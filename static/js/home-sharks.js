/* Home hero background (DESIGN.md decision 183): ASCII humpback whales on a cell grid, drawn with canvas 2D from
   sharks-sim.js (load first). Desktop only (hover, >= laptop, no reduced-motion); elsewhere the stylesheet shows the
   still; if 2D fails [data-fallback] goes on the still. Colours and font come from the stylesheet. Budget: 16384 bytes with the sim. */
(() => {
  'use strict';
  const cv = document.querySelector('[data-home-sharks]');
  if (!cv) return;
  const Sim = window.SharksSim;
  const hero = cv.parentElement;
  const still = document.querySelector('[data-home-sharks-still]');
  if (!Sim) { if (still) still.setAttribute('data-fallback', ''); return; }
  const desktop = matchMedia('(min-width: 961px) and (hover: hover) and (prefers-reduced-motion: no-preference)'); // 961px = tailwind `laptop`
  const FRAME_MS = 1000 / 30 - 4;   // at most 30 fps
  const SEED = 36;                  // starts with whales in view

  const FADE = Sim.TEXT_FADE_MAX;
  const GRID = Sim.LADDER[0];       // grid lines: the ink ladder's first step
  let ctx, grid, cw, ch, cols, rows, rects, ink, paper, tints, font, dpr;
  let ready = null, running = false, visible = true, last = 0, clock = 0, timer;
  const styles = {};

  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const inkA = (a) => styles[a] || (styles[a] = `rgb(${ink} / ${a})`);

  const init = () => {
    try { ctx = Sim && cv.getContext('2d'); } catch (e) { ctx = null; }
    ink = token('--ink-rgb');
    paper = `rgb(${token('--surface-rgb')})`;
    tints = [1, 2, 3, 4].map((n) => `rgb(${token(`--shark-${n}-rgb`)})`);
    font = getComputedStyle(cv).fontFamily;
    return !!ctx && !!ink && !paper.includes('()') && !tints.some((c) => c.includes('()'));
  };

  // One box per LINE of hero text (cells, glyph-wide): the sim fades cells to TEXT_FADE_MAX inside them.
  const measure = () => {
    const o = cv.getBoundingClientRect(), w = document.createTreeWalker(hero, 4), rg = document.createRange();
    rects = [];
    for (let n; (n = w.nextNode());) {
      if (!n.textContent.trim()) continue;
      rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width > 0 && r.height > 0) rects.push({ x: (r.left - o.left) / cw, y: (r.top - o.top) / ch, w: r.width / cw, h: r.height / ch });
    }
  };

  // Everything that depends on size: cell, backing store, grid layer, text boxes.
  const size = () => {
    const w = cv.clientWidth, h = cv.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = Math.min(14, Math.max(8, w * 0.0082));
    ch = cw * 1.5;
    cols = Math.ceil(w / cw);
    rows = Math.ceil(h / ch);
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    grid = document.createElement('canvas');
    grid.width = cv.width;
    grid.height = cv.height;
    const g = grid.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = inkA(GRID);
    for (let x = 0; x <= cols; x++) g.fillRect(Math.round(x * cw), 0, 1, h);
    for (let y = 0; y <= rows; y++) g.fillRect(0, Math.round(y * ch), w, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${Math.round(ch * 0.78)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    measure();
  };

  const draw = (t) => {
    const f = Sim.frame(SEED, t, cols, rows, rects);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(grid, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const c of f.cells.concat(f.dust)) {
      const x = c.x * cw, y = c.y * ch;
      if (c.tile) {
        ctx.fillStyle = inkA(c.tile);
        ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
      }
      // Inside a text box the whole cell stays under FADE: no tint, and the
      // glyph only tops the tile up to it (check:hero-sharks relies on this).
      const faded = c.tile <= FADE;
      if (c.tint !== null && !faded) ctx.fillStyle = tints[c.tint];
      else if (c.tile >= 0.4) ctx.fillStyle = paper;
      else ctx.fillStyle = inkA(faded ? Math.min(c.ink, Math.max(0, FADE - c.tile)).toFixed(3) : c.ink);
      ctx.fillText(c.ch, x + cw / 2, y + ch / 2);
    }
  };

  const frame = (now) => {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    clock += Math.min(now - last, 100) / 1000;   // a returning tab does not jump
    last = now;
    draw(clock);
  };

  const update = () => {
    const go = desktop.matches && visible && !document.hidden;
    if (go && ready === null) {
      ready = init();
      if (!ready && still) still.setAttribute('data-fallback', '');
    }
    if (go && ready && !running) {
      size();
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    } else if (!go && running) {
      running = false;
    }
    if (ready && !desktop.matches) ctx.clearRect(0, 0, cv.width, cv.height);
  };

  desktop.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (running) size(); }, 120);
  });
  const remeasure = () => { if (running) measure(); };   // the text moves when a font or the layout settles
  if (document.fonts) { document.fonts.ready.then(remeasure); document.fonts.addEventListener('loadingdone', remeasure); }
  addEventListener('load', remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(hero);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      update();
    }).observe(hero);
  }
  update();
})();
