import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewQueue,
  compareQueue,
  flagLabel,
  matchesFilter,
  profileStats,
  reportReasonLabel,
} from "../src/lib/trail-review.ts";
import { checkpointPosition } from "../src/lib/geo.ts";

const trail = (id, overrides = {}) => ({
  id,
  name_en: id,
  name_ka: null,
  region: "Kazbegi",
  difficulty: "medium",
  distance_km: 10,
  elevation_gain_m: 500,
  estimated_hours: 4,
  is_published: true,
  reviewed_at: null,
  review_flags: [],
  photos: 0,
  ...overrides,
});

const TRAILS = [
  trail("Zeta"),
  trail("Alpha", { review_flags: ["near_border"] }),
  trail("Beta", { review_flags: ["manual_review", "generated_name"], region: "Svaneti" }),
  trail("Gamma", { reviewed_at: "2026-11-10T00:00:00Z", review_flags: ["rebuilt", "reversed", "near_border"] }),
  trail("Delta", { reviewed_at: "2026-11-11T00:00:00Z" }),
  trail("Epsilon", { region: "Svaneti" }),
];

test("the queue puts unreviewed trails first, the most flagged on top, then by name", () => {
  const order = [...TRAILS].sort(compareQueue).map((t) => t.id);
  assert.deepEqual(order, ["Beta", "Alpha", "Epsilon", "Zeta", "Gamma", "Delta"]);
});

test("filters select unreviewed, reviewed, flagged or all trails", () => {
  const ids = (filter) => TRAILS.filter((t) => matchesFilter(t, filter)).map((t) => t.id).sort();
  assert.deepEqual(ids("unreviewed"), ["Alpha", "Beta", "Epsilon", "Zeta"]);
  assert.deepEqual(ids("reviewed"), ["Delta", "Gamma"]);
  assert.deepEqual(ids("flagged"), ["Alpha", "Beta", "Gamma"]);
  assert.equal(ids("all").length, TRAILS.length);
});

test("buildReviewQueue filters, counts per region, pages, and counts the bulk-action trails globally", () => {
  const all = buildReviewQueue(TRAILS, { filter: "unreviewed", region: "", page: 1, pageSize: 2 });
  assert.deepEqual(all.data.map((t) => t.id), ["Beta", "Alpha"]);
  assert.equal(all.total, 4);
  assert.deepEqual(all.counts, { unreviewed: 4, reviewed: 2, flagged: 3, all: 6 });
  assert.deepEqual(all.regions, ["Kazbegi", "Svaneti"]);
  assert.equal(all.unflaggedUnreviewed, 2); // Zeta and Epsilon

  const page2 = buildReviewQueue(TRAILS, { filter: "unreviewed", region: "", page: 2, pageSize: 2 });
  assert.deepEqual(page2.data.map((t) => t.id), ["Epsilon", "Zeta"]);
  assert.deepEqual(buildReviewQueue(TRAILS, { filter: "unreviewed", region: "", page: 9, pageSize: 2 }).data, []);

  const svaneti = buildReviewQueue(TRAILS, { filter: "all", region: "Svaneti", page: 1, pageSize: 50 });
  assert.deepEqual(svaneti.data.map((t) => t.id), ["Beta", "Epsilon"]);
  assert.deepEqual(svaneti.counts, { unreviewed: 2, reviewed: 0, flagged: 1, all: 2 });
  assert.equal(svaneti.unflaggedUnreviewed, 2); // not limited to the region
  assert.deepEqual(svaneti.regions, ["Kazbegi", "Svaneti"]);
});

test("profileStats reads [distance_m, elevation_m] pairs and rejects anything else", () => {
  const stats = profileStats([[0, 1000], [500, 1100], [1000, 1050], [2500, 1300]]);
  assert.deepEqual(stats, {
    points: [[0, 1000], [500, 1100], [1000, 1050], [2500, 1300]],
    lengthKm: 2.5,
    minM: 1000,
    maxM: 1300,
    ascentM: 350,
  });
  for (const bad of [null, undefined, "[]", {}, [], [[0, 1000]], [[0, 1000], [100]], [[0, 1000], [100, "x"]], [[0, 1000], [100, NaN]]]) {
    assert.equal(profileStats(bad), null, JSON.stringify(bad));
  }
});

test("labels for pipeline flags and report reasons, with a readable fallback", () => {
  assert.equal(flagLabel("generated_name"), "Generated name");
  assert.equal(flagLabel("synthetic_elevation"), "Synthetic elevation");
  assert.equal(flagLabel("some_new_flag"), "some new flag");
  assert.equal(reportReasonLabel("wrong_route"), "Wrong route");
  assert.equal(reportReasonLabel("path_missing"), "Path missing");
  assert.equal(reportReasonLabel("wrong_info"), "Wrong information");
  assert.equal(reportReasonLabel("spam"), "Spam");
});

test("checkpointPosition reads GeoJSON [lng, lat] points", () => {
  assert.deepEqual(checkpointPosition({ coordinates: { type: "Point", coordinates: [44.61, 42.66] } }), { lat: 42.66, lng: 44.61 });
  assert.equal(checkpointPosition({ coordinates: null }), null);
  assert.equal(checkpointPosition({ coordinates: { type: "Point", coordinates: "x" } }), null);
});
