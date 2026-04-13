import { NextRequest, NextResponse } from 'next/server';
import { getOccupancyLogs, saveOccupancyLog, initOccupancySheet } from '@/lib/sheets';

export async function GET() {
  try {
    await initOccupancySheet();
    const logs = await getOccupancyLogs(90);
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initOccupancySheet();
    const body = await req.json();
    if (!body.date || body.occupiedRooms == null) {
      return NextResponse.json({ error: 'date and occupiedRooms required' }, { status: 400 });
    }
    const log = await saveOccupancyLog({
      date: body.date,
      occupiedRooms: Math.min(322, Math.max(0, Number(body.occupiedRooms))),
      notes: body.notes ?? '',
    });
    return NextResponse.json({ log });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
