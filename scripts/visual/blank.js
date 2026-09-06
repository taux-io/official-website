// How much of a screenshot is paper. A tool for a person, like screenshot.js
// and diff.js — not a gate, because the number has no threshold anyone could
// defend: line spacing alone makes a third of every text block blank.
//
//   npm run screenshot after && node scripts/visual/blank.js after
//
// Two numbers per image. `blank%` is the share of pixel rows with no ink at
// all; `longest` is the tallest run of consecutive blank rows, in px — the one
// that matters, because a run taller than a phone screen (812px) is a screen
// with nothing on it. Measured before the v5.2 density change: long-form pages
// on a phone ran 354–499px blank at their widest gap, the desktop 473–644px.
// The paper is read from the top-left pixel, not from a token, so a screenshot
// of an older palette measures against its own ground.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const label = process.argv[2];
if (!label) {
  console.error("usage: node scripts/visual/blank.js <label>");
  process.exit(2);
}
const root = path.join(__dirname, "..", "..", ".visual", label);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".png")) out.push(p);
  }
  return out;
}

(async () => {
  const rows = [];
  for (const file of walk(root).sort()) {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels: c } = info;
    const paper = [data[0], data[1], data[2]];
    let blank = 0, run = 0, longest = 0;
    for (let y = 0; y < h; y++) {
      let ink = false;
      const row = y * w * c;
      for (let x = 0; x < w; x += 2) {
        const i = row + x * c;
        if (Math.abs(data[i] - paper[0]) > 6 || Math.abs(data[i + 1] - paper[1]) > 6 || Math.abs(data[i + 2] - paper[2]) > 6) { ink = true; break; }
      }
      if (ink) run = 0;
      else { blank++; run++; if (run > longest) longest = run; }
    }
    rows.push({ file: path.relative(root, file), h, blank: Math.round((100 * blank) / h), longest });
  }
  rows.sort((a, b) => b.longest - a.longest);
  console.log("image".padEnd(48) + "height  blank%  longest blank run");
  for (const r of rows) console.log(r.file.padEnd(48) + String(r.h).padStart(6) + String(r.blank).padStart(7) + "%" + String(r.longest).padStart(9) + "px");
  const phones = rows.filter((r) => r.file.endsWith("mobile.png"));
  if (phones.length) {
    const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    console.log(`\n${phones.length} phone images: median blank ${med(phones.map((r) => r.blank))}%, median longest run ${med(phones.map((r) => r.longest))}px`);
  }
})();
