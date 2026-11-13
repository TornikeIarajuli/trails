import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Older deployments stored the service-role key under a NEXT_PUBLIC_ name. It is still
// accepted so they keep working, but it is looked up by a computed name at runtime: a literal
// process.env.NEXT_PUBLIC_* reference would be inlined into the build output.
const LEGACY_KEY_NAME = ['NEXT_PUBLIC', 'SUPABASE_SERVICE_ROLE_KEY'].join('_');
let warnedAboutLegacyKey = false;

export function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function getServiceRoleKey(): string | undefined {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;

  const legacy = process.env[LEGACY_KEY_NAME];
  if (!legacy) return undefined;

  if (!warnedAboutLegacyKey) {
    warnedAboutLegacyKey = true;
    console.warn(
      `The Supabase service-role key was read from ${LEGACY_KEY_NAME}. Rename that variable to ` +
        'SUPABASE_SERVICE_ROLE_KEY: the NEXT_PUBLIC_ prefix marks a value as safe to ship to browsers.',
    );
  }
  return legacy;
}

// Admin Supabase client (server-only — uses service role key, bypasses RLS)
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();

  if (!url || !key) {
    throw new Error(`Missing Supabase env vars. URL: ${!!url}, Key: ${!!key}`);
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
