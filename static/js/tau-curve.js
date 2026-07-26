// The step response of an underdamped second-order system, drawn at viewport
// scale as a horizon line.
//
// This is the company's own diagram, not decoration: tau is the time constant,
// the measure of how fast a system absorbs a disturbance and returns to a
// stable state. The curve below is literally that definition — a flat
// baseline, a step, overshoot, ringing, settlement — which is why it earns the
// space a photograph would otherwise occupy.
//
//   <canvas data-tau-curve></canvas>           animated: traced once, then breathes
//   <canvas data-tau-curve="static"></canvas>  drawn once, no loop
//
// Canvas 2D rather than WebGL: a single path needs no GPU context, no library,
// and does not heat a phone.

(() => {
  "use strict";

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

  const TRACE_MS = 7000;
  const BREATHE_MS = 9000;
  // The settled curve only drifts by a hair. Anything more reads as a loading
  // state rather than a system at rest.
  const BREATHE_AMPLITUDE = 0.012;
  // Redraws per second once the trace is done. The trace itself runs at the
  // display's rate; the idle breathing does not need to.
  const IDLE_FPS = 30;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

  function createCurve(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const isStatic = canvas.dataset.tauCurve === "static";
    let width = 0;
    let height = 0;
    let raf = null;
    let timer = null;
    let startedAt = null;
    // Elapsed time at the last breath, so scrolling away and back resumes
    // rather than restarting the trace.
    let breatheAt = null;
    let onScreen = true;

    // Read the ink colour from the token layer so the curve follows a palette
    // change like everything else.
    const ink = getComputedStyle(document.documentElement)
      .getPropertyValue("--text-primary-rgb")
      .trim() || "255 255 255";
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

    // progress: how much of the curve has been traced, 0..1
    // drift:    slow vertical breathing applied to the settled level
    function draw(progress, drift) {
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;

      // The baseline sits low so the step reads as a rise. The settled level is
      // derived rather than chosen: scale the curve so its peak overshoot lands
      // exactly on the top inset, whatever the container's height. Picking the
      // target by eye works at one size and clips the ringing at another.
      const baseY = height * 0.8;
      const topInset = height * 0.08;
      const rise = ((baseY - topInset) / PEAK) * (1 + drift);
      const targetY = baseY - rise;

      const stepX = width * STEP_AT;
      const tauX = stepX + (width - stepX) * TAU_FRAC;
      const traced = width * progress;

      // Settled level: where the system is heading.
      ctx.save();
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = stroke(0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, targetY);
      ctx.lineTo(width, targetY);
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
        points.push([px, baseY - response(px / width) * rise]);
      }
      if (points.length < 2) return;

      // Area under the curve, fading down.
      const fill = ctx.createLinearGradient(0, targetY, 0, height);
      fill.addColorStop(0, stroke(0.035));
      fill.addColorStop(1, stroke(0));
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (const [px, py] of points) ctx.lineTo(px, py);
      ctx.lineTo(points[points.length - 1][0], height);
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

    function drawSettled() {
      draw(1, 0);
    }

    // The trace runs on rAF, where smoothness is worth the display's frame
    // rate. The settled breathing does not: it moves the curve by about one
    // percent over nine seconds, so it runs on a timer instead. Driving it from
    // rAF and discarding three callbacks in four would still wake the main
    // thread at the display's rate while doing nothing.
    function frame(now) {
      if (startedAt === null) startedAt = now;
      const elapsed = now - startedAt;

      if (elapsed < TRACE_MS) {
        // Ease the sweep so it leaves the origin briskly and eases into the
        // settled tail, the way a pen plotter would.
        const t = elapsed / TRACE_MS;
        draw(1 - Math.pow(1 - t, 2), 0);
        raf = requestAnimationFrame(frame);
        return;
      }

      raf = null;
      breatheFrom(elapsed);
    }

    function breatheFrom(elapsed) {
      const phase = ((elapsed - TRACE_MS) / BREATHE_MS) * Math.PI * 2;
      draw(1, Math.sin(phase) * BREATHE_AMPLITUDE);
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
      // Resume mid-breath rather than replaying the trace every time the hero
      // scrolls back into view.
      if (breatheAt !== null) breatheFrom(breatheAt);
      else raf = requestAnimationFrame(frame);
    }

    function render() {
      if (!resize()) return;
      stop();
      // Reduced motion still gets the diagram — it is content, not ornament —
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
    const canvases = document.querySelectorAll("[data-tau-curve]");
    if (!canvases.length) return;

    const curves = [];
    canvases.forEach((canvas) => {
      canvas.setAttribute("aria-hidden", "true");
      const curve = createCurve(canvas);
      if (!curve) return;
      curves.push([canvas, curve]);
      curve.render();
    });
    if (!curves.length) return;

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const found = curves.find(([c]) => c === entry.target);
            if (found) found[1].setVisible(entry.isIntersecting);
          });
        },
        { rootMargin: "100px" }
      );
      curves.forEach(([canvas]) => io.observe(canvas));
    }

    document.addEventListener("visibilitychange", () => {
      curves.forEach(([, curve]) => {
        if (document.hidden) curve.stop();
        else curve.setVisible(true);
      });
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => curves.forEach(([, c]) => c.render()), 150);
    });

    // Re-render if the user changes the motion preference mid-session.
    const onMotionChange = () => curves.forEach(([, c]) => c.render());
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", onMotionChange);

    // The curve is measured in CSS pixels, so a late-loading webfont that
    // reflows its container would leave it drawn at the wrong size.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => curves.forEach(([, c]) => c.render()));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
