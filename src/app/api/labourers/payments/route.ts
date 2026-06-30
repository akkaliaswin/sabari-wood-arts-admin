import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const labourerId = searchParams.get('labourerId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const whereClause: any = {};

    if (labourerId) {
      whereClause.labourerId = labourerId;
    }

    if (startDate || endDate) {
      whereClause.paymentDate = {};
      if (startDate) {
        whereClause.paymentDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.paymentDate.lte = new Date(endDate);
      }
    }

    const payments = await prisma.labourPayment.findMany({
      where: whereClause,
      include: {
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
        paymentDate: 'desc',
      },
    });

    return NextResponse.json(payments, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Error fetching labour payments:', error);
    return NextResponse.json({ error: 'Failed to fetch labour payments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { labourerId, paymentDate, amount, paymentType, remarks } = body;

    if (!labourerId || !paymentDate || amount === undefined || !paymentType) {
      return NextResponse.json(
        { error: 'Labourer ID, Payment Date, Amount, and Payment Type are required.' },
        { status: 400 }
      );
    }

    if (Number(amount) <= 0 && paymentType !== 'Adjustment') {
      return NextResponse.json(
        { error: 'Amount must be greater than zero for standard payments.' },
        { status: 400 }
      );
    }

    // Verify labourer exists
    const labourer = await prisma.labourer.findUnique({
      where: { id: labourerId },
    });
    if (!labourer) {
      return NextResponse.json({ error: 'Labourer profile not found.' }, { status: 404 });
    }

    const newPayment = await prisma.labourPayment.create({
      data: {
        labourerId,
        paymentDate: new Date(paymentDate),
        amount: Number(amount),
        paymentType,
        remarks: remarks || null,
      },
    });

    return NextResponse.json(newPayment, { status: 201 });
  } catch (error) {
    console.error('Error creating labour payment:', error);
    return NextResponse.json({ error: 'Failed to create labour payment' }, { status: 500 });
  }
}
