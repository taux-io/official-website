// Asserts the mattpocock-skills guide says what its data file says, and
// nothing the Content-Security-Policy would refuse.
//
//   node scripts/check-mattpocock-skills.js
//   node scripts/check-mattpocock-skills.js --dist <dir> --data <file> --phase <file> --plugin <dir>
//   MATTPOCOCK_SKILLS_DIR=<dir> node scripts/check-mattpocock-skills.js
//
// The page is written by a template looping over data/mattpocock_skills.json,
// so a skill can go missing three ways the other gates cannot see: it is dropped
// from the data file and nobody notices; it is in the data but the template
// stops printing it; or the Markdown twin loses it in conversion. check-md
// asks whether the twin is well formed, never whether it is complete. This asks
// whether every skill the data names is a section of the page and of its twin,
// with the fields a reader came for.
//
// VERSION LABELS ARE CLAIMS. "加入於 1.3.0" is only true if the upstream
// changelog says so. The rule: the label is the oldest changelog section that
// names the skill in backticks, and a skill that was renamed or merged out of
// older ones carries none (its name is new, its history is not). With the
// plugin directory present the data is held to that rule; without it the page
// is only held to the data.
//
// THE CSP HAS NO STATIC GATE. `contract` catches violations in a browser, in the
// audit job. Nothing reads the built page for an inline <script>, a <style> or a
// style= attribute, and nothing reads it for a dark mode the design forbids
// (DESIGN.md, decision 95). Both are checked here, over the whole page.
//
// THE PLUGIN IS OPTIONAL. CI has no copy of it, so without a directory those
// comparisons are skipped and say so. A directory that is named but does not
// hold the plugin is an error, not a skip.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SLUG = "mattpocock-skills";
const LOCALE = "zh-Hant-TW";
const ORIGIN = "https://taux.io";
const UPSTREAM = "https://github.com/mattpocock/skills";
const LABELS = ["一句話答案", "解決什麼問題", "什麼時候用", "前後接誰", "呼叫方式"];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const failures = [];
let assertions = 0;
function check(ok, where, check_, problem) {
  assertions++;
  if (!ok) failures.push({ where, check: check_, problem });
}

const text = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"');

// Oldest changelog section that names `skill` in backticks, or null.
function introducedIn(changelog, skill) {
  const sections = [];
  let current = null;
  for (const line of changelog.split("\n")) {
    const m = /^## (\d+\.\d+\.\d+)/.exec(line);
    if (m) {
      current = { version: m[1], body: "" };
      sections.push(current);
    } else if (current) {
      current.body += line + "\n";
    }
  }
  const hits = sections.filter((s) => s.body.includes("`" + skill + "`"));
  return hits.length ? hits[hits.length - 1].version : null;
}

function checkPage(data, html, md) {
  const where = `/${LOCALE}/${SLUG}`;
  const skills = data.skills;

  // Sections of the HTML, cut at each skill anchor.
  const starts = [...html.matchAll(/id="skill-([a-z0-9-]+)"/g)];
  const htmlSection = {};
  starts.forEach((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : html.indexOf("</main>");
    // A skill section also ends where the next chapter (<section>) begins.
    const chapter = html.indexOf("<section", m.index);
    htmlSection[m[1]] = html.slice(m.index, chapter !== -1 && chapter < end ? chapter : end);
  });
  const mdSection = {};
  for (const block of md.split(/^### /m).slice(1)) {
    const name = block.split("\n", 1)[0].trim();
    mdSection[name] = block;
  }

  for (const s of skills) {
    const h = htmlSection[s.skill];
    check(h !== undefined, where, "skill section", `${s.skill} has no id="skill-${s.skill}" section in the page`);
    check(
      mdSection[s.skill] !== undefined,
      where + ".md",
      "skill section",
      `${s.skill} has no "### ${s.skill}" heading in the Markdown twin`,
    );
    for (const [kind, body] of [["page", h], ["markdown twin", mdSection[s.skill]]]) {
      if (body === undefined) continue;
      for (const label of LABELS) {
        const present = kind === "page" ? body.includes(`<strong>${label}</strong>`) : body.includes(`**${label}**`);
        check(present, where, "skill fields", `${s.skill} (${kind}) is missing the "${label}" field`);
      }
      const shown = kind === "page"
        ? (/<strong>加入於<\/strong>：\s*([\d.]+)/.exec(body) || [])[1] || null
        : (/\*\*加入於\*\*：\s*([\d.]+)/.exec(body) || [])[1] || null;
      check(
        shown === (s.version || null),
        where,
        "version label",
        `${s.skill} (${kind}) shows ${shown ? "加入於 " + shown : "no version"}, the data says ${s.version || "none"}`,
      );
      const hand = kind === "page" ? text(body) : body;
      const invoked = s.invocation === "user" ? "手打" : "模型";
      check(hand.includes(invoked), where, "invocation", `${s.skill} (${kind}) does not say how it is invoked (${invoked})`);
    }
  }

  const unknown = Object.keys(htmlSection).filter((n) => !skills.some((s) => s.skill === n));
  check(unknown.length === 0, where, "skill section", `the page has sections the data does not: ${unknown.join(", ")}`);

  // The flow list: every node is a link to a section, and the nodes are the
  // main line, in the data's order.
  const flow = /<ol[^>]*data-flow[^>]*>([\s\S]*?)<\/ol>/.exec(html);
  check(!!flow, where, "flow", 'no <ol data-flow> on the page');
  if (flow) {
    const nodes = [...flow[1].matchAll(/href="#skill-([a-z0-9-]+)"/g)].map((m) => m[1]);
    const main = skills.filter((s) => s.region === "main").map((s) => s.skill);
    check(
      JSON.stringify(nodes) === JSON.stringify(main),
      where,
      "flow",
      `the flow lists ${nodes.join(" > ")}; the data's main line is ${main.join(" > ")}`,
    );
    const mdFlow = main.filter((n) => !md.includes(`${where}#skill-${n}`.replace(/^/, ORIGIN)));
    check(mdFlow.length === 0, where + ".md", "flow", `the twin's flow does not link ${mdFlow.join(", ")}`);
  }

  // Provenance and the correction.
  const firstCover = html.indexOf("data-cover");
  // The cover macro prints its number as a <p class="eyebrow">; that is not prose.
  const lead = [...html.slice(firstCover).matchAll(/<p\b[\s\S]*?<\/p>/g)].map((m) => m[0]).find((p) => !p.includes("eyebrow")) || "";
  check(
    lead.includes(`href="${UPSTREAM}"`) && text(lead).includes("Matt Pocock"),
    where,
    "upstream",
    `the first paragraph of the body must name Matt Pocock and link ${UPSTREAM}`,
  );
  check(md.includes(`](${UPSTREAM})`), where + ".md", "upstream", `the twin never links ${UPSTREAM}`);

  const correction = /<p[^>]*id="correction"[^>]*>([\s\S]*?)<\/p>/.exec(html);
  check(!!correction, where, "correction", 'no <p id="correction"> on the page');
  const claim = correction ? text(correction[1]) : "";
  for (const needle of ["pr", "retro", "implement-spec", "1.3.0", "1.3.1"]) {
    check(claim.includes(needle), where, "correction", `the correction does not mention ${needle}`);
  }
  check(md.includes("1.3.0") && /implement-spec/.test(md), where + ".md", "correction", "the twin lost the correction");
  check(
    text(html).includes(`依 ${data.plugin_version} 撰寫`) && md.includes(`依 ${data.plugin_version} 撰寫`),
    where,
    "written-for",
    `the page and its twin must say 依 ${data.plugin_version} 撰寫`,
  );
}

// The phase-boundary tree. The order of the five options, the four cases that
// justify a handoff and the smart-zone figure are claims about the upstream
// (ask-matt's PHASE-BOUNDARIES.md); the page must carry them in its HTML and in
// its twin, as a plain ordered list a reader can follow with no script.
const PHASE_ORDER = ["continue", "clear", "handoff", "subagent", "compact"];
const SMART_ZONE_K = 150;
const HANDOFF_CASES = ["harness", "目錄", "同事", "中途"];

function checkPhase(phase, html, md) {
  const where = `/${LOCALE}/${SLUG}`;
  const ids = phase.options.map((o) => o.id);
  check(
    JSON.stringify(ids) === JSON.stringify(PHASE_ORDER),
    where,
    "phase order",
    `the options are ${ids.join(" > ")}; PHASE-BOUNDARIES.md orders them ${PHASE_ORDER.join(" > ")}`,
  );
  check(phase.questions.length === 5, where, "phase order", `the tree has ${phase.questions.length} questions, not 5`);
  check(
    JSON.stringify(phase.questions.map((q) => q.leads_to)) === JSON.stringify(PHASE_ORDER),
    where,
    "phase order",
    "the questions do not lead to the options in order",
  );

  const tree = /<ol[^>]*data-phase-tree[^>]*>([\s\S]*?)<\/ol>/.exec(html);
  check(!!tree, where, "phase tree", "no <ol data-phase-tree> on the page");
  if (tree) {
    const items = [...tree[1].matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
    check(items.length === 5, where, "phase tree", `the tree list has ${items.length} items, not 5`);
    items.forEach((li, i) => {
      const q = phase.questions[i];
      if (!q) return;
      check(text(li).includes(q.text), where, "phase tree", `item ${i + 1} does not carry the question the data gives`);
      const o = phase.options[i];
      check(li.includes(`href="#phase-${o.id}"`), where, "phase tree", `item ${i + 1} does not link to #phase-${o.id}`);
    });
    const first = items[0] ? text(items[0]) : "";
    check(first.includes("先排除"), where, "phase tree", "the first question does not say continue is ruled out first");
  }

  for (const [kind, body] of [["page", text(html)], ["markdown twin", md]]) {
    for (const o of phase.options) {
      check(body.includes(o.does), where, "phase options", `${o.name} (${kind}) lost its description`);
    }
    const compact = phase.options.find((o) => o.id === "compact");
    check(
      compact && /預設/.test(compact.reason) && body.includes(compact.reason),
      where,
      "phase options",
      `compact (${kind}) must be described as the default, not the first reach`,
    );
    const handoff = phase.options.find((o) => o.id === "handoff");
    const cases = (handoff && handoff.valid_reasons) || [];
    check(cases.length === 4, where, "handoff cases", `the data lists ${cases.length} handoff cases, not 4`);
    HANDOFF_CASES.forEach((kw, i) => {
      check(!!cases[i] && cases[i].includes(kw), where, "handoff cases", `handoff case ${i + 1} should be about "${kw}"`);
    });
    for (const c of cases) check(body.includes(c), where, "handoff cases", `handoff case "${c}" (${kind}) is missing`);
    check(
      body.includes(`${phase.smart_zone.tokens_k}k`) && phase.smart_zone.tokens_k === SMART_ZONE_K,
      where,
      "smart zone",
      `the smart zone must read ${SMART_ZONE_K}k (${kind})`,
    );
    check(body.includes(phase.smart_zone.text), where, "smart zone", `the smart-zone explanation (${kind}) is missing`);
  }
}

function checkPhasePlugin(phase, dir) {
  const where = "plugin " + dir;
  const askMatt = path.join(dir, "skills", "engineering", "ask-matt");
  const boundaries = path.join(askMatt, "PHASE-BOUNDARIES.md");
  const skill = path.join(askMatt, "SKILL.md");
  if (!fs.existsSync(boundaries) || !fs.existsSync(skill)) {
    check(false, where, "plugin", "ask-matt/PHASE-BOUNDARIES.md or SKILL.md is missing");
    return;
  }
  const doc = fs.readFileSync(boundaries, "utf8");
  const table = /## The five options([\s\S]*?)\n## /.exec(doc);
  const names = table
    ? [...table[1].matchAll(/^\|\s*\*\*([^*]+)\*\*/gm)].map((m) => m[1].toLowerCase().replace(/[`/]/g, ""))
    : [];
  check(
    JSON.stringify(names) === JSON.stringify(PHASE_ORDER),
    where,
    "phase order",
    `PHASE-BOUNDARIES.md lists ${names.join(" > ")}; the checker expects ${PHASE_ORDER.join(" > ")}`,
  );
  const tree = /## The tree([\s\S]*?)\n## /.exec(doc);
  const order = tree ? [...tree[1].matchAll(/^\*\*(\d)\./gm)].length : 0;
  check(order === 5, where, "phase order", "PHASE-BOUNDARIES.md no longer has five numbered questions");
  const bullets = tree ? (/You need it only when you are:([\s\S]*?)That list is the whole clause/.exec(tree[1]) || [])[1] || "" : "";
  check((bullets.match(/^- /gm) || []).length === 4, where, "handoff cases", "PHASE-BOUNDARIES.md no longer lists exactly four handoff cases");
  for (const f of [boundaries, skill]) {
    const k = [...fs.readFileSync(f, "utf8").matchAll(/~(\d+)k tokens/g)].map((m) => Number(m[1]));
    check(
      k.length > 0 && k.every((n) => n === phase.smart_zone.tokens_k),
      where,
      "smart zone",
      `${path.basename(f)} says ~${k.join(", ")}k; the data says ${phase.smart_zone.tokens_k}k`,
    );
  }
}

// What the CSP refuses, and the dark mode the design forbids.
function checkPolicy(html, css) {
  const where = `/${LOCALE}/${SLUG}`;
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = m[1];
    const ok = /\bsrc\s*=/.test(attrs) || /type\s*=\s*"application\/(ld\+)?json"/.test(attrs);
    check(ok, where, "inline script", `an inline <script${attrs}> would be refused by script-src 'self'`);
  }
  check(!/<style\b/i.test(html), where, "inline style", "the page has a <style> element; style-src is 'self'");
  check(!/\sstyle\s*=/i.test(html), where, "inline style", "the page has a style= attribute; style-src is 'self'");
  const dark = /prefers-color-scheme|data-theme|color-scheme\s*:\s*dark/;
  check(!dark.test(html), where, "dark mode", "the page carries dark-mode markup; the site has none (DESIGN.md)");
  check(!dark.test(css), "static/css/styles.min.css", "dark mode", "the stylesheet carries a dark mode; the site has none (DESIGN.md)");
}

function checkPlugin(data, dir) {
  const where = "plugin " + dir;
  const root = path.join(dir, "skills");
  if (!fs.existsSync(root)) {
    check(false, where, "plugin", `${dir} has no skills/ directory; it is not the mattpocock-skills plugin`);
    return;
  }
  const found = {};
  for (const bucket of fs.readdirSync(root)) {
    const b = path.join(root, bucket);
    if (!fs.statSync(b).isDirectory()) continue;
    for (const name of fs.readdirSync(b)) {
      const file = path.join(b, name, "SKILL.md");
      if (fs.existsSync(file)) found[name] = fs.readFileSync(file, "utf8");
    }
  }
  const changelog = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, ".claude-plugin", "plugin.json"), "utf8"));
  check(manifest.version === data.plugin_version, where, "plugin version", `the plugin is ${manifest.version}, the data was written for ${data.plugin_version}`);

  // Subset, not equality, while the data file holds only the main line.
  for (const s of data.skills) {
    const src = found[s.skill];
    check(src !== undefined, where, "skill exists", `${s.skill} is not a skill in the plugin`);
    if (src === undefined) continue;
    const front = /^---\n([\s\S]*?)\n---/.exec(src);
    const userOnly = !!front && /^disable-model-invocation:\s*true\s*$/m.test(front[1]);
    check(
      (s.invocation === "user") === userOnly,
      where,
      "invocation",
      `${s.skill}: the data says ${s.invocation}-invoked; its SKILL.md says ${userOnly ? "user" : "model"}-invoked`,
    );
    const oldest = introducedIn(changelog, s.skill);
    if (s.version) {
      check(s.version === oldest, where, "version label", `${s.skill}: labelled ${s.version}; the oldest changelog section naming it is ${oldest}`);
      check(!s.renamed_from, where, "version label", `${s.skill}: renamed skills carry no label`);
    } else {
      check(
        oldest === null || !!s.renamed_from,
        where,
        "version label",
        `${s.skill}: the changelog names it in ${oldest} and the data records no rename, so the label is provable; add it`,
      );
    }
  }

  const sec = new RegExp("^## 1\\.3\\.0([\\s\\S]*?)^## ", "m").exec(changelog);
  for (const n of ["pr", "retro", "implement-spec"]) {
    check(!!sec && sec[1].includes("`" + n + "`"), where, "correction", `the changelog's 1.3.0 section does not name ${n}`);
  }
  const patch = /^## 1\.3\.1([\s\S]*?)^## /m.exec(changelog);
  check(!!patch && !/Graduate/.test(patch[1]), where, "correction", "the 1.3.1 section graduates something; the correction would be wrong");
}

function main() {
  const dist = path.resolve(arg("--dist") || path.join(ROOT, "dist"));
  const dataFile = path.resolve(arg("--data") || path.join(ROOT, "data", "mattpocock_skills.json"));
  const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
  const html = read(path.join(dist, LOCALE, SLUG + ".html"));
  const md = read(path.join(dist, LOCALE, SLUG + ".md"));
  if (html === null || md === null) {
    console.log(`\n  page             ${dist}/${LOCALE}/${SLUG}.{html,md}`);
    console.log("                   not built. Run `npm run build:site` first, and check that site.toml declares the page.\n");
    process.exitCode = 1;
    return;
  }
  const css = read(path.join(ROOT, "static", "css", "styles.min.css")) || "";

  const phaseFile = path.resolve(arg("--phase") || path.join(ROOT, "data", "mattpocock_phase.json"));
  const phase = JSON.parse(fs.readFileSync(phaseFile, "utf8"));

  checkPage(data, html, md);
  checkPhase(phase, html, md);
  checkPolicy(html, css);

  const plugin = arg("--plugin") || process.env.MATTPOCOCK_SKILLS_DIR;
  if (plugin) {
    checkPlugin(data, path.resolve(plugin));
    checkPhasePlugin(phase, path.resolve(plugin));
  }

  if (failures.length) {
    console.log("");
    for (const f of failures) {
      console.log(`  ${f.check.padEnd(16)} ${f.where}`);
      console.log(`  ${"".padEnd(16)} ${f.problem}\n`);
    }
    console.log(`${failures.length} mattpocock-skills defect(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `mattpocock-skills page holds (${assertions} assertions, ${data.skills.length} skills)` +
      (plugin ? "" : "; plugin comparison skipped, no MATTPOCOCK_SKILLS_DIR"),
  );
}

main();
