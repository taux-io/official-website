// Captures every route's rendered HTML to a directory, for byte-comparison.
//
//   node scripts/migration/capture.js <label>
//
// The Go server's output is the reference the static generator has to
// reproduce. Two requests to the same route already return identical bytes —
// the only value that varies per request is the footer year — so "identical
// output" is an achievable and complete acceptance test: if every byte matches,
// no SEO or GEO signal can have changed, and no checklist is needed.

const fs = require("fs");
const path = require("path");
const { ROUTES, BASE_URL } = require("../routes");

const label = process.argv[2];
if (!label) {
  console.error("usage: node scripts/migration/capture.js <label>");
  process.exit(1);
}

const OUT = path.join(__dirname, "..", "..", ".migration", label);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let n = 0;
  for (const route of ROUTES) {
    if (route.standalone) continue; // served by nginx-proxy, not generated
    const res = await fetch(BASE_URL + route.path);
    const html = await res.text();
    fs.writeFileSync(path.join(OUT, `${route.name}.html`), html);
    n++;
  }
  console.log(`${n} pages captured to .migration/${label}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
