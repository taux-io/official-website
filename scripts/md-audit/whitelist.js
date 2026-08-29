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
// EVERY ENTRY CARRIES ITS REASON and names the issue that introduced the
// transformation. An entry nobody can justify is an entry hiding a defect.
//
// ⚠️ THE WHITELIST IS NOT ALLOWED TO GROW TO FIT THE OUTPUT — and the first
// version of this file broke that rule in the same breath as stating it. Its
// chip entry matched any html-only `text` block on a `div` or `span`, tag name
// alone, because the blocks did not carry their class. There are 395 such
// blocks in this build, the longest 473 characters. Deleting a cited study from
// one twin and re-running gave `89 identical, 1 legal by whitelist, 0 needing
// judgement`: an entire paragraph gone, reported as a clean page. A rule that
// silences a whole class of block because it cannot see what distinguishes them
// is not a whitelist, it is a blindfold.
//
// EVERY RULE BELOW IS NARROWED BY SOMETHING IT CAN ACTUALLY CHECK — a class
// token, an exact separator, a resolved URL — and each carries the count it
// matches in the current build, so a rule that silently widens shows up as a
// number that moved.

const ORIGIN = "https://taux.io";

// The em dash the generator inserts between the two halves of a bilingual
// heading (issue 270). The HTML has the halves as two spans and no separator at
// all, so every such heading differs by exactly this string.
const SEPARATOR = " — ";

// The class that marks a decorative chip. `class="eyebrow"` is NOT here and
// must not be: issue 269 records 1240 of those inside `<main>`, most of them
// real content.
const CHIP = "tag";

const RULES = [
  {
    name: "bilingual heading separator",
    matches: 231,
    why:
      "Issues 270 and 278: a bilingual heading is two halves, laid out as two " +
      "lines by CSS. Markdown has no CSS and a heading is one line, so the " +
      "generator inserts an em dash. The HTML carries no separator, so every " +
      "such heading differs here.",
    applies: (op) =>
      op.op === "diff" &&
      op.html.kind === "heading" &&
      // ⚠️ THE PAGE JOINS THE HALVES TWO WAYS, and the first version knew one.
      // The `display-*` shape leaves a space between its spans; the
      // `class="block"` shape of issue 278 leaves nothing in three of five
      // locales. A rule that only put a space back left 33 correctly separated
      // headings looking like defects — the count declared below is what caught
      // it, which is what the counts are for.
      // ONLY THE FIRST SEPARATOR IS THE ONE WE INSERTED. Five `pqc-migration`
      // headings carry an em dash inside their second half — `CBOM — Cryptography
      // Bill of Materials` — so splitting on every occurrence took the heading
      // apart at a boundary the page put there itself and failed to reconstruct
      // it. A reader flagged this shape as a "false boundary" while judging the
      // glued form, before the fix existed.
      (op.md.text.replace(SEPARATOR, " ") === op.html.text ||
        op.md.text.replace(SEPARATOR, "") === op.html.text) &&
      // ⚠️ THE TEXT IS NOT THE WHOLE BLOCK. Links and marks travel in the
      // alignment key precisely because a block can differ while its words do
      // not; a rule that compares only the words would license a heading whose
      // link had been redirected — reopening the hole the key was added to
      // close, from inside the whitelist.
      sameLinks(op) &&
      sameMarks(op),
  },
  {
    name: "decorative chip dropped",
    matches: 60,
    why:
      'Issue 270: `class="tag"` draws a rounded pill above a heading. In ' +
      "Markdown there is no shape, so it would land as a bare line reading " +
      "like a sentence the page is making. The generator drops it, so the page " +
      "has a block the twin does not. Narrowed to the class, not the tag name.",
    applies: (op) =>
      op.op === "html-only" &&
      op.html.kind === "text" &&
      (op.html.classes || []).includes(CHIP),
  },
  {
    name: "link rewritten absolute",
    matches: 0,
    why:
      "The generator rewrites `/zh-Hant-TW/geo-guide` and `#speed` so the " +
      "Markdown survives being copied elsewhere. The extractor resolves the " +
      "page's own hrefs the same way before comparing, so a correctly rewritten " +
      "link is already equal and this rule matches nothing today. It is here " +
      "because the transformation is real and a reader is told about it in " +
      "READER.md: an entry matching zero is a claim that can be checked, and " +
      "one that starts matching is a signal the resolution has drifted.",
    applies: (op) =>
      op.op === "diff" &&
      op.html.text === op.md.text &&
      sameMarks(op) &&
      op.html.links.length === op.md.links.length &&
      op.html.links.every((href, at) => absolute(href) === op.md.links[at]),
  },
];

function absolute(href) {
  return href.startsWith("/") ? ORIGIN + href : href;
}

function sameLinks(op) {
  return op.html.links.join(",") === op.md.links.join(",");
}

function sameMarks(op) {
  return op.html.marks.join(",") === op.md.marks.join(",");
}

// A difference is legal when a rule claims it. Everything else goes to a reader.
function classify(op) {
  if (op.op === "match") return { legal: true, rule: "identical" };
  const rule = RULES.find((r) => r.applies(op));
  return rule ? { legal: true, rule: rule.name } : { legal: false, rule: null };
}

// Only what another file requires. `RULES` is here because the counts beside
// each rule are the thing a future reader checks; nothing else is.
module.exports = { RULES, classify };
