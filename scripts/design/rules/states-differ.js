const stylesheet = require("../../stylesheet");
const { lineOf, parseElements, STATE_SELECTOR } = require("../lib");

// A state that declares feedback and produces none.
//
// Collapsing three ink steps and three surfaces to one value each (DESIGN.md
// decision #53) turned six classes of state declaration into no-ops at once —
// four component hovers, the section rail's [aria-current], sixteen table rows
// and thirty-seven template utilities. Every gate stayed green. check:classes
// asks whether a class resolves to a real rule; `press follows hover` asks
// whether :active is written after :hover. NEITHER ASKS WHETHER THE TWO STATES
// DIFFER, and that is the question.
//
// PER DECLARATION, NOT PER RULE. The defect that started this had two
// declarations of which one was dead; the survivor made the whole state look
// alive. A rule that only fired when everything in it was dead would have
// reported that one as healthy.
//
// SOURCE LEVEL ONLY. The third sub-class — a state whose value equals what the
// element already computes from an ancestor — needs the rendered page, and
// :hover cannot be forced from page script. It is left to a person and named in
// DESIGN.md's list of things nothing checks, because a state that is
// deliberately identical at one breakpoint would false-positive, and a gate that
// cries wolf is the argument that document opens with.
const STATE_VARIANT = /^(hover|focus|focus-visible|active|group-hover):(.+)$/;

function ruleStatesDiffer(files) {
  const found = [];
  const sheet = stylesheet.read();

  // 1a — a state rule whose declaration matches the base rule it overrides.
  const baseBySelector = new Map();
  for (const rule of sheet.rules) {
    for (const sel of rule.selectors) {
      if (STATE_SELECTOR.test(sel)) continue;
      if (!baseBySelector.has(sel)) baseBySelector.set(sel, rule);
    }
  }
  for (const rule of sheet.rules) {
    for (const sel of rule.selectors) {
      if (!STATE_SELECTOR.test(sel)) continue;
      const base = baseBySelector.get(sel.replace(STATE_SELECTOR, "").replace(/::[a-z-]+$/, "").trim());
      if (!base) continue;
      for (const d of rule.declarations) {
        const twin = base.declarations.find(
          (b) => b.prop === d.prop && b.value.trim() === d.value.trim()
        );
        if (!twin) continue;
        found.push({
          file: d.file,
          line: d.line,
          detail: `${sel} sets ${d.prop} to what ${base.selector} already sets it to — the state declares feedback and produces none`,
        });
      }
      for (const a of rule.applied) {
        if (!base.applied.some((b) => b.utility === a.utility)) continue;
        found.push({
          file: a.file,
          line: a.line,
          detail: `${sel} applies ${a.utility}, which ${base.selector} already applies — the state declares feedback and produces none`,
        });
      }
    }
  }

  // 1b — the same utility written plain and under a state variant on one
  // element. `class="text-ink hover:text-ink"` is the shape thirty-seven
  // elements carried after the ink collapsed to a single value.
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      const plain = new Set(node.classes.filter((c) => !STATE_VARIANT.test(c)));
      for (const c of node.classes) {
        const m = STATE_VARIANT.exec(c);
        if (!m || !plain.has(m[2])) continue;
        found.push({
          file: rel,
          line: lineOf(html, node.index),
          detail: `${c} alongside ${m[2]} — the state resolves to the value it is overriding`,
        });
      }
    }
  }
  return found;
}

module.exports = ruleStatesDiffer;
