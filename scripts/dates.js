// Compares the dates site.toml declares against what git knows about each
// template.
//
//   node scripts/dates.js            report drift
//   node scripts/dates.js --check    validate the declared dates (CI)
//
// The build used to derive dateModified from `git log -1 -- <template>`. That
// was wrong in a way that got worse with every deploy: CI and Cloudflare Pages
// both clone shallowly, and in a one-commit history git attributes every file to
// that single commit. Every page's date collapsed to the date of whatever was
// deployed last, so a README typo would have restamped the entire site as
// freshly revised — a stronger freshness claim than the hand-written dates it
// replaced, and a false one.
//
// So the build reads no git at all and is reproducible from the tree alone. The
// declared date is the truth. This script only advises: it shows where git
// disagrees, and a person decides whether the difference was a real revision or
// a class rename. That asymmetry is deliberate — a tool that moved the date
// automatically is exactly what produced the problem.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { PAGES } = require("./routes");

const ROOT = path.join(__dirname, "..");
const CHECK = process.argv.includes("--check");

function lastCommitDate(template) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%ad", "--date=short", "--", path.join("templates", template)],
      { cwd: ROOT, encoding: "utf8" }
    );
    return out.trim() || null;
  } catch {
    return null;
  }
}

// A shallow clone answers `git log` with plausible nonsense rather than an
// error, which is the whole reason the build stopped asking it. Say so, rather
// than printing a drift table built on it.
function isShallow() {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim() === "true"
    );
  } catch {
    return false;
  }
}

function main() {
  const pages = PAGES;
  const today = new Date().toISOString().slice(0, 10);
  const problems = [];

  for (const p of pages) {
    if (!p.date_modified) {
      problems.push(`${p.path}: no date_modified`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date_modified)) {
      problems.push(`${p.path}: date_modified "${p.date_modified}" is not YYYY-MM-DD`);
    } else if (p.date_modified > today) {
      problems.push(`${p.path}: date_modified ${p.date_modified} is in the future`);
    }
    if (p.date_published) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date_published)) {
        problems.push(`${p.path}: date_published "${p.date_published}" is not YYYY-MM-DD`);
      } else if (p.date_published > p.date_modified) {
        problems.push(
          `${p.path}: published ${p.date_published} is after modified ${p.date_modified}`
        );
      }
    }
  }

  if (problems.length) {
    console.log("");
    for (const p of problems) console.log(`  ${p}`);
    console.log(`\n${problems.length} problem(s) with the declared dates.`);
    process.exitCode = 1;
    return;
  }

  if (CHECK) {
    console.log(`every page declares a usable date (${pages.length} pages)`);
    return;
  }

  if (isShallow()) {
    console.log(
      "this is a shallow clone — git cannot say when a template really changed,\n" +
        "which is why the build no longer asks it. Run this where the history is complete."
    );
    return;
  }

  const drifted = [];
  for (const p of pages) {
    const git = lastCommitDate(p.template);
    if (git && git !== p.date_modified) drifted.push({ p, git });
  }

  if (!drifted.length) {
    console.log(`declared dates match the last commit for all ${pages.length} pages`);
    return;
  }

  console.log("");
  for (const { p, git } of drifted) {
    console.log(`  ${p.path}`);
    console.log(`      declared ${p.date_modified}, last commit ${git}`);
  }
  console.log(
    `\n${drifted.length} page(s) differ. This is not an error — a commit that renames a` +
      `\nclass or fixes a typo should not move the date. Update site.toml only where the` +
      `\ncontent actually changed.`
  );
}

main();
