import { useMutation } from '@tanstack/react-query';
import { useAuthStore, AuthUser } from '../store/authStore';
import { useHikeStore } from '../store/hikeStore';
import { authService } from '../services/auth';
import { notificationsService } from '../services/notifications';
import { router } from 'expo-router';
import { identify, reset } from '../utils/analytics';
import { discardActiveHike } from '../utils/hikeSession';
import { queryClient } from '../utils/queryClient';
import { storage } from '../utils/storage';

/** The backend answers 403 with this code when the e-mail address has not been confirmed yet. */
export function isEmailNotConfirmed(error: unknown): boolean {
  const data = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data;
  return data?.code === 'EMAIL_NOT_CONFIRMED';
}

/** Starts a session for an account that just signed in, which may not be the one that used this phone last. */
export function startSession(user: AuthUser, accessToken: string, refreshToken: string) {
  // The cache may still hold the previous account's profile, bookmarks, completions…
  queryClient.clear();
  // …and a hike that account left running must not be finished under this one
  const hike = useHikeStore.getState();
  if (hike.isActive && hike.ownerId && hike.ownerId !== user.id) discardActiveHike();

  useAuthStore.getState().setSession(user, accessToken, refreshToken);
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      authService.login(data),
    onSuccess: (data) => {
      startSession(data.user, data.session.access_token, data.session.refresh_token);
      if (data.user) identify(data.user.id, { email: data.user.email });
      router.replace('/(tabs)/home');
    },
    onError: (error, variables) => {
      if (isEmailNotConfirmed(error)) {
        router.replace({ pathname: '/(auth)/verify-email', params: { email: variables.email } });
      }
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      username: string;
      full_name?: string;
    }) => authService.signup(data),
    onSuccess: (data, variables) => {
      if (data.session) {
        startSession(data.user, data.session.access_token, data.session.refresh_token);
        router.replace('/(tabs)/home');
      } else {
        // Email confirmation required
        router.replace({ pathname: '/(auth)/verify-email', params: { email: variables.email } });
      }
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
  });
}

/**
 * Tells the server this device is done with the session: its push token is
 * unregistered and the session revoked. Sent with the token of the session
 * being closed, because the local session is gone by the time these go out.
 */
async function closeRemoteSession(accessToken: string) {
  const request = {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000,
    skipAuthRefresh: true,
  };
  let pushToken: string | null = null;
  try {
    pushToken = await storage.getPushToken();
    // Forgotten before the slow request: an account that signs in meanwhile stores it again
    await storage.clearPushToken();
  } catch {
    // Secure storage unavailable: nothing to unregister
  }
  try {
    if (pushToken) await notificationsService.removeToken(pushToken, request);
  } catch {
    // Best effort: the token is also reassigned when the next account registers it
  }
  await authService.logout(request).catch(() => {});
}

export async function logout() {
  const { accessToken } = useAuthStore.getState();
  // Not awaited: signing out must work at once, with or without a connection
  if (accessToken) void closeRemoteSession(accessToken);

  reset();
  // Stops GPS tracking and drops the hike in progress. Hikes already waiting to
  // upload stay queued under their owner and go out when that account is back.
  discardActiveHike();
  useAuthStore.getState().clearSession();
  router.replace('/(auth)/login');
}
