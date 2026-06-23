import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ProjectWithRelations, WorkItem, Payment, MaterialPurchase, LabourCost } from '@/types/db';

export async function GET() {
  try {
    // Fetch all non-deleted projects with their related items for aggregation
    const allProjects: ProjectWithRelations[] = await prisma.project.findMany({
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
    }) as unknown as ProjectWithRelations[];

    const activeStatuses = ['Lead', 'Measurement Done', 'Quotation Sent', 'Advance Received', 'Production', 'Installation', 'On Hold'];
    const activeProjects = allProjects.filter((p: ProjectWithRelations) => activeStatuses.includes(p.status));

    // Computations
    const totalActiveProjects = activeProjects.length;

    // Active project quoted value
    const totalProjectValue = activeProjects.reduce((sum: number, p: ProjectWithRelations) => sum + Number(p.quotedAmount), 0);

    // Global payments received (all-time / global)
    const globalCollectionsReceived = allProjects.reduce(
      (sum: number, p: ProjectWithRelations) => sum + p.payments.reduce((s: number, pay: Payment) => s + Number(pay.amount), 0),
      0
    );

    // Payments received (active projects only / status is NOT Completed)
    const totalCollectionsReceived = allProjects.reduce(
      (sum: number, p: ProjectWithRelations) => {
        if (p.status === 'Completed') return sum;
        return sum + p.payments.reduce((s: number, pay: Payment) => s + Number(pay.amount), 0);
      },
      0
    );

    // Global revenue = sum of quotedAmount of all non-deleted projects
    const totalRevenue = allProjects.reduce(
      (sum: number, p: ProjectWithRelations) => sum + Number(p.quotedAmount),
      0
    );

    // Material cost (all-time)
    const totalMaterialCost = allProjects.reduce(
      (sum: number, p: ProjectWithRelations) => sum + p.materialPurchases.reduce((s: number, mat: MaterialPurchase) => s + Number(mat.amount), 0),
      0
    );

    // Labour cost (all-time)
    const totalLabourCost = allProjects.reduce(
      (sum: number, p: ProjectWithRelations) => sum + p.labourCosts.reduce((s: number, lab: LabourCost) => s + Number(lab.amount), 0),
      0
    );

    // Profit = Quoted Amount - Material Cost - Labour Cost
    const grossProfit = totalRevenue - totalMaterialCost - totalLabourCost;
    const averageMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Pending collections: Quoted Amount - Payments Received (summed per project, capped at 0)
    const pendingCollections = allProjects.reduce((sum: number, p: ProjectWithRelations) => {
      if (p.status === 'Cancelled') return sum;
      const pPayments = p.payments.reduce((s: number, pay: Payment) => s + Number(pay.amount), 0);
      const pending = Math.max(0, Number(p.quotedAmount) - pPayments);
      return sum + pending;
    }, 0);

    // Gross margin for active projects = Total Active Quoted Value - Active Material Costs - Active Labor Costs
    const activeMaterialCost = activeProjects.reduce(
      (sum: number, p: ProjectWithRelations) => sum + p.materialPurchases.reduce((s: number, mat: MaterialPurchase) => s + Number(mat.amount), 0),
      0
    );
    const activeLabourCost = activeProjects.reduce(
      (sum: number, p: ProjectWithRelations) => sum + p.labourCosts.reduce((s: number, lab: LabourCost) => s + Number(lab.amount), 0),
      0
    );
    const grossMarginEstimate = totalProjectValue - activeMaterialCost - activeLabourCost;

    // Calculate Most Profitable Work Type (All time)
    const workTypeStats: Record<string, { revenue: number; cost: number; profit: number }> = {};
    allProjects.forEach((p: ProjectWithRelations) => {
      p.workItems.forEach((item: WorkItem) => {
        const type = item.workType;
        const sellPrice = Number(item.sellingPrice);
        const actualCost = Number(item.actualCost || 0);
        const profit = sellPrice - actualCost;

        if (!workTypeStats[type]) {
          workTypeStats[type] = { revenue: 0, cost: 0, profit: 0 };
        }
        workTypeStats[type].revenue += sellPrice;
        workTypeStats[type].cost += actualCost;
        workTypeStats[type].profit += profit;
      });
    });

    let mostProfitableWorkType = 'None';
    let maxWorkTypeProfit = -Infinity;
    Object.entries(workTypeStats).forEach(([type, data]: [string, { revenue: number; cost: number; profit: number }]) => {
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
    allProjects.forEach((p: ProjectWithRelations) => {
      const pQuoted = Number(p.quotedAmount);
      const pMaterials = p.materialPurchases.reduce((sum: number, m: MaterialPurchase) => sum + Number(m.amount), 0);
      const pLabour = p.labourCosts.reduce((sum: number, l: LabourCost) => sum + Number(l.amount), 0);
      const pProfit = pQuoted - pMaterials - pLabour;

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
    allProjects.forEach((p: ProjectWithRelations) => {
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
    const globalTotalLabourCost = allLabourCosts.reduce((sum: number, cost: LabourCost) => sum + Number(cost.amount), 0);
    const labourCostThisMonth = allLabourCosts
      .filter((cost: LabourCost) => new Date(cost.paymentDate) >= startOfThisMonth)
      .reduce((sum: number, cost: LabourCost) => sum + Number(cost.amount), 0);

    // Highest paid labourer calculation
    const labourerPayments: Record<string, { name: string; amount: number }> = {};
    allLabourCosts.forEach((cost: LabourCost) => {
      const key = cost.labourerId || 'legacy';
      const name = cost.carpenterName;
      if (!labourerPayments[key]) {
        labourerPayments[key] = { name, amount: 0 };
      }
      labourerPayments[key].amount += Number(cost.amount);
    });

    let highestPaidLabourer = 'None';
    let highestPaidAmount = 0;
    Object.values(labourerPayments).forEach((data: { name: string; amount: number }) => {
      if (data.amount > highestPaidAmount) {
        highestPaidAmount = data.amount;
        highestPaidLabourer = `${data.name} (₹${data.amount.toLocaleString('en-IN')})`;
      }
    });
    if (highestPaidAmount === 0) {
      highestPaidLabourer = 'None';
    }

    const netCashPosition = globalCollectionsReceived - totalMaterialCost - globalTotalLabourCost;

    // Daily workforce aggregation for quick dashboard operations widget
    const todayISTStr = new Date().toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }); // MM/DD/YYYY format
    const [mStr, dStr, yStr] = todayISTStr.split('/');
    const todayUTC = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));

    // Fetch today's attendance
    const todayAttendances = await prisma.labourAttendance.findMany({
      where: { attendanceDate: todayUTC },
    });
    const todayAttMap = new Map(todayAttendances.map(a => [a.labourerId, { status: a.status, remarks: a.remarks }]));

    // Fetch active assignments
    const activeAssignments = await prisma.projectLabourAssignment.findMany({
      where: { isActive: true },
      include: {
        labourer: {
          select: { id: true, name: true, labourCode: true, skillType: true, phone: true }
        }
      }
    });

    // Fetch active projects
    const activeProjectsList = await prisma.project.findMany({
      where: {
        deletedAt: null,
        status: { in: ['Lead', 'Measurement Done', 'Quotation Sent', 'Advance Received', 'Production', 'Installation', 'On Hold'] }
      },
      select: {
        id: true,
        projectName: true,
        projectCode: true,
        status: true,
        client: {
          select: {
            name: true
          }
        }
      }
    });

    // Group active assignments by project
    const projectAssignmentsMap: Record<string, typeof activeAssignments> = {};
    activeProjectsList.forEach(p => {
      projectAssignmentsMap[p.id] = [];
    });
    activeAssignments.forEach(a => {
      if (projectAssignmentsMap[a.projectId]) {
        projectAssignmentsMap[a.projectId].push(a);
      }
    });

    // Fetch all active labourers to compute unassigned list
    const activeLabourersList = await prisma.labourer.findMany({
      where: { activeStatus: true },
      select: { id: true, name: true, labourCode: true, skillType: true, phone: true }
    });
    const assignedLabourerIdsSet = new Set(activeAssignments.map(a => a.labourerId));
    const unassignedLabourers = activeLabourersList
      .filter(l => !assignedLabourerIdsSet.has(l.id))
      .map(l => {
        const att = todayAttMap.get(l.id);
        return {
          ...l,
          todayAttendance: att ? { status: att.status, remarks: att.remarks } : null
        };
      });

    // Fetch today's DAILY_NOTE project activities
    const todayDailyNotes = await prisma.projectActivity.findMany({
      where: {
        activityType: 'DAILY_NOTE',
        createdAt: {
          gte: todayUTC,
          lt: new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });
    const projectDailyNotesMap = new Map(todayDailyNotes.map(a => [a.projectId, a.description]));

    // Construct project allocation widget payload
    const projectAllocations = activeProjectsList.map(p => {
      const assignments = projectAssignmentsMap[p.id] || [];
      const assignedIds = new Set(assignments.map(a => a.labourerId));
      
      // Calculate today's counts for this project
      const projTodayAtts = todayAttendances.filter(a => a.projectId === p.id || (assignedIds.has(a.labourerId) && !a.projectId));
      const presentCount = projTodayAtts.filter(a => a.status === 'Present').length;
      const absentCount = projTodayAtts.filter(a => a.status === 'Absent').length;
      const halfDayCount = projTodayAtts.filter(a => a.status === 'Half Day').length;
      const leaveCount = projTodayAtts.filter(a => a.status === 'Leave').length;
      const requiredCount = assignments.length === 0 ? 2 : assignments.length;

      return {
        id: p.id,
        projectName: p.projectName,
        projectCode: p.projectCode,
        status: p.status,
        clientName: p.client?.name || 'Unknown Client',
        assignedCount: assignments.length,
        requiredCount,
        presentCount,
        absentCount,
        halfDayCount,
        leaveCount,
        dailyNote: projectDailyNotesMap.get(p.id) || '',
        labourers: assignments.map(a => {
          const att = todayAttMap.get(a.labourerId);
          return {
            id: a.labourer.id,
            assignmentId: a.id,
            name: a.labourer.name,
            labourCode: a.labourer.labourCode,
            skillType: a.labourer.skillType,
            role: a.role,
            todayAttendance: att ? { status: att.status, remarks: att.remarks } : null
          };
        })
      };
    });

    // Smart operations insights
    const absentLabourersToday = todayAttendances
      .filter((a) => a.status === 'Absent')
      .map((a) => {
        const lab = activeLabourersList.find(l => l.id === a.labourerId);
        return {
          id: a.labourerId,
          name: lab?.name || 'Unknown',
          labourCode: lab?.labourCode || '',
          remarks: a.remarks || ''
        };
      });

    const projectsWithNoAllocation = activeProjectsList.filter(p => (projectAssignmentsMap[p.id] || []).length === 0);
    const labourShortages = projectAllocations
      .filter(p => p.presentCount < p.requiredCount)
      .map(p => ({
        id: p.id,
        projectName: p.projectName,
        projectCode: p.projectCode,
        assignedCount: p.assignedCount,
        requiredCount: p.requiredCount,
        presentCount: p.presentCount,
        shortage: p.requiredCount - p.presentCount
      }));

    // Calculate suggested assignments for unassigned available workers
    const suggestedAssignments: { labourerId: string; labourerName: string; skillType: string; projectId: string; projectName: string }[] = [];
    const needyProjects = [
      ...projectsWithNoAllocation.map(p => ({ id: p.id, projectName: p.projectName })),
      ...labourShortages.map(p => ({ id: p.id, projectName: p.projectName }))
    ];

    if (unassignedLabourers.length > 0 && needyProjects.length > 0) {
      unassignedLabourers.forEach((labourer, index) => {
        const targetProj = needyProjects[index % needyProjects.length];
        suggestedAssignments.push({
          labourerId: labourer.id,
          labourerName: labourer.name,
          skillType: labourer.skillType,
          projectId: targetProj.id,
          projectName: targetProj.projectName,
        });
      });
    }

    // Fetch latest activities for operational timeline
    const recentActivities = await prisma.projectActivity.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: {
            projectName: true,
            projectCode: true
          }
        }
      }
    });

    const workforceToday = {
      presentToday: todayAttendances.filter((a) => a.status === 'Present').length,
      absentToday: todayAttendances.filter((a) => a.status === 'Absent').length,
      halfDayToday: todayAttendances.filter((a) => a.status === 'Half Day').length,
      leaveToday: todayAttendances.filter((a) => a.status === 'Leave').length,
      attendancePercentage: activeLabourers > 0
        ? ((todayAttendances.filter((a) => a.status === 'Present').length + 0.5 * todayAttendances.filter((a) => a.status === 'Half Day').length) / activeLabourers) * 100
        : 0
    };

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
      netCashPosition,
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
      // Workforce payload
      workforceToday,
      projectAllocations,
      unassignedLabourers,
      suggestedAssignments,
      recentActivities,
      smartInsights: {
        absentLabourersToday,
        unassignedLabourers,
        projectsWithNoAllocation,
        labourShortages,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard metrics' }, { status: 500 });
  }
}
