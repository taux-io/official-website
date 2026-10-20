#!/usr/bin/env node
// check:hero-sharks — the home hero's sharks background may never make its text
// fail WCAG AA, and its palette may not grow. Needs no browser.
//
// WHY THIS EXISTS. The hero's background is a <canvas>, a SIBLING of the hero's
// content (src/input.css, ".HOME HERO BACKGROUND"). `npm run contrast` measures
// text against the background of its ancestors, and a sibling is not an
// ancestor: the audit would stay green with the sharks as dark as you like. So
// the worst case is computed here, from the numbers that make it.
//
// THE WORST BACKGROUND. Nothing darkens the canvas (the fade to paper at the
// bottom edge is not a veil). Behind any hero text the simulation (static/js/
// sharks-sim.js) caps every cell at TEXT_FADE_MAX of ink, tile and glyph
// together (home-sharks.js tops a glyph up only to that cap and never tints
// there), and the grid line (the ladder's first step) lies under it. So
//     coverage = 1 - (1 - TEXT_FADE_MAX) * (1 - GRID)
//     worst    = paper * (1 - coverage) + ink * coverage
// and every hero text colour is held against it. What this CANNOT see is a
// shark cell that leaks outside a text box; that is the simulation's own test
// (scripts/sharks-sim.test.mjs) and `npm run sharks`.
//
// THE RULES THIS GATE HOLDS:
//   (a) every hero text colour reaches AA on that worst background, with MARGIN
//       to spare (large text 3:1, the rest 4.5:1);
//   (b) the tints. The stylesheet declares exactly four --shark-N-rgb; a colour
//       literal in either script must be one of them; the simulation picks from
//       exactly four and the script reads exactly four;
//   (c) `text-ink-soft` anywhere in the hero fails whatever the numbers say;
//   (d) a hero text colour this file does not recognise ERRORS, it is never skipped;
//   (e) static/js/home-sharks.js + static/js/sharks-sim.js together are at most
//       14336 bytes. Raise nothing quietly: that number is the spec's.
//
// WHERE EVERY NUMBER COMES FROM, none of it written here: TEXT_FADE_MAX and the
// ladder from the simulation (required), the tokens from AUTHORED src/input.css
// through scripts/stylesheet (so this runs in `npm run check` before or without
// a Tailwind build), and the hero's text colours from the five locales' home
// templates (templates/index.html and templates/<locale>/index.html) including
// the partials they include. A text-* colour class the scan cannot map FAILS
// the check instead of being skipped.
//
// Contrast is scripts/design/lib.js `contrastRatio`, the WCAG formula the other
// gates use. Large text (>= 24px, or >= 18.66px and bold; scripts/visual/
// contrast.js) needs 3:1, everything else 4.5:1. MARGIN is the headroom the
// shipped values must keep so a rounding change in a token does not flip it.
// The still (static/brand/hero-sharks.webp) is the OLD water picture until
// ticket #401 and has no gate here: NOTES.md says so.

const fs = require("fs");
const path = require("path");
const { contrastRatio } = require("./design/lib");
const { read } = require("./stylesheet");
const sharksSource = require("./lib/sharks-source");

const ROOT = path.join(__dirname, "..");
const TEMPLATES = path.join(ROOT, "templates");
const HOME_TEMPLATES = ["index.html", "en-US/index.html", "ja-JP/index.html", "ko-KR/index.html", "zh-Hans-CN/index.html"];

const AA = 4.5;
const AA_LARGE = 3;
const MARGIN = 0.1;

// Hero classes whose type is large by the site's own grading (.display-lead is
// 40px+, .display-sub the same band; both are an <h1>). They are checked at 3:1.
const LARGE_CLASSES = new Set(["display-lead", "display-sub"]);
// Colours the hero may not use at all, whatever they measure.
const BANNED = new Set(["text-ink-soft"]);
// text-* utilities that are size / alignment / wrapping, not colour.
const TEXT_NON_COLOUR = /^text-(xs|sm|base|lg|xl|[2-9]xl|left|right|center|justify|start|end|balance|pretty|wrap|nowrap|ellipsis|clip|\[.*\])$/;
// Tailwind colour utilities as tailwind.config.js defines them -> token.
const TEXT_COLOUR = {
  "text-ink": "ink-rgb",
  "text-ink-muted": "ink-86-rgb",
  "text-ink-soft": "ink-72-rgb",
  "text-primary": "primary-rgb",
  "text-surface": "surface-rgb",
};

const fail = (msg) => {
  console.error(`check:hero-sharks FAIL: ${msg}`);
  process.exit(1);
};

// The shared readers (scripts/lib/sharks-source.js) throw; this gate reports a
// throw as its own failure.
const orFail = (fn) => (...args) => {
  try {
    return fn(...args);
  } catch (e) {
    return fail(e.message);
  }
};
const channels = orFail(sharksSource.channels);

const mix = (fg, bg, a) => fg.map((f, i) => f * a + bg[i] * (1 - a));

// Ink at TEXT_FADE_MAX with the grid line's ink under it, over paper.
const inkCoverage = (fade, grid) => 1 - (1 - fade) * (1 - grid);
function worstBackground({ paper, ink, fade, grid }) {
  return mix(ink, paper, inkCoverage(fade, grid));
}

function readSheet(sheet) {
  const token = (name) => {
    const v = sheet.token(name);
    if (v == null) fail(`src/input.css has no --${name}`);
    return v;
  };
  return {
    paper: channels(token("surface-rgb"), "--surface-rgb"),
    ink: channels(token("ink-rgb"), "--ink-rgb"),
    token: (n) => channels(token(n), `--${n}`),
  };
}

// The hero of one home template: from <section id="about-us" to its </section>,
// with {% include %} expanded (nested, bounded).
function heroSource(rel) {
  const expand = (src, depth) => {
    if (depth > 8) fail(`${rel}: include nesting is deeper than 8`);
    return src.replace(/\{%-?\s*include\s+"([^"]+)"\s*-?%\}/g, (_, name) => {
      const file = path.join(TEMPLATES, name);
      if (!fs.existsSync(file)) fail(`${rel}: includes "${name}", which does not exist`);
      return expand(fs.readFileSync(file, "utf8"), depth + 1);
    });
  };
  const full = expand(fs.readFileSync(path.join(TEMPLATES, rel), "utf8"), 0);
  const start = full.search(/<section\b[^>]*\bid="about-us"/);
  if (start < 0) fail(`${rel}: no <section id="about-us"> (the hero); update scripts/check-hero-sharks.js if it was renamed`);
  const end = full.indexOf("</section>", start);
  if (end < 0) fail(`${rel}: the hero section is never closed`);
  // SVG illustrations (_art.html) are shapes, not text: `contrast` does not
  // measure them and their text-spot / text-surface classes colour fills. An
  // SVG that carries a real <text> would be text, so that is refused here.
  return full.slice(start, end).replace(/<svg\b[\s\S]*?<\/svg>/g, (svg) => {
    if (/<text\b/.test(svg)) fail(`${rel}: an <svg> in the hero contains <text>; this check skips SVG shapes and cannot skip text`);
    return "";
  });
}

// Every distinct text colour in the hero: { label, token | rgb, large, where }.
function heroTextColours(sheet, rels) {
  const found = new Map(); // key -> { label, tokenName, large, where:Set }
  const add = (key, entry, rel) => {
    if (!found.has(key)) found.set(key, { ...entry, where: new Set() });
    found.get(key).where.add(rel);
  };
  // body text: <body> sets color: var(--ink); the hero's plain <p>, <a>, <strong> inherit it.
  for (const rel of rels) {
    const html = heroSource(rel);
    add("ink-rgb|body", { label: "body / inherited (ink)", tokenName: "ink-rgb", large: false }, rel);
    for (const m of html.matchAll(/\bclass="([^"]*)"/g)) {
      for (const cls of m[1].split(/\s+/).filter(Boolean)) {
        // `{{ }}` / `{% %}` inside a class is parameterised markup (rule 37) and cannot be read.
        if (/[{}%]/.test(cls)) fail(`${rel}: hero class "${cls}" is computed; this check cannot read it`);
        const bare = cls.replace(/^(?:[a-z-]+:)+/, ""); // laptop:, hover:, ...
        if (/^text-/.test(bare) && !TEXT_NON_COLOUR.test(bare)) {
          const base = bare.replace(/\/\d+$/, "");
          if (bare !== base) fail(`${rel}: hero uses ${cls}, an opacity-modified text colour; mix it in this check or use a token`);
          if (!TEXT_COLOUR[base]) fail(`${rel}: hero uses ${cls}, a text colour check:hero-sharks does not know; add it to TEXT_COLOUR in scripts/check-hero-sharks.js so its contrast is measured`);
          if (BANNED.has(base)) {
            const at = html.slice(0, m.index).split("\n").length;
            const tag = html.slice(html.lastIndexOf("<", m.index), m.index + m[0].length).slice(0, 80);
            fail(`${rel}: the hero uses ${cls} (expanded line ${at}: ${tag}...); hero small print is ink, not grey, because the sharks can sit behind it`);
          }
          add(`${TEXT_COLOUR[base]}|${bare}`, { label: bare, tokenName: TEXT_COLOUR[base], large: false }, rel);
          continue;
        }
        // an authored class that sets `color` (.display-lead, .copy-email, ...)
        const decls = sheet.declarations.filter((d) => d.selector === `.${cls}`);
        const own = decls.find((d) => d.prop === "color");
        const backed = decls.some((d) => /^background(-color)?$/.test(d.prop) && d.value.trim() !== "transparent");
        if (backed) continue; // paints its own opaque ground (.btn); the sharks are not behind its text
        if (own) {
          const vm = /^(?:var\(--([a-z0-9-]+)\)|rgb\(\s*var\(--([a-z0-9-]+-rgb)\)\s*\))$/.exec(own.raw || own.value);
          const alias = vm && (vm[2] || (vm[1] && `${vm[1]}-rgb`));
          if (!alias) fail(`${rel}: .${cls} sets color: ${own.raw || own.value}, which this check cannot map to a token`);
          add(`${alias}|.${cls}`, { label: `.${cls}`, tokenName: alias, large: LARGE_CLASSES.has(cls) }, rel);
        }
      }
    }
  }
  return [...found.values()];
}

function evaluate() {
  const sheet = read();
  const s = readSheet(sheet);
  const { fade, grid } = orFail(sharksSource.simConstants)();
  const bg = worstBackground({ paper: s.paper, ink: s.ink, fade, grid });
  const colours = heroTextColours(sheet, HOME_TEMPLATES);
  const rows = colours.map((c) => {
    const rgb = s.token(c.tokenName);
    const ratio = contrastRatio(rgb, bg);
    const need = c.large ? AA_LARGE : AA;
    return { ...c, ratio, need, ok: ratio >= need, roomy: ratio >= need + MARGIN };
  });
  return { rows, bg, fade, grid, paper: s.paper };
}

// (b) the tints: stylesheet, scripts and simulation agree, and there are four.
function checkTints() {
  const css = orFail(sharksSource.readTints)(read());
  const known = Object.values(css);
  const { literals, simPicks, scriptReads } = orFail(sharksSource.scriptTints)();
  for (const l of literals) {
    if (!known.some((k) => k.join() === l.rgb.join())) {
      fail(`${l.where} writes the colour ${l.text}, which is none of the four --shark-N-rgb in src/input.css; the scripts read their colours from the stylesheet (getComputedStyle) and hold none of their own`);
    }
  }
  if (simPicks !== 4) fail(`static/js/sharks-sim.js picks among ${simPicks} tints; the sharks have exactly four (--shark-1-rgb .. --shark-4-rgb)`);
  if (scriptReads.join() !== "1,2,3,4") fail(`static/js/home-sharks.js reads tints [${scriptReads}]; it must read exactly --shark-1-rgb .. --shark-4-rgb`);
  return css;
}

// (e) the two scripts together.
function checkSize() {
  const z = sharksSource.sizes();
  const total = z.script + z.sim;
  if (total > z.limit) fail(`home-sharks.js (${z.script}) + sharks-sim.js (${z.sim}) = ${total} bytes, over the ${z.limit} limit (spec #396); shrink the script, do not raise the limit`);
  return { ...z, total };
}

function main() {
  const r = evaluate();
  const rgb = (c) => c.map((n) => Math.round(n)).join(" ");
  const tints = checkTints();
  const z = checkSize();
  console.log(`hero sharks: TEXT_FADE_MAX ${r.fade}, grid line ${r.grid}, ${Object.keys(tints).length} tints (${Object.values(tints).map(rgb).join(" | ")}), paper ${rgb(r.paper)}`);
  console.log(`worst background ${rgb(r.bg)} (ink ${(100 * inkCoverage(r.fade, r.grid)).toFixed(1)}% over paper); ${HOME_TEMPLATES.length} home templates read`);
  console.log(`scripts ${z.script} + ${z.sim} = ${z.total} of ${z.limit} bytes`);
  let bad = 0;
  let thin = 0;
  for (const row of r.rows.sort((a, b) => a.ratio - b.ratio)) {
    const flag = !row.ok ? "FAIL" : row.roomy ? "ok  " : "THIN";
    console.log(`  ${flag} ${row.ratio.toFixed(2)}:1 (needs ${row.need}) ${row.label}  [${[...row.where].length === HOME_TEMPLATES.length ? `all ${HOME_TEMPLATES.length} locales` : [...row.where].join(", ")}]`);
    if (!row.ok) bad++;
    else if (!row.roomy) thin++;
  }
  if (bad) fail(`${bad} hero text colour(s) fall below AA on the worst background; lower TEXT_FADE_MAX or change the text colour`);
  if (thin) fail(`${thin} hero text colour(s) pass with less than ${MARGIN} to spare; keep the headroom so a token nudge does not turn the hero red`);
  console.log("check:hero-sharks ok");
}

module.exports = { evaluate, worstBackground };
if (require.main === module) main();
