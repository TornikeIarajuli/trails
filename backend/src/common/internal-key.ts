import { createHash, timingSafeEqual } from 'crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Constant-time string comparison (hashing first makes the lengths equal). */
export function safeEqual(provided: string, expected: string): boolean {
  return timingSafeEqual(digest(provided), digest(expected));
}

const headerValue = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Authorises server-to-server calls (contract C8): `x-internal-key` must equal
 * INTERNAL_API_KEY, or - for admin panels deployed before that variable existed - the
 * legacy `x-service-key` must equal SUPABASE_SERVICE_ROLE_KEY.
 */
export function isAuthorizedInternalCall(
  headers: Record<string, string | string[] | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const internalKey = env.INTERNAL_API_KEY;
  const provided = headerValue(headers['x-internal-key']);
  if (internalKey && provided && safeEqual(provided, internalKey)) {
    return true;
  }

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const legacy = headerValue(headers['x-service-key']);
  return !!(serviceKey && legacy && safeEqual(legacy, serviceKey));
}
