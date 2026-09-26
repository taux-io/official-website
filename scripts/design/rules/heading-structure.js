// CANONICAL_LOCALE is the language the error document speaks; routes.js holds
// it (mirroring the generator's constant) so it is written once on this side.
const { isLatin, CANONICAL_LOCALE } = require("../../routes");
const { locate, markup } = require("../rendered");

// CJK has no uppercase, so the typographic signature of this vocabulary — bold,
// uppercase, set tighter than its own size — can only be carried by a Latin
// line. Every H1 is therefore two lines: a Latin lead and a Chinese sub. The
// route table is read rather than the template directory so that a page added
// to the site cannot quietly skip this.
// CONDITIONAL ON THE WRITING SYSTEM, NOT SWITCHED OFF (decision #56).
//
// Decision #6's reason for the two-line h1 was that Chinese has no upper case,
// so the display signature could only be carried by a Latin line above it. That
// reason does not exist on a Latin page: there the lead IS the content, and
// requiring a sub-line under it would demand a second line with nothing to say.
//
// So `display-lead` is asked of every template and `display-sub` only of those
// that render into a non-Latin locale. A template serving both — which is what
// the canonical locale's templates do until issue 200 gives each language its
// own — still owes the sub-line, because it still renders a Chinese page.
//
// The rule shrank to where it holds rather than being turned off. Turning it off
// to get a green build is the same move as keeping an exemption list, and this
// needed neither.
// READS THE BUILT PAGE, ONE ROW PER PAGE. It read each template and asked it
// for the union of the locales it renders into; the built page has exactly one
// locale, and an h1 that a base layout or a hero macro supplies is in it —
// where the template-source version would have reported "no <h1>".
function ruleHeadingStructure(files, { rendered }) {
  const found = [];
  for (const page of rendered()) {
    // A document has no locale of its own — one file answers every unmatched
    // path — so it is held to the canonical locale's requirement.
    const locale = page.locale || CANONICAL_LOCALE;
    const html = markup(page);
    const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    if (!headings.length) {
      found.push({ file: page.dist, line: 0, detail: `no <h1> (on ${page.url})` });
      continue;
    }
    const needsSub = !isLatin(locale);
    const required = needsSub ? ["display-lead", "display-sub"] : ["display-lead"];

    for (const h of headings) {
      const missing = required.filter((c) => !h[1].includes(c));
      if (missing.length) {
        const open = /^<h1\b[^>]*>/.exec(h[0])[0];
        found.push({
          ...locate(page, [h[0].length <= 400 ? h[0] : null, open], h.index),
          detail:
            `<h1> missing ${missing.join(" and ")} (on ${page.url})` +
            (needsSub ? "" : ` — ${locale} is Latin, so no sub-line is asked for`),
        });
      }
    }
  }
  return found;
}

module.exports = ruleHeadingStructure;
