import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { PendingCompletion, TrackPoint } from '../types/completion';
import { GpsPoint, createLocalId } from './track';

/**
 * Persistence for the hike store.
 *
 * AsyncStorage on Android cannot read a single value larger than ~2 MB and caps
 * the whole database at 6 MB, so a long track must not live in one JSON blob
 * that is rewritten on every change. The state is therefore split:
 *
 *   <name>                  small state, queue metadata        (every flush)
 *   <name>:track:<n>        active track in chunks of 500      (only the last chunk is rewritten)
 *   <name>:last             track of the last finished hike    (once per hike)
 *   <name>:queue:<localId>  track of a completion waiting to upload
 *
 * Writes are coalesced: a change is flushed at most every few seconds, and
 * `flushHikeStorage()` forces it out when losing it would hurt.
 */

export const HIKE_STORAGE_VERSION = 1;

const FLUSH_INTERVAL_MS = 5000;
const CHUNK_SIZE = 500;

export interface LastHike {
  trailId: string;
  /** Server id of the completion, once known. */
  completionId: string | null;
  /** Queue entry this hike is waiting in while it has not been uploaded. */
  localId: string | null;
  points: GpsPoint[];
}

export interface PersistedHikeState {
  isActive: boolean;
  trailId: string | null;
  /** Account that started the hike in progress, so it is never finished under another one. */
  ownerId: string | null;
  startTime: number | null;
  isPaused: boolean;
  resumedAt: number | null;
  baseElapsedSeconds: number;
  visitedCheckpointIds: string[];
  distanceCoveredMeters: number;
  gpsPoints: GpsPoint[];
  lastHike: LastHike | null;
  pendingCompletions: PendingCompletion[];
}

const PERSISTED_KEYS: (keyof PersistedHikeState)[] = [
  'isActive',
  'trailId',
  'ownerId',
  'startTime',
  'isPaused',
  'resumedAt',
  'baseElapsedSeconds',
  'visitedCheckpointIds',
  'distanceCoveredMeters',
  'gpsPoints',
  'lastHike',
  'pendingCompletions',
];

interface MainRecord extends Omit<PersistedHikeState, 'gpsPoints' | 'lastHike' | 'pendingCompletions'> {
  trackChunks: number;
  lastHike: (Omit<LastHike, 'points'> & { hasPoints: boolean }) | null;
  pendingCompletions: Omit<PendingCompletion, 'track'>[];
}

/** What is known to be on disk, held by reference so an unchanged part is never rewritten. */
interface Written {
  mainJson: string | null;
  points: GpsPoint[];
  chunkCount: number;
  lastPoints: GpsPoint[] | null;
  queueTracks: Map<string, TrackPoint[]>;
}

const NOTHING_WRITTEN = (): Written => ({
  mainJson: null,
  points: [],
  chunkCount: 0,
  lastPoints: null,
  queueTracks: new Map(),
});

// False until the saved state has been read: whatever the store holds before
// that is its empty default, and writing it out would erase the saved hike.
let loaded = false;
let latest: { name: string; state: PersistedHikeState } | null = null;
let flushed: PersistedHikeState | null = null;
let written: Written = NOTHING_WRITTEN();
let timer: ReturnType<typeof setTimeout> | null = null;
let chain: Promise<void> = Promise.resolve();

const chunkKey = (name: string, index: number) => `${name}:track:${index}`;
const lastKey = (name: string) => `${name}:last`;
const queueKey = (name: string, localId: string) => `${name}:queue:${localId}`;

function encodePoints(points: GpsPoint[]): string {
  return JSON.stringify(points.map((p) => [p.lat, p.lng, p.timestamp]));
}

function decodePoints(raw: unknown): GpsPoint[] {
  if (!Array.isArray(raw)) return [];
  const points: GpsPoint[] = [];
  for (const item of raw) {
    // Tuples in the current layout, objects in the layout this replaced
    const [lat, lng, timestamp] = Array.isArray(item)
      ? item
      : [item?.lat, item?.lng, item?.timestamp];
    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(timestamp)) {
      points.push({ lat, lng, timestamp });
    }
  }
  return points;
}

function decodeTrack(raw: unknown): TrackPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is TrackPoint => Array.isArray(p) && p.length === 3 && p.every((n) => Number.isFinite(n)),
  );
}

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isDirty(state: PersistedHikeState): boolean {
  if (!flushed) return true;
  const previous = flushed;
  return PERSISTED_KEYS.some((key) => state[key] !== previous[key]);
}

function toMainRecord(state: PersistedHikeState, trackChunks: number): MainRecord {
  return {
    isActive: state.isActive,
    trailId: state.trailId,
    ownerId: state.ownerId,
    startTime: state.startTime,
    isPaused: state.isPaused,
    resumedAt: state.resumedAt,
    baseElapsedSeconds: state.baseElapsedSeconds,
    visitedCheckpointIds: state.visitedCheckpointIds,
    distanceCoveredMeters: state.distanceCoveredMeters,
    trackChunks,
    lastHike: state.lastHike
      ? {
          trailId: state.lastHike.trailId,
          completionId: state.lastHike.completionId,
          localId: state.lastHike.localId,
          hasPoints: state.lastHike.points.length > 0,
        }
      : null,
    pendingCompletions: state.pendingCompletions.map(({ track: _track, ...meta }) => meta),
  };
}

async function writePending(): Promise<void> {
  if (!latest) return;
  const { name, state } = latest;
  if (!isDirty(state)) return;

  const sets: [string, string][] = [];
  const removes: string[] = [];

  // Active track: points are only ever appended, so everything before the last
  // chunk that was written is still valid unless the array was replaced.
  const points = state.gpsPoints;
  let chunkCount = written.chunkCount;
  if (points !== written.points) {
    const known = written.points.length;
    const appendedOnly = known > 0 && points.length >= known && points[known - 1] === written.points[known - 1];
    const firstStale = appendedOnly ? Math.floor(known / CHUNK_SIZE) : 0;
    chunkCount = Math.ceil(points.length / CHUNK_SIZE);
    for (let i = firstStale; i < chunkCount; i++) {
      sets.push([chunkKey(name, i), encodePoints(points.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))]);
    }
    for (let i = chunkCount; i < written.chunkCount; i++) removes.push(chunkKey(name, i));
  }

  const lastPoints = state.lastHike && state.lastHike.points.length > 0 ? state.lastHike.points : null;
  if (lastPoints !== written.lastPoints) {
    if (lastPoints) sets.push([lastKey(name), encodePoints(lastPoints)]);
    else removes.push(lastKey(name));
  }

  const queueTracks = new Map<string, TrackPoint[]>();
  for (const entry of state.pendingCompletions) {
    queueTracks.set(entry.localId, entry.track);
    if (written.queueTracks.get(entry.localId) !== entry.track) {
      sets.push([queueKey(name, entry.localId), JSON.stringify(entry.track)]);
    }
  }
  for (const localId of written.queueTracks.keys()) {
    if (!queueTracks.has(localId)) removes.push(queueKey(name, localId));
  }

  // The main record goes last: it must never point at data that is not there yet
  const mainJson = JSON.stringify({ version: HIKE_STORAGE_VERSION, state: toMainRecord(state, chunkCount) });
  if (mainJson !== written.mainJson) sets.push([name, mainJson]);

  if (sets.length > 0) await AsyncStorage.multiSet(sets);
  if (removes.length > 0) await AsyncStorage.multiRemove(removes);

  written = { mainJson, points, chunkCount, lastPoints, queueTracks };
  flushed = state;
}

/** Writes any pending change now. Never rejects: a failed write is retried by the next flush. */
export function flushHikeStorage(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  chain = chain.then(writePending).catch((error) => {
    console.warn('[hikeStorage] could not save hike state', error);
  });
  return chain;
}

function expectedKeys(name: string): Set<string> {
  const keys = new Set<string>([name]);
  for (let i = 0; i < written.chunkCount; i++) keys.add(chunkKey(name, i));
  if (written.lastPoints) keys.add(lastKey(name));
  for (const localId of written.queueTracks.keys()) keys.add(queueKey(name, localId));
  return keys;
}

/** Removes sub-keys left behind by a write that was interrupted before the main record was updated. */
async function removeOrphans(name: string): Promise<void> {
  const expected = expectedKeys(name);
  const all = await AsyncStorage.getAllKeys();
  const orphans = all.filter((key) => key.startsWith(`${name}:`) && !expected.has(key));
  if (orphans.length > 0) await AsyncStorage.multiRemove(orphans);
}

async function readState(name: string): Promise<StorageValue<PersistedHikeState> | null> {
  loaded = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  latest = null;
  written = NOTHING_WRITTEN();
  flushed = null;

  const raw = await AsyncStorage.getItem(name);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { version?: number; state?: unknown } | null;
  if (!parsed || typeof parsed.state !== 'object' || parsed.state === null) return null;

  if (parsed.version !== HIKE_STORAGE_VERSION) {
    // The layout this replaced kept everything in this one value; `migrateHikeState`
    // converts it and the first flush rewrites it in the current layout.
    return {
      state: parsed.state as PersistedHikeState,
      version: typeof parsed.version === 'number' ? parsed.version : 0,
    };
  }

  const main = parsed.state as MainRecord;
  const queue = Array.isArray(main.pendingCompletions) ? main.pendingCompletions : [];
  const trackChunks = Number.isInteger(main.trackChunks) && main.trackChunks > 0 ? main.trackChunks : 0;

  const [chunks, lastRaw, queueRaw] = await Promise.all([
    Promise.all(Array.from({ length: trackChunks }, (_, i) => readJson(chunkKey(name, i)))),
    main.lastHike?.hasPoints ? readJson(lastKey(name)) : Promise.resolve(null),
    Promise.all(queue.map((entry) => readJson(queueKey(name, entry.localId)))),
  ]);

  const decodedChunks = chunks.map(decodePoints);
  const gpsPoints = decodedChunks.flat();
  // Appending relies on every chunk but the last being full; anything else is rewritten whole
  const aligned = decodedChunks.every((chunk, i) => i === decodedChunks.length - 1 || chunk.length === CHUNK_SIZE);

  const lastPoints = decodePoints(lastRaw);
  const lastHike: LastHike | null = main.lastHike
    ? {
        trailId: main.lastHike.trailId,
        completionId: main.lastHike.completionId ?? null,
        localId: main.lastHike.localId ?? null,
        points: lastPoints,
      }
    : null;

  const queueTracks = new Map<string, TrackPoint[]>();
  const pendingCompletions: PendingCompletion[] = queue.map((meta, i) => {
    const track = decodeTrack(queueRaw[i]);
    queueTracks.set(meta.localId, track);
    return { ...meta, track };
  });

  const state: PersistedHikeState = {
    isActive: !!main.isActive,
    trailId: main.trailId ?? null,
    ownerId: main.ownerId ?? null,
    startTime: main.startTime ?? null,
    isPaused: !!main.isPaused,
    resumedAt: main.resumedAt ?? null,
    baseElapsedSeconds: Number(main.baseElapsedSeconds) || 0,
    visitedCheckpointIds: Array.isArray(main.visitedCheckpointIds) ? main.visitedCheckpointIds : [],
    distanceCoveredMeters: Number(main.distanceCoveredMeters) || 0,
    gpsPoints,
    lastHike,
    pendingCompletions,
  };

  written = {
    mainJson: raw,
    points: aligned ? gpsPoints : [],
    chunkCount: trackChunks,
    lastPoints: lastPoints.length > 0 ? lastPoints : null,
    queueTracks,
  };
  flushed = aligned ? state : null;

  chain = chain.then(() => removeOrphans(name)).catch(() => {});
  return { state, version: HIKE_STORAGE_VERSION };
}

export const hikeStorage: PersistStorage<PersistedHikeState> = {
  async getItem(name) {
    try {
      return await readState(name);
    } catch (error) {
      console.warn('[hikeStorage] could not read saved hike state', error);
      return null;
    } finally {
      loaded = true;
    }
  },

  setItem(name, value) {
    if (!loaded) return;
    latest = { name, state: value.state };
    if (!timer && isDirty(value.state)) {
      timer = setTimeout(() => {
        timer = null;
        void flushHikeStorage();
      }, FLUSH_INTERVAL_MS);
    }
  },

  async removeItem(name) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    latest = null;
    flushed = null;
    written = NOTHING_WRITTEN();
    const all = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(all.filter((key) => key === name || key.startsWith(`${name}:`)));
  },
};

/**
 * Converts state saved by an older version of the store. Version 0 had a single
 * `pendingSync` slot (no owner, no track) and a `lastHikeGpsPoints` buffer that
 * was not tied to any trail, so that buffer cannot be carried over.
 */
export function migrateHikeState(persisted: unknown, _version: number): PersistedHikeState {
  const old = (persisted ?? {}) as Record<string, any>;
  const pendingSync = old.pendingSync;

  const pendingCompletions: PendingCompletion[] =
    pendingSync && typeof pendingSync.trailId === 'string'
      ? [
          {
            localId: createLocalId(),
            userId: null,
            trailId: pendingSync.trailId,
            elapsedSeconds: Number(pendingSync.elapsedSeconds) || 0,
            startedAt: null,
            completedAt:
              typeof pendingSync.completedAt === 'string' ? pendingSync.completedAt : new Date().toISOString(),
            distanceM: null,
            track: [],
            attempts: 0,
          },
        ]
      : [];

  return {
    isActive: !!old.isActive,
    trailId: typeof old.trailId === 'string' ? old.trailId : null,
    ownerId: null,
    startTime: typeof old.startTime === 'number' ? old.startTime : null,
    isPaused: !!old.isPaused,
    resumedAt: typeof old.resumedAt === 'number' ? old.resumedAt : null,
    baseElapsedSeconds: Number(old.baseElapsedSeconds) || 0,
    visitedCheckpointIds: Array.isArray(old.visitedCheckpointIds) ? old.visitedCheckpointIds : [],
    distanceCoveredMeters: Number(old.distanceCoveredMeters) || 0,
    gpsPoints: decodePoints(old.gpsPoints),
    lastHike: null,
    pendingCompletions,
  };
}

// The OS may kill a backgrounded app without warning, so nothing is left waiting on the timer.
AppState.addEventListener('change', (status) => {
  if (status !== 'active') void flushHikeStorage();
});
