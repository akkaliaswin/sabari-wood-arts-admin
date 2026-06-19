import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma, Project, WorkItem, MaterialPurchase, LabourCost } from '@prisma/client';

export interface ReportRow {
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  clientCode: string;
  revenue: number;
  materialCost: number;
  labourCost: number;
  profit: number;
  marginPercentage: number;
}

export type ProjectReportPayload = Project & {
  client: {
    id: string;
    name: string;
    clientCode: string;
  };
  workItems: WorkItem[];
  materialPurchases: MaterialPurchase[];
  labourCosts: LabourCost[];
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const projectId = searchParams.get('projectId') || '';
    const clientId = searchParams.get('clientId') || '';
    const workType = searchParams.get('workType') || '';

    // Build query filters for projects
    const projectWhereClause: Prisma.ProjectWhereInput = {
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
    const projects: ProjectReportPayload[] = await prisma.project.findMany({
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
    }) as unknown as ProjectReportPayload[];

    const parsedStart = startDate ? new Date(startDate) : null;
    const parsedEnd = endDate ? new Date(endDate) : null;

    if (parsedStart) parsedStart.setHours(0, 0, 0, 0);
    if (parsedEnd) parsedEnd.setHours(23, 59, 59, 999);

    let totalRevenue = 0;
    let totalMaterialCost = 0;
    let totalLabourCost = 0;

    const reportRows: ReportRow[] = [];

    // Aggregate report data dynamically
    projects.forEach((proj: ProjectReportPayload) => {
      // 1. Filter and sum Work Items (Revenue)
      let projWorkItems = proj.workItems;
      if (parsedStart || parsedEnd) {
        projWorkItems = projWorkItems.filter((item: WorkItem) => {
          const itemDate = new Date(item.createdAt);
          if (parsedStart && itemDate < parsedStart) return false;
          if (parsedEnd && itemDate > parsedEnd) return false;
          return true;
        });
      }
      
      const projRevenue = projWorkItems.reduce((sum: number, item: WorkItem) => sum + Number(item.sellingPrice), 0);
      
      // Get set of matching work item IDs to filter expenses
      const matchedWorkItemIds = new Set(projWorkItems.map((item: WorkItem) => item.id));

      // 2. Filter and sum Material Purchases
      let projMaterials = proj.materialPurchases;
      
      // If workType filter is active, only count materials linked to matched work items
      if (workType) {
        projMaterials = projMaterials.filter((m: MaterialPurchase) => m.workItemId && matchedWorkItemIds.has(m.workItemId));
      }
      
      if (parsedStart || parsedEnd) {
        projMaterials = projMaterials.filter((m: MaterialPurchase) => {
          const mDate = new Date(m.purchaseDate);
          if (parsedStart && mDate < parsedStart) return false;
          if (parsedEnd && mDate > parsedEnd) return false;
          return true;
        });
      }
      
      const projMaterialCost = projMaterials.reduce((sum: number, m: MaterialPurchase) => sum + Number(m.amount), 0);

      // 3. Filter and sum Labour Costs
      let projLabour = proj.labourCosts;
      
      // If workType filter is active, only count labour linked to matched work items
      if (workType) {
        projLabour = projLabour.filter((l: LabourCost) => l.workItemId && matchedWorkItemIds.has(l.workItemId));
      }
      
      if (parsedStart || parsedEnd) {
        projLabour = projLabour.filter((l: LabourCost) => {
          const lDate = new Date(l.paymentDate);
          if (parsedStart && lDate < parsedStart) return false;
          if (parsedEnd && lDate > parsedEnd) return false;
          return true;
        });
      }
      
      const projLabourCost = projLabour.reduce((sum: number, l: LabourCost) => sum + Number(l.amount), 0);

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
  } catch (error) {
    console.error('Error generating reports:', error);
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 });
  }
}
