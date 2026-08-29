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
function pairAdjacent(ops) {
  const out = [];
  for (let i = 0; i < ops.length; i++) {
    const here = ops[i];
    const next = ops[i + 1];
    const changed =
      next &&
      ((here.op === "html-only" && next.op === "md-only") ||
        (here.op === "md-only" && next.op === "html-only"));
    if (changed) {
      out.push({
        op: "diff",
        html: here.html || next.html,
        md: here.md || next.md,
      });
      i++;
      continue;
    }
    out.push(here);
  }
  return out;
}

// THE KEY IS NOT THE TEXT ALONE. A link's destination and a marked span are
// invisible in the words — that is what markup is for — so two blocks can read
// identically while one points somewhere else or has lost the backticks around
// an identifier. Both were injected in the red proof and both aligned as perfect
// matches, so no reader was ever shown them. They travel in the key; they are
// still not shown in the table, which stays readable.
const { markSignature } = require("./extract");

function keyOf(block) {
  return [block.text, block.links.join(","), markSignature(block.marks)].join("\u0000");
}

function align(htmlBlocks, mdBlocks) {
  return pairAdjacent(lcs(htmlBlocks, mdBlocks, keyOf));
}

module.exports = { align };
