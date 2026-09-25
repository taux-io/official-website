const path = require("path");
const { lineOf, elements, stripVariants } = require("../lib");

function ruleNavBreakpointsPaired(files) {
  const HEADER = path.join("templates", "header.html");
  const header = files.find(({ rel }) => rel === HEADER);
  // The partial is included by every template rather than routed to, so its
  // absence means the file was renamed and this rule has gone blind. Say so
  // rather than passing vacuously.
  if (!header) {
    return [{ file: HEADER, line: 0, detail: "not found; this rule cannot see the navigation" }];
  }

  const { rel, html } = header;
  const variantOf = (classes, utility) => {
    const hit = classes.find((c) => stripVariants(c) === utility && c !== utility);
    return hit ? hit.slice(0, hit.length - utility.length - 1) : null;
  };

  const showing = [];
  let hides = null;
  for (const el of elements(html)) {
    if (el.id === "hamburger") {
      hides = { variant: variantOf(el.classes, "hidden"), line: lineOf(html, el.index) };
    }
    // The desktop group is the one that starts hidden and becomes a flex row at
    // some breakpoint. Identified by that shape because it carries no id.
    if (el.classes.includes("hidden") && variantOf(el.classes, "flex")) {
      showing.push({ variant: variantOf(el.classes, "flex"), line: lineOf(html, el.index) });
    }
  }

  const found = [];
  // Collected rather than overwritten. Assigning in the loop meant the LAST
  // match won and a second group would be compared against nothing — the rule
  // would pass while the pairing it exists to check went unexamined. Today
  // there is exactly one, and this says so rather than relying on it.
  if (showing.length > 1) {
    found.push({
      file: rel,
      line: showing[1].line,
      detail: `${showing.length} \`hidden <bp>:flex\` groups; this rule pairs one against #hamburger and cannot tell which you meant`,
    });
  }
  const shows = showing[0] ?? null;
  if (!shows) {
    found.push({ file: rel, line: 0, detail: "no `hidden <bp>:flex` desktop nav group found" });
  }
  if (!hides || !hides.variant) {
    found.push({
      file: rel,
      line: hides ? hides.line : 0,
      detail: "#hamburger carries no `<bp>:hidden`",
    });
  }
  if (shows && hides && hides.variant && shows.variant !== hides.variant) {
    found.push({
      file: rel,
      line: hides.line,
      detail: `desktop nav shows at ${shows.variant}: but #hamburger hides at ${hides.variant}: — both or neither render between them`,
    });
  }
  return found;
}

module.exports = ruleNavBreakpointsPaired;
