# Vida — Your Life, Handled ✦

Personal AI assistant PWA powered by **Gemini AI** with **Google Calendar** and **Contacts** integration.

## What Vida Does

Talk naturally — via text or voice — and it handles everything:

- **Reminders** → "Remind me to call the plumber Friday at 3pm" → syncs to Google Calendar
- **Habits** → "I went to the gym" → logs with streak tracking
- **Events** → "Sarah's birthday is June 15" → tracks + reminds you to buy a gift
- **Spending** → "Spent R450 at Woolies" → auto-categorises, tracks monthly
- **Schedule** → "What's my week look like?" → pulls from Google Calendar
- **Proactive nudges** → Birthday coming up? Free weekend? Vida tells you first

## Setup (15 minutes)

### 1. Install
```bash
npm install
cp .env.example .env
```

### 2. Get a Gemini API key (free)
Go to https://aistudio.google.com/apikey → Create API Key → copy it

### 3. Set up Google OAuth
1. Go to https://console.cloud.google.com → Create project
2. Enable: **Google Calendar API** + **People API**
3. Create OAuth 2.0 Client (Web app)
4. Redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID + Secret

### 4. Fill in .env
```env
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GEMINI_API_KEY=your_key
NEXTAUTH_SECRET=run_openssl_rand_-base64_32
NEXTAUTH_URL=http://localhost:3000
```

### 5. Run
```bash
npm run dev
```

## iPhone Setup
1. Deploy to Vercel → `npx vercel`
2. Open URL in Safari → Share → Add to Home Screen
3. Calendar events sync automatically to iPhone calendar

## Stack
Next.js 16 · Gemini 2.5 Flash · Google Calendar API · People API · NextAuth · Tailwind · Web Speech API
