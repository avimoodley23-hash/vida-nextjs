import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingEvents } from '@/lib/google-calendar';
import { getRecentEmails } from '@/lib/gmail';
import { generateBriefingNotifications } from '@/lib/gemini';
import { generateBriefingNotificationsOpenAI } from '@/lib/openai-ai';
import { generateBriefingNotificationsGroq } from '@/lib/groq-ai';
import { getWeather, weatherToContext } from '@/lib/weather';

async function generateBriefing(
  model: string,
  ...args: Parameters<typeof generateBriefingNotifications>
): ReturnType<typeof generateBriefingNotifications> {
  if (model === 'gpt') return generateBriefingNotificationsOpenAI(...args);
  if (model === 'groq') return generateBriefingNotificationsGroq(...args);
  // Default: Gemini → auto-fallback to Groq (free) on rate-limit/error
  try {
    const result = await generateBriefingNotifications(...args);
    if (result.length > 0) return result;
    throw new Error('gemini_empty');
  } catch {
    if (process.env.GROQ_API_KEY) return generateBriefingNotificationsGroq(...args);
    if (process.env.OPENAI_API_KEY) return generateBriefingNotificationsOpenAI(...args);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, workAccessToken, spending, habits, today, currentTime, userName, model = 'gemini' } = body;

    if (!accessToken) return NextResponse.json({ error: 'No access token' }, { status: 401 });

    const todayStr = today || new Date().toISOString().split('T')[0];

    const [events, emails, weatherData] = await Promise.allSettled([
      getUpcomingEvents(accessToken, 14),
      getRecentEmails(accessToken, 10),
      getWeather(),
    ]);

    const weatherContext = weatherData.status === 'fulfilled' && weatherData.value
      ? weatherToContext(weatherData.value)
      : undefined;

    let calendarEvents = events.status === 'fulfilled'
      ? events.value.map(e => `${e.date}${e.time ? ' ' + e.time : ''} — ${e.title}${e.detail ? ` (${e.detail})` : ''}`)
      : [];

    let gmailSummary = emails.status === 'fulfilled'
      ? emails.value.map(e => `${e.from} | ${e.subject}${e.snippet ? ` | ${e.snippet.slice(0, 100)}` : ''}`)
      : [];

    // Merge work account data if present
    if (workAccessToken) {
      const [wEvents, wEmails] = await Promise.allSettled([
        getUpcomingEvents(workAccessToken, 14),
        getRecentEmails(workAccessToken, 10),
      ]);
      if (wEvents.status === 'fulfilled') {
        calendarEvents = [
          ...calendarEvents,
          ...wEvents.value.map(e => `[Work] ${e.date}${e.time ? ' ' + e.time : ''} — ${e.title}${e.detail ? ` (${e.detail})` : ''}`),
        ];
      }
      if (wEmails.status === 'fulfilled') {
        gmailSummary = [
          ...gmailSummary,
          ...wEmails.value.map(e => `[Work] ${e.from} | ${e.subject}${e.snippet ? ` | ${e.snippet.slice(0, 100)}` : ''}`),
        ];
      }
    }

    // Spending breakdown with budget comparison
    const spendingBreakdown: string[] = (spending || []).map(
      (s: { cat: string; amount: number; budget: number }) =>
        `${s.cat}: R${s.amount} / R${s.budget} budget${s.amount > s.budget ? ' (OVER)' : s.amount > s.budget * 0.8 ? ' (nearing limit)' : ''}`
    );

    // Habit summary: name + days since last logged
    const habitsSummary: string[] = (habits || []).map((h: { name: string; log: Record<string, boolean>; streak: number }) => {
      let daysSince = 0;
      for (let i = 0; i < 14; i++) {
        const d = new Date(todayStr);
        d.setDate(d.getDate() - i);
        if (h.log[d.toISOString().split('T')[0]]) break;
        daysSince++;
      }
      return `${h.name}: streak ${h.streak} days, last logged ${daysSince === 0 ? 'today' : `${daysSince} days ago`}`;
    });

    const notifications = await generateBriefing(model, {
      today: todayStr,
      currentTime: currentTime || new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      userName,
      calendarEvents,
      gmailSummary,
      spendingBreakdown,
      habitsSummary,
      weatherContext,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Briefing error:', error);
    return NextResponse.json({ notifications: [] }, { status: 500 });
  }
}
