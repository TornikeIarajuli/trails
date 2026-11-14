/**
 * The phone's side of "Back by": setting it, sending the position now and then (also from the
 * background), and a finish without signal that is kept and sent once the phone is online.
 */
jest.mock('../../services/checkins', () => ({
  checkinsService: { set: jest.fn(), finish: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkinsService } from '../../services/checkins';
import {
  POSITION_EVERY_MS,
  finishCheckIn,
  keptCheckIn,
  resetCheckInSyncForTests,
  retryCheckInFinish,
  sendCheckInPosition,
  setBackBy,
} from '../../utils/checkInSync';

const set = checkinsService.set as jest.Mock;
const finish = checkinsService.finish as jest.Mock;
const backBy = new Date('2026-11-14T15:30:00.000Z');

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  resetCheckInSyncForTests();
  set.mockResolvedValue(undefined);
  finish.mockResolvedValue(undefined);
});

it('sets the back-by time with the position, and keeps it for later fixes', async () => {
  await setBackBy('t1', backBy, { lat: 42.6, lng: 44.6 });

  expect(set).toHaveBeenCalledWith({ trail_id: 't1', back_by: backBy.toISOString(), lat: 42.6, lng: 44.6 });
  expect(await keptCheckIn()).toEqual({ trailId: 't1', backBy: backBy.toISOString() });
});

it('keeps nothing when the server could not be reached', async () => {
  set.mockRejectedValueOnce(new Error('Network Error'));
  await expect(setBackBy('t1', backBy)).rejects.toThrow('Network Error');
  expect(await keptCheckIn()).toBeNull();
});

it('sends the position at most every ten minutes, and only while a check-in is kept', async () => {
  const now = Date.now();
  await sendCheckInPosition(42.6, 44.6, now);
  expect(set).not.toHaveBeenCalled(); // nothing kept

  await setBackBy('t1', backBy);
  set.mockClear();
  await sendCheckInPosition(42.61, 44.61, now + 60_000);
  expect(set).not.toHaveBeenCalled(); // just set: too soon

  await sendCheckInPosition(42.62, 44.62, now + POSITION_EVERY_MS + 1000);
  expect(set).toHaveBeenCalledWith({ trail_id: 't1', back_by: backBy.toISOString(), lat: 42.62, lng: 44.62 });

  set.mockClear();
  await sendCheckInPosition(42.63, 44.63, now + POSITION_EVERY_MS + 120_000);
  expect(set).not.toHaveBeenCalled();
});

it('tries a failed position again a minute later instead of ten', async () => {
  const now = Date.now();
  await setBackBy('t1', backBy);
  set.mockClear();
  set.mockRejectedValueOnce(new Error('offline'));

  await sendCheckInPosition(42.6, 44.6, now + POSITION_EVERY_MS + 1000);
  await sendCheckInPosition(42.6, 44.6, now + POSITION_EVERY_MS + 70_000);

  expect(set).toHaveBeenCalledTimes(2);
});

it('finishes the check-in of this trail when the hike ends', async () => {
  await setBackBy('t1', backBy);
  await finishCheckIn();

  expect(finish).toHaveBeenCalledWith('t1');
  expect(await keptCheckIn()).toBeNull();
});

it('lets the hiker close whatever is open, also a check-in this phone did not set', async () => {
  await finishCheckIn({ byHiker: true });
  expect(finish).toHaveBeenCalledWith(null);
});

it('tells the hiker when their own check-in could not be sent, and sends it later anyway', async () => {
  finish.mockRejectedValueOnce(new Error('Network Error'));
  await expect(finishCheckIn({ byHiker: true })).rejects.toThrow('Network Error');

  await retryCheckInFinish();
  expect(finish).toHaveBeenCalledTimes(2);
  expect(finish).toHaveBeenLastCalledWith(null);
});

it('keeps a finish made without signal, also across a restart, and sends it once online', async () => {
  await setBackBy('t1', backBy);
  finish.mockRejectedValueOnce(new Error('Network Error'));
  await finishCheckIn();
  expect(finish).toHaveBeenCalledTimes(1);

  // The app is closed and opened again: the pending finish comes back from storage
  resetCheckInSyncForTests();
  await retryCheckInFinish();
  expect(finish).toHaveBeenCalledTimes(2);
  // Named after its trail, so arriving late it cannot close a later hike's check-in
  expect(finish).toHaveBeenLastCalledWith('t1');

  // Sent: nothing left to retry
  await retryCheckInFinish();
  expect(finish).toHaveBeenCalledTimes(2);
});

it('does nothing at the end of a hike that had no back-by time', async () => {
  await finishCheckIn();
  expect(finish).not.toHaveBeenCalled();
});
