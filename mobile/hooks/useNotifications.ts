import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { notificationsService } from '../services/notifications';
import { useAuthStore } from '../store/authStore';

// expo-notifications remote push is not available in Expo Go (SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy-load expo-notifications to avoid module-level crashes on re-open
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  if (!isExpoGo && Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
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

export function useNotificationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const responseListener = useRef<any>();

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
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      } catch {}
    };
  }, [isAuthenticated]);
}
