/**
 * The location pipeline's configuration: one accuracy mapping for the
 * foreground watcher and the background task, and what the task does with fixes.
 */
jest.mock('expo-location', () => ({
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  ActivityType: { Other: 1, AutomotiveNavigation: 2, Fitness: 3, OtherNavigation: 4, Airborne: 5 },
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(false)),
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
// The "Back by" position upload talks to the API; not under test here
jest.mock('../../utils/checkInSync', () => ({ sendCheckInPosition: jest.fn(() => Promise.resolve()) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useHikeStore, whenHikeStoreHydrated } from '../../store/hikeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { flushHikeStorage } from '../../utils/hikeStorage';
import { getTrackingOptions } from '../../utils/locationConfig';
import {
  BACKGROUND_LOCATION_TASK,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../../utils/locationTask';

// Registered when utils/locationTask was imported; captured before any mock is cleared
const [registeredTaskName, runTask] = (TaskManager.defineTask as jest.Mock).mock.calls[0] as [
  string,
  (body: { data?: unknown; error?: unknown }) => Promise<void>,
];

const start = Location.startLocationUpdatesAsync as jest.Mock;
const stop = Location.stopLocationUpdatesAsync as jest.Mock;
const hasStarted = Location.hasStartedLocationUpdatesAsync as jest.Mock;
const hike = () => useHikeStore.getState();

const fix = (lat: number, lng: number, timestamp: number, accuracy = 6) => ({
  coords: { latitude: lat, longitude: lng, accuracy, altitude: 0, altitudeAccuracy: 0, heading: 0, speed: 0 },
  timestamp,
});

beforeAll(async () => {
  await whenHikeStoreHydrated();
});

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ gpsAccuracy: 'balanced' });
  hike().discardHike();
});

afterEach(async () => {
  await flushHikeStorage();
});

describe('getTrackingOptions', () => {
  it('maps the GPS accuracy setting to location accuracy', () => {
    // Battery saver still uses GPS (fewer fixes, not worse ones), so its tracks can be verified.
    expect(getTrackingOptions('low').accuracy).toBe(Location.Accuracy.High);
    expect(getTrackingOptions('balanced').accuracy).toBe(Location.Accuracy.High);
    expect(getTrackingOptions('high').accuracy).toBe(Location.Accuracy.BestForNavigation);
  });

  it('uses the default (balanced → High) when the setting is missing', () => {
    expect(getTrackingOptions(undefined)).toEqual(getTrackingOptions('balanced'));
    expect(getTrackingOptions('nonsense' as never)).toEqual(getTrackingOptions('balanced'));
  });

  it('asks for more frequent fixes the more precise the setting', () => {
    const low = getTrackingOptions('low');
    const balanced = getTrackingOptions('balanced');
    const high = getTrackingOptions('high');
    expect(low.distanceInterval).toBeGreaterThan(balanced.distanceInterval);
    expect(balanced.distanceInterval).toBeGreaterThan(high.distanceInterval);
    expect(low.timeInterval).toBeGreaterThan(balanced.timeInterval);
    expect(balanced.timeInterval).toBeGreaterThan(high.timeInterval);
  });
});

describe('startBackgroundTracking', () => {
  it.each(['low', 'balanced', 'high'] as const)(
    'starts the task with the same options as the foreground watcher (%s)',
    async (setting) => {
      useSettingsStore.setState({ gpsAccuracy: setting });

      expect(await startBackgroundTracking()).toBe(true);

      expect(start).toHaveBeenCalledTimes(1);
      const [taskName, options] = start.mock.calls[0];
      expect(taskName).toBe(BACKGROUND_LOCATION_TASK);
      expect(options).toMatchObject(getTrackingOptions(setting));
    },
  );

  it('runs as a foreground service with a notification, and never lets iOS pause it', async () => {
    await startBackgroundTracking();

    const options = start.mock.calls[0][1];
    expect(options.foregroundService).toEqual({
      notificationTitle: expect.any(String),
      notificationBody: expect.any(String),
    });
    expect(options.pausesUpdatesAutomatically).toBe(false);
    expect(options.activityType).toBe(Location.ActivityType.Fitness);
    expect(options.showsBackgroundLocationIndicator).toBe(true);
  });

  it('does not ask for the "Allow all the time" permission', async () => {
    await startBackgroundTracking();
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('starts again even if the task is already registered (restores the service after a restart)', async () => {
    hasStarted.mockResolvedValue(true);
    await startBackgroundTracking();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('reports failure instead of throwing when the task cannot be started', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    start.mockRejectedValueOnce(new Error('Foreground service cannot be started'));

    expect(await startBackgroundTracking()).toBe(false);

    warn.mockRestore();
  });
});

describe('stopBackgroundTracking', () => {
  it('stops the task when it is running', async () => {
    hasStarted.mockResolvedValueOnce(true);
    await stopBackgroundTracking();
    expect(stop).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  });

  it('does nothing when it is not running', async () => {
    hasStarted.mockResolvedValueOnce(false);
    await stopBackgroundTracking();
    expect(stop).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    hasStarted.mockRejectedValueOnce(new Error('native module missing'));
    await expect(stopBackgroundTracking()).resolves.toBeUndefined();
  });
});

describe('the background task', () => {
  it('is registered under the task name the tracking functions use', () => {
    expect(registeredTaskName).toBe(BACKGROUND_LOCATION_TASK);
  });

  it('records each fix with its own time and drops inaccurate ones', async () => {
    hike().startHike('trail-1');

    await runTask({
      data: {
        locations: [
          fix(41.0, 44.0, 1_700_000_000_000),
          fix(41.0002, 44.0, 1_700_000_010_000, 300), // too vague
          fix(41.0004, 44.0, 1_700_000_020_000),
        ],
      },
    });

    expect(hike().gpsPoints).toEqual([
      { lat: 41.0, lng: 44.0, timestamp: 1_700_000_000_000 },
      { lat: 41.0004, lng: 44.0, timestamp: 1_700_000_020_000 },
    ]);
  });

  it('does not count a fix the foreground watcher already delivered', async () => {
    hike().startHike('trail-1');
    hike().addGpsPoint(41.0, 44.0, { timestamp: 1_700_000_000_000, accuracy: 6 });
    hike().addGpsPoint(41.0002, 44.0, { timestamp: 1_700_000_010_000, accuracy: 6 });
    const distance = hike().distanceCoveredMeters;

    await runTask({ data: { locations: [fix(41.0002, 44.0, 1_700_000_010_000)] } });

    expect(hike().gpsPoints).toHaveLength(2);
    expect(hike().distanceCoveredMeters).toBe(distance);
  });

  it('records nothing while the hike is paused', async () => {
    hike().startHike('trail-1');
    hike().pauseHike();

    await runTask({ data: { locations: [fix(41.0, 44.0, 1_700_000_000_000)] } });

    expect(hike().gpsPoints).toEqual([]);
    expect(stop).not.toHaveBeenCalled();
  });

  it('shuts the location service down when there is no hike to record', async () => {
    hasStarted.mockResolvedValue(true);

    await runTask({ data: { locations: [fix(41.0, 44.0, 1_700_000_000_000)] } });
    await new Promise((resolve) => setImmediate(resolve));

    expect(hike().gpsPoints).toEqual([]);
    expect(stop).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  });

  describe('saving what it recorded', () => {
    const appState = AppState as unknown as { currentState: unknown };
    const original = appState.currentState;
    const savedTrack = () => AsyncStorage.getItem('hike-store:track:0');

    afterEach(() => {
      appState.currentState = original;
    });

    it('writes the fixes out before returning while the app is off screen', async () => {
      appState.currentState = 'background';
      hike().startHike('trail-1');
      await flushHikeStorage();

      await runTask({ data: { locations: [fix(41.0, 44.0, 1_700_000_000_000)] } });

      expect(JSON.parse((await savedTrack()) ?? '[]')).toEqual([[41, 44, 1_700_000_000_000]]);
    });

    it('leaves it to the periodic flush while the app is on screen', async () => {
      appState.currentState = 'active';
      hike().startHike('trail-1');
      await flushHikeStorage();

      await runTask({ data: { locations: [fix(41.0, 44.0, 1_700_000_000_000)] } });

      expect(await savedTrack()).toBeNull();
      expect(hike().gpsPoints).toHaveLength(1);
    });
  });

  it('ignores an error report or an empty delivery', async () => {
    hike().startHike('trail-1');

    await runTask({ error: { message: 'location unavailable' } });
    await runTask({});
    await runTask({ data: {} });

    expect(hike().gpsPoints).toEqual([]);
  });
});
