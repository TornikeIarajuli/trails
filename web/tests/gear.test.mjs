import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GEAR_CATEGORIES, GEAR_LABELS, PRODUCT_GEAR_KEYS, normalizeGearTags, terrainSummary } from "../src/lib/gear.ts";

test("keeps only known gear keys, once each, in catalog order", () => {
  assert.deepEqual(normalizeGearTags(["tent", "hiking_boots", "tent", "passport", 7, null, "headlamp"]), [
    "hiking_boots",
    "tent",
    "headlamp",
  ]);
  assert.deepEqual(normalizeGearTags("tent"), []);
  assert.deepEqual(normalizeGearTags(undefined), []);
  assert.deepEqual(normalizeGearTags([]), []);
});

test("labels every key", () => {
  assert.equal(new Set(PRODUCT_GEAR_KEYS).size, PRODUCT_GEAR_KEYS.length);
  for (const key of PRODUCT_GEAR_KEYS) assert.ok(GEAR_LABELS[key], key);
});

test("summarises terrain in one line", () => {
  assert.equal(
    terrainSummary({ fetched_at: "2026-11-14", coverage: 0.856, max_sac: "T3", fords: 2, water_points: 1, shelters: 0 }),
    "SAC up to T3 · 2 fords · 1 water source · 86% of the route mapped (OpenStreetMap, 2026-11-14)",
  );
  assert.equal(terrainSummary({ max_sac: null, coverage: 0.2 }), "No SAC grade mapped · 20% of the route mapped");
  assert.equal(terrainSummary(null), null);
  assert.equal(terrainSummary([1, 2]), null);
  assert.equal(terrainSummary("T3"), null);
});

// The app's checklist and shop filters use the same keys; a product tagged with a key the
// app doesn't know would never show up there.
test("matches the app's gear catalog", () => {
  const source = readFileSync(fileURLToPath(new URL("../../mobile/utils/gearCatalog.ts", import.meta.url)), "utf8");
  const block = source.slice(source.indexOf("export const SHOP_CATEGORIES"), source.indexOf("export const PRODUCT_GEAR_KEYS"));
  const appCategories = [...block.matchAll(/key: '([a-z_]+)',\s*label: '([^']+)',\s*items: \[([^\]]*)\]/g)].map((m) => ({
    key: m[1],
    label: m[2],
    items: [...m[3].matchAll(/'([a-z_]+)'/g)].map((i) => i[1]),
  }));
  assert.ok(appCategories.length > 0, "could not read SHOP_CATEGORIES from the app");
  assert.deepEqual(
    appCategories,
    GEAR_CATEGORIES.map((c) => ({ key: c.key, label: c.label, items: c.items.map((i) => i.key) })),
  );

  for (const [key, label] of Object.entries(GEAR_LABELS)) {
    assert.match(source, new RegExp(`${key}: \\{ label: '${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`), `label of ${key}`);
  }
});
