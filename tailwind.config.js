/** @type {import('tailwindcss').Config} */
module.exports = {
  // Vendored libraries are excluded. Tailwind scans these files as text and
  // takes any token that looks like a utility, so a third-party bundle donates
  // class names it never meant to: chart.umd.min.js contains the word `italic`
  // for its font handling, and that alone added a `.italic` rule to the
  // stylesheet nothing on the site uses. Harmless at 26 bytes and unbounded in
  // principle — the next library decides what ships next. Our own JS still
  // counts, because tau-curve.js and friends really do name classes.
  content: [
    "./templates/**/*.html",
    "./static/js/**/*.js",
    "!./static/js/vendor/**",
  ],
  theme: {
    // Six steps, and they REPLACE Tailwind's defaults rather than sitting
    // beside them. This is the contract half of the expand/migrate/contract
    // that moved 204 call sites: with every template on the named steps, the
    // defaults are dead vocabulary, and dead vocabulary is what the next person
    // reaches for by habit.
    //
    // Outside `extend` on purpose — inside it, sm/md/lg/xl/2xl survive.
    screens: {
      mobile: "600px",
      tablet: "768px",
      laptop: "961px",
      desktop: "1280px",
      wide: "1500px",
    },
    extend: {
      // Semantic names only. The values live in :root in src/input.css, so a
      // palette change is one file and seven variables rather than a sweep
      // through seventeen templates. The <alpha-value> placeholder keeps
      // Tailwind's opacity modifiers working: bg-surface/50, text-ink/70.
      colors: {
        // One surface, three inks, one accent, one hairline. Values live in
        // src/input.css; nothing here carries a literal. The <alpha-value>
        // placeholder is load-bearing — bg-ink/5 is the code-chip and row-hover
        // fill, and deleting it as dead would take every call site with it.
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          muted: "rgb(var(--ink-muted-80-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-muted-48-rgb) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          focus: "rgb(var(--primary-focus-rgb) / <alpha-value>)",
        },
        line: "rgb(var(--line-rgb) / <alpha-value>)",
      },
      fontFamily: {
        // SF Pro on Apple platforms, system-ui everywhere else, CJK from the
        // system in both cases. Nothing is self-hosted — see the note at the top
        // of input.css and DESIGN.md decision #54 for the cost that buys.
        sans: [
          "SF Pro Text",
          "system-ui",
          "-apple-system",
          // One token, five faces — src/input.css swaps it on the root's lang.
          // Three Traditional faces hard-coded here rendered Japanese kanji in
          // Chinese shapes; see decision #55.
          "var(--cjk)",
          "sans-serif",
        ],
        display: [
          "SF Pro Display",
          "system-ui",
          "-apple-system",
          // One token, five faces — src/input.css swaps it on the root's lang.
          // Three Traditional faces hard-coded here rendered Japanese kanji in
          // Chinese shapes; see decision #55.
          "var(--cjk)",
          "sans-serif",
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
        // The six declared steps, and every Tailwind alias points at one of them
        // so that `rounded-2xl` cannot quietly introduce a seventh value. The
        // `radius scale` rule holds the class names; this holds the values.
        none: "var(--radius)",
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-lg)",
        "2xl": "var(--radius-lg)",
        "3xl": "var(--radius-lg)",
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
        // The Apple ladder. Weights are 300 / 400 / 600 / 700 with 500
        // deliberately absent; body is always 400, inline strong 600, display
        // 600 — not 700, which is why the display steps no longer carry it.
        //
        // NEGATIVE TRACKING IS BACK, three hours after decision #53 deleted it
        // for being the previous reference site's signature. It is this one's
        // signature too, at different values: the tighter the display size the
        // more it closes up.
        eyebrow: ["0.75rem", { lineHeight: "2", letterSpacing: "0.09em", fontWeight: "600" }],
        caption: ["0.875rem", { lineHeight: "1.43", letterSpacing: "0", fontWeight: "400" }],
        nav: ["0.75rem", { lineHeight: "1", letterSpacing: "0", fontWeight: "400" }],
        button: ["1.0625rem", { lineHeight: "1.2", letterSpacing: "-0.022em", fontWeight: "600" }],
        // Body is 17px and the leading floor is 1.47. The editorial leading is
        // part of the brand — DESIGN.md forbids going below it.
        base: ["1.0625rem", { lineHeight: "1.47", letterSpacing: "-0.022em" }],
        lg: ["1.3125rem", { lineHeight: "1.48", letterSpacing: "0.011em" }],
        xl: ["1.5rem", { lineHeight: "1.4", letterSpacing: "0" }],
        "display-sm": ["2.125rem", { lineHeight: "1.18", letterSpacing: "-0.011em", fontWeight: "600" }],
        "display-md": ["2.5rem", { lineHeight: "1.1", letterSpacing: "0", fontWeight: "600" }],
        "display-lg": ["3.5rem", { lineHeight: "1.07", letterSpacing: "-0.005em", fontWeight: "600" }],
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
