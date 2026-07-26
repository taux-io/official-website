// The site's route table, read from main.go.
//
// There used to be two lists: a hand-maintained one for the visual tooling and
// a parsed one inside the share-card generator. Adding a page meant remembering
// to update the first, and forgetting was invisible — the new page simply went
// unaudited. The same class of divergence already produced a share tag pointing
// at an image that was never generated.
//
// main.go registers the routes, so main.go is where they are read from. Adding
// a page there is now enough for the audits, the contract test and the share
// cards to pick it up.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://taux.io";

// Each handler declares its page data in the same shape. Anything that does not
// carry a Title/Description/Canonical is not a page — health checks, static
// file handlers — and is skipped by the pattern rather than by a list.
const HANDLER = new RegExp(
  String.raw`r\.GET\("([^"]+)",` +
    String.raw`[\s\S]*?Title:\s*"([^"]*)"` +
    String.raw`[\s\S]*?Description:\s*"([^"]*)"` +
    String.raw`[\s\S]*?Canonical:\s*"([^"]*)"`,
  "g"
);

// Served by nginx-proxy from its own volume when the backend is down, so they
// never appear in main.go. They are still pages a visitor can be shown, so the
// audits cover them; the contract test knows to expect no app-set headers.
const STANDALONE = [
  { path: "/static/502.html", name: "502", standalone: true },
  { path: "/static/503.html", name: "503", standalone: true },
];

function readRoutes() {
  const go = fs.readFileSync(path.join(ROOT, "main.go"), "utf8");
  const out = [];
  let m;
  while ((m = HANDLER.exec(go))) {
    const [, route, title, description, canonical] = m;
    // The share card's filename and the ogImage template helper derive the same
    // slug from the canonical URL. Deriving it here too keeps all three in step.
    const slug =
      canonical.replace(ORIGIN, "").replace(/^\/|\/$/g, "") || "index";
    out.push({
      path: route,
      name: slug,
      title,
      description,
      canonical,
      // Error routes answer with their own status rather than 200.
      expectedStatus: /^(404|500)$/.test(slug) ? Number(slug) : 200,
      standalone: false,
    });
  }
  if (!out.length) throw new Error("no routes found in main.go");
  return out;
}

const ROUTES = [...readRoutes(), ...STANDALONE];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const BASE_URL = process.env.BASE_URL || "http://localhost:8099";

module.exports = { ROUTES, VIEWPORTS, BASE_URL, ORIGIN };
