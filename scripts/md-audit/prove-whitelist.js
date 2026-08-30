// Proves that the whitelist rules added by issue 279 refuse the defects they
// are shaped like.
//
//   node scripts/md-audit/prove-whitelist.js
//
// WHY THIS IS A SCRIPT AND NOT A PARAGRAPH IN RED-PROOF.md. That file records
// six defect classes as caught, in prose, from readings nobody kept — its own
// closing section says so. A whitelist rule is the one part of this tool whose
// job is to make things INVISIBLE, so "we checked once that it does not hide
// anything real" is the claim least worth taking on trust and the easiest to
// make re-runnable. Every case below breaks a twin on purpose and asserts the
// audit still shows the pair to a reader.
//
// ⚠️ EVERY INJECTION IS ASSERTED TO HAVE CHANGED THE FILE. Two of these were
// no-ops on the first run — they assumed each paragraph was one line, and the
// twins wrap at the source's hard line breaks — and a no-op injection audits
// clean, which reads exactly like a rule correctly refusing it. That is how
// `inject.js` reported six of six while failing to apply on 85 routes.
//
// NOT IN CI, for the same reason the audit is not: it runs the tool against
// deliberately corrupted copies, and its answer is a proof about the rules, not
// a fact about the build.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { ROUTES } = require("../routes");
const { extract } = require("./extract");
const { blocks } = require("./blocks");
const { align } = require("./align");
const { classify } = require("./whitelist");

const DIST = path.join(__dirname, "..", "..", "dist");

// The two pages the rules were written from: `claude-skills-guide` has the ten
// paragraphs `htmd` splits, `geo-guide` has the pull quote it folds.
const SPLIT = "/en-US/claude-skills-guide";
const QUOTE = "/en-US/geo-guide";

function route(routePath) {
  const found = ROUTES.find((r) => r.path === routePath);
  if (!found) throw new Error(`no such route: ${routePath}`);
  return found;
}

// How many pairs this twin would put in front of a reader.
function judgement(routePath, markdown) {
  const r = route(routePath);
  const html = fs.readFileSync(path.join(DIST, r.path + ".html"), "utf8");
  const ops = align(extract(html, r.canonical), blocks(markdown));
  return ops.filter((op, index) => !classify(op, { ops, index }).legal).length;
}

function twin(routePath) {
  return fs.readFileSync(path.join(DIST, route(routePath).path + ".md"), "utf8");
}

// Drop `count` lines starting at `from`, counting the way an editor does.
function without(text, from, count) {
  const lines = text.split("\n");
  return [...lines.slice(0, from - 1), ...lines.slice(from - 1 + count)].join("\n");
}

function move(text, from, to) {
  const lines = text.split("\n");
  const [line] = lines.splice(from - 1, 1);
  lines.splice(to - 1, 0, line);
  return lines.join("\n");
}

const CASES = [
  // The split rule. Each of these leaves the two halves looking like a split
  // and is not one.
  [SPLIT, "a word dropped from the tail half", (s) =>
    s.replace("A step-by-step handbook", "A handbook")],
  [SPLIT, "the tail half deleted outright", (s) => without(s, 17, 3)],
  [SPLIT, "the two halves swapped", (s) => move(s, 15, 18)],
  [SPLIT, "a link appears in the tail half", (s) =>
    s.replace("automated workflow.", "[automated workflow](https://example.invalid).")],
  [SPLIT, "the tail half gains emphasis", (s) =>
    s.replace("A step-by-step handbook", "**A step-by-step handbook**")],
  [SPLIT, "a third paragraph from nowhere", (s) =>
    s.replace("automated workflow.\n", "automated workflow.\n\nA sentence the page never had.\n")],
  // The merge rule.
  [QUOTE, "the quote body cut out of the blockquote", (s) =>
    s.replace('"AI search is a contest over credibility and entity relationships. ', '"')],
  [QUOTE, "the attribution changed", (s) =>
    s.replace("TauX engineering", "someone else entirely")],
  [QUOTE, "a word changed inside the quote", (s) => s.replace("well-backed", "backed")],
];

function main() {
  let swallowed = 0;

  // A page that audits dirty before anything is injected would make every case
  // below meaningless.
  for (const routePath of [SPLIT, QUOTE]) {
    const clean = judgement(routePath, twin(routePath));
    console.log(`  ${routePath.padEnd(46)} ${clean} needing judgement, nothing injected`);
    if (clean !== 0) {
      console.log("    ⚠️  the baseline is not clean; every case below is unreadable");
      swallowed++;
    }
  }
  console.log("");

  for (const [routePath, label, mutate] of CASES) {
    const before = twin(routePath);
    const after = mutate(before);
    if (before === after) {
      console.log(`  ${label.padEnd(46)} INJECTION WAS A NO-OP`);
      swallowed++;
      continue;
    }
    const shown = judgement(routePath, after);
    console.log(`  ${label.padEnd(46)} ${shown ? "shown" : "SWALLOWED"} (${shown})`);
    if (!shown) swallowed++;
  }

  console.log("");
  if (swallowed) {
    console.log(`${swallowed} case(s) a whitelist rule hid from a reader.`);
    process.exitCode = 1;
    return;
  }
  console.log(`All ${CASES.length} defects still reach a reader. No rule swallows one.`);
}

main();
