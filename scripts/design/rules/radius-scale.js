const { lineOf, elements, stripVariants } = require("../lib");

// A radius must be one of the six declared steps.
//
// THIS REPLACES "radius on controls only", and the replacement is a widening,
// not a relaxation. The previous vocabulary was square except for controls; this
// one has a six-step grammar and forbids mixing — utility rects at 8px, cards at
// 18px, pills at 9999. Three of the six have no user on this site today, which
// is the reverse of decision #52's argument and is named as a cost in #54.
//
// What still cannot happen is a seventh value. Tailwind's own rounded-* steps
// are mapped onto the declared ones in the config, so an arbitrary
// rounded-[7px] is the shape this catches.
// SIX STEPS, AND THE WORD "SIX" HAS TO SURVIVE CONTACT WITH THE LIST.
//
// An earlier version of this set held seven names while the message said six and
// DESIGN.md's prose said six over a list of seven — the same defect class that
// document confesses to three times (20 hex values, 106 cover screens, 4.29:1).
// `rounded-control` was the seventh: it resolves to the same 9999px as
// `rounded-full` and had zero users in the templates, because the pill radius
// reaches .btn through CSS rather than through a class. The token stays;
// the duplicate class name does not.
const RADIUS_ALLOWED = new Set([
  "rounded-none", "rounded-xs", "rounded-sm", "rounded-md", "rounded-lg",
  "rounded-full",
]);

function ruleRadiusScale(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const el of elements(html)) {
      for (const c of el.classes) {
        const bare = stripVariants(c);
        if (!/^rounded(-|$)/.test(bare)) continue;
        if (RADIUS_ALLOWED.has(bare)) continue;
        found.push({
          file: rel,
          line: lineOf(html, el.index),
          detail: `${c} is not one of the six declared radius steps — the grammar is none / xs / sm / md / lg / full`,
        });
      }
    }
  }
  return found;
}

module.exports = ruleRadiusScale;
