import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { note } = body;

    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayUTC = new Date(Date.UTC(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate()));
    const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);

    // Find if there is already a DAILY_NOTE for this project today
    const existingActivity = await prisma.projectActivity.findFirst({
      where: {
        projectId: id,
        activityType: 'DAILY_NOTE',
        createdAt: {
          gte: todayUTC,
          lt: tomorrowUTC,
        },
      },
    });

    if (existingActivity) {
      if (!note || note.trim() === '') {
        // Delete if note is cleared
        await prisma.projectActivity.delete({
          where: { id: existingActivity.id },
        });
        return NextResponse.json({ message: 'Daily note deleted' });
      } else {
        // Update existing note
        const updated = await prisma.projectActivity.update({
          where: { id: existingActivity.id },
          data: {
            description: note.trim(),
          },
        });
        return NextResponse.json(updated);
      }
    } else {
      if (!note || note.trim() === '') {
        return NextResponse.json({ message: 'No note to save' });
      }
      // Create new activity log for DAILY_NOTE
      const created = await prisma.projectActivity.create({
        data: {
          projectId: id,
          activityType: 'DAILY_NOTE',
          description: note.trim(),
          createdAt: todayUTC, // Pin to the beginning of today (UTC)
        },
      });
      return NextResponse.json(created);
    }
  } catch (error) {
    console.error('Error updating project daily note:', error);
    return NextResponse.json({ error: 'Failed to update daily note' }, { status: 500 });
  }
}
