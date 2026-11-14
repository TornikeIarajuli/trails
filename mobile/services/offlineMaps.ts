import { Directory, File, Paths } from 'expo-file-system';
import {
  TOPO_USER_AGENT,
  TilePlan,
  fileUriToPath,
  parseTileKey,
  tileUrl,
} from '../utils/topoTiles';
import {
  SavedTopoTrail,
  TopoManifest,
  emptyManifest,
  parseManifest,
  tilesNotSaved,
  tilesToDeleteOnRemove,
  withTrail,
  withoutTrail,
} from '../utils/tileManifest';
import { DownloadOptions, DownloadOutcome, TileSink, downloadTiles } from '../utils/tileDownloader';

/**
 * Topo tiles on the phone. One folder serves both the tiles the map keeps while browsing
 * (react-native-maps' UrlTile writes them as `{z}/{x}/{y}`, no extension) and the tiles
 * saved for trails, so saved trails show offline with no extra native code.
 */
const tilesRoot = () => new Directory(Paths.document, 'tiles');
const topoDir = () => new Directory(Paths.document, 'tiles', 'opentopomap');
const manifestFile = () => new File(Paths.document, 'tiles', 'offline-trails.json');

/** The cache folder as a plain path, which is what UrlTile's `tileCachePath` reads best. */
export function topoTileCachePath(): string {
  return fileUriToPath(topoDir().uri);
}

function tileFile(key: string): File | null {
  const tile = parseTileKey(key);
  return tile ? new File(topoDir(), String(tile.z), String(tile.x), String(tile.y)) : null;
}

function ensureDir(dir: Directory) {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

export function readManifest(): TopoManifest {
  try {
    const file = manifestFile();
    return file.exists ? parseManifest(file.textSync()) : emptyManifest();
  } catch {
    return emptyManifest();
  }
}

function writeManifest(manifest: TopoManifest) {
  ensureDir(tilesRoot());
  manifestFile().write(JSON.stringify(manifest));
}

const tileSink: TileSink = {
  has: (key) => tileFile(key)?.exists ?? false,
  fetch: async (key) => {
    const tile = parseTileKey(key);
    if (!tile) throw new Error(`Bad tile key ${key}`);
    const dir = new Directory(topoDir(), String(tile.z), String(tile.x));
    ensureDir(dir);
    // Downloaded beside the tile and renamed when complete: on Android a failed download
    // can leave a partial file, which the map would otherwise show as a broken tile
    const part = new File(dir, `${tile.y}.part`);
    if (part.exists) part.delete();
    try {
      await File.downloadFileAsync(tileUrl(tile), part, {
        headers: { 'User-Agent': TOPO_USER_AGENT },
        idempotent: true,
      });
    } catch (error) {
      if (part.exists) part.delete();
      throw error;
    }
    const target = new File(dir, String(tile.y));
    try {
      part.move(target);
    } catch (error) {
      // The map's own cache wrote the same tile meanwhile; keep that one
      if (part.exists) part.delete();
      if (!target.exists) throw error;
    }
  },
};

function deleteTiles(keys: string[]) {
  for (const key of keys) {
    try {
      const file = tileFile(key);
      if (file?.exists) file.delete();
    } catch {
      // Already gone, or in use; nothing else to do
    }
  }
}

function sizeOfTiles(keys: string[]): number {
  let bytes = 0;
  for (const key of keys) {
    try {
      const file = tileFile(key);
      if (file?.exists) bytes += file.size;
    } catch {
      // Unreadable: not counted
    }
  }
  return bytes;
}

export interface SaveTrailResult {
  outcome: DownloadOutcome;
  /** The trail's manifest entry, when it was saved completely. */
  saved: SavedTopoTrail | null;
}

/**
 * Downloads a trail's topo tiles and records them in the manifest once all are on the phone.
 * A cancelled download removes the tiles it fetched (unless another saved trail uses them);
 * after a failure they stay, so trying again only fetches what is missing.
 */
export async function saveTrailTopo(
  trailId: string,
  name: string,
  plan: TilePlan,
  options: Pick<DownloadOptions, 'control' | 'onProgress' | 'sleep'>,
): Promise<SaveTrailResult> {
  ensureDir(topoDir());
  const outcome = await downloadTiles(plan.tiles, tileSink, options);

  if (outcome.status === 'cancelled') {
    deleteTiles(tilesNotSaved(readManifest(), outcome.created));
    return { outcome, saved: null };
  }
  if (outcome.status !== 'done' || plan.maxZoom === null) return { outcome, saved: null };

  const saved: SavedTopoTrail = {
    name,
    tiles: plan.tiles,
    bytes: sizeOfTiles(plan.tiles),
    savedAt: new Date().toISOString(),
    minZoom: plan.minZoom,
    maxZoom: plan.maxZoom,
  };
  writeManifest(withTrail(readManifest(), trailId, saved));
  return { outcome, saved };
}

/** Removes a saved trail, deleting only the tiles no other saved trail uses. */
export function removeTrailTopo(trailId: string): TopoManifest {
  const manifest = readManifest();
  deleteTiles(tilesToDeleteOnRemove(manifest, trailId));
  const next = withoutTrail(manifest, trailId);
  writeManifest(next);
  return next;
}

/** Everything topo on the phone: saved trails and tiles kept from browsing. */
export function offlineMapsSize(): number {
  try {
    const root = tilesRoot();
    return root.exists ? (root.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

export function deleteAllOfflineMaps() {
  try {
    const root = tilesRoot();
    if (root.exists) root.delete();
  } catch {
    // Partly deleted; what is left is found again by the size check
  }
}
