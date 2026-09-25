// CANONICAL_LOCALE is the language the error document speaks; routes.js holds
// it (mirroring the generator's constant) so it is written once on this side.
const { PAGES, DOCUMENTS, isLatin, CANONICAL_LOCALE } = require("../../routes");
const { templateKey, lineOf } = require("../lib");

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
function ruleHeadingStructure(files) {
  const found = [];
  const byName = new Map(files.map((f) => [templateKey(f.rel), f]));

  // Which languages each template actually renders into. A document has no
  // locale of its own — one file answers every unmatched path — so it is held
  // to the canonical locale's requirement.
  const localesOf = new Map();
  for (const p of PAGES) {
    if (!localesOf.has(p.template)) localesOf.set(p.template, []);
    localesOf.get(p.template).push(p.locale);
  }
  for (const d of DOCUMENTS) {
    if (!localesOf.has(d.template)) localesOf.set(d.template, []);
    localesOf.get(d.template).push(CANONICAL_LOCALE);
  }

  for (const [template, locales] of localesOf) {
    const f = byName.get(template);
    if (!f) {
      found.push({ file: `site.toml`, line: 0, detail: `declares missing template ${template}` });
      continue;
    }
    const headings = [...f.html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    if (!headings.length) {
      found.push({ file: f.rel, line: 0, detail: "no <h1>" });
      continue;
    }
    const needsSub = locales.some((tag) => !isLatin(tag));
    const required = needsSub ? ["display-lead", "display-sub"] : ["display-lead"];

    for (const h of headings) {
      const missing = required.filter((c) => !h[1].includes(c));
      if (missing.length) {
        found.push({
          file: f.rel,
          line: lineOf(f.html, h.index),
          detail:
            `<h1> missing ${missing.join(" and ")}` +
            (needsSub ? "" : ` — ${locales.join(", ")} is Latin, so no sub-line is asked for`),
        });
      }
    }
  }
  return found;
}

module.exports = ruleHeadingStructure;
