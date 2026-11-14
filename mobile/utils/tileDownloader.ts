/**
 * Downloads a list of map tiles politely: at most two at a time, a short pause after each
 * request, nothing fetched that is already on the phone, and a stop after repeated failures
 * (offline, or the server asking us to back off). The storage is passed in, so this can be
 * tested without files or network.
 */

export interface TileSink {
  /** Whether the tile is already stored. */
  has(key: string): boolean;
  /** Downloads one tile into the store; rejects when it could not be fetched. */
  fetch(key: string): Promise<void>;
}

/** Set `cancelled` to stop: requests in flight finish, no new ones start. */
export interface DownloadControl {
  cancelled: boolean;
}

export interface DownloadOutcome {
  status: 'done' | 'cancelled' | 'failed';
  /** Tiles this run downloaded (not those that were already stored). */
  created: string[];
  failed: string[];
}

export interface DownloadOptions {
  /** Requests at the same time; capped at 2. */
  concurrency?: number;
  /** Pause after every request, per worker. */
  pauseMs?: number;
  /** Stop after this many failures in a row. */
  maxConsecutiveFailures?: number;
  control?: DownloadControl;
  onProgress?: (done: number, total: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

export const MAX_CONCURRENT_TILE_REQUESTS = 2;
export const TILE_REQUEST_PAUSE_MS = 150;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function downloadTiles(
  keys: string[],
  sink: TileSink,
  options: DownloadOptions = {},
): Promise<DownloadOutcome> {
  const concurrency = Math.max(1, Math.min(MAX_CONCURRENT_TILE_REQUESTS, options.concurrency ?? MAX_CONCURRENT_TILE_REQUESTS));
  const pauseMs = options.pauseMs ?? TILE_REQUEST_PAUSE_MS;
  const maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
  const control = options.control ?? { cancelled: false };
  const sleep = options.sleep ?? defaultSleep;
  const queue = [...new Set(keys)];
  const total = queue.length;

  const created: string[] = [];
  const failed: string[] = [];
  let next = 0;
  let done = 0;
  let consecutiveFailures = 0;
  let stopped = false;

  const tick = () => {
    done += 1;
    options.onProgress?.(done, total);
  };

  /** One request, retried once after a longer pause. */
  const fetchWithRetry = async (key: string): Promise<boolean> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await sink.fetch(key);
        return true;
      } catch {
        if (attempt === 0 && !control.cancelled) await sleep(pauseMs * 4);
      } finally {
        await sleep(pauseMs);
      }
      if (control.cancelled) return false;
    }
    return false;
  };

  const worker = async () => {
    while (!stopped && !control.cancelled && next < queue.length) {
      const key = queue[next++];
      if (sink.has(key)) {
        tick();
        continue;
      }
      if (await fetchWithRetry(key)) {
        created.push(key);
        consecutiveFailures = 0;
      } else if (!control.cancelled) {
        failed.push(key);
        consecutiveFailures += 1;
        if (consecutiveFailures >= maxConsecutiveFailures) stopped = true;
      }
      tick();
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, total)) }, worker));

  const status = control.cancelled ? 'cancelled' : stopped || failed.length > 0 ? 'failed' : 'done';
  return { status, created, failed };
}
