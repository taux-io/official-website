const fs = require("fs");
const path = require("path");
const { ROOT, lineOf, TYPE_LADDER_MIN, TYPE_LADDER_MAX } = require("../lib");

// RULE 27 — scale jump.
//
// The reference set asks for one dramatic scale jump: the largest text is 5-12
// times the microcopy. Rule 30 asks it of the share card; this asks it of the
// pages, and the two read different files on purpose (30 reads build-og.js's
// TYPE_SCALE, this reads tailwind.config.js) because the site and the card
// carry two separate ladders and nothing compares them.
//
// IT READS THE LADDER, NOT A BREAKPOINT. `.display-lead` renders `text-4xl
// tablet:text-display-lg`, and text-4xl is Tailwind's own 2.25rem — so the
// largest type actually painted on a phone is 36px, a 3.0x jump. Measuring what
// a viewport shows would make this rule report the breakpoint rather than the
// vocabulary, and go red on a phone for a decision the scale never made.
//
// RATIOS DO NOT NEED PIXELS. Every step is declared in rem, so the jump is
// 3.5rem / 0.75rem whatever the root font size happens to be. This site has had
// its root inflated to 17px once already (the reading-measure note in DESIGN.md
// records what that cost), and a rule that converted to px would have quietly
// moved with it.

function ruleScaleJump() {
  const config = path.join(ROOT, "tailwind.config.js");
  if (!fs.existsSync(config)) return [];
  let scale;
  try {
    scale = require(config)?.theme?.extend?.fontSize;
  } catch (err) {
    return [{ file: "tailwind.config.js", line: 1, detail: `the type scale is not readable: ${err.message}` }];
  }
  if (!scale) return [{ file: "tailwind.config.js", line: 1, detail: "theme.extend.fontSize declares no scale for this rule to read" }];

  const text = fs.readFileSync(config, "utf8");
  const steps = [];
  for (const [name, value] of Object.entries(scale)) {
    const size = Array.isArray(value) ? value[0] : value;
    const rem = /^([\d.]+)rem$/.exec(String(size));
    if (!rem) continue;
    steps.push({ name, rem: Number(rem[1]) });
  }
  if (steps.length < 2) return [];

  const largest = steps.reduce((a, b) => (a.rem >= b.rem ? a : b));
  const smallest = steps.reduce((a, b) => (a.rem <= b.rem ? a : b));
  const jump = largest.rem / smallest.rem;
  if (jump >= TYPE_LADDER_MIN && jump <= TYPE_LADDER_MAX) return [];

  const m = new RegExp(`^\\s*"?${largest.name}"?:`, "m").exec(text);
  return [
    {
      file: "tailwind.config.js",
      line: m ? lineOf(text, m.index) : 1,
      detail:
        `${largest.name} ${largest.rem}rem over ${smallest.name} ${smallest.rem}rem is ${jump.toFixed(2)}x, ` +
        `outside the ${TYPE_LADDER_MIN}-${TYPE_LADDER_MAX}x jump — ${largest.name} would have to be ` +
        `${(smallest.rem * TYPE_LADDER_MIN).toFixed(2)}-${(smallest.rem * TYPE_LADDER_MAX).toFixed(2)}rem`,
    },
  ];
}

module.exports = ruleScaleJump;
