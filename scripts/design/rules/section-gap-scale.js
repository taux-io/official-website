const { lineOf } = require("../lib");

// THE GAP AFTER A SECTION RULE IS ONE OF THREE, AND THE THREE MEAN DIFFERENT
// THINGS. This is the proximity principle, written down for the first time.
//
// A hairline on a `<section>` is the site's inter-group boundary, and what
// follows it says how far apart the two groups are. Three depths, measured off
// what the templates already do rather than invented here:
//
//   .cover's padding-block  96px  a section that opens with a cover block —
//                                 the cover supplies the gap, so the section
//                                 carries no `pt` of its own (45 sections)
//   pt-16                   64px  a top-level section that opens with content
//                                 (355 sections)
//   pt-12                   48px  a section nested inside another — a SUB-group,
//                                 and a sub-group belongs closer (20 sections)
//
// Against intra-group spacing of `space-y-6` (24px) and `gap-4` (16px), the
// inter:intra ratio is about 2.7:1. That ratio is the whole of proximity, and
// nothing stated it anywhere before this rule.
//
// ⚠️ WHAT THIS RULE IS NOT. An earlier reading of this codebase claimed "seven
// different paddings follow the identical separator, nothing distinguishes
// them". That was a grep counting every `border-t border-line`, including the
// 34 on `<p>`, 21 on `<li>` and 42 on `<div>` — a rule under a list row and a
// rule between two sections are different jobs and correctly take different
// gaps. Restricted to `<section>`, the site was already consistent at 355/375;
// the genuine defects were one nested section at `pt-8` and five copies of a
// section carrying `border-t border-line` twice AND both `pt-8` and `pt-16`,
// where which padding won depended on the order of the generated CSS rather
// than on anything an author wrote.
// v5.3 (decision #147): THE COLUMN SPACES ITS SECTIONS, AND A SECTION CARRIES
// NOTHING OF ITS OWN. No hairline between sections — the heading is the
// boundary — and no top padding or margin: the parent's `space-y` is the one
// place the rhythm is declared. The rule below now reports a <section> that
// brings its own divider or vertical offset; the pt-16/pt-12 ladder it used
// to police is gone with the dividers it measured from.
const SECTION_OWN_RHYTHM = /^(?:[a-z-]+:)*(?:border-t|border-line|pt-\d+|mt-\d+|py-\d+|my-\d+|space-y-\d+)$/;

function ruleSectionGapScale(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<section\b([^>]*)>/g)) {
      const cls = /class="([^"]*)"/.exec(m[1]);
      if (!cls) continue;
      const own = cls[1].split(/\s+/).filter((c) => SECTION_OWN_RHYTHM.test(c));
      if (!own.length) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: `<section> carries ${own.join(" ")} — sections bring no divider and no vertical offset of their own; the column's space-y is the rhythm`,
      });
    }
  }
  return found;
}

module.exports = ruleSectionGapScale;
