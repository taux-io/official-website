const stylesheet = require("../../stylesheet");

// RULE 31 — declared surfaces.
//
// Three places where NOT declaring a colour is itself a colour decision, made
// by the browser instead of by this vocabulary. Rule 25 scans the colours the
// stylesheet contains; it cannot see the ones that should be there and are not,
// so this is the only rule in the file that checks for absence.
//
// WHY ONLY THREE, WHEN THE CHAPTER NAMES FIVE. Two of the five — the
// forced-colors block and the print stylesheet — are deliberately NOT here.
// Presence is not their fix: an empty `@media print {}` would satisfy a
// presence check while printing exactly as badly as no block at all. That is
// rule 28's defect (decision #112), and writing it twice on purpose would be
// worse than writing it once by accident. Those two are implemented and
// verified by hand, and recorded in DESIGN.md as ungated.
//
// `accent-color` is absent for a different reason: it styles checkboxes, radios
// and ranges, and this site has zero of all three. A rule guarding a property
// with no possible subject guards nothing.
const DECLARED_SURFACES = [
  {
    prop: "color-scheme",
    where: ":root",
    why: "without it a dark-themed OS renders the UA's own widgets dark — nine <select>, three <input>, the scrollbar and the initial canvas — against paper",
  },
  {
    prop: "background",
    where: "::selection",
    why: "an undeclared selection highlight is the OS blue, which is a third plate appearing on every drag across the text",
  },
  {
    prop: "caret-color",
    where: "input",
    why: "an undeclared caret is the OS accent, and this site has three text inputs to show it in",
  },
];

function ruleDeclaredSurfaces() {
  const sheet = stylesheet.read();
  const found = [];
  for (const want of DECLARED_SURFACES) {
    const hit = sheet.declarations.some(
      (d) => d.prop === want.prop && d.selector.includes(want.where)
    );
    if (hit) continue;
    found.push({
      file: stylesheet.INPUT_CSS,
      line: 1,
      detail: `${want.where} declares no ${want.prop} — ${want.why}`,
    });
  }
  return found;
}

module.exports = ruleDeclaredSurfaces;
