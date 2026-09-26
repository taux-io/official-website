const { PAGES } = require("../../routes");
const { locate, markup, dedupe } = require("../rendered");

// A fragment link that resolves to nothing fails in the one way nobody sees:
// the page renders, the link is clickable, and it simply does not move. Rename
// a section id and every index and table of contents pointing at it dies
// silently — which is the failure the section index and the mobile overview
// table on the guides would otherwise be one careless edit away from.
//
// Two kinds of link, resolved differently:
//
//   `#frag`       against the page it is written on. A link in the footer is
//                 therefore checked against every page, because that is where
//                 it ends up, and it has to resolve on all of them.
//   `/path#frag`  against the page `path` names — the built page for that URL,
//                 so `/ja-JP/geo-guide#x` is checked against the Japanese page's
//                 ids, not against whichever template the route declares first.
//
// Anything carrying a scheme or an authority belongs to another origin and its
// fragment is not ours to resolve. A bare `href="#"` is a deliberate no-op, not
// a reference to an element.
// READS THE BUILT PAGES (scripts/design/rendered.js). It resolved ids by
// following `{% include %}` through template source, so an id a macro or a base
// layout supplied was invisible to it — measured as a false "does not resolve"
// in the 2026-09 evaluation. The built page has every id the reader gets.
//
// Rendered documents (the error page) carry the same header and footer, so they
// are walked too — but they are not routes, so nothing can link to them.
function ruleAnchorIntegrity(files, { rendered }) {
  const found = [];
  const pages = rendered();
  const idsOf = new Map(
    pages.map((p) => [p, new Set([...markup(p).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))])
  );
  const byUrl = new Map(pages.filter((p) => PAGES.some((r) => r.url === p.url)).map((p) => [p.url, p]));

  for (const page of pages) {
    const html = markup(page);
    for (const m of html.matchAll(/\shref="([^"]*)"/g)) {
      const href = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;
      const cut = href.indexOf("#");
      if (cut === -1) continue;
      const target = href.slice(0, cut);
      const frag = href.slice(cut + 1);
      if (!frag) continue;
      const at = () => locate(page, `href="${href}"`, m.index + 1);

      if (!target) {
        if (!idsOf.get(page).has(frag)) {
          found.push({ ...at(), detail: `#${frag} does not resolve on ${page.url}` });
        }
        continue;
      }
      const dest = byUrl.get(target);
      if (!dest) {
        found.push({ ...at(), detail: `${target}#${frag} — no page serves ${target}` });
        continue;
      }
      if (!idsOf.get(dest).has(frag)) {
        found.push({ ...at(), detail: `${target}#${frag} — ${target} declares no such id` });
      }
    }
  }
  return dedupe(found);
}

module.exports = ruleAnchorIntegrity;
