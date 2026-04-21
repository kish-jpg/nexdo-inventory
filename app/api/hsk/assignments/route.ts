import { NextRequest, NextResponse } from 'next/server';
import {
  getHSKAssignments, saveHSKAssignment, deleteHSKAssignment,
  initHSKSheets, HSK_PHONE_COUNT,
} from '@/lib/sheets';

export async function GET(req: NextRequest) {
  try {
    await initHSKSheets();
    const date = new URL(req.url).searchParams.get('date') ?? undefined;
    const assignments = await getHSKAssignments(date);
    return NextResponse.json({ assignments });
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
    const assignment = await saveHSKAssignment({
      date: body.date,
      phoneId,
      housekeeperName: String(body.housekeeperName).trim(),
      shift: body.shift,
      startTime: body.startTime,
      endTime: body.endTime,
      notes: body.notes,
    });
    return NextResponse.json({ assignment });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await initHSKSheets();
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const ok = await deleteHSKAssignment(id);
    return NextResponse.json({ ok });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
