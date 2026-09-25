const { OPACITY_EXEMPT_IDS, lineOf } = require("../lib");

// Whatever is exempted from the scroll-reveal rule owes something in return.
//
// OPACITY_EXEMPT_IDS lets an element rest at opacity-0 because a click, not a
// scroll position, reveals it. That exemption is about the eyes. It says
// nothing about the keyboard, and the menu overlay proved the gap: opacity-0
// plus pointer-events-none hid it from sight and from the mouse while leaving
// twenty links in the tab order, so tabbing past the navigation walked into
// twenty stops on a menu that was not on screen and drew no focus ring.
//
// So the exemption now carries an obligation, expressed against the same list
// rather than a second one: an element allowed to rest invisible must also
// ship inert, and the script that reveals it is what lifts that. Binding both
// to OPACITY_EXEMPT_IDS is the point — a future exemption cannot be granted
// without inheriting the duty.
//
// Inert in the markup rather than applied on load also points the failure the
// right way: if the script never runs the overlay cannot open, and an
// unopenable menu should not be collecting focus.
function ruleInvisibleIsInert(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*\bid="([^"]*)"[^>]*>/g)) {
      if (!OPACITY_EXEMPT_IDS.has(m[1])) continue;
      if (/\binert\b/.test(m[0])) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: `#${m[1]} rests invisible but ships focusable; it must carry inert for the script to lift`,
      });
    }
  }
  return found;
}

module.exports = ruleInvisibleIsInert;
