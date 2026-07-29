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
const { launch } = require("../browser");
const { ROUTES, VIEWPORTS, BASE_URL } = require("../routes");

const label = process.argv[2];
if (!label) {
  console.error("usage: node scripts/visual/screenshot.js <label>");
  process.exit(1);
}

const outDir = path.join(__dirname, "..", "..", ".visual", label);

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  let count = 0;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      // Freeze the tau curve and every entrance animation so repeat runs are
      // byte-comparable; motion is verified by eye, not by diff.
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      const url = BASE_URL + route.path;
      const response = await page.goto(url, { waitUntil: "networkidle" });
      const status = response ? response.status() : 0;
      if (status >= 400 && route.name !== "404") {
        console.warn(`  ! ${route.path} returned ${status}`);
      }
      // Several templates reveal content on scroll via IntersectionObserver.
      // A full-page screenshot does not trip the observer, so anything below
      // the fold would be captured at opacity 0 and read as missing text.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 50));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(outDir, `${route.name}-${viewport.name}.png`),
        fullPage: true,
      });
      count++;
    }

    await context.close();
  }

  await browser.close();
  console.log(`${count} screenshots written to .visual/${label}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
