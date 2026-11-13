/**
 * The hike screen's location hook: permission handling, the foreground watcher
 * and starting (or failing to start) background tracking.
 */
jest.mock('expo-location', () => ({
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  ActivityType: { Other: 1, AutomotiveNavigation: 2, Fitness: 3, OtherNavigation: 4, Airborne: 5 },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));

import React from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import * as Location from 'expo-location';
import { useLocationTracking } from '../../hooks/useLocation';
import { useSettingsStore } from '../../store/settingsStore';
import { flushHikeStorage } from '../../utils/hikeStorage';
import { getTrackingOptions } from '../../utils/locationConfig';

const requestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const getPermission = Location.getForegroundPermissionsAsync as jest.Mock;
const servicesEnabled = Location.hasServicesEnabledAsync as jest.Mock;
const watch = Location.watchPositionAsync as jest.Mock;
const startUpdates = Location.startLocationUpdatesAsync as jest.Mock;
const addAppStateListener = AppState.addEventListener as jest.Mock;

let hook: ReturnType<typeof useLocationTracking>;
let deliverFix: (loc: unknown) => void = () => {};
let removeWatch: jest.Mock;

function Probe({ enabled }: { enabled: boolean }) {
  hook = useLocationTracking(enabled);
  return null;
}

const flush = () => act(async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
});

const mounted: ReactTestRenderer[] = [];

async function mount(enabled = true) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Probe enabled={enabled} />);
  });
  mounted.push(renderer);
  await flush();
  return renderer;
}

/** Sends an AppState change to the listeners registered from `from` on. */
async function appBecomes(state: string, from: number) {
  await act(async () => {
    for (const [, listener] of addAppStateListener.mock.calls.slice(from)) listener(state);
  });
  await flush();
}

let warn: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  useSettingsStore.setState({ gpsAccuracy: 'balanced' });
  requestPermission.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  getPermission.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  servicesEnabled.mockResolvedValue(true);
  removeWatch = jest.fn();
  watch.mockImplementation(async (_options: unknown, callback: (loc: unknown) => void) => {
    deliverFix = callback;
    return { remove: removeWatch };
  });
  startUpdates.mockResolvedValue(undefined);
});

afterEach(async () => {
  // Unmounted before the next test changes the settings store they listen to
  await act(async () => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
  });
  warn.mockRestore();
  jest.useRealTimers();
  await flushHikeStorage();
});

describe('useLocationTracking', () => {
  it('does nothing while disabled', async () => {
    await mount(false);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(watch).not.toHaveBeenCalled();
  });

  it('watches the position with the options of the GPS accuracy setting, then starts background tracking', async () => {
    useSettingsStore.setState({ gpsAccuracy: 'high' });

    await mount();

    expect(hook.status).toBe('ready');
    expect(watch.mock.calls[0][0]).toEqual({ ...getTrackingOptions('high'), mayShowUserSettingsDialog: false });
    expect(startUpdates).toHaveBeenCalledTimes(1);
    expect(hook.backgroundTracking).toBe('on');
  });

  it('passes on each fix with its own time and accuracy', async () => {
    await mount();

    await act(async () => {
      deliverFix({ coords: { latitude: 42.66, longitude: 44.61, accuracy: 7 }, timestamp: 1_700_000_000_000 });
    });

    expect(hook.location).toEqual({ latitude: 42.66, longitude: 44.61, accuracy: 7, timestamp: 1_700_000_000_000 });
  });

  it('reports a refused permission instead of waiting for a fix forever', async () => {
    requestPermission.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });

    await mount();

    expect(hook.status).toBe('denied');
    expect(hook.canAskAgain).toBe(false);
    expect(watch).not.toHaveBeenCalled();
    expect(startUpdates).not.toHaveBeenCalled();
  });

  it('reports location switched off on the device', async () => {
    servicesEnabled.mockResolvedValue(false);

    await mount();

    expect(hook.status).toBe('disabled');
    expect(watch).not.toHaveBeenCalled();
  });

  it('starts over once access has been allowed in the system settings', async () => {
    requestPermission.mockResolvedValueOnce({ status: 'denied', granted: false, canAskAgain: false });
    const listenersBefore = addAppStateListener.mock.calls.length;
    await mount();
    expect(hook.status).toBe('denied');

    await appBecomes('active', listenersBefore);

    expect(hook.status).toBe('ready');
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('asks again when the user wants to allow location after all', async () => {
    requestPermission.mockResolvedValueOnce({ status: 'denied', granted: false, canAskAgain: true });
    await mount();
    expect(hook.status).toBe('denied');

    await act(async () => hook.retry());
    await flush();

    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(hook.status).toBe('ready');
  });

  it('reports background tracking as unavailable when it cannot start, and keeps the foreground watcher', async () => {
    startUpdates.mockRejectedValue(new Error('Foreground service cannot be started'));

    await mount();

    expect(hook.status).toBe('ready');
    expect(hook.backgroundTracking).toBe('unavailable');
    expect(removeWatch).not.toHaveBeenCalled();
  });

  it('tries the background start again a few seconds later', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    startUpdates.mockRejectedValueOnce(new Error('app not in the foreground')).mockResolvedValue(undefined);

    await mount();
    expect(hook.backgroundTracking).toBe('unavailable');

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flush();

    expect(startUpdates).toHaveBeenCalledTimes(2);
    expect(hook.backgroundTracking).toBe('on');
  });

  it('tries the background start again when the app comes back to the front', async () => {
    startUpdates
      .mockRejectedValueOnce(new Error('app not in the foreground'))
      .mockRejectedValueOnce(new Error('still not'))
      .mockResolvedValue(undefined);
    const listenersBefore = addAppStateListener.mock.calls.length;

    await mount();
    await appBecomes('active', listenersBefore);
    expect(hook.backgroundTracking).toBe('unavailable');

    await appBecomes('active', listenersBefore);
    expect(hook.backgroundTracking).toBe('on');
  });

  it('stops watching when the hike screen turns tracking off', async () => {
    const renderer = await mount(true);

    await act(async () => renderer.update(<Probe enabled={false} />));

    expect(removeWatch).toHaveBeenCalledTimes(1);
  });

  it('restarts the watcher with new options when the accuracy setting changes', async () => {
    await mount();

    await act(async () => useSettingsStore.setState({ gpsAccuracy: 'low' }));
    await flush();

    expect(removeWatch).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenCalledTimes(2);
    expect(watch.mock.calls[1][0]).toMatchObject(getTrackingOptions('low'));
  });
});
