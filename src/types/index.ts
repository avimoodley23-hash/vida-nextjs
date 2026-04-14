export interface Reminder {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  done: boolean;
  createdAt: string;
  recurring?: 'daily' | 'weekly' | 'monthly';
  recurringParentId?: string;
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
  time?: string; // HH:MM
  type: 'birthday' | 'event' | 'appointment';
  detail?: string;
  googleEventId?: string;
}

export interface SpendingEntry {
  id: string;
  amount: number;
  category: string;
  description?: string;
  date: string; // YYYY-MM-DD
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
  draftEmail?: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
    inReplyTo?: string;
  };
  calendarEvent?: {
    title: string;
    date: string;
    time?: string;
    type: 'birthday' | 'event' | 'appointment';
    detail?: string;
  };
}

export interface Todo {
  id: string;
  title: string;
  scope: 'daily' | 'weekly';
  done: boolean;
  doneDate?: string;
  createdAt: string;
  forDate: string;
}

export interface VidaNotification {
  id: string;
  type: 'calendar_prep' | 'spending' | 'habit' | 'email' | 'general';
  title: string;
  body: string;
  urgency: 'high' | 'medium' | 'low';
  createdAt: string;
  read: boolean;
}

export interface VidaData {
  messages: ChatMessage[];
  reminders: Reminder[];
  habits: Habit[];
  events: CalendarEvent[];
  spending: SpendingSummary[];
  spendingEntries: SpendingEntry[];
  todos: Todo[];
  notifications: VidaNotification[];
  lastResetMonth?: string; // YYYY-MM — for monthly spending reset
}

export interface GeminiAction {
  action:
    | 'create_reminder' | 'complete_reminder'
    | 'log_habit' | 'create_habit'
    | 'log_spending' | 'add_event' | 'check_schedule'
    | 'check_habits' | 'check_spending' | 'check_email'
    | 'set_budget' | 'delete_reminder' | 'delete_habit' | 'delete_event'
    | 'create_todo' | 'complete_todo' | 'delete_todo' | 'list_todos'
    | 'read_email' | 'draft_email'
    | 'greeting' | 'help' | 'suggestion' | 'general';
  params?: Record<string, string | number | boolean>;
  response: string;
}
