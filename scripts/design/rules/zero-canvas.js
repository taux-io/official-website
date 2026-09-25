const { lineOf } = require("../lib");

// Photography and video are the only decorative depth this vocabulary admits,
// and the site has neither. What it had instead were twenty-five canvases
// drawing the tau curve. The rule is existence, not usage: a canvas with no
// script behind it is still a canvas the next change will find a use for.
//
// NO EXEMPTIONS. The one there was — the jailbreak chart on
// what-is-prompt-injection, drawn by Chart.js — is now an SVG rendered at build
// time (templates/_jailbreak-chart.html), so every <canvas> is a finding.

function ruleZeroCanvas(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<canvas\b([^>]*)>/g)) {
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: "canvas — decorative depth is photography, and this site ships none",
      });
    }
  }
  return found;
}

module.exports = ruleZeroCanvas;
