import { NextRequest, NextResponse } from 'next/server';
import { getItemById, getItemTransactions, updateItem, deleteItem } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// GET /api/items/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await getItemById(parseInt(id));
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const transactions = await getItemTransactions(parseInt(id), 20);
    return NextResponse.json({ ...item, transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/items/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, categoryId, subCategory, unit, stock, targetStock, reorderPoint, reorderQty, supplier, unitCost, location, itemCode } = body;

    const updated = await updateItem(parseInt(id), {
      ...(name != null ? { name } : {}),
      ...(categoryId != null ? { categoryId: parseInt(categoryId) } : {}),
      ...(subCategory !== undefined ? { subCategory: subCategory || null } : {}),
      ...(unit != null ? { unit } : {}),
      ...(stock != null ? { stock: parseInt(stock) } : {}),
      ...(targetStock != null ? { targetStock: parseInt(targetStock) } : {}),
      ...(reorderPoint !== undefined ? { reorderPoint: reorderPoint != null ? parseInt(reorderPoint) : null } : {}),
      ...(reorderQty !== undefined ? { reorderQty: reorderQty != null ? parseInt(reorderQty) : null } : {}),
      ...(supplier !== undefined ? { supplier: supplier || null } : {}),
      ...(unitCost !== undefined ? { unitCost: unitCost != null ? parseFloat(unitCost) : null } : {}),
      ...(location !== undefined ? { location: location || null } : {}),
      ...(itemCode !== undefined ? { itemCode: itemCode || null } : {}),
    });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/items/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ok = await deleteItem(parseInt(id));
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
