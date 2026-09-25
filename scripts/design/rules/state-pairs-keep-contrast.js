const stylesheet = require("../../stylesheet");
const plates = require("../../plates");
const { STATE_SELECTOR, contrastRatio, hexOf } = require("../lib");

// RULE 34 — state pairs keep contrast.
//
// `contrast` walks every route and measures every text element — at rest.
// Nothing measured what a pointer does to a control, and the primary call to
// action on every page lost its label the moment it was hovered: `.btn:hover`
// painted a 12% ink wash under text that stayed `--on-primary`, the paper.
// #FAFAF7 on #E2E2E0 is 1.24:1. It was on the density ladder, it was on a plate,
// it was in the built stylesheet, and it was green in every gate this repo has,
// because every gate that reads colour reads membership and the one that reads
// pairs reads them with nothing pressed.
//
// This reads the pair a state rule produces: the ground it sets, under the
// label it sets or inherits from its own base rule. Both are composited over
// the paper first (plates.rendered), so a `/ 0.12` and a token that names the
// same colour measure the same. A state whose base rule declares no colour is
// skipped rather than guessed — the label's colour then comes from outside the
// component and is `contrast`'s to measure at rest.
//
// 4.5 for everything. Buttons here are 17px at 600, under WCAG's large-text
// line, and a 3:1 allowance for the one large case would be a second threshold
// nothing needs yet.
//
// WENT RED BEFORE IT WENT GREEN: run against the stylesheet as it stood, it
// reported `.btn:hover` at 1.24 and `.btn:active` at 1.45 — the two values it
// was written to find — and reported nothing else. Then the values changed.
const STATE_PAIR = /:(hover|active|focus-visible)\b/;
const TEXT_CONTRAST_MIN = 4.5;

function ruleStatePairsKeepContrast() {
  const sheet = stylesheet.read();
  const baseBySelector = new Map();
  for (const rule of sheet.rules) {
    for (const sel of rule.selectors) {
      if (STATE_SELECTOR.test(sel)) continue;
      if (!baseBySelector.has(sel)) baseBySelector.set(sel, rule);
    }
  }

  const found = [];
  for (const rule of sheet.rules) {
    for (const sel of rule.selectors) {
      if (!STATE_PAIR.test(sel)) continue;
      // A pseudo-element paints its own box, not the label.
      if (sel.includes("::")) continue;
      const ground = rule.declarations.find((d) => d.prop === "background-color" || d.prop === "background");
      if (!ground) continue;
      const base = baseBySelector.get(sel.replace(STATE_PAIR, "").trim());
      const label =
        rule.declarations.find((d) => d.prop === "color") ||
        base?.declarations.find((d) => d.prop === "color");
      if (!label) continue;
      const bg = plates.rendered(ground.value, sheet);
      if (!bg) continue;
      const fg = plates.rendered(label.value, sheet, bg);
      if (!fg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio >= TEXT_CONTRAST_MIN) continue;
      found.push({
        file: ground.file,
        line: ground.line,
        detail:
          `${sel} paints its label ${hexOf(fg)} on ${hexOf(bg)} — ${ratio.toFixed(2)}:1, under ${TEXT_CONTRAST_MIN}; ` +
          `the state a pointer produces is where the text has to stay readable`,
      });
    }
  }
  return found;
}

module.exports = ruleStatePairsKeepContrast;
