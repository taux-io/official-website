const path = require("path");
const { lineOf, parseElements, hasAttr } = require("../lib");

// Every section heading opens a full-screen band carrying nothing but an eyebrow
// and the heading itself. The heading stays a real h2 inside that band rather
// than a visual stand-in beside it, because the document outline, the
// heading-structure rule and every fragment link depend on it.
//
// PARTIALS ARE EXCLUDED, AND THAT EXCLUSION IS THE POINT. The site has 106 h2
// elements and six of them live in the nav columns, the header and the footer. A
// rule written against the raw total would demand six full-screen bands inside
// the footer. The spec's first draft said 106; counting the files before writing
// the rule is what caught it.
function ruleSectionCoverScreens(files) {
  const found = [];
  for (const { rel, html } of files) {
    const base = path.basename(rel);
    if (base.startsWith("_") || base === "header.html" || base === "footer.html") continue;
    for (const node of parseElements(html)) {
      if (node.tag !== "h2") continue;
      // data-cover="sr" is the one variant: a screen-reader-only heading gets a
      // cover element so this rule stays satisfied, without the visible block.
      // Named here and in the glossary rather than left as an undocumented
      // attribute value that any future writer could invent a second one beside.
      if (hasAttr(node, /\bdata-cover\b/)) continue;
      found.push({
        file: rel,
        line: lineOf(html, node.index),
        detail: "h2 outside a [data-cover] band — every section heading opens a cover screen",
      });
    }
  }
  return found;
}

module.exports = ruleSectionCoverScreens;
