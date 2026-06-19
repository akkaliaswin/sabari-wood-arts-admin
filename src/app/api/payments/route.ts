import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const paymentMode = searchParams.get('paymentMode') || '';
    const projectStatus = searchParams.get('projectStatus') || '';
    const clientId = searchParams.get('clientId') || '';
    const projectId = searchParams.get('projectId') || '';
    const startDateStr = searchParams.get('startDate') || '';
    const endDateStr = searchParams.get('endDate') || '';

    // Calculate start and end dates
    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;
    if (startDateStr) {
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    }

    // Build the main query filters
    const whereClause: any = {
      project: {
        deletedAt: null,
        client: {
          deletedAt: null,
        },
      },
    };

    // Apply Filters
    if (paymentMode) {
      whereClause.paymentMode = paymentMode;
    }
    if (projectStatus) {
      let statusQuery: any = projectStatus;
      if (projectStatus === 'In Progress') {
        statusQuery = { in: ['Advance Received', 'Production', 'Installation', 'Measurement Done'] };
      } else if (projectStatus === 'Quoted') {
        statusQuery = 'Quotation Sent';
      }
      whereClause.project = {
        ...whereClause.project,
        status: statusQuery,
      };
    }
    if (clientId) {
      whereClause.project = {
        ...whereClause.project,
        clientId: clientId,
      };
    }
    if (projectId) {
      whereClause.projectId = projectId;
    }
    if (startDate || endDate) {
      whereClause.paymentDate = {};
      if (startDate) {
        whereClause.paymentDate.gte = startDate;
      }
      if (endDate) {
        whereClause.paymentDate.lte = endDate;
      }
    }

    // Apply Search matching multiple fields
    if (search) {
      whereClause.OR = [
        { paymentCode: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
        {
          project: {
            OR: [
              { projectName: { contains: search, mode: 'insensitive' } },
              { projectCode: { contains: search, mode: 'insensitive' } },
              {
                client: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        },
      ];
    }

    // Retrieve paginated records
    const skip = (page - 1) * limit;

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              projectName: true,
              status: true,
              quotedAmount: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  clientCode: true,
                },
              },
            },
          },
        },
        orderBy: [
          { paymentDate: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: whereClause }),
    ]);

    // Calculate global KPIs (Dashboard Cards)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all non-deleted projects with their payments
    const allProjects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        client: { deletedAt: null },
      },
      include: {
        payments: true,
      },
    });

    let totalCollection = 0;
    let todayCollection = 0;
    let monthCollection = 0;
    let totalTransactions = 0;
    let pendingCollection = 0;

    allProjects.forEach((p) => {
      const projectPaymentsSum = p.payments.reduce((sum, pay) => {
        const amt = Number(pay.amount);
        const payDate = new Date(pay.paymentDate);

        totalCollection += amt;
        totalTransactions++;

        if (payDate >= todayStart) {
          todayCollection += amt;
        }
        if (payDate >= monthStart) {
          monthCollection += amt;
        }

        return sum + amt;
      }, 0);

      // Only count outstanding for non-cancelled projects
      if (p.status !== 'Cancelled') {
        const balance = Number(p.quotedAmount) - projectPaymentsSum;
        if (balance > 0) {
          pendingCollection += balance;
        }
      }
    });

    return NextResponse.json({
      payments,
      totalCount,
      page,
      limit,
      metrics: {
        totalCollection,
        todayCollection,
        monthCollection,
        pendingCollection,
        totalTransactions,
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
