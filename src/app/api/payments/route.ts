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

    // Calculate KPIs dynamically based on filters in IST timezone (Asia/Kolkata)
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayISTString = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0') + '-' + String(nowIST.getDate()).padStart(2, '0');
    const currentMonthIST = nowIST.getMonth();
    const currentYearIST = nowIST.getFullYear();

    // Fetch all filtered payments for payment metrics
    const allFilteredPayments = await prisma.payment.findMany({
      where: whereClause,
      select: {
        amount: true,
        paymentDate: true,
      },
    });

    let totalCollection = 0;
    let todayCollection = 0;
    let monthCollection = 0;
    const totalTransactions = allFilteredPayments.length;

    allFilteredPayments.forEach((pay: any) => {
      const amt = Number(pay.amount);
      const payDate = new Date(pay.paymentDate);

      // prisma Date-only maps to midnight UTC, getUTC* extracts the correct input day/month/year
      const payYear = payDate.getUTCFullYear();
      const payMonth = payDate.getUTCMonth();
      const payDay = payDate.getUTCDate();
      const payDateString = payYear + '-' + String(payMonth + 1).padStart(2, '0') + '-' + String(payDay).padStart(2, '0');

      totalCollection += amt;

      if (payDateString === todayISTString) {
        todayCollection += amt;
      }
      if (payYear === currentYearIST && payMonth === currentMonthIST) {
        monthCollection += amt;
      }
    });

    // Construct project filter for outstanding pending calculation
    const projectWhere: any = {
      deletedAt: null,
      client: {
        deletedAt: null,
      },
    };

    if (clientId) {
      projectWhere.clientId = clientId;
    }
    if (projectId) {
      projectWhere.id = projectId;
    }
    if (projectStatus) {
      let statusQuery: any = projectStatus;
      if (projectStatus === 'In Progress') {
        statusQuery = { in: ['Advance Received', 'Production', 'Installation', 'Measurement Done'] };
      } else if (projectStatus === 'Quoted') {
        statusQuery = 'Quotation Sent';
      }
      projectWhere.status = statusQuery;
    }
    if (search) {
      projectWhere.OR = [
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
      ];
    }

    const allFilteredProjects = await prisma.project.findMany({
      where: projectWhere,
      include: {
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });

    let pendingCollection = 0;
    allFilteredProjects.forEach((p: any) => {
      if (p.status !== 'Cancelled') {
        const projectPaymentsSum = p.payments.reduce((sum: number, pay: any) => sum + Number(pay.amount), 0);
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
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
