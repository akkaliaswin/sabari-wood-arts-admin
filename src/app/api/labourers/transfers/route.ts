import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch all assignments (active and inactive) with project and labourer details
    const assignments = await prisma.projectLabourAssignment.findMany({
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true,
          },
        },
        labourer: {
          select: {
            id: true,
            name: true,
            labourCode: true,
            skillType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by labourer
    const labourerGroups: Record<string, typeof assignments> = {};
    assignments.forEach((assignment) => {
      const lid = assignment.labourerId;
      if (!labourerGroups[lid]) {
        labourerGroups[lid] = [];
      }
      labourerGroups[lid].push(assignment);
    });

    // Build transfers list
    const transfers: {
      id: string;
      date: string;
      workerName: string;
      workerCode: string;
      fromProject: string;
      toProject: string;
      reason: string;
    }[] = [];

    Object.values(labourerGroups).forEach((list) => {
      // Sort by assignedDate ascending, then by createdAt ascending
      list.sort((a, b) => new Date(a.assignedDate).getTime() - new Date(b.assignedDate).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const curr = list[i];

        // If project changed, it's a transfer!
        if (prev.projectId !== curr.projectId) {
          transfers.push({
            id: `${prev.id}-${curr.id}`,
            date: curr.assignedDate.toISOString().split('T')[0],
            workerName: curr.labourer.name,
            workerCode: curr.labourer.labourCode,
            fromProject: prev.project.projectName,
            toProject: curr.project.projectName,
            reason: curr.remarks || 'Workforce transfer',
          });
        }
      }
    });

    // Sort transfers by date descending
    transfers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(transfers);
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
  }
}
