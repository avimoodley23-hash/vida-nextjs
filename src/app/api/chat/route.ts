import { NextRequest, NextResponse } from 'next/server';
import { processWithGemini } from '@/lib/gemini';
import { getUpcomingEvents, deleteCalendarEvent } from '@/lib/google-calendar';
import { getRecentEmails, getBankTransactions, getEmailBody, sendEmail } from '@/lib/gmail';
import { getWeather, weatherToContext } from '@/lib/weather';

// In-memory context cache per access token (5 min TTL)
interface CachedContext {
  calendarEvents: string[];
  gmailSummary: string[];
  gmailRaw: Array<{ id: string; from: string; subject: string; snippet: string }>;
  fetchedAt: number;
}

const contextCache = new Map<string, CachedContext>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(token: string): CachedContext | null {
  const c = contextCache.get(token);
  if (c && Date.now() - c.fetchedAt < CACHE_TTL) return c;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context, accessToken, workAccessToken, history } = body;

    if (!message) return NextResponse.json({ error: 'No message provided' }, { status: 400 });

    let calendarEvents: string[] = context?.recentEvents || [];
    let gmailSummary: string[] = [];
    let gmailRaw: CachedContext['gmailRaw'] = [];
    let bankSummary: string[] = [];

    // Fetch weather (uses Next.js fetch cache internally — 30 min revalidate)
    const weatherData = await getWeather().catch(() => null);
    const weatherContext = weatherData ? weatherToContext(weatherData) : undefined;

    if (accessToken) {
      const cached = getCached(accessToken);
      if (cached) {
        calendarEvents = cached.calendarEvents;
        gmailSummary = cached.gmailSummary;
        gmailRaw = cached.gmailRaw;
      } else {
        // Fetch calendar and gmail in parallel
        const [events, emails] = await Promise.allSettled([
          getUpcomingEvents(accessToken, 14),
          getRecentEmails(accessToken, 15),
        ]);

        if (events.status === 'fulfilled' && events.value.length > 0) {
          calendarEvents = events.value.slice(0, 10).map(e =>
            `${e.date}${e.time ? ' ' + e.time : ''} — ${e.title}${e.detail ? ` (${e.detail})` : ''}`
          );
        }

        if (emails.status === 'fulfilled') {
          gmailRaw = emails.value.map(e => ({ id: e.id, from: e.from, subject: e.subject, snippet: e.snippet }));
          gmailSummary = emails.value.map(e =>
            `[${e.id}] ${e.from} | ${e.subject}${e.snippet ? ` | ${e.snippet.slice(0, 100)}` : ''}`
          );
        }

        contextCache.set(accessToken, { calendarEvents, gmailSummary, gmailRaw, fetchedAt: Date.now() });
      }

      // Bank transactions only on relevant queries (not cached — they change)
      const isBankQuery = /bank|spend|spent|money|transaction|debit|fnb|absa|capitec|standard bank|nedbank|discovery bank|budget|afford|balance/i.test(message);
      if (isBankQuery) {
        try {
          const txns = await getBankTransactions(accessToken);
          if (txns.length > 0) {
            bankSummary = txns.map(t => `${t.date} | ${t.bank} | R${t.amount} | ${t.category} | ${t.description}`);
          }
        } catch { /* non-fatal */ }
      }
    }

    // Merge work account data (calendar + email)
    if (workAccessToken) {
      const workCached = getCached(workAccessToken);
      let workEvents: string[] = [];
      let workEmails: string[] = [];
      let workRaw: CachedContext['gmailRaw'] = [];
      if (workCached) {
        workEvents = workCached.calendarEvents;
        workEmails = workCached.gmailSummary;
        workRaw = workCached.gmailRaw;
      } else {
        const [wEvents, wEmails] = await Promise.allSettled([
          getUpcomingEvents(workAccessToken, 14),
          getRecentEmails(workAccessToken, 15),
        ]);
        if (wEvents.status === 'fulfilled') {
          workEvents = wEvents.value.slice(0, 10).map(e =>
            `[Work] ${e.date}${e.time ? ' ' + e.time : ''} — ${e.title}${e.detail ? ` (${e.detail})` : ''}`
          );
        }
        if (wEmails.status === 'fulfilled') {
          workRaw = wEmails.value.map(e => ({ id: 'w_' + e.id, from: e.from, subject: `[Work] ${e.subject}`, snippet: e.snippet }));
          workEmails = wEmails.value.map(e =>
            `[w_${e.id}] [Work] ${e.from} | ${e.subject}${e.snippet ? ` | ${e.snippet.slice(0, 100)}` : ''}`
          );
        }
        contextCache.set(workAccessToken, { calendarEvents: workEvents, gmailSummary: workEmails, gmailRaw: workRaw, fetchedAt: Date.now() });
      }
      calendarEvents = [...calendarEvents, ...workEvents];
      gmailSummary = [...gmailSummary, ...workEmails];
      gmailRaw = [...gmailRaw, ...workRaw];
    }

    // Build goals context from client-provided goals
    const goalsContext: string[] = (context?.goals || []).map(
      (g: { title: string; progress: number; target: number; unit: string; deadline?: string; category: string }) =>
        `${g.title}: ${g.progress}/${g.target} ${g.unit}${g.deadline ? ` (due ${g.deadline})` : ''} [${g.category}]`
    );

    // Build spending breakdown for context
    const spendingBreakdown = (context?.spending || []).map(
      (s: { cat: string; amount: number; budget: number }) =>
        `${s.cat}: R${s.amount} spent / R${s.budget} budget${s.amount > s.budget ? ' ⚠️ OVER' : s.amount > s.budget * 0.8 ? ' (nearing limit)' : ''}`
    );

    const result = await processWithGemini(message, {
      today: context?.today || new Date().toISOString().split('T')[0],
      currentTime: context?.currentTime || new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      userName: context?.userName,
      pendingReminders: context?.pendingReminders || 0,
      habitsDoneToday: context?.habitsDoneToday || 0,
      totalHabits: context?.totalHabits || 0,
      recentEvents: calendarEvents,
      monthSpending: context?.monthSpending || 0,
      spendingBreakdown,
      gmailSummary,
      bankTransactions: bankSummary,
      todosToday: context?.todosToday || [],
      todosWeekly: context?.todosWeekly || [],
      goalsContext,
      weatherContext,
    }, history);

    // Handle read_email: fetch full body and re-process
    if (result.action === 'read_email' && result.params?.emailId && accessToken) {
      try {
        const emailData = await getEmailBody(accessToken, String(result.params.emailId));
        if (emailData.body) {
          // Re-run Gemini with the full email body as extra context
          const followUp = await processWithGemini(message, {
            today: context?.today || new Date().toISOString().split('T')[0],
            currentTime: context?.currentTime || new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
            userName: context?.userName,
            pendingReminders: context?.pendingReminders || 0,
            habitsDoneToday: context?.habitsDoneToday || 0,
            totalHabits: context?.totalHabits || 0,
            recentEvents: calendarEvents,
            monthSpending: context?.monthSpending || 0,
            spendingBreakdown,
            gmailSummary,
            extraContext: `Full email body requested:\nFrom: ${emailData.from}\nSubject: ${emailData.subject}\nDate: ${emailData.date}\n\n${emailData.body}`,
          }, history);
          return NextResponse.json(followUp);
        }
      } catch (err) {
        console.error('read_email follow-up failed:', err);
      }
    }

    // Handle draft_email: return to client for confirmation (don't auto-send)
    if (result.action === 'draft_email' && result.params) {
      return NextResponse.json({
        ...result,
        draftEmail: {
          to: String(result.params.to || ''),
          subject: String(result.params.subject || ''),
          body: String(result.params.body || ''),
          threadId: result.params.threadId ? String(result.params.threadId) : undefined,
          inReplyTo: result.params.inReplyTo ? String(result.params.inReplyTo) : undefined,
        },
      });
    }

    // For suggest_schedule: return as calendarEvent so user can confirm and add
    if (result.action === 'suggest_schedule' && result.params?.title) {
      return NextResponse.json({
        ...result,
        calendarEvent: {
          title: String(result.params.title),
          date: String(result.params.suggestedDate || ''),
          time: result.params.suggestedTime ? String(result.params.suggestedTime) : undefined,
          type: 'event' as const,
          detail: result.params.reason ? String(result.params.reason) : undefined,
        },
      });
    }

    // For add_event: return event details so the client can show calendar add buttons
    if (result.action === 'add_event' && result.params?.title) {
      return NextResponse.json({
        ...result,
        calendarEvent: {
          title: String(result.params.title),
          date: String(result.params.date || ''),
          time: result.params.time ? String(result.params.time) : undefined,
          type: String(result.params.type || 'event'),
          detail: result.params.detail ? String(result.params.detail) : undefined,
        },
      });
    }

    // Delete calendar event
    if (accessToken && result.action === 'delete_event' && result.params?.googleEventId) {
      try {
        await deleteCalendarEvent(accessToken, String(result.params.googleEventId));
        contextCache.delete(accessToken);
      } catch { /* non-fatal */ }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { action: 'general', params: {}, response: "Something went wrong. Try again?" },
      { status: 500 }
    );
  }
}

// Endpoint to send a confirmed email draft
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, to, subject, emailBody, threadId, inReplyTo } = body;
    if (!accessToken || !to || !subject || !emailBody) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const result = await sendEmail(accessToken, { to, subject, body: emailBody, threadId, inReplyTo });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
