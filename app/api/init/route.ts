/**
 * GET /api/init
 * One-time setup: creates sheet tabs + writes headers.
 * Safe to call multiple times — won't overwrite existing data.
 */
import { NextResponse } from 'next/server';
import { initSheets } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initSheets();
    return NextResponse.json({ success: true, message: 'Sheet tabs and headers initialised.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
