// Reports what the built pages declare about who published them.
//
//   node scripts/check-entity.js           the three offline rules
//   node scripts/check-entity.js --links   the one rule that needs the network
//
// The defects this exists for all passed every gate the repo already had, and
// that is not a failure of those gates — it is that none of them asks this
// question. The contract test asks whether a route carries structured data.
// check:jsonld asks whether that data parses and whether an object declares a
// key twice, which is the one fault JSON.parse resolves silently rather than
// reporting. Neither can see a reference to a node that was never declared:
// it parses, it is valid JSON-LD syntax, and it points at nothing. Four of
// them shipped that way, all naming a WebSite node no template defines.
//
// So this reads the GRAPH rather than the syntax, and it reads dist/ rather
// than templates/. That is the other half of the same point: an @id graph only
// exists once minijinja has composed the includes. An author looking at a
// template sees a fragment; a search engine sees the assembled document, and
// the assembled document is where a reference either resolves or does not.
// check:design is the opposite direction and reads what the author wrote.
//
// RULES ARE SWITCHED ON BY THE TICKET THAT MAKES THEM SATISFIABLE. All four
// below are off today, because all four describe a state the site is not yet
// in. Landing them disabled and flipping each in the change that earns it is
// what keeps CI green commit to commit without an allowlist — and a rule that
// is off says so, and says which ticket turns it on.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const ORIGIN = "https://taux.io";

const LD = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const TITLE = /<title>([\s\S]*?)<\/title>/;
const DESCRIPTION = /<meta name="description" content="([^"]*)"/;
const CJK = /[㐀-䶿一-鿿豈-﫿]/;

// Organization and everything schema.org derives from it that this site would
// plausibly use. A node is the company whichever of these names it goes by.
const ORGANISATION_TYPES = new Set([
  "Organization",
  "LocalBusiness",
  "ProfessionalService",
  "Corporation",
]);

function pages() {
  return fs
    .readdirSync(DIST)
    .filter((f) => f.endsWith(".html"))
    .map((f) => ({ rel: f, html: fs.readFileSync(path.join(DIST, f), "utf8") }));
}

// Every JSON-LD document on a page, already parsed. check:jsonld is the gate
// that guarantees these parse, so a failure here would mean it did not run —
// worth saying out loud rather than crashing with a JSON error.
function graphs(html, rel) {
  const out = [];
  for (const m of html.matchAll(LD)) {
    try {
      out.push(JSON.parse(m[1]));
    } catch (e) {
      throw new Error(`${rel}: JSON-LD does not parse — run check:jsonld first (${e.message})`);
    }
  }
  return out;
}

// Walks every object in a document and sorts the ones carrying an @id into
// declarations and references.
//
// The distinction is the whole rule: an object with both @type and @id DECLARES
// that node, and an object with an @id and no @type merely POINTS at one. That
// is exactly how a consumer reads it, and it is why `{"@id": ".../#website"}`
// sitting under isPartOf is a reference and not a definition of anything.
function idsIn(doc) {
  const declared = new Set();
  const referenced = [];

  const visit = (node, trail) => {
    if (Array.isArray(node)) {
      node.forEach((n, i) => visit(n, `${trail}[${i}]`));
      return;
    }
    if (!node || typeof node !== "object") return;

    const id = node["@id"];
    if (typeof id === "string") {
      if (node["@type"]) declared.add(id);
      else referenced.push({ id, at: trail });
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === "@id" || k === "@type" || k === "@context") continue;
      visit(v, trail ? `${trail}.${k}` : k);
    }
  };

  visit(doc, "");
  return { declared, referenced };
}

// Only the organisation this site IS, never the ones it cites.
//
// The guides name Google, Forrester, NBER, METR and others as sources, and
// those are mentions rather than identity claims — demanding an @id for them
// would be demanding that this repo mint identifiers for other people's
// companies. The site's own node is the one claiming this origin as its url or
// its @id; a cited organisation claims neither.
//
// This distinction is load-bearing. Without it the rule reports thirty
// violations it can never be made to pass, which is the shape of a check people
// learn to skip.
function ourOrganisationsIn(doc) {
  const found = [];
  const ours = (node) =>
    (typeof node.url === "string" && node.url.startsWith(ORIGIN)) ||
    (typeof node["@id"] === "string" && node["@id"].startsWith(ORIGIN));

  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;

    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((t) => ORGANISATION_TYPES.has(t)) && ours(node)) {
      found.push({ id: node["@id"] || null, name: node.name || node.legalName || "(未命名)" });
    }
    for (const v of Object.values(node)) visit(v);
  };
  visit(doc);
  return found;
}

function sameAsIn(doc) {
  const urls = new Set();
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const s = node.sameAs;
    for (const u of Array.isArray(s) ? s : s ? [s] : []) {
      if (typeof u === "string") urls.add(u);
    }
    for (const v of Object.values(node)) visit(v);
  };
  visit(doc);
  return urls;
}

// ---------------------------------------------------------------------------
// Rules. Each returns a list of {file, detail}.

// A reference must resolve inside the page that makes it.
//
// Scope is the PAGE, not the individual script block. A consumer merges every
// JSON-LD block in a document into one graph, so a node declared in a shared
// block in <head> is available to a reference made in the page's own block —
// and checking per block would report that correct arrangement as broken,
// which would push the fix towards repeating the organisation on every page
// instead of declaring it once.
//
// It is not wider than the page either. An @id declared on /about does nothing
// for a reference made on /geo-guide: the consumer parsing the guide never
// fetches the about page.
function ruleIdReferencesResolve(files) {
  const found = [];
  for (const { rel, html } of files) {
    const docs = graphs(html, rel);
    const declared = new Set();
    const referenced = [];
    for (const doc of docs) {
      const ids = idsIn(doc);
      for (const id of ids.declared) declared.add(id);
      referenced.push(...ids.referenced);
    }
    for (const { id, at } of referenced) {
      if (!declared.has(id)) {
        found.push({ file: rel, detail: `${at} references ${id}, which nothing on this page declares` });
      }
    }
  }
  return found;
}

// One company, one identity. Nodes without an @id are separate entities as far
// as a consumer is concerned, so four declarations of the same company with no
// @id between them are four companies — each holding a different subset of the
// facts, and none of them the one the articles name as their publisher.
function ruleOneOrganisationIdentity(files) {
  const found = [];
  const ids = new Map();

  for (const { rel, html } of files) {
    for (const doc of graphs(html, rel)) {
      for (const org of ourOrganisationsIn(doc)) {
        if (!org.id) {
          found.push({ file: rel, detail: `Organization "${org.name}" declares no @id` });
          continue;
        }
        if (!ids.has(org.id)) ids.set(org.id, []);
        ids.get(org.id).push(rel);
      }
    }
  }

  if (ids.size > 1) {
    for (const [id, where] of ids) {
      found.push({ file: where[0], detail: `Organization identity ${id} (${where.length} page(s))` });
    }
  }
  return found;
}

// The market is Traditional Chinese. A title and description with no Chinese in
// them share no surface with the query they are meant to match — which was
// literally true of the flagship GEO guide, whose content is Chinese and whose
// title and description were not.
function ruleFacingChinese(files) {
  const found = [];
  for (const { rel, html } of files) {
    const title = TITLE.exec(html);
    const description = DESCRIPTION.exec(html);
    if (!title) {
      found.push({ file: rel, detail: "no <title>" });
    } else if (!CJK.test(title[1])) {
      found.push({ file: rel, detail: `title has no Chinese — ${title[1].trim()}` });
    }
    if (!description) {
      found.push({ file: rel, detail: "no meta description" });
    } else if (!CJK.test(description[1])) {
      found.push({ file: rel, detail: `description has no Chinese — ${description[1].slice(0, 60)}…` });
    }
  }
  return found;
}

// sameAs asserts "these are the same entity". Pointing it at a profile that
// does not exist asserts a relationship with nothing, and this site did: the
// declared Facebook page was not the real one, and the real one — linked in the
// footer the whole time — was not declared.
//
// This is the only rule here that reaches the network, which is why it is
// behind a flag and belongs to the CI job that already needs one.
//
// Its reach is genuinely limited and saying so is part of the rule. A hard 404
// it catches. A soft one it cannot: facebook.com answers 200 with a login wall
// for a profile that does not exist, so the very defect that motivated this —
// a declared Facebook page that was not real — would pass. Deciding whether a
// social profile is the right one stays a person's job; this only catches the
// link that is outright dead.
async function ruleSameAsResolves(files) {
  const found = [];
  const urls = new Map();

  for (const { rel, html } of files) {
    for (const doc of graphs(html, rel)) {
      for (const u of sameAsIn(doc)) {
        if (!urls.has(u)) urls.set(u, rel);
      }
    }
  }

  for (const [url, rel] of urls) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (compatible; taux-entity-check)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) found.push({ file: rel, detail: `sameAs ${url} answered ${res.status}` });
    } catch (e) {
      found.push({ file: rel, detail: `sameAs ${url} could not be reached — ${e.message}` });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------

const RULES = [
  {
    name: "@id references resolve",
    enabled: true,
    network: false,
    turnedOnBy: "#104 — consolidates the Organization and adds the missing WebSite node",
    run: ruleIdReferencesResolve,
    summary: "a reference must point at a node the same document declares",
  },
  {
    name: "one organisation identity",
    enabled: true,
    network: false,
    turnedOnBy: "#104 — consolidates the Organization and adds the missing WebSite node",
    run: ruleOneOrganisationIdentity,
    summary: "one company, one @id, site-wide",
  },
  {
    name: "chinese facing copy",
    enabled: true,
    network: false,
    turnedOnBy: "#105 — rewrites nine titles and descriptions to lead in Chinese",
    run: ruleFacingChinese,
    summary: "title and description must share surface with a Traditional Chinese query",
  },
  {
    name: "sameAs resolves",
    enabled: true,
    network: true,
    turnedOnBy: "#104 — replaces the declared Facebook page with the real one",
    run: ruleSameAsResolves,
    summary: "an identity claim must point at something that exists",
  },
];

async function main() {
  const wantsNetwork = process.argv.includes("--links");
  const mode = wantsNetwork ? "network" : "offline";

  if (!fs.existsSync(DIST)) {
    console.log("\ndist/ is missing — run npm run build:site first.");
    process.exitCode = 1;
    return;
  }

  const files = pages();
  const selected = RULES.filter((r) => Boolean(r.network) === wantsNetwork);

  let failed = 0;
  const pending = [];

  for (const rule of selected) {
    if (!rule.enabled) {
      pending.push(rule);
      continue;
    }
    const violations = await rule.run(files);
    if (!violations.length) continue;

    failed += violations.length;
    console.log(`\n  ${rule.name} — ${rule.summary}\n`);
    for (const v of violations) console.log(`      ${v.file}  ${v.detail}`);
  }

  if (pending.length) {
    console.log("");
    for (const rule of pending) {
      console.log(`  not yet enforced — ${rule.name}: ${rule.turnedOnBy}`);
    }
  }

  if (failed) {
    console.log(`\n${failed} entity defect(s).`);
    process.exitCode = 1;
    return;
  }

  const on = selected.filter((r) => r.enabled).length;
  console.log(
    `\nentity declarations hold (${on} of ${selected.length} ${mode} rules enforced, ${files.length} pages)`
  );
}

main().catch((e) => {
  // A stack trace here is noise: every error this throws is a sentence about
  // the site, not about this file.
  console.log(`\n${e.message}`);
  process.exitCode = 1;
});
