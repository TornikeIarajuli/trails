/**
 * Saving, removing and measuring topo tiles, on an in-memory stand-in for expo-file-system.
 */
jest.mock('expo-file-system', () => {
  const state = {
    files: new Map<string, string>(),
    dirs: new Set<string>(['file:///docs']),
    requests: [] as { url: string; headers?: Record<string, string> }[],
    failing: new Set<string>(),
    /** URLs whose download breaks off midway, leaving part of the file (as on Android). */
    breaking: new Set<string>(),
    /** Called with the target URI between a download finishing and its rename, like the map's cache writing. */
    beforeMove: null as null | Function,
  };
  const toUri = (part: unknown) => (typeof part === 'string' ? part : (part as { uri: string }).uri);
  const join = (...parts: unknown[]) => {
    const [first, ...rest] = parts.map(toUri);
    let path = first.replace(/\/+$/, '');
    for (const p of rest) path += `/${String(p).replace(/^\/+|\/+$/g, '')}`;
    return path;
  };
  const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'));

  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = `${join(...parts)}/`;
    }
    private get path() {
      return this.uri.replace(/\/$/, '');
    }
    get exists() {
      return state.dirs.has(this.path);
    }
    create() {
      for (let p = this.path; !state.dirs.has(p); p = parentOf(p)) state.dirs.add(p);
    }
    delete() {
      for (const f of [...state.files.keys()]) if (f.startsWith(`${this.path}/`)) state.files.delete(f);
      for (const d of [...state.dirs]) if (d === this.path || d.startsWith(`${this.path}/`)) state.dirs.delete(d);
    }
    get size() {
      let bytes = 0;
      for (const [f, data] of state.files) if (f.startsWith(`${this.path}/`)) bytes += data.length;
      return bytes;
    }
  }

  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return state.files.has(this.uri);
    }
    get size() {
      return state.files.get(this.uri)?.length ?? 0;
    }
    delete() {
      if (!state.files.delete(this.uri)) throw new Error('No such file');
    }
    textSync() {
      const data = state.files.get(this.uri);
      if (data === undefined) throw new Error('No such file');
      return data;
    }
    write(content: string) {
      if (!state.dirs.has(parentOf(this.uri))) throw new Error('No such directory');
      state.files.set(this.uri, content);
    }
    move(target: File) {
      state.beforeMove?.(target.uri);
      if (state.files.has(target.uri)) throw new Error('Destination exists');
      state.files.set(target.uri, state.files.get(this.uri)!);
      state.files.delete(this.uri);
      this.uri = target.uri;
    }
    static async downloadFileAsync(url: string, destination: File, options?: { headers?: Record<string, string> }) {
      state.requests.push({ url, headers: options?.headers });
      if (state.failing.has(url)) throw new Error('UnableToDownload: response has status 503');
      if (!state.dirs.has(parentOf(destination.uri))) throw new Error('No such directory');
      if (state.breaking.has(url)) {
        state.files.set(destination.uri, 'x'.repeat(300));
        throw new Error('Connection reset');
      }
      state.files.set(destination.uri, 'x'.repeat(1000));
      return destination;
    }
  }

  return {
    Directory,
    File,
    Paths: {
      get document() {
        return new Directory('file:///docs/');
      },
    },
    __fs: state,
  };
});

import {
  deleteAllOfflineMaps,
  offlineMapsSize,
  readManifest,
  removeTrailTopo,
  saveTrailTopo,
  topoTileCachePath,
} from '../../services/offlineMaps';
import { TilePlan } from '../../utils/topoTiles';

const fs = jest.requireMock('expo-file-system').__fs as {
  files: Map<string, string>;
  dirs: Set<string>;
  requests: { url: string; headers?: Record<string, string> }[];
  failing: Set<string>;
  breaking: Set<string>;
  beforeMove: null | ((targetUri: string) => void);
};

const TILE_DIR = 'file:///docs/tiles/opentopomap';
const tilePath = (key: string) => `${TILE_DIR}/${key}`;
const urlOf = (key: string) => `https://tile.opentopomap.org/${key}.png`;
const plan = (tiles: string[]): TilePlan => ({ tiles, minZoom: 10, maxZoom: 15, droppedZooms: [] });
const noWait = { sleep: async () => {} };

const GERGETI = ['10/638/377', '15/20447/12082', '15/20447/12083'];
const JUTA = ['10/638/377', '15/20447/12083', '15/20460/12100'];

beforeEach(() => {
  fs.files.clear();
  fs.dirs.clear();
  fs.dirs.add('file:///docs');
  fs.requests.length = 0;
  fs.failing.clear();
  fs.breaking.clear();
  fs.beforeMove = null;
});

describe('topoTileCachePath', () => {
  it('points the map at the same folder the downloads use, as a plain path', () => {
    expect(topoTileCachePath()).toBe('/docs/tiles/opentopomap');
  });
});

describe('saveTrailTopo', () => {
  it('downloads every tile into {z}/{x}/{y} and records the trail', async () => {
    const { outcome, saved } = await saveTrailTopo('gergeti', 'Gergeti Trinity', plan(GERGETI), {
      control: { cancelled: false },
      ...noWait,
    });
    expect(outcome.status).toBe('done');
    for (const key of GERGETI) expect(fs.files.has(tilePath(key))).toBe(true);
    expect([...fs.files.keys()].some((f) => f.endsWith('.part'))).toBe(false);
    expect(saved).toMatchObject({ name: 'Gergeti Trinity', tiles: GERGETI, bytes: 3000, minZoom: 10, maxZoom: 15 });
    expect(readManifest().trails.gergeti.tiles).toEqual(GERGETI);
  });

  it('identifies the app to the tile server', async () => {
    await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI.slice(0, 1)), { control: { cancelled: false }, ...noWait });
    expect(fs.requests).toEqual([
      { url: urlOf('10/638/377'), headers: { 'User-Agent': 'Kvali (Android hiking app)' } },
    ]);
  });

  it('does not download tiles already on the phone, but counts them as part of the trail', async () => {
    fs.dirs.add(TILE_DIR);
    fs.dirs.add(`${TILE_DIR}/15`);
    fs.dirs.add(`${TILE_DIR}/15/20447`);
    fs.files.set(tilePath('15/20447/12082'), 'y'.repeat(500));
    const { saved } = await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI), { control: { cancelled: false }, ...noWait });
    expect(fs.requests.map((r) => r.url)).toEqual([urlOf('10/638/377'), urlOf('15/20447/12083')]);
    expect(saved?.tiles).toEqual(GERGETI);
    expect(saved?.bytes).toBe(2500);
  });

  it('keeps a tile the map cached while the download was finishing', async () => {
    fs.beforeMove = (target) => {
      if (target === tilePath('15/20447/12082')) fs.files.set(target, 'm'.repeat(700));
    };
    const { outcome } = await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI), { control: { cancelled: false }, ...noWait });
    expect(outcome.status).toBe('done');
    expect(fs.files.get(tilePath('15/20447/12082'))).toBe('m'.repeat(700));
    expect([...fs.files.keys()].some((f) => f.endsWith('.part'))).toBe(false);
  });

  it('on cancel, deletes what it fetched except tiles another saved trail uses', async () => {
    await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI), { control: { cancelled: false }, ...noWait });
    deleteTileForTest('10/638/377'); // gone from the phone, but still listed for Gergeti
    const control = { cancelled: false };
    const { outcome, saved } = await saveTrailTopo('juta', 'Juta', plan(JUTA), {
      control,
      ...noWait,
      onProgress: (done) => {
        if (done === 2) control.cancelled = true;
      },
    });
    expect(outcome.status).toBe('cancelled');
    expect(saved).toBeNull();
    // Fetched again for Juta, but Gergeti needs it, so it stays
    expect(fs.files.has(tilePath('10/638/377'))).toBe(true);
    expect(fs.files.has(tilePath('15/20460/12100'))).toBe(false);
    expect(Object.keys(readManifest().trails)).toEqual(['gergeti']);
  });

  it('never leaves a half-downloaded tile where the map would read it', async () => {
    fs.breaking.add(urlOf('15/20447/12082'));
    const { outcome } = await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI), { control: { cancelled: false }, ...noWait });
    expect(outcome.failed).toEqual(['15/20447/12082']);
    expect(fs.files.has(tilePath('15/20447/12082'))).toBe(false);
    expect([...fs.files.keys()].some((f) => f.endsWith('.part'))).toBe(false);
  });

  it('after a failure records nothing but keeps the tiles, so a retry fetches only the rest', async () => {
    fs.failing.add(urlOf('15/20447/12083'));
    const first = await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI), { control: { cancelled: false }, ...noWait });
    expect(first.outcome.status).toBe('failed');
    expect(first.saved).toBeNull();
    expect(readManifest().trails).toEqual({});
    expect(fs.files.has(tilePath('10/638/377'))).toBe(true);

    fs.failing.clear();
    fs.requests.length = 0;
    const retry = await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI), { control: { cancelled: false }, ...noWait });
    expect(retry.outcome.status).toBe('done');
    expect(fs.requests.map((r) => r.url)).toEqual([urlOf('15/20447/12083')]);
  });
});

function deleteTileForTest(key: string) {
  fs.files.delete(tilePath(key));
}

describe('removeTrailTopo', () => {
  it('deletes only the tiles no other saved trail uses', async () => {
    await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI), { control: { cancelled: false }, ...noWait });
    await saveTrailTopo('juta', 'Juta', plan(JUTA), { control: { cancelled: false }, ...noWait });

    const manifest = removeTrailTopo('gergeti');
    expect(Object.keys(manifest.trails)).toEqual(['juta']);
    expect(fs.files.has(tilePath('15/20447/12082'))).toBe(false);
    for (const key of JUTA) expect(fs.files.has(tilePath(key))).toBe(true);

    removeTrailTopo('juta');
    for (const key of [...GERGETI, ...JUTA]) expect(fs.files.has(tilePath(key))).toBe(false);
    expect(readManifest().trails).toEqual({});
  });
});

describe('size and delete all', () => {
  it('measures everything under the tiles folder and deletes it all', async () => {
    expect(offlineMapsSize()).toBe(0);
    await saveTrailTopo('gergeti', 'Gergeti', plan(GERGETI), { control: { cancelled: false }, ...noWait });
    expect(offlineMapsSize()).toBeGreaterThanOrEqual(3000);

    deleteAllOfflineMaps();
    expect(offlineMapsSize()).toBe(0);
    expect(readManifest().trails).toEqual({});
    expect([...fs.files.keys()]).toEqual([]);
  });
});
