// Reports pages that site.toml declares but llms.txt never links to.
//
//   node scripts/check-llms.js
//
// llms.txt is the file written specifically for language models, so a page
// missing from it is invisible to the audience the whole GEO effort is aimed
// at. It drifted exactly the way the hand-maintained sitemap did: workspace-ai-roi
// shipped, was indexed, was linked from the navigation, and was absent here.
//
// The sitemap stopped drifting by being generated. llms.txt cannot be — it is
// prose, and a one-line summary written per page is the reason a model can use
// it. So the file stays hand-written and this check watches it instead: adding
// the page is a person's job, noticing it was forgotten is not.

const fs = require("fs");
const path = require("path");
const { ROUTES, ORIGIN } = require("./routes");

const ROOT = path.join(__dirname, "..");
const LLMS = path.join(ROOT, "static", "llms.txt");

function main() {
  const text = fs.readFileSync(LLMS, "utf8");

  // A page counts as listed if the file links to its URL. Trailing slashes and
  // anchors are tolerated; anything else is a link somewhere other than here.
  const linked = new Set();
  for (const m of text.matchAll(/https:\/\/taux\.io(\/[a-z0-9-]*)?/g)) {
    linked.add(m[1] && m[1] !== "/" ? m[1] : "/");
  }

  const missing = ROUTES.filter((r) => !r.standalone && !linked.has(r.path));

  if (missing.length) {
    console.log("");
    for (const r of missing) {
      console.log(`  ${r.path}`);
      console.log(`      ${ORIGIN}${r.path === "/" ? "" : r.path}`);
    }
    console.log(
      `\n${missing.length} page(s) are published but absent from llms.txt.` +
        `\nAdd each one with the one-line summary a model would need to decide whether to read it.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`every published page is listed in llms.txt (${ROUTES.length - 2} pages)`);
}

main();
