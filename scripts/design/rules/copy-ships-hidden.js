const { lineOf, parseElements } = require("../lib");

// RULE 39 — copy ships hidden.
//
// The fallback address's copy button (DESIGN.md decisions 172 and 174) only
// works through script.js and the clipboard API. Shipped visible, it is a
// button that does nothing wherever either is missing — which is exactly the
// locked-down machine the fallback exists for. So the markup must hide it
// (`hidden`, which script.js removes), name what it copies (two sit on one
// page), and carry both outcomes, so a refused clipboard says so instead of
// leaving the button unchanged.
const NEEDS = ["aria-label", "data-copied", "data-failed"];

function ruleCopyShipsHidden(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      if (!/\sdata-copy="/.test(" " + node.attrs)) continue;
      const missing = NEEDS.filter((a) => !new RegExp(`\\s${a}="`).test(" " + node.attrs));
      if (!node.classes.includes("hidden")) missing.unshift("class hidden");
      if (!missing.length) continue;
      found.push({
        file: rel,
        line: lineOf(html, node.index),
        detail: `copy control without ${missing.join(", ")} — it must ship hidden, named, and with both outcomes`,
      });
    }
  }
  return found;
}

module.exports = ruleCopyShipsHidden;
