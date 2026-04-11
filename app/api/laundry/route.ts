import { NextRequest, NextResponse } from 'next/server';
import { getLaundryLogs, saveLaundryLog, initLaundrySheets } from '@/lib/sheets';

export async function GET() {
  try {
    await initLaundrySheets();
    const logs = await getLaundryLogs(60);
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initLaundrySheets();
    const body = await req.json();
    const log = await saveLaundryLog({
      date:        body.date        ?? new Date().toISOString().slice(0, 10),
      kingDep:     Number(body.kingDep)     || 0,
      kingRegular: Number(body.kingRegular) || 0,
      kingDay3:    Number(body.kingDay3)    || 0,
      twinDep:     Number(body.twinDep)     || 0,
      twinRegular: Number(body.twinRegular) || 0,
      twinDay3:    Number(body.twinDay3)    || 0,
      notes:       body.notes ?? '',
    });
    return NextResponse.json({ log });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
