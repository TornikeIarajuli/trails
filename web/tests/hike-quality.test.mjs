import { test } from "node:test";
import assert from "node:assert/strict";
import { needsCheck, normalizeQualityRow, qualityConcerns, sortQualityRows } from "../src/lib/hike-quality.ts";

const row = (overrides = {}) => ({
  trail_id: "t1",
  name_en: "Trail",
  hikes: 5,
  verified: 5,
  median_coverage: 0.9,
  median_off_route: 0.05,
  median_hours: 3,
  estimated_hours: 3,
  median_distance_km: 8,
  distance_km: 8,
  last_hike: "2026-11-01T10:00:00Z",
  ...overrides,
});

test("a trail whose hikes match its data needs no check", () => {
  assert.deepEqual(qualityConcerns(row()), []);
  assert.equal(needsCheck(row()), false);
});

test("fewer than 3 hikes never trigger a check, however bad they look", () => {
  const bad = { verified: 0, median_off_route: 0.9, median_hours: 10 };
  assert.equal(needsCheck(row({ hikes: 2, ...bad })), false);
  assert.equal(needsCheck(row({ hikes: 1, ...bad })), false);
  assert.equal(needsCheck(row({ hikes: 3, ...bad })), true);
});

test("less than half of the hikes verified triggers a check; exactly half does not", () => {
  assert.equal(needsCheck(row({ hikes: 4, verified: 1 })), true);
  assert.equal(needsCheck(row({ hikes: 4, verified: 2 })), false);
  assert.match(qualityConcerns(row({ hikes: 4, verified: 1 }))[0], /25% of hikes verified/);
});

test("median off-route above 30% triggers a check; exactly 30% or unknown does not", () => {
  assert.equal(needsCheck(row({ median_off_route: 0.31 })), true);
  assert.equal(needsCheck(row({ median_off_route: 0.3 })), false);
  assert.equal(needsCheck(row({ median_off_route: null })), false);
});

test("hikes much longer or shorter than the estimate trigger a check", () => {
  assert.equal(needsCheck(row({ median_hours: 4.6, estimated_hours: 3 })), true);
  assert.equal(needsCheck(row({ median_hours: 4.5, estimated_hours: 3 })), false); // exactly 1.5x
  assert.equal(needsCheck(row({ median_hours: 1.4, estimated_hours: 3 })), true);
  assert.equal(needsCheck(row({ median_hours: 1.5, estimated_hours: 3 })), false); // exactly 0.5x
  assert.equal(needsCheck(row({ median_hours: 9, estimated_hours: null })), false);
  assert.equal(needsCheck(row({ median_hours: 9, estimated_hours: 0 })), false);
  assert.equal(needsCheck(row({ median_hours: null })), false);
});

test("every failing rule is listed", () => {
  const concerns = qualityConcerns(row({ hikes: 4, verified: 0, median_off_route: 0.6, median_hours: 7, estimated_hours: 3 }));
  assert.equal(concerns.length, 3);
});

test("normalizeQualityRow turns numeric strings into numbers and keeps unknowns null", () => {
  const n = normalizeQualityRow({
    trail_id: "a", name_en: "A", hikes: "4", verified: 3, median_coverage: "0.812", median_off_route: null,
    median_hours: "2.50", estimated_hours: "3.0", median_distance_km: "", distance_km: "abc", last_hike: null,
  });
  assert.deepEqual(n, {
    trail_id: "a", name_en: "A", hikes: 4, verified: 3, median_coverage: 0.812, median_off_route: null,
    median_hours: 2.5, estimated_hours: 3, median_distance_km: null, distance_km: null, last_hike: null,
  });
});

test("sortQualityRows sorts by the chosen column with missing values last", () => {
  const rows = [
    row({ trail_id: "a", name_en: "Alpha", hikes: 2, median_off_route: 0.2 }),
    row({ trail_id: "b", name_en: "Bravo", hikes: 6, median_off_route: null }),
    row({ trail_id: "c", name_en: "Charlie", hikes: 4, median_off_route: 0.5 }),
  ];
  assert.deepEqual(sortQualityRows(rows, "off_route", "desc").map((r) => r.trail_id), ["c", "a", "b"]);
  assert.deepEqual(sortQualityRows(rows, "off_route", "asc").map((r) => r.trail_id), ["a", "c", "b"]);
  assert.deepEqual(sortQualityRows(rows, "hikes", "desc").map((r) => r.trail_id), ["b", "c", "a"]);
  assert.deepEqual(sortQualityRows(rows, "name", "asc").map((r) => r.trail_id), ["a", "b", "c"]);
  // "check" puts the trails with the most concerns first.
  assert.deepEqual(sortQualityRows(rows, "check", "desc").map((r) => r.trail_id), ["c", "b", "a"]);
  assert.notEqual(sortQualityRows(rows, "hikes", "asc"), rows); // returns a new array
});
