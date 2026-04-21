import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjects, initProjectSheets } from '@/lib/sheets';

export async function GET() {
  try {
    await initProjectSheets();
    const projects = await getProjects();
    return NextResponse.json({ projects });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initProjectSheets();
    const body = await req.json();
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const project = await createProject({
      name: String(body.name),
      client: body.client,
      owner: body.owner,
      status: body.status,
      priority: body.priority,
      startDate: body.startDate,
      dueDate: body.dueDate,
      progress: body.progress != null ? Number(body.progress) : 0,
      summary: body.summary,
      notes: body.notes,
    });

    return NextResponse.json({ project });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
