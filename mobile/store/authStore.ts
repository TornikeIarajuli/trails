import { create } from 'zustand';
import { storage } from '../utils/storage';

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
    const accessToken = await storage.getAccessToken();
    const refreshToken = await storage.getRefreshToken();

    if (accessToken && refreshToken) {
      // We have tokens, mark as authenticated
      // The actual user data will be fetched by the profile query
      set({
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },
}));
