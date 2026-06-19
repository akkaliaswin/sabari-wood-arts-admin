import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const searchField = searchParams.get('searchField') || ''; // 'name' or 'phone'
    const skill = searchParams.get('skill') || '';

    const whereClause: any = {};
    if (skill) {
      whereClause.skillType = skill;
    }

    if (search) {
      if (searchField === 'name') {
        whereClause.name = { contains: search, mode: 'insensitive' };
      } else if (searchField === 'phone') {
        whereClause.phone = { contains: search, mode: 'insensitive' };
      } else {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    const labourers = await prisma.labourer.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(labourers);
  } catch (error) {
    console.error('Error fetching labourers:', error);
    return NextResponse.json({ error: 'Failed to fetch labourers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, address, skillType, joiningDate, activeStatus, notes } = body;

    if (!name || !phone || !skillType) {
      return NextResponse.json({ error: 'Name, Phone, and Skill Type are required' }, { status: 400 });
    }

    // Phone validations: Exactly 10 digits, only digits allowed.
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const newLabourer = await prisma.labourer.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        address: address || null,
        skillType,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        activeStatus: activeStatus !== undefined ? Boolean(activeStatus) : true,
        notes: notes || null,
      },
    });

    return NextResponse.json(newLabourer, { status: 201 });
  } catch (error) {
    console.error('Error creating labourer:', error);
    return NextResponse.json({ error: 'Failed to create labourer' }, { status: 500 });
  }
}
