// Screen-scale generative figures, drawn on canvas.
//
// This site uses no photography. The full-bleed layout it borrows works on the
// reference site because a rocket sits under every section; without imagery of
// that calibre the same layout returns empty black panels. There are three
// further reasons beyond not having the pictures: the content policy requires
// images to be self-hosted, the contrast audit is blind to a background image
// and would pass white text over a pale photograph, and a full-bleed image
// becomes the LCP element on exactly the pages whose LCP the font strategy
// exists to protect. Figures drawn from arithmetic have none of those problems:
// no colour, never an LCP candidate, and the audit still sees the real ground.
//
//   <canvas data-tau-curve></canvas>                    traced once, then breathes
//   <canvas data-tau-curve="static"></canvas>           drawn once, no loop
//   <canvas data-figure="polar-grid"></canvas>          same, by name
//   <canvas data-figure="interference" data-static></canvas>
//
// One runtime for all of them. The lifecycle below — device-pixel sizing,
// intersection, tab visibility, reduced motion, resize, late fonts — is the
// part that is easy to get subtly wrong, and having it once means a new figure
// cannot get it wrong differently. Adding one is a draw function and a registry
// entry; it inherits everything else.
//
// Canvas 2D rather than WebGL: these are paths, and paths need no GPU context,
// no library, and do not heat a phone.

(() => {
  "use strict";


  // ---------------------------------------------------------------------------
  // The grid rasteriser.
  //
  // The three figures below are unchanged as mathematics: the same step
  // response, the same ring radii, the same fringe spacing. What changed is
  // where they land. Instead of stroking continuous paths, every figure now
  // plots onto a fixed grid of square cells, which is what makes the family
  // read as instrument output rather than as illustration.
  //
  // Cells accumulate into a map before anything is painted, keeping the highest
  // alpha rather than compositing. Two rings crossing the same cell would
  // otherwise darken it twice and the crossings — the part of the interference
  // figure that carries the information — would burn out.
  //
  // 5px, from DESIGN.md: coarse enough to read as a grid, fine enough that a
  // second-order step response is still recognisably one. Eight and above and
  // the overshoot stops being legible, which would make it decoration.
  const CELL = 5;

  // Ordered dither, 4x4 Bayer. Ordered rather than random because the figure is
  // redrawn on every breath and a stochastic fill would crawl.
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  function rasteriser(ctx, stroke, w, h, dpr) {
    // Snap the cell to whole DEVICE pixels. CELL is authored in CSS pixels and
    // the context is scaled by dpr, so on a 1.25x or 1.5x display — the default
    // on a large population of Windows laptops — a 5px cell is 6.25 device
    // pixels and every edge lands on a half pixel and is antialiased. That
    // erases the hard edge, which is the whole point of drawing on a grid.
    const cell = Math.max(1, Math.round(CELL * dpr)) / dpr;

    // One bucket per alpha rather than one fillStyle assignment per cell.
    // Assigning fillStyle forces a CSS colour parse; the interference figure
    // plots tens of thousands of cells per frame and only a handful of distinct
    // alphas, so this turns ~35k parses into ~30.
    const byAlpha = new Map();
    const seen = new Map();

    const plot = (x, y, alpha) => {
      if (alpha <= 0) return;
      const gx = Math.round(x / cell) * cell;
      const gy = Math.round(y / cell) * cell;
      // Cull off-canvas. The continuous-stroke version handed clipping to the
      // rasteriser in C++; plotting into a Map does not get that for free, and
      // the interference figure generates ~9x more points than land on the
      // surface. Without this the idle loop repaints tens of thousands of
      // invisible rectangles thirty times a second, forever.
      if (gx < -cell || gy < -cell || gx > w || gy > h) return;
      const key = gx + "," + gy;
      const prev = seen.get(key);
      if (prev !== undefined && prev >= alpha) return;
      seen.set(key, alpha);
      let bucket = byAlpha.get(alpha);
      if (!bucket) byAlpha.set(alpha, (bucket = []));
      bucket.push(gx, gy);
    };

    const segment = (x0, y0, x1, y1, alpha) => {
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(dist / (cell * 0.5)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        plot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, alpha);
      }
    };

    const arc = (cx, cy, radius, a0, a1, alpha) => {
      if (radius <= 0) return;
      const sweep = Math.abs(a1 - a0);
      const steps = Math.max(1, Math.ceil((sweep * radius) / (cell * 0.5)));
      for (let i = 0; i <= steps; i++) {
        const a = a0 + (a1 - a0) * (i / steps);
        plot(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, alpha);
      }
    };

    // The area under a curve, as density rather than as a gradient.
    //
    // A dot grid has no gradient to give, and fading each cell's alpha just
    // produces a blurry grid. Dithering is the technique for exactly this: hold
    // the ink constant and vary how many cells carry it.
    //
    // Depth is measured against the FIXED span the gradient used, not against
    // each column's own curve height. Normalising per column made the flat run
    // before the step — where the band is only 0.2h tall — come out at nearly
    // full density while the settled region at the same y got one cell in
    // sixteen, so the pre-step baseline read heavier than the response and the
    // step stopped reading as a rise.
    const ramp = (topAt, spanTop, bottom, x0, x1, alpha) => {
      const span = bottom - spanTop || 1;
      for (let x = x0; x <= x1; x += cell) {
        const top = topAt(x);
        if (top >= bottom) continue;
        for (let y = top; y <= bottom; y += cell) {
          const depth = (y - spanTop) / span;
          const want = (1 - depth) * (1 - depth) * (1 - depth);
          if (want <= 0) continue;
          const bx = Math.abs(Math.round(x / cell)) % 4;
          const by = Math.abs(Math.round(y / cell)) % 4;
          if (want * 16 > BAYER[by][bx]) plot(x, y, alpha);
        }
      }
    };

    const flush = () => {
      const side = cell - Math.min(1, cell * 0.2);
      for (const [alpha, xy] of byAlpha) {
        ctx.fillStyle = stroke(alpha);
        for (let i = 0; i < xy.length; i += 2) ctx.fillRect(xy[i], xy[i + 1], side, side);
      }
      byAlpha.clear();
      seen.clear();
    };

    return { plot, segment, arc, ramp, flush, cell };
  }

  // ---------------------------------------------------------------------------
  // The tau curve: the step response of an underdamped second-order system.
  //
  // Not decoration and not a generic swoosh — tau is the time constant, the
  // measure of how fast a system absorbs a disturbance and returns to a stable
  // state, and this curve is literally that definition: flat baseline, step,
  // overshoot, ringing, settlement. That is why it earns the space a photograph
  // would otherwise take.

  // Damping ratio. Low enough to ring visibly, high enough to settle inside
  // the frame — the overshoot is the part that reads as "disturbance", and
  // without it the curve is just an ease-out.
  const ZETA = 0.22;
  const OMEGA_N = 1;
  const OMEGA_D = Math.sqrt(1 - ZETA * ZETA);

  // How much settling time the width covers, in the same units.
  const SPAN = 18;
  // Where the step happens, as a fraction of width. The flat run before it is
  // what makes the step legible as an event.
  const STEP_AT = 0.12;
  // One time constant, in fractions of the post-step run.
  const TAU_FRAC = 1 / (ZETA * OMEGA_N) / SPAN;
  // Peak of the first overshoot, from the standard maximum-overshoot identity.
  // Used to scale the curve so the ringing always fits the frame.
  const PEAK = 1 + Math.exp((-ZETA * Math.PI) / OMEGA_D);

  // Normalised response: 0 before the step, settling to 1 well after it.
  function response(x) {
    if (x <= STEP_AT) return 0;
    const s = ((x - STEP_AT) / (1 - STEP_AT)) * SPAN;
    const envelope = Math.exp(-ZETA * OMEGA_N * s);
    return (
      1 -
      envelope *
        (Math.cos(OMEGA_D * s) + ((ZETA * OMEGA_N) / OMEGA_D) * Math.sin(OMEGA_D * s))
    );
  }

  function drawTau(ctx, g) {
    const { w, h, progress, drift, stroke, isStatic } = g;
    const r = rasteriser(ctx, stroke, w, h, g.dpr);

    // The baseline sits low so the step reads as a rise. The settled level is
    // derived rather than chosen: scale the curve so its peak overshoot lands
    // exactly on the top inset, whatever the container's height. Picking the
    // target by eye works at one size and clips the ringing at another.
    const baseY = h * 0.8;
    const topInset = h * 0.08;
    const rise = ((baseY - topInset) / PEAK) * (1 + drift);
    const targetY = baseY - rise;

    const stepX = w * STEP_AT;
    const tauX = stepX + (w - stepX) * TAU_FRAC;
    const traced = w * progress;

    // Settled level: where the system is heading. A dashed rule becomes every
    // other cell, which is the same statement in this vocabulary.
    for (let x = 0; x <= w; x += r.cell * 2) r.plot(x, targetY, 0.1);

    // One time constant — the quantity the company is named for.
    if (!isStatic && traced > tauX) {
      for (let y = targetY; y <= baseY; y += r.cell * 2) r.plot(tauX, y, 0.14);
    }

    // Sample at device resolution so the ringing stays smooth.
    const steps = Math.max(2, Math.ceil(traced));
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const px = (traced * i) / steps;
      points.push([px, baseY - response(px / w) * rise]);
    }
    if (points.length < 2) return;

    // Area under the curve, as dither density rather than as a gradient.
    r.ramp((x) => baseY - response(x / w) * rise, targetY, h, 0, points[points.length - 1][0], 0.035);

    // The trace itself.
    const traceAlpha = isStatic ? 0.3 : 0.42;
    for (let i = 1; i < points.length; i++) {
      r.segment(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], traceAlpha);
    }

    // Leading edge, while the trace is still being drawn. One cell at full
    // weight — a 1.5px dot has no meaning on a 5px grid.
    if (progress < 1) {
      const [hx, hy] = points[points.length - 1];
      r.plot(hx, hy, 0.9);
    }

    r.flush();
  }

  // ---------------------------------------------------------------------------
  // Polar grid: the plane the curve is measured against.
  //
  // Rings at constant radius, spokes at constant angle, anchored off the right
  // edge so the copy column on the left stays open. It reads as an instrument
  // face rather than a pattern, which is the same register as the tau curve —
  // this family is drawn from measurement, not from taste.

  const POLAR_RINGS = 7;
  const POLAR_SPOKES = 12;

  function drawPolar(ctx, g) {
    const { w, h, progress, drift, stroke } = g;
    const r = rasteriser(ctx, stroke, w, h, g.dpr);

    // Centre sits off the right edge, so the visible figure is the left part of
    // a much larger instrument rather than a complete circle floating in a box.
    const cx = w * 0.82;
    const cy = h * 0.5;
    const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * (1 + drift);

    // Spokes first, so the rings read on top of them.
    for (let i = 0; i < POLAR_SPOKES; i++) {
      const a = (i / POLAR_SPOKES) * Math.PI * 2;
      // Cardinal spokes carry a touch more weight, the way a dial marks
      // quarters — a grid of identical lines is wallpaper.
      const cardinal = i % 3 === 0;
      r.segment(
        cx,
        cy,
        cx + Math.cos(a) * maxR * progress,
        cy + Math.sin(a) * maxR * progress,
        cardinal ? 0.1 : 0.05
      );
    }

    for (let i = 1; i <= POLAR_RINGS; i++) {
      const radius = (maxR * i) / POLAR_RINGS;
      // Rings arrive from the inside out as the figure traces.
      const t = Math.min(1, Math.max(0, progress * POLAR_RINGS - (i - 1)));
      if (t <= 0) continue;
      r.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t, 0.09);
    }

    r.flush();
  }

  // ---------------------------------------------------------------------------
  // Interference: two sources, drawn as iso-phase rings.
  //
  // Where the two families cross, the eye assembles the hyperbolic fringes on
  // its own — the figure is only circles, so it costs two loops of arcs rather
  // than a per-pixel field. Two signals meeting and producing a pattern neither
  // carries alone is a reasonable thing for this company to have on a wall.

  const FRINGES = 14;

  function drawInterference(ctx, g) {
    const { w, h, progress, drift, stroke } = g;
    const r = rasteriser(ctx, stroke, w, h, g.dpr);

    const sep = w * 0.18;
    const cy = h * 0.55;
    const sources = [
      [w * 0.5 - sep, cy],
      [w * 0.5 + sep, cy],
    ];
    // The wavelength breathes; the fringes slide through each other without
    // anything moving, which is what interference actually looks like.
    // Quantised to whole cells. Left continuous, `spacing * i` moves the outer
    // rings by a few pixels per frame and every cell they touch re-snaps to a
    // different square — a measured 22-32% of the field flipping thirty times a
    // second, which reads as boiling. Snapping the wavelength means most frames
    // are identical and the ones that change shift the whole family by one cell.
    const spacingRaw = (Math.hypot(w, h) / FRINGES) * (1 + drift * 6);
    const spacing = Math.max(r.cell, Math.round(spacingRaw / r.cell) * r.cell);

    for (const [sx, sy] of sources) {
      for (let i = 1; i <= FRINGES; i++) {
        const t = Math.min(1, Math.max(0, progress * FRINGES - (i - 1)));
        if (t <= 0) continue;
        // Outer rings fade, so the figure has a centre of gravity instead of
        // filling the frame evenly.
        r.arc(sx, sy, spacing * i, 0, Math.PI * 2 * t, 0.07 * (1 - i / (FRINGES + 4)));
      }
    }

    // Both families share one flush, so a cell where two rings cross is painted
    // once at the stronger alpha. Flushing per source would double it and the
    // crossings — the whole point of the figure — would blow out.
    r.flush();
  }

  // ---------------------------------------------------------------------------

  const FIGURES = {
    tau: { draw: drawTau, traceMs: 7000, breatheMs: 9000, amplitude: 0.012 },
    // Slower and shallower than the curve: a grid that visibly pulses reads as
    // a loading state, and this one is meant to sit still behind text.
    "polar-grid": { draw: drawPolar, traceMs: 5200, breatheMs: 14000, amplitude: 0.008 },
    interference: { draw: drawInterference, traceMs: 6000, breatheMs: 16000, amplitude: 0.01 },
  };

  // Redraws per second once the trace is done. The trace itself runs at the
  // display's rate; the idle breathing does not need to.
  const IDLE_FPS = 30;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function createFigure(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const name = canvas.dataset.figure || "tau";
    const spec = FIGURES[name];
    if (!spec) return null;

    // Both spellings mean the same thing: the original data-tau-curve="static"
    // and a bare data-static on the newer figures.
    const isStatic =
      canvas.dataset.tauCurve === "static" || canvas.dataset.static !== undefined;

    let width = 0;
    let dprUsed = 1;
    let height = 0;
    let raf = null;
    let timer = null;
    let startedAt = null;
    // Elapsed time at the last breath, so scrolling away and back resumes
    // rather than restarting the trace.
    let breatheAt = null;
    let onScreen = true;

    // Read the ink colour from the token layer so every figure follows a
    // palette change like everything else.
    const ink =
      getComputedStyle(document.documentElement).getPropertyValue("--ink-rgb").trim() ||
      "240 240 250";
    const stroke = (a) => `rgb(${ink} / ${a})`;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      // Cap the backing store at 2x; beyond that the extra pixels cost more
      // than they show on a 1px line.
      dprUsed = Math.min(window.devicePixelRatio || 1, 2);
      const dpr = dprUsed;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastKey = null; // geometry changed; the memo is stale
      return true;
    }

    // progress: how much of the figure has been traced, 0..1
    // drift:    slow breathing applied once it has settled
    //
    // Skips the redraw when the output cannot have changed.
    //
    // Drawing on a grid makes this possible and makes it necessary. Possible,
    // because the output is a function of quantised geometry: once the breath
    // has moved everything by less than one cell, the next frame paints exactly
    // the same squares. Necessary, because a cell grid costs hundreds of
    // thousands of fillRects a second — measured at 6x CPU throttling, the
    // unconditional version held the main thread busy about half the time,
    // forever, for a background. The continuous strokes it replaced were a few
    // dozen native path calls and could afford to be lazy about this.
    //
    // The gate is one cell of movement at the figure's largest radius, which is
    // the fastest-moving thing any of them draw. Decision #17's reasoning is
    // unchanged: the timer still runs at IDLE_FPS, it just usually returns
    // without touching the canvas.
    let lastKey = null;
    function draw(progress, drift) {
      if (!width || !height) return;
      const reach = Math.hypot(width, height);
      const key =
        Math.round(width) + "x" + Math.round(height) +
        ":" + Math.round(progress * 1000) +
        ":" + Math.round((drift * reach) / Math.max(1, CELL));
      if (key === lastKey) return;
      lastKey = key;
      ctx.clearRect(0, 0, width, height);
      spec.draw(ctx, { w: width, h: height, progress, drift, stroke, isStatic, dpr: dprUsed });
    }

    const drawSettled = () => draw(1, 0);

    // The trace runs on rAF, where smoothness is worth the display's frame
    // rate. The settled breathing does not: it moves by about one percent over
    // several seconds, so it runs on a timer instead. Driving it from rAF and
    // discarding three callbacks in four would still wake the main thread at
    // the display's rate while doing nothing.
    function frame(now) {
      if (startedAt === null) startedAt = now;
      const elapsed = now - startedAt;

      if (elapsed < spec.traceMs) {
        // Ease the sweep so it leaves the origin briskly and eases into the
        // settled tail, the way a pen plotter would.
        const t = elapsed / spec.traceMs;
        draw(1 - Math.pow(1 - t, 2), 0);
        raf = requestAnimationFrame(frame);
        return;
      }

      raf = null;
      breatheFrom(elapsed);
    }

    function breatheFrom(elapsed) {
      const phase = ((elapsed - spec.traceMs) / spec.breatheMs) * Math.PI * 2;
      draw(1, Math.sin(phase) * spec.amplitude);
      breatheAt = elapsed + 1000 / IDLE_FPS;
      timer = setTimeout(() => breatheFrom(breatheAt), 1000 / IDLE_FPS);
    }

    function stop() {
      if (raf !== null) cancelAnimationFrame(raf);
      if (timer !== null) clearTimeout(timer);
      raf = null;
      timer = null;
    }

    function start() {
      if (raf !== null || timer !== null) return;
      // Resume mid-breath rather than replaying the trace every time the
      // section scrolls back into view.
      if (breatheAt !== null) breatheFrom(breatheAt);
      else raf = requestAnimationFrame(frame);
    }

    function render() {
      if (!resize()) return;
      stop();
      // Reduced motion still gets the figure — it is content, not ornament —
      // just without the sweep.
      if (isStatic || reduceMotion.matches) {
        drawSettled();
        return;
      }
      startedAt = null;
      breatheAt = null;
      if (onScreen && !document.hidden) start();
      else drawSettled();
    }

    return {
      render,
      setVisible(v) {
        onScreen = v;
        if (isStatic || reduceMotion.matches) return;
        // Nothing animating off-screen: a reader three screens down should not
        // be paying for a canvas they cannot see.
        if (v) start();
        else stop();
      },
      stop,
    };
  }

  function init() {
    const canvases = document.querySelectorAll("[data-tau-curve], [data-figure]");
    if (!canvases.length) return;

    const figures = [];
    canvases.forEach((canvas) => {
      canvas.setAttribute("aria-hidden", "true");
      const figure = createFigure(canvas);
      if (!figure) return;
      figures.push([canvas, figure]);
      figure.render();
    });
    if (!figures.length) return;

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const found = figures.find(([c]) => c === entry.target);
            if (found) found[1].setVisible(entry.isIntersecting);
          });
        },
        { rootMargin: "100px" }
      );
      figures.forEach(([canvas]) => io.observe(canvas));
    }

    document.addEventListener("visibilitychange", () => {
      figures.forEach(([, figure]) => {
        if (document.hidden) figure.stop();
        else figure.setVisible(true);
      });
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => figures.forEach(([, f]) => f.render()), 150);
    });

    // Re-render if the user changes the motion preference mid-session.
    const onMotionChange = () => figures.forEach(([, f]) => f.render());
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", onMotionChange);

    // Figures are measured in CSS pixels, so a late-loading webfont that
    // reflows the container would leave one drawn at the wrong size.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => figures.forEach(([, f]) => f.render()));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
