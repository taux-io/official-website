const { lineOf } = require("../lib");

function ruleCollapsibleShipsOpen(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*\bdata-panel="[^"]*"[^>]*>/g)) {
      if (!/\bhidden\b/.test(m[0])) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: "data-panel ships hidden; the script must be what collapses it, not the markup",
      });
    }
  }
  return found;
}

module.exports = ruleCollapsibleShipsOpen;
