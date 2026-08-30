// Pairs every page's HTML with its Markdown twin and writes the tables a reader
// works from.
//
//   node scripts/md-audit --out .scratch/md-audit     all hundred pages
//   node scripts/md-audit --route /ja-JP/about        one page, to stdout
//   node scripts/md-audit --summary                   counts only
//   node scripts/md-audit --md-root <dir>             twins from elsewhere
//   node scripts/md-audit --headings                  Pass B input, headings only
//
// NOT A GATE, AND DELIBERATELY NOT IN CI. Issue 269 settled this: a one-off
// investigation is not a rule, and a rule cannot be written before anyone knows
// what the defects look like. What this produces is the input to that reading;
// whichever findings turn out to be mechanical become assertions in `check:md`
// afterwards, alongside the ones already there.
//
// ⚠️ THAT SENTENCE USED TO SAY "the eleven that already exist". There were
// twelve, and `NOTES.md` says in as many words that the count lives in
// `check-md.js` and only there. Writing it here made a second source and it had
// already drifted by the time anyone read it.
//
// WHAT IT CAN AND CANNOT SEE — the honest half of the design, and the half that
// was measured rather than assumed.
//
// It sees LOSS AND DIVERGENCE: a block in the HTML with no counterpart in the
// Markdown, a block that appeared from nowhere, a run that moved, a sentence
// whose words changed on the way across.
//
// ⚠️ IT WOULD NOT HAVE CAUGHT EITHER DEFECT THAT PROMPTED THIS AUDIT, AND THAT
// IS MEASURED, NOT ARGUED. Run against the build from before issue 270 — the
// one with a hundred and sixty glued headings and sixty chips standing as
// prose — it reports 7940 identical pairs and 5 html-only. Run against the
// fixed build it reports 7720 identical and 69 html-only. IT CALLS THE BROKEN
// BUILD THE CLEANER OF THE TWO.
//
// The reason is not a bug in the comparison; it is what the comparison is. Both
// defects were places where the HTML and the Markdown AGREED. `with AI AI を`
// carries the same characters on both sides — the halves were glued by the
// absence of a separator, not by losing anything. A chip rendered as prose is a
// faithful conversion of a chip; that it should not have been converted at all
// is a judgement about what belongs in a Markdown twin, not a fidelity failure.
//
// So the differences this tool reports on the FIXED build where the two sides
// disagree BY DESIGN — the heading separator issue 270 introduced, and the
// chips it drops — are not defects found. They belong in the reader's
// whitelist, not in a finding list. Their counts are what a run prints; they
// are not written down here, because a count in a comment is a second source
// and this file has already been wrong once that way.
//
// ISSUE 271's ACCEPTANCE CRITERION SAID THIS TOOL WOULD INDEPENDENTLY MEASURE
// THOSE TWO DEFECTS. It cannot, and the criterion was wrong when it was
// written — by the same person who had already written, in issue 269, that "a
// character comparison is blind to it". Two instruments were specified for this
// exact reason. This is the first; the reader in issue 272 is the second, and
// it is the one that catches what this cannot.

const fs = require("fs");
const path = require("path");
const { ROUTES } = require("../routes");
const { extract, markSignature } = require("./extract");
const { blocks } = require("./blocks");
const { align } = require("./align");
const { classify, RULES } = require("./whitelist");

const DIST = path.join(__dirname, "..", "..", "dist");

// A route with no `.md` twin has nothing to audit. `noindex` pages are not
// published as Markdown at all, so walking the whole route table without this
// would die on `ENOENT` at the first one. There are none today, which is
// exactly why it would have gone unnoticed until the day there was.
function auditable(route) {
  return !route.noindex && fs.existsSync(path.join(DIST, route.path + ".md"));
}

// `mdRoot` lets the Markdown side come from somewhere other than `dist/`, which
// is how `inject.js`'s deliberately broken twins get compared against the real
// page. The HTML always comes from `dist/`: it is the reference, and a harness
// that could move both sides would be able to prove anything.
function auditRoute(route, mdRoot = DIST) {
  const html = fs.readFileSync(path.join(DIST, route.path + ".html"), "utf8");
  const markdown = fs.readFileSync(path.join(mdRoot, route.path + ".md"), "utf8");
  return align(extract(html, route.canonical), blocks(markdown));
}

// One place that knows the four op names. The first version had the cascade in
// `render` and the counting in `main`, so adding a fifth kind meant remembering
// to touch both.
// Pass B's input: every heading in the twin, alone. See READER.md — 1140 of the
// build's 1300 headings are identical to the page and so never reach Pass A,
// which is where a hundred and sixty glued ones once lived.
function headings(route, mdRoot = DIST) {
  const markdown = fs.readFileSync(path.join(mdRoot, route.path + ".md"), "utf8");
  return blocks(markdown)
    .filter((b) => b.kind === "heading")
    .map((b) => `${route.path}.md:${b.line}  ${b.raw}`);
}

function tally(ops) {
  const review = ops.filter((op) => !classify(op).legal).length;
  const match = ops.filter((o) => o.op === "match").length;
  return {
    pairs: ops.length,
    match,
    // `legal` and `review` live here rather than at each call site. They were
    // computed separately in `render` and in `main`, which is the second way of
    // counting the same thing that `NOTES.md` has recorded going wrong three
    // times.
    legal: ops.length - match - review,
    review,
    diff: ops.filter((o) => o.op === "diff").length,
    htmlOnly: ops.filter((o) => o.op === "html-only").length,
    mdOnly: ops.filter((o) => o.op === "md-only").length,
  };
}

function shorten(text, width) {
  return text.length <= width ? text : text.slice(0, width - 1) + "…";
}

// One page's table. Matches are counted rather than printed: a reader asked to
// look at eight thousand identical pairs stops looking at any of them.
function render(route, ops) {
  const lines = [`## ${route.path}`, ""];
  const counts = tally(ops);
  lines.push(
    `${counts.pairs} pairs — ${counts.match} identical, ` +
      `${counts.legal} legal by whitelist, ${counts.review} needing judgement`,
    ""
  );
  ops.forEach((op, index) => {
    // The whitelist decides what a reader sees. Everything it claims is a
    // difference the converter makes on purpose, named in the issue that
    // introduced it — showing those would teach a reader that most findings are
    // not findings, which is the fastest way to get real ones waved through.
    if (classify(op).legal) return;
    // The Markdown line where the reader can open the file, not just the row of
    // this table. An html-only block has no line to point at, so it says which
    // pair it sits between instead.
    const at = op.md ? `${route.path}.md:${op.md.line}` : `[pair ${index}]`;
    if (op.op === "diff") {
      lines.push(`${at} CHANGED  ${op.html.kind} -> ${op.md.kind}`);
      lines.push(`     HTML: ${shorten(op.html.text, 300)}`);
      lines.push(`     MD:   ${shorten(op.md.text, 300)}`);
      // WHEN THE WORDS ARE THE SAME, SAY WHAT ISN'T.
      //
      // Link destinations and marked spans travel in the alignment key but not
      // in the displayed text — that is what keeps the table readable. The red
      // proof for issue 272 then handed a reader a pair whose two lines were
      // character-for-character identical and expected it to find the
      // redirected link: the difference was real, was why the pair surfaced at
      // all, and was the one thing not printed.
      if (op.html.links.join() !== op.md.links.join()) {
        lines.push(`     PAGE LINKS: ${op.html.links.join(" ") || "(none)"}`);
        lines.push(`     TWIN LINKS: ${op.md.links.join(" ") || "(none)"}`);
      }
      if (markSignature(op.html.marks) !== markSignature(op.md.marks)) {
        lines.push(`     PAGE MARKS: ${op.html.marks.join(" | ") || "(none)"}`);
        lines.push(`     TWIN MARKS: ${op.md.marks.join(" | ") || "(none)"}`);
      }
    } else if (op.op === "html-only") {
      lines.push(`${at} HTML-ONLY  ${op.html.kind} <${op.html.tag}>`);
      lines.push(`     HTML: ${shorten(op.html.text, 300)}`);
    } else {
      lines.push(`${at} MD-ONLY  ${op.md.kind}`);
      lines.push(`     MD:   ${shorten(op.md.text, 300)}`);
    }
    lines.push("");
  });
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const flagValue = (flag) => {
    const at = args.indexOf(flag);
    return at === -1 ? null : args[at + 1];
  };
  const onlyRoute = flagValue("--route");
  const out = flagValue("--out");
  const mdRoot = flagValue("--md-root") || DIST;
  const summaryOnly = args.includes("--summary");
  const headingsOnly = args.includes("--headings");

  const auditableRoutes = ROUTES.filter(auditable);
  const wanted = onlyRoute
    ? auditableRoutes.filter((r) => r.path === onlyRoute)
    : auditableRoutes;
  if (onlyRoute && !wanted.length) {
    console.error(`no auditable route ${onlyRoute}`);
    process.exitCode = 1;
    return;
  }

  if (headingsOnly) {
    for (const route of wanted) {
      for (const line of headings(route, mdRoot)) console.log(line);
    }
    return;
  }

  const totals = { pairs: 0, match: 0, legal: 0, review: 0, diff: 0, htmlOnly: 0, mdOnly: 0 };
  const perRoute = [];
  for (const route of wanted) {
    const ops = auditRoute(route, mdRoot);
    const counts = tally(ops);
    for (const key of Object.keys(totals)) totals[key] += counts[key];
    perRoute.push({ route, ops, counts });
  }

  if (out) {
    fs.mkdirSync(out, { recursive: true });
    for (const { route, ops } of perRoute) {
      const name = route.path.replace(/^\//, "").replace(/\//g, "__") + ".txt";
      fs.writeFileSync(path.join(out, name), render(route, ops));
    }
    console.log(`${perRoute.length} tables written to ${out}`);
  } else if (!summaryOnly) {
    for (const { route, ops } of perRoute) console.log(render(route, ops));
  }

  // THE SAME BREAKDOWN THE PER-PAGE HEADER USES. The first version counted by
  // op kind here and by whitelist verdict there, so a reader was handed
  // "2 legal, 1 needing judgement" above and "1 changed, 2 html-only" below and
  // had to work out for itself that they described the same three blocks. One
  // did, and reported the tool as inconsistent — correctly, from what it could
  // see.
  console.log(
    `\n${perRoute.length} pages, ${totals.pairs} pairs: ` +
      `${totals.match} identical, ${totals.legal} legal by whitelist, ` +
      `${totals.review} needing judgement`
  );
  console.log(
    `by kind: ${totals.diff} changed, ${totals.htmlOnly} html-only, ` +
      `${totals.mdOnly} md-only`
  );
  console.log(`${totals.review} pairs need a reader's judgement.`);

  // The whitelist's declared counts, checked. Each rule states how many pairs
  // it claims in the current build; a rule that widens or narrows silently is a
  // rule nobody would notice, which is how one of them came to silence 395
  // blocks of real content.
  const drift = [];
  for (const rule of RULES) {
    const actual = perRoute.reduce(
      (sum, { ops }) => sum + ops.filter((op) => classify(op).rule === rule.name).length,
      0
    );
    if (actual !== rule.matches) drift.push(`${rule.name}: declares ${rule.matches}, matches ${actual}`);
  }
  if (drift.length) {
    console.log(`\nWHITELIST DRIFT — ${drift.length} rule(s) no longer match what they declare:`);
    for (const line of drift) console.log(`  ${line}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${RULES.length} whitelist rules match the counts they declare.`);
}

if (require.main === module) main();
// This file is the CLI. Nothing requires it — `md:audit` runs it. The exports
// that were here had no caller in the repository, only in throwaway scripts,
// which is the definition the repo uses for a dead export.
module.exports = { auditRoute, headings };
