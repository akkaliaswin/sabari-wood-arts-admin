import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface DailyRegisterRecord {
  labourerId: string;
  status: string; // Present, Absent, Half Day, Leave
  projectIds: string[]; // Selected project IDs
  amountPaid: number | null; // Optional payment
  paymentType: string | null; // Daily Wage, Advance, Partial Settlement
  remarks: string | null;
  otHours: number | null; // Added overtime hours field
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, records } = body as { date: string; records: DailyRegisterRecord[] };

    if (!date || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Date and records array are required' }, { status: 400 });
    }

    const [y, m, d] = date.split('-').map(Number);
    const attendanceDate = new Date(Date.UTC(y, m - 1, d));

    // Run batch operations in a single database transaction
    await prisma.$transaction(async (tx) => {
      for (const rec of records) {
        // 1. Upsert Attendance Record
        // Set singular projectId to the first selected project in the array, or null if none
        const primaryProjectId = rec.projectIds[0] || null;

        await tx.labourAttendance.upsert({
          where: {
            labourerId_attendanceDate: {
              labourerId: rec.labourerId,
              attendanceDate,
            },
          },
          update: {
            status: rec.status,
            remarks: rec.remarks || null,
            projectId: primaryProjectId,
            otHours: rec.otHours ? Number(rec.otHours) : 0.0,
          },
          create: {
            labourerId: rec.labourerId,
            attendanceDate,
            status: rec.status,
            remarks: rec.remarks || null,
            projectId: primaryProjectId,
            otHours: rec.otHours ? Number(rec.otHours) : 0.0,
          },
        });

        // 2. Sync Long-Term Project Assignments (only for active statuses: Present / Half Day)
        if (rec.status === 'Present' || rec.status === 'Half Day') {
          // Find all active project assignments for this worker
          const activeAssignments = await tx.projectLabourAssignment.findMany({
            where: {
              labourerId: rec.labourerId,
              isActive: true,
            },
          });

          const activeProjectIds = new Set(activeAssignments.map((a) => a.projectId));
          const selectedProjectIds = new Set(rec.projectIds);

          const lab = await tx.labourer.findUnique({
            where: { id: rec.labourerId },
            select: { name: true, labourCode: true },
          });

          // Deactivate assignments that are active but not selected today
          for (const assignment of activeAssignments) {
            if (!selectedProjectIds.has(assignment.projectId)) {
              await tx.projectLabourAssignment.update({
                where: { id: assignment.id },
                data: {
                  isActive: false,
                  unassignedDate: attendanceDate,
                },
              });

              await tx.projectActivity.create({
                data: {
                  projectId: assignment.projectId,
                  activityType: 'LABOUR_TRANSFERRED',
                  description: `Labourer ${lab?.name} (${lab?.labourCode}) unassigned to General Bench via Daily Register.`,
                },
              });
            }
          }

          // Create new assignments for projects that are selected but not active
          for (const projId of rec.projectIds) {
            if (!activeProjectIds.has(projId)) {
              await tx.projectLabourAssignment.create({
                data: {
                  projectId: projId,
                  labourerId: rec.labourerId,
                  role: 'Carpenter',
                  remarks: 'Assigned via Daily Work Register',
                  assignedDate: attendanceDate,
                  isActive: true,
                },
              });

              await tx.projectActivity.create({
                data: {
                  projectId: projId,
                  activityType: 'LABOUR_ASSIGNED',
                  description: `Labourer ${lab?.name} (${lab?.labourCode}) assigned via Daily Register.`,
                },
              });
            }
          }
        }

        // 3. Create Labour Payment Record
        if (rec.amountPaid && Number(rec.amountPaid) > 0) {
          await tx.labourPayment.create({
            data: {
              labourerId: rec.labourerId,
              paymentDate: attendanceDate,
              amount: Number(rec.amountPaid),
              paymentType: rec.paymentType || 'Daily Wage',
              remarks: rec.remarks || 'Logged from Daily Work Register',
            },
          });
        }

        // 4. Daily Attendance Activity Log (on all selected projects)
        for (const projId of rec.projectIds) {
          const lab = await tx.labourer.findUnique({
            where: { id: rec.labourerId },
            select: { name: true, labourCode: true },
          });
          await tx.projectActivity.create({
            data: {
              projectId: projId,
              activityType: 'ATTENDANCE_MARKED',
              description: `Labourer ${lab?.name || 'Worker'} (${lab?.labourCode || 'LAB'}) marked ${rec.status} today.`,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true, count: records.length });
  } catch (error: any) {
    console.error('Error in daily-register POST:', error);
    return NextResponse.json({ error: error.message || 'Failed to save daily register' }, { status: 500 });
  }
}
