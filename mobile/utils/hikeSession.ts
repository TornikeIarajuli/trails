import { completionsService } from '../services/completions';
import { useHikeStore } from '../store/hikeStore';
import { analytics } from './analytics';
import { stopBackgroundTracking } from './locationTask';
import { computeElapsedSeconds } from './track';
import { finishCheckIn } from './checkInSync';

/**
 * Abandons the hike in progress: recording stops and its track is dropped.
 * Nothing is uploaded, and completions already waiting in the queue are kept.
 */
export function discardActiveHike(): void {
  const hike = useHikeStore.getState();
  if (hike.isActive && hike.trailId) {
    analytics.hikeAbandoned(hike.trailId, computeElapsedSeconds(hike));
    completionsService.clearActive(hike.trailId).catch(() => {});
  }
  void stopBackgroundTracking();
  void finishCheckIn();
  hike.discardHike();
}
