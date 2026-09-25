const fs = require("fs");
const path = require("path");
const { ROOT, lineOf, TYPE_LADDER_MIN, TYPE_LADDER_MAX } = require("../lib");

// RULE 30 — og scale jump.
//
// DESIGN.md's reference set asks for one dramatic scale jump: the largest text
// on a printed page is 5-12 times the microcopy size. The site's pages answer
// that through rule 27, which reads the ladder in tailwind.config.js. The share
// cards are the site's only other carrier with a fixed frame, and they carry a
// second, entirely separate ladder that nothing has ever read.
//
// TWO RULES, NOT ONE. Rule 27 reads tailwind.config.js; this reads
// build-og.js. The two ladders are unrelated declarations and no third thing
// compares them, which is why the card sat at 4.71x while the page was being
// argued up to 5.33x.
//
// WHY THE EXPORT AND NOT A REGEX. The sizes used to live inline in a template
// literal. A rule that scraped `font-size: (\d+)px` out of it would miss the
// title entirely — it is written `${cond ? long : short}px` — and would go
// green the moment someone reformatted the string. The scale is now a named
// export, so this reads the same value the card is built from.
//
// BOTH BRANCHES. The title has two steps and the long one is the one 59 of the
// 100 cards take, so checking only the nominal size would report a ratio that
// most cards do not have.
function ruleOgScaleJump() {
  const rel = path.join("scripts", "assets", "og-card.js");
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const src = fs.readFileSync(abs, "utf8");
  const lineOfKey = (key) => {
    const m = new RegExp(`^\\s*${key}:`, "m").exec(src);
    return m ? lineOf(src, m.index) : 1;
  };

  let scale;
  try {
    ({ TYPE_SCALE: scale } = require(path.join(ROOT, rel)));
  } catch (err) {
    return [{ file: rel, line: 1, detail: `the card's type scale is not importable: ${err.message}` }];
  }
  if (!scale) return [{ file: rel, line: 1, detail: "og-card.js exports no TYPE_SCALE for this rule to read" }];

  const nonTitle = Object.entries(scale).filter(([, v]) => typeof v === "number");
  const found = [];
  for (const [branch, title] of Object.entries(scale.title || {})) {
    const sizes = [...nonTitle, [`title.${branch}`, title]];
    const max = sizes.reduce((a, b) => (a[1] >= b[1] ? a : b));
    const min = sizes.reduce((a, b) => (a[1] <= b[1] ? a : b));
    const ratio = max[1] / min[1];
    if (ratio >= TYPE_LADDER_MIN && ratio <= TYPE_LADDER_MAX) continue;
    found.push({
      file: rel,
      line: lineOfKey(min[0].includes(".") ? "title" : min[0]),
      detail:
        `${branch} title: ${max[0]} ${max[1]}px over ${min[0]} ${min[1]}px is ${ratio.toFixed(2)}x, ` +
        `outside the ${TYPE_LADDER_MIN}-${TYPE_LADDER_MAX}x jump — ${min[0]} would have to be ` +
        `${(max[1] / TYPE_LADDER_MAX).toFixed(0)}-${(max[1] / TYPE_LADDER_MIN).toFixed(0)}px`,
    });
  }
  return found;
}

module.exports = ruleOgScaleJump;
