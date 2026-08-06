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

// There used to be 502 and 503 documents here, served by nginx-proxy from its
// own volume when the origin was unreachable. Static hosting has no origin that
// can be unreachable, so nothing serves them and the audits were walking two
// pages no visitor could ever be shown. They are gone; this list is kept because
// it is the seam a genuinely host-served document would attach to.
const STANDALONE = [];

function readRoutes() {
  const site = parse(fs.readFileSync(path.join(ROOT, "site.toml"), "utf8"));
  return (site.page || []).map((p) => {
    // The share card's filename and the generator's og_image derive the same
    // slug from the canonical URL. Deriving it here too keeps all three in step.
    const slug = p.canonical.replace(ORIGIN, "").replace(/^\/|\/$/g, "") || "index";
    return {
      path: p.path,
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
  const site = parse(fs.readFileSync(path.join(ROOT, "site.toml"), "utf8"));
  return (site.redirect || []).map((r) => ({
    from: r.from,
    to: r.to,
    status: r.status ?? 301,
  }));
}

// The error documents, which are rendered like pages but are not routes.
//
// They are exported separately rather than folded into ROUTES, because every
// assertion in the contract expects a route to answer 200 at its own path and
// this one answers 404 at every path but its own. Kept in the table all the
// same: it goes through the same renderer and the same shared header as a page,
// so it inherits the same defects, and it was the one rendered document nothing
// looked at — a check that skips the only page served on every wrong URL is
// checking the easy half.
function readErrorDocuments() {
  const site = parse(fs.readFileSync(path.join(ROOT, "site.toml"), "utf8"));
  return (site.document || []).map((d) => ({
    output: d.output,
    title: d.title,
    description: d.description,
    canonical: d.canonical,
  }));
}

const REDIRECTS = readRedirects();
const ERROR_DOCUMENTS = readErrorDocuments();

const ROUTES = [...readRoutes(), ...STANDALONE];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8099";

module.exports = { ROUTES, REDIRECTS, ERROR_DOCUMENTS, VIEWPORTS, BASE_URL, ORIGIN };
