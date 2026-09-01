// Regenerates the icon set for the dark palette.
//
//   node scripts/assets/build-icons.js
//
// The mark is a black tau-X on a transparent field. Rather than redraw it, the
// source is recoloured and composited onto the site's black, which keeps the
// letterforms exactly as drawn — the brand mark is not something to re-letter
// as a side effect of a restyle.
//
// The background has to be opaque. Left transparent, a white mark disappears
// against light browser chrome, a bookmark bar or a light-themed home screen —
// which is precisely where a favicon spends its life.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const STATIC = path.join(__dirname, "..", "..", "static");
// A pristine master kept apart from the outputs. The script writes
// android-chrome-512x512.png, so reading the source from there would make a
// second run consume its own output — every pixel opaque, every pixel
// recoloured white, and the icon becomes a white square.
const SOURCE = path.join(STATIC, "brand", "icon-master.png");

// A DELIBERATE BLACK, NOT THE SITE'S SURFACE.
//
// This read "--surface-deep. Matches the page the icon links to", and that
// stopped being true two brand resets ago: --surface-deep does not exist, and
// the page has been light since decision #54 and is paper (#FAFAF7) since v5.
// The icon stayed black through both without anyone deciding it should.
//
// It is kept black because a favicon does not live on this site's surface — it
// lives on browser chrome, a bookmark bar and a home screen, none of which we
// choose. A dense mark reads on all of them; paper-on-paper reads on none. The
// rule above still holds for the reason it was written: the background has to
// be opaque. What changed is that this is now a choice rather than an
// inherited value, so a future surface change does not silently make it wrong
// again. DESIGN.md's rule 31 (`declared surfaces`) names the icon as one of
// the places a colour escapes the two-plate model on purpose.
const BACKGROUND = "#000000";

const TARGETS = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "android-chrome-192x192.png", size: 192 },
  { file: "android-chrome-512x512.png", size: 512 },
];

const RENDER = async ([src, size, BACKGROUND]) => {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("source icon failed to load"));
    i.src = src;
  });

  // Recolour at full resolution, then scale down. Doing it the other way round
  // would recolour the interpolated edge pixels and thicken the outline.
  const full = new OffscreenCanvas(img.width, img.height);
  const fctx = full.getContext("2d", { willReadFrequently: true });
  fctx.drawImage(img, 0, 0);
  const data = fctx.getImageData(0, 0, img.width, img.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    // Only the glyph is opaque; alpha carries the shape, so the colour can be
    // replaced outright and the antialiased edges keep their coverage.
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
  }
  fctx.putImageData(data, 0, 0);

  const out = new OffscreenCanvas(size, size);
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.fillStyle = BACKGROUND;
  octx.fillRect(0, 0, size, size);
  // Inset so the glyph is not flush to the edge; Android and iOS both crop
  // icons to a rounded mask.
  const pad = Math.round(size * 0.14);
  octx.drawImage(full, pad, pad, size - pad * 2, size - pad * 2);

  const blob = await out.convertToBlob({ type: "image/png" });
  const buf = new Uint8Array(await blob.arrayBuffer());
  return Array.from(buf);
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let current = SOURCE;
  await page.route("https://icons.local/**", (route) => {
    if (route.request().url().endsWith(".png")) {
      route.fulfill({ status: 200, contentType: "image/png", body: fs.readFileSync(current) });
    } else {
      route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html>" });
    }
  });
  await page.goto("https://icons.local/");

  for (const t of TARGETS) {
    const bytes = await page.evaluate(RENDER, ["https://icons.local/source.png", t.size, BACKGROUND]);
    fs.writeFileSync(path.join(STATIC, t.file), Buffer.from(bytes));
    console.log(`  ${t.file} (${t.size}x${t.size})`);
  }

  // favicon.ico, for the bare /favicon.ico request browsers still make. The
  // format accepts a PNG payload directly, so the container is a 6-byte header
  // and one 16-byte directory entry around the 32px image.
  const png = fs.readFileSync(path.join(STATIC, "favicon-32x32.png"));
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(32, 6); // width
  header.writeUInt8(32, 7); // height
  header.writeUInt8(0, 8); // palette size: none
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // offset to the payload
  fs.writeFileSync(path.join(STATIC, "favicon.ico"), Buffer.concat([header, png]));
  console.log("  favicon.ico (32x32, PNG payload)");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
