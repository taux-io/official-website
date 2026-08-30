// Reports Markdown twins that are missing, malformed, or quietly wrong.
//
//   node scripts/check-md.js
//
// WHY THIS EXISTS AT ALL. Every page is published twice now — once as HTML for
// a reader and once as `.md` for whatever is going to quote it — and NOBODY
// EVER LOOKS AT THE SECOND ONE. There is no browser tab open on a `.md`, no
// screenshot, no reader to notice. The whole class of file is invisible until a
// model gets a bad copy of it, and by then the failure is somebody else's
// output, not this build's.
//
// The repository's own decision #63 is that a rule nothing checks is not a
// rule. This is the something.
//
// THE HISTORY IS THE ARGUMENT FOR CHECKING QUALITY AND NOT ONLY PRESENCE. When
// the twins landed, `cargo test` was green, ten gates were green, the contract
// audit made 1256 assertions and none of them failed — and the output was wrong
// in four ways at once: the H1 was truncated on all five locale homes, twenty
// five files carried code samples escaped into backslash noise, three quarters
// of the routes shipped fragment links that resolved nowhere, and a `<main>`
// that converted to nothing would have been written, counted and reported as a
// success. Every one was found by a person reading `dist/`. A gate that only
// asked "is the file there" would have passed all four.
//
// THIRTEEN ASSERTIONS, and the last is deliberately the reverse of the first —
// the same pairing `check:routes` uses, and for the same reason: an assertion
// in one direction only describes whatever happened to exist on the day it was
// written.
//
// THREE OF THE TWELVE ARRIVED AFTER A PERSON READ FIFTEEN LINES — two from the
// reading and the third from the review it triggered. Nine assertions here and
// 1564 production assertions in `contract` were green when
// someone opened `dist/ja-JP/about.md` for the first time and found, in its
// first fifteen lines, a decorative chip standing as a sentence (line thirteen)
// and a heading whose two halves had been glued into `with AI AI を` (line
// fifteen). Neither is invisible; nobody had looked. That is the argument for
// the three below, and for the audit that follows them.
//
// ⚠️ THAT SENTENCE SAID EIGHTEEN LINES WHEN IT WAS FIRST WRITTEN, from memory
// rather than from the file. A remembered number inside a paragraph about a
// mis-measurement is the same defect one layer up.
//
// This runs offline against `dist/`, in the fast build job. Its two siblings in
// the audit job — `contract`'s Content-Type and canonical assertions — need a
// running host emulator to see a real header, and cost three minutes to reach.
// Checking whether a conversion mangled a code block should not cost that.

const fs = require("fs");
const path = require("path");
const { ROUTES, ORIGIN } = require("./routes");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// Measured, not guessed: the shortest real body in the current build is 112
// characters (`/ja-JP/building`, a placeholder page whose whole content is two
// sentences and a link). The floor sits below that with room to spare, because
// its job is to catch a body that converted to nothing or nearly nothing, not
// to have an opinion about how long a page should be.
const BODY_FLOOR = 64;

// Structural HTML that has no business surviving into Markdown. NAMED, RATHER
// THAN A GENERIC `<`, and that is not laziness — the pages are about prompting
// and agents, so their prose legitimately contains `<fixed-point>`, `<name>`,
// `<spec>` and a passage recommending `<form>内容</form>` as an XML tag. A
// generic angle-bracket rule would fail on correct output, which is the fastest
// way to teach everyone to ignore a gate.
const STRUCTURAL = [
  "div", "svg", "path", "script", "style", "span", "section", "article",
  "header", "footer", "nav", "main", "img", "figure", "table", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
];
const STRUCTURAL_RE = new RegExp(`</?(?:${STRUCTURAL.join("|")})[\\s>/]`, "i");

// A link target this file is willing to see. `https://` because every internal
// link is rewritten absolute at build time — a root-relative one survives being
// copied elsewhere as a link to nothing — and `mailto:` because seventy of them
// are the contact address and are absolute already.
const LINK_RE = /\]\(([^)\s]+)/g;

// The separator that keeps a bilingual heading readable.
//
// `<h1>` and friends are built from two spans — `display-lead` carries the
// English, `display-sub` the locale's own words — laid out as two lines by CSS.
// Markdown has no CSS, and a Markdown heading is one line, so the two halves
// arrive touching:
//
//     # Empowering Business with AI AI を、企業が本当に使える力に
//
// A hundred and sixty headings across eighty files shipped like that — not
// eighty, which was the first count and was of first headings only: the same
// pair of spans builds the section headings too.
//
// `generator/src/main.rs` holds the same constant. Change one and this goes
// red, which is the point of writing it down twice rather than once.
//
// IT CANNOT BE FIXED BY DROPPING THE ENGLISH HALF, which was the first plan.
// en-US has no `display-sub` at all — forty of its headings are `display-lead`
// alone — so dropping the lead leaves twenty English pages with no heading. The
// measurement that caught this is the reason all five locales get read, not one.
const HEADING_SEPARATOR = " \u2014 ";

// The two halves of a bilingual heading, whichever way the template builds it.
//
// ⚠️ THERE ARE TWO SHAPES AND THE FIRST VERSION KNEW ONLY ONE. Issue 270 fixed
// `display-lead` + `display-sub`, two sibling spans, and this assertion looked
// for exactly that pair. The templates also build the same heading a second
// way — the locale half as the `<h2>`'s own text and the English half in a
// `class="block"` span:
//
//     <h2>プロンプトインジェクション<span class="block …">Prompt Injection</span></h2>
//
// SEVENTY-FIVE HEADINGS ACROSS TEN PAGES were built that way and every one of
// them shipped glued, while twelve assertions and 1101 checks stayed green. The
// audit in issue 273 found them by READING the twins, not by any gate; Pass A
// was blind to them too, because the page and the twin agree — the page has no
// separator either.
//
// ⚠️ A SPACE IS NOT A SEPARATOR, and that is a decision rather than an
// observation. THREE of the five locales put a space between the halves
// (`提示詞注入 Prompt Injection` — en-US, zh-Hans-CN, zh-Hant-TW, 45 headings)
// and two put nothing (`プロンプトインジェクションPrompt Injection` — ja-JP,
// ko-KR, 30). A rule phrased "the halves must not touch" would leave the
// FORTY-FIVE spaced ones green. But a space is what a sentence puts between its
// words, so the spaced form reads as one phrase whose second part continues the
// first — the same defect as `with AI AI を`, only harder to see. The rule is
// therefore "the halves must be joined by the separator", and it is red on all
// seventy-five.
//
// ⚠️ THIS PARAGRAPH HAD THE SPLIT BACKWARDS IN THREE FILES AT ONCE — "two
// locales space, three none", and "the thirty spaced ones" when the spaced ones
// are forty-five. It is the sentence that argues for the decision, so it
// understated the risk it was weighing by a third. Ninth wrong number on this
// line of work; counted this time.
function headingParts(inner) {
  // A NUMBER BADGE IS A PART TOO (issue 281). The templates draw a section
  // number as a circle: `<span class="w-12 h-12 …">1</span>` before the title.
  // In Markdown there is no circle, so it lands as a bare numeral touching the
  // words after it — `## 1 Part one: the basics`.
  //
  // ⚠️ IDENTIFIED BY WHAT IT IS, NOT BY WHAT IT WEARS. Every earlier version of
  // this file matched a class: `class="tag`, then `class="block`, and both were
  // narrow enough that a template rewrite would have escaped the fix and the
  // gate together — twice. A badge is the heading's first element whose text is
  // nothing but digits. Measured: fifty of those in this build, all leading,
  // all `<span>`, and NO other digit-only element in any heading, so the rule
  // costs no false positives and cannot be undone by renaming a utility class.
  //
  // ⚠️ WHAT IT CANNOT SEE. A roman numeral, a spelled-out `One`, a `1.` with
  // its stop, digits wrapped twice, or an icon before the number are all left
  // glued — and a heading opening `<span>2024</span> in review` would be
  // separated as though the year were a badge. Zero of each today, measured
  // once and not re-measured on every run.
  //
  // The separated form is the site's own convention, not an invention: pages
  // that write their number as literal text already write `01 — 一句話`.
  // ⚠️ COLLECTED, NOT RETURNED EARLY — and the first version returned early.
  // A heading with a badge exited before the two language-half checks ran, so
  // `<span>1</span><span class="display-lead">Alpha</span><span
  // class="display-sub">Beta</span>` reported one part and `## 1 — AlphaBeta`
  // passed with the halves glued. FOURTH time on this line of work that a fix
  // and its gate went blind together, two lines under the comment boasting
  // that this one could not. No page carries that shape today; the case was
  // constructed because issue 281 asked for one, and it was already true.
  // A BADGE IS A PREFIX CLAIM, NOT A PAIR. Its "other half" is the whole rest
  // of the heading, which may itself be two parts — so comparing it as one flat
  // string demands `1 — AlphaBeta` and rejects the correct `1 — Alpha — Beta`.
  // What the badge actually requires is that the number be followed by the
  // separator; everything after it is the other constructs' business.
  const parts = [];
  const badge = /^\s*<([a-z][a-z0-9]*)\b[^>]*>\s*(\d+)\s*<\/\1>/i.exec(inner);
  let body = inner;
  if (badge) {
    const rest = visibleText(inner.slice(badge[0].length));
    if (rest) parts.push([badge[2], null]);
    body = inner.slice(badge[0].length);
  }

  const lead = /<span[^>]*class="display-lead[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(body);
  const sub = /<span[^>]*class="display-sub[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(body);
  if (lead && sub) {
    parts.push([visibleText(lead[1]), visibleText(sub[1])]);
    return parts;
  }

  // EVERY second half, on ANY element, matched by class TOKEN.
  //
  // ⚠️ THE FIRST VERSION GOT ALL THREE WRONG. It took the first `class="block`
  // it found, on a `<span>` only, with `class` required to open the tag and
  // `block` to open the class. The generator meanwhile separated every such
  // element regardless of tag name — so a heading with two of them had its
  // second half checked by nobody, and `class="text-base block"` would have
  // escaped the fix AND the gate together. The templates already carry fifty
  // `<strong class="block …">` outside headings; one moving inside would have
  // been silent.
  //
  // This is the third time a fix and its gate have been blinded by sharing one
  // narrow definition. The second is written out in assertion 10 below.
  let before = "";
  for (const tag of body.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    const classes = /class="([^"]*)"/.exec(tag[2]);
    if (!classes || !classes[1].split(/\s+/).includes("block")) continue;
    const head = visibleText(body.slice(before.length, tag.index));
    if (!head) continue;
    const closing = new RegExp(`<\\/${tag[1]}>`, "i").exec(body.slice(tag.index));
    const end = closing ? tag.index + closing.index : body.length;
    parts.push([head, visibleText(body.slice(tag.index + tag[0].length, end))]);
    before = body.slice(0, end);
  }
  return parts.length ? parts : null;
}

// Text as `htmd` will see it once the markup is gone. Verified against the
// build: the only tag that ever appears inside these spans is `<br>`, and no
// HTML entity does — so this is enough, and honest about being enough.
// The visible text of every decorative chip in one `<main>`.
//
// A scanner rather than one regular expression, because the chips that carry the
// little dot hold a nested element of the same name — and a non-greedy `(.*?)`
// stops at the inner close tag, capturing nothing the assertion could match.
// THAT VERSION WAS WRITTEN, AND IT REPORTED SIXTY CHIPS AS ZERO: a green gate
// over broken output, which is the exact failure the assertion below exists to
// catch. It was caught only by re-running it against the pre-fix build.
//
// Deliberately wider than the generator's own pass: any element name, `class`
// anywhere in the tag, `tag` as a whitespace-separated token.
function chips(region) {
  const found = [];
  const opening = /<([a-z][a-z0-9]*)\b([^>]*?)\/?>/g;
  let tag;
  while ((tag = opening.exec(region))) {
    const [, name, attrs] = tag;
    const classes = /class="([^"]*)"/.exec(attrs);
    if (!classes || !classes[1].split(/\s+/).includes("tag")) continue;
    const start = opening.lastIndex;
    let depth = 1;
    let cursor = start;
    let end = -1;
    while (depth > 0) {
      const close = region.indexOf(`</${name}>`, cursor);
      if (close === -1) break;
      const nested = region.indexOf(`<${name}`, cursor);
      if (nested !== -1 && nested < close) {
        depth++;
        cursor = nested + name.length + 1;
      } else {
        depth--;
        cursor = close + name.length + 3;
        end = close;
      }
    }
    if (end !== -1) found.push(region.slice(start, end));
  }
  return found;
}

function visibleText(markup) {
  return markup
    .replace(/<br[^>]*>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// A deliberately small front-matter reader rather than a YAML dependency.
//
// It understands exactly the shape the generator writes: top-level
// `key: "value"` with a double-quoted scalar, plus a nested `alternates:` block
// it does not need to read. That is enough to assert the three things that
// matter and honest about being enough — a real parser here would be asserting
// that js-yaml can parse js-yaml's own output.
function frontMatter(text) {
  if (!text.startsWith("---\n")) return { error: "does not open with ---" };
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return { error: "front matter is never closed" };
  const fields = {};
  for (const line of text.slice(4, end).split("\n")) {
    const m = /^([a-z_]+):\s+"((?:[^"\\]|\\.)*)"$/.exec(line);
    if (m) fields[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return { fields, body: text.slice(end + 5).trim() };
}

function main() {
  const failures = [];
  const fail = (route, check, problem) => failures.push({ route, check, problem });
  const expected = new Set();
  let checked = 0;

  for (const route of ROUTES) {
    // A noindex page gets no twin: Markdown has no <head> and no headers of its
    // own, so there is nowhere to repeat the directive, and an indexable copy
    // of a page kept out of an index is worse than no copy.
    if (route.noindex) continue;

    const rel = route.path + ".md";
    const file = path.join(DIST, rel);
    expected.add(rel);

    // 1 — the twin exists.
    checked++;
    if (!fs.existsSync(file)) {
      fail(rel, "twin exists", "no such file — every route is published twice");
      continue;
    }
    const text = fs.readFileSync(file, "utf8");

    // 2 — the front matter parses, and says what this page is.
    checked++;
    const { error, fields, body } = frontMatter(text);
    if (error) {
      fail(rel, "front matter", error);
      continue;
    }
    for (const key of ["title", "description", "url", "locale"]) {
      if (!fields[key]) fail(rel, "front matter", `no ${key}:`);
    }

    // 3 — `url:` is the reason the front matter exists. If it points anywhere
    // but at this page, every citation of this file sends a reader elsewhere.
    checked++;
    if (fields.url !== route.canonical) {
      fail(rel, "canonical url", `url: is ${fields.url}, want ${route.canonical}`);
    }
    if (fields.locale !== route.locale) {
      fail(rel, "front matter", `locale: is ${fields.locale}, want ${route.locale}`);
    }

    // 4 — the body converted to something.
    checked++;
    if (body.length < BODY_FLOOR) {
      fail(rel, "body", `${body.length} characters — a conversion that produced nothing`);
    }

    // 5 — no structural HTML survived the conversion.
    checked++;
    const tag = STRUCTURAL_RE.exec(body);
    if (tag) {
      fail(rel, "residual html", `${tag[0].trim()} — the conversion left markup behind`);
    }

    // 6 — every link is absolute.
    checked++;
    for (const [, target] of body.matchAll(LINK_RE)) {
      if (!target.startsWith("https://") && !target.startsWith("mailto:")) {
        fail(rel, "relative link", `${target} — dies the moment this file is copied elsewhere`);
        break;
      }
    }

    // 7 — EVERY `<pre>` IN `<main>` DECLARES ITSELF AS CODE.
    //
    // This is the assertion that replaced a rescue pass in the generator, and
    // the reason it is worth more than the pass was. `htmd` needs `<pre><code>`
    // to emit a fenced block; a lone `<pre>` says "keep this whitespace" and
    // nothing about what the text is, so the converter treats it as prose —
    // correctly, and catastrophically.
    //
    // FORTY-FIVE BLOCKS SHIPPED THAT WAY. `claude plugins install …` sat in the
    // file as a sentence; a sample CLAUDE.md had its `## Agent behaviour`
    // promoted into agent-dev-workflow's own heading hierarchy, so a model
    // reading the outline saw a section that does not exist; and
    // `--skill=&lt;name&gt;` decoded into running text as markup a renderer can
    // swallow. Every gate was green, including the seven above it here — they
    // ask whether HTML survived into the Markdown, never whether something that
    // should have been code still is.
    //
    // Asserted on the HTML rather than by counting fences in the Markdown,
    // because the HTML is where a person can fix it and the message can name
    // the file they have to open.
    checked++;
    const html = path.join(DIST, route.path + ".html");
    if (fs.existsSync(html)) {
      const source = fs.readFileSync(html, "utf8");
      const main = (/<main[\s\S]*?<\/main>/.exec(source) || [""])[0];

      // EVERY offender, not the first. The rescue pass this replaced was itself
      // shipped twice on one page, because a literal match found one of two
      // samples and left the other escaped in all five locales while every gate
      // stayed green. Stopping at the first hit rebuilds that exact trap.
      for (const [, inner] of main.matchAll(/<pre(?:\s[^>]*)?>([\s\S]*?)<\/pre>/g)) {
        if (!inner.trimStart().startsWith("<code")) {
          fail(
            route.path + ".html",
            "pre without code",
            `${JSON.stringify(inner.trim().slice(0, 40))} — a <pre> with no <code> converts as prose`
          );
        }
      }

      // AND THE SHAPE THAT WAS RESCUED BY THE OTHER DELETED PASS. `code-window`
      // was a `<div>` of styled spans until issue 264; nothing about the class
      // name stops it being one again, and a re-introduced `<div>` would convert
      // to escaped prose exactly as twenty-five files once did. Without this the
      // generator's claim that a gate replaced those passes is only half true.
      for (const [tag] of main.matchAll(/<(\w+)[^>]*class="code-window"/g)) {
        if (!/^<pre\b/.test(tag)) {
          fail(
            route.path + ".html",
            "code-window is not a pre",
            `${tag.trim()} — code-window names a code block, and a <div> is not one`
          );
        }
      }
    }

    // 8 — the HTML advertises the twin, and names the file that exists.
    checked++;
    if (!fs.existsSync(html)) {
      fail(rel, "advertised", `${route.path}.html is missing — nothing can advertise the twin`);
      continue;
    }
    const advert = /<link rel="alternate" type="text\/markdown" href="([^"]+)">/.exec(
      fs.readFileSync(html, "utf8")
    );
    if (!advert) {
      fail(rel, "advertised", "the HTML carries no <link rel=alternate type=text/markdown>");
    } else if (advert[1] !== route.canonical + ".md") {
      fail(rel, "advertised", `advertises ${advert[1]}, want ${route.canonical}.md`);
    } else if (!fs.existsSync(path.join(DIST, advert[1].replace(ORIGIN, "")))) {
      fail(rel, "advertised", `advertises ${advert[1]}, which is not a file`);
    }


    // 9 — A HEADING BUILT FROM TWO PARTS KEEPS THEM APART.
    //
    // Found by reading `dist/ja-JP/about.md`, eighteen lines in, with every
    // other gate green. `htmd` joins two sibling spans with a single space,
    // which is right for a sentence and wrong for two languages: the reader
    // gets `with AI AI を`, and the H1 is the strongest signal in a file whose
    // whole purpose is to be quoted by a model.
    //
    // ASSERTED POSITIVELY — the separated form must be present — rather than by
    // banning the glued form. The negative would pass for a heading that lost a
    // half entirely, which is the failure mode of the fix that was nearly
    // shipped instead of this one.
    //
    // MATCHED AGAINST HEADING LINES, not against the whole body. A substring
    // search over the file would be satisfied by the same words appearing in a
    // paragraph, which is the shape of an assertion that passes for the wrong
    // reason and then never fails.
    checked++;
    const markup = fs.readFileSync(html, "utf8");
    const region = (/<main[\s\S]*?<\/main>/.exec(markup) || [""])[0];
    const lines = body.split("\n");
    const headings = lines.filter((line) => /^#{1,6} /.test(line));
    for (const [, , inner] of region.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)) {
      for (const [first, second] of headingParts(inner) || []) {
        // `second === null` is the badge: assert the number opens a heading and
        // is followed by the separator, not that it is followed by any
        // particular text.
        const want = second === null ? first + HEADING_SEPARATOR : first + HEADING_SEPARATOR + second;
        const found = headings.some((line) =>
          second === null ? line.replace(/^#{1,6} /, "").startsWith(want) : line.includes(want)
        );
        if (!found) {
          fail(rel, "glued heading", `${JSON.stringify(want)} is not in the Markdown — the two parts of this heading are touching`);
        }
      }
    }

    // 10 — NO DECORATIVE PILL SURVIVES AS PROSE.
    //
    // `class="tag …"` is the small rounded chip above a heading. On the page it
    // reads as a chip because it is drawn as one; in Markdown it lands as a bare
    // line above the H1, indistinguishable from a sentence the page is making.
    // Sixty of them shipped that way across sixty files.
    //
    // NOT ALL OF THEM ARE ENGLISH CHROME, which the decision to drop them
    // originally assumed, and the correction was wrong too — it said ten. Twelve
    // carry CJK (`GEO 技術觀點`, `GEO の技術メモ`, `GEO 기술 노트` and their
    // Simplified siblings) and thirteen are non-ASCII once `Google Cloud Tech —
    // notes` is counted for its em dash. They go anyway — the reason is that a
    // chip is not a sentence, not that nobody translated it — and the front
    // matter already carries the title and description a citation needs.
    //
    // ⚠️ DELIBERATELY WIDER THAN THE PASS IT GUARDS. The first version of both
    // sides looked for the literal `<div class="tag`, which requires `class` to
    // open the tag and `tag` to open the class. Neither is a rule; both merely
    // happen to hold. A chip written `class="mb-6 tag"` would have survived the
    // generator AND been invisible here, because the gate was checking the same
    // narrow shape the fix was — a measurement taking its definition from the
    // thing it measures, which is how `wrangler dev`'s own `charset` kept a
    // charset assertion green for a rule that did not exist. So: any element,
    // `class` anywhere in the tag, `tag` as a whitespace-separated token. If the
    // generator ever stops seeing a chip, this still does.
    checked++;
    for (const pill of chips(region)) {
      const text = visibleText(pill);
      if (text && lines.some((line) => line.trim() === text)) {
        fail(rel, "decorative pill", `${JSON.stringify(text)} stands as its own line — a chip is not a sentence`);
      }
    }

    // 11 — THE TWIN HAS A HEADING AT ALL.
    //
    // ADDED BY REVIEW, NOT BY THE READING, and it guards the failure the fix
    // above was nearly written to cause. The first plan for the glued heading
    // was to drop the English half and keep the local one. It reads better in
    // four locales and destroys the fifth: en-US has no `display-sub`, so forty
    // of its headings are a lead alone and twenty pages would have lost their
    // title outright.
    //
    // NOTHING WOULD HAVE SAID SO. Assertion 9 skips a heading that has only one
    // half, which is every en-US heading, and no other assertion here has an
    // opinion about headings — a title-less page clears `BODY_FLOOR` easily.
    // The measurement caught it; a measurement is not a gate.
    //
    // At least one, not exactly one: eighty-five files carry a single `#` and
    // the remaining fifteen carry two, four or seven. Counted, not assumed.
    checked++;
    if (!headings.some((line) => line.startsWith("# "))) {
      fail(rel, "no heading", "the Markdown has no H1 — the strongest signal a model reads is missing");
    }

    // 13 — A LETTERED RUN OF HEADINGS STARTS AT A AND SKIPS NOTHING.
    //
    // `agent-dev-workflow` said "four complete cases" and then lettered them
    // B, C, D, E, in all five locales. Nobody noticed for as long as the page
    // has existed. It is not a conversion defect — the HTML says B too — so
    // every assertion above it was green and the audit's Pass A, which only
    // compares the two sides, was green as well. A reader found it.
    //
    // MACHINE-CHECKABLE, which is the only reason it is here rather than in a
    // reader's recipe. A letter used as an ordinal is not a judgement call: a
    // run that goes B C D E is wrong however good the prose is.
    //
    // A RUN, NOT A SINGLE HEADING. Two or more headings at the same level that
    // share the same text before the letter — "Scenario", "案例", "사례" — are
    // one run. One heading with a letter in it is a sentence, not an
    // enumeration, and is left alone; requiring a lone `A` would fail on any
    // page that names a grade or a variant.
    //
    // Measured on the current build: five runs (the five locales of that one
    // page), zero failing. Proved red by re-lettering a twin B-E, which fails
    // all five. Two is the floor because a single-item "run" cannot be told
    // from prose, not because a two-item list matters more than a ten-item one.
    checked++;
    const runs = new Map();
    for (const line of headings) {
      const m = /^(#{1,6})\s+(.*)$/.exec(line);
      const letter = /(?:^|\s)([A-Z])(?=\s*[—\-:.、])/.exec(m[2]);
      if (!letter) continue;
      const key = m[1] + "\u0000" + m[2].slice(0, letter.index).trim();
      if (!runs.has(key)) runs.set(key, []);
      runs.get(key).push(letter[1]);
    }
    for (const [key, letters] of runs) {
      if (letters.length < 2) continue;
      const want = letters.map((_, i) => String.fromCharCode(65 + i));
      if (letters.join("") === want.join("")) continue;
      fail(
        rel,
        "lettered run",
        `"${key.split("\u0000")[1]}" is lettered ${letters.join(" ")} — a lettered run has to read ${want.join(" ")}`
      );
    }
  }

  // 12 — AND NOTHING ELSE. The reverse of the first assertion, and the only one
  // that can see a twin left behind by a route that was renamed: the loop above
  // walks the current route table, so a stale file is invisible to it while
  // still being served, still being advertised by nothing, and still being
  // indexed by whoever found it once.
  checked++;
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) found.push("/" + path.relative(DIST, full));
    }
  })(DIST);
  for (const orphan of found.filter((f) => !expected.has(f))) {
    fail(orphan, "orphan", "a Markdown file no route claims — a rename left it behind");
  }

  if (failures.length) {
    console.log("");
    for (const f of failures) {
      console.log(`  ${f.check.padEnd(16)} ${f.route}`);
      console.log(`  ${"".padEnd(16)} ${f.problem}\n`);
    }
    console.log(`${failures.length} Markdown twin defect(s) across ${checked} assertions.`);
    console.log("Nobody reads these files in a browser, which is why they are checked here.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n${found.length} Markdown twins hold, across ${checked} assertions ` +
      `— front matter, body, headings, markup, links, code blocks, headings ` +
      `built from two parts, decorative chips, lettered runs, and the HTML ` +
      `that advertises them.`
  );
}

main();
