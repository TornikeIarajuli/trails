import { createClient } from '@supabase/supabase-js';

// Admin Supabase client (server-only — uses service role key, bypasses RLS)
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(`Missing Supabase env vars. URL: ${!!url}, Key: ${!!key}`);
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
