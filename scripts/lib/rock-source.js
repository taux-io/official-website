// Reads the home hero's rock background out of its single sources, so the
// checks and the still builder do not each keep their own regex for them.
//
//   · ROCK_MAX_INTENSITY and the fragment shader   static/js/home-rock.js
//   · --rock-rgb (and any other three-channel token)   the authored CSS
//
// Used by scripts/check-hero-rock.js and scripts/assets/build-rock.js. Every
// failure THROWS an Error; each caller decides how to report it.

const fs = require("fs");
const path = require("path");

const SCRIPT = path.join(__dirname, "..", "..", "static", "js", "home-rock.js");

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
  const m = /const\s+ROCK_MAX_INTENSITY\s*=\s*([0-9.]+)\s*;/.exec(source());
  if (!m) throw new Error("static/js/home-rock.js has no `const ROCK_MAX_INTENSITY = <number>;`");
  const v = Number(m[1]);
  if (!(v > 0 && v <= 1)) throw new Error(`ROCK_MAX_INTENSITY ${m[1]} is outside 0..1`);
  return v;
}

function readFrag() {
  const m = /const FRAG = `([\s\S]*?)`;/.exec(source());
  if (!m) throw new Error("static/js/home-rock.js has no `const FRAG = \\`...\\`;`");
  return m[1];
}

// --rock-rgb from an authored-stylesheet reader (scripts/stylesheet `read()`).
function readRockRgb(sheet) {
  const v = sheet.token("rock-rgb");
  if (v == null) throw new Error("--rock-rgb not found in the authored CSS");
  return channels(v, "--rock-rgb");
}

module.exports = { channels, readMaxIntensity, readFrag, readRockRgb };
