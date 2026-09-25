const { lineOf } = require("../lib");

// ---------------------------------------------------------------------------
// The scale, from DESIGN.md's "字級與字距刻度" table. Any arbitrary tracking
// value outside this set is a one-off, which is the thing the table exists to
// prevent: the reference site's tracking changes sign with size, so it is one
// scale rather than a handful of independently chosen numbers.
// The Apple ladder's tracking, and it is signed: display closes up, lead opens
// out, eyebrow stays wide. Decision #53 deleted negative tracking three hours
// before this for being the previous reference site's signature; it is this
// one's signature too, at its own values.
const TRACKING_SCALE = new Set([
  "0", "0em", "0.09em", "0.011em", "-0.005em", "-0.011em", "-0.022em",
]);

function ruleTrackingScale(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/tracking-\[([^\]]+)\]/g)) {
      if (TRACKING_SCALE.has(m[1])) continue;
      found.push({ file: rel, line: lineOf(html, m.index), detail: m[0] });
    }
  }
  return found;
}

module.exports = ruleTrackingScale;
