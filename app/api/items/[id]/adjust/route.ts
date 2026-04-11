import { NextRequest, NextResponse } from 'next/server';
import { adjustStock } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// POST /api/items/[id]/adjust
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { type, quantity, reason, doneBy } = body;

    if (!type || quantity == null) {
      return NextResponse.json({ error: 'type and quantity are required' }, { status: 400 });
    }
    if (!['add', 'remove', 'stocktake'].includes(type)) {
      return NextResponse.json({ error: 'type must be add, remove, or stocktake' }, { status: 400 });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json({ error: 'quantity must be a non-negative number' }, { status: 400 });
    }

    const result = await adjustStock(parseInt(id), type, qty, reason, doneBy);
    if (!result) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
