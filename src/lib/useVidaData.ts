'use client';

import { useState, useEffect, useCallback } from 'react';
import type { VidaData, Reminder, Habit, CalendarEvent, SpendingSummary, SpendingEntry, ChatMessage, Todo, VidaNotification, Goal } from '@/types';

const STORE_KEY = 'vida_data';
const USER_KEY = 'vida_user_id';
const COLORS = ['sage', 'lavender', 'pink', 'peach', 'sky', 'mint'];

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split('T')[0];
}

function calcStreak(log: Record<string, boolean>): number {
  let s = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (log[d.toISOString().split('T')[0]]) s++;
    else if (i > 0) break;
  }
  return s;
}

function getNextRecurringDate(date: string, recurring: 'daily' | 'weekly' | 'monthly'): string {
  const d = new Date(date + 'T00:00:00');
  if (recurring === 'daily') d.setDate(d.getDate() + 1);
  else if (recurring === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

function pruneOldTodos(todos: Todo[]): Todo[] {
  const today = todayStr();
  const weekStart = getWeekStart();
  return todos.filter(t => {
    if (t.scope === 'daily') return t.forDate >= today || t.done;
    return t.forDate >= weekStart || t.done;
  });
}

function applyMonthlyReset(data: VidaData): VidaData {
  const month = currentMonth();
  if (data.lastResetMonth === month) return data;
  // New month: zero out spending summaries, trim old entries (keep last 60 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return {
    ...data,
    spending: data.spending.map(s => ({ ...s, amount: 0 })),
    spendingEntries: (data.spendingEntries || []).filter(e => e.date >= cutoffStr),
    lastResetMonth: month,
  };
}

const emptyData = (): VidaData => ({
  messages: [],
  reminders: [],
  habits: [],
  events: [],
  spending: [],
  spendingEntries: [],
  todos: [],
  notifications: [],
  goals: [],
  lastResetMonth: currentMonth(),
});

function migrateData(raw: Partial<VidaData>): VidaData {
  return {
    ...emptyData(),
    ...raw,
    spendingEntries: raw.spendingEntries || [],
    todos: raw.todos || [],
    notifications: raw.notifications || [],
    goals: raw.goals || [],
  };
}

export function useVidaData(userId?: string | null) {
  const [data, setData] = useState<VidaData>(emptyData());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedUserId = localStorage.getItem(USER_KEY);
      const stored = localStorage.getItem(STORE_KEY);
      if (userId && storedUserId !== userId) {
        localStorage.removeItem(STORE_KEY);
        localStorage.setItem(USER_KEY, userId);
        setData(emptyData());
      } else {
        if (userId) localStorage.setItem(USER_KEY, userId);
        if (stored) {
          let parsed = migrateData(JSON.parse(stored));
          parsed = applyMonthlyReset(parsed);
          parsed.todos = pruneOldTodos(parsed.todos);
          setData(parsed);
          // Persist any migrations immediately
          try { localStorage.setItem(STORE_KEY, JSON.stringify(parsed)); } catch {}
        }
      }
    } catch { /* use defaults */ }
    setLoaded(true);
  }, [userId]);

  const persist = (newData: VidaData) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(newData)); } catch {}
  };

  const save = useCallback((newData: VidaData) => {
    setData(newData);
    persist(newData);
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setData(prev => {
      const next = { ...prev, messages: [...prev.messages, msg] };
      persist(next);
      return next;
    });
  }, []);

  const addReminder = useCallback((r: Omit<Reminder, 'id' | 'createdAt'>) => {
    setData(prev => {
      const reminder: Reminder = { ...r, id: 'r' + Date.now(), createdAt: new Date().toISOString() };
      const next = { ...prev, reminders: [...prev.reminders, reminder] };
      persist(next);
      return next;
    });
  }, []);

  const toggleReminder = useCallback((id: string) => {
    setData(prev => {
      const reminder = prev.reminders.find(r => r.id === id);
      let reminders = prev.reminders.map(r => r.id === id ? { ...r, done: !r.done } : r);
      // Auto-create next occurrence for recurring reminders being completed
      if (reminder && !reminder.done && reminder.recurring) {
        const nextDate = getNextRecurringDate(reminder.date, reminder.recurring);
        // Only create if no future occurrence already exists
        const alreadyExists = prev.reminders.some(
          r => !r.done && r.title === reminder.title && r.date === nextDate
        );
        if (!alreadyExists) {
          const next: Reminder = {
            ...reminder,
            id: 'r' + (Date.now() + 1),
            date: nextDate,
            done: false,
            createdAt: new Date().toISOString(),
            recurringParentId: reminder.recurringParentId || reminder.id,
          };
          reminders = [...reminders, next];
        }
      }
      const next = { ...prev, reminders };
      persist(next);
      return next;
    });
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, reminders: prev.reminders.filter(r => r.id !== id) };
      persist(next);
      return next;
    });
  }, []);

  const logHabit = useCallback((habitName: string) => {
    const today = todayStr();
    setData(prev => {
      const next = {
        ...prev,
        habits: prev.habits.map(h => {
          if (h.name.toLowerCase() === habitName.toLowerCase()) {
            const newLog = { ...h.log, [today]: true };
            return { ...h, log: newLog, streak: calcStreak(newLog) };
          }
          return h;
        }),
      };
      persist(next);
      return next;
    });
  }, []);

  const toggleHabitDay = useCallback((habitId: string, date: string) => {
    setData(prev => {
      const next = {
        ...prev,
        habits: prev.habits.map(h => {
          if (h.id === habitId) {
            const newLog = { ...h.log, [date]: !h.log[date] };
            return { ...h, log: newLog, streak: calcStreak(newLog) };
          }
          return h;
        }),
      };
      persist(next);
      return next;
    });
  }, []);

  const addHabit = useCallback((name: string, icon: string = '✨') => {
    setData(prev => {
      const habit: Habit = {
        id: 'h' + Date.now(), name, icon,
        color: COLORS[prev.habits.length % COLORS.length],
        log: {}, streak: 0,
      };
      const next = { ...prev, habits: [...prev.habits, habit] };
      persist(next);
      return next;
    });
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, habits: prev.habits.filter(h => h.id !== id) };
      persist(next);
      return next;
    });
  }, []);

  const addEvent = useCallback((e: Omit<CalendarEvent, 'id'>) => {
    setData(prev => {
      const event: CalendarEvent = { ...e, id: 'e' + Date.now() };
      const next = { ...prev, events: [...prev.events, event] };
      persist(next);
      return next;
    });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, events: prev.events.filter(e => e.id !== id) };
      persist(next);
      return next;
    });
  }, []);

  const logSpending = useCallback((amount: number, category: string, description?: string) => {
    setData(prev => {
      const entry: SpendingEntry = {
        id: 'se' + Date.now(), amount, category,
        description, date: todayStr(),
      };
      const existing = prev.spending.find(s => s.cat === category);
      const newSpending: SpendingSummary[] = existing
        ? prev.spending.map(s => s.cat === category ? { ...s, amount: s.amount + amount } : s)
        : [...prev.spending, { cat: category, amount, budget: 0 }];
      const next = { ...prev, spending: newSpending, spendingEntries: [...(prev.spendingEntries || []), entry] };
      persist(next);
      return next;
    });
  }, []);

  const setBudget = useCallback((category: string, budget: number) => {
    setData(prev => {
      const newSpending = prev.spending.map(s => s.cat === category ? { ...s, budget } : s);
      const next = { ...prev, spending: newSpending };
      persist(next);
      return next;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setData(prev => {
      const next = { ...prev, messages: [] };
      persist(next);
      return next;
    });
  }, []);

  // ── Todos ──

  const addTodo = useCallback((title: string, scope: 'daily' | 'weekly') => {
    setData(prev => {
      const todo: Todo = {
        id: 't' + Date.now(), title, scope, done: false,
        createdAt: new Date().toISOString(),
        forDate: scope === 'daily' ? todayStr() : getWeekStart(),
      };
      const next = { ...prev, todos: [...prev.todos, todo] };
      persist(next);
      return next;
    });
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setData(prev => {
      const next = {
        ...prev,
        todos: prev.todos.map(t =>
          t.id === id ? { ...t, done: !t.done, doneDate: !t.done ? todayStr() : undefined } : t
        ),
      };
      persist(next);
      return next;
    });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, todos: prev.todos.filter(t => t.id !== id) };
      persist(next);
      return next;
    });
  }, []);

  // ── Notifications ──

  const setNotifications = useCallback((notifications: VidaNotification[]) => {
    setData(prev => {
      const next = { ...prev, notifications };
      persist(next);
      return next;
    });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n) };
      persist(next);
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setData(prev => {
      const next = { ...prev, notifications: prev.notifications.map(n => ({ ...n, read: true })) };
      persist(next);
      return next;
    });
  }, []);

  // ── Goals ──

  const addGoal = useCallback((g: Omit<Goal, 'id' | 'createdAt'>) => {
    setData(prev => {
      const goal: Goal = { ...g, id: 'g' + Date.now(), createdAt: new Date().toISOString() };
      const next = { ...prev, goals: [...prev.goals, goal] };
      persist(next);
      return next;
    });
  }, []);

  const updateGoalProgress = useCallback((id: string, progress: number) => {
    setData(prev => {
      const next = { ...prev, goals: prev.goals.map(g => g.id === id ? { ...g, progress } : g) };
      persist(next);
      return next;
    });
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, goals: prev.goals.filter(g => g.id !== id) };
      persist(next);
      return next;
    });
  }, []);

  const setLastWeeklyReview = useCallback((date: string) => {
    setData(prev => {
      const next = { ...prev, lastWeeklyReview: date };
      persist(next);
      return next;
    });
  }, []);

  return {
    data, loaded, save,
    addMessage, addReminder, toggleReminder, deleteReminder,
    logHabit, toggleHabitDay, addHabit, deleteHabit,
    addEvent, deleteEvent, logSpending, setBudget, clearMessages,
    addTodo, toggleTodo, deleteTodo,
    setNotifications, markNotificationRead, markAllNotificationsRead,
    addGoal, updateGoalProgress, deleteGoal, setLastWeeklyReview,
  };
}
