// One browser session over every route × every viewport, with the probes
// hanging off it.
//
//   const { walk } = require("./walk");
//   const { findings } = await walk({
//     viewports: [{ name: "desktop", width: 1440, height: 900 }],
//     probes: [{ name: "overflow", inPage: measureOverflowInPage }],
//   });
//
// THREE MODULES WERE EACH DOING THIS, AND THE COST WAS NOT THE DUPLICATION.
// geometry, contrast and screenshot each launched a browser, each walked the
// route table, and each re-derived what "the page has settled" means. The
// discipline that keeps the overflow gate from going red at random — measure,
// and if something was found, wait and measure again, because Chart.js sizes
// its canvas after load — lived in exactly one of the three. The next person to
// write a probe would have had to rediscover it, and issue 151 records what
// happens to a gate that goes red at random: everyone re-runs until it is
// green, which is worse than having no gate.
//
// A probe is DATA, not a program: a name, a function to run, and which
// viewports it wants. Writing a new one costs a function rather than a file.
//
// WHAT THIS DOES NOT COVER, and why:
//
//   · contract.js walks the same routes but its assertions are about HTTP —
//     seven request.get/fetch calls for headers, redirects, HEAD and og:image
//     status. It never sets a viewport. Absorbing it would make this module
//     answer "what did the server say" as well as "what did the browser draw".
//
//   · diff.js does not walk anything. It uses Chromium as a PNG decoder to
//     compare two screenshot sets, which is a browser doing an unrelated job.
//
// Both are named in check-design.js's `single walker` rule, so a fourth script
// launching its own browser goes red rather than appearing quietly.

const { launch } = require("../browser");
const { ROUTES, BASE_URL } = require("../routes");

// /404 is a [[document]] rather than a [[page]], so it is not in ROUTES.
const DEFAULT_PATHS = [...ROUTES.map((r) => r.path), "/404"];

// Chart.js sizes its canvas from the container after load, and networkidle can
// fire mid-resize: the chart on /what-is-prompt-injection has been caught at
// 376px wide in a 320px viewport and settles at 176px. Only paid when the first
// look found something, so a clean run costs nothing.
const TRANSIENT_SETTLE_MS = 400;

// Scrolling the whole page before measuring, then waiting.
//
// THE ORIGINAL REASON IS GONE AND THE RITUAL IS NOT. Both contrast and
// screenshot carried this with a comment about content revealed on scroll
// starting at opacity 0 — scroll reveal was removed with the brand reset
// (DESIGN.md decision #53), so that justification no longer holds. What still
// holds is narrower: a full-page screenshot of a tall document, and any probe
// that measures below the fold, wants every deferred paint to have happened.
// Opt in rather than default, because it costs 600ms a route.
const SCROLL_STEP_PX = 400;
const SCROLL_SETTLE_MS = 600;

async function scrollThrough(page) {
  await page.evaluate(async (step) => {
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  }, SCROLL_STEP_PX);
  await page.waitForTimeout(SCROLL_SETTLE_MS);
}

// ---------------------------------------------------------------------------

// A probe is one of two named kinds, and the distinction is deliberate.
//
//   inPage — evaluated inside the page, returns findings. The common case, and
//            the one that can be reasoned about without a browser in hand.
//   onPage — receives the page handle. Screenshots need it; nothing else here
//            does.
//
// The escape hatch is named rather than universal. Handing every probe the page
// would collapse this back into "yield a page handle and let each caller
// re-derive the walk", which is the shape this module exists to replace.
function probeViewports(probe, viewports) {
  if (probe.viewports === "widest") {
    return [viewports.reduce((a, b) => (b.width > a.width ? b : a))];
  }
  if (Array.isArray(probe.viewports)) return probe.viewports;
  return viewports;
}

async function walk({
  paths = DEFAULT_PATHS,
  viewports,
  probes,
  scroll = false,
  reducedMotion = "reduce",
} = {}) {
  if (!viewports?.length) throw new Error("walk: viewports is required");
  if (!probes?.length) throw new Error("walk: probes is required");

  const widest = viewports.reduce((a, b) => (b.width > a.width ? b : a));
  const findings = [];
  const stats = { loads: 0, measurements: 0, paths: paths.length, viewports: viewports.length };

  const browser = await launch();
  // One context at the widest viewport; each route is loaded once and the
  // viewport resized around it. Everything measured here is layout, so a resize
  // costs a reflow rather than a navigation — the difference between 20 loads
  // and 160. A probe that needs a clean initial state asks for `reload: true`.
  const context = await browser.newContext({
    viewport: { width: widest.width, height: widest.height },
    deviceScaleFactor: 1,
    reducedMotion,
  });
  const page = await context.newPage();

  try {
    for (const path of paths) {
      await page.setViewportSize({ width: widest.width, height: widest.height });
      await page.goto(BASE_URL + path, { waitUntil: "networkidle" });
      stats.loads++;
      if (scroll) await scrollThrough(page);

      for (const probe of probes) {
        for (const viewport of probeViewports(probe, viewports)) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          if (probe.reload) {
            await page.goto(BASE_URL + path, { waitUntil: "networkidle" });
            stats.loads++;
            if (scroll) await scrollThrough(page);
          }
          const where = { path, viewport, page };

          if (probe.onPage) {
            const produced = await probe.onPage(page, where);
            stats.measurements++;
            for (const f of produced ?? []) {
              findings.push({ probe: probe.name, path, viewport: viewport.name, ...f });
            }
            continue;
          }

          let produced = await page.evaluate(probe.inPage, probe.args);
          stats.measurements++;
          // The re-measure, applied by default rather than remembered. A probe
          // whose findings cannot be transient opts out with settle: false.
          if (produced?.length && probe.settle !== false) {
            await page.waitForTimeout(TRANSIENT_SETTLE_MS);
            produced = await page.evaluate(probe.inPage, probe.args);
          }
          for (const f of produced ?? []) {
            findings.push({ probe: probe.name, path, viewport: viewport.name, ...f });
          }
        }
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return { findings, stats };
}

module.exports = { walk, DEFAULT_PATHS, TRANSIENT_SETTLE_MS };
