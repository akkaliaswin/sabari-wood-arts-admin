import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Project, Prisma } from '@prisma/client';

type ProjectWithPayments = Project & {
  payments: { amount: Prisma.Decimal }[];
  client: {
    id: string;
    name: string;
    clientCode: string;
    phone: string;
  };
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        client: {
          deletedAt: null, // Only fetch projects for non-deleted clients
        },
        status: status ? status : undefined,
        OR: search
          ? [
              { projectName: { contains: search, mode: 'insensitive' } },
              { projectCode: { contains: search, mode: 'insensitive' } },
              { client: { name: { contains: search, mode: 'insensitive' } } },
              { projectLocation: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            clientCode: true,
            phone: true,
          },
        },
        payments: {
          select: { amount: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map projects to include calculated simple fields (like total payments received so far)
    const formattedProjects = (projects as unknown as ProjectWithPayments[]).map((p: ProjectWithPayments) => {
      const receivedAmount = p.payments.reduce((sum: number, pay: { amount: Prisma.Decimal }) => sum + Number(pay.amount), 0);
      const pendingCollection = Number(p.quotedAmount) - receivedAmount;
      return {
        ...p,
        receivedAmount,
        pendingCollection,
      };
    });

    return NextResponse.json(formattedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientId,
      projectName,
      projectType,
      projectLocation,
      status,
      quotedAmount,
      startDate,
      expectedCompletionDate,
      actualCompletionDate,
      notes,
    } = body;

    if (!clientId || !projectName) {
      return NextResponse.json({ error: 'Client ID and Project Name are required' }, { status: 400 });
    }

    const newProject = await prisma.project.create({
      data: {
        clientId,
        projectName,
        projectType: projectType || null,
        projectLocation: projectLocation || null,
        status: status || 'Lead',
        quotedAmount: quotedAmount ? Number(quotedAmount) : 0.0,
        startDate: startDate ? new Date(startDate) : null,
        expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : null,
        actualCompletionDate: actualCompletionDate ? new Date(actualCompletionDate) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
