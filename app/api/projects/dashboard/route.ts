import { NextResponse } from 'next/server';
import { getProjectsDashboard, initProjectSheets } from '@/lib/sheets';

export async function GET() {
  try {
    await initProjectSheets();
    const data = await getProjectsDashboard();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
