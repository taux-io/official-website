// Pixel diff between two screenshot sets.
//
//   node scripts/visual/diff.js before after
//
// Reports the share of changed pixels per image, loudest first, so an
// unintended change stands out next to the intended ones. The contrast audit
// only sees colour pairs — it cannot notice that a component lost its border,
// its padding or its background entirely. This can.
//
// The comparison runs inside Chromium: it decodes PNG natively, so there is no
// image library to install.

const fs = require("fs");
const path = require("path");
const { launch } = require("../browser");

const [labelA, labelB] = process.argv.slice(2);
if (!labelA || !labelB) {
  console.error("usage: node scripts/visual/diff.js <label-a> <label-b>");
  process.exit(1);
}

const root = path.join(__dirname, "..", "..", ".visual");
const dirA = path.join(root, labelA);
const dirB = path.join(root, labelB);

// Anti-aliasing and subpixel text rendering shift a channel or two between
// runs; only a real change moves a pixel further than this.
const CHANNEL_TOLERANCE = 12;

// Runs in the page. Full-page captures of the long guides reach 1440x15000,
// and holding two decoded copies of that at once is ~170MB of ImageData —
// enough to take the renderer down — so the comparison walks horizontal
// strips and keeps only the running tally.
const COMPARE = async ([srcA, srcB, tolerance]) => {
  const load = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("failed to load " + src));
      img.src = src;
    });

  const [a, b] = await Promise.all([load(srcA), load(srcB)]);
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);

  const STRIP = 2000;
  const canvas = new OffscreenCanvas(w, Math.min(STRIP, h));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const stripOf = (img, y, sh) => {
    ctx.clearRect(0, 0, w, sh);
    ctx.drawImage(img, 0, -y);
    return ctx.getImageData(0, 0, w, sh).data;
  };

  let changed = 0;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < h; y += STRIP) {
    const sh = Math.min(STRIP, h - y);
    const da = stripOf(a, y, sh);
    const db = stripOf(b, y, sh);
    for (let i = 0; i < da.length; i += 4) {
      if (
        Math.abs(da[i] - db[i]) > tolerance ||
        Math.abs(da[i + 1] - db[i + 1]) > tolerance ||
        Math.abs(da[i + 2] - db[i + 2]) > tolerance
      ) {
        changed++;
        const row = y + Math.floor(i / 4 / w);
        if (row < minY) minY = row;
        if (row > maxY) maxY = row;
      }
    }
  }

  return {
    pct: (changed / (w * h)) * 100,
    changed,
    sizeChanged: a.width !== b.width || a.height !== b.height,
    dims: [`${a.width}x${a.height}`, `${b.width}x${b.height}`],
    band: changed ? [minY, maxY] : null,
  };
};

async function main() {
  const names = fs
    .readdirSync(dirA)
    .filter((f) => f.endsWith(".png"))
    .sort();

  const browser = await launch();
  const page = await browser.newPage();

  // Served over an intercepted route rather than inlined as data URIs: the
  // full-page captures of the long guides run to tens of thousands of pixels
  // tall, and base64ing those into an evaluate argument overruns Chromium.
  let current = { a: null, b: null };
  await page.route("https://diff.local/**", (route) => {
    const url = route.request().url();
    const which = url.includes("/a.png") ? "a" : url.includes("/b.png") ? "b" : null;
    if (!which) {
      // The host page itself; it only needs to exist so the images share an
      // origin and stay readable from a canvas.
      route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html>" });
      return;
    }
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: fs.readFileSync(current[which]),
    });
  });
  await page.goto("https://diff.local/");

  const results = [];

  for (const name of names) {
    const pa = path.join(dirA, name);
    const pb = path.join(dirB, name);
    if (!fs.existsSync(pb)) {
      results.push({ name, missing: true });
      continue;
    }
    current = { a: pa, b: pb };
    const r = await page.evaluate(COMPARE, [
      "https://diff.local/a.png?" + name,
      "https://diff.local/b.png?" + name,
      CHANNEL_TOLERANCE,
    ]);
    results.push({ name, ...r });
  }

  await browser.close();

  results.sort((x, y) => (y.pct || 0) - (x.pct || 0));

  console.log(`${labelA} -> ${labelB}\n`);
  let untouched = 0;
  for (const r of results) {
    if (r.missing) {
      console.log(`  MISSING in ${labelB}: ${r.name}`);
      continue;
    }
    if (r.pct < 0.01) {
      untouched++;
      continue;
    }
    const size = r.sizeChanged ? `  size ${r.dims[0]} -> ${r.dims[1]}` : "";
    const band = r.band ? `  rows ${r.band[0]}-${r.band[1]}` : "";
    console.log(`  ${r.pct.toFixed(2).padStart(6)}%  ${r.name}${band}${size}`);
  }
  console.log(`\n${untouched} of ${results.length} images unchanged`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
