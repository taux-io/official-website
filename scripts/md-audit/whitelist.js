// Which differences between a page and its Markdown twin are SUPPOSED to be
// there, and why each one is.
//
// WHY A WHITELIST AND NOT A JUDGEMENT. Without one, a reader invents its own
// standard for "close enough" — and the standard it invents always drifts
// towards "this is probably fine", because that is the cheaper answer and
// nothing contradicts it. Naming the legal differences up front turns the
// reader's job from an opinion into a yes/no question: is this difference one
// of the listed ones, or not?
//
// EVERY ENTRY CARRIES ITS REASON. An entry nobody can justify is an entry that
// is hiding a defect, and the count beside each one is measured against the
// current build rather than remembered — this line of work has now shipped six
// separate comments whose numbers were wrong.
//
// ⚠️ THE WHITELIST IS NOT ALLOWED TO GROW TO FIT THE OUTPUT. Adding a rule
// because it silences a lot of pairs is how an audit ends with nothing to
// report. Each rule below describes a transformation the converter performs
// deliberately, named in the issue that introduced it.

const { collapse } = require("./extract");

// The em dash the generator inserts between the two halves of a bilingual
// heading (issue 270). The HTML has the halves as two spans and no separator at
// all, so every one of these headings differs by exactly this string.
const SEPARATOR = " — ";

const RULES = [
  {
    name: "bilingual heading separator",
    why:
      "Issue 270: `<h1>` is two spans laid out as two lines by CSS. Markdown " +
      "has no CSS and a heading is one line, so the generator inserts an em " +
      "dash. The HTML carries no separator, so every such heading differs here.",
    applies: (op) =>
      op.op === "diff" &&
      op.html.kind === "heading" &&
      op.md.text.split(SEPARATOR).join(" ") === op.html.text,
  },
  {
    name: "decorative chip dropped",
    why:
      "Issue 270: `class=\"tag\"` draws a rounded chip. Markdown has no shape, " +
      "so a chip lands as a bare line that reads like a sentence the page is " +
      "making. The generator drops it, so the HTML has a block the twin does not.",
    applies: (op) =>
      op.op === "html-only" &&
      op.html.kind === "text" &&
      (op.html.tag === "div" || op.html.tag === "span"),
  },
];

// A difference is legal when a rule claims it. Everything else goes to a reader.
function classify(op) {
  if (op.op === "match") return { legal: true, rule: "identical" };
  const rule = RULES.find((r) => r.applies(op));
  return rule ? { legal: true, rule: rule.name } : { legal: false, rule: null };
}

// The pairs a reader actually has to look at.
function forReview(ops) {
  return ops.filter((op) => !classify(op).legal);
}

module.exports = { RULES, classify, forReview, SEPARATOR, collapse };
