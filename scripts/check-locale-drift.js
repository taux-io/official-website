// Warns when a change touches a route in some locales and not the others.
//
//   node scripts/check-locale-drift.js                 against origin/main
//   node scripts/check-locale-drift.js --base <ref>    against any ref
//
// WHY THIS EXISTS. #300 rewrote the about page's copy in zh-Hant-TW and
// zh-Hans-CN; ja-JP, ko-KR and en-US kept the old promotional lines for three
// weeks. Every gate stayed green, because the gates compare markup and the
// markup was identical — only the words had drifted. Nothing in this repo can
// tell whether two sentences in two languages say the same thing, but a diff
// can tell that one language was edited and four were not, and that is the
// moment somebody should look.
//
// A WARNING, NOT A GATE. Editing one locale is often right: a typo, a
// locale-specific phrasing, a Korean spacing fix. A check that failed on those
// would be switched off within a week, and the NOTES paragraph on gates that
// cry wolf applies. So this always exits 0; in CI it prints GitHub warning
// annotations and a table in the job summary, where a reviewer sees it.
//
// WHAT COUNTS AS TOUCHING A LOCALE:
//   · its template for the route changed (shared partials are one file for
//     every locale and are ignored);
//   · its title or description in site.toml changed. site.toml is not parsed
//     at the base ref — routes.js is the only reader of that file (check:design
//     rule `single route table`) — so each current string is looked up in the
//     base file's text. A string that is not there verbatim was changed or is new.
//
// WHAT IT CANNOT SEE: a change that touched every locale's file but finished
// only some of them. #300 is exactly that for the about page — all five files
// changed, three of them only in the display line — and a file-level diff calls
// that complete. Run against #300 it finds the two routes that did drift
// wholesale (ai-smart-work and data-governance, where ja-JP and ko-KR still
// carried the old copy until this script's own PR fixed them) and not about.

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { PAGES } = require("./routes");

const ROOT = path.join(__dirname, "..");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

function main() {
  const i = process.argv.indexOf("--base");
  const base = i > -1 ? process.argv[i + 1] : "origin/main";

  let changed;
  let baseToml;
  try {
    changed = new Set(git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean));
    baseToml = git("show", `${base}:site.toml`);
  } catch (err) {
    // A shallow clone has no merge base. Say so rather than report "no drift".
    console.log(`cannot compare against ${base}: ${err.message.split("\n")[0]}`);
    console.log("(CI needs `fetch-depth: 0` on the checkout for this to run.)");
    return;
  }

  const tomlChanged = changed.has("site.toml");
  const byRoute = new Map();
  for (const p of PAGES) {
    if (!byRoute.has(p.path)) byRoute.set(p.path, []);
    const reasons = [];
    if (changed.has(path.join("templates", p.template))) reasons.push("template");
    if (tomlChanged) {
      for (const field of ["title", "description"]) {
        if (!baseToml.includes(JSON.stringify(p[field]))) reasons.push(field);
      }
    }
    byRoute.get(p.path).push({ locale: p.locale, template: p.template, reasons });
  }

  const drift = [];
  for (const [route, rows] of byRoute) {
    const touched = rows.filter((r) => r.reasons.length);
    if (touched.length === 0 || touched.length === rows.length) continue;
    drift.push({ route, touched, untouched: rows.filter((r) => !r.reasons.length) });
  }

  if (drift.length === 0) {
    console.log(`no locale drift against ${base}: every route touched was touched in all of its locales`);
    return;
  }

  const inCI = process.env.GITHUB_ACTIONS === "true";
  const summary = [
    "### Locale drift",
    "",
    "These routes changed in some locales and not in others. That is often right (a typo, a",
    "locale-specific phrasing) — but if the change was to what the page *says*, the other",
    "locales probably need it too.",
    "",
    "| route | changed | not changed |",
    "|---|---|---|",
  ];
  for (const d of drift) {
    const changedList = d.touched.map((r) => `${r.locale} (${r.reasons.join(", ")})`).join(", ");
    const untouchedList = d.untouched.map((r) => r.locale).join(", ");
    console.log(`  ${d.route}\n      changed:     ${changedList}\n      not changed: ${untouchedList}`);
    summary.push(`| \`${d.route}\` | ${changedList} | ${untouchedList} |`);
    if (inCI) {
      const file = d.touched.find((r) => r.reasons.includes("template"))
        ? `templates/${d.touched.find((r) => r.reasons.includes("template")).template}`
        : "site.toml";
      console.log(
        `::warning file=${file},title=Locale drift::${d.route} changed in ${d.touched.length} of ` +
          `${d.touched.length + d.untouched.length} locales — not in ${untouchedList}`
      );
    }
  }
  console.log(`\n${drift.length} route(s) changed in only some of their locales. This is a warning, not a failure.`);
  if (inCI && process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
  }
}

main();
