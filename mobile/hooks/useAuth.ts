import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { router } from 'expo-router';
import { identify, reset } from '../utils/analytics';
import { queryClient } from '../utils/queryClient';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      authService.login(data),
    onSuccess: (data) => {
      setSession(data.user, data.session.access_token, data.session.refresh_token);
      if (data.user) identify(data.user.id, { email: data.user.email });
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
    onSuccess: (data, variables) => {
      if (data.session) {
        setSession(data.user, data.session.access_token, data.session.refresh_token);
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

export function logout() {
  reset();
  useAuthStore.getState().clearSession();
  queryClient.clear();
  router.replace('/(auth)/login');
}
