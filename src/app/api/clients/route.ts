import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const searchField = searchParams.get('searchField') || ''; // 'name' or 'phone'

    const whereClause: any = { deletedAt: null };

    if (search) {
      if (searchField === 'name') {
        whereClause.name = { contains: search, mode: 'insensitive' };
      } else if (searchField === 'phone') {
        whereClause.phone = { contains: search, mode: 'insensitive' };
      } else {
        // Fallback generic search
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(clients, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, alternatePhone, location, address, referredBy, remarks } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
    }

    // Phone validations: Exactly 10 digits, only digits allowed.
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }
    if (alternatePhone && alternatePhone.trim() && !phoneRegex.test(alternatePhone.trim())) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const newClient = await prisma.client.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        alternatePhone: alternatePhone ? alternatePhone.trim() : null,
        location: location ? location.trim() : null,
        address: address ? address.trim() : null,
        referredBy: referredBy ? referredBy.trim() : null,
        remarks: remarks ? remarks.trim() : null,
      },
    });

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
