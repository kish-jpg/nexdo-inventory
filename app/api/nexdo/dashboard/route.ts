import { NextResponse } from 'next/server';
import { getNexDoDashboardStats, initNexDoSheets } from '@/lib/sheets';

export async function GET() {
  try {
    await initNexDoSheets();
    const data = await getNexDoDashboardStats();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
