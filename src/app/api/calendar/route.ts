import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingEvents, getBirthdays } from '@/lib/google-calendar';

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
