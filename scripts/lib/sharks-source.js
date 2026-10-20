// Reads the home hero's sharks background out of its single sources, so
// check:hero-sharks keeps no regex of its own for them.
//
//   · TEXT_FADE_MAX and the ladder             static/js/sharks-sim.js
//   · the tint tokens the script reads         static/js/home-sharks.js
//   · --shark-N-rgb, --ink-rgb, --surface-rgb  the authored CSS
//
// Every failure THROWS an Error; the caller decides how to report it.
// (The still's staleness ledger that used to live here hashed the water shader;
// ticket #401 rebuilds that pipeline for the sharks.)

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "static", "js", "home-sharks.js");
const SIM = path.join(ROOT, "static", "js", "sharks-sim.js");
// home-sharks.js and sharks-sim.js TOGETHER (spec #396); a limit, not a target.
const SIZE_LIMIT = 14336;

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

const sizes = () => ({ script: fs.statSync(SCRIPT).size, sim: fs.statSync(SIM).size, limit: SIZE_LIMIT });

module.exports = { ROOT, SCRIPT, SIM, SIZE_LIMIT, channels, simConstants, readTints, scriptTints, sizes };
