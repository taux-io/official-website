/* sharks-sim: pure shark simulation (spec #396). frame(seed,t,cols,rows,rects)
   -> {sharks,cells,dust}. Same inputs, same output; hash only, no clock/DOM. */
(function (root, make) {
  if (typeof module === "object" && module.exports) module.exports = make();
  else root.SharksSim = make();
})(this, function () {
  "use strict";
  var LEN = 36,  SPEED = 6.5, ASPECT = 1.5, SEG = 8, STEP = 0.1, R = LEN / 2;
  var MAX_CELLS = 900, DUST_N = 140, TINT_SHARE = 0.1;
  var TEXT_FADE_MAX = 0.12, TEXT_MARGIN = 0.4; // margin in cells, each side of a rect
  var LADDER = [0.05, 0.12, 0.2, 0.26, 0.34, 0.44, 0.54, 0.66];
  var DENSE = "@8%#SXt;:"; // dark to light; the rest is sparse
  var INK = { "@": 1, 8: 0.9, "%": 0.8, "#": 0.7, S: 0.6, X: 0.5, t: 0.4, ";": 0.32, ":": 0.25, ",": 0.12, "'": 0.09, "-": 0.08, ".": 0.06 };
  // Outlines, seen from above, as half-widths along the body (u: 0 nose .. 1 tail), all
  // in cells of width. Per type: body B, nose shape [length, power], hammer H (0 = none),
  // pectoral fin [start, length, reach], tail fork spread, spine bend.
  var SHAPES = [[3.2, 0.7, 0.14, 7, 0.2, 0.32, 4.6, 5, 2.5], [3.6, 1, 0.24, 0, 0.2, 0.34, 5.6, 5.5, 0], [4.6, 0.65, 0.24, 0, 0.2, 0.28, 3.4, 4, -3.5]];
  function clamp(d) { return d < 0 ? 0 : d > 1 ? 1 : d; }

  function density(P, u, v) { // body density at u along, a across (|v|): soft edge, dark spine
    var a = Math.abs(v), n = P[2], t = (u - P[4]) / P[5], x = (u - 0.045) / 0.045, w, e, s;
    w = u < n ? P[0] * Math.pow(u / n, P[1]) : P[0] + (0.7 - P[0]) * Math.pow((u - n) / (0.82 - n), 1.5);
    if (P[3] && u < 0.09) w = Math.max(w, P[3] * Math.pow(1 - Math.pow(x * x, 2), 0.25));
    if (t > 0 && t < 1) w = Math.max(w, 0.8 * P[0] + P[6] * (t < 0.75 ? t / 0.75 : (1 - t) / 0.25));
    e = u < 0.84 ? w - a : -9;
    if (u > 0.8) { s = (u - 0.8) / 0.2; e = Math.max(e, 2 - s * (v > 0 ? 0.9 : 1.6) - Math.abs(a - s * P[7])); }
    return clamp(0.5 + 0.9 * e) * (0.55 + 0.45 * clamp(e / 4));
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
    var r = function (i) { return H(seed, k, n, i); }, e = r(1), f = 0.15 + 0.7 * r(2), o = LEN / 2 + 2, x, y;
    if (e < 0.4) { x = -o; y = f * Hh; } else if (e < 0.8) { x = W + o; y = f * Hh; }
    else if (e < 0.9) { x = f * W; y = -o; } else { x = f * W; y = Hh + o; }
    var L = {
      seed: seed, k: k, n: n, x: x, y: y, start: start, dur: 240,
      th: Math.atan2(Hh / 2 - y, 0.6 * W - x) + (r(3) - 0.5) * 0.7,
      v: SPEED * (0.92 + 0.16 * r(4)), type: Math.floor(r(5) * 3),
      sign: r(6) < 0.5 ? -1 : 1, ph: r(7) * 6.2832
    };
    for (var t = 2; t <= 240; t += STEP) {
      var p = at(L, t);
      if (p.x < -R || p.x > W + R || p.y < -R || p.y > Hh + R) { L.dur = t; break; }
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

  function inRects(c, r, rects) {
    for (var i = 0; i < rects.length; i++) {
      var q = rects[i];
      if (c + 1 > q.x - TEXT_MARGIN && c < q.x + q.w + TEXT_MARGIN && r + 1 > q.y - TEXT_MARGIN && r < q.y + q.h + TEXT_MARGIN) return true;
    }
    return false;
  }

  function sparse(d) { return d < 0.07 ? "." : d < 0.085 ? "-" : d < 0.1 ? "'" : ","; }
  function frame(seed, t, cols, rows, rects) {
    var W = cols, Hh = rows * ASPECT, sharks = [], dens = new Float32Array(cols * rows), k, i, c, r;
    rects = rects || []; t = Math.max(0, t);
    for (k = 0; k < 3; k++) {
      var L = lifeAt(seed, k, t, W, Hh), tau = t - L.start, p = at(L, tau), P = SHAPES[L.type];
      var ct = Math.cos(p.th), st = Math.sin(p.th);
      sharks.push({ id: k + "." + L.n, x: p.x, y: p.y, heading: p.th * 180 / Math.PI, turn: p.om * 180 / Math.PI, speed: L.v, len: LEN, type: L.type, age: tau });
      for (r = Math.max(0, Math.floor((p.y - R) / ASPECT)); r <= Math.min(rows - 1, Math.ceil((p.y + R) / ASPECT)); r++) {
        for (c = Math.max(0, Math.floor(p.x - R)); c <= Math.min(cols - 1, Math.ceil(p.x + R)); c++) {
          var dx = c + 0.5 - p.x, dy = (r + 0.5) * ASPECT - p.y;
          var col = LEN / 2 - (dx * ct + dy * st);
          if (col < 0 || col >= LEN) continue;
          var fu = col / LEN, v = -dx * st + dy * ct;
          v -= 1.3 * (0.2 + 0.8 * fu) * Math.sin(6.2832 * (tau + L.ph) - 4.5 * fu) + P[8] * (Math.pow(2 * fu - 1, 2) - 0.33);
          var q = density(P, fu, v);
          if (q > dens[r * cols + c]) dens[r * cols + c] = q;
        }
      }
    }
    var cells = [], step = Math.floor(t * 12), tints = 0;
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var d = dens[r * cols + c];
      if (!d) continue;
      if (H(seed, c, r, 1000 + step) < 0.07) d = clamp(d + (H(seed, c, r, 2000 + step) - 0.5) * 0.5);
      if (d < 0.04) continue;
      var tile = 0, ch2, tint = null, cap = inRects(c, r, rects);
      if (d >= 0.2) tile = LADDER[Math.min(7, Math.floor((d - 0.2) / 0.8 * 8))];
      if (cap) { tile = Math.min(tile, TEXT_FADE_MAX); d = Math.min(d, TEXT_FADE_MAX); }
      if (d >= 0.2) ch2 = DENSE.charAt(Math.min(8, Math.floor((1 - d) / 0.8 * 9)));
      else ch2 = sparse(d);
      if (d >= 0.2 && tints < Math.floor(MAX_CELLS * TINT_SHARE) && H(seed, c, r, 3000 + Math.floor(t * 2)) < 0.14) tint = Math.floor(H(seed, c, r, 4000) * 4);
      cells.push({ x: c, y: r, ch: ch2, tile: tile, ink: INK[ch2], tint: tint, d: d });
      if (tint !== null) tints++;
    }
    var dust = [], occ = {};
    for (i = 0; i < DUST_N; i++) {
      var life = 0.3 + 0.2 * H(seed, i, 0), cyc = life + 0.15 * H(seed, i, 1), tt = t + H(seed, i, 2) * 64;
      var ep = Math.floor(tt / 8);
      if (tt % cyc >= life) continue;
      c = Math.floor(H(seed, i, 3, ep) * cols); r = Math.floor(H(seed, i, 4, ep) * rows);
      if (dens[r * cols + c]) continue;
      dust.push({ x: c, y: r, ch: H(seed, i, 5, ep) < 0.7 ? "-" : ".", tile: 0, ink: 0.08, tint: null });
    }
    var room = MAX_CELLS - dust.length;
    if (cells.length > room) { // over budget: keep the darkest
      cells.sort(function (a, b) { return b.d - a.d || a.y - b.y || a.x - b.x; });
      cells = cells.slice(0, room).sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    }
    var cap10 = Math.floor(cells.length * TINT_SHARE), used = 0;
    cells.forEach(function (q) {
      if (q.tint !== null && ++used > cap10) q.tint = null;
      delete q.d;
    });
    return { sharks: sharks, cells: cells, dust: dust };
  }

  return { frame: frame, TEXT_FADE_MAX: TEXT_FADE_MAX, TEXT_MARGIN: TEXT_MARGIN, LADDER: LADDER, LEN: LEN };
});
