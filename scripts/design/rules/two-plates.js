const stylesheet = require("../../stylesheet");
const plates = require("../../plates");
const { colourBearing, colourUtilities } = require("../lib");

// RULE 25 — two plates.
//
// DESIGN.md v5 counts two printing plates and one paper. Every colour this site
// ships has to be one of them, at some coverage; a colour that no single plate
// explains is a third ink, and the whole model rests on there not being one.
//
// TWO ROADS IN, AND ONLY ONE OF THEM IS CSS. A declaration can name a colour
// outright, and stylesheet.read() sees those. A template class can name one
// too: tailwind.config.js declares this site's palette under `extend`, extend
// adds rather than replaces, and `bg-red-500` therefore compiles — verified by
// building it, not assumed. That road never becomes author CSS, so the
// declaration half alone would have left the wider door open.
//
// WHAT THIS RULE CANNOT SEE, said plainly because the neighbouring rules are
// what cover it: it does not notice that a colour was hand-written. The literal
// `rgba(25,25,24,0.06)` this site carried for three brand resets solves cleanly
// to ink at 6.6% and passes here. Rule 1 catches the syntax and rule 32 catches
// the coverage. Three rules, three different failures, none of them redundant.
function ruleTwoPlates(files) {
  const sheet = stylesheet.read();
  const found = [];

  for (const { d, value } of colourBearing(sheet.declarations)) {
    for (const step of plates.stepsIn(value, sheet)) {
      if (step.plate !== null) continue;
      found.push({
        file: d.file,
        line: d.line,
        detail: `${d.selector} paints ${step.text} — no coverage of the ink or the accent over this paper produces it, so it is a third plate`,
      });
    }
  }

  for (const u of colourUtilities(files, sheet)) {
    if (!plates.foreignColourUtility(u.name)) continue;
    found.push({
      file: u.file,
      line: u.line(),
      detail: `${u.name} reaches Tailwind's own palette — this vocabulary has two plates and that is not one of them`,
    });
  }
  return found;
}

module.exports = ruleTwoPlates;
