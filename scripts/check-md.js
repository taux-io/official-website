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
// ELEVEN ASSERTIONS, and the last is deliberately the reverse of the first —
// the same pairing `check:routes` uses, and for the same reason: an assertion
// in one direction only describes whatever happened to exist on the day it was
// written.
//
// TWO OF THE ELEVEN ARRIVED AFTER A PERSON READ EIGHTEEN LINES. Nine assertions
// and 1564 production assertions were green when someone opened
// `dist/ja-JP/about.md` for the first time and found, inside the first page of
// it, a heading whose two halves had been glued into `with AI AI を` and a
// decorative pill sitting above it as though it were a sentence. Neither is
// invisible; nobody had looked. That is the argument for the two below, and
// for the audit that follows them.
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
// A hundred and sixty headings across eighty files shipped like that. The em
// dash is what separates them once nothing is laying them out.
//
// IT CANNOT BE FIXED BY DROPPING THE ENGLISH HALF, which was the first plan.
// en-US has no `display-sub` at all — forty of its headings are `display-lead`
// alone — so dropping the lead leaves twenty English pages with no heading. The
// measurement that caught this is the reason all five locales get read, not one.
const HEADING_SEPARATOR = " \u2014 ";

// Text as `htmd` will see it once the markup is gone. Verified against the
// build: the only tag that ever appears inside these spans is `<br>`, and no
// HTML entity does — so this is enough, and honest about being enough.
function flatten(markup) {
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


    // 9 — A BILINGUAL HEADING KEEPS ITS TWO HALVES APART.
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
    checked++;
    const markup = fs.readFileSync(html, "utf8");
    const region = (/<main[\s\S]*?<\/main>/.exec(markup) || [""])[0];
    const lines = body.split("\n");
    for (const [, , inner] of region.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)) {
      const lead = /<span[^>]*class="display-lead[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(inner);
      const sub = /<span[^>]*class="display-sub[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(inner);
      if (!lead || !sub) continue;
      const want = flatten(lead[1]) + HEADING_SEPARATOR + flatten(sub[1]);
      if (!body.includes(want)) {
        fail(rel, "glued heading", `${JSON.stringify(want)} is not in the Markdown — the two halves of a bilingual heading are touching`);
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
    // originally assumed: ten carry localised text (`GEO 技術觀點`,
    // `GEO の技術メモ`, `GEO 기술 노트`). They go anyway — the reason is that a
    // chip is not a sentence, not that nobody translated it — and the front
    // matter already carries the title and description a citation needs.
    checked++;
    for (const [, , pill] of region.matchAll(/<(div|span)\s+class="tag[\s"][^>]*>([\s\S]*?)<\/\1>/g)) {
      const text = flatten(pill);
      if (text && lines.some((line) => line.trim() === text)) {
        fail(rel, "decorative pill", `${JSON.stringify(text)} stands as its own line — a chip is not a sentence`);
      }
    }
  }

  // 11 — AND NOTHING ELSE. The reverse of the first assertion, and the only one
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
      `— front matter, body, markup, links, code blocks, bilingual headings, ` +
      `decorative chips, and the HTML that advertises them.`
  );
}

main();
