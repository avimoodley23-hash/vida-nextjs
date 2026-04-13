import { NextRequest, NextResponse } from 'next/server';
import { processWithGemini } from '@/lib/gemini';
import { createCalendarEvent, getUpcomingEvents } from '@/lib/google-calendar';
import { getRecentEmails } from '@/lib/gmail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context, accessToken } = body;

    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    }

    // Fetch live Google data to enrich Gemini's context
    let calendarEvents: string[] = context?.recentEvents || [];
    let gmailSummary: string[] = [];

    if (accessToken) {
      // Always pull upcoming calendar events so Gemini has real schedule context
      try {
        const events = await getUpcomingEvents(accessToken, 14);
        if (events.length > 0) {
          calendarEvents = events
            .slice(0, 8)
            .map(e => `${e.date}${e.time ? ' ' + e.time : ''} — ${e.title}${e.detail ? ` (${e.detail})` : ''}`);
        }
      } catch (err) {
        console.error('Calendar pre-fetch failed:', err);
      }

      // Fetch Gmail inbox summaries for context
      try {
        const emails = await getRecentEmails(accessToken, 8);
        gmailSummary = emails.map(e => `From: ${e.from} | Subject: ${e.subject}`);
      } catch (err) {
        console.error('Gmail pre-fetch failed:', err);
      }
    }

    // Process through Gemini with enriched context
    const result = await processWithGemini(message, {
      today: context?.today || new Date().toISOString().split('T')[0],
      currentTime: context?.currentTime || new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      pendingReminders: context?.pendingReminders || 0,
      habitsDoneToday: context?.habitsDoneToday || 0,
      totalHabits: context?.totalHabits || 0,
      recentEvents: calendarEvents,
      monthSpending: context?.monthSpending || 0,
      gmailSummary,
    });

    // If action is to create a reminder/event and we have a token, also add to Google Calendar
    if (accessToken && (result.action === 'create_reminder' || result.action === 'add_event') && result.params) {
      try {
        const calResult = await createCalendarEvent(accessToken, {
          title: String(result.params.title || ''),
          date: String(result.params.date || ''),
          time: result.params.time ? String(result.params.time) : undefined,
          description: 'Created by Vida',
        });
        if (calResult.success) {
          result.response += '\n\n📅 Added to your Google Calendar (syncs to iPhone too)!';
          result.params.googleEventId = calResult.eventId || '';
        }
      } catch (err) {
        console.error('Calendar sync failed:', err);
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
