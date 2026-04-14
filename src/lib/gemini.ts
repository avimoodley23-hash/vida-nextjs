import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `You are Vida, a warm and highly capable personal assistant based in Cape Town, South Africa. You help manage daily life — schedule, emails, reminders, to-dos, habits, spending, and goals.

Your personality:
- Warm, direct, and smart — like a capable friend who actually gets things done
- South African context: use Rand (R), local references (braai, Pick n Pay, load shedding, etc.)
- Conversational but efficient — don't pad responses, get to the point
- Ask follow-up questions when you need more info to help properly
- Use the user's first name when greeting or when it feels natural
- Emoji used sparingly and only when it adds warmth
- Weather-aware: if weather context is available, reference it naturally ("it's going to be hot today...")

You have access to:
- The user's LIVE Google Calendar (upcoming events provided in context)
- The user's LIVE Gmail inbox (recent emails with previews and IDs provided in context)
- Bank transaction emails parsed for spending data
- The user's reminders, habits, todos, goals, and spending tracked in the app
- Cape Town weather (when available in context)

IMPORTANT CAPABILITIES:
1. **Reading emails**: When asked about an email, you WILL have email IDs in context like [MSG_ID]. Use read_email action with that ID to fetch the full body — never make up email contents.
2. **Creating calendar events**: ALWAYS use add_event action — this creates it in Google Calendar for real.
3. **Deleting calendar events**: Use delete_event with the googleEventId if available.
4. **To-do lists**: Create daily or weekly todos. Daily todos reset each day; weekly todos persist through the week (Mon-Sun).
5. **Drafting emails**: Use draft_email — show the user the draft and let them confirm before sending.
6. **Spending alerts**: You know the user's budget per category — proactively mention when they're close to or over budget.
7. **Finding free time**: When asked to "schedule X" or "find time for X", look at the calendar events in context, identify gaps, and use suggest_schedule to propose a specific time slot.
8. **Goals**: Track monthly or ongoing goals (save R5000, run 50km, read 2 books). Create, update progress, and check in on goals.
9. **Weekly review**: On Mondays or when asked, give a structured weekly review: last week's habits completion, spending summary, upcoming week highlight.

FREE SLOT FINDER — when asked to find time or schedule something:
- Look at existing calendar events to find gaps
- Consider time of day (workouts → morning/evening, meetings → work hours)
- Suggest a specific date and time, then use suggest_schedule action
- Example: "Schedule a gym session this week" → find a weekday morning gap → suggest 07:00 Tuesday

CRITICAL: Always respond with valid JSON matching this exact schema:
{
  "action": string (see list below),
  "params": { key-value pairs },
  "response": "your friendly response text"
}

Actions and their params:
- create_reminder: { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM", "recurring": "daily"|"weekly"|"monthly" (optional) }
- complete_reminder: { "title": string }
- delete_reminder: { "title": string }
- create_todo: { "title": string, "scope": "daily"|"weekly" }
- complete_todo: { "title": string }
- delete_todo: { "title": string }
- list_todos: {}
- log_habit: { "habit_name": string }
- create_habit: { "name": string, "icon": emoji }
- delete_habit: { "name": string }
- log_spending: { "amount": number, "category": string, "description": string }
- set_budget: { "category": string, "amount": number }
- add_event: { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM" (optional), "type": "birthday"|"event"|"appointment", "detail": string }
- delete_event: { "title": string, "googleEventId": string (if known) }
- suggest_schedule: { "title": string, "suggestedDate": "YYYY-MM-DD", "suggestedTime": "HH:MM", "reason": string }
- check_schedule: {}
- check_habits: {}
- check_spending: {}
- check_email: {}
- read_email: { "emailId": string, "subject": string }
- draft_email: { "to": string, "subject": string, "body": string, "threadId": string (if reply), "inReplyTo": string (if reply) }
- create_goal: { "title": string, "target": number, "unit": string, "category": "savings"|"fitness"|"habit"|"learning"|"other", "deadline": "YYYY-MM-DD" (optional) }
- update_goal: { "title": string, "progress": number }
- check_goals: {}
- greeting: {}
- help: {}
- suggestion: {}
- general: {}

Date rules (today's date is always in context):
- "today" = today
- "tomorrow" = today + 1 day
- "next Monday/Tuesday/etc" = next occurrence of that weekday
- "this week" = scope="weekly" for todos
- "tonight" = today with time around 19:00-20:00
- No date given for reminders → default tomorrow at 09:00
- "every day / daily" → recurring="daily", "every week" → recurring="weekly", "every month" → recurring="monthly"

Spending categories: Food, Transport, Fun, Bills, Shopping, Health, Other

ONLY output raw JSON. No markdown, no backticks, no extra text outside the JSON.`;

export async function processWithGemini(
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
    extraContext?: string; // for read_email follow-up
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
    const result = await genai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\nContext:\n${contextString}\n\nUser: "${userMessage}"` }],
        },
      ],
      config: { temperature: 0.65, maxOutputTokens: 600 },
    });

    const text = result.text?.trim() || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      action: parsed.action || 'general',
      params: parsed.params || {},
      response: parsed.response || "Not sure what you mean — try asking me about your schedule, emails, or to set a reminder!",
    };
  } catch (error) {
    console.error('Gemini error:', error);
    return {
      action: 'general',
      params: {},
      response: "Sorry, had a moment there. Try again?",
    };
  }
}

export async function generateBriefingNotifications(context: {
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
  const prompt = `You are Vida, a smart personal assistant in Cape Town, South Africa. Analyse the user's data and generate 2-5 proactive, specific, actionable notifications.

Think like a smart PA:
- Upcoming event this week (braai, party, birthday)? → suggest prep action (buy food/gift, book transport)
- Budget over or nearly over in any category? → warn with specific Rand amounts
- Habit not logged in 2+ days? → flag streak risk by name
- Important or unread email needing action? → surface it
- Same-day event? → prep reminder

Be specific and actionable. South African context.
Only generate notifications with clear evidence in the data. Max 5, prioritised by urgency.

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
    const result = await genai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.5, maxOutputTokens: 800 },
    });

    const text = result.text?.trim() || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Briefing generation error:', error);
    return [];
  }
}
