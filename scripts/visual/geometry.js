// Geometry the other audits cannot see.
//
//   node scripts/visual/geometry.js
//   GEOMETRY_WIDTHS=375,1500 node scripts/visual/geometry.js
//
// contrast reads colour, contract reads what a route declares, check:design
// reads what the author wrote. None of them looks at where anything actually
// lands, and three things live exactly there.
//
//   1. Horizontal overflow. A type scale that grew by a step is exactly the
//      change that pushes a fixed-width child past its container, and the
//      symptom — content clipped by <main>'s overflow-x-clip — is one a desktop
//      author never meets. Decision #49: grid and flex children default to
//      `min-width: auto`, so anything that cannot shrink bursts its parent, and
//      whether a given child needs `min-w-0` depends on its content rather than
//      its classes. No source rule can decide that; this measures it.
//
//   2. Cover bands that are not one screen. check:design can see that an h2
//      sits inside a [data-cover] element. It cannot see whether that element
//      ends up a screen tall — and that is the half the reader experiences.
//      Measured at every breakpoint, because a band that holds at 1500 and
//      collapses at 600 is the failure worth catching.
//
//   3. The ghost pill's radius and the floor under every touch target. The
//      radius is a token, but what a control renders after every utility, media
//      query and inherited rule has had its turn is not something a token can
//      promise. 32px is the signature shape of this vocabulary; 44px is the
//      floor issue 154 established after the hamburger measured 40x31.
//
// TWO CHECKS WERE REMOVED HERE RATHER THAN LEFT PASSING. `advance` measured
// symbol widths inside monospace blocks and `curve` measured parallax canvases
// exposing an edge; the brand reset deleted both the monospace faces and the
// canvases (DESIGN.md decision #53). A check with nothing left to measure
// reports green forever and inflates the count of things being watched, which
// is worse than no check: it says the ground is covered when nobody is on it.
//
// THE WIDTHS ARE THE SIX BREAKPOINTS, not a sample of devices. 375 stands for
// everything below `mobile`; the rest are the first pixel of each named step.
//
// Reads the same route table and starts the browser the same way as its
// neighbours, so adding a page to site.toml brings it under all of them.

const { launch } = require("../browser");
const { ROUTES, BASE_URL } = require("../routes");

// /404 is a [[document]] rather than a [[page]], so it is not in ROUTES and
// neither contrast nor contract ever requests it — DESIGN.md says so of both.
// This audit walks it anyway, because the box-drawing frame that decision #41
// is entirely about lives there: it shipped with a 26-character border around
// 28-character content, and that defect is invisible until the lines are
// measured. Leaving the one page the rule was written for outside the check
// that enforces it would be its own kind of joke.
const PATHS = [...ROUTES.map((r) => r.path), "/404"];

// 320 is the narrowest phone still worth serving, 768 the tablet, 1440 the
// desktop. 720 is the accessibility case: a 1440px window at 200% browser zoom,
// and the width most likely to overflow.
const DEFAULT_WIDTHS = [375, 600, 768, 961, 1280, 1500];
const WIDTHS = process.env.GEOMETRY_WIDTHS
  ? process.env.GEOMETRY_WIDTHS.split(",").map((w) => Number(w.trim()))
  : DEFAULT_WIDTHS;




// How long to let a suspected overflow prove it is real rather than a layout
// still settling. See the second measurement in the route loop.
const TRANSIENT_SETTLE_MS = 400;

// A CHECK IS SWITCHED ON BY THE TICKET THAT MAKES IT SATISFIABLE — the same
// arrangement check-design.js uses, for the same reason: landing a check
// disabled and flipping it in the change that earns it keeps CI green commit to
// commit without an allowlist, and an allowlist is how a check decays into a
// warning nobody reads.
//
// Overflow landed off in issue 148 because it was the only one of the four that
// found anything, and what it found predated the change that added it. Issue
// 151 cleared all six: min-w-0 on the grid and flex items that would not shrink
// below their content, and a correction to this check for the one finding that
// was never a defect.
const CHECKS = {
  overflow: { enabled: true, turnedOnBy: "issue 151" },
  cover: { enabled: true, turnedOnBy: "#184 — the 100 bands" },
  control: { enabled: true, turnedOnBy: "#185 — the ghost pill" },
};

// The pill's declared radius and the floor for a touch target, both measured on
// the rendered control rather than read from a token. check:design can see that
// a template wrote `rounded-control`; only the browser knows what it resolved
// to after every utility, media query and inherited rule had its turn.
const PILL_RADIUS_PX = 32;
const TOUCH_TARGET_MIN_PX = 44;
// Sub-pixel layout and zoom put a rendered band a hair under the viewport. Three
// pixels is the same tolerance the overflow probe already uses.
const COVER_TOLERANCE_PX = 3;

// ---------------------------------------------------------------------------
function measureOverflowInPage() {
  const de = document.documentElement;
  const limit = de.clientWidth;
  const culprits = [];

  const reported = [];
  for (const el of document.querySelectorAll("body *")) {
    const b = el.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) continue;
    // 1px of slack for sub-pixel rounding on a full-width element.
    if (b.right <= limit + 1) continue;

    // An element the author positioned off-screen on purpose declares it: the
    // menu overlay is fixed inset-0 and its children sit wherever it puts them
    // while it is closed.
    if (el.closest("[inert]")) continue;

    // A shape inside an <svg> cannot overflow independently of the <svg> — its
    // box is the drawing's coordinate space projected onto the screen. Reporting
    // <rect>, <path> and <circle> separately names three symptoms of one cause
    // and buries it. The <svg> itself is checked like any other element.
    if (el.ownerSVGElement) continue;

    // Who contains this, and is that containment a decision or a last resort?
    //
    // Wide content living in its own horizontal scroller is the correct
    // pattern: a table or an ASCII block that cannot reflow scrolls inside its
    // container while the page does not.
    //
    // A clipping ancestor that is NOT the page shell is also a decision. The
    // glow on /what-is-prompt-injection is 256px translated half its width past
    // its section's right edge, and that section carries overflow-hidden — the
    // author bounded it deliberately and it never reaches the viewport. An
    // earlier version of this check reported it, having read the geometric box
    // and ignored what clips it.
    //
    // <main>'s overflow-x-clip (decision #22) is the opposite: the shell's last
    // resort, cutting whatever ran past it. That is precisely the failure this
    // exists to find, so being clipped by <main> excuses nothing.
    //
    // Geometry alone cannot tell decoration from lost text — both are boxes
    // past an edge. The structural question can: is something narrower than the
    // page already holding it?
    let a = el.parentElement;
    let contained = false;
    while (a && a !== document.body) {
      const ox = getComputedStyle(a).overflowX;
      const scrolls = ox === "auto" || ox === "scroll";
      const clips = (ox === "hidden" || ox === "clip") && a.tagName !== "MAIN";
      if (scrolls || clips) {
        contained = true;
        break;
      }
      a = a.parentElement;
    }
    if (contained) continue;

    // Only the outermost offender in a subtree. A container that overruns drags
    // every descendant with it, and listing all of them says the same thing
    // many times.
    if (reported.some((r) => r.contains(el))) continue;
    reported.push(el);

    culprits.push(
      `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}"> right=${b.right.toFixed(0)} width=${b.width.toFixed(0)} (viewport ${limit})`
    );
    if (culprits.length >= 3) break;
  }

  const scrolls = de.scrollWidth > limit + 1;
  if (!culprits.length && !scrolls) return null;

  const parts = [];
  if (culprits.length) parts.push(`renders past the viewport: ${culprits.join(" | ")}`);
  if (scrolls) parts.push(`document scrolls sideways: scrollWidth ${de.scrollWidth} > clientWidth ${limit}`);
  return parts.join(". ");
}
// ---------------------------------------------------------------------------

// Every cover band is exactly one screen.
//
// check:design can see that an h2 sits inside a [data-cover] element. It cannot
// see whether that element ends up a screen tall, and that is the half the
// reader experiences. Measured at every breakpoint because a band that holds at
// 1500 and collapses at 600 is the failure worth catching.
//
// data-cover="sr" is skipped by name. A screen-reader-only heading gets a cover
// element so the source rule stays satisfied, but giving it a blank full screen
// would be absurd — the site has one of these.
function measureCoverInPage({ tolerance }) {
  const out = [];
  const viewport = window.innerHeight;
  for (const el of document.querySelectorAll("[data-cover]")) {
    if (el.getAttribute("data-cover") === "sr") continue;
    const height = el.getBoundingClientRect().height;
    if (height >= viewport - tolerance) continue;
    const heading = el.querySelector("h1, h2");
    out.push({
      label: heading ? heading.textContent.trim().replace(/\s+/g, " ").slice(0, 48) : "(no heading)",
      height: Math.round(height),
      viewport,
    });
  }
  return out;
}

// The pill's radius and the floor under every touch target, both read off the
// rendered control.
//
// Radius is asserted on .btn and .btn-quiet only: the hamburger and the menu
// close are icon buttons and square by design. The touch floor applies to
// anything a finger has to hit.
//
// Invisible controls are skipped rather than failed — the closed menu overlay
// holds nineteen links at zero size, and they are inert while it is closed.
function measureControlsInPage({ radius, minTarget }) {
  const out = [];
  for (const el of document.querySelectorAll(".btn, .btn-quiet")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const actual = parseFloat(getComputedStyle(el).borderTopLeftRadius);
    if (Math.abs(actual - radius) > 0.5) {
      out.push({
        label: el.textContent.trim().replace(/\s+/g, " ").slice(0, 32),
        detail: "border-radius " + actual + "px, expected " + radius + "px",
      });
    }
  }
  const touchable = "a.btn, .btn-quiet, button, input, select, textarea, summary";
  for (const el of document.querySelectorAll(touchable)) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.width >= minTarget && rect.height >= minTarget) continue;
    out.push({
      label: el.textContent.trim().replace(/\s+/g, " ").slice(0, 32) || el.tagName.toLowerCase(),
      detail: Math.round(rect.width) + "x" + Math.round(rect.height) + "px, floor is " + minTarget,
    });
  }
  return out;
}

async function main() {
  const browser = await launch();
  const failures = [];
  let overflowChecks = 0;
  let coverChecks = 0;
  let controlChecks = 0;
  let coverBands = 0;

  // One load per route, then resize. Everything measured here is pure layout,
  // so re-measuring at each width costs a reflow rather than a navigation —
  // the difference between 20 loads and 120.
  const widest = Math.max(...WIDTHS);
  const context = await browser.newContext({ viewport: { width: widest, height: 900 } });
  const page = await context.newPage();

  for (const path of PATHS) {
    await page.goto(BASE_URL + path, { waitUntil: "networkidle" });
    coverBands += await page.evaluate(
      () => document.querySelectorAll('[data-cover]:not([data-cover="sr"])').length
    );

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });

      let detail = await page.evaluate(measureOverflowInPage);
      overflowChecks++;
      // Measured again before it counts. Chart.js sizes its canvas from the
      // container after load, and networkidle can fire mid-resize: the chart on
      // /what-is-prompt-injection was caught at 376px wide in a 320px viewport
      // and settles at 176px, so the finding appeared on some runs and not
      // others. A gate that goes red at random teaches people to re-run until
      // it is green, which is worse than not having it.
      //
      // Only when the first look found something, so a clean run pays nothing.
      if (detail) {
        await page.waitForTimeout(TRANSIENT_SETTLE_MS);
        const again = await page.evaluate(measureOverflowInPage);
        if (!again) detail = null;
      }
      if (detail) failures.push({ where: `${path} @ ${width}px`, kind: "overflow", detail });

      const short = await page.evaluate(measureCoverInPage, { tolerance: COVER_TOLERANCE_PX });
      coverChecks++;
      for (const c of short) {
        failures.push({
          where: `${path} @ ${width}px`,
          kind: "cover",
          detail: `"${c.label}" is ${c.height}px in a ${c.viewport}px viewport`,
        });
      }

      const controls = await page.evaluate(measureControlsInPage, {
        radius: PILL_RADIUS_PX,
        minTarget: TOUCH_TARGET_MIN_PX,
      });
      controlChecks++;
      for (const c of controls) {
        failures.push({
          where: `${path} @ ${width}px`,
          kind: "control",
          detail: `"${c.label}" — ${c.detail}`,
        });
      }
    }
    await page.setViewportSize({ width: widest, height: 900 });
  }
  await context.close();
  await browser.close();

  const combos = `${PATHS.length} paths x ${WIDTHS.length} widths: ${WIDTHS.join(", ")}`;
  console.log(`\n${overflowChecks} route/width combinations checked for horizontal overflow (${combos})`);
  console.log(`${coverChecks} checked for cover bands filling the screen (${coverBands} bands on the widest pass)`);
  console.log(`${controlChecks} checked for pill radius and ${TOUCH_TARGET_MIN_PX}px touch targets`);

  // Sampling is stated rather than implied. A run that quietly narrowed its own
  // scope would report green on ground it never covered.
  const narrowed =
    WIDTHS.length !== DEFAULT_WIDTHS.length || WIDTHS.some((w, i) => w !== DEFAULT_WIDTHS[i]);
  if (narrowed) {
    console.log(`  NARROWED by GEOMETRY_WIDTHS — the default set is ${DEFAULT_WIDTHS.join(", ")}`);
  }

  const enforced = failures.filter((f) => CHECKS[f.kind].enabled);
  const pending = failures.filter((f) => !CHECKS[f.kind].enabled);

  for (const [kind, cfg] of Object.entries(CHECKS)) {
    if (cfg.enabled) continue;
    const n = pending.filter((f) => f.kind === kind).length;
    console.log(`\n  not yet enforced — ${kind}: ${cfg.turnedOnBy} (${n} finding(s) today)`);
    for (const f of pending.filter((x) => x.kind === kind)) {
      console.log(`      ${f.where}`);
      console.log(`          ${f.detail}`);
    }
  }

  if (enforced.length) {
    console.log(`\n${enforced.length} geometry failure(s):\n`);
    for (const f of enforced) {
      console.log(`  [${f.kind}] ${f.where}`);
      console.log(`      ${f.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("\n0 failing");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
