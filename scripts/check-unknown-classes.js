// Reports class names in the templates that Tailwind generates nothing for.
//
//   node scripts/check-unknown-classes.js
//
// The redesign found 55 of these. They named config keys that were never
// defined — accent, anthro-dark, brand-blue-light, text-muted — plus two typos.
// Tailwind's response to a candidate it cannot resolve is to emit nothing at
// all, so the markup looked deliberate, the build succeeded, and the timeline
// dots on the prompting guide were simply invisible.
//
// This is the highest-frequency risk in the project: it recurs every time
// somebody hand-writes a utility. Nothing else catches it — the class is
// syntactically fine, the page renders, and only the missing effect gives it
// away, to someone who knows what the effect was supposed to be.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CSS = path.join(ROOT, "static", "css", "styles.min.css");
const TEMPLATE_DIRS = [path.join(ROOT, "templates"), path.join(ROOT, "static")];

// Classes a template declares in its own <style> block. Reading them beats
// maintaining a list of prefixes by hand — the list goes stale and each stale
// entry is a false report that trains people to ignore this check.
function localClasses(html) {
  const found = new Set();
  for (const block of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const chunk of block[1].split("}")) {
      const parts = chunk.split("{");
      if (parts.length < 2) continue;
      for (const m of parts[parts.length - 2].matchAll(/\.((?:\\.|[a-zA-Z0-9_-])+)/g)) {
        found.add(m[1].replace(/\\/g, ""));
      }
    }
  }
  return found;
}

// Utilities are what Tailwind generates. Anything that does not look like one
// is markup vocabulary, not a candidate — checking it would only produce noise.
const LOOKS_LIKE_UTILITY =
  /^-?(bg|text|border|rounded|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|min-w|min-h|max-w|max-h|gap|space|flex|grid|col|row|items|justify|self|place|order|inset|top|bottom|left|right|z|opacity|shadow|ring|outline|font|leading|tracking|align|whitespace|break|list|object|overflow|position|absolute|relative|fixed|sticky|static|block|inline|hidden|table|transition|duration|delay|ease|animate|transform|translate|rotate|scale|skew|origin|cursor|select|pointer|resize|fill|stroke|divide|backdrop|blur|filter|antialiased|sr|not-sr|uppercase|lowercase|capitalize|truncate|underline|decoration|indent|aspect|container|columns|float|clear|isolate|visible|invisible|collapse|basis|grow|shrink|content|group|peer)(-|$)/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// A class is present if the stylesheet declares a selector for it.
//
// Only selector text is scanned — everything between a rule's opening brace and
// the one before it. Reading the whole file instead matches the decimal point in
// every `margin:.75rem`, which is how the first version of this reported that
// `mb-4` generates no CSS.
//
// Escapes are stripped so the generated `.md\:h-20` matches the candidate
// `md:h-20`, and `.h-\[140\%\]` matches `h-[140%]`.
function declaredClasses(css) {
  const found = new Set();
  for (const chunk of css.split("}")) {
    const parts = chunk.split("{");
    if (parts.length < 2) continue;
    // The selector is whatever precedes the innermost brace, so a rule nested
    // inside an at-rule prelude is read rather than the prelude.
    const selector = parts[parts.length - 2];
    for (const m of selector.matchAll(/\.((?:\\.|[a-zA-Z0-9_-])+)/g)) {
      found.add(m[1].replace(/\\/g, ""));
    }
  }
  return found;
}

function main() {
  if (!fs.existsSync(CSS)) {
    console.error("stylesheet not built — run npm run build:css first");
    process.exit(1);
  }
  const declared = declaredClasses(fs.readFileSync(CSS, "utf8"));
  const unknown = new Map();

  for (const dir of TEMPLATE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const html = fs.readFileSync(file, "utf8");
      const local = localClasses(html);
      for (const attr of html.matchAll(/class="([^"]*)"/g)) {
        for (const raw of attr[1].split(/\s+/)) {
          if (!raw || raw.includes("{{")) continue; // template expressions
          if (local.has(raw)) continue;
          if (!LOOKS_LIKE_UTILITY.test(raw)) continue;

          // Variants are separate selectors in the output, so the whole
          // candidate is what has to be declared, prefix included.
          if (declared.has(raw)) continue;

          const rel = path.relative(ROOT, file);
          if (!unknown.has(raw)) unknown.set(raw, new Set());
          unknown.get(raw).add(rel);
        }
      }
    }
  }

  if (unknown.size) {
    console.log("");
    for (const [cls, files] of [...unknown].sort()) {
      console.log(`  ${cls}`);
      console.log(`      ${[...files].join(", ")}`);
    }
    console.log(
      `\n${unknown.size} class name(s) generate no CSS.` +
        `\nEither the config key does not exist, or it is a typo.`
    );
    process.exitCode = 1;
    return;
  }

  console.log("every utility class in the templates resolves to a rule");
}

main();
