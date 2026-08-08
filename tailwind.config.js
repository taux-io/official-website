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
        surface: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          deep: "rgb(var(--surface-deep-rgb) / <alpha-value>)",
          raised: "rgb(var(--surface-raised-rgb) / <alpha-value>)",
        },
        // One ink; the steps are alpha. The <alpha-value> placeholder cannot
        // survive that: it is substituted with the opacity modifier or with 1,
        // so there is no way to express "0.8 unless told otherwise". Baking the
        // alpha means `text-ink-body/50` no longer composes — nothing uses it,
        // and `line` below has always been written this way for the same
        // reason. The surfaces keep the placeholder, which is what bg-surface-
        // deep/90 in the header depends on.
        ink: {
          DEFAULT: "rgb(var(--ink-rgb))",
          body: "rgb(var(--ink-rgb) / 0.8)",
          muted: "rgb(var(--ink-rgb) / 0.9)",
        },
        // Fixed at two weights on purpose — a divider and a control edge. More
        // steps than that is how hairlines drift back into decoration.
        line: {
          DEFAULT: "rgb(var(--line-rgb) / 0.08)",
          strong: "rgb(var(--line-rgb) / 0.35)",
        },

        // The one accent. Keeps <alpha-value> so `text-phosphor/80` composes.
        //
        // Measured on --surface: /100 is 10.80:1, /70 is 5.63:1, /65 is 4.98:1,
        // and /60 is 4.38:1 — under the 4.5:1 AA floor. So /65 is the lowest
        // step that holds for text, not /60. The contrast audit catches a
        // mistake here, which is the safety net rather than a licence to probe
        // downwards.
        phosphor: "rgb(var(--phosphor-rgb) / <alpha-value>)",
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
        // this look the same on every machine. The system stack stays behind it
        // for the glyphs outside the Latin subset.
        //
        // STAGE 2 INSERTS THE CJK FACES AHEAD OF ui-monospace, AND THAT IS A
        // VISIBLE CHANGE, NOT A NO-OP. Roboto Mono's unicode-range excludes CJK,
        // so 14 elements already on the site — the branded τ on about.html and
        // thirteen Chinese labels across pqc-migration, threat-landscape,
        // owasp-llm-top-10 and agent-prompting-guide — resolve today to
        // SF Mono / Consolas and would resolve to PingFang TC instead. That
        // belongs in the stage that expects visual change, next to the eyebrow
        // work that needs it. See DESIGN.md decision #35.
        mono: [
          "Roboto Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
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
        base: ["1rem", { lineHeight: "1.6", letterSpacing: "0" }],

        // LINE-HEIGHT BELOW 1 IS FOR LATIN ONLY. A CJK glyph fills its em box
        // and has no descender gap to give back, so 0.9 crops strokes rather
        // than tightening the line. display-lg is therefore only safe on
        // .display-lead; anything Chinese wearing this token needs its own
        // leading, and until #55 replaces those headings a few still do.
        "display-sm": ["2rem", { lineHeight: "1", letterSpacing: "0", fontWeight: "700" }],
        "display-md": ["3rem", { lineHeight: "1", letterSpacing: "0.02em", fontWeight: "700" }],
        "display-lg": ["3.75rem", { lineHeight: "0.9", letterSpacing: "-0.017em", fontWeight: "700" }],
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
