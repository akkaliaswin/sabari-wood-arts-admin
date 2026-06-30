import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WorkItem, MaterialPurchase, Payment, LabourCost } from '@/types/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            clientCode: true,
            phone: true,
            location: true,
          },
        },
        workItems: {
          include: {
            statusHistory: {
              orderBy: { updatedAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        materialPurchases: {
          include: {
            workItem: {
              select: {
                id: true,
                workType: true,
                workCode: true,
              },
            },
          },
          orderBy: { purchaseDate: 'desc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        labourCosts: {
          include: {
            workItem: {
              select: {
                id: true,
                workType: true,
                workCode: true,
              },
            },
            labourer: {
              select: {
                id: true,
                name: true,
                labourCode: true,
              },
            },
          },
          orderBy: { paymentDate: 'desc' },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Dynamic calculations
    const receivedAmount = project.payments.reduce((sum: number, p: Payment) => sum + Number(p.amount), 0);
    const materialCost = project.materialPurchases.reduce((sum: number, m: MaterialPurchase) => sum + Number(m.amount), 0);
    const labourCost = project.labourCosts.reduce((sum: number, l: LabourCost) => sum + Number(l.amount), 0);
    
    // Map work items to compute item profitability dynamically
    const formattedWorkItems = project.workItems.map((item: WorkItem) => {
      const itemMaterials = project.materialPurchases
        .filter((m: MaterialPurchase) => m.workItemId === item.id)
        .reduce((sum: number, m: MaterialPurchase) => sum + Number(m.amount), 0);
        
      const itemLabour = project.labourCosts
        .filter((l: LabourCost) => l.workItemId === item.id)
        .reduce((sum: number, l: LabourCost) => sum + Number(l.amount), 0);
        
      const sellPrice = Number(item.sellingPrice);
      const actualCost = Number((item as any).actualCost || 0);
      const profit = sellPrice - actualCost;
      const marginPercentage = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
      
      return {
        ...item,
        materialCost: itemMaterials,
        labourCost: itemLabour,
        profit,
        marginPercentage,
      };
    });

    const totalRevenue = project.workItems.reduce((sum: number, item: WorkItem) => sum + Number(item.sellingPrice), 0);
    const profit = Number(project.quotedAmount) - materialCost - labourCost; // Profit = Quoted Amount - Material - Labour
    const marginPercentage = Number(project.quotedAmount) > 0 ? (profit / Number(project.quotedAmount)) * 100 : 0;
    const pendingCollection = project.status === 'Cancelled' ? 0 : Math.max(0, Number(project.quotedAmount) - receivedAmount);

    return NextResponse.json({
      ...project,
      workItems: formattedWorkItems,
      receivedAmount,
      materialCost,
      labourCost,
      totalRevenue,
      profit,
      marginPercentage,
      pendingCollection,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
    return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
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

    const currentProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!currentProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const finalProjectName = projectName || currentProject.projectName;

    const updatedProject = await prisma.$transaction(async (tx: {
      projectStatusHistory: { create: (args: any) => Promise<any> };
      projectActivity: { create: (args: any) => Promise<any> };
      project: { update: (args: any) => Promise<any> };
    }) => {
      const isStatusChanged = status && status !== currentProject.status;

      if (isStatusChanged) {
        // Create Project Status History
        await tx.projectStatusHistory.create({
          data: {
            projectId: id,
            previousStatus: currentProject.status,
            newStatus: status,
          },
        });

        // Log Project Status Changed Activity
        await tx.projectActivity.create({
          data: {
            projectId: id,
            activityType: 'PROJECT_STATUS_CHANGED',
            description: `Project status changed from '${currentProject.status}' to '${status}'.`,
          },
        });
      }

      const updated = await tx.project.update({
        where: { id },
        data: {
          projectName: finalProjectName,
          projectType: projectType !== undefined ? (projectType || null) : undefined,
          projectLocation: projectLocation !== undefined ? (projectLocation || null) : undefined,
          status: status || undefined,
          quotedAmount: quotedAmount !== undefined ? (quotedAmount !== null && quotedAmount !== '' ? Number(quotedAmount) : null) : undefined,
          startDate: startDate ? new Date(startDate) : (startDate === null ? null : undefined),
          expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : (expectedCompletionDate === null ? null : undefined),
          actualCompletionDate: actualCompletionDate ? new Date(actualCompletionDate) : (actualCompletionDate === null ? null : undefined),
          notes: notes !== undefined ? (notes || null) : undefined,
        },
      });

      return updated;
    });

    return NextResponse.json(updatedProject);
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const softDeletedProject = await prisma.project.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'Project soft-deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

