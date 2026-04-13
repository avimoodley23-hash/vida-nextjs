import { google } from 'googleapis';

function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export async function getRecentEmails(accessToken: string, maxResults = 10): Promise<EmailSummary[]> {
  const gmail = getGmailClient(accessToken);
  try {
    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'in:inbox -category:promotions -category:social',
    });
    const messages = list.data.messages || [];
    const summaries: EmailSummary[] = [];
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
      const rawFrom = get('From');
      const fromName = rawFrom.replace(/<[^>]+>/g, '').trim() || rawFrom;
      summaries.push({
        id: msg.id,
        from: fromName,
        subject: get('Subject'),
        date: get('Date'),
        snippet: detail.data.snippet || '',
      });
    }
    return summaries;
  } catch (error) {
    console.error('Gmail fetch error:', error);
    return [];
  }
}

// South African bank sender domains
const SA_BANK_DOMAINS = [
  'fnb.co.za', 'firstrand.co.za',
  'standardbank.co.za',
  'absa.co.za',
  'capitecbank.co.za', 'capitec.co.za',
  'nedbank.co.za',
  'discovery.co.za', 'discoverybank.co.za',
  'investec.co.za',
  'tymebank.co.za',
  'bankzero.co.za',
];

function isBankEmail(from: string): boolean {
  return SA_BANK_DOMAINS.some(d => from.toLowerCase().includes(d));
}

function parseRandAmount(text: string): number | null {
  // Match R 1,234.56 / R1234 / ZAR 123.00 / debited R50
  const patterns = [
    /R\s*(\d[\d\s,]*\.?\d{0,2})/i,
    /ZAR\s*(\d[\d\s,]*\.?\d{0,2})/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const cleaned = match[1].replace(/[\s,]/g, '');
      const amount = parseFloat(cleaned);
      if (!isNaN(amount) && amount > 0 && amount < 500_000) return amount;
    }
  }
  return null;
}

function categorizeBankTransaction(subject: string, snippet: string): string {
  const text = (subject + ' ' + snippet).toLowerCase();
  if (/grocery|checkers|pick n pay|woolworths food|spar|shoprite|restaurant|takeaway|mcd|kfc|steers|burger king|nandos|coffee|cafe/.test(text)) return 'Food';
  if (/uber|bolt|fuel|petrol|parking|toll|gautrain|taxi|bus/.test(text)) return 'Transport';
  if (/electricity|eskom|water|rates|dstv|netflix|showmax|insurance|premium|bond|rent/.test(text)) return 'Bills';
  if (/gym|virgin active|planet fitness|pharmacy|dis-chem|clicks|doctor|medical|dentist/.test(text)) return 'Health';
  if (/takealot|amazon|zara|mr price|h&m|woolworths|clothing|shop|store/.test(text)) return 'Shopping';
  if (/movie|event|game|cinema|bar|spotify|apple|music|entertainment/.test(text)) return 'Fun';
  return 'Other';
}

export interface BankTransaction {
  emailId: string;
  bank: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

export async function getBankTransactions(accessToken: string): Promise<BankTransaction[]> {
  const gmail = getGmailClient(accessToken);
  try {
    // Search bank emails from last 30 days
    const bankQuery = SA_BANK_DOMAINS.map(d => `from:${d}`).join(' OR ');
    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: `(${bankQuery}) newer_than:30d`,
    });
    const messages = list.data.messages || [];
    const transactions: BankTransaction[] = [];

    for (const msg of messages.slice(0, 15)) {
      if (!msg.id) continue;
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const headers = detail.data.payload?.headers || [];
        const get = (name: string) => headers.find(h => h.name === name)?.value || '';
        const from = get('From');
        const subject = get('Subject');
        const date = get('Date');
        const snippet = detail.data.snippet || '';

        if (!isBankEmail(from)) continue;

        // Only process debit/transaction notifications, not statements
        if (!/debit|purchase|payment|paid|transaction|spent|charged|withdraw/i.test(subject + snippet)) continue;

        const amount = parseRandAmount(subject + ' ' + snippet);
        if (!amount) continue;

        const category = categorizeBankTransaction(subject, snippet);
        const bank = from.toLowerCase().includes('fnb') || from.toLowerCase().includes('firstrand') ? 'FNB'
          : from.toLowerCase().includes('absa') ? 'ABSA'
          : from.toLowerCase().includes('standard') ? 'Standard Bank'
          : from.toLowerCase().includes('capitec') ? 'Capitec'
          : from.toLowerCase().includes('nedbank') ? 'Nedbank'
          : from.toLowerCase().includes('discovery') ? 'Discovery Bank'
          : from.toLowerCase().includes('investec') ? 'Investec'
          : 'Bank';

        transactions.push({
          emailId: msg.id,
          bank,
          amount,
          category,
          description: subject.slice(0, 80),
          date: (() => { try { return new Date(date).toISOString().split('T')[0]; } catch { return new Date().toISOString().split('T')[0]; } })(),
        });
      } catch { /* skip individual failures */ }
    }
    return transactions;
  } catch (error) {
    console.error('Bank transaction fetch error:', error);
    return [];
  }
}
