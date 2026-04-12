import { NextRequest, NextResponse } from 'next/server';
import { getNexDoItemById, updateNexDoItem, initNexDoSheets } from '@/lib/sheets';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initNexDoSheets();
    const { id } = await params;
    const item = await getNexDoItemById(Number(id));
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initNexDoSheets();
    const { id } = await params;
    const body = await req.json();
    const item = await updateNexDoItem(Number(id), body);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
