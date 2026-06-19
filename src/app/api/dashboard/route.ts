import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch all non-deleted projects with their related items for aggregation
    const allProjects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        client: {
          deletedAt: null, // Ensure client is not deleted
        },
      },
      include: {
        workItems: true,
        payments: true,
        materialPurchases: true,
        labourCosts: true,
      },
    });

    const activeStatuses = ['Lead', 'Measurement Done', 'Quotation Sent', 'Advance Received', 'Production', 'Installation', 'On Hold'];
    const activeProjects = allProjects.filter((p: any) => activeStatuses.includes(p.status));

    // Computations
    const totalActiveProjects = activeProjects.length;

    // Active project quoted value
    const totalProjectValue = activeProjects.reduce((sum, p) => sum + Number(p.quotedAmount), 0);

    // Payments received (all-time / global)
    const totalCollectionsReceived = allProjects.reduce(
      (sum, p) => sum + p.payments.reduce((s, pay) => s + Number(pay.amount), 0),
      0
    );

    // Global revenue = sum of sellingPrice of all work items in non-deleted projects
    const totalRevenue = allProjects.reduce(
      (sum, p) => sum + p.workItems.reduce((s, item) => s + Number(item.sellingPrice), 0),
      0
    );

    // Material cost (all-time)
    const totalMaterialCost = allProjects.reduce(
      (sum, p) => sum + p.materialPurchases.reduce((s, mat) => s + Number(mat.amount), 0),
      0
    );

    // Labour cost (all-time)
    const totalLabourCost = allProjects.reduce(
      (sum, p) => sum + p.labourCosts.reduce((s, lab) => s + Number(lab.amount), 0),
      0
    );

    // Estimated Gross Profit (All time)
    const grossProfit = totalRevenue - totalMaterialCost - totalLabourCost;
    const averageMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Pending collections on active projects: Quoted Amount - Payments Received (summed per active project)
    const pendingCollections = activeProjects.reduce((sum, p) => {
      const pPayments = p.payments.reduce((s, pay) => s + Number(pay.amount), 0);
      const pending = Number(p.quotedAmount) - pPayments;
      return sum + (pending > 0 ? pending : 0);
    }, 0);

    // Gross margin for active projects = Total Active Quoted Value - Active Material Costs - Active Labor Costs
    const activeMaterialCost = activeProjects.reduce(
      (sum, p) => sum + p.materialPurchases.reduce((s, mat) => s + Number(mat.amount), 0),
      0
    );
    const activeLabourCost = activeProjects.reduce(
      (sum, p) => sum + p.labourCosts.reduce((s, lab) => s + Number(lab.amount), 0),
      0
    );
    const grossMarginEstimate = totalProjectValue - activeMaterialCost - activeLabourCost;

    // Calculate Most Profitable Work Type (All time)
    const workTypeStats: Record<string, { revenue: number; cost: number; profit: number }> = {};
    allProjects.forEach((p) => {
      p.workItems.forEach((item) => {
        const itemMaterials = p.materialPurchases
          .filter((m) => m.workItemId === item.id)
          .reduce((sum, m) => sum + Number(m.amount), 0);
        const itemLabour = p.labourCosts
          .filter((l) => l.workItemId === item.id)
          .reduce((sum, l) => sum + Number(l.amount), 0);

        const type = item.workType;
        const sellPrice = Number(item.sellingPrice);
        const profit = sellPrice - itemMaterials - itemLabour;

        if (!workTypeStats[type]) {
          workTypeStats[type] = { revenue: 0, cost: 0, profit: 0 };
        }
        workTypeStats[type].revenue += sellPrice;
        workTypeStats[type].cost += itemMaterials + itemLabour;
        workTypeStats[type].profit += profit;
      });
    });

    let mostProfitableWorkType = 'None';
    let maxWorkTypeProfit = -Infinity;
    Object.entries(workTypeStats).forEach(([type, data]) => {
      if (data.profit > maxWorkTypeProfit) {
        maxWorkTypeProfit = data.profit;
        mostProfitableWorkType = type;
      }
    });
    if (maxWorkTypeProfit <= 0) {
      mostProfitableWorkType = 'None';
    }

    // Calculate Most Profitable Project (All time)
    let mostProfitableProject = 'None';
    let maxProjectProfit = -Infinity;
    allProjects.forEach((p) => {
      const pRevenue = p.workItems.reduce((sum, item) => sum + Number(item.sellingPrice), 0);
      const pMaterials = p.materialPurchases.reduce((sum, m) => sum + Number(m.amount), 0);
      const pLabour = p.labourCosts.reduce((sum, l) => sum + Number(l.amount), 0);
      const pProfit = pRevenue - pMaterials - pLabour;

      if (pProfit > maxProjectProfit) {
        maxProjectProfit = pProfit;
        mostProfitableProject = `${p.projectName} (${p.projectCode})`;
      }
    });
    if (maxProjectProfit <= 0) {
      mostProfitableProject = 'None';
    }

    // Pipeline counts
    const pipelineCounts = {
      Lead: 0,
      'Measurement Done': 0,
      'Quotation Sent': 0,
      'Advance Received': 0,
      Production: 0,
      Installation: 0,
      Completed: 0,
      'On Hold': 0,
      Cancelled: 0,
    };
    allProjects.forEach((p) => {
      const status = p.status;
      if (status in pipelineCounts) {
        pipelineCounts[status as keyof typeof pipelineCounts]++;
      }
    });

    // Labour master metrics
    const totalLabourers = await prisma.labourer.count();
    const activeLabourers = await prisma.labourer.count({ where: { activeStatus: true } });

    // Monthly labour costs
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startOfThisMonth = new Date(currentYear, currentMonth, 1);

    // Retrieve all labour cost logs
    const allLabourCosts = await prisma.labourCost.findMany();
    const globalTotalLabourCost = allLabourCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
    const labourCostThisMonth = allLabourCosts
      .filter((cost) => new Date(cost.paymentDate) >= startOfThisMonth)
      .reduce((sum, cost) => sum + Number(cost.amount), 0);

    // Highest paid labourer calculation
    const labourerPayments: Record<string, { name: string; amount: number }> = {};
    allLabourCosts.forEach((cost) => {
      const key = cost.labourerId || 'legacy';
      const name = cost.carpenterName;
      if (!labourerPayments[key]) {
        labourerPayments[key] = { name, amount: 0 };
      }
      labourerPayments[key].amount += Number(cost.amount);
    });

    let highestPaidLabourer = 'None';
    let highestPaidAmount = 0;
    Object.values(labourerPayments).forEach((data) => {
      if (data.amount > highestPaidAmount) {
        highestPaidAmount = data.amount;
        highestPaidLabourer = `${data.name} (₹${data.amount.toLocaleString('en-IN')})`;
      }
    });
    if (highestPaidAmount === 0) {
      highestPaidLabourer = 'None';
    }

    return NextResponse.json({
      totalActiveProjects,
      totalProjectValue,
      totalCollectionsReceived,
      pendingCollections,
      totalMaterialCost,
      totalLabourCost: globalTotalLabourCost,
      grossMarginEstimate,
      // Enhanced profitability fields
      totalRevenue,
      grossProfit,
      averageMargin,
      mostProfitableWorkType,
      mostProfitableProject,
      // Pipeline metrics
      pipelineCounts,
      // Labour Master metrics
      labourMetrics: {
        totalLabourers,
        activeLabourers,
        totalLabourCost: globalTotalLabourCost,
        labourCostThisMonth,
        highestPaidLabourer,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard metrics' }, { status: 500 });
  }
}
