import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { router } from 'expo-router';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      authService.login(data),
    onSuccess: (data) => {
      setSession(data.user, data.session.access_token, data.session.refresh_token);
      router.replace('/(tabs)/home');
    },
  });
}

export function useSignup() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      username: string;
      full_name?: string;
    }) => authService.signup(data),
    onSuccess: (data) => {
      if (data.session) {
        setSession(data.user, data.session.access_token, data.session.refresh_token);
        router.replace('/(tabs)/home');
      } else {
        // Email confirmation required — redirect to login
        router.replace('/(auth)/login');
      }
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
  });
}

export function logout() {
  useAuthStore.getState().clearSession();
  router.replace('/(auth)/login');
}
