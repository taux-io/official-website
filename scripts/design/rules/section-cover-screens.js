// Every section heading opens a full-screen band carrying nothing but an eyebrow
// and the heading itself. The heading stays a real h2 inside that band rather
// than a visual stand-in beside it, because the document outline, the
// heading-structure rule and every fragment link depend on it.
//
// THE CHROME IS LEFT OUT BY WHERE IT SITS, NOT BY WHICH FILE IT CAME FROM. Six
// of the site's h2s live in the nav columns, the header and the footer, and a
// rule written against the raw total would demand full-screen bands inside the
// footer. This rule used to skip every `_*.html`, header.html and footer.html
// to get that — which also meant a macro in a partial could drop `data-cover`
// with the rule green (measured, NOTES 「模板結構大改」). It now reads the built
// page (scripts/design/rendered.js), and only an h2 inside <main> is a section
// heading; the menu overlay and the footer are outside it.
const { parseElements, hasAttr } = require("../lib");
const { locate, outerOf, markup, dedupe } = require("../rendered");

function ruleSectionCoverScreens(files, { rendered }) {
  const found = [];
  for (const page of rendered()) {
    for (const node of parseElements(markup(page))) {
      if (node.tag !== "h2") continue;
      if (!node.ancestors.some((a) => a.tag === "main")) continue;
      // data-cover="sr" is the one variant: a screen-reader-only heading gets a
      // cover element so this rule stays satisfied, without the visible block.
      // Named here and in the glossary rather than left as an undocumented
      // attribute value that any future writer could invent a second one beside.
      if (hasAttr(node, /\bdata-cover\b/)) continue;
      const tag = page.html.slice(node.index, node.contentStart);
      found.push({
        ...locate(page, [outerOf(page, node), tag], node.index),
        detail: `h2 outside a [data-cover] band — every section heading opens a cover screen (on ${page.url})`,
      });
    }
  }
  return dedupe(found);
}

module.exports = ruleSectionCoverScreens;
