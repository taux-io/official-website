const stylesheet = require("../../stylesheet");
const { lineOf } = require("../lib");

// The one hole the stylesheet module cannot close for itself.
//
// It reads every template, so a new <style> block or style="" attribute comes
// under the check the moment it is written. A new stylesheet FILE does not:
// <link rel="stylesheet" href="/static/css/deck.css"> would ship CSS that no
// rule sees and nothing would go red, which is exactly the shape of the blind
// spot this whole module exists to remove.
//
// One link, and it is the built one.
function ruleSingleStylesheet(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)) {
      const href = /href="([^"]*)"/.exec(m[0]);
      const target = href ? href[1] : "(no href)";
      if (/^\/static\/css\/styles\.min\.css(\?|$)/.test(target)) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: `${target} — the only stylesheet is the built one; CSS in a second file is outside every rule's view`,
      });
    }
  }
  return found;
}

module.exports = ruleSingleStylesheet;
