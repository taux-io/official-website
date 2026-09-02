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
const stylesheet = require("../stylesheet");
const { ROUTES, LOCALES } = require("../routes");

const ROOT = path.join(__dirname, "..", "..");
const { WIDTH, HEIGHT, OUT_DIR, TYPE_SCALE, TITLE_LONG_THRESHOLD } = require("./og-card");

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
    locale: r.locale,
  }));
}

// THE CJK FACE FOLLOWS THE CARD'S LANGUAGE, THE SAME WAY THE SITE'S DOES.
//
// Decision #55 gave every locale its own CJK stack because the old one was
// three Traditional faces and Japanese kanji answered by PingFang TC are
// visibly the wrong glyph forms to a Japanese reader (直, 骨, 令, 海, 説).
// That fix landed in src/input.css and NOT here, so the cards kept the
// singular assumption the site had just dropped — a Japanese card would have
// shipped with Chinese glyphs BY CONSTRUCTION rather than by the build
// machine's luck, which is the gap decision #57 accepted. #57 accepted not
// knowing which face a machine has; it did not accept asking for the wrong one.
//
// A card is the one asset seen away from the site and never noticed to be
// wrong in a browser, which is the same argument that moved the palette out of
// this file.
const CJK = {
  Hant: '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC"',
  Hans: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC"',
  Jpan: '"Hiragino Sans", "Yu Gothic UI", "Yu Gothic", "Noto Sans JP"',
  Kore: '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR"',
  // English cards still carry a CJK face: the registered company name and the
  // address appear on them in Chinese, and with no face Windows answers with a
  // Ming serif (decision #40).
  Latn: '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC"',
};

const cjkFor = (tag) => {
  const l = LOCALES.find((x) => x.tag === tag);
  return CJK[l && l.script] || CJK.Hant;
};

const CARD = (item, fontCss, tokenCss) => `
<style>
  ${fontCss}
  ${tokenCss}
  :root { --cjk: ${cjkFor(item.locale)}; }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    background: rgb(var(--surface-rgb));
    color: rgb(var(--ink-rgb));
    font-family: "SF Pro Text", system-ui, -apple-system, var(--cjk), sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 80px;
    position: relative; overflow: hidden;
  }
  .row { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: baseline; }
  .mark { font-family: "SF Pro Display", system-ui, -apple-system, sans-serif; font-weight: 700; font-size: ${TYPE_SCALE.mark}px; letter-spacing: 0.09em; text-transform: uppercase; }
  .kicker { font-family: "SF Pro Display", system-ui, -apple-system, var(--cjk), sans-serif; font-weight: 400; font-size: ${TYPE_SCALE.kicker}px; letter-spacing: 0.09em; text-transform: uppercase; color: rgb(var(--ink-rgb)); }
  h1 {
    position: relative; z-index: 1;
    font-family: "SF Pro Display", system-ui, -apple-system, var(--cjk), sans-serif;
    font-size: ${item.title.length > TITLE_LONG_THRESHOLD ? TYPE_SCALE.title.long : TYPE_SCALE.title.short}px;
    font-weight: 600; line-height: 1.07; letter-spacing: -0.005em;
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
    color: rgb(var(--ink-rgb)); font-size: ${TYPE_SCALE.desc}px; line-height: 1.55; max-width: 820px;
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

  // NOTHING IS INLINED, AND THE CARD'S FACE THEREFORE DEPENDS ON THE MACHINE
  // THAT BUILT IT. This is a known gap, stated rather than guarded.
  //
  // The four D-DIN faces used to be embedded as data URIs so a card rendered
  // identically anywhere. Decision #54 dropped self-hosted faces for SF Pro,
  // which exists on Apple platforms and nowhere else — so these committed PNGs
  // are SF Pro when built on macOS and whatever fontconfig picks on a Linux
  // runner.
  //
  // A READ-BACK ASSERTION WAS TRIED HERE AND REMOVED, because it could not
  // fire. It measured the h1's stack with canvas measureText against a
  // monospace baseline and threw if nothing resolved — but Chromium cannot
  // match SF Pro by family name (it is reachable only through the `system-ui`
  // keyword), and `system-ui` is the second entry of every stack, so the probe
  // returned "system-ui" on every platform and the throw was unreachable. It
  // also measured a fixed Latin string while most card titles are CJK, so the
  // family it reported had never drawn a glyph on those cards.
  //
  // A guard that cannot fire is worse than a recorded gap: it reads as coverage.
  // Closing this for real means one of two decisions, neither taken here —
  // self-host a face for the cards alone (which decision #54 chose against), or
  // compare the rendered PNG bytes against a committed baseline.
  const fontCss = "";

  // The tokens come from the stylesheet module rather than a second reader.
  //
  // This file used to hardcode #fff, #c8c8cc, #8a8a91 and 0.25em, which meant a
  // palette change updated the site and quietly left fifteen share cards on the
  // previous one. A share card is the only asset that is seen away from the site
  // and never noticed to be wrong in a browser, so it is the one most easily
  // missed — the answer is not to remember, it is to not have a second copy of
  // the values. That fix left a second READER instead, which this removes.
  //
  // Still throws on a missing token. A card built from a palette that no longer
  // exists is worse than a build that stops.
  const sheet = stylesheet.read();
  const token = (name) => {
    const value = sheet.token(name);
    if (value === null) throw new Error(`build-og: --${name} not found in the authored CSS`);
    return value;
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
    // The slug is the canonical URL's path, so it now contains a locale prefix
    // and therefore a slash: `zh-Hant-TW/geo-guide`. Keeping the card's path
    // identical to the page's path is what stops the two from drifting — the
    // generator and this file derive the same slug from the same canonical, and
    // a page once advertised an image that was never generated because they
    // did not. The directory has to exist first.
    const dest = path.join(OUT_DIR, `${item.name}.png`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await page.screenshot({ path: dest });
    console.log(`  ${item.name}.png  ${item.title}`);
  }

  await browser.close();
  console.log(`\n${items.length} cards written to static/og/`);
}

// The guard stays even though nothing imports this any more: the gates read
// og-card.js now, and a build script that rewrites 100 PNGs on require is a
// hazard whether or not something currently requires it.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
