import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useHikeStore } from '../store/hikeStore';

export const BACKGROUND_LOCATION_TASK = 'background-location';

// Must be defined at module level (expo-task-manager requirement)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }: any) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const { addGpsPoint, isActive } = useHikeStore.getState();
  if (!isActive) return;
  locations.forEach((loc) => addGpsPoint(loc.coords.latitude, loc.coords.longitude));
});

export async function startBackgroundTracking(): Promise<boolean> {
  const { granted } = await Location.requestBackgroundPermissionsAsync();
  if (!granted) return false;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) return true;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 20,
    timeInterval: 10000,
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
