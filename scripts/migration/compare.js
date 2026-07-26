// Byte-compares the generated pages against the captured Go reference.
//
//   node scripts/migration/compare.js
//
// If every byte matches, no SEO or GEO signal can have changed — no checklist
// of canonical tags, structured data, headings and internal links is needed,
// because their union is the file. That is the whole reason the migration was
// sequenced to keep content frozen.
//
// Known deltas are normalised away rather than ignored, and each rule is listed
// on failure. Every rule is a place a real regression could hide, so the list is
// kept short and explicit.

const fs = require("fs");
const path = require("path");
const { ROUTES } = require("../routes");

const REF = path.join(__dirname, "..", "..", ".migration", "go");
const DIST = path.join(__dirname, "..", "..", "dist");

// The Go server read the clock per request; the generator bakes the year at
// build time. Same value today, but the mechanism differs, so it is normalised.
const NORMALISERS = [
  { name: "copyright year", apply: (s) => s.replace(/&copy; \d{4} TauX/g, "&copy; YYYY TauX") },
  // Go's {{ define }} left a blank line ahead of the doctype. The construct is
  // gone and the generated file simply starts at <!DOCTYPE>, which is the
  // better output; whitespace before the doctype carries no meaning either way.
  { name: "leading and trailing whitespace", apply: (s) => s.trim() },
  // Go spells an escaped apostrophe &#39;, minijinja spells it &#x27;. Same
  // character, different notation; hex references are rewritten to decimal so
  // both sides spell every reference the same way.
  {
    name: "character reference notation",
    apply: (s) => s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => `&#${parseInt(h, 16)};`),
  },
];

// Flat files, matching the generator: `geo-guide.html` is served at
// `/geo-guide` with no redirect, where `geo-guide/index.html` would answer a
// request for `/geo-guide` with a 308 to the trailing-slash form.
function distPath(route) {
  if (route.path === "/") return path.join(DIST, "index.html");
  return path.join(DIST, `${route.path.replace(/^\//, "")}.html`);
}

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      const from = Math.max(0, i - 60);
      return {
        offset: i,
        ref: JSON.stringify(a.slice(from, i + 60)),
        out: JSON.stringify(b.slice(from, i + 60)),
      };
    }
  }
  return { offset: n, ref: JSON.stringify(a.slice(n, n + 80)), out: JSON.stringify(b.slice(n, n + 80)) };
}

let identical = 0;
const differing = [];

for (const route of ROUTES) {
  if (route.standalone) continue;
  const refFile = path.join(REF, `${route.name}.html`);
  const outFile = distPath(route);

  if (!fs.existsSync(refFile)) { differing.push({ route: route.path, why: "no reference captured" }); continue; }
  if (!fs.existsSync(outFile)) { differing.push({ route: route.path, why: `not generated (${outFile})` }); continue; }

  let ref = fs.readFileSync(refFile, "utf8");
  let out = fs.readFileSync(outFile, "utf8");
  for (const n of NORMALISERS) { ref = n.apply(ref); out = n.apply(out); }

  if (ref === out) { identical++; continue; }
  differing.push({ route: route.path, why: "bytes differ", ...firstDifference(ref, out), refLen: ref.length, outLen: out.length });
}

for (const d of differing) {
  console.log(`\n  DIFFERS  ${d.route}  (${d.why})`);
  if (d.offset !== undefined) {
    console.log(`    reference ${d.refLen} bytes, generated ${d.outLen}; first difference at ${d.offset}`);
    console.log(`    reference  ${d.ref}`);
    console.log(`    generated  ${d.out}`);
  }
}

console.log(`\nnormalised: ${NORMALISERS.map((n) => n.name).join(", ")}`);
console.log(`${identical} identical, ${differing.length} differing`);
process.exitCode = differing.length ? 1 : 0;
