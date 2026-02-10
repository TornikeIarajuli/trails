import { File, Directory, Paths } from 'expo-file-system';

const cacheDir = new Directory(Paths.document, 'trail-cache');
const savedIdsFile = new File(cacheDir, 'saved_ids.json');

function trailFile(id: string) {
  return new File(cacheDir, `trail_${id}.json`);
}

// In-memory cache for synchronous reads
const memoryCache = new Map<string, any>();
let memoryCacheLoaded = false;

async function loadSavedIdsToMemory() {
  if (memoryCacheLoaded) return;
  try {
    if (!cacheDir.exists) {
      cacheDir.create();
    }
    if (savedIdsFile.exists) {
      const raw = savedIdsFile.text();
      const ids: string[] = JSON.parse(raw);
      memoryCache.set('saved_ids', ids);
      for (const id of ids) {
        const f = trailFile(id);
        if (f.exists) {
          memoryCache.set(`trail_${id}`, JSON.parse(f.text()));
        }
      }
    }
  } catch {}
  memoryCacheLoaded = true;
}

// Initialize on import
loadSavedIdsToMemory();

export const trailCache = {
  setTrailDetail(id: string, data: any) {
    memoryCache.set(`trail_${id}`, data);
    try {
      if (!cacheDir.exists) cacheDir.create();
      trailFile(id).write(JSON.stringify(data));
    } catch {}
  },

  getTrailDetail<T>(id: string): T | null {
    return (memoryCache.get(`trail_${id}`) as T) ?? null;
  },

  saveTrailOffline(id: string, data: any) {
    memoryCache.set(`trail_${id}`, data);
    const saved = this.getSavedTrailIds();
    if (!saved.includes(id)) {
      saved.push(id);
      memoryCache.set('saved_ids', saved);
    }
    try {
      if (!cacheDir.exists) cacheDir.create();
      trailFile(id).write(JSON.stringify(data));
      savedIdsFile.write(JSON.stringify(saved));
    } catch {}
  },

  removeOfflineTrail(id: string) {
    memoryCache.delete(`trail_${id}`);
    const saved = this.getSavedTrailIds().filter((tid) => tid !== id);
    memoryCache.set('saved_ids', saved);
    try {
      const f = trailFile(id);
      if (f.exists) f.delete();
      savedIdsFile.write(JSON.stringify(saved));
    } catch {}
  },

  getSavedTrailIds(): string[] {
    return (memoryCache.get('saved_ids') as string[]) ?? [];
  },

  isTrailSavedOffline(id: string): boolean {
    return this.getSavedTrailIds().includes(id);
  },
};
