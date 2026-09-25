// Helpers and constants for scripts/design/rules/: whatever more than one rule
// reads, the template parsers and walkers, and ROOT/TEMPLATES for check-design.js.
const path = require("path");
const { PAGES, DOCUMENTS } = require("../routes");

const ROOT = path.join(__dirname, "..", "..");
const TEMPLATES = path.join(ROOT, "templates");

const CONTROL_TAGS = new Set(["button", "input", "select", "textarea"]);
// `tag` WAS HERE. A .tag cannot be clicked — it labels a section the way an
// eyebrow does — and listing it as a control let the accent onto something
// inert while the rule believed it was guarding a button. It now wears the
// xs radius rather than the pill precisely so it stops looking like one.
const CONTROL_CLASSES = ["btn"];

// The full-screen menu rests at opacity-0 and is revealed by the menu script.
// That is a disclosure, not a scroll reveal: it is driven by a click, it has no
// scroll listener and no observer, and its content is in the document for
// crawlers either way. It is the single structural exemption in this file, and
// it is named here rather than pattern-matched so that a second one cannot be
// added without saying so out loud.
const OPACITY_EXEMPT_IDS = new Set(["menuOverlay"]);

// ---------------------------------------------------------------------------

// HOW site.toml NAMES A TEMPLATE, which stopped being its basename.
//
// Templates used to be a flat directory, so `path.basename` and "what the route
// table declares" were the same string. A translated page needs its own file —
// one file cannot hold two languages' prose — so they live in `templates/en-US/`
// and site.toml declares `en-US/building.html`.
//
// Keyed by basename, the two `building.html` files collide: the map keeps
// whichever came last, and the rules above then check one language's template
// twice and the other's never. It surfaced as "site.toml declares missing
// template en-US/building.html", which is the good outcome — the same collision
// with the *other* iteration order would have reported nothing at all.
const templateKey = (rel) => path.relative(TEMPLATES, path.join(ROOT, rel));

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
// THE ONE PLACE A TEMPLATE MUST CARRY A LITERAL COLOUR.
//
// `zero literal colour` exists because a colour written in a template is a
// colour that cannot follow the tokens. `<meta name="theme-color">` is the
// exception that proves it: HTML metadata has no token mechanism at all, so the
// substrate has to be spelled out there or the address bar goes uncoloured.
//
// This is a carve-out by POSITION, not a list — the same shape rule 23 uses for
// the surface. Any other literal in any other attribute still fails. And the
// literal is not left unwatched: `theme colour agrees` (rule 33) compares it to
// the manifest, which is the failure this pair actually has a history of.
function maskNonColourHashes(html) {
  return html
    .replace(/&#x?[0-9a-fA-F]+;/g, (m) => " ".repeat(m.length))
    .replace(/href="#[^"]*"/g, (m) => " ".repeat(m.length))
    .replace(/(<meta[^>]*name="theme-color"[^>]*content=")([^"]*)/g, (m, head, value) => head + " ".repeat(value.length));
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

// PARSED ONCE PER DOCUMENT. Eight callers (five rules directly, three more
// through colourUtilities) used to parse the same 107 templates independently.
// Keyed by the html string itself; the nodes are shared between callers, so no
// caller may write to them — none does, and a rule that needs to must copy.
const parsedElements = new Map();

function parseElements(html) {
  const cached = parsedElements.get(html);
  if (cached) return cached;
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
  parsedElements.set(html, nodes);
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
  const declared = [...PAGES, ...DOCUMENTS].map((p) => p.template);
  const byName = new Map(files.map((f) => [templateKey(f.rel), f]));
  return { declared, byName };
}

// ---------------------------------------------------------------------------

// No reader today; kept so this split changes nothing but where code lives.
const BG_IMAGE_INLINE = /style=("|')[^"']*background(-image)?\s*:[^"']*(url\(|gradient)/i;

// No reader today either — the rules use stylesheet.INPUT_CSS.
const INPUT_CSS = path.join("src", "input.css");

// The reference set's one type rule, shared by the two ladders that answer to
// it: the pages' scale (rule 27) and the card's (rule 30). They read different
// files on purpose; the bounds are the same number and were written twice.
const TYPE_LADDER_MIN = 5;
const TYPE_LADDER_MAX = 12;

// WHERE COVERAGE CAN ENTER, AND IT IS NOT ONE PLACE. An author reaches a step
// through a declaration (`rgb(var(--ink-rgb) / 0.12)`), through a solid token
// whose value IS that step (`--line-rgb`), or through a Tailwind utility whose
// slash carries it (`bg-ink/5`). The first two arrive as CSS and come from
// stylesheet.read(); the third is a class string in a template and never
// becomes author CSS at all. Reading only the CSS would leave the 185 call
// sites of `bg-ink/5` unchecked, which is the larger half.
const COLOUR_PROP = /^(?:color|background|background-color|border|border-color|border-(?:top|right|bottom|left)-color|outline-color|fill|stroke|text-decoration-color|box-shadow|caret-color|accent-color)$/;

// A TOKEN IS A COLOUR TOO, AND SKIPPING IT LEFT THE ONE CONDITIONAL PATH OPEN.
//
// The three colour rules each began by skipping every `--*` declaration. It
// looked harmless — a plate token holds bare channels (`48 52 58`), which
// `stepsIn` cannot read anyway, so the skip and the regex agreed and nothing
// was ever reported. What that hid is the only place this site changes a colour
// conditionally: `--line-rgb` is redefined inside `@media (prefers-contrast:
// more)`, and a third ink written there was invisible to `two plates`.
//
// Measured, with the same Terracotta decision #108 used as its proof: as
// `.probe { color: #C65F38 }` the gate goes red; as `--line-rgb: 198 95 56`
// inside the media block it printed `31 of 31`. Decision #108's injection only
// ever walked the colour-property road, so the token road was never tested —
// the rule could not have gone red there and nothing said so.
const CHANNEL_TOKEN = /^--[a-z0-9-]+-rgb$/;
const BARE_CHANNELS = /^\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*$/;

// Every declaration that carries a colour, token or not, with the value in a
// form `plates.stepsIn` can read. Tokens are wrapped because they hold channels
// without the `rgb()` around them.
function colourBearing(declarations) {
  const out = [];
  for (const d of declarations) {
    if (CHANNEL_TOKEN.test(d.prop)) {
      if (!BARE_CHANNELS.test(d.value)) continue;
      out.push({ d, value: `rgb(${d.value.trim()})` });
      continue;
    }
    if (d.prop.startsWith("--")) continue;
    if (!COLOUR_PROP.test(d.prop)) continue;
    out.push({ d, value: d.value });
  }
  return out;
}

// ONE CENSUS, THREE VERDICTS.
//
// Rules 25, 26 and 32 each ask a different question about the same colour —
// which plate, where it lands, which step — and decision #105 is right that
// those are three failures rather than one. What was not right is that each of
// them rebuilt the walk: `sheet.applied` plus `parseElements` over 107
// templates, copied verbatim into two rules and hand-rolled a third time in the
// accent rule, which is how that copy lost `from|via|to` (decision #117) and how
// the `--*` skip ended up in all three (decision #116). Both defects are the
// same shape, and PR 297 fixed them one level too shallow: the predicates were
// shared, the enumeration was not.
//
// LINE NUMBERS ARE LAZY, AND THAT IS THE WHOLE PERFORMANCE STORY. Computing
// `html.slice(0, index).split("\n").length` eagerly is O(n²) per file, and it
// was being paid for every class token before any filter: measured 43,345
// tokens across 107 templates, of which 185 (0.43%) are colour utilities. Two
// rules doing it twice was 1.79s of a 2.03s run. The line is now a function the
// caller invokes only inside `found.push`.
function colourUtilities(files, sheet) {
  const out = [];
  for (const a of sheet.applied) {
    out.push({ file: a.file, line: () => a.line, name: a.utility, node: null });
  }
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        out.push({ file: rel, line: () => lineOf(html, node.index), name: c, node });
      }
    }
  }
  return out;
}

// What makes a selector a state. Shared by `states differ` (whose file carries
// the argument) and `state pairs keep contrast`.
const STATE_SELECTOR = /(:(?:hover|active|focus|focus-visible|focus-within)\b|\[aria-[a-z-]+(?:=|\]))/;

// "Interactive is a position, not a list" — the argument is in
// rules/accent-carries-interaction.js, the one rule that asks it.
const INTERACTIVE_TAGS = new Set(["a", "button", "label", "summary", ...CONTROL_TAGS]);

function isInteractiveNode(node) {
  if (INTERACTIVE_TAGS.has(node.tag)) return true;
  if (node.classes.some((c) => CONTROL_CLASSES.includes(c))) return true;
  return (node.ancestors || []).some(
    (a) => INTERACTIVE_TAGS.has(a.tag) || a.classes.some((c) => CONTROL_CLASSES.includes(c))
  );
}

// A page as the generator assembles it: `{% include %}` resolved, with a map
// from every offset back to the file and line the byte came from. Without this
// the rule reads header.html as a document that opens <html> and never closes
// it, which is not a defect — it is half a shell. Nesting is a property of the
// composed page, so the composed page is what gets checked, and the finding
// still points at the file an author would open.
const INCLUDE = /\{%-?\s*include\s*"([^"]+)"\s*-?%\}/;

// A MISSING OR TOO-DEEP INCLUDE IS AN ERROR, NOT AN EMPTY STRING. This returned
// "" for both, so a fifth level of nesting — or a partial this walk could not
// find — was dropped from the composed page and the nesting rule reported the
// remainder clean: the green-while-unchecked shape this file exists to prevent.
// The generator has no depth limit; the only reason to stop is a cycle.
const MAX_INCLUDE_DEPTH = 16;

function compose(rel, byRel, depth = 0) {
  const file = byRel.get(rel);
  if (!file) throw new Error(`tags nest: cannot compose ${rel} — no such template was read`);
  if (depth > MAX_INCLUDE_DEPTH) {
    throw new Error(`tags nest: includes nest deeper than ${MAX_INCLUDE_DEPTH} at ${rel} — is there a cycle?`);
  }
  let text = "";
  const map = [];
  let rest = file.html;
  let line = 1;
  for (;;) {
    const m = INCLUDE.exec(rest);
    const head = m ? rest.slice(0, m.index) : rest;
    if (head) {
      map.push({ start: text.length, end: text.length + head.length, rel, line });
      text += head;
      line += head.split("\n").length - 1;
    }
    if (!m) break;
    const inner = compose(path.join("templates", m[1]), byRel, depth + 1);
    for (const seg of inner.map) {
      map.push({ start: text.length + seg.start, end: text.length + seg.end, rel: seg.rel, line: seg.line });
    }
    text += inner.text;
    rest = rest.slice(m.index + m[0].length);
  }
  return { text, map };
}

function relativeLuminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hexOf = ([r, g, b]) => "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");

module.exports = {
  ROOT,
  TEMPLATES,
  CONTROL_TAGS,
  CONTROL_CLASSES,
  OPACITY_EXEMPT_IDS,
  templateKey,
  lineOf,
  maskNonColourHashes,
  elements,
  stripVariants,
  squareSized,
  includesOf,
  reachable,
  VOID_TAGS,
  parseElements,
  subtreeText,
  hasAttr,
  renderedNodes,
  routeTemplates,
  BG_IMAGE_INLINE,
  INPUT_CSS,
  TYPE_LADDER_MIN,
  TYPE_LADDER_MAX,
  COLOUR_PROP,
  CHANNEL_TOKEN,
  BARE_CHANNELS,
  colourBearing,
  colourUtilities,
  STATE_SELECTOR,
  INTERACTIVE_TAGS,
  isInteractiveNode,
  INCLUDE,
  MAX_INCLUDE_DEPTH,
  compose,
  relativeLuminance,
  contrastRatio,
  hexOf,
};
