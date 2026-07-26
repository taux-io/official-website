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

// Variants sit in front of the utility they modify — `hover:`, `md:`,
// `group-open:`, `[&>svg]:` — and stack. They have to come off before the base
// is recognised, because the first version of this tested the whole candidate
// against the list below and no variant name is in it: every hover-, focus- and
// breakpoint-prefixed invalid class was silently skipped. `group-hover:` was
// the sole exception, and only by accident, since `group-` happens to match.
const VARIANT_PREFIX = /^(?:[a-z0-9-]+|\[[^\]]*\]):/;

function stripVariants(candidate) {
  let base = candidate;
  while (VARIANT_PREFIX.test(base)) base = base.replace(VARIANT_PREFIX, "");
  return base;
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

// Class names appearing in selector position within some CSS text.
//
// Only selector text is scanned — what precedes the innermost brace of each
// rule — so decimal points inside declarations are never mistaken for class
// names. Reading the whole file instead reports that `mb-4` generates no CSS,
// because of the `.75rem` in `margin:.75rem`.
//
// Escapes are stripped so the generated `.md\:h-20` matches the candidate
// `md:h-20`, and `.h-\[140\%\]` matches `h-[140%]`.
function selectorClasses(css) {
  const found = new Set();
  for (const chunk of css.split("}")) {
    const parts = chunk.split("{");
    if (parts.length < 2) continue;
    // The innermost brace, so a rule nested inside an at-rule prelude is read
    // rather than the prelude itself.
    for (const m of parts[parts.length - 2].matchAll(/\.((?:\\.|[a-zA-Z0-9_-])+)/g)) {
      found.add(m[1].replace(/\\/g, ""));
    }
  }
  return found;
}

// What the built stylesheet declares.
const declaredClasses = (css) => selectorClasses(css);

// What a template declares in its own <style> blocks. Reading them beats
// maintaining a list of prefixes by hand — the list goes stale, and each stale
// entry is a false report that trains people to ignore this check.
//
// The recognition list below is the opposite trade: it is hand-maintained, and
// its staleness mode is a silent miss rather than a false report. That is the
// safer direction for a list that decides what to *examine*, but it does mean
// an unrecognised utility prefix is skipped rather than flagged.
function localClasses(html) {
  const found = new Set();
  for (const block of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const c of selectorClasses(block[1])) found.add(c);
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
          // Recognise the base, but look up the whole candidate: Tailwind emits
          // a separate selector per variant combination, prefix included.
          if (!LOOKS_LIKE_UTILITY.test(stripVariants(raw))) continue;
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
