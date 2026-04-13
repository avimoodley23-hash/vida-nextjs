import { google } from 'googleapis';

export async function getRecentEmails(accessToken: string, maxResults = 8) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'in:inbox -category:promotions -category:social',
    });

    const messages = list.data.messages || [];
    const summaries: { from: string; subject: string; date: string }[] = [];

    for (const msg of messages.slice(0, maxResults)) {
      if (!msg.id) continue;
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const headers = detail.data.payload?.headers || [];
      const get = (name: string) => headers.find(h => h.name === name)?.value || '';
      // Strip email address, keep display name only
      const rawFrom = get('From');
      const fromName = rawFrom.replace(/<[^>]+>/g, '').trim() || rawFrom;
      summaries.push({
        from: fromName,
        subject: get('Subject'),
        date: get('Date'),
      });
    }

    return summaries;
  } catch (error) {
    console.error('Gmail fetch error:', error);
    return [];
  }
}
