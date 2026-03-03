import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notifications';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../utils/queryKeys';

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

export function useNotificationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated || isExpoGo || !Notifications) return;

    // Register push token with backend
    registerForPushNotifications().then((token) => {
      if (token) {
        notificationsService.registerToken(token).catch(() => {});
      }
    });

    // Handle notification taps
    try {
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data;
          if (data?.type === 'new_follower' && data.followerId) {
            router.push(`/trail/user/${data.followerId}`);
          } else if (data?.type === 'badge_earned') {
            router.push('/(tabs)/profile/badges');
          }
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
