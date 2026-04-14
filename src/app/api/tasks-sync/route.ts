import { NextRequest, NextResponse } from 'next/server';
import { getGoogleTasks, createGoogleTask, completeGoogleTask } from '@/lib/google-tasks';

// GET — fetch tasks from Google
export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) return NextResponse.json({ error: 'No access token' }, { status: 401 });
  try {
    const tasks = await getGoogleTasks(accessToken);
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST — create a task in Google
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, title, notes, due } = body;
    if (!accessToken || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const result = await createGoogleTask(accessToken, title, notes, due);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// PATCH — mark a task complete in Google
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, taskId } = body;
    if (!accessToken || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const success = await completeGoogleTask(accessToken, taskId);
    return NextResponse.json({ success });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
