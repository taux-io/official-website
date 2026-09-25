const { lineOf, elements, stripVariants } = require("../lib");

// THE SURFACE IS PAINTED ONCE, AND EVERY REPAINT OF IT IS INVISIBLE.
//
// There is one surface and `body` carries it, so `bg-surface` on anything
// inside `body` paints white on white. That is not merely redundant — it
// silently produced OBJECTS THAT DO NOT EXIST. Measured before this rule was
// written: 373 elements repainted the surface, and among them 40 bullet dots
// (`w-1.5 h-1.5 bg-surface rounded-full` inside a `list-none` list, so the list
// lost its markers entirely) and 30 numbered discs (`w-12 h-12 rounded-full
// bg-surface`, where the number showed and the disc never did).
//
// TWO SHAPES ARE LEGITIMATE AND BOTH ARE MEASURED RATHER THAN ASSUMED. `body`
// is where the surface is painted. And an element that floats over something
// else needs its own opaque fill or the layer beneath shows through — the two
// locale-switcher panels are `absolute`, and the nav is `fixed`. A probe over
// eight routes found 109 `bg-surface` elements: 85 computed the same background
// as their nearest painted ancestor, and every one of the rest was `body`, the
// nav, or a switcher panel.
//
// So the test is positional, not a name list: paint the surface only where you
// are the surface, or where you are lifted off it. `states differ` catches this
// same tautology for states; this catches it for base declarations, which
// nothing read before.
function ruleSurfacePaintedOnce(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const el of elements(html)) {
      if (!el.classes.some((c) => stripVariants(c).startsWith("bg-surface"))) continue;
      if (el.tag === "body") continue;
      if (el.classes.some((c) => ["absolute", "fixed"].includes(stripVariants(c)))) continue;
      found.push({
        file: rel,
        line: lineOf(html, el.index),
        detail: `<${el.tag}> repaints the surface it already sits on`,
      });
    }
  }
  return found;
}

module.exports = ruleSurfacePaintedOnce;
