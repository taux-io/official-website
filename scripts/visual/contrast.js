// WCAG contrast audit across every route.
//
//   node scripts/visual/contrast.js            # report failures
//   node scripts/visual/contrast.js --all      # also list passing elements
//
// Inverting a site that carries four generations of stale hex, the dangerous
// failure is not "looks wrong" but "invisible": a section background gets
// flipped to black while its text colour is missed, leaving near-black on
// near-black. The text stays in the DOM, so nothing 404s and nothing looks
// broken — the region just reads as empty. This walks the rendered page and
// compares each text element's computed colour against its *effective*
// background, compositing alpha up the ancestor chain.

const { chromium } = require("playwright");
const { ROUTES, VIEWPORTS, BASE_URL } = require("./routes");

const SHOW_ALL = process.argv.includes("--all");

// Audit at desktop width only: contrast is a colour property, not a layout
// one, and the same elements render at every breakpoint.
const VIEWPORT = VIEWPORTS.find((v) => v.name === "desktop");

const AUDIT = () => {
  const parseColor = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    const [r, g, b] = parts;
    const a = parts.length > 3 ? parts[3] : 1;
    return { r, g, b, a };
  };

  // Standard source-over compositing of a translucent colour onto an opaque one.
  const composite = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  const luminance = ({ r, g, b }) => {
    const chan = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  };

  const ratio = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  };

  const hex = ({ r, g, b }) =>
    "#" +
    [r, g, b]
      .map((c) => Math.round(c).toString(16).padStart(2, "0"))
      .join("");

  // Walk ancestors accumulating translucent layers until an opaque one is hit.
  // Returns null when a gradient or image intervenes — those cannot be resolved
  // from computed styles, and guessing would produce false positives.
  const effectiveBackground = (el) => {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        return { unresolved: true, reason: "background-image" };
      }
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg.a > 0) {
        if (bg.a >= 1) {
          let result = bg;
          for (let i = layers.length - 1; i >= 0; i--) {
            result = composite(layers[i], result);
          }
          return { color: result };
        }
        layers.push(bg);
      }
      node = node.parentElement;
    }
    // Nothing opaque found: the canvas underneath is the browser default white.
    let result = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) {
      result = composite(layers[i], result);
    }
    return { color: result };
  };

  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const findings = [];

  for (const el of document.querySelectorAll("body *")) {
    // Only elements that render their own text — skip pure containers, or the
    // same string gets reported once per ancestor.
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!ownText) continue;

    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (parseFloat(cs.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const fg = parseColor(cs.color);
    if (!fg) continue;

    const bgResult = effectiveBackground(el);
    if (bgResult.unresolved) continue;
    const bg = bgResult.color;

    const fgSolid = fg.a < 1 ? composite(fg, bg) : fg;
    const r = ratio(fgSolid, bg);

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    // WCAG AA: 4.5:1 for body text, 3:1 for large text.
    const threshold = isLarge ? 3 : 4.5;

    findings.push({
      selector: describe(el),
      text: ownText.slice(0, 60),
      fg: hex(fgSolid),
      bg: hex(bg),
      ratio: Math.round(r * 100) / 100,
      threshold,
      fontSize: size,
      pass: r >= threshold,
    });
  }

  return findings;
};

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  let totalFail = 0;
  let totalChecked = 0;
  let invisible = 0;

  for (const route of ROUTES) {
    await page.goto(BASE_URL + route.path, { waitUntil: "networkidle" });
    // Content revealed on scroll starts at opacity 0, and the audit skips
    // transparent elements — without scrolling first, everything below the
    // fold would silently go unchecked.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    const findings = await page.evaluate(AUDIT);
    totalChecked += findings.length;

    const shown = SHOW_ALL ? findings : findings.filter((f) => !f.pass);
    if (!shown.length) continue;

    console.log(`\n${route.path}  (${findings.length} text elements)`);
    for (const f of shown) {
      // Below 1.5:1 the text is effectively invisible, not merely low-contrast.
      const severity = f.ratio < 1.5 ? "INVISIBLE" : f.pass ? "ok" : "LOW";
      if (f.ratio < 1.5) invisible++;
      if (!f.pass) totalFail++;
      console.log(
        `  [${severity}] ${f.ratio}:1 (need ${f.threshold}) ` +
          `fg=${f.fg} bg=${f.bg} ${f.fontSize}px  ${f.selector}\n` +
          `      "${f.text}"`
      );
    }
  }

  await browser.close();

  console.log(
    `\n${totalChecked} text elements checked across ${ROUTES.length} routes` +
      `\n${totalFail} below WCAG AA` +
      `\n${invisible} effectively invisible (< 1.5:1)`
  );
  process.exitCode = totalFail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
