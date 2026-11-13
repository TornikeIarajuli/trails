import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'auth_user',
  PUSH_TOKEN: 'push_token',
} as const;

/** The part of the signed-in user that is kept on the device so a start without a connection still knows who it is. */
export interface StoredUser {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string | null;
}

export const storage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
  },

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  },

  async getUser(): Promise<StoredUser | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEYS.USER);
      const user = raw ? JSON.parse(raw) : null;
      return user && typeof user.id === 'string' ? (user as StoredUser) : null;
    } catch {
      return null;
    }
  },

  async setUser(user: StoredUser): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
  },

  /**
   * Removes everything that identifies the session. The push token is kept: it
   * belongs to the device. All deletes are issued at once, so a sign-in that
   * follows immediately cannot have its writes overtaken by them.
   */
  async clearSession(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.USER),
    ]);
  },

  /** The push token this device registered with the backend, so signing out can unregister it. */
  async getPushToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.PUSH_TOKEN);
  },

  async setPushToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.PUSH_TOKEN, token);
  },

  async clearPushToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.PUSH_TOKEN);
  },
};
