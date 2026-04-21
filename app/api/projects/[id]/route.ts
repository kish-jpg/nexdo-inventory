import { NextRequest, NextResponse } from 'next/server';
import { getProjectById, initProjectSheets, updateProject } from '@/lib/sheets';

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await initProjectSheets();
    const { id } = await context.params;
    const project = await getProjectById(Number(id));
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await initProjectSheets();
    const { id } = await context.params;
    const body = await req.json();
    const project = await updateProject(Number(id), {
      name: body.name,
      client: body.client,
      owner: body.owner,
      status: body.status,
      priority: body.priority,
      startDate: body.startDate,
      dueDate: body.dueDate,
      progress: body.progress != null ? Number(body.progress) : undefined,
      summary: body.summary,
      notes: body.notes,
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
