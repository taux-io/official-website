// Pull the translatable text out of a template, and check a twin for leftovers.
//
// AN AUTHORING TOOL, LIKE scripts/hans.js — not a build step. Simplified
// Chinese is a transform a machine can do; Japanese and Korean are not. What a
// machine CAN do for those is the mechanical half: find every string that needs
// a human, and afterwards find the ones that did not get one.
//
// This existed as ad-hoc Python for nine routes before it was written down.
// Each route rediscovered the same three traps, so they are recorded here as
// code rather than as scar tissue.
//
// Usage:
//   node scripts/i18n-extract.js runs <route>          the strings to translate
//   node scripts/i18n-extract.js check <route> <tag>   what the twin still owes

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const TEMPLATES = path.join(ROOT, "templates");

// TRAP 1: SENTENCES BROKEN ACROSS LINES.
//
// The templates wrap at roughly 100 columns, so a sentence is regularly split
// with a newline and indentation in the middle of it. A replacement keyed on
// the sentence then never matches, and the first nine routes each burned two or
// three round trips recovering the exact whitespace. Joining first makes the
// whole class of failure disappear.
const unwrap = (s) =>
  s
    .replace(/(?<=[^\s>])\n\s+(?=[一-鿿])/g, " ")
    .replace(/(?<=[一-鿿])\n\s+(?=[^\s<])/g, " ");

const HAN = /[一-鿿]/;
const KANA = /[ぁ-ゟ゠-ヿ]/;

// TRAP 2: TEXT CONTAINING `>`.
//
// `>([^<>]*)<` looks right and silently skips any paragraph with a `>` or `->`
// in it — a prose arrow, a "Settings > Extensions" path. Three such paragraphs
// shipped untranslated before a checker caught them. `[^<]` is the correct
// class: a text node cannot contain `<`, but it certainly can contain `>`.
//
// TRAP 3: QUOTED STRINGS THAT SPAN LINES.
//
// Widening the JSON-LD scan to `"([^"]*)"` lets a match run from the closing
// quote of one HTML attribute to the opening quote of the next, swallowing tags
// on the way. Ten of those appeared in one route; replacing them would have
// shredded the markup. Hence `[^"\n]`, and the bracket filter below.
function runs(html) {
  const body = unwrap(html).replace(/<!--[\s\S]*?-->/g, "");
  const out = [];
  const add = (t) => {
    if (t.trim() && !t.includes("<") && !t.includes(">") && !out.includes(t)) out.push(t);
  };
  for (const m of body.matchAll(/>([^<]*)</g)) if (HAN.test(m[1])) add(m[1]);
  for (const m of body.matchAll(/"([^"\n]*)"/g)) if (HAN.test(m[1])) add(m[1]);
  return out;
}

// CHARACTERS WHOSE TRADITIONAL AND JAPANESE FORMS GENUINELY DIFFER.
//
// Finding untranslated Chinese in a Japanese page is the hard direction: the
// two scripts share their Han characters, so "does it still contain Han" says
// nothing. The usable signal is a character whose shinjitai form is different,
// because a Japanese writer would have typed the other one.
//
// THE LIST WAS WRONG THREE TIMES, ALWAYS THE SAME WAY. 動 and 試 went in, then
// 導, then 類 and 複 — each time because the WORD was a Traditional usage, and
// the test is per CHARACTER. 導入 is ordinary Japanese and 11 lines lit up.
//
// So the entry test is narrow and mechanical: the character is here only if
// Japanese writes it differently. A word being Taiwanese is not a reason.
const TRADITIONAL_ONLY = [
  ..."這們麼說讓與對從將檔體點擊臺灣觸嚴專屬應實驗證產據覽數獨遙禦樣單學國會來雜聲圖",
];

// Korean needs none of that. Hanja is rare enough in modern Korean prose that
// ANY Han character is worth a look — which is why the Korean twin has caught
// four leaks the Japanese filter passed, including one in an `aria-label` that
// no text-node scan would ever have reached. Translate both, and let Korean
// stand guard over Japanese.
function leftovers(html, tag) {
  const body = html.replace(/<!--[\s\S]*?-->/g, "");
  return body
    .split("\n")
    .map((line, i) => ({ line: i + 1, text: line.trim() }))
    .filter(({ text }) =>
      tag === "ja-JP"
        ? TRADITIONAL_ONLY.some((c) => text.includes(c))
        : HAN.test(text)
    );
}

function main() {
  const [mode, route, tag] = process.argv.slice(2);
  if (!mode || !route) {
    console.log("\nusage: i18n-extract.js runs <route> | check <route> <tag>");
    process.exitCode = 1;
    return;
  }
  const rel = tag && mode === "check" ? path.join(tag, `${route}.html`) : `${route}.html`;
  const file = path.join(TEMPLATES, rel);
  if (!fs.existsSync(file)) {
    console.log(`\nno such template: templates/${rel}`);
    process.exitCode = 1;
    return;
  }
  const html = fs.readFileSync(file, "utf8");

  if (mode === "runs") {
    const found = runs(html);
    console.log(JSON.stringify(found, null, 0));
    console.error(
      `\n${found.length} strings, ${found.reduce((n, t) => n + t.length, 0)} characters`
    );
    return;
  }

  if (mode === "check") {
    if (!tag) {
      console.log("\ncheck needs a locale tag");
      process.exitCode = 1;
      return;
    }
    const left = leftovers(html, tag);
    for (const { line, text } of left) console.log(`  ${line}  ${text.slice(0, 110)}`);
    console.log(
      left.length
        ? `\n${left.length} line(s) still hold source text`
        : `\ntemplates/${rel} holds no untranslated source`
    );
    // Not an exit code: a Japanese page legitimately keeps a proper noun in its
    // original form now and then, and a tool that fails the build on a judgement
    // call gets switched off. This reports; a person decides.
    return;
  }

  console.log(`\nunknown mode: ${mode}`);
  process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { runs, leftovers, unwrap };
