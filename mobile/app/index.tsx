import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  const hydrated = useSettingsStore((s) => s._hydrated);

  useEffect(() => {
    if (!hydrated) return;

    if (!hasSeenOnboarding) {
      router.replace('/onboarding');
    } else if (isAuthenticated) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, hasSeenOnboarding, hydrated]);

  return null;
}
