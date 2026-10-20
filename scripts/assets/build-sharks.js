// Builds the two stills of the home hero's sharks background.
//
//   npm run build:sharks            (then: npm run build:css)
//   node scripts/assets/build-sharks.js --scan     list moments that meet SELECTION
//
// static/js/home-sharks.js draws ASCII sharks with canvas 2D, but only on a
// desktop (a hover pointer, laptop width, no reduced-motion, a working 2D
// context). Everywhere else the hero shows one of these pictures: the SAME
// simulation (static/js/sharks-sim.js), drawn once at a fixed moment. The
// stylesheet picks between them by width: the portrait one on a phone, the
// landscape one on tablets, on a desktop that asked for reduced motion and when
// the canvas could not start (.home-sharks-still, src/input.css).
//
// Nothing here is a second copy of the look except `paint`, which mirrors the
// script's draw() with no text boxes (a still has none to fade around; the
// moment was picked so the text side is empty instead). Colours and the glyph
// face are read from the authored CSS, sizes and moments from
// scripts/lib/sharks-source.js, which the staleness gate hashes too.
//
// RERUN IT after changing the simulation, a tint, the paper or ink colour, a
// still's cell, moment or seed, or this file; `npm run check:hero-sharks` goes
// red until you do. One line:
//     npm run build:sharks && npm run build:css
// then commit static/brand/hero-sharks-landscape.webp,
// static/brand/hero-sharks-portrait.webp, ledgers/hero-sharks-still.txt,
// src/input.css and static/css/styles.min.css. This script rewrites the `?v=`
// on both pictures' url() in src/input.css: /static/brand is cached for a week
// and that is how a visitor with an old picture fetches the new one.
//
// Reproducible: the simulation is a pure function of (seed, t, cols, rows) and
// the WebP encoder is deterministic at fixed settings. What is not pinned is the
// glyph face, which is the machine's monospace; the picture is committed, CI
// never redraws it, and the ledger hashes inputs, not pixels. A local Chromium
// whose version does not match Playwright's is picked up automatically
// (scripts/browser.js).

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { launch } = require("../browser");
const stylesheet = require("../stylesheet");
const src = require("../lib/sharks-source");
const Sim = require(src.SIM);

const { STILLS, ENCODE, SELECTION, STILL_MAX_BYTES, ROOT } = src;
const grid = (s) => ({ cols: Math.ceil(s.width / s.cw), rows: Math.ceil(s.height / s.ch) });

// SELECTION: does the picture of `s` at (seed, t) show enough sharks, on the
// right, with nothing on the text side? Returns the numbers either way.
function judge(s, seed, t) {
  const { cols, rows } = grid(s);
  const f = Sim.frame(seed, t, cols, rows, []);
  const inside = f.sharks.filter((k) => k.x > 0 && k.x < cols && k.y > 0 && k.y < rows * 1.5);
  const right = inside.filter((k) => k.x > cols / 2).length;
  const left = f.cells.filter((c) => c.x < cols * SELECTION.leftClear).length;
  const ok = inside.length >= SELECTION.minSharks && right >= SELECTION.minRight && left === 0;
  const cut = f.cells.filter((c) => c.tile > 0 && (c.x >= cols - 2 || c.y <= 1 || c.y >= rows - 2)).length; // cells the picture's edge cuts off
  return { ok, visible: inside.length, right, left, cut, cells: f.cells.length };
}

// Runs in the page. Mirrors draw() and size() in static/js/home-sharks.js.
function paint({ s, frame, cols, rows, ink, paper, tints, font, fade, step }) {
  const cv = document.getElementById("c");
  const g = cv.getContext("2d");
  const rgb = (a) => `rgb(${ink} / ${a})`;
  g.fillStyle = `rgb(${paper})`;
  g.fillRect(0, 0, s.width, s.height);
  g.fillStyle = rgb(step);
  for (let x = 0; x <= cols; x++) g.fillRect(Math.round(x * s.cw), 0, 1, s.height);
  for (let y = 0; y <= rows; y++) g.fillRect(0, Math.round(y * s.ch), s.width, 1);
  g.font = `${Math.round(s.ch * 0.78)}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const c of frame.cells.concat(frame.dust)) {
    const x = c.x * s.cw, y = c.y * s.ch;
    if (c.tile) {
      g.fillStyle = rgb(c.tile);
      g.fillRect(x + 1, y + 1, s.cw - 1, s.ch - 1);
    }
    const faded = c.tile <= fade;
    if (c.tint !== null && !faded) g.fillStyle = `rgb(${tints[c.tint]})`;
    else if (c.tile >= 0.4) g.fillStyle = `rgb(${paper})`;
    else g.fillStyle = rgb(faded ? Math.min(c.ink, Math.max(0, fade - c.tile)).toFixed(3) : c.ink);
    g.fillText(c.ch, x + s.cw / 2, y + s.ch / 2);
  }
  return cv.toDataURL("image/png");
}

function scan() {
  for (const [name, s] of Object.entries(STILLS)) {
    const hits = [];
    for (let seed = 1; seed <= 40; seed++) {
      for (let t = 0; t <= 240; t++) {
        const j = judge(s, seed, t);
        if (j.ok) hits.push({ seed, t, ...j });
      }
    }
    hits.sort((a, b) => b.visible - a.visible || a.cut - b.cut || b.cells - a.cells);
    console.log(`${name} (${grid(s).cols}x${grid(s).rows} cells): ${hits.length} moments meet the selection; best:`);
    for (const h of hits.slice(0, 8)) console.log(`  seed ${h.seed} t ${h.t}: ${h.visible} sharks, ${h.right} on the right, ${h.cells} cells, ${h.cut} at the edge`);
  }
}

async function main() {
  if (process.argv.includes("--scan")) return scan();
  const sheet = stylesheet.read();
  const inputs = src.stillInputs(sheet);
  const decl = sheet.declarations.find((d) => d.selector === ".home-sharks" && d.prop === "font-family");
  if (!decl) throw new Error("src/input.css has no .home-sharks { font-family }");
  const { fade, grid: step } = src.simConstants();
  const tints = inputs.tints.map((t) => t.join(" "));

  const browser = await launch();
  const images = {};
  try {
    for (const [name, s] of Object.entries(STILLS)) {
      const j = judge(s, s.seed, s.t);
      if (!j.ok) {
        throw new Error(`build-sharks: the ${name} still (seed ${s.seed}, t ${s.t}) no longer meets the selection (${j.visible} sharks inside, ${j.right} on the right, ${j.left} shark cells in the left ${SELECTION.leftClear * 100}%); run \`node scripts/assets/build-sharks.js --scan\` and set a new seed/t in scripts/lib/sharks-source.js`);
      }
      const { cols, rows } = grid(s);
      const page = await (await browser.newContext({ viewport: { width: s.width, height: s.height } })).newPage();
      await page.setContent(`<canvas id="c" width="${s.width}" height="${s.height}"></canvas>`);
      const data = await page.evaluate(paint, {
        s, frame: Sim.frame(s.seed, s.t, cols, rows, []), cols, rows, fade, step,
        ink: inputs.ink.join(" "), paper: inputs.paper.join(" "), tints, font: decl.value,
      });
      const png = Buffer.from(data.split(",")[1], "base64");
      const webp = await sharp(png).webp({ quality: ENCODE.quality, alphaQuality: ENCODE.alphaQuality, effort: ENCODE.effort }).toBuffer();
      if (webp.length > STILL_MAX_BYTES) {
        throw new Error(`build-sharks: the ${name} still is ${webp.length} bytes, over the ${STILL_MAX_BYTES} budget; lower ENCODE.quality in scripts/lib/sharks-source.js`);
      }
      images[name] = webp;
    }
  } finally {
    await browser.close();
  }

  let css = fs.readFileSync(src.INPUT_CSS, "utf8");
  for (const [name, s] of Object.entries(STILLS)) {
    fs.writeFileSync(src.stillPath(name), images[name]);
    const v = src.imageVersion(images[name]);
    const re = new RegExp(`url\\("/static/brand/${s.file.replace(".", "\\.")}(?:\\?v=[0-9a-f]+)?"\\)`);
    if (!re.test(css)) throw new Error(`src/input.css has no url("/static/brand/${s.file}") to version`);
    css = css.replace(re, `url("/static/brand/${s.file}?v=${v}")`);
    console.log(`  ${path.relative(ROOT, src.stillPath(name))}  ${s.width}x${s.height}  ${(images[name].length / 1024).toFixed(1)} KB  ?v=${v}`);
  }
  fs.writeFileSync(src.INPUT_CSS, css);
  fs.writeFileSync(src.STILL_LEDGER, src.ledgerText(inputs, images));
  console.log("  ledgers/hero-sharks-still.txt and the ?v= in src/input.css updated; now run npm run build:css and commit them with the pictures");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
