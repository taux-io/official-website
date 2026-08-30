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
//
// ⚠️ THAT SENTENCE WAS A PROMISE NOTHING KEPT. The counts sat in `matches:` and
// no code ever compared them to reality; `md:audit` printed only a total. A
// declared number that nothing checks is exactly what `NOTES.md` means by a
// second source — and this file's own comment cited it as the mechanism that
// had just caught a widening rule, which it had not: a person had. `tally()`
// in `index.js` now checks them on every run and says so.

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
    // ⚠️ RENAMED FROM "bilingual heading separator". Issue 281 added a third
    // shape — a number badge before a title — which is not bilingual at all.
    // A rule whose name describes only some of what it claims is a rule nobody
    // can check against its own reason.
    name: "heading part separator",
    matches: 258,
    why:
      "Issues 270, 278, 281, 282 and 284: a heading can be built from two " +
      "parts — two " +
      "language halves, or a section number and a title — laid out as two " +
      "lines or a circle by CSS. Markdown has neither, so the generator writes " +
      "an em dash between them. The HTML carries no separator, so every such " +
      "heading differs here.",
    applies: (op) =>
      op.op === "diff" &&
      op.html.kind === "heading" &&
      // ⚠️ THE PAGE JOINS THE HALVES TWO WAYS, and the first version knew one.
      // The `display-*` shape leaves a space between its spans; the
      // `class="block"` shape of issue 278 leaves nothing in TWO of the five
      // locales (ja-JP and ko-KR, 30 headings; the other three leave a space,
      // 45). A rule that only put a space back left correctly separated
      // headings looking like defects.
      // EXACTLY ONE SEPARATOR IS THE ONE WE INSERTED — but not necessarily the
      // first. Five `pqc-migration` headings carry an em dash inside their
      // SECOND half (`CBOM — Cryptography Bill of Materials`), so splitting on
      // every occurrence takes the heading apart at a boundary the page put
      // there itself. Taking only the first fixes those and breaks the mirror
      // case, where the FIRST half carries one (`Google Cloud Tech — notes`).
      // So: try removing each occurrence in turn and accept if any one of them
      // reconstructs the page's text.
      rejoinsAt(op.md.text, op.html.text) &&
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

// Whether removing exactly one separator from `md` — either as a space or as
// nothing, since the page joins its halves both ways — yields the page's text.
function rejoinsAt(md, html) {
  for (let at = md.indexOf(SEPARATOR); at !== -1; at = md.indexOf(SEPARATOR, at + 1)) {
    const head = md.slice(0, at);
    const tail = md.slice(at + SEPARATOR.length);
    if (`${head} ${tail}` === html || head + tail === html) return true;
  }
  return false;
}

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
