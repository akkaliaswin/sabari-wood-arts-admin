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
    const { workType, description, quantity, unitPrice, sellingPrice, status, remarks } = body;

    if (!workType) {
      return NextResponse.json({ error: 'Work Type is required' }, { status: 400 });
    }

    const qty = quantity ? Number(quantity) : 1.0;
    const price = unitPrice ? Number(unitPrice) : 0.0;
    const totalPrice = qty * price;
    const sellPrice = sellingPrice !== undefined ? Number(sellingPrice) : totalPrice;

    const newWorkItem = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const item = await tx.workItem.create({
        data: {
          projectId,
          workType,
          description: description || null,
          quantity: qty,
          unitPrice: price,
          totalPrice,
          sellingPrice: sellPrice,
          status: status || 'Pending',
          remarks: remarks || null,
        },
      });

      await tx.projectActivity.create({
        data: {
          projectId,
          activityType: 'WORK_ITEM_ADDED',
          description: `Work Item added: ${workType} (Qty: ${qty}, Price: ₹${price}, Selling Price: ₹${sellPrice})`,
        },
      });

      return item;
    });

    return NextResponse.json(newWorkItem, { status: 201 });
  } catch (error: any) {
    console.error('Error creating work item:', error);
    return NextResponse.json({ error: 'Failed to create work item' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const { itemId, workType, description, quantity, unitPrice, sellingPrice, status, remarks } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const currentItem = await prisma.workItem.findUnique({
      where: { id: itemId },
    });

    if (!currentItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 });
    }

    const qty = quantity !== undefined ? Number(quantity) : undefined;
    const price = unitPrice !== undefined ? Number(unitPrice) : undefined;
    const sellPrice = sellingPrice !== undefined ? Number(sellingPrice) : undefined;
    
    let totalPrice = undefined;
    if (qty !== undefined || price !== undefined) {
      const finalQty = qty !== undefined ? qty : Number(currentItem.quantity);
      const finalPrice = price !== undefined ? price : Number(currentItem.unitPrice);
      totalPrice = finalQty * finalPrice;
    }

    const updatedWorkItem = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const isStatusChanged = status && status !== currentItem.status;

      if (isStatusChanged) {
        // Log Work Item Status History
        await tx.workItemStatusHistory.create({
          data: {
            workItemId: itemId,
            previousStatus: currentItem.status,
            newStatus: status,
          },
        });

        // Log Work Item Status Activity
        await tx.projectActivity.create({
          data: {
            projectId,
            activityType: 'WORK_ITEM_STATUS_CHANGED',
            description: `Work Item '${workType || currentItem.workType}' status changed from '${currentItem.status}' to '${status}'.`,
          },
        });
      } else {
        // Log Work Item Details Updated Activity
        await tx.projectActivity.create({
          data: {
            projectId,
            activityType: 'WORK_ITEM_UPDATED',
            description: `Work Item '${workType || currentItem.workType}' details were updated.`,
          },
        });
      }

      const updated = await tx.workItem.update({
        where: { id: itemId, projectId },
        data: {
          workType,
          description,
          quantity: qty,
          unitPrice: price,
          totalPrice,
          sellingPrice: sellPrice,
          status,
          remarks,
        },
      });

      return updated;
    });

    return NextResponse.json(updatedWorkItem);
  } catch (error) {
    console.error('Error updating work item:', error);
    return NextResponse.json({ error: 'Failed to update work item' }, { status: 500 });
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

    const currentItem = await prisma.workItem.findUnique({
      where: { id: itemId },
    });

    if (currentItem) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.projectActivity.create({
          data: {
            projectId,
            activityType: 'WORK_ITEM_DELETED',
            description: `Work Item '${currentItem.workType}' was removed from scope.`,
          },
        });

        await tx.workItem.delete({
          where: {
            id: itemId,
            projectId,
          },
        });
      });
    }

    return NextResponse.json({ message: 'Work item deleted successfully' });
  } catch (error) {
    console.error('Error deleting work item:', error);
    return NextResponse.json({ error: 'Failed to delete work item' }, { status: 500 });
  }
}

