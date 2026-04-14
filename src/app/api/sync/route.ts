import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.email;
  const { data, error } = await supabase
    .from('vida_user_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found, which is fine for new users
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data?.data ?? null, updatedAt: data?.updated_at ?? null });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.email;
  const body = await req.json();

  const { error } = await supabase
    .from('vida_user_data')
    .upsert(
      { user_id: userId, data: body, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
