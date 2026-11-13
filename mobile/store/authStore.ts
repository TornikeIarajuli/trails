import { create } from 'zustand';
import axios from 'axios';
import { storage, StoredUser } from '../utils/storage';
import { Config } from '../constants/config';
import { queryClient } from '../utils/queryClient';

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    username: string;
    full_name?: string;
  };
  /** Set by the server only; this is what the backend authorises admins on. */
  app_metadata?: {
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

/** `refreshed`: new tokens are in the store. `signed-out`: the server rejected the refresh token. `failed`: could not tell — the session is kept. */
export type RefreshOutcome = 'refreshed' | 'signed-out' | 'failed';

const REFRESH_TIMEOUT_MS = 15000;

const isAdminUser = (user: AuthUser | null) => user?.app_metadata?.role === 'admin';

function toStoredUser(user: AuthUser): StoredUser {
  return {
    id: user.id,
    email: user.email,
    username: user.user_metadata?.username ?? '',
    full_name: user.user_metadata?.full_name ?? null,
    role: user.app_metadata?.role ?? null,
  };
}

function fromStoredUser(stored: StoredUser): AuthUser {
  return {
    id: stored.id,
    email: stored.email,
    user_metadata: {
      username: stored.username,
      ...(stored.full_name ? { full_name: stored.full_name } : {}),
    },
    app_metadata: stored.role ? { role: stored.role } : {},
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,

  setSession: (user, accessToken, refreshToken) => {
    storage.setAccessToken(accessToken).catch(() => {});
    storage.setRefreshToken(refreshToken).catch(() => {});
    storage.setUser(toStoredUser(user)).catch(() => {});
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      isAdmin: isAdminUser(user),
    });
  },

  clearSession: () => {
    storage.clearSession().catch(() => {});
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isAdmin: false,
    });
    // Cached answers belong to the account that just ended
    queryClient.clear();
  },

  setLoading: (isLoading) => set({ isLoading }),

  restoreSession: async () => {
    try {
      const [accessToken, refreshToken, storedUser] = await Promise.all([
        storage.getAccessToken(),
        storage.getRefreshToken(),
        storage.getUser(),
      ]);
      if (!refreshToken) return;

      const user = storedUser ? fromStoredUser(storedUser) : null;
      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: !!accessToken,
        isAdmin: isAdminUser(user),
      });

      if (accessToken && user) {
        // Everything needed is on the device: open the app now instead of waiting for
        // the server (it may be asleep, or there may be no connection at all). The
        // refresh still runs, and signs the user out only if the server says so.
        set({ isLoading: false });
        void refreshSession();
        return;
      }

      // Saved by a version that did not keep the user: it has to come from the server.
      // If that fails for any reason but a rejected token, the tokens above stay in place.
      await refreshSession();
    } catch {
      // Secure storage could not be read: start signed out
    } finally {
      set({ isLoading: false });
    }
  },
}));

let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function requestRefresh(): Promise<RefreshOutcome> {
  const sentToken = useAuthStore.getState().refreshToken;
  if (!sentToken) return 'failed';

  // The session may end or be replaced (sign-out, another sign-in) while the request is on its way
  const stillCurrent = () => useAuthStore.getState().refreshToken === sentToken;

  try {
    const { data } = await axios.post(
      `${Config.API_BASE_URL}/auth/refresh`,
      { refresh_token: sentToken },
      { timeout: REFRESH_TIMEOUT_MS },
    );

    const accessToken: string | undefined = data?.session?.access_token;
    const refreshToken: string | undefined = data?.session?.refresh_token;
    const user: AuthUser | null = data?.user ?? useAuthStore.getState().user;
    if (!stillCurrent() || !accessToken || !refreshToken || !user) return 'failed';

    useAuthStore.getState().setSession(user, accessToken, refreshToken);
    return 'refreshed';
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    // Only an explicit rejection of the token ends the session. A timeout, no
    // connection or a server error says nothing about whether the token is valid.
    if ((status === 401 || status === 403) && stillCurrent()) {
      useAuthStore.getState().clearSession();
      return 'signed-out';
    }
    return 'failed';
  }
}

/**
 * Exchanges the refresh token for a new session. Every caller that arrives
 * while a refresh is running shares it, so the token is never spent twice.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = requestRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
