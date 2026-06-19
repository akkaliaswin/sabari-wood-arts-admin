import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export interface ReportRow {
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  clientCode: string;
  quotedAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  materialCost: number;
  labourCost: number;
  profit: number; // Profit = Quoted - Material - Labour
  marginPercentage: number;
}

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

    // Fetch matching projects with sub-resources including payments
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
        payments: true,
      },
    });

    const parsedStart = startDate ? new Date(startDate) : null;
    const parsedEnd = endDate ? new Date(endDate) : null;

    if (parsedStart) parsedStart.setHours(0, 0, 0, 0);
    if (parsedEnd) parsedEnd.setHours(23, 59, 59, 999);

    let totalQuoted = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let totalMaterialCost = 0;
    let totalLabourCost = 0;

    const reportRows: ReportRow[] = [];

    // General counts for default view
    const totalProjects = projects.length;
    const activeStatuses = ['Lead', 'Measurement Done', 'Quotation Sent', 'Advance Received', 'Production', 'Installation', 'On Hold'];
    const activeProjects = projects.filter((p) => activeStatuses.includes(p.status)).length;
    const completedProjects = projects.filter((p) => p.status === 'Completed').length;

    // Aggregate report data dynamically
    projects.forEach((proj: any) => {
      // 1. Filter and sum Work Items (selling price)
      let projWorkItems = proj.workItems;
      if (parsedStart || parsedEnd) {
        projWorkItems = projWorkItems.filter((item: any) => {
          const itemDate = new Date(item.createdAt);
          if (parsedStart && itemDate < parsedStart) return false;
          if (parsedEnd && itemDate > parsedEnd) return false;
          return true;
        });
      }
      
      const matchedWorkItemIds = new Set(projWorkItems.map((item: any) => item.id));

      // 2. Filter and sum Material Purchases
      let projMaterials = proj.materialPurchases;
      if (workType) {
        projMaterials = projMaterials.filter((m: any) => m.workItemId && matchedWorkItemIds.has(m.workItemId));
      }
      if (parsedStart || parsedEnd) {
        projMaterials = projMaterials.filter((m: any) => {
          const mDate = new Date(m.purchaseDate);
          if (parsedStart && mDate < parsedStart) return false;
          if (parsedEnd && mDate > parsedEnd) return false;
          return true;
        });
      }
      const projMaterialCost = projMaterials.reduce((sum: number, m: any) => sum + Number(m.amount), 0);

      // 3. Filter and sum Labour Costs
      let projLabour = proj.labourCosts;
      if (workType) {
        projLabour = projLabour.filter((l: any) => l.workItemId && matchedWorkItemIds.has(l.workItemId));
      }
      if (parsedStart || parsedEnd) {
        projLabour = projLabour.filter((l: any) => {
          const lDate = new Date(l.paymentDate);
          if (parsedStart && lDate < parsedStart) return false;
          if (parsedEnd && lDate > parsedEnd) return false;
          return true;
        });
      }
      const projLabourCost = projLabour.reduce((sum: number, l: any) => sum + Number(l.amount), 0);

      // 4. Filter and sum Payments
      let projPayments = proj.payments;
      if (parsedStart || parsedEnd) {
        projPayments = projPayments.filter((p: any) => {
          const pDate = new Date(p.paymentDate);
          if (parsedStart && pDate < parsedStart) return false;
          if (parsedEnd && pDate > parsedEnd) return false;
          return true;
        });
      }
      const projReceived = projPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      // Calculations
      const projQuoted = Number(proj.quotedAmount);
      const totalProjReceivedAllTime = proj.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const projOutstanding = proj.status === 'Cancelled' ? 0 : Math.max(0, projQuoted - totalProjReceivedAllTime);
      
      const profit = projQuoted - projMaterialCost - projLabourCost; // Profit = Quoted - Material - Labour
      const margin = projQuoted > 0 ? (profit / projQuoted) * 100 : 0;

      // Push project row to list if there is active revenue or costs in this timeframe
      // If no date filters are active, display all non-deleted projects
      const hasDateFilter = startDate || endDate || workType || projectId || clientId;
      if (!hasDateFilter || projQuoted > 0 || projReceived > 0 || projMaterialCost > 0 || projLabourCost > 0) {
        totalQuoted += projQuoted;
        totalReceived += projReceived;
        totalOutstanding += projOutstanding;
        totalMaterialCost += projMaterialCost;
        totalLabourCost += projLabourCost;

        reportRows.push({
          projectId: proj.id,
          projectCode: proj.projectCode,
          projectName: proj.projectName,
          clientName: proj.client.name,
          clientCode: proj.client.clientCode,
          quotedAmount: projQuoted,
          receivedAmount: projReceived,
          outstandingAmount: projOutstanding,
          materialCost: projMaterialCost,
          labourCost: projLabourCost,
          profit,
          marginPercentage: margin,
        });
      }
    });

    const totalProfit = totalQuoted - totalMaterialCost - totalLabourCost; // Profit = Quoted - Material - Labour
    const totalMarginPercentage = totalQuoted > 0 ? (totalProfit / totalQuoted) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalRevenue: totalQuoted, // Total revenue is total Quoted Amount
        totalPaymentsReceived: totalReceived,
        totalOutstandingCollection: totalOutstanding,
        totalMaterialCost,
        totalLabourCost,
        totalProfit,
        totalMarginPercentage,
      },
      rows: reportRows,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error generating reports:', error);
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 });
  }
}
