const { PAGES } = require("../../routes");
const { lineOf } = require("../lib");

// An internal link that names a declared route must carry the locale.
//
// THE TEMPLATES ARE SHARED AND THE PREFIX IS NOT. header.html is one file
// rendered once per language, so `href="/geo-guide"` in it does two wrong
// things at once: it costs a 301 for every reader, and once a second locale
// exists it sends an English reader to the Chinese page. The second failure is
// silent — the link works, the page loads, it is simply the wrong language, and
// no gate that checks status codes can see it.
//
// Forty-eight links were in this state the moment decision #58 landed. They
// were rewritten to `/{{ locale }}/...`; this is what stops the forty-ninth.
//
// Only paths that name a declared route are checked. `/static/...`, `/404`,
// fragments, `mailto:` and anything with a scheme are somewhere else's problem
// — and a link to another origin is not ours to prefix.
function ruleLocaleRelativeLinks(files) {
  const found = [];
  const routeIds = new Set(PAGES.map((p) => p.path).filter((p) => p !== "/"));

  for (const { rel, html } of files) {
    for (const m of html.matchAll(/href="([^"]*)"/g)) {
      const href = m[1];
      if (!href.startsWith("/")) continue;
      if (href.startsWith("/{{")) continue;
      const bare = href.split(/[#?]/)[0].replace(/\/$/, "");
      if (bare !== "" && !routeIds.has(bare)) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail:
          `href="${href}" names a route without the render's locale — ` +
          `write /{{ locale }}${bare} so the shared template follows the page it is rendered into`,
      });
    }
  }
  return found;
}

module.exports = ruleLocaleRelativeLinks;
