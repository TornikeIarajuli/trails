import * as Linking from 'expo-linking';

/**
 * The password-reset e-mail links to `mikiri-trails://reset-password` with the
 * outcome in the URL fragment: `#access_token=…&refresh_token=…&type=recovery`,
 * or `#error=…&error_code=…&error_description=…` when the link is no longer valid.
 * The router drops the fragment, so the screen reads it from the URL itself.
 */
export type RecoveryLink =
  | { kind: 'recovery'; accessToken: string; refreshToken: string | null }
  | { kind: 'error'; code: string | null; description: string | null };

const RESET_ROUTE = 'reset-password';

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parseParams(part: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of part.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const key = separator === -1 ? pair : pair.slice(0, separator);
    if (key) params[decode(key)] = separator === -1 ? '' : decode(pair.slice(separator + 1));
  }
  return params;
}

/** True when the URL points at the reset-password screen, whatever scheme delivered it. */
export function isResetPasswordUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const location = url.split(/[?#]/)[0];
  const afterScheme = location.includes('://') ? location.slice(location.indexOf('://') + 3) : location;
  // Expo Go serves the app below `<host>/--/`
  const path = afterScheme.includes('/--/') ? afterScheme.slice(afterScheme.indexOf('/--/') + 4) : afterScheme;
  return path.replace(/^\/+|\/+$/g, '').split('/').pop() === RESET_ROUTE;
}

/** Reads the outcome carried by a reset-password link; null when the URL carries none. */
export function parseRecoveryLink(url: string | null | undefined): RecoveryLink | null {
  if (!url || !isResetPasswordUrl(url)) return null;

  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  // Supabase puts the outcome in the fragment; some versions repeat an error in the query
  const params = {
    ...(queryAt === -1 ? {} : parseParams(beforeHash.slice(queryAt + 1))),
    ...(hashAt === -1 ? {} : parseParams(url.slice(hashAt + 1))),
  };

  if (params.error || params.error_code || params.error_description) {
    return {
      kind: 'error',
      code: params.error_code || params.error || null,
      description: params.error_description || null,
    };
  }
  if (params.access_token) {
    return {
      kind: 'recovery',
      accessToken: params.access_token,
      refreshToken: params.refresh_token || null,
    };
  }
  return null;
}

// The URL the app was last opened with stays readable for the life of the process,
// also after the user has left the reset screen. Two things are remembered about it:
// whether the reset screen has shown it (so launching the app again does not bring
// it back up), and whether it has been used up (password changed, or refused).
const seenUrls = new Set<string>();
const usedUrls = new Set<string>();

export function markRecoveryLinkSeen(url: string | null | undefined): void {
  if (url) seenUrls.add(url);
}

export function markRecoveryLinkUsed(url: string | null | undefined): void {
  if (url) usedUrls.add(url);
}

export function isRecoveryLinkUsed(url: string | null | undefined): boolean {
  return !!url && usedUrls.has(url);
}

/** A reset link the app was opened with that the reset screen has not shown yet. */
export function getPendingRecoveryUrl(): string | null {
  let url: string | null = null;
  try {
    url = Linking.getLinkingURL();
  } catch {
    return null;
  }
  return url && isResetPasswordUrl(url) && !seenUrls.has(url) ? url : null;
}
