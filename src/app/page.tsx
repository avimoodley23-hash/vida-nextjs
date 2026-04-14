'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useVidaData } from '@/lib/useVidaData';
import {
  Send, Mic, Bell, Check, Activity, Calendar, CreditCard, Sun,
  Dumbbell, BookOpen, Pill, Sparkles, ArrowRight, Plus, X, LogOut,
  Trash2, Home, MessageCircle, ListTodo, ChevronRight, RefreshCw,
  Mail, AlertCircle, TrendingUp, Flame, Volume2, VolumeX, Repeat,
  ChevronDown, ChevronUp, Pencil,
} from 'lucide-react';
import type { CalendarEvent, VidaNotification } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function HabitIcon({ name, icon, size = 16 }: { name: string; icon?: string; size?: number }) {
  // Use stored emoji if it looks like an emoji (not the default '✦')
  if (icon && icon !== '✦' && icon !== '✨' && /\p{Emoji}/u.test(icon)) {
    return <span style={{ fontSize: size }}>{icon}</span>;
  }
  const n = name.toLowerCase();
  if (n.includes('gym') || n.includes('workout') || n.includes('exercise')) return <Dumbbell size={size} />;
  if (n.includes('read')) return <BookOpen size={size} />;
  if (n.includes('vitamin') || n.includes('pill') || n.includes('supplement')) return <Pill size={size} />;
  return <Sparkles size={size} />;
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/[#_`]/g, '').slice(0, 500);
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'en-ZA';
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

function renderMarkdown(text: string) {
  return text.split('\n').flatMap((line, li) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const nodes: React.ReactNode[] = parts.map((p, j) =>
      j % 2 === 1 ? <strong key={j}>{p}</strong> : <span key={j}>{p}</span>
    );
    return li === 0 ? nodes : [<br key={`br-${li}`} />, ...nodes];
  });
}

const HABIT_ICONS = ['🏋️','📚','🧘','💧','🛌','🏃','🍎','✍️','🎯','💊','🎵','🚴','🍵','🌱','💻','🎨','🙏','⭐','🎮','✦'];

const CM: Record<string, { light: string; dark: string; df: string; de: string }> = {
  sage:     { light: 'bg-sage-light',     dark: 'text-sage-dark',     df: 'bg-sage text-sage-dark',         de: 'bg-sage-dark/10 text-sage-dark/40' },
  lavender: { light: 'bg-lavender-light', dark: 'text-lavender-dark', df: 'bg-lavender text-lavender-dark', de: 'bg-lavender-dark/10 text-lavender-dark/40' },
  pink:     { light: 'bg-pink-light',     dark: 'text-pink-dark',     df: 'bg-pink text-pink-dark',         de: 'bg-pink-dark/10 text-pink-dark/40' },
  peach:    { light: 'bg-peach-light',    dark: 'text-peach-dark',    df: 'bg-peach text-peach-dark',       de: 'bg-peach-dark/10 text-peach-dark/40' },
  sky:      { light: 'bg-sky-light',      dark: 'text-sky-dark',      df: 'bg-sky text-sky-dark',           de: 'bg-sky-dark/10 text-sky-dark/40' },
  mint:     { light: 'bg-mint-light',     dark: 'text-mint-dark',     df: 'bg-mint text-mint-dark',         de: 'bg-mint-dark/10 text-mint-dark/40' },
};

function rd(d: number) { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().split('T')[0]; }
function fd(d: string) {
  const t = new Date(); t.setHours(0,0,0,0);
  const dt = new Date(d + 'T00:00:00');
  const diff = Math.round((dt.getTime() - t.getTime()) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 0 && diff < 7) return dt.toLocaleDateString('en-ZA', { weekday: 'long' });
  return dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
function ft(t: string) { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }
function dt(d: string) { const a = new Date(); a.setHours(0,0,0,0); return Math.round((new Date(d + 'T00:00:00').getTime() - a.getTime()) / 864e5); }

function getWeekStart() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split('T')[0];
}

const QUICK_REPLIES = [
  "What do I have today?",
  "Any emails?",
  "How are my habits this week?",
  "What's on my todo list?",
  "Remind me to...",
  "Check my spending",
];

function NotifIcon({ type }: { type: VidaNotification['type'] }) {
  if (type === 'calendar_prep') return <Calendar size={16} />;
  if (type === 'spending') return <CreditCard size={16} />;
  if (type === 'habit') return <Flame size={16} />;
  if (type === 'email') return <Mail size={16} />;
  return <Sparkles size={16} />;
}

type Panel = 'home' | 'chat' | 'tasks' | 'schedule' | 'notifications';
type TaskTab = 'todos' | 'reminders' | 'habits';

// ── Main Component ─────────────────────────────────────────────────────────

export default function VidaApp() {
  const { data: session, status } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessToken = (session as any)?.accessToken as string | undefined;
  const userName = session?.user?.name?.split(' ')[0] || 'there';
  const userEmail = session?.user?.email || '';

  const [panel, setPanel] = useState<Panel>('home');
  const [taskTab, setTaskTab] = useState<TaskTab>('todos');
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [budgetModal, setBudgetModal] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [scheduleTab, setScheduleTab] = useState<'calendar' | 'spending'>('calendar');
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [addForm, setAddForm] = useState<'reminder' | 'habit' | 'event' | 'todo' | null>(null);
  const [rf, setRf] = useState({ title: '', date: '', time: '09:00' });
  const [hf, setHf] = useState({ name: '', icon: '✦' });
  const [ef, setEf] = useState({ title: '', date: '', type: 'event' as 'birthday' | 'event' | 'appointment', detail: '' });
  const [tf, setTf] = useState({ title: '', scope: 'daily' as 'daily' | 'weekly' });
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(true);
  const [briefingDone, setBriefingDone] = useState(false);
  const [bankToast, setBankToast] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const {
    data, loaded,
    addMessage, addReminder, toggleReminder, deleteReminder,
    logHabit, toggleHabitDay, addHabit, deleteHabit,
    addEvent, deleteEvent, logSpending, setBudget, clearMessages,
    addTodo, toggleTodo, deleteTodo,
    setNotifications, markNotificationRead, markAllNotificationsRead,
  } = useVidaData(userEmail || undefined);

  const unreadCount = data.notifications.filter(n => !n.read).length;
  const overBudget = data.spending.filter(s => s.budget > 0 && s.amount > s.budget);

  // Fetch Google Calendar events
  useEffect(() => {
    if (!accessToken) { setGcalLoading(false); return; }
    setGcalLoading(true);
    fetch('/api/calendar?days=30', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => { if (d.events) setGcalEvents(d.events); })
      .catch(() => {})
      .finally(() => setGcalLoading(false));
  }, [accessToken]);

  // Auto-detect bank transactions from email
  useEffect(() => {
    if (!accessToken) return;
    const processedKey = `vida_bank_processed_${userEmail}`;
    const processed: string[] = (() => { try { return JSON.parse(localStorage.getItem(processedKey) || '[]'); } catch { return []; } })();
    fetch('/api/emails', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.transactions?.length) return;
        const newTxns = d.transactions.filter((t: { emailId: string }) => !processed.includes(t.emailId));
        if (!newTxns.length) return;
        newTxns.forEach((t: { amount: number; category: string }) => logSpending(t.amount, t.category));
        const ids = [...processed, ...newTxns.map((t: { emailId: string }) => t.emailId)];
        try { localStorage.setItem(processedKey, JSON.stringify(ids.slice(-100))); } catch {}
        setBankToast(`💳 Detected ${newTxns.length} bank transaction${newTxns.length > 1 ? 's' : ''} from your emails`);
        setTimeout(() => setBankToast(null), 5000);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Fetch AI briefing notifications once per day
  const fetchBriefing = useCallback(async (force = false) => {
    if (!accessToken) return;
    const briefingKey = `vida_briefing_notifs_${userEmail}`;
    const today = rd(0);
    let stored: { date: string; notifications: VidaNotification[] } | null = null;
    try { stored = JSON.parse(localStorage.getItem(briefingKey) || 'null'); } catch {}
    if (!force && stored?.date === today) {
      setNotifications(stored.notifications);
      return;
    }
    setBriefingLoading(true);
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          spending: data.spending,
          habits: data.habits,
          today,
          currentTime: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
          userName,
        }),
      });
      const json = await res.json();
      if (json.notifications?.length) {
        const notifications: VidaNotification[] = json.notifications.map(
          (n: Omit<VidaNotification, 'id' | 'createdAt' | 'read'>, i: number) => ({
            ...n, id: `notif_${Date.now()}_${i}`, createdAt: new Date().toISOString(), read: false,
          })
        );
        setNotifications(notifications);
        try { localStorage.setItem(briefingKey, JSON.stringify({ date: today, notifications })); } catch {}
        // Push urgent notifications via browser Notification API
        if ('Notification' in window && Notification.permission === 'granted') {
          notifications.filter(n => n.urgency === 'high').forEach(n => {
            new Notification(`Vida: ${n.title}`, { body: n.body, icon: '/icon-192.png', tag: n.id });
          });
        }
      }
    } catch { /* non-fatal */ }
    setBriefingLoading(false);
  }, [accessToken, data.spending, data.habits, userName, setNotifications]);

  useEffect(() => {
    if (loaded && accessToken) {
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      fetchBriefing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, accessToken]);

  // Reminder check via service worker
  useEffect(() => {
    if (status !== 'authenticated') return;
    const check = () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'REMINDER_CHECK', reminders: data.reminders });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        const now = new Date();
        const nowDate = now.toISOString().split('T')[0];
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        data.reminders
          .filter(r => !r.done && r.date === nowDate && r.time === nowTime)
          .forEach(r => new Notification(`⏰ ${r.title}`, { body: 'Tap to open Vida', icon: '/icon-192.png' }));
      }
    };
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [status, data.reminders]);

  const scroll = useCallback(() => { setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100); }, []);

  // Morning briefing message in chat
  useEffect(() => {
    if (!loaded || briefingDone) return;
    if (panel !== 'chat') return;
    if (data.messages.length > 0) { setBriefingDone(true); return; }
    setBriefingDone(true);
    const today = rd(0);
    const lastKey = `vida_briefing_${userEmail}`;
    let lastDate = '';
    try { lastDate = localStorage.getItem(lastKey) || ''; } catch {}
    if (lastDate !== today && accessToken) {
      try { localStorage.setItem(lastKey, today); } catch {}
      setTyping(true); scroll();
      fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Give me a friendly morning briefing — what have I got on today and this week, any important emails, and how are my habits going?',
          accessToken,
          context: buildContext(),
        }),
      })
        .then(r => r.json())
        .then(r => { addMessage({ role: 'assistant', text: r.response, time: new Date().toISOString() }); })
        .catch(() => { addMessage({ role: 'assistant', text: `Hey ${userName}! ☀️\n\nI'm **Vida** — your AI assistant. What can I help you with?\n\n• "What's on today?"\n• "Any emails?"\n• "Remind me to..."`, time: new Date().toISOString() }); })
        .finally(() => { setTyping(false); scroll(); });
    } else {
      addMessage({ role: 'assistant', text: `Hey ${userName}! What can I help with today?`, time: new Date().toISOString() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, loaded, accessToken]);

  const today = rd(0);
  const weekStart = getWeekStart();
  const activeTodosToday = data.todos.filter(t => t.scope === 'daily' && t.forDate === today);
  const activeTodosWeekly = data.todos.filter(t => t.scope === 'weekly' && t.forDate === weekStart);

  function buildContext() {
    return {
      today,
      currentTime: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      userName,
      pendingReminders: data.reminders.filter(r => !r.done).length,
      habitsDoneToday: data.habits.filter(h => h.log[today]).length,
      totalHabits: data.habits.length,
      recentEvents: data.events.slice(0, 3).map(e => `${e.title} (${fd(e.date)})`),
      monthSpending: data.spending.reduce((a, s) => a + s.amount, 0),
      spending: data.spending,
      todosToday: activeTodosToday.map(t => `${t.done ? '✓' : '○'} ${t.title}`),
      todosWeekly: activeTodosWeekly.map(t => `${t.done ? '✓' : '○'} ${t.title}`),
    };
  }

  async function typeOut(text: string, draftEmail?: import('@/types').ChatMessage['draftEmail'], calendarEvent?: import('@/types').ChatMessage['calendarEvent']) {
    const chunkSize = text.length > 300 ? 15 : 1;
    const delay = text.length > 300 ? 25 : 14;
    let current = '';
    for (let i = 0; i < text.length; i += chunkSize) {
      current = text.slice(0, i + chunkSize);
      setStreamingText(current);
      if (i % 60 === 0) scroll();
      await new Promise(r => setTimeout(r, delay));
    }
    setStreamingText('');
    addMessage({ role: 'assistant', text, time: new Date().toISOString(), draftEmail, calendarEvent });
    if (ttsEnabled) speak(text);
    scroll();
  }

  async function send(messageOverride?: string) {
    const text = (messageOverride || input).trim();
    if (!text) return;
    const historySnapshot = data.messages.slice(-10);
    addMessage({ role: 'user', text, time: new Date().toISOString() });
    setInput(''); setTyping(true); scroll();
    if (panel !== 'chat') setPanel('chat');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text, accessToken,
          history: historySnapshot.map(m => ({ role: m.role, text: m.text })),
          context: buildContext(),
        }),
      });
      const r = await res.json();
      handleAction(r);
      setTyping(false);
      await typeOut(r.response, r.draftEmail, r.calendarEvent);
    } catch {
      setTyping(false);
      await typeOut("Couldn't reach the AI. Check your GEMINI_API_KEY!");
    }
  }

  function handleAction(r: { action: string; params?: Record<string, string | number | boolean> }) {
    const p = r.params || {};
    switch (r.action) {
      case 'create_reminder':
        if (p.title) addReminder({
          title: String(p.title),
          date: String(p.date || rd(1)),
          time: p.time ? String(p.time) : '09:00',
          done: false,
          recurring: p.recurring as 'daily' | 'weekly' | 'monthly' | undefined,
        });
        break;
      case 'complete_reminder': {
        const match = data.reminders.find(rem => rem.title.toLowerCase().includes(String(p.title || '').toLowerCase()) && !rem.done);
        if (match) toggleReminder(match.id);
        break;
      }
      case 'delete_reminder': {
        const match = data.reminders.find(rem => rem.title.toLowerCase().includes(String(p.title || '').toLowerCase()));
        if (match) deleteReminder(match.id);
        break;
      }
      case 'log_habit':
        if (p.habit_name) logHabit(String(p.habit_name));
        break;
      case 'create_habit':
        if (p.name) addHabit(String(p.name), String(p.icon || '✨'));
        break;
      case 'delete_habit': {
        const match = data.habits.find(h => h.name.toLowerCase().includes(String(p.name || '').toLowerCase()));
        if (match) deleteHabit(match.id);
        break;
      }
      case 'log_spending':
        if (p.amount) logSpending(Number(p.amount), String(p.category || 'Other'), p.description ? String(p.description) : undefined);
        break;
      case 'set_budget':
        if (p.category && p.amount) setBudget(String(p.category), Number(p.amount));
        break;
      case 'add_event':
        if (p.title) {
          addEvent({ title: String(p.title), date: String(p.date || rd(7)), type: (p.type as 'birthday' | 'event' | 'appointment') || 'event', detail: p.detail ? String(p.detail) : undefined, googleEventId: p.googleEventId ? String(p.googleEventId) : undefined });
          if (accessToken && p.googleEventId) {
            fetch('/api/calendar?days=30', { headers: { Authorization: `Bearer ${accessToken}` } })
              .then(res => res.json()).then(d => { if (d.events) setGcalEvents(d.events); }).catch(() => {});
          }
          // Smart post-event prep suggestion
          const title = String(p.title).toLowerCase();
          let prepMsg = '';
          if (/braai|barbecue|party|gathering/.test(title)) {
            prepMsg = `Nice one! Want me to add a shopping reminder the day before for the ${String(p.title)}?`;
          } else if (p.type === 'birthday' || /birthday|bday/.test(title)) {
            prepMsg = `I'll keep that in mind! Want a reminder a few days before to sort a gift?`;
          } else if (/appointment|doctor|dentist|meeting/.test(title)) {
            prepMsg = `Got it. Want a reminder to leave on time for your ${String(p.title)}?`;
          }
          if (prepMsg) {
            setTimeout(() => {
              addMessage({ role: 'assistant', text: prepMsg, time: new Date().toISOString() });
              scroll();
            }, 800);
          }
        }
        break;
      case 'delete_event': {
        const match = data.events.find(e => e.title.toLowerCase().includes(String(p.title || '').toLowerCase()));
        if (match) deleteEvent(match.id);
        break;
      }
      case 'create_todo':
        if (p.title) addTodo(String(p.title), (p.scope as 'daily' | 'weekly') || 'daily');
        break;
      case 'complete_todo': {
        const match = data.todos.find(t => t.title.toLowerCase().includes(String(p.title || '').toLowerCase()) && !t.done);
        if (match) toggleTodo(match.id);
        break;
      }
      case 'delete_todo': {
        const match = data.todos.find(t => t.title.toLowerCase().includes(String(p.title || '').toLowerCase()));
        if (match) deleteTodo(match.id);
        break;
      }
    }
  }

  async function sendDraftEmail(draftEmail: NonNullable<import('@/types').ChatMessage['draftEmail']>) {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/chat', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, to: draftEmail.to, subject: draftEmail.subject, emailBody: draftEmail.body, threadId: draftEmail.threadId, inReplyTo: draftEmail.inReplyTo }),
      });
      const r = await res.json();
      addMessage({ role: 'assistant', text: r.success ? `Sent! ✓` : "Couldn't send — check your connection.", time: new Date().toISOString() });
    } catch {
      addMessage({ role: 'assistant', text: "Failed to send. Try again?", time: new Date().toISOString() });
    }
    scroll();
  }

  const [gcalAdding, setGcalAdding] = useState<string | null>(null);

  async function addToGoogleCal(evt: NonNullable<import('@/types').ChatMessage['calendarEvent']>, msgIdx: number) {
    if (!accessToken) { addMessage({ role: 'assistant', text: "Sign in with Google to add to Google Calendar.", time: new Date().toISOString() }); return; }
    setGcalAdding(String(msgIdx));
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, title: evt.title, date: evt.date, time: evt.time, description: evt.detail || 'Created by Vida' }),
      });
      const r = await res.json();
      if (r.success) {
        addMessage({ role: 'assistant', text: `Added "${evt.title}" to your Google Calendar!`, time: new Date().toISOString() });
        // Refresh gcal events
        fetch('/api/calendar?days=30', { headers: { Authorization: `Bearer ${accessToken}` } })
          .then(res => res.json()).then(d => { if (d.events) setGcalEvents(d.events); }).catch(() => {});
      } else {
        addMessage({ role: 'assistant', text: "Couldn't add to Google Calendar. You may need to sign out and back in to grant calendar access.", time: new Date().toISOString() });
      }
    } catch {
      addMessage({ role: 'assistant', text: "Failed to add to Google Calendar. Try again?", time: new Date().toISOString() });
    }
    setGcalAdding(null);
    scroll();
  }

  function saveToIphoneCal(evt: NonNullable<import('@/types').ChatMessage['calendarEvent']>) {
    const params = new URLSearchParams({ title: evt.title, date: evt.date });
    if (evt.time) params.set('time', evt.time);
    if (evt.detail) params.set('detail', evt.detail);
    window.open(`/api/ical?${params.toString()}`, '_blank');
  }

  function voice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.webkitSpeechRecognition && !w.SpeechRecognition) return;
    if (recording) return;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-ZA';
    rec.onstart = () => setRecording(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setRecording(false); };
    rec.onerror = rec.onend = () => setRecording(false);
    rec.start();
  }

  function newChat() {
    clearMessages(); setBriefingDone(false);
    try { localStorage.removeItem(`vida_briefing_${userEmail}`); } catch {}
  }

  function openAddForm(type: 'reminder' | 'habit' | 'event' | 'todo') {
    if (type === 'reminder') setRf({ title: '', date: rd(0), time: '09:00' });
    if (type === 'event') setEf({ title: '', date: rd(1), type: 'event', detail: '' });
    if (type === 'habit') setHf({ name: '', icon: '✦' });
    if (type === 'todo') setTf({ title: '', scope: 'daily' });
    setAddForm(type);
  }

  // ── Auth states ──────────────────────────────────────────────────────────

  if (status === 'loading' || !loaded) return (
    <div className="h-dvh flex items-center justify-center bg-vida-bg">
      <span className="text-3xl animate-pulse">✦</span>
    </div>
  );

  if (status === 'unauthenticated') return (
    <div className="h-dvh flex flex-col items-center justify-center bg-vida-bg px-8 max-w-[480px] mx-auto">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sage to-lavender flex items-center justify-center text-4xl mb-6 shadow-lg">✦</div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Vida</h1>
      <p className="text-vida-secondary text-center text-[15px] mb-10 leading-relaxed">
        Your AI personal assistant — connected to your Google Calendar and Gmail.
      </p>
      <button onClick={() => signIn('google')} className="w-full flex items-center justify-center gap-3 bg-vida-text text-vida-bg rounded-2xl py-4 text-[16px] font-bold transition hover:opacity-90 active:scale-95 shadow-md">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
      <p className="text-xs text-vida-muted text-center mt-6 leading-relaxed">
        Vida connects to your Google Calendar and Gmail. Your data is never stored on our servers.
      </p>
    </div>
  );

  // ── Merged events ─────────────────────────────────────────────────────────

  const gcalIds = new Set(gcalEvents.map(e => e.googleEventId).filter(Boolean));
  const localOnly = data.events.filter(e => !e.googleEventId || !gcalIds.has(e.googleEventId));
  const allEvents = [...gcalEvents, ...localOnly].sort((a, b) => a.date.localeCompare(b.date));
  const bday = allEvents.find(e => e.type === 'birthday' && dt(e.date) >= 1 && dt(e.date) <= 5);
  const hDone = data.habits.filter(h => h.log[today]).length;
  const pend = data.reminders.filter(r => !r.done);
  const hr = new Date().getHours();
  const todoPendingCount = activeTodosToday.filter(t => !t.done).length + activeTodosWeekly.filter(t => !t.done).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-dvh max-w-[480px] mx-auto bg-vida-bg relative">
      {/* Toast */}
      {bankToast && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-mint-dark text-white rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg flex items-center justify-between gap-2 msg-pop">
          <span>{bankToast}</span>
          <button onClick={() => setBankToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* HEADER */}
      <header className="flex items-center justify-between px-5 pt-safe pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sage to-lavender flex items-center justify-center font-bold text-vida-bg text-sm">
              {userName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-[17px] font-bold tracking-tight leading-tight">
              {hr < 12 ? 'Morning' : hr < 17 ? 'Afternoon' : 'Evening'}, {userName}
            </h1>
            <p className="text-[11px] text-vida-secondary">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
        <button onClick={() => signOut()} title="Sign out" className="w-8 h-8 rounded-2xl bg-vida-warm shadow-sm flex items-center justify-center text-vida-muted">
          <LogOut size={15} />
        </button>
      </header>

      {/* PANEL CONTENT */}
      <main className="flex-1 overflow-hidden relative">

        {/* HOME */}
        {panel === 'home' && (
          <div className="h-full overflow-y-auto hide-scrollbar px-4 pb-4 pt-1">
            {/* Over-budget alert */}
            {overBudget.length > 0 && (
              <button onClick={() => setPanel('schedule')} className="w-full flex items-center gap-3 bg-red-50 text-red-700 rounded-2xl p-3.5 mb-3 text-left border border-red-100">
                <AlertCircle size={18} className="shrink-0" />
                <span className="text-[13px] font-semibold flex-1">Over budget in {overBudget.map(s => s.cat).join(', ')}</span>
                <ChevronRight size={14} className="opacity-50 shrink-0" />
              </button>
            )}
            {/* Top AI notification */}
            {data.notifications.filter(n => !n.read && n.urgency === 'high').slice(0, 1).map(n => (
              <button key={n.id} onClick={() => { markNotificationRead(n.id); setPanel('notifications'); }} className="w-full flex items-center gap-3 bg-vida-text text-vida-bg rounded-2xl p-4 mb-3 text-left">
                <Sparkles size={18} className="shrink-0 opacity-75" />
                <div className="flex-1 min-w-0"><div className="text-[13px] font-bold truncate">{n.title}</div><div className="text-[11px] opacity-70 truncate">{n.body}</div></div>
                <ChevronRight size={14} className="opacity-50 shrink-0" />
              </button>
            ))}
            {bday && !data.notifications.some(n => n.urgency === 'high' && !n.read) && (
              <button onClick={() => setPanel('chat')} className="w-full flex items-center gap-3 bg-vida-text text-vida-bg rounded-2xl p-4 mb-3 text-left">
                <Sparkles size={18} className="shrink-0 opacity-75" />
                <span className="flex-1 text-[13.5px] font-medium">{bday.title} is in {dt(bday.date)} days — grab a gift?</span>
                <ArrowRight size={14} className="opacity-50 shrink-0" />
              </button>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Habits */}
              <button onClick={() => { setPanel('tasks'); setTaskTab('habits'); }} className="bento-card bg-sage-light text-sage-dark rounded-2xl p-4 text-left relative min-h-[120px] flex flex-col">
                <Activity size={24} className="mb-2 opacity-85" />
                <span className="absolute top-3.5 right-3.5 bg-white/50 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[11px] font-semibold">{hDone}/{data.habits.length}</span>
                <span className="font-bold text-[15px]">Habits</span>
                <span className="text-xs opacity-70">Today</span>
                <div className="flex gap-1 mt-2">{data.habits.slice(0, 5).map(h => (
                  <div key={h.id} className={`w-6 h-6 rounded-lg flex items-center justify-center ${h.log[today] ? (CM[h.color]?.df || '') : (CM[h.color]?.de || '')}`}>
                    {h.log[today] ? <Check size={10} strokeWidth={3} /> : <HabitIcon name={h.name} icon={h.icon} size={10} />}
                  </div>
                ))}</div>
              </button>
              {/* Reminders */}
              <button onClick={() => { setPanel('tasks'); setTaskTab('reminders'); }} className="bento-card bg-peach-light text-peach-dark rounded-2xl p-4 text-left min-h-[120px] flex flex-col">
                <Bell size={24} className="mb-2 opacity-85" />
                <span className="font-bold text-[15px]">Reminders</span>
                <span className="text-xs opacity-70">{pend.length} pending</span>
                <div className="flex flex-col gap-1 mt-2">{pend.slice(0, 2).map(r => <div key={r.id} className="flex items-center gap-1.5 text-xs font-medium"><div className="w-1.5 h-1.5 rounded-full bg-peach-dark shrink-0" /><span className="truncate">{r.title}</span></div>)}</div>
              </button>
              {/* Talk to Vida */}
              <button onClick={() => setPanel('chat')} className="bento-card col-span-2 bg-vida-cream text-vida-text rounded-2xl p-4 flex items-center gap-3 min-h-[68px]">
                <MessageCircle size={28} className="shrink-0 opacity-50" />
                <div className="text-left"><div className="font-bold text-[17px]">Talk to Vida</div><div className="text-xs text-vida-secondary">Plan your day, check emails, anything</div></div>
                <ArrowRight size={18} className="ml-auto opacity-30 shrink-0" />
              </button>
              {/* Todos */}
              <button onClick={() => { setPanel('tasks'); setTaskTab('todos'); }} className="bento-card bg-lavender-light text-lavender-dark rounded-2xl p-4 text-left min-h-[110px] flex flex-col">
                <ListTodo size={24} className="mb-2 opacity-85" />
                <span className="font-bold text-[15px]">Todos</span>
                <span className="text-xs opacity-70">{todoPendingCount} left today</span>
                <div className="flex flex-col gap-1 mt-1.5">
                  {activeTodosToday.slice(0, 2).map(t => <div key={t.id} className={`text-[11px] truncate ${t.done ? 'line-through opacity-40' : ''}`}>{t.title}</div>)}
                </div>
              </button>
              {/* Spending */}
              <button onClick={() => setPanel('schedule')} className="bento-card bg-mint-light text-mint-dark rounded-2xl p-4 text-left min-h-[110px] flex flex-col">
                <CreditCard size={24} className="mb-2 opacity-85" />
                <span className="font-bold text-[15px]">Spending</span>
                <span className="text-xs opacity-70">This month</span>
                <div className="flex flex-col gap-1.5 mt-2">
                  {data.spending.slice(0, 2).map(s => (
                    <div key={s.cat} className="flex items-center gap-1.5 text-[11px] font-medium">
                      <span className="min-w-[40px]">{s.cat}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/50 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${s.amount > s.budget ? 'bg-red-400' : 'bg-mint-dark'}`} style={{ width: `${Math.min(Math.round(s.amount / Math.max(s.budget, 1) * 100), 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </button>
              {/* Next event */}
              {(() => {
                const eventsToday = allEvents.filter(e => dt(e.date) === 0);
                const eventsThisWeek = allEvents.filter(e => { const d = dt(e.date); return d >= 0 && d <= 6; });
                const nextEvent = allEvents.find(e => dt(e.date) >= 0);
                return (
                  <button onClick={() => setPanel('schedule')} className="bento-card col-span-2 bg-sky-light text-sky-dark rounded-2xl p-4 flex items-center gap-3 min-h-[64px]">
                    <Sun size={26} className="shrink-0 opacity-75" />
                    <div className="text-left">
                      {eventsToday.length > 0
                        ? <><div className="font-bold text-[15px]">{eventsToday.length === 1 ? eventsToday[0].title : `${eventsToday.length} things today`}</div><div className="text-xs opacity-70">Today · tap to see all</div></>
                        : eventsThisWeek.length > 0
                        ? <><div className="font-bold text-[15px]">{eventsThisWeek.length} event{eventsThisWeek.length > 1 ? 's' : ''} this week</div><div className="text-xs opacity-70">Next: {nextEvent?.title}</div></>
                        : <><div className="font-bold text-[15px]">Week looks free!</div><div className="text-xs opacity-70">Maybe plan something nice?</div></>
                      }
                    </div>
                    <ArrowRight size={16} className="ml-auto opacity-30 shrink-0" />
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* CHAT */}
        {panel === 'chat' && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 mb-1 shrink-0">
              <div className="flex items-center gap-1.5 text-[11px] text-sage-dark font-semibold bg-sage-light px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-sage-dark animate-pulse" />
                Vida AI · Gemini
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setTtsEnabled(e => !e); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }}
                  title={ttsEnabled ? 'Mute Vida' : 'Unmute Vida'}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${ttsEnabled ? 'bg-sage-light text-sage-dark' : 'text-vida-muted hover:bg-vida-cream'}`}
                >
                  {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
                {data.messages.length > 0 && (
                  <button onClick={newChat} className="flex items-center gap-1 text-[11px] font-semibold text-vida-muted px-2.5 py-1 rounded-full hover:bg-vida-cream transition">
                    <Plus size={12} />New
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-2 flex flex-col gap-2.5">
              {data.messages.map((m, i) => (
                <div key={i} className={`msg-pop max-w-[84%] ${m.role === 'user' ? 'self-end' : 'self-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-vida-text text-vida-bg rounded-br-md' : 'bg-vida-warm text-vida-text rounded-bl-md shadow-sm'}`}>
                    {renderMarkdown(m.text)}
                  </div>
                  {/* Email draft confirmation */}
                  {m.draftEmail && (
                    <div className="mt-2 bg-sky-light text-sky-dark rounded-2xl p-3.5 text-sm">
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1.5">Draft Email</div>
                      <div className="text-xs mb-1"><span className="font-semibold">To:</span> {m.draftEmail.to}</div>
                      <div className="text-xs mb-2"><span className="font-semibold">Subject:</span> {m.draftEmail.subject}</div>
                      <div className="text-xs opacity-80 mb-3 line-clamp-3">{m.draftEmail.body}</div>
                      <button onClick={() => sendDraftEmail(m.draftEmail!)} className="w-full bg-sky-dark text-white rounded-xl py-2 text-[13px] font-bold">
                        Send →
                      </button>
                    </div>
                  )}
                  {/* Calendar event add buttons */}
                  {m.calendarEvent && (
                    <div className="mt-2 bg-sage/20 text-vida-text rounded-2xl p-3.5 text-sm">
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1.5">Add to Calendar</div>
                      <div className="text-xs font-semibold mb-0.5">{m.calendarEvent.title}</div>
                      <div className="text-xs opacity-70 mb-3">
                        {new Date(m.calendarEvent.date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {m.calendarEvent.time ? ` at ${m.calendarEvent.time}` : ''}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => addToGoogleCal(m.calendarEvent!, i)}
                          disabled={gcalAdding === String(i)}
                          className="flex-1 bg-vida-text text-vida-bg rounded-xl py-2 text-[12px] font-bold disabled:opacity-50"
                        >
                          {gcalAdding === String(i) ? '...' : '📅 Google Calendar'}
                        </button>
                        <button
                          onClick={() => saveToIphoneCal(m.calendarEvent!)}
                          className="flex-1 bg-vida-warm border border-vida-cream text-vida-text rounded-xl py-2 text-[12px] font-bold"
                        >
                          📱 iPhone Calendar
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={`flex items-center gap-2 mt-1 px-1 ${m.role === 'user' ? 'justify-end' : ''}`}>
                    <span className="text-[10px] text-vida-muted">{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {m.role === 'assistant' && (
                      <button onClick={() => speak(m.text)} className="text-vida-muted hover:text-vida-secondary transition opacity-50 hover:opacity-100">
                        <Volume2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {typing && <div className="self-start bg-vida-warm rounded-2xl rounded-bl-md shadow-sm px-5 py-3.5 flex gap-1.5 items-center"><div className="w-[7px] h-[7px] rounded-full bg-vida-muted typing-dot" /><div className="w-[7px] h-[7px] rounded-full bg-vida-muted typing-dot" /><div className="w-[7px] h-[7px] rounded-full bg-vida-muted typing-dot" /></div>}
              {streamingText && (
                <div className="msg-pop max-w-[84%] self-start">
                  <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed bg-vida-warm text-vida-text rounded-bl-md shadow-sm">
                    {renderMarkdown(streamingText)}
                    <span className="inline-block w-0.5 h-4 bg-vida-muted ml-0.5 animate-pulse align-middle" />
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            {/* Quick reply chips */}
            {data.messages.length <= 1 && (
              <div className="px-4 pb-2 flex gap-2 overflow-x-auto hide-scrollbar shrink-0">
                {QUICK_REPLIES.map(q => (
                  <button key={q} onClick={() => send(q)} className="shrink-0 bg-vida-warm text-vida-secondary text-[12px] font-semibold px-3 py-2 rounded-full border border-vida-cream whitespace-nowrap">
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="px-4 pb-3 pt-1 shrink-0">
              <div className="flex items-end gap-1.5 bg-vida-warm border-[1.5px] border-vida-cream rounded-3xl px-4 py-1.5 shadow-sm focus-within:border-sage focus-within:ring-4 focus-within:ring-sage/25 transition">
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Talk to Vida..." rows={1} className="flex-1 bg-transparent text-[15px] py-2 resize-none outline-none min-h-[24px] max-h-[100px] placeholder:text-vida-muted" />
                <button onClick={voice} className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 ${recording ? 'bg-red-400 text-white rec-pulse' : 'text-vida-muted'}`}><Mic size={16} /></button>
                <button onClick={() => send()} disabled={!input.trim()} className="w-9 h-9 rounded-full bg-vida-text text-vida-bg flex items-center justify-center transition shrink-0 disabled:opacity-20"><Send size={14} /></button>
              </div>
            </div>
          </div>
        )}

        {/* TASKS — Todos / Reminders / Habits */}
        {panel === 'tasks' && (
          <div className="h-full flex flex-col">
            {/* Sub-tabs */}
            <div className="flex gap-1 px-4 pb-2 shrink-0">
              {(['todos', 'reminders', 'habits'] as TaskTab[]).map(t => (
                <button key={t} onClick={() => setTaskTab(t)} className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition capitalize ${taskTab === t ? 'bg-vida-text text-vida-bg' : 'text-vida-muted hover:bg-vida-cream'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-4">

              {/* TODOS */}
              {taskTab === 'todos' && (
                <>
                  {activeTodosToday.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-vida-muted uppercase tracking-wider mb-2">Today</p>
                      {activeTodosToday.map(t => (
                        <div key={t.id} className="flex items-center gap-3 bg-vida-warm rounded-2xl p-3.5 mb-2 shadow-sm">
                          <button onClick={() => toggleTodo(t.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${t.done ? 'border-lavender bg-lavender text-lavender-dark' : 'border-vida-muted'}`}>{t.done && <Check size={12} />}</button>
                          <span className={`flex-1 text-sm font-semibold ${t.done ? 'line-through opacity-40' : ''}`}>{t.title}</span>
                          <button onClick={() => deleteTodo(t.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-vida-muted hover:text-red-400 transition shrink-0"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </>
                  )}
                  {activeTodosWeekly.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-vida-muted uppercase tracking-wider mb-2 mt-3">This week</p>
                      {activeTodosWeekly.map(t => (
                        <div key={t.id} className="flex items-center gap-3 bg-vida-warm rounded-2xl p-3.5 mb-2 shadow-sm">
                          <button onClick={() => toggleTodo(t.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${t.done ? 'border-lavender bg-lavender text-lavender-dark' : 'border-vida-muted'}`}>{t.done && <Check size={12} />}</button>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-semibold ${t.done ? 'line-through opacity-40' : ''}`}>{t.title}</span>
                            <div className="text-[10px] text-vida-muted mt-0.5">Weekly</div>
                          </div>
                          <button onClick={() => deleteTodo(t.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-vida-muted hover:text-red-400 transition shrink-0"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </>
                  )}
                  {activeTodosToday.length === 0 && activeTodosWeekly.length === 0 && (
                    <div className="text-center py-10 text-vida-muted">
                      <div className="flex justify-center mb-2 opacity-40"><ListTodo size={36} strokeWidth={1.5} /></div>
                      <div className="text-sm">No todos — ask Vida to add some or tap below!</div>
                    </div>
                  )}
                  <button onClick={() => openAddForm('todo')} className="w-full border-2 border-dashed border-vida-muted/25 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-vida-muted mt-1">
                    <Plus size={15} /> New todo
                  </button>
                </>
              )}

              {/* REMINDERS */}
              {taskTab === 'reminders' && (
                <>
                  {[
                    { label: 'Today', items: data.reminders.filter(r => r.date === today) },
                    { label: 'Upcoming', items: data.reminders.filter(r => r.date > today && !r.done).sort((a, b) => a.date.localeCompare(b.date)) },
                    { label: 'Done', items: data.reminders.filter(r => r.done) },
                  ].map(g => g.items.length > 0 && (
                    <div key={g.label}>
                      <p className="text-xs font-semibold text-vida-muted uppercase tracking-wider mb-2 mt-3 first:mt-0">{g.label}</p>
                      {g.items.map(r => (
                        <div key={r.id} className={`flex items-center gap-3 bg-vida-warm rounded-2xl p-3.5 mb-2 shadow-sm ${r.done ? 'opacity-40' : ''}`}>
                          <button onClick={() => toggleReminder(r.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${r.done ? 'border-sage bg-sage text-sage-dark' : 'border-vida-muted'}`}>{r.done && <Check size={12} />}</button>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm truncate ${r.done ? 'line-through' : ''}`}>{r.title}</div>
                            <div className="text-xs text-vida-muted mt-0.5 flex items-center gap-1.5">
                              {fd(r.date)}{r.time ? ` · ${ft(r.time)}` : ''}
                              {r.recurring && <span className="flex items-center gap-0.5 text-sage-dark font-semibold"><Repeat size={10} />{r.recurring}</span>}
                            </div>
                          </div>
                          <button onClick={() => deleteReminder(r.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-vida-muted hover:text-red-400 transition shrink-0"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  ))}
                  {data.reminders.length === 0 && <div className="text-center py-10 text-vida-muted"><div className="flex justify-center mb-2 opacity-40"><Bell size={36} strokeWidth={1.5} /></div><div className="text-sm">No reminders — try "Remind me to..." in chat</div></div>}
                  <button onClick={() => openAddForm('reminder')} className="w-full border-2 border-dashed border-vida-muted/25 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-vida-muted mt-1">
                    <Plus size={15} /> New reminder
                  </button>
                </>
              )}

              {/* HABITS */}
              {taskTab === 'habits' && (
                <>
                  <p className="text-xs font-semibold text-vida-muted uppercase tracking-wider mb-2">This week</p>
                  {data.habits.map(h => { const c = CM[h.color] || CM.sage; return (
                    <div key={h.id} className={`group ${c.light} ${c.dark} rounded-2xl p-4 mb-2.5`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[15px] flex items-center gap-2"><span className="opacity-70"><HabitIcon name={h.name} icon={h.icon} size={16} /></span>{h.name}</span>
                        <div className="flex items-center gap-1.5">
                          {h.streak > 0 && <span className="text-[11px] font-bold bg-white/60 px-2.5 py-0.5 rounded-full flex items-center gap-1"><Flame size={11} />{h.streak}d</span>}
                          <button onClick={() => deleteHabit(h.id)} className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-3">{Array.from({ length: 7 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = d.toISOString().split('T')[0]; const f = h.log[k]; const day = d.toLocaleDateString('en-ZA', { weekday: 'short' }).charAt(0); return (
                        <button key={k} onClick={() => toggleHabitDay(h.id, k)} className={`flex-1 h-8 rounded-[10px] flex items-center justify-center text-[10px] font-semibold transition active:scale-90 ${f ? c.df : c.de} ${i === 6 ? 'ring-2 ring-vida-text/20 ring-offset-1' : ''}`}>{f ? <Check size={12} strokeWidth={3} /> : day}</button>
                      ); })}</div>
                    </div>
                  ); })}
                  {data.habits.length === 0 && <div className="text-center py-10 text-vida-muted"><div className="flex justify-center mb-2 opacity-40"><Activity size={36} strokeWidth={1.5} /></div><div className="text-sm">No habits yet — ask Vida to add one!</div></div>}
                  <button onClick={() => openAddForm('habit')} className="w-full border-2 border-dashed border-vida-muted/25 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-vida-muted mt-1">
                    <Plus size={15} /> New habit
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* SCHEDULE — Calendar + Spending */}
        {panel === 'schedule' && (() => {
          // Calendar grid helpers
          const { year, month } = calMonth;
          const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const startOffset = firstDow === 0 ? 6 : firstDow - 1; // Mon-first
          const cells: (number | null)[] = [
            ...Array(startOffset).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];
          while (cells.length % 7 !== 0) cells.push(null);

          const monthLabel = new Date(year, month, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
          const todayFull = new Date().toISOString().split('T')[0];

          function dateStr(day: number) {
            return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }

          function eventsOnDay(day: number) {
            return allEvents.filter(e => e.date === dateStr(day));
          }

          const selectedEvents = allEvents.filter(e => e.date === selectedDate);

          const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

          return (
            <div className="h-full flex flex-col">
              {/* Sub-tabs */}
              <div className="flex gap-1 px-4 pb-2 shrink-0">
                {(['calendar', 'spending'] as const).map(t => (
                  <button key={t} onClick={() => setScheduleTab(t)} className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition capitalize ${scheduleTab === t ? 'bg-vida-text text-vida-bg' : 'text-vida-muted hover:bg-vida-cream'}`}>{t}</button>
                ))}
              </div>

              {scheduleTab === 'calendar' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between px-4 mb-3 shrink-0">
                    <button onClick={() => setCalMonth(p => { const d = new Date(p.year, p.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-vida-cream text-vida-secondary transition">
                      <ChevronRight size={18} className="rotate-180" />
                    </button>
                    <span className="font-bold text-[15px]">{monthLabel}</span>
                    <button onClick={() => setCalMonth(p => { const d = new Date(p.year, p.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-vida-cream text-vida-secondary transition">
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 px-3 mb-1 shrink-0">
                    {DOW.map((d, i) => (
                      <div key={i} className="text-center text-[11px] font-bold text-vida-muted py-1">{d}</div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 px-3 gap-y-1 shrink-0">
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} />;
                      const ds = dateStr(day);
                      const isToday = ds === todayFull;
                      const isSelected = ds === selectedDate;
                      const evts = eventsOnDay(day);
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDate(ds)}
                          className={`flex flex-col items-center py-1.5 rounded-2xl transition ${isSelected ? 'bg-vida-text' : isToday ? 'bg-vida-cream' : 'hover:bg-vida-warm'}`}
                        >
                          <span className={`text-[14px] font-semibold leading-none mb-1 ${isSelected ? 'text-vida-bg' : isToday ? 'text-vida-text' : 'text-vida-text'}`}>
                            {day}
                          </span>
                          <div className="flex gap-0.5 h-[6px] items-center">
                            {evts.slice(0, 3).map((e, j) => (
                              <div key={j} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-vida-bg/60' : e.type === 'birthday' ? 'bg-lavender-dark' : e.type === 'appointment' ? 'bg-peach-dark' : 'bg-sky-dark'}`} />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected day events */}
                  <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pt-3 pb-4 mt-2 border-t border-vida-cream">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-bold text-vida-muted uppercase tracking-wider">
                        {selectedDate === todayFull ? 'Today' : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </p>
                      <button onClick={() => openAddForm('event')} className="flex items-center gap-1 text-[11px] font-semibold text-vida-muted hover:text-vida-secondary px-2.5 py-1 rounded-full hover:bg-vida-cream transition">
                        <Plus size={12} /> Add
                      </button>
                    </div>
                    {gcalLoading && gcalEvents.length === 0 && selectedDate === todayFull && (
                      <div className="h-16 rounded-2xl bg-vida-warm animate-pulse" />
                    )}
                    {selectedEvents.length === 0 && (
                      <p className="text-sm text-vida-muted text-center py-6 opacity-60">Nothing on this day</p>
                    )}
                    {selectedEvents.map(e => (
                      <div key={e.id} className={`rounded-2xl p-4 mb-2 ${e.type === 'birthday' ? 'bg-lavender-light text-lavender-dark' : e.type === 'appointment' ? 'bg-peach-light text-peach-dark' : 'bg-sky-light text-sky-dark'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {e.time && <div className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-0.5">{ft(e.time)}</div>}
                            <div className="font-semibold text-[15px] truncate">{e.title}</div>
                            {e.detail && <div className="text-xs opacity-65 mt-0.5">{e.detail}</div>}
                            {e.googleEventId && <div className="text-[10px] opacity-40 mt-1">📅 Google Calendar</div>}
                          </div>
                          {!e.googleEventId && (
                            <button onClick={() => deleteEvent(e.id)} className="w-7 h-7 rounded-full flex items-center justify-center opacity-40 hover:opacity-80 transition shrink-0"><Trash2 size={13} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scheduleTab === 'spending' && (
                <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-4">
                  {data.spending.length === 0 && (
                    <div className="text-center py-10 text-vida-muted">
                      <div className="flex justify-center mb-2 opacity-40"><CreditCard size={36} strokeWidth={1.5} /></div>
                      <div className="text-sm">No spending tracked yet — ask Vida to log a purchase!</div>
                    </div>
                  )}
                  {data.spending.map(s => {
                    const entries = (data.spendingEntries || []).filter(e => e.category === s.cat);
                    const isExpanded = expandedCategory === s.cat;
                    return (
                      <div key={s.cat} className="bg-vida-warm rounded-2xl p-4 mb-3 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <button onClick={() => setExpandedCategory(isExpanded ? null : s.cat)} className="flex items-center gap-1.5 font-bold text-[15px] hover:opacity-70 transition">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {s.cat}
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-sm ${s.amount > s.budget && s.budget > 0 ? 'text-red-500' : ''}`}>
                              R{s.amount}{s.budget > 0 ? ` / R${s.budget}` : ''}
                              {s.amount > s.budget && s.budget > 0 && ' ⚠️'}
                            </span>
                            <button onClick={() => { setBudgetModal(s.cat); setBudgetInput(String(s.budget || '')); }} className="w-7 h-7 rounded-full flex items-center justify-center text-vida-muted hover:bg-vida-cream transition">
                              <Pencil size={12} />
                            </button>
                          </div>
                        </div>
                        {s.budget > 0 && (
                          <div className="h-2 rounded-full bg-vida-cream overflow-hidden mb-2">
                            <div className={`h-full rounded-full transition-all ${s.amount > s.budget ? 'bg-red-400' : s.amount > s.budget * 0.8 ? 'bg-amber-400' : 'bg-mint-dark'}`} style={{ width: `${Math.min(Math.round(s.amount / Math.max(s.budget, 1) * 100), 100)}%` }} />
                          </div>
                        )}
                        {isExpanded && (
                          <div className="border-t border-vida-cream pt-2.5 flex flex-col gap-2">
                            {entries.length === 0 && <p className="text-[12px] text-vida-muted">No entries yet</p>}
                            {entries.slice(-15).reverse().map(e => (
                              <div key={e.id} className="flex justify-between items-baseline text-[13px]">
                                <span className="text-vida-secondary truncate flex-1">{e.description || e.category}</span>
                                <span className="font-semibold text-vida-text ml-2 shrink-0">R{e.amount}</span>
                                <span className="text-[11px] text-vida-muted ml-2 shrink-0">{e.date.slice(5)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* NOTIFICATIONS */}
        {panel === 'notifications' && (
          <div className="h-full overflow-y-auto hide-scrollbar px-4 pb-4 pt-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-vida-muted uppercase tracking-wider">AI Alerts</p>
              <div className="flex gap-2">
                {data.notifications.some(n => !n.read) && (
                  <button onClick={markAllNotificationsRead} className="text-[11px] font-semibold text-vida-muted hover:text-vida-secondary">
                    Mark all read
                  </button>
                )}
                <button onClick={() => fetchBriefing(true)} disabled={briefingLoading} className="flex items-center gap-1 text-[11px] font-semibold text-vida-muted hover:text-vida-secondary disabled:opacity-40">
                  <RefreshCw size={11} className={briefingLoading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>
            {data.notifications.length === 0 && !briefingLoading && (
              <div className="text-center py-10 text-vida-muted">
                <div className="flex justify-center mb-2 opacity-40"><Bell size={36} strokeWidth={1.5} /></div>
                <div className="text-sm mb-3">No alerts yet</div>
                <button onClick={() => fetchBriefing(true)} className="text-[13px] font-semibold text-sage-dark bg-sage-light px-4 py-2 rounded-full">
                  Generate alerts
                </button>
              </div>
            )}
            {briefingLoading && (
              <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="h-[80px] rounded-2xl bg-vida-warm animate-pulse" />)}</div>
            )}
            {[...data.notifications].sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2 };
              return order[a.urgency] - order[b.urgency];
            }).map(n => (
              <button key={n.id} onClick={() => markNotificationRead(n.id)} className={`w-full text-left rounded-2xl p-4 mb-2.5 transition ${n.read ? 'opacity-50' : ''} ${n.urgency === 'high' ? 'bg-red-50 border border-red-100' : n.urgency === 'medium' ? 'bg-amber-50 border border-amber-100' : 'bg-vida-warm'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${n.urgency === 'high' ? 'bg-red-100 text-red-600' : n.urgency === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-vida-cream text-vida-secondary'}`}>
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-[14px] text-vida-text">{n.title}</span>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-sage-dark shrink-0" />}
                    </div>
                    <p className="text-[12.5px] text-vida-secondary leading-relaxed">{n.body}</p>
                  </div>
                </div>
              </button>
            ))}
            <div className="mt-3 p-4 bg-vida-warm rounded-2xl">
              <div className="flex items-center gap-2 text-[12px] text-vida-muted">
                <TrendingUp size={14} />
                <span>Alerts refresh daily. Tap Refresh to update anytime.</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM TAB BAR */}
      <nav className="shrink-0 bg-vida-bg border-t border-vida-cream pb-safe">
        <div className="flex items-stretch h-16">
          {([
            { id: 'home',          icon: Home,          label: 'Home' },
            { id: 'chat',          icon: MessageCircle, label: 'Chat' },
            { id: 'tasks',         icon: ListTodo,      label: 'Tasks' },
            { id: 'schedule',      icon: Calendar,      label: 'Schedule' },
            { id: 'notifications', icon: Bell,          label: 'Alerts' },
          ] as { id: Panel; icon: React.FC<{ size?: number; className?: string }>; label: string }[]).map(tab => {
            const active = panel === tab.id;
            const badge = tab.id === 'notifications' && unreadCount > 0;
            return (
              <button key={tab.id} onClick={() => setPanel(tab.id)} className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors ${active ? 'text-vida-text' : 'text-vida-muted'}`}>
                {badge && <div className="absolute top-2.5 right-[calc(50%-14px)] w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center z-10">{unreadCount > 9 ? '9+' : unreadCount}</div>}
                <tab.icon size={22} className={active ? 'opacity-100' : 'opacity-50'} />
                <span className={`text-[10px] font-semibold ${active ? 'opacity-100' : 'opacity-50'}`}>{tab.label}</span>
                {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-vida-text rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* BUDGET MODAL */}
      {budgetModal && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-vida-text/20 backdrop-blur-sm" onClick={() => setBudgetModal(null)}>
          <div className="bg-vida-bg rounded-t-3xl px-5 pt-5 shadow-2xl border-t border-vida-cream" onClick={e => e.stopPropagation()}>
            <div className="pb-8">
              <div className="w-10 h-1 bg-vida-muted/30 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] font-bold">Set {budgetModal} Budget</h2>
                <button onClick={() => setBudgetModal(null)} className="w-8 h-8 rounded-full bg-vida-cream flex items-center justify-center text-vida-muted"><X size={16} /></button>
              </div>
              <div className="flex items-center gap-2 bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 mb-4">
                <span className="text-vida-muted font-semibold">R</span>
                <input
                  type="number" inputMode="decimal"
                  className="flex-1 bg-transparent text-[17px] font-semibold outline-none text-vida-text"
                  placeholder="0"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && budgetInput) { setBudget(budgetModal, Number(budgetInput)); setBudgetModal(null); } }}
                />
              </div>
              <button
                onClick={() => { if (budgetInput) { setBudget(budgetModal, Number(budgetInput)); setBudgetModal(null); } }}
                disabled={!budgetInput}
                className="w-full bg-vida-text text-vida-bg rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-30"
              >
                Set Budget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD FORM MODAL */}
      {addForm && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-vida-text/20 backdrop-blur-sm" onClick={() => setAddForm(null)}>
          <div className="bg-vida-bg rounded-t-3xl px-5 pt-5 pb-safe shadow-2xl border-t border-vida-cream" onClick={e => e.stopPropagation()}>
            <div className="pb-6">
              <div className="w-10 h-1 bg-vida-muted/30 rounded-full mx-auto mb-4" />

              {addForm === 'todo' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[17px] font-bold">New Todo</h2>
                    <button onClick={() => setAddForm(null)} className="w-8 h-8 rounded-full bg-vida-cream flex items-center justify-center text-vida-muted"><X size={16} /></button>
                  </div>
                  <input
                    className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-3 transition placeholder:text-vida-muted"
                    placeholder="What needs doing?"
                    value={tf.title} onChange={e => setTf(p => ({ ...p, title: e.target.value }))}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && tf.title.trim()) { addTodo(tf.title.trim(), tf.scope); setAddForm(null); } }}
                  />
                  <div className="flex gap-2 mb-4">
                    {(['daily', 'weekly'] as const).map(s => (
                      <button key={s} onClick={() => setTf(p => ({ ...p, scope: s }))} className={`flex-1 py-2.5 rounded-2xl text-[14px] font-semibold transition capitalize ${tf.scope === s ? 'bg-vida-text text-vida-bg' : 'bg-vida-warm text-vida-muted border border-vida-cream'}`}>{s}</button>
                    ))}
                  </div>
                  <button onClick={() => { if (tf.title.trim()) { addTodo(tf.title.trim(), tf.scope); setAddForm(null); } }} disabled={!tf.title.trim()} className="w-full bg-vida-text text-vida-bg rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-30">Add Todo</button>
                </>
              )}

              {addForm === 'reminder' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[17px] font-bold">Add Reminder</h2>
                    <button onClick={() => setAddForm(null)} className="w-8 h-8 rounded-full bg-vida-cream flex items-center justify-center text-vida-muted"><X size={16} /></button>
                  </div>
                  <input className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-3 transition placeholder:text-vida-muted" placeholder="What do you need to remember?" value={rf.title} onChange={e => setRf(p => ({ ...p, title: e.target.value }))} autoFocus onKeyDown={e => { if (e.key === 'Enter' && rf.title.trim() && rf.date) { addReminder({ title: rf.title.trim(), date: rf.date, time: rf.time || '09:00', done: false }); setAddForm(null); } }} />
                  <div className="flex gap-2 mb-4">
                    <input type="date" className="flex-1 bg-vida-warm border border-vida-cream rounded-2xl px-3 py-3 text-[14px] outline-none focus:border-sage transition text-vida-text" value={rf.date} onChange={e => setRf(p => ({ ...p, date: e.target.value }))} />
                    <input type="time" className="flex-1 bg-vida-warm border border-vida-cream rounded-2xl px-3 py-3 text-[14px] outline-none focus:border-sage transition text-vida-text" value={rf.time} onChange={e => setRf(p => ({ ...p, time: e.target.value }))} />
                  </div>
                  <button onClick={() => { if (rf.title.trim() && rf.date) { addReminder({ title: rf.title.trim(), date: rf.date, time: rf.time || '09:00', done: false }); setAddForm(null); } }} disabled={!rf.title.trim() || !rf.date} className="w-full bg-vida-text text-vida-bg rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-30">Add Reminder</button>
                </>
              )}

              {addForm === 'habit' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[17px] font-bold">New Habit</h2>
                    <button onClick={() => setAddForm(null)} className="w-8 h-8 rounded-full bg-vida-cream flex items-center justify-center text-vida-muted"><X size={16} /></button>
                  </div>
                  <input className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-3 transition placeholder:text-vida-muted" placeholder="e.g. Meditate, Run, Drink water..." value={hf.name} onChange={e => setHf(p => ({ ...p, name: e.target.value }))} autoFocus onKeyDown={e => { if (e.key === 'Enter' && hf.name.trim()) { addHabit(hf.name.trim(), hf.icon); setAddForm(null); } }} />
                  <p className="text-xs font-semibold text-vida-muted mb-2">Pick an icon</p>
                  <div className="grid grid-cols-10 gap-1.5 mb-4">{HABIT_ICONS.map(icon => (<button key={icon} onClick={() => setHf(p => ({ ...p, icon }))} className={`h-9 rounded-xl text-[18px] flex items-center justify-center transition ${hf.icon === icon ? 'bg-vida-text' : 'bg-vida-warm'}`}>{icon}</button>))}</div>
                  <button onClick={() => { if (hf.name.trim()) { addHabit(hf.name.trim(), hf.icon); setAddForm(null); } }} disabled={!hf.name.trim()} className="w-full bg-vida-text text-vida-bg rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-30">Create Habit</button>
                </>
              )}

              {addForm === 'event' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[17px] font-bold">Add Event</h2>
                    <button onClick={() => setAddForm(null)} className="w-8 h-8 rounded-full bg-vida-cream flex items-center justify-center text-vida-muted"><X size={16} /></button>
                  </div>
                  <input className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-3 transition placeholder:text-vida-muted" placeholder="What's the event?" value={ef.title} onChange={e => setEf(p => ({ ...p, title: e.target.value }))} autoFocus />
                  <div className="flex gap-2 mb-3">
                    <input type="date" className="flex-1 bg-vida-warm border border-vida-cream rounded-2xl px-3 py-3 text-[14px] outline-none focus:border-sage transition text-vida-text" value={ef.date} onChange={e => setEf(p => ({ ...p, date: e.target.value }))} />
                    <select className="flex-1 bg-vida-warm border border-vida-cream rounded-2xl px-3 py-3 text-[14px] outline-none focus:border-sage transition text-vida-text" value={ef.type} onChange={e => setEf(p => ({ ...p, type: e.target.value as 'birthday' | 'event' | 'appointment' }))}>
                      <option value="event">Event</option>
                      <option value="appointment">Appointment</option>
                      <option value="birthday">Birthday</option>
                    </select>
                  </div>
                  <input className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[14px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-4 transition placeholder:text-vida-muted" placeholder="Details (optional)" value={ef.detail} onChange={e => setEf(p => ({ ...p, detail: e.target.value }))} />
                  <button onClick={() => { if (ef.title.trim() && ef.date) { addEvent({ title: ef.title.trim(), date: ef.date, type: ef.type, detail: ef.detail || undefined }); setAddForm(null); } }} disabled={!ef.title.trim() || !ef.date} className="w-full bg-vida-text text-vida-bg rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-30">Add Event</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
