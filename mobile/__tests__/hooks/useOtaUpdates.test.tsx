/**
 * Over-the-air updates: when the app checks, and when it offers to restart.
 */
const updatesState = { isUpdatePending: false };

jest.mock('expo-updates', () => ({
  isEnabled: true,
  useUpdates: jest.fn(() => updatesState),
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(() => Promise.resolve({ isNew: true })),
  reloadAsync: jest.fn(() => Promise.resolve()),
}));

import React from 'react';
import { Alert, AppState } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import * as Updates from 'expo-updates';
import { useOtaUpdates, MIN_CHECK_INTERVAL_MS } from '../../hooks/useOtaUpdates';
import { useHikeStore } from '../../store/hikeStore';

const checkForUpdate = Updates.checkForUpdateAsync as jest.Mock;
const fetchUpdate = Updates.fetchUpdateAsync as jest.Mock;
const reload = Updates.reloadAsync as jest.Mock;

function Probe() {
  useOtaUpdates();
  return null;
}

const flush = () =>
  act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

let renderer: ReactTestRenderer | null = null;
let appStateListener: ((state: string) => void) | null = null;
const realDev = (global as { __DEV__?: boolean }).__DEV__;

beforeEach(() => {
  jest.clearAllMocks();
  updatesState.isUpdatePending = false;
  useHikeStore.setState({ isActive: false });
  (global as { __DEV__?: boolean }).__DEV__ = false;
  checkForUpdate.mockResolvedValue({ isAvailable: false });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  (global as { __DEV__?: boolean }).__DEV__ = realDev;
  jest.restoreAllMocks();
});

async function mount() {
  await act(async () => {
    renderer = TestRenderer.create(<Probe />);
  });
  await flush();
}

it('checks on start and downloads an available update', async () => {
  checkForUpdate.mockResolvedValueOnce({ isAvailable: true });
  await mount();

  expect(checkForUpdate).toHaveBeenCalledTimes(1);
  expect(fetchUpdate).toHaveBeenCalledTimes(1);
});

it('checks again on returning to the foreground, but not more than every 30 minutes', async () => {
  const start = 1_800_000_000_000;
  const now = jest.spyOn(Date, 'now').mockReturnValue(start);
  await mount();
  expect(checkForUpdate).toHaveBeenCalledTimes(1);

  await act(async () => appStateListener?.('active'));
  expect(checkForUpdate).toHaveBeenCalledTimes(1);

  now.mockReturnValue(start + MIN_CHECK_INTERVAL_MS + 1);
  await act(async () => appStateListener?.('active'));
  expect(checkForUpdate).toHaveBeenCalledTimes(2);
});

it('survives an unreachable update server', async () => {
  checkForUpdate.mockRejectedValueOnce(new Error('network'));
  await mount();
  expect(fetchUpdate).not.toHaveBeenCalled();
});

it('offers to restart once an update has been downloaded', async () => {
  updatesState.isUpdatePending = true;
  await mount();

  expect(Alert.alert).toHaveBeenCalledTimes(1);
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  buttons.find((b: { text: string }) => b.text === 'Restart now').onPress();
  expect(reload).toHaveBeenCalledTimes(1);
});

it('does not interrupt a hike, and offers the restart when the hike ends', async () => {
  updatesState.isUpdatePending = true;
  useHikeStore.setState({ isActive: true });
  await mount();
  expect(Alert.alert).not.toHaveBeenCalled();

  await act(async () => {
    useHikeStore.setState({ isActive: false });
  });
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

it('does nothing in development builds', async () => {
  (global as { __DEV__?: boolean }).__DEV__ = true;
  await mount();
  expect(checkForUpdate).not.toHaveBeenCalled();
});
