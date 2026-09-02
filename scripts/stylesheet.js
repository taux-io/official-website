// Every CSS declaration this site ships, from wherever the author wrote it.
//
//   const { read } = require("./stylesheet");
//   const sheet = read();
//   sheet.declarations.filter((d) => d.prop === "box-shadow");
//   sheet.token("ink-rgb");
//
// THE PROBLEM THIS EXISTS FOR IS NOT DUPLICATION. Four rules in check-design.js
// each opened src/input.css and regexed over it, which was untidy but harmless.
// What was not harmless is that all four were reading ONE of the three places
// this site's CSS actually lives. templates/claude-skills-guide.html carries an
// 809-line <style> block — 119 rules, 406 declarations, a second stylesheet in
// all but name — and nothing read it. Two defects hid there through an entire
// brand reset and were found by a person, not a gate:
//
//   · two `box-shadow` declarations survived the removal of shadows, because
//     the `shadow scale` rule only ever looked at input.css;
//   · two `font-family: monospace` declarations kept DESIGN.md decision #40's
//     MingLiU trap open on the route with the most code content, after the
//     `zero mono` rule reported the monospace vocabulary gone.
//
// A rule cannot be wrong about CSS it never sees. This module is the single
// answer to "what CSS does this site ship", so that being blind is a property of
// one module rather than of every rule.
//
// SCOPE IS THE AUTHORED CSS, NOT THE BUILT STYLESHEET. static/css/styles.min.css
// answers a different question — "did Tailwind actually emit something for what
// was written" — and check-unknown-classes.js is already the module for that
// question. One module, one question; merging them is how a deep module becomes
// a shallow one with a mode flag.

const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

const ROOT = path.join(__dirname, "..");
const INPUT_CSS = path.join("src", "input.css");
const TEMPLATES = path.join(ROOT, "templates");

// ---------------------------------------------------------------------------

// var() is resolved, and the text the author wrote is kept beside the result.
//
// Both halves earn their place. Without resolution the first run reports 18
// violations of `radius on controls only` for `border-radius: var(--radius)` —
// every one of them square, because --radius is 0px. This file's governing
// document opens by arguing that a checker whose first run is a pile of false
// positives teaches everyone to skip it.
//
// Without the raw text the message reads "border-radius: 0px is a violation" and
// the author greps the file for 0px and finds nothing.
//
// ONE LEVEL, NOT RECURSIVE. A token defined in terms of another token is a
// composition this site does not have, and a resolver that follows chains needs
// a cycle guard, which is machinery bought for a case that does not exist.
function resolveValue(value, tokens) {
  return value.replace(/var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,([^)]*))?\)/g, (whole, name, fallback) => {
    const declared = tokens.get(name);
    if (declared !== undefined && !declared.includes("var(")) return declared;
    if (fallback !== undefined) return fallback.trim();
    return whole;
  });
}

// CONDITIONAL DECLARATIONS DO NOT DEFINE A TOKEN.
//
// An earlier version took the last --line-rgb it walked past, and the last one
// in input.css is inside `@media (prefers-contrast: more)`. So token("line-rgb")
// answered 122 122 132 — the lifted value — and build-og.js drew the rule on
// nineteen share cards in a hairline the site never uses. Nothing went red:
// the cards are the one asset seen away from the site and never noticed to be
// wrong in a browser, which is the failure mode build-og's own comment warns
// about.
//
// @layer is not a condition and stays. @media, @supports and @container are.
const CONDITIONAL_AT_RULES = new Set(["media", "supports", "container"]);

function isConditional(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "atrule" && CONDITIONAL_AT_RULES.has(p.name)) return true;
  }
  return false;
}

function collectTokens(roots) {
  const tokens = new Map();
  for (const { root } of roots) {
    root.walkDecls((decl) => {
      if (!decl.prop.startsWith("--")) return;
      if (isConditional(decl)) return;
      tokens.set(decl.prop, decl.value.trim());
    });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// The three places CSS is written.

function readInputCss() {
  const abs = path.join(ROOT, INPUT_CSS);
  if (!fs.existsSync(abs)) return null;
  return { file: INPUT_CSS, css: fs.readFileSync(abs, "utf8"), lineOffset: 0, origin: "stylesheet" };
}

// A <style> block in a template. Line numbers are offset by where the block
// starts, so a finding points at the line in the TEMPLATE — the file the author
// would open — rather than at line 7 of a fragment that exists nowhere.
function readTemplateStyles() {
  const out = [];
  if (!fs.existsSync(TEMPLATES)) return out;
  for (const name of fs.readdirSync(TEMPLATES).sort()) {
    if (!name.endsWith(".html")) continue;
    const rel = path.join("templates", name);
    const html = fs.readFileSync(path.join(TEMPLATES, name), "utf8");
    for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
      const before = html.slice(0, m.index + m[0].indexOf(m[1]));
      out.push({
        file: rel,
        css: m[1],
        lineOffset: before.split("\n").length - 1,
        origin: "template-style",
      });
    }
  }
  return out;
}

// style="" attributes. Fifteen of them, twelve of which are SVG gradient stops.
//
// NO CATEGORY IS EXCLUDED, and that is deliberate. "SVG paint is not really CSS"
// is a defensible sentence that establishes a precedent for the next exclusion,
// and the whole argument for this module is that the excluded thing is where the
// defect hides. Fifteen declarations cost nothing to carry.
function readStyleAttributes() {
  const out = [];
  if (!fs.existsSync(TEMPLATES)) return out;
  for (const name of fs.readdirSync(TEMPLATES).sort()) {
    if (!name.endsWith(".html")) continue;
    const rel = path.join("templates", name);
    const html = fs.readFileSync(path.join(TEMPLATES, name), "utf8");
    for (const m of html.matchAll(/\sstyle="([^"]*)"/g)) {
      if (!m[1].trim()) continue;
      out.push({
        file: rel,
        // Wrapped so postcss has a rule to hang the declarations on. The
        // selector is reported as null downstream; an inline attribute has none.
        css: `[style]{${m[1]}}`,
        lineOffset: html.slice(0, m.index).split("\n").length - 1,
        origin: "style-attribute",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

function read() {
  const sources = [readInputCss(), ...readTemplateStyles(), ...readStyleAttributes()].filter(Boolean);

  const roots = [];
  for (const src of sources) {
    let root;
    try {
      root = postcss.parse(src.css, { from: src.file });
    } catch (err) {
      // A source that will not parse is reported as a finding rather than
      // thrown: one malformed block must not take every rule down with it.
      roots.push({ ...src, root: null, error: err.message });
      continue;
    }
    roots.push({ ...src, root });
  }

  const tokens = collectTokens(roots.filter((r) => r.root));
  const rules = [];
  const declarations = [];
  const applied = [];
  const errors = [];

  // Source order is preserved across files and exposed as `index`. Rules that
  // care about ordering — `press follows hover` compares which of two blocks the
  // cascade sees last — must compare this rather than `line`, because line
  // numbers only order within one file.
  let index = 0;

  for (const src of roots) {
    if (!src.root) {
      errors.push({ file: src.file, line: 0, detail: `will not parse: ${src.error}` });
      continue;
    }
    // Declarations that hang directly off an at-rule — @font-face is the one
    // this site has — belong to no selector and were missed by an earlier
    // version of this walk. "Every declaration" cannot carry an exception: the
    // 24 declarations inside input.css's @font-face blocks are exactly where a
    // font-family reaching a generic family would be written.
    src.root.walkAtRules((at) => {
      const owns = at.nodes?.some((n) => n.type === "decl");
      if (!owns) return;
      const line = (at.source?.start?.line ?? 1) + src.lineOffset;
      const rule = {
        index: index++,
        selector: `@${at.name} ${at.params}`.trim(),
        selectors: [],
        file: src.file,
        line,
        origin: src.origin,
        atRule: at.name,
        declarations: [],
        applied: [],
      };
      for (const decl of at.nodes) {
        if (decl.type !== "decl") continue;
        const d = {
          selector: rule.selector,
          prop: decl.prop,
          raw: decl.value,
          value: resolveValue(decl.value, tokens),
          file: src.file,
          line: (decl.source?.start?.line ?? line) + src.lineOffset,
          origin: src.origin,
          atRule: at.name,
        };
        rule.declarations.push(d);
        declarations.push(d);
      }
      rules.push(rule);
    });

    src.root.walkRules((node) => {
      const line = (node.source?.start?.line ?? 1) + src.lineOffset;
      const inline = src.origin === "style-attribute";
      const rule = {
        index: index++,
        selector: inline ? null : node.selector,
        selectors: inline ? [] : node.selector.split(",").map((s) => s.trim()).filter(Boolean),
        file: src.file,
        line,
        origin: src.origin,
        declarations: [],
        applied: [],
      };
      node.walkDecls((decl) => {
        const d = {
          selector: rule.selector,
          prop: decl.prop,
          raw: decl.value,
          value: resolveValue(decl.value, tokens),
          file: src.file,
          line: (decl.source?.start?.line ?? line) + src.lineOffset,
          origin: src.origin,
        };
        rule.declarations.push(d);
        declarations.push(d);
      });
      // @apply is an at-rule, not a declaration, and it stays its own field.
      //
      // Normalising `@apply uppercase` into `text-transform: uppercase` would
      // let a rule ask one question instead of two, and would cost this module a
      // built-in copy of Tailwind's utility-to-property table — hundreds of
      // entries that drift with the Tailwind version and that nothing checks.
      // Two questions is the cheaper half of that trade.
      node.walkAtRules("apply", (at) => {
        for (const utility of at.params.split(/\s+/).filter(Boolean)) {
          const a = {
            selector: rule.selector,
            utility,
            file: src.file,
            line: (at.source?.start?.line ?? line) + src.lineOffset,
            origin: src.origin,
          };
          rule.applied.push(a);
          applied.push(a);
        }
      });
      rules.push(rule);
    });
  }

  return {
    rules,
    declarations,
    applied,
    errors,
    sources: sources.map((s) => s.file),
    tokens,
    // The resolved value of a custom property, without the leading dashes —
    // `token("ink-rgb")`. Null rather than a throw: the caller decides whether a
    // missing token is fatal, and build-og.js decides that it is.
    token(name) {
      const key = name.startsWith("--") ? name : `--${name}`;
      const raw = tokens.get(key);
      return raw === undefined ? null : resolveValue(raw, tokens);
    },
    // Every rule whose selector list contains this exact selector.
    rulesFor(selector) {
      return rules.filter((r) => r.selectors.includes(selector));
    },
  };
}

// MEMOISED BECAUSE IT TAKES NO ARGUMENTS AND NOTHING MUTATES BETWEEN CALLERS.
//
// Each call re-reads src/input.css, walks templates/ twice and hands sixteen
// sources to postcss — 15.8ms cold, 3.4ms warm. check-design.js reached ten
// calls as the colour rules landed, one per rule that needed CSS, and every one
// of them parsed the same bytes into the same tree. The gate is a single
// short-lived process; a file changing mid-run would mean the run was already
// reading two different versions of the site.
let cached = null;

function readOnce() {
  if (!cached) cached = read();
  return cached;
}

module.exports = { read: readOnce, INPUT_CSS };
