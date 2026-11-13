// Pure helpers for the trail review queue and review screen (covered by tests/trail-review.test.mjs).

export type ReviewFilter = "unreviewed" | "reviewed" | "flagged" | "all";
export const REVIEW_FILTERS: ReviewFilter[] = ["unreviewed", "reviewed", "flagged", "all"];

export interface QueueTrail {
  id: string;
  name_en: string;
  name_ka: string | null;
  region: string;
  difficulty: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  estimated_hours: number | null;
  is_published: boolean;
  reviewed_at: string | null;
  review_flags: string[];
  photos: number;
}

export interface ReviewCounts {
  unreviewed: number;
  reviewed: number;
  flagged: number;
  all: number;
}

export interface ReviewQueuePage {
  data: QueueTrail[];
  total: number;
  counts: ReviewCounts;
  regions: string[];
  // Trails the bulk action would mark: not reviewed and without flags, in any region.
  unflaggedUnreviewed: number;
}

// Reasons the content pipeline sets in trails.review_flags.
const FLAG_LABELS: Record<string, string> = {
  manual_review: "Needs manual review",
  generated_name: "Generated name",
  near_border: "Near the border",
  synthetic_elevation: "Synthetic elevation",
  reversed: "Route reversed",
  rebuilt: "Route rebuilt",
};

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.replace(/_/g, " ");
}

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  offensive: "Offensive",
  harassment: "Harassment",
  dangerous: "Dangerous",
  other: "Other",
  wrong_route: "Wrong route",
  path_missing: "Path missing",
  wrong_info: "Wrong information",
};

export function reportReasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

export function matchesFilter(trail: QueueTrail, filter: ReviewFilter): boolean {
  switch (filter) {
    case "unreviewed":
      return trail.reviewed_at === null;
    case "reviewed":
      return trail.reviewed_at !== null;
    case "flagged":
      return trail.review_flags.length > 0;
    default:
      return true;
  }
}

// Unreviewed trails first; among them the most flagged, then by name.
export function compareQueue(a: QueueTrail, b: QueueTrail): number {
  return (
    Number(a.reviewed_at !== null) - Number(b.reviewed_at !== null) ||
    b.review_flags.length - a.review_flags.length ||
    a.name_en.localeCompare(b.name_en)
  );
}

export function buildReviewQueue(
  trails: QueueTrail[],
  options: { filter: ReviewFilter; region: string; page: number; pageSize: number },
): ReviewQueuePage {
  const inRegion = options.region ? trails.filter((t) => t.region === options.region) : trails;
  const count = (filter: ReviewFilter) => inRegion.filter((t) => matchesFilter(t, filter)).length;
  const matching = inRegion.filter((t) => matchesFilter(t, options.filter)).sort(compareQueue);
  const start = (Math.max(1, Math.floor(options.page) || 1) - 1) * options.pageSize;

  return {
    data: matching.slice(start, start + options.pageSize),
    total: matching.length,
    counts: { unreviewed: count("unreviewed"), reviewed: count("reviewed"), flagged: count("flagged"), all: inRegion.length },
    regions: [...new Set(trails.map((t) => t.region).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    unflaggedUnreviewed: trails.filter((t) => t.reviewed_at === null && t.review_flags.length === 0).length,
  };
}

export interface ProfileStats {
  points: [number, number][]; // [distance_m, elevation_m]
  lengthKm: number;
  minM: number;
  maxM: number;
  ascentM: number;
}

// trails.elevation_profile is [[distance_m, elevation_m], ...] or null; anything else is ignored.
export function profileStats(profile: unknown): ProfileStats | null {
  if (!Array.isArray(profile)) return null;
  const points: [number, number][] = [];
  for (const point of profile) {
    if (!Array.isArray(point)) return null;
    const [distance, elevation] = point;
    if (!Number.isFinite(distance) || !Number.isFinite(elevation)) return null;
    points.push([distance, elevation]);
  }
  if (points.length < 2) return null;

  let ascent = 0;
  for (let i = 1; i < points.length; i++) ascent += Math.max(0, points[i][1] - points[i - 1][1]);
  const elevations = points.map(([, e]) => e);
  return {
    points,
    lengthKm: points[points.length - 1][0] / 1000,
    minM: Math.min(...elevations),
    maxM: Math.max(...elevations),
    ascentM: Math.round(ascent),
  };
}
