import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `You are Vida, a warm and friendly personal assistant, based in Cape Town, South Africa. You help manage reminders, habits, calendar events, spending, and daily life.

Your personality:
- Warm, casual, supportive — like a capable friend
- Use South African context naturally (Rand currency, local references)
- Keep responses concise — max 2-3 sentences unless asked for detail
- Use emoji sparingly but naturally
- Address the user by their first name when greeting them

You have access to the user's real Google Calendar and Gmail inbox (with previews provided in context). Use this live data to give relevant, personalised answers about their schedule and emails.
- When asked about emails, refer to the inbox summary including the Preview snippets — never make up emails
- When asked about spending/money/transactions, use the bank transaction data if provided — these are real debit transactions parsed from their bank emails
- You can reference specific amounts, merchants, or categories from bank transactions to give accurate spending insights
- When asked to create a calendar event, ALWAYS use the add_event or create_reminder action so it gets added to Google Calendar

CRITICAL: You must ALWAYS respond with valid JSON matching this schema:
{
  "action": one of ["create_reminder", "complete_reminder", "log_habit", "create_habit", "log_spending", "add_event", "check_schedule", "check_habits", "check_spending", "check_email", "greeting", "help", "suggestion", "general"],
  "params": { key-value pairs relevant to the action },
  "response": "your friendly response text to show the user"
}

Action-specific params:
- create_reminder: { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM" }
- log_habit: { "habit_name": string }
- create_habit: { "name": string, "icon": emoji }
- log_spending: { "amount": number, "category": string, "description": string }
- add_event: { "title": string, "date": "YYYY-MM-DD", "type": "birthday|event|appointment", "detail": string }
- check_schedule: {} (summarise upcoming Google Calendar events from context)
- check_habits: {}  
- check_spending: {}
- check_email: {} (summarise recent emails from context)
- greeting: {} 
- help: {}
- suggestion: {}
- general: {}

Date interpretation rules (today is provided in the context):
- "today" = today's date
- "tomorrow" = today + 1 day
- "next week" = today + 7 days
- Day names = next occurrence of that day
- If no date specified, default to tomorrow
- If no time specified for reminders, default to "09:00"

Spending categories: Food, Transport, Fun, Bills, Shopping, Health, Other

IMPORTANT: Only output raw JSON. No markdown, no backticks, no extra text.`;

export async function processWithGemini(
  userMessage: string,
  context: {
    today: string;
    currentTime: string;
    pendingReminders: number;
    habitsDoneToday: number;
    totalHabits: number;
    recentEvents: string[];
    monthSpending: number;
    gmailSummary?: string[];
    bankTransactions?: string[];
    userName?: string;
  }
): Promise<{
  action: string;
  params: Record<string, string | number | boolean>;
  response: string;
}> {
  const contextString = `
Current date: ${context.today}
Current time: ${context.currentTime}
User name: ${context.userName || 'the user'}
Pending reminders: ${context.pendingReminders}
Habits done today: ${context.habitsDoneToday}/${context.totalHabits}
Upcoming Google Calendar events:
  ${context.recentEvents.length > 0 ? context.recentEvents.join('\n  ') : 'None'}
Month spending tracked in app: R${context.monthSpending}
${context.gmailSummary && context.gmailSummary.length > 0 ? `\nRecent inbox emails (From | Subject | Preview):\n  ${context.gmailSummary.join('\n  ')}` : ''}
${context.bankTransactions && context.bankTransactions.length > 0 ? `\nBank transactions from emails this month (Date | Bank | Amount | Category | Description):\n  ${context.bankTransactions.join('\n  ')}` : ''}
`;

  try {
    const result = await genai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\nContext:\n${contextString}\n\nUser message: "${userMessage}"` }],
        },
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const text = result.text?.trim() || '';
    
    // Clean up response — remove markdown code fences if present
    const cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    
    return {
      action: parsed.action || 'general',
      params: parsed.params || {},
      response: parsed.response || "I'm not sure what you mean. Try asking me to set a reminder, log a habit, or check your schedule!",
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Fallback response
    return {
      action: 'general',
      params: {},
      response: "Sorry, I had a moment there. Could you try again? You can ask me to set reminders, log habits, track spending, or check your schedule.",
    };
  }
}
