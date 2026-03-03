import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { usersService } from '../services/users';

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

export function useHeartbeat() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const send = () => {
    if (useAuthStore.getState().isAuthenticated) {
      usersService.heartbeat().catch(() => {});
    }
  };

  const start = () => {
    if (intervalRef.current) return;
    send(); // immediate on foreground
    intervalRef.current = setInterval(send, HEARTBEAT_INTERVAL_MS);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      stop();
      return;
    }

    start();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [isAuthenticated]);
}
