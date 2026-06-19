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
    const { paymentDate, amount, paymentMode, referenceNumber, remarks } = body;

    if (!paymentDate || !amount || !paymentMode) {
      return NextResponse.json({ error: 'Payment Date, Amount, and Payment Mode are required' }, { status: 400 });
    }

    const validModes = ['Cash', 'Bank Transfer', 'UPI', 'Cheque'];
    if (!validModes.includes(paymentMode)) {
      return NextResponse.json({ error: `Payment Mode must be one of: ${validModes.join(', ')}` }, { status: 400 });
    }

    const newPayment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pay = await tx.payment.create({
        data: {
          projectId,
          paymentDate: new Date(paymentDate),
          amount: Number(amount),
          paymentMode,
          referenceNumber: referenceNumber || null,
          remarks: remarks || null,
        },
      });

      await tx.projectActivity.create({
        data: {
          projectId,
          activityType: 'PAYMENT_RECEIVED',
          description: `Payment received: ₹${amount} via ${paymentMode} (Ref: ${referenceNumber || 'N/A'})`,
        },
      });

      return pay;
    });

    return NextResponse.json(newPayment, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const { itemId, paymentDate, amount, paymentMode, referenceNumber, remarks } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    if (paymentMode) {
      const validModes = ['Cash', 'Bank Transfer', 'UPI', 'Cheque'];
      if (!validModes.includes(paymentMode)) {
        return NextResponse.json({ error: `Payment Mode must be one of: ${validModes.join(', ')}` }, { status: 400 });
      }
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: itemId, projectId },
      data: {
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        amount: amount !== undefined ? Number(amount) : undefined,
        paymentMode,
        referenceNumber,
        remarks,
      },
    });

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
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

    const currentPayment = await prisma.payment.findUnique({
      where: { id: itemId },
    });

    if (currentPayment) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.projectActivity.create({
          data: {
            projectId,
            activityType: 'PAYMENT_DELETED',
            description: `Payment record deleted: ₹${currentPayment.amount} via ${currentPayment.paymentMode}`,
          },
        });

        await tx.payment.delete({
          where: {
            id: itemId,
            projectId,
          },
        });
      });
    }

    return NextResponse.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}

