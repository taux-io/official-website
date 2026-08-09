// The control-hierarchy explainer on /what-is-mcp.
//
//   <div data-mcp-primitives>
//     <button data-scenario="resource">…</button>   ← becomes a tab
//     <section data-panel="resource">…</section>    ← becomes a tabpanel
//
// Three scenarios, three answers. The point it exists to make is that the
// difference between a resource and a tool is not read-versus-write — it is who
// decides. That is a thing people have to try on a few cases before it lands,
// which is the only reason this is interactive at all.
//
// WITHOUT THIS SCRIPT EVERY PANEL IS VISIBLE. The markup ships with all three
// expanded and the script's job is to collapse them to one at a time. That is
// the same contract as the section index (DESIGN.md decision #21): the script
// changes how much you see at once, never whether the content is there. A
// crawler, a reader with JS disabled, and a reader whose network dropped this
// file all get the whole lesson.
//
// It also means nothing here may set opacity or visibility from JavaScript.
// Panels are removed from the flow with `hidden`, which is honest about the
// content being gone rather than painting over it — check:design's "no scroll
// reveal" rule exists because an earlier effect on this site left nineteen
// elements permanently invisible.

(() => {
  "use strict";

  function setup(root) {
    const tabs = [...root.querySelectorAll("[data-scenario]")];
    const panels = new Map(
      [...root.querySelectorAll("[data-panel]")].map((el) => [el.dataset.panel, el])
    );
    if (tabs.length < 2 || panels.size !== tabs.length) return;

    // The tablist role is only correct once the script is running — before that
    // it is a list of headings over open sections, which is what it looks like.
    const list = root.querySelector("[data-tablist]");
    if (list) list.setAttribute("role", "tablist");

    tabs.forEach((tab, i) => {
      const name = tab.dataset.scenario;
      const panel = panels.get(name);
      if (!panel) return;
      tab.setAttribute("role", "tab");
      tab.setAttribute("id", `mcp-tab-${name}`);
      tab.setAttribute("aria-controls", `mcp-panel-${name}`);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("id", `mcp-panel-${name}`);
      panel.setAttribute("aria-labelledby", `mcp-tab-${name}`);
      panel.setAttribute("tabindex", "0");
      tab.setAttribute("tabindex", i === 0 ? "0" : "-1");
    });

    function select(name, moveFocus) {
      // If focus is inside the panel about to be hidden, move it to the tab
      // that now owns the answer. Hiding an element that holds focus drops it
      // to <body>, and the next Tab restarts at the site header — a reader
      // seven sections into an article is thrown back to the top with no
      // announcement. It is reachable without any keyboard at all: on Safari
      // and Firefox for macOS a button click does not move focus, so a reader
      // who tabbed into the panel and then clicked another scenario hits it.
      const active = document.activeElement;
      const losingFocus = [...panels.values()].some(
        (panel) => !panel.hidden && panel !== panels.get(name) && panel.contains(active)
      );

      tabs.forEach((tab) => {
        const on = tab.dataset.scenario === name;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.setAttribute("tabindex", on ? "0" : "-1");
        if (on && (moveFocus || losingFocus)) tab.focus();
      });
      panels.forEach((panel, key) => {
        panel.hidden = key !== name;
      });
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => select(tab.dataset.scenario, false));
    });

    // Left/Right move between tabs, Home/End jump to the ends. Without this a
    // keyboard user has to tab through every panel's contents to reach the next
    // scenario, which is the failure that makes tab widgets worse than the
    // headings they replaced.
    //
    // Deliberately NOT Up/Down. This tablist is horizontal, which is the ARIA
    // default, and the APG binds only Left/Right for that orientation. Binding
    // the vertical keys as well meant calling preventDefault on them, so a
    // reader who had focused a tab could no longer scroll the page with the
    // arrow keys — the page simply stopped responding to them.
    //
    // Modifier combinations are left alone for the same reason: Alt+Left is
    // Back on Windows and Linux, and Cmd+Home jumps to the top of the document.
    // Swallowing either to change a tab is a worse trade than any keyboard
    // convenience this widget can offer.
    root.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      let next = null;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      select(tabs[next].dataset.scenario, true);
    });

    select(tabs[0].dataset.scenario, false);
  }

  function init() {
    document.querySelectorAll("[data-mcp-primitives]").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
