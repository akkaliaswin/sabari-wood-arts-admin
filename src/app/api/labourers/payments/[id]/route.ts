import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { paymentDate, amount, paymentType, remarks } = body;

    const existingPayment = await prisma.labourPayment.findUnique({
      where: { id },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'Labour payment record not found.' }, { status: 404 });
    }

    const data: any = {};
    if (paymentDate !== undefined) data.paymentDate = new Date(paymentDate);
    if (amount !== undefined) data.amount = Number(amount);
    if (paymentType !== undefined) data.paymentType = paymentType;
    if (remarks !== undefined) data.remarks = remarks || null;

    const updatedPayment = await prisma.labourPayment.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error('Error updating labour payment:', error);
    return NextResponse.json({ error: 'Failed to update labour payment' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingPayment = await prisma.labourPayment.findUnique({
      where: { id },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'Labour payment record not found.' }, { status: 404 });
    }

    await prisma.labourPayment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Labour payment record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting labour payment:', error);
    return NextResponse.json({ error: 'Failed to delete labour payment' }, { status: 500 });
  }
}
