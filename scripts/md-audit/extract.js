// Turns one page's `<main>` into a list of blocks, WITHOUT asking the generator
// what `<main>` is or what a block is.
//
// WHY THE INDEPENDENCE MATTERS MORE THAN THE CODE REUSE WOULD.
// The generator's `main_content` picks the region it converts. Reusing it here
// would mean both sides of the comparison inherit the same mistake: if it ever
// selects the wrong element, the Markdown and the "expected" blocks would be
// wrong together, the diff would be empty, and the audit would report a clean
// bill of health over a broken page.
//
// This repository has already paid for that shape once. `contract`'s charset
// assertion ran against `wrangler dev`, which supplies `charset` itself — so the
// assertion was green whether or not the rule it guarded existed, and every
// `.md` was mojibake in a browser for an hour after it shipped. A measurement
// that takes its definition from the thing it measures measures nothing.
//
// So: a second implementation, in a different language from the converter, that
// reads only the published HTML.
//
// ⚠️ THIS IS A SCANNER, NOT AN HTML PARSER, and the difference matters at the
// edges. It knows the void elements it has seen in this build and treats an
// unclosed non-void tag as an error rather than guessing.
//
// ⚠️ THAT SENTENCE WAS FALSE WHEN FIRST WRITTEN, and false about the very thing
// the paragraph was boasting of. The unwind below took `lastIndexOf` and reset
// the stack to it — silent recovery, in a tool whose comment two lines up said
// silent recovery is the failure it exists to find. It was firing on five
// pages: `agent-dev-workflow`'s JSON-LD contains the literal `<fixed-point>`,
// which the scanner read as an opening tag and only survived because `</script>`
// happened to unwind past it. Removing the discarded elements' CONTENTS first
// (see below) takes that input away, so the strictness is now real and an
// unbalanced tag throws.

// Removed from the source text — opening tag, contents and closing tag —
// before a single tag is scanned.
//
// ⚠️ THE FIRST VERSION ONLY SKIPPED THEIR TEXT, so the scanner still parsed
// what was inside them. Every page's `<main>` carries JSON-LD, and prose about
// prompting carries `<fixed-point>` and `<name>` inside it; those were being
// read as markup.
//
// ⚠️ AND THE FIRST VERSION'S COMMENT NAMED THE CONVERTER'S LIST. It said "the
// same four the converter skips", which is the coupling this whole file exists
// to avoid: if that list is ever wrong, both sides drop the same thing and the
// diff stays empty. The list here is chosen for what these elements ARE — a
// decorative SVG's `<title>`, a script's source, a stylesheet — none of which
// is text a reader is shown. IT IS ALLOWED TO DIVERGE from the converter's,
// and divergence is not a bug: drop something the converter keeps and it
// surfaces as an md-only block; keep something it drops and it surfaces as
// html-only. Either way a reader sees it, which is the whole design.
const { ORIGIN } = require("../routes");

const DISCARDED = ["svg", "script", "style", "noscript"];

function withoutDiscarded(region) {
  let text = region;
  for (const tag of DISCARDED) {
    const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi");
    text = text.replace(pattern, "");
  }
  return text;
}

// Elements that close themselves. Anything outside this set is expected to have
// an end tag; see the warning above about why that is not leniency.
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

// An element whose presence means its parent is a container, not a block: the
// parent's text belongs to these, not to the parent.
const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "dd", "details", "div", "dl",
  "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
  "h4", "h5", "h6", "header", "hgroup", "li", "main", "nav", "ol", "p", "pre",
  "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr",
  "ul",
]);

// What each emitted block is called. Anything not named here — the `<div>` a
// decorative chip is built from, most obviously — is a `text` block, which is
// the point: a chip has no element of its own, so a scanner that only looked
// for known block tags would not see the defect this audit was built to find.
// `<code>`, `<strong>` and `<em>` are what `htmd` writes as backticks and
// asterisks. Losing one turns an identifier the page is teaching into prose.
const MARKED = new Set(["code", "strong", "b", "em", "i"]);

const KIND = {
  h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading",
  h6: "heading", p: "para", li: "item", pre: "code", tr: "row",
  blockquote: "quote", figcaption: "caption", dt: "term", dd: "definition",
  summary: "summary",
};

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", mdash: "—", tau: "τ",
};

// MEASURED IN THE REGION THIS TOOL ACTUALLY READS — inside `<main>`, after the
// discarded elements are removed — because that is the only region any of this
// applies to:
//
//     &mdash;  85 across 20 pages
//     &gt;     82 across 20 pages
//     &lt;     80 across 20 pages
//     &tau;     5 across  5 pages
//     &amp;     4 across  2 pages
//
// Nothing else appears. No `&quot;`, `&nbsp;` or `&apos;` — they are absent, so
// they are not here.
//
// ⚠️ THIS LIST HAS NOW BEEN WRONG THREE TIMES, EACH TIME FROM NOT MEASURING.
// First it lacked `&tau;`, so the Greek letter the company is named after
// compared unequal. Then the comment claimed eleven pages when it was five, and
// added `&copy;` on the strength of 101 occurrences — every one in the footer,
// zero inside `<main>`, an entry that could never fire. Then, correcting THAT,
// `&mdash;` was deleted along with the unused ones without being counted: it is
// the most common entity here, and `01 &mdash; Vendor Figures` went straight
// into the audit as a difference the page does not have.
//
// The rule the three mistakes share: a number about a region has to be counted
// in that region. An unknown entity is left as written rather than dropped, so
// the next one to arrive shows up as a difference instead of vanishing.

function decode(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      // Out of Unicode range throws rather than returning a character, and a
      // crash in an auditing tool reads as "the page is fine".
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return body in ENTITIES ? ENTITIES[body] : whole;
  });
}

// The `<main>` region. Found by tag rather than by class or id because that is
// what the published HTML declares, and a page without one is an error here
// rather than an empty result — `check:md` learned that the hard way when a
// `<main>` converting to nothing was written, counted and reported as a success.
function mainRegion(html) {
  const open = /<main(?:\s[^>]*)?>/i.exec(html);
  if (!open) return null;
  const close = html.lastIndexOf("</main>");
  if (close === -1) return null;
  return html.slice(open.index + open[0].length, close);
}

// A shallow tree of the region: elements with children, and text.
function parse(region) {
  const root = { tag: "#root", children: [] };
  const stack = [root];
  // `-` and `:` belong in a tag name. Without them `<fixed-point>` scanned as
  // `<fixed>` and the rest of the name fell into the attribute text.
  const pattern = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>'"])*)>/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(region))) {
    const between = region.slice(cursor, match.index);
    // WHITESPACE BETWEEN TWO ELEMENTS IS A WORD BOUNDARY, not nothing. The
    // first version dropped it, and two sibling spans came out of the walk as
    // `with AIAI を` — a word boundary invented out of thin air on every
    // bilingual heading, in a tool whose entire job is to notice differences
    // that were not there before.
    if (between.trim()) stack[stack.length - 1].children.push({ text: between });
    else if (between) stack[stack.length - 1].children.push({ text: " " });
    cursor = pattern.lastIndex;
    const tag = match[1].toLowerCase();
    const closing = match[0][1] === "/";
    const selfClosing = match[2].trimEnd().endsWith("/");
    if (closing) {
      // STRICT. The end tag must close the element that is actually open. A
      // `lastIndexOf` unwind would recover from unbalanced markup by discarding
      // whatever sat between — silently, and an auditing tool that silently
      // discards page content is worse than one that stops.
      const open = stack[stack.length - 1];
      if (stack.length === 1 || open.tag !== tag) {
        throw new Error(`</${tag}> closes <${open.tag}>`);
      }
      stack.pop();
      continue;
    }
    const node = { tag, attrs: match[2], children: [] };
    stack[stack.length - 1].children.push(node);
    if (!VOID.has(tag) && !selfClosing) stack.push(node);
  }
  const tail = region.slice(cursor);
  if (tail.trim()) stack[stack.length - 1].children.push({ text: tail });
  if (stack.length !== 1) {
    throw new Error(`unclosed <${stack[stack.length - 1].tag}>`);
  }
  return root;
}

// A table row is a leaf, not a container.
//
// GRANULARITY IS PART OF THE COMPARISON. Markdown writes a row as one line, so
// descending into `<td>` would emit five blocks where the twin has one and turn
// every table into five spurious gaps. The first run of this tool produced
// 10595 HTML blocks against 5930 Markdown ones almost entirely for this reason
// and the list one below — a diff that large reports nothing at all.
const LEAF = new Set(["tr", "pre"]);

function hasBlockDescendant(node) {
  if (LEAF.has(node.tag)) return false;
  return node.children.some(
    (c) => c.tag && (BLOCK.has(c.tag) || hasBlockDescendant(c))
  );
}

// `<br>` becomes a space rather than a newline: the whole comparison is over
// collapsed text, and a page that lays a heading out on two lines is not making
// two statements.
function textOf(node) {
  if (node.text !== undefined) return decode(node.text);
  if (node.tag === "br") return " ";
  // Cells are joined with a space. Minified markup puts no whitespace between
  // `</td>` and `<td>`, so concatenating produced `0101提示詞注入` out of three
  // cells — a row that matches nothing and reads as a defect in the page.
  const separator = node.tag === "tr" ? " " : "";
  return node.children.map(textOf).join(separator);
}

// WHAT THE COMPARISON WOULD OTHERWISE THROW AWAY.
//
// The normalisation that makes an HTML block and a Markdown block comparable —
// strip the markup, keep the words — discards exactly the two things a reader
// most needs and cannot see: where a link points, and which words the page
// marked as code or emphasis.
//
// ⚠️ MEASURED, IN THE RED PROOF FOR ISSUE 272. Two of the six injected defects
// went in and never came out: a link redirected to `example.invalid/wrong` and
// a `**優勢：**` flattened to plain prose. Both were applied to the twin, both
// changed the file, and NEITHER APPEARED IN THE READER'S INPUT AT ALL — the
// aligner called both blocks a perfect match, because after stripping `[](…)`
// and `**` the two sides said the same words. The reader was then blamed for
// missing something it was never shown.
//
// So the destinations and the marked spans travel WITH the block, as part of
// what the alignment compares but not part of what is displayed. A changed URL
// or a lost `<code>` now moves the key and surfaces as a difference.
function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

// The walk. A block is emitted for any element that holds text and has no
// block-level descendant to hold it instead.
// Where the links in one block point, resolved the way a twin's links are.
//
// The rewriting rule is re-derived here rather than borrowed: root-relative
// against the origin, fragment-only against this page's own URL, anything
// already absolute left alone. It is stated in the issue that introduced it and
// is three lines; copying the converter's implementation would put both sides
// of the comparison behind the same mistake, which is the thing this file exists
// not to do.
// WHICH CHARACTERS ARE MARKED, not how the marks are split.
//
// `**A**B**C**` and `**ABC**` mark the same words and one converter writes one
// where another writes the other; comparing run-by-run reported 41 of those as
// differences. Comparing the marked characters still catches a mark that is
// GONE — which is the defect (`destress`) this exists for — without reporting a
// difference nobody could act on.
function markSignature(marks) {
  // THE CHARACTERS THAT ARE MARKED, sorted — not the runs, and not their order.
  //
  // The two sides split adjacent marks differently: a page with three `<strong>`
  // spans arrives as two `**…**` runs when the text between them is itself
  // marked. Comparing runs reported 41 of those, every one a difference in how
  // the same words were divided rather than in which words were marked. Sorting
  // whole runs did not help — the split moves text between them.
  //
  // A mark that is GONE still changes this, which is the defect (`destress`) the
  // signature exists for. What it stops noticing is a mark moved to different
  // words made of the same letters, which nothing in this build does.
  const of = (family) =>
    marks
      .filter((m) => m.startsWith(family + ":"))
      .map((m) => m.slice(family.length + 1))
      .join("")
      .replace(/\s+/g, "")
      .split("")
      .sort()
      .join("");
  return `code:${of("code")}|emphasis:${of("emphasis")}`;
}

function linksIn(node, canonical) {
  const out = [];
  (function walk(current) {
    if (current.text !== undefined) return;
    if (current.tag === "a") {
      const href = /href="([^"]*)"/.exec(current.attrs || "");
      if (href) out.push(absolute(href[1], canonical));
    }
    current.children.forEach(walk);
  })(node);
  return out.sort();
}

function absolute(href, canonical) {
  if (href.startsWith("//")) return href;
  if (href.startsWith("#")) return canonical + href;
  if (href.startsWith("/")) return ORIGIN + href;
  return href;
}

// The spans the page marked as code, strong or emphasis.
function marksIn(node) {
  // A `<pre><code>` IS the block; its `<code>` is not an inline mark. Counting
  // it produced 123 mismatches on the first run, because the Markdown side sees
  // a fence and reports no inline marks at all.
  if (node.tag === "pre") return [];
  const out = [];
  (function walk(current) {
    if (current.text !== undefined) return;
    if (current.tag === "pre") return;
    if (MARKED.has(current.tag)) {
      const text = collapse(textOf(current));
      const family = current.tag === "code" ? "code" : "emphasis";
      if (text) out.push(`${family}:${text}`);
    }
    current.children.forEach(walk);
  })(node);
  return out;
}

function blocksOf(node, out, canonical) {
  for (const child of node.children) {
    // A container's own loose text, alongside its block children. Zero pages
    // carry any today; the first version dropped it with a bare `continue`,
    // which would have removed a sentence from the audit without a trace.
    if (child.text !== undefined) {
      const loose = collapse(decode(child.text));
      if (loose) out.push({ kind: "text", tag: node.tag, text: loose, links: [], marks: [] });
      continue;
    }
    // A thematic break carries no text but is a block on the Markdown side, so
    // it has to be one here or every `* * *` reads as an insertion.
    if (child.tag === "hr") {
      out.push({ kind: "rule", tag: "hr", text: "---", links: [], marks: [] });
      continue;
    }
    if (!LEAF.has(child.tag) && hasBlockDescendant(child)) {
      blocksOf(child, out, canonical);
      continue;
    }
    const text = collapse(textOf(child));
    if (!text) continue;
    out.push({
      kind: KIND[child.tag] || "text",
      tag: child.tag,
      level: /^h([1-6])$/.test(child.tag) ? Number(child.tag[1]) : undefined,
      text,
      links: linksIn(child, canonical),
      marks: marksIn(child),
    });
  }
  return out;
}

function extract(html, canonical = "") {
  const region = mainRegion(html);
  if (region === null) throw new Error("no <main> in this page");
  return blocksOf(parse(withoutDiscarded(region)), [], canonical);
}

// Only what another file calls. The first version exported eleven symbols
// across the four files and three had a caller — and with no tests, by
// design, the rest had no consumer at all.
module.exports = { extract, collapse, markSignature };
