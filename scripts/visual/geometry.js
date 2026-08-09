// Geometry the other audits cannot see.
//
//   node scripts/visual/geometry.js
//   GEOMETRY_WIDTHS=320,1440 node scripts/visual/geometry.js
//
// contrast reads colour, contract reads what a route declares. Neither looks at
// where anything actually lands, and three failures live exactly there. All
// three were measured by hand during issue 132 and passed; none of them would
// have been measured again, because remembering is not a mechanism.
//
//   1. Symbol advance inside monospace blocks. DESIGN.md decision #40: Roboto
//      Mono's subset carries no arrows, maths or box drawing, so those glyphs
//      fall through the stack. The CJK faces sit AFTER the Latin monospace
//      fallbacks precisely so SF Mono answers first and the cell width holds;
//      put PingFang ahead of them and it answers with a FULL-WIDTH advance —
//      12.04px becomes 20.0px at 20px type — and the hand-aligned flow diagram
//      on /adk-skill-patterns shears by 5.6px a line. Invisible from a Mac,
//      where those glyphs already come from the same face either way.
//
//   2. Box-drawing blocks whose lines disagree in width. Decision #41: the 404
//      frame shipped with a border 26 characters wide and content lines of 28,
//      and you cannot see whether that is two extra characters or a font
//      answering with the wrong advance — the two look identical. It is
//      verified by measuring the rendered width of every line, which is what
//      this does.
//
//   3. Horizontal overflow. A type scale that grew by a step is exactly the
//      change that pushes a fixed-width child past its container, and the
//      symptom — the page scrolling sideways — is one a desktop author never
//      meets. 720px is not a device: it is a 1440px window at 200% zoom.
//
//   4. Parallax canvases exposing an edge. The templates claim the 40%
//      overscale bounds the travel, and they are right: parallax.js anchors on
//      `el.parentElement` — the section, not the canvas, and it says so in a
//      comment — so travel is 0.5 * H * 0.35 = 0.175H of section height against
//      0.2H of margin either side. It holds with room to spare.
//
//      ISSUE 132 CLAIMED OTHERWISE AND WAS WRONG. Its commit and PR both said
//      the bound was 0.245H against 0.2H, "arithmetically short by 0.045H",
//      from reading rect.height as the canvas. The margin is real; there is no
//      shortfall. What the check guards is a future change to the factor or the
//      overscale, and raising the factor to 3.0 does make it fire.
//
// WHAT THIS DELIBERATELY DOES NOT ASSERT: that every character in a monospace
// block sits on the Latin cell grid. Chinese in these blocks takes PingFang's
// full-width advance — 14px against Roboto Mono's 8.4px cell, a ratio of 1.667
// — so CJK prose inside a <pre> has never been on that grid and cannot be. An
// earlier draft of this file asserted it and reported 72 of 160 characters
// "off grid" on its first run against a page that is completely correct. A
// checker whose first run is a pile of false positives teaches everyone to skip
// it, which is the argument DESIGN.md opens with.
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
const DEFAULT_WIDTHS = [320, 375, 720, 768, 1440];
const WIDTHS = process.env.GEOMETRY_WIDTHS
  ? process.env.GEOMETRY_WIDTHS.split(",").map((w) => Number(w.trim()))
  : DEFAULT_WIDTHS;

// The canvases travel with scroll, so they need a walk down the page. Two
// viewports rather than five: the invariant is a ratio of the block's own
// height, so unlike overflow it does not vary with width.
const CURVE_VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
];
const CURVE_STEP_PX = 400;

// A glyph may differ from the block's cell width by this fraction before it
// counts as coming from the wrong face. Generous against hinting and sub-pixel
// rounding; the failure it exists to catch is a full-width advance, which is a
// 67% error.
const ADVANCE_TOLERANCE = 0.2;

// Rendered line widths inside one box-drawing block may differ by this many
// pixels. Not zero: a trailing space is not painted, and rounding differs by
// line. Two extra characters — the defect decision #41 records — is 12px at
// 11px Departure Mono and 17px at Roboto Mono.
const LINE_WIDTH_TOLERANCE_PX = 3;

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
  advance: { enabled: true, turnedOnBy: "issue 148" },
  box: { enabled: true, turnedOnBy: "issue 148" },
  curve: { enabled: true, turnedOnBy: "issue 148" },
  overflow: { enabled: true, turnedOnBy: "issue 151" },
};

// ---------------------------------------------------------------------------
// Runs inside the page.

function measureMonoInPage({ advanceTolerance, lineTolerance }) {
  // Glyphs Roboto Mono's subset omits, which is what makes them the ones that
  // fall through the stack and the ones a reordered stack breaks first.
  const FALLTHROUGH = /[→←↑↓≥≤≈∞●★✕✓─│┌┐└┘├┤┬┴┼━┃]/;
  const BOX = /[─│┌┐└┘├┤┬┴┼━┃]/;
  const findings = [];

  for (const [i, pre] of [...document.querySelectorAll("pre")].entries()) {
    const cs = getComputedStyle(pre);
    // Only blocks actually set in a monospace face make this claim. A <pre>
    // restyled to the body font is prose that happens to keep its whitespace.
    if (!/mono|Menlo|Consolas|Courier|Departure/i.test(cs.fontFamily)) continue;

    // The cell width, measured in the block's own resolved font rather than
    // assumed from the family name.
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`;
    probe.textContent = "0".repeat(50);
    document.body.appendChild(probe);
    const cell = probe.getBoundingClientRect().width / 50;
    probe.remove();
    if (!(cell > 0)) continue;

    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    const lines = new Map(); // rounded top -> {left, right}
    let node;
    let hasBox = false;
    let widest = null;

    while ((node = walker.nextNode())) {
      const text = node.textContent;
      for (let k = 0; k < text.length; k++) {
        const ch = text[k];
        if (ch === "\n") continue;
        const range = document.createRange();
        range.setStart(node, k);
        range.setEnd(node, k + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.width && !/\s/.test(ch)) continue;

        if (BOX.test(ch)) hasBox = true;

        // Check 1 — a fall-through glyph must still be one cell wide.
        if (FALLTHROUGH.test(ch)) {
          const ratio = rect.width / cell;
          if (Math.abs(ratio - 1) > advanceTolerance) {
            if (!widest || ratio > widest.ratio) {
              widest = { ch, ratio: +ratio.toFixed(2), width: +rect.width.toFixed(2) };
            }
          }
        }

        // Line extents, grouped by rounded top so inline spans do not split a
        // line into several boxes.
        if (!/\s/.test(ch)) {
          const key = Math.round(rect.top);
          const cur = lines.get(key);
          if (!cur) lines.set(key, { left: rect.left, right: rect.right });
          else {
            cur.left = Math.min(cur.left, rect.left);
            cur.right = Math.max(cur.right, rect.right);
          }
        }
      }
    }

    if (widest) {
      findings.push({
        kind: "advance",
        detail:
          `pre[${i}] (${cs.fontFamily.split(",")[0]}, cell ${cell.toFixed(2)}px): ` +
          `"${widest.ch}" renders ${widest.width}px — ${widest.ratio}x the cell. ` +
          `A ratio near 1.67 means a CJK face answered; see DESIGN.md decision #40`,
      });
    }

    // Check 2 — inside a box drawing, every line is the same width.
    if (hasBox && lines.size > 1) {
      const widths = [...lines.values()].map((l) => +(l.right - l.left).toFixed(2));
      const min = Math.min(...widths);
      const max = Math.max(...widths);
      if (max - min > lineTolerance) {
        findings.push({
          kind: "box",
          detail:
            `pre[${i}] (${cs.fontFamily.split(",")[0]}): box-drawing lines disagree by ${(max - min).toFixed(1)}px ` +
            `(${lines.size} lines, ${min}px to ${max}px). Decision #41: measure these, do not look at them`,
        });
      }
    }
  }

  return findings;
}

// Two different failures, because this site can only ever show one of them.
//
// <main> carries overflow-x-clip (decision #22 chose it over overflow-hidden so
// position:sticky survives). Clip still clips: content that runs past the
// viewport is CUT OFF rather than reachable by scrolling, and
// documentElement.scrollWidth never grows. An earlier draft of this file
// asserted only the scroll and was proved inert — a deliberately planted
// 1800px-wide element inside <main> produced no finding at all.
//
// So the primary assertion is about element extents: nothing may render past
// the right edge of the viewport, whether or not that makes the page scroll.
// The scroll check stays as well, because anything escaping <main> — a fixed
// header, an overlay — would scroll rather than clip.
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

// ONE POSITION PER ROUND TRIP, DELIBERATELY.
//
// The obvious optimisation is to run the whole scroll walk inside a single
// evaluate — it cut this pass from minutes to seconds. It also made the check
// incapable of failing. parallax.js updates from a scroll listener that
// schedules a requestAnimationFrame, and a tight in-page loop outruns the event
// dispatch, so every measurement reads the previous position's transform.
// Raising the factor to 3.0 — which displaces the canvas by one and a half
// section heights — produced no finding at all from the batched walk, while the
// same page driven one position per round trip reported gaps of 128.7px and
// 260.7px. Awaiting the scroll event inside the loop did not fix it either.
//
// So the cost stays, and the step is coarse instead: the gap grows continuously
// with scroll position, so sampling every 400px finds an exposure long before
// it is large. Fast and unable to fail is worse than slow and honest.
function measureCurvesInPage() {
  const out = [];
  for (const c of document.querySelectorAll("canvas[data-parallax]")) {
    const host = c.parentElement;
    const cr = c.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    // Only meaningful while some part of the host is on screen; an edge nobody
    // can see is not an exposed edge.
    if (hr.bottom <= 0 || hr.top >= window.innerHeight) continue;
    const topGap = Math.max(0, Math.min(cr.top, window.innerHeight) - Math.max(hr.top, 0));
    const botGap = Math.max(0, Math.min(hr.bottom, window.innerHeight) - Math.max(cr.bottom, 0));
    if (topGap > 0.5 || botGap > 0.5) {
      out.push({
        figure: c.dataset.figure || (c.hasAttribute("data-tau-curve") ? "tau-curve" : "canvas"),
        topGap: +topGap.toFixed(1),
        botGap: +botGap.toFixed(1),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

async function main() {
  const browser = await launch();
  const failures = [];
  const curveRoutes = [];
  let monoBlocks = 0;
  let overflowChecks = 0;
  let curveChecks = 0;

  // One load per route. Overflow is pure layout, so resizing the viewport
  // re-measures it without paying for a navigation each time — the difference
  // between 19 loads and 95.
  {
    const widest = Math.max(...WIDTHS);
    const context = await browser.newContext({ viewport: { width: widest, height: 900 } });
    const page = await context.newPage();

    for (const path of PATHS) {
      await page.goto(BASE_URL + path, { waitUntil: "networkidle" });

      const mono = await page.evaluate(measureMonoInPage, {
        advanceTolerance: ADVANCE_TOLERANCE,
        lineTolerance: LINE_WIDTH_TOLERANCE_PX,
      });
      monoBlocks += await page.evaluate(() => document.querySelectorAll("pre").length);
      for (const f of mono) failures.push({ where: path, ...f });

      if (await page.evaluate(() => !!document.querySelector("canvas[data-parallax]"))) {
        curveRoutes.push(path);
      }

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        let detail = await page.evaluate(measureOverflowInPage);
        overflowChecks++;
        // Measured again before it counts. Chart.js sizes its canvas from the
        // container after load, and networkidle can fire mid-resize: the chart
        // on /what-is-prompt-injection was caught at 376px wide in a 320px
        // viewport and settles at 176px, so the finding appeared on some runs
        // and not others. A gate that goes red at random teaches people to
        // re-run until it is green, which is worse than not having it.
        //
        // Only when the first look found something, so a clean run pays
        // nothing.
        if (detail) {
          await page.waitForTimeout(TRANSIENT_SETTLE_MS);
          const again = await page.evaluate(measureOverflowInPage);
          if (!again) detail = null;
        }
        if (detail) failures.push({ where: `${path} @ ${width}px`, kind: "overflow", detail });
      }
      await page.setViewportSize({ width: widest, height: 900 });
    }
    await context.close();
  }

  // The canvases, walked down the page. Only the routes that carry one.
  for (const vp of CURVE_VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    for (const path of curveRoutes) {
      await page.goto(BASE_URL + path, { waitUntil: "networkidle" });
      const height = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y <= height; y += CURVE_STEP_PX) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        // Two frames: one for the scroll handler, one for the transform to
        // land. Separate calls rather than one — see measureCurvesInPage.
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        );
        const exposed = await page.evaluate(measureCurvesInPage);
        curveChecks++;
        for (const e of exposed) {
          failures.push({
            where: `${path} @ ${vp.name}, scrollY ${y}`,
            kind: "curve",
            detail: `${e.figure} exposes an edge inside the viewport (top ${e.topGap}px, bottom ${e.botGap}px)`,
          });
        }
      }
    }
    await context.close();
  }

  await browser.close();

  console.log(`\n${monoBlocks} monospace blocks checked for symbol advance and box-line agreement`);
  console.log(
    `${overflowChecks} route/width combinations checked for horizontal overflow ` +
      `(${PATHS.length} paths x ${WIDTHS.length} widths: ${WIDTHS.join(", ")})`
  );
  // Sampling is stated rather than implied. A run that quietly narrowed its own
  // scope would report green on ground it never covered.
  const narrowed =
    WIDTHS.length !== DEFAULT_WIDTHS.length || WIDTHS.some((w, i) => w !== DEFAULT_WIDTHS[i]);
  if (narrowed) {
    console.log(`  NARROWED by GEOMETRY_WIDTHS — the default set is ${DEFAULT_WIDTHS.join(", ")}`);
  }
  console.log(
    `${curveChecks} scroll positions checked for canvas edges ` +
      `(${curveRoutes.length} of ${PATHS.length} paths carry a parallax canvas, ` +
      `x ${CURVE_VIEWPORTS.length} viewports, every ${CURVE_STEP_PX}px)`
  );

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
