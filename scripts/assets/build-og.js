// Builds the social share cards.
//
//   node scripts/assets/build-og.js
//
// The site had no og:image at all, so every share on LinkedIn, Slack, Line or
// X rendered as a blank card. For a company selling discoverability that is an
// odd gap to leave, and the fix is cheap: the cards are built from the same
// tokens, the same typeface and the same tau curve as the pages, rendered in
// Chromium and saved as PNG. Rerun after a palette change and the share images
// follow — which is exactly what did not happen with the logo referenced in
// the structured data, still light-on-white from two restyles ago.
//
// Titles are read from main.go so a card cannot drift from the page it
// represents.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "static", "og");
const WIDTH = 1200;
const HEIGHT = 630;

function routes() {
  const go = fs.readFileSync(path.join(ROOT, "main.go"), "utf8");
  const re =
    /r\.GET\("([^"]+)",[\s\S]*?Title:\s*"([^"]*)"[\s\S]*?Description:\s*"([^"]*)"[\s\S]*?Canonical:\s*"([^"]*)"/g;
  const out = [];
  let m;
  while ((m = re.exec(go))) {
    const [, route, title, description, canonical] = m;
    // The filename is derived from the canonical URL exactly as main.go's
    // ogImage helper derives it, so a card and the tag pointing at it cannot
    // drift apart. Deriving it from the route instead is how /404.html ended
    // up advertising an image that was never generated.
    const slug = canonical.replace(/^https:\/\/taux\.io/, "").replace(/^\/|\/$/g, "") || "index";
    out.push({
      route,
      // The brand suffix is for a browser tab; the card already carries the
      // wordmark, so repeating it wastes the largest line on the image. It is
      // not always the trailing segment — "About TauX | AI & GEO Specialists"
      // puts it first — so segments are filtered rather than truncated.
      title: title
        .split(/[|｜]/)
        .map((part) =>
          part
            .replace(/\bTauX\b/g, "")
            // Removing the brand can strand the dash that joined it to the
            // rest: "TauX - AI Smart Work" leaves "- AI Smart Work".
            .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
            .replace(/\s{2,}/g, " ")
            .trim()
        )
        .filter(Boolean)
        .join(" — "),
      description,
      name: slug,
    });
  }
  return out;
}

const CARD = (item, fontCss) => `
<style>
  ${fontCss}
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    background: #000;
    color: #fff;
    font-family: "D-DIN", "PingFang TC", sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 80px;
    position: relative; overflow: hidden;
  }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .row { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: baseline; }
  .mark { font-family: "D-DIN Condensed", sans-serif; font-size: 26px; letter-spacing: 0.22em; text-transform: uppercase; }
  .kicker { font-family: "D-DIN Condensed", sans-serif; font-size: 17px; letter-spacing: 0.25em; text-transform: uppercase; color: #8a8a91; }
  h1 {
    position: relative; z-index: 1;
    font-family: "D-DIN Condensed", "PingFang TC", sans-serif;
    font-size: ${item.title.length > 34 ? 62 : 80}px;
    font-weight: 400; line-height: 1.1; letter-spacing: -0.01em;
    max-width: 940px;
  }
  p {
    position: relative; z-index: 1;
    color: #c8c8cc; font-size: 23px; line-height: 1.55; max-width: 820px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .rule { position: relative; z-index: 1; height: 1px; background: rgba(255,255,255,0.2); margin-bottom: 28px; }
</style>
<canvas data-tau-curve="static"></canvas>
<div class="row"><span class="mark">TauX</span><span class="kicker">拓思科技</span></div>
<div>
  <div class="rule"></div>
  <h1>${item.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</h1>
  <p style="margin-top:22px">${item.description.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
</div>
`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const items = routes();

  // The cards are rendered offline, so the fonts are inlined as data URIs
  // rather than fetched — nothing here should depend on a running server.
  const face = (family, file, weight) =>
    `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${fs
      .readFileSync(path.join(ROOT, "static", "fonts", file))
      .toString("base64")}) format("woff2");}`;
  const fontCss = [
    face("D-DIN", "D-DIN.woff2", 400),
    face("D-DIN Condensed", "D-DINCondensed.woff2", 400),
  ].join("\n");

  const curveJs = fs.readFileSync(path.join(ROOT, "static", "js", "tau-curve.js"), "utf8");

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  for (const item of items) {
    await page.setContent(CARD(item, fontCss), { waitUntil: "load" });
    await page.addScriptTag({ content: curveJs });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT_DIR, `${item.name}.png`) });
    console.log(`  ${item.name}.png  ${item.title}`);
  }

  await browser.close();
  console.log(`\n${items.length} cards written to static/og/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
