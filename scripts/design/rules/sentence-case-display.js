const stylesheet = require("../../stylesheet");
const { lineOf, parseElements } = require("../lib");

// Chinese has no upper case. The display signature is therefore carried by the
// Latin lead line alone, and applying the same transform to the Chinese sub
// would be a no-op that reads as though the rule were satisfied.
//
// The transform belongs to the component classes rather than to utilities on the
// elements, so this reads the stylesheet for both halves and then checks that no
// template argues with it.
function ruleSentenceCaseDisplay(files) {
  const found = [];
  const sheet = stylesheet.read();

  // REVERSED, NOT DELETED. The previous vocabulary set the Latin lead in all
  // caps and this rule enforced it; this one never shouts. The rule stays so
  // that the transform coming back is a red gate rather than a quiet drift, and
  // it is asked of both fields because the transform can be written either way.
  const rendersUpper = (selector) => {
    const rules = sheet.rulesFor(selector);
    if (!rules.length) return null;
    for (const r of rules) {
      if (r.applied.some((a) => a.utility === "uppercase")) return { yes: true, rule: r };
      if (r.declarations.some((d) => d.prop === "text-transform" && d.value.trim() === "uppercase")) {
        return { yes: true, rule: r };
      }
    }
    return { yes: false, rule: rules[0] };
  };

  for (const selector of [".display-lead", ".display-sub"]) {
    const hit = rendersUpper(selector);
    if (!hit) {
      found.push({ file: stylesheet.INPUT_CSS, line: 0, detail: `${selector} is not defined` });
      continue;
    }
    if (!hit.yes) continue;
    found.push({
      file: hit.rule.file,
      line: hit.rule.line,
      detail: `${selector} renders upper case — this vocabulary is sentence case and never shouts`,
    });
  }

  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      if (!node.classes.some((c) => c === "display-lead" || c === "display-sub")) continue;
      const bad = node.classes.find((c) => /^(?:[a-z]+:)*uppercase$/.test(c));
      if (!bad) continue;
      found.push({
        file: rel,
        line: lineOf(html, node.index),
        detail: `display line carries ${bad}; this vocabulary is sentence case`,
      });
    }
  }
  return found;
}

module.exports = ruleSentenceCaseDisplay;
