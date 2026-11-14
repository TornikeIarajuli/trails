/**
 * What the trail screen says about a trail's terrain (trails.terrain, worked out from
 * OpenStreetMap): the hardest grade, the ground, river crossings, water and huts, one row each.
 */
import type { SacGrade, TrailTerrain } from '../types/trail';
import { SAC_DESCRIPTION } from './gear';

const GRADES: SacGrade[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

/** Green for easy, through amber, to red and purple for alpine. */
export const SAC_COLORS: Record<SacGrade, string> = {
  T1: '#66BB6A',
  T2: '#9CCC65',
  T3: '#FFCA28',
  T4: '#FFA726',
  T5: '#EF5350',
  T6: '#AB47BC',
};

type Surface = keyof TrailTerrain['surfaces_km'];

export const SURFACES: Record<Surface, { label: string; color: string }> = {
  ground: { label: 'Dirt path', color: '#8D6E63' },
  gravel: { label: 'Gravel', color: '#B0A48F' },
  paved: { label: 'Paved', color: '#757575' },
  grass: { label: 'Grass', color: '#7CB342' },
  rock: { label: 'Rock', color: '#90A4AE' },
  other: { label: 'Other', color: '#CFD8DC' },
};

export interface TerrainBarPart {
  key: string;
  km: number;
  color: string;
}

export interface TerrainRow {
  key: 'grade' | 'ground' | 'fords' | 'water' | 'shelters';
  icon: string;
  title: string;
  detail?: string;
  /** Km per grade or surface, longest first, when there is more than one. */
  bar?: TerrainBarPart[];
}

/** "3.6 km", "12 km". */
export function formatKm(km: number): string {
  return `${km >= 10 ? Math.round(km) : Math.round(km * 10) / 10} km`;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The rows of the terrain card, in reading order. */
export function terrainRows(terrain: TrailTerrain): TerrainRow[] {
  const rows: TerrainRow[] = [];

  // The hardest part of the route, and how much of it there is
  if (terrain.max_sac) {
    const parts = GRADES.filter((g) => (terrain.sac_km?.[g] ?? 0) > 0).map((g) => ({
      key: g,
      km: terrain.sac_km[g] as number,
      color: SAC_COLORS[g],
    }));
    const hardestKm = terrain.sac_km?.[terrain.max_sac] ?? 0;
    rows.push({
      key: 'grade',
      icon: 'mountain',
      title: `${SAC_DESCRIPTION[terrain.max_sac]} (${terrain.max_sac})`,
      detail:
        parts.length > 1
          ? `${parts.map((p) => `${p.key} ${formatKm(p.km)}`).join(' · ')}`
          : hardestKm > 0
            ? `${formatKm(hardestKm)} of the route`
            : undefined,
      bar: parts.length > 1 ? parts : undefined,
    });
  }

  // What the ground is like
  const surfaces = (Object.entries(terrain.surfaces_km ?? {}) as [Surface, number][])
    .filter(([, km]) => km > 0)
    .sort((a, b) => b[1] - a[1]);
  if (surfaces.length > 0) {
    const total = surfaces.reduce((sum, [, km]) => sum + km, 0);
    const [topKey, topKm] = surfaces[0];
    const mostly = topKm / total >= 0.8;
    rows.push({
      key: 'ground',
      icon: 'layers',
      title: mostly ? `Mostly ${SURFACES[topKey].label.toLowerCase()}` : 'Mixed ground',
      detail: surfaces.map(([key, km]) => `${SURFACES[key].label} ${formatKm(km)}`).join(' · '),
      bar: surfaces.length > 1 ? surfaces.map(([key, km]) => ({ key, km, color: SURFACES[key].color })) : undefined,
    });
  }

  // River crossings: what hikers most want to know before they go
  rows.push(
    terrain.fords > 0
      ? {
          key: 'fords',
          icon: 'footprints',
          title: `${count(terrain.fords, 'river crossing', 'river crossings')} without a bridge`,
          detail: 'Deeper after rain and snowmelt. River shoes help.',
        }
      : { key: 'fords', icon: 'footprints', title: 'No river crossings without a bridge mapped' },
  );

  // Drinking water on the way
  rows.push(
    terrain.water_points > 0
      ? {
          key: 'water',
          icon: 'droplet',
          title: `${count(terrain.water_points, 'spring or tap', 'springs or taps')} near the route`,
          detail: 'Not checked to be running: carry enough water.',
        }
      : { key: 'water', icon: 'droplet', title: 'No springs or taps mapped near the route', detail: 'Carry all the water you need.' },
  );

  // Huts and shelters, when there are any
  if (terrain.shelters > 0) {
    rows.push({ key: 'shelters', icon: 'house', title: `${count(terrain.shelters, 'hut or shelter', 'huts or shelters')} near the route` });
  }

  return rows;
}

/** "From OpenStreetMap, 13 November 2026", and a word of caution when much of the route is unmapped. */
export function terrainSource(terrain: TrailTerrain): { source: string; caution: string | null } {
  const date = new Date(`${terrain.fetched_at}T12:00:00Z`);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const when = Number.isNaN(date.getTime()) ? '' : `, ${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  const coverage = Math.round((terrain.coverage ?? 1) * 100);
  return {
    source: `From OpenStreetMap${when}`,
    caution:
      coverage < 80
        ? `Only ${coverage}% of the route follows mapped paths, so there may be more than this.`
        : null,
  };
}
