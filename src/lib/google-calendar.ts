import { google } from 'googleapis';

export function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth });
}

export async function getUpcomingEvents(accessToken: string, days: number = 14) {
  const calendar = getCalendarClient(accessToken);
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (res.data.items || []).map((event) => ({
      id: event.id || '',
      title: event.summary || 'Untitled',
      date: event.start?.date || event.start?.dateTime?.split('T')[0] || '',
      time: event.start?.dateTime?.split('T')[1]?.substring(0, 5) || undefined,
      type: 'event' as const,
      detail: event.location || event.description || undefined,
      googleEventId: event.id || undefined,
    }));
  } catch (error) {
    console.error('Calendar fetch error:', error);
    return [];
  }
}

export async function createCalendarEvent(
  accessToken: string,
  params: {
    title: string;
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM
    duration?: number; // minutes, default 60
    description?: string;
  }
) {
  const calendar = getCalendarClient(accessToken);
  const { title, date, time, duration = 60, description } = params;

  let start: { dateTime?: string; date?: string; timeZone?: string };
  let end: { dateTime?: string; date?: string; timeZone?: string };

  if (time) {
    const startDt = `${date}T${time}:00`;
    const endDate = new Date(`${date}T${time}:00`);
    endDate.setMinutes(endDate.getMinutes() + duration);
    const endDt = endDate.toISOString().replace('Z', '');
    
    start = { dateTime: startDt, timeZone: 'Africa/Johannesburg' };
    end = { dateTime: endDt.substring(0, 19), timeZone: 'Africa/Johannesburg' };
  } else {
    start = { date };
    end = { date };
  }

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        description: description || `Created by Vida`,
        start,
        end,
      },
    });

    return {
      success: true,
      eventId: res.data.id,
      htmlLink: res.data.htmlLink,
    };
  } catch (error) {
    console.error('Calendar create error:', error);
    return { success: false, eventId: null, htmlLink: null };
  }
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<boolean> {
  const calendar = getCalendarClient(accessToken);
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch (error) {
    console.error('Calendar delete error:', error);
    return false;
  }
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  params: { title?: string; date?: string; time?: string; description?: string }
): Promise<{ success: boolean }> {
  const calendar = getCalendarClient(accessToken);
  try {
    const existing = await calendar.events.get({ calendarId: 'primary', eventId });
    const patch: Record<string, unknown> = {};
    if (params.title) patch.summary = params.title;
    if (params.description) patch.description = params.description;
    if (params.date) {
      const { time } = params;
      if (time) {
        const startDt = `${params.date}T${time}:00`;
        const endDate = new Date(`${params.date}T${time}:00`);
        endDate.setMinutes(endDate.getMinutes() + 60);
        patch.start = { dateTime: startDt, timeZone: 'Africa/Johannesburg' };
        patch.end = { dateTime: endDate.toISOString().substring(0, 19), timeZone: 'Africa/Johannesburg' };
      } else if (existing.data.start?.date) {
        patch.start = { date: params.date };
        patch.end = { date: params.date };
      }
    }
    await calendar.events.patch({ calendarId: 'primary', eventId, requestBody: patch });
    return { success: true };
  } catch (error) {
    console.error('Calendar update error:', error);
    return { success: false };
  }
}

export async function getBirthdays(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const people = google.people({ version: 'v1', auth });

  try {
    const res = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 200,
      personFields: 'names,birthdays',
    });

    const contacts = res.data.connections || [];
    const birthdays: { name: string; date: string; month: number; day: number }[] = [];

    for (const contact of contacts) {
      const name = contact.names?.[0]?.displayName;
      const bday = contact.birthdays?.[0]?.date;
      if (name && bday?.month && bday?.day) {
        const year = new Date().getFullYear();
        const dateStr = `${year}-${String(bday.month).padStart(2, '0')}-${String(bday.day).padStart(2, '0')}`;
        birthdays.push({
          name,
          date: dateStr,
          month: bday.month,
          day: bday.day,
        });
      }
    }

    return birthdays;
  } catch (error) {
    console.error('Contacts fetch error:', error);
    return [];
  }
}
