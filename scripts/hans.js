// Generate the zh-Hans-CN templates from the zh-Hant-TW ones.
//
// AN AUTHORING TOOL, NOT A BUILD STEP. The twins are checked in and hand
// editable — that is the whole point of one template set per locale, and a
// build-time transform would take it away. This runs once per route, writes a
// file that a person then owns, and refuses to touch a file that already
// exists unless you say --force.
//
// It does two things the character pass cannot do on its own:
//
//   1. The vocabulary, from scripts/hans-terms.js. See that file for why the
//      word list is ours rather than OpenCC's.
//   2. The locale in hardcoded URLs. Templates link with `/{{ locale }}/`, but
//      the JSON-LD `@id` and `url` values are absolute and written out, so a
//      copied template would name the Traditional page from the Simplified one.
//      `check:entity`'s `graph urls match the locale` rule catches this — this
//      just does it right the first time.
//
// Usage:
//   node scripts/hans.js                 every route that has no twin yet
//   node scripts/hans.js about geo-guide just those
//   node scripts/hans.js --force about   overwrite a twin that already exists

const fs = require("node:fs");
const path = require("node:path");
const OpenCC = require("opencc-js");
const { TERMS, PROPER_NOUNS } = require("./hans-terms");
const { PAGES } = require("./routes");

const ROOT = path.join(__dirname, "..");
const FROM = path.join(ROOT, "templates");
const TO = path.join(FROM, "zh-Hans-CN");
const CANONICAL_LOCALE = "zh-Hant-TW";

// `tw` → `cn`, NOT `twp` → `cn`. The `p` is the phrase dictionary, and the
// phrases are the half this repo decides for itself.
const characters = OpenCC.Converter({ from: "tw", to: "cn" });

// Longest first, so 资料夹 is settled before 资料 and 人工智慧 before 智慧.
const ORDER = Object.keys(TERMS).sort((a, b) => b.length - a.length);

// Names are held out with a sentinel rather than by being early in the order.
// A longest-first pass only protects a name when the replacement removes the
// shorter trigger, and mapping a name to itself does not — see PROPER_NOUNS.
// U+0000 cannot occur in an HTML template, so the sentinel cannot collide with
// content, and a stray one left behind would be visible rather than silent.
const NAMES = [...PROPER_NOUNS].sort((a, b) => b.length - a.length);
const sentinel = (i) => `\u0000${i}\u0000`;

function toHans(source) {
  let out = characters(source);
  NAMES.forEach((name, i) => (out = out.replaceAll(name, sentinel(i))));
  for (const term of ORDER) out = out.replaceAll(term, TERMS[term]);
  NAMES.forEach((name, i) => (out = out.replaceAll(sentinel(i), name)));
  if (out.includes("\u0000")) throw new Error("a sentinel survived the term pass");
  // After the text, the identifiers. Simplified characters never appear in a
  // URL here, so this cannot collide with anything above.
  return out.replaceAll("zh-Hant-TW", "zh-Hans-CN");
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const named = args.filter((a) => !a.startsWith("--")).map((a) => a.replace(/\.html$/, ""));

  fs.mkdirSync(TO, { recursive: true });

  // WHAT IS A PAGE IS READ FROM site.toml, NOT GUESSED FROM THE FILENAME.
  //
  // The first version filtered `*.html` minus a `_` prefix, and copied
  // header.html, footer.html and 404.html into the locale directory. Those are
  // ONE file rendered once per language — a per-locale copy of the header is
  // exactly the branch-per-language the roster comment warns about, and 404 is
  // a [[document]] that answers every unmatched path in every language.
  //
  // site.toml already says which templates belong to a route. Asking it costs
  // nothing and cannot drift.
  const routes = [
    ...new Set(
      PAGES.filter((p) => p.locale === CANONICAL_LOCALE).map((p) =>
        p.template.replace(/\.html$/, "")
      )
    ),
  ].filter((r) => named.length === 0 || named.includes(r));

  if (named.length) {
    const missing = named.filter((n) => !routes.includes(n));
    if (missing.length) {
      console.log(`\nno such template: ${missing.join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }

  let written = 0;
  let kept = 0;
  for (const route of routes) {
    const dest = path.join(TO, `${route}.html`);
    if (fs.existsSync(dest) && !force) {
      kept++;
      continue;
    }
    const source = fs.readFileSync(path.join(FROM, `${route}.html`), "utf8");
    fs.writeFileSync(dest, toHans(source));
    console.log(`  ${route}.html`);
    written++;
  }

  console.log(`\n${written} written, ${kept} left alone (already exist — pass --force to replace)`);
  if (written) {
    console.log(
      "These are now yours to edit. Re-running will not touch them again."
    );
  }
}

if (require.main === module) main();

module.exports = { toHans };
