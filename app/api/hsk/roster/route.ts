import { NextRequest, NextResponse } from 'next/server';
import { getHSKRoster, upsertHSKRosterEntry, initHSKSheets, HSK_PHONE_COUNT } from '@/lib/sheets';

export async function GET() {
  try {
    await initHSKSheets();
    const roster = await getHSKRoster();
    return NextResponse.json({ roster, phoneCount: HSK_PHONE_COUNT });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initHSKSheets();
    const body = await req.json();
    if (body.phoneId == null || !body.name) {
      return NextResponse.json({ error: 'phoneId and name required' }, { status: 400 });
    }
    const phoneId = Number(body.phoneId);
    if (phoneId < 1 || phoneId > HSK_PHONE_COUNT) {
      return NextResponse.json({ error: `phoneId must be 1-${HSK_PHONE_COUNT}` }, { status: 400 });
    }
    const entry = await upsertHSKRosterEntry({
      phoneId,
      name: String(body.name).trim(),
      role: body.role,
      active: body.active,
      notes: body.notes,
    });
    return NextResponse.json({ entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
