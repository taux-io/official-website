// The two interactive parts of /mattpocock-skills.
//
//   <div data-skills-flow>
//     <ol data-flow> … <a data-flow-node href="#skill-x"> …
//     <div data-flow-panel hidden>            ← filled here
//     <p data-flow-status role="status">      ← announces what changed
//   <ol data-phase-tree>                      ← five questions, read here
//
// WITHOUT THIS SCRIPT NOTHING IS MISSING. Every node is a link to the section
// that says the same thing, the decision tree is an ordered list, and the panel
// does not exist. The script adds a way to see one skill beside the diagram and
// to answer the five questions one at a time; it never removes content. Both
// parts read the page's own HTML (the sections, the list items, the option
// entries) and carry no data of their own, so the page, its Markdown twin and
// this script cannot disagree about what a skill is.
//
// Nothing here writes a style. The CSP is `style-src 'self'`, and the only
// state this file keeps in the document is `hidden`, `aria-*`, `data-*` and
// the nodes it inserts; how any of it looks is the stylesheet's business.
// (scripts/check-mattpocock-skills.js reads this file for the ways to break
// that, because only a browser would notice otherwise.)

(() => {
  "use strict";

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    for (const kid of kids) node.append(kid);
    return node;
  }

  function button(label, onClick) {
    const b = el("button", { type: "button", class: "skills-flow-tool" }, label);
    b.addEventListener("click", onClick);
    return b;
  }

  // A copy with every id stripped: the sections keep theirs, and two elements
  // with one id make every #fragment on the page ambiguous.
  function copyOf(node) {
    const c = node.cloneNode(true);
    c.removeAttribute("id");
    c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    return c;
  }

  // ---------------------------------------------------------------- flow

  function setupFlow(root) {
    const panel = root.querySelector("[data-flow-panel]");
    const status = root.querySelector("[data-flow-status]");
    const nodes = [...root.querySelectorAll("[data-flow-node]")];
    if (!panel || !status || nodes.length === 0) return;

    const byName = new Map();
    for (const n of nodes) {
      const id = (n.getAttribute("href") || "").slice(1);
      if (id.startsWith("skill-") && document.getElementById(id)) byName.set(id, n);
    }
    if (byName.size === 0) return;

    let current = null;

    function placeholder() {
      panel.replaceChildren(el("p", {}, "點流程圖上的一個 skill，這裡會顯示它的說明。"));
      panel.setAttribute("data-empty", "");
    }

    function announce(text) {
      // Cleared first so the same text twice (open, close, open) still speaks.
      status.textContent = "";
      requestAnimationFrame(() => {
        status.textContent = text;
      });
    }

    function visible() {
      const r = panel.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    }

    function reveal() {
      if (panel.hidden || visible()) return;
      panel.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
    }

    function open(id, how) {
      const node = byName.get(id);
      const section = document.getElementById(id);
      if (!node || !section) return;
      current = id;
      byName.forEach((n, key) => {
        if (key === id) n.setAttribute("aria-current", "true");
        else n.removeAttribute("aria-current");
      });

      const body = copyOf(section);
      const kids = [...body.childNodes];
      const sentence = body.querySelector("p");
      panel.replaceChildren(...kids);
      panel.append(
        el(
          "div",
          { class: "skills-flow-actions" },
          button("關閉", () => close({ push: true, focus: true })),
          el("a", { href: "#" + id, class: "skills-flow-more" }, "看下方完整段落"),
        ),
      );
      panel.removeAttribute("data-empty");
      panel.hidden = false;

      const name = id.slice("skill-".length);
      announce(`${name} 的說明已顯示在流程圖${window.innerWidth >= 961 ? "旁邊" : "下方"}。${sentence ? sentence.textContent.trim() : ""}`);

      if (how.push) history.pushState({ skillsFlow: id }, "", "#" + id);
      if (how.scroll) reveal();
      // Focus goes to the panel only when the reader got here by keyboard (or
      // an assistive technology, whose activation also reports detail 0). A
      // mouse reader's focus stays on the node they pressed.
      if (how.focus) panel.focus({ preventScroll: true });
    }

    function close(how) {
      const was = current;
      current = null;
      byName.forEach((n) => n.removeAttribute("aria-current"));
      placeholder();
      announce("skill 說明已關閉。");
      if (how.push) history.pushState({ skillsFlow: null }, "", location.pathname + location.search);
      // The panel held focus or the close button did; the node that opened it
      // is where the reader was, so that is where they go back to.
      if (how.focus && was && byName.get(was)) byName.get(was).focus();
    }

    root.setAttribute("data-live", "");
    panel.hidden = false;
    placeholder();

    nodes.forEach((n) => {
      const id = (n.getAttribute("href") || "").slice(1);
      if (!byName.has(id)) return;
      n.setAttribute("aria-controls", panel.id || (panel.id = "skills-flow-panel"));
      n.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        open(id, { push: current !== id, scroll: true, focus: e.detail === 0 });
      });
      // A link answers Enter and not Space. The panel is a control in all but
      // tag, and a keyboard reader should not have to know the difference.
      n.addEventListener("keydown", (e) => {
        if (e.key !== " " || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        n.click();
      });
    });

    // Previous and next skill inside the panel are links to sections; when the
    // target is another node they open its panel instead of scrolling away.
    panel.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href^='#skill-']");
      if (!a || !panel.contains(a) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const id = a.getAttribute("href").slice(1);
      if (!byName.has(id) || a.classList.contains("skills-flow-more")) return;
      e.preventDefault();
      open(id, { push: current !== id, scroll: true, focus: true });
    });

    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && current) {
        e.preventDefault();
        close({ push: true, focus: true });
      }
    });

    // Back and forward follow the hash. A hash that is not a node (or none)
    // is the panel closed. Nothing is scrolled or focused: the browser has
    // already put the reader where the history entry was.
    window.addEventListener("popstate", () => {
      const id = location.hash.slice(1);
      if (byName.has(id)) {
        if (id !== current) open(id, { push: false, scroll: false, focus: false });
      } else if (current) {
        close({ push: false, focus: false });
      }
    });

    // Opened on a #skill-x link: show its panel. The browser scrolls to the
    // section on its own; once the page has settled the panel is brought into
    // view too, because the panel is what the diagram is for.
    const start = location.hash.slice(1);
    if (byName.has(start)) {
      open(start, { push: false, scroll: false, focus: false });
      const settle = () => reveal();
      if (document.readyState === "complete") settle();
      else window.addEventListener("load", settle, { once: true });
    }
  }

  // ---------------------------------------------------------------- tree

  function setupTree(list) {
    const items = [...list.children].filter((li) => li.tagName === "LI");
    const steps = items.map((li) => {
      const q = li.querySelector("[data-phase-question]");
      const a = li.querySelector("[data-phase-answer]");
      const target = a && document.getElementById(a.getAttribute("href").slice(1));
      return q && a && target ? { question: q.textContent.trim(), name: a.textContent.trim(), target } : null;
    });
    if (steps.length < 2 || steps.some((s) => s === null)) return;

    const box = el("div", { class: "skills-wizard", role: "group", "aria-label": "階段交界決策樹" });
    const toggle = button("", () => {
      const open = list.hidden;
      list.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "收起文字清單" : "展開文字清單";
    });
    list.id = list.id || "phase-tree-list";
    toggle.setAttribute("aria-controls", list.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "展開文字清單";
    list.hidden = true;
    list.before(box, el("div", { class: "skills-wizard-actions" }, toggle));

    // The path is the questions answered "no" so far; an answer "yes" ends it.
    let path = [0];
    let result = null;

    function render(moveFocus) {
      const i = path[path.length - 1];
      const children = [];
      let focusTarget;
      if (result === null) {
        const step = steps[i];
        focusTarget = el("p", { class: "skills-wizard-question", tabindex: "-1" }, step.question);
        children.push(el("p", { class: "skills-wizard-progress" }, `第 ${i + 1} 題，共 ${steps.length} 題`), focusTarget);
        const actions = el("div", { class: "skills-wizard-actions" });
        actions.append(
          button("是", () => {
            result = i;
            render(true);
          }),
        );
        if (i < steps.length - 1) {
          actions.append(
            button("否", () => {
              path.push(i + 1);
              render(true);
            }),
          );
        }
        children.push(actions);
      } else {
        const step = steps[result];
        focusTarget = el("p", { class: "skills-wizard-question", tabindex: "-1" }, el("strong", {}, `選 ${step.name}`));
        children.push(el("p", { class: "skills-wizard-progress" }, "答案"), focusTarget);
        for (const kid of copyOf(step.target).childNodes) children.push(kid);
        children.push(el("p", {}, el("a", { href: "#" + step.target.id, class: "skills-flow-more" }, "看下方完整說明")));
      }
      const actions = el("div", { class: "skills-wizard-actions" });
      if (path.length > 1 || result !== null) {
        actions.append(
          button("上一步", () => {
            if (result !== null) result = null;
            else path.pop();
            render(true);
          }),
        );
      }
      if (path.length > 1 || result !== null) {
        actions.append(
          button("重來", () => {
            path = [0];
            result = null;
            render(true);
          }),
        );
      }
      if (actions.childNodes.length) children.push(actions);
      box.replaceChildren(...children);
      // The buttons just pressed no longer exist; leaving focus on <body>
      // would restart the Tab order at the top of the page.
      if (moveFocus) focusTarget.focus({ preventScroll: true });
    }

    render(false);
  }

  function init() {
    document.querySelectorAll("[data-skills-flow]").forEach(setupFlow);
    document.querySelectorAll("[data-phase-tree]").forEach(setupTree);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
