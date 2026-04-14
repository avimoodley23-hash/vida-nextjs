import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  if (!_client) {
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return _client;
}
