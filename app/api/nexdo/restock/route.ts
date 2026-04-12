import { NextResponse } from 'next/server';
import { getNexDoRestockList, initNexDoSheets } from '@/lib/sheets';

export async function GET() {
  try {
    await initNexDoSheets();
    const items = await getNexDoRestockList();
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
