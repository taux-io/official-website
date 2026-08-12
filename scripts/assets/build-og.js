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
// Titles are read from site.toml so a card cannot drift from the page it
// represents.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { ROUTES } = require("../routes");

const ROOT = path.join(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "static", "og");
const WIDTH = 1200;
const HEIGHT = 630;

// Routes come from the shared table, which reads site.toml. Parsing it here a
// second time is how a card and the tag pointing at it could drift apart.
function routes() {
  return ROUTES.filter((r) => !r.standalone).map((r) => ({
    route: r.path,
    // The brand suffix is for a browser tab; the card already carries the
    // wordmark, so repeating it wastes the largest line on the image. It is
    // not always the trailing segment — "About TauX | AI & GEO Specialists"
    // puts it first — so segments are filtered rather than truncated.
    title: r.title
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
    description: r.description,
    name: r.name,
  }));
}

const CARD = (item, fontCss, tokenCss) => `
<style>
  ${fontCss}
  ${tokenCss}
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    background: rgb(var(--surface-rgb));
    color: rgb(var(--ink-rgb));
    font-family: "D-DIN", "PingFang TC", sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 80px;
    position: relative; overflow: hidden;
  }
  .row { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: baseline; }
  .mark { font-family: "D-DIN Condensed", sans-serif; font-weight: 700; font-size: 26px; letter-spacing: 0.09em; text-transform: uppercase; }
  .kicker { font-family: "D-DIN Condensed", "PingFang TC", sans-serif; font-weight: 400; font-size: 17px; letter-spacing: 0.09em; text-transform: uppercase; color: rgb(var(--ink-rgb)); }
  h1 {
    position: relative; z-index: 1;
    font-family: "D-DIN Condensed", "PingFang TC", sans-serif;
    font-size: ${item.title.length > 34 ? 62 : 80}px;
    font-weight: 700; line-height: 1.1; letter-spacing: 0.02em;
    max-width: 940px;
    /* Balanced rather than greedy. The home card set its title in three lines
       with a two-character last line — issue #144. Greedy wrapping fills each
       line to the edge and leaves whatever is left over on the last one, which
       on a 34-character Chinese title is reliably an orphan. Balance gives
       the lines equal length instead, so the last one is never the remainder.
       Chromium renders these cards, so support is not in question here. */
    text-wrap: balance;
  }
  p {
    position: relative; z-index: 1;
    color: rgb(var(--ink-rgb)); font-size: 23px; line-height: 1.55; max-width: 820px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .rule { position: relative; z-index: 1; height: 1px; background: rgb(var(--line-rgb)); margin-bottom: 28px; }
</style>
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
    face("D-DIN Condensed", "D-DINCondensed-Bold.woff2", 700),
  ].join("\n");

  // The tokens are read out of src/input.css rather than restated here.
  //
  // This file used to hardcode #fff, #c8c8cc, #8a8a91 and 0.25em, which meant a
  // palette change updated the site and quietly left fifteen share cards on the
  // previous one. A share card is the only asset that is seen away from the
  // site and never noticed to be wrong in a browser, so it is the one most
  // easily missed — the answer is not to remember, it is to not have a second
  // copy of the values.
  const rootCss = fs.readFileSync(path.join(ROOT, "src", "input.css"), "utf8");
  const token = (name) => {
    const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(rootCss);
    if (!m) throw new Error(`build-og: --${name} not found in src/input.css`);
    return m[1].trim();
  };
  const tokenCss = `:root{--ink-rgb:${token("ink-rgb")};--line-rgb:${token(
    "line-rgb"
  )};--surface-rgb:${token("surface-rgb")};}`;

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  for (const item of items) {
    await page.setContent(CARD(item, fontCss, tokenCss), { waitUntil: "load" });
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
