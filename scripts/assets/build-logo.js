// Builds the logo used in structured data.
//
//   node scripts/assets/build-logo.js
//
// Google renders an Organization logo on its own surface — a knowledge panel
// or a rich result, almost always light — and this is the one image on the
// site whose presentation is out of our hands. The share cards get a composed
// 1200x630 layout and the favicon gets a chosen inset; here the only control
// available is the asset itself, so it is worth cutting properly.
//
// Two things were wrong with what the JSON-LD pointed at. It used
// taux-logo-dark.png, which is the *light* mark — the name describes the
// background it is meant for, not its own colour, and it had been read the
// other way. White on white is not a logo. And both masters are 1500x1500
// around a 1210x538 mark, so nearly two thirds of the frame is padding that
// Google would letterbox around, leaving the mark small.
//
// Output is named for where it goes rather than what colour it is, since that
// ambiguity is what caused the mistake in the first place.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "..");
// The dark mark on transparency — correct for a light surface.
const SOURCE = path.join(ROOT, "static", "taux-logo-light.png");
const OUT = path.join(ROOT, "static", "brand", "logo-on-light.png");

// Google asks for at least 112px on a side and prefers generous resolution.
const TARGET_HEIGHT = 320;
const PAD_RATIO = 0.18;

const RENDER = async ([src, targetHeight, padRatio]) => {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("source logo failed to load"));
    i.src = src;
  });

  const probe = new OffscreenCanvas(img.width, img.height);
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  pctx.drawImage(img, 0, 0);
  const d = pctx.getImageData(0, 0, img.width, img.height).data;

  // Trim to the mark's own bounds rather than trusting the source frame.
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (d[(y * img.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("source logo is entirely transparent");

  const markW = x1 - x0 + 1;
  const markH = y1 - y0 + 1;
  const scale = targetHeight / markH;
  const pad = Math.round(targetHeight * padRatio);
  const outW = Math.round(markW * scale) + pad * 2;
  const outH = targetHeight + pad * 2;

  const out = new OffscreenCanvas(outW, outH);
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  // Opaque white rather than transparent: a transparent PNG placed on a dark
  // surface would hide a dark mark, and we do not choose the surface.
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, outW, outH);
  octx.drawImage(img, x0, y0, markW, markH, pad, pad, Math.round(markW * scale), targetHeight);

  const blob = await out.convertToBlob({ type: "image/png" });
  return {
    bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    source: `${img.width}x${img.height}`,
    mark: `${markW}x${markH}`,
    output: `${outW}x${outH}`,
  };
};

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.route("https://logo.local/**", (route) => {
    if (route.request().url().endsWith(".png")) {
      route.fulfill({ status: 200, contentType: "image/png", body: fs.readFileSync(SOURCE) });
    } else {
      route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html>" });
    }
  });
  await page.goto("https://logo.local/");

  const r = await page.evaluate(RENDER, [
    "https://logo.local/source.png",
    TARGET_HEIGHT,
    PAD_RATIO,
  ]);
  fs.writeFileSync(OUT, Buffer.from(r.bytes));
  console.log(`  source ${r.source} -> mark ${r.mark} -> output ${r.output}`);
  console.log(`  static/brand/logo-on-light.png`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
