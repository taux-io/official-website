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
// table, so adding a page to site.toml is enough to bring it under test.

const { launch } = require("../browser");
const { ROUTES, REDIRECTS, BASE_URL, ORIGIN } = require("../routes");

const VIEWPORT = { width: 1440, height: 900 };

// What the host is configured to send, asserted rather than assumed.
const EXPECTED_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://static.cloudflareinsights.com; " +
    "style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

// Two things this site relies on are configured at the Cloudflare zone rather
// than in this repository: HSTS, and the redirect from www to the apex. Neither
// reaches a version preview URL or the local emulator, because neither is part
// of what `wrangler deploy` uploads.
//
// That is the cost of putting them there, and it is paid here: those assertions
// can only run against the production origin. The handling is to say so out
// loud at the end of a run rather than let one report green on assertions it
// never made — the same failure mode as a policy that lived outside the running
// topology and was advertised for months while no response carried it.
const AGAINST_ORIGIN = BASE_URL === ORIGIN;

// The Go server that preceded this sent max-age=31536000. The bar here is the
// widely-used six-month minimum, so that a deliberately shorter zone setting is
// still allowed to pass while an absent or token one is not.
const HSTS_MIN_MAX_AGE = 15552000;

// One representative of each tier. Overlapping rules in the host config produce
// a header carrying two max-age directives, which a browser resolves by taking
// the first — so the value is compared exactly, not merely for presence.
const CACHE_TIERS = {
  "/static/fonts/D-DIN.woff2": "public, max-age=31536000, immutable",
  "/static/og/index.png": "public, max-age=604800",
  "/static/css/styles.min.css": "public, max-age=3600",
};

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
    // A page can answer GET with 200 and HEAD with 404, and every check that
    // loads the page in a browser will pass while it does. taux.io was doing
    // exactly that in production: GET / returned the homepage with 200, HEAD /
    // returned 404. Link checkers, uptime monitors and some crawlers use HEAD,
    // so the homepage read as missing to all of them, and nothing here could
    // see it because a browser never issues HEAD for a navigation.
    name: "head status",
    run: ({ route, headStatus }) =>
      headStatus === route.expectedStatus
        ? null
        : `HEAD expected ${route.expectedStatus}, got ${headStatus} (GET may still be fine — that is the failure)`,
  },
  {
    // The page must declare the language it was rendered as, not one language.
    //
    // This asserted `zh-Hant-TW` flatly, which was right while there was one
    // locale and becomes a false failure the moment there are two — the English
    // page would have been reported broken for correctly saying so. The route
    // knows which locale it is; the page has to agree with it.
    name: "lang",
    run: ({ route, doc }) =>
      doc.lang === route.locale
        ? null
        : `expected ${route.locale}, got "${doc.lang || "(empty)"}"`,
  },
  {
    // hreflang has to be reciprocal or the whole set is discarded: every version
    // lists every version, including itself. And x-default has to name the one
    // path that reads Accept-Language — `/` — rather than any single language.
    //
    // x-default is asserted because getting it wrong is silent. A bulk rewrite
    // of absolute URLs after the locale move pointed it at the Chinese home,
    // which reads as "when in doubt, Chinese" instead of "when in doubt, ask" —
    // valid markup, no error anywhere, and the opposite of the intent.
    name: "hreflang",
    contentOnly: true,
    run: ({ route, doc }) => {
      if (!doc.alternates.length) return null; // untranslated route: nothing to declare
      const self = doc.alternates.find((a) => a.hreflang === route.locale);
      if (!self) return `does not list itself (${route.locale})`;
      if (self.href !== route.canonical) {
        return `lists itself as ${self.href}, canonical is ${route.canonical}`;
      }
      const xd = doc.alternates.find((a) => a.hreflang === "x-default");
      if (!xd) return "no x-default";
      return xd.href === `${ORIGIN}/`
        ? null
        : `x-default is ${xd.href}, must be ${ORIGIN}/ — the path that reads Accept-Language`;
    },
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
    // Two assertions, not one. The first catches the policy going missing, the
    // second catches it blocking something it should not.
    //
    // Only the second existed to begin with, and it passes when there is no
    // policy at all: no header means no violations means green. That is the
    // failure this project has already had once — a policy that lived in a
    // config file outside the running topology, advertised in the README,
    // never sent. A check that reports success when the thing it checks has
    // disappeared is worse than no check.
    name: "policy",
    skipStandalone: true,
    run: ({ headers, violations }) => {
      const sent = headers["content-security-policy"];
      if (!sent) return "no Content-Security-Policy header";
      if (sent !== EXPECTED_HEADERS["content-security-policy"]) {
        return `policy differs from the expected value: ${sent}`;
      }
      return violations.length ? violations[0] : null;
    },
  },
  {
    // The headers the host is configured to send. Nothing else verifies that
    // _headers reaches a response — the byte comparison covers HTML, not what
    // is wrapped around it.
    name: "security headers",
    skipStandalone: true,
    run: ({ headers }) => {
      const missing = Object.entries(EXPECTED_HEADERS)
        .filter(([k]) => k !== "content-security-policy")
        .filter(([k, v]) => headers[k] !== v)
        .map(([k, v]) => `${k}: expected "${v}", got "${headers[k] || "(absent)"}"`);
      return missing.length ? missing.join("; ") : null;
    },
  },
  {
    // Three tiers, and until now none of them were tested. A font served with
    // an hour's cache instead of a year is invisible: nothing breaks, the site
    // is simply slower for everyone who comes back.
    name: "cache tiers",
    skipStandalone: true,
    run: async ({ request }) => {
      const problems = [];
      for (const [url, expected] of Object.entries(CACHE_TIERS)) {
        const r = await request.get(BASE_URL + url);
        const got = r.headers()["cache-control"];
        if (got !== expected) {
          problems.push(`${url}: expected "${expected}", got "${got || "(absent)"}"`);
        }
      }
      return problems.length ? problems.join("; ") : null;
    },
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
    alternates: [...document.querySelectorAll("link[rel=alternate][hreflang]")].map((l) => ({
      hreflang: l.getAttribute("hreflang"),
      href: l.href,
    })),
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
  const browser = await launch();
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

    // Assets referenced from inside other assets are the ones that go missing
    // unnoticed: a manifest names its icons, a stylesheet names its fonts, and
    // neither appears in the DOM. The first version of this check walked the
    // DOM only — so a 404ing manifest icon passed, which is the exact defect
    // the ticket cites as its reason for existing.
    const queue = [...doc.assetUrls];
    const seen = new Set();
    doc.assets = [];
    while (queue.length) {
      const url = queue.shift();
      if (seen.has(url)) continue;
      seen.add(url);

      const r = await page.request.get(local(url));
      doc.assets.push({ url: url.replace(BASE_URL, ""), status: r.status() });
      if (r.status() !== 200) continue;

      const abs = (ref) => new URL(ref, local(url)).href.replace(BASE_URL, ORIGIN);
      if (/\.webmanifest(\?|$)/.test(url)) {
        try {
          for (const icon of (await r.json()).icons || []) {
            if (icon.src) queue.push(abs(icon.src));
          }
        } catch {
          doc.assets.push({ url: url.replace(BASE_URL, "") + " (unparseable)", status: 0 });
        }
      } else if (/\.css(\?|$)/.test(url)) {
        const css = await r.text();
        for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
          if (!m[1].startsWith("data:")) queue.push(abs(m[1]));
        }
      }
    }
    if (doc.ogImage) {
      const r = await page.request.get(local(doc.ogImage));
      doc.ogImageStatus = r.status();
    }

    page.off("console", onConsole);
    page.off("pageerror", onError);

    // Issued separately from the navigation, because a browser never sends HEAD
    // to load a page and so cannot reveal a host that answers it differently.
    const head = await page.request.fetch(BASE_URL + route.path, { method: "HEAD" });

    const ctx = {
      route,
      status: response ? response.status() : 0,
      headStatus: head.status(),
      headers: response ? response.headers() : {},
      request: page.request,
      doc,
      violations,
      errors,
    };
    for (const check of CHECKS) {
      if (check.skipStandalone && route.standalone) continue;
      if (check.contentOnly && route.isError) continue;
      checked++;
      const problem = await check.run(ctx);
      if (problem) failures.push({ route: route.path, check: check.name, problem });
    }
  }

  // The control-hierarchy explainer on /what-is-mcp.
  //
  // Asserted here rather than in CHECKS because it is one page's behaviour, not
  // a site-wide contract. What is worth testing is what a reader would notice:
  // that choosing a scenario changes which answer is on screen, that the choice
  // is announced, and that a keyboard can reach the next one. The implementation
  // — tablist roles, which element holds tabindex — is deliberately not
  // asserted; that is the shape of the thing, not its behaviour, and pinning it
  // would make the test an obstacle to improving the widget.
  try {
    const path = "/what-is-mcp";
    await page.goto(BASE_URL + path, { waitUntil: "networkidle" });

    const visible = () =>
      page.$$eval("[data-panel]", (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.panel));

    checked++;
    const first = await visible();
    if (first.length !== 1) {
      failures.push({
        route: path,
        check: "primitives: one answer at a time",
        problem: `${first.length} panels visible with the script running, expected 1`,
      });
    }

    checked++;
    await page.click('[data-scenario="tool"]');
    const afterClick = await visible();
    if (afterClick.join() !== "tool") {
      failures.push({
        route: path,
        check: "primitives: choosing a scenario changes the answer",
        problem: `clicked "tool", visible panel is ${afterClick.join() || "none"}`,
      });
    }

    checked++;
    // Every tab's state, not just the clicked one. Reading only the tab that was
    // clicked cannot tell "one is selected" from "all of them are".
    const announced = await page.$$eval("[data-scenario]", (els) =>
      els.map((e) => `${e.dataset.scenario}=${e.getAttribute("aria-selected")}`).join(" ")
    );
    if (announced !== "resource=false tool=true prompt=false") {
      failures.push({
        route: path,
        check: "primitives: exactly one choice is announced",
        problem: `aria-selected reads "${announced}"`,
      });
    }

    checked++;
    await page.focus('[data-scenario="tool"]');
    await page.keyboard.press("ArrowRight");
    const afterKey = await visible();
    const focused = await page.evaluate(() => document.activeElement.dataset.scenario);
    if (afterKey.join() !== "prompt" || focused !== "prompt") {
      failures.push({
        route: path,
        check: "primitives: a keyboard reaches the next scenario",
        problem: `ArrowRight left panel=${afterKey.join() || "none"} focus=${focused}`,
      });
    }
  } catch (err) {
    // A missing or renamed widget is one failure to report, not a reason to
    // lose every assertion that would have run after this block.
    checked++;
    failures.push({
      route: "/what-is-mcp",
      check: "primitives: widget present",
      problem: String(err && err.message ? err.message : err),
    });
  }

  // The classic static-host mistake: the 404 document served at a 200, which
  // Google reads as a soft 404 and can cost the paths around it their place in
  // the index. It is not a route, so it is asserted here rather than in CHECKS.
  {
    checked++;
    const res = await page.goto(BASE_URL + "/this-path-does-not-exist", {
      waitUntil: "domcontentloaded",
    });
    const status = res ? res.status() : 0;
    if (status !== 404) {
      failures.push({
        route: "(unmatched path)",
        check: "not found",
        problem: `expected 404, got ${status}`,
      });
    }

    // The status alone was already correct before `not_found_handling` was set,
    // because the host answers an unmatched path with its own bare 404 — plain
    // text, no markup, none of this site's language or navigation. The status
    // is what crawlers read; the body is what a person is left looking at, and
    // only one of the two was ever being checked.
    checked++;
    const body = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      title: document.title,
      type: document.contentType,
    }));
    if (body.type !== "text/html") {
      failures.push({
        route: "(unmatched path)",
        check: "not found body",
        problem: `served as ${body.type}, so it is the host's own error page rather than 404.html`,
      });
    } else if (body.lang !== "zh-Hant-TW" || !body.title) {
      failures.push({
        route: "(unmatched path)",
        check: "not found body",
        problem: `lang "${body.lang || "(empty)"}", title "${body.title || "(empty)"}" — not this site's 404 document`,
      });
    }
  }

  // Retired paths.
  //
  // A redirect that stops working has one symptom — an old URL answering 404 —
  // and nobody who still has that URL is in a position to report it. So it is
  // asserted from the same table the generator emits _redirects from: one
  // declaration, checked on both sides.
  //
  // Both the status and the destination are compared. A 301 to the wrong place
  // is still a broken promise, and a 302 would tell search engines to keep the
  // old URL indexed, which is the opposite of retiring it.
  for (const redirect of REDIRECTS) {
    checked++;
    const res = await page.request.get(BASE_URL + redirect.from, { maxRedirects: 0 });
    const location = res.headers()["location"];
    if (res.status() !== redirect.status) {
      failures.push({
        route: redirect.from,
        check: "retired path",
        problem: `expected ${redirect.status}, got ${res.status()}`,
      });
    } else if (location !== redirect.to && location !== BASE_URL + redirect.to) {
      failures.push({
        route: redirect.from,
        check: "retired path",
        problem: `redirects to ${location || "(no Location header)"}, expected ${redirect.to}`,
      });
    } else {
      // And the destination has to exist.
      //
      // Comparing the Location header against site.toml only proves the host
      // emits what was declared — both sides read the same table, so they
      // agree by construction. A one-character typo in `to` produced a
      // perfectly conformant 301 into a 404 and this check called it a pass.
      //
      // The destination is not necessarily a route: a retired page takes its
      // share card with it, and that lands on an image. So this asks for
      // anything that is not an error rather than asserting a 200 HTML page.
      const dest = await page.request.get(BASE_URL + redirect.to, { maxRedirects: 5 });
      if (dest.status() >= 400) {
        failures.push({
          route: redirect.from,
          check: "retired path",
          problem: `redirects to ${redirect.to}, which answers ${dest.status()}`,
        });
      }
    }
  }

  // Configured at the zone, so only observable from the zone. See AGAINST_ORIGIN.
  const skipped = [];
  if (AGAINST_ORIGIN) {
    checked++;
    const res = await page.request.get(ORIGIN + "/");
    const hsts = res.headers()["strict-transport-security"];
    const maxAge = hsts && /max-age=(\d+)/.exec(hsts);
    if (!hsts) {
      failures.push({
        route: "/",
        check: "hsts",
        problem: "no Strict-Transport-Security header",
      });
    } else if (!maxAge || Number(maxAge[1]) < HSTS_MIN_MAX_AGE) {
      failures.push({
        route: "/",
        check: "hsts",
        problem: `max-age below ${HSTS_MIN_MAX_AGE}: "${hsts}"`,
      });
    }

    // Asserted on a path rather than the bare host, because a redirect rule
    // that drops everything after the origin sends every indexed www URL to the
    // homepage and looks correct when the only thing tried was "/".
    //
    // Node's fetch rather than Playwright's request context: the latter throws
    // when maxRedirects is exceeded instead of handing back the 3xx, so there
    // would be no Location header left to compare against.
    const WWW = ORIGIN.replace("://", "://www.");
    for (const path of ["/", "/geo-guide"]) {
      checked++;
      const r = await fetch(WWW + path, { redirect: "manual" });
      const location = r.headers.get("location");
      if (r.status !== 301) {
        failures.push({
          route: "www" + path,
          check: "www redirect",
          problem: `expected 301, got ${r.status}`,
        });
      } else if (location !== ORIGIN + path) {
        failures.push({
          route: "www" + path,
          check: "www redirect",
          problem: `redirects to ${location || "(no Location)"}, expected ${ORIGIN + path}`,
        });
      }
    }

    // THE LANGUAGE NEGOTIATION ON `/`, WHICH IS THE ONLY ZONE SETTING WITH A
    // RIGHT ANSWER PER REQUEST RATHER THAN ONE ANSWER.
    //
    // Redirect Rules cannot read `http.request.accepted_languages` — that
    // parsed, q-weight-sorted field is Transform Rules only — so the rules
    // match a prefix of the raw header instead. That works because browsers
    // already send the header in preference order, and this asserts exactly
    // that behaviour rather than the rule text, which lives in a dashboard
    // nobody can diff.
    //
    // The last row is the one that catches a missing rule set: with no rules at
    // all, every other row still passes by falling through to the canonical
    // locale. Only a header that must NOT reach the default proves the rules
    // are there.
    for (const [header, want] of [
      ["zh-TW,zh;q=0.9", "/zh-Hant-TW"],
      ["zh-CN,zh;q=0.9", "/zh-Hans-CN"],
      ["zh-Hans,zh;q=0.9", "/zh-Hans-CN"],
      ["en-GB,en;q=0.9", "/en-US"],
      ["de-DE,de;q=0.9", "/zh-Hant-TW"],
      ["", "/zh-Hant-TW"],
    ]) {
      checked++;
      const r = await fetch(ORIGIN + "/", {
        redirect: "manual",
        headers: header ? { "accept-language": header } : {},
      });
      const location = r.headers.get("location");
      const label = `/ (Accept-Language: ${header || "absent"})`;
      // 302 for every one of them, including the fallthrough. A 301 here would
      // be cached and outlive the preference that produced it; a 301 for bots
      // and a 302 for readers would be a response that varies by User-Agent,
      // which is one step from cloaking (decision #59).
      if (r.status !== 302) {
        failures.push({
          route: label,
          check: "language negotiation",
          problem: `expected 302, got ${r.status}`,
        });
      } else if (location !== want && location !== ORIGIN + want) {
        failures.push({
          route: label,
          check: "language negotiation",
          problem: `sent to ${location || "(no Location)"}, expected ${want}`,
        });
      }
    }
  } else {
    skipped.push(
      "hsts, www redirect and the language negotiation on / — configured at the",
      `Cloudflare zone, so they are not observable from ${BASE_URL}.`,
      `Run with BASE_URL=${ORIGIN} to assert them.`
    );
  }

  await browser.close();

  if (failures.length) {
    console.log("");
    for (const f of failures) {
      console.log(`  FAIL  ${f.route}`);
      console.log(`        ${f.check}: ${f.problem}`);
    }
  }

  // Printed on every run that did not make them, so that "0 failing" is never
  // read as "everything was checked".
  if (skipped.length) {
    console.log("\n  NOT ASSERTED");
    for (const line of skipped) console.log(`        ${line}`);
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
