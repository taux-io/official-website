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
const TRACKING_SCALE = new Set(["0", "0em", "0.09em", "0.02em"]);

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

const BG_IMAGE_INLINE = /style=("|')[^"']*background(-image)?\s*:[^"']*(url\(|gradient)/i;
// The idiomatic way to add one in this codebase is a utility, not a style
// attribute: bg-[url(...)] and every gradient helper resolve to background-image.
// Bare bg-radial / bg-conic, every gradient direction, and the arbitrary-value
// form bg-[linear-gradient(...)] / bg-[image:...]. Enumerating a subset is how a
// rule that was just switched on goes quietly blind.
const BG_IMAGE_CLASS = /^bg-(?:\[(?:url|image|linear|radial|conic)|gradient-|linear-|radial-|conic-)/;

const PIXEL_TEMPLATES = new Set(["404.html"]);
const SPECIMEN = /\bdata-specimen\b/;

function ruleCollapsibleShipsOpen(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*\bdata-panel="[^"]*"[^>]*>/g)) {
      if (!/\bhidden\b/.test(m[0])) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: "data-panel ships hidden; the script must be what collapses it, not the markup",
      });
    }
  }
  return found;
}

// Whatever is exempted from the scroll-reveal rule owes something in return.
//
// OPACITY_EXEMPT_IDS lets an element rest at opacity-0 because a click, not a
// scroll position, reveals it. That exemption is about the eyes. It says
// nothing about the keyboard, and the menu overlay proved the gap: opacity-0
// plus pointer-events-none hid it from sight and from the mouse while leaving
// twenty links in the tab order, so tabbing past the navigation walked into
// twenty stops on a menu that was not on screen and drew no focus ring.
//
// So the exemption now carries an obligation, expressed against the same list
// rather than a second one: an element allowed to rest invisible must also
// ship inert, and the script that reveals it is what lifts that. Binding both
// to OPACITY_EXEMPT_IDS is the point — a future exemption cannot be granted
// without inheriting the duty.
//
// Inert in the markup rather than applied on load also points the failure the
// right way: if the script never runs the overlay cannot open, and an
// unopenable menu should not be collecting focus.
function ruleInvisibleIsInert(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*\bid="([^"]*)"[^>]*>/g)) {
      if (!OPACITY_EXEMPT_IDS.has(m[1])) continue;
      if (/\binert\b/.test(m[0])) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: `#${m[1]} rests invisible but ships focusable; it must carry inert for the script to lift`,
      });
    }
  }
  return found;
}

// The stylesheet's cache-busting query must be computed, never written.
//
// It was a literal — `?v=25` — from the Go-to-Rust migration until PR 145, and
// it never moved again: not for a palette change, not for the type scale, not
// for two changes that shipped the same afternoon. `_headers` caches
// /static/css/* for an hour, so a returning visitor got new markup styled by
// the stylesheet they already had. When the markup introduced new utility
// classes, the elements wearing them fell back to nothing — a nav reading
// `hidden sm:flex` against a stylesheet with no `sm:flex` is hidden at every
// width.
//
// The generator now derives the query from the stylesheet's bytes, which makes
// the failure impossible rather than merely discouraged. This rule exists to
// keep it that way: the next person to touch this line will be tempted to
// "simplify" it back to a literal, and a literal is silently wrong from the
// first stylesheet change after it.
const STYLESHEET_LINK = /<link[^>]*rel="stylesheet"[^>]*>/g;

function ruleCssVersionIsDerived(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(STYLESHEET_LINK)) {
      const tag = m[0];
      if (!/styles\.min\.css/.test(tag)) continue;
      if (tag.includes("{{ css_version }}")) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: /\?v=/.test(tag)
          ? "stylesheet cache-buster is a literal; it must be {{ css_version }} so it cannot lag the file"
          : "stylesheet link carries no cache-buster; it must be ?v={{ css_version }}",
      });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// The motion and material vocabulary issue 156 introduced.
//
// That change gave the site two easings, three shadow steps and a pressed
// state, none of which existed before and none of which anything checked. This
// file's opening argument is that a rule nothing checks is not a rule, and a
// vocabulary is only a vocabulary while it stays small — the reason the site
// had one ink, two hairline weights and no shadows at all was never taste, it
// was that an unpoliced scale grows a fourth step for a case none of the first
// three fit.

const INPUT_CSS = path.join("src", "input.css");

// Comments carry examples and prose about the very things these rules match on
// — ":active" appears in three explanations before it appears in a selector.
// Scanning the raw file finds those and reports the documentation as a
// violation.
function readStylesheet() {
  const abs = path.join(ROOT, INPUT_CSS);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, "utf8");
  // Replaced with spaces of equal length so every line number still resolves.
  return raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

// Two easings, and they are declared as tokens. A third curve written inline is
// how a scale stops being a scale.
function ruleEasingScale() {
  const css = readStylesheet();
  if (css === null) {
    return [{ file: INPUT_CSS, line: 0, detail: "not found; this rule cannot see the easings" }];
  }
  const declared = new Set();
  for (const m of css.matchAll(/--ease-[a-z-]+:\s*(cubic-bezier\([^)]*\))/g)) {
    declared.add(m[1].replace(/\s+/g, ""));
  }
  if (!declared.size) {
    return [{ file: INPUT_CSS, line: 0, detail: "no --ease-* tokens declared; this rule has gone blind" }];
  }
  const found = [];
  for (const m of css.matchAll(/cubic-bezier\([^)]*\)/g)) {
    if (declared.has(m[0].replace(/\s+/g, ""))) continue;
    found.push({
      file: INPUT_CSS,
      line: lineOf(css, m.index),
      detail: `${m[0]} is not one of the declared easings (${[...declared].join(", ")}) — use the token`,
    });
  }
  return found;
}

const PRESS_EXEMPT = new Set(["::-webkit-scrollbar-thumb"]);

function rulePressFollowsHover() {
  const css = readStylesheet();
  if (css === null) {
    return [{ file: INPUT_CSS, line: 0, detail: "not found; this rule cannot see the states" }];
  }

  // Selector lists sit before a `{`; a rule may group several.
  const hover = new Map();
  const active = new Map();
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const list = m[1];
    for (const sel of list.split(",")) {
      const s = sel.trim();
      if (!s) continue;
      const base = s.replace(/:(hover|active)\b.*$/, "");
      if (PRESS_EXEMPT.has(base)) continue;
      if (/:hover\b/.test(s) && !hover.has(base)) hover.set(base, lineOf(css, m.index));
      if (/:active\b/.test(s) && !active.has(base)) active.set(base, lineOf(css, m.index));
    }
  }

  const found = [];
  for (const [base, hoverLine] of hover) {
    const activeLine = active.get(base);
    if (activeLine === undefined) {
      found.push({
        file: INPUT_CSS,
        line: hoverLine,
        detail: `${base} answers :hover but not :active — a touch device never fires hover, so it would have no press feedback at all`,
      });
      continue;
    }
    if (activeLine < hoverLine) {
      found.push({
        file: INPUT_CSS,
        line: activeLine,
        detail: `${base}:active is written before :hover (line ${hoverLine}); equal specificity means hover wins and the press does nothing with a mouse`,
      });
    }
  }
  return found;
}

// A revealed block must ship visible.
//
// The neighbouring "no scroll reveal" rule bans opacity-0 across the templates,
// which is what kept nineteen elements from being lost a second time. This one
// is narrower and aimed at the feature issue 156 introduced: the elements that
// opt into a reveal are exactly the ones a future edit is most likely to "help"
// by giving them a starting state in the markup. The starting state belongs to
// the script, which adds it only once it knows it can take it away again.
const REVEAL_FORBIDDEN = /^(?:opacity-(?!100$)|invisible$|scale-(?!100$)|translate-[xy]-(?!0$)|blur-)/;

const INK_SOURCES = [
  { file: path.join("src", "input.css"), re: /--ink-body:\s*rgb\(var\(--ink-rgb\)\s*\/\s*([0-9.]+)\s*\)/ },
  { file: path.join("tailwind.config.js"), re: /body:\s*"rgb\(var\(--ink-rgb\)\s*\/\s*([0-9.]+)\)"/ },
];

const VIEWPORT_HEIGHT = /^(?:min-)?h-(?:screen|svh|lvh|dvh|\[[^\]]*(?:v|sv|lv|dv)h[^\]]*\])$/;

// Two exemptions, named rather than pattern-matched so a third cannot appear
// without someone saying so out loud — the same device OPACITY_EXEMPT_IDS uses.
//
//   404 is the one page whose job IS to fill the screen: no body semantics, no
//   reading measure, no SEO value. DESIGN.md's layout chapter already carved it
//   out as the sole exception and #137 narrowed the chapter to exactly that.
//
//   <main> keeps the footer at the bottom of a short page. Now that sections
//   are content-height, that is the shell doing its job rather than a block
//   padding itself out — the opposite of what this rule exists to stop.
const FULL_HEIGHT_EXEMPT_FILE = path.join("templates", "404.html");
const FULL_HEIGHT_EXEMPT_TAGS = new Set(["main"]);

function ruleNavBreakpointsPaired(files) {
  const HEADER = path.join("templates", "header.html");
  const header = files.find(({ rel }) => rel === HEADER);
  // The partial is included by every template rather than routed to, so its
  // absence means the file was renamed and this rule has gone blind. Say so
  // rather than passing vacuously.
  if (!header) {
    return [{ file: HEADER, line: 0, detail: "not found; this rule cannot see the navigation" }];
  }

  const { rel, html } = header;
  const variantOf = (classes, utility) => {
    const hit = classes.find((c) => stripVariants(c) === utility && c !== utility);
    return hit ? hit.slice(0, hit.length - utility.length - 1) : null;
  };

  const showing = [];
  let hides = null;
  for (const el of elements(html)) {
    if (el.id === "hamburger") {
      hides = { variant: variantOf(el.classes, "hidden"), line: lineOf(html, el.index) };
    }
    // The desktop group is the one that starts hidden and becomes a flex row at
    // some breakpoint. Identified by that shape because it carries no id.
    if (el.classes.includes("hidden") && variantOf(el.classes, "flex")) {
      showing.push({ variant: variantOf(el.classes, "flex"), line: lineOf(html, el.index) });
    }
  }

  const found = [];
  // Collected rather than overwritten. Assigning in the loop meant the LAST
  // match won and a second group would be compared against nothing — the rule
  // would pass while the pairing it exists to check went unexamined. Today
  // there is exactly one, and this says so rather than relying on it.
  if (showing.length > 1) {
    found.push({
      file: rel,
      line: showing[1].line,
      detail: `${showing.length} \`hidden <bp>:flex\` groups; this rule pairs one against #hamburger and cannot tell which you meant`,
    });
  }
  const shows = showing[0] ?? null;
  if (!shows) {
    found.push({ file: rel, line: 0, detail: "no `hidden <bp>:flex` desktop nav group found" });
  }
  if (!hides || !hides.variant) {
    found.push({
      file: rel,
      line: hides ? hides.line : 0,
      detail: "#hamburger carries no `<bp>:hidden`",
    });
  }
  if (shows && hides && hides.variant && shows.variant !== hides.variant) {
    found.push({
      file: rel,
      line: hides.line,
      detail: `desktop nav shows at ${shows.variant}: but #hamburger hides at ${hides.variant}: — both or neither render between them`,
    });
  }
  return found;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The four rules the brand reset introduced (DESIGN.md decision #53).
//
// All four land disabled and are switched on by the ticket that makes each
// satisfiable — the arrangement the rest of this file already uses. A rule that
// is off says so, and says which ticket turns it on.

// The reference site's typographic system has no monospace at all, and the three
// faces this site carried for it (Roboto Mono, its box-drawing subset, Departure
// Mono) go with it. Both halves are checked: a template still writing the
// utility, and a config still defining the family for it to resolve against.
// Checking only the templates would leave the families sitting there for the
// next person to reach for.
function ruleZeroMono(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        if (!/^(?:[a-z]+:)*font-(?:mono|pixel)$/.test(c)) continue;
        found.push({
          file: rel,
          line: html.slice(0, node.index).split("\n").length,
          detail: `${c} — the vocabulary has no monospace face for it to resolve to`,
        });
      }
    }
  }
  const config = path.join(ROOT, "tailwind.config.js");
  if (fs.existsSync(config)) {
    const text = fs.readFileSync(config, "utf8");
    for (const family of ["mono", "pixel"]) {
      const m = new RegExp(`^\\s{6,}${family}:\\s*\\[`, "m").exec(text);
      if (!m) continue;
      found.push({
        file: "tailwind.config.js",
        line: text.slice(0, m.index).split("\n").length,
        detail: `fontFamily.${family} is still defined; nothing should resolve to it`,
      });
    }
  }
  // A component class applying the utility reaches the same face by another
  // road, and it is the road this site actually used: `.eyebrow` carried
  // `@apply font-mono` for 202 elements while no template said so. Reading only
  // the templates would have called that clean.
  const css = readStylesheet();
  if (css !== null) {
    for (const m of css.matchAll(/@apply[^;]*\bfont-(mono|pixel)\b/g)) {
      found.push({
        file: INPUT_CSS,
        line: css.slice(0, m.index).split("\n").length,
        detail: `@apply font-${m[1]} — a component class reaches the removed family too`,
      });
    }
  }
  return found;
}

// Photography and video are the only decorative depth this vocabulary admits,
// and the site has neither. What it had instead were twenty-five canvases
// drawing the tau curve. The rule is existence, not usage: a canvas with no
// script behind it is still a canvas the next change will find a use for.
//
// ONE NAMED EXEMPTION, AND IT IS NOT DECORATION. The jailbreak chart on
// what-is-prompt-injection is measured data drawn by Chart.js — the same family
// as the code blocks DESIGN.md's machine-output chapter covers, not the tau
// curve this rule exists to keep out. The brand reset was authorised against a
// count of "25 tau-curve canvases"; the inventory found 24 decorative canvases
// and this one chart, so removing it would have deleted content on a premise
// that turned out to be wrong. Named here rather than pattern-matched, for the
// reason OPACITY_EXEMPT_IDS is: a second exemption cannot be added quietly.
const CANVAS_EXEMPT_IDS = new Set(["jailbreakChart"]);

function ruleZeroCanvas(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<canvas\b([^>]*)>/g)) {
      const id = /id="([^"]*)"/.exec(m[1] || "");
      if (id && CANVAS_EXEMPT_IDS.has(id[1])) continue;
      found.push({
        file: rel,
        line: html.slice(0, m.index).split("\n").length,
        detail: "canvas — decorative depth is photography, and this site ships none",
      });
    }
  }
  return found;
}

// Every section heading opens a full-screen band carrying nothing but an eyebrow
// and the heading itself. The heading stays a real h2 inside that band rather
// than a visual stand-in beside it, because the document outline, the
// heading-structure rule and every fragment link depend on it.
//
// PARTIALS ARE EXCLUDED, AND THAT EXCLUSION IS THE POINT. The site has 106 h2
// elements and six of them live in the nav columns, the header and the footer. A
// rule written against the raw total would demand six full-screen bands inside
// the footer. The spec's first draft said 106; counting the files before writing
// the rule is what caught it.
function ruleSectionCoverScreens(files) {
  const found = [];
  for (const { rel, html } of files) {
    const base = path.basename(rel);
    if (base.startsWith("_") || base === "header.html" || base === "footer.html") continue;
    for (const node of parseElements(html)) {
      if (node.tag !== "h2") continue;
      if (hasAttr(node, /\bdata-cover\b/)) continue;
      found.push({
        file: rel,
        line: html.slice(0, node.index).split("\n").length,
        detail: "h2 outside a [data-cover] band — every section heading opens a cover screen",
      });
    }
  }
  return found;
}

// Chinese has no upper case. The display signature is therefore carried by the
// Latin lead line alone, and applying the same transform to the Chinese sub
// would be a no-op that reads as though the rule were satisfied.
//
// The transform belongs to the component classes rather than to utilities on the
// elements, so this reads the stylesheet for both halves and then checks that no
// template argues with it.
function ruleUppercaseDisplay(files) {
  const found = [];
  const css = readStylesheet();
  if (css === null) {
    return [{ file: INPUT_CSS, line: 0, detail: "not found; this rule cannot see the display classes" }];
  }
  const declaration = (sel) => {
    const m = new RegExp(`\\.${sel}\\s*\\{([^}]*)\\}`).exec(css);
    return m ? { body: m[1], line: css.slice(0, m.index).split("\n").length } : null;
  };
  const upper = /\buppercase\b/;
  const lead = declaration("display-lead");
  if (!lead) {
    found.push({ file: INPUT_CSS, line: 0, detail: ".display-lead is not defined" });
  } else if (!upper.test(lead.body)) {
    found.push({
      file: INPUT_CSS,
      line: lead.line,
      detail: ".display-lead must render upper case — it is the only line carrying the display signature",
    });
  }
  const sub = declaration("display-sub");
  if (!sub) {
    found.push({ file: INPUT_CSS, line: 0, detail: ".display-sub is not defined" });
  } else if (upper.test(sub.body) && !/normal-case/.test(sub.body)) {
    found.push({
      file: INPUT_CSS,
      line: sub.line,
      detail: ".display-sub must not render upper case — Chinese has none, so the transform only looks satisfied",
    });
  }
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      if (!node.classes.includes("display-sub")) continue;
      const bad = node.classes.find((c) => /^(?:[a-z]+:)*uppercase$/.test(c));
      if (!bad) continue;
      found.push({
        file: rel,
        line: html.slice(0, node.index).split("\n").length,
        detail: `.display-sub carries ${bad}; the Chinese sub line is never upper case`,
      });
    }
  }
  return found;
}

const RULES = [
  {
    name: "easing scale",
    enabled: true,
    turnedOnBy: "issue 156 — the motion vocabulary",
    run: ruleEasingScale,
    summary: "every curve is one of the two declared --ease-* tokens",
  },
  {
    name: "press follows hover",
    enabled: true,
    turnedOnBy: "issue 156 — after the ordering defect in 154",
    run: rulePressFollowsHover,
    summary: "anything that answers hover answers a press, and later in the file",
  },
  {
    name: "invisible is inert",
    enabled: true,
    turnedOnBy: "issue 143 — the closed overlay left twenty links in the tab order",
    run: ruleInvisibleIsInert,
    summary: "an element exempted from the scroll-reveal rule must ship inert",
  },
  {
    name: "css version is derived",
    enabled: true,
    turnedOnBy: "PR 145 — the cache-buster is computed from the stylesheet",
    run: ruleCssVersionIsDerived,
    summary: "the stylesheet's ?v= must be a hash of the stylesheet, not a literal",
  },
  {
    name: "nav breakpoints paired",
    enabled: true,
    turnedOnBy: "#134 — the desktop nav narrows to two items",
    run: ruleNavBreakpointsPaired,
    summary: "the desktop nav appears exactly where the hamburger disappears",
  },
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
    name: "collapsible ships open",
    enabled: true,
    turnedOnBy: "#130 — the MCP primitives explainer",
    run: ruleCollapsibleShipsOpen,
    summary: "a panel a script collapses must be in the document open, not hidden",
  },
  {
    name: "zero mono",
    enabled: true,
    turnedOnBy: "#171 — the monospace faces come out with the vocabulary",
    run: ruleZeroMono,
    summary: "no template writes font-mono or font-pixel, and no family answers them",
  },
  {
    name: "zero canvas",
    enabled: true,
    turnedOnBy: "#166 — the tau curve comes out",
    run: ruleZeroCanvas,
    summary: "decorative depth is photography; this site ships none, so it ships nothing",
  },
  {
    name: "section cover screens",
    enabled: false,
    turnedOnBy: "#182 — after the 100 bands land",
    run: ruleSectionCoverScreens,
    summary: "every section heading opens a full-screen band, partials excluded",
  },
  {
    name: "uppercase display",
    enabled: false,
    turnedOnBy: "#182 — after the type scale lands",
    run: ruleUppercaseDisplay,
    summary: "the Latin lead is upper case and the Chinese sub never is",
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
