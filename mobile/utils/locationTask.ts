import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useHikeStore, whenHikeStoreHydrated } from '../store/hikeStore';
import { useSettingsStore } from '../store/settingsStore';
import { flushHikeStorage } from './hikeStorage';
import { getTrackingOptions } from './locationConfig';

export const BACKGROUND_LOCATION_TASK = 'background-location';

// Must be defined at module level (expo-task-manager requirement)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error || !data) return;
  const { locations } = data as { locations?: Location.LocationObject[] };

  // The task can be the first thing to run in a fresh process, before the saved hike is loaded
  await whenHikeStoreHydrated();

  const { addGpsPoint, isActive } = useHikeStore.getState();
  if (!isActive) {
    // No hike to feed: do not leave the location service (and its notification) running
    void stopBackgroundTracking();
    return;
  }
  for (const loc of locations ?? []) {
    addGpsPoint(loc.coords.latitude, loc.coords.longitude, {
      timestamp: loc.timestamp,
      accuracy: loc.coords.accuracy,
    });
  }

  // Off screen the OS may stop the app the moment this task returns, so the
  // fixes are written out now instead of waiting for the next periodic flush.
  if (AppState.currentState !== 'active') await flushHikeStorage();
});

/**
 * Keeps the hike recording while the app is in the background. Needs only the
 * foreground ("while using the app") permission: on Android the updates run in
 * a foreground service started while the app is visible, on iOS they continue
 * under the `location` background mode. Call it with the app on screen.
 *
 * Returns false when it could not be started; never throws.
 */
export async function startBackgroundTracking(): Promise<boolean> {
  try {
    // Safe to repeat: for a task that is already registered this only updates the
    // options and brings the Android foreground service back after an app restart.
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      ...getTrackingOptions(useSettingsStore.getState().gpsAccuracy),
      activityType: Location.ActivityType.Fitness,
      // iOS would otherwise stop delivering fixes during a long rest and not resume in the background
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Mikiri Trails',
        notificationBody: 'Recording your hike…',
      },
    });
    return true;
  } catch (error) {
    console.warn('[location] background tracking could not be started', error);
    return false;
  }
}

/** Stops background location updates if they are running; never throws. */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Nothing was running, or the platform has no background location (Expo Go)
  }
}
