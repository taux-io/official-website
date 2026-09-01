// RULE 29 — og geometry.
//
//   npm run cards
//
// The share cards are the only thing this site ships with a fixed frame. Every
// page is a viewport away from being a different shape, which is why DESIGN.md
// records the reference set's proportional rules — 5-9% outer margin, a dominant
// subject at 45-80% — as unadoptable for pages: the denominator is chosen by
// whoever is looking. On a 1200x630 card the denominator is a constant, and the
// same rules become measurable.
//
// WHY THIS READS PNGs AND NOT build-og.js. The margin could be computed from
// the source — `padding: 72px 80px` over `WIDTH` is 6.67% without opening an
// image. The ink box cannot: nothing in the source says how much of the card a
// balanced three-line title ends up covering. A rule that read the source would
// check the half that was never in doubt and skip the half that is, and the
// claim under test is about the artifact, not the recipe.
//
// WHAT "DOMINANT SUBJECT" MEANS ON A CARD WITH NO PHOTOGRAPH, and this is the
// measurement that went wrong once (DESIGN.md decision #91): it is the bounding
// box of everything that is not bare paper, not the proportion of dark pixels.
// Measured as dark pixels the cards read 86-97% empty and every one of them
// fails, because type is mostly counters and line gaps — a text-only card can
// never reach 45% ink however large it is set. Measured as the ink box they
// read 64.8-65.3% and every one passes. Both numbers are measurements; one of
// them is of the wrong thing.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..", "..");
const CARDS = path.join(ROOT, "static", "og");

// From the reference set: generous outer margins of 5-9% of page width, and one
// dominant subject occupying 45-80% of the page.
const MARGIN_MIN_PERCENT = 5;
const MARGIN_MAX_PERCENT = 9;
const SUBJECT_MIN_PERCENT = 45;
const SUBJECT_MAX_PERCENT = 80;

// The card is 1200x630 by build-og.js's own constants. A card that is not that
// shape is a different carrier and these proportions were not chosen for it.
const WIDTH = 1200;
const HEIGHT = 630;

// A channel this close to the substrate is paper, not a very pale ink. The
// cards' faintest real mark is the hairline at 12% coverage, which lands 24
// levels away — an order of magnitude outside this.
const PAPER_TOLERANCE = 2;

function pngFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pngFiles(p));
    else if (entry.name.endsWith(".png")) out.push(p);
  }
  return out;
}

// The substrate is read from the image's own corner rather than from a token,
// so this measures the card that shipped instead of the card the stylesheet
// would produce today. A card built before a palette change is exactly what
// this is here to notice.
async function measure(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const at = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const paper = at(0, 0);
  const isPaper = (px) => px.every((c, i) => Math.abs(c - paper[i]) <= PAPER_TOLERANCE);

  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isPaper(at(x, y))) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { width, height, blank: true };
  return {
    width,
    height,
    blank: false,
    subjectPercent: (((maxX - minX + 1) * (maxY - minY + 1)) / (width * height)) * 100,
    margins: { left: minX, right: width - 1 - maxX, top: minY, bottom: height - 1 - maxY },
  };
}

async function main() {
  if (!fs.existsSync(CARDS)) {
    console.log("no share cards to check");
    return;
  }
  const files = pngFiles(CARDS);
  const failures = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const m = await measure(file);

    if (m.width !== WIDTH || m.height !== HEIGHT) {
      failures.push({ where: rel, detail: `${m.width}x${m.height} is not the ${WIDTH}x${HEIGHT} carrier these proportions were chosen for` });
      continue;
    }
    if (m.blank) {
      failures.push({ where: rel, detail: "every pixel is the substrate — the card carries no mark at all" });
      continue;
    }
    if (m.subjectPercent < SUBJECT_MIN_PERCENT || m.subjectPercent > SUBJECT_MAX_PERCENT) {
      failures.push({
        where: rel,
        detail: `the ink box covers ${m.subjectPercent.toFixed(1)}% of the card, outside ${SUBJECT_MIN_PERCENT}-${SUBJECT_MAX_PERCENT}%`,
      });
    }
    for (const [edge, px] of Object.entries(m.margins)) {
      const percent = (px / WIDTH) * 100;
      if (percent >= MARGIN_MIN_PERCENT && percent <= MARGIN_MAX_PERCENT) continue;
      failures.push({
        where: rel,
        detail: `${edge} margin is ${px}px (${percent.toFixed(2)}% of width), outside ${MARGIN_MIN_PERCENT}-${MARGIN_MAX_PERCENT}%`,
      });
    }
  }

  console.log(`\n${files.length} share cards checked for outer margin and ink box`);
  if (!failures.length) {
    console.log("\n0 failing");
    return;
  }
  console.log(`\n${failures.length} card geometry failure(s):\n`);
  for (const f of failures) console.log(`  ${f.where}\n      ${f.detail}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
