import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory, getItems } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// GET /api/categories
export async function GET() {
  try {
    const [categories, items] = await Promise.all([getCategories(), getItems()]);
    // Attach item count
    const withCount = categories.map(c => ({
      ...c,
      _count: { items: items.filter(i => i.categoryId === c.id).length },
    }));
    return NextResponse.json(withCount);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/categories
export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const category = await createCategory(name);
    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
