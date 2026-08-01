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
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
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
      fontSize: {
        // Latin eyebrows and section numbers: uppercase, widely tracked. This
        // is where the SpaceX typographic signature lives, since CJK has no
        // uppercase to borrow it from.
        //
        // display-md is currently unused. Kept for the completeness of the
        // scale: removing the middle step leaves lg and sm with a gap between
        // them, and the next person needing that size invents a one-off.
        eyebrow: [
          "0.75rem",
          { lineHeight: "1", letterSpacing: "0.25em", fontWeight: "500" },
        ],
        "display-lg": ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        "display-md": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "display-sm": ["2rem", { lineHeight: "1.15", letterSpacing: "0" }],
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
