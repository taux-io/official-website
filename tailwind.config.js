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
        ink: {
          DEFAULT: "rgb(var(--text-primary-rgb) / <alpha-value>)",
          body: "rgb(var(--text-body-rgb) / <alpha-value>)",
          muted: "rgb(var(--text-muted-rgb) / <alpha-value>)",
        },
        // Fixed at two weights on purpose — a divider and a button edge. More
        // steps than that is how hairlines drift back into decoration.
        line: {
          DEFAULT: "rgb(var(--line-rgb) / 0.08)",
          strong: "rgb(var(--line-rgb) / 0.2)",
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
      borderRadius: {
        none: "0px",
        sm: "var(--radius)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius)",
        full: "9999px",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      fontSize: {
        // Latin eyebrows and section numbers: uppercase, widely tracked. This
        // is where the SpaceX typographic signature lives, since CJK has no
        // uppercase to borrow it from.
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
        content: "64rem",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
    },
  },
  plugins: [],
};
