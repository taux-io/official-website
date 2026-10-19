#!/usr/bin/env node
// check:hero-rock — the home hero's rock background may never make its text
// fail WCAG AA. Needs no browser.
//
// WHY THIS EXISTS. The hero's background is a WebGL <canvas> plus a paper veil,
// both SIBLINGS of the hero's content (src/input.css, ".HOME HERO BACKGROUND").
// `npm run contrast` measures text against the background of its ancestors, and
// a sibling is not an ancestor: the audit would stay green with the veil at 0%.
// So the worst case is computed here, from the numbers that make it.
//
// THE WORST BACKGROUND. The shader writes premultiplied colour = rock * a with
// alpha a <= ROCK_MAX_INTENSITY, over paper; the veil is paper at alpha V over
// that. A pixel at full intensity is therefore
//     paper * (1 - I*(1-V)) + rock * I*(1-V)
// and every other pixel is between that and plain paper. The canvas mask only
// fades the bottom out, so it can only make things lighter. The check is the
// brightest pixel, which is also the one the shader reaches somewhere on screen.
//
// WHERE EVERY NUMBER COMES FROM, none of it written here:
//   · ROCK_MAX_INTENSITY  parsed from static/js/home-rock.js
//   · --rock-rgb, --surface-rgb, the ink tokens, the veil alpha, the hero's
//     class colours   read from AUTHORED src/input.css through scripts/stylesheet
//     rather than the built static/css/styles.min.css: this gate then runs in
//     `npm run check` before or without a Tailwind build, and the authored file
//     is what a designer edits. (The built file would also carry every utility
//     whether or not the hero uses it.)
//   · the hero's text colours   scanned from the five locales' home templates
//     (templates/index.html and templates/<locale>/index.html), including the
//     partials they include. A text-* colour class the scan cannot map FAILS the
//     check instead of being skipped, so a hero that gains a new colour cannot
//     slip past: someone has to teach this file about it.
//
// Contrast is scripts/design/lib.js `contrastRatio`, the WCAG formula the other
// gates use. Large text (>= 24px, or >= 18.66px and bold; scripts/visual/
// contrast.js) needs 3:1, everything else 4.5:1. MARGIN is the headroom the
// shipped values must keep so a rounding change in a token does not flip it.

const fs = require("fs");
const path = require("path");
const { contrastRatio } = require("./design/lib");
const { read } = require("./stylesheet");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "static", "js", "home-rock.js");
const TEMPLATES = path.join(ROOT, "templates");
const HOME_TEMPLATES = ["index.html", "en-US/index.html", "ja-JP/index.html", "ko-KR/index.html", "zh-Hans-CN/index.html"];

const AA = 4.5;
const AA_LARGE = 3;
const MARGIN = 0.1;

// Hero classes whose type is large by the site's own grading (.display-lead is
// 40px+, .display-sub the same band; both are an <h1>). They are checked at 3:1.
const LARGE_CLASSES = new Set(["display-lead", "display-sub"]);
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
  console.error(`check:hero-rock FAIL: ${msg}`);
  process.exit(1);
};

const channels = (value, what) => {
  const c = String(value || "").trim().split(/\s+/).map(Number);
  if (c.length !== 3 || !c.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) fail(`${what} is not three 0-255 channels: "${value}"`);
  return c;
};

const mix = (fg, bg, a) => fg.map((f, i) => f * a + bg[i] * (1 - a));

// The worst background for a given veil alpha, ridge ceiling and rock colour.
function worstBackground({ paper, rock, maxIntensity, veil }) {
  return mix(rock, paper, maxIntensity * (1 - veil));
}

function readMaxIntensity() {
  const m = /const\s+ROCK_MAX_INTENSITY\s*=\s*([0-9.]+)\s*;/.exec(fs.readFileSync(SCRIPT, "utf8"));
  if (!m) fail("static/js/home-rock.js has no `const ROCK_MAX_INTENSITY = <number>;`");
  const v = Number(m[1]);
  if (!(v > 0 && v <= 1)) fail(`ROCK_MAX_INTENSITY ${m[1]} is outside 0..1`);
  return v;
}

function readSheet(sheet) {
  const token = (name) => {
    const v = sheet.token(name);
    if (v == null) fail(`src/input.css has no --${name}`);
    return v;
  };
  const veilDecl = sheet.declarations.find((d) => d.selector === ".home-rock-veil" && d.prop === "background-color");
  if (!veilDecl) fail("src/input.css has no .home-rock-veil background-color");
  const vm = /^rgb\(\s*var\(--surface-rgb\)\s*\/\s*([0-9.]+%?)\s*\)$/.exec(veilDecl.raw || veilDecl.value);
  if (!vm) fail(`.home-rock-veil background-color must be rgb(var(--surface-rgb) / <alpha>); found "${veilDecl.raw || veilDecl.value}"`);
  const veil = vm[1].endsWith("%") ? Number(vm[1].slice(0, -1)) / 100 : Number(vm[1]);
  if (!(veil >= 0 && veil <= 1)) fail(`veil alpha ${vm[1]} is outside 0..1`);
  return {
    veil,
    paper: channels(token("surface-rgb"), "--surface-rgb"),
    rock: channels(token("rock-rgb"), "--rock-rgb"),
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
  if (start < 0) fail(`${rel}: no <section id="about-us"> (the hero); update scripts/check-hero-rock.js if it was renamed`);
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
          if (!TEXT_COLOUR[base]) fail(`${rel}: hero uses ${cls}, a text colour check:hero-rock does not know; add it to TEXT_COLOUR in scripts/check-hero-rock.js so its contrast is measured`);
          add(`${TEXT_COLOUR[base]}|${bare}`, { label: bare, tokenName: TEXT_COLOUR[base], large: false }, rel);
          continue;
        }
        // an authored class that sets `color` (.display-lead, .copy-email, ...)
        const decls = sheet.declarations.filter((d) => d.selector === `.${cls}`);
        const own = decls.find((d) => d.prop === "color");
        const backed = decls.some((d) => /^background(-color)?$/.test(d.prop) && d.value.trim() !== "transparent");
        if (backed) continue; // paints its own opaque ground (.btn); the veil is not behind its text
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

function evaluate(rock = {}) {
  const sheet = read();
  const s = readSheet(sheet);
  const maxIntensity = rock.maxIntensity ?? readMaxIntensity();
  const veil = rock.veil ?? s.veil;
  const rockRgb = rock.rock ?? s.rock;
  const bg = worstBackground({ paper: s.paper, rock: rockRgb, maxIntensity, veil });
  const colours = heroTextColours(sheet, HOME_TEMPLATES);
  const rows = colours.map((c) => {
    const rgb = s.token(c.tokenName);
    const ratio = contrastRatio(rgb, bg);
    const need = c.large ? AA_LARGE : AA;
    return { ...c, ratio, need, ok: ratio >= need, roomy: ratio >= need + MARGIN };
  });
  return { rows, bg, veil, maxIntensity, rock: rockRgb, paper: s.paper, paperRatio: (c) => contrastRatio(s.token(c), s.paper) };
}

function main() {
  const r = evaluate();
  const rgb = (c) => c.map((n) => Math.round(n)).join(" ");
  console.log(`hero rock: veil ${(r.veil * 100).toFixed(0)}%, ROCK_MAX_INTENSITY ${r.maxIntensity}, --rock-rgb ${rgb(r.rock)}, paper ${rgb(r.paper)}`);
  console.log(`worst background ${rgb(r.bg)} (paper under full-strength rock, under the veil); ${HOME_TEMPLATES.length} home templates read`);
  let bad = 0;
  let thin = 0;
  for (const row of r.rows.sort((a, b) => a.ratio - b.ratio)) {
    const flag = !row.ok ? "FAIL" : row.roomy ? "ok  " : "THIN";
    console.log(`  ${flag} ${row.ratio.toFixed(2)}:1 (needs ${row.need}) ${row.label}  [${[...row.where].length === HOME_TEMPLATES.length ? "all 5 locales" : [...row.where].join(", ")}]`);
    if (!row.ok) bad++;
    else if (!row.roomy) thin++;
  }
  if (bad) fail(`${bad} hero text colour(s) fall below AA on the brightest rock; thicken the veil or lower ROCK_MAX_INTENSITY`);
  if (thin) fail(`${thin} hero text colour(s) pass with less than ${MARGIN} to spare; keep the headroom so a token nudge does not turn the hero red`);
  console.log("check:hero-rock ok");
}

module.exports = { evaluate, worstBackground };
if (require.main === module) main();
