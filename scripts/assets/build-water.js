// Builds the still of the home hero's water background.
//
//   node scripts/assets/build-water.js      (or: npm run build:water)
//
// static/js/home-water.js draws slow teal ridges with a WebGL fragment shader,
// but only on a desktop (a hover pointer, laptop width, no reduced-motion, and
// a working WebGL). Everywhere else the hero shows this picture instead: the
// SAME shader, drawn once at a fixed moment. The two are complementary — the
// stylesheet hides this one exactly when the script runs (see .home-water-still).
//
// The picture is the stone ALONE: teal over a transparent background, at the
// brightness the live canvas has. The paper veil (.home-water-veil) and the fade
// toward the band's lower edge are laid over it by the stylesheet, as they are
// over the canvas, so a change to the veil never needs this file rerun.
//
// Nothing here is a second copy of the look. The GLSL source and
// WATER_MAX_INTENSITY are read out of home-water.js, and the colour out of
// --water-rgb in the authored CSS, so the still cannot drift from the canvas.
// RERUN IT after changing any of: --water-rgb, WATER_MAX_INTENSITY, the fragment
// shader. One line: `npm run build:water`, then commit static/brand/hero-water.webp.
//
// Reproducible: the shader has no randomness (its noise is a sine hash of the
// pixel coordinate) and time is a constant, STILL_T below, not a clock. The
// WebP encoder is deterministic at fixed settings. The only wobble left is the
// GPU's float rounding, which can move a few pixels by one level between
// machines; on one machine two runs are byte-identical.
//
// A local Chromium whose version does not match Playwright's:
//   PLAYWRIGHT_CHANNEL=chrome npm run build:water

const fs = require("fs");
const path = require("path");
const { launch } = require("../browser");
const sharp = require("sharp");
const stylesheet = require("../stylesheet");
const waterSource = require("../lib/water-source");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "static", "brand", "hero-water.webp");

// 1600x900 is wider than any hero is tall: the stylesheet shows it with
// `background-size: cover`, so a phone sees a centred crop of it.
const WIDTH = 800;
const HEIGHT = 450;
// Shader time, in the shader's own units (the script's `clock * SPEED`). Chosen
// by eye: ridges spread across the whole frame, none of them parked on a corner.
const STILL_T = 4.8;
const QUALITY = 60;
const MAX_BYTES = 100 * 1024;

async function main() {
  const rgb = waterSource.readWaterRgb(stylesheet.read());
  const frag = waterSource.readFrag();
  const max = waterSource.readMaxIntensity();

  const browser = await launch();
  let dataUrl;
  try {
    const page = await (await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } })).newPage();
    await page.setContent(`<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>`);
    dataUrl = await page.evaluate(
      ({ frag, rgb, max, t }) => {
        const cv = document.getElementById("c");
        const gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
        if (!gl) throw new Error("WebGL is not available in this browser");
        const sh = (type, src) => {
          const s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
          return s;
        };
        const p = gl.createProgram();
        gl.attachShader(p, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
        gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
        gl.linkProgram(p);
        gl.useProgram(p);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(p, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, cv.width, cv.height);
        gl.uniform2f(gl.getUniformLocation(p, "r"), cv.width, cv.height);
        gl.uniform1f(gl.getUniformLocation(p, "t"), t);
        gl.uniform3f(gl.getUniformLocation(p, "c"), rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
        gl.uniform1f(gl.getUniformLocation(p, "m"), max);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return cv.toDataURL("image/png");
      },
      { frag, rgb, max, t: STILL_T }
    );
  } finally {
    await browser.close();
  }

  const png = Buffer.from(dataUrl.split(",")[1], "base64");
  const webp = await sharp(png).webp({ quality: QUALITY, alphaQuality: 60, effort: 6 }).toBuffer();
  if (webp.length > MAX_BYTES) {
    throw new Error(`build-water: ${webp.length} bytes is over the ${MAX_BYTES} budget; lower QUALITY or the size`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, webp);
  console.log(`  ${path.relative(ROOT, OUT)}  ${WIDTH}x${HEIGHT}  ${(webp.length / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
