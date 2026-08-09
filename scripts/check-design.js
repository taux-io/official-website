// Reports templates that contradict DESIGN.md.
//
//   node scripts/check-design.js
//
// DESIGN.md is the single source of design truth, and its opening argument is
// that a rule nothing checks is not a rule. Three earlier generations of design
// description drifted from the code without anyone noticing — one of them
// claimed no template carries a hex value while asserting the opposite about a
// page whose "hex values" turned out to be escaped braces. This is the checker
// that makes the drift impossible to keep.
//
// It reads what the *author wrote* — the templates and the route table — and
// never the built stylesheet. check-unknown-classes.js is the other direction:
// it asks whether Tailwind actually emitted something for what was written.
// Both are needed and neither substitutes for the other.
//
// The threshold is clean rather than "no worse than yesterday". Set while the
// codebase is clean, it needs no list of tolerated exceptions — and an
// exceptions list is precisely how a check decays into a warning nobody reads.
//
// RULES ARE SWITCHED ON BY THE TICKET THAT MAKES THEM SATISFIABLE. Landing a
// rule disabled and flipping it in the change that earns it is what keeps CI
// green commit to commit without an allowlist. A rule that is off says so, and
// says which ticket turns it on.
//
// The first six hold today and have since #66. Three more land disabled with
// the DESIGN-NEXT migration (#125) and are turned on by the stage that makes
// each satisfiable.

const fs = require("fs");
const path = require("path");
const { parse } = require("smol-toml");

const ROOT = path.join(__dirname, "..");
const TEMPLATES = path.join(ROOT, "templates");
const SITE = path.join(ROOT, "site.toml");

// ---------------------------------------------------------------------------
// The scale, from DESIGN.md's "字級與字距刻度" table. Any arbitrary tracking
// value outside this set is a one-off, which is the thing the table exists to
// prevent: the reference site's tracking changes sign with size, so it is one
// scale rather than a handful of independently chosen numbers.
const TRACKING_SCALE = new Set(["0", "0em", "0.09em", "0.02em", "-0.017em"]);

// Controls are the only thing that takes a corner radius or an outline —
// buttons, inputs, selects, tags. Everything else is layout, and layout is
// square. `rounded-full` is exempt everywhere because a true circle (gauge,
// orbit, avatar) belongs to this vocabulary in a way a rounded rectangle does
// not.
const CONTROL_TAGS = new Set(["button", "input", "select", "textarea"]);
const CONTROL_CLASSES = ["btn", "tag"];

// The full-screen menu rests at opacity-0 and is revealed by the menu script.
// That is a disclosure, not a scroll reveal: it is driven by a click, it has no
// scroll listener and no observer, and its content is in the document for
// crawlers either way. It is the single structural exemption in this file, and
// it is named here rather than pattern-matched so that a second one cannot be
// added without saying so out loud.
const OPACITY_EXEMPT_IDS = new Set(["menuOverlay"]);

// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// Numeric character references have to go before anything looks for a hex
// colour. The templates escape their braces as &#123; and &#125; so minijinja
// does not read a code sample as a template expression, and a naive
// /#[0-9a-f]{3}/ reads twenty of those as colours — which is exactly what an
// earlier draft of DESIGN.md did, reporting a page as the worst offender in the
// codebase when its real count was zero. A checker whose first run is twenty
// false positives teaches people to skip it.
//
// Fragment hrefs go too: `#contact-us` is not a colour, and `#abc` would
// otherwise be indistinguishable from one.
function maskNonColourHashes(html) {
  return html
    .replace(/&#x?[0-9a-fA-F]+;/g, (m) => " ".repeat(m.length))
    .replace(/href="#[^"]*"/g, (m) => " ".repeat(m.length));
}

// Every opening tag with its attributes, so a rule can ask what kind of element
// it is looking at rather than guessing from the class name alone.
function* elements(html) {
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
    const attrs = m[2];
    const cls = /class="([^"]*)"/.exec(attrs);
    const id = /id="([^"]*)"/.exec(attrs);
    yield {
      tag: m[1].toLowerCase(),
      classes: cls ? cls[1].split(/\s+/).filter(Boolean) : [],
      id: id ? id[1] : null,
      index: m.index,
    };
  }
}

const stripVariants = (c) => c.replace(/^(?:(?:[a-z0-9-]+|\[[^\]]*\]):)+/, "");

// A genuine circle declares equal width and height. Reading the classes beats
// measuring in a browser: this checker reads authored intent, and an element
// that means to be a circle says so.
function squareSized(classes) {
  const dim = (p) => {
    const m = classes.map(stripVariants).find((c) => new RegExp(`^${p}-`).test(c));
    return m ? m.slice(p.length + 1) : null;
  };
  const w = dim("w");
  const h = dim("h");
  return w !== null && w === h;
}

// Every `{% include "x.html" %}` a template pulls in, in both spellings the
// templates use — some carry a space after the keyword and some do not.
function includesOf(html) {
  return [...html.matchAll(/\{%-?\s*include\s*"([^"]+)"\s*-?%\}/g)].map((m) => m[1]);
}

// The ids a page declares and the fragment hrefs it contains, assembled the way
// minijinja assembles the page rather than read from one file.
//
// This has to follow the includes. A fragment resolves against the *rendered*
// document, and the header and footer contribute ids to every page — so a rule
// that read a single template would both miss ids that are really there and be
// unable to say anything about a link written in a partial.
function reachable(name, byName, seen = new Set()) {
  const ids = new Set();
  const hrefs = [];
  if (seen.has(name)) return { ids, hrefs };
  seen.add(name);

  const f = byName.get(name);
  if (!f) return { ids, hrefs };

  for (const el of elements(f.html)) {
    if (el.id) ids.add(el.id);
  }
  for (const m of f.html.matchAll(/href="([^"]*#[^"]*)"/g)) {
    hrefs.push({ file: f.rel, line: lineOf(f.html, m.index), href: m[1] });
  }

  for (const inc of includesOf(f.html)) {
    const child = reachable(inc, byName, seen);
    for (const id of child.ids) ids.add(id);
    hrefs.push(...child.hrefs);
  }
  return { ids, hrefs };
}

// ---------------------------------------------------------------------------
// Rules. Each returns a list of {file, line, detail}.

function ruleNoHex(files) {
  const found = [];
  for (const { rel, html } of files) {
    const masked = maskNonColourHashes(html);
    for (const m of masked.matchAll(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) {
      found.push({ file: rel, line: lineOf(masked, m.index), detail: m[0] });
    }
  }
  return found;
}

// A reveal that starts invisible and depends on a script to undo it makes the
// text conditional on that script running. This site shipped one: an
// IntersectionObserver released elements as they scrolled in, a fast scroll
// outran the observer, and nineteen elements on the home page stayed invisible
// permanently. The reference site has none of this — zero elements below the
// fold sit under opacity 1.
function ruleNoScrollReveal(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const el of elements(html)) {
      if (el.classes.some((c) => stripVariants(c) === "opacity-0")) {
        if (el.id && OPACITY_EXEMPT_IDS.has(el.id)) continue;
        found.push({
          file: rel,
          line: lineOf(html, el.index),
          detail: `<${el.tag}> starts at opacity-0`,
        });
      }
      const stagger = el.classes.find((c) => /^animate-stagger/.test(stripVariants(c)));
      if (stagger) {
        found.push({ file: rel, line: lineOf(html, el.index), detail: stagger });
      }
    }
  }
  return found;
}

function ruleTrackingScale(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/tracking-\[([^\]]+)\]/g)) {
      if (TRACKING_SCALE.has(m[1])) continue;
      found.push({ file: rel, line: lineOf(html, m.index), detail: m[0] });
    }
  }
  return found;
}

function ruleRadiusOnControlsOnly(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const el of elements(html)) {
      const radii = el.classes.filter((c) => /^rounded(-|$)/.test(stripVariants(c)));
      if (!radii.length) continue;

      const isControl =
        CONTROL_TAGS.has(el.tag) ||
        el.classes.some((c) => CONTROL_CLASSES.includes(stripVariants(c)));

      // rounded-full is the exemption for genuine circles — gauges, orbits,
      // avatars, the dot in a list. A pill-shaped button abuses it: it is a
      // rounded rectangle wearing the circle's exemption, and three of them
      // passed this rule before it was tightened. A circle has equal width and
      // height, and says so in its own classes.
      const square = squareSized(el.classes);

      for (const r of radii) {
        if (stripVariants(r) === "rounded-full" && (square || isControl)) continue;
        if (stripVariants(r) !== "rounded-full" && isControl) continue;
        found.push({
          file: rel,
          line: lineOf(html, el.index),
          detail:
            stripVariants(r) === "rounded-full"
              ? `${r} on <${el.tag}> without equal width and height — a pill, not a circle`
              : `${r} on <${el.tag}>`,
        });
      }
    }
  }
  return found;
}

// CJK has no uppercase, so the typographic signature of this vocabulary — bold,
// uppercase, set tighter than its own size — can only be carried by a Latin
// line. Every H1 is therefore two lines: a Latin lead and a Chinese sub. The
// route table is read rather than the template directory so that a page added
// to the site cannot quietly skip this.
function ruleHeadingStructure(files) {
  const found = [];
  const site = parse(fs.readFileSync(SITE, "utf8"));
  const declared = [...(site.page || []), ...(site.document || [])].map((p) => p.template);
  const byName = new Map(files.map((f) => [path.basename(f.rel), f]));

  for (const template of declared) {
    const f = byName.get(template);
    if (!f) {
      found.push({ file: `site.toml`, line: 0, detail: `declares missing template ${template}` });
      continue;
    }
    const headings = [...f.html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    if (!headings.length) {
      found.push({ file: f.rel, line: 0, detail: "no <h1>" });
      continue;
    }
    for (const h of headings) {
      const missing = ["display-lead", "display-sub"].filter((c) => !h[1].includes(c));
      if (missing.length) {
        found.push({
          file: f.rel,
          line: lineOf(f.html, h.index),
          detail: `<h1> missing ${missing.join(" and ")}`,
        });
      }
    }
  }
  return found;
}

// A fragment link that resolves to nothing fails in the one way nobody sees:
// the page renders, the link is clickable, and it simply does not move. Rename
// a section id and every index and table of contents pointing at it dies
// silently — which is the failure the section index and the mobile overview
// table on the guides would otherwise be one careless edit away from.
//
// Two kinds of link, resolved differently:
//
//   `#frag`       against the page it is written on. A link in the footer is
//                 therefore checked against every page, because that is where
//                 it ends up, and it has to resolve on all of them.
//   `/path#frag`  against the page `path` names. Cross-page links do not depend
//                 on where they were written, so they are checked once rather
//                 than once per page that includes them.
//
// Anything carrying a scheme or an authority belongs to another origin and its
// fragment is not ours to resolve. A bare `href="#"` is a deliberate no-op, not
// a reference to an element.
function ruleAnchorIntegrity(files) {
  const found = [];
  const site = parse(fs.readFileSync(SITE, "utf8"));
  const byName = new Map(files.map((f) => [path.basename(f.rel), f]));

  const templateFor = new Map((site.page || []).map((p) => [p.path, p.template]));

  const idCache = new Map();
  const idsOf = (template) => {
    if (!idCache.has(template)) idCache.set(template, reachable(template, byName).ids);
    return idCache.get(template);
  };

  // Rendered documents (the error page) carry the same header and footer, so
  // they are walked too — but they are not routes, so nothing can link to them.
  const rendered = [
    ...(site.page || []).map((p) => ({ template: p.template, where: p.path })),
    ...(site.document || []).map((d) => ({ template: d.template, where: `(${d.output})` })),
  ];

  const crossPage = new Map();

  for (const { template, where } of rendered) {
    for (const { file, line, href } of reachable(template, byName).hrefs) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;

      const cut = href.indexOf("#");
      const target = href.slice(0, cut);
      const frag = href.slice(cut + 1);
      if (!frag) continue;

      if (!target) {
        if (!idsOf(template).has(frag)) {
          found.push({
            file,
            line,
            detail: `#${frag} does not resolve on ${where}`,
          });
        }
        continue;
      }

      // Deduped: the same cross-page link written in a partial reaches every
      // page, but its correctness has nothing to do with which page it is on.
      crossPage.set(`${file}:${line}:${href}`, { file, line, target, frag });
    }
  }

  for (const { file, line, target, frag } of crossPage.values()) {
    const template = templateFor.get(target);
    if (!template) {
      found.push({ file, line, detail: `${target}#${frag} — no page declares ${target}` });
      continue;
    }
    if (!idsOf(template).has(frag)) {
      found.push({ file, line, detail: `${target}#${frag} — ${target} declares no such id` });
    }
  }

  return found;
}

// ---------------------------------------------------------------------------

// A tag scanner that tracks nesting, so a rule can ask two questions the flat
// `elements()` generator cannot answer: where does this element's subtree end,
// and what is it inside?
//
// The first draft of the two rules below did both with string arithmetic —
// `html.indexOf("</div>", start)` for the subtree and "does `data-specimen`
// appear earlier in the file" for containment. Both are wrong in the direction
// that reports success: the first stops at the *inner* close tag of any nested
// same-tag element, so a decorative empty div in front of a heading hides the
// heading; the second lets one specimen block near the top of a file exempt
// everything below it.
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "source", "track", "wbr",
]);

function parseElements(html) {
  const nodes = [];
  const stack = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)(\/?)>/g)) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (closing) {
      // Tolerate stray close tags by unwinding to the nearest matching open
      // rather than assuming the document is well formed.
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack[i].contentEnd = m.index;
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const attrs = m[3] || "";
    const cls = /class="([^"]*)"/.exec(attrs);
    const node = {
      tag,
      attrs,
      classes: cls ? cls[1].split(/\s+/).filter(Boolean) : [],
      index: m.index,
      contentStart: m.index + m[0].length,
      contentEnd: null,
      ancestors: stack.slice(),
    };
    nodes.push(node);
    if (VOID_TAGS.has(tag) || m[4] === "/") node.contentEnd = node.contentStart;
    else stack.push(node);
  }
  // Anything still open at EOF owns the rest of the file.
  for (const open of stack) open.contentEnd = html.length;
  return nodes;
}

const subtreeText = (html, node) =>
  html
    .slice(node.contentStart, node.contentEnd)
    .replace(/<[^>]*>/g, "")
    .replace(/&#x?[0-9a-fA-F]+;/g, "")
    .trim();

const hasAttr = (node, re) => re.test(node.attrs) || node.ancestors.some((a) => re.test(a.attrs));

// Every template a route actually renders, resolved through its includes, with
// the file each element really came from. Two rules need this and they used to
// disagree about it: one walked rendered pages and the other walked raw files,
// so a partial that only 404.html includes was judged as though it were a page.
function renderedNodes(name, byName, chain = []) {
  const out = [];
  // Guard cycles, not repetition. A shared partial reached from both the header
  // and the footer renders TWICE on the page, and a budget counted against the
  // rendered page has to see both — memoising on "visited anywhere" would hide
  // half of _nav-columns.html and let a page ship double the budget while the
  // checker reported it inside.
  if (chain.includes(name)) return out;
  const f = byName.get(name);
  if (!f) return out;

  for (const node of parseElements(f.html)) {
    out.push({ node, file: f.rel, line: lineOf(f.html, node.index), html: f.html });
  }
  const next = [...chain, name];
  for (const inc of includesOf(f.html)) out.push(...renderedNodes(inc, byName, next));
  return out;
}

function routeTemplates(files) {
  const site = parse(fs.readFileSync(SITE, "utf8"));
  const declared = [...(site.page || []), ...(site.document || [])].map((p) => p.template);
  const byName = new Map(files.map((f) => [path.basename(f.rel), f]));
  return { declared, byName };
}

// ---------------------------------------------------------------------------

// Phosphor is the first non-ink colour this vocabulary has ever carried, and the
// argument for adding it (DESIGN.md decision #27) rests entirely on it staying
// rare: a dither texture needs one dimension to separate structure from noise,
// and the moment there are eight of them on a page it has become a second body
// colour. The budget is the gate on that.
//
// It counts against the *rendered* page rather than the file, because a phosphor
// element in the footer appears once in the source and on every page of the
// site. That is the same reason ruleAnchorIntegrity resolves through includes.
const PHOSPHOR_BUDGET = 5;

// Any utility whose colour slot resolves to the token, not a hand-listed six.
// `theme.extend.colors.phosphor` makes Tailwind emit text-, bg-, border-, ring-,
// shadow-, outline-, divide-, accent-, caret-, placeholder-, fill-, stroke-,
// decoration- and the gradient from-/via-/to- forms; enumerating a subset is how
// a budget silently stops counting. The opacity tail accepts both `/50` and the
// arbitrary `/[0.06]` a low-alpha dither panel is written with.
const PHOSPHOR_CLASS = /(?:^|-)phosphor(?:\/(?:\d+|\[[^\]]*\]))?$/;
// The arbitrary-value spelling reaches the same token by another road:
// text-[var(--phosphor)], bg-[rgb(var(--phosphor-rgb))]. Counting only the
// named utility would leave a documented escape hatch through the budget.
const PHOSPHOR_ARBITRARY = /-\[[^\]]*--phosphor[^\]]*\]$/;
const isPhosphor = (c) => PHOSPHOR_CLASS.test(c) || PHOSPHOR_ARBITRARY.test(c);

// Component classes that apply phosphor in src/input.css count wherever they
// are used. Without this a single `@apply bg-phosphor` inside .some-panel makes
// every instance of that panel invisible to the budget.
function phosphorComponentClasses() {
  const css = path.join(ROOT, "src", "input.css");
  if (!fs.existsSync(css)) return new Set();
  const text = fs.readFileSync(css, "utf8");
  const out = new Set();
  for (const m of text.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g)) {
    if (/--phosphor|@apply[^;]*\bphosphor\b/.test(m[2])) out.add(m[1]);
  }
  return out;
}

function rulePhosphorBudget(files) {
  const found = [];
  const { declared, byName } = routeTemplates(files);

  for (const template of declared) {
    if (!byName.has(template)) continue; // ruleHeadingStructure already reports this
    const component = phosphorComponentClasses();
    const hits = renderedNodes(template, byName).filter(({ node }) =>
      node.classes.map(stripVariants).some((c) => isPhosphor(c) || component.has(c))
    );
    if (hits.length <= PHOSPHOR_BUDGET) continue;

    // Report where the offending element actually lives. Pairing the entry
    // template's name with a line number that came from footer.html sends the
    // reader to unrelated markup, on a rule whose only job is to point at the
    // element to delete.
    const over = hits[PHOSPHOR_BUDGET];
    found.push({
      file: over.file,
      line: over.line,
      detail: `${hits.length} phosphor elements on ${template} once includes are resolved, budget is ${PHOSPHOR_BUDGET}`,
    });
  }
  return found;
}

// The contrast audit composites an element's background by walking its ancestor
// chain, and it gives up the moment it meets a background-image — returning
// "unresolved" and skipping the element rather than failing it. A gradient over
// text therefore does not turn CI red; it makes the audit blind while it carries
// on reporting success. DESIGN.md refused photography for this same reason.
//
// Texture belongs on a sibling or in a font glyph, not on an ancestor of text.
// This reads templates, so a background-image introduced in input.css is out of
// its reach — that limit is real and is recorded in DESIGN.md decision #32.
// Both quote styles, and the `background:` shorthand — `background: url(...)`
// and `background: linear-gradient(...)` set background-image just as surely as
// the longhand does.
const BG_IMAGE_INLINE = /style=("|')[^"']*background(-image)?\s*:[^"']*(url\(|gradient)/i;
// The idiomatic way to add one in this codebase is a utility, not a style
// attribute: bg-[url(...)] and every gradient helper resolve to background-image.
// Bare bg-radial / bg-conic, every gradient direction, and the arbitrary-value
// form bg-[linear-gradient(...)] / bg-[image:...]. Enumerating a subset is how a
// rule that was just switched on goes quietly blind.
const BG_IMAGE_CLASS = /^bg-(?:\[(?:url|image|linear|radial|conic)|gradient-|linear-|radial-|conic-)/;

function ruleTextureNotBehindText(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      const inline = BG_IMAGE_INLINE.test(node.attrs);
      const utility = node.classes.map(stripVariants).some((c) => BG_IMAGE_CLASS.test(c));
      if (!inline && !utility) continue;
      if (!subtreeText(html, node)) continue;

      found.push({
        file: rel,
        line: lineOf(html, node.index),
        detail: "background-image on an ancestor of text blinds the contrast audit",
      });
    }
  }
  return found;
}

// Departure Mono's advance is 6% wider than Roboto Mono's, so it cannot share a
// text run with anything — mixing it shears every column. It is also drawn on an
// 11px lattice and only lands on whole pixels at multiples of that size, so it
// cannot ride the responsive type scale either.
//
// It is therefore allowed in exactly two places: the 404 document, which is a
// whole page set in it, and blocks explicitly marked as specimens.
const PIXEL_TEMPLATES = new Set(["404.html"]);
const SPECIMEN = /\bdata-specimen\b/;

// Component classes in input.css that reach Departure Mono, so a .foo built on
// @apply font-pixel is caught the same as the utility itself.
function pixelComponentClasses() {
  const css = path.join(ROOT, "src", "input.css");
  if (!fs.existsSync(css)) return new Set();
  const text = fs.readFileSync(css, "utf8");
  const out = new Set();
  for (const m of text.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g)) {
    if (/font-pixel|Departure Mono/.test(m[2])) out.add(m[1]);
  }
  return out;
}

function rulePixelScope(files) {
  const found = [];
  const pixelComponents = pixelComponentClasses();
  const { declared, byName } = routeTemplates(files);
  const seenAt = new Set();

  for (const template of declared) {
    if (PIXEL_TEMPLATES.has(template) || !byName.has(template)) continue;
    for (const { node, file, line } of renderedNodes(template, byName)) {
      const cls = node.classes.map(stripVariants);
      // The literal utility, an arbitrary font value naming the face, and any
      // component class that applies the pixel stack in input.css.
      const pixel =
        cls.includes("font-pixel") ||
        cls.some((c) => /^font-\[.*[Dd]eparture/.test(c)) ||
        cls.some((c) => pixelComponents.has(c));
      if (!pixel) continue;
      // A specimen marks itself or an ancestor of itself — not merely something
      // earlier in the same file.
      if (hasAttr(node, SPECIMEN)) continue;

      // A partial reached from several routes is one defect, not one per route.
      const key = `${file}:${line}`;
      if (seenAt.has(key)) continue;
      seenAt.add(key);

      found.push({
        file,
        line,
        detail: "font-pixel outside 404.html and outside a data-specimen block",
      });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------

const RULES = [
  {
    name: "zero hex",
    enabled: true,
    turnedOnBy: "#50",
    run: ruleNoHex,
    summary: "colour values belong to the tokens in src/input.css, not the templates",
  },
  {
    name: "no scroll reveal",
    enabled: true,
    turnedOnBy: "#50",
    run: ruleNoScrollReveal,
    summary: "content must be painted, not revealed by a script that may not run",
  },
  {
    name: "tracking scale",
    enabled: true,
    turnedOnBy: "#53",
    run: ruleTrackingScale,
    summary: "arbitrary tracking must come from the scale in DESIGN.md",
  },
  {
    name: "radius on controls only",
    enabled: true,
    turnedOnBy: "#66",
    run: ruleRadiusOnControlsOnly,
    summary: "corners are for things you can touch; layout is square",
  },
  {
    name: "heading structure",
    enabled: true,
    turnedOnBy: "#55",
    run: ruleHeadingStructure,
    summary: "every H1 is a Latin lead line over a Chinese sub",
  },
  {
    name: "anchor integrity",
    enabled: true,
    turnedOnBy: "#66",
    run: ruleAnchorIntegrity,
    summary: "a fragment link must point at an element that exists on the rendered page",
  },
  {
    name: "phosphor budget",
    enabled: true,
    turnedOnBy: "#125 stage 2 — typography",
    run: rulePhosphorBudget,
    summary: `at most ${PHOSPHOR_BUDGET} phosphor elements on a rendered page`,
  },
  {
    name: "texture not behind text",
    enabled: true,
    turnedOnBy: "#125 stage 3 — figures",
    run: ruleTextureNotBehindText,
    summary: "a background-image over text blinds the contrast audit rather than failing it",
  },
  {
    name: "pixel face scope",
    enabled: true,
    turnedOnBy: "#125 stage 3 — figures",
    run: rulePixelScope,
    summary: "Departure Mono belongs to 404.html and to marked specimens, nowhere else",
  },
];

function main() {
  const files = walk(TEMPLATES).map((file) => ({
    rel: path.relative(ROOT, file),
    html: fs.readFileSync(file, "utf8"),
  }));

  let failed = 0;
  const pending = [];

  for (const rule of RULES) {
    if (!rule.enabled) {
      pending.push(rule);
      continue;
    }
    const violations = rule.run(files);
    if (!violations.length) continue;

    failed += violations.length;
    console.log(`\n  ${rule.name} — ${rule.summary}\n`);
    for (const v of violations) {
      const where = v.line ? `${v.file}:${v.line}` : v.file;
      console.log(`      ${where}  ${v.detail}`);
    }
  }

  if (pending.length) {
    console.log("");
    for (const rule of pending) {
      console.log(`  not yet enforced — ${rule.name}: ${rule.turnedOnBy ?? "no ticket recorded"}`);
    }
  }

  if (failed) {
    console.log(`\n${failed} design violation(s). DESIGN.md is the rule; fix the template.`);
    process.exitCode = 1;
    return;
  }

  const on = RULES.filter((r) => r.enabled).length;
  console.log(`\ntemplates agree with DESIGN.md (${on} of ${RULES.length} rules enforced)`);
}

main();
