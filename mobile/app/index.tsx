import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { getPendingRecoveryUrl } from '../utils/recoveryLink';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  const hydrated = useSettingsStore((s) => s._hydrated);

  // Only while this screen is the one on top: a deep link (such as a password-reset
  // link) may have put its own screen above it, and redirecting then would replace
  // that screen instead of this one.
  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return;

      if (getPendingRecoveryUrl()) {
        // Opened by a reset link that the router did not get to deliver
        router.replace('/(auth)/reset-password');
      } else if (!hasSeenOnboarding) {
        router.replace('/onboarding');
      } else if (isAuthenticated) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    }, [isAuthenticated, hasSeenOnboarding, hydrated]),
  );

  return null;
}
