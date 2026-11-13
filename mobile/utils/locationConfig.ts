import * as Location from 'expo-location';
import type { GpsAccuracy } from '../store/settingsStore';

export interface TrackingOptions {
  accuracy: Location.Accuracy;
  /** Metres the device must move before the next fix is delivered. */
  distanceInterval: number;
  /** Minimum time between fixes in ms (Android only; iOS delivers by distance). */
  timeInterval: number;
}

/**
 * The one place the "GPS accuracy" setting is translated into location options,
 * shared by the foreground watcher and the background task.
 *
 * Every mode uses GPS-class accuracy: `Balanced` is ~100 m and uses no GPS on Android,
 * so in the mountains it delivers few or no fixes, and fixes worse than 50 m are dropped
 * anyway. Battery saver therefore asks for fewer fixes rather than worse ones.
 */
const TRACKING_OPTIONS: Record<GpsAccuracy, TrackingOptions> = {
  low: { accuracy: Location.Accuracy.High, distanceInterval: 40, timeInterval: 30_000 },
  balanced: { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 10_000 },
  high: { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3_000 },
};

export function getTrackingOptions(setting: GpsAccuracy | undefined): TrackingOptions {
  return TRACKING_OPTIONS[setting ?? 'balanced'] ?? TRACKING_OPTIONS.balanced;
}
