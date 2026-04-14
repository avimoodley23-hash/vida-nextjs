import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingEvents, getBirthdays, createCalendarEvent } from '@/lib/google-calendar';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '');
  const action = req.nextUrl.searchParams.get('action');

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 });
  }

  try {
    if (action === 'birthdays') {
      const birthdays = await getBirthdays(accessToken);
      return NextResponse.json({ birthdays });
    }

    // Default: fetch upcoming events
    const days = parseInt(req.nextUrl.searchParams.get('days') || '14');
    const events = await getUpcomingEvents(accessToken, days);
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, title, date, time, description } = body;
    if (!accessToken || !title || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const result = await createCalendarEvent(accessToken, { title, date, time, description: description || 'Created by Vida' });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Calendar create error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create event' }, { status: 500 });
  }
}
