const fs = require("fs");
const path = require("path");
const { ROOT, lineOf } = require("../lib");

// RULE 33 — theme colour agrees.
//
// The browser address bar on a phone is coloured from <meta name="theme-color">;
// an installed PWA reads `theme_color` from the manifest instead. Two consumers,
// two places, and the site needs both — so this is not duplication, it is a pair
// that can drift.
//
// PRESENCE IS NOT THE RISK HERE, AND THAT IS WHY THIS IS A SEPARATE RULE from
// `declared surfaces`. The manifest already carried a theme colour through two
// brand resets — #000000, from the black era, live in production and read by
// every Android install (decision #99). It was declared the whole time. What it
// was not, was equal to the surface. Checking that something is declared would
// have called that clean.
function ruleThemeColourAgrees(files) {
  const manifest = path.join(ROOT, "public", "site.webmanifest");
  if (!fs.existsSync(manifest)) return [];
  let declared;
  try {
    declared = JSON.parse(fs.readFileSync(manifest, "utf8")).theme_color;
  } catch (err) {
    return [{ file: path.join("public", "site.webmanifest"), line: 1, detail: `will not parse: ${err.message}` }];
  }
  if (!declared) return [];

  const found = [];
  let seen = 0;
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<meta[^>]*name="theme-color"[^>]*>/g)) {
      seen++;
      const content = /content="([^"]*)"/.exec(m[0]);
      const value = content ? content[1].trim() : "";
      if (value.toLowerCase() === String(declared).trim().toLowerCase()) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: `theme-color is ${value || "(empty)"} but the manifest says ${declared} — the address bar and the installed app would paint different surfaces`,
      });
    }
  }
  if (!seen) {
    found.push({
      file: path.join("templates", "header.html"),
      line: 1,
      detail: `no <meta name="theme-color"> anywhere, so a phone browser colours its address bar itself — the manifest's ${declared} only applies once the site is installed`,
    });
  }
  return found;
}

module.exports = ruleThemeColourAgrees;
