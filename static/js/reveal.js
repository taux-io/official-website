// Scroll reveal, written so it cannot take the content with it.
//
//   <section data-reveal>…</section>
//
// DESIGN.md decision #13 banned this outright, and not on taste: the previous
// attempt let an IntersectionObserver decide whether text was visible, a fast
// scroll outran it, and nineteen elements on the home page stayed invisible
// permanently. Issue 156 overturns the ban. It does not overturn the reason.
//
// So the direction of the mechanism is inverted from the usual one. Nothing
// ships hidden. The markup carries `data-reveal` and no visual state; the CSS
// hidden state lives behind `html.js-reveal`, a class this file adds only
// after it has proven it can run. Then:
//
//   * script absent, blocked by CSP, 404, or throwing before this line
//       -> no class, no hidden state, every element painted. Same page as
//          before issue 156, minus the animation.
//   * IntersectionObserver missing
//       -> the class is never added, same outcome.
//   * observer registered but never fires, fires late, or loses a race
//       -> the failsafe timer reveals everything regardless.
//   * prefers-reduced-motion
//       -> the class is never added, and the CSS is inside a
//          no-preference query as well. Guarded twice on purpose; this is the
//          failure mode with a scar.
//
// The invariant is one sentence: NO PATH THROUGH THIS FILE CAN LEAVE TEXT
// HIDDEN. Every branch either reveals or never hides.

(() => {
  "use strict";

  const REVEALED = "is-revealed";
  const ENABLE = "js-reveal";
  // Long enough that a normal reveal has happened on its own, short enough
  // that a reader who scrolled past during a stall is not left waiting.
  const FAILSAFE_MS = 1500;

  function start() {
    const nodes = document.querySelectorAll("[data-reveal]");
    if (!nodes.length) return;

    // Asked once at start-up rather than watched. Changing the preference
    // mid-visit is rare, and re-running would mean adding a hidden state to a
    // page the reader is already looking at — the one thing this file must
    // never do.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const revealAll = () => {
      for (const el of nodes) el.classList.add(REVEALED);
    };

    // The hidden state starts here, and everything after this line is a
    // guarantee that it ends.
    document.documentElement.classList.add(ENABLE);

    // Whatever happens to the observer, this fires.
    const failsafe = setTimeout(revealAll, FAILSAFE_MS);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add(REVEALED);
          observer.unobserve(entry.target);
        }
      },
      {
        // A little before the edge, so the motion reads as the block settling
        // into place rather than catching up after it is already in view.
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.01,
      }
    );

    for (const el of nodes) observer.observe(el);

    // Anything already on screen at load reveals immediately rather than
    // animating — a block the reader is looking at should not move.
    requestAnimationFrame(() => {
      for (const el of nodes) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add(REVEALED);
          observer.unobserve(el);
        }
      }
    });

    // A page hidden and restored (bfcache, tab switch) can strand pending
    // entries; take the whole thing off the observer's hands at that point.
    window.addEventListener(
      "pagehide",
      () => {
        clearTimeout(failsafe);
        revealAll();
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
