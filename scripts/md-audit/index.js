// Pairs every page's HTML with its Markdown twin and writes the tables a reader
// works from.
//
//   node scripts/md-audit --out .scratch/md-audit     all hundred pages
//   node scripts/md-audit --route /ja-JP/about        one page, to stdout
//   node scripts/md-audit --summary                   counts only
//
// NOT A GATE, AND DELIBERATELY NOT IN CI. Issue 269 settled this: a one-off
// investigation is not a rule, and a rule cannot be written before anyone knows
// what the defects look like. What this produces is the input to that reading;
// whichever findings turn out to be mechanical become assertions in `check:md`
// afterwards, where the eleven that already exist live.
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
// So the numbers this tool now reports on the FIXED build — 156 heading
// differences and 60 html-only chips — are not defects found. They are the
// deliberate differences issue 270 introduced, showing up exactly as they
// should, and they belong in the reader's whitelist rather than in a finding
// list.
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
const { extract } = require("./extract");
const { blocks } = require("./blocks");
const { align } = require("./align");

const DIST = path.join(__dirname, "..", "..", "dist");

function auditRoute(route) {
  const html = fs.readFileSync(path.join(DIST, route.path + ".html"), "utf8");
  const markdown = fs.readFileSync(path.join(DIST, route.path + ".md"), "utf8");
  return align(extract(html), blocks(markdown));
}

function shorten(text, width) {
  return text.length <= width ? text : text.slice(0, width - 1) + "…";
}

// One page's table. Matches are counted rather than printed: a reader asked to
// look at eight thousand identical pairs stops looking at any of them.
function render(route, ops) {
  const lines = [`## ${route.path}`, ""];
  const matched = ops.filter((o) => o.op === "match").length;
  lines.push(`${ops.length} pairs — ${matched} identical, ${ops.length - matched} needing judgement`, "");
  ops.forEach((op, index) => {
    if (op.op === "match") return;
    const at = `[${index}]`;
    if (op.op === "diff") {
      lines.push(`${at} CHANGED  ${op.html.kind} -> ${op.md.kind}`);
      lines.push(`     HTML: ${shorten(op.html.text, 300)}`);
      lines.push(`     MD:   ${shorten(op.md.text, 300)}`);
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
  const value = (flag) => {
    const at = args.indexOf(flag);
    return at === -1 ? null : args[at + 1];
  };
  const one = value("--route");
  const out = value("--out");
  const summaryOnly = args.includes("--summary");

  const wanted = one ? ROUTES.filter((r) => r.path === one) : ROUTES;
  if (one && !wanted.length) {
    console.error(`no route ${one}`);
    process.exitCode = 1;
    return;
  }

  const totals = { pairs: 0, match: 0, diff: 0, htmlOnly: 0, mdOnly: 0 };
  const perRoute = [];
  for (const route of wanted) {
    const ops = auditRoute(route);
    const counts = {
      pairs: ops.length,
      match: ops.filter((o) => o.op === "match").length,
      diff: ops.filter((o) => o.op === "diff").length,
      htmlOnly: ops.filter((o) => o.op === "html-only").length,
      mdOnly: ops.filter((o) => o.op === "md-only").length,
    };
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

  console.log(
    `\n${perRoute.length} pages, ${totals.pairs} pairs: ` +
      `${totals.match} identical, ${totals.diff} changed, ` +
      `${totals.htmlOnly} html-only, ${totals.mdOnly} md-only`
  );
  const needing = totals.diff + totals.htmlOnly + totals.mdOnly;
  console.log(`${needing} pairs need a reader's judgement.`);
}

if (require.main === module) main();
module.exports = { auditRoute, render };
