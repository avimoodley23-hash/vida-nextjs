import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './gemini';

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return client;
}

export async function processWithOpenAI(
  userMessage: string,
  context: {
    today: string;
    currentTime: string;
    userName?: string;
    pendingReminders: number;
    habitsDoneToday: number;
    totalHabits: number;
    recentEvents: string[];
    monthSpending: number;
    spendingBreakdown?: string[];
    gmailSummary?: string[];
    bankTransactions?: string[];
    todosToday?: string[];
    todosWeekly?: string[];
    goalsContext?: string[];
    weatherContext?: string;
    extraContext?: string;
  },
  history?: { role: 'user' | 'assistant'; text: string }[]
): Promise<{
  action: string;
  params: Record<string, string | number | boolean>;
  response: string;
}> {
  const historySection = history && history.length > 0
    ? `\nRecent conversation:\n${history.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Vida'}: ${m.text.slice(0, 200)}`).join('\n')}`
    : '';

  const contextString = `
Today: ${context.today}
Time: ${context.currentTime}
User: ${context.userName || 'the user'}
Pending reminders: ${context.pendingReminders}
Habits done today: ${context.habitsDoneToday}/${context.totalHabits}

Upcoming Google Calendar events:
${context.recentEvents.length > 0 ? context.recentEvents.join('\n') : 'None in the next 2 weeks'}

${context.todosToday && context.todosToday.length > 0 ? `Today's todos:\n${context.todosToday.join('\n')}` : "Today's todos: none"}
${context.todosWeekly && context.todosWeekly.length > 0 ? `\nThis week's todos:\n${context.todosWeekly.join('\n')}` : ''}

Month spending: R${context.monthSpending}
${context.spendingBreakdown && context.spendingBreakdown.length > 0 ? `Spending vs budget:\n${context.spendingBreakdown.join('\n')}` : ''}

${context.gmailSummary && context.gmailSummary.length > 0 ? `Recent emails (ID in brackets | From | Subject | Preview):\n${context.gmailSummary.join('\n')}` : 'No recent emails'}

${context.bankTransactions && context.bankTransactions.length > 0 ? `Recent bank transactions:\n${context.bankTransactions.join('\n')}` : ''}

${context.goalsContext && context.goalsContext.length > 0 ? `Goals:\n${context.goalsContext.join('\n')}` : ''}

${context.weatherContext ? `Weather: ${context.weatherContext}` : ''}

${context.extraContext ? `\nADDITIONAL CONTEXT:\n${context.extraContext}` : ''}
${historySection}
`;

  try {
    const completion = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `${SYSTEM_PROMPT}\n\nContext:\n${contextString}\n\nUser: "${userMessage}"`,
        },
      ],
      temperature: 0.65,
      max_tokens: 600,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      action: parsed.action || 'general',
      params: parsed.params || {},
      response: parsed.response || "Not sure what you mean — try asking me about your schedule, emails, or to set a reminder!",
    };
  } catch (error) {
    console.error('OpenAI error:', error);
    return {
      action: 'general',
      params: {},
      response: "Sorry, had a moment there. Try again?",
    };
  }
}

const BRIEFING_PROMPT = `You are Vida, a smart personal assistant in Cape Town, South Africa. Analyse the user's data and generate 2-5 proactive, specific, actionable notifications.

Think like a smart PA:
- Upcoming event this week (braai, party, birthday)? → suggest prep action (buy food/gift, book transport)
- Budget over or nearly over in any category? → warn with specific Rand amounts
- Habit not logged in 2+ days? → flag streak risk by name
- Important or unread email needing action? → surface it
- Same-day event? → prep reminder

Be specific and actionable. South African context.
Only generate notifications with clear evidence in the data. Max 5, prioritised by urgency.`;

export async function generateBriefingNotificationsOpenAI(context: {
  today: string;
  currentTime: string;
  userName?: string;
  calendarEvents: string[];
  gmailSummary: string[];
  spendingBreakdown: string[];
  habitsSummary: string[];
  weatherContext?: string;
}): Promise<Array<{
  type: 'calendar_prep' | 'spending' | 'habit' | 'email' | 'general';
  title: string;
  body: string;
  urgency: 'high' | 'medium' | 'low';
}>> {
  const userContent = `${BRIEFING_PROMPT}

Data:
Today: ${context.today} ${context.currentTime}
User: ${context.userName || 'the user'}

Calendar (next 14 days):
${context.calendarEvents.length > 0 ? context.calendarEvents.join('\n') : 'No upcoming events'}

Recent emails:
${context.gmailSummary.length > 0 ? context.gmailSummary.join('\n') : 'No emails'}

Spending vs budget:
${context.spendingBreakdown.length > 0 ? context.spendingBreakdown.join('\n') : 'No spending data'}

Habits (days since last logged):
${context.habitsSummary.length > 0 ? context.habitsSummary.join('\n') : 'No habits'}

${context.weatherContext ? `Weather: ${context.weatherContext}` : ''}

Return ONLY a JSON array, no other text:
[{"type":"calendar_prep"|"spending"|"habit"|"email"|"general","title":"max 40 chars","body":"specific actionable detail, max 120 chars","urgency":"high"|"medium"|"low"}]`;

  try {
    const completion = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.5,
      max_tokens: 800,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('OpenAI briefing error:', error);
    return [];
  }
}
