// Pure helpers for the hike quality report (covered by tests/hike-quality.test.mjs).

export interface HikeQualityRow {
  trail_id: string;
  name_en: string;
  hikes: number;
  verified: number;
  median_coverage: number | null; // share of the route the track passed near, 0..1
  median_off_route: number | null; // share of the track more than 120 m from the route, 0..1
  median_hours: number | null;
  estimated_hours: number | null;
  median_distance_km: number | null;
  distance_km: number | null;
  last_hike: string | null;
}

export const MIN_HIKES_FOR_CHECK = 3;

const percent = (share: number) => `${Math.round(share * 100)}%`;
const hours = (h: number) => `${h.toFixed(1)} h`;

// Why the recorded hikes suggest the trail's data is wrong. Empty when they don't, or when
// there are too few hikes to tell.
export function qualityConcerns(row: HikeQualityRow): string[] {
  if (!(row.hikes >= MIN_HIKES_FOR_CHECK)) return [];
  const concerns: string[] = [];

  const verifiedShare = row.verified / row.hikes;
  if (verifiedShare < 0.5) concerns.push(`Only ${percent(verifiedShare)} of hikes verified`);

  if (row.median_off_route !== null && row.median_off_route > 0.3) {
    concerns.push(`Hikers are off the route for ${percent(row.median_off_route)} of their track (median)`);
  }

  if (row.median_hours !== null && row.estimated_hours !== null && row.estimated_hours > 0) {
    if (row.median_hours > 1.5 * row.estimated_hours) {
      concerns.push(`Hikes take ${hours(row.median_hours)}, estimated ${hours(row.estimated_hours)}`);
    } else if (row.median_hours < 0.5 * row.estimated_hours) {
      concerns.push(`Hikes take only ${hours(row.median_hours)}, estimated ${hours(row.estimated_hours)}`);
    }
  }
  return concerns;
}

export function needsCheck(row: HikeQualityRow): boolean {
  return qualityConcerns(row).length > 0;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Postgres numeric values may arrive as strings; counts default to 0.
export function normalizeQualityRow(raw: Record<string, unknown>): HikeQualityRow {
  return {
    trail_id: String(raw.trail_id ?? ""),
    name_en: String(raw.name_en ?? ""),
    hikes: toNumber(raw.hikes) ?? 0,
    verified: toNumber(raw.verified) ?? 0,
    median_coverage: toNumber(raw.median_coverage),
    median_off_route: toNumber(raw.median_off_route),
    median_hours: toNumber(raw.median_hours),
    estimated_hours: toNumber(raw.estimated_hours),
    median_distance_km: toNumber(raw.median_distance_km),
    distance_km: toNumber(raw.distance_km),
    last_hike: typeof raw.last_hike === "string" ? raw.last_hike : null,
  };
}

export type QualitySortKey =
  | "check"
  | "name"
  | "hikes"
  | "verified"
  | "coverage"
  | "off_route"
  | "hours"
  | "distance"
  | "last_hike";

function sortValue(row: HikeQualityRow, key: QualitySortKey): number | string | null {
  switch (key) {
    case "check":
      return qualityConcerns(row).length;
    case "name":
      return row.name_en.toLocaleLowerCase();
    case "hikes":
      return row.hikes;
    case "verified":
      return row.hikes > 0 ? row.verified / row.hikes : null;
    case "coverage":
      return row.median_coverage;
    case "off_route":
      return row.median_off_route;
    case "hours":
      return row.median_hours;
    case "distance":
      return row.median_distance_km;
    case "last_hike":
      return row.last_hike ? Date.parse(row.last_hike) : null;
  }
}

// Missing values sort last in either direction; ties are broken by hikes (most first), then name.
export function sortQualityRows(rows: HikeQualityRow[], key: QualitySortKey, direction: "asc" | "desc"): HikeQualityRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va !== vb) {
      if (va === null) return 1;
      if (vb === null) return -1;
      const order = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : (va as number) - (vb as number);
      if (order !== 0) return sign * order;
    }
    return b.hikes - a.hikes || a.name_en.localeCompare(b.name_en);
  });
}
