// Reads the home hero's water background out of its single sources, so the
// checks and the still builder do not each keep their own regex for them.
//
//   · WATER_MAX_INTENSITY and the fragment shader   static/js/home-water.js
//   · --water-rgb (and any other three-channel token)   the authored CSS
//
// Used by scripts/check-hero-water.js and scripts/assets/build-water.js. Every
// failure THROWS an Error; each caller decides how to report it.

const fs = require("fs");
const path = require("path");

const SCRIPT = path.join(__dirname, "..", "..", "static", "js", "home-water.js");

const source = () => fs.readFileSync(SCRIPT, "utf8");

// "20 220 190" -> [20, 220, 190]. `what` names the token in the error.
function channels(value, what) {
  const c = String(value || "").trim().split(/\s+/).map(Number);
  if (c.length !== 3 || !c.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    throw new Error(`${what} is not three 0-255 channels: "${value}"`);
  }
  return c;
}

function readMaxIntensity() {
  const m = /const\s+WATER_MAX_INTENSITY\s*=\s*([0-9.]+)\s*;/.exec(source());
  if (!m) throw new Error("static/js/home-water.js has no `const WATER_MAX_INTENSITY = <number>;`");
  const v = Number(m[1]);
  if (!(v > 0 && v <= 1)) throw new Error(`WATER_MAX_INTENSITY ${m[1]} is outside 0..1`);
  return v;
}

function readFrag() {
  const m = /const FRAG = `([\s\S]*?)`;/.exec(source());
  if (!m) throw new Error("static/js/home-water.js has no `const FRAG = \\`...\\`;`");
  return m[1];
}

// --water-rgb from an authored-stylesheet reader (scripts/stylesheet `read()`).
function readWaterRgb(sheet) {
  const v = sheet.token("water-rgb");
  if (v == null) throw new Error("--water-rgb not found in the authored CSS");
  return channels(v, "--water-rgb");
}

module.exports = { channels, readMaxIntensity, readFrag, readWaterRgb };
