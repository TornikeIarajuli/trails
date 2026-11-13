/**
 * The gear items a shop product can cover. The app builds each trail's "What to bring" list
 * from the same keys (mobile/utils/gearCatalog.ts) and links an item to the products tagged
 * with it, and the in-app shop filters by these categories. tests/gear.test.mjs checks both
 * lists stay the same — add a key in both places.
 */
export const GEAR_CATEGORIES: { key: string; label: string; items: { key: string; label: string }[] }[] = [
  {
    key: "footwear",
    label: "Footwear",
    items: [
      { key: "hiking_boots", label: "Hiking boots" },
      { key: "trail_shoes", label: "Trail shoes" },
      { key: "river_shoes", label: "Sandals for river crossings" },
      { key: "hiking_socks", label: "Hiking socks" },
    ],
  },
  {
    key: "clothing",
    label: "Clothing",
    items: [
      { key: "rain_jacket", label: "Rain jacket" },
      { key: "warm_layer", label: "Warm layer" },
      { key: "hat_gloves", label: "Warm hat and gloves" },
      { key: "quick_dry_clothes", label: "Quick-dry clothes" },
      { key: "sun_protection", label: "Sun protection" },
    ],
  },
  {
    key: "packs",
    label: "Backpacks",
    items: [
      { key: "daypack", label: "Daypack" },
      { key: "backpack", label: "Large backpack" },
    ],
  },
  {
    key: "camping",
    label: "Camping",
    items: [
      { key: "tent", label: "Tent" },
      { key: "sleeping_bag", label: "Sleeping bag" },
      { key: "sleeping_mat", label: "Sleeping mat" },
      { key: "stove", label: "Stove and pot" },
    ],
  },
  {
    key: "equipment",
    label: "Equipment",
    items: [
      { key: "trekking_poles", label: "Trekking poles" },
      { key: "headlamp", label: "Headlamp" },
      { key: "power_bank", label: "Power bank" },
      { key: "water", label: "Water" },
      { key: "water_filter", label: "Water filter" },
      { key: "knife", label: "Knife or multitool" },
    ],
  },
  {
    key: "safety",
    label: "Safety",
    items: [
      { key: "first_aid", label: "First-aid kit" },
      { key: "helmet", label: "Helmet" },
      { key: "microspikes", label: "Microspikes" },
    ],
  },
];

export const PRODUCT_GEAR_KEYS: string[] = GEAR_CATEGORIES.flatMap((c) => c.items.map((i) => i.key));

export const GEAR_LABELS: Record<string, string> = Object.fromEntries(
  GEAR_CATEGORIES.flatMap((c) => c.items.map((i) => [i.key, i.label])),
);

/** Matches the CHECK constraint on trails.gear_notes (migration 053). */
export const GEAR_NOTES_MAX = 2000;

/** Known keys only, each once, in catalog order. Anything that isn't an array gives []. */
export function normalizeGearTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const wanted = new Set(input.filter((v): v is string => typeof v === "string"));
  return PRODUCT_GEAR_KEYS.filter((key) => wanted.has(key));
}

interface Terrain {
  fetched_at?: string;
  coverage?: number;
  max_sac?: string | null;
  fords?: number;
  water_points?: number;
  shelters?: number;
}

/** One line for the trail editor, e.g. "SAC up to T3 · 2 fords · 4 water sources · 86% of the route mapped". */
export function terrainSummary(terrain: unknown): string | null {
  if (!terrain || typeof terrain !== "object" || Array.isArray(terrain)) return null;
  const t = terrain as Terrain;
  const count = (n: number | undefined, one: string, many: string) =>
    typeof n === "number" && n > 0 ? `${n} ${n === 1 ? one : many}` : null;
  const parts = [
    t.max_sac ? `SAC up to ${t.max_sac}` : "No SAC grade mapped",
    count(t.fords, "ford", "fords"),
    count(t.water_points, "water source", "water sources"),
    count(t.shelters, "shelter", "shelters"),
    typeof t.coverage === "number" ? `${Math.round(t.coverage * 100)}% of the route mapped` : null,
  ].filter(Boolean);
  return `${parts.join(" · ")}${t.fetched_at ? ` (OpenStreetMap, ${t.fetched_at})` : ""}`;
}
