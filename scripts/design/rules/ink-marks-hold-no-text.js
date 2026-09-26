const { lineOf, parseElements } = require("../lib");

// RULE 38 — ink marks hold no text.
//
// In forced colours (Windows high contrast) every background is flattened to
// the system Canvas, so the site's 263 `bg-ink` dots and bars — list bullets,
// timeline nodes, the hamburger's three lines — vanished. The forced-colors
// block in src/input.css paints them back in CanvasText (DESIGN.md decision
// #152), which is correct only because every one of them is an empty shape.
//
// Put a word inside one and that same rule paints CanvasText under
// CanvasText: the text is gone, in exactly the mode a reader chose so they
// could read. Nothing else would see it — `contrast` does not run with forced
// colours on, and in normal mode the word is simply ink-on-ink that a person
// would catch, or white-on-ink that passes. So this checks the one assumption
// the forced-colors block rests on, which is the way that block breaks. A
// presence check on the block itself would not (decision #113).
//
// Text is anything left after removing child tags, comments and template
// statements; a `{{ … }}` expression counts, because it renders as text.
function ruleInkMarksHoldNoText(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      if (!node.classes.includes("bg-ink")) continue;
      const inner = html
        .slice(node.contentStart, node.contentEnd)
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\{%[\s\S]*?%\}/g, "")
        .replace(/<[^>]*>/g, "")
        .trim();
      if (!inner) continue;
      found.push({
        file: rel,
        line: lineOf(html, node.index),
        detail: `<${node.tag}> with bg-ink holds text ("${inner.slice(0, 30)}") — forced colours paints this ground CanvasText, the same colour as the text on it`,
      });
    }
  }
  return found;
}

module.exports = ruleInkMarksHoldNoText;
