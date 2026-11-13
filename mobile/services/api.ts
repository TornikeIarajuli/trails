import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Config } from '../constants/config';
import { refreshSession, useAuthStore } from '../store/authStore';

declare module 'axios' {
  // The type parameter has to be repeated for the declarations to merge
  export interface AxiosRequestConfig<D = any> {
    /** Reject a 401 as it is instead of refreshing the session and retrying. */
    skipAuthRefresh?: boolean;
  }
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Answers that a moment's wait can fix. 429 is not one of them: the rate limit
// will not have reset a second or two later, and retrying only extends it.
const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504]);

// Only requests that are safe to repeat are retried on their own. A POST, PATCH,
// PUT or DELETE that timed out may well have reached the server, and sending it
// again would repeat it (or, for a toggle, undo it).
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options']);

type RequestConfig = InternalAxiosRequestConfig & {
  _authRetried?: boolean;
  _retryCount?: number;
};

const api = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token to every request
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function bearerOf(config: InternalAxiosRequestConfig): string | null {
  const header = config.headers?.Authorization;
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
}

// 401 → refresh the session once and repeat the request.
// Transient failures of idempotent requests → retry with a short delay.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RequestConfig | undefined;

    if (!request) return Promise.reject(error);

    const status = error.response?.status;

    if (status === 401) {
      if (request._authRetried || request.skipAuthRefresh) return Promise.reject(error);
      request._authRetried = true;

      const auth = useAuthStore.getState();
      if (!auth.refreshToken) return Promise.reject(error);

      // Another request may have refreshed the session while this one was on its way
      const alreadyRefreshed = !!auth.accessToken && auth.accessToken !== bearerOf(request);
      if (!alreadyRefreshed && (await refreshSession()) !== 'refreshed') {
        // Signed out by the refresh, or the refresh itself could not be completed:
        // either way this request cannot be repeated now.
        return Promise.reject(error);
      }

      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) return Promise.reject(error);
      request.headers.Authorization = `Bearer ${accessToken}`;
      return api(request);
    }

    const retryCount = request._retryCount ?? 0;
    const isNetworkError = !error.response && error.code !== 'ERR_CANCELED';
    const isRetryableStatus = status !== undefined && RETRYABLE_STATUS.has(status);
    const isIdempotent = IDEMPOTENT_METHODS.has((request.method ?? 'get').toLowerCase());

    if (isIdempotent && retryCount < MAX_RETRIES && (isNetworkError || isRetryableStatus)) {
      request._retryCount = retryCount + 1;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (retryCount + 1)));
      return api(request);
    }

    return Promise.reject(error);
  },
);

export default api;
