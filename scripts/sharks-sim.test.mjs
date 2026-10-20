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
const LADDER = [0.05, 0.12, 0.2, 0.35, 0.56, 0.72, 0.86, 1];
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

test("sharks swim about 6.5 cells/s, turn 2-20 deg/s, and are about 28 cells long", () => {
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
      assert.ok(s.len >= 26 && s.len <= 30, `len ${s.len}`);
      measured++;
    }
  }
  assert.ok(measured > 100);
});

test("rendered sharks are body-sized: the fullest frame has 150+ cells, spanning 20+ columns", () => {
  const frames = times.map((t) => Sim.frame(SEED, t, COLS, ROWS, []));
  const best = frames.reduce((m, f) => (f.cells.length > m.cells.length ? f : m));
  const xs = best.cells.map((c) => c.x);
  assert.ok(best.cells.length >= 150, `${best.cells.length}`);
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
  assert.ok(f.cells.some((c) => c.tile >= 0.56));
  assert.ok(f.cells.every((c) => c.tile === 0 || LADDER.includes(c.tile)));
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
