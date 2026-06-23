import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') || '';
    const labourerId = searchParams.get('labourerId') || '';
    const isActiveStr = searchParams.get('isActive');

    const whereClause: {
      projectId?: string;
      labourerId?: string;
      isActive?: boolean;
    } = {};

    if (projectId) {
      whereClause.projectId = projectId;
    }
    if (labourerId) {
      whereClause.labourerId = labourerId;
    }
    if (isActiveStr !== null && isActiveStr !== undefined && isActiveStr !== '') {
      whereClause.isActive = isActiveStr === 'true';
    }

    const assignments = await prisma.projectLabourAssignment.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true,
            status: true,
          },
        },
        labourer: {
          select: {
            id: true,
            name: true,
            labourCode: true,
            skillType: true,
            activeStatus: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { assignedDate: 'desc' },
      ],
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, labourerId, role, remarks } = body;

    if (!projectId || !labourerId || !role) {
      return NextResponse.json({ error: 'Project, Labourer, and Role are required' }, { status: 400 });
    }

    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const today = new Date(Date.UTC(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate()));

    // Run transaction to close old active assignment and create new one
    const newAssignment = await prisma.$transaction(async (tx) => {
      // Find active assignment
      const activeAssignment = await tx.projectLabourAssignment.findFirst({
        where: {
          labourerId,
          isActive: true,
        },
      });

      if (activeAssignment) {
        // If already assigned to the target project actively, prevent duplicate
        if (activeAssignment.projectId === projectId) {
          throw new Error('Labourer is already actively assigned to this project.');
        }

        // Close the old assignment
        await tx.projectLabourAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            isActive: false,
            unassignedDate: today,
          },
        });

        // Log Project Activity for transferring
        const oldProject = await tx.project.findUnique({
          where: { id: activeAssignment.projectId },
          select: { projectName: true, projectCode: true },
        });
        const newProject = await tx.project.findUnique({
          where: { id: projectId },
          select: { projectName: true, projectCode: true },
        });
        const lab = await tx.labourer.findUnique({
          where: { id: labourerId },
          select: { name: true, labourCode: true },
        });

        const reasonText = remarks ? ` Reason: ${remarks}` : '';
        await tx.projectActivity.create({
          data: {
            projectId: activeAssignment.projectId,
            activityType: 'LABOUR_TRANSFERRED',
            description: `Labourer ${lab?.name} (${lab?.labourCode}) transferred to project '${newProject?.projectName}' (${newProject?.projectCode}).${reasonText}`,
          },
        });

        await tx.projectActivity.create({
          data: {
            projectId,
            activityType: 'LABOUR_ASSIGNED',
            description: `Labourer ${lab?.name} (${lab?.labourCode}) transferred from project '${oldProject?.projectName}' (${oldProject?.projectCode}).${reasonText}`,
          },
        });
      } else {
        // Log simple assign activity
        const lab = await tx.labourer.findUnique({
          where: { id: labourerId },
          select: { name: true, labourCode: true },
        });
        await tx.projectActivity.create({
          data: {
            projectId,
            activityType: 'LABOUR_ASSIGNED',
            description: `Labourer ${lab?.name} (${lab?.labourCode}) assigned to project with role '${role}'.`,
          },
        });
      }

      // Create new assignment
      return tx.projectLabourAssignment.create({
        data: {
          projectId,
          labourerId,
          role,
          remarks: remarks || null,
          assignedDate: today,
          isActive: true,
        },
      });
    });

    return NextResponse.json(newAssignment);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to save labourer assignment';
    console.error('Error creating assignment:', error);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
