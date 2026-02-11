import { createClient } from '@supabase/supabase-js';

// Admin Supabase client (uses service role key, bypasses RLS)
// Safe for internal admin panel — never expose this on a public site
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
