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
// What the plugin held when the data was written. A skill dropped from the data
// file is otherwise invisible in CI, where there is no plugin to compare with.
const EXPECTED_SKILLS = 38;
// "other" skills get a name and one sentence in a closed disclosure; every other
// region gets a full section. The entries are the on-ramps, each of which must
// say where it joins the main line.
const REGIONS = ["main", "router", "entry", "health", "vocab", "standalone", "other"];
const GROUPS = ["misc", "in-progress"];

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

function checkData(data) {
  const where = "data/mattpocock_skills.json";
  const names = data.skills.map((s) => s.skill);
  check(
    data.skills.length === EXPECTED_SKILLS,
    where,
    "skill count",
    `the data holds ${data.skills.length} skills; the plugin ${data.plugin_version} has ${EXPECTED_SKILLS}`,
  );
  check(new Set(names).size === names.length, where, "skill count", "a skill is listed twice");
  for (const s of data.skills) {
    check(REGIONS.includes(s.region), where, "region", `${s.skill}: unknown region "${s.region}"`);
    if (s.region === "other") {
      check(GROUPS.includes(s.group), where, "region", `${s.skill}: group must be one of ${GROUPS.join(", ")}`);
      check(!!s.one_liner, where, "region", `${s.skill}: an "other" skill still needs its one sentence`);
      continue;
    }
    for (const f of ["one_liner", "problem", "when"]) check(!!s[f], where, "fields", `${s.skill}: no ${f}`);
    check(s.invocation === "user" || s.invocation === "model", where, "fields", `${s.skill}: invocation must be user or model`);
    for (const ref of [...(s.before || []), ...(s.after || [])]) {
      const target = data.skills.find((t) => t.skill === ref);
      check(!!target && target.region !== "other", where, "links", `${s.skill}: links to ${ref}, which has no section to land on`);
    }
    if (s.region === "entry") {
      const target = data.skills.find((t) => t.skill === s.merge_at);
      check(!!target && target.region === "main", where, "merge point", `${s.skill}: an on-ramp must name the main-line skill it joins (merge_at)`);
      check(!!s.merge_note, where, "merge point", `${s.skill}: an on-ramp must say how it joins (merge_note)`);
      check(!!s.merge_when, where, "merge point", `${s.skill}: an on-ramp must say when it joins, in a few words (merge_when)`);
    } else {
      check(!s.merge_at, where, "merge point", `${s.skill}: only on-ramps join the main line`);
    }
  }
}

function checkPage(data, html, md) {
  const where = `/${LOCALE}/${SLUG}`;
  const skills = data.skills.filter((s) => s.region !== "other");
  const others = data.skills.filter((s) => s.region === "other");

  // Sections of the HTML, cut at each skill anchor.
  // A section ends at the next skill, at the next chapter, or where the
  // closed "other" disclosure begins, whichever comes first.
  const starts = [...html.matchAll(/id="skill-([a-z0-9-]+)"/g)];
  const stops = [...html.matchAll(/<section\b|<details\b/g)].map((m) => m.index);
  const htmlSection = {};
  starts.forEach((m, i) => {
    const next = [i + 1 < starts.length ? starts[i + 1].index : Infinity, ...stops.filter((x) => x > m.index), html.indexOf("</main>")];
    htmlSection[m[1]] = html.slice(m.index, Math.min(...next));
  });
  // In the twin, a skill is a "### name" heading; a chapter ("## 03 ...") ends it.
  const mdSection = {};
  for (const block of md.split(/^### /m).slice(1)) {
    const name = block.split("\n", 1)[0].trim();
    mdSection[name] = block.split(/^## /m)[0];
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
      if (s.region === "entry") {
        const field = kind === "page" ? body.includes("<strong>併入主線</strong>") : body.includes("**併入主線**");
        check(field, where, "merge point", `${s.skill} (${kind}) is an on-ramp and does not say where it joins the main line (併入主線)`);
        const link = kind === "page" ? `href="#skill-${s.merge_at}"` : `${where.replace(/^/, ORIGIN)}#skill-${s.merge_at}`;
        check(body.includes(link), where, "merge point", `${s.skill} (${kind}) does not link to ${s.merge_at}, where the data says it joins`);
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

  // The "other" skills: a closed disclosure holding a name and one sentence each.
  // The twin prints a disclosure open, so only the page can be asked if it is closed.
  const details = /<details\b([^>]*)>([\s\S]*?)<\/details>/.exec(html.slice(html.indexOf("<main")));
  check(!!details, where, "other skills", "no <details> disclosure holding the other skills");
  if (details) {
    check(!/\bopen\b/.test(details[1]), where, "other skills", "the disclosure of the other skills is open by default; it should start closed");
    const shownText = text(details[2]);
    for (const o of others) {
      check(
        shownText.includes(o.skill) && shownText.includes(o.one_liner),
        where,
        "other skills",
        `${o.skill} is not in the disclosure with its one sentence`,
      );
      check(!htmlSection[o.skill], where, "other skills", `${o.skill} has a full section; the "other" skills are only a name and a sentence`);
      check(md.includes(o.skill) && md.includes(o.one_liner), where + ".md", "other skills", `${o.skill} (markdown twin) is missing its name or its sentence`);
    }
    for (const label of LABELS) {
      check(!details[2].includes(`<strong>${label}</strong>`), where, "other skills", `the disclosure carries the "${label}" field; it should hold only names and sentences`);
    }
  }

  checkFlow(data, html, md);

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

// The flow diagram: chapter 02's main line as a list of links, with the
// on-ramps marked where they join and the two forks and the implement /
// implement-spec comparison beside it. The template writes all of it from the
// data, so this asks the built page whether the twelve nodes are there in
// order, whether each one lands on a section, and whether the twin (which has
// no picture, only the list) says the same.
const MAIN_LINE = [
  "setup-matt-pocock-skills", "grill-with-docs", "prototype", "handoff", "to-spec", "to-tickets",
  "implement", "implement-spec", "tdd", "code-review", "pr", "retro",
];
// Where the three on-ramps join, as ask-matt says it.
const JOINS = { triage: "implement", "diagnosing-bugs": "retro", wayfinder: "to-spec" };

function checkFlow(data, html, md) {
  const where = `/${LOCALE}/${SLUG}`;
  const main = data.skills.filter((s) => s.region === "main").map((s) => s.skill);
  const entries = data.skills.filter((s) => s.region === "entry");
  const hasId = (name) => html.includes(`id="skill-${name}"`);
  const pageText = text(html);

  check(
    JSON.stringify(main) === JSON.stringify(MAIN_LINE),
    "data/mattpocock_skills.json",
    "flow",
    `the data's main line is ${main.join(" > ")}; the issue and ask-matt give ${MAIN_LINE.join(" > ")}`,
  );

  const flow = /<ol[^>]*data-flow[^>]*>([\s\S]*?)<\/ol>/.exec(html);
  check(!!flow, where, "flow", "no <ol data-flow> on the page");
  let items = [];
  if (flow) {
    items = [...flow[1].matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
    check(items.length === main.length, where, "flow", `the flow has ${items.length} nodes, the main line has ${main.length}`);
    const nodes = [...flow[1].matchAll(/<a\b[^>]*data-flow-node[^>]*>/g)].map((m) => (/href="#skill-([a-z0-9-]+)"/.exec(m[0]) || [])[1]);
    check(
      JSON.stringify(nodes) === JSON.stringify(main),
      where,
      "flow",
      `the flow lists ${nodes.join(" > ")}; the data's main line is ${main.join(" > ")}`,
    );
    for (const n of nodes) check(hasId(n), where, "flow", `the node ${n} links to #skill-${n}, which is not on the page`);
    check(!/<nav\b/.test(flow[0]), where, "flow", "the flow sits in a <nav>, which would hold every join link to 44px; keep it a plain list");

    // Each on-ramp is marked inside the node it joins, with a working link.
    for (const e of entries) {
      const li = items.find((x) => x.includes(`data-flow-node href="#skill-${e.merge_at}"`)) || "";
      const join = new RegExp(`<p\\b[^>]*data-flow-join[^>]*>(?:(?!</p>)[\\s\\S])*?href="#skill-${e.skill}"[\\s\\S]*?</p>`).exec(li);
      check(!!join, where, "flow join", `${e.skill} is not marked on the ${e.merge_at} node, where the data says it joins`);
      check(hasId(e.skill), where, "flow join", `the join mark for ${e.skill} links to a section that is not on the page`);
      if (join) check(text(join[0]).includes(e.merge_when), where, "flow join", `${e.skill}: the join mark does not say when it joins (${e.merge_when})`);
      check(JOINS[e.skill] === e.merge_at, "data/mattpocock_skills.json", "flow join", `${e.skill} joins ${e.merge_at}; ask-matt has it join ${JOINS[e.skill]}`);
    }
    check(
      entries.length === Object.keys(JOINS).length,
      where,
      "flow join",
      `the data has ${entries.length} on-ramps; ask-matt has ${Object.keys(JOINS).length}`,
    );
    check(
      (flow[1].match(/data-flow-join/g) || []).length === entries.length,
      where,
      "flow join",
      "the flow carries a join mark that is not an on-ramp, or lost one",
    );
  }

  // The twin has no picture: chapter 02, up to the first skill section, is a
  // numbered list, and it must read as one.
  const open = md.search(/^## 從想法到出貨/m);
  const close = md.indexOf("### " + main[0]);
  const region = open === -1 || close === -1 ? "" : md.slice(open, close);
  check(region !== "", where + ".md", "flow", "the twin has no chapter 02 before its first skill section");
  const at = main.map((n) => region.search(new RegExp(`^\\d+\\.\\s+\\[${n}\\]\\(${ORIGIN}${where}#skill-${n}\\)`, "m")));
  check(at.every((i) => i !== -1), where + ".md", "flow", `the twin's flow does not link ${main.filter((n, i) => at[i] === -1).join(", ")}`);
  check(at.every((x, i) => i === 0 || x > at[i - 1]), where + ".md", "flow", "the twin lists the main line out of order");
  check(/^1\.\s+\[setup-matt-pocock-skills\]/m.test(region), where + ".md", "flow", "the twin's flow is not a numbered list");
  for (const e of entries) {
    const line = region.split("\n").find((l) => l.includes("**入口**") && l.includes(`#skill-${e.skill})`)) || "";
    check(line !== "", where + ".md", "flow join", `the twin's flow does not mention the on-ramp ${e.skill}`);
    check(line === "" || line.includes(e.merge_when), where + ".md", "flow join", `the twin's mark for ${e.skill} does not say when it joins`);
  }

  // The two forks.
  const forks = data.forks || [];
  check(forks.length === 2, "data/mattpocock_skills.json", "forks", `the data has ${forks.length} forks, not 2`);
  forks.forEach((f, i) => {
    check(MAIN_LINE.includes(f.after), "data/mattpocock_skills.json", "forks", `fork ${i + 1}: "after" must name a main-line skill`);
    for (const part of [f.question, f.yes && f.yes.label, f.yes && f.yes.text, f.no && f.no.label, f.no && f.no.text]) {
      check(!!part, "data/mattpocock_skills.json", "forks", `fork ${i + 1} lacks a question or an answer`);
      if (!part) continue;
      check(pageText.includes(part), where, "forks", `fork ${i + 1}: "${part.slice(0, 20)}..." is not on the page`);
      check(md.includes(part), where + ".md", "forks", `fork ${i + 1}: "${part.slice(0, 20)}..." is not in the twin`);
    }
    for (const side of ["yes", "no"]) {
      for (const g of (f[side] && f[side].goes) || []) {
        check(MAIN_LINE.includes(g) && hasId(g), where, "forks", `fork ${i + 1} (${side}) sends the reader to ${g}, which has no section`);
      }
    }
    const li = items.find((x) => x.includes(`data-flow-node href="#skill-${f.after}"`)) || "";
    check(li.includes("data-fork") && text(li).includes(f.question), where, "forks", `fork ${i + 1} is not drawn under the ${f.after} node`);
  });
  [["對話"], ["session"]].forEach((kw, i) => {
    const q = (forks[i] && forks[i].question) || "";
    check(kw.every((k) => q.includes(k)), "data/mattpocock_skills.json", "forks", `fork ${i + 1} should ask about "${kw.join(", ")}" (can it be settled in conversation; is it a multi-session build)`);
  });

  // implement against implement-spec.
  const cmp = data.comparison;
  check(!!cmp && Array.isArray(cmp.rows) && cmp.rows.length >= 4, "data/mattpocock_skills.json", "comparison", "the data needs a comparison with at least 4 rows");
  if (cmp && cmp.rows) {
    check(!!cmp.intro && pageText.includes(cmp.intro) && md.includes(cmp.intro), where, "comparison", "the comparison lost its introduction");
    for (const r of cmp.rows) {
      for (const [kind, body] of [["page", pageText], ["markdown twin", md]]) {
        for (const part of [r.aspect, r.implement, r.implement_spec]) {
          check(!!part && body.includes(part), where, "comparison", `the comparison row "${r.aspect}" (${kind}) is missing a part`);
        }
      }
    }
    check(/<[^>]*data-compare[^>]*>/.test(html), where, "comparison", "no element marked data-compare on the page");
  }
}

// ask-matt is the source of the order, the joins and the forks.
function checkFlowPlugin(data, dir) {
  const where = "plugin " + dir;
  const read = (n) => path.join(dir, "skills", "engineering", n, "SKILL.md");
  for (const n of ["ask-matt", "implement", "implement-spec"]) {
    if (!fs.existsSync(read(n))) {
      check(false, where, "plugin", `${n}/SKILL.md is missing`);
      return;
    }
  }
  const ask = fs.readFileSync(read("ask-matt"), "utf8");
  const mainFlow = (/## The main flow[\s\S]*?(?=\n## On-ramps)/.exec(ask) || [""])[0];
  const names = data.skills.filter((s) => s.region === "main").map((s) => s.skill);
  // The prototype detour is told as handoff, prototype, handoff, so for the
  // order the two are one step.
  const step = (n) => (["prototype", "handoff"].includes(n) ? "prototype+handoff" : n);
  const told = [];
  for (const m of mainFlow.matchAll(/`\/([a-z-]+)`/g)) {
    if (names.includes(m[1]) && !told.includes(step(m[1]))) told.push(step(m[1]));
  }
  // Setup is not part of that story: ask-matt makes it the precondition.
  const mine = names.filter((n) => n !== "setup-matt-pocock-skills").map(step).filter((n, i, a) => a.indexOf(n) === i);
  check(
    JSON.stringify(told) === JSON.stringify(mine),
    where,
    "flow order",
    `ask-matt tells the main flow as ${told.join(" > ")}; the data has ${mine.join(" > ")}`,
  );
  check(names[0] === "setup-matt-pocock-skills", where, "flow order", "the data does not open the main line with setup-matt-pocock-skills");
  check(/## Precondition\s+\*\*`\/setup-matt-pocock-skills`\*\*/.test(ask), where, "flow order", "ask-matt no longer makes setup-matt-pocock-skills the precondition of the main flow");

  const ramps = (/## On-ramps([\s\S]*?)\n## /.exec(ask) || ["", ""])[1];
  for (const e of data.skills.filter((s) => s.region === "entry")) {
    const bullet = ramps.split(/\n- /).find((b) => b.includes("`/" + e.skill + "`"));
    check(!!bullet, where, "flow join", `ask-matt has no on-ramp bullet for ${e.skill}`);
    check(!!bullet && bullet.includes("`/" + e.merge_at + "`"), where, "flow join", `ask-matt's ${e.skill} bullet no longer names ${e.merge_at}`);
  }

  check(/Branch: can you settle every question in conversation\?/.test(ask), where, "forks", "ask-matt no longer asks whether every question can be settled in conversation");
  check(/Branch: is this a multi-session build\?/.test(ask), where, "forks", "ask-matt no longer asks whether this is a multi-session build");

  const impl = fs.readFileSync(read("implement"), "utf8");
  const spec = fs.readFileSync(read("implement-spec"), "utf8");
  check(/code-review/.test(impl) && /tdd/.test(impl), where, "comparison", "implement's SKILL.md no longer calls tdd and code-review");
  check(/task graph/.test(spec) && /integration branch/.test(spec) && /subagent/i.test(spec), where, "comparison", "implement-spec's SKILL.md no longer describes a task graph, an integration branch and subagents");
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

  // Equality, not subset: the data names exactly the skills that have a SKILL.md
  // in the plugin directory. plugin.json lists fewer (the misc and in-progress
  // skills are in the directory but not in the manifest); the directory is what
  // the page describes, so it is what the data is held to.
  const have = Object.keys(found).sort();
  const named = data.skills.map((s) => s.skill).sort();
  const missing = have.filter((n) => !named.includes(n));
  const extra = named.filter((n) => !have.includes(n));
  check(missing.length === 0, where, "skill set", `the plugin has skills the data does not: ${missing.join(", ")}`);
  check(extra.length === 0, where, "skill set", `the data has skills the plugin does not: ${extra.join(", ")}`);
  for (const s of data.skills) {
    const src = found[s.skill];
    check(src !== undefined, where, "skill exists", `${s.skill} is not a skill in the plugin`);
    if (src === undefined || s.region === "other") continue;
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

  checkData(data);
  checkPage(data, html, md);
  checkPhase(phase, html, md);
  checkPolicy(html, css);

  const plugin = arg("--plugin") || process.env.MATTPOCOCK_SKILLS_DIR;
  if (plugin) {
    checkPlugin(data, path.resolve(plugin));
    checkPhasePlugin(phase, path.resolve(plugin));
    checkFlowPlugin(data, path.resolve(plugin));
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
