import { NextRequest, NextResponse } from 'next/server';
import { getProjectTaskById, initProjectSheets, updateProjectTask } from '@/lib/sheets';

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await initProjectSheets();
    const { id } = await context.params;
    const task = await getProjectTaskById(Number(id));
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await initProjectSheets();
    const { id } = await context.params;
    const body = await req.json();
    const task = await updateProjectTask(Number(id), {
      title: body.title,
      owner: body.owner,
      status: body.status,
      priority: body.priority,
      dueDate: body.dueDate,
      notes: body.notes,
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
