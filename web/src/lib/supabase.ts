import { createClient } from '@supabase/supabase-js';

// Admin Supabase client (server-only — uses service role key, bypasses RLS)
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
