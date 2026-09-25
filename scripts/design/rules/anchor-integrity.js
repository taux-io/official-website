const { PAGES, DOCUMENTS } = require("../../routes");
const { templateKey, reachable } = require("../lib");

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
//   `/path#frag`  against the page `path` names. Cross-page links do not depend
//                 on where they were written, so they are checked once rather
//                 than once per page that includes them.
//
// Anything carrying a scheme or an authority belongs to another origin and its
// fragment is not ours to resolve. A bare `href="#"` is a deliberate no-op, not
// a reference to an element.
function ruleAnchorIntegrity(files) {
  const found = [];
  const byName = new Map(files.map((f) => [templateKey(f.rel), f]));

  const templateFor = new Map(PAGES.map((p) => [p.path, p.template]));

  // Cross-page links carry the render's locale as a placeholder, because the
  // templates are shared and the prefix is not (`locale relative links`). What
  // this rule resolves against is the route's identity, which is what remains
  // once the placeholder comes off: `/{{ locale }}/geo-guide` is `/geo-guide`,
  // and a bare `/{{ locale }}` is the home page.
  //
  // Stripping it here rather than teaching every caller means the two rules
  // cannot disagree about what an internal link looks like.
  const routeIdentity = (href) => {
    const bare = href.replace(/^\/\{\{\s*locale\s*\}\}/, "");
    return bare === "" ? "/" : bare;
  };

  const idCache = new Map();
  const idsOf = (template) => {
    if (!idCache.has(template)) idCache.set(template, reachable(template, byName).ids);
    return idCache.get(template);
  };

  // Rendered documents (the error page) carry the same header and footer, so
  // they are walked too — but they are not routes, so nothing can link to them.
  const rendered = [
    ...PAGES.map((p) => ({ template: p.template, where: p.path })),
    ...DOCUMENTS.map((d) => ({ template: d.template, where: d.servedPath })),
  ];

  const crossPage = new Map();

  for (const { template, where } of rendered) {
    for (const { file, line, href } of reachable(template, byName).hrefs) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;

      const cut = href.indexOf("#");
      const target = href.slice(0, cut);
      const frag = href.slice(cut + 1);
      if (!frag) continue;

      if (!target) {
        if (!idsOf(template).has(frag)) {
          found.push({
            file,
            line,
            detail: `#${frag} does not resolve on ${where}`,
          });
        }
        continue;
      }

      // Deduped: the same cross-page link written in a partial reaches every
      // page, but its correctness has nothing to do with which page it is on.
      crossPage.set(`${file}:${line}:${href}`, { file, line, target, frag });
    }
  }

  for (const { file, line, target, frag } of crossPage.values()) {
    const template = templateFor.get(routeIdentity(target));
    if (!template) {
      found.push({ file, line, detail: `${target}#${frag} — no page declares ${target}` });
      continue;
    }
    if (!idsOf(template).has(frag)) {
      found.push({ file, line, detail: `${target}#${frag} — ${target} declares no such id` });
    }
  }

  return found;
}

module.exports = ruleAnchorIntegrity;
