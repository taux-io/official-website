#!/usr/bin/env node
// check:hero-water — the home hero's water background may never make its text
// fail WCAG AA. Needs no browser.
//
// WHY THIS EXISTS. The hero's background is a WebGL <canvas>, a SIBLING of the
// hero's content (src/input.css, ".HOME HERO BACKGROUND"). `npm run contrast`
// measures text against the background of its ancestors, and a sibling is not
// an ancestor: the audit would stay green with the water as dark as you like.
// So the worst case is computed here, from the numbers that make it.
//
// THE WORST BACKGROUND. There is no darkening veil (the fade to
// paper at the bottom edge is not one): the water is drawn straight over the
// paper. The shader mixes three tones from --water-rgb and the paper (--surface-rgb)
// and its deepest facet is WATER_MAX_DEPTH of the way from paper to water, so
//     worst = paper * (1 - D) + water * D
// Every other facet, the glints and the light band are between that and white,
// and the canvas mask only fades the bottom toward paper, so none is darker.
// The check is that deepest facet, which the shader reaches somewhere on screen.
//
// WHERE EVERY NUMBER COMES FROM, none of it written here:
//   · WATER_MAX_DEPTH  parsed from static/js/home-water.js
//   · --water-rgb, --surface-rgb, the ink tokens, the hero's class colours
//     read from AUTHORED src/input.css through scripts/stylesheet
//     rather than the built static/css/styles.min.css: this gate then runs in
//     `npm run check` before or without a Tailwind build, and the authored file
//     is what a designer edits. (The built file would also carry every utility
//     whether or not the hero uses it.)
//   · the hero's text colours   scanned from the five locales' home templates
//     (templates/index.html and templates/<locale>/index.html), including the
//     partials they include. A text-* colour class the scan cannot map FAILS the
//     check instead of being skipped, so a hero that gains a new colour cannot
//     slip past: someone has to teach this file about it.
//   · `text-ink-soft` is refused outright in the hero, wherever it appears, even
//     if the numbers would let it through: the hero's small print is ink.
//
// Contrast is scripts/design/lib.js `contrastRatio`, the WCAG formula the other
// gates use. Large text (>= 24px, or >= 18.66px and bold; scripts/visual/
// contrast.js) needs 3:1, everything else 4.5:1. MARGIN is the headroom the
// shipped values must keep so a rounding change in a token does not flip it.

const fs = require("fs");
const path = require("path");
const { contrastRatio } = require("./design/lib");
const { read } = require("./stylesheet");
const waterSource = require("./lib/water-source");

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
  console.error(`check:hero-water FAIL: ${msg}`);
  process.exit(1);
};

// The shared readers (scripts/lib/water-source.js) throw; this gate reports a
// throw as its own failure.
const orFail = (fn) => (...args) => {
  try {
    return fn(...args);
  } catch (e) {
    return fail(e.message);
  }
};
const channels = orFail(waterSource.channels);

const mix = (fg, bg, a) => fg.map((f, i) => f * a + bg[i] * (1 - a));

// The deepest facet: WATER_MAX_DEPTH of the way from paper to the water colour.
function worstBackground({ paper, water, depth }) {
  return mix(water, paper, depth);
}

const readDepth = orFail(waterSource.readMaxDepth);

function readSheet(sheet) {
  const token = (name) => {
    const v = sheet.token(name);
    if (v == null) fail(`src/input.css has no --${name}`);
    return v;
  };
  return {
    paper: channels(token("surface-rgb"), "--surface-rgb"),
    water: channels(token("water-rgb"), "--water-rgb"),
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
  if (start < 0) fail(`${rel}: no <section id="about-us"> (the hero); update scripts/check-hero-water.js if it was renamed`);
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
          if (!TEXT_COLOUR[base]) fail(`${rel}: hero uses ${cls}, a text colour check:hero-water does not know; add it to TEXT_COLOUR in scripts/check-hero-water.js so its contrast is measured`);
          if (BANNED.has(base)) {
            const at = html.slice(0, m.index).split("\n").length;
            const tag = html.slice(html.lastIndexOf("<", m.index), m.index + m[0].length).slice(0, 80);
            fail(`${rel}: the hero uses ${cls} (expanded line ${at}: ${tag}...); hero small print is ink, not grey, because the water can sit behind it`);
          }
          add(`${TEXT_COLOUR[base]}|${bare}`, { label: bare, tokenName: TEXT_COLOUR[base], large: false }, rel);
          continue;
        }
        // an authored class that sets `color` (.display-lead, .copy-email, ...)
        const decls = sheet.declarations.filter((d) => d.selector === `.${cls}`);
        const own = decls.find((d) => d.prop === "color");
        const backed = decls.some((d) => /^background(-color)?$/.test(d.prop) && d.value.trim() !== "transparent");
        if (backed) continue; // paints its own opaque ground (.btn); the water is not behind its text
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

function evaluate(water = {}) {
  const sheet = read();
  const s = readSheet(sheet);
  const depth = water.depth ?? readDepth();
  const waterRgb = water.water ?? s.water;
  const bg = worstBackground({ paper: s.paper, water: waterRgb, depth });
  const colours = heroTextColours(sheet, HOME_TEMPLATES);
  const rows = colours.map((c) => {
    const rgb = s.token(c.tokenName);
    const ratio = contrastRatio(rgb, bg);
    const need = c.large ? AA_LARGE : AA;
    return { ...c, ratio, need, ok: ratio >= need, roomy: ratio >= need + MARGIN };
  });
  return { rows, bg, depth, water: waterRgb, paper: s.paper };
}

// THE STILL MUST BE DRAWN FROM THE SHADER THAT SHIPS. Phones, reduced-motion and
// no-WebGL visitors see static/brand/hero-water.webp, a frame of the same
// shader. Nobody notices the picture going stale: it still loads, it is merely
// last season's water. The ledger holds a hash of what the picture was drawn
// from (scripts/lib/water-source.js stillInputs); this recomputes it. No browser:
// only the build-water script draws.
const REBUILD = "run `PLAYWRIGHT_CHANNEL=chrome npm run build:water`, then commit static/brand/hero-water.webp, ledgers/hero-water-still.txt, src/input.css and static/css/styles.min.css";

function checkStill() {
  const inputs = orFail(waterSource.stillInputs)(read());
  const ledger = waterSource.readLedger();
  if (!ledger || !ledger.inputs || !ledger.image) fail(`ledgers/hero-water-still.txt is missing or unreadable; ${REBUILD}`);
  if (waterSource.stillDigest(inputs) !== ledger.inputs) {
    fail(`the hero's still is out of date: the shader, --water-rgb, --surface-rgb, WATER_MAX_DEPTH or the builder's constants changed since it was drawn; ${REBUILD}`);
  }
  if (!fs.existsSync(waterSource.STILL_IMAGE)) fail(`static/brand/hero-water.webp is missing; ${REBUILD}`);
  const bytes = fs.readFileSync(waterSource.STILL_IMAGE);
  if (waterSource.sha(bytes) !== ledger.image) {
    fail(`static/brand/hero-water.webp is not the picture the ledger recorded (it was replaced or edited by hand); ${REBUILD}`);
  }
  const v = waterSource.imageVersion(bytes);
  const css = fs.readFileSync(waterSource.INPUT_CSS, "utf8");
  if (!css.includes(`url("/static/brand/hero-water.webp?v=${v}")`)) {
    fail(`src/input.css does not ask for hero-water.webp?v=${v}; /static/brand is cached for a week, so a returning visitor keeps the old picture. ${REBUILD}`);
  }
  console.log(`still: drawn from the shipped shader (inputs ${ledger.inputs.slice(0, 10)}), ${(bytes.length / 1024).toFixed(1)} KB, ?v=${v}`);
}

function main() {
  const r = evaluate();
  const rgb = (c) => c.map((n) => Math.round(n)).join(" ");
  console.log(`hero water: WATER_MAX_DEPTH ${r.depth}, --water-rgb ${rgb(r.water)}, paper ${rgb(r.paper)}`);
  console.log(`worst background ${rgb(r.bg)} (the deepest facet: paper ${((1 - r.depth) * 100).toFixed(0)}% + water ${(r.depth * 100).toFixed(0)}%); ${HOME_TEMPLATES.length} home templates read`);
  let bad = 0;
  let thin = 0;
  for (const row of r.rows.sort((a, b) => a.ratio - b.ratio)) {
    const flag = !row.ok ? "FAIL" : row.roomy ? "ok  " : "THIN";
    console.log(`  ${flag} ${row.ratio.toFixed(2)}:1 (needs ${row.need}) ${row.label}  [${[...row.where].length === HOME_TEMPLATES.length ? `all ${HOME_TEMPLATES.length} locales` : [...row.where].join(", ")}]`);
    if (!row.ok) bad++;
    else if (!row.roomy) thin++;
  }
  if (bad) fail(`${bad} hero text colour(s) fall below AA on the deepest water; lower WATER_MAX_DEPTH or the --water-rgb saturation`);
  if (thin) fail(`${thin} hero text colour(s) pass with less than ${MARGIN} to spare; keep the headroom so a token nudge does not turn the hero red`);
  checkStill();
  console.log("check:hero-water ok");
}

module.exports = { evaluate, worstBackground };
if (require.main === module) main();
