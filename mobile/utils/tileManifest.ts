/**
 * The record of which topo tiles each saved trail uses. Trails close together share tiles,
 * so removing one trail may only delete the tiles no other saved trail still needs.
 */

export interface SavedTopoTrail {
  name?: string;
  /** Tile keys ("z/x/y") of the whole plan, whether downloaded now or already on the phone. */
  tiles: string[];
  /** Size of those tiles on the phone when the trail was saved. */
  bytes: number;
  /** ISO time the download finished. */
  savedAt: string;
  minZoom: number;
  maxZoom: number;
}

export interface TopoManifest {
  version: 1;
  trails: Record<string, SavedTopoTrail>;
}

export const emptyManifest = (): TopoManifest => ({ version: 1, trails: {} });

/** Reads a stored manifest, dropping anything malformed instead of failing. */
export function parseManifest(raw: string | null | undefined): TopoManifest {
  if (!raw) return emptyManifest();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyManifest();
  }
  const trails = (data as { trails?: unknown })?.trails;
  if (!trails || typeof trails !== 'object') return emptyManifest();

  const manifest = emptyManifest();
  for (const [trailId, entry] of Object.entries(trails as Record<string, unknown>)) {
    const e = entry as Partial<SavedTopoTrail> | null;
    if (!e || !Array.isArray(e.tiles)) continue;
    manifest.trails[trailId] = {
      ...(typeof e.name === 'string' ? { name: e.name } : {}),
      tiles: e.tiles.filter((t): t is string => typeof t === 'string'),
      bytes: typeof e.bytes === 'number' && e.bytes >= 0 ? e.bytes : 0,
      savedAt: typeof e.savedAt === 'string' ? e.savedAt : '',
      minZoom: typeof e.minZoom === 'number' ? e.minZoom : 0,
      maxZoom: typeof e.maxZoom === 'number' ? e.maxZoom : 0,
    };
  }
  return manifest;
}

export function withTrail(manifest: TopoManifest, trailId: string, entry: SavedTopoTrail): TopoManifest {
  return { ...manifest, trails: { ...manifest.trails, [trailId]: entry } };
}

export function withoutTrail(manifest: TopoManifest, trailId: string): TopoManifest {
  const trails = { ...manifest.trails };
  delete trails[trailId];
  return { ...manifest, trails };
}

/** Every tile some saved trail uses, optionally ignoring one trail. */
export function tilesInUse(manifest: TopoManifest, exceptTrailId?: string): Set<string> {
  const used = new Set<string>();
  for (const [trailId, entry] of Object.entries(manifest.trails)) {
    if (trailId === exceptTrailId) continue;
    for (const tile of entry.tiles) used.add(tile);
  }
  return used;
}

/** The tiles to delete when a trail is removed: those no other saved trail uses. */
export function tilesToDeleteOnRemove(manifest: TopoManifest, trailId: string): string[] {
  const entry = manifest.trails[trailId];
  if (!entry) return [];
  const usedElsewhere = tilesInUse(manifest, trailId);
  return [...new Set(entry.tiles)].filter((tile) => !usedElsewhere.has(tile));
}

/** Of the given tiles, those no saved trail uses (e.g. what a cancelled download fetched). */
export function tilesNotSaved(manifest: TopoManifest, tiles: string[]): string[] {
  const used = tilesInUse(manifest);
  return tiles.filter((tile) => !used.has(tile));
}
