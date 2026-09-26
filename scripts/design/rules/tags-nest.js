const path = require("path");
const { compose, lineOf } = require("../lib");
const { markup } = require("../rendered");

// RULE 36 — tags nest.
//
// THE DIV COUNT WAS RIGHT AND THE PAGE WAS BROKEN. A layout sweep left
// /geo-guide with one `</div>` too many in the middle and one too few at the
// end: the totals matched, so nothing noticed, and the reading column closed
// two sections early. Those two sections rendered at x=0 across the full
// 1280px window with the rest of the page in a 680px column beside them.
//
// EVERY GATE WAS GREEN. `check:classes` reads class names, `check:design` read
// attributes, `check:md` reads the converted Markdown (htmd re-balances as it
// parses), `contrast` and `geometry` measure what the browser rendered — and
// the browser silently repairs mis-nesting, which is exactly why the damage is
// visual rather than fatal. Reported by a person looking at the page.
//
// Comments and the contents of <script>/<style> are removed first: minijinja
// tags and JS both contain `<` and `>`. Void and self-closing elements are
// skipped, and SVG's own void elements are named because this site draws
// icons inline.
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
  "path", "circle", "rect", "line", "polygon", "polyline", "ellipse", "use", "stop",
]);

// The nesting walk itself, over text whose comments, scripts and styles are
// already blanked. Returns offsets; each caller decides how to name a place.
function crossings(src) {
  const out = [];
  const stack = [];
  for (const m of src.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/?)>/g)) {
    const [, closing, raw, , selfClosing] = m;
    const tag = raw.toLowerCase();
    if (VOID_ELEMENTS.has(tag) || selfClosing) continue;
    if (!closing) {
      stack.push({ tag, at: m.index });
      continue;
    }
    const top = stack[stack.length - 1];
    if (!top) {
      out.push({ kind: "stray", tag, at: m.index });
      continue;
    }
    if (top.tag === tag) {
      stack.pop();
      continue;
    }
    out.push({ kind: "cross", tag, at: m.index, open: top });
    const at = stack.map((e) => e.tag).lastIndexOf(tag);
    if (at !== -1) stack.length = at;
  }
  for (const open of stack) out.push({ kind: "unclosed", tag: open.tag, at: open.at });
  return out;
}

const describe = (c, where, page) => {
  if (c.kind === "stray") return `</${c.tag}> closes nothing that is open (in ${page})`;
  if (c.kind === "unclosed") return `<${c.tag}> is never closed (in ${page})`;
  const opened = where(c.open.at);
  return (
    `</${c.tag}> closes <${c.open.tag}> opened at ${opened.file}:${opened.line} — the tags cross, ` +
    `so the browser repairs the tree and the layout lands somewhere nobody wrote (in ${page})`
  );
};

// TWO PASSES, AND THE SECOND IS THE ONE THAT CANNOT GO BLIND.
//
// The first composes each page from template source (`compose()` follows
// `{% include %}`) and names the file and line a crossing came from — the
// precise answer, when it exists. It does not exist for markup a macro, an
// `import` or an `extends` produced: `compose()` does not run Jinja, and in the
// 2026-09 evaluation a macro with an unclosed `<div>` and a `_base.html`
// missing its `</main>` both passed this rule.
//
// The second walks the built page (scripts/design/rendered.js), which has
// every tag the reader gets. A page it finds broken while the source pass found
// that page clean is reported at its dist line, with the reason named.
function ruleTagsNest(files, { rendered }) {
  const byRel = new Map(files.map((f) => [f.rel, f]));
  const PARTIAL = /(^|[\\/])(header\.html|footer\.html|_)/;
  const found = [];
  const cleanInSource = new Set();
  for (const { rel } of files) {
    if (PARTIAL.test(rel)) continue;
    const page = compose(rel, byRel);
    // Offsets shift when comments and scripts go, so they are blanked rather
    // than deleted: same length, same map, nothing left to parse.
    const blank = (m) => " ".repeat(m.length);
    const src = page.text
      .replace(/<!--[\s\S]*?-->/g, blank)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, blank);
    const where = (offset) => {
      const seg = page.map.find((s) => offset >= s.start && offset < s.end);
      if (!seg) return { file: rel, line: 0 };
      return { file: seg.rel, line: seg.line + page.text.slice(seg.start, offset).split("\n").length - 1 };
    };
    const problems = crossings(src);
    if (!problems.length) cleanInSource.add(rel);
    for (const c of problems) found.push({ ...where(c.at), detail: describe(c, where, rel) });
  }

  for (const page of rendered()) {
    if (!cleanInSource.has(path.join("templates", page.template))) continue;
    const src = markup(page);
    const where = (offset) => ({ file: page.dist, line: lineOf(page.html, offset) });
    for (const c of crossings(src)) {
      found.push({
        ...where(c.at),
        detail:
          describe(c, where, page.url) +
          " — only in the built page: the template source nests, so this came from a macro, an import or an extends",
      });
    }
  }
  return found;
}

module.exports = ruleTagsNest;
