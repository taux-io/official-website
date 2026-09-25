// Filesystem helpers the gates share.

const fs = require("fs");
const path = require("path");

// Every file under `dir` whose name ends in `ext`, as full paths, sorted.
//
// This was five hand-written recursive functions — check-jsonld, check-design,
// check-unknown-classes, check-md and visual/blank — four of them identical
// but for the extension. Sorted because readdir order is the filesystem's, not
// alphabetical on Linux, and a report whose order changes between the laptop
// and CI reads as a different result.
function walk(dir, ext) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

module.exports = { walk };
