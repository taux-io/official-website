const { lineOf, maskNonColourHashes } = require("../lib");

// WHAT THIS RULE'S OWN SUMMARY USED TO OVERCLAIM.
//
// It said "colour values belong to the tokens in src/input.css, not the
// templates" and then matched `#rrggbb` and nothing else. `rgb()`, `rgba()`,
// `hsl()` and `hsla()` walked straight past it, and 25 of them were doing so:
// ten `rgba(25,25,24,0.06)`, five `rgba(25,25,24,0.08)`, five
// `rgba(255,255,255,0.04)` and five `rgba(255,255,255,0.08)`, spread over the
// five locale copies of claude-skills-guide.html.
//
// 25,25,24 is #191918 — not this site's ink under any of the three brand
// resets, so those tints were a fourth palette nobody declared. The white ones
// were worse than wrong: on paper `rgba(255,255,255,0.04)` composites to
// #FAFAF7, which is the substrate exactly. Ten declarations painting paper onto
// paper, making an object that is not there — the same defect rule 23 catches
// in `bg-surface`, except rule 23 reads classes and these were a `<style>` block
// and an inline `style=""`.
//
// A LITERAL IS A NUMBER, NOT A FUNCTION. `rgb(var(--ink-rgb) / 0.35)` is the
// sanctioned route to a density step and must stay green, so the test is what
// follows the opening paren: a digit means someone typed a colour, `var(` means
// they reached for a plate.
//
// STILL UNCOVERED, AND NAMED HERE RATHER THAN IMPLIED: `oklch()`, `lab()`,
// `color()` and the named colours (`white`, `red`). Measured today: zero of
// each. They are left out because nothing here uses them and a rule should not
// grow branches for cases that do not exist — but a summary that promised "no
// literal colours" would be making this rule's original mistake a second time,
// so the summary names the four families it actually reads.
const LITERAL_COLOUR = /\b(?:rgba?|hsla?)\(\s*[0-9.][^)]*\)/g;

function ruleNoLiteralColour(files) {
  const found = [];
  for (const { rel, html } of files) {
    const masked = maskNonColourHashes(html);
    for (const m of masked.matchAll(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) {
      found.push({ file: rel, line: lineOf(masked, m.index), detail: m[0] });
    }
    for (const m of masked.matchAll(LITERAL_COLOUR)) {
      found.push({ file: rel, line: lineOf(masked, m.index), detail: m[0] });
    }
  }
  return found;
}

module.exports = ruleNoLiteralColour;
