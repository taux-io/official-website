// Scroll parallax.
//
//   <div data-parallax="0.35">…</div>
//
// The number is how much of the scroll distance the element keeps: 0.35 means
// it travels a third as far as the page, so it reads as further away. Negative
// values move it against the scroll.
//
// This only ever writes `transform`. Nothing here decides whether content is
// visible — the previous scroll effect on this site set opacity from
// JavaScript and left 19 elements permanently invisible when a fast scroll
// outran its observer, which is not a failure mode worth reintroducing for a
// sense of depth. With this script absent or broken the page is simply still.
//
// Reads are batched before writes and the whole pass runs inside one
// requestAnimationFrame, so scrolling never interleaves getBoundingClientRect
// with a style change and forces synchronous layout.

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const items = [];
  let ticking = false;

  function update() {
    ticking = false;
    const viewportHeight = window.innerHeight;

    // Read every position first, then write every transform.
    const offsets = items.map(({ factor, anchor }) => {
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewportHeight) return null;

      // Progress across the anchor's full pass through the viewport: 0 as its
      // top meets the bottom edge, 1 as its bottom leaves the top edge.
      const progress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
      // Centred on the midpoint so the offset is zero when the section is
      // squarely in view, and bounded at half its height times the factor.
      // Measuring from the entry point instead would leave a hero at the top of
      // the page displaced by a full viewport before the reader has scrolled.
      return (progress - 0.5) * rect.height * factor;
    });

    offsets.forEach((offset, i) => {
      const { el } = items[i];
      if (offset === null) return;
      el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function clear() {
    items.forEach(({ el }) => {
      el.style.transform = "";
      el.style.willChange = "";
    });
  }

  function init() {
    const nodes = document.querySelectorAll("[data-parallax]");
    if (!nodes.length) return;

    items.length = 0;
    nodes.forEach((el) => {
      const factor = parseFloat(el.dataset.parallax);
      if (!Number.isFinite(factor) || factor === 0) return;
      items.push({
        el,
        factor,
        // Measure the section rather than the element: the element is the thing
        // being moved, so measuring it would feed its own transform back in.
        anchor: el.parentElement || el,
      });
    });
    if (!items.length) return;

    if (reduceMotion.matches) {
      clear();
      return;
    }

    items.forEach(({ el }) => {
      el.style.willChange = "transform";
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  function onMotionChange() {
    if (reduceMotion.matches) {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clear();
    } else {
      init();
    }
  }

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", onMotionChange);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
