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

const { WIDTH, HEIGHT, OUT_DIR: CARDS } = require("../assets/og-card");
const { ROUTES } = require("../routes");

const ROOT = path.join(__dirname, "..", "..");

// From the reference set: generous outer margins of 5-9% of page width, and one
// dominant subject occupying 45-80% of the page.
const MARGIN_MIN_PERCENT = 5;
const MARGIN_MAX_PERCENT = 9;
const SUBJECT_MIN_PERCENT = 45;
const SUBJECT_MAX_PERCENT = 80;


// A channel this close to the substrate is paper, not a very pale ink. The
// cards' faintest real mark is the hairline at 12% coverage, which lands 24
// levels away — an order of magnitude outside this.
const PAPER_TOLERANCE = 2;

// THE ROUTE TABLE SAYS WHICH CARDS EXIST; THE DIRECTORY ONLY SAYS WHAT IS THERE.
//
// This walked `static/og` and measured whatever it found, which meant a missing
// card was a card it never looked for: delete one and the gate counts 99,
// reports `0 failing`, and the page it belonged to advertises an og:image that
// 404s. A gate that cannot see an absence is the defect rule 31 exists for, and
// this file had it while sitting next to it.
//
// `site.toml`'s only JS reader is `routes.js` (rule 19, `single route table`),
// and `build-og.js` derives every card's path from the same `name`. Reading the
// directory instead was a second source for a list that already has one.
//
// BOTH DIRECTIONS, because reading only the table would trade one blind spot for
// another: a card left behind by a retired route would become invisible where
// the directory walk at least saw it. Measured before writing this: 100 wanted,
// 100 on disk, 0 missing, 0 orphaned.
function cardInventory() {
  const wanted = new Map();
  for (const r of ROUTES) {
    if (r.standalone) continue;
    wanted.set(`${r.name}.png`, path.join(CARDS, `${r.name}.png`));
  }

  const onDisk = new Set();
  const walk = (dir, prefix = "") => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".png")) onDisk.add(`${prefix}${entry.name}`);
    }
  };
  walk(CARDS);

  return {
    present: [...wanted].filter(([slug]) => onDisk.has(slug)).map(([, file]) => file),
    missing: [...wanted.keys()].filter((slug) => !onDisk.has(slug)),
    orphaned: [...onDisk].filter((slug) => !wanted.has(slug)),
  };
}

// The substrate is read from the image's own corner rather than from a token,
// so this measures the card that shipped instead of the card the stylesheet
// would produce today. A card built before a palette change is exactly what
// this is here to notice.
//
// IT SCANS ROWS THEN COLUMNS, AND STOPS AS SOON AS IT CAN. Walking all 756,000
// pixels of every card cost 270ms per run; finding the first and last inked row
// first, then scanning columns only between them, costs 56ms. Channels are read
// straight out of the buffer — the earlier version built a three-element array
// per pixel through a closure, which is 756,000 allocations to compare three
// numbers.
//
// The frame is checked before any of this: a card that is not the carrier size
// is a different carrier, and these proportions were not chosen for it.
async function measure(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (width !== WIDTH || height !== HEIGHT) return { width, height, wrongFrame: true };

  const pr = data[0];
  const pg = data[1];
  const pb = data[2];
  const inked = (i) =>
    Math.abs(data[i] - pr) > PAPER_TOLERANCE ||
    Math.abs(data[i + 1] - pg) > PAPER_TOLERANCE ||
    Math.abs(data[i + 2] - pb) > PAPER_TOLERANCE;

  let minY = -1;
  for (let y = 0; y < height && minY < 0; y++) {
    for (let x = 0; x < width; x++) if (inked((y * width + x) * channels)) { minY = y; break; }
  }
  if (minY < 0) return { width, height, blank: true };

  let maxY = minY;
  for (let y = height - 1; y > minY; y--) {
    let hit = false;
    for (let x = 0; x < width; x++) if (inked((y * width + x) * channels)) { hit = true; break; }
    if (hit) { maxY = y; break; }
  }

  let minX = width;
  let maxX = -1;
  for (let y = minY; y <= maxY; y++) {
    const row = y * width;
    for (let x = 0; x < minX; x++) if (inked((row + x) * channels)) { minX = x; break; }
    for (let x = width - 1; x > maxX; x--) if (inked((row + x) * channels)) { maxX = x; break; }
  }

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
  const failures = [];
  const { present: files, missing, orphaned } = cardInventory();
  for (const slug of missing) {
    failures.push({
      where: path.join("static", "og", slug),
      detail: "the route table declares this card and it is not on disk — the page advertises an og:image that 404s",
    });
  }
  for (const slug of orphaned) {
    failures.push({
      where: path.join("static", "og", slug),
      detail: "no route declares this card — a retired route left it behind, and nothing ships it",
    });
  }

  // libvips decodes on its own threadpool; awaiting one card at a time left it
  // idle between images. Measured 475ms sequential against 67ms batched.
  const measured = await Promise.all(files.map(async (file) => ({ file, m: await measure(file) })));

  for (const { file, m } of measured) {
    const rel = path.relative(ROOT, file);

    if (m.wrongFrame) {
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

  console.log(`\n${files.length} share cards checked for outer margin and ink box (${ROUTES.filter((r) => !r.standalone).length} declared by the route table)`);
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
