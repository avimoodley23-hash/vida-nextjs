'use client';

import { useState, useEffect, useCallback } from 'react';
import type { VidaData, Reminder, Habit, CalendarEvent, SpendingSummary, ChatMessage } from '@/types';

const STORE_KEY = 'vida_data';

const COLORS = ['sage', 'lavender', 'pink', 'peach', 'sky', 'mint'];

function relDate(d: number): string {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().split('T')[0];
}

function genLog(n: number): Record<string, boolean> {
  const l: Record<string, boolean> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    l[d.toISOString().split('T')[0]] = i < n && Math.random() > 0.3;
  }
  return l;
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

const defaultData = (): VidaData => ({
  messages: [],
  reminders: [
    { id: 'r1', title: 'Call Mom about weekend', date: relDate(1), time: '14:00', done: false, createdAt: new Date().toISOString() },
    { id: 'r2', title: 'Pick up dry cleaning', date: relDate(0), time: '17:00', done: false, createdAt: new Date().toISOString() },
    { id: 'r3', title: 'Submit brief to Shaune', date: relDate(2), time: '09:00', done: false, createdAt: new Date().toISOString() },
  ],
  habits: [
    { id: 'h1', name: 'Gym', icon: '💪', color: 'sage', log: genLog(7), streak: 3 },
    { id: 'h2', name: 'Read 30 mins', icon: '📖', color: 'lavender', log: genLog(4), streak: 2 },
    { id: 'h3', name: 'Vitamins', icon: '💊', color: 'pink', log: genLog(5), streak: 1 },
  ],
  events: [
    { id: 'e1', title: "Sarah's Birthday", date: relDate(4), type: 'birthday', detail: 'Turning 28' },
    { id: 'e2', title: 'Dentist', date: relDate(6), type: 'appointment', detail: '10:30 AM — Dr. Patel' },
    { id: 'e3', title: 'Games Night', date: relDate(9), type: 'event', detail: 'At yours — 7 PM' },
  ],
  spending: [
    { cat: 'Food', amount: 1200, budget: 2000 },
    { cat: 'Transport', amount: 650, budget: 1000 },
    { cat: 'Fun', amount: 600, budget: 800 },
  ],
});

export function useVidaData() {
  const [data, setData] = useState<VidaData>(defaultData());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) setData(JSON.parse(stored));
    } catch { /* use defaults */ }
    setLoaded(true);
  }, []);

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
