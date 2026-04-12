import { NextRequest, NextResponse } from 'next/server';
import { getNexDoItems, createNexDoItem, initNexDoSheets } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  try {
    await initNexDoSheets();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') ?? undefined;
    const search   = searchParams.get('search')   ?? undefined;
    const items = await getNexDoItems({ category, search });
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initNexDoSheets();
    const body = await req.json();
    const item = await createNexDoItem({
      code:         body.code        ?? '',
      name:         body.name        ?? '',
      category:     body.category    ?? 'Tools',
      subcategory:  body.subcategory ?? '',
      unit:         body.unit        ?? 'Each',
      stock:        Number(body.stock)        || 0,
      targetStock:  Number(body.targetStock)  || 0,
      reorderPoint: Number(body.reorderPoint) || 0,
      reorderQty:   Number(body.reorderQty)   || 0,
      unitCost:     body.unitCost != null ? Number(body.unitCost) : null,
      notes:        body.notes ?? '',
    });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
