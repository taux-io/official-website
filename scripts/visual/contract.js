// Checks what each route declares to the things that read it — search engines,
// answer engines, browsers, operating systems.
//
//   node scripts/visual/contract.js
//
// Seven of the nine defects found during the redesign lived here rather than in
// anything a person looks at: structured data pointing at an image that renders
// white on white, manifest icons answering 404, no og:image at all, a Chinese
// site declaring lang="en", a policy silently refusing the script that draws a
// chart. All of them are a second's work for a machine and invisible to a
// reader, which is why they survived.
//
// Runs against the same server as the contrast audit and reads the same route
// table, so adding a page in main.go is enough to bring it under test.

const { chromium } = require("playwright");
const { ROUTES, BASE_URL, ORIGIN } = require("../routes");

const VIEWPORT = { width: 1440, height: 900 };

// A page-level assertion.
//
// `contentOnly` marks what a page owes because it is meant to be found and
// shared. Error pages are neither, so a canonical URL, a share card and
// structured data are not part of their contract — requiring them would be
// asserting the wrong thing rather than raising the bar.
//
// `skipStandalone` marks what only applies to documents the Go app renders.
// The two nginx-served error pages carry no app-set headers and must keep
// their retry script inline, since nothing under /static is reachable when the
// backend they announce is down.
const CHECKS = [
  {
    name: "status",
    run: ({ route, status }) =>
      status === route.expectedStatus
        ? null
        : `expected ${route.expectedStatus}, got ${status}`,
  },
  {
    name: "lang",
    run: ({ doc }) =>
      doc.lang === "zh-Hant-TW"
        ? null
        : `expected zh-Hant-TW, got "${doc.lang || "(empty)"}"`,
  },
  {
    name: "canonical",
    contentOnly: true,
    run: ({ route, doc }) => {
      if (!doc.canonical) return "missing";
      return doc.canonical === route.canonical
        ? null
        : `declares ${doc.canonical}, route is ${route.canonical}`;
    },
  },
  {
    name: "share image",
    contentOnly: true,
    run: ({ doc }) => {
      if (!doc.ogImage) return "og:image missing";
      if (!doc.twitterImage) return "twitter:image missing";
      if (doc.ogImage !== doc.twitterImage)
        return "og:image and twitter:image disagree";
      if (doc.ogImageStatus !== 200)
        return `og:image ${doc.ogImage} answers ${doc.ogImageStatus}`;
      if (!doc.ogImageAlt) return "og:image:alt missing";
      if (doc.twitterCard !== "summary_large_image")
        return `twitter:card is "${doc.twitterCard}"`;
      return null;
    },
  },
  {
    name: "structured data",
    contentOnly: true,
    run: ({ doc }) => {
      if (!doc.jsonLd.length) return "no JSON-LD block";
      const broken = doc.jsonLd.filter((b) => !b.parsed);
      if (broken.length) return `${broken.length} block(s) fail to parse`;
      const incomplete = doc.jsonLd.filter((b) => !b.hasContext || !b.hasType);
      if (incomplete.length)
        return `${incomplete.length} block(s) missing @context or @type`;
      return null;
    },
  },
  {
    name: "assets",
    run: ({ doc }) => {
      const bad = doc.assets.filter((a) => a.status !== 200);
      return bad.length
        ? bad.map((a) => `${a.url} -> ${a.status}`).join("; ")
        : null;
    },
  },
  {
    name: "policy",
    // The error pages are the documented exception: their retry script has to
    // be inline to run at all when the app is unreachable, and the app's policy
    // does not apply to them where they are actually served.
    skipStandalone: true,
    run: ({ violations }) => (violations.length ? violations[0] : null),
  },
  {
    name: "no js errors",
    run: ({ errors }) => (errors.length ? errors[0] : null),
  },
];

const READ_DOCUMENT = () => {
  const meta = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute("content") : null;
  };
  const abs = (u) => {
    try {
      return new URL(u, location.href).href;
    } catch {
      return null;
    }
  };

  const assets = new Set();
  document.querySelectorAll("link[rel]").forEach((l) => {
    const rel = (l.getAttribute("rel") || "").toLowerCase();
    if (/stylesheet|icon|manifest|preload/.test(rel) && l.getAttribute("href")) {
      assets.add(abs(l.getAttribute("href")));
    }
  });
  document.querySelectorAll("script[src]").forEach((s) => assets.add(abs(s.src)));
  document.querySelectorAll("img[src]").forEach((i) => assets.add(abs(i.src)));

  return {
    lang: document.documentElement.lang,
    canonical: (document.querySelector("link[rel=canonical]") || {}).href || null,
    ogImage: meta('meta[property="og:image"]'),
    ogImageAlt: meta('meta[property="og:image:alt"]'),
    twitterImage: meta('meta[name="twitter:image"]'),
    twitterCard: meta('meta[name="twitter:card"]'),
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
      (s) => {
        try {
          const d = JSON.parse(s.textContent);
          const nodes = d["@graph"] || [d];
          return {
            parsed: true,
            hasContext: Boolean(d["@context"]),
            hasType: nodes.every((n) => Boolean(n["@type"])),
          };
        } catch {
          return { parsed: false, hasContext: false, hasType: false };
        }
      }
    ),
    assetUrls: [...assets].filter(Boolean),
  };
};

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: "reduce" });
  const page = await context.newPage();

  const failures = [];
  let checked = 0;

  for (const route of ROUTES) {
    const violations = [];
    const errors = [];
    const onConsole = (m) => {
      const t = m.text();
      if (/Content Security Policy|Refused to/i.test(t)) violations.push(t.slice(0, 120));
    };
    const onError = (e) => errors.push(e.message.slice(0, 120));
    page.on("console", onConsole);
    page.on("pageerror", onError);

    const response = await page.goto(BASE_URL + route.path, { waitUntil: "networkidle" });
    const doc = await page.evaluate(READ_DOCUMENT);

    // Resolve every declared URL from the page's own origin, so a share image
    // advertised at the production host is checked against the local build.
    const local = (u) => u.replace(ORIGIN, BASE_URL);
    doc.assets = [];
    for (const url of doc.assetUrls) {
      const r = await page.request.get(local(url));
      doc.assets.push({ url: url.replace(BASE_URL, ""), status: r.status() });
    }
    if (doc.ogImage) {
      const r = await page.request.get(local(doc.ogImage));
      doc.ogImageStatus = r.status();
    }

    page.off("console", onConsole);
    page.off("pageerror", onError);

    const ctx = { route, status: response ? response.status() : 0, doc, violations, errors };
    for (const check of CHECKS) {
      if (check.skipStandalone && route.standalone) continue;
      if (check.contentOnly && route.isError) continue;
      checked++;
      const problem = check.run(ctx);
      if (problem) failures.push({ route: route.path, check: check.name, problem });
    }
  }

  await browser.close();

  if (failures.length) {
    console.log("");
    for (const f of failures) {
      console.log(`  FAIL  ${f.route}`);
      console.log(`        ${f.check}: ${f.problem}`);
    }
  }

  console.log(
    `\n${checked} assertions across ${ROUTES.length} routes` +
      `\n${failures.length} failing`
  );
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
