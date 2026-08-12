/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  theme: {
    extend: {
      // Semantic names only. The values live in :root in src/input.css, so a
      // palette change is one file and seven variables rather than a sweep
      // through seventeen templates. The <alpha-value> placeholder keeps
      // Tailwind's opacity modifiers working: bg-surface/50, text-ink/70.
      colors: {
        // One surface, one ink, one hairline. The three-step surface, the three
        // alpha steps of ink and the two hairline weights all collapsed with the
        // brand reset — see DESIGN.md decision #53. Names are semantic and the
        // values live in src/input.css; nothing here carries a literal.
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
      },
      fontFamily: {
        // D-DIN carries the Latin; CJK falls through to the system faces,
        // which avoids shipping a Traditional Chinese webfont on pages whose
        // search performance depends on LCP. PingFang and Microsoft JhengHei
        // sit comfortably next to DIN.
        sans: [
          "D-DIN",
          "PingFang TC",
          "Microsoft JhengHei",
          "Noto Sans TC",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "D-DIN Condensed",
          "D-DIN",
          "PingFang TC",
          "Microsoft JhengHei",
          "Noto Sans TC",
          "sans-serif",
        ],
        // Self-hosted, so the dates, section numbers and measurements that use
        // this look the same on every machine.
        //
        // THE CJK FACES ARE LOAD-BEARING AND MUST STAY AHEAD OF ui-monospace.
        // Roboto Mono's unicode-range excludes CJK, so Chinese in a mono run
        // falls through this list. With the system faces here it lands on
        // PingFang TC or Microsoft JhengHei — the same faces the rest of the
        // site uses. Remove them and it falls to generic `monospace`, which on
        // Windows is MingLiU: a serif the site sets nowhere else, on 95 of the
        // 186 eyebrows. That regression is invisible from a Mac.
        //
        // This is what makes `.eyebrow` monospace possible without a Latin-only
        // variant applied by hand 91 times. It is the same mechanism `sans`
        // already relies on — D-DIN carries no CJK either.
        //
        // Nothing checks this; DESIGN.md decision #35 records that as a known,
        // accepted cost rather than an oversight.
        mono: [
          "Roboto Mono",
          // The Latin monospace fallbacks come BEFORE the CJK faces, and the
          // order is load-bearing in both directions.
          //
          // Roboto Mono's subset carries no arrows, no maths and no geometric
          // shapes, so → ≥ ≈ ∞ ● ★ all fall through. Put PingFang TC ahead of
          // these and it answers first with a FULL-WIDTH advance: → goes from
          // 12.04px to 20.0px at 20px type, and the hand-aligned ASCII flow
          // diagram on adk-skill-patterns.html comes apart by 5.6px a line.
          // Behind them, SF Mono answers instead and the cell width holds.
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          // None of the faces above carries CJK, so Chinese still reaches these
          // — the same faces the rest of the site uses. Without them it lands on
          // generic `monospace`, which on Windows is MingLiU: a serif this site
          // sets nowhere else, on 95 of the 186 eyebrows, invisibly from a Mac.
          "PingFang TC",
          "Microsoft JhengHei",
          "Noto Sans TC",
          "monospace",
        ],
        // Departure Mono only. No fallback chain worth writing: this stack is
        // for blocks that are entirely pixel-set, and if the face fails to load
        // the right outcome is the generic monospace the browser picks, not a
        // half-pixel hybrid.
        pixel: ["Departure Mono", "monospace"],
      },
      // Every rectangular step collapses to the radius token; `full` is kept
      // so genuine circles survive.
      //
      // Most of these steps are unused by the templates and must stay anyway.
      // They are not dead entries — they are what enforces the rule. Delete the
      // unused ones and a later `rounded-md` falls back to Tailwind's own
      // 0.375rem, so the square-corner decision breaks silently, with no error
      // and nothing in the diff to explain it.
      borderRadius: {
        none: "0px",
        // The only step that is not square. Named for what may use it rather
        // than for a size, so `rounded-control` reads as a claim about the
        // element — and check-design.js can hold you to it.
        control: "var(--radius-control)",
        sm: "var(--radius)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius)",
        full: "9999px",
      },
      // One scale, and the tracking changes sign along it: positive on small
      // caps, zero on buttons and body, negative on the largest display step.
      // That progression is the measured behaviour of the reference site, and
      // stating it as a scale is what stops the next size from being chosen on
      // its own. check-design.js holds arbitrary tracking values to this set.
      //
      // Weights sit in the tokens because DIN carries only 400 and 700; a
      // display step is always the bold face, an eyebrow is always the regular
      // one, and leaving that to a utility is how font-semibold ends up
      // synthesised against a face that has no such weight.
      fontSize: {
        eyebrow: [
          "0.75rem",
          { lineHeight: "1", letterSpacing: "0.09em", fontWeight: "400" },
        ],
        nav: [
          "0.8125rem",
          { lineHeight: "1", letterSpacing: "0.09em", fontWeight: "400" },
        ],
        button: [
          "0.75rem",
          { lineHeight: "1", letterSpacing: "0", fontWeight: "400" },
        ],
        // 1.6 rather than Tailwind's 1.5. CJK sets denser than Latin and reads
        // better with the extra leading over a long measure.
        //
        // THE THREE BODY STEPS MOVE TOGETHER OR NOT AT ALL. 16px was small for
        // a site that is dark-ground and mostly Chinese, but lifting `base`
        // alone puts it 1px from Tailwind's stock `lg` (18px) and the ladder
        // collapses — effort spent on size, paid for in hierarchy. Lifting `lg`
        // to 19px then leaves it 1px from stock `xl` (20px), so the same
        // squeeze simply moves up a rung; `xl` has to give way too. It is not a
        // rung to sacrifice: `.display-sub` wears it at phone width, which is
        // the one line on a phone that most needs to be readable.
        //
        // The alternative — scaling the root font-size — was rejected. It
        // enlarges every rem-based gap and max-width by the same factor, and
        // #137 had just tightened that spacing on purpose. The two moves would
        // have cancelled.
        base: ["1.0625rem", { lineHeight: "1.6", letterSpacing: "0" }],
        lg: ["1.1875rem", { lineHeight: "1.6", letterSpacing: "0" }],
        xl: ["1.375rem", { lineHeight: "1.5", letterSpacing: "0" }],

        // LINE-HEIGHT BELOW 1 IS FOR LATIN ONLY. A CJK glyph fills its em box
        // and has no descender gap to give back, so anything under 1 crops
        // strokes rather than tightening the line. These tokens are therefore
        // only safe on .display-lead; anything Chinese wearing one needs its
        // own leading, and until #55 replaces those headings a few still do.
        //
        // display-lg was 0.9 and is now 1. The lead line wraps since #133, and
        // 0.9 was chosen when it never did — two lines set at 0.9 sit almost on
        // top of each other. This does NOT license loosening .display-sub's own
        // 1.15: that value protects CJK strokes and has nothing to do with what
        // the Latin line above it does.
        //
        // display-sm carries the h2 on every inner page. At 2rem against 17px
        // body it was only a shade over twice the size, and Chinese has no
        // capitals to help a heading separate from the text around it, so
        // headings did not surface when scanning. 2.25rem is the smaller of the
        // two steps considered — this change already moves layout, size,
        // leading and ink at once, and taking the top of every range leaves
        // nothing to attribute a regression to.
        "display-sm": ["2.25rem", { lineHeight: "1", letterSpacing: "0", fontWeight: "700" }],
        "display-md": ["3rem", { lineHeight: "1", letterSpacing: "0.02em", fontWeight: "700" }],
        "display-lg": ["3.75rem", { lineHeight: "1", letterSpacing: "-0.017em", fontWeight: "700" }],
      },
      maxWidth: {
        // 68ch is the reading measure for the long-form pages; CJK runs denser
        // than Latin, so the comfortable line is shorter than the usual 75ch.
        prose: "68ch",
      },
    },
  },
  plugins: [],
};
