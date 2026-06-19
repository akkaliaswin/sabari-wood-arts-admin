import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const projectId = searchParams.get('projectId') || '';
    const clientId = searchParams.get('clientId') || '';
    const workType = searchParams.get('workType') || '';

    // Build query filters for projects
    const projectWhereClause: any = {
      deletedAt: null,
      client: {
        deletedAt: null,
      },
    };

    if (projectId) {
      projectWhereClause.id = projectId;
    }
    if (clientId) {
      projectWhereClause.clientId = clientId;
    }

    // Fetch matching projects with sub-resources
    const projects = await prisma.project.findMany({
      where: projectWhereClause,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            clientCode: true,
          },
        },
        workItems: {
          where: workType ? { workType } : undefined,
        },
        materialPurchases: true,
        labourCosts: true,
      },
    });

    const parsedStart = startDate ? new Date(startDate) : null;
    const parsedEnd = endDate ? new Date(endDate) : null;

    if (parsedStart) parsedStart.setHours(0, 0, 0, 0);
    if (parsedEnd) parsedEnd.setHours(23, 59, 59, 999);

    let totalRevenue = 0;
    let totalMaterialCost = 0;
    let totalLabourCost = 0;

    const reportRows: any[] = [];

    // Aggregate report data dynamically
    projects.forEach((proj) => {
      // 1. Filter and sum Work Items (Revenue)
      let projWorkItems = proj.workItems;
      if (parsedStart || parsedEnd) {
        projWorkItems = projWorkItems.filter((item) => {
          const itemDate = new Date(item.createdAt);
          if (parsedStart && itemDate < parsedStart) return false;
          if (parsedEnd && itemDate > parsedEnd) return false;
          return true;
        });
      }
      
      const projRevenue = projWorkItems.reduce((sum, item) => sum + Number(item.sellingPrice), 0);
      
      // Get set of matching work item IDs to filter expenses
      const matchedWorkItemIds = new Set(projWorkItems.map((item) => item.id));

      // 2. Filter and sum Material Purchases
      let projMaterials = proj.materialPurchases;
      
      // If workType filter is active, only count materials linked to matched work items
      if (workType) {
        projMaterials = projMaterials.filter((m) => m.workItemId && matchedWorkItemIds.has(m.workItemId));
      }
      
      if (parsedStart || parsedEnd) {
        projMaterials = projMaterials.filter((m) => {
          const mDate = new Date(m.purchaseDate);
          if (parsedStart && mDate < parsedStart) return false;
          if (parsedEnd && mDate > parsedEnd) return false;
          return true;
        });
      }
      
      const projMaterialCost = projMaterials.reduce((sum, m) => sum + Number(m.amount), 0);

      // 3. Filter and sum Labour Costs
      let projLabour = proj.labourCosts;
      
      // If workType filter is active, only count labour linked to matched work items
      if (workType) {
        projLabour = projLabour.filter((l) => l.workItemId && matchedWorkItemIds.has(l.workItemId));
      }
      
      if (parsedStart || parsedEnd) {
        projLabour = projLabour.filter((l) => {
          const lDate = new Date(l.paymentDate);
          if (parsedStart && lDate < parsedStart) return false;
          if (parsedEnd && lDate > parsedEnd) return false;
          return true;
        });
      }
      
      const projLabourCost = projLabour.reduce((sum, l) => sum + Number(l.amount), 0);

      // Calculate totals for project row
      const profit = projRevenue - projMaterialCost - projLabourCost;
      const margin = projRevenue > 0 ? (profit / projRevenue) * 100 : 0;

      // Only push to report if there is active revenue or costs in this timeframe
      if (projRevenue > 0 || projMaterialCost > 0 || projLabourCost > 0) {
        totalRevenue += projRevenue;
        totalMaterialCost += projMaterialCost;
        totalLabourCost += projLabourCost;

        reportRows.push({
          projectId: proj.id,
          projectCode: proj.projectCode,
          projectName: proj.projectName,
          clientName: proj.client.name,
          clientCode: proj.client.clientCode,
          revenue: projRevenue,
          materialCost: projMaterialCost,
          labourCost: projLabourCost,
          profit,
          marginPercentage: margin,
        });
      }
    });

    const totalProfit = totalRevenue - totalMaterialCost - totalLabourCost;
    const totalMarginPercentage = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalMaterialCost,
        totalLabourCost,
        totalProfit,
        totalMarginPercentage,
      },
      rows: reportRows,
    });
  } catch (error: any) {
    console.error('Error generating reports:', error);
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 });
  }
}
