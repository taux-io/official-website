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
const stylesheet = require("./stylesheet");
const plates = require("./plates");
const { PAGES, DOCUMENTS, isLatin } = require("./routes");

// The language the error document speaks; the generator holds the same constant
// and for the same reason — one file answers every unmatched path, chosen
// before the host knows anything about the reader.
const CANONICAL_LOCALE = "zh-Hant-TW";

const ROOT = path.join(__dirname, "..");
const TEMPLATES = path.join(ROOT, "templates");

// ---------------------------------------------------------------------------
// The scale, from DESIGN.md's "字級與字距刻度" table. Any arbitrary tracking
// value outside this set is a one-off, which is the thing the table exists to
// prevent: the reference site's tracking changes sign with size, so it is one
// scale rather than a handful of independently chosen numbers.
// The Apple ladder's tracking, and it is signed: display closes up, lead opens
// out, eyebrow stays wide. Decision #53 deleted negative tracking three hours
// before this for being the previous reference site's signature; it is this
// one's signature too, at its own values.
const TRACKING_SCALE = new Set([
  "0", "0em", "0.09em", "0.011em", "-0.005em", "-0.011em", "-0.022em",
]);

// Properties whose value carries a timing function.
const TIMED_PROPS = new Set([
  "transition", "transition-timing-function", "animation", "animation-timing-function",
]);
// The named curves. `steps()` and `cubic-bezier()` are handled separately.
const KEYWORD_EASINGS = new Set([
  "ease", "ease-in", "ease-out", "ease-in-out", "linear", "step-start", "step-end",
]);

const CONTROL_TAGS = new Set(["button", "input", "select", "textarea"]);
const CONTROL_CLASSES = ["btn", "tag"];

// The full-screen menu rests at opacity-0 and is revealed by the menu script.
// That is a disclosure, not a scroll reveal: it is driven by a click, it has no
// scroll listener and no observer, and its content is in the document for
// crawlers either way. It is the single structural exemption in this file, and
// it is named here rather than pattern-matched so that a second one cannot be
// added without saying so out loud.
const OPACITY_EXEMPT_IDS = new Set(["menuOverlay"]);

// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// HOW site.toml NAMES A TEMPLATE, which stopped being its basename.
//
// Templates used to be a flat directory, so `path.basename` and "what the route
// table declares" were the same string. A translated page needs its own file —
// one file cannot hold two languages' prose — so they live in `templates/en-US/`
// and site.toml declares `en-US/building.html`.
//
// Keyed by basename, the two `building.html` files collide: the map keeps
// whichever came last, and the rules above then check one language's template
// twice and the other's never. It surfaced as "site.toml declares missing
// template en-US/building.html", which is the good outcome — the same collision
// with the *other* iteration order would have reported nothing at all.
const templateKey = (rel) => path.relative(TEMPLATES, path.join(ROOT, rel));

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// Numeric character references have to go before anything looks for a hex
// colour. The templates escape their braces as &#123; and &#125; so minijinja
// does not read a code sample as a template expression, and a naive
// /#[0-9a-f]{3}/ reads twenty of those as colours — which is exactly what an
// earlier draft of DESIGN.md did, reporting a page as the worst offender in the
// codebase when its real count was zero. A checker whose first run is twenty
// false positives teaches people to skip it.
//
// Fragment hrefs go too: `#contact-us` is not a colour, and `#abc` would
// otherwise be indistinguishable from one.
function maskNonColourHashes(html) {
  return html
    .replace(/&#x?[0-9a-fA-F]+;/g, (m) => " ".repeat(m.length))
    .replace(/href="#[^"]*"/g, (m) => " ".repeat(m.length));
}

// Every opening tag with its attributes, so a rule can ask what kind of element
// it is looking at rather than guessing from the class name alone.
function* elements(html) {
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
    const attrs = m[2];
    const cls = /class="([^"]*)"/.exec(attrs);
    const id = /id="([^"]*)"/.exec(attrs);
    yield {
      tag: m[1].toLowerCase(),
      classes: cls ? cls[1].split(/\s+/).filter(Boolean) : [],
      id: id ? id[1] : null,
      index: m.index,
    };
  }
}

const stripVariants = (c) => c.replace(/^(?:(?:[a-z0-9-]+|\[[^\]]*\]):)+/, "");

// A genuine circle declares equal width and height. Reading the classes beats
// measuring in a browser: this checker reads authored intent, and an element
// that means to be a circle says so.
function squareSized(classes) {
  const dim = (p) => {
    const m = classes.map(stripVariants).find((c) => new RegExp(`^${p}-`).test(c));
    return m ? m.slice(p.length + 1) : null;
  };
  const w = dim("w");
  const h = dim("h");
  return w !== null && w === h;
}

// Every `{% include "x.html" %}` a template pulls in, in both spellings the
// templates use — some carry a space after the keyword and some do not.
function includesOf(html) {
  return [...html.matchAll(/\{%-?\s*include\s*"([^"]+)"\s*-?%\}/g)].map((m) => m[1]);
}

// The ids a page declares and the fragment hrefs it contains, assembled the way
// minijinja assembles the page rather than read from one file.
//
// This has to follow the includes. A fragment resolves against the *rendered*
// document, and the header and footer contribute ids to every page — so a rule
// that read a single template would both miss ids that are really there and be
// unable to say anything about a link written in a partial.
function reachable(name, byName, seen = new Set()) {
  const ids = new Set();
  const hrefs = [];
  if (seen.has(name)) return { ids, hrefs };
  seen.add(name);

  const f = byName.get(name);
  if (!f) return { ids, hrefs };

  for (const el of elements(f.html)) {
    if (el.id) ids.add(el.id);
  }
  for (const m of f.html.matchAll(/href="([^"]*#[^"]*)"/g)) {
    hrefs.push({ file: f.rel, line: lineOf(f.html, m.index), href: m[1] });
  }

  for (const inc of includesOf(f.html)) {
    const child = reachable(inc, byName, seen);
    for (const id of child.ids) ids.add(id);
    hrefs.push(...child.hrefs);
  }
  return { ids, hrefs };
}

// ---------------------------------------------------------------------------
// Rules. Each returns a list of {file, line, detail}.

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
function ruleSectionGapScale(files) {
  const ALLOWED = new Set(["pt-16", "pt-12"]);
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<section\b([^>]*)>/g)) {
      const cls = /class="([^"]*)"/.exec(m[1]);
      if (!cls) continue;
      const classes = cls[1].split(/\s+/).filter(Boolean);
      // Stripped on BOTH sides. Matching `border-t` un-stripped while stripping
      // the padding let a section whose hairline is responsive (`tablet:border-t`)
      // escape the rule entirely, which is the opposite of what a rule about
      // that hairline should do.
      const bare = classes.map(stripVariants);
      if (!bare.includes("border-t") || !bare.includes("border-line")) continue;
      // GROUPED BY BREAKPOINT, NOT LUMPED TOGETHER. `pt-12 tablet:pt-16` is one
      // padding per breakpoint and the cascade picks between them
      // deterministically — that is NOT the ambiguity this rule is about. An
      // earlier version stripped the variants before counting, so it would have
      // reported that pair as "the winner is decided by the generated CSS",
      // which is false, and this same change adopts exactly that pattern on the
      // home page. The real defect is two paddings at the SAME breakpoint,
      // which is what `class="pt-8 … pt-16"` was.
      const byBreakpoint = new Map();
      for (const c of classes) {
        const bareC = stripVariants(c);
        if (!/^pt-\d/.test(bareC)) continue;
        const at = c.slice(0, c.length - bareC.length) || "base";
        if (!byBreakpoint.has(at)) byBreakpoint.set(at, []);
        byBreakpoint.get(at).push(bareC);
      }
      // No `pt` at all is the cover case: the cover block supplies the gap.
      // Verified rather than assumed — every such section today opens with one.
      if (byBreakpoint.size === 0) continue;
      for (const [at, values] of byBreakpoint) {
        const where = at === "base" ? "" : ` at ${at.replace(/:$/, "")}`;
        if (values.length > 1) {
          found.push({
            file: rel,
            line: lineOf(html, m.index),
            detail: `two top paddings on one section${where} (${values.join(" ")}) — same breakpoint, so the winner is decided by the generated CSS rather than by this attribute`,
          });
          continue;
        }
        if (!ALLOWED.has(values[0])) {
          found.push({
            file: rel,
            line: lineOf(html, m.index),
            detail: `${values[0]}${where} after a section rule — the scale is pt-16 top-level, pt-12 nested, or none when a cover supplies the gap`,
          });
        }
      }
    }
  }
  return found;
}

// THE SURFACE IS PAINTED ONCE, AND EVERY REPAINT OF IT IS INVISIBLE.
//
// There is one surface and `body` carries it, so `bg-surface` on anything
// inside `body` paints white on white. That is not merely redundant — it
// silently produced OBJECTS THAT DO NOT EXIST. Measured before this rule was
// written: 373 elements repainted the surface, and among them 40 bullet dots
// (`w-1.5 h-1.5 bg-surface rounded-full` inside a `list-none` list, so the list
// lost its markers entirely) and 30 numbered discs (`w-12 h-12 rounded-full
// bg-surface`, where the number showed and the disc never did).
//
// TWO SHAPES ARE LEGITIMATE AND BOTH ARE MEASURED RATHER THAN ASSUMED. `body`
// is where the surface is painted. And an element that floats over something
// else needs its own opaque fill or the layer beneath shows through — the two
// locale-switcher panels are `absolute`, and the nav is `fixed`. A probe over
// eight routes found 109 `bg-surface` elements: 85 computed the same background
// as their nearest painted ancestor, and every one of the rest was `body`, the
// nav, or a switcher panel.
//
// So the test is positional, not a name list: paint the surface only where you
// are the surface, or where you are lifted off it. `states differ` catches this
// same tautology for states; this catches it for base declarations, which
// nothing read before.
function ruleSurfacePaintedOnce(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const el of elements(html)) {
      if (!el.classes.some((c) => stripVariants(c).startsWith("bg-surface"))) continue;
      if (el.tag === "body") continue;
      if (el.classes.some((c) => ["absolute", "fixed"].includes(stripVariants(c)))) continue;
      found.push({
        file: rel,
        line: lineOf(html, el.index),
        detail: `<${el.tag}> repaints the surface it already sits on`,
      });
    }
  }
  return found;
}

// A reveal that starts invisible and depends on a script to undo it makes the
// text conditional on that script running. This site shipped one: an
// IntersectionObserver released elements as they scrolled in, a fast scroll
// outran the observer, and nineteen elements on the home page stayed invisible
// permanently. The reference site has none of this — zero elements below the
// fold sit under opacity 1.
function ruleNoScrollReveal(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const el of elements(html)) {
      if (el.classes.some((c) => stripVariants(c) === "opacity-0")) {
        if (el.id && OPACITY_EXEMPT_IDS.has(el.id)) continue;
        found.push({
          file: rel,
          line: lineOf(html, el.index),
          detail: `<${el.tag}> starts at opacity-0`,
        });
      }
      const stagger = el.classes.find((c) => /^animate-stagger/.test(stripVariants(c)));
      if (stagger) {
        found.push({ file: rel, line: lineOf(html, el.index), detail: stagger });
      }
    }
  }
  return found;
}

function ruleTrackingScale(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/tracking-\[([^\]]+)\]/g)) {
      if (TRACKING_SCALE.has(m[1])) continue;
      found.push({ file: rel, line: lineOf(html, m.index), detail: m[0] });
    }
  }
  return found;
}

// A radius must be one of the six declared steps.
//
// THIS REPLACES "radius on controls only", and the replacement is a widening,
// not a relaxation. The previous vocabulary was square except for controls; this
// one has a six-step grammar and forbids mixing — utility rects at 8px, cards at
// 18px, pills at 9999. Three of the six have no user on this site today, which
// is the reverse of decision #52's argument and is named as a cost in #54.
//
// What still cannot happen is a seventh value. Tailwind's own rounded-* steps
// are mapped onto the declared ones in the config, so an arbitrary
// rounded-[7px] is the shape this catches.
// SIX STEPS, AND THE WORD "SIX" HAS TO SURVIVE CONTACT WITH THE LIST.
//
// An earlier version of this set held seven names while the message said six and
// DESIGN.md's prose said six over a list of seven — the same defect class that
// document confesses to three times (20 hex values, 106 cover screens, 4.29:1).
// `rounded-control` was the seventh: it resolves to the same 9999px as
// `rounded-full` and had zero users in the templates, because the pill radius
// reaches .btn through CSS rather than through a class. The token stays;
// the duplicate class name does not.
const RADIUS_ALLOWED = new Set([
  "rounded-none", "rounded-xs", "rounded-sm", "rounded-md", "rounded-lg",
  "rounded-full",
]);

function ruleRadiusScale(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const el of elements(html)) {
      for (const c of el.classes) {
        const bare = stripVariants(c);
        if (!/^rounded(-|$)/.test(bare)) continue;
        if (RADIUS_ALLOWED.has(bare)) continue;
        found.push({
          file: rel,
          line: lineOf(html, el.index),
          detail: `${c} is not one of the six declared radius steps — the grammar is none / xs / sm / md / lg / full`,
        });
      }
    }
  }
  return found;
}

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

// A fragment link that resolves to nothing fails in the one way nobody sees:
// the page renders, the link is clickable, and it simply does not move. Rename
// a section id and every index and table of contents pointing at it dies
// silently — which is the failure the section index and the mobile overview
// table on the guides would otherwise be one careless edit away from.
//
// Two kinds of link, resolved differently:
//
//   `#frag`       against the page it is written on. A link in the footer is
//                 therefore checked against every page, because that is where
//                 it ends up, and it has to resolve on all of them.
//   `/path#frag`  against the page `path` names. Cross-page links do not depend
//                 on where they were written, so they are checked once rather
//                 than once per page that includes them.
//
// Anything carrying a scheme or an authority belongs to another origin and its
// fragment is not ours to resolve. A bare `href="#"` is a deliberate no-op, not
// a reference to an element.
function ruleAnchorIntegrity(files) {
  const found = [];
  const byName = new Map(files.map((f) => [templateKey(f.rel), f]));

  const templateFor = new Map(PAGES.map((p) => [p.path, p.template]));

  // Cross-page links carry the render's locale as a placeholder, because the
  // templates are shared and the prefix is not (`locale relative links`). What
  // this rule resolves against is the route's identity, which is what remains
  // once the placeholder comes off: `/{{ locale }}/geo-guide` is `/geo-guide`,
  // and a bare `/{{ locale }}` is the home page.
  //
  // Stripping it here rather than teaching every caller means the two rules
  // cannot disagree about what an internal link looks like.
  const routeIdentity = (href) => {
    const bare = href.replace(/^\/\{\{\s*locale\s*\}\}/, "");
    return bare === "" ? "/" : bare;
  };

  const idCache = new Map();
  const idsOf = (template) => {
    if (!idCache.has(template)) idCache.set(template, reachable(template, byName).ids);
    return idCache.get(template);
  };

  // Rendered documents (the error page) carry the same header and footer, so
  // they are walked too — but they are not routes, so nothing can link to them.
  const rendered = [
    ...PAGES.map((p) => ({ template: p.template, where: p.path })),
    ...DOCUMENTS.map((d) => ({ template: d.template, where: d.servedPath })),
  ];

  const crossPage = new Map();

  for (const { template, where } of rendered) {
    for (const { file, line, href } of reachable(template, byName).hrefs) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;

      const cut = href.indexOf("#");
      const target = href.slice(0, cut);
      const frag = href.slice(cut + 1);
      if (!frag) continue;

      if (!target) {
        if (!idsOf(template).has(frag)) {
          found.push({
            file,
            line,
            detail: `#${frag} does not resolve on ${where}`,
          });
        }
        continue;
      }

      // Deduped: the same cross-page link written in a partial reaches every
      // page, but its correctness has nothing to do with which page it is on.
      crossPage.set(`${file}:${line}:${href}`, { file, line, target, frag });
    }
  }

  for (const { file, line, target, frag } of crossPage.values()) {
    const template = templateFor.get(routeIdentity(target));
    if (!template) {
      found.push({ file, line, detail: `${target}#${frag} — no page declares ${target}` });
      continue;
    }
    if (!idsOf(template).has(frag)) {
      found.push({ file, line, detail: `${target}#${frag} — ${target} declares no such id` });
    }
  }

  return found;
}

// ---------------------------------------------------------------------------

// A tag scanner that tracks nesting, so a rule can ask two questions the flat
// `elements()` generator cannot answer: where does this element's subtree end,
// and what is it inside?
//
// The first draft of the two rules below did both with string arithmetic —
// `html.indexOf("</div>", start)` for the subtree and "does `data-specimen`
// appear earlier in the file" for containment. Both are wrong in the direction
// that reports success: the first stops at the *inner* close tag of any nested
// same-tag element, so a decorative empty div in front of a heading hides the
// heading; the second lets one specimen block near the top of a file exempt
// everything below it.
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "source", "track", "wbr",
]);

function parseElements(html) {
  const nodes = [];
  const stack = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)(\/?)>/g)) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (closing) {
      // Tolerate stray close tags by unwinding to the nearest matching open
      // rather than assuming the document is well formed.
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack[i].contentEnd = m.index;
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const attrs = m[3] || "";
    const cls = /class="([^"]*)"/.exec(attrs);
    const node = {
      tag,
      attrs,
      classes: cls ? cls[1].split(/\s+/).filter(Boolean) : [],
      index: m.index,
      contentStart: m.index + m[0].length,
      contentEnd: null,
      ancestors: stack.slice(),
    };
    nodes.push(node);
    if (VOID_TAGS.has(tag) || m[4] === "/") node.contentEnd = node.contentStart;
    else stack.push(node);
  }
  // Anything still open at EOF owns the rest of the file.
  for (const open of stack) open.contentEnd = html.length;
  return nodes;
}

const subtreeText = (html, node) =>
  html
    .slice(node.contentStart, node.contentEnd)
    .replace(/<[^>]*>/g, "")
    .replace(/&#x?[0-9a-fA-F]+;/g, "")
    .trim();

const hasAttr = (node, re) => re.test(node.attrs) || node.ancestors.some((a) => re.test(a.attrs));

// Every template a route actually renders, resolved through its includes, with
// the file each element really came from. Two rules need this and they used to
// disagree about it: one walked rendered pages and the other walked raw files,
// so a partial that only 404.html includes was judged as though it were a page.
function renderedNodes(name, byName, chain = []) {
  const out = [];
  // Guard cycles, not repetition. A shared partial reached from both the header
  // and the footer renders TWICE on the page, and a budget counted against the
  // rendered page has to see both — memoising on "visited anywhere" would hide
  // half of _nav-columns.html and let a page ship double the budget while the
  // checker reported it inside.
  if (chain.includes(name)) return out;
  const f = byName.get(name);
  if (!f) return out;

  for (const node of parseElements(f.html)) {
    out.push({ node, file: f.rel, line: lineOf(f.html, node.index), html: f.html });
  }
  const next = [...chain, name];
  for (const inc of includesOf(f.html)) out.push(...renderedNodes(inc, byName, next));
  return out;
}

function routeTemplates(files) {
  const declared = [...PAGES, ...DOCUMENTS].map((p) => p.template);
  const byName = new Map(files.map((f) => [templateKey(f.rel), f]));
  return { declared, byName };
}

// ---------------------------------------------------------------------------

const BG_IMAGE_INLINE = /style=("|')[^"']*background(-image)?\s*:[^"']*(url\(|gradient)/i;
// An internal link that names a declared route must carry the locale.
//
// THE TEMPLATES ARE SHARED AND THE PREFIX IS NOT. header.html is one file
// rendered once per language, so `href="/geo-guide"` in it does two wrong
// things at once: it costs a 301 for every reader, and once a second locale
// exists it sends an English reader to the Chinese page. The second failure is
// silent — the link works, the page loads, it is simply the wrong language, and
// no gate that checks status codes can see it.
//
// Forty-eight links were in this state the moment decision #58 landed. They
// were rewritten to `/{{ locale }}/...`; this is what stops the forty-ninth.
//
// Only paths that name a declared route are checked. `/static/...`, `/404`,
// fragments, `mailto:` and anything with a scheme are somewhere else's problem
// — and a link to another origin is not ours to prefix.
function ruleLocaleRelativeLinks(files) {
  const found = [];
  const routeIds = new Set(PAGES.map((p) => p.path).filter((p) => p !== "/"));

  for (const { rel, html } of files) {
    for (const m of html.matchAll(/href="([^"]*)"/g)) {
      const href = m[1];
      if (!href.startsWith("/")) continue;
      if (href.startsWith("/{{")) continue;
      const bare = href.split(/[#?]/)[0].replace(/\/$/, "");
      if (bare !== "" && !routeIds.has(bare)) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail:
          `href="${href}" names a route without the render's locale — ` +
          `write /{{ locale }}${bare} so the shared template follows the page it is rendered into`,
      });
    }
  }
  return found;
}

function ruleCollapsibleShipsOpen(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*\bdata-panel="[^"]*"[^>]*>/g)) {
      if (!/\bhidden\b/.test(m[0])) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: "data-panel ships hidden; the script must be what collapses it, not the markup",
      });
    }
  }
  return found;
}

// Whatever is exempted from the scroll-reveal rule owes something in return.
//
// OPACITY_EXEMPT_IDS lets an element rest at opacity-0 because a click, not a
// scroll position, reveals it. That exemption is about the eyes. It says
// nothing about the keyboard, and the menu overlay proved the gap: opacity-0
// plus pointer-events-none hid it from sight and from the mouse while leaving
// twenty links in the tab order, so tabbing past the navigation walked into
// twenty stops on a menu that was not on screen and drew no focus ring.
//
// So the exemption now carries an obligation, expressed against the same list
// rather than a second one: an element allowed to rest invisible must also
// ship inert, and the script that reveals it is what lifts that. Binding both
// to OPACITY_EXEMPT_IDS is the point — a future exemption cannot be granted
// without inheriting the duty.
//
// Inert in the markup rather than applied on load also points the failure the
// right way: if the script never runs the overlay cannot open, and an
// unopenable menu should not be collecting focus.
function ruleInvisibleIsInert(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*\bid="([^"]*)"[^>]*>/g)) {
      if (!OPACITY_EXEMPT_IDS.has(m[1])) continue;
      if (/\binert\b/.test(m[0])) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: `#${m[1]} rests invisible but ships focusable; it must carry inert for the script to lift`,
      });
    }
  }
  return found;
}

// The stylesheet's cache-busting query must be computed, never written.
//
// It was a literal — `?v=25` — from the Go-to-Rust migration until PR 145, and
// it never moved again: not for a palette change, not for the type scale, not
// for two changes that shipped the same afternoon. `_headers` caches
// /static/css/* for an hour, so a returning visitor got new markup styled by
// the stylesheet they already had. When the markup introduced new utility
// classes, the elements wearing them fell back to nothing — a nav reading
// `hidden sm:flex` against a stylesheet with no `sm:flex` is hidden at every
// width.
//
// The generator now derives the query from the stylesheet's bytes, which makes
// the failure impossible rather than merely discouraged. This rule exists to
// keep it that way: the next person to touch this line will be tempted to
// "simplify" it back to a literal, and a literal is silently wrong from the
// first stylesheet change after it.
const STYLESHEET_LINK = /<link[^>]*rel="stylesheet"[^>]*>/g;

function ruleCssVersionIsDerived(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(STYLESHEET_LINK)) {
      const tag = m[0];
      if (!/styles\.min\.css/.test(tag)) continue;
      if (tag.includes("{{ css_version }}")) continue;
      found.push({
        file: rel,
        line: lineOf(html, m.index),
        detail: /\?v=/.test(tag)
          ? "stylesheet cache-buster is a literal; it must be {{ css_version }} so it cannot lag the file"
          : "stylesheet link carries no cache-buster; it must be ?v={{ css_version }}",
      });
    }
  }
  return found;
}

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

const INPUT_CSS = path.join("src", "input.css");


// Two easings, and they are declared as tokens. A third curve written inline is
// how a scale stops being a scale.
function ruleEasingScale() {
  const sheet = stylesheet.read();
  const declared = new Set();
  for (const [name, value] of sheet.tokens) {
    if (!name.startsWith("--ease-")) continue;
    declared.add(value.replace(/\s+/g, ""));
  }
  if (!declared.size) {
    return [{ file: stylesheet.INPUT_CSS, line: 0, detail: "no --ease-* tokens declared; this rule has gone blind" }];
  }

  const found = [];
  for (const d of sheet.declarations) {
    if (!TIMED_PROPS.has(d.prop)) continue;
    for (const m of d.value.matchAll(/cubic-bezier\([^)]*\)/g)) {
      if (declared.has(m[0].replace(/\s+/g, ""))) continue;
      found.push({
        file: d.file,
        line: d.line,
        detail: `${d.prop}: ${d.raw} — ${m[0]} is not one of the declared easings (${[...declared].join(", ")})`,
      });
    }
    // KEYWORD EASINGS COUNT. `ease` is a curve like any other — it is
    // cubic-bezier(.25,.1,.25,1) wearing a name — and an earlier version of this
    // rule matched only the parenthesised form, so a second easing sat in a
    // template's own <style> block for as long as nothing read that block.
    for (const kw of d.value.split(/[\s,]+/)) {
      if (!KEYWORD_EASINGS.has(kw)) continue;
      found.push({
        file: d.file,
        line: d.line,
        detail: `${d.prop}: ${d.raw} — \`${kw}\` is a second easing; this vocabulary has one, and it is a token`,
      });
    }
  }
  return found;
}

const PRESS_EXEMPT = new Set(["::-webkit-scrollbar-thumb"]);

function rulePressFollowsHover() {
  const sheet = stylesheet.read();

  // Ordering is by source index, not line number. Line numbers only order
  // within one file, and the cascade now spans input.css and every template's
  // own <style> block.
  const hover = new Map();
  const active = new Map();
  for (const rule of sheet.rules) {
    for (const sel of rule.selectors) {
      const base = sel.replace(/:(hover|active)\b.*$/, "");
      if (PRESS_EXEMPT.has(base)) continue;
      if (/:hover\b/.test(sel) && !hover.has(base)) hover.set(base, rule);
      if (/:active\b/.test(sel) && !active.has(base)) active.set(base, rule);
    }
  }

  const found = [];
  for (const [base, hoverRule] of hover) {
    const activeRule = active.get(base);
    if (activeRule === undefined) {
      found.push({
        file: hoverRule.file,
        line: hoverRule.line,
        detail: `${base} answers :hover but not :active — a touch device never fires hover, so it would have no press feedback at all`,
      });
      continue;
    }
    if (activeRule.index < hoverRule.index) {
      found.push({
        file: activeRule.file,
        line: activeRule.line,
        detail: `${base}:active is written before :hover (${hoverRule.file}:${hoverRule.line}); equal specificity means hover wins and the press does nothing with a mouse`,
      });
    }
  }
  return found;
}

function ruleNavBreakpointsPaired(files) {
  const HEADER = path.join("templates", "header.html");
  const header = files.find(({ rel }) => rel === HEADER);
  // The partial is included by every template rather than routed to, so its
  // absence means the file was renamed and this rule has gone blind. Say so
  // rather than passing vacuously.
  if (!header) {
    return [{ file: HEADER, line: 0, detail: "not found; this rule cannot see the navigation" }];
  }

  const { rel, html } = header;
  const variantOf = (classes, utility) => {
    const hit = classes.find((c) => stripVariants(c) === utility && c !== utility);
    return hit ? hit.slice(0, hit.length - utility.length - 1) : null;
  };

  const showing = [];
  let hides = null;
  for (const el of elements(html)) {
    if (el.id === "hamburger") {
      hides = { variant: variantOf(el.classes, "hidden"), line: lineOf(html, el.index) };
    }
    // The desktop group is the one that starts hidden and becomes a flex row at
    // some breakpoint. Identified by that shape because it carries no id.
    if (el.classes.includes("hidden") && variantOf(el.classes, "flex")) {
      showing.push({ variant: variantOf(el.classes, "flex"), line: lineOf(html, el.index) });
    }
  }

  const found = [];
  // Collected rather than overwritten. Assigning in the loop meant the LAST
  // match won and a second group would be compared against nothing — the rule
  // would pass while the pairing it exists to check went unexamined. Today
  // there is exactly one, and this says so rather than relying on it.
  if (showing.length > 1) {
    found.push({
      file: rel,
      line: showing[1].line,
      detail: `${showing.length} \`hidden <bp>:flex\` groups; this rule pairs one against #hamburger and cannot tell which you meant`,
    });
  }
  const shows = showing[0] ?? null;
  if (!shows) {
    found.push({ file: rel, line: 0, detail: "no `hidden <bp>:flex` desktop nav group found" });
  }
  if (!hides || !hides.variant) {
    found.push({
      file: rel,
      line: hides ? hides.line : 0,
      detail: "#hamburger carries no `<bp>:hidden`",
    });
  }
  if (shows && hides && hides.variant && shows.variant !== hides.variant) {
    found.push({
      file: rel,
      line: hides.line,
      detail: `desktop nav shows at ${shows.variant}: but #hamburger hides at ${hides.variant}: — both or neither render between them`,
    });
  }
  return found;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The four rules the brand reset introduced (DESIGN.md decision #53).
//
// All four land disabled and are switched on by the ticket that makes each
// satisfiable — the arrangement the rest of this file already uses. A rule that
// is off says so, and says which ticket turns it on.

// The reference site's typographic system has no monospace at all, and the three
// faces this site carried for it (Roboto Mono, its box-drawing subset, Departure
// Mono) go with it. Both halves are checked: a template still writing the
// utility, and a config still defining the family for it to resolve against.
// Checking only the templates would leave the families sitting there for the
// next person to reach for.
function ruleZeroMono(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        if (!/^(?:[a-z]+:)*font-(?:mono|pixel)$/.test(c)) continue;
        found.push({
          file: rel,
          line: html.slice(0, node.index).split("\n").length,
          detail: `${c} — the vocabulary has no monospace face for it to resolve to`,
        });
      }
    }
  }
  const config = path.join(ROOT, "tailwind.config.js");
  if (fs.existsSync(config)) {
    const text = fs.readFileSync(config, "utf8");
    for (const family of ["mono", "pixel"]) {
      const m = new RegExp(`^\\s{6,}${family}:\\s*\\[`, "m").exec(text);
      if (!m) continue;
      found.push({
        file: "tailwind.config.js",
        line: text.slice(0, m.index).split("\n").length,
        detail: `this project defines fontFamily.${family}; the vocabulary has no monospace`,
      });
    }
    // WHAT THIS HALF CANNOT SAY. The families were removed from `theme.extend`,
    // and extend only adds — Tailwind's own default `mono` survives underneath,
    // so `font-mono` still resolves to a real stack. Deleting the project's
    // definition does not delete the utility, and an earlier version of this
    // rule claimed it did. What actually keeps monospace off the site is the
    // template half above plus the @apply scan below; this half only stops the
    // project from declaring a family of its own again.
  }
  // A component class applying the utility reaches the same face by another
  // road, and it is the road this site actually used: `.eyebrow` carried
  // `@apply font-mono` for 202 elements while no template said so. Reading only
  // the templates would have called that clean.
  const sheet = stylesheet.read();
  for (const a of sheet.applied) {
    const m = /^font-(mono|pixel)$/.exec(a.utility);
    if (!m) continue;
    found.push({
      file: a.file,
      line: a.line,
      detail: `${a.selector} applies font-${m[1]} — a component class reaches the removed family too`,
    });
  }

  // THE OTHER ROAD TO A MONOSPACE FACE, and the one this rule was blind to by
  // design rather than by accident: a raw `font-family` declaration. It never
  // looked at declarations at all — only class strings, the Tailwind config and
  // @apply — so two `font-family: monospace` rules in a template's own <style>
  // block survived the removal of the monospace vocabulary and kept DESIGN.md
  // decision #40's MingLiU trap open on the route with the most code content.
  //
  // The generic family is what is banned, not the word. A stack ending in
  // `monospace` puts CJK on whatever the platform calls generic monospace, which
  // on Windows is MingLiU — a serif this site sets nowhere else, and invisible
  // from a Mac.
  for (const d of sheet.declarations) {
    if (d.prop !== "font-family") continue;
    if (!/(^|,)\s*monospace\s*$/.test(d.value)) continue;
    found.push({
      file: d.file,
      line: d.line,
      detail: `${d.selector} falls through to generic monospace — no CJK face answers it, so Chinese lands on MingLiU on Windows`,
    });
  }
  return found;
}

// Photography and video are the only decorative depth this vocabulary admits,
// and the site has neither. What it had instead were twenty-five canvases
// drawing the tau curve. The rule is existence, not usage: a canvas with no
// script behind it is still a canvas the next change will find a use for.
//
// ONE NAMED EXEMPTION, AND IT IS NOT DECORATION. The jailbreak chart on
// what-is-prompt-injection is measured data drawn by Chart.js — the same family
// as the code blocks DESIGN.md's machine-output chapter covers, not the tau
// curve this rule exists to keep out. The brand reset was authorised against a
// count of "25 tau-curve canvases"; the inventory found 24 decorative canvases
// and this one chart, so removing it would have deleted content on a premise
// that turned out to be wrong. Named here rather than pattern-matched, for the
// reason OPACITY_EXEMPT_IDS is: a second exemption cannot be added quietly.
const CANVAS_EXEMPT_IDS = new Set(["jailbreakChart"]);

function ruleZeroCanvas(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<canvas\b([^>]*)>/g)) {
      const id = /id="([^"]*)"/.exec(m[1] || "");
      if (id && CANVAS_EXEMPT_IDS.has(id[1])) continue;
      found.push({
        file: rel,
        line: html.slice(0, m.index).split("\n").length,
        detail: "canvas — decorative depth is photography, and this site ships none",
      });
    }
  }
  return found;
}

// Every section heading opens a full-screen band carrying nothing but an eyebrow
// and the heading itself. The heading stays a real h2 inside that band rather
// than a visual stand-in beside it, because the document outline, the
// heading-structure rule and every fragment link depend on it.
//
// PARTIALS ARE EXCLUDED, AND THAT EXCLUSION IS THE POINT. The site has 106 h2
// elements and six of them live in the nav columns, the header and the footer. A
// rule written against the raw total would demand six full-screen bands inside
// the footer. The spec's first draft said 106; counting the files before writing
// the rule is what caught it.
function ruleSectionCoverScreens(files) {
  const found = [];
  for (const { rel, html } of files) {
    const base = path.basename(rel);
    if (base.startsWith("_") || base === "header.html" || base === "footer.html") continue;
    for (const node of parseElements(html)) {
      if (node.tag !== "h2") continue;
      // data-cover="sr" is the one variant: a screen-reader-only heading gets a
      // cover element so this rule stays satisfied, without the visible block.
      // Named here and in the glossary rather than left as an undocumented
      // attribute value that any future writer could invent a second one beside.
      if (hasAttr(node, /\bdata-cover\b/)) continue;
      found.push({
        file: rel,
        line: html.slice(0, node.index).split("\n").length,
        detail: "h2 outside a [data-cover] band — every section heading opens a cover screen",
      });
    }
  }
  return found;
}

// Chinese has no upper case. The display signature is therefore carried by the
// Latin lead line alone, and applying the same transform to the Chinese sub
// would be a no-op that reads as though the rule were satisfied.
//
// The transform belongs to the component classes rather than to utilities on the
// elements, so this reads the stylesheet for both halves and then checks that no
// template argues with it.
function ruleSentenceCaseDisplay(files) {
  const found = [];
  const sheet = stylesheet.read();

  // REVERSED, NOT DELETED. The previous vocabulary set the Latin lead in all
  // caps and this rule enforced it; this one never shouts. The rule stays so
  // that the transform coming back is a red gate rather than a quiet drift, and
  // it is asked of both fields because the transform can be written either way.
  const rendersUpper = (selector) => {
    const rules = sheet.rulesFor(selector);
    if (!rules.length) return null;
    for (const r of rules) {
      if (r.applied.some((a) => a.utility === "uppercase")) return { yes: true, rule: r };
      if (r.declarations.some((d) => d.prop === "text-transform" && d.value.trim() === "uppercase")) {
        return { yes: true, rule: r };
      }
    }
    return { yes: false, rule: rules[0] };
  };

  for (const selector of [".display-lead", ".display-sub"]) {
    const hit = rendersUpper(selector);
    if (!hit) {
      found.push({ file: stylesheet.INPUT_CSS, line: 0, detail: `${selector} is not defined` });
      continue;
    }
    if (!hit.yes) continue;
    found.push({
      file: hit.rule.file,
      line: hit.rule.line,
      detail: `${selector} renders upper case — this vocabulary is sentence case and never shouts`,
    });
  }

  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      if (!node.classes.some((c) => c === "display-lead" || c === "display-sub")) continue;
      const bad = node.classes.find((c) => /^(?:[a-z]+:)*uppercase$/.test(c));
      if (!bad) continue;
      found.push({
        file: rel,
        line: html.slice(0, node.index).split("\n").length,
        detail: `display line carries ${bad}; this vocabulary is sentence case`,
      });
    }
  }
  return found;
}


// The one hole the stylesheet module cannot close for itself.
//
// It reads every template, so a new <style> block or style="" attribute comes
// under the check the moment it is written. A new stylesheet FILE does not:
// <link rel="stylesheet" href="/static/css/deck.css"> would ship CSS that no
// rule sees and nothing would go red, which is exactly the shape of the blind
// spot this whole module exists to remove.
//
// One link, and it is the built one.
function ruleSingleStylesheet(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const m of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)) {
      const href = /href="([^"]*)"/.exec(m[0]);
      const target = href ? href[1] : "(no href)";
      if (/^\/static\/css\/styles\.min\.css(\?|$)/.test(target)) continue;
      found.push({
        file: rel,
        line: html.slice(0, m.index).split("\n").length,
        detail: `${target} — the only stylesheet is the built one; CSS in a second file is outside every rule's view`,
      });
    }
  }
  return found;
}


// The visual family starts one browser, in one place.
//
// geometry, contrast and screenshot each used to launch their own and each
// re-derived what "the page has settled" means; the discipline that keeps the
// overflow gate from going red at random lived in exactly one of the three.
// walk.js owns that now, and this keeps a fourth walker from appearing quietly.
//
// TWO NAMED EXEMPTIONS, and naming them is the point — a comment saying "we
// decided not to absorb these" has no teeth.
//
//   contract.js walks the same routes but asserts HTTP: headers, redirects,
//   HEAD, og:image status. It never sets a viewport.
//
//   diff.js walks nothing. It uses Chromium as a PNG decoder to compare two
//   screenshot sets.
const WALKER_EXEMPT = new Set(["walk.js", "contract.js", "diff.js"]);

function ruleSingleWalker() {
  const dir = path.join(ROOT, "scripts", "visual");
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".js") || WALKER_EXEMPT.has(name)) continue;
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    const m = /\blaunch\s*\(/.exec(text);
    if (!m) continue;
    found.push({
      file: path.join("scripts", "visual", name),
      line: text.slice(0, m.index).split("\n").length,
      detail: "launches its own browser — the walk, and the settle discipline that goes with it, belongs to walk.js",
    });
  }
  return found;
}


// One reader for the route table.
//
// routes.js has been the seam since the Go migration, and four scripts still
// parsed site.toml for themselves — check-design.js three times in three
// separate rules. They were not going around it out of habit: the module
// DROPPED the fields they needed. `template`, both date fields and `noindex`
// never reached a caller, and [[document]] was excluded outright, so "what is a
// page" had five definitions. Widening the module removed the reason to go
// around; this removes the option.
//
// SCOPED TO scripts/. generator/ reads site.toml too, in Rust, and cannot use a
// JavaScript module — that is a language boundary, not a discipline problem, and
// it is the reason the file is a data file in the first place.
function ruleSingleRouteTable() {
  const dir = path.join(ROOT, "scripts");
  const found = [];
  const walkDir = (abs, rel) => {
    for (const name of fs.readdirSync(abs).sort()) {
      const child = path.join(abs, name);
      if (fs.statSync(child).isDirectory()) {
        walkDir(child, path.join(rel, name));
        continue;
      }
      if (!name.endsWith(".js") || (rel === "scripts" && name === "routes.js")) continue;
      const text = fs.readFileSync(child, "utf8");
      const m = /require\(["'][^"']*smol-toml["']\)/.exec(text);
      if (!m) continue;
      found.push({
        file: path.join(rel, name),
        line: text.slice(0, m.index).split("\n").length,
        detail: "parses site.toml itself — routes.js is the one reader, and it carries every field now",
      });
    }
  };
  walkDir(dir, "scripts");
  return found;
}


// A state that declares feedback and produces none.
//
// Collapsing three ink steps and three surfaces to one value each (DESIGN.md
// decision #53) turned six classes of state declaration into no-ops at once —
// four component hovers, the section rail's [aria-current], sixteen table rows
// and thirty-seven template utilities. Every gate stayed green. check:classes
// asks whether a class resolves to a real rule; `press follows hover` asks
// whether :active is written after :hover. NEITHER ASKS WHETHER THE TWO STATES
// DIFFER, and that is the question.
//
// PER DECLARATION, NOT PER RULE. The defect that started this had two
// declarations of which one was dead; the survivor made the whole state look
// alive. A rule that only fired when everything in it was dead would have
// reported that one as healthy.
//
// SOURCE LEVEL ONLY. The third sub-class — a state whose value equals what the
// element already computes from an ancestor — needs the rendered page, and
// :hover cannot be forced from page script. It is left to a person and named in
// DESIGN.md's list of things nothing checks, because a state that is
// deliberately identical at one breakpoint would false-positive, and a gate that
// cries wolf is the argument that document opens with.
const STATE_SELECTOR = /(:(?:hover|active|focus|focus-visible|focus-within)\b|\[aria-[a-z-]+(?:=|\]))/;
const STATE_VARIANT = /^(hover|focus|focus-visible|active|group-hover):(.+)$/;

function ruleStatesDiffer(files) {
  const found = [];
  const sheet = stylesheet.read();

  // 1a — a state rule whose declaration matches the base rule it overrides.
  const baseBySelector = new Map();
  for (const rule of sheet.rules) {
    for (const sel of rule.selectors) {
      if (STATE_SELECTOR.test(sel)) continue;
      if (!baseBySelector.has(sel)) baseBySelector.set(sel, rule);
    }
  }
  for (const rule of sheet.rules) {
    for (const sel of rule.selectors) {
      if (!STATE_SELECTOR.test(sel)) continue;
      const base = baseBySelector.get(sel.replace(STATE_SELECTOR, "").replace(/::[a-z-]+$/, "").trim());
      if (!base) continue;
      for (const d of rule.declarations) {
        const twin = base.declarations.find(
          (b) => b.prop === d.prop && b.value.trim() === d.value.trim()
        );
        if (!twin) continue;
        found.push({
          file: d.file,
          line: d.line,
          detail: `${sel} sets ${d.prop} to what ${base.selector} already sets it to — the state declares feedback and produces none`,
        });
      }
      for (const a of rule.applied) {
        if (!base.applied.some((b) => b.utility === a.utility)) continue;
        found.push({
          file: a.file,
          line: a.line,
          detail: `${sel} applies ${a.utility}, which ${base.selector} already applies — the state declares feedback and produces none`,
        });
      }
    }
  }

  // 1b — the same utility written plain and under a state variant on one
  // element. `class="text-ink hover:text-ink"` is the shape thirty-seven
  // elements carried after the ink collapsed to a single value.
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      const plain = new Set(node.classes.filter((c) => !STATE_VARIANT.test(c)));
      for (const c of node.classes) {
        const m = STATE_VARIANT.exec(c);
        if (!m || !plain.has(m[2])) continue;
        found.push({
          file: rel,
          line: html.slice(0, node.index).split("\n").length,
          detail: `${c} alongside ${m[2]} — the state resolves to the value it is overriding`,
        });
      }
    }
  }
  return found;
}


// The weight ladder has a hole in it, on purpose.
//
// 300 / 400 / 600 / 700, with 500 deliberately absent — the reference site's own
// "Don't" list says so by name. Body is 400, inline emphasis is 600, display is
// 600.
//
// THE FIRST VERSION OF THIS RULE WAS TRIVIALLY EVADED, and it was credited in
// DESIGN.md while being so. It stripped a `[a-z-]*:` prefix and compared against
// one literal class name, so `!font-medium`, `min-[600px]:font-medium`,
// `font-[500]` and `[font-weight:500]` all shipped weight 500 past a green gate
// — and it never read the stylesheet at all, so a raw `font-weight: 500` in a
// template's own <style> block was invisible. There was one, live, on the route
// with the most code content.
//
// Both roads are checked now: the class attribute for anything that compiles to
// 500, and every declaration the stylesheet module can see.
const WEIGHT_500_CLASS = /(?:^|:)(?:!)?(?:font-medium|font-\[500\]|\[font-weight:500\])$/;

function ruleWeightLadder(files) {
  const found = [];
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        // Variants are stripped by taking everything after the last colon that
        // is not inside brackets — `min-[600px]:font-medium` and
        // `data-[state=on]:!font-medium` both end in the utility itself.
        const bare = c.replace(/^(?:[^:\[\]]*(?:\[[^\]]*\])?[^:\[\]]*:)+/, "");
        if (!WEIGHT_500_CLASS.test(":" + bare)) continue;
        found.push({
          file: rel,
          line: html.slice(0, node.index).split("\n").length,
          detail: `${c} compiles to weight 500, which this ladder omits — inline emphasis is 600`,
        });
      }
    }
  }

  // The other road: a raw declaration anywhere the stylesheet module can see —
  // input.css, a template's own <style>, a style="" attribute.
  for (const d of stylesheet.read().declarations) {
    if (d.prop !== "font-weight") continue;
    if (d.value.trim() !== "500") continue;
    found.push({
      file: d.file,
      line: d.line,
      detail: `${d.selector} declares font-weight: 500, which this ladder omits`,
    });
  }
  return found;
}


// RULE 30 — og scale jump.
//
// DESIGN.md's reference set asks for one dramatic scale jump: the largest text
// on a printed page is 5-12 times the microcopy size. The site's pages answer
// that through rule 27, which reads the ladder in tailwind.config.js. The share
// cards are the site's only other carrier with a fixed frame, and they carry a
// second, entirely separate ladder that nothing has ever read.
//
// TWO RULES, NOT ONE. Rule 27 reads tailwind.config.js; this reads
// build-og.js. The two ladders are unrelated declarations and no third thing
// compares them, which is why the card sat at 4.71x while the page was being
// argued up to 5.33x.
//
// WHY THE EXPORT AND NOT A REGEX. The sizes used to live inline in a template
// literal. A rule that scraped `font-size: (\d+)px` out of it would miss the
// title entirely — it is written `${cond ? long : short}px` — and would go
// green the moment someone reformatted the string. The scale is now a named
// export, so this reads the same value the card is built from.
//
// BOTH BRANCHES. The title has two steps and the long one is the one 59 of the
// 100 cards take, so checking only the nominal size would report a ratio that
// most cards do not have.
function ruleOgScaleJump(files) {
  void files;
  const rel = path.join("scripts", "assets", "build-og.js");
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const src = fs.readFileSync(abs, "utf8");
  const lineOfKey = (key) => {
    const m = new RegExp(`^\\s*${key}:`, "m").exec(src);
    return m ? src.slice(0, m.index).split("\n").length : 1;
  };

  let scale;
  try {
    ({ TYPE_SCALE: scale } = require(path.join(ROOT, rel)));
  } catch (err) {
    return [{ file: rel, line: 1, detail: `the card's type scale is not importable: ${err.message}` }];
  }
  if (!scale) return [{ file: rel, line: 1, detail: "build-og.js exports no TYPE_SCALE for this rule to read" }];

  const support = Object.entries(scale).filter(([, v]) => typeof v === "number");
  const found = [];
  for (const [branch, title] of Object.entries(scale.title || {})) {
    const sizes = [...support, [`title.${branch}`, title]];
    const max = sizes.reduce((a, b) => (a[1] >= b[1] ? a : b));
    const min = sizes.reduce((a, b) => (a[1] <= b[1] ? a : b));
    const ratio = max[1] / min[1];
    if (ratio >= 5 && ratio <= 12) continue;
    found.push({
      file: rel,
      line: lineOfKey(min[0].includes(".") ? "title" : min[0]),
      detail:
        `${branch} title: ${max[0]} ${max[1]}px over ${min[0]} ${min[1]}px is ${ratio.toFixed(2)}x, ` +
        `outside the 5-12x jump — ${min[0]} would have to be ${(max[1] / 12).toFixed(0)}-${(max[1] / 5).toFixed(0)}px`,
    });
  }
  return found;
}


// RULE 32 — density scale.
//
// DESIGN.md v5 says a lighter colour is the same plate laid down thinner, not a
// new ink. That makes coverage a scale, and this site already polices two other
// scales the same way: `tracking scale` and `radius scale` each hold a closed
// Set and reject anything outside it. This is the third of that shape.
//
// WHERE COVERAGE CAN ENTER, AND IT IS NOT ONE PLACE. An author reaches a step
// through a declaration (`rgb(var(--ink-rgb) / 0.12)`), through a solid token
// whose value IS that step (`--line-rgb`), or through a Tailwind utility whose
// slash carries it (`bg-ink/5`). The first two arrive as CSS and come from
// stylesheet.read(); the third is a class string in a template and never
// becomes author CSS at all. Reading only the CSS would leave the 185 call
// sites of `bg-ink/5` unchecked, which is the larger half.
const COLOUR_PROP = /^(?:color|background|background-color|border|border-color|border-(?:top|right|bottom|left)-color|outline-color|fill|stroke|text-decoration-color|box-shadow|caret-color|accent-color)$/;

function ruleDensityScale(files) {
  const sheet = stylesheet.read();
  const found = [];
  const ladder = [...plates.DENSITY_SCALE].join(", ");

  for (const d of sheet.declarations) {
    if (d.prop.startsWith("--")) continue;
    if (!COLOUR_PROP.test(d.prop)) continue;
    for (const step of plates.stepsIn(d.value, sheet)) {
      if (step.plate === null) continue;
      if (plates.onScale(step.coverage) !== null) continue;
      found.push({
        file: d.file,
        line: d.line,
        detail: `${d.selector} lays ${step.plate} at ${(step.coverage * 100).toFixed(1)}% — not a step on the scale (${ladder})`,
      });
    }
  }

  const utilities = [];
  for (const a of sheet.applied) utilities.push({ file: a.file, line: a.line, name: a.utility, where: a.selector });
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        utilities.push({ file: rel, line: html.slice(0, node.index).split("\n").length, name: c, where: `<${node.tag || "element"}>` });
      }
    }
  }
  for (const u of utilities) {
    const hit = plates.utilityCoverage(u.name);
    if (!hit) continue;
    if (plates.onScale(hit.coverage) !== null) continue;
    found.push({
      file: u.file,
      line: u.line,
      detail: `${u.name} lays ${hit.plate} at ${(hit.coverage * 100).toFixed(0)}% — not a step on the scale (${ladder})`,
    });
  }
  return found;
}


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

  for (const d of sheet.declarations) {
    if (d.prop.startsWith("--")) continue;
    if (!COLOUR_PROP.test(d.prop)) continue;
    for (const step of plates.stepsIn(d.value, sheet)) {
      if (step.plate !== null) continue;
      found.push({
        file: d.file,
        line: d.line,
        detail: `${d.selector} paints ${step.text} — no coverage of the ink or the accent over this paper produces it, so it is a third plate`,
      });
    }
  }

  const utilities = [];
  for (const a of sheet.applied) utilities.push({ file: a.file, line: a.line, name: a.utility });
  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        utilities.push({ file: rel, line: html.slice(0, node.index).split("\n").length, name: c });
      }
    }
  }
  for (const u of utilities) {
    if (!plates.foreignColourUtility(u.name)) continue;
    found.push({
      file: u.file,
      line: u.line,
      detail: `${u.name} reaches Tailwind's own palette — this vocabulary has two plates and that is not one of them`,
    });
  }
  return found;
}


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
const INTERACTIVE_TAGS = new Set(["a", "button", "label", "summary", ...CONTROL_TAGS]);
const INTERACTIVE_SELECTOR = /(^|[\s,>~+([])(a|button|input|select|textarea|label|summary)([\s,:.\[)]|$)|\.(btn|tag)\b|:(hover|active|focus|focus-visible|focus-within)\b|\[aria-(current|expanded|selected)/;

function isInteractiveNode(node) {
  if (INTERACTIVE_TAGS.has(node.tag)) return true;
  if (node.classes.some((c) => CONTROL_CLASSES.includes(c))) return true;
  return (node.ancestors || []).some(
    (a) => INTERACTIVE_TAGS.has(a.tag) || a.classes.some((c) => CONTROL_CLASSES.includes(c))
  );
}

function ruleAccentCarriesInteraction(files) {
  const sheet = stylesheet.read();
  const found = [];

  for (const d of sheet.declarations) {
    if (d.prop.startsWith("--")) continue;
    if (!COLOUR_PROP.test(d.prop)) continue;
    if (!plates.stepsIn(d.value, sheet).some((s) => s.plate === "primary")) continue;
    if (INTERACTIVE_SELECTOR.test(d.selector)) continue;
    found.push({
      file: d.file,
      line: d.line,
      detail: `${d.selector} paints the accent, and nothing in that selector can be clicked — the accent is the mark interaction gets, not a colour`,
    });
  }

  for (const { rel, html } of files) {
    for (const node of parseElements(html)) {
      for (const c of node.classes) {
        const hit = plates.utilityCoverage(c) || (/(?:^|:)(?:bg|text|border|ring|outline|decoration|fill|stroke|divide)-primary(?:-[a-z]+)?$/.test(c) ? { plate: "primary" } : null);
        if (!hit || hit.plate !== "primary") continue;
        if (isInteractiveNode(node)) continue;
        found.push({
          file: rel,
          line: html.slice(0, node.index).split("\n").length,
          detail: `<${node.tag}> carries ${c} but is not interactive and sits inside nothing that is`,
        });
      }
    }
  }
  return found;
}


// RULE 27 — scale jump.
//
// The reference set asks for one dramatic scale jump: the largest text is 5-12
// times the microcopy. Rule 30 asks it of the share card; this asks it of the
// pages, and the two read different files on purpose (30 reads build-og.js's
// TYPE_SCALE, this reads tailwind.config.js) because the site and the card
// carry two separate ladders and nothing compares them.
//
// IT READS THE LADDER, NOT A BREAKPOINT. `.display-lead` renders `text-4xl
// tablet:text-display-lg`, and text-4xl is Tailwind's own 2.25rem — so the
// largest type actually painted on a phone is 36px, a 3.0x jump. Measuring what
// a viewport shows would make this rule report the breakpoint rather than the
// vocabulary, and go red on a phone for a decision the scale never made.
//
// RATIOS DO NOT NEED PIXELS. Every step is declared in rem, so the jump is
// 3.5rem / 0.75rem whatever the root font size happens to be. This site has had
// its root inflated to 17px once already (the reading-measure note in DESIGN.md
// records what that cost), and a rule that converted to px would have quietly
// moved with it.
const TYPE_LADDER_MIN = 5;
const TYPE_LADDER_MAX = 12;

function ruleScaleJump() {
  const config = path.join(ROOT, "tailwind.config.js");
  if (!fs.existsSync(config)) return [];
  let scale;
  try {
    scale = require(config)?.theme?.extend?.fontSize;
  } catch (err) {
    return [{ file: "tailwind.config.js", line: 1, detail: `the type scale is not readable: ${err.message}` }];
  }
  if (!scale) return [{ file: "tailwind.config.js", line: 1, detail: "theme.extend.fontSize declares no scale for this rule to read" }];

  const text = fs.readFileSync(config, "utf8");
  const steps = [];
  for (const [name, value] of Object.entries(scale)) {
    const size = Array.isArray(value) ? value[0] : value;
    const rem = /^([\d.]+)rem$/.exec(String(size));
    if (!rem) continue;
    steps.push({ name, rem: Number(rem[1]) });
  }
  if (steps.length < 2) return [];

  const largest = steps.reduce((a, b) => (a.rem >= b.rem ? a : b));
  const smallest = steps.reduce((a, b) => (a.rem <= b.rem ? a : b));
  const jump = largest.rem / smallest.rem;
  if (jump >= TYPE_LADDER_MIN && jump <= TYPE_LADDER_MAX) return [];

  const m = new RegExp(`^\\s*"?${largest.name}"?:`, "m").exec(text);
  return [
    {
      file: "tailwind.config.js",
      line: m ? text.slice(0, m.index).split("\n").length : 1,
      detail:
        `${largest.name} ${largest.rem}rem over ${smallest.name} ${smallest.rem}rem is ${jump.toFixed(2)}x, ` +
        `outside the ${TYPE_LADDER_MIN}-${TYPE_LADDER_MAX}x jump — ${largest.name} would have to be ` +
        `${(smallest.rem * TYPE_LADDER_MIN).toFixed(2)}-${(smallest.rem * TYPE_LADDER_MAX).toFixed(2)}rem`,
    },
  ];
}

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
    summary: "the gap after a section rule is pt-16, pt-12, or a cover's own 96px",
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
];

function main() {
  const files = walk(TEMPLATES).map((file) => ({
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
