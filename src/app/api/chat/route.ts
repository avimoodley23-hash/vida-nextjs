import { NextRequest, NextResponse } from 'next/server';
import { processWithGemini } from '@/lib/gemini';
import { createCalendarEvent, getUpcomingEvents } from '@/lib/google-calendar';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context, accessToken } = body;

    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    }

    // Process through Gemini
    const result = await processWithGemini(message, {
      today: context?.today || new Date().toISOString().split('T')[0],
      currentTime: context?.currentTime || new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      pendingReminders: context?.pendingReminders || 0,
      habitsDoneToday: context?.habitsDoneToday || 0,
      totalHabits: context?.totalHabits || 0,
      recentEvents: context?.recentEvents || [],
      monthSpending: context?.monthSpending || 0,
    });

    // If we have a Google access token and the action involves calendar, sync
    if (accessToken && result.action === 'create_reminder' && result.params) {
      try {
        const calResult = await createCalendarEvent(accessToken, {
          title: String(result.params.title || ''),
          date: String(result.params.date || ''),
          time: result.params.time ? String(result.params.time) : undefined,
          description: 'Created by Vida',
        });
        
        if (calResult.success) {
          result.response += '\n\n📅 Also added to your Google Calendar!';
          result.params.googleEventId = calResult.eventId || '';
        }
      } catch (err) {
        console.error('Calendar sync failed:', err);
        // Don't fail the whole request — reminder still saved locally
      }
    }

    // If checking schedule and we have access token, enrich with Google Calendar
    if (accessToken && result.action === 'check_schedule') {
      try {
        const events = await getUpcomingEvents(accessToken, 7);
        if (events.length > 0) {
          const eventList = events
            .slice(0, 5)
            .map(e => `• ${e.date} — ${e.title}${e.detail ? ` (${e.detail})` : ''}`)
            .join('\n');
          result.response += `\n\nFrom Google Calendar:\n${eventList}`;
          result.params.googleEvents = JSON.stringify(events);
        }
      } catch (err) {
        console.error('Calendar fetch failed:', err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        action: 'general',
        params: {},
        response: "Something went wrong on my end. Try again?",
      },
      { status: 500 }
    );
  }
}
