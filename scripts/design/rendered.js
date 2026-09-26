// The pages as the generator wrote them, for the rules that must not go blind.
//
// WHY THESE RULES READ dist/ AND NOT templates/. Four rules ask questions that
// only the assembled page can answer — does every section h2 open a cover, do
// the tags nest, does every fragment link resolve, does the h1 carry its lead
// and sub. They used to answer from template source, following
// `{% include %}` by hand. The 2026-09 evaluation of macros and a base layout
// (NOTES, 「模板結構大改」) measured what that costs: a macro that drops
// `data-cover`, a macro that leaves a `<div>` open, and a `_base.html` missing
// its `</main>` were all green. Source analysis has to re-implement Jinja to see
// through macros, `import` and `extends`; the built page already did it.
//
// SO FINDINGS POINT AT dist/, AND THEN AT A TEMPLATE WHEN ONE CAN BE FOUND.
// `locate()` searches the page's own template and everything it includes,
// imports or extends for the literal text of the offending tag. Found exactly
// once, that file and line is reported; otherwise the dist line is, which is
// always right and is the honest answer for markup a macro produced.

const fs = require("fs");
const path = require("path");
const { PAGES, DOCUMENTS } = require("../routes");
const { walk } = require("../lib/fs");
const { ROOT, TEMPLATES, lineOf } = require("./lib");

const DIST = path.join(ROOT, "dist");

// `include`, `import`, `from … import` and `extends` all name another template.
const REFERENCE = /\{%-?\s*(?:include|import|from|extends)\s*"([^"]+)"/g;

function sourcesOf(template, seen = new Set()) {
  if (seen.has(template)) return seen;
  const file = path.join(TEMPLATES, template);
  if (!fs.existsSync(file)) return seen;
  seen.add(template);
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(REFERENCE)) sourcesOf(m[1], seen);
  return seen;
}

// A dist/ older than the templates would let every rule here report on a page
// nobody is looking at any more — green on the last build rather than on this
// one. Refused rather than warned about, for the reason the rest of this repo
// refuses a half-built dist/.
function assertFresh() {
  if (!fs.existsSync(DIST)) {
    throw new Error("dist/ is missing — run npm run build:site before check:design");
  }
  const built = Math.min(
    ...[...PAGES.map((p) => p.file), ...DOCUMENTS.map((d) => d.output)].map((rel) => {
      const f = path.join(DIST, rel);
      if (!fs.existsSync(f)) throw new Error(`dist/${rel} is missing — run npm run build:site`);
      return fs.statSync(f).mtimeMs;
    })
  );
  const inputs = [...walk(TEMPLATES, ".html"), path.join(ROOT, "site.toml")];
  const newer = inputs.filter((f) => fs.statSync(f).mtimeMs > built);
  if (newer.length) {
    throw new Error(
      `dist/ is older than ${path.relative(ROOT, newer[0])}` +
        (newer.length > 1 ? ` and ${newer.length - 1} more` : "") +
        " — run npm run build:site before check:design"
    );
  }
}

let cache = null;

// Every built page and document: its dist path, its HTML, the route it serves,
// its locale, and the templates it was made from (for `locate`).
function renderedPages() {
  if (cache) return cache;
  assertFresh();
  const rows = [
    ...PAGES.map((p) => ({ rel: p.file, url: p.url, locale: p.locale, template: p.template })),
    ...DOCUMENTS.map((d) => ({ rel: d.output, url: d.servedPath, locale: null, template: d.template })),
  ];
  cache = rows.map((r) => ({
    ...r,
    dist: path.join("dist", r.rel),
    html: fs.readFileSync(path.join(DIST, r.rel), "utf8"),
    sources: [...sourcesOf(r.template)].map((t) => path.join("templates", t)),
  }));
  return cache;
}

// Where a finding should point. `needles` is literal text from the built page,
// most specific first — an element's whole outer HTML, then its opening tag.
// Each is searched in the page's sources as written and with the locale put
// back as `{{ locale }}`, since templates never spell it; the first needle that
// occurs exactly once wins. Otherwise the dist line, which is always right.
function locate(page, needles, offset) {
  for (const needle of [].concat(needles)) {
    if (!needle) continue;
    const variants = new Set([needle]);
    if (page.locale) variants.add(needle.split(`/${page.locale}`).join("/{{ locale }}"));
    const hits = [];
    for (const rel of page.sources) {
      const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
      for (const v of variants) {
        let at = text.indexOf(v);
        while (at !== -1) {
          hits.push({ file: rel, line: lineOf(text, at) });
          at = text.indexOf(v, at + 1);
        }
      }
    }
    if (hits.length === 1) return hits[0];
  }
  return { file: page.dist, line: lineOf(page.html, offset) };
}

// An element's outer HTML in the built page, when it is short enough to be a
// useful search needle; null otherwise.
function outerOf(page, node) {
  if (node.contentEnd === null) return null;
  const close = page.html.indexOf(">", node.contentEnd);
  if (close === -1 || close - node.index > 400) return null;
  return page.html.slice(node.index, close + 1);
}

// The page with comments, scripts and styles blanked to spaces: same length,
// so every offset and line still lines up with `html`, and nothing inside a
// JSON-LD block (whose FAQ answers quote `<fixed-point>`) parses as a tag.
function markup(page) {
  if (page.markup === undefined) {
    const blank = (m) => m.replace(/[^\n]/g, " ");
    page.markup = page.html
      .replace(/<!--[\s\S]*?-->/g, blank)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, blank);
  }
  return page.markup;
}

// One finding per place: a shared partial located in its own file would
// otherwise be reported once for each of the hundred pages that include it.
function dedupe(found) {
  const seen = new Set();
  return found.filter((f) => {
    const key = `${f.file}:${f.line}:${f.detail.replace(/ \(on [^)]*\)$/, "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { renderedPages, locate, outerOf, sourcesOf, markup, dedupe };
