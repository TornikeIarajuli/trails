import axios from 'axios';
import { Config } from '../constants/config';
import { storage } from '../utils/storage';
import { useAuthStore } from '../store/authStore';

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
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

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
    }

    return Promise.reject(error);
  },
);

export default api;
