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
      // Which language this row is, so an auditor can assert the page agrees.
      locale: p.locale,
      // Whether the page refuses indexing. Carried here because the Markdown
      // twin is conditional on it — a noindex page gets none, since Markdown
      // has nowhere to repeat the directive — and `check:md` would otherwise
      // report the missing twin as a defect. Nothing sets the flag today; the
      // field exists so that the day something does, one edit is enough.
      //
      // This module's own argument, at the top: a seam that narrows the data is
      // a seam people have to go around.
      noindex: p.noindex === true,
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
    // A language may override the route's template, because translated prose
    // cannot live in the same file as the original. Spreading `text` after
    // `route` already does this; naming it is what stops the next reader from
    // deleting the ordering as incidental.
    template: text.template || route.template,
    locale: tag,
    url: servedPath(text.canonical),
    file: localeFile(route, tag),
  }));
});

// The published languages, in the order the switcher shows them.
//
// `script` says which writing system the locale uses, and three checks read it
// rather than guessing from the tag: whether an h1 needs a sub-line under its
// Latin lead, what script a title has to contain, and how many characters fit
// on a line. Guessing would hold until ja-JP, whose kanji are Han and whose
// kana are not.
const LOCALES = (SITE.locale || []).map((l) => ({ ...l }));

// Writing systems that carry capital letters, so a Latin display lead is the
// content rather than a signature over it (decision #56).
const LATIN_SCRIPTS = new Set(["Latn", "Latin"]);
const isLatin = (tag) => {
  const l = LOCALES.find((x) => x.tag === tag);
  return !!l && LATIN_SCRIPTS.has(l.script);
};

// The reading measure, per writing system. DESIGN.md holds the table and says
// which of these were measured.
//
// `Kore` WAS 60, ON A REASON THAT TURNED OUT TO BE FALSE. The note read
// "hangul is wider"; measured, a hangul syllable is 20.77px against a kanji's
// 24px in the same size — it is NARROWER. At 68ch a Korean line holds about 48
// syllables, inside the convention it was meant to respect.
//
// It was not a harmless spare margin either. These pages carry English legal
// text in every locale (a deliberate decision — see the note in the templates),
// and the probe takes its limit from `html[lang]`, so English paragraphs that
// pass on all four other locales failed on this one at 61.3ch. A limit that
// fires on prose it was never about is not caution, it is a false positive.
// `Latn` WAS 75, AND IT WAS UNFALSIFIABLE. Measured across all 101 routes at
// the widest viewport (2,818 elements, the same `width:1ch` probe the gate
// uses): the widest en-US paragraph on the site is 68.11ch. Not 75 — 68.11.
// Reaching 75 would take 566px of width where `src/input.css` permits 514px,
// so no English page could ever fire this limit. A threshold that cannot fail
// is not a loose threshold, it is a decoration.
//
// THE REASON EVERY SCRIPT LANDS ON THE SAME NUMBER, which is the part worth
// keeping: `src/input.css`'s `:where(main p, main li) { max-width: 68ch }` is
// unconditional, and `tailwind.config.js`'s `prose` is 68ch too. 0 of 2,818
// measured elements carry a wider cap. So the ceiling is a stylesheet constant,
// not a property of any writing system — which is why all five maxima come out
// within 0.07ch of each other and all five medians are identical at 63.55ch.
// A per-script table cannot be justified from that data, and one that varies
// invites the reader to believe it was derived per script.
//
// ⚠️ WHAT THIS PROBE ACTUALLY GUARDS, stated because the table above reads like
// the other thing: it can detect the 68ch rule being removed or widened, or a
// new element escaping it. It CANNOT detect "this line is too long to read
// comfortably" — the site never lets a paragraph get wide enough to answer
// that question. For ja-JP and en-US the comfortable measure remains genuinely
// unmeasured. The 0.04–0.11ch of apparent excess is the engine's `68ch` and the
// probe's `1ch × 68` disagreeing in the last quantisation step, which is what
// MEASURE_TOLERANCE_CH exists to absorb.
const MEASURE_CH = { Hant: 68, Hans: 68, Latn: 68, Jpan: 68, Kore: 68 };
const measureFor = (tag) => {
  const l = LOCALES.find((x) => x.tag === tag);
  return (l && MEASURE_CH[l.script]) || 68;
};

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

module.exports = {
  ROUTES,
  PAGES,
  DOCUMENTS,
  REDIRECTS,
  LOCALES,
  VIEWPORTS,
  BASE_URL,
  ORIGIN,
  isLatin,
  measureFor,
};
