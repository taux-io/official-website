const stylesheet = require("../../stylesheet");
const plates = require("../../plates");
const { colourBearing, colourUtilities } = require("../lib");

// RULE 32 — density scale.
//
// DESIGN.md v5 says a lighter colour is the same plate laid down thinner, not a
// new ink. That makes coverage a scale, and this site already polices two other
// scales the same way: `tracking scale` and `radius scale` each hold a closed
// Set and reject anything outside it. This is the third of that shape.

function ruleDensityScale(files) {
  const sheet = stylesheet.read();
  const found = [];
  const ladder = [...plates.DENSITY_SCALE].join(", ");

  for (const { d, value } of colourBearing(sheet.declarations)) {
    for (const step of plates.stepsIn(value, sheet)) {
      if (step.plate === null) continue;
      if (plates.onScale(step.coverage) !== null) continue;
      found.push({
        file: d.file,
        line: d.line,
        detail: `${d.selector} lays ${step.plate} at ${(step.coverage * 100).toFixed(1)}% — not a step on the scale (${ladder})`,
      });
    }
  }

  for (const u of colourUtilities(files, sheet)) {
    const hit = plates.plateUtility(u.name);
    if (!hit || hit.coverage === null) continue;
    if (plates.onScale(hit.coverage) !== null) continue;
    found.push({
      file: u.file,
      line: u.line(),
      detail: `${u.name} lays ${hit.plate} at ${(hit.coverage * 100).toFixed(0)}% — not a step on the scale (${ladder})`,
    });
  }
  return found;
}

module.exports = ruleDensityScale;
