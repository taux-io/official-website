// Reads the home hero's sharks background out of its single sources, so
// check:hero-sharks keeps no regex of its own for them.
//
//   · TEXT_FADE_MAX and the ladder             static/js/sharks-sim.js
//   · the tint tokens the script reads         static/js/home-sharks.js
//   · --shark-N-rgb, --ink-rgb, --surface-rgb  the authored CSS
//
//   · the two stills' constants and their ledger   below (spec #396, ticket #401)
//
// Every failure THROWS an Error; the caller decides how to report it.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "static", "js", "home-sharks.js");
const SIM = path.join(ROOT, "static", "js", "sharks-sim.js");
// home-sharks.js and sharks-sim.js TOGETHER (spec #396); a limit, not a target.
const SIZE_LIMIT = 16384;

const BUILDER = path.join(ROOT, "scripts", "assets", "build-sharks.js");
const INPUT_CSS = path.join(ROOT, "src", "input.css");
const STILL_LEDGER = path.join(ROOT, "ledgers", "hero-sharks-still.txt");

const text = (file) => fs.readFileSync(file, "utf8");

// "20 220 190" -> [20, 220, 190]. `what` names the token in the error.
function channels(value, what) {
  const c = String(value || "").trim().split(/\s+/).map(Number);
  if (c.length !== 3 || !c.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    throw new Error(`${what} is not three 0-255 channels: "${value}"`);
  }
  return c;
}

// What the simulation promises: the most ink a cell holds inside a text box,
// and the first (lightest) ladder step, which is also the grid line's ink.
function simConstants() {
  delete require.cache[SIM];
  const sim = require(SIM);
  const fade = sim.TEXT_FADE_MAX;
  const grid = sim.LADDER && sim.LADDER[0];
  if (!(fade > 0 && fade < 1)) throw new Error(`static/js/sharks-sim.js TEXT_FADE_MAX ${fade} is not in 0..1`);
  if (!(grid > 0 && grid < 1)) throw new Error("static/js/sharks-sim.js exports no LADDER whose first step is a coverage in 0..1");
  return { fade, grid };
}

// Every --shark-*-rgb the authored CSS declares, as { "--shark-1-rgb": [r,g,b] }.
// Exactly four, numbered 1..4, or it throws.
function readTints(sheet) {
  const names = [...sheet.tokens.keys()].filter((k) => /^--shark-.*-rgb$/.test(k));
  const want = [1, 2, 3, 4].map((n) => `--shark-${n}-rgb`);
  const extra = names.filter((n) => !want.includes(n));
  if (extra.length) throw new Error(`${extra.join(", ")} declared: the sharks have exactly four tints (--shark-1-rgb .. --shark-4-rgb); another one is a new colour, which needs the owner (DESIGN.md decision 183)`);
  const out = {};
  for (const n of want) {
    const v = sheet.token(n);
    if (v == null) throw new Error(`${n} is not declared in the authored CSS`);
    out[n] = channels(v, n);
  }
  return out;
}

// The tints the scripts themselves know of, so a change in a script cannot
// drift from the stylesheet. Three things are read, and each must be found:
//   · every colour literal in either script (`rgb(r g b)`, `rgb(r, g, b)`,
//     `#hex`, or a quoted `'r g b'` triple); each must be one of the
//     stylesheet's four. The scripts are meant to hold none, so the usual
//     answer is an empty list;
//   · the number of tints the simulation can pick (`H(..., 4000) * N`);
//   · the list of --shark-N tokens the script reads (`[1, 2, 3, 4].map`).
function scriptTints() {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const literals = [];
  for (const file of [SCRIPT, SIM]) {
    const src = strip(text(file));
    const where = path.relative(ROOT, file);
    for (const m of src.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g)) literals.push({ where, rgb: [+m[1], +m[2], +m[3]], text: m[0] });
    for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b/g)) literals.push({ where, rgb: [1, 3, 5].map((i) => parseInt(m[0].slice(i, i + 2), 16)), text: m[0] });
    for (const m of src.matchAll(/['"`](\d{1,3}) (\d{1,3}) (\d{1,3})['"`]/g)) literals.push({ where, rgb: [+m[1], +m[2], +m[3]], text: m[0] });
  }
  const pick = /H\([^()]*\b4000\b[^()]*\)\s*\*\s*(\d+)/.exec(strip(text(SIM)));
  if (!pick) throw new Error("static/js/sharks-sim.js no longer picks a tint as `H(..., 4000) * <count>`; teach scripts/lib/sharks-source.js the new form so the tint count stays held");
  const read = /\[([\d,\s]+)\]\.map\(\(n\) => `rgb\(\$\{token\(`--shark-\$\{n\}-rgb`\)\}\)`\)/.exec(text(SCRIPT));
  if (!read) throw new Error("static/js/home-sharks.js no longer reads its tints as `[1, 2, 3, 4].map((n) => `rgb(${token(`--shark-${n}-rgb`)})`)`; teach scripts/lib/sharks-source.js the new form so the tint count stays held");
  return { literals, simPicks: Number(pick[1]), scriptReads: read[1].split(",").map((s) => Number(s.trim())).filter(Number.isFinite) };
}

// ---------------------------------------------------------------------------
// THE STILLS. Two WebPs drawn by scripts/assets/build-sharks.js from the SAME
// simulation as the live canvas, at a fixed moment (seed and t are `frame()`'s
// arguments; no clock). Everything that decides what they look like is here so
// the builder and the staleness gate read ONE copy; change any of it and the
// ledger no longer matches until `npm run build:sharks` is rerun.
//
//   landscape  desktop fallback and tablets: the cell a 1440-wide hero gets
//              (the script's 0.82% of the width, 8..14 px), 12 x 17.7 px.
//   portrait   phones: fixed 8 x 12 px cells, 49 columns (spec #396).
//
// seed and t were picked by `node scripts/assets/build-sharks.js --scan`, which
// sweeps the simulation and lists the moments that meet SELECTION: at least two
// sharks inside the picture, at least two of them in its right half, and no
// shark cell at all in its left `leftClear` (where the hero's text is). The
// builder refuses a pair that does not meet it.
// Re-picked for the humpback whales that replaced the sharks (top view, dive depth);
// re-pick with `--scan` whenever the simulation's motion or sizes change.
const cellFor = (width) => {
  const cw = Math.min(14, Math.max(8, width * 0.0082));
  return { cw, ch: cw * 1.5 };
};
//
// The portrait still (ticket #403) is drawn at 1 CSS px per image px and shown
// that way (background-size: 600px 900px, top left; src/input.css), so a cell is
// 8 x 12 CSS px whatever the phone and a text line sits at the same place in
// the picture as on the page. It is 600 wide so the widest phone (599px) is
// covered; a narrower phone crops the right. Its text lines are NOT avoided by
// the choice of moment: build-sharks.js measures the hero's lines at every
// PHONE_WIDTHS x LOCALES and fades the cells under the UNION of all of them
// (the most conservative zone: a line at any width or language is clear), with
// the same per-line boxes and the same 12% as the desktop. `view` is the part of
// the picture every phone shows (the narrowest width checked, the shortest
// hero), where SELECTION counts whales.
const STILLS = {
  landscape: { file: "hero-sharks-landscape.webp", width: 1440, height: 720, ...cellFor(1440), seed: 17, t: 217 },
  portrait: { file: "hero-sharks-portrait.webp", width: 600, height: 900, cw: 8, ch: 12, seed: 24, t: 80, fade: true, view: { cols: 40, rows: 45 } },
};
// The phone widths the portrait still's fade is drawn for and then held to by
// `npm run sharks`: a narrow phone, the 375 the issue names, and a wide one.
const PHONE_WIDTHS = [320, 375, 430];
const LOCALES = ["zh-Hant-TW", "en-US", "zh-Hans-CN", "ja-JP", "ko-KR"];
const ENCODE = { quality: 62, alphaQuality: 60, effort: 6 };
// leftClear applies to a still with no fade (the landscape one); the portrait
// one fades under its text instead and needs no empty side.
const SELECTION = { minSharks: 2, minRight: 2, leftClear: 0.4 };
// A budget the builder checks, not an input to the pictures: kept out of the
// ledger's hash so changing it cannot make a correct still look stale.
const STILL_MAX_BYTES = 80 * 1024;
const stillPath = (name) => path.join(ROOT, "static", "brand", STILLS[name].file);
const REGEN = "npm run build:sharks && npm run build:css";

// Source with comments removed and whitespace collapsed, so editing a comment
// (or re-indenting) does not make a still look stale. String literals are left
// alone; none of the hashed files has a regex literal that holds a quote.
function normalized(file) {
  const src = text(file);
  let out = "", i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) {
      out += c;
      if (c === "\\") out += src[++i];
      else if (c === q) q = null;
      i++;
    } else if (c === "/" && n === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e < 0 ? src.length : e + 2;
    } else if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else {
      if (c === "'" || c === '"' || c === "`") q = c;
      out += c;
      i++;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");

// What the pictures are made from. `sheet` is a scripts/stylesheet `read()`.
// Pixels are not hashed (fonts and GPUs differ); the images' own hashes are
// kept apart in the ledger, so "replaced by hand" has its own message.
function stillInputs(sheet) {
  const tints = readTints(sheet);
  return {
    sim: normalized(SIM),
    builder: normalized(BUILDER),
    tints: Object.keys(tints).sort().map((k) => tints[k]),
    paper: channels(sheet.token("surface-rgb"), "--surface-rgb"),
    ink: channels(sheet.token("ink-rgb"), "--ink-rgb"),
    stills: STILLS,
    selection: SELECTION,
    encode: ENCODE,
    phones: PHONE_WIDTHS,
  };
}
const stillDigest = (inputs) => sha(JSON.stringify(inputs));

// First 10 hex digits of an image's own hash: the `?v=` on its url() in
// src/input.css. /static/brand/* is cached for a week (_headers) and a url()
// inside the stylesheet has no js_version to ride on, so this is what makes a
// returning visitor ask for the new picture.
const imageVersion = (bytes) => sha(bytes).slice(0, 10);

function ledgerText(inputs, images) {
  const kb = (b) => (b.length / 1024).toFixed(1);
  return [
    "# Which simulation the home hero's two stills (static/brand/hero-sharks-*.webp) were drawn from.",
    "#",
    `# Regenerate with \`${REGEN}\`, then commit both images, this file,`,
    "# src/input.css and static/css/styles.min.css. `npm run check:hero-sharks` (no",
    "# browser) hashes the simulation source (comments stripped), the builder, the four",
    "# tints, paper, ink, the cell sizes, the moments, the seeds and the encoder again",
    "# and fails if they differ from this file. Each image's own hash is here too, so a",
    "# picture swapped by hand is as stale as a simulation changed without a rebuild.",
    "# Pixels are not hashed (fonts and GPUs differ); the byte limit is the builder's.",
    "#",
    `# paper      ${inputs.paper.join(" ")}`,
    `# ink        ${inputs.ink.join(" ")}`,
    `# tints      ${inputs.tints.map((t) => t.join(" ")).join(" | ")}`,
    `# landscape  ${JSON.stringify(inputs.stills.landscape)}  ${kb(images.landscape)} KB`,
    `# portrait   ${JSON.stringify(inputs.stills.portrait)}  ${kb(images.portrait)} KB`,
    "",
    `inputs ${stillDigest(inputs)}`,
    `landscape ${sha(images.landscape)}`,
    `portrait ${sha(images.portrait)}`,
    "",
  ].join("\n");
}

function readLedger() {
  if (!fs.existsSync(STILL_LEDGER)) return null;
  const t = fs.readFileSync(STILL_LEDGER, "utf8");
  const get = (k) => (new RegExp(`^${k} ([0-9a-f]{64})$`, "m").exec(t) || [])[1] || null;
  return { inputs: get("inputs"), landscape: get("landscape"), portrait: get("portrait") };
}

// Runs IN THE PAGE (pass it to page.evaluate; it must stay self-contained): one
// box per line of the hero's text, in CSS px relative to the hero, as wide as
// the line's glyphs. The same walk static/js/home-sharks.js measure() does, so
// the builder, the gate and the desktop script all mean "a line of text" alike.
function lineBoxes() {
  const hero = document.querySelector("[data-home-sharks]").parentElement, o = hero.getBoundingClientRect();
  const walker = document.createTreeWalker(hero, 4), range = document.createRange(), out = [];
  for (let n; (n = walker.nextNode());) {
    if (!n.textContent.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width > 0 && r.height > 0) out.push({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
    }
  }
  return { hero: { w: o.width, h: o.height }, lines: out };
}

const sizes = () => ({ script: fs.statSync(SCRIPT).size, sim: fs.statSync(SIM).size, limit: SIZE_LIMIT });

module.exports = {
  ROOT, SCRIPT, SIM, SIZE_LIMIT, INPUT_CSS, STILL_LEDGER, STILLS, PHONE_WIDTHS, LOCALES, ENCODE, SELECTION, STILL_MAX_BYTES, REGEN, lineBoxes,
  channels, simConstants, readTints, scriptTints, sizes,
  stillPath, stillInputs, stillDigest, imageVersion, ledgerText, readLedger, sha, normalized,
};
