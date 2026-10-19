const fs = require("fs");
const path = require("path");
const { ROOT, lineOf } = require("../lib");

// The visual family starts one browser, in one place.
//
// geometry, contrast and screenshot each used to launch their own and each
// re-derived what "the page has settled" means; the discipline that keeps the
// overflow gate from going red at random lived in exactly one of the three.
// walk.js owns that now, and this keeps a fourth walker from appearing quietly.
//
// THREE NAMED EXEMPTIONS, and naming them is the point — a comment saying "we
// decided not to absorb these" has no teeth.
//
//   contract.js walks the same routes but asserts HTTP: headers, redirects,
//   HEAD, og:image status. It never sets a viewport.
//
//   diff.js walks nothing. It uses Chromium as a PNG decoder to compare two
//   screenshot sets.
//
//   water.js walks no routes' layout either: it opens the five home pages under
//   five conditions (desktop, phone, reduced motion, no WebGL) and needs its
//   own launch flags per condition — SwiftShader on, then every GL path off —
//   which a shared walker's one browser cannot offer.
const WALKER_EXEMPT = new Set(["walk.js", "contract.js", "diff.js", "water.js"]);

function ruleSingleWalker() {
  const dir = path.join(ROOT, "scripts", "visual");
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".js") || WALKER_EXEMPT.has(name)) continue;
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    const m = /\blaunch\s*\(/.exec(text);
    if (!m) continue;
    found.push({
      file: path.join("scripts", "visual", name),
      line: lineOf(text, m.index),
      detail: "launches its own browser — the walk, and the settle discipline that goes with it, belongs to walk.js",
    });
  }
  return found;
}

module.exports = ruleSingleWalker;
