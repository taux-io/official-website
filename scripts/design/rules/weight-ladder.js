const stylesheet = require("../../stylesheet");
const { lineOf, parseElements } = require("../lib");

// The weight ladder has a hole in it, on purpose.
//
// 300 / 400 / 600 / 700, with 500 deliberately absent — the reference site's own
// "Don't" list says so by name. Body is 400, inline emphasis is 600, display is
// 600.
//
// THE FIRST VERSION OF THIS RULE WAS TRIVIALLY EVADED, and it was credited in
// DESIGN.md while being so. It stripped a `[a-z-]*:` prefix and compared against
// one literal class name, so `!font-medium`, `min-[600px]:font-medium`,
// `font-[500]` and `[font-weight:500]` all shipped weight 500 past a green gate
// — and it never read the stylesheet at all, so a raw `font-weight: 500` in a
// template's own <style> block was invisible. There was one, live, on the route
// with the most code content.
//
// Both roads are checked now: the class attribute for anything that compiles to
// 500, and every declaration the stylesheet module can see.
const WEIGHT_500_CLASS = /(?:^|:)(?:!)?(?:font-medium|font-\[500\]|\[font-weight:500\])$/;

function ruleWeightLadder(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        // Variants are stripped by taking everything after the last colon that
        // is not inside brackets — `min-[600px]:font-medium` and
        // `data-[state=on]:!font-medium` both end in the utility itself.
        const bare = c.replace(/^(?:[^:\[\]]*(?:\[[^\]]*\])?[^:\[\]]*:)+/, "");
        if (!WEIGHT_500_CLASS.test(":" + bare)) continue;
        found.push({
          file: rel,
          line: lineOf(html, node.index),
          detail: `${c} compiles to weight 500, which this ladder omits — inline emphasis is 600`,
        });
      }
    }
  }

  // The other road: a raw declaration anywhere the stylesheet module can see —
  // input.css, a template's own <style>, a style="" attribute.
  for (const d of stylesheet.read().declarations) {
    if (d.prop !== "font-weight") continue;
    if (d.value.trim() !== "500") continue;
    found.push({
      file: d.file,
      line: d.line,
      detail: `${d.selector} declares font-weight: 500, which this ladder omits`,
    });
  }
  return found;
}

module.exports = ruleWeightLadder;
