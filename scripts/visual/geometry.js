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
//   2. Each button grammar's radius and the floor under every touch target. The
//      radius is a token, but what a control renders after every utility, media
//      query and inherited rule has had its turn is not something a token can
//      promise. 32px is the signature shape of this vocabulary; 44px is the
//      floor issue 154 established after the hamburger measured 40x31.
//
// THREE CHECKS HAVE BEEN REMOVED HERE RATHER THAN LEFT PASSING. `advance`
// measured symbol widths inside monospace blocks, `curve` measured parallax
// canvases exposing an edge, and `cover` asserted that a section band filled the
// screen. The first two went with the faces and canvases the brand reset deleted
// (decision #53); `cover` went three hours after it was written, when decision
// #54 made cover blocks content-height. A check with nothing left to measure
// reports green forever and inflates the count of things being watched, which is
// worse than no check: it says the ground is covered when nobody is on it.
//
// THE WIDTHS ARE THE SIX BREAKPOINTS PLUS 320 AND 720 — see the constant for
// why those two are not breakpoints and still have to be measured.
//
// Reads the same route table and starts the browser the same way as its
// neighbours, so adding a page to site.toml brings it under all of them.

const { walk } = require("./walk");

// /404 is a [[document]] rather than a [[page]], so it is not in ROUTES and
// neither contrast nor contract ever requests it — DESIGN.md says so of both.
// This audit walks it anyway. It used to be here for the box-drawing frame
// decision #41 was written about; that frame went with the monospace faces, and
// what is left is a route with a hero band, a pill and no gate but this one.

// THE FIVE NAMED STEPS PLUS THREE WIDTHS THAT ARE NOT STEPS.
//
// 600 / 768 / 961 / 1280 / 1500 are the first pixel of each named step in
// tailwind.config.js — where a responsive rule changes hands, and therefore
// where layout breaks. There are five of them; the design vocabulary calls
// itself six-tier because the sub-600 default counts as a tier, and it has no
// first pixel to sample. 375 stands in for it.
//
// 320, 375 and 720 are not steps and each is here for its own reason. 320 is
// the narrowest phone still worth serving. 375 is the common phone and the
// sub-600 tier's representative. 720 is the accessibility case: a 1440px window
// at 200% browser zoom, which lands between `tablet` and `laptop`.
//
// TWO OF THESE HAVE ALREADY BEEN LOST ONCE. Rewriting this list around the new
// steps silently dropped 320 and 720 while the comment above it still explained
// why they were measured; restoring them dropped 375 the same way. A list whose
// own documentation disagrees with it is the drift DESIGN.md opens against, and
// it has now happened twice in one branch.
const DEFAULT_WIDTHS = [320, 375, 600, 720, 768, 961, 1280, 1500];
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
  measure: { enabled: true, turnedOnBy: "#188 — the reading measure" },
  control: { enabled: true, turnedOnBy: "#185 — the ghost pill" },
};

// The pill's declared radius and the floor for a touch target, both measured on
// the rendered control rather than read from a token.
//
// 9999px, not the 32px it was: decision #54 moved --radius-control to the pill
// step. A browser clamps the painted corner to half the box, but the computed
// value is the declared one, which is what this compares. check:design can see that
// a template wrote `rounded-control`; only the browser knows what it resolved
// to after every utility, media query and inherited rule had its turn.
// Two button grammars, two radii. The primary CTA is the pill; the secondary
// utility rect takes the 8px step. One expectation for both was right only
// while there was one grammar.
const BUTTON_RADIUS_PX = { btn: 9999, "btn-quiet": 8 };
const TOUCH_TARGET_MIN_PX = 44;
// The reading measure, in characters. DESIGN.md sets 68 rather than the 75
// usually quoted for Latin because Chinese sets denser.
//
// THE UNIT IS THE WHOLE POINT. Every container on this site is sized in pixels,
// and issue #147 is what happens when the two are confused: collapsing body from
// 17px to 16px left every container exactly as wide and put more characters on
// each line, so /pqc-migration drifted from 70.8ch to 85.2ch without one
// template changing. Nothing caught it, because no source rule can — how wide a
// paragraph ends up depends on its ancestors, its type size and its face.
//
// Half a character of slack for sub-pixel rounding.
const MEASURE_MAX_CH = 68;
const MEASURE_TOLERANCE_CH = 0.5;
// Short runs are labels, captions and table cells that happen to be in a <p>.
// A measure is about sustained reading; forty characters is where that starts.
const MEASURE_MIN_CHARS = 40;

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
  for (const [cls, expected] of Object.entries(radius)) {
    for (const el of document.querySelectorAll("." + cls)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const actual = parseFloat(getComputedStyle(el).borderTopLeftRadius);
      if (Math.abs(actual - expected) <= 0.5) continue;
      const label = el.textContent.trim().replace(/\s+/g, " ").slice(0, 32);
      out.push({ detail: `"${label}" (.${cls}) — border-radius ${actual}px, expected ${expected}px` });
    }
  }
  const touchable = "a.btn, .btn-quiet, button, input, select, textarea, summary";
  for (const el of document.querySelectorAll(touchable)) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.width >= minTarget && rect.height >= minTarget) continue;
    const label = el.textContent.trim().replace(/\s+/g, " ").slice(0, 32) || el.tagName.toLowerCase();
    out.push({
      detail: `"${label}" — ${Math.round(rect.width)}x${Math.round(rect.height)}px, floor is ${minTarget}`,
    });
  }
  return out;
}

// The reading measure, taken at the widest viewport only.
//
// Container widths grow monotonically with the viewport, so the widest pass is
// the worst case — measuring at all eight would report the same paragraph eight
// times and hide how many distinct ones are actually over.
//
// `ch` is the advance of "0" in the element's OWN computed font, which is what
// makes this a character count at every type size rather than a pixel width
// wearing one. That distinction is the whole reason this check exists: issue
// #147 happened because collapsing body from 17px to 16px left every container
// exactly as wide and put more characters on each line, and /pqc-migration
// drifted from 70.8ch to 85.2ch without a single template changing.
//
// TABLE CELLS ARE EXCLUDED BY SELECTOR, deliberately. A cell's width is a column
// decision taken across every row, and capping one cell would break the column
// rather than help anyone. Measured before excluding them — the widest cell on
// the site is 46.8ch, inside the limit anyway.
function measureReadingInPage({ maxCh, minChars }) {
  const out = [];
  for (const el of document.querySelectorAll("main p, main li")) {
    const text = el.textContent.trim();
    if (text.length < minChars) continue;
    // THE BROWSER IS ASKED FOR ch DIRECTLY rather than measured with a glyph.
    //
    // Two earlier versions got this wrong in two different ways. The first
    // copied `getComputedStyle(el).font` onto a span parked on <body>; the
    // shorthand drops the family list, so the span fell back to another face.
    // The second appended the span inside the element to inherit the font
    // correctly — and then measured a single "0" that carried the element's
    // `letter-spacing: -0.022em`, which the ch unit does not include. It
    // reported 70.4ch for a paragraph CSS had capped at exactly 68ch.
    //
    // `width: 1ch` has no such gap: it is the unit itself, resolved by the same
    // engine that resolves the max-width being checked.
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;display:block;width:1ch;height:0";
    el.appendChild(probe);
    const zero = probe.getBoundingClientRect().width;
    probe.remove();
    if (!zero) continue;
    const ch = el.getBoundingClientRect().width / zero;
    if (ch <= maxCh) continue;
    out.push({
      detail: `"${text.replace(/\s+/g, " ").slice(0, 40)}" runs ${Math.round(ch * 10) / 10}ch, limit is ${maxCh - 0.5} (${el.className.slice(0, 48)})`,
    });
  }
  return out;
}

async function main() {
  const viewports = WIDTHS.map((width) => ({ name: `${width}px`, width, height: 900 }));

  const { findings, stats } = await walk({
    viewports,
    probes: [
      { name: "overflow", inPage: measureOverflowInPage },
      {
        name: "control",
        inPage: measureControlsInPage,
        args: { radius: BUTTON_RADIUS_PX, minTarget: TOUCH_TARGET_MIN_PX },
        settle: false,
      },
      {
        name: "measure",
        inPage: measureReadingInPage,
        args: { maxCh: MEASURE_MAX_CH + MEASURE_TOLERANCE_CH, minChars: MEASURE_MIN_CHARS },
        // Container widths grow monotonically with the viewport, so the widest
        // pass is the worst case; measuring at all eight would report the same
        // paragraph eight times.
        viewports: "widest",
        settle: false,
      },
    ],
  });

  const failures = findings.map((f) => ({
    kind: f.probe,
    where: `${f.path} @ ${f.viewport}`,
    detail: f.detail,
  }));

  const combos = `${stats.paths} paths x ${stats.viewports} widths: ${WIDTHS.join(", ")}`;
  console.log(`\n${stats.paths * stats.viewports} route/width combinations checked for horizontal overflow (${combos})`);
  console.log(`${stats.paths * stats.viewports} checked for pill radius and ${TOUCH_TARGET_MIN_PX}px touch targets`);
  console.log(`${stats.paths} routes checked for a ${MEASURE_MAX_CH}ch reading measure (widest viewport only)`);

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
