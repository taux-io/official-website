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

const { markSignature } = require("./extract");

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
    matches: 262,
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
    // Issue 279. `htmd` ends a paragraph where the page had only a `<br>` or a
    // nested block, so one `<p>` arrives as two. Ten of them in this build, all
    // on `claude-skills-guide`, all in the lead paragraph and the MCP
    // comparison — the two places that put two sentences in one `<p>` and rely
    // on the line break to separate them.
    //
    // NARROWED TO EXACT RECONSTRUCTION. The rule refuses unless the page's
    // paragraph is character for character the twin's pieces joined by one
    // space, with the same links and the same marks in the same order. A word
    // dropped at the seam, a link that moved between the halves, a third
    // paragraph that came from nowhere — none of those reconstruct, and all of
    // them stay a reader's problem.
    //
    // WHAT IT CANNOT SEE: whether splitting there was a good idea. The twin now
    // says two things where the page said one, and if the page's sentence
    // depended on being one paragraph — a list introduced by a colon, say —
    // this rule calls that legal and nobody is told. It is a fidelity rule, not
    // a readability one; Pass B is where that question belongs.
    name: "paragraph split at a line break",
    matches: 20,
    why:
      "Issue 279: `htmd` turns a `<p>` that contains a line break into two " +
      "Markdown paragraphs. No text is lost — the page's paragraph is exactly " +
      "the twin's pieces joined by a space — so the twin reads the same and " +
      "the tool sees one changed block followed by one that appeared.",
    applies: (op, at) => splitRun(op, at) !== null,
  },
  {
    // Issue 279. A pull quote is a `<p>` and a `<cite>` in the page; `htmd`
    // folds both into one `>` blockquote, so the body has no counterpart and
    // the attribution appears to have grown a whole paragraph. Ten pairs, the
    // same quote on the five locales of `geo-guide`.
    //
    // NARROWED TO THE `<cite>` TAG AND EXACT RECONSTRUCTION. Only a `cite`
    // becoming a `quote` qualifies, and only when the twin's blockquote is the
    // orphaned paragraph and the cite joined by one space. A paragraph that
    // merely vanished next to a quote does not reconstruct and is still shown.
    //
    // WHAT IT CANNOT SEE: that the attribution belongs to that quote. It checks
    // that the characters line up, not that the page meant them to. Two
    // adjacent quotes whose bodies were swapped would reconstruct just as well.
    name: "quote and attribution merged",
    matches: 10,
    why:
      "Issue 279: the page marks a pull quote as a paragraph plus a `<cite>`. " +
      "Markdown has one blockquote for both, so the converter joins them. The " +
      "tool sees the body with no partner and the attribution apparently " +
      "replaced by the whole quote.",
    applies: (op, at) => mergedQuote(op, at) !== null,
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
//
// ⚠️ A RULE CAN SEE ITS NEIGHBOURS, and until issue 279 it could not. Two of
// the transformations below are not visible in one op: a paragraph split in two
// is a changed block AND the block that appeared after it, and a folded quote
// is a changed block AND the orphan beside it. A rule shown only one half has
// to either guess or refuse, and the first draft of this file guessed — it
// matched any `md-only` paragraph whose text was a suffix of anything, which is
// a licence to delete the first half of any paragraph on the site.
//
// `at` is `{ ops, index }`: the whole list and where this op sits in it. Rules
// that do not need it ignore it, and the three that predate this change take
// exactly the argument they always took.
function classify(op, at = { ops: [op], index: 0 }) {
  if (op.op === "match") return { legal: true, rule: "identical" };
  const rule = RULES.find((r) => r.applies(op, at));
  return rule ? { legal: true, rule: rule.name } : { legal: false, rule: null };
}

// The joiner. `htmd` ends a paragraph at a line break and the page's own markup
// left a space there, so the two pieces rejoin with exactly one space. Not a
// regex over whitespace: a rule that normalised whitespace away would also
// forgive a paragraph that lost a newline in the middle of a code sample.
const JOIN = " ";

// A split paragraph, seen from either half: returns the [anchor, ...pieces] ops
// when this op belongs to one, and null when it does not.
//
// FROM EITHER HALF, because both halves are classified and each has to reach
// the same verdict on its own. A version that only understood the anchor would
// report the tail as a block that appeared from nowhere — the exact noise this
// rule exists to remove — and one that only understood the tail would leave the
// anchor looking like a paragraph that lost its second half.
function splitRun(op, { ops, index }) {
  let anchor = index;
  while (anchor >= 0 && ops[anchor].op === "md-only") anchor--;
  if (anchor < 0) return null;
  const head = ops[anchor];
  if (!head || head.op !== "diff") return null;
  if (head.html.kind !== "para" || head.md.kind !== "para") return null;
  const pieces = [];
  for (let k = anchor + 1; k < ops.length && ops[k].op === "md-only"; k++) {
    if (ops[k].md.kind !== "para") return null;
    pieces.push(ops[k]);
  }
  if (!pieces.length) return null;
  if (index !== anchor && !pieces.includes(op)) return null;
  const rejoined = [head.md, ...pieces.map((p) => p.md)].map((b) => b.text).join(JOIN);
  if (rejoined !== head.html.text) return null;
  const links = [head.md, ...pieces.map((p) => p.md)].flatMap((b) => b.links);
  const marks = [head.md, ...pieces.map((p) => p.md)].flatMap((b) => b.marks);
  if (links.join(",") !== head.html.links.join(",")) return null;
  if (markSignature(marks) !== markSignature(head.html.marks)) return null;
  return [head, ...pieces];
}

// A pull quote whose body and attribution the converter folded into one
// blockquote, seen from either half.
function mergedQuote(op, { ops, index }) {
  const pairing = (fold, body) =>
    fold &&
    body &&
    fold.op === "diff" &&
    fold.html.tag === "cite" &&
    fold.md.kind === "quote" &&
    body.op === "html-only" &&
    body.html.kind === "para" &&
    `${body.html.text}${JOIN}${fold.html.text}` === fold.md.text &&
    [...body.html.links, ...fold.html.links].join(",") === fold.md.links.join(",") &&
    markSignature([...body.html.marks, ...fold.html.marks]) === markSignature(fold.md.marks)
      ? [fold, body]
      : null;
  // The two sit next to each other; which comes first is the seam's business.
  return (
    pairing(op, ops[index + 1]) ||
    pairing(op, ops[index - 1]) ||
    pairing(ops[index - 1], op) ||
    pairing(ops[index + 1], op)
  );
}

// Only what another file requires. `RULES` is here because the counts beside
// each rule are the thing a future reader checks; nothing else is.
module.exports = { RULES, classify };
