import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated]);

  return null;
}
