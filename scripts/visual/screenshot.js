// Full-page screenshots of every route at every viewport.
//
//   node scripts/visual/screenshot.js before
//   node scripts/visual/screenshot.js after
//
// Output lands in .visual/<label>/<route>-<viewport>.png. Capture `before`
// prior to touching any styles — with four generations of stale hex in the
// templates, the "after" pass is only meaningful against a recorded baseline.

const fs = require("fs");
const path = require("path");
const { walk } = require("./walk");
const { ROUTES, VIEWPORTS, BASE_URL } = require("../routes");

const label = process.argv[2];
if (!label) {
  console.error("usage: node scripts/visual/screenshot.js <label>");
  process.exit(1);
}

const outDir = path.join(__dirname, "..", "..", ".visual", label);

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  // The walk yields a path; the filename wants the route's name.
  const nameOf = new Map(ROUTES.map((r) => [r.path, r.name]));
  const fileName = (routePath, viewport) => {
    const slug = nameOf.get(routePath) || routePath.replace(/^\//, "") || "index";
    return slug + "-" + viewport.name + ".png";
  };

  const { stats } = await walk({
    viewports: VIEWPORTS,
    // Every deferred paint has to have happened before a full-page capture.
    scroll: true,
    probes: [
      {
        // An onPage probe rather than an inPage one: this writes files and
        // produces no findings, and taking a screenshot needs the page handle.
        name: "capture",
        onPage: async (page, { path: routePath, viewport }) => {
          await page.screenshot({
            path: path.join(outDir, fileName(routePath, viewport)),
            fullPage: true,
          });
          return [];
        },
      },
    ],
  });

  console.log(`${stats.measurements} screenshots written to .visual/${label}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
