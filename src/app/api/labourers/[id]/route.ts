import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const labourer = await prisma.labourer.findUnique({
      where: { id },
      include: {
        labourCosts: {
          include: {
            project: {
              select: {
                id: true,
                projectName: true,
                projectCode: true,
              },
            },
            workItem: {
              select: {
                id: true,
                workType: true,
                workCode: true,
              },
            },
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!labourer) {
      return NextResponse.json({ error: 'Labourer profile not found' }, { status: 404 });
    }

    // Dynamic metrics
    const totalPaid = labourer.labourCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
    
    // Unique projects worked on
    const uniqueProjectIds = new Set(labourer.labourCosts.map(cost => cost.projectId));
    const projectsCount = uniqueProjectIds.size;

    return NextResponse.json({
      ...labourer,
      totalPaid,
      projectsCount,
    });
  } catch (error: any) {
    console.error('Error fetching labourer details:', error);
    return NextResponse.json({ error: 'Failed to fetch labourer details' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, address, skillType, joiningDate, activeStatus, notes } = body;

    if (!name || !phone || !skillType) {
      return NextResponse.json({ error: 'Name, Phone, and Skill Type are required' }, { status: 400 });
    }

    const updatedLabourer = await prisma.labourer.update({
      where: { id },
      data: {
        name,
        phone,
        address,
        skillType,
        joiningDate: joiningDate ? new Date(joiningDate) : undefined,
        activeStatus: activeStatus !== undefined ? Boolean(activeStatus) : undefined,
        notes,
      },
    });

    return NextResponse.json(updatedLabourer);
  } catch (error: any) {
    console.error('Error updating labourer profile:', error);
    return NextResponse.json({ error: 'Failed to update labourer profile' }, { status: 500 });
  }
}
