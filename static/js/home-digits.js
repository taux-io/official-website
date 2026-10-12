// Home hero background: a field of 0s and 1s that lights up around the pointer.
//
// DECORATION ONLY. The canvas is aria-hidden and carries no information; every
// word on the page is real text above it. Nothing here may be the only way to
// learn or do something.
//
// COLORS ARE READ FROM THE STYLESHEET, not copied here. --ink-72-rgb is the
// resting digit, --primary-rgb the lit one; a palette change in src/input.css
// reaches this file without an edit. The fallbacks only cover a stylesheet that
// failed to load.
//
// MOTION: each digit eases toward its own target (quick up, slow down), so a
// leaving pointer leaves a trail that fades rather than a cut. The grid drifts
// on a 48 s loop. Under prefers-reduced-motion nothing eases and nothing drifts:
// the light simply follows the pointer.
(() => {
  const cv = document.querySelector('[data-home-digits]');
  if (!cv || !cv.getContext) return;
  const hero = cv.parentElement;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const FONT_PX = 10;
  const LINE_H = 14;
  const RADIUS = 210;       // spotlight radius, px
  const DIM_A = 0.2;        // resting opacity
  const LIT_A = 0.45;       // opacity at the center of the light — body text sits on top
  const RISE_TAU = 0.1;     // seconds to light up (smaller is faster)
  const FALL_TAU = 1.2;     // seconds to fade back (larger is slower)
  const FOLLOW = 0.07;      // how softly the light trails the pointer, seconds
  const SYMBOL_P = 0.03;    // share of cells that are a symbol instead of 0/1
  const SYMBOLS = '%!#@$^&*_+=~?<>/\\|';
  const DRIFT_S = 48;       // seconds per drift loop
  const DRIFT_X = 66, DRIFT_Y = 40;

  const token = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const p = v.split(/\s+/).map(Number);
    return p.length === 3 && p.every(Number.isFinite) ? p : fallback;
  };
  const DIM_RGB = token('--ink-72-rgb', [105, 107, 111]);
  const LIT_RGB = token('--primary-rgb', [33, 72, 184]);

  // Extra canvas on every side so the drift never shows an edge.
  const MX = DRIFT_X + 4, MY = DRIFT_Y + 4;
  const FONT = FONT_PX + 'px ui-monospace, "SF Mono", Menlo, monospace';

  let W = 0, H = 0, cols = 0, rows = 0, step = 0;
  let chars = [], rowText = [], inten = new Float32Array(0);
  let tx = 0, ty = 0, sx = 0, sy = 0, inside = false, fresh = true;
  let ox = 0, oy = 0, last = 0, dirty = true, running = false, visible = true;

  const rnd = () => Math.random() < SYMBOL_P
    ? SYMBOLS[(Math.random() * SYMBOLS.length) | 0]
    : (Math.random() < 0.5 ? '0' : '1');

  const build = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = hero.clientWidth + MX * 2;
    H = hero.clientHeight + MY * 2;
    cv.style.left = -MX + 'px';
    cv.style.top = -MY + 'px';
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;
    ctx.textBaseline = 'alphabetic';
    step = ctx.measureText('0').width * 2;      // one digit plus one space
    cols = Math.ceil(W / step) + 1;
    rows = Math.ceil(H / LINE_H) + 1;
    chars = Array.from({ length: rows }, () => Array.from({ length: cols }, rnd));
    rowText = chars.map((r) => r.join(' '));
    inten = new Float32Array(rows * cols);
    dirty = true;
  };

  const mix = (a, b, t) => Math.round(a + (b - a) * t);

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `rgba(${DIM_RGB[0]},${DIM_RGB[1]},${DIM_RGB[2]},${DIM_A})`;
    for (let r = 0; r < rows; r++) ctx.fillText(rowText[r], 0, r * LINE_H + LINE_H * 0.8);
    for (let r = 0; r < rows; r++) {
      const y = r * LINE_H + LINE_H * 0.8;
      for (let c = 0; c < cols; c++) {
        const v = inten[r * cols + c];
        if (v < 0.01) continue;
        const R = mix(DIM_RGB[0], LIT_RGB[0], v);
        const G = mix(DIM_RGB[1], LIT_RGB[1], v);
        const B = mix(DIM_RGB[2], LIT_RGB[2], v);
        ctx.fillStyle = `rgba(${R},${G},${B},${(DIM_A + (LIT_A - DIM_A) * v).toFixed(3)})`;
        ctx.fillText(chars[r][c], c * step, y);
      }
    }
  };

  // Left, up, right, down; each leg eased, like a CSS ease-in-out keyframe loop.
  const PATH = [[-DRIFT_X, 0], [0, -DRIFT_Y], [DRIFT_X, 0], [0, DRIFT_Y], [-DRIFT_X, 0]];
  const drift = (sec) => {
    const t = ((sec % DRIFT_S) / DRIFT_S) * 4;
    const i = Math.min(3, Math.floor(t));
    const u = t - i;
    const e = u * u * (3 - 2 * u);
    return [PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * e,
            PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * e];
  };

  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    if (!reduce.matches) {
      [ox, oy] = drift(now / 1000);
      cv.style.transform = `translate3d(${ox.toFixed(2)}px,${oy.toFixed(2)}px,0)`;
    }

    if (fresh && inside) { sx = tx; sy = ty; fresh = false; }
    const f = reduce.matches ? 1 : 1 - Math.exp(-dt / FOLLOW);
    sx += (tx - sx) * f;
    sy += (ty - sy) * f;

    // Pointer in canvas coordinates: undo the canvas margin and the current drift.
    const cx = sx + MX - ox, cy0 = sy + MY - oy;
    const up = reduce.matches ? 1 : 1 - Math.exp(-dt / RISE_TAU);
    const down = reduce.matches ? 1 : 1 - Math.exp(-dt / FALL_TAU);

    let alive = false;
    if (inside || dirty || inten.some((v) => v > 0)) {
      for (let r = 0; r < rows; r++) {
        const cy = r * LINE_H + LINE_H * 0.5;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          let target = 0;
          if (inside) {
            const d = Math.hypot(c * step + step * 0.25 - cx, cy - cy0) / RADIUS;
            if (d < 1) { const w = 1 - d; target = w * w * (3 - 2 * w); }
          }
          const cur = inten[i];
          const next = cur + (target - cur) * (target > cur ? up : down);
          inten[i] = next < 0.002 && target === 0 ? 0 : next;
          if (inten[i] > 0) alive = true;
        }
      }
      draw();
      dirty = false;
    }

    // Nothing to ease and nothing drifting: stop asking for frames.
    if (alive || inside || !reduce.matches) requestAnimationFrame(frame);
    else running = false;
  };

  const start = () => {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };

  const point = (e) => {
    const r = hero.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    inside = true;
    start();
  };
  hero.addEventListener('pointermove', point);
  hero.addEventListener('pointerdown', point);
  hero.addEventListener('pointerleave', () => { inside = false; fresh = true; start(); });

  // Off screen, stop drawing.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) start(); else running = false;
    }).observe(hero);
  }

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); start(); }, 120);
  });
  reduce.addEventListener('change', () => { if (reduce.matches) cv.style.transform = ''; start(); });

  build();
  start();
})();
