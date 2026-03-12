import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useHikeStore } from '../store/hikeStore';
import { useSettingsStore, GpsAccuracy } from '../store/settingsStore';

export const BACKGROUND_LOCATION_TASK = 'background-location';

const ACCURACY_MAP: Record<GpsAccuracy, Location.Accuracy> = {
  low: Location.Accuracy.Low,
  balanced: Location.Accuracy.Balanced,
  high: Location.Accuracy.High,
};

const DISTANCE_INTERVAL_MAP: Record<GpsAccuracy, number> = {
  low: 50,       // 50m between updates — saves battery
  balanced: 20,  // 20m — default
  high: 5,       // 5m — most precise
};

const TIME_INTERVAL_MAP: Record<GpsAccuracy, number> = {
  low: 30000,     // 30s
  balanced: 10000, // 10s
  high: 3000,      // 3s
};

// Must be defined at module level (expo-task-manager requirement)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const { addGpsPoint, isActive, isPaused } = useHikeStore.getState();
  if (!isActive || isPaused) return;
  locations.forEach((loc) => addGpsPoint(loc.coords.latitude, loc.coords.longitude));
});

export async function startBackgroundTracking(): Promise<boolean> {
  const { granted } = await Location.requestBackgroundPermissionsAsync();
  if (!granted) return false;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) return true;

  const accuracy = useSettingsStore.getState().gpsAccuracy;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: ACCURACY_MAP[accuracy],
    distanceInterval: DISTANCE_INTERVAL_MAP[accuracy],
    timeInterval: TIME_INTERVAL_MAP[accuracy],
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Mikiri Trails',
      notificationBody: 'Recording your hike…',
    },
  });
  return true;
}

export async function stopBackgroundTracking(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
