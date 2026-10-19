/* Home hero background (DESIGN.md decision 182): slow low-poly water, drawn with
   a WebGL fragment shader. Desktop only (a hover pointer, at least `laptop`
   wide, no prefers-reduced-motion); everywhere else this script does nothing and
   the stylesheet shows the still (static/brand/hero-water.webp). If WebGL fails
   here it sets [data-fallback] on the still so the still takes over. It does
   not follow the pointer. The colours come from the stylesheet's --water-rgb
   and --surface-rgb, never from this file: the shader mixes the water with
   paper into three tones (deep, mid, a near-white glint). */
(() => {
  'use strict';

  // THE DEEPEST THE WATER EVER GETS: the share of --water-rgb in the darkest
  // facet, the rest being paper, 0..1. This is the contrast knob (no veil sits
  // on top): `npm run check:hero-water` fails if a change here, or to
  // --water-rgb, takes any hero text under AA or leaves it less than 0.1 to spare.
  const WATER_MAX_DEPTH = 0.6;

  // Wave speed, a multiplier on the shader's clock. 1 is the pace the owner saw
  // in prototype B; 2 is twice as fast.
  const WATER_SPEED = 1;

  const FRAME_MS = 1000 / 30;   // at most 30 fps
  const SCALE = 0.5;            // internal resolution: half the CSS size

  const cv = document.querySelector('[data-home-water]');
  if (!cv) return;
  const still = document.querySelector('[data-home-water-still]');
  const desktop = matchMedia('(min-width: 961px) and (hover: hover) and (prefers-reduced-motion: no-preference)'); // 961px = tailwind `laptop`
  let gl, uR, uT;
  const init = () => {
    gl = cv.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true });
    if (!gl) return false;

    const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    // Simplex-lattice triangles over a warped plane, each lit by the slope of a
    // sum of plane waves at its centre (flat shading), plus a narrow glint, a
    // diagonal band of light and a faint edge line.
    const FRAG = `precision highp float;
  uniform vec2 r;uniform float t,m;uniform vec3 c,q;
  vec2 h(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
  vec2 g(vec2 x,float t){
  return .5*vec2(1.3,.7)*cos(dot(vec2(1.3,.7),x)+t*.9)+.35*vec2(-.8,1.5)*cos(dot(vec2(-.8,1.5),x)+t*.7)
  +.22*vec2(2.1,-1.1)*cos(dot(vec2(2.1,-1.1),x)-t*1.1)+.15*vec2(.6,2.4)*cos(dot(vec2(.6,2.4),x)+t*.6)
  +.12*vec2(-1.7,-.9)*cos(dot(vec2(-1.7,-.9),x)-t*.8);}
  void main(){
  vec2 u=gl_FragCoord.xy/r;
  vec2 p=(u-.5)*vec2(r.x/r.y,1.);
  p=mat2(.88,-.48,.48,.88)*p;
  vec2 w=vec2(sin(p.y*2.3+t*.15)+.5*sin(p.y*5.1-t*.11),cos(p.x*2.1-t*.13)+.5*cos(p.x*4.7+t*.09))*.1;
  w+=vec2(sin(dot(p,vec2(3.1,2.2))+t*.2),cos(dot(p,vec2(-2.6,3.7))-t*.17))*.05;
  vec2 x=(p+w)*13.;
  vec2 i=floor(x+(x.x+x.y)*.366),x0=x-i+(i.x+i.y)*.2113;
  vec2 a=x0.x>x0.y?vec2(1,0):vec2(0,1);
  vec2 v=a-(a.x+a.y)*.2113,e=vec2(.5774);
  float d=v.x*e.y-v.y*e.x,b1=(x0.x*e.y-x0.y*e.x)/d,b2=(v.x*x0.y-v.y*x0.x)/d;
  float k=min(1.-b1-b2,min(b1,b2));
  vec2 f=i+(a+1.)/3.;f-=(f.x+f.y)*.2113;
  vec2 n=g((f/13.-w)*2.86,t)+(h(i+a*7.)-.5)*.5;
  vec3 N=normalize(vec3(-n*.6,1.));
  vec3 L=normalize(vec3(.5,.4,.75));
  float s=clamp((dot(N,L)-.55)/.4,0.,1.);
  float sp=pow(max(dot(N,normalize(L+vec3(0,0,1))),0.),90.);
  float sw=u.x*.75+u.y*.65-(.85+.35*sin(t*.07));
  float bd=exp(-pow(sw*2.4,2.));
  vec3 hi=vec3(1);
  vec3 o=mix(mix(q,c,m),mix(q,c,m*.2),s);
  o=mix(o,hi,bd*.55*(.3+.7*s));
  o=mix(o,hi,clamp(sp*.66,0.,1.));
  o=mix(o,hi,(1.-smoothstep(0.,.05,k))*.08*(.3+.7*bd+.3*s));
  gl_FragColor=vec4(o,1);}`;

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

    // Each colour is three space-separated 0-255 channels; the stylesheet owns the value.
    const rgb = (name, id) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
      if (v.length !== 3 || !v.every(Number.isFinite)) return false;
      gl.uniform3f(gl.getUniformLocation(prog, id), v[0] / 255, v[1] / 255, v[2] / 255);
      return true;
    };
    if (!rgb('--water-rgb', 'c') || !rgb('--surface-rgb', 'q')) return false;
    gl.uniform1f(gl.getUniformLocation(prog, 'm'), WATER_MAX_DEPTH);

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
    gl.uniform1f(uT, clock * WATER_SPEED);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const update = () => {
    const go = desktop.matches && visible && !document.hidden;
    if (go && ready === null) {
      ready = init();
      if (!ready && still) still.setAttribute('data-fallback', '');
    }
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
