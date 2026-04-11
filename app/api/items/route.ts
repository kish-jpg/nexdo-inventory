import { NextRequest, NextResponse } from 'next/server';
import { getItems, createItem } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// GET /api/items
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const items = await getItems({
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      search: search ?? undefined,
    });
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/items
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, categoryId, subCategory, unit, stock, targetStock, reorderPoint, reorderQty, supplier, unitCost, location, itemCode } = body;

    if (!name || !categoryId || targetStock == null) {
      return NextResponse.json({ error: 'name, categoryId, and targetStock are required' }, { status: 400 });
    }

    const item = await createItem({
      name, categoryId: parseInt(categoryId),
      subCategory: subCategory || null, unit: unit || 'Each',
      stock: parseInt(stock ?? 0), targetStock: parseInt(targetStock),
      reorderPoint: reorderPoint ? parseInt(reorderPoint) : null,
      reorderQty: reorderQty ? parseInt(reorderQty) : null,
      supplier: supplier || null, unitCost: unitCost ? parseFloat(unitCost) : null,
      location: location || null, itemCode: itemCode || null,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
