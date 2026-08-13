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
  //
  // MULTIPLE SEGMENTS, AND CASE MATTERS. This used to read `(\/[a-z0-9-]*)?` —
  // one lower-case segment. Decision #58 made every URL two segments deep and
  // the first of them a locale tag with capitals in it, so the pattern matched
  // `/zh-` and stopped: twenty listed pages read as twenty missing ones.
  //
  // Upper case is not cosmetic here. A URL path is case-sensitive, and
  // `zh-Hant-TW` is the spelling the canonical, the file on disk and the
  // hreflang all use. Lower-casing the class would let `/zh-hant-tw/geo-guide`
  // satisfy a check for a URL the host does not serve.
  const linked = new Set();
  for (const m of text.matchAll(/https:\/\/taux\.io((?:\/[A-Za-z0-9-]+)*)\/?/g)) {
    linked.add(m[1] || "/");
  }

  const published = ROUTES.filter((r) => !r.standalone);
  const missing = published.filter((r) => !linked.has(r.path));

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

  console.log(`every published page is listed in llms.txt (${published.length} pages)`);
}

main();
