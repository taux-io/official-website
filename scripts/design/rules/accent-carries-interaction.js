const stylesheet = require("../../stylesheet");
const plates = require("../../plates");
const { colourBearing, colourUtilities, isInteractiveNode } = require("../lib");

// RULE 26 — accent carries interaction.
//
// DESIGN.md has said since v4 that the accent plate is not decoration: it is
// the only mark an interactive element gets, and a blue thing that cannot be
// clicked spends that mark on nothing. It said it in prose for two brand
// resets, which is the same as not saying it.
//
// INTERACTIVE IS A POSITION, NOT A LIST. An element qualifies by being a link,
// a button, one of the form controls, or by carrying a component class that
// makes it one — and an element inside one of those inherits the standing,
// because a `<span class="text-primary">` in a button is part of the button's
// mark, not a second use of the plate. That is the shape rule 23 uses for the
// surface: a legal case is described by where it sits, so no exemption list is
// needed and none is kept.
// TWO NAMED WAYFINDING MARKS (DESIGN.md decision 156, the owner's call). The
// accent also marks where the reader is: a section cover's number, and the
// line icon beside each service category on the home page. Both are small,
// neither is text a reader could mistake for a link — the number is a label
// above a heading, the icon is aria-hidden — and both are named here rather
// than matched by pattern, so a third use has to be written into this list
// and argued for. Everything else still spends the accent on interaction only.
const WAYFINDING_SELECTOR = /^\.cover \.eyebrow$/;
const isWayfindingIcon = (node) => node.tag === "svg" && /aria-hidden="true"/.test(node.attrs);

const INTERACTIVE_SELECTOR = /(^|[\s,>~+([])(a|button|input|select|textarea|label|summary)([\s,:.\[)]|$)|\.btn\b|:(hover|active|focus|focus-visible|focus-within)\b|\[aria-(current|expanded|selected)/;

function ruleAccentCarriesInteraction(files) {
  const sheet = stylesheet.read();
  const found = [];

  for (const { d, value } of colourBearing(sheet.declarations)) {
    // A TOKEN DEFINES A COLOUR; IT DOES NOT APPLY ONE, and this is the one
    // place the three colour rules must diverge. `two plates` and `density
    // scale` ask what colours exist, so a token is exactly what they need to
    // see. This rule asks WHERE a colour lands, and `--primary-rgb: 33 72 184`
    // lands nowhere — there is no element in a definition to click. Reading
    // tokens here reported `:root` for owning the accent at all, which is the
    // rule inverted: it would demand the site not declare its own plate.
    if (d.prop.startsWith("--")) continue;
    if (!plates.stepsIn(value, sheet).some((s) => s.plate === "primary")) continue;
    if (INTERACTIVE_SELECTOR.test(d.selector)) continue;
    if (WAYFINDING_SELECTOR.test(d.selector.trim())) continue;
    found.push({
      file: d.file,
      line: d.line,
      detail: `${d.selector} paints the accent, and nothing in that selector can be clicked — the accent is the mark interaction gets, not a colour`,
    });
  }

  for (const u of colourUtilities(files, sheet)) {
    const hit = plates.plateUtility(u.name);
    if (!hit || hit.plate !== "primary") continue;
    // A utility reached through `@apply` has no element to judge, and a
    // component class is not a place — `sheet.applied` entries carry no node.
    if (!u.node) continue;
    if (isInteractiveNode(u.node)) continue;
    if (isWayfindingIcon(u.node)) continue;
    found.push({
      file: u.file,
      line: u.line(),
      detail: `<${u.node.tag}> carries ${u.name} but is not interactive and sits inside nothing that is`,
    });
  }
  return found;
}

module.exports = ruleAccentCarriesInteraction;
