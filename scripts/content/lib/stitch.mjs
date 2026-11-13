// Turns the member ways of an OSM route relation into one continuous line in travel order.
// Nothing here guesses: if the ways do not form a line (gaps > maxGapM, real branches,
// parallel alternatives) the result is { ok: false, reason } and the caller keeps what it had.
import { haversineM, lineLengthM } from './geo.mjs';

const SIDE_ROLE = /^(alternat|excursion|approach|connection|link|variant|shortcut|detour|side|spur|branch|platform|stop|guidepost|information|board|map|viewpoint)/i;

/** Ways of the main line: drops members whose role marks them as alternatives/excursions. */
export function mainWays(ways) {
  const main = ways.filter((w) => !SIDE_ROLE.test(w.role ?? ''));
  return main.length ? main : ways;
}

const keyOf = (c) => `${c[0].toFixed(7)},${c[1].toFixed(7)}`;

function buildGraph(ways) {
  const nodes = new Map();
  const node = (c) => {
    const k = keyOf(c);
    let n = nodes.get(k);
    if (!n) nodes.set(k, (n = { k, c, adj: new Map() }));
    return n;
  };
  for (const w of ways) {
    for (let i = 1; i < w.coords.length; i++) {
      const a = node(w.coords[i - 1]);
      const b = node(w.coords[i]);
      if (a === b) continue;
      const len = haversineM(a.c, b.c);
      a.adj.set(b.k, len);
      b.adj.set(a.k, len);
    }
  }
  return nodes;
}

function components(nodes) {
  const comp = new Map();
  const list = [];
  for (const n of nodes.values()) {
    if (comp.has(n.k)) continue;
    const members = [];
    const queue = [n];
    comp.set(n.k, list.length);
    while (queue.length) {
      const cur = queue.pop();
      members.push(cur);
      for (const nk of cur.adj.keys()) {
        if (!comp.has(nk)) {
          comp.set(nk, list.length);
          queue.push(nodes.get(nk));
        }
      }
    }
    list.push(members);
  }
  return list;
}

function graphLengthM(nodes) {
  let total = 0;
  for (const n of nodes.values()) for (const len of n.adj.values()) total += len;
  return total / 2;
}

/** Connects components whose closest way-end is within maxGapM of the other part. */
function bridgeGaps(nodes, maxGapM) {
  let comps = components(nodes);
  const bridged = [];
  while (comps.length > 1) {
    let best = null;
    for (let i = 0; i < comps.length; i++) {
      const ends = comps[i].filter((n) => n.adj.size <= 1);
      const from = ends.length ? ends : comps[i];
      for (let j = 0; j < comps.length; j++) {
        if (i === j) continue;
        for (const a of from)
          for (const b of comps[j]) {
            // cheap reject before the trig
            if (Math.abs(a.c[1] - b.c[1]) > 0.01 || Math.abs(a.c[0] - b.c[0]) > 0.02) continue;
            const d = haversineM(a.c, b.c);
            if (!best || d < best.d) best = { d, a, b };
          }
      }
    }
    if (!best || best.d > maxGapM) {
      return { ok: false, parts: comps.length, nearestGapM: best ? Math.round(best.d) : null, bridged };
    }
    best.a.adj.set(best.b.k, best.d);
    best.b.adj.set(best.a.k, best.d);
    bridged.push(Math.round(best.d));
    comps = components(nodes);
  }
  return { ok: true, bridged };
}

function walk(nodes, start, firstStep = null) {
  const out = [start.c];
  let prev = null;
  let cur = start;
  for (;;) {
    let next = null;
    if (cur === start && firstStep && prev === null) next = firstStep;
    else {
      for (const nk of cur.adj.keys()) {
        if (!prev || nk !== prev.k) {
          next = nodes.get(nk);
          break;
        }
      }
    }
    if (!next) break;
    out.push(next.c);
    if (next === start) break;
    prev = cur;
    cur = next;
    if (out.length > nodes.size + 2) break;
  }
  return out;
}

function farthest(nodes, start) {
  const dist = new Map([[start.k, 0]]);
  const parent = new Map();
  const stack = [start];
  let far = start;
  while (stack.length) {
    const cur = stack.pop();
    const d = dist.get(cur.k);
    if (d > dist.get(far.k)) far = cur;
    for (const [nk, len] of cur.adj) {
      if (dist.has(nk)) continue;
      dist.set(nk, d + len);
      parent.set(nk, cur.k);
      stack.push(nodes.get(nk));
    }
  }
  return { far, dist: dist.get(far.k), parent };
}

/** Removes dangling chains; returns the 2-core plus the spur lengths that were removed. */
function pruneSpurs(nodes) {
  const core = new Map();
  for (const n of nodes.values()) core.set(n.k, { k: n.k, c: n.c, adj: new Map(n.adj) });
  const spurs = [];
  const queue = [...core.values()].filter((n) => n.adj.size === 1);
  while (queue.length) {
    let cur = queue.pop();
    if (!core.has(cur.k) || cur.adj.size !== 1) continue;
    const chain = [cur.c];
    let len = 0;
    while (cur && cur.adj.size === 1) {
      const [nk, l] = [...cur.adj][0];
      const next = core.get(nk);
      core.delete(cur.k);
      next.adj.delete(cur.k);
      len += l;
      chain.push(next.c);
      cur = next;
    }
    if (cur && cur.adj.size === 0) core.delete(cur.k);
    spurs.push({ lengthM: len, chain, attach: cur ? cur.k : null });
    if (cur && cur.adj.size === 1) queue.push(cur);
  }
  return { core, spurs };
}

function stitchGraph(ways, maxGapM, { allowBridging, spurTolerance }) {
  const nodes = buildGraph(ways);
  if (nodes.size < 2) return { ok: false, reason: 'no usable ways' };

  let bridged = [];
  const comps = components(nodes);
  if (comps.length > 1) {
    if (!allowBridging) return { ok: false, reason: `${comps.length} disconnected parts` };
    const res = bridgeGaps(nodes, maxGapM);
    bridged = res.bridged;
    if (!res.ok) {
      return {
        ok: false,
        reason: `${res.parts} disconnected parts; nearest remaining gap ${res.nearestGapM != null ? `${res.nearestGapM} m` : 'over 1 km'} (> ${maxGapM} m)`,
      };
    }
  }

  const totalM = graphLengthM(nodes);
  const ends = [...nodes.values()].filter((n) => n.adj.size === 1);
  const junctions = [...nodes.values()].filter((n) => n.adj.size >= 3);
  const firstWay = ways[0].coords;
  const lastWay = ways[ways.length - 1].coords;
  const base = { ok: true, maxGapM: bridged.length ? Math.max(...bridged) : 0, gaps: bridged, droppedM: 0, totalWaysM: totalM };

  if (junctions.length === 0 && ends.length === 2) {
    const firstKeys = new Set([keyOf(firstWay[0]), keyOf(firstWay[firstWay.length - 1])]);
    const lastKeys = new Set([keyOf(lastWay[0]), keyOf(lastWay[lastWay.length - 1])]);
    let start = ends[0];
    if (firstKeys.has(ends[1].k) && !firstKeys.has(ends[0].k)) start = ends[1];
    else if (!firstKeys.has(ends[0].k) && lastKeys.has(ends[0].k) && !lastKeys.has(ends[1].k)) start = ends[1];
    return { ...base, coords: walk(nodes, start), shape: 'line', method: 'graph' };
  }

  if (junctions.length === 0 && ends.length === 0) {
    const start = nodes.get(keyOf(firstWay[0]));
    const second = nodes.get(keyOf(firstWay[1]));
    return { ...base, coords: walk(nodes, start, second), shape: 'loop', method: 'graph' };
  }

  if (!spurTolerance) return { ok: false, reason: `${junctions.length} junction(s): the ways branch` };

  const edgeCount = [...nodes.values()].reduce((n, v) => n + v.adj.size, 0) / 2;
  if (edgeCount === nodes.size - 1) {
    // A tree: the main line is its longest path; anything else is a side spur.
    const a = farthest(nodes, ends[0]).far;
    const { far: b, dist, parent } = farthest(nodes, a);
    const dropped = totalM - dist;
    if (dropped > spurTolerance * totalM) {
      return { ok: false, reason: `branches: longest line covers only ${Math.round((dist / totalM) * 100)}% of the ways` };
    }
    const coords = [];
    for (let k = b.k; k !== undefined; k = parent.get(k)) coords.push(nodes.get(k).c);
    coords.reverse();
    const firstKeys = new Set(firstWay.map(keyOf));
    if (!firstKeys.has(keyOf(coords[0])) && firstKeys.has(keyOf(coords[coords.length - 1]))) coords.reverse();
    return { ...base, coords, shape: 'line', method: 'graph-longest-path', droppedM: Math.round(dropped) };
  }

  const { core, spurs } = pruneSpurs(nodes);
  const coreIsCycle = core.size >= 3 && [...core.values()].every((n) => n.adj.size === 2);
  if (!coreIsCycle) return { ok: false, reason: 'the ways form several loops or parallel alternatives' };

  const spurTotal = spurs.reduce((n, s) => n + s.lengthM, 0);
  const longSpurs = spurs.filter((s) => s.lengthM > spurTolerance * totalM);
  if (longSpurs.length === 0) {
    if (spurTotal > spurTolerance * totalM) {
      return { ok: false, reason: `a loop with side branches adding up to ${Math.round((spurTotal / totalM) * 100)}% of the ways` };
    }
    const startKey = core.has(keyOf(firstWay[0])) ? keyOf(firstWay[0]) : [...core.keys()][0];
    const start = core.get(startKey);
    const second = core.has(keyOf(firstWay[1])) && start.adj.has(keyOf(firstWay[1])) ? core.get(keyOf(firstWay[1])) : null;
    return { ...base, coords: walk(core, start, second), shape: 'loop', method: 'graph-loop', droppedM: Math.round(spurTotal) };
  }
  if (longSpurs.length === 1 && spurTotal - longSpurs[0].lengthM <= spurTolerance * totalM) {
    // Lollipop: walk the stem in, go round the loop, walk the stem back.
    const stem = longSpurs[0];
    const start = core.get(stem.attach);
    if (!start) return { ok: false, reason: 'stem does not attach to the loop' };
    const loop = walk(core, start);
    const coords = [...stem.chain.slice(0, -1), ...loop, ...stem.chain.slice(0, -1).reverse()];
    return { ...base, coords, shape: 'lollipop', method: 'graph-lollipop', droppedM: Math.round(spurTotal - stem.lengthM) };
  }
  return { ok: false, reason: `a loop with ${longSpurs.length} long branches` };
}

function stitchSequential(ways, maxGapM) {
  if (!ways.length) return { ok: false, reason: 'no ways' };
  let first = ways[0].coords;
  if (ways.length > 1) {
    const next = ways[1].coords;
    const ends = [next[0], next[next.length - 1]];
    const fromEnd = Math.min(...ends.map((e) => haversineM(first[first.length - 1], e)));
    const fromStart = Math.min(...ends.map((e) => haversineM(first[0], e)));
    if (fromStart < fromEnd) first = first.slice().reverse();
  }
  const line = first.slice();
  const gaps = [];
  for (let i = 1; i < ways.length; i++) {
    const w = ways[i].coords;
    const tail = line[line.length - 1];
    const dFirst = haversineM(tail, w[0]);
    const dLast = haversineM(tail, w[w.length - 1]);
    const seg = dFirst <= dLast ? w : w.slice().reverse();
    const gap = Math.min(dFirst, dLast);
    if (gap > maxGapM) {
      return { ok: false, reason: `members are not in travel order (gap of ${Math.round(gap)} m after member ${i})` };
    }
    if (gap > 1) gaps.push(Math.round(gap));
    line.push(...(gap < 0.01 ? seg.slice(1) : seg));
  }
  const closed = haversineM(line[0], line[line.length - 1]) < 30;
  return {
    ok: true,
    coords: line,
    shape: closed ? 'loop' : 'line',
    method: 'member-order',
    maxGapM: gaps.length ? Math.max(...gaps) : 0,
    gaps,
    droppedM: 0,
    totalWaysM: ways.reduce((n, w) => n + lineLengthM(w.coords), 0),
  };
}

/**
 * ways: [{ id, role, coords: [[lng,lat], …] }] in relation member order.
 * Returns { ok, coords, shape: 'line'|'loop'|'lollipop', method, maxGapM, gaps[], droppedM } or { ok:false, reason }.
 */
export function stitchWays(allWays, { maxGapM = 150, spurTolerance = 0.1 } = {}) {
  const ways = mainWays(allWays.filter((w) => w.coords && w.coords.length >= 2));
  if (!ways.length) return { ok: false, reason: 'relation has no way members with geometry' };

  // 1. The ways share nodes and form exactly one line or one ring — unambiguous.
  const pure = stitchGraph(ways, maxGapM, { allowBridging: false, spurTolerance: 0 });
  if (pure.ok) return pure;

  // 2. Members are already in travel order (covers out-and-back and small gaps).
  const seq = stitchSequential(ways, maxGapM);
  if (seq.ok) return seq;

  // 3. Unordered members with small gaps or short side spurs.
  const loose = stitchGraph(ways, maxGapM, { allowBridging: true, spurTolerance });
  if (loose.ok) return loose;

  return { ok: false, reason: loose.reason ?? seq.reason ?? pure.reason, tried: [pure.reason, seq.reason, loose.reason] };
}

/** Reverses/rotates a stitched line so it starts where the reference route starts. */
export function orientLike(result, refStart, refEnd, refQuarter = null) {
  let coords = result.coords;
  if (result.shape === 'loop') {
    const ring = coords.slice(0, -1);
    let bestI = 0;
    let bestD = Infinity;
    ring.forEach((c, i) => {
      const d = haversineM(c, refStart);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    let rotated = [...ring.slice(bestI), ...ring.slice(0, bestI)];
    rotated.push(rotated[0]);
    if (refQuarter) {
      const q = Math.floor(rotated.length / 4);
      const fwd = haversineM(rotated[q], refQuarter);
      const rev = haversineM(rotated[rotated.length - 1 - q], refQuarter);
      if (rev < fwd) rotated = rotated.slice().reverse();
    }
    return { ...result, coords: rotated };
  }
  const asIs = haversineM(coords[0], refStart) + haversineM(coords[coords.length - 1], refEnd);
  const flipped = haversineM(coords[0], refEnd) + haversineM(coords[coords.length - 1], refStart);
  if (flipped < asIs) coords = coords.slice().reverse();
  return { ...result, coords };
}

class MinHeap {
  constructor() {
    this.a = [];
  }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

function nearestNode(nodes, p) {
  let best = null;
  let bestD = Infinity;
  for (const n of nodes.values()) {
    if (Math.abs(n.c[1] - p[1]) > 0.05 || Math.abs(n.c[0] - p[0]) > 0.07) continue;
    const d = haversineM(n.c, p);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return { node: best, distM: bestD };
}

/**
 * The walk along a relation's ways between the vertices nearest to two anchor points
 * (e.g. two villages of a longer trek). The line follows mapped ways only. `alternatives`
 * lists every stretch where the ways offer another way round, so the caller can tell a
 * unique line from a choice between variants.
 */
export function pathBetween(allWays, from, to, { maxGapM = 150, maxSnapM = 400 } = {}) {
  const ways = mainWays(allWays.filter((w) => w.coords && w.coords.length >= 2));
  if (!ways.length) return { ok: false, reason: 'relation has no way members with geometry' };
  const nodes = buildGraph(ways);
  const bridged = bridgeGaps(nodes, maxGapM).bridged;
  const a = nearestNode(nodes, from);
  const b = nearestNode(nodes, to);
  if (!a.node || a.distM > maxSnapM) return { ok: false, reason: `start anchor is ${a.node ? Math.round(a.distM) : '>5000'} m from the relation's ways` };
  if (!b.node || b.distM > maxSnapM) return { ok: false, reason: `end anchor is ${b.node ? Math.round(b.distM) : '>5000'} m from the relation's ways` };
  if (a.node === b.node) return { ok: false, reason: 'both anchors snap to the same point' };

  const dist = new Map([[a.node.k, 0]]);
  const parent = new Map();
  const heap = new MinHeap();
  heap.push([0, a.node.k]);
  while (heap.size) {
    const [d, k] = heap.pop();
    if (d > dist.get(k)) continue;
    if (k === b.node.k) break;
    for (const [nk, len] of nodes.get(k).adj) {
      const nd = d + len;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        parent.set(nk, k);
        heap.push([nd, nk]);
      }
    }
  }
  if (!dist.has(b.node.k)) return { ok: false, reason: 'the anchors are on parts of the relation that do not connect (gap > maxGap)' };

  const keys = [];
  for (let k = b.node.k; k !== undefined; k = parent.get(k)) keys.push(k);
  keys.reverse();
  const coords = keys.map((k) => nodes.get(k).c);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversineM(coords[i - 1], coords[i]));

  // Other ways round: take the path's edges out; any remaining piece that touches the path twice is a variant.
  const onPath = new Map(keys.map((k, i) => [k, i]));
  for (let i = 1; i < keys.length; i++) {
    nodes.get(keys[i - 1]).adj.delete(keys[i]);
    nodes.get(keys[i]).adj.delete(keys[i - 1]);
  }
  const alternatives = [];
  for (const comp of components(nodes)) {
    const touching = comp.filter((n) => onPath.has(n.k)).map((n) => onPath.get(n.k));
    if (touching.length < 2) continue;
    const lo = Math.min(...touching);
    const hi = Math.max(...touching);
    let detour = 0;
    for (const n of comp) for (const len of n.adj.values()) detour += len;
    alternatives.push({ replacesM: Math.round(cum[hi] - cum[lo]), variantWaysM: Math.round(detour / 2), atM: Math.round(cum[lo]) });
  }
  alternatives.sort((x, y) => y.replacesM - x.replacesM);

  return {
    ok: true,
    coords,
    shape: 'line',
    method: 'path-between-anchors',
    lengthM: cum[cum.length - 1],
    snapFromM: Math.round(a.distM),
    snapToM: Math.round(b.distM),
    maxGapM: bridged.length ? Math.max(...bridged) : 0,
    gaps: bridged,
    droppedM: 0,
    alternatives,
  };
}

/** Unit direction (projected metres) pointing out of an end node, measured ~50 m back along its chain. */
function outwardDirection(nodes, end) {
  let prev = end;
  let cur = [...end.adj.keys()][0] ? nodes.get([...end.adj.keys()][0]) : null;
  let len = 0;
  while (cur && len < 50) {
    len += haversineM(prev.c, cur.c);
    if (cur.adj.size !== 2 || len >= 50) break;
    const next = [...cur.adj.keys()].map((k) => nodes.get(k)).find((n) => n !== prev);
    prev = cur;
    cur = next;
  }
  if (!cur) return null;
  const k = Math.cos((end.c[1] * Math.PI) / 180);
  const dx = (end.c[0] - cur.c[0]) * k;
  const dy = end.c[1] - cur.c[1];
  const n = Math.hypot(dx, dy);
  return n ? [dx / n, dy / n] : null;
}

/** Joins dangling ends of different parts when the gap is short and both sides point at each other. */
function bridgeStraightGaps(nodes, maxGapM, maxAngleDeg = 45) {
  const bridged = [];
  const cosMax = Math.cos((maxAngleDeg * Math.PI) / 180);
  for (;;) {
    const comps = components(nodes);
    if (comps.length < 2) break;
    const compOf = new Map();
    comps.forEach((c, i) => c.forEach((n) => compOf.set(n.k, i)));
    const ends = [...nodes.values()].filter((n) => n.adj.size === 1);
    let best = null;
    for (const a of ends) {
      const da = outwardDirection(nodes, a);
      if (!da) continue;
      for (const b of ends) {
        if (compOf.get(a.k) === compOf.get(b.k) || a.k >= b.k) continue;
        const d = haversineM(a.c, b.c);
        if (d > maxGapM || (best && d >= best.d)) continue;
        const db = outwardDirection(nodes, b);
        if (!db) continue;
        const k = Math.cos((a.c[1] * Math.PI) / 180);
        const gx = (b.c[0] - a.c[0]) * k;
        const gy = b.c[1] - a.c[1];
        const gn = Math.hypot(gx, gy) || 1;
        // a keeps heading towards b, and b's outward direction points back at a
        if ((da[0] * gx + da[1] * gy) / gn < cosMax || (-(db[0] * gx + db[1] * gy)) / gn < cosMax) continue;
        best = { a, b, d };
      }
    }
    if (!best) break;
    best.a.adj.set(best.b.k, best.d);
    best.b.adj.set(best.a.k, best.d);
    bridged.push(Math.round(best.d));
  }
  return bridged;
}

function dijkstra(nodes, startKey) {
  const dist = new Map([[startKey, 0]]);
  const parent = new Map();
  const heap = new MinHeap();
  heap.push([0, startKey]);
  while (heap.size) {
    const [d, k] = heap.pop();
    if (d > dist.get(k)) continue;
    for (const [nk, len] of nodes.get(k).adj) {
      const nd = d + len;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        parent.set(nk, k);
        heap.push([nd, nk]);
      }
    }
  }
  return { dist, parent };
}

/**
 * The main line of a relation whose ways branch, run in parallel or have small gaps: the walk between
 * the two places named in the route name (anchors) or, without them, between the two most distant
 * ends of its largest connected part. Gaps up to maxGapM are bridged only where both sides continue
 * straight towards each other. A pure ring is returned as a loop.
 */
export function mainLine(allWays, { maxGapM = 300, anchors = null, maxSnapM = 1500 } = {}) {
  const ways = mainWays(allWays.filter((w) => w.coords && w.coords.length >= 2));
  if (!ways.length) return { ok: false, reason: 'relation has no way members with geometry' };
  const nodes = buildGraph(ways);
  const bridged = bridgeStraightGaps(nodes, maxGapM);
  const comps = components(nodes)
    .map((c) => ({ c, len: c.reduce((n, x) => n + [...x.adj.values()].reduce((m, l) => m + l, 0), 0) / 2 }))
    .sort((a, b) => b.len - a.len);
  const totalM = comps.reduce((n, c) => n + c.len, 0);
  const main = comps[0];
  if (main.len < 0.6 * totalM) {
    return { ok: false, reason: `its largest connected part holds only ${Math.round((main.len / totalM) * 100)}% of the ways (gaps over ${maxGapM} m or not straight)` };
  }
  const inMain = new Set(main.c.map((n) => n.k));
  const sub = new Map(main.c.map((n) => [n.k, n]));
  const path = (fromKey, toKey) => {
    const { dist, parent } = dijkstra(sub, fromKey);
    if (!dist.has(toKey)) return null;
    const keys = [];
    for (let k = toKey; k !== undefined; k = parent.get(k)) keys.push(k);
    return { coords: keys.reverse().map((k) => sub.get(k).c), lengthM: dist.get(toKey) };
  };
  const base = { ok: true, shape: 'line', maxGapM: bridged.length ? Math.max(...bridged) : 0, gaps: bridged };

  if (anchors) {
    const snap = (p) => {
      let best = null;
      for (const n of main.c) {
        const d = haversineM(n.c, p);
        if (!best || d < best.d) best = { n, d };
      }
      return best;
    };
    const a = snap(anchors[0]);
    const b = snap(anchors[1]);
    if (a && b && a.d <= maxSnapM && b.d <= maxSnapM && a.n !== b.n) {
      const p = path(a.n.k, b.n.k);
      if (p) return { ...base, coords: p.coords, method: 'main-line-between-named-places', droppedM: Math.round(totalM - p.lengthM) };
    }
  }

  const ends = main.c.filter((n) => n.adj.size === 1);
  if (ends.length >= 2) {
    let best = null;
    for (const e of ends) {
      const { dist } = dijkstra(sub, e.k);
      for (const f of ends) {
        if (f === e || !dist.has(f.k)) continue;
        if (!best || dist.get(f.k) > best.d) best = { e, f, d: dist.get(f.k) };
      }
    }
    const p = path(best.e.k, best.f.k);
    return { ...base, coords: p.coords, method: 'main-line-between-farthest-ends', droppedM: Math.round(totalM - p.lengthM) };
  }
  if (ends.length === 0 && main.c.every((n) => n.adj.size === 2) && inMain.size >= 3) {
    const start = main.c[0];
    return { ...base, coords: walk(sub, start), shape: 'loop', method: 'main-line-loop', droppedM: Math.round(totalM - main.len) };
  }
  return { ok: false, reason: 'no clear main line (loops without free ends)' };
}
