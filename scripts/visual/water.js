// Does the home hero's water background actually run, and only where it should?
//
//   npm run serve        (another terminal)
//   npm run water
//
// WHY THIS EXISTS. `check:hero-water` computes the worst contrast the water can
// make from the numbers in the source; it never opens a page. `contrast` cannot
// see a <canvas> at all. So a shader that compiles to nothing, a media query
// that starts the shader on a phone, or a loop that never stops when the hero
// scrolls away would each leave every other gate green. This drives a browser
// and asks the page, for each of the five home pages:
//
//   desktop       1440x900, hover, no reduced-motion. WebGL must exist in the
//                 browser (if it does not, this fails and says so; it never
//                 skips). The canvas has to have drawn something that is not
//                 paper, no CSP violation may have fired, and the still must be
//                 hidden and not downloaded.
//   scroll        the shader's frame loop stops when the hero is out of view and
//                 resumes when it is back.
//   phone         390x844: no one asked for a WebGL context on .home-water, the
//                 loop never ran, the still is visible and answered 200.
//   reduced       desktop + prefers-reduced-motion: the same as the phone.
//   no-webgl      desktop in a browser with WebGL switched off: the still takes
//                 over (the script marks it [data-fallback]).
//
// A CI RUNNER HAS NO GPU. The first three groups use one browser started with
// SwiftShader (a software WebGL), so a context exists on a bare Linux box. The
// no-webgl group uses another, started with every GL path disabled. If the
// desktop group goes red on CI with "WebGL is not available", the runner's
// Chromium could not make a software context: that is the environment, not the
// water. Anything else red names the locale and the condition.
//
// The canvas is read by screenshot, with the veil hidden, against a screenshot
// of the same box with the canvas hidden: gl.readPixels outside the frame that
// drew returns zeros (the buffer is not preserved), and the veil is meant to
// hide the canvas from a viewer, so neither reading it as a person sees it nor
// reading the buffer later would measure the shader.

const sharp = require("sharp");
const { launch } = require("../browser");
const { BASE_URL } = require("../routes");

const LOCALES = ["zh-Hant-TW", "en-US", "zh-Hans-CN", "ja-JP", "ko-KR"];
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// SwiftShader: software GL for a browser with no GPU (CI). The second flag is
// required by recent Chromium, which gates SwiftShader fallback behind it.
const GPU_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const NO_GL_ARGS = ["--disable-gpu", "--disable-webgl", "--disable-3d-apis", "--disable-software-rasterizer"];

// Share of pixels in the canvas box that must differ from paper. The shader
// colours a wide share of the box at full strength; a blank or a stray pixel
// is far below this.
const MIN_INKED_SHARE = 0.02;
const PIXEL_DELTA = 6;

// Frames the loop must make in the 700ms it is watched while it should run
// (30 fps would be ~20; software GL is slower), and may make while it should
// not (the one callback already queued when it stopped).
const MIN_FRAMES_RUNNING = 3;
const MAX_FRAMES_STOPPED = 1;

const failures = [];
const notes = [];
const fail = (locale, cond, msg) => failures.push(`[${locale}] [${cond}] ${msg}`);

// Before any page script: count frames requested FROM home-water.js (the page has
// other animation of its own), note every WebGL context asked of the water's
// canvas, and keep CSP violations the page itself reports.
function instrument() {
  window.__water = { frames: 0, glOnWater: 0, csp: [] };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => {
    if (new Error().stack.includes("home-water")) window.__water.frames++;
    return raf(f);
  };
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (/webgl/.test(String(type)) && this.classList.contains("home-water")) window.__water.glOnWater++;
    return get.call(this, type, ...rest);
  };
  document.addEventListener("securitypolicyviolation", (e) => window.__water.csp.push(`${e.violatedDirective} ${e.blockedURI}`));
}

async function open(browser, locale, cond, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.addInitScript(instrument);
  const seen = { stills: [], console: [], errors: [] };
  page.on("response", (r) => { if (/hero-water/.test(r.url())) seen.stills.push(r.status()); });
  page.on("console", (m) => { if (/Content Security Policy|violates the following/i.test(m.text())) seen.console.push(m.text()); });
  page.on("pageerror", (e) => seen.errors.push(e.message));
  const res = await page.goto(`${BASE_URL}/${locale}`, { waitUntil: "load" });
  if (!res || res.status() !== 200) fail(locale, cond, `GET /${locale} answered ${res && res.status()}`);
  await page.waitForTimeout(700);
  return { context, page, seen };
}

const frames = (page) => page.evaluate(() => window.__water.frames);
async function framesOver(page, ms) {
  const a = await frames(page);
  await page.waitForTimeout(ms);
  return (await frames(page)) - a;
}

const stillState = (page) =>
  page.evaluate(() => {
    const s = document.querySelector("[data-home-water-still]");
    const cs = getComputedStyle(s);
    return { display: cs.display, h: s.getBoundingClientRect().height, image: cs.backgroundImage, fallback: s.hasAttribute("data-fallback") };
  });

async function inkedShare(page) {
  const box = page.locator("[data-home-water]");
  // Through the CSSOM: the page's CSP (style-src 'self') refuses an injected <style>.
  await page.evaluate(() => document.querySelectorAll(".home-water-veil,.home-water-still").forEach((e) => e.style.setProperty("display", "none", "important")));
  const clip = await box.boundingBox();
  const region = { x: clip.x, y: clip.y, width: clip.width, height: Math.min(clip.height * 0.5, DESKTOP.height - clip.y) };
  const read = async () => {
    const { data, info } = await sharp(await page.screenshot({ clip: region })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, info };
  };
  const withWater = await read();
  await box.evaluate((el) => { el.style.visibility = "hidden"; });
  const paper = await read();
  const { data, info } = withWater;
  let inked = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (Math.abs(data[i] - paper.data[i]) > PIXEL_DELTA || Math.abs(data[i + 1] - paper.data[i + 1]) > PIXEL_DELTA || Math.abs(data[i + 2] - paper.data[i + 2]) > PIXEL_DELTA) inked++;
  }
  return inked / (info.width * info.height);
}

async function desktopGroups(browser, locale) {
  const cond = "desktop";
  const { context, page, seen } = await open(browser, locale, cond, { viewport: DESKTOP, reducedMotion: "no-preference" });
  const webgl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl"));
  if (!webgl) {
    fail(locale, cond, `WebGL is not available in this browser (launched with ${GPU_ARGS.join(" ")}); the desktop check cannot run. On CI this means the runner's Chromium could not make a software context, which is the environment and not the water.`);
    await context.close();
    return;
  }
  const fell = await stillState(page);
  if (fell.fallback) fail(locale, cond, "WebGL exists but the script put the still up ([data-fallback]): the shader failed to compile or link");
  if (fell.display !== "none" && !fell.fallback) fail(locale, cond, `the still is visible (display ${fell.display}) while the shader should be drawing`);
  if (seen.stills.length && !fell.fallback) fail(locale, cond, `the still was downloaded (${seen.stills.join(",")}) although hidden`);
  const running = await framesOver(page, 700);
  if (running < MIN_FRAMES_RUNNING) fail(locale, cond, `the frame loop made ${running} frames in 700ms (needs ${MIN_FRAMES_RUNNING}+): the shader is not running`);
  const share = await inkedShare(page);
  if (!(share >= MIN_INKED_SHARE)) fail(locale, cond, `the canvas is blank: ${(share * 100).toFixed(2)}% of its top half differs from paper (needs ${MIN_INKED_SHARE * 100}%+)`);
  const csp = [...seen.console, ...(await page.evaluate(() => window.__water.csp))];
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
  notes.push(`${locale.padEnd(11)} desktop: ${running} frames/700ms, ${(share * 100).toFixed(1)}% inked, scrolled away ${away}, back ${back}`);
  await context.close();
}

async function stillOnly(browser, locale, cond, contextOptions, expectGlAsked) {
  const { context, page, seen } = await open(browser, locale, cond, contextOptions);
  const asked = await page.evaluate(() => window.__water.glOnWater);
  const ran = await framesOver(page, 700);
  const total = await frames(page);
  if (!expectGlAsked && asked) fail(locale, cond, `${asked} WebGL context request(s) on .home-water: the shader started where it must not`);
  if (!expectGlAsked && (total || ran > MAX_FRAMES_STOPPED)) fail(locale, cond, `the frame loop ran (${total} frames): the shader started where it must not`);
  const s = await stillState(page);
  if (s.display === "none" || s.h <= 0) fail(locale, cond, `the still is not visible (display ${s.display}, height ${s.h})`);
  if (!/hero-water/.test(s.image)) fail(locale, cond, `the still has no image (${s.image})`);
  if (!seen.stills.length) fail(locale, cond, "the still image was never requested");
  else if (seen.stills.some((c) => c !== 200)) fail(locale, cond, `the still answered ${seen.stills.join(",")}, not 200`);
  if (seen.errors.length) fail(locale, cond, `page error: ${seen.errors.join(" | ")}`);
  notes.push(`${locale.padEnd(11)} ${cond}: asked WebGL ${asked}x, ${total} frames, still ${s.display} ${seen.stills.join(",")}`);
  await context.close();
}

(async () => {
  const gpu = await launch({ args: GPU_ARGS });
  const nogl = await launch({ args: NO_GL_ARGS });
  for (const locale of LOCALES) {
    await desktopGroups(gpu, locale);
    await stillOnly(gpu, locale, "phone", { viewport: PHONE, isMobile: true, hasTouch: true }, false);
    await stillOnly(gpu, locale, "reduced-motion", { viewport: DESKTOP, reducedMotion: "reduce" }, false);

    // The browser must truly have no WebGL, or the condition below tests nothing.
    const probe = await open(nogl, locale, "no-webgl", { viewport: DESKTOP, reducedMotion: "no-preference" });
    const has = await probe.page.evaluate(() => !!document.createElement("canvas").getContext("webgl"));
    if (has) fail(locale, "no-webgl", `this browser still has WebGL despite ${NO_GL_ARGS.join(" ")}; the fallback cannot be tested here`);
    else {
      const s = await stillState(probe.page);
      if (!s.fallback) fail(locale, "no-webgl", "WebGL is unavailable but the still was not marked [data-fallback]");
      if (s.display === "none" || s.h <= 0) fail(locale, "no-webgl", `WebGL is unavailable and the still is not visible (display ${s.display}, height ${s.h})`);
      if (probe.seen.stills.some((c) => c !== 200) || !probe.seen.stills.length) fail(locale, "no-webgl", `the still answered ${probe.seen.stills.join(",") || "nothing"}, not 200`);
      notes.push(`${locale.padEnd(11)} no-webgl: still ${s.display}, data-fallback ${s.fallback}, ${probe.seen.stills.join(",")}`);
    }
    await probe.context.close();
  }
  await gpu.close();
  await nogl.close();

  console.log(notes.join("\n"));
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):\n` + failures.map((f) => "  " + f).join("\n"));
    process.exit(1);
  }
  console.log(`\nwater: ${LOCALES.length} locales x 5 conditions, 0 failures`);
})().catch((e) => { console.error(e); process.exit(1); });
