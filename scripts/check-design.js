// Reports templates that contradict DESIGN.md.
//
//   node scripts/check-design.js
//
// DESIGN.md is the single source of design truth, and its opening argument is
// that a rule nothing checks is not a rule. Three earlier generations of design
// description drifted from the code without anyone noticing — one of them
// claimed no template carries a hex value while asserting the opposite about a
// page whose "hex values" turned out to be escaped braces. This is the checker
// that makes the drift impossible to keep.
//
// It reads what the *author wrote* — the templates and the route table — and
// never the built stylesheet. check-unknown-classes.js is the other direction:
// it asks whether Tailwind actually emitted something for what was written.
// Both are needed and neither substitutes for the other.
//
// The threshold is clean rather than "no worse than yesterday". Set while the
// codebase is clean, it needs no list of tolerated exceptions — and an
// exceptions list is precisely how a check decays into a warning nobody reads.
//
// RULES ARE SWITCHED ON BY THE TICKET THAT MAKES THEM SATISFIABLE. Landing a
// rule disabled and flipping it in the change that earns it is what keeps CI
// green commit to commit without an allowlist. A rule that is off says so, and
// says which ticket turns it on.
//
// Twenty-one rules hold today, and none of them is disabled. Decision #34's
// convention — a rule that is not yet satisfiable lands disabled and names the
// ticket that will turn it on — still stands and is still used; it simply has
// no current subject, because every rule added since was satisfiable in the
// change that added it.

const fs = require("fs");
const path = require("path");
const { walk } = require("./lib/fs");
const { ROOT, TEMPLATES } = require("./design/lib");

// ---------------------------------------------------------------------------
// Rules. Each returns a list of {file, line, detail}.
const ruleNoLiteralColour = require("./design/rules/no-literal-colour");
const ruleSectionGapScale = require("./design/rules/section-gap-scale");
const ruleSurfacePaintedOnce = require("./design/rules/surface-painted-once");
const ruleNoScrollReveal = require("./design/rules/no-scroll-reveal");
const ruleTrackingScale = require("./design/rules/tracking-scale");
const ruleRadiusScale = require("./design/rules/radius-scale");
const ruleHeadingStructure = require("./design/rules/heading-structure");
const ruleAnchorIntegrity = require("./design/rules/anchor-integrity");
const ruleLocaleRelativeLinks = require("./design/rules/locale-relative-links");
const ruleCollapsibleShipsOpen = require("./design/rules/collapsible-ships-open");
const ruleInvisibleIsInert = require("./design/rules/invisible-is-inert");
const ruleCssVersionIsDerived = require("./design/rules/css-version-is-derived");

// ---------------------------------------------------------------------------
// The motion and material vocabulary issue 156 introduced.
//
// That change gave the site two easings, three shadow steps and a pressed
// state, none of which existed before and none of which anything checked. This
// file's opening argument is that a rule nothing checks is not a rule, and a
// vocabulary is only a vocabulary while it stays small — the reason the site
// had one ink, two hairline weights and no shadows at all was never taste, it
// was that an unpoliced scale grows a fourth step for a case none of the first
// three fit.
const ruleEasingScale = require("./design/rules/easing-scale");
const rulePressFollowsHover = require("./design/rules/press-follows-hover");
const ruleNavBreakpointsPaired = require("./design/rules/nav-breakpoints-paired");

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The four rules the brand reset introduced (DESIGN.md decision #53).
//
// All four land disabled and are switched on by the ticket that makes each
// satisfiable — the arrangement the rest of this file already uses. A rule that
// is off says so, and says which ticket turns it on.
const ruleZeroMono = require("./design/rules/zero-mono");
const ruleZeroCanvas = require("./design/rules/zero-canvas");
const ruleSectionCoverScreens = require("./design/rules/section-cover-screens");
const ruleSentenceCaseDisplay = require("./design/rules/sentence-case-display");
const ruleSingleStylesheet = require("./design/rules/single-stylesheet");
const ruleSingleWalker = require("./design/rules/single-walker");
const ruleSingleRouteTable = require("./design/rules/single-route-table");
const ruleStatesDiffer = require("./design/rules/states-differ");
const ruleWeightLadder = require("./design/rules/weight-ladder");
const ruleOgScaleJump = require("./design/rules/og-scale-jump");
const ruleDensityScale = require("./design/rules/density-scale");
const ruleTwoPlates = require("./design/rules/two-plates");
const ruleAccentCarriesInteraction = require("./design/rules/accent-carries-interaction");
const ruleScaleJump = require("./design/rules/scale-jump");
const ruleDeclaredSurfaces = require("./design/rules/declared-surfaces");
const ruleTagsNest = require("./design/rules/tags-nest");
const ruleStatePairsKeepContrast = require("./design/rules/state-pairs-keep-contrast");
const ruleHoverIsGuarded = require("./design/rules/hover-is-guarded");
const ruleThemeColourAgrees = require("./design/rules/theme-colour-agrees");

const RULES = [
  {
    name: "easing scale",
    enabled: true,
    turnedOnBy: "issue 156 — the motion vocabulary",
    run: ruleEasingScale,
    summary: "every curve is the one declared --ease-* token, in every source",
  },
  {
    name: "press follows hover",
    enabled: true,
    turnedOnBy: "issue 156 — after the ordering defect in 154",
    run: rulePressFollowsHover,
    summary: "anything that answers hover answers a press, and later in the file",
  },
  {
    name: "invisible is inert",
    enabled: true,
    turnedOnBy: "issue 143 — the closed overlay left twenty links in the tab order",
    run: ruleInvisibleIsInert,
    summary: "an element exempted from the scroll-reveal rule must ship inert",
  },
  {
    name: "css version is derived",
    enabled: true,
    turnedOnBy: "PR 145 — the cache-buster is computed from the stylesheet",
    run: ruleCssVersionIsDerived,
    summary: "the stylesheet's ?v= must be a hash of the stylesheet, not a literal",
  },
  {
    name: "section gap scale",
    enabled: true,
    turnedOnBy: "the Gestalt pass — proximity finally has a written ratio",
    run: ruleSectionGapScale,
    summary: "a section carries no divider and no top padding or margin; the column's space-y is the rhythm",
  },
  {
    name: "surface is painted once",
    enabled: true,
    turnedOnBy: "the Gestalt pass — 373 repaints, 70 of them invisible objects",
    run: ruleSurfacePaintedOnce,
    summary: "bg-surface only on body or on something lifted off it (absolute/fixed)",
  },
  {
    name: "nav breakpoints paired",
    enabled: true,
    turnedOnBy: "#134 — the desktop nav narrows to two items",
    run: ruleNavBreakpointsPaired,
    summary: "the desktop nav appears exactly where the hamburger disappears",
  },
  {
    name: "zero literal colour",
    enabled: true,
    turnedOnBy: "#50, widened in v5 — it read hex only while 25 rgba() walked past",
    run: ruleNoLiteralColour,
    summary: "no hex, rgb(), rgba(), hsl() or hsla() literal in a template; colours come from the tokens in src/input.css",
  },
  {
    name: "no scroll reveal",
    enabled: true,
    turnedOnBy: "#50",
    run: ruleNoScrollReveal,
    summary: "content must be painted, not revealed by a script that may not run",
  },
  {
    name: "tracking scale",
    enabled: true,
    turnedOnBy: "#53",
    run: ruleTrackingScale,
    summary: "arbitrary tracking must come from the scale in DESIGN.md",
  },
  {
    name: "radius scale",
    enabled: true,
    turnedOnBy: "#66",
    run: ruleRadiusScale,
    summary: "every radius is one of the six declared steps; no seventh value",
  },
  {
    name: "heading structure",
    enabled: true,
    turnedOnBy: "#55",
    run: ruleHeadingStructure,
    summary: "every H1 is a Latin lead line over a Chinese sub",
  },
  {
    name: "anchor integrity",
    enabled: true,
    turnedOnBy: "#66",
    run: ruleAnchorIntegrity,
    summary: "a fragment link must point at an element that exists on the rendered page",
  },
  {
    name: "locale relative links",
    enabled: true,
    turnedOnBy: "issue 199",
    run: ruleLocaleRelativeLinks,
    summary: "an internal link names a declared route and must carry the render's locale",
  },
  {
    name: "collapsible ships open",
    enabled: true,
    turnedOnBy: "#130 — the MCP primitives explainer",
    run: ruleCollapsibleShipsOpen,
    summary: "a panel a script collapses must be in the document open, not hidden",
  },
  {
    name: "weight ladder",
    enabled: true,
    turnedOnBy: "#194 — 500 is absent from the ladder by name",
    run: ruleWeightLadder,
    summary: "no weight 500; the ladder is 300 / 400 / 600 / 700",
  },
  {
    name: "states differ",
    enabled: true,
    turnedOnBy: "#192 — after the palette collapse made six classes of state a no-op",
    run: ruleStatesDiffer,
    summary: "a declared state produces a different value from the one it overrides",
  },
  {
    name: "single route table",
    enabled: true,
    turnedOnBy: "#191 — routes.js widened enough to be adoptable",
    run: ruleSingleRouteTable,
    summary: "only routes.js parses site.toml; every other script asks it",
  },
  {
    name: "single walker",
    enabled: true,
    turnedOnBy: "#190 — the walk module's own adoption",
    run: ruleSingleWalker,
    summary: "only walk.js starts a browser for the visual family, plus two named exemptions",
  },
  {
    name: "single stylesheet",
    enabled: true,
    turnedOnBy: "#189 — the stylesheet module's own coverage",
    run: ruleSingleStylesheet,
    summary: "the only stylesheet link is the built one; a second file would be unread",
  },
  {
    name: "zero mono",
    enabled: true,
    turnedOnBy: "#171 — the monospace faces come out with the vocabulary",
    run: ruleZeroMono,
    summary: "nothing writes font-mono or font-pixel, and nothing reaches generic monospace",
  },
  {
    name: "zero canvas",
    enabled: true,
    turnedOnBy: "#166 — the tau curve comes out",
    run: ruleZeroCanvas,
    summary: "decorative depth is photography; this site ships none, so it ships nothing",
  },
  {
    name: "section cover screens",
    enabled: true,
    turnedOnBy: "#182 — after the 100 bands land",
    run: ruleSectionCoverScreens,
    summary: "every section heading opens a cover block, partials excluded",
  },
  {
    name: "sentence case display",
    enabled: true,
    turnedOnBy: "#193 — reversed from uppercase display",
    run: ruleSentenceCaseDisplay,
    summary: "no display line renders upper case; this vocabulary is sentence case",
  },
  {
    name: "og scale jump",
    enabled: true,
    turnedOnBy: "v5 — the reference set's 5-12x jump, on the one carrier with a fixed frame",
    run: ruleOgScaleJump,
    summary: "the share card's largest step is 5-12 times its smallest, in both title branches",
  },
  {
    name: "density scale",
    enabled: true,
    turnedOnBy: "v5 — a lighter colour is the same plate laid thinner, so coverage is a scale",
    run: ruleDensityScale,
    summary: "every coverage a colour lands on is one of the declared density steps",
  },
  {
    name: "two plates",
    enabled: true,
    turnedOnBy: "v5 — the ink model's one structural claim, and the only rule that can disprove it",
    run: ruleTwoPlates,
    summary: "every colour is the paper, the ink or the accent at some coverage; there is no third",
  },
  {
    name: "accent carries interaction",
    enabled: true,
    turnedOnBy: "v5 — prose since v4 that nothing read",
    run: ruleAccentCarriesInteraction,
    summary: "the accent plate appears only on something that can be clicked, or inside it",
  },
  {
    name: "scale jump",
    enabled: true,
    turnedOnBy: "v5 — the reference set's 5-12x jump, asked of the pages",
    run: ruleScaleJump,
    summary: "the declared type ladder's largest step is 5-12 times its smallest",
  },
  {
    name: "declared surfaces",
    enabled: true,
    turnedOnBy: "v5 — the only rule here that checks for absence",
    run: ruleDeclaredSurfaces,
    summary: "the three places where saying nothing hands the colour to the browser are declared",
  },
  {
    name: "theme colour agrees",
    enabled: true,
    turnedOnBy: "v5 — the manifest carried a black theme colour through two resets while declared the whole time",
    run: ruleThemeColourAgrees,
    summary: "the meta theme-color and the manifest's theme_color are the same surface",
  },
  {
    name: "tags nest",
    enabled: true,
    turnedOnBy: "v5.3 — /geo-guide shipped with balanced div counts and crossed tags; sixteen gates called it clean",
    run: ruleTagsNest,
    summary: "every closing tag closes the element that is actually open; counts matching is not nesting",
  },
  {
    name: "state pairs keep contrast",
    enabled: true,
    turnedOnBy: "v5.1 — the primary button's label was 1.24:1 on hover, on every route, and no gate read a state",
    run: ruleStatePairsKeepContrast,
    summary: "a hover, active or focus ground keeps its own label at 4.5:1 or better",
  },
  {
    name: "hover is guarded",
    enabled: true,
    turnedOnBy: "v5.1 — better-accessibility: hover latches on touch; zero media queries guarded it",
    run: ruleHoverIsGuarded,
    summary: "every :hover in authored CSS sits inside @media (hover: hover)",
  },
];

function main() {
  const files = walk(TEMPLATES, ".html").map((file) => ({
    rel: path.relative(ROOT, file),
    html: fs.readFileSync(file, "utf8"),
  }));

  let failed = 0;
  const pending = [];

  for (const rule of RULES) {
    if (!rule.enabled) {
      pending.push(rule);
      continue;
    }
    const violations = rule.run(files);
    if (!violations.length) continue;

    failed += violations.length;
    console.log(`\n  ${rule.name} — ${rule.summary}\n`);
    for (const v of violations) {
      const where = v.line ? `${v.file}:${v.line}` : v.file;
      console.log(`      ${where}  ${v.detail}`);
    }
  }

  if (pending.length) {
    console.log("");
    for (const rule of pending) {
      console.log(`  not yet enforced — ${rule.name}: ${rule.turnedOnBy ?? "no ticket recorded"}`);
    }
  }

  if (failed) {
    console.log(`\n${failed} design violation(s). DESIGN.md is the rule; fix the template.`);
    process.exitCode = 1;
    return;
  }

  const on = RULES.filter((r) => r.enabled).length;
  console.log(`\ntemplates agree with DESIGN.md (${on} of ${RULES.length} rules enforced)`);
}

main();
