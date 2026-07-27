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

// Served by nginx-proxy from its own volume when the origin is unreachable, so
// they are never part of the generated site. They are still pages a visitor can
// be shown, so the audits cover them; the contract test knows not to expect the
// host's headers on them.
const STANDALONE = [
  { path: "/static/502.html", name: "502", standalone: true, isError: true, expectedStatus: 200 },
  { path: "/static/503.html", name: "503", standalone: true, isError: true, expectedStatus: 200 },
];

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

const ROUTES = [...readRoutes(), ...STANDALONE];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8099";

module.exports = { ROUTES, VIEWPORTS, BASE_URL, ORIGIN };
