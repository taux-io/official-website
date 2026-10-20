// Builds the still of the home hero's sharks background.
//
//   node scripts/assets/build-sharks.js      (or: npm run build:sharks)
//
// static/js/home-sharks.js draws slow low-poly water with a WebGL fragment shader,
// but only on a desktop (a hover pointer, laptop width, no reduced-motion, and
// a working WebGL). Everywhere else the hero shows this picture instead: the
// SAME shader, drawn once at a fixed moment. The two are complementary — the
// stylesheet hides this one exactly when the script runs (see .home-sharks-still).
//
// The picture is the water as the live canvas draws it: three tones mixed from
// --water-rgb and the paper (--surface-rgb) by the shader itself, opaque. The
// fade toward the band's lower edge is laid over it by the stylesheet, as it is
// over the canvas.
//
// Nothing here is a second copy of the look. The GLSL source and
// WATER_MAX_DEPTH are read out of home-sharks.js, and the colours out of
// --water-rgb and --surface-rgb in the authored CSS, so the still cannot drift
// from the canvas.
// RERUN IT after changing any of: --water-rgb, --surface-rgb, WATER_MAX_DEPTH, the
// fragment shader, or the constants in scripts/lib/sharks-source.js (STILL).
// `npm run check:hero-sharks` goes red until you do. One line:
// `PLAYWRIGHT_CHANNEL=chrome npm run build:sharks`, then `npm run build:css`, and
// commit static/brand/hero-sharks.webp, ledgers/hero-sharks-still.txt, src/input.css
// and static/css/styles.min.css. This script rewrites the `?v=` on the picture's
// url() in src/input.css: /static/brand is cached for a week, and that is how a
// visitor with the old picture fetches the new one.
//
// Reproducible: the shader has no randomness (its jitter is a sine hash of the
// facet's lattice cell) and time is a constant, STILL_T below, not a clock. The
// WebP encoder is deterministic at fixed settings. The only wobble left is the
// GPU's float rounding, which can move a few pixels by one level between
// machines; on one machine two runs are byte-identical.
//
// A local Chromium whose version does not match Playwright's:
//   PLAYWRIGHT_CHANNEL=chrome npm run build:sharks

const fs = require("fs");
const path = require("path");
const { launch, GPU_ARGS } = require("../browser");
const sharp = require("sharp");
const stylesheet = require("../stylesheet");
const sharksSource = require("../lib/sharks-source");

const { ROOT, STILL, STILL_IMAGE: OUT, STILL_LEDGER, INPUT_CSS } = sharksSource;

// 800x450 is wider than any hero is tall: the stylesheet shows it with
// `background-size: cover`, so a phone sees a centred crop of it.
// STILL.T is shader time in the shader's own units (the script's
// `clock * WATER_SPEED`). All the constants live in scripts/lib/sharks-source.js
// because the staleness gate hashes them too.
const { WIDTH, HEIGHT, T: STILL_T, QUALITY, ALPHA_QUALITY, EFFORT } = STILL;
const { STILL_MAX_BYTES: MAX_BYTES } = sharksSource;

async function main() {
  const sheet = stylesheet.read();
  const inputs = sharksSource.stillInputs(sheet);
  const { frag, water: rgb, paper, depth: max } = inputs;

  const browser = await launch({ args: GPU_ARGS });
  let dataUrl;
  try {
    const page = await (await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } })).newPage();
    await page.setContent(`<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>`);
    dataUrl = await page.evaluate(
      ({ frag, rgb, paper, max, t }) => {
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
        gl.uniform3f(gl.getUniformLocation(p, "q"), paper[0] / 255, paper[1] / 255, paper[2] / 255);
        gl.uniform1f(gl.getUniformLocation(p, "m"), max);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return cv.toDataURL("image/png");
      },
      { frag, rgb, paper, max, t: STILL_T }
    );
  } finally {
    await browser.close();
  }

  const png = Buffer.from(dataUrl.split(",")[1], "base64");
  const webp = await sharp(png).webp({ quality: QUALITY, alphaQuality: ALPHA_QUALITY, effort: EFFORT }).toBuffer();
  if (webp.length > MAX_BYTES) {
    throw new Error(`build-sharks: ${webp.length} bytes is over the ${MAX_BYTES} budget; lower QUALITY or the size`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, webp);
  fs.writeFileSync(STILL_LEDGER, sharksSource.ledgerText(inputs, webp));
  // The picture's url() carries a ?v= of its own hash (see imageVersion).
  const v = sharksSource.imageVersion(webp);
  const css = fs.readFileSync(INPUT_CSS, "utf8");
  const next = css.replace(/url\("\/static\/brand\/hero-sharks\.webp(?:\?v=[0-9a-f]+)?"\)/, `url("/static/brand/hero-sharks.webp?v=${v}")`);
  if (!next.includes(`hero-sharks.webp?v=${v}`)) throw new Error('src/input.css has no url("/static/brand/hero-sharks.webp") to version');
  fs.writeFileSync(INPUT_CSS, next);
  console.log(`  ${path.relative(ROOT, OUT)}  ${WIDTH}x${HEIGHT}  ${(webp.length / 1024).toFixed(1)} KB  ?v=${v}`);
  console.log(`  ${path.relative(ROOT, STILL_LEDGER)} and the ?v= in src/input.css updated; now run npm run build:css and commit them with the picture`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
