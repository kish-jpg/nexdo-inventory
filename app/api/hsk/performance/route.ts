import { NextRequest, NextResponse } from 'next/server';
import {
  getHSKPerformance, saveHSKPerformance, deleteHSKPerformance,
  getHSKDailyKPIs, initHSKSheets, HSK_PHONE_COUNT,
} from '@/lib/sheets';

export async function GET(req: NextRequest) {
  try {
    await initHSKSheets();
    const sp = new URL(req.url).searchParams;
    const view = sp.get('view'); // "kpis" | "entries" (default)
    if (view === 'kpis') {
      const days = Math.min(Math.max(Number(sp.get('days') ?? 30), 7), 90);
      const kpis = await getHSKDailyKPIs(days);
      return NextResponse.json({ kpis, days });
    }
    const entries = await getHSKPerformance({
      date: sp.get('date') ?? undefined,
      phoneId: sp.get('phoneId') ? Number(sp.get('phoneId')) : undefined,
      fromDate: sp.get('fromDate') ?? undefined,
      toDate: sp.get('toDate') ?? undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });
    return NextResponse.json({ entries });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initHSKSheets();
    const body = await req.json();
    if (!body.date || body.phoneId == null || !body.housekeeperName) {
      return NextResponse.json({ error: 'date, phoneId, housekeeperName required' }, { status: 400 });
    }
    const phoneId = Number(body.phoneId);
    if (phoneId < 1 || phoneId > HSK_PHONE_COUNT) {
      return NextResponse.json({ error: `phoneId must be 1-${HSK_PHONE_COUNT}` }, { status: 400 });
    }
    const entry = await saveHSKPerformance({
      date: body.date,
      phoneId,
      housekeeperName: String(body.housekeeperName).trim(),
      roomsAssigned: Number(body.roomsAssigned ?? 0),
      departuresDone: Number(body.departuresDone ?? 0),
      stayoversDone: Number(body.stayoversDone ?? 0),
      minutesWorked: Number(body.minutesWorked ?? 0),
      qualityScore: body.qualityScore != null ? Number(body.qualityScore) : null,
      notes: body.notes,
      source: body.source ?? 'Manual',
    });
    return NextResponse.json({ entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await initHSKSheets();
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const ok = await deleteHSKPerformance(id);
    return NextResponse.json({ ok });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
