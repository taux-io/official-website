// What DESIGN.md's ink model says about a colour.
//
//   const plates = require("./plates");
//   plates.stepsIn("rgb(var(--ink-rgb) / 0.12)", sheet);
//   // [{ text: "rgb(48 52 58 / 0.12)", plate: "ink", coverage: 0.121 }]
//
// THE ONE QUESTION BOTH COLOUR RULES ASK. `two plates` asks which plate a
// colour belongs to; `density scale` asks whether its coverage is a step the
// vocabulary declares. Those are the two halves of a single answer, so they are
// computed once here rather than twice in check-design.js.
//
// WHY IT COMPOSITES BEFORE IT COMPARES. DESIGN.md v5 says a lighter colour is
// not a new ink, it is the same plate laid down thinner — and a website can
// reach a given thinness by two different roads. `rgb(var(--ink-rgb) / 0.12)`
// and the `--line-rgb` token `226 226 224` are the same step; one is written as
// coverage, the other as the colour that coverage produces. Comparing the text
// would call them different. Compositing over the substrate first and then
// solving for coverage calls them what they are: ink at 12%.
//
// Measured, not assumed: `--ink-86` inverts to 86.1%, `--ink-72` to 72.0% and
// the hairline to 12.1%, each with under 0.005 of disagreement between the
// three channels. The named steps and the alpha steps land on one ladder.
//
// WHAT `null` MEANS, AND WHAT IT DOES NOT. A null plate means no coverage of
// any single plate produces this colour over this paper — a third ink. It does
// NOT mean the colour was hand-written: `rgba(25,25,24,0.06)`, the literal this
// site carried through three brand resets, composites to #ececea and solves
// cleanly to ink at 7.0%. Once rendered it is indistinguishable from a plate
// step, so this module cannot see that someone typed it. That is rule 1
// (`zero literal colour`) reading syntax, and it is why the three colour rules
// do not subsume one another.

// Every plate this vocabulary has. The substrate is listed because a colour may
// legitimately BE the paper, but it is not an ink: DESIGN.md counts two plates,
// and paper is what they are printed on.
const PLATE_TOKENS = { surface: "surface-rgb", ink: "ink-rgb", primary: "primary-rgb" };

// THE DECLARED LADDER, and like `tracking scale` and `radius scale` before it,
// the point is that it is closed. Every value here was measured off a colour
// this site actually ships:
//
//   0     bare paper                                        19 declarations
//   0.05  the code-chip wash, and .btn-quiet's hover        37 classes + 4
//   0.12  the hairline, .btn:hover, .btn-quiet:active       18 declarations
//   0.2   .btn:active                                        1
//   0.35  the scrollbar thumb under the pointer              1
//   0.56  --line-rgb under prefers-contrast: more            1
//   0.72  --ink-72, captions and meta                       named
//   0.86  --ink-86, secondary text                          named
//   1     solid ink or solid Cobalt                         43
//
// 0.56 WAS MISSING FOR AS LONG AS TOKENS WERE INVISIBLE. The migration table
// asked for it by name — 「`hairline` 改主墨版 12%（含 `prefers-contrast` 的
// 56% 階）」 — and the value shipped, but the three colour rules all opened by
// skipping `--*` declarations, so the one step this site reaches only inside a
// media query was never offered to the ladder. It is on the list now because
// the rules can finally see it, not because anything about the design changed.
//
// 0.06 IS ABSENT ON PURPOSE. It was `.btn-quiet:hover`, and on paper it renders
// #EEEEEC against 0.05's #F0F0EE — two levels apart, which nobody can see. A
// scale with a step in it that cannot be distinguished from its neighbour is
// decision #52's argument arriving from the other direction, so the two were
// merged into the one with 185 callers rather than the one with a single caller.
const DENSITY_SCALE = new Set([0, 0.05, 0.12, 0.2, 0.35, 0.56, 0.72, 0.86, 1]);

// 8-bit channels quantise coverage, so a step never solves to exactly itself.
// MEASURED, ACROSS EVERY STEP ON THE LADDER: the largest disagreement is 0.0008
// (0.05 solves to 0.0492, 0.86 to 0.8608); the rest are under 0.0006.
//
// THIS NUMBER WAS 0.01 AND THAT MADE THE RULE UNABLE TO GO RED. 0.05 and 0.06
// are 0.01 apart, so a tolerance of 0.01 snapped the off-ladder 0.06 onto 0.05
// and reported clean — a gate that agrees with whatever it is shown. Chosen by
// feel it was twelve times wider than the error it existed to absorb. 0.004 is
// five times the measured error and two and a half times inside the narrowest
// gap the ladder has to keep open.
const COVERAGE_TOLERANCE = 0.004;

// How far the three channels may disagree about coverage before the colour is
// judged not to be a plate at all. Measured spread on real values stays under
// 0.005; a colour off the plate axis lands an order of magnitude outside.
const CHANNEL_TOLERANCE = 0.02;

const COLOUR_TOKEN = /rgba?\([^)]*\)|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

function channels(text) {
  const fn = text.match(/rgba?\(\s*([0-9]+)[\s,]+([0-9]+)[\s,]+([0-9]+)\s*(?:[/,]\s*([0-9.]+%?))?\s*\)/);
  if (fn) {
    const alpha = fn[4] === undefined ? 1 : fn[4].endsWith("%") ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
    return { rgb: [+fn[1], +fn[2], +fn[3]], alpha };
  }
  const hex = text.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hex) return null;
  const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
  return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)), alpha: 1 };
}

// Substitution runs to a fixed point because the aliases chain: `var(--surface)`
// is `rgb(var(--surface-rgb))` is `rgb(250 250 247)`. One pass would leave the
// inner var standing and the colour unreadable.
function expand(value, sheet) {
  let out = value;
  for (let i = 0; i < 8 && out.includes("var("); i++) {
    const next = out.replace(/var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,[^)]*)?\)/g, (whole, name) => {
      const declared = sheet.token(name);
      return declared === null ? whole : declared;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

function plateValues(sheet) {
  const out = {};
  for (const [name, token] of Object.entries(PLATE_TOKENS)) {
    const raw = sheet.token(token);
    if (raw) out[name] = raw.trim().split(/[\s,]+/).map(Number);
  }
  return out;
}

// Solve C = coverage · plate + (1 − coverage) · substrate for coverage, one
// channel at a time. A channel where plate and substrate are equal carries no
// information about coverage — it constrains nothing and is skipped — but it
// must still match, or the colour is somewhere off the axis entirely.
function solve(rendered, plate, substrate) {
  const coverages = [];
  for (let i = 0; i < 3; i++) {
    if (plate[i] === substrate[i]) {
      if (Math.abs(rendered[i] - substrate[i]) > 1) return null;
      continue;
    }
    coverages.push((rendered[i] - substrate[i]) / (plate[i] - substrate[i]));
  }
  if (!coverages.length) return null;
  const spread = Math.max(...coverages) - Math.min(...coverages);
  if (spread > CHANNEL_TOLERANCE) return null;
  const coverage = coverages.reduce((a, b) => a + b, 0) / coverages.length;
  if (coverage < -COVERAGE_TOLERANCE || coverage > 1 + COVERAGE_TOLERANCE) return null;
  return { coverage, spread };
}

// Every colour a declaration value carries, each answered with the plate and
// coverage that produces it. `plate: null` is a colour no single plate explains.
function stepsIn(value, sheet) {
  const plates = plateValues(sheet);
  const substrate = plates.surface;
  if (!substrate) return [];
  const expanded = expand(String(value), sheet);
  const out = [];
  for (const text of expanded.match(COLOUR_TOKEN) || []) {
    const parsed = channels(text);
    if (!parsed) continue;
    const rendered = parsed.rgb.map((c, i) => Math.round(parsed.alpha * c + (1 - parsed.alpha) * substrate[i]));
    let best = null;
    for (const [name, plate] of Object.entries(plates)) {
      if (name === "surface") continue;
      const hit = solve(rendered, plate, substrate);
      if (hit && (!best || hit.spread < best.spread)) best = { plate: name, ...hit };
    }
    if (rendered.every((c, i) => Math.abs(c - substrate[i]) <= 1)) best = { plate: "surface", coverage: 0, spread: 0 };
    out.push({ text, plate: best ? best.plate : null, coverage: best ? best.coverage : null });
  }
  return out;
}



// TAILWIND'S OWN PALETTE IS STILL REACHABLE, AND THAT IS THE OTHER ROAD TO A
// THIRD INK. tailwind.config.js declares this site's colours under `extend`,
// and extend adds rather than replaces — `bg-red-500` compiles today, verified
// by building it. It never becomes author CSS, so stylesheet.read() cannot see
// it and neither can the declaration half of `two plates`.
//
// The check is by name rather than by shape, because a colour utility is not
// separable from a sizing one by parsing: `text-ink` is a colour and `text-lg`
// is not, and both are `text-<word>`. Tailwind's palette is a closed list, so
// the list is what this reads.
const FOREIGN_HUES = [
  "slate", "gray", "grey", "zinc", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo",
  "violet", "purple", "fuchsia", "pink", "rose",
].join("|");
const COLOUR_PREFIX = "bg|text|border|divide|ring|outline|decoration|from|via|to|fill|stroke|accent|caret|placeholder|shadow";
const FOREIGN_UTILITY = new RegExp(
  `^(?:[a-z-]+:)*(?:${COLOUR_PREFIX})-(?:(?:${FOREIGN_HUES})-\\d{2,3}|white|black)(?:\\/\\d{1,3})?$`
);

function foreignColourUtility(className) {
  return FOREIGN_UTILITY.test(className) ? className : null;
}

// Which plate a Tailwind colour utility applies, coverage aside. `bg-ink/5` and
// `text-primary` and `from-primary` are all the same question — this site's
// palette is the only one the config exposes under these names, so the plate is
// whatever follows the prefix.
//
// IT SHARES `COLOUR_PREFIX` WITH THE FOREIGN-HUE CHECK ON PURPOSE. Rule 26 used
// to carry its own inlined prefix list, and that copy was missing
// `from|via|to|accent|caret|placeholder|shadow` — verified by injecting
// `from-primary` onto a plain <div>, which the gate passed. One list, read by
// everything that needs it.
const PLATE_UTILITY = new RegExp(
  `^(?:[a-z-]+:)*(?:${COLOUR_PREFIX})-(surface|ink|primary|line)(?:-[a-z]+)?(?:\\/(\\d{1,3}))?$`
);

// `null` coverage means the utility names a plate without a density — `text-ink`
// is the plate at full strength through the token, not a step someone chose.
// Callers that police the ladder skip those; callers that police placement do
// not care either way.
//
// THIS USED TO BE TWO REGEXES. `utilityCoverage` matched the same plate group
// over a subset of the prefixes and demanded the slash; every class it matched,
// this one matched too, so `utilityCoverage(c) || plateUtility(c)` was only ever
// the second call. Two patterns over the same vocabulary is how rule 26's copy
// came to be missing `from|via|to` (decision #117), twelve lines under a comment
// promising one list.
function plateUtility(className) {
  const m = PLATE_UTILITY.exec(className);
  if (!m) return null;
  return { plate: m[1], coverage: m[2] === undefined ? null : Number(m[2]) / 100 };
}

function onScale(coverage) {
  for (const step of DENSITY_SCALE) {
    if (Math.abs(coverage - step) <= COVERAGE_TOLERANCE) return step;
  }
  return null;
}

module.exports = { stepsIn, plateUtility, foreignColourUtility, onScale, DENSITY_SCALE };
