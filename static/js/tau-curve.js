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

    // Settled level: where the system is heading.
    ctx.save();
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = stroke(0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(w, targetY);
    ctx.stroke();
    ctx.restore();

    // One time constant — the quantity the company is named for.
    if (!isStatic && traced > tauX) {
      ctx.save();
      ctx.setLineDash([1, 5]);
      ctx.strokeStyle = stroke(0.14);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tauX, targetY);
      ctx.lineTo(tauX, baseY);
      ctx.stroke();
      ctx.restore();
    }

    // Sample at device resolution so the ringing stays smooth.
    const steps = Math.max(2, Math.ceil(traced));
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const px = (traced * i) / steps;
      points.push([px, baseY - response(px / w) * rise]);
    }
    if (points.length < 2) return;

    // Area under the curve, fading down.
    const fill = ctx.createLinearGradient(0, targetY, 0, h);
    fill.addColorStop(0, stroke(0.035));
    fill.addColorStop(1, stroke(0));
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const [px, py] of points) ctx.lineTo(px, py);
    ctx.lineTo(points[points.length - 1][0], h);
    ctx.closePath();
    ctx.fill();

    // The trace itself.
    ctx.strokeStyle = stroke(isStatic ? 0.3 : 0.42);
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [px, py] of points) ctx.lineTo(px, py);
    ctx.stroke();

    // Leading edge, while the trace is still being drawn.
    if (progress < 1) {
      const [hx, hy] = points[points.length - 1];
      ctx.fillStyle = stroke(0.9);
      ctx.beginPath();
      ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
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

    // Centre sits off the right edge, so the visible figure is the left part of
    // a much larger instrument rather than a complete circle floating in a box.
    const cx = w * 0.82;
    const cy = h * 0.5;
    const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * (1 + drift);

    ctx.lineWidth = 1;

    // Spokes first, so the rings read on top of them.
    for (let i = 0; i < POLAR_SPOKES; i++) {
      const a = (i / POLAR_SPOKES) * Math.PI * 2;
      // Cardinal spokes carry a touch more weight, the way a dial marks
      // quarters — a grid of identical lines is wallpaper.
      const cardinal = i % 3 === 0;
      ctx.strokeStyle = stroke(cardinal ? 0.1 : 0.05);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * maxR * progress, cy + Math.sin(a) * maxR * progress);
      ctx.stroke();
    }

    for (let i = 1; i <= POLAR_RINGS; i++) {
      const r = (maxR * i) / POLAR_RINGS;
      // Rings arrive from the inside out as the figure traces.
      const t = Math.min(1, Math.max(0, progress * POLAR_RINGS - (i - 1)));
      if (t <= 0) continue;
      ctx.strokeStyle = stroke(0.09);
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
      ctx.stroke();
    }
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

    const sep = w * 0.18;
    const cy = h * 0.55;
    const sources = [
      [w * 0.5 - sep, cy],
      [w * 0.5 + sep, cy],
    ];
    // The wavelength breathes; the fringes slide through each other without
    // anything moving, which is what interference actually looks like.
    const spacing = (Math.hypot(w, h) / FRINGES) * (1 + drift * 6);

    ctx.lineWidth = 1;
    for (const [sx, sy] of sources) {
      for (let i = 1; i <= FRINGES; i++) {
        const t = Math.min(1, Math.max(0, progress * FRINGES - (i - 1)));
        if (t <= 0) continue;
        // Outer rings fade, so the figure has a centre of gravity instead of
        // filling the frame evenly.
        ctx.strokeStyle = stroke(0.07 * (1 - i / (FRINGES + 4)));
        ctx.beginPath();
        ctx.arc(sx, sy, spacing * i, 0, Math.PI * 2 * t);
        ctx.stroke();
      }
    }
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }

    // progress: how much of the figure has been traced, 0..1
    // drift:    slow breathing applied once it has settled
    function draw(progress, drift) {
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;
      spec.draw(ctx, { w: width, h: height, progress, drift, stroke, isStatic });
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
