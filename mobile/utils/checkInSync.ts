/**
 * The phone's side of a "Back by" check-in: what it needs to keep the server informed while the
 * hike runs, also from the background task and across app restarts.
 *
 *   - the check-in being kept (trail, back-by time), so positions can be sent with it
 *   - the latest position, sent every POSITION_EVERY_MS at most
 *   - a finish that could not reach the server (no signal at the end of the hike), retried
 *     whenever the phone is online again, so the emergency contact is not alerted for nothing.
 *     It names its trail, so arriving late it can never close the check-in of a later hike.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { checkinsService as CheckinsService } from '../services/checkins';

// Loaded on first use: the background task imports this module, and should not pull in the
// whole API client before a check-in is actually set
function api(): typeof CheckinsService {
  return (require('../services/checkins') as { checkinsService: typeof CheckinsService }).checkinsService;
}

const STORAGE_KEY = 'mikiri.checkIn.v1';
export const POSITION_EVERY_MS = 10 * 60 * 1000;
// After a failed send, try again a minute later rather than ten
const RETRY_AFTER_MS = 60 * 1000;

interface Kept {
  trailId: string;
  backBy: string;
}

interface Saved {
  kept: Kept | null;
  /** A finish still to be sent: for this trail's check-in, or (null) whatever is open. */
  pendingFinish: { trailId: string | null } | null;
}

let state: Saved = { kept: null, pendingFinish: null };
let loaded: Promise<void> | null = null;
let nextPositionAt = 0;
let sending = false;

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Saved>;
      state = { kept: saved.kept ?? null, pendingFinish: saved.pendingFinish ?? null };
    })
    .catch(() => {});
  return loaded;
}

function save(): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

/** The check-in this phone keeps up to date, if any. */
export async function keptCheckIn(): Promise<Kept | null> {
  await load();
  return state.kept;
}

/**
 * Sets the back-by time of the hike in progress (with the current position when known).
 * Throws when the server could not be reached: the alert only works once it is set.
 */
export async function setBackBy(
  trailId: string,
  backBy: Date,
  position?: { lat: number; lng: number } | null,
): Promise<void> {
  await load();
  await api().set({
    trail_id: trailId,
    back_by: backBy.toISOString(),
    ...(position ? { lat: position.lat, lng: position.lng } : {}),
  });
  state = { kept: { trailId, backBy: backBy.toISOString() }, pendingFinish: null };
  nextPositionAt = Date.now() + POSITION_EVERY_MS;
  await save();
}

/** A GPS fix during the hike: sent with the check-in now and then, never more than one at a time. */
export async function sendCheckInPosition(lat: number, lng: number, now = Date.now()): Promise<void> {
  await load();
  const kept = state.kept;
  if (!kept || sending || now < nextPositionAt || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  sending = true;
  nextPositionAt = now + POSITION_EVERY_MS;
  try {
    await api().set({ trail_id: kept.trailId, back_by: kept.backBy, lat, lng });
  } catch {
    nextPositionAt = now + RETRY_AFTER_MS;
  } finally {
    sending = false;
  }
}

/**
 * Tells the server the hiker is back.
 *
 * - When a hike ends (no options): the check-in this phone set for it, if any. Without signal
 *   the finish is kept and sent later by retryCheckInFinish.
 * - When the hiker says so ({ byHiker: true }: "I'm back", "Turn off"): whatever is open,
 *   also when this phone did not set it. Throws when the server cannot be reached (the screen
 *   says so), and is still sent later on its own.
 */
export async function finishCheckIn(options: { byHiker?: boolean } = {}): Promise<void> {
  await load();
  const trailId = options.byHiker ? null : state.kept?.trailId;
  if (trailId === undefined && !state.pendingFinish) return;
  state = {
    kept: null,
    pendingFinish: trailId === undefined ? state.pendingFinish : { trailId },
  };
  await save();
  await sendPendingFinish(options.byHiker === true);
}

async function sendPendingFinish(throwOnFailure: boolean): Promise<void> {
  const pending = state.pendingFinish;
  if (!pending) return;
  try {
    await api().finish(pending.trailId);
    // Only drop what was sent: a newer finish may have been queued meanwhile
    if (state.pendingFinish === pending) {
      state = { ...state, pendingFinish: null };
      await save();
    }
  } catch (error) {
    if (throwOnFailure) throw error;
  }
}

/** Sends a finish that could not reach the server before. Safe to call any time. */
export async function retryCheckInFinish(): Promise<void> {
  await load();
  await sendPendingFinish(false);
}

/** For tests: forget everything kept in memory. */
export function resetCheckInSyncForTests() {
  state = { kept: null, pendingFinish: null };
  loaded = null;
  nextPositionAt = 0;
  sending = false;
}
