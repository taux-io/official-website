const path = require("path");
const stylesheet = require("../../stylesheet");
const { ROOT } = require("../lib");

// RULE 35 — hover is guarded.
//
// On a touch screen there is no hover, but :hover still fires: it latches on
// the tap and holds until the next tap lands somewhere else, so a row or a link
// sits in its hover state looking selected. better-accessibility's fix is a
// media query, and this vocabulary had zero of them — every :hover on the site
// applied to every finger.
//
// Two roads, one query. tailwind.config.js sets `hoverOnlyWhenSupported`, which
// compiles every `hover:` utility under `@media (hover: hover) and (pointer:
// fine)`; this rule holds the authored CSS to the same idea. It reads the
// ancestors stylesheet.js now records for every rule, so a :hover written in a
// template's own <style> block is held to it as well.
function ruleHoverIsGuarded() {
  const sheet = stylesheet.read();
  const found = [];
  // The utility half. 63 `hover:` and `group-hover:` classes in the templates are guarded by one
  // config flag, and a flag is one edit from being "simplified" away — after
  // which every one of them latches on touch again while this rule, reading
  // only authored CSS, stays green. So the flag is asserted here too.
  const config = path.join(ROOT, "tailwind.config.js");
  let flag = false;
  try {
    flag = require(config)?.future?.hoverOnlyWhenSupported === true;
  } catch (err) {
    found.push({ file: "tailwind.config.js", line: 1, detail: `not readable: ${err.message}` });
  }
  if (!flag) {
    found.push({
      file: "tailwind.config.js",
      line: 1,
      detail: "future.hoverOnlyWhenSupported is not true — every `hover:` utility compiles unguarded and latches on touch",
    });
  }
  for (const rule of sheet.rules) {
    if (!rule.selectors.some((s) => /:hover\b/.test(s))) continue;
    if ((rule.conditions || []).some((c) => /\(\s*hover:\s*hover\s*\)/.test(c))) continue;
    found.push({
      file: rule.file,
      line: rule.line,
      detail: `${rule.selector} answers :hover outside @media (hover: hover) — on touch the state latches after a tap and reads as stuck`,
    });
  }
  return found;
}

module.exports = ruleHoverIsGuarded;
