const path = require("path");
const { compose } = require("../lib");

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

function ruleTagsNest(files) {
  const byRel = new Map(files.map((f) => [f.rel, f]));
  const PARTIAL = /(^|[\\/])(header\.html|footer\.html|_)/;
  const found = [];
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
        found.push({ ...where(m.index), detail: `</${tag}> closes nothing that is open (in ${rel})` });
        continue;
      }
      if (top.tag === tag) {
        stack.pop();
        continue;
      }
      const opened = where(top.at);
      found.push({
        ...where(m.index),
        detail:
          `</${tag}> closes <${top.tag}> opened at ${opened.file}:${opened.line} — the tags cross, ` +
          `so the browser repairs the tree and the layout lands somewhere nobody wrote (in ${rel})`,
      });
      const at = stack.map((e) => e.tag).lastIndexOf(tag);
      if (at !== -1) stack.length = at;
    }
    for (const { tag, at } of stack) {
      found.push({ ...where(at), detail: `<${tag}> is never closed (in ${rel})` });
    }
  }
  return found;
}

module.exports = ruleTagsNest;
