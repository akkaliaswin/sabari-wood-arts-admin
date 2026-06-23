import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type WhereClause = {
  labourerId?: string;
  projectId?: string | null;
  attendanceDate?: {
    gte?: Date;
    lte?: Date;
  };
  labourer?: {
    skillType: string;
  };
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const labourerId = searchParams.get('labourerId') || '';
    const projectId = searchParams.get('projectId') || '';
    const skillType = searchParams.get('skillType') || '';

    // 1. Build where clause for records
    const whereClause: WhereClause = {};
    
    if (labourerId) {
      whereClause.labourerId = labourerId;
    }

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (startDate || endDate) {
      whereClause.attendanceDate = {};
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        whereClause.attendanceDate.gte = new Date(Date.UTC(y, m - 1, d));
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        whereClause.attendanceDate.lte = new Date(Date.UTC(y, m - 1, d));
      }
    }

    if (skillType) {
      whereClause.labourer = {
        skillType: skillType,
      };
    }

    // Fetch matching logs
    const records = await prisma.labourAttendance.findMany({
      where: whereClause,
      include: {
        labourer: {
          select: {
            id: true,
            name: true,
            labourCode: true,
            skillType: true,
            phone: true,
            activeStatus: true,
          },
        },
        project: {
          select: {
            id: true,
            projectName: true,
            projectCode: true,
          },
        },
      },
      orderBy: [
        { attendanceDate: 'desc' },
        { labourer: { labourCode: 'asc' } },
      ],
    });

    // 2. Aggregate analytics (if not heavily filtered, or always provide global context)
    const todayISTStr = new Date().toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }); // MM/DD/YYYY format
    const [mStr, dStr, yStr] = todayISTStr.split('/');
    const todayUTC = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));

    // Query today's attendance
    const todayAttendances = await prisma.labourAttendance.findMany({
      where: {
        attendanceDate: todayUTC,
      },
      include: {
        labourer: {
          select: {
            name: true,
            labourCode: true,
          },
        },
      },
    });

    const presentToday = todayAttendances.filter((a) => a.status === 'Present').length;
    const absentToday = todayAttendances.filter((a) => a.status === 'Absent').length;
    const halfDayToday = todayAttendances.filter((a) => a.status === 'Half Day').length;
    const leaveToday = todayAttendances.filter((a) => a.status === 'Leave').length;

    // Total active assignments
    const activeAllocations = await prisma.projectLabourAssignment.findMany({
      where: { isActive: true },
      include: {
        labourer: { select: { id: true, name: true, labourCode: true, skillType: true } },
        project: { select: { id: true, projectName: true, projectCode: true } },
      },
    });

    // Total active labourers count
    const totalActiveLabourersCount = await prisma.labourer.count({
      where: { activeStatus: true },
    });

    // All-time/Global metrics for summary & analytics
    const allAttendances = await prisma.labourAttendance.findMany({
      include: {
        labourer: {
          select: {
            name: true,
            labourCode: true,
            activeStatus: true,
            skillType: true,
          },
        },
      },
    });

    const totalDays = allAttendances.length;
    const presentDays = allAttendances.filter((a) => a.status === 'Present').length;
    const halfDays = allAttendances.filter((a) => a.status === 'Half Day').length;
    const overallPercentage = totalDays > 0 ? ((presentDays + 0.5 * halfDays) / totalDays) * 100 : 0;

    // Smart operations insights:
    // 1. Who is absent today
    const absentLabourersToday = todayAttendances
      .filter((a) => a.status === 'Absent')
      .map((a) => ({
        id: a.labourerId,
        name: a.labourer?.name || 'Unknown',
        labourCode: a.labourer?.labourCode || '',
        remarks: a.remarks || '',
      }));

    // 2. Unassigned labourers
    const assignedIds = new Set(activeAllocations.map(a => a.labourerId));
    const allActiveLabourersList = await prisma.labourer.findMany({
      where: { activeStatus: true },
      select: { id: true, name: true, labourCode: true, skillType: true },
    });
    const unassignedLabourers = allActiveLabourersList.filter(l => !assignedIds.has(l.id));

    // 3. Projects with no allocation & shortages
    const activeProjects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        status: { in: ['Lead', 'Measurement Done', 'Quotation Sent', 'Advance Received', 'Production', 'Installation', 'On Hold'] },
      },
      select: { id: true, projectName: true, projectCode: true },
    });

    const projectAllocationsMap: Record<string, typeof activeAllocations> = {};
    activeProjects.forEach(p => {
      projectAllocationsMap[p.id] = [];
    });
    activeAllocations.forEach(a => {
      if (projectAllocationsMap[a.projectId]) {
        projectAllocationsMap[a.projectId].push(a);
      }
    });

    const projectsWithNoAllocation: { id: string; projectName: string; projectCode: string }[] = [];
    const labourShortages: { id: string; projectName: string; projectCode: string; assignedCount: number; presentCount: number; shortage: number }[] = [];

    // Project allocation view breakdown
    const projectAllocationView = activeProjects.map(p => {
      const allocations = projectAllocationsMap[p.id] || [];
      const assignedIds = new Set(allocations.map(a => a.labourerId));
      
      // Calculate today's counts for this project
      const projTodayAtts = todayAttendances.filter(a => a.projectId === p.id || (assignedIds.has(a.labourerId) && !a.projectId));
      const presentCount = projTodayAtts.filter(a => a.status === 'Present').length;
      const absentCount = projTodayAtts.filter(a => a.status === 'Absent').length;
      const halfDayCount = projTodayAtts.filter(a => a.status === 'Half Day').length;
      const leaveCount = projTodayAtts.filter(a => a.status === 'Leave').length;

      if (allocations.length === 0) {
        projectsWithNoAllocation.push(p);
      } else if (presentCount < allocations.length) {
        labourShortages.push({
          id: p.id,
          projectName: p.projectName,
          projectCode: p.projectCode,
          assignedCount: allocations.length,
          presentCount,
          shortage: allocations.length - presentCount,
        });
      }

      // Calculate project historical attendance percentage
      const projectHistory = allAttendances.filter(a => a.projectId === p.id);
      const projPct = projectHistory.length > 0
        ? ((projectHistory.filter(a => a.status === 'Present').length + 0.5 * projectHistory.filter(a => a.status === 'Half Day').length) / projectHistory.length) * 100
        : 0;

      return {
        id: p.id,
        projectName: p.projectName,
        projectCode: p.projectCode,
        assignedCount: allocations.length,
        presentCount,
        absentCount,
        halfDayCount,
        leaveCount,
        attendancePercentage: projPct,
        labourers: allocations.map(a => ({
          id: a.labourer.id,
          name: a.labourer.name,
          labourCode: a.labourer.labourCode,
          skillType: a.labourer.skillType,
          role: a.role,
        })),
      };
    });

    // 4. Highest & lowest attendance performers (history based)
    const labourerStats: Record<string, { name: string; code: string; score: number; total: number }> = {};
    allAttendances.forEach((att) => {
      const id = att.labourerId;
      const name = att.labourer?.name || 'Unknown';
      const code = att.labourer?.labourCode || '';
      if (!labourerStats[id]) {
        labourerStats[id] = { name, code, score: 0, total: 0 };
      }
      labourerStats[id].total += 1;
      if (att.status === 'Present') labourerStats[id].score += 1;
      else if (att.status === 'Half Day') labourerStats[id].score += 0.5;
    });

    const rankedLabourers = Object.entries(labourerStats)
      .map(([id, val]) => ({
        id,
        name: val.name,
        labourCode: val.code,
        percentage: val.total > 0 ? (val.score / val.total) * 100 : 0,
        totalDays: val.total,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const highestAttendanceLabourer = rankedLabourers.length > 0 ? `${rankedLabourers[0].name} (${rankedLabourers[0].labourCode}) - ${rankedLabourers[0].percentage.toFixed(0)}%` : 'None';
    const lowestAttendanceLabourer = rankedLabourers.length > 0 ? `${rankedLabourers[rankedLabourers.length - 1].name} (${rankedLabourers[rankedLabourers.length - 1].labourCode}) - ${rankedLabourers[rankedLabourers.length - 1].percentage.toFixed(0)}%` : 'None';
    const mostActiveLabourer = highestAttendanceLabourer;

    // Chart trend data:
    // Monthly Attendance Trend
    const monthStats: Record<string, { present: number; half: number; total: number }> = {};
    allAttendances.forEach((att) => {
      const d = new Date(att.attendanceDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthStats[key]) {
        monthStats[key] = { present: 0, half: 0, total: 0 };
      }
      monthStats[key].total += 1;
      if (att.status === 'Present') monthStats[key].present += 1;
      else if (att.status === 'Half Day') monthStats[key].half += 0.5;
    });

    const monthlyTrend = Object.entries(monthStats)
      .map(([month, stat]) => {
        const percentage = stat.total > 0 ? ((stat.present + 0.5 * stat.half) / stat.total) * 100 : 0;
        return { month, percentage };
      })
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    // Project-wise attendance rate for charts
    const projectStats: Record<string, { name: string; score: number; total: number }> = {};
    activeProjects.forEach(p => {
      projectStats[p.id] = { name: p.projectName, score: 0, total: 0 };
    });

    allAttendances.forEach(a => {
      if (a.projectId && projectStats[a.projectId]) {
        projectStats[a.projectId].total += 1;
        if (a.status === 'Present') projectStats[a.projectId].score += 1;
        else if (a.status === 'Half Day') projectStats[a.projectId].score += 0.5;
      }
    });

    const projectAttendanceRanking = Object.entries(projectStats)
      .map(([id, val]) => ({
        id,
        name: val.name,
        percentage: val.total > 0 ? (val.score / val.total) * 100 : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Absence trend analysis: Absences grouped by month for the last 6 months
    const absenceTrendMap: Record<string, number> = {};
    allAttendances.forEach(a => {
      if (a.status === 'Absent') {
        const d = new Date(a.attendanceDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        absenceTrendMap[key] = (absenceTrendMap[key] || 0) + 1;
      }
    });
    const absenceTrend = Object.entries(absenceTrendMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    // Leave analysis distribution
    const leaveAnalysis = {
      Present: allAttendances.filter(a => a.status === 'Present').length,
      Absent: allAttendances.filter(a => a.status === 'Absent').length,
      'Half Day': allAttendances.filter(a => a.status === 'Half Day').length,
      Leave: allAttendances.filter(a => a.status === 'Leave').length,
    };

    // Labour-wise summary list
    const activeLabourers = await prisma.labourer.findMany({
      where: { activeStatus: true },
      select: {
        id: true,
        name: true,
        labourCode: true,
        skillType: true,
      },
    });

    const labourerSummary = activeLabourers.map((lab) => {
      const stats = labourerStats[lab.id] || { score: 0, total: 0 };
      const pct = stats.total > 0 ? (stats.score / stats.total) * 100 : 0;
      return {
        id: lab.id,
        name: lab.name,
        labourCode: lab.labourCode,
        skillType: lab.skillType,
        totalDays: stats.total,
        presentDays: allAttendances.filter((a) => a.labourerId === lab.id && a.status === 'Present').length,
        absentDays: allAttendances.filter((a) => a.labourerId === lab.id && a.status === 'Absent').length,
        halfDays: allAttendances.filter((a) => a.labourerId === lab.id && a.status === 'Half Day').length,
        leaveDays: allAttendances.filter((a) => a.labourerId === lab.id && a.status === 'Leave').length,
        percentage: pct,
      };
    });

    return NextResponse.json({
      records,
      metrics: {
        presentToday,
        absentToday,
        halfDayToday,
        leaveToday,
        totalActiveLabourersCount,
        activeAssignmentsCount: activeAllocations.length,
        attendancePercentage: overallPercentage,
        mostActiveLabourer,
        monthlyTrend,
        labourerRanking: rankedLabourers.slice(0, 10),
        projectAttendanceRanking,
        absenceTrend,
        leaveAnalysis,
        labourerSummary,
        projectAllocationView,
        smartInsights: {
          absentLabourersToday,
          unassignedLabourers,
          projectsWithNoAllocation,
          labourShortages,
          highestAttendanceLabourer,
          lowestAttendanceLabourer,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching attendance logs:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance logs' }, { status: 500 });
  }
}

interface PostRecord {
  labourerId: string;
  status: string;
  projectId?: string | null;
  remarks?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, records } = body as { date: string; records: PostRecord[] };

    if (!date || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Date and records array are required' }, { status: 400 });
    }

    const [y, m, d] = date.split('-').map(Number);
    const attendanceDate = new Date(Date.UTC(y, m - 1, d));

    // Perform batch upsert in a transaction
    const results = await prisma.$transaction(
      records.map((rec) => {
        const key = {
          labourerId: rec.labourerId,
          attendanceDate,
        };
        return prisma.labourAttendance.upsert({
          where: {
            labourerId_attendanceDate: key,
          },
          update: {
            status: rec.status,
            remarks: rec.remarks || null,
            projectId: rec.projectId || null,
          },
          create: {
            labourerId: rec.labourerId,
            attendanceDate,
            status: rec.status,
            remarks: rec.remarks || null,
            projectId: rec.projectId || null,
          },
        });
      })
    );

    // Log attendance activities to the timeline if a projectId is associated
    try {
      await Promise.all(
        records.map(async (rec) => {
          if (!rec.projectId) return;
          const lab = await prisma.labourer.findUnique({
            where: { id: rec.labourerId },
            select: { name: true, labourCode: true },
          });
          await prisma.projectActivity.create({
            data: {
              projectId: rec.projectId,
              activityType: 'ATTENDANCE_MARKED',
              description: `Labourer ${lab?.name || 'Worker'} (${lab?.labourCode || 'LAB'}) marked ${rec.status} today.`,
            },
          });
        })
      );
    } catch (activityError) {
      console.error('Error logging attendance activities:', activityError);
    }

    return NextResponse.json({ message: 'Attendance updated successfully', count: results.length });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
  }
}
