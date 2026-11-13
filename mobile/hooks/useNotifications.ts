import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notifications';
import { useAuthStore } from '../store/authStore';
import { ALERTS_TAB_HREF, getNotificationTarget, mapLinks } from '../utils/notificationTarget';
import { queryKeys } from '../utils/queryKeys';
import { storage } from '../utils/storage';

// expo-notifications remote push is not available in Expo Go (SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy-load expo-notifications to avoid module-level crashes on re-open
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  if (!isExpoGo && Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch {}

async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo || !Device.isDevice || !Notifications) {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    return tokenData.data;
  } catch {
    return null;
  }
}

export function useNotificationList(page = 1) {
  return useQuery({
    queryKey: queryKeys.notifications.list(page),
    queryFn: () => notificationsService.getNotifications(page),
    staleTime: 30 * 1000, // 30 sec — notifications should feel near-real-time
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.root() }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.root() }),
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: queryKeys.notifications.prefs(),
    queryFn: () => notificationsService.getPreferences(),
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Parameters<typeof notificationsService.updatePreferences>[0]) =>
      notificationsService.updatePreferences(prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.prefs() }),
  });
}

async function openInMaps(lat: number, lng: number) {
  for (const url of mapLinks(lat, lng, Platform.OS)) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try the next link
    }
  }
}

/**
 * Shows the notification list (Alerts tab) and opens `href` on top of it, so Back
 * from the target lands on the list. Screens of the Alerts stack (badges) get the
 * list underneath through the stack's anchor; everything else is outside the tabs
 * and is pushed on the root stack after switching to the Alerts tab.
 */
function openOverAlerts(href: string) {
  if (href.startsWith(`${ALERTS_TAB_HREF}/`)) {
    router.push(href as any, { withAnchor: true });
    return;
  }
  router.navigate(ALERTS_TAB_HREF as any);
  router.push(href as any);
}

/**
 * Opens what a tapped push notification is about. Uses the same mapping as the
 * notification list (utils/notificationTarget), so both lead to the same place.
 */
export function navigateFromNotification(data: unknown) {
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const target = getNotificationTarget(null, payload);

  try {
    if (target.kind === 'route') {
      openOverAlerts(target.href);
    } else if (target.kind === 'sos') {
      // Someone asked for help: show where they are, or failing that who they are
      if (target.lat !== null && target.lng !== null) {
        void openInMaps(target.lat, target.lng);
        router.navigate(ALERTS_TAB_HREF as any);
      } else if (target.userId) {
        openOverAlerts(`/trail/user/${target.userId}`);
      }
    }
  } catch {
    // The navigator is not mounted yet; there is nowhere to go
  }
}

export function useNotificationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const responseListener = useRef<any>(null);
  const coldStartHandled = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isExpoGo || !Notifications) return;

    // Register push token with backend
    registerForPushNotifications().then((token) => {
      if (token) {
        notificationsService
          .registerToken(token)
          // Remembered so that signing out can unregister this device
          .then(() => storage.setPushToken(token))
          .catch(() => {});
      }
    });

    // Cold-start: app was opened by tapping a notification — handle it once
    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      try {
        Notifications.getLastNotificationResponseAsync().then((response) => {
          if (response) {
            navigateFromNotification(response.notification.request.content.data);
          }
        });
      } catch {}
    }

    // Foreground / background tap listener
    try {
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          navigateFromNotification(response.notification.request.content.data);
        },
      );
    } catch {}

    return () => {
      try {
        if (responseListener.current && Notifications) {
          responseListener.current?.remove();
        }
      } catch {}
    };
  }, [isAuthenticated]);
}
