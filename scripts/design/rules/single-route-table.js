const fs = require("fs");
const path = require("path");
const { ROOT, lineOf } = require("../lib");

// One reader for the route table.
//
// routes.js has been the seam since the Go migration, and four scripts still
// parsed site.toml for themselves — check-design.js three times in three
// separate rules. They were not going around it out of habit: the module
// DROPPED the fields they needed. `template`, both date fields and `noindex`
// never reached a caller, and [[document]] was excluded outright, so "what is a
// page" had five definitions. Widening the module removed the reason to go
// around; this removes the option.
//
// SCOPED TO scripts/. generator/ reads site.toml too, in Rust, and cannot use a
// JavaScript module — that is a language boundary, not a discipline problem, and
// it is the reason the file is a data file in the first place.
function ruleSingleRouteTable() {
  const dir = path.join(ROOT, "scripts");
  const found = [];
  const walkDir = (abs, rel) => {
    for (const name of fs.readdirSync(abs).sort()) {
      const child = path.join(abs, name);
      if (fs.statSync(child).isDirectory()) {
        walkDir(child, path.join(rel, name));
        continue;
      }
      if (!name.endsWith(".js") || (rel === "scripts" && name === "routes.js")) continue;
      const text = fs.readFileSync(child, "utf8");
      const m = /require\(["'][^"']*smol-toml["']\)/.exec(text);
      if (!m) continue;
      found.push({
        file: path.join(rel, name),
        line: lineOf(text, m.index),
        detail: "parses site.toml itself — routes.js is the one reader, and it carries every field now",
      });
    }
  };
  walkDir(dir, "scripts");
  return found;
}

module.exports = ruleSingleRouteTable;
