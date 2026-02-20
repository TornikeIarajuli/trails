import { create } from 'zustand';
import axios from 'axios';
import { storage } from '../utils/storage';
import { Config } from '../constants/config';

interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    username: string;
    full_name?: string;
    role?: string;
  };
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,

  setSession: (user, accessToken, refreshToken) => {
    storage.setAccessToken(accessToken);
    storage.setRefreshToken(refreshToken);
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      isAdmin: user.user_metadata?.role === 'admin',
    });
  },

  clearSession: () => {
    storage.clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isAdmin: false,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  restoreSession: async () => {
    try {
      const refreshToken = await storage.getRefreshToken();

      if (!refreshToken) {
        set({ isLoading: false });
        return;
      }

      // Always refresh on app open — access tokens expire in 1 hour,
      // this gets fresh tokens + user data without requiring re-login.
      const { data } = await axios.post(
        `${Config.API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: 10000 },
      );

      const newAccessToken = data.session?.access_token;
      const newRefreshToken = data.session?.refresh_token;
      const user = data.user as AuthUser;

      if (newAccessToken && newRefreshToken && user) {
        await storage.setAccessToken(newAccessToken);
        await storage.setRefreshToken(newRefreshToken);
        set({
          user,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          isAuthenticated: true,
          isAdmin: user.user_metadata?.role === 'admin',
          isLoading: false,
        });
      } else {
        // Unexpected response shape — sign out cleanly
        await storage.clearTokens();
        set({ isLoading: false });
      }
    } catch {
      // Refresh token expired or network error.
      // If network error: fall back to stored tokens so user isn't signed out offline.
      try {
        const accessToken = await storage.getAccessToken();
        const refreshToken = await storage.getRefreshToken();
        if (accessToken && refreshToken) {
          // Keep them signed in with potentially stale tokens;
          // the API interceptor will handle 401s when requests are made.
          set({ accessToken, refreshToken, isAuthenticated: true, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } catch {
        set({ isLoading: false });
      }
    }
  },
}));
