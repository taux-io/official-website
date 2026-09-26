// A MACRO MAY NOT TAKE A CLASS OR AN HREF AS AN ARGUMENT.
//
// Every rule that reads class attributes — radius, weight ladder, zero mono,
// states differ, density, two plates, accent carries interaction, sentence case
// — and `check:classes` read template source, and a value that arrives as a
// macro argument is not in the attribute the rule reads: `class="{{ cls }}"`
// is a placeholder, and whatever the caller passes is somewhere else, in a
// string. The 2026-09 evaluation measured it: `cls="rounded-[7px] uppercase
// font-mono"` passed to a cover macro was green on every one of those rules.
// Hrefs the same way, for `locale relative links`.
//
// So a macro spells its classes and hrefs out and takes content, not markup:
// text, a heading, an id, a number. Zero macros exist today, so this is the
// guard that has to be in place before the first one is written — the
// prerequisite NOTES 「模板結構大改」 names for part A.
//
// `locale` is not a macro parameter anywhere and is allowed inside an href: it
// is the render's own variable, and `locale relative links` requires it.
const { lineOf } = require("../lib");

const MACRO = /\{%-?\s*macro\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)\s*-?%\}([\s\S]*?)\{%-?\s*endmacro\s*-?%\}/g;
const ATTR = /\b(class|href)\s*=\s*"([^"]*)"/g;

function ruleNoParameterisedMarkup(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(MACRO)) {
      const [, name, params, body] = m;
      const names = params
        .split(",")
        .map((p) => p.split("=")[0].trim())
        .filter(Boolean);
      const bodyStart = m.index + m[0].indexOf(body);
      for (const a of body.matchAll(ATTR)) {
        const used = names.filter((n) => new RegExp(`\\{\\{[^}]*\\b${n}\\b`).test(a[2]));
        if (!used.length) continue;
        found.push({
          file: rel,
          line: lineOf(html, bodyStart + a.index),
          detail:
            `macro ${name}() puts its argument ${used.join(", ")} into ${a[1]}="…" — ` +
            `the rules that read ${a[1]} attributes cannot see what a caller passes`,
        });
      }
    }
  }
  return found;
}

module.exports = ruleNoParameterisedMarkup;
