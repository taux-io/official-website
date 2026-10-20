// Does the home hero's sharks background actually run, and only where it should?
//
//   npm run serve        (another terminal)
//   npm run sharks
//
// WHY THIS EXISTS. `check:hero-sharks` computes the worst contrast the sharks can
// make from the numbers in the source; it never opens a page. `contrast` cannot
// see a <canvas> at all. So a script that draws nothing, a media query that
// starts the loop on a phone, or a loop that never stops when the hero scrolls
// away would each leave every other gate green. This drives a browser and asks
// the page, for each of the five home pages:
//
//   desktop       1440x900, hover, no reduced-motion. The canvas (canvas 2D, so
//                 no GPU and no browser flags are needed) has to have drawn
//                 something that is not paper, no CSP violation may have fired,
//                 and the still must be hidden and not downloaded.
//   sharks        every frame the page asks SharksSim for holds 3 or 4 sharks (the
//                 page's own calls are observed, not a re-run of the simulation).
//   text lines    under every line of the hero's text the canvas holds at most
//                 TEXT_CAP of alpha (12% ink and the 5% grid line, the numbers
//                 check:hero-sharks computes its worst case from), read from
//                 the canvas pixels at several moments.
//   scroll        the frame loop stops when the hero is out of view and resumes
//                 when it is back.
//   phone         390x844: no one asked for a context on .home-sharks, the loop
//                 never ran, the still is visible and answered 200.
//   reduced       desktop + prefers-reduced-motion: the same as the phone.
//   no-2d         desktop where the sharks' canvas cannot make a 2D context (an
//                 init script makes getContext("2d") answer null for it): the
//                 still takes over (the script marks it [data-fallback]).
//
// The canvas is read by screenshot, with the still hidden, against a screenshot
// of the same box with the canvas hidden. What the canvas leaves behind it is
// paper. The still is asserted by where it comes from, not by what it looks like
// (check:hero-sharks holds the picture against its ledger): a phone (< 600px)
// must be shown and download the PORTRAIT one and only that, everything else
// that shows a still (a wide screen asking for reduced motion, the no-canvas
// fallback) the LANDSCAPE one.

const sharp = require("sharp");
const { launch } = require("../browser");
const { BASE_URL } = require("../routes");
const sharksSource = require("../lib/sharks-source");

const LOCALES = ["zh-Hant-TW", "en-US", "zh-Hans-CN", "ja-JP", "ko-KR"];
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// Share of pixels in the part of the canvas box on screen that must differ from
// paper by more than PIXEL_DELTA on a channel. The grid lines (1px lines at 5%
// ink, about 11 on a channel) stay under it, so a canvas that drew only the
// grid is blank; tiles (20% ink and up, about 45) and shark glyphs are over it.
// The simulation starts from the same moment on every load: its three sharks are
// 1.6-2.1% of the box here; a blank canvas measures 0.2% (the grid edges).
const MIN_INKED_SHARE = 0.008;
const PIXEL_DELTA = 20;

// Frames the loop must make in the 700ms it is watched while it should run
// (30 fps would be ~20), and may make while it should not (the one callback
// already queued when it stopped).
// 1 - (1 - 0.12) * (1 - 0.05) = 0.164, plus rounding and glyph edges.
const TEXT_CAP = Math.ceil(0.18 * 255);
const MIN_FRAMES_RUNNING = 3;
// The phone still (phoneFade): a pixel is "clearly inked" over SHOWN_COVER of 255
// (the tiles and glyphs the fade leaves alone start at 20% ink, well above the
// 12% it holds under text) and the share of such pixels must reach MIN_SHOWN.
const SHOWN_COVER = Math.ceil(0.25 * 255);
const MIN_SHOWN = 0.005;
// Sharks in every frame the page draws (spec #396: 3, at most 4).
const MIN_SHARKS = 3;
const MAX_SHARKS = 4;
const MAX_FRAMES_STOPPED = 1;

const failures = [];
const notes = [];
const fail = (locale, cond, msg) => failures.push(`[${locale}] [${cond}] ${msg}`);

// Before any page script: count frames requested FROM home-sharks.js (the page has
// other animation of its own), note every 2D context asked of the sharks' canvas
// (and refuse it when `refuse2d`), and keep CSP violations the page itself reports.
function instrument(refuse2d) {
  window.__sharks = { frames: 0, asked: 0, csp: [], drawn: 0, minSharks: 99, maxSharks: 0 };
  // Every frame the page asks SharksSim for: how many sharks it was handed.
  let sim;
  Object.defineProperty(window, "SharksSim", {
    configurable: true,
    get: () => sim,
    set: (v) => {
      sim = v && typeof v.frame === "function" ? { ...v, frame: (...a) => {
        const out = v.frame(...a), n = out.sharks.length, s = window.__sharks;
        s.drawn++; s.minSharks = Math.min(s.minSharks, n); s.maxSharks = Math.max(s.maxSharks, n);
        return out;
      } } : v;
    },
  });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => {
    if (new Error().stack.includes("home-sharks")) window.__sharks.frames++;
    return raf(f);
  };
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (String(type) === "2d" && this.classList.contains("home-sharks")) {
      window.__sharks.asked++;
      if (refuse2d) return null;
    }
    return get.call(this, type, ...rest);
  };
  document.addEventListener("securitypolicyviolation", (e) => window.__sharks.csp.push(`${e.violatedDirective} ${e.blockedURI}`));
}

async function open(browser, locale, cond, contextOptions, refuse2d = false) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.addInitScript(instrument, refuse2d);
  const seen = { stills: [], stillUrls: [], console: [], errors: [] };
  page.on("response", (r) => { if (/hero-sharks/.test(r.url())) { seen.stills.push(r.status()); seen.stillUrls.push(r.url()); } });
  page.on("console", (m) => { if (/Content Security Policy|violates the following/i.test(m.text())) seen.console.push(m.text()); });
  page.on("pageerror", (e) => seen.errors.push(e.message));
  const res = await page.goto(`${BASE_URL}/${locale}`, { waitUntil: "load" });
  if (!res || res.status() !== 200) fail(locale, cond, `GET /${locale} answered ${res && res.status()}`);
  await page.waitForTimeout(700);
  return { context, page, seen };
}

const frames = (page) => page.evaluate(() => window.__sharks.frames);
async function framesOver(page, ms) {
  const a = await frames(page);
  await page.waitForTimeout(ms);
  return (await frames(page)) - a;
}

const stillState = (page) =>
  page.evaluate(() => {
    const s = document.querySelector("[data-home-sharks-still]");
    const cs = getComputedStyle(s);
    return { display: cs.display, h: s.getBoundingClientRect().height, image: cs.backgroundImage, fallback: s.hasAttribute("data-fallback") };
  });

async function inkedShare(page) {
  const box = page.locator("[data-home-sharks]");
  // Through the CSSOM: the page's CSP (style-src 'self') refuses an injected <style>.
  await page.evaluate(() => document.querySelectorAll(".home-sharks-still").forEach((e) => e.style.setProperty("display", "none", "important")));
  const clip = await box.boundingBox();
  const region = { x: clip.x, y: clip.y, width: clip.width, height: Math.min(clip.height, DESKTOP.height - clip.y) };
  const read = async () => {
    const { data, info } = await sharp(await page.screenshot({ clip: region })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, info };
  };
  const withSharks = await read();
  await box.evaluate((el) => { el.style.visibility = "hidden"; });
  const paper = await read();
  const { data, info } = withSharks;
  let inked = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (Math.abs(data[i] - paper.data[i]) > PIXEL_DELTA || Math.abs(data[i + 1] - paper.data[i + 1]) > PIXEL_DELTA || Math.abs(data[i + 2] - paper.data[i + 2]) > PIXEL_DELTA) inked++;
  }
  return inked / (info.width * info.height);
}

// The most alpha the canvas holds under any line of hero text, over a few moments.
// A line box is what Range.getClientRects reports for a text node, the same
// boxes home-sharks.js fades; the canvas is read through its own 2D context.
async function maxAlphaUnderText(page) {
  let worst = { alpha: 0, lines: 0, at: "" };
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate(() => {
      const cv = document.querySelector("[data-home-sharks]"), o = cv.getBoundingClientRect(), k = cv.width / o.width;
      const ctx = cv.getContext("2d"), w = document.createTreeWalker(cv.parentElement, 4), rg = document.createRange();
      let alpha = 0, lines = 0, at = "";
      for (let n; (n = w.nextNode());) {
        if (!n.textContent.trim()) continue;
        rg.selectNodeContents(n);
        for (const b of rg.getClientRects()) {
          const x = Math.max(0, Math.floor((b.left - o.left) * k)), y = Math.max(0, Math.floor((b.top - o.top) * k));
          const x2 = Math.min(cv.width, Math.ceil((b.right - o.left) * k)), y2 = Math.min(cv.height, Math.ceil((b.bottom - o.top) * k));
          if (x2 <= x || y2 <= y || b.width < 2) continue;
          lines++;
          const d = ctx.getImageData(x, y, x2 - x, y2 - y).data;
          for (let j = 3; j < d.length; j += 4) if (d[j] > alpha) { alpha = d[j]; at = `${n.textContent.trim().slice(0, 20)} @${x},${y}`; }
        }
      }
      return { alpha, lines, at };
    });
    if (r.alpha >= worst.alpha) worst = r;
    await page.waitForTimeout(900);
  }
  return worst;
}

async function desktopGroups(browser, locale) {
  const cond = "desktop";
  const { context, page, seen } = await open(browser, locale, cond, { viewport: DESKTOP, reducedMotion: "no-preference" });
  const fell = await stillState(page);
  if (fell.fallback) fail(locale, cond, "the script put the still up ([data-fallback]) although the 2D context is available: init failed (a missing token or SharksSim?)");
  if (fell.display !== "none" && !fell.fallback) fail(locale, cond, `the still is visible (display ${fell.display}) while the sharks should be drawing`);
  if (seen.stills.length && !fell.fallback) fail(locale, cond, `the still was downloaded (${seen.stills.join(",")}) although hidden`);
  const running = await framesOver(page, 700);
  if (running < MIN_FRAMES_RUNNING) fail(locale, cond, `the frame loop made ${running} frames in 700ms (needs ${MIN_FRAMES_RUNNING}+): the sharks are not running`);
  const sh = await page.evaluate(() => window.__sharks);
  if (!sh.drawn) fail(locale, cond, "the page never asked SharksSim for a frame: no sharks were simulated");
  else if (sh.minSharks < MIN_SHARKS || sh.maxSharks > MAX_SHARKS) fail(locale, cond, `${sh.minSharks}-${sh.maxSharks} sharks in the frames the page drew (needs ${MIN_SHARKS}-${MAX_SHARKS})`);
  const share = await inkedShare(page);
  if (!(share >= MIN_INKED_SHARE)) fail(locale, cond, `the canvas is blank: ${(share * 100).toFixed(2)}% of the canvas differs from paper (needs ${MIN_INKED_SHARE * 100}%+)`);
  const under = await maxAlphaUnderText(page);
  if (under.lines < 5) fail(locale, "text lines", `only ${under.lines} text lines were measured; the hero's text boxes were not found`);
  if (under.alpha > TEXT_CAP) fail(locale, "text lines", `the canvas holds alpha ${under.alpha} (limit ${TEXT_CAP}) under hero text "${under.at}": a shark leaks into a line of text`);
  const csp = [...seen.console, ...(await page.evaluate(() => window.__sharks.csp))];
  if (csp.length) fail(locale, cond, `CSP violation: ${csp.join(" | ")}`);
  if (seen.errors.length) fail(locale, cond, `page error: ${seen.errors.join(" | ")}`);

  // The hero scrolls away: the loop must stop, and come back with it.
  await page.evaluate(() => window.scrollTo(0, 4000));
  await page.waitForTimeout(500);
  const away = await framesOver(page, 700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const back = await framesOver(page, 700);
  if (away > MAX_FRAMES_STOPPED) fail(locale, "scroll", `${away} frames in 700ms with the hero out of view (allowed ${MAX_FRAMES_STOPPED}): the loop did not stop`);
  if (back < MIN_FRAMES_RUNNING) fail(locale, "scroll", `${back} frames in 700ms after scrolling back (needs ${MIN_FRAMES_RUNNING}+): the loop did not resume`);
  notes.push(`${locale.padEnd(11)} desktop: ${running} frames/700ms, ${(share * 100).toFixed(1)}% inked, ${sh.minSharks}-${sh.maxSharks} sharks, max alpha under ${under.lines} text lines ${under.alpha}/${TEXT_CAP}, scrolled away ${away}, back ${back}`);
  await context.close();
}

// `which` is the picture this condition must get: "portrait" or "landscape".
function stillIs(locale, cond, which, s, seen) {
  if (!new RegExp(`hero-sharks-${which}\\.webp\\?v=[0-9a-f]{10}`).test(s.image)) fail(locale, cond, `the still shows ${s.image}, not the ${which} picture with its ?v=`);
  const other = seen.stillUrls.filter((u) => !u.includes(`hero-sharks-${which}.webp`));
  if (other.length) fail(locale, cond, `the ${which} picture was expected but the page also downloaded ${other.join(", ")}`);
}

async function stillOnly(browser, locale, cond, which, contextOptions) {
  const { context, page, seen } = await open(browser, locale, cond, contextOptions);
  const asked = await page.evaluate(() => window.__sharks.asked);
  const ran = await framesOver(page, 700);
  const total = await frames(page);
  if (asked) fail(locale, cond, `${asked} 2D context request(s) on .home-sharks: the sharks started where they must not`);
  if (total || ran > MAX_FRAMES_STOPPED) fail(locale, cond, `the frame loop ran (${total} frames): the sharks started where they must not`);
  const s = await stillState(page);
  if (s.display === "none" || s.h <= 0) fail(locale, cond, `the still is not visible (display ${s.display}, height ${s.h})`);
  stillIs(locale, cond, which, s, seen);
  if (!seen.stills.length) fail(locale, cond, "the still image was never requested");
  else if (seen.stills.some((c) => c !== 200)) fail(locale, cond, `the still answered ${seen.stills.join(",")}, not 200`);
  if (seen.errors.length) fail(locale, cond, `page error: ${seen.errors.join(" | ")}`);
  notes.push(`${locale.padEnd(11)} ${cond}: asked 2D ${asked}x, ${total} frames, still ${s.display} ${seen.stills.join(",")}`);
  await context.close();
}

// A phone's still, read as the visitor sees it (ticket #403): under every line of
// the hero's text the picture may hold at most TEXT_CAP of ink, as the desktop
// canvas does. The page's text is hidden and the still's own box is
// screenshotted, so what is measured is the picture as the stylesheet places and
// scales it, not the file; the lines are the same boxes the sharks script fades
// (lineBoxes). Run at PHONE_WIDTHS in every locale, because the lines wrap
// differently in each. A picture that was faded by erasing the sharks would
// pass the cap trivially, so it must also show MIN_SHOWN of its pixels clearly
// inked somewhere (the unfaded parts).
async function phoneFade(browser, locale, width) {
  const cond = `phone-fade ${width}`;
  const { context, page, seen } = await open(browser, locale, cond, { viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const loaded = await page.evaluate(async () => {
    const still = document.querySelector("[data-home-sharks-still]");
    const m = /url\("?([^")]+)"?\)/.exec(getComputedStyle(still).backgroundImage);
    if (!m) return false;
    return new Promise((done) => { const i = new Image(); i.onload = () => done(true); i.onerror = () => done(false); i.src = m[1]; });
  });
  if (!loaded) fail(locale, cond, "the still's picture did not load");
  const { lines, hero } = await page.evaluate(sharksSource.lineBoxes);
  const tokens = await page.evaluate(() => {
    const t = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().split(/\s+/).map(Number);
    return { paper: t("--surface-rgb"), ink: t("--ink-rgb") };
  });
  if (lines.length < 5) fail(locale, cond, `only ${lines.length} text lines were measured; the hero's text boxes were not found`);
  // What the visitor sees behind the text: everything but the still hidden.
  await page.evaluate(() => document.querySelectorAll("#about-us > :not([data-home-sharks-still])").forEach((e) => e.style.setProperty("visibility", "hidden", "important")));
  const box = await page.locator("[data-home-sharks-still]").boundingBox();
  const { data, info } = await sharp(await page.screenshot({ fullPage: true, clip: box })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cover = (i) => {
    let c = 0;
    for (let k = 0; k < 3; k++) c = Math.max(c, ((tokens.paper[k] - data[i + k]) / (tokens.paper[k] - tokens.ink[k])) * 255);
    return c;
  };
  let worst = 0, at = "", inked = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (cover((y * info.width + x) * 3) > SHOWN_COVER) inked++;
  for (const l of lines) {
    const x0 = Math.max(0, Math.floor(l.x)), y0 = Math.max(0, Math.floor(l.y));
    const x1 = Math.min(info.width, Math.ceil(l.x + l.w)), y1 = Math.min(info.height, Math.ceil(l.y + l.h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const c = cover((y * info.width + x) * 3);
      if (c > worst) { worst = c; at = `line @${Math.round(l.x)},${Math.round(l.y)} ${Math.round(l.w)}x${Math.round(l.h)} px (${x},${y})`; }
    }
  }
  const share = inked / (info.width * info.height);
  if (info.width !== Math.round(hero.w)) fail(locale, cond, `the still's box is ${info.width}px wide, the hero ${hero.w}px`);
  if (worst > TEXT_CAP) fail(locale, cond, `the picture holds ${Math.round(worst)}/255 ink (limit ${TEXT_CAP}) under hero text, ${at}: a shark cell sits behind a line of text`);
  if (share < MIN_SHOWN) fail(locale, cond, `only ${(share * 100).toFixed(2)}% of the still is clearly inked (needs ${MIN_SHOWN * 100}%+): the fade passes by erasing the sharks`);
  if (seen.errors.length) fail(locale, cond, `page error: ${seen.errors.join(" | ")}`);
  notes.push(`${locale.padEnd(11)} ${cond}: max ink under ${lines.length} text lines ${Math.round(worst)}/${TEXT_CAP}, ${(share * 100).toFixed(2)}% of the picture clearly inked`);
  await context.close();
}

(async () => {
  const browser = await launch();
  for (const locale of LOCALES) {
    await desktopGroups(browser, locale);
    await stillOnly(browser, locale, "phone", "portrait", { viewport: PHONE, isMobile: true, hasTouch: true });
    for (const width of sharksSource.PHONE_WIDTHS) await phoneFade(browser, locale, width);
    await stillOnly(browser, locale, "tablet", "landscape", { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });
    await stillOnly(browser, locale, "reduced-motion", "landscape", { viewport: DESKTOP, reducedMotion: "reduce" });

    // The sharks' canvas gets no 2D context: the still must take over.
    const probe = await open(browser, locale, "no-2d", { viewport: DESKTOP, reducedMotion: "no-preference" }, true);
    const asked = await probe.page.evaluate(() => window.__sharks.asked);
    if (!asked) fail(locale, "no-2d", "the script never asked for a 2D context, so the fallback was not exercised");
    const s = await stillState(probe.page);
    if (!s.fallback) fail(locale, "no-2d", "the 2D context was refused but the still was not marked [data-fallback]");
    if (s.display === "none" || s.h <= 0) fail(locale, "no-2d", `the 2D context was refused and the still is not visible (display ${s.display}, height ${s.h})`);
    stillIs(locale, "no-2d", "landscape", s, probe.seen);
    if (probe.seen.stills.some((c) => c !== 200) || !probe.seen.stills.length) fail(locale, "no-2d", `the still answered ${probe.seen.stills.join(",") || "nothing"}, not 200`);
    notes.push(`${locale.padEnd(11)} no-2d: still ${s.display}, data-fallback ${s.fallback}, ${probe.seen.stills.join(",")}`);
    await probe.context.close();
  }
  await browser.close();

  console.log(notes.join("\n"));
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):\n` + failures.map((f) => "  " + f).join("\n"));
    process.exit(1);
  }
  console.log(`\nsharks: ${LOCALES.length} locales x 5 conditions, 0 failures`);
})().catch((e) => { console.error(e); process.exit(1); });
