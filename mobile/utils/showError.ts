import { Alert } from 'react-native';

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = 'Could not reach the server. Check your connection and try again.';
const RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment and try again.';

type HttpLikeError = {
  isAxiosError?: boolean;
  code?: string;
  message?: string;
  response?: { status?: number; data?: { message?: unknown } };
};

/** True when the request never got an HTTP response (offline, DNS failure, timeout). */
export function isNetworkError(err: unknown): boolean {
  const e = err as HttpLikeError | null | undefined;
  if (!e || e.response) return false;
  return (
    e.code === 'ERR_NETWORK' ||
    e.code === 'ECONNABORTED' ||
    e.code === 'ETIMEDOUT' ||
    e.message === 'Network Error' ||
    e.message === 'Network request failed'
  );
}

export function getErrorStatus(err: unknown): number | undefined {
  const status = (err as HttpLikeError | null | undefined)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

export function getErrorMessage(err: unknown, fallback = DEFAULT_MESSAGE): string {
  const e = err as HttpLikeError | null | undefined;

  if (getErrorStatus(err) === 429) return RATE_LIMIT_MESSAGE;

  // NestJS validation errors send `message` as an array of strings
  const raw = e?.response?.data?.message;
  if (Array.isArray(raw)) {
    const joined = raw.filter((m): m is string => typeof m === 'string' && m.length > 0).join('\n');
    if (joined) return joined;
  } else if (typeof raw === 'string' && raw) {
    return raw;
  }

  if (isNetworkError(err)) return NETWORK_MESSAGE;

  // Axios' own messages ("Request failed with status code 500") are not meant for users
  if (e && !e.isAxiosError && !e.response && typeof e.message === 'string' && e.message) {
    return e.message;
  }

  return fallback;
}

export function showError(err: unknown, fallback = DEFAULT_MESSAGE) {
  Alert.alert('Error', getErrorMessage(err, fallback));
}
