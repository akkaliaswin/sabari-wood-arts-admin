import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const { labourerId, carpenterName, workDescription, amount, paymentDate, remarks, workItemId } = body;

    let finalLabourerId = labourerId || null;
    let finalCarpenterName = carpenterName;

    if (finalLabourerId) {
      const labourer = await prisma.labourer.findUnique({ where: { id: finalLabourerId } });
      if (labourer) {
        finalCarpenterName = labourer.name;
      }
    }

    if (!finalCarpenterName || !amount || !paymentDate) {
      return NextResponse.json({ error: 'Labourer Name, Amount, and Payment Date are required' }, { status: 400 });
    }

    const newLabour = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cost = await tx.labourCost.create({
        data: {
          projectId,
          workItemId: workItemId || null,
          labourerId: finalLabourerId,
          carpenterName: finalCarpenterName,
          workDescription: workDescription || null,
          amount: Number(amount),
          paymentDate: new Date(paymentDate),
          remarks: remarks || null,
        },
      });

      await tx.projectActivity.create({
        data: {
          projectId,
          activityType: 'LABOUR_ADDED',
          description: `Labour cost logged for ${finalCarpenterName} (Amount paid: ₹${amount}, Work: ${workDescription || 'N/A'})`,
        },
      });

      return cost;
    });

    return NextResponse.json(newLabour, { status: 201 });
  } catch (error: any) {
    console.error('Error creating labour cost:', error);
    return NextResponse.json({ error: 'Failed to create labour cost' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const { itemId, labourerId, carpenterName, workDescription, amount, paymentDate, remarks, workItemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    let finalLabourerId = labourerId;
    let finalCarpenterName = carpenterName;

    if (finalLabourerId) {
      const labourer = await prisma.labourer.findUnique({ where: { id: finalLabourerId } });
      if (labourer) {
        finalCarpenterName = labourer.name;
      }
    }

    const updatedLabour = await prisma.labourCost.update({
      where: { id: itemId, projectId },
      data: {
        workItemId: workItemId !== undefined ? (workItemId || null) : undefined,
        labourerId: finalLabourerId !== undefined ? (finalLabourerId || null) : undefined,
        carpenterName: finalCarpenterName,
        workDescription,
        amount: amount !== undefined ? Number(amount) : undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        remarks,
      },
    });

    return NextResponse.json(updatedLabour);
  } catch (error: any) {
    console.error('Error updating labour cost:', error);
    return NextResponse.json({ error: 'Failed to update labour cost' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const currentLabour = await prisma.labourCost.findUnique({
      where: { id: itemId },
    });

    if (currentLabour) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.projectActivity.create({
          data: {
            projectId,
            activityType: 'LABOUR_DELETED',
            description: `Labour cost entry deleted: ${currentLabour.carpenterName} (Amount: ₹${currentLabour.amount})`,
          },
        });

        await tx.labourCost.delete({
          where: {
            id: itemId,
            projectId,
          },
        });
      });
    }

    return NextResponse.json({ message: 'Labour cost deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting labour cost:', error);
    return NextResponse.json({ error: 'Failed to delete labour cost' }, { status: 500 });
  }
}

