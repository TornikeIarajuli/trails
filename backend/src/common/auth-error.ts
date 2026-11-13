import { ServiceUnavailableException } from '@nestjs/common';

/**
 * What an error returned by Supabase Auth means for the caller:
 *  - `invalid`      the credentials / token were rejected
 *  - `unconfirmed`  the credentials are right but the email address is not confirmed yet
 *  - `rate_limited` Supabase is throttling this client
 *  - `unavailable`  Supabase could not be reached or failed; says nothing about the token
 */
export type AuthFailure =
  | 'invalid'
  | 'unconfirmed'
  | 'rate_limited'
  | 'unavailable';

export interface AuthErrorLike {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
}

export const AUTH_UNAVAILABLE_MESSAGE =
  'Authentication service is unavailable. Please try again.';

export function classifyAuthError(error: AuthErrorLike): AuthFailure {
  if (
    error.code === 'email_not_confirmed' ||
    /email not confirmed/i.test(error.message ?? '')
  ) {
    return 'unconfirmed';
  }

  // auth-js: network failures and 502/503/504 answers
  if (error.name === 'AuthRetryableFetchError') return 'unavailable';
  // auth-js: the answer could not be parsed
  if (error.name === 'AuthUnknownError') return 'unavailable';

  if (error.status === 429) return 'rate_limited';
  if (typeof error.status === 'number' && error.status >= 500) {
    return 'unavailable';
  }

  return 'invalid';
}

/**
 * For token checks: answers 503 when Supabase Auth could not give a verdict.
 * Answering 401 instead would make the app refresh its session for nothing, and builds
 * that sign out on any failed refresh would log the user out during an outage.
 */
export function throwIfAuthUnavailable(
  error: AuthErrorLike | null | undefined,
): void {
  if (!error) return;
  const failure = classifyAuthError(error);
  if (failure === 'unavailable' || failure === 'rate_limited') {
    throw new ServiceUnavailableException(AUTH_UNAVAILABLE_MESSAGE);
  }
}
