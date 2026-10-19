const { lineOf } = require("../lib");

// Photography and video are the only decorative depth this vocabulary admits,
// and the site has neither. What it had instead were twenty-five canvases
// drawing the tau curve. The rule is existence, not usage: a canvas with no
// script behind it is still a canvas the next change will find a use for.
//
// ONE EXEMPTION, decided by the owner (DESIGN.md decision 181, replaced by 182): the home
// hero's rock-ridge background, `<canvas data-home-rock>`, and only in a home page
// (templates/index.html and templates/<locale>/index.html). It is named by
// attribute AND by file so a second canvas anywhere else is still a finding —
// the exemption is a single element, not a category.
//
// The earlier exemption — the jailbreak chart on what-is-prompt-injection, drawn
// by Chart.js — is an SVG rendered at build time (templates/_jailbreak-chart.html).

const HOME_PAGE = /^templates[\\/](?:[A-Za-z-]+[\\/])?index\.html$/;

function ruleZeroCanvas(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<canvas\b([^>]*)>/g)) {
      if (HOME_PAGE.test(rel) && /\bdata-home-rock\b/.test(m[1])) continue;
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
