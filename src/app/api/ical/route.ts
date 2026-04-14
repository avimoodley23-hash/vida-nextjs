import { NextRequest } from 'next/server';

function pad(n: number) { return String(n).padStart(2, '0'); }

function toICSDate(date: string, time?: string): string {
  // date = YYYY-MM-DD, time = HH:MM
  if (time) {
    const [y, m, d] = date.split('-');
    const [hh, mm] = time.split(':');
    return `${y}${m}${d}T${hh}${mm}00`;
  }
  return date.replace(/-/g, '');
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm + minutes);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get('title') || 'Event';
  const date = req.nextUrl.searchParams.get('date') || '';
  const time = req.nextUrl.searchParams.get('time') || '';
  const detail = req.nextUrl.searchParams.get('detail') || 'Created by Vida';

  if (!date) {
    return new Response('Missing date', { status: 400 });
  }

  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const uid = `vida-${Date.now()}@vida.app`;

  let dtStart: string;
  let dtEnd: string;
  let startLine: string;
  let endLine: string;

  if (time) {
    dtStart = toICSDate(date, time);
    dtEnd = addMinutes(date, time, 60);
    startLine = `DTSTART;TZID=Africa/Johannesburg:${dtStart}`;
    endLine = `DTEND;TZID=Africa/Johannesburg:${dtEnd}`;
  } else {
    dtStart = toICSDate(date);
    // For all-day, end = next day
    const [y, m, d] = date.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    dtEnd = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    startLine = `DTSTART;VALUE=DATE:${dtStart}`;
    endLine = `DTEND;VALUE=DATE:${dtEnd}`;
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vida//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(time ? [
      'BEGIN:VTIMEZONE',
      'TZID:Africa/Johannesburg',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0200',
      'TZNAME:SAST',
      'END:STANDARD',
      'END:VTIMEZONE',
    ] : []),
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    startLine,
    endLine,
    `SUMMARY:${title}`,
    `DESCRIPTION:${detail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const safeName = title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/ /g, '-');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}.ics"`,
    },
  });
}
