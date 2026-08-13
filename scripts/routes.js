// The site's route table, read from site.toml.
//
// There used to be two lists — a hand-maintained one for the visual tooling and
// a regex over Go handler source for the share cards. The regex depended on
// field order, so reordering a struct literal would have mismatched pages
// silently. Both are gone: the pages are declared once, in a data file, parsed
// by a real parser in both languages, so neither reads the other's source.
//
// Adding a page to site.toml is enough for the generator, the contract test,
// the contrast audit and the share-card builder to pick it up.

const fs = require("fs");
const path = require("path");
const { parse } = require("smol-toml");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://taux.io";

// ONE PARSE. This file used to parse site.toml twice — once for the pages and
// once for the redirects — and four other scripts parsed it again for
// themselves, so "what is a page" had five definitions. They did not go around
// this module out of laziness: it DROPPED the fields they needed. `template`,
// `date_modified`, `date_published` and `noindex` never appeared in a route
// object, and [[document]] was excluded outright. A seam that narrows the data
// is a seam people have to go around.
const SITE = parse(fs.readFileSync(path.join(ROOT, "site.toml"), "utf8"));

// There used to be 502 and 503 documents here, served by nginx-proxy from its
// own volume when the origin was unreachable. Static hosting has no origin that
// can be unreachable, so nothing serves them. The empty array that stood here as
// "the seam a host-served document would attach to" is gone too — DOCUMENTS
// below is that seam now, and it has a member.

function readRoutes() {
  return PAGES.map((p) => {
    // The share card's filename and the generator's og_image derive the same
    // slug from the canonical URL. Deriving it here too keeps all three in step.
    const slug = p.canonical.replace(ORIGIN, "").replace(/^\/|\/$/g, "") || "index";
    return {
      // The URL, not the route identity. An auditor fetches this.
      path: p.url,
      name: slug,
      title: p.title,
      description: p.description,
      canonical: p.canonical,
      // Every declared page is a page; the error document is not a route and is
      // not listed here. An unmatched path answering 404 is asserted separately,
      // since that is the behaviour that matters and the one a static host most
      // often gets wrong.
      expectedStatus: 200,
      isError: false,
      standalone: false,
    };
  });
}

// Paths that used to be routes. The generator emits _redirects from this same
// table, so what the contract test asserts and what the host serves come from
// one declaration rather than two that agree until someone edits one.
//
// This is the half that makes a retired path safe. Without an assertion a
// redirect can stop working and the only symptom is an old URL answering 404 —
// invisible to everyone except the people following links that used to work.
function readRedirects() {
  return (SITE.redirect || []).map((r) => ({
    from: r.from,
    to: r.to,
    status: r.status ?? 301,
  }));
}

// The declared surface, unedited, FLATTENED ACROSS LOCALES. Every field
// site.toml carries reaches the caller — template, both date fields, noindex —
// because the callers that need them are the reason this export exists.
//
// site.toml became two-dimensional: a route declares its path, template and
// dates once, and each locale under it supplies title, description and
// canonical. Flattening here rather than exposing the nesting is deliberate.
// Every caller — check:llms, check:entity, check:dates, the contract test, the
// contrast audit, the share-card builder — wants one entry per thing it has to
// visit, and a page in two languages is two things to visit. Handing them the
// nested shape would make each of them write the same loop, which is how this
// module came to exist: "what is a page" had five definitions.
//
// The note above about a seam that narrows the data applies in the other
// direction too, so `locale` rides along. A caller that needs to know which
// language it is looking at should not have to parse it back out of the URL.

// THE SERVED PATH IS THE CANONICAL'S PATH, NOT `page.path`.
//
// Those were the same string until decision #58 gave every route a locale
// prefix. Now `page.path` is the route's identity — the thing that is the same
// in every language — and the URL a visitor or a crawler actually asks for is
// `/<locale><path>`, which is exactly what the canonical already spells out.
//
// Reading `page.path` here after the move would have been quiet rather than
// loud: the contract test would fetch `/geo-guide`, get the 301 it now answers
// with, and report a route that no longer exists as healthy. `check:routes`
// would compare its ledger against route identities instead of URLs and report
// that nothing was retired — on the change that retired all twenty.
const servedPath = (canonical) => canonical.replace(ORIGIN, "") || "/";

// THREE THINGS THAT USED TO BE ONE STRING, EACH NAMED.
//
// Before locales, `path` was the route's identity, the URL it was served at and
// (bar a suffix) the file it landed in. Decision #58 split them apart, and the
// dangerous version of this change is the one that keeps calling all three
// `path` and lets each caller mean whatever it meant before:
//
//   path — the route's identity. `/geo-guide`. The same in every language, and
//          the key you match a translation against.
//   url  — what a visitor or crawler asks for. `/zh-Hant-TW/geo-guide`.
//   file — where it lands in dist/. `zh-Hant-TW/geo-guide.html`.
//
// `file` mirrors Page::output_path in the generator, including the locale home
// being a flat `<locale>.html` rather than a directory index — measured against
// the host, see that function's comment for the two layouts and their hops.
const localeFile = (route, tag) => {
  if (route.path === "/") return `${tag}.html`;
  if (route.path.endsWith(".html")) return route.path.replace(/^\//, "");
  return `${tag}/${route.path.replace(/^\//, "")}.html`;
};

const PAGES = (SITE.page || []).flatMap((p) => {
  const { locale, ...route } = p;
  return Object.entries(locale || {}).map(([tag, text]) => ({
    ...route,
    ...text,
    locale: tag,
    url: servedPath(text.canonical),
    file: localeFile(route, tag),
  }));
});

// [[document]] entries are not routes: they have no `path`, they are the body a
// static host serves for an unmatched URL. What they do have is a served path,
// derived here from `output` so that "where does 404 live" has one definition
// rather than a literal in walk.js and two more spelled `404.html`.
const DOCUMENTS = (SITE.document || []).map((d) => ({
  ...d,
  servedPath: "/" + String(d.output).replace(/\.html$/, "").replace(/^index$/, ""),
}));

const REDIRECTS = readRedirects();

// The audit view: pages only, with the status an auditor should expect.
//
// Documents stay out on purpose. Every declared page is a page; the error
// document is not a route. An unmatched path answering 404 is asserted
// separately, since that is the behaviour that matters and the one a static host
// most often gets wrong.
const ROUTES = readRoutes();
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8099";

module.exports = { ROUTES, PAGES, DOCUMENTS, REDIRECTS, VIEWPORTS, BASE_URL, ORIGIN };
