import { NextRequest, NextResponse } from 'next/server';
import { getConsumptionReport, initOccupancySheet, initNexDoSheets } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  try {
    await Promise.all([initOccupancySheet(), initNexDoSheets()]);
    const days = Number(new URL(req.url).searchParams.get('days') ?? '30');
    const data = await getConsumptionReport(Math.min(Math.max(days, 7), 90));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
