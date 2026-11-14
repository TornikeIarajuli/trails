jest.mock('../../services/completions', () => ({
  completionsService: { clearActive: jest.fn(() => Promise.resolve()) },
}));
jest.mock('../../utils/locationTask', () => ({
  stopBackgroundTracking: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/analytics', () => ({
  analytics: { hikeAbandoned: jest.fn() },
}));
jest.mock('../../utils/checkInSync', () => ({
  finishCheckIn: jest.fn(() => Promise.resolve()),
}));

import { completionsService } from '../../services/completions';
import { useHikeStore, whenHikeStoreHydrated } from '../../store/hikeStore';
import { analytics } from '../../utils/analytics';
import { discardActiveHike } from '../../utils/hikeSession';
import { flushHikeStorage } from '../../utils/hikeStorage';
import { stopBackgroundTracking } from '../../utils/locationTask';
import { finishCheckIn } from '../../utils/checkInSync';

const clearActive = completionsService.clearActive as jest.Mock;
const stopTracking = stopBackgroundTracking as jest.Mock;
const hike = () => useHikeStore.getState();

const queued = {
  localId: 'local-1',
  userId: 'user-1',
  trailId: 'trail-done',
  elapsedSeconds: 60,
  startedAt: null,
  completedAt: '2026-11-13T08:00:00.000Z',
  distanceM: null,
  track: [],
  attempts: 0,
};
const finished = { trailId: 'trail-done', completionId: null, localId: 'local-1', points: [{ lat: 41, lng: 44, timestamp: 1 }] };

beforeAll(async () => {
  await whenHikeStoreHydrated();
});

beforeEach(() => {
  jest.clearAllMocks();
  useHikeStore.setState({ pendingCompletions: [queued], lastHike: finished });
});

afterEach(async () => {
  await flushHikeStorage();
});

describe('discardActiveHike', () => {
  it('stops tracking, drops the hike and its track, and tells the server the trail is free', () => {
    hike().startHike('trail-1', 'user-1');
    hike().addGpsPoint(41, 44, { timestamp: 1000 });
    hike().addGpsPoint(41.001, 44, { timestamp: 2000 });

    discardActiveHike();

    expect(stopTracking).toHaveBeenCalledTimes(1);
    expect(clearActive).toHaveBeenCalledWith('trail-1');
    expect(analytics.hikeAbandoned).toHaveBeenCalledWith('trail-1', expect.any(Number));
    expect(hike()).toMatchObject({
      isActive: false,
      trailId: null,
      ownerId: null,
      gpsPoints: [],
      distanceCoveredMeters: 0,
    });
  });

  it('keeps the last finished hike and everything waiting to upload', () => {
    hike().startHike('trail-1', 'user-1');

    discardActiveHike();

    expect(hike().pendingCompletions).toEqual([queued]);
    expect(hike().lastHike).toEqual(finished);
  });

  it('still stops tracking when no hike is active (sign-out)', () => {
    discardActiveHike();

    expect(stopTracking).toHaveBeenCalledTimes(1);
    expect(clearActive).not.toHaveBeenCalled();
    expect(analytics.hikeAbandoned).not.toHaveBeenCalled();
  });

  it('does not fail when the server cannot be told', () => {
    clearActive.mockRejectedValueOnce(new Error('Network Error'));
    hike().startHike('trail-1');

    expect(() => discardActiveHike()).not.toThrow();
    expect(hike().isActive).toBe(false);
  });
});

it('ends the hike’s “Back by” check-in too, so nobody is alerted for an abandoned hike', () => {
  discardActiveHike();
  expect(finishCheckIn).toHaveBeenCalled();
});
