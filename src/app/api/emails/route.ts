import { NextRequest, NextResponse } from 'next/server';
import { getBankTransactions } from '@/lib/gmail';

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 });
  }
  try {
    const transactions = await getBankTransactions(accessToken);
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Bank email API error:', error);
    return NextResponse.json({ error: 'Failed to fetch bank emails' }, { status: 500 });
  }
}
