import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { useHikeStore } from '../store/hikeStore';

/** Foreground checks closer together than this are skipped. */
export const MIN_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Over-the-air updates (EAS Update). The app already checks once at launch
 * (`updates.checkAutomatically: ON_LOAD` in app.json); this also checks when the
 * app comes back to the foreground and, once a new update has been downloaded,
 * offers to restart into it. It never interrupts a hike: an update that arrives
 * during one is offered after the hike ends, and is applied on the next launch
 * in any case.
 */
export function useOtaUpdates() {
  const { isUpdatePending } = Updates.useUpdates();
  const isHikeActive = useHikeStore((s) => s.isActive);
  const lastCheck = useRef(0);
  const prompted = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const check = () => {
      const now = Date.now();
      if (now - lastCheck.current < MIN_CHECK_INTERVAL_MS) return;
      lastCheck.current = now;
      Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        // Offline or the update server is unreachable: the next check retries.
        .catch(() => {});
    };

    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isUpdatePending || isHikeActive || prompted.current) return;
    prompted.current = true;
    Alert.alert('Update ready', 'A new version of the app has been downloaded.', [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Restart now',
        onPress: () => {
          Updates.reloadAsync().catch(() => {});
        },
      },
    ]);
  }, [isUpdatePending, isHikeActive]);
}
