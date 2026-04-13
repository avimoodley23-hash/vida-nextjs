'use client';

import { useState, useEffect, useCallback } from 'react';
import type { VidaData, Reminder, Habit, CalendarEvent, SpendingSummary, ChatMessage } from '@/types';

const STORE_KEY = 'vida_data';
const USER_KEY = 'vida_user_id';

const COLORS = ['sage', 'lavender', 'pink', 'peach', 'sky', 'mint'];

function relDate(d: number): string {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().split('T')[0];
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

const emptyData = (): VidaData => ({
  messages: [],
  reminders: [],
  habits: [],
  events: [],
  spending: [],
});

export function useVidaData(userId?: string | null) {
  const [data, setData] = useState<VidaData>(emptyData());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedUserId = localStorage.getItem(USER_KEY);
      const stored = localStorage.getItem(STORE_KEY);
      // If a userId is provided and it differs from stored, clear and start fresh
      if (userId && storedUserId && storedUserId !== userId) {
        localStorage.removeItem(STORE_KEY);
        localStorage.setItem(USER_KEY, userId);
        setData(emptyData());
      } else {
        if (userId) localStorage.setItem(USER_KEY, userId);
        if (stored) setData(JSON.parse(stored));
      }
    } catch { /* use defaults */ }
    setLoaded(true);
  }, [userId]);

  const save = useCallback((newData: VidaData) => {
    setData(newData);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(newData)); } catch { /* noop */ }
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setData(prev => {
      const next = { ...prev, messages: [...prev.messages, msg] };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addReminder = useCallback((r: Omit<Reminder, 'id' | 'createdAt'>) => {
    setData(prev => {
      const reminder: Reminder = { ...r, id: 'r' + Date.now(), createdAt: new Date().toISOString() };
      const next = { ...prev, reminders: [...prev.reminders, reminder] };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toggleReminder = useCallback((id: string) => {
    setData(prev => {
      const next = {
        ...prev,
        reminders: prev.reminders.map(r => r.id === id ? { ...r, done: !r.done } : r),
      };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const logHabit = useCallback((habitName: string) => {
    const today = relDate(0);
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
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
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
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addHabit = useCallback((name: string, icon: string = '✨') => {
    setData(prev => {
      const habit: Habit = {
        id: 'h' + Date.now(),
        name,
        icon,
        color: COLORS[prev.habits.length % COLORS.length],
        log: {},
        streak: 0,
      };
      const next = { ...prev, habits: [...prev.habits, habit] };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addEvent = useCallback((e: Omit<CalendarEvent, 'id'>) => {
    setData(prev => {
      const event: CalendarEvent = { ...e, id: 'e' + Date.now() };
      const next = { ...prev, events: [...prev.events, event] };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const logSpending = useCallback((amount: number, category: string) => {
    setData(prev => {
      const existing = prev.spending.find(s => s.cat === category);
      let newSpending: SpendingSummary[];
      if (existing) {
        newSpending = prev.spending.map(s => s.cat === category ? { ...s, amount: s.amount + amount } : s);
      } else {
        newSpending = [...prev.spending, { cat: category, amount, budget: amount * 2 }];
      }
      const next = { ...prev, spending: newSpending };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setData(prev => {
      const next = { ...prev, messages: [] };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return {
    data,
    loaded,
    save,
    addMessage,
    addReminder,
    toggleReminder,
    logHabit,
    toggleHabitDay,
    addHabit,
    addEvent,
    logSpending,
    clearMessages,
  };
}
