// The Markdown twin, cut into the same kind of blocks the extractor produces.
//
// Blank-line separated, EXCEPT inside a fence. A fenced sample on these pages
// legitimately contains blank lines and `##` headings — a sample `CLAUDE.md`
// once had its `## Agent behaviour` promoted into the page's own outline, and a
// splitter that did not know about fences would re-import that confusion here.

const FENCE = /^(```|~~~)/;

function split(body) {
  const out = [];
  let buffer = [];
  let fence = null;
  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) out.push(text);
    buffer = [];
  };
  for (const line of body.split("\n")) {
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
  return out.flatMap((block) =>
    FENCE.test(block) ? [block] : splitRuns(block)
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
// table — 830 of them across the hundred pages, on the first run.
const DELIMITER = /^\s*\|[\s:|-]+\|\s*$/;

function classify(raw) {
  if (FENCE.test(raw)) return { kind: "code", level: undefined };
  if (RULE.test(raw)) return { kind: "rule", level: undefined };
  if (DELIMITER.test(raw)) return { kind: "delimiter", level: undefined };
  const heading = /^(#{1,6})\s/.exec(raw);
  if (heading) return { kind: "heading", level: heading[1].length };
  if (/^>/.test(raw)) return { kind: "quote", level: undefined };
  if (/^\|/.test(raw)) return { kind: "row", level: undefined };
  if (/^([-*+]|\d+\.)\s/.test(raw)) return { kind: "item", level: undefined };
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
    return raw.split("\n").slice(1, -1).join("\n").replace(/\s+/g, " ").trim();
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
    .replace(/\*(?!\s)(.*?)(?<!\s)\*/g, "$1");
  if (kind === "row") {
    text = text.replace(/^\|/, "").replace(/\|$/, "").split("|").join(" ");
  }
  return text.replace(/\s+/g, " ").trim();
}

// Strips the front matter and returns the body's blocks.
function blocks(markdown) {
  let body = markdown;
  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---\n", 4);
    if (end !== -1) body = body.slice(end + 5);
  }
  return split(body)
    .map((raw) => {
      const { kind, level } = classify(raw);
      return { kind, level, raw, text: visible(raw, kind) };
    })
    .filter((block) => block.kind !== "delimiter");
}

module.exports = { blocks, split, visible, classify };
