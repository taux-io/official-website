// Tests for static/js/sharks-sim.js, the pure shark simulation (spec #396, ticket #402).
//
//   node --test scripts/sharks-sim.test.mjs
//
// Seam: SharksSim.frame(seed, t, cols, rows, textRects) -> what is on the grid
// at that instant, plus three pure helpers the spec names (density, glyph,
// constants). Everything below observes those; nothing reaches in.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "static", "js", "sharks-sim.js");
const Sim = require(FILE);

const COLS = 120;
const ROWS = 40;
const SEED = 7;
const LENS = [54, 44, 34]; // big, middle, small whale (the shark's type is its slot)
const times = Array.from({ length: 100 }, (_, i) => i * 1.13); // 0 .. ~112 s
const RECTS = [
  { x: 6, y: 8, w: 50, h: 18 },
  { x: 70, y: 30, w: 20, h: 5 },
];

test("same inputs give an identical frame, in one load and in a fresh load", () => {
  const a = Sim.frame(SEED, 12.34, COLS, ROWS, RECTS);
  const b = Sim.frame(SEED, 12.34, COLS, ROWS, RECTS);
  assert.deepEqual(a, b);
  delete require.cache[FILE];
  const fresh = require(FILE);
  assert.deepEqual(fresh.frame(SEED, 12.34, COLS, ROWS, RECTS), a);
  assert.notDeepEqual(Sim.frame(SEED + 1, 12.34, COLS, ROWS, RECTS), a);
});

test("the frame does not depend on which frames were asked for before it", () => {
  const cold = Sim.frame(SEED, 60, COLS, ROWS, []);
  Sim.frame(SEED, 200, COLS, ROWS, []);
  assert.deepEqual(Sim.frame(SEED, 60, COLS, ROWS, []), cold);
});

test("there are always exactly 3 sharks, from t=0 on", () => {
  for (const t of times) {
    const n = Sim.frame(SEED, t, COLS, ROWS, []).sharks.length;
    assert.equal(n, 3, `t=${t}: ${n} sharks`);
  }
});

test("three fixed whales: type = slot, about 34 / 44 / 54 cells long, the big one 1.5x+ the small", () => {
  for (let t = 0; t < 100; t += 7) {
    const f = Sim.frame(SEED, t, COLS, ROWS, []);
    assert.deepEqual(f.sharks.map((s) => s.type).sort(), [0, 1, 2]);
    for (const s of f.sharks) assert.ok(Math.abs(s.len - LENS[s.type]) <= 2, `type ${s.type} len ${s.len}`);
  }
  assert.ok(LENS[0] / LENS[2] >= 1.5);
});

test("sharks swim about 6.5 cells/s on long arcs, the same speed whatever their size", () => {
  const dt = 0.25, bySize = [[], [], []];
  for (let t = 0; t < 100; t += 1.7) {
    const a = Sim.frame(SEED, t, COLS, ROWS, []).sharks, b = Sim.frame(SEED, t + dt, COLS, ROWS, []).sharks;
    for (const s of a) {
      const n = b.find((o) => o.id === s.id);
      if (!n) continue;
      const speed = Math.hypot(n.x - s.x, n.y - s.y) / dt;
      assert.ok(speed >= 5.5 && speed <= 7.5, `speed ${speed}`);
      assert.ok(Math.abs(s.turn) >= 2 && Math.abs(s.turn) <= 20, `turn ${s.turn}`);
      bySize[s.type].push(speed);
    }
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(bySize.every((a) => a.length > 20));
  assert.ok(Math.abs(mean(bySize[0]) - mean(bySize[2])) < 0.6);
});

test("turns are arcs: a shark keeps one turn direction for at least 6 s at a time", () => {
  let flips = 0, runs = 0;
  for (let t0 = 0; t0 < 120; t0 += 0.5) {
    const a = Sim.frame(SEED, t0, COLS, ROWS, []).sharks, b = Sim.frame(SEED, t0 + 0.5, COLS, ROWS, []).sharks;
    for (const s of a) {
      const n = b.find((o) => o.id === s.id);
      if (n && Math.sign(n.turn) !== Math.sign(s.turn)) { flips++; assert.ok(s.age >= 5.5, `flip at age ${s.age}`); }
      runs++;
    }
  }
  assert.ok(runs > 200);
  assert.ok(flips < runs / 10, `${flips} flips in ${runs} samples`);
});

test("a replacement shark arrives whenever one has left", () => {
  let prev = Sim.frame(SEED, 0, COLS, ROWS, []).sharks.map((s) => s.id);
  let replaced = 0;
  for (let t = 0.5; t <= 150; t += 0.5) {
    const ids = Sim.frame(SEED, t, COLS, ROWS, []).sharks.map((s) => s.id);
    assert.ok(ids.length >= 3);
    const gone = prev.filter((i) => !ids.includes(i));
    const born = ids.filter((i) => !prev.includes(i));
    assert.equal(born.length, gone.length);
    replaced += gone.length;
    prev = ids;
  }
  assert.ok(replaced >= 4, `only ${replaced} replacements in 150 s`);
});

test("a shark is never alive fully off an edge, and a new one starts off-screen", () => {
  for (let t = 0; t <= 150; t += 0.5) {
    const f = Sim.frame(SEED, t, COLS, ROWS, []);
    for (const s of f.sharks) {
      const half = Sim.REACH + 1; // removal is checked every 0.1 s
      const offAll = s.x + half < 0 || s.x - half > COLS || s.y + half < 0 || s.y - half > ROWS * 1.5;
      assert.ok(!offAll || s.age < 5, `${s.id} alive while fully off at t=${t}`);
    }
  }
});

// ---------------------------------------------------------------- shapes

// A shark's own frame: u 0 (nose) .. 1 (tail tip) along its heading; side across it.
function inShark(f, s, minTile = 0.2) {
  const h = (s.heading * Math.PI) / 180, ct = Math.cos(h), st = Math.sin(h), out = [];
  for (const c of f.cells) {
    if (c.tile < minTile) continue;
    const dx = c.x + 0.5 - s.x, dy = (c.y + 0.5) * 1.5 - s.y;
    const along = dx * ct + dy * st, side = -dx * st + dy * ct;
    if (Math.abs(along) <= s.len / 2 + 1 && Math.abs(side) < s.len / 2 + 1) out.push({ u: (s.len / 2 - along) / s.len, side });
  }
  return out;
}
const span = (cells, a, b) => {
  const v = cells.filter((c) => c.u >= a && c.u < b).map((c) => c.side);
  return v.length ? Math.max(...v) - Math.min(...v) + 1 : 0;
};
// First moment `type` is wholly inside a big grid, so nothing is clipped.
function sample(type, maxDepth = 1) {
  for (let t = 0; t < 800; t += 0.37) {
    const f = Sim.frame(SEED, t, 300, 200, []);
    const s = f.sharks.find((o) => o.type === type);
    if (s && s.depth <= maxDepth && s.x > 40 && s.x < 260 && s.y > 40 && s.y < 260) return { f, s };
  }
  throw new Error("no clean sample for type " + type);
}

// A humpback's shape from its density field (straight, no spine curve): the
// extent across at x (highest v of everything over 0.1).
const across = (type, x) => {
  let hi = 0;
  for (let v = 0; v <= 40; v += 0.25) if (Sim.density(type, x, v) > 0.1) hi = v + 0.25;
  return hi;
};

test("humpbacks: rounded head, widest at the flippers, thin peduncle, long swept flippers, two fluke lobes", () => {
  for (const type of [0, 1, 2]) {
    const L = Sim.LENS[type], at = (u) => across(type, u * L);
    const body = Math.max(at(0.12), at(0.18)), nose = at(0.02), head = at(0.08), peduncle = at(0.86);
    assert.ok(nose < head && head < body, `type ${type}: nose ${nose} head ${head} body ${body}`);
    assert.ok(body >= 0.08 * L && body <= 0.13 * L, `type ${type}: body ${body}`);
    assert.ok(peduncle <= body * 0.5 && peduncle >= 1, `type ${type}: peduncle ${peduncle} body ${body}`);
    // flippers: reach well past the body, down the front half, and are not hairlines
    const flip = Math.max(at(0.38), at(0.42), at(0.46));
    assert.ok(flip >= body * 2.2, `type ${type}: flippers reach ${flip}, body ${body}`);
    let thick = 0;
    for (let v = body; v <= 40; v += 0.25) if (Sim.density(type, 0.42 * L, v) > 0.15) thick += 0.25;
    assert.ok(thick >= 2, `type ${type}: flipper only ${thick} cells thick`);
    // flukes: much wider than the peduncle, two lobes with a notch between
    const fluke = at(0.96);
    assert.ok(fluke >= peduncle * 3 && fluke >= 0.28 * L / 2, `type ${type}: fluke ${fluke} peduncle ${peduncle}`);
    assert.ok(Sim.density(type, 0.99 * L, 0) < 0.1 && Sim.density(type, 0.96 * L, 0.1 * L) > 0.15, `type ${type}: no notch between lobes`);
    for (let u = 0.04; u < 0.9; u += 0.02) assert.ok(Sim.density(type, u * L, 0) > 0.2, `type ${type}: gap in the body at u=${u.toFixed(2)}`);
  }
});

test("the spine curves like a C or an S that swells and reverses over tens of seconds, nose fixed", () => {
  assert.equal(typeof Sim.spine, "function");
  assert.ok(Sim.CURVE.c >= 20 && Sim.CURVE.s >= 25);
  const ph = [0.7, 0.2, 1.1];
  for (const type of [0, 1, 2]) {
    let lo = 0, hi = 0, maxRate = 0, prev = null, opposite = 0, same = 0;
    for (let tau = 0; tau < 240; tau += 0.25) {
      const tail = Sim.spine(type, 1, tau, ph), mid = Sim.spine(type, 0.5, tau, ph);
      lo = Math.min(lo, tail); hi = Math.max(hi, tail);
      if (prev !== null) maxRate = Math.max(maxRate, Math.abs(tail - prev) / 0.25);
      prev = tail;
      if (Math.abs(mid) > 1 && Math.abs(tail) > 1) { if (Math.sign(mid) !== Math.sign(tail)) opposite++; else same++; }
    }
    const L = Sim.LENS[type];
    assert.ok(hi >= 0.1 * L && lo <= -0.1 * L, `type ${type}: tail swings ${lo.toFixed(1)}..${hi.toFixed(1)}`);
    assert.ok(maxRate <= 3.6, `type ${type}: tail moves ${maxRate.toFixed(2)} cells/s`);
    assert.ok(opposite > 0 && same > 0, "both C and S shapes occur");
    assert.ok(Math.abs(Sim.spine(type, 0, 77, ph)) <= Sim.BEND.amp * 0.2 + 1e-9, "the nose stays on the line");
  }
});

test("each whale sinks and surfaces slowly, and the deeper it is the lighter its tail and the fewer its tints", () => {
  assert.equal(typeof Sim.depth, "function");
  let lo = 1, hi = 0, maxRate = 0, prev = null;
  for (let tau = 0; tau < 200; tau += 0.5) {
    const d = Sim.depth(tau, 1.3);
    lo = Math.min(lo, d); hi = Math.max(hi, d);
    if (prev !== null) maxRate = Math.max(maxRate, Math.abs(d - prev) / 0.5);
    prev = d;
  }
  assert.ok(lo <= 0.02 && hi >= 0.98 && maxRate <= 0.09, `depth ${lo}..${hi}, ${maxRate}/s`);
  const shallow = { tail: 0, head: 0, tint: 0, n: 0 }, deep = { tail: 0, head: 0, tint: 0, n: 0 };
  for (let t = 0; t < 600; t += 0.9) {
    const f = Sim.frame(SEED, t, 300, 200, []);
    for (const s of f.sharks) {
      if (s.x < 50 || s.x > 250 || s.y < 50 || s.y > 250 || (s.depth > 0.3 && s.depth < 0.7)) continue;
      const g = s.depth < 0.3 ? shallow : deep, cells = inShark(f, s, 0.2);
      g.tail += cells.filter((c) => c.u >= 0.7).length; g.head += cells.filter((c) => c.u < 0.4).length;
      const cs = f.cells.filter((c) => Math.hypot(c.x + 0.5 - s.x, (c.y + 0.5) * 1.5 - s.y) < s.len / 2);
      g.tint += cs.filter((c) => c.tint !== null).length / Math.max(1, cs.length); g.n++;
    }
  }
  assert.ok(shallow.n > 5 && deep.n > 5, `${shallow.n} shallow, ${deep.n} deep samples`);
  assert.ok(deep.tail / deep.n < 0.5 * shallow.tail / shallow.n, `tail cells deep ${deep.tail / deep.n} vs shallow ${shallow.tail / shallow.n}`);
  assert.ok(deep.head / deep.n > 0.5 * shallow.head / shallow.n, "the head stays");
  assert.ok(deep.tint / deep.n < shallow.tint / shallow.n, "fewer tints when deep");
});

// ---------------------------------------------------------------- density

test("density: richer from the rim inward, a 3-4 cell gradient, the spine is densest", () => {
  assert.equal(typeof Sim.density, "function");
  for (const type of [0, 1]) {
    const x = Sim.LENS[type] * 0.62; // through the torso, behind the fins
    let prev = 0, rim = null, full = null;
    for (let v = 14; v >= 0; v -= 0.25) {
      const d = Sim.density(type, x, v);
      assert.ok(d >= prev - 1e-9, `type ${type}: density falls going inward at v=${v}`);
      if (rim === null && d > 0.04) rim = v;
      if (full === null && d >= 0.8) full = v;
      prev = d;
    }
    assert.ok(prev >= 0.7 && Math.max(...[...Array(40)].map((_, i) => Sim.density(type, i, 0))) >= 0.99, `type ${type}: spine ${prev}`);
    assert.ok(rim - full >= 2.5 && rim - full <= 5, `type ${type}: gradient ${rim - full} cells`);
    // by the Notes: about 35-40%, 55%, 70%, 80% of the core, outside in
    assert.ok(Sim.density(type, x, rim - 1) >= 0.15 && Sim.density(type, x, rim - 1) <= 0.45);
  }
});

test("every shark has a faint outer ring of small glyphs with no tile, then tiles in several greys", () => {
  const { f } = sample(0, 0.3); // near the surface, so not lightened
  const small = f.cells.filter((c) => "o,'.".includes(c.ch));
  assert.ok(small.length >= 10, `${small.length}`);
  for (const c of small) assert.equal(c.tile, 0);
  const tiled = f.cells.filter((c) => c.tile > 0);
  assert.ok(tiled.length > 60);
  assert.ok(tiled.every((c) => c.tile >= 0.2 && c.tile <= 0.66));
  assert.ok(new Set(tiled.map((c) => c.tile)).size >= 5, "several grey steps");
  const med = tiled.map((c) => c.tile).sort((a, b) => a - b)[Math.floor(tiled.length / 2)];
  assert.ok(med >= 0.22 && med <= 0.6, `median ${med}`);
});

test("tile cells: the big whale at most 480 (ring glyphs on top), the whole frame at most 1200 with dust", () => {
  let maxBig = 0;
  for (const t of times) {
    const f = Sim.frame(SEED, t, 300, 200, []);
    assert.ok(f.cells.length + f.dust.length <= 1200, `${f.cells.length + f.dust.length}`);
    assert.ok(f.dust.length <= 160);
    for (const s of f.sharks) {
      assert.ok(s.n <= [480, 400, 280][s.type], `type ${s.type}: ${s.n} cells`);
      if (s.type === 0) maxBig = Math.max(maxBig, s.n);
    }
  }
  assert.ok(maxBig >= 250, `the big one fills ${maxBig} cells`);
  assert.equal(Sim.MAX_CELLS, 1200);
});

test("each whale has one main hue, the three differ; coloured glyphs are at most 10% of the content cells", () => {
  const hues = [new Set(), new Set(), new Set()];
  let tinted = 0, total = 0;
  for (const t of times) {
    const f = Sim.frame(SEED, t, 300, 200, []);
    const n = f.cells.filter((c) => c.tint !== null).length;
    assert.ok(n <= Math.floor(f.cells.length * 0.1), `t=${t}: ${n}/${f.cells.length}`);
    f.cells.forEach((c) => c.tint !== null && assert.ok([0, 1, 2, 3].includes(c.tint)));
    tinted += n;
    total += f.cells.length;
    f.sharks.forEach((s) => hues[s.type].add(s.hue));
  }
  assert.ok(tinted / total > 0.05, `tint share ${tinted / total}`);
  assert.ok(hues.every((x) => x.size === 1));
  assert.equal(new Set(hues.map((x) => [...x][0])).size, 3);
});

// ---------------------------------------------------------------- glyphs

test("glyphs redraw fast: about 65 ms a glyph, cells independent, about 10% coloured, pure", () => {
  assert.equal(typeof Sim.glyph, "function");
  const dt = 0.005, a = [], b = [];
  let runs = 0, life = 0, colour = 0, n = 0;
  for (let c = 0; c < 60; c++) {
    let prev = null, len = 0;
    for (let t = 0; t < 4; t += dt) {
      const g = Sim.glyph(SEED, c, 5, t, 0.8), key = g.ch + (g.tint === null ? "" : "#" + g.tint);
      if (g.tint !== null) colour++;
      n++;
      if (key !== prev) { if (prev !== null) { runs++; life += len; } prev = key; len = 0; }
      len += dt;
      if (c === 0) a.push(key);
      if (c === 1) b.push(key);
    }
  }
  const mean = life / runs;
  assert.ok(mean >= 0.055 && mean <= 0.1, `mean glyph life ${(mean * 1000).toFixed(0)} ms`);
  assert.ok(colour / n >= 0.07 && colour / n <= 0.13, `coloured ${(colour / n).toFixed(3)}`);
  assert.ok(a.filter((k, i) => k === b[i]).length / a.length < 0.3, "neighbouring cells move together");
  assert.deepEqual(Sim.glyph(SEED, 3, 4, 1.234, 0.5), Sim.glyph(SEED, 3, 4, 1.234, 0.5));
});

test("dense cells draw dark glyphs, thin ones light glyphs (one density sets tile and glyph)", () => {
  const rank = "@8%#SXt;:";
  const mean = (d) => { let s = 0; for (let i = 0; i < 400; i++) s += rank.indexOf(Sim.glyph(SEED, i, 3, i * 0.071, d).ch); return s / 400; };
  assert.ok(mean(0.95) < mean(0.5) && mean(0.5) < mean(0.28), `${mean(0.95)} ${mean(0.5)} ${mean(0.28)}`);
  for (let i = 0; i < 200; i++) assert.ok("o,'.".includes(Sim.glyph(SEED, i, 3, i * 0.07, 0.1).ch));
});

test("the body bends slowly: a period of 4-5 s and about 1 cell, not a 1 s wag", () => {
  assert.ok(Sim.BEND.period >= 4 && Sim.BEND.period <= 5);
  assert.ok(Sim.BEND.amp >= 0.8 && Sim.BEND.amp <= 1.2);
});

// ---------------------------------------------------------------- text

test("soft edge: at most 12% ink inside a text box, climbing back over 2 cells outside it", () => {
  assert.equal(Sim.TEXT_FADE_MAX, 0.12);
  const box = [{ x: 30, y: 20, w: 40, h: 4 }];
  const cap = (dist) => 0.12 + 0.54 * Math.min(1, dist / 2);
  const at = [0, 0, 0, 0];
  let inside = 0;
  for (let t = 0; t < 400; t += 0.5) {
    for (const c of Sim.frame(SEED, t, 120, 60, box).cells) {
      const ddx = Math.max(30 - Sim.TEXT_MARGIN - (c.x + 1), c.x - (70 + Sim.TEXT_MARGIN), 0);
      const ddy = Math.max(20 - Sim.TEXT_MARGIN - (c.y + 1), c.y - (24 + Sim.TEXT_MARGIN), 0) * 1.5;
      const d = Math.hypot(ddx, ddy);
      if (d === 0) { inside++; assert.ok(c.tile <= 0.12 && c.ink <= 0.12, `inside: tile ${c.tile} ink ${c.ink}`); continue; }
      assert.ok(c.tile <= cap(d) + 1e-9, `dist ${d.toFixed(2)}: tile ${c.tile}`);
      if (d < 2) at[Math.floor(d * 2)] = Math.max(at[Math.floor(d * 2)], c.tile);
    }
  }
  assert.ok(inside > 50);
  assert.ok(at[0] <= at[1] && at[1] <= at[2] && at[2] <= at[3] && at[3] > at[0], at.join(" "));
  assert.ok([12, 40, 70, 100].some((t) => Sim.frame(SEED, t, 120, 60, []).cells.some((c) => c.tile >= 0.44)), "outside the box the whales are dark");
});

test("every cell inside a text rect (plus margin) is capped at ink 0.12, dust included", () => {
  let inside = 0;
  for (const t of times) {
    const f = Sim.frame(SEED, t, COLS, ROWS, RECTS);
    for (const c of [...f.cells, ...f.dust]) {
      const hit = RECTS.some(
        (r) => c.x + 1 > r.x - Sim.TEXT_MARGIN && c.x < r.x + r.w + Sim.TEXT_MARGIN &&
          c.y + 1 > r.y - Sim.TEXT_MARGIN && c.y < r.y + r.h + Sim.TEXT_MARGIN
      );
      if (!hit) continue;
      inside++;
      assert.ok((c.tile || 0) <= 0.12 && c.ink <= 0.12, `t=${t} cell ${c.x},${c.y} tile=${c.tile} ink=${c.ink}`);
    }
  }
  assert.ok(inside > 50, "the rect must actually have been crossed");
});

test("dust flickers in place: marks keep their cell over 0.1 s, but blink off over seconds", () => {
  const key = (d) => `${d.x},${d.y}`;
  const a = new Set(Sim.frame(SEED, 10, COLS, ROWS, []).dust.map(key));
  const b = new Set(Sim.frame(SEED, 10.1, COLS, ROWS, []).dust.map(key));
  const c = new Set(Sim.frame(SEED, 12.9, COLS, ROWS, []).dust.map(key));
  assert.ok([...a].filter((k) => b.has(k)).length > a.size * 0.5);
  assert.ok([...a].filter((k) => c.has(k)).length < a.size);
  const avg = times.reduce((s, t) => s + Sim.frame(SEED, t, COLS, ROWS, []).dust.length, 0) / times.length;
  assert.ok(avg >= 100 && avg <= 160, `avg dust ${avg}`);
});

test("the module is pure: no clock, no Math.random, no DOM", () => {
  const src = fs.readFileSync(FILE, "utf8");
  for (const bad of [/Math\.random/, /\bDate\b/, /\bperformance\b/, /\bdocument\b/, /\bwindow\b/, /\brequire\s*\(/, /\bimport\b/, /\bsetTimeout\b|\bsetInterval\b|requestAnimationFrame/]) {
    assert.ok(!bad.test(src), `sharks-sim.js must not match ${bad}`);
  }
});
