'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useVidaData } from '@/lib/useVidaData';
import { Send, Mic, MessageCircle, Bell, Check, Activity, Star, Calendar, CreditCard, Sun, Dumbbell, BookOpen, Pill, Sparkles, ArrowRight, Plus, X, LogOut } from 'lucide-react';

function HabitIcon({ name, size = 16 }: { name: string; size?: number }) {
  const n = name.toLowerCase();
  if (n.includes('gym') || n.includes('workout') || n.includes('exercise')) return <Dumbbell size={size} />;
  if (n.includes('read')) return <BookOpen size={size} />;
  if (n.includes('vitamin') || n.includes('pill') || n.includes('supplement')) return <Pill size={size} />;
  return <Sparkles size={size} />;
}

type Panel = 'home' | 'chat' | 'habits' | 'reminders' | 'upcoming';

const CM: Record<string, { light: string; dark: string; df: string; de: string }> = {
  sage: { light: 'bg-sage-light', dark: 'text-sage-dark', df: 'bg-sage text-sage-dark', de: 'bg-sage-dark/10 text-sage-dark/40' },
  lavender: { light: 'bg-lavender-light', dark: 'text-lavender-dark', df: 'bg-lavender text-lavender-dark', de: 'bg-lavender-dark/10 text-lavender-dark/40' },
  pink: { light: 'bg-pink-light', dark: 'text-pink-dark', df: 'bg-pink text-pink-dark', de: 'bg-pink-dark/10 text-pink-dark/40' },
  peach: { light: 'bg-peach-light', dark: 'text-peach-dark', df: 'bg-peach text-peach-dark', de: 'bg-peach-dark/10 text-peach-dark/40' },
  sky: { light: 'bg-sky-light', dark: 'text-sky-dark', df: 'bg-sky text-sky-dark', de: 'bg-sky-dark/10 text-sky-dark/40' },
  mint: { light: 'bg-mint-light', dark: 'text-mint-dark', df: 'bg-mint text-mint-dark', de: 'bg-mint-dark/10 text-mint-dark/40' },
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

export default function VidaApp() {
  const { data: session, status } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessToken = (session as any)?.accessToken as string | undefined;
  const userName = session?.user?.name?.split(' ')[0] || 'there';
  const userEmail = session?.user?.email || '';

  const [panel, setPanel] = useState<Panel>('home');
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [addForm, setAddForm] = useState<'reminder' | 'habit' | 'event' | null>(null);
  const [rf, setRf] = useState({ title: '', date: '', time: '09:00' });
  const [hf, setHf] = useState({ name: '' });
  const [ef, setEf] = useState({ title: '', date: '', type: 'event' as 'birthday' | 'event' | 'appointment', detail: '' });
  const chatEnd = useRef<HTMLDivElement>(null);
  const { data, loaded, addMessage, addReminder, toggleReminder, logHabit, toggleHabitDay, addHabit, addEvent, logSpending, clearMessages } = useVidaData(userEmail || undefined);

  const scroll = useCallback(() => { setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100); }, []);

  useEffect(() => {
    if (panel === 'chat' && data.messages.length === 0 && loaded) {
      addMessage({ role: 'assistant', text: `Hey ${userName}! ☀️\n\nI'm **Vida** — powered by Gemini AI. I'm connected to your Google Calendar and Gmail so I actually know what's going on in your life.\n\nJust type or talk naturally:\n• \"What's on my calendar this week?\"\n• \"Do I have any important emails?\"\n• \"Remind me to call the dentist tomorrow\"\n• \"Add gym to my habits\"`, time: new Date().toISOString() });
    }
  }, [panel, loaded]); // eslint-disable-line

  async function send() {
    const text = input.trim(); if (!text) return;
    addMessage({ role: 'user', text, time: new Date().toISOString() });
    setInput(''); setTyping(true); scroll();
    try {
      const today = rd(0);
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          accessToken,
          context: {
            today, currentTime: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
            pendingReminders: data.reminders.filter(r => !r.done).length,
            habitsDoneToday: data.habits.filter(h => h.log[today]).length,
            totalHabits: data.habits.length,
            recentEvents: data.events.slice(0, 3).map(e => `${e.title} (${fd(e.date)})`),
            monthSpending: data.spending.reduce((a, s) => a + s.amount, 0),
          },
        }),
      });
      const r = await res.json();
      if (r.action === 'create_reminder' && r.params) addReminder({ title: String(r.params.title || text), date: String(r.params.date || rd(1)), time: r.params.time ? String(r.params.time) : '09:00', done: false });
      else if (r.action === 'log_habit' && r.params?.habit_name) logHabit(String(r.params.habit_name));
      else if (r.action === 'create_habit' && r.params?.name) addHabit(String(r.params.name), String(r.params.icon || '✨'));
      else if (r.action === 'log_spending' && r.params?.amount) logSpending(Number(r.params.amount), String(r.params.category || 'Other'));
      else if (r.action === 'add_event' && r.params) addEvent({ title: String(r.params.title || ''), date: String(r.params.date || rd(7)), type: (r.params.type as 'birthday' | 'event' | 'appointment') || 'event', detail: r.params.detail ? String(r.params.detail) : undefined });
      addMessage({ role: 'assistant', text: r.response, time: new Date().toISOString() });
    } catch {
      addMessage({ role: 'assistant', text: "Couldn't reach the AI. Make sure your GEMINI_API_KEY is set in .env!", time: new Date().toISOString() });
    }
    setTyping(false); scroll();
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
    clearMessages();
    addMessage({ role: 'assistant', text: `Hey ${userName}! ☀️\n\nI'm **Vida** — powered by Gemini AI. I'm connected to your Google Calendar and Gmail so I actually know what's going on in your life.\n\nJust type or talk naturally:\n• \"What's on my calendar this week?\"\n• \"Do I have any important emails?\"\n• \"Remind me to call the dentist tomorrow\"\n• \"Add gym to my habits\"`, time: new Date().toISOString() });
  }

  function openAddForm(type: 'reminder' | 'habit' | 'event') {
    if (type === 'reminder') setRf({ title: '', date: rd(0), time: '09:00' });
    if (type === 'event') setEf({ title: '', date: rd(1), type: 'event', detail: '' });
    if (type === 'habit') setHf({ name: '' });
    setAddForm(type);
  }

  function submitReminder() {
    if (!rf.title.trim() || !rf.date) return;
    addReminder({ title: rf.title.trim(), date: rf.date, time: rf.time || '09:00', done: false });
    setAddForm(null);
  }

  function submitHabit() {
    if (!hf.name.trim()) return;
    addHabit(hf.name.trim());
    setAddForm(null);
  }

  function submitEvent() {
    if (!ef.title.trim() || !ef.date) return;
    addEvent({ title: ef.title.trim(), date: ef.date, type: ef.type, detail: ef.detail || undefined });
    setAddForm(null);
  }

  if (status === 'loading' || !loaded) return (
    <div className="h-dvh flex items-center justify-center bg-vida-bg">
      <span className="text-3xl animate-pulse">✦</span>
    </div>
  );

  if (status === 'unauthenticated') return (
    <div className="h-dvh flex flex-col items-center justify-center bg-vida-bg px-8 max-w-[480px] mx-auto">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sage to-lavender flex items-center justify-center text-4xl mb-6 shadow-lg">
        ✦
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Vida</h1>
      <p className="text-vida-secondary text-center text-[15px] mb-10 leading-relaxed">
        Your AI personal assistant — connected to your real Google Calendar and Gmail.
      </p>
      <button
        onClick={() => signIn('google')}
        className="w-full flex items-center justify-center gap-3 bg-vida-text text-vida-bg rounded-2xl py-4 text-[16px] font-bold transition hover:opacity-90 active:scale-95 shadow-md"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
      <p className="text-xs text-vida-muted text-center mt-6 leading-relaxed">
        Vida requests access to your Google Calendar and Gmail so Gemini can read your schedule and emails. Your data is never stored on our servers.
      </p>
    </div>
  );

  if (!loaded) return (
    <div className="h-dvh flex items-center justify-center bg-vida-bg">
      <span className="text-3xl animate-pulse">✦</span>
    </div>
  );

  const today = rd(0);
  const hDone = data.habits.filter(h => h.log[today]).length;
  const pend = data.reminders.filter(r => !r.done);
const bday = data.events.find(e => e.type === 'birthday' && dt(e.date) >= 1 && dt(e.date) <= 5);
  const hr = new Date().getHours();

  return (
    <div className="flex flex-col h-dvh max-w-[480px] mx-auto bg-vida-bg relative">
      {/* HEADER */}
      <header className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sage to-lavender flex items-center justify-center font-bold text-vida-bg">
              {userName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold tracking-tight">{hr < 12 ? 'Morning' : hr < 17 ? 'Afternoon' : 'Evening'}, {userName}!</h1>
            <p className="text-xs text-vida-secondary -mt-0.5">{hr < 12 ? "Let's make today count" : hr < 17 ? "Hope your day's going well" : 'Time to wind down'}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setPanel('chat')} className="w-9 h-9 rounded-2xl bg-vida-warm shadow-sm flex items-center justify-center text-vida-secondary hover:bg-vida-cream transition"><MessageCircle size={16} /></button>
          <button onClick={() => signOut()} title="Sign out" className="w-9 h-9 rounded-2xl bg-vida-warm shadow-sm flex items-center justify-center text-vida-secondary hover:bg-vida-cream transition"><LogOut size={16} /></button>
        </div>
      </header>

      {/* NAV */}
      <nav className="flex gap-1 px-5 py-2 shrink-0 overflow-x-auto hide-scrollbar">
        {(['home','chat','habits','reminders','upcoming'] as Panel[]).map(p => (
          <button key={p} onClick={() => setPanel(p)} className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition whitespace-nowrap ${panel === p ? 'bg-vida-text text-vida-bg' : 'text-vida-muted hover:bg-vida-cream hover:text-vida-secondary'}`}>
            {p === 'home' ? 'Home' : p === 'chat' ? 'Chat' : p === 'habits' ? 'Habits' : p === 'reminders' ? 'Reminders' : 'Events'}
          </button>
        ))}
      </nav>

      {/* HOME */}
      {panel === 'home' && (
        <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-8 pt-1">
          {bday && (
            <button onClick={() => setPanel('chat')} className="w-full flex items-center gap-3 bg-vida-text text-vida-bg rounded-2xl p-4 mb-3 text-left hover:opacity-90 transition">
              <Sparkles size={22} className="shrink-0 opacity-75" />
              <span className="flex-1 text-[13.5px] font-medium">{bday.title} is in {dt(bday.date)} days — grab a gift?</span>
              <ArrowRight size={16} className="opacity-50 shrink-0" />
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => setPanel('habits')} className="bento-card bg-sage-light text-sage-dark rounded-2xl p-4 text-left relative min-h-[120px] flex flex-col">
              <Activity size={26} className="mb-2 opacity-85" />
              <span className="absolute top-3.5 right-3.5 bg-white/50 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[11px] font-semibold">{hDone}/{data.habits.length}</span>
              <span className="font-bold text-[15px]">Habits</span>
              <span className="text-xs opacity-70">Today&apos;s progress</span>
              <div className="flex gap-1 mt-2">{data.habits.map(h => (
                <div key={h.id} className={`w-6 h-6 rounded-lg flex items-center justify-center ${h.log[today] ? (CM[h.color]?.df || '') : (CM[h.color]?.de || '')}`}>
                  {h.log[today] ? <Check size={10} strokeWidth={3} /> : <HabitIcon name={h.name} size={10} />}
                </div>
              ))}</div>
            </button>
            <button onClick={() => setPanel('reminders')} className="bento-card bg-peach-light text-peach-dark rounded-2xl p-4 text-left min-h-[120px] flex flex-col">
              <Bell size={26} className="mb-2 opacity-85" />
              <span className="font-bold text-[15px]">Reminders</span>
              <span className="text-xs opacity-70">{pend.length} pending</span>
              <div className="flex flex-col gap-1 mt-2">{pend.slice(0, 2).map(r => <div key={r.id} className="flex items-center gap-2 text-xs font-medium"><div className="w-1.5 h-1.5 rounded-full bg-peach-dark shrink-0" /><span className="truncate">{r.title}</span></div>)}</div>
            </button>
            <button onClick={() => setPanel('chat')} className="bento-card col-span-2 bg-vida-cream text-vida-text rounded-2xl p-4 flex items-center gap-3 min-h-[72px]">
              <Star size={32} className="shrink-0 opacity-50" />
              <div className="text-left"><div className="font-bold text-[17px]">Talk to Vida</div><div className="text-xs text-vida-secondary">Set reminders, log habits, ask anything</div></div>
              <ArrowRight size={20} className="ml-auto opacity-30 shrink-0" />
            </button>
            <button onClick={() => setPanel('upcoming')} className="bento-card bg-lavender-light text-lavender-dark rounded-2xl p-4 text-left min-h-[110px] flex flex-col">
              <Calendar size={26} className="mb-2 opacity-85" />
              <span className="font-bold text-[15px]">Upcoming</span>
              <div className="flex flex-col gap-1 mt-1.5">{data.events.slice(0, 2).map(e => <div key={e.id} className="flex items-center gap-1.5 text-[11px]"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${e.type === 'birthday' ? 'bg-lavender text-lavender-dark' : 'bg-sky text-sky-dark'}`}>{e.type === 'birthday' ? 'Bday' : 'Event'}</span><span className="truncate">{e.title}</span></div>)}</div>
            </button>
            <button onClick={() => setPanel('chat')} className="bento-card bg-mint-light text-mint-dark rounded-2xl p-4 text-left min-h-[110px] flex flex-col">
              <CreditCard size={26} className="mb-2 opacity-85" />
              <span className="font-bold text-[15px]">Spending</span>
              <span className="text-xs opacity-70">This month</span>
              <div className="flex flex-col gap-1.5 mt-2">
                {data.spending.map(s => (
                  <div key={s.cat} className="flex items-center gap-2 text-[11px] font-medium">
                    <span className="min-w-[44px]">{s.cat}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/50 overflow-hidden">
                      <div className="h-full rounded-full bg-mint-dark transition-all duration-500" style={{ width: `${Math.min(Math.round(s.amount / s.budget * 100), 100)}%` }} />
                    </div>
                    <span>R{s.amount}</span>
                  </div>
                ))}
              </div>
            </button>
            <button onClick={() => setPanel('chat')} className="bento-card col-span-2 bg-sky-light text-sky-dark rounded-2xl p-4 flex items-center gap-3 min-h-[68px]">
              <Sun size={28} className="shrink-0 opacity-75" />
              <div className="text-left"><div className="font-bold text-[15px]">Your weekend is free!</div><div className="text-xs opacity-70">Maybe plan a braai or games night?</div></div>
            </button>
          </div>
        </div>
      )}

      {/* CHAT */}
      {panel === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 mb-2">
            <div className="flex items-center gap-1.5 text-[11px] text-sage-dark font-semibold bg-sage-light px-3 py-1 rounded-full w-fit">
              <div className="w-1.5 h-1.5 rounded-full bg-sage-dark animate-pulse" />
              Vida AI · powered by Gemini
            </div>
            {data.messages.length > 0 && (
              <button onClick={newChat} className="flex items-center gap-1 text-[11px] font-semibold text-vida-muted hover:text-vida-secondary px-2.5 py-1 rounded-full hover:bg-vida-cream transition">
                <Plus size={12} />New chat
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-3 flex flex-col gap-2.5">
            {data.messages.map((m, i) => (
              <div key={i} className={`msg-pop max-w-[82%] ${m.role === 'user' ? 'self-end' : 'self-start'}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-vida-text text-vida-bg rounded-br-md' : 'bg-vida-warm text-vida-text rounded-bl-md shadow-sm'}`}
                  dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                <div className={`text-[10.5px] text-vida-muted mt-1 px-1 ${m.role === 'user' ? 'text-right' : ''}`}>{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
            {typing && <div className="self-start bg-vida-warm rounded-2xl rounded-bl-md shadow-sm px-5 py-3.5 flex gap-1.5 items-center"><div className="w-[7px] h-[7px] rounded-full bg-vida-muted typing-dot" /><div className="w-[7px] h-[7px] rounded-full bg-vida-muted typing-dot" /><div className="w-[7px] h-[7px] rounded-full bg-vida-muted typing-dot" /></div>}
            <div ref={chatEnd} />
          </div>
          <div className="px-4 pb-7 pt-2 shrink-0 relative">
            <div className="absolute top-0 left-0 right-0 h-6 -translate-y-full bg-gradient-to-t from-vida-bg to-transparent pointer-events-none" />
            <div className="flex items-end gap-1.5 bg-vida-warm border-[1.5px] border-vida-cream rounded-3xl px-4 py-1.5 shadow-sm focus-within:border-sage focus-within:ring-4 focus-within:ring-sage/25 transition">
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Talk to Vida..." rows={1} className="flex-1 bg-transparent text-[15px] py-2 resize-none outline-none min-h-[24px] max-h-[100px] placeholder:text-vida-muted" />
              <button onClick={voice} className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 ${recording ? 'bg-red-400 text-white rec-pulse' : 'text-vida-muted hover:text-vida-secondary'}`}><Mic size={16} /></button>
              <button onClick={send} disabled={!input.trim()} className="w-9 h-9 rounded-full bg-vida-text text-vida-bg flex items-center justify-center transition shrink-0 hover:scale-105 disabled:opacity-20"><Send size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* HABITS */}
      {panel === 'habits' && (
        <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-8 pt-1">
          <p className="text-xs font-semibold text-vida-muted uppercase tracking-wider mb-2">This week</p>
          {data.habits.map(h => { const c = CM[h.color] || CM.sage; return (
            <div key={h.id} className={`${c.light} ${c.dark} rounded-2xl p-4 mb-2.5`}>
              <div className="flex justify-between items-center">
                <span className="font-bold text-[15px] flex items-center gap-2"><span className="opacity-70"><HabitIcon name={h.name} size={16} /></span>{h.name}</span>
                {h.streak > 0 && <span className="text-[11px] font-bold bg-white/60 px-2.5 py-0.5 rounded-full flex items-center gap-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>{h.streak}d</span>}
              </div>
              <div className="flex gap-1.5 mt-3">{Array.from({ length: 7 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = d.toISOString().split('T')[0]; const f = h.log[k]; const day = d.toLocaleDateString('en-ZA', { weekday: 'short' }).charAt(0); return (
                <button key={k} onClick={() => toggleHabitDay(h.id, k)} className={`flex-1 h-8 rounded-[10px] flex items-center justify-center text-[10px] font-semibold transition active:scale-90 ${f ? c.df : c.de} ${i === 6 ? 'ring-2 ring-vida-text/20 ring-offset-1' : ''}`}>{f ? <Check size={12} strokeWidth={3} /> : day}</button>
              ); })}</div>
            </div>
          ); })}
          <button onClick={() => openAddForm('habit')} className="w-full border-2 border-dashed border-vida-muted/25 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-vida-muted hover:border-vida-muted/50 hover:text-vida-secondary transition mt-1">
            <Plus size={15} /> New habit
          </button>
        </div>
      )}

      {/* REMINDERS */}
      {panel === 'reminders' && (
        <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-8 pt-1">
          {[
            { label: 'Today', items: data.reminders.filter(r => r.date === today) },
            { label: 'Upcoming', items: data.reminders.filter(r => r.date > today && !r.done).sort((a, b) => a.date.localeCompare(b.date)) },
            { label: 'Done', items: data.reminders.filter(r => r.done) },
          ].map(g => g.items.length > 0 && (
            <div key={g.label}>
              <p className="text-xs font-semibold text-vida-muted uppercase tracking-wider mb-2 mt-3 first:mt-0">{g.label}</p>
              {g.items.map(r => (
                <div key={r.id} className={`flex items-center gap-3 bg-vida-warm rounded-2xl p-3.5 mb-2 shadow-sm transition hover:translate-x-0.5 ${r.done ? 'opacity-40' : ''}`}>
                  <button onClick={() => toggleReminder(r.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs shrink-0 transition ${r.done ? 'border-sage bg-sage text-sage-dark' : 'border-vida-muted hover:border-sage-dark'}`}>{r.done && <Check size={12} />}</button>
                  <div className="flex-1 min-w-0"><div className={`font-semibold text-sm truncate ${r.done ? 'line-through' : ''}`}>{r.title}</div><div className="text-xs text-vida-muted mt-0.5">{fd(r.date)}{r.time ? ` · ${ft(r.time)}` : ''}</div></div>
                </div>
              ))}
            </div>
          ))}
          {data.reminders.length === 0 && <div className="text-center py-10 text-vida-muted"><div className="flex justify-center mb-2 opacity-40"><Bell size={36} strokeWidth={1.5} /></div><div className="text-sm">No reminders yet — try &quot;Remind me to...&quot; in chat!</div></div>}
          <button onClick={() => openAddForm('reminder')} className="w-full border-2 border-dashed border-vida-muted/25 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-vida-muted hover:border-vida-muted/50 hover:text-vida-secondary transition mt-1">
            <Plus size={15} /> New reminder
          </button>
        </div>
      )}

      {/* UPCOMING */}
      {panel === 'upcoming' && (
        <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-8 pt-1">
          <p className="text-xs font-semibold text-vida-muted uppercase tracking-wider mb-2">Coming up</p>
          {[...data.events].sort((a, b) => a.date.localeCompare(b.date)).map(e => (
            <div key={e.id} className={`rounded-2xl p-4 mb-2 ${e.type === 'birthday' ? 'bg-lavender-light text-lavender-dark' : e.type === 'appointment' ? 'bg-peach-light text-peach-dark' : 'bg-sky-light text-sky-dark'}`}>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">{fd(e.date)}</div>
              <div className="font-semibold text-[15px] mt-0.5">{e.title}</div>
              {e.detail && <div className="text-xs opacity-65 mt-0.5">{e.detail}</div>}
            </div>
          ))}
          {data.events.length === 0 && <div className="text-center py-10 text-vida-muted"><div className="flex justify-center mb-2 opacity-40"><Calendar size={36} strokeWidth={1.5} /></div><div className="text-sm">No events yet!</div></div>}
          <button onClick={() => openAddForm('event')} className="w-full border-2 border-dashed border-vida-muted/25 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-vida-muted hover:border-vida-muted/50 hover:text-vida-secondary transition mt-1">
            <Plus size={15} /> New event
          </button>
        </div>
      )}

      {/* ADD FORM MODAL */}
      {addForm && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-vida-text/20 backdrop-blur-sm" onClick={() => setAddForm(null)}>
          <div className="bg-vida-bg rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl border-t border-vida-cream" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-vida-muted/30 rounded-full mx-auto mb-4" />
            {addForm === 'reminder' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[17px] font-bold">Add Reminder</h2>
                  <button onClick={() => setAddForm(null)} className="w-8 h-8 rounded-full bg-vida-cream flex items-center justify-center text-vida-muted hover:text-vida-secondary transition"><X size={16} /></button>
                </div>
                <input
                  className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-3 transition placeholder:text-vida-muted"
                  placeholder="What do you need to remember?"
                  value={rf.title} onChange={e => setRf(p => ({ ...p, title: e.target.value }))}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') submitReminder(); }}
                />
                <div className="flex gap-2 mb-4">
                  <input type="date" className="flex-1 bg-vida-warm border border-vida-cream rounded-2xl px-3 py-3 text-[14px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition text-vida-text" value={rf.date} onChange={e => setRf(p => ({ ...p, date: e.target.value }))} />
                  <input type="time" className="flex-1 bg-vida-warm border border-vida-cream rounded-2xl px-3 py-3 text-[14px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition text-vida-text" value={rf.time} onChange={e => setRf(p => ({ ...p, time: e.target.value }))} />
                </div>
                <button onClick={submitReminder} disabled={!rf.title.trim() || !rf.date} className="w-full bg-vida-text text-vida-bg rounded-2xl py-3.5 text-[15px] font-bold transition hover:opacity-90 disabled:opacity-30">Add Reminder</button>
              </>
            )}
            {addForm === 'habit' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[17px] font-bold">New Habit</h2>
                  <button onClick={() => setAddForm(null)} className="w-8 h-8 rounded-full bg-vida-cream flex items-center justify-center text-vida-muted hover:text-vida-secondary transition"><X size={16} /></button>
                </div>
                <input
                  className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-4 transition placeholder:text-vida-muted"
                  placeholder="e.g. Meditate, Run, Drink water..."
                  value={hf.name} onChange={e => setHf(p => ({ ...p, name: e.target.value }))}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') submitHabit(); }}
                />
                <button onClick={submitHabit} disabled={!hf.name.trim()} className="w-full bg-vida-text text-vida-bg rounded-2xl py-3.5 text-[15px] font-bold transition hover:opacity-90 disabled:opacity-30">Create Habit</button>
              </>
            )}
            {addForm === 'event' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[17px] font-bold">Add Event</h2>
                  <button onClick={() => setAddForm(null)} className="w-8 h-8 rounded-full bg-vida-cream flex items-center justify-center text-vida-muted hover:text-vida-secondary transition"><X size={16} /></button>
                </div>
                <input
                  className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-3 transition placeholder:text-vida-muted"
                  placeholder="What's the event?"
                  value={ef.title} onChange={e => setEf(p => ({ ...p, title: e.target.value }))}
                  autoFocus
                />
                <div className="flex gap-2 mb-3">
                  <input type="date" className="flex-1 bg-vida-warm border border-vida-cream rounded-2xl px-3 py-3 text-[14px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition text-vida-text" value={ef.date} onChange={e => setEf(p => ({ ...p, date: e.target.value }))} />
                  <select className="flex-1 bg-vida-warm border border-vida-cream rounded-2xl px-3 py-3 text-[14px] outline-none focus:border-sage transition text-vida-text" value={ef.type} onChange={e => setEf(p => ({ ...p, type: e.target.value as 'birthday' | 'event' | 'appointment' }))}>
                    <option value="event">Event</option>
                    <option value="appointment">Appointment</option>
                    <option value="birthday">Birthday</option>
                  </select>
                </div>
                <input
                  className="w-full bg-vida-warm border border-vida-cream rounded-2xl px-4 py-3 text-[14px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 mb-4 transition placeholder:text-vida-muted"
                  placeholder="Details (optional)"
                  value={ef.detail} onChange={e => setEf(p => ({ ...p, detail: e.target.value }))}
                />
                <button onClick={submitEvent} disabled={!ef.title.trim() || !ef.date} className="w-full bg-vida-text text-vida-bg rounded-2xl py-3.5 text-[15px] font-bold transition hover:opacity-90 disabled:opacity-30">Add Event</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
