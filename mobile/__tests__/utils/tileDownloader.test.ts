import { TileSink, downloadTiles } from '../../utils/tileDownloader';

const keys = (n: number) => Array.from({ length: n }, (_, i) => `15/20000/${12000 + i}`);

/** A fake store whose downloads finish when the test says so. */
function controllableSink(stored: string[] = []) {
  const files = new Set(stored);
  const pending: { key: string; resolve: () => void; reject: (e: Error) => void }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const requested: string[] = [];
  const sink: TileSink = {
    has: (key) => files.has(key),
    fetch: (key) =>
      new Promise<void>((resolve, reject) => {
        requested.push(key);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        pending.push({
          key,
          resolve: () => {
            inFlight -= 1;
            files.add(key);
            resolve();
          },
          reject: (e) => {
            inFlight -= 1;
            reject(e);
          },
        });
      }),
  };
  return { sink, pending, requested, files, maxInFlight: () => maxInFlight };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('downloadTiles', () => {
  it('never has more than two requests in flight', async () => {
    const { sink, pending, maxInFlight } = controllableSink();
    const run = downloadTiles(keys(7), sink, { concurrency: 5, sleep: async () => {} });
    while (true) {
      await flush();
      const next = pending.shift();
      if (!next) break;
      next.resolve();
    }
    const outcome = await run;
    expect(maxInFlight()).toBe(2);
    expect(outcome).toEqual({ status: 'done', created: keys(7), failed: [] });
  });

  it('skips tiles already on the phone and reports progress for all', async () => {
    const all = keys(4);
    const fetched: string[] = [];
    const progress: [number, number][] = [];
    const sink: TileSink = {
      has: (key) => key === all[0] || key === all[2],
      fetch: async (key) => {
        fetched.push(key);
      },
    };
    const outcome = await downloadTiles(all, sink, {
      sleep: async () => {},
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(fetched.sort()).toEqual([all[1], all[3]].sort());
    expect(outcome.created.sort()).toEqual([all[1], all[3]].sort());
    expect(progress[progress.length - 1]).toEqual([4, 4]);
    expect(progress).toHaveLength(4);
  });

  it('pauses after every request', async () => {
    const pauses: number[] = [];
    const sink: TileSink = { has: () => false, fetch: async () => {} };
    await downloadTiles(keys(3), sink, { pauseMs: 150, sleep: async (ms) => void pauses.push(ms) });
    expect(pauses).toEqual([150, 150, 150]);
  });

  it('asks for each tile once, even if listed twice', async () => {
    const fetched: string[] = [];
    const sink: TileSink = { has: () => false, fetch: async (key) => void fetched.push(key) };
    await downloadTiles(['12/1/1', '12/1/1', '12/1/2'], sink, { sleep: async () => {} });
    expect(fetched.sort()).toEqual(['12/1/1', '12/1/2']);
  });

  it('retries a failed tile once, after a longer pause', async () => {
    let calls = 0;
    const pauses: number[] = [];
    const sink: TileSink = {
      has: () => false,
      fetch: async () => {
        calls += 1;
        if (calls === 1) throw new Error('timeout');
      },
    };
    const outcome = await downloadTiles(['12/1/1'], sink, {
      pauseMs: 100,
      sleep: async (ms) => void pauses.push(ms),
    });
    expect(calls).toBe(2);
    expect(pauses).toEqual([400, 100, 100]);
    expect(outcome.status).toBe('done');
  });

  it('stops after three tiles fail in a row, e.g. when the connection is gone', async () => {
    const fetched = new Set<string>();
    const sink: TileSink = {
      has: () => false,
      fetch: async (key) => {
        fetched.add(key);
        throw new Error('offline');
      },
    };
    const outcome = await downloadTiles(keys(20), sink, { concurrency: 1, sleep: async () => {} });
    expect(outcome.status).toBe('failed');
    expect(outcome.failed).toEqual(keys(3));
    expect(fetched.size).toBe(3);
  });

  it('reports a failure when some tiles could not be fetched', async () => {
    const sink: TileSink = {
      has: () => false,
      fetch: async (key) => {
        if (key.endsWith('12001')) throw new Error('500');
      },
    };
    const outcome = await downloadTiles(keys(4), sink, { concurrency: 1, sleep: async () => {} });
    expect(outcome.status).toBe('failed');
    expect(outcome.failed).toEqual(['15/20000/12001']);
    expect(outcome.created).toHaveLength(3);
  });

  it('stops starting requests when cancelled, keeping track of what it fetched', async () => {
    const { sink, pending, requested } = controllableSink();
    const control = { cancelled: false };
    const run = downloadTiles(keys(10), sink, { control, sleep: async () => {} });
    await flush();
    expect(requested).toHaveLength(2);
    pending.shift()!.resolve();
    control.cancelled = true;
    pending.shift()!.resolve();
    await flush();
    const outcome = await run;
    expect(outcome.status).toBe('cancelled');
    expect(outcome.created).toEqual(keys(2));
    expect(requested).toHaveLength(2);
  });

  it('finishes at once with nothing to do', async () => {
    const sink: TileSink = { has: () => false, fetch: async () => {} };
    expect(await downloadTiles([], sink, { sleep: async () => {} })).toEqual({
      status: 'done',
      created: [],
      failed: [],
    });
  });
});
