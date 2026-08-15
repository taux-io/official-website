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
// ⚠️ ONE MODE IS A GATE, AND IT IS THE ONLY ONE. `gate` runs in CI as
// `npm run check:i18n`; `runs` and `check` are still authoring tools that report
// and let a person decide. The split is not a mood — see the comment on
// `CJK_PUNCTUATION` for what makes exactly one of these questions mechanical.
//
// Usage:
//   node scripts/i18n-extract.js runs <route>          the strings to translate
//   node scripts/i18n-extract.js check <route> <tag>   what the twin still owes
//   node scripts/i18n-extract.js gate                  CI: CJK punctuation on the English pages

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
// shredded the markup.
//
// ⚠️ THE FIRST FIX FOR THIS WAS A BRACKET FILTER, AND IT WAS WRONG TWICE OVER.
//
// It ran on both passes, so it also threw away text nodes containing `>` —
// undoing trap 2 three lines after claiming to fix it. And on the quoted pass
// it could not tell "this match swallowed a tag" from "this string legitimately
// contains a bracket". A JSON-LD FAQ answer reading `diff <fixed-point>...HEAD`
// was silently dropped by it on the last route, and `check` stayed quiet
// because the string never entered the map for anything to compare against.
//
// THE DISCRIMINATOR IS LOCATION, NOT CONTENT. Attribute-spanning matches can
// only happen where there are attributes. Inside a `<script type=ld+json>`
// block there are no tags at all, so a quote there always closes its own
// string, and a bracket in it is always literal text. Scoping the pass removes
// the need to guess.
function runs(html) {
  const body = unwrap(html).replace(/<!--[\s\S]*?-->/g, "");
  const out = [];
  const add = (t) => {
    if (t.trim() && !out.includes(t)) out.push(t);
  };
  // Text nodes. `[^<]` by construction, so no bracket test is needed or wanted.
  for (const m of body.matchAll(/>([^<]*)</g)) if (HAN.test(m[1])) add(m[1]);
  // JSON-LD only. Escaped quotes stay part of the value rather than ending it.
  for (const block of body.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g
  )) {
    for (const m of block[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (HAN.test(m[1])) add(m[1]);
  }
  // ATTRIBUTE VALUES, WHICH NO TEXT-NODE SCAN CAN EVER REACH.
  //
  // `aria-label="章節索引"` sits in neither a text node nor a JSON-LD block, and
  // it shipped untranslated on one route until the Korean checker found it —
  // the only leak of the whole stage that no extraction pass would have caught.
  //
  // Anchored on an attribute NAME, which is what keeps this safe: the match
  // must start at `name="`, so it cannot begin at the closing quote of one
  // attribute and run into the next. That is the same trap-3 failure, fixed by
  // construction rather than by filtering afterwards.
  for (const m of body.matchAll(/\b[a-zA-Z-]+="([^"\n]*)"/g)) if (HAN.test(m[1])) add(m[1]);
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
// CJK punctuation on a Latin page is never right, and it is the one part of
// "does this prose read correctly" that a machine can actually decide.
//
// 190 of these shipped on the English pages — `。`, `、`, `「」`, and the
// wreckage of a paragraph-by-paragraph replacement (`，,`, `spec、ec`) — and passed thirteen
// gates on the way, because not one of them reads prose. This closes the half
// of that gap that is closable. The other half, whether a sentence is right,
// stays a person's job and is recorded as such in DESIGN.md.
//
// ⚠️ AND FOR A WHILE THAT WAS ONLY HALF TRUE. This constant landed, DESIGN.md
// wrote that the mechanical part "已經補進 `i18n-extract`", and `i18n-extract`
// was in no CI job — so a new English page could carry every one of these and
// still go green. A tool is not a gate. `gate` below is the gate; the sentence
// in DESIGN.md is now about it rather than about this constant.
const CJK_PUNCTUATION = /[「」『』，。、；：（）？！《》]/;

// WHY THE GATE READS `templates/en-US/` AND NOT `dist/en-US/`.
//
// dist is what ships, and reading it would be the stronger choice for anything
// a person writes. But every built English page carries six CJK punctuation
// marks that no English author put there: `_identity.html` is the site's single
// Organization node — one identity site-wide, which is a rule `check:entity`
// enforces — and it holds a registered legal name, a Taiwanese address and a
// Chinese `description`. Gating dist would fail on that decision every run.
// Whether that node should carry a per-locale description is a separate
// question and belongs in a separate change; it is not this gate's business to
// force it by staying red.
//
// The prose a person writes and translates lives in `templates/en-US/`, and
// that is where all 190 of the shipped ones were. So this is where the gate
// looks — narrower than dist, and exactly as wide as the claim it makes true.
//
// WHY PUNCTUATION AND NOT HAN. Three of these templates hold Han on purpose:
// the registered company name 拓思科技股份有限公司 (a proper noun — CONTEXT.md
// says a name is kept, not translated), a Chinese label quoted from a source
// being described, and a structural HTML comment. Han on an English page is a
// judgement call and a gate that fails on judgement calls gets switched off,
// which is the reason `check` deliberately does not exit non-zero. CJK
// punctuation has no such exception, which is what makes it gateable.
const EN_LOCALE = "en-US";

function gate() {
  const dir = path.join(TEMPLATES, EN_LOCALE);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html")).sort();
  let found = 0;
  for (const name of files) {
    // Comments are stripped, as they are everywhere else in this file: the
    // generator strips them out of the output too, so they are not something a
    // reader can be served. One English template carries `④ 互動` as a section
    // marker copied from the source it was translated from.
    const body = fs
      .readFileSync(path.join(dir, name), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "");
    body.split("\n").forEach((line, i) => {
      if (!CJK_PUNCTUATION.test(line)) return;
      found++;
      console.log(`  ${EN_LOCALE}/${name}:${i + 1}  ${line.trim().slice(0, 110)}`);
    });
  }
  console.log(
    found
      ? `\n${found} line(s) carry CJK punctuation across ${files.length} English templates`
      : `\n${files.length} English templates, 0 CJK punctuation`
  );
  // Unlike `check`, this one fails the build. There is no judgement call in it:
  // a full stop written `。` on an English page is wrong in every context, and
  // the alternative to failing is what this repo already lived through — the
  // rule existing in a script nothing ran.
  process.exitCode = found ? 1 : 0;
}

function leftovers(html, tag) {
  const body = html.replace(/<!--[\s\S]*?-->/g, "");
  const test =
    tag === "ja-JP"
      ? (t) => TRADITIONAL_ONLY.some((c) => t.includes(c))
      : tag === "en-US"
        ? (t) => HAN.test(t) || CJK_PUNCTUATION.test(t)
        : (t) => HAN.test(t);
  return body
    .split("\n")
    .map((line, i) => ({ line: i + 1, text: line.trim() }))
    .filter(({ text }) => test(text));
}

function main() {
  const [mode, route, tag] = process.argv.slice(2);
  // `gate` takes no route: it is the whole locale or it is not a gate.
  if (mode === "gate") return gate();
  if (!mode || !route) {
    console.log("\nusage: i18n-extract.js runs <route> | check <route> <tag> | gate");
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

module.exports = { runs, leftovers, unwrap, gate };
