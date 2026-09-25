const stylesheet = require("../../stylesheet");

const PRESS_EXEMPT = new Set(["::-webkit-scrollbar-thumb"]);

function rulePressFollowsHover() {
  const sheet = stylesheet.read();

  // Ordering is by source index, not line number. Line numbers only order
  // within one file, and the cascade now spans input.css and every template's
  // own <style> block.
  const hover = new Map();
  const active = new Map();
  for (const rule of sheet.rules) {
    for (const sel of rule.selectors) {
      const base = sel.replace(/:(hover|active)\b.*$/, "");
      if (PRESS_EXEMPT.has(base)) continue;
      if (/:hover\b/.test(sel) && !hover.has(base)) hover.set(base, rule);
      if (/:active\b/.test(sel) && !active.has(base)) active.set(base, rule);
    }
  }

  const found = [];
  for (const [base, hoverRule] of hover) {
    const activeRule = active.get(base);
    if (activeRule === undefined) {
      found.push({
        file: hoverRule.file,
        line: hoverRule.line,
        detail: `${base} answers :hover but not :active — a touch device never fires hover, so it would have no press feedback at all`,
      });
      continue;
    }
    if (activeRule.index < hoverRule.index) {
      found.push({
        file: activeRule.file,
        line: activeRule.line,
        detail: `${base}:active is written before :hover (${hoverRule.file}:${hoverRule.line}); equal specificity means hover wins and the press does nothing with a mouse`,
      });
    }
  }
  return found;
}

module.exports = rulePressFollowsHover;
