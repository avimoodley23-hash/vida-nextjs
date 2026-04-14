import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const GOOGLE_SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/tasks',
].join(' ');

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { scope: GOOGLE_SCOPES, access_type: 'offline', prompt: 'consent' },
      },
    }),
    // Second Google provider for work account
    Google({
      id: 'google-work',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { scope: GOOGLE_SCOPES, access_type: 'offline', prompt: 'select_account consent' },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, trigger, session }) {
      if (account?.provider === 'google') {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      } else if (account?.provider === 'google-work') {
        // Add work account without touching personal token
        token.workAccessToken = account.access_token;
        // profile.email is the work account email
        if (profile?.email) token.workEmail = profile.email;
      }
      // Handle disconnect work account (called via useSession().update())
      if (trigger === 'update' && (session as { clearWork?: boolean } | null)?.clearWork) {
        delete token.workAccessToken;
        delete token.workEmail;
      }
      return token;
    },
    async session({ session, token }) {
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
      (session as unknown as Record<string, unknown>).workAccessToken = token.workAccessToken;
      (session as unknown as Record<string, unknown>).workEmail = token.workEmail;
      return session;
    },
  },
});
