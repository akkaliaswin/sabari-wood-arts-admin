import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { LabourCost } from '@/types/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const labourer = await prisma.labourer.findUnique({
      where: { id },
      include: {
        labourCosts: {
          include: {
            project: {
              select: {
                id: true,
                projectName: true,
                projectCode: true,
              },
            },
            workItem: {
              select: {
                id: true,
                workType: true,
                workCode: true,
              },
            },
          },
          orderBy: { paymentDate: 'desc' },
        },
        attendances: {
          include: {
            project: {
              select: {
                id: true,
                projectName: true,
                projectCode: true,
              },
            },
          },
          orderBy: { attendanceDate: 'desc' },
        },
        labourAssignments: {
          include: {
            project: {
              select: {
                id: true,
                projectName: true,
                projectCode: true,
              },
            },
          },
          orderBy: { assignedDate: 'desc' },
        },
        labourPayments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!labourer) {
      return NextResponse.json({ error: 'Labourer profile not found' }, { status: 404 });
    }

    // Dynamic metrics
    const totalPaid = labourer.labourPayments.reduce((sum: number, pay: any) => sum + Number(pay.amount), 0);
    const totalAdvances = labourer.labourPayments
      .filter((pay: any) => pay.paymentType === 'Advance')
      .reduce((sum: number, pay: any) => sum + Number(pay.amount), 0);
    const outstandingAdvance = Math.max(
      0,
      labourer.labourPayments
        .filter((pay: any) => pay.paymentType === 'Advance' || pay.paymentType === 'Adjustment')
        .reduce((sum: number, pay: any) => sum + Number(pay.amount), 0)
    );

    const lastPaymentDate = labourer.labourPayments.length > 0
      ? labourer.labourPayments[0].paymentDate.toISOString()
      : null;
    
    // Unique projects worked on
    const uniqueProjectIds = new Set(labourer.labourCosts.map((cost: LabourCost) => cost.projectId));
    const projectsCount = uniqueProjectIds.size;

    // Overtime stats
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let totalOtThisMonth = 0;
    let totalOtThisYear = 0;
    let lifetimeOtHours = 0;

    labourer.attendances.forEach((att: any) => {
      const ot = Number(att.otHours || 0);
      if (ot > 0) {
        lifetimeOtHours += ot;
        const attDate = new Date(att.attendanceDate);
        if (attDate.getFullYear() === currentYear) {
          totalOtThisYear += ot;
          if (attDate.getMonth() === currentMonth) {
            totalOtThisMonth += ot;
          }
        }
      }
    });

    // Attendance stats
    const totalWorkingDays = labourer.attendances.length;
    const presentDays = labourer.attendances.filter((a) => a.status === 'Present').length;
    const absentDays = labourer.attendances.filter((a) => a.status === 'Absent').length;
    const halfDays = labourer.attendances.filter((a) => a.status === 'Half Day').length;
    const attendancePercentage = totalWorkingDays > 0 ? ((presentDays + 0.5 * halfDays) / totalWorkingDays) * 100 : 0;

    return NextResponse.json({
      ...labourer,
      totalPaid,
      totalAdvances,
      outstandingAdvance,
      lastPaymentDate,
      projectsCount,
      totalWorkingDays,
      presentDays,
      absentDays,
      halfDays,
      attendancePercentage,
      totalOtThisMonth,
      totalOtThisYear,
      lifetimeOtHours,
    });
  } catch (error) {
    console.error('Error fetching labourer details:', error);
    return NextResponse.json({ error: 'Failed to fetch labourer details' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, address, skillType, joiningDate, activeStatus, notes } = body;

    if (!name || !phone || !skillType) {
      return NextResponse.json({ error: 'Name, Phone, and Skill Type are required' }, { status: 400 });
    }

    // Phone validations: Exactly 10 digits, only digits allowed.
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const updatedLabourer = await prisma.labourer.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone.trim(),
        address,
        skillType,
        joiningDate: joiningDate ? new Date(joiningDate) : undefined,
        activeStatus: activeStatus !== undefined ? Boolean(activeStatus) : undefined,
        notes,
      },
    });

    return NextResponse.json(updatedLabourer);
  } catch (error) {
    console.error('Error updating labourer profile:', error);
    return NextResponse.json({ error: 'Failed to update labourer profile' }, { status: 500 });
  }
}
