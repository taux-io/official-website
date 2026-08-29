// The Markdown twin, cut into the same kind of blocks the extractor produces.
//
// Blank-line separated, EXCEPT inside a fence. A fenced sample on these pages
// legitimately contains blank lines and `##` headings — a sample `CLAUDE.md`
// once had its `## Agent behaviour` promoted into the page's own outline, and a
// splitter that did not know about fences would re-import that confusion here.

const { collapse } = require("./extract");

// Indented by up to three spaces, which is still a fence and still a list item
// by CommonMark. None of the hundred pages indents one today; the version that
// anchored these at column zero would have read an indented fence as prose and
// re-imported the exact confusion `check:md`'s seventh assertion exists to stop.
const FENCE = /^ {0,3}(```|~~~)/;

// Each block carries the line it starts on, because "block 42" is a coordinate
// inside this tool and `about.md:37` is a coordinate in the file the reader has
// open. The first version emitted only the former, which is a position in the
// sense that a row number is a position and an address is not.
function split(body, firstLine = 1) {
  const out = [];
  let buffer = [];
  let fence = null;
  // `at` trails by one so the increment at the top of the loop lands ON the
  // line being read. Off by one here means every coordinate this tool hands a
  // reader points at the blank line above the block.
  let at = firstLine - 1;
  let start = firstLine;
  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) out.push({ raw: text, line: start });
    buffer = [];
    start = at + 1;
  };
  for (const line of body.split("\n")) {
    at++;
    const opener = FENCE.exec(line);
    if (fence) {
      buffer.push(line);
      if (opener && line.trim().startsWith(fence)) {
        fence = null;
        flush();
      }
      continue;
    }
    if (opener) {
      flush();
      // `flush` points `start` at the line after whatever it just closed, which
      // is the line after this fence's opener. The fence starts HERE. Seventy
      // five code blocks reported the line below their own ``` before this.
      start = at;
      fence = opener[1];
      buffer.push(line);
      continue;
    }
    if (line.trim() === "") flush();
    else buffer.push(line);
  }
  flush();
  // A run of list items or table rows is one paragraph by Markdown's rules and
  // N elements by HTML's. Split it so the two sides count the same things; see
  // the granularity note in `extract.js`.
  return out.flatMap(({ raw, line }) =>
    FENCE.test(raw)
      ? [{ raw, line }]
      : splitRuns(raw).map((piece, index) => ({ raw: piece, line: line + index }))
  );
}

function splitRuns(block) {
  const lines = block.split("\n");
  const runnable = (line) => /^\s*([-*+]|\d+\.)\s/.test(line) || /^\s*\|/.test(line);
  if (!lines.some(runnable)) return [block];
  const out = [];
  let buffer = [];
  for (const line of lines) {
    if (runnable(line)) {
      if (buffer.length) out.push(buffer.join("\n"));
      buffer = [line];
      continue;
    }
    // A wrapped continuation belongs to the item above it.
    if (buffer.length) buffer.push(line);
    else out.push(line);
  }
  if (buffer.length) out.push(buffer.join("\n"));
  return out.map((b) => b.trim()).filter(Boolean);
}

const RULE = /^\s*(\*\s*){3,}$|^\s*(-\s*){3,}$|^\s*(_\s*){3,}$/;
// The `|---|:--|` line under a table header. Table syntax, not content: the
// HTML has no element for it, so keeping it would report one insertion per
// table — 140 of them across the hundred pages, one per table.
//
// ⚠️ THIS COMMENT SAID 830, which was the total of every table-shaped pair the
// first run reported and not the delimiter count at all. Counted: 140.
const DELIMITER = /^\s*\|[\s:|-]+\|\s*$/;

function classify(raw) {
  if (FENCE.test(raw)) return { kind: "code", level: undefined };
  if (RULE.test(raw)) return { kind: "rule", level: undefined };
  if (DELIMITER.test(raw)) return { kind: "delimiter", level: undefined };
  const heading = /^(#{1,6})\s/.exec(raw);
  if (heading) return { kind: "heading", level: heading[1].length };
  if (/^>/.test(raw)) return { kind: "quote", level: undefined };
  if (/^\|/.test(raw)) return { kind: "row", level: undefined };
  if (/^ {0,3}([-*+]|\d+\.)\s/.test(raw)) return { kind: "item", level: undefined };
  return { kind: "para", level: undefined };
}

// The markup a Markdown block carries that its HTML source did not, removed so
// the two sides can be compared as the same sentence.
//
// A CODE BLOCK IS LEFT ALONE. Stripping `*` and backticks from a sample would
// rewrite the very thing the page is quoting, and two samples that differ only
// in their asterisks would then compare equal.
function visible(raw, kind) {
  if (kind === "rule") return "---";
  if (kind === "code") {
    return collapse(raw.split("\n").slice(1, -1).join("\n"));
  }
  let text = raw
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/gm, "")
    .replace(/^([-*+]|\d+\.)\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    // ⚠️ ONLY `*`. The first version also treated `_` as emphasis, and
    // `linear_create_issue` — an identifier the page is teaching — came out as
    // `linearcreateissue`. `htmd` writes emphasis with asterisks, so the
    // underscore rule bought nothing and corrupted five samples.
    .replace(/\*(?!\s)(.*?)(?<!\s)\*/g, "$1")
    // BACKSLASH ESCAPES COME BACK OUT. `htmd` correctly writes a heading that
    // opens `1. ` as `1\. `, because unescaped it would be an ordered list.
    // The escape is Markdown syntax, not a word the page says — leaving it in
    // reported 110 headings as CHANGED, thirty percent of everything this tool
    // asked a reader to look at, every one of them identical to its HTML once
    // the backslash was removed.
    .replace(/\\([-`*_#.+!>\[\]()])/g, "$1");
  if (kind === "row") {
    text = text.replace(/^\|/, "").replace(/\|$/, "").split("|").join(" ");
  }
  return collapse(text);
}

// The same two things the HTML side carries: where links point, and which spans
// the twin marks as code or emphasis. See the note in `extract.js` — the red
// proof for issue 272 put a redirected link and a flattened `**…**` into a twin
// and neither reached a reader, because stripping `[](…)` and `**` made both
// sides say the same words.
function linksIn(raw, kind) {
  if (kind === "code") return [];
  return [...raw.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1]).sort();
}

// NESTED MARKS. `**一定要勾 `x`。**` is a `<code>` inside a `<strong>`. The HTML
// walk records the outer span's TEXT — backticks are markup, not characters the
// page shows — while a regex over the Markdown captures the backticks with it.
// Forty blocks differed by exactly those characters and nothing else.
// ⚠️ BACKTICKS AND ASTERISKS ONLY. The first version of this line also stripped
// `_`, and `<user_input>` — an XML tag the page is teaching — became
// `<userinput>` on fifteen pages. That is the SECOND time an underscore rule
// has corrupted an identifier in this file: `visible()` did it to
// `linear_create_issue` and carries a warning about it eight lines below. The
// warning was there and the same mistake was made anyway, in a helper written
// to fix a different one.
const bare = (text) => collapse(text.replace(/[`*]/g, ""));

function marksIn(raw, kind) {
  if (kind === "code") return [];
  const out = [];
  for (const [, inner] of raw.matchAll(/`([^`]+)`/g)) out.push(`code:${bare(inner)}`);
  const withoutStrong = raw.replace(/\*\*(?!\s)([\s\S]*?)(?<!\s)\*\*/g, (whole, inner) => {
    out.push(`emphasis:${bare(inner)}`);
    return " ";
  });
  // `htmd` writes `<em>` as a single asterisk. Matched after the double ones are
  // taken out, or `**bold**` reads as an empty emphasis on each side of it.
  for (const [, inner] of withoutStrong.matchAll(/\*(?!\s)([^*]+?)(?<!\s)\*/g)) {
    out.push(`emphasis:${bare(inner)}`);
  }
  return out;
}

// Strips the front matter and returns the body's blocks.
function blocks(markdown) {
  let body = markdown;
  let offset = 1;
  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---\n", 4);
    if (end !== -1) {
      offset += markdown.slice(0, end + 5).split("\n").length - 1;
      body = body.slice(end + 5);
    }
  }
  return split(body, offset)
    .map(({ raw, line }) => {
      const { kind, level } = classify(raw);
      return {
        kind,
        level,
        raw,
        line,
        text: visible(raw, kind),
        links: linksIn(raw, kind),
        marks: marksIn(raw, kind),
      };
    })
    .filter((block) => block.kind !== "delimiter");
}

module.exports = { blocks };
