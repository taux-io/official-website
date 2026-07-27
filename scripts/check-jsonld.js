// Validates the JSON-LD in the built pages, including the failure JSON.parse
// cannot report: a duplicate key.
//
//   node scripts/check-jsonld.js
//
// Structured data is the site's primary GEO signal, and it is the one part of a
// page where a defect is invisible from every direction — it does not render, it
// does not throw, and the page looks right.
//
// Duplicate keys are the specific case that motivated this. A bulk edit put
// `legalName` into seven objects that already had it. Every parser takes the
// last one, so the output was correct and the document was invalid, and the
// check that was supposed to catch it — `JSON.parse` on each block — passed,
// because JSON.parse silently discards the earlier key. A validator that uses
// the same parser as the consumer cannot see this class of fault at all, so this
// one scans the text.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// Walks the raw text and reports every object that declares the same key twice.
//
// Written as a scanner rather than a parse because every parser in reach — the
// one here, the one Google uses — resolves duplicates rather than reporting
// them. The document is already known to parse when this runs, so this only has
// to be right about strings, escapes and nesting.
function duplicateKeys(text) {
  const found = [];
  const stack = [];
  let i = 0;

  const readString = () => {
    let s = "";
    i++; // opening quote
    while (i < text.length) {
      const c = text[i];
      if (c === "\\") {
        s += text[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') {
        i++;
        return s;
      }
      s += c;
      i++;
    }
    return s;
  };

  while (i < text.length) {
    const c = text[i];

    if (c === '"') {
      const top = stack[stack.length - 1];
      const start = i;
      const s = readString();
      // A string is a key only when the innermost container is an object and
      // nothing has claimed the current slot as a value.
      if (top && top.kind === "object" && top.expectKey) {
        if (top.keys.has(s)) found.push({ key: s, at: start });
        top.keys.add(s);
        top.expectKey = false;
      }
      continue;
    }

    if (c === "{") {
      stack.push({ kind: "object", keys: new Set(), expectKey: true });
    } else if (c === "[") {
      stack.push({ kind: "array" });
    } else if (c === "}" || c === "]") {
      stack.pop();
    } else if (c === ",") {
      const top = stack[stack.length - 1];
      if (top && top.kind === "object") top.expectKey = true;
    }
    i++;
  }

  return found;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error("dist/ not built — run npm run build:site first");
    process.exit(1);
  }

  const problems = [];
  let blocks = 0;

  for (const file of walk(DIST)) {
    const html = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const m of html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    )) {
      blocks++;
      const body = m[1];
      try {
        JSON.parse(body);
      } catch (e) {
        problems.push(`${rel}: does not parse — ${e.message}`);
        continue;
      }
      for (const d of duplicateKeys(body)) {
        problems.push(`${rel}: duplicate key "${d.key}" in one object`);
      }
    }
  }

  if (problems.length) {
    console.log("");
    for (const p of problems) console.log(`  ${p}`);
    console.log(
      `\n${problems.length} problem(s) in the structured data.` +
        `\nA duplicate key parses and renders correctly; it is still an invalid document.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`structured data is valid with no duplicate keys (${blocks} blocks)`);
}

main();
