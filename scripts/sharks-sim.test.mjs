// Tests for static/js/sharks-sim.js, the pure shark simulation (spec #396).
//
//   node --test scripts/sharks-sim.test.mjs
//
// Seam: SharksSim.frame(seed, t, cols, rows, textRects) -> what is on the grid
// at that instant. Everything below observes that output; nothing reaches in.

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
const LADDER = [0.05, 0.12, 0.2, 0.26, 0.34, 0.44, 0.54, 0.66];
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

test("there are always 3 or 4 sharks, from t=0 on", () => {
  assert.ok(times.length >= 60 && times[times.length - 1] >= 90);
  for (const t of times) {
    const n = Sim.frame(SEED, t, COLS, ROWS, []).sharks.length;
    assert.ok(n >= 3 && n <= 4, `t=${t}: ${n} sharks`);
  }
});

test("sharks swim about 6.5 cells/s, turn 2-20 deg/s, and are about 36 cells long", () => {
  const dt = 0.25;
  let measured = 0;
  for (let t = 0; t < 100; t += 1.7) {
    const a = Sim.frame(SEED, t, COLS, ROWS, []).sharks;
    const b = Sim.frame(SEED, t + dt, COLS, ROWS, []).sharks;
    for (const s of a) {
      const n = b.find((o) => o.id === s.id);
      if (!n) continue;
      const speed = Math.hypot(n.x - s.x, n.y - s.y) / dt;
      assert.ok(speed >= 5.5 && speed <= 7.5, `speed ${speed}`);
      assert.ok(Math.abs(s.turn) >= 2 && Math.abs(s.turn) <= 20, `turn ${s.turn}`);
      assert.ok(s.len >= 34 && s.len <= 38, `len ${s.len}`);
      measured++;
    }
  }
  assert.ok(measured > 100);
});

test("rendered sharks are body-sized: the fullest frame has 150+ cells, spanning 20+ columns", () => {
  const frames = times.map((t) => Sim.frame(SEED, t, COLS, ROWS, []));
  const best = frames.reduce((m, f) => (f.cells.length > m.cells.length ? f : m));
  const xs = best.cells.map((c) => c.x);
  assert.ok(best.cells.length >= 200, `${best.cells.length}`);
  assert.ok(Math.max(...xs) - Math.min(...xs) >= 20);
});

test("every cell inside a text rect (plus margin) is capped at ink 0.12", () => {
  assert.equal(Sim.TEXT_FADE_MAX, 0.12);
  let inside = 0;
  for (const t of times) {
    const f = Sim.frame(SEED, t, COLS, ROWS, RECTS);
    for (const c of [...f.cells, ...f.dust]) {
      const hit = RECTS.some(
        (r) =>
          c.x + 1 > r.x - Sim.TEXT_MARGIN && c.x < r.x + r.w + Sim.TEXT_MARGIN &&
          c.y + 1 > r.y - Sim.TEXT_MARGIN && c.y < r.y + r.h + Sim.TEXT_MARGIN
      );
      if (!hit) continue;
      inside++;
      assert.ok((c.tile || 0) <= 0.12 && c.ink <= 0.12, `t=${t} cell ${c.x},${c.y} tile=${c.tile} ink=${c.ink}`);
    }
  }
  assert.ok(inside > 50, "the rect must actually have been crossed");
});

test("outside the rects the sharks are dark (the cap is not applied everywhere)", () => {
  const f = Sim.frame(SEED, 0, COLS, ROWS, []);
  assert.ok(f.cells.some((c) => c.tile >= 0.44));
  assert.ok(f.cells.every((c) => c.tile === 0 || LADDER.includes(c.tile)));
});

test("tiles are a soft mid-grey: never darker than 66% ink, and the median tile is 35-55%", () => {
  const tiles = [];
  for (const t of times) for (const c of Sim.frame(SEED, t, COLS, ROWS, []).cells) if (c.tile >= 0.2) tiles.push(c.tile);
  tiles.sort((a, b) => a - b);
  assert.ok(tiles[tiles.length - 1] <= 0.66);
  const med = tiles[Math.floor(tiles.length / 2)];
  assert.ok(med >= 0.35 && med <= 0.55, `median ${med}`);
});

test("per-line text boxes fade only their own line: three rows away a shark is still dark", () => {
  const line = [{ x: 10, y: 20, w: 30, h: 1 }];
  let near = 0, far = 0;
  for (const t of times) {
    for (const c of Sim.frame(SEED, t, COLS, ROWS, line).cells) {
      const dy = c.y < 20 ? 20 - c.y - 1 : c.y - 21;
      if (c.x >= 9 && c.x <= 40 && dy <= 0) { near++; assert.ok(c.tile <= 0.12); }
      else if (c.x >= 9 && c.x <= 40 && dy >= 2 && c.tile >= 0.34) far++;
    }
  }
  assert.ok(near > 0 && far > 0, `near ${near} far ${far}`);
});

// A shark's own frame: u runs 0 (nose) .. 1 (tail tip) along its heading, side across it.
function inShark(f, s) {
  const h = (s.heading * Math.PI) / 180, ct = Math.cos(h), st = Math.sin(h), out = [];
  for (const c of f.cells) {
    if (c.tile < 0.2) continue;
    const dx = c.x + 0.5 - s.x, dy = (c.y + 0.5) * 1.5 - s.y;
    const along = dx * ct + dy * st, side = -dx * st + dy * ct;
    if (Math.abs(along) <= s.len / 2 + 1 && Math.abs(side) < s.len / 2) out.push({ u: (s.len / 2 - along) / s.len, side });
  }
  return out;
}
const span = (cells, a, b) => {
  const v = cells.filter((c) => c.u >= a && c.u < b).map((c) => c.side);
  return v.length ? Math.max(...v) - Math.min(...v) : 0;
};

test("every shark reads as a shark: a head, pectoral fins wider than the body behind them, a forked tail", () => {
  const seen = new Set();
  for (let t = 0; t < 400 && seen.size < 3; t += 0.37) {
    const f = Sim.frame(SEED, t, 300, 200, []);
    for (const s of f.sharks) {
      if (seen.has(s.type) || s.x < 30 || s.x > 270 || s.y < 30 || s.y > 270) continue;
      const cells = inShark(f, s);
      const nose = span(cells, 0.01, 0.1), fins = span(cells, 0.3, 0.45), body = span(cells, 0.55, 0.7);
      assert.ok(fins >= body * 1.3, `type ${s.type}: fins ${fins} vs body ${body}`);
      if (s.type === 0) assert.ok(nose >= body * 1.7, `hammer head ${nose} vs body ${body}`);
      else assert.ok(nose <= body * 0.9, `type ${s.type}: snout ${nose} vs body ${body}`);
      const tail = cells.filter((c) => c.u >= 0.9 && c.u < 0.97).map((c) => c.side).sort((a, b) => a - b);
      let gap = 0;
      for (let i = 1; i < tail.length; i++) gap = Math.max(gap, tail[i] - tail[i - 1]);
      assert.ok(tail.length >= 3 && gap >= 1.5, `type ${s.type}: tail is not forked (gap ${gap})`);
      seen.add(s.type);
    }
  }
  assert.equal(seen.size, 3);
});

test("shark edges are soft: a body is not a stair of full-dark cells (partial tiles border it)", () => {
  const f = Sim.frame(SEED, 40, 300, 200, []);
  const soft = f.cells.filter((c) => c.tile > 0 && c.tile <= 0.2).length;
  const hard = f.cells.filter((c) => c.tile >= 0.44).length;
  assert.ok(soft >= hard * 0.15, `soft ${soft} hard ${hard}`);
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
      const half = s.len / 2 + 1; // removal is checked every 0.1 s
      const offAll = s.x + half < 0 || s.x - half > COLS || s.y + half < 0 || s.y - half > ROWS * 1.5;
      assert.ok(!offAll || s.age < 5, `${s.id} alive while fully off at t=${t}`);
    }
  }
});

test("tinted glyphs are at most 10% of shark cells, from 4 tints", () => {
  const used = new Set();
  let tinted = 0;
  for (const t of times) {
    const f = Sim.frame(SEED, t, COLS, ROWS, []);
    const n = f.cells.filter((c) => c.tint !== null).length;
    assert.ok(n <= Math.floor(f.cells.length * 0.1), `t=${t}: ${n}/${f.cells.length}`);
    f.cells.forEach((c) => c.tint !== null && used.add(c.tint));
    tinted += n;
  }
  assert.ok(tinted > 0);
  assert.ok([...used].every((i) => [0, 1, 2, 3].includes(i)));
});

test("cell and dust budgets: <= 900 non-empty cells, ~140 dust marks, never over 160", () => {
  let maxCells = 0;
  let dustSum = 0;
  for (const t of times) {
    const f = Sim.frame(SEED, t, COLS, ROWS, []);
    assert.ok(f.dust.length <= 160, `dust ${f.dust.length}`);
    assert.ok(f.cells.length + f.dust.length <= 900, `cells ${f.cells.length + f.dust.length}`);
    maxCells = Math.max(maxCells, f.cells.length);
    dustSum += f.dust.length;
  }
  assert.ok(maxCells > 100);
  const avg = dustSum / times.length;
  assert.ok(avg >= 100 && avg <= 160, `avg dust ${avg}`);
  const big = Sim.frame(SEED, 30, 400, 150, []);
  assert.ok(big.cells.length + big.dust.length <= 900);
});

test("glyphs run @ .. . by darkness; the sparsest cells have no tile", () => {
  const f = Sim.frame(SEED, 20, COLS, ROWS, []);
  const allowed = "@8%#SXt;:,'.-";
  for (const c of [...f.cells, ...f.dust]) assert.ok(allowed.includes(c.ch), c.ch);
  for (const c of f.cells) if ("',.-".includes(c.ch)) assert.equal(c.tile, 0);
  assert.ok(f.cells.some((c) => c.ch === "@"));
  assert.ok(f.dust.every((c) => c.ch === "-" || c.ch === "."));
});

test("dust flickers in place: marks keep their cell over 0.1 s, but blink off over seconds", () => {
  const key = (d) => `${d.x},${d.y}`;
  const a = new Set(Sim.frame(SEED, 10, COLS, ROWS, []).dust.map(key));
  const b = new Set(Sim.frame(SEED, 10.1, COLS, ROWS, []).dust.map(key));
  const c = new Set(Sim.frame(SEED, 12.9, COLS, ROWS, []).dust.map(key));
  assert.ok([...a].filter((k) => b.has(k)).length > a.size * 0.5);
  assert.ok([...a].filter((k) => c.has(k)).length < a.size);
});

test("the module is pure: no clock, no Math.random, no DOM", () => {
  const src = fs.readFileSync(FILE, "utf8");
  for (const bad of [/Math\.random/, /\bDate\b/, /\bperformance\b/, /\bdocument\b/, /\bwindow\b/, /\brequire\s*\(/, /\bimport\b/, /\bsetTimeout\b|\bsetInterval\b|requestAnimationFrame/]) {
    assert.ok(!bad.test(src), `sharks-sim.js must not match ${bad}`);
  }
});
