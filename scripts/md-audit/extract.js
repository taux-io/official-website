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
// unclosed non-void tag as an error rather than guessing. That is deliberate —
// a lenient parser recovers silently, and silent recovery in an auditing tool
// is the failure mode the tool exists to find.

// Dropped before anything else, contents and all. The same four the converter
// skips — matched here because a decorative SVG's `<title>` and a script's body
// are text that never reaches a reader, not because the converter says so.
const DISCARDED = new Set(["svg", "script", "style", "noscript"]);

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
const KIND = {
  h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading",
  h6: "heading", p: "para", li: "item", pre: "code", tr: "row",
  blockquote: "quote", figcaption: "caption", dt: "term", dd: "definition",
  summary: "summary",
};

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", rsquo: "’",
  lsquo: "‘", ldquo: "“", rdquo: "”", times: "×",
  copy: "©", tau: "τ",
};

// MEASURED, NOT GUESSED. The named entities this build actually contains are
// `&copy;` (101), `&mdash;` (85), `&gt;` (82), `&lt;` (80), `&tau;` (5) and
// `&amp;` (4). `&tau;` and `&copy;` were missing from the first version, so the
// company's own name — the Greek letter the company is named after — compared
// unequal on eleven pages, and the tool reported a defect that was its own.
// An unknown entity is left as written rather than dropped, so the next one
// shows up as a difference instead of vanishing.

function decode(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
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
  const pattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>'"])*)>/g;
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
      // Find the matching open on the stack. An end tag with no open is
      // reported rather than ignored.
      const at = stack.map((n) => n.tag).lastIndexOf(tag);
      if (at <= 0) throw new Error(`</${tag}> with no matching open tag`);
      stack.length = at;
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
    (c) => c.tag && !DISCARDED.has(c.tag) && (BLOCK.has(c.tag) || hasBlockDescendant(c))
  );
}

// `<br>` becomes a space rather than a newline: the whole comparison is over
// collapsed text, and a page that lays a heading out on two lines is not making
// two statements.
function textOf(node) {
  if (node.text !== undefined) return decode(node.text);
  if (DISCARDED.has(node.tag)) return "";
  if (node.tag === "br") return " ";
  // Cells are joined with a space. Minified markup puts no whitespace between
  // `</td>` and `<td>`, so concatenating produced `0101提示詞注入` out of three
  // cells — a row that matches nothing and reads as a defect in the page.
  const separator = node.tag === "tr" ? " " : "";
  return node.children.map(textOf).join(separator);
}

function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

// The walk. A block is emitted for any element that holds text and has no
// block-level descendant to hold it instead.
function blocksOf(node, out) {
  for (const child of node.children) {
    if (child.text !== undefined) continue;
    if (DISCARDED.has(child.tag)) continue;
    // A thematic break carries no text but is a block on the Markdown side, so
    // it has to be one here or every `* * *` reads as an insertion.
    if (child.tag === "hr") {
      out.push({ kind: "rule", tag: "hr", text: "---" });
      continue;
    }
    if (!LEAF.has(child.tag) && hasBlockDescendant(child)) {
      blocksOf(child, out);
      continue;
    }
    const text = collapse(textOf(child));
    if (!text) continue;
    out.push({
      kind: KIND[child.tag] || "text",
      tag: child.tag,
      level: /^h([1-6])$/.test(child.tag) ? Number(child.tag[1]) : undefined,
      text,
    });
  }
  return out;
}

function extract(html) {
  const region = mainRegion(html);
  if (region === null) throw new Error("no <main> in this page");
  return blocksOf(parse(region), []);
}

module.exports = { extract, mainRegion, collapse, decode };
