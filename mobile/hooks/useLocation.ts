import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useSettingsStore } from '../store/settingsStore';
import { getTrackingOptions } from '../utils/locationConfig';
import { startBackgroundTracking } from '../utils/locationTask';

export interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Time of the fix in ms since epoch. */
  timestamp: number;
}

export function useCurrentLocation() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (mounted) setError('Location permission denied');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (mounted) {
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          timestamp: loc.timestamp,
        });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { location, error };
}

/**
 * - `checking`: asking for permission / starting up
 * - `ready`: the watcher is running (fixes may still take a while to arrive)
 * - `denied`: the app has no location permission
 * - `disabled`: location is switched off on the device, or could not be started
 */
export type LocationStatus = 'checking' | 'ready' | 'denied' | 'disabled';
export type BackgroundTrackingStatus = 'starting' | 'on' | 'unavailable';

const BACKGROUND_RETRY_MS = 3000;

/**
 * Tracks the device while a hike is on screen: asks for the foreground
 * permission, watches the position, then starts the background task so the
 * recording survives the screen turning off.
 */
export function useLocationTracking(enabled: boolean) {
  const gpsAccuracy = useSettingsStore((s) => s.gpsAccuracy);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [status, setStatus] = useState<LocationStatus>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [backgroundTracking, setBackgroundTracking] = useState<BackgroundTrackingStatus>('starting');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (permission.status !== 'granted') {
        setCanAskAgain(permission.canAskAgain);
        setStatus('denied');
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (cancelled) return;
      if (!servicesEnabled) {
        setStatus('disabled');
        return;
      }

      const started = await Location.watchPositionAsync(
        // No system dialog here: whether location is on was checked above, and the
        // screen explains what to do when it is not.
        { ...getTrackingOptions(gpsAccuracy), mayShowUserSettingsDialog: false },
        (loc) => {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            timestamp: loc.timestamp,
          });
        },
      );
      if (cancelled) {
        started.remove();
        return;
      }
      subscription = started;
      setStatus('ready');

      const backgroundStarted = await startBackgroundTracking();
      if (!cancelled) setBackgroundTracking(backgroundStarted ? 'on' : 'unavailable');
    })().catch(() => {
      if (!cancelled) setStatus('disabled');
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, gpsAccuracy, attempt]);

  // Android refuses to start the location service while the app is not in the
  // foreground, which it briefly is not right after a permission dialog. Such a
  // refusal is retried a little later and whenever the app comes back to the front.
  useEffect(() => {
    if (!enabled || status !== 'ready' || backgroundTracking !== 'unavailable') return;

    let cancelled = false;
    const startAgain = () => {
      startBackgroundTracking().then((started) => {
        if (started && !cancelled) setBackgroundTracking('on');
      });
    };
    const timer = setTimeout(startAgain, BACKGROUND_RETRY_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') startAgain();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [enabled, status, backgroundTracking]);

  // Coming back from the system Settings: start over once access has been fixed there.
  // Only checks — asking again here would re-open the permission prompt on every return.
  useEffect(() => {
    if (!enabled || (status !== 'denied' && status !== 'disabled')) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      Promise.all([Location.getForegroundPermissionsAsync(), Location.hasServicesEnabledAsync()])
        .then(([permission, servicesEnabled]) => {
          if (permission.status === 'granted' && servicesEnabled) retry();
        })
        .catch(() => {});
    });
    return () => subscription.remove();
  }, [enabled, status, retry]);

  return { location, status, canAskAgain, backgroundTracking, retry };
}
