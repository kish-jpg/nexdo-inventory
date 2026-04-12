import { NextRequest, NextResponse } from 'next/server';
import { adjustNexDoStock, initNexDoSheets } from '@/lib/sheets';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initNexDoSheets();
    const { id } = await params;
    const { type, quantity, reason, doneBy } = await req.json();
    if (!['add', 'remove', 'stocktake'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    const result = await adjustNexDoStock(Number(id), type, Number(quantity), reason, doneBy);
    if (!result) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
