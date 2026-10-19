/* Home hero background (DESIGN.md decision 182): slow teal ridges drawn with a
   WebGL fragment shader. Desktop only (a hover pointer, at least `laptop` wide,
   no prefers-reduced-motion); everywhere else this script does nothing and the
   hero stays paper. It does not follow the pointer. The colour comes from the
   stylesheet's --rock-rgb, never from this file. */
(() => {
  'use strict';

  // THE BRIGHTEST THE STONE EVER GETS: the share of --rock-rgb a pixel can
  // reach over paper, 0..1. This is the contrast knob. Under the hero's 85%
  // paper veil (.home-rock-veil) the worst text, ink-72 at 5.11:1 on paper,
  // measures 4.69:1 with 0.9. `npm run check:hero-rock` fails if a change here
  // takes any hero text under AA, or leaves it less than 0.1 to spare.
  const ROCK_MAX_INTENSITY = 0.9;

  const FRAME_MS = 1000 / 30;   // at most 30 fps
  const SCALE = 0.5;            // internal resolution: half the CSS size
  const SPEED = 0.12;           // ridge drift, noise units per second

  const cv = document.querySelector('[data-home-rock]');
  if (!cv) return;
  const desktop = matchMedia('(min-width: 961px) and (hover: hover) and (prefers-reduced-motion: no-preference)'); // 961px = tailwind `laptop`
  let gl, uR, uT;
  const init = () => {
    gl = cv.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true });
    if (!gl) return false;

    const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FRAG = `precision mediump float;
  uniform vec2 r;uniform float t;uniform vec3 c;uniform float m;
  float h(vec2 i){return fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float ridge(vec2 x){float s=0.,a=.5;for(int k=0;k<5;k++){s+=a*(1.-abs(2.*n(x)-1.));x=x*2.03+vec2(1.7,9.2);a*=.5;}return s;}
  void main(){
  vec2 u=gl_FragCoord.xy/r.y*3.;
  vec2 w=vec2(ridge(u+t),ridge(u-t+4.));
  float v=ridge(u+w*.9+vec2(t*.6,-t*.4));
  float a=smoothstep(.45,.95,v)*m;
  gl_FragColor=vec4(c*a,a);}`;

    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERT);
    const fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    uR = gl.getUniformLocation(prog, 'r');
    uT = gl.getUniformLocation(prog, 't');

    // --rock-rgb is three space-separated channels, e.g. "40 160 140".
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--rock-rgb').trim().split(/\s+/).map(Number);
    if (raw.length !== 3 || !raw.every(Number.isFinite)) return false;
    gl.uniform3f(gl.getUniformLocation(prog, 'c'), raw[0] / 255, raw[1] / 255, raw[2] / 255);
    gl.uniform1f(gl.getUniformLocation(prog, 'm'), ROCK_MAX_INTENSITY);

    return true;
  };
  let ready = null;   // the context is made on first need, so a phone never makes one

  let running = false;
  let visible = true;
  let last = 0;
  let clock = 0;

  const size = () => {
    cv.width = Math.max(1, Math.round(cv.clientWidth * SCALE));
    cv.height = Math.max(1, Math.round(cv.clientHeight * SCALE));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(uR, cv.width, cv.height);
  };

  const frame = (now) => {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    clock += Math.min(now - last, 100) / 1000;   // a returning tab does not jump
    last = now;
    gl.uniform1f(uT, clock * SPEED);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const update = () => {
    const go = desktop.matches && visible && !document.hidden;
    if (go && ready === null) ready = init();
    if (go && ready && !running) {
      size();
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    } else if (!go && running) {
      running = false;
    }
    if (ready && !desktop.matches) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  };

  desktop.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  let timer;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (running) size(); }, 120);
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      update();
    }).observe(cv.parentElement);
  }
  update();
})();
