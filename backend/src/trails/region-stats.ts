/**
 * Per-region trail counts and a user's progress through them. Pure: no I/O.
 */

/** A published trail as read from the database. */
export interface RegionTrail {
  id: string;
  region: unknown;
  /** GeoJSON Point from PostgREST (may carry a `crs` member), or its JSON text. */
  start_point?: unknown;
}

export interface RegionSummary {
  region: string;
  total: number;
  /** Mean [lng, lat] of the region's trailheads; null when none is known. */
  center: [number, number] | null;
  trailIds: string[];
}

export interface RegionProgress {
  region: string;
  total: number;
  completed: number;
  center: [number, number] | null;
  completed_trail_ids: string[];
}

export interface RegionProgressResponse {
  regions: RegionProgress[];
  totals: {
    regions_total: number;
    regions_started: number;
    regions_completed: number;
    trails_total: number;
    trails_completed: number;
  };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** [lng, lat] of a GeoJSON Point, or null. */
export function parsePoint(point: unknown): [number, number] | null {
  let geometry = point;
  if (typeof geometry === 'string') {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      return null;
    }
  }
  if (!geometry || typeof geometry !== 'object') return null;

  const { type, coordinates } = geometry as {
    type?: unknown;
    coordinates?: unknown;
  };
  if (type !== 'Point' || !Array.isArray(coordinates)) return null;

  const [lng, lat] = coordinates as unknown[];
  if (
    typeof lng !== 'number' ||
    typeof lat !== 'number' ||
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    Math.abs(lng) > 180 ||
    Math.abs(lat) > 90
  ) {
    return null;
  }
  return [lng, lat];
}

/**
 * Groups trails by `region` exactly as stored (no trimming or case folding), sorted by
 * number of trails (descending), then by name.
 */
export function summarizeRegions(trails: RegionTrail[]): RegionSummary[] {
  const groups = new Map<
    string,
    { trailIds: string[]; lngSum: number; latSum: number; points: number }
  >();

  for (const trail of trails) {
    if (typeof trail.region !== 'string') continue;

    let group = groups.get(trail.region);
    if (!group) {
      group = { trailIds: [], lngSum: 0, latSum: 0, points: 0 };
      groups.set(trail.region, group);
    }
    group.trailIds.push(trail.id);

    const point = parsePoint(trail.start_point);
    if (point) {
      group.lngSum += point[0];
      group.latSum += point[1];
      group.points++;
    }
  }

  return [...groups.entries()]
    .map(([region, group]) => ({
      region,
      total: group.trailIds.length,
      center:
        group.points > 0
          ? ([
              round6(group.lngSum / group.points),
              round6(group.latSum / group.points),
            ] as [number, number])
          : null,
      trailIds: group.trailIds,
    }))
    .sort(
      (a, b) => b.total - a.total || a.region.localeCompare(b.region, 'en'),
    );
}

/**
 * A user's progress per region. Completions of trails that are not in `summaries`
 * (unpublished or deleted) are ignored.
 */
export function regionProgress(
  summaries: RegionSummary[],
  completedTrailIds: Iterable<string>,
): RegionProgressResponse {
  const done = new Set(completedTrailIds);

  const regions = summaries.map((summary) => {
    const completedIds = summary.trailIds.filter((id) => done.has(id));
    return {
      region: summary.region,
      total: summary.total,
      completed: completedIds.length,
      center: summary.center,
      completed_trail_ids: completedIds,
    };
  });

  return {
    regions,
    totals: {
      regions_total: regions.length,
      regions_started: regions.filter((r) => r.completed > 0).length,
      regions_completed: regions.filter(
        (r) => r.total > 0 && r.completed === r.total,
      ).length,
      trails_total: regions.reduce((sum, r) => sum + r.total, 0),
      trails_completed: regions.reduce((sum, r) => sum + r.completed, 0),
    },
  };
}
