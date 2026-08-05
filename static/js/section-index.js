// Marks which section of a long-form page the reader is currently in.
//
//   <nav data-section-index>
//     <a href="#llm01">…</a>
//     …
//   </nav>
//
// The rail this drives is a plain list of anchors. It is fully usable before
// this file loads, if this file fails to load, and if this file throws: ten
// links that scroll to ten sections. All that is lost is knowing which one you
// are in, and knowing is the decoration here — the navigating is the content.
// With this script absent the page is simply unmarked, the same bargain
// parallax.js makes when it says the page is simply still.
//
// This only ever moves an `aria-current` attribute. It never writes `opacity`,
// never adds or removes a node, and never touches the sections themselves.
// DESIGN.md bans scroll reveal because this site once shipped text whose
// visibility depended on an observer keeping up with the scroll, and nineteen
// elements on the home page lost that race permanently. Nothing here can fail
// that way: the worst outcome is the wrong entry marked for a frame.
//
// Reads are batched ahead of writes and the pass runs inside one
// requestAnimationFrame, so scrolling never interleaves getBoundingClientRect
// with a style change and forces synchronous layout — the same discipline
// parallax.js follows, for the same reason.

(() => {
  "use strict";

  const nav = document.querySelector("[data-section-index]");
  if (!nav) return;

  const entries = [];
  for (const link of nav.querySelectorAll('a[href^="#"]')) {
    const section = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    // A link pointing at nothing is a bug, but it is check:design's bug to
    // report at build time, not this file's to crash over at runtime.
    if (section) entries.push({ link, section });
  }
  if (!entries.length) return;

  // Where in the viewport a section counts as "the one being read". A third
  // down rather than the very top: a heading that has just scrolled past the
  // top edge is what the reader is looking at, not the one still below it.
  const LINE = 0.33;

  let ticking = false;
  let current = null;

  function update() {
    ticking = false;
    const mark = window.innerHeight * LINE;

    // Read every position, then write. Never interleaved.
    const tops = entries.map(({ section }) => section.getBoundingClientRect().top);

    // The last section that has crossed the line. Before the first one does,
    // the first entry stands — the reader is above the body, and an unmarked
    // rail reads as broken rather than as accurate.
    let active = 0;
    for (let i = 0; i < tops.length; i++) {
      if (tops[i] <= mark) active = i;
    }

    if (active === current) return;
    if (current !== null) entries[current].link.removeAttribute("aria-current");
    entries[active].link.setAttribute("aria-current", "true");
    current = active;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
})();
