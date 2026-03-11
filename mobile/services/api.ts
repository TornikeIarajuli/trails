import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Config } from '../constants/config';
import { storage } from '../utils/storage';
import { useAuthStore } from '../store/authStore';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Status codes that are safe to retry (transient errors)
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

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

// Handle 401 responses: try to refresh token
// Retry transient failures (network errors, 5xx, 429)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _retryCount?: number;
    };

    if (!originalRequest) return Promise.reject(error);

    // 401 → token refresh (existing logic)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${Config.API_BASE_URL}/auth/refresh`,
            { refresh_token: refreshToken },
          );

          const newAccessToken = data.session.access_token;
          const newRefreshToken = data.session.refresh_token;

          useAuthStore.getState().setSession(
            data.user,
            newAccessToken,
            newRefreshToken,
          );

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().clearSession();
        }
      }
      return Promise.reject(error);
    }

    // Retry logic for transient failures (only GET/HEAD are idempotent by default,
    // but we also retry POST/PUT/PATCH/DELETE on network errors with no response)
    const retryCount = originalRequest._retryCount ?? 0;
    const isNetworkError = !error.response && error.code !== 'ERR_CANCELED';
    const isRetryableStatus = error.response && RETRYABLE_STATUS.has(error.response.status);
    const isIdempotent = ['get', 'head', 'options'].includes(
      originalRequest.method?.toLowerCase() ?? '',
    );

    if (retryCount < MAX_RETRIES && (isNetworkError || (isRetryableStatus && isIdempotent))) {
      originalRequest._retryCount = retryCount + 1;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (retryCount + 1)));
      return api(originalRequest);
    }

    return Promise.reject(error);
  },
);

export default api;
