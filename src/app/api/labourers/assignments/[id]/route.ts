import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { isActive, unassignedDate, remarks } = body;

    const currentAssignment = await prisma.projectLabourAssignment.findUnique({
      where: { id },
    });

    if (!currentAssignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const defaultEnd = new Date(Date.UTC(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate()));

    const updatedAssignment = await prisma.$transaction(async (tx) => {
      // Log unassignment activity if status changed to inactive
      if (currentAssignment.isActive && isActive === false) {
        const lab = await tx.labourer.findUnique({
          where: { id: currentAssignment.labourerId },
          select: { name: true, labourCode: true },
        });
        await tx.projectActivity.create({
          data: {
            projectId: currentAssignment.projectId,
            activityType: 'LABOUR_UNASSIGNED',
            description: `Labourer ${lab?.name} (${lab?.labourCode}) unassigned from project.`,
          },
        });
      }

      return tx.projectLabourAssignment.update({
        where: { id },
        data: {
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          unassignedDate: unassignedDate ? new Date(unassignedDate) : (isActive === false ? defaultEnd : undefined),
          remarks: remarks !== undefined ? (remarks || null) : undefined,
        },
      });
    });

    return NextResponse.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const assignment = await prisma.projectLabourAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment record not found' }, { status: 404 });
    }

    await prisma.projectLabourAssignment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Assignment record deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json({ error: 'Failed to delete assignment record' }, { status: 500 });
  }
}
