const stylesheet = require("../../stylesheet");
const { lineOf } = require("../lib");

// The stylesheet's cache-busting query must be computed, never written.
//
// It was a literal — `?v=25` — from the Go-to-Rust migration until PR 145, and
// it never moved again: not for a palette change, not for the type scale, not
// for two changes that shipped the same afternoon. `_headers` caches
// /static/css/* for an hour, so a returning visitor got new markup styled by
// the stylesheet they already had. When the markup introduced new utility
// classes, the elements wearing them fell back to nothing — a nav reading
// `hidden sm:flex` against a stylesheet with no `sm:flex` is hidden at every
// width.
//
// The generator now derives the query from the stylesheet's bytes, which makes
// the failure impossible rather than merely discouraged. This rule exists to
// keep it that way: the next person to touch this line will be tempted to
// "simplify" it back to a literal, and a literal is silently wrong from the
// first stylesheet change after it.
const STYLESHEET_LINK = /<link[^>]*rel="stylesheet"[^>]*>/g;

function ruleCssVersionIsDerived(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(STYLESHEET_LINK)) {
      const tag = m[0];
      if (!/styles\.min\.css/.test(tag)) continue;
      if (tag.includes("{{ css_version }}")) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: /\?v=/.test(tag)
          ? "stylesheet cache-buster is a literal; it must be {{ css_version }} so it cannot lag the file"
          : "stylesheet link carries no cache-buster; it must be ?v={{ css_version }}",
      });
    }
  }
  return found;
}

module.exports = ruleCssVersionIsDerived;
