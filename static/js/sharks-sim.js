/* sharks-sim: pure shark simulation (spec #396, ticket #402). frame(seed,t,cols,rows,rects)
   -> {sharks,cells,dust}. Same inputs, same output; hash only, no clock/DOM. */
(function (root, make) {
  if (typeof module === "object" && module.exports) module.exports = make();
  else root.SharksSim = make();
})(this, function () {
  "use strict";
  var SPEED = 6.5, ASPECT = 1.5, SEG = 8, STEP = 0.1, REACH = 26;
  var MAX_CELLS = 1200, DUST_N = 140, TINT_SHARE = 0.1, G = 4, REROLL = 0.055;
  var BEND = { period: 4.6, amp: 1 };
  var TEXT_FADE_MAX = 0.12, TEXT_MARGIN = 0.4, TEXT_RISE = 2; // margin / rise in cells
  var LADDER = [0.05, 0.12, 0.2, 0.26, 0.34, 0.44, 0.54, 0.66];
  var DENSE = "@8%#SXt;:"; // dark to light; thinner cells draw o , ' .
  var INK = { "@": 1, 8: 0.9, "%": 0.8, "#": 0.7, S: 0.6, X: 0.5, t: 0.4, ";": 0.32, ":": 0.25, o: 0.2, ",": 0.12, "'": 0.09, "-": 0.08, ".": 0.06 };
  // Three sharks traced from the reference video, nose at x = 0, tail at x = L,
  // y across (cells wide). A shark is a few strokes of [x, y, r, ...] (a spine,
  // the hammer, a pectoral fin, a tail lobe; mirrored across the spine) and the
  // density at a point is how far inside the nearest stroke it is, over G cells.
  // L, spine bend, main hue (--shark-N), content-cell cap, strokes.
  var SHAPES = [
    [46, 5, 3, 300, [[3, 0, 3.9, 4, 7, 3.8, 5, 12, 3.3], [4, 0, 3.6, 10, 0, 3.8, 15, 0, 4.9, 22, 0, 4.7, 28, 0, 3.1, 34, 0, 2.7], [12, 3, 2.7, 18, 8, 2.5, 22, 12, 1.7], [33, 0, 2.7, 38, 4.5, 2.5, 43, 8, 2]]],
    [34, 7, 2, 240, [[3, 0, 3.8, 3.5, 5, 3.6, 4.5, 9, 3], [3, 0, 3.2, 8, 0, 3.4, 13, 0, 4.6, 19, 0, 4.4, 23, 0, 3, 26, 0, 2.6], [9, 2.5, 2.5, 14, 7, 2.3, 18, 11, 1.7], [25, 0, 2.5, 29, 3.5, 2.4, 33, 6, 1.9]]],
    [26, -6, 0, 100, [[2, 0, 2.4, 6, 0, 2.7, 11, 0, 2.9, 16, 0, 2.5, 20, 0, 2.2], [3, 0, 2.6, 3.2, 2.2, 2], [8, 1.5, 1.7, 11, 4.5, 1.5], [19, 0, 2.2, 22, 2.8, 2, 24.5, 4.5, 1.5]]]
  ];
  function clamp(d) { return d < 0 ? 0 : d > 1 ? 1 : d; }

  function density(k, x, v) { // 0..1 at x along a type's body, v across
    var best = 0, a = Math.abs(v), S = SHAPES[k][4], i, j, s, ax, ay, bx, by, t, e, f;
    for (i = 0; i < S.length; i++) {
      s = S[i];
      for (j = 0; j + 5 < s.length; j += 3) {
        ax = s[j]; ay = s[j + 1]; bx = s[j + 3]; by = s[j + 4];
        e = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
        t = clamp(((x - ax) * (bx - ax) + (a - ay) * (by - ay)) / e);
        f = s[j + 2] + (s[j + 5] - s[j + 2]) * t - Math.hypot(x - ax - t * (bx - ax), a - ay - t * (by - ay));
        if (f > best) best = f;
      }
    }
    return clamp(best / G);
  }

  function H() { // integer args -> [0,1)
    var h = 0x9e3779b9 | 0, i;
    for (i = 0; i < arguments.length; i++) {
      h ^= arguments[i] | 0;
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      h ^= h >>> 16;
    }
    return (h >>> 0) / 4294967296;
  }

  // One cell's glyph at time t for density d: a fresh draw every REROLL seconds
  // (each cell on its own phase), about one glyph in ten coloured, in the
  // shark's hue (a tint index) or, now and then, another.
  function glyph(seed, c, r, t, d, hue) {
    var n = Math.floor(t / REROLL + H(seed, c, r, 77)), dd = d + (H(seed, c, r, 1000, n) - 0.5) * 0.5, ch, tint = null;
    if (d >= 0.2) { dd = Math.max(0.2, Math.min(1, dd)); ch = DENSE.charAt(Math.min(8, Math.floor((1 - dd) / 0.8 * 9))); }
    else { dd = Math.max(0.02, Math.min(0.199, dd)); ch = dd < 0.07 ? "." : dd < 0.1 ? "'" : dd < 0.14 ? "," : "o"; }
    if (H(seed, c, r, 3000, n) < TINT_SHARE) tint = hue !== undefined && H(seed, c, r, 5000, n) < 0.7 ? hue : Math.floor(H(seed, c, r, 4000, n) * 4);
    return { ch: ch, tint: tint, n: n };
  }

  function omega(L, j) { // rad/s of segment j: 4-16 deg/s, sign alternates
    var m = (4 + 12 * H(L.seed, L.k, L.n, 100 + j)) * Math.PI / 180;
    return (j % 2 ? -L.sign : L.sign) * m;
  }

  function at(L, t) { // closed-form walk over constant-turn segments
    var x = L.x, y = L.y, th = L.th, s = 0, j = 0, om = 0, d;
    while (s < t - 1e-9) {
      j = Math.floor(s / SEG + 1e-9);
      om = omega(L, j);
      d = Math.min(t - s, (j + 1) * SEG - s);
      x += L.v / om * (Math.sin(th + om * d) - Math.sin(th));
      y -= L.v / om * (Math.cos(th + om * d) - Math.cos(th));
      th += om * d;
      s += d;
    }
    return { x: x, y: y, th: th, om: omega(L, Math.floor(t / SEG + 1e-9)) };
  }

  function makeLife(seed, k, n, W, Hh, start) {
    var r = function (i) { return H(seed, k, n, i); }, e = r(1), f = 0.15 + 0.7 * r(2), o = REACH + 2, x, y;
    if (e < 0.4) { x = -o; y = f * Hh; } else if (e < 0.8) { x = W + o; y = f * Hh; }
    else if (e < 0.9) { x = f * W; y = -o; } else { x = f * W; y = Hh + o; }
    var L = {
      seed: seed, k: k, n: n, x: x, y: y, start: start, dur: 240,
      th: Math.atan2(Hh / 2 - y, 0.6 * W - x) + (r(3) - 0.5) * 0.7,
      v: SPEED * (0.92 + 0.16 * r(4)),
      sign: r(6) < 0.5 ? -1 : 1, ph: r(7) * 6.2832
    };
    for (var t = 2; t <= 240; t += STEP) {
      var p = at(L, t);
      if (p.x < -REACH || p.x > W + REACH || p.y < -REACH || p.y > Hh + REACH) { L.dur = t; break; }
    }
    return L;
  }

  var cache = {};
  function lifeAt(seed, k, t, W, Hh) { // slot k's life containing t
    var key = seed + "|" + k + "|" + W + "|" + Hh, ls = cache[key] || (cache[key] = []), L;
    if (!ls.length) { // warm-up: life 0 is already part-way across at t=0
      L = makeLife(seed, k, 0, W, Hh, 0);
      L.start = -(0.2 + 0.6 * H(seed, k, 0, 9)) * L.dur;
      ls.push(L);
    }
    while ((L = ls[ls.length - 1]).start + L.dur <= t) ls.push(makeLife(seed, k, ls.length, W, Hh, L.start + L.dur));
    for (var i = ls.length - 1; i >= 0; i--) if (ls[i].start <= t) return ls[i];
    return ls[0];
  }

  function gap(c, r, rects) { // cells from the cell to the nearest text box (0 = inside, margin included)
    var m = 99, i, q, dx, dy;
    for (i = 0; i < rects.length; i++) {
      q = rects[i];
      dx = Math.max(q.x - TEXT_MARGIN - (c + 1), c - (q.x + q.w + TEXT_MARGIN), 0);
      dy = Math.max(q.y - TEXT_MARGIN - (r + 1), r - (q.y + q.h + TEXT_MARGIN), 0) * ASPECT;
      m = Math.min(m, Math.hypot(dx, dy));
    }
    return m;
  }

  function frame(seed, t, cols, rows, rects) {
    var W = cols, Hh = rows * ASPECT, sharks = [], best = new Float32Array(cols * rows), own = new Int8Array(cols * rows), k, i, c, r;
    rects = rects || []; t = Math.max(0, t);
    for (k = 0; k < 3; k++) {
      var L = lifeAt(seed, k, t, W, Hh), tau = t - L.start, p = at(L, tau), P = SHAPES[k], len = P[0], mine = [];
      var ct = Math.cos(p.th), st = Math.sin(p.th);
      sharks.push({ id: k + "." + L.n, x: p.x, y: p.y, heading: p.th * 180 / Math.PI, turn: p.om * 180 / Math.PI, speed: L.v, len: len, type: k, hue: P[2], age: tau, n: 0 });
      for (r = Math.max(0, Math.floor((p.y - REACH) / ASPECT)); r <= Math.min(rows - 1, Math.ceil((p.y + REACH) / ASPECT)); r++) {
        for (c = Math.max(0, Math.floor(p.x - REACH)); c <= Math.min(cols - 1, Math.ceil(p.x + REACH)); c++) {
          var dx = c + 0.5 - p.x, dy = (r + 0.5) * ASPECT - p.y;
          var col = len / 2 - (dx * ct + dy * st);
          if (col < -6 || col >= len + 4) continue;
          var fu = col / len, v = -dx * st + dy * ct;
          v -= BEND.amp * (0.2 + 0.8 * fu) * Math.sin(6.2832 * (tau / BEND.period) + L.ph - 2.2 * fu) + P[1] * (Math.pow(2 * fu - 1, 2) - 0.33);
          var q = density(k, col, v);
          if (q >= 0.04) mine.push({ i: r * cols + c, d: q });
        }
      }
      mine.sort(function (a, b) { return b.d - a.d || a.i - b.i; }); // over this shark's cap of tiles: keep the densest
      mine = mine.filter(function (m, j) { return m.d < 0.2 || j < P[3]; });
      mine.forEach(function (m) { if (m.d > best[m.i]) { best[m.i] = m.d; own[m.i] = k + 1; } });
    }
    var cells = [], tints = [];
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var d = best[r * cols + c];
      if (!d) continue;
      var g = glyph(seed, c, r, t, d, SHAPES[own[r * cols + c] - 1][2]), tile = 0, ink = INK[g.ch], gp = gap(c, r, rects), cap = 1;
      if (d >= 0.2) tile = LADDER[Math.min(7, Math.floor(2 + (d - 0.2) / 0.8 * 6.99))];
      if (gp < TEXT_RISE) cap = TEXT_FADE_MAX + (LADDER[7] - TEXT_FADE_MAX) * gp / TEXT_RISE;
      tile = Math.min(tile, cap); ink = Math.min(ink, cap);
      if (gp === 0) g.tint = null;
      cells.push({ x: c, y: r, ch: g.ch, tile: tile, ink: ink, tint: g.tint, n: g.n, o: own[r * cols + c] - 1 });
    }
    var dust = [], occ = {};
    for (i = 0; i < DUST_N; i++) {
      var life = 0.3 + 0.2 * H(seed, i, 0), cyc = life + 0.15 * H(seed, i, 1), tt = t + H(seed, i, 2) * 64;
      var ep = Math.floor(tt / 8);
      if (tt % cyc >= life) continue;
      c = Math.floor(H(seed, i, 3, ep) * cols); r = Math.floor(H(seed, i, 4, ep) * rows);
      if (best[r * cols + c]) continue;
      dust.push({ x: c, y: r, ch: H(seed, i, 5, ep) < 0.7 ? "-" : ".", tile: 0, ink: 0.08, tint: null });
    }
    var room = MAX_CELLS - dust.length;
    if (cells.length > room) { // over budget: keep the densest
      cells.sort(function (a, b) { return b.tile - a.tile || a.y - b.y || a.x - b.x; });
      cells = cells.slice(0, room).sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    }
    var cap10 = Math.floor(cells.length * TINT_SHARE), hot = cells.filter(function (q) { return q.tint !== null; });
    if (hot.length > cap10) { // keep the ones the hash likes least... deterministic, spread over the body
      hot.sort(function (a, b) { return H(seed, a.x, a.y, 6000, a.n) - H(seed, b.x, b.y, 6000, b.n); });
      hot.slice(cap10).forEach(function (q) { q.tint = null; });
    }
    cells.forEach(function (q) { if (q.tile) sharks[q.o].n++; delete q.n; delete q.o; });
    return { sharks: sharks, cells: cells, dust: dust };
  }

  return { frame: frame, density: density, glyph: glyph, TEXT_FADE_MAX: TEXT_FADE_MAX, TEXT_MARGIN: TEXT_MARGIN, LADDER: LADDER, LENS: SHAPES.map(function (s) { return s[0]; }), REACH: REACH, MAX_CELLS: MAX_CELLS, BEND: BEND };
});
