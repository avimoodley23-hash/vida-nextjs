export interface Reminder {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  done: boolean;
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  log: Record<string, boolean>; // date -> done
  streak: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'birthday' | 'event' | 'appointment';
  detail?: string;
  googleEventId?: string; // synced from Google Calendar
}

export interface SpendingEntry {
  id: string;
  amount: number;
  category: string;
  description?: string;
  date: string;
}

export interface SpendingSummary {
  cat: string;
  amount: number;
  budget: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

export interface VidaData {
  messages: ChatMessage[];
  reminders: Reminder[];
  habits: Habit[];
  events: CalendarEvent[];
  spending: SpendingSummary[];
}

// Gemini function calling types
export interface GeminiAction {
  action: 'create_reminder' | 'complete_reminder' | 'log_habit' | 'create_habit' |
          'log_spending' | 'add_event' | 'check_schedule' | 'check_habits' |
          'check_spending' | 'greeting' | 'help' | 'suggestion' | 'general';
  params?: Record<string, string | number | boolean>;
  response: string;
}
