const fs = require("fs");
const path = require("path");
const stylesheet = require("../../stylesheet");
const { ROOT, lineOf, parseElements } = require("../lib");

// The reference site's typographic system has no monospace at all, and the three
// faces this site carried for it (Roboto Mono, its box-drawing subset, Departure
// Mono) go with it. Both halves are checked: a template still writing the
// utility, and a config still defining the family for it to resolve against.
// Checking only the templates would leave the families sitting there for the
// next person to reach for.
function ruleZeroMono(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        if (!/^(?:[a-z]+:)*font-(?:mono|pixel)$/.test(c)) continue;
        found.push({
          file: rel,
          line: lineOf(html, node.index),
          detail: `${c} — the vocabulary has no monospace face for it to resolve to`,
        });
      }
    }
  }
  const config = path.join(ROOT, "tailwind.config.js");
  if (fs.existsSync(config)) {
    const text = fs.readFileSync(config, "utf8");
    for (const family of ["mono", "pixel"]) {
      const m = new RegExp(`^\\s{6,}${family}:\\s*\\[`, "m").exec(text);
      if (!m) continue;
      found.push({
        file: "tailwind.config.js",
        line: lineOf(text, m.index),
        detail: `this project defines fontFamily.${family}; the vocabulary has no monospace`,
      });
    }
    // WHAT THIS HALF CANNOT SAY. The families were removed from `theme.extend`,
    // and extend only adds — Tailwind's own default `mono` survives underneath,
    // so `font-mono` still resolves to a real stack. Deleting the project's
    // definition does not delete the utility, and an earlier version of this
    // rule claimed it did. What actually keeps monospace off the site is the
    // template half above plus the @apply scan below; this half only stops the
    // project from declaring a family of its own again.
  }
  // A component class applying the utility reaches the same face by another
  // road, and it is the road this site actually used: `.eyebrow` carried
  // `@apply font-mono` for 202 elements while no template said so. Reading only
  // the templates would have called that clean.
  const sheet = stylesheet.read();
  for (const a of sheet.applied) {
    const m = /^font-(mono|pixel)$/.exec(a.utility);
    if (!m) continue;
    found.push({
      file: a.file,
      line: a.line,
      detail: `${a.selector} applies font-${m[1]} — a component class reaches the removed family too`,
    });
  }

  // THE OTHER ROAD TO A MONOSPACE FACE, and the one this rule was blind to by
  // design rather than by accident: a raw `font-family` declaration. It never
  // looked at declarations at all — only class strings, the Tailwind config and
  // @apply — so two `font-family: monospace` rules in a template's own <style>
  // block survived the removal of the monospace vocabulary and kept DESIGN.md
  // decision #40's MingLiU trap open on the route with the most code content.
  //
  // The generic family is what is banned, not the word. A stack ending in
  // `monospace` puts CJK on whatever the platform calls generic monospace, which
  // on Windows is MingLiU — a serif this site sets nowhere else, and invisible
  // from a Mac.
  for (const d of sheet.declarations) {
    if (d.prop !== "font-family") continue;
    if (!/(^|,)\s*monospace\s*$/.test(d.value)) continue;
    found.push({
      file: d.file,
      line: d.line,
      detail: `${d.selector} falls through to generic monospace — no CJK face answers it, so Chinese lands on MingLiU on Windows`,
    });
  }
  return found;
}

module.exports = ruleZeroMono;
