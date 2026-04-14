import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingEvents } from '@/lib/google-calendar';
import { getRecentEmails } from '@/lib/gmail';
import { generateBriefingNotifications } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, spending, habits, today, currentTime, userName } = body;

    if (!accessToken) return NextResponse.json({ error: 'No access token' }, { status: 401 });

    const todayStr = today || new Date().toISOString().split('T')[0];

    const [events, emails] = await Promise.allSettled([
      getUpcomingEvents(accessToken, 14),
      getRecentEmails(accessToken, 10),
    ]);

    const calendarEvents = events.status === 'fulfilled'
      ? events.value.map(e => `${e.date}${e.time ? ' ' + e.time : ''} — ${e.title}${e.detail ? ` (${e.detail})` : ''}`)
      : [];

    const gmailSummary = emails.status === 'fulfilled'
      ? emails.value.map(e => `${e.from} | ${e.subject}${e.snippet ? ` | ${e.snippet.slice(0, 100)}` : ''}`)
      : [];

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

    const notifications = await generateBriefingNotifications({
      today: todayStr,
      currentTime: currentTime || new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      userName,
      calendarEvents,
      gmailSummary,
      spendingBreakdown,
      habitsSummary,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Briefing error:', error);
    return NextResponse.json({ notifications: [] }, { status: 500 });
  }
}
