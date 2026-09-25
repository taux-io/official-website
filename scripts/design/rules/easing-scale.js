const stylesheet = require("../../stylesheet");

// Properties whose value carries a timing function.
const TIMED_PROPS = new Set([
  "transition", "transition-timing-function", "animation", "animation-timing-function",
]);
// The named curves. `steps()` and `cubic-bezier()` are handled separately.
const KEYWORD_EASINGS = new Set([
  "ease", "ease-in", "ease-out", "ease-in-out", "linear", "step-start", "step-end",
]);

// Two easings, and they are declared as tokens. A third curve written inline is
// how a scale stops being a scale.
function ruleEasingScale() {
  const sheet = stylesheet.read();
  const declared = new Set();
  for (const [name, value] of sheet.tokens) {
    if (!name.startsWith("--ease-")) continue;
    declared.add(value.replace(/\s+/g, ""));
  }
  if (!declared.size) {
    return [{ file: stylesheet.INPUT_CSS, line: 0, detail: "no --ease-* tokens declared; this rule has gone blind" }];
  }

  const found = [];
  for (const d of sheet.declarations) {
    if (!TIMED_PROPS.has(d.prop)) continue;
    for (const m of d.value.matchAll(/cubic-bezier\([^)]*\)/g)) {
      if (declared.has(m[0].replace(/\s+/g, ""))) continue;
      found.push({
        file: d.file,
        line: d.line,
        detail: `${d.prop}: ${d.raw} — ${m[0]} is not one of the declared easings (${[...declared].join(", ")})`,
      });
    }
    // KEYWORD EASINGS COUNT. `ease` is a curve like any other — it is
    // cubic-bezier(.25,.1,.25,1) wearing a name — and an earlier version of this
    // rule matched only the parenthesised form, so a second easing sat in a
    // template's own <style> block for as long as nothing read that block.
    for (const kw of d.value.split(/[\s,]+/)) {
      if (!KEYWORD_EASINGS.has(kw)) continue;
      found.push({
        file: d.file,
        line: d.line,
        detail: `${d.prop}: ${d.raw} — \`${kw}\` is a second easing; this vocabulary has one, and it is a token`,
      });
    }
  }
  return found;
}

module.exports = ruleEasingScale;
