import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const DEFAULT_TYPES = [
  'Kitchen',
  'Wardrobe',
  'Doors',
  'Windows',
  'False Ceiling',
  'TV Unit',
  'Dining Table',
  'Custom',
];

export async function GET(req: NextRequest) {
  try {
    let types = await prisma.workItemType.findMany({
      orderBy: { name: 'asc' },
    });

    // Auto-seed defaults if table is empty
    if (types.length === 0) {
      await prisma.workItemType.createMany({
        data: DEFAULT_TYPES.map(name => ({ name })),
        skipDuplicates: true,
      });
      types = await prisma.workItemType.findMany({
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json(types, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Error fetching work item types:', error);
    return NextResponse.json({ error: 'Failed to fetch work item types' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Case-insensitive duplicate check
    const existing = await prisma.workItemType.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Work item type "${trimmedName}" already exists.` }, { status: 400 });
    }

    const newType = await prisma.workItemType.create({
      data: { name: trimmedName },
    });

    return NextResponse.json(newType, { status: 201 });
  } catch (error) {
    console.error('Error creating work item type:', error);
    return NextResponse.json({ error: 'Failed to create work item type' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, isDisabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const currentType = await prisma.workItemType.findUnique({
      where: { id },
    });

    if (!currentType) {
      return NextResponse.json({ error: 'Work item type not found' }, { status: 404 });
    }

    const data: any = {};
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }

      // Check case-insensitive duplicate if name is changing
      if (trimmedName.toLowerCase() !== currentType.name.toLowerCase()) {
        const existing = await prisma.workItemType.findFirst({
          where: {
            name: { equals: trimmedName, mode: 'insensitive' },
          },
        });
        if (existing) {
          return NextResponse.json({ error: `Work item type "${trimmedName}" already exists.` }, { status: 400 });
        }
      }
      data.name = trimmedName;
    }

    if (isDisabled !== undefined) {
      data.isDisabled = Boolean(isDisabled);
    }

    const updated = await prisma.workItemType.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating work item type:', error);
    return NextResponse.json({ error: 'Failed to update work item type' }, { status: 500 });
  }
}
