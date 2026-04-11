import { NextResponse } from 'next/server';
import { getLaundryReconciliation, initLaundrySheets } from '@/lib/sheets';

export async function GET() {
  try {
    await initLaundrySheets();
    const data = await getLaundryReconciliation();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
