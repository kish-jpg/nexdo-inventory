import { NextRequest, NextResponse } from 'next/server';
import { createProjectTask, getProjectTasks, initProjectSheets } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  try {
    await initProjectSheets();
    const sp = new URL(req.url).searchParams;
    const projectId = sp.get('projectId');
    const status = sp.get('status') ?? undefined;
    const limit = sp.get('limit');
    const tasks = await getProjectTasks({
      projectId: projectId ? Number(projectId) : undefined,
      status,
      limit: limit ? Number(limit) : undefined,
    });
    return NextResponse.json({ tasks });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initProjectSheets();
    const body = await req.json();
    if (!body.projectId || !body.title || !String(body.title).trim()) {
      return NextResponse.json({ error: 'projectId and title are required' }, { status: 400 });
    }

    const task = await createProjectTask({
      projectId: Number(body.projectId),
      title: String(body.title),
      owner: body.owner,
      status: body.status,
      priority: body.priority,
      dueDate: body.dueDate,
      notes: body.notes,
    });

    return NextResponse.json({ task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
