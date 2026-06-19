import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const { purchaseDate, materialName, vendor, quantity, unit, amount, billNumber, remarks, workItemId } = body;

    if (!purchaseDate || !materialName || !amount) {
      return NextResponse.json({ error: 'Purchase Date, Material Name, and Amount are required' }, { status: 400 });
    }

    const newMaterial = await prisma.$transaction(async (tx: {
      materialPurchase: { create: (args: any) => Promise<any> };
      projectActivity: { create: (args: any) => Promise<any> };
    }) => {
      const mat = await tx.materialPurchase.create({
        data: {
          projectId,
          workItemId: workItemId || null,
          purchaseDate: new Date(purchaseDate),
          materialName,
          vendor: vendor || null,
          quantity: quantity ? Number(quantity) : 1.0,
          unit: unit || null,
          amount: Number(amount),
          billNumber: billNumber || null,
          remarks: remarks || null,
        },
      });

      await tx.projectActivity.create({
        data: {
          projectId,
          activityType: 'MATERIAL_ADDED',
          description: `Material purchase logged: ${materialName} (Amount: ₹${amount}, Vendor: ${vendor || 'N/A'})`,
        },
      });

      return mat;
    });

    return NextResponse.json(newMaterial, { status: 201 });
  } catch (error: any) {
    console.error('Error creating material purchase:', error);
    return NextResponse.json({ error: 'Failed to create material purchase' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const { itemId, purchaseDate, materialName, vendor, quantity, unit, amount, billNumber, remarks, workItemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const updatedMaterial = await prisma.materialPurchase.update({
      where: { id: itemId, projectId },
      data: {
        workItemId: workItemId !== undefined ? (workItemId || null) : undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        materialName,
        vendor,
        quantity: quantity !== undefined ? Number(quantity) : undefined,
        unit,
        amount: amount !== undefined ? Number(amount) : undefined,
        billNumber,
        remarks,
      },
    });

    return NextResponse.json(updatedMaterial);
  } catch (error) {
    console.error('Error updating material purchase:', error);
    return NextResponse.json({ error: 'Failed to update material purchase' }, { status: 500 });
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

    const currentMat = await prisma.materialPurchase.findUnique({
      where: { id: itemId },
    });

    if (currentMat) {
      await prisma.$transaction(async (tx: {
        projectActivity: { create: (args: any) => Promise<any> };
        materialPurchase: { delete: (args: any) => Promise<any> };
      }) => {
        await tx.projectActivity.create({
          data: {
            projectId,
            activityType: 'MATERIAL_DELETED',
            description: `Material purchase deleted: ${currentMat.materialName} (Amount: ₹${currentMat.amount})`,
          },
        });

        await tx.materialPurchase.delete({
          where: {
            id: itemId,
            projectId,
          },
        });
      });
    }

    return NextResponse.json({ message: 'Material purchase deleted successfully' });
  } catch (error) {
    console.error('Error deleting material purchase:', error);
    return NextResponse.json({ error: 'Failed to delete material purchase' }, { status: 500 });
  }
}

