// Pairs the two block lists, allowing insertions and deletions.
//
// WHY NOT PAIR THEM IN ORDER. Position-for-position pairing survives exactly as
// far as the first gap and then reports every block after it as wrong. The
// converter deliberately drops the decorative chips, so sixty pages open with a
// gap on purpose — an in-order pairing would have produced sixty pages of noise
// and buried whatever else was there. The gaps are the finding; everything
// after them is not.
//
// Longest common subsequence over the normalised text, which is the same
// algorithm a diff uses and needs no dependency.

function lcs(left, right, key) {
  const n = left.length;
  const m = right.length;
  const table = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = key(left[i]) === key(right[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(left[i]) === key(right[j])) {
      ops.push({ op: "match", html: left[i], md: right[j] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ op: "html-only", html: left[i++] });
    } else {
      ops.push({ op: "md-only", md: right[j++] });
    }
  }
  while (i < n) ops.push({ op: "html-only", html: left[i++] });
  while (j < m) ops.push({ op: "md-only", md: right[j++] });
  return ops;
}

// A deletion immediately followed by an insertion is one block that CHANGED,
// not two that vanished and appeared. Reporting it as a pair is what lets a
// reader answer "are these the same sentence?" instead of guessing which
// orphan belongs to which.
//
// BOTH ORDERS. The first version paired only html-only → md-only, so whether a
// changed block was reported as one pair or two orphans depended on which side
// the alignment happened to walk first — the same finding wearing two different
// shapes depending on nothing the reader can see.
//
// ⚠️ THE PARTNER IS CHOSEN BY KIND FIRST, and the version before this one had
// no opinion at all: it paired the LAST deletion with the FIRST insertion,
// whatever the two were. Four pages open with an `<h1>` whose halves the twin
// separates, followed by a `<p>` the converter splits in two. LCS emits the
// deletions together and then the insertions together:
//
//   html-only h1   html-only p   md-only heading   md-only para   md-only para
//
// Pairing only across the seam gave `diff(p → heading)` — a paragraph reported
// as having turned into a heading — and left the `<h1>` an orphan. Both blocks
// were intact; the tool had matched them to the wrong partners, and sixteen
// pairs reached a reader looking like losses. The whitelist could not rescue
// them either: its separator rule wants a heading on the HTML side and was
// being shown a paragraph.
//
// ⚠️ THE FIX IS NOT TO WHITELIST THAT SHAPE, which is what issue 279 asked for.
// A rule saying "a heading paired with a paragraph is legal" would silence the
// tool's own mis-pairing and, with it, every real case of a heading demoted to
// prose that reaches this point. The shape is not a difference between the page
// and the twin at all.
//
// ⚠️ THAT SENTENCE USED TO END AT "demoted to prose", crediting this file with
// seeing a defect it was blind to — the alignment key had no opinion about what
// a block was, so a demoted heading matched its own paragraph and never reached
// a rule at all. `keyOf` below is where that was fixed.
//
// ⚠️ THERE IS NO MIRROR CASE, and this function used to carry one — a second
// branch for a run of insertions followed by a run of deletions, commented "LCS
// may walk the insertions first". It cannot. The table is monotone, so an
// `md-only` is never immediately followed by an `html-only`; brute force over
// every pair of sequences up to length five from a three-symbol alphabet
// (1048576 pairs) produces the shape zero times, and instrumenting the branch
// across all hundred pages hit it zero times. Nine lines of code and a comment
// asserting a behaviour that does not exist, which is worse than no comment:
// somebody would have maintained it.
//
// ⚠️ NOR IS THE FIX TO ZIP THE RUNS INDEX FOR INDEX. That was tried and
// measured against this tree: 0 pairs needing judgement become 106, and three
// of the five rules stop matching what they declare — the chip rule falls from
// 60 to 12, because a dropped chip is an `html-only` block by definition and
// zipping married sixty of them to whatever insertion happened to follow.
// Kind is the narrowest thing that separates the two situations, so kind is
// what is used, and everything the old rule paired it still pairs.
function pairAdjacent(ops) {
  const out = [];
  let i = 0;
  while (i < ops.length) {
    const runEnd = (op, from) => {
      let to = from;
      while (to < ops.length && ops[to].op === op) to++;
      return to;
    };
    const deletions = runEnd("html-only", i);
    const insertions = runEnd("md-only", deletions);
    if (deletions > i && insertions > deletions) {
      seam(out, ops.slice(i, deletions), ops.slice(deletions, insertions));
      i = insertions;
      continue;
    }
    out.push(ops[i++]);
  }
  return out;
}

// One seam: a run of deletions against a run of insertions.
//
// First, blocks of the same kind, in the order they appear. A heading that lost
// its separator is still a heading on both sides, and that is the whole signal
// needed to keep it away from the paragraph below it.
//
// Then the leftovers get the old rule — the last remaining deletion with the
// first remaining insertion, once — because a quote whose attribution the twin
// folds in really does change kind (`cite` becomes part of a `quote`), and
// pairing it is what lets a reader see the two halves side by side instead of
// guessing which orphan belongs to which. Anything still unclaimed stays an
// orphan.
function seam(out, htmlOps, mdOps) {
  const pairs = [];
  const html = [...htmlOps];
  const md = [...mdOps];
  for (let a = 0; a < html.length; a++) {
    const b = md.findIndex((op) => op && op.md.kind === html[a].html.kind);
    if (b === -1) continue;
    pairs.push({ at: a, op: { op: "diff", html: html[a].html, md: md[b].md } });
    html[a] = null;
    md[b] = null;
  }
  const lastHtml = html.map((op, at) => (op ? at : -1)).filter((at) => at !== -1).pop();
  const firstMd = md.findIndex((op) => op);
  if (lastHtml !== undefined && firstMd !== -1) {
    pairs.push({ at: lastHtml, op: { op: "diff", html: html[lastHtml].html, md: md[firstMd].md } });
    html[lastHtml] = null;
    md[firstMd] = null;
  }
  // Emitted in the page's order, so the table still reads top to bottom.
  pairs.sort((x, y) => x.at - y.at).forEach((p) => out.push(p.op));
  html.filter(Boolean).forEach((op) => out.push(op));
  md.filter(Boolean).forEach((op) => out.push(op));
}

// THE KEY IS NOT THE TEXT ALONE. A link's destination and a marked span are
// invisible in the words — that is what markup is for — so two blocks can read
// identically while one points somewhere else or has lost the backticks around
// an identifier. Both were injected in the red proof and both aligned as perfect
// matches, so no reader was ever shown them. They travel in the key; they are
// still not shown in the table, which stays readable.
//
// ⚠️ AND NEITHER IS IT THE WORDS PLUS THE MARKUP INSIDE THEM. Until issue 279
// the key said nothing about what a block IS, so a heading whose `#` had gone
// missing aligned against the paragraph it had become as a PERFECT MATCH: same
// text, same links, same marks. Demoting the `<h1>` of `claude-skills-guide` in
// its twin and re-running reported the page clean, with its title turned into
// prose. The same held for a heading that quietly changed level.
//
// This was found by a reviewer asking why the pairing fix above had no injected
// case of its own, and the comment beside that fix was wrong in the direction
// that flatters: it said a whitelist rule would have silenced "every real case
// of a heading demoted to prose", which assumed this tool could see one.
//
// ⚠️ THE WHOLE `kind` WAS TRIED FIRST AND IS TOO BLUNT: 0 pairs needing
// judgement became 370, and the absolute-link rule went from 0 matches to 230,
// because `text` and `para` are different kinds for reasons a reader would
// never act on. Heading-or-not, plus the level when it is one, is the
// distinction that carries meaning. Measured cost of the narrow version: none —
// 0 pairs needing judgement before and after, and all five rule counts
// unchanged.
const { markSignature } = require("./extract");

function keyOf(block) {
  return [
    block.kind === "heading" ? `h${block.level}` : "",
    block.text,
    block.links.join(","),
    markSignature(block.marks),
  ].join("\u0000");
}

function align(htmlBlocks, mdBlocks) {
  return pairAdjacent(lcs(htmlBlocks, mdBlocks, keyOf));
}

module.exports = { align };
