/**
 * BM Player — GPU Fluid Simulation
 *
 * A real Navier-Stokes solver running entirely on the GPU, in the style of
 * the WebGL fluid-simulation toys (advect → curl → vorticity confinement →
 * divergence → Jacobi pressure solve → gradient subtract → advect dye).
 *
 * This replaces the previous "fluid" mode, which was a 2D-canvas particle
 * system with curl noise — it looked like drifting dots, not like fluid,
 * because no pressure projection was happening at all.
 *
 * Exposes the same surface as ThemeFX (setMode / setPalette / pause /
 * resume / destroy) so it can be swapped in without touching call sites.
 *
 * Everything is capability-probed. If half-float render targets aren't
 * available the constructor throws, and app.js falls back to ThemeFX.
 */

import { perf } from './perf.js';

/* ─── Per-theme dye colours (0–1 range, matched to the CSS accents) ─── */
export const PALETTES = {
  dark:      [[0.36,0.44,0.97],[0.00,0.83,1.00],[0.51,0.31,1.00]],
  light:     [[0.28,0.34,0.89],[0.00,0.60,0.81],[0.39,0.24,0.78]],
  glass:     [[0.55,0.48,1.00],[0.26,0.88,1.00],[0.78,0.39,1.00]],
  dracula:   [[1.00,0.30,0.43],[0.74,0.36,1.00],[1.00,0.20,0.31]],
  northern:  [[0.13,0.91,0.66],[0.23,0.66,1.00],[0.58,0.20,1.00],[0.00,0.82,0.51]],
  ocean:     [[0.00,0.83,1.00],[0.13,0.56,0.80],[0.31,0.71,0.86]],
  snow:      [[0.56,0.82,1.00],[0.81,0.91,1.00],[0.40,0.60,0.95]],
  sunset:    [[1.00,0.42,0.21],[1.00,0.70,0.20],[1.00,0.31,0.39]],
  sakura:    [[0.96,0.63,0.75],[1.00,0.51,0.71],[0.86,0.39,0.63]],
  midnight:  [[0.29,0.37,0.81],[0.39,0.47,1.00],[0.24,0.31,0.71]],
  cyberpunk: [[1.00,0.00,0.50],[0.00,1.00,1.00],[1.00,0.20,0.59]],
  forest:    [[0.31,0.78,0.47],[0.60,0.85,0.35],[0.20,0.71,0.31]],
  lavender:  [[0.71,0.55,1.00],[1.00,0.50,0.75],[0.78,0.39,0.94]],
  golden:    [[0.86,0.71,0.31],[0.94,0.63,0.19],[1.00,0.78,0.39]],
};

/* ─── Cost profile per quality tier ──────────────────────────────────
   Pressure iterations dominate: each one is a full-screen pass over the
   simulation grid. 20 is the usual "looks right" number; 8 still resolves
   large-scale motion, and 4 is enough to avoid obvious compressibility
   artefacts at the low sim resolution Lite uses. */
const TIER = {
  low:    { sim: 64,  dye: 256,  iterations: 4,  dissipation: 1.4, velDissipation: 0.35, curl: 18, radius: 0.30, fps: 30 },
  medium: { sim: 128, dye: 512,  iterations: 12, dissipation: 1.0, velDissipation: 0.25, curl: 26, radius: 0.25, fps: 60 },
  high:   { sim: 192, dye: 1024, iterations: 20, dissipation: 0.9, velDissipation: 0.20, curl: 30, radius: 0.22, fps: 60 },
};

/* ─── Shaders (GLSL ES 1.00 — valid under both WebGL1 and WebGL2) ─── */

const BASE_VERT = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv, vL, vR, vT, vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const COPY_FRAG = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv; uniform sampler2D uTexture;
void main () { gl_FragColor = texture2D(uTexture, vUv); }`;

const CLEAR_FRAG = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;
void main () { gl_FragColor = value * texture2D(uTexture, vUv); }`;

/* Gaussian blob of colour + velocity injected at a point. The aspect
   correction keeps splats round on a wide window instead of oval. */
/* The pointer's trail, relative to the ambient splats: size, brightness, push. */
const POINTER = { radius: 0.35, dye: 0.13, force: 3500 };

const SPLAT_FRAG = `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio, radius;
uniform vec3 color;
uniform vec2 point;
void main () {
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}`;

/* Semi-Lagrangian advection: trace backwards along the velocity field. */
const ADVECTION_FRAG = `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uVelocity, uSource;
uniform vec2 texelSize, dyeTexelSize;
uniform float dt, dissipation;

vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}
void main () {
  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
  vec4 result = bilerp(uSource, coord, dyeTexelSize);
  float decay = 1.0 + dissipation * dt;
  gl_FragColor = result / decay;
}`;

const DIVERGENCE_FRAG = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  // Free-slip walls: mirror the centre sample at the boundary.
  if (vL.x < 0.0)  { L = -C.x; }
  if (vR.x > 1.0)  { R = -C.x; }
  if (vT.y > 1.0)  { T = -C.y; }
  if (vB.y < 0.0)  { B = -C.y; }
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL_FRAG = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

/* Vorticity confinement — puts back the small eddies that numerical
   diffusion eats. Without it the motion looks like syrup. */
const VORTICITY_FRAG = `
precision highp float; precision highp sampler2D;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity, uCurl;
uniform float curl, dt;
void main () {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
  vel = min(max(vel, -1000.0), 1000.0);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`;

const PRESSURE_FRAG = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure, uDivergence;
void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float divergence = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_SUBTRACT_FRAG = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure, uVelocity;
void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity.xy -= vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

/* Cheap fake lighting from the dye gradient — gives the smoke volume
   without a second render pass. */
const DISPLAY_FRAG = `
precision highp float; precision highp sampler2D;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uTexture;
uniform vec2 texelSize;
uniform float uAlpha, uShading;
void main () {
  vec3 c = texture2D(uTexture, vUv).rgb;
  if (uShading > 0.5) {
    vec3 lc = texture2D(uTexture, vL).rgb;
    vec3 rc = texture2D(uTexture, vR).rgb;
    vec3 tc = texture2D(uTexture, vT).rgb;
    vec3 bc = texture2D(uTexture, vB).rgb;
    float dx = length(rc) - length(lc);
    float dy = length(tc) - length(bc);
    vec3 n = normalize(vec3(dx, dy, length(texelSize)));
    float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.7, 0.7, 1.0);
    c *= diffuse;
  }
  float a = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c, a * uAlpha);
}`;

/* ─── GL helpers ─────────────────────────────────────────────────── */

function compile(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('shader compile failed: ' + log);
  }
  return s;
}

class Program {
  constructor(gl, vertSrc, fragSrc) {
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    // _initBlit sets up attribute 0 once for every program, so aPosition has
    // to actually be at 0. Drivers usually assign it there with a single
    // attribute, but "usually" isn't a contract.
    gl.bindAttribLocation(this.program, 0, 'aPosition');
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('program link failed: ' + gl.getProgramInfoLog(this.program));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.uniforms = {};
    const n = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(this.program, i).name;
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
  }
  bind() { this.gl.useProgram(this.program); }
}

export class FluidFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'off';
    this.paused = false;
    this.theme = 'dark';
    this._raf = null;
    this._lastTime = performance.now();
    this._accum = 0;
    this._pointers = [];
    this._nextAutoSplat = 0;
    this._alpha = 0;          // fades in so the first frame isn't a hard pop
    this._targetAlpha = 0;
    // The Flow theme's controls (v3.28.0). Neutral unless that theme sets them,
    // so Dark and Light keep their look. Multipliers on the tier's values,
    // applied where they are used: the tier table itself is shared.
    this.flow = { palette: null, intensity: 1, radius: 1, swirl: 1, trail: 1 };

    const params = {
      alpha: true, depth: false, stencil: false,
      antialias: false, preserveDrawingBuffer: false,
      powerPreference: 'default',
    };
    let gl = canvas.getContext('webgl2', params);
    this.isWebGL2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;

    this._initFormats();
    this._initPrograms();
    this._initBlit();
    this._ready = false;              // _resize(true) below does the first build
    this.setQuality(perf.tier || 'medium');
    this._ready = true;

    // Context loss on a laptop GPU switch or driver reset used to leave a
    // permanently black canvas. Tear down cleanly and rebuild on restore.
    this._onLost = e => { e.preventDefault(); this._stop(); };
    this._onRestored = () => {
      try {
        this._initFormats(); this._initPrograms(); this._initBlit();
        this.setQuality(this._tier); this._resize(true);
        if (this.mode === 'fluid' && !this.paused) this._start();
      } catch (err) { console.warn('[FluidFX] restore failed:', err); }
    };
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    canvas.addEventListener('webglcontextrestored', this._onRestored, false);

    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._resize(true);
  }

  /* ── capability probe ─────────────────────────────────────────── */
  _initFormats() {
    const gl = this.gl;
    let halfFloatTexType;
    if (this.isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      this._linearOK = !!gl.getExtension('OES_texture_float_linear');
      halfFloatTexType = gl.HALF_FLOAT;
    } else {
      const hf = gl.getExtension('OES_texture_half_float');
      if (!hf) throw new Error('OES_texture_half_float unsupported');
      this._linearOK = !!gl.getExtension('OES_texture_half_float_linear');
      halfFloatTexType = hf.HALF_FLOAT_OES;
    }
    this.halfFloat = halfFloatTexType;

    const supported = (internal, format) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, format, halfFloatTexType, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.deleteTexture(tex); gl.deleteFramebuffer(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok;
    };

    if (this.isWebGL2) {
      if (supported(gl.RGBA16F, gl.RGBA)) this.fmtRGBA = { internal: gl.RGBA16F, format: gl.RGBA };
      else throw new Error('no renderable half-float RGBA target');
      this.fmtRG = supported(gl.RG16F, gl.RG) ? { internal: gl.RG16F, format: gl.RG } : this.fmtRGBA;
      this.fmtR  = supported(gl.R16F,  gl.RED) ? { internal: gl.R16F,  format: gl.RED } : this.fmtRGBA;
    } else {
      if (!supported(gl.RGBA, gl.RGBA)) throw new Error('no renderable half-float RGBA target');
      this.fmtRGBA = this.fmtRG = this.fmtR = { internal: gl.RGBA, format: gl.RGBA };
    }
  }

  _initPrograms() {
    const gl = this.gl;
    this.progs = {
      copy:     new Program(gl, BASE_VERT, COPY_FRAG),
      clear:    new Program(gl, BASE_VERT, CLEAR_FRAG),
      splat:    new Program(gl, BASE_VERT, SPLAT_FRAG),
      advect:   new Program(gl, BASE_VERT, ADVECTION_FRAG),
      diverge:  new Program(gl, BASE_VERT, DIVERGENCE_FRAG),
      curl:     new Program(gl, BASE_VERT, CURL_FRAG),
      vorticity:new Program(gl, BASE_VERT, VORTICITY_FRAG),
      pressure: new Program(gl, BASE_VERT, PRESSURE_FRAG),
      gradSub:  new Program(gl, BASE_VERT, GRADIENT_SUBTRACT_FRAG),
      display:  new Program(gl, BASE_VERT, DISPLAY_FRAG),
    };
  }

  _initBlit() {
    const gl = this.gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, -1,1, 1,1, 1,-1]), gl.STATIC_DRAW);
    const idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    this._blit = target => {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  }

  _createFBO(w, h, fmt, filter) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, fmt.format, this.halfFloat, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture, fbo, width: w, height: h,
      texelSizeX: 1 / w, texelSizeY: 1 / h,
      attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; }
    };
  }

  _createDouble(w, h, fmt, filter) {
    let fbo1 = this._createFBO(w, h, fmt, filter);
    let fbo2 = this._createFBO(w, h, fmt, filter);
    return {
      width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
      get read()  { return fbo1; },  set read(v)  { fbo1 = v; },
      get write() { return fbo2; },  set write(v) { fbo2 = v; },
      swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t; }
    };
  }

  setQuality(tier) {
    this._tier = TIER[tier] ? tier : 'medium';
    this.cfg = TIER[this._tier];
    this._frameInterval = 1000 / this.cfg.fps;
    if (this._ready && this.gl && this.canvas.width) this._initFramebuffers();
  }

  _dims(res) {
    const gl = this.gl;
    const aspect = gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight);
    const min = Math.round(res), max = Math.round(res * (aspect >= 1 ? aspect : 1 / aspect));
    return aspect >= 1 ? { width: max, height: min } : { width: min, height: max };
  }

  _disposeFramebuffers() {
    const gl = this.gl;
    const kill = t => { if (!t) return; try { gl.deleteTexture(t.texture); gl.deleteFramebuffer(t.fbo); } catch(_) {} };
    const killDouble = d => { if (!d) return; kill(d.read); kill(d.write); };
    killDouble(this.dye); killDouble(this.velocity); killDouble(this.pressure);
    kill(this.divergence); kill(this.curlFBO);
    this.dye = this.velocity = this.pressure = this.divergence = this.curlFBO = null;
  }

  _initFramebuffers() {
    const gl = this.gl;
    // Every resize and quality change rebuilds these. Without the dispose
    // the old dye buffer (up to 1024^2 x RGBA16F) is simply orphaned.
    this._disposeFramebuffers();
    const filter = this._linearOK ? gl.LINEAR : gl.NEAREST;
    const s = this._dims(this.cfg.sim);
    const d = this._dims(this.cfg.dye);
    this.dye      = this._createDouble(d.width, d.height, this.fmtRGBA, filter);
    this.velocity = this._createDouble(s.width, s.height, this.fmtRG,  filter);
    this.divergence = this._createFBO(s.width, s.height, this.fmtR, gl.NEAREST);
    this.curlFBO    = this._createFBO(s.width, s.height, this.fmtR, gl.NEAREST);
    this.pressure   = this._createDouble(s.width, s.height, this.fmtR, gl.NEAREST);
  }

  _resize(force) {
    const c = this.canvas;
    // Cap the backing store: on a 4K display a 1:1 dye buffer is the single
    // biggest cost here, and the effect is a soft background either way.
    const dpr = Math.min(window.devicePixelRatio || 1, this._tier === 'low' ? 1 : 1.5);
    const w = Math.max(1, Math.floor(c.clientWidth  * dpr));
    const h = Math.max(1, Math.floor(c.clientHeight * dpr));
    if (!force && c.width === w && c.height === h) return;
    c.width = w; c.height = h;
    this._initFramebuffers();
  }

  /* ── simulation step ──────────────────────────────────────────── */
  _step(dt) {
    const gl = this.gl, P = this.progs, cfg = this.cfg;
    gl.disable(gl.BLEND);

    P.curl.bind();
    gl.uniform2f(P.curl.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(P.curl.uniforms.uVelocity, this.velocity.read.attach(0));
    this._blit(this.curlFBO);

    P.vorticity.bind();
    gl.uniform2f(P.vorticity.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(P.vorticity.uniforms.uVelocity, this.velocity.read.attach(0));
    gl.uniform1i(P.vorticity.uniforms.uCurl, this.curlFBO.attach(1));
    gl.uniform1f(P.vorticity.uniforms.curl, cfg.curl * this.flow.swirl);
    gl.uniform1f(P.vorticity.uniforms.dt, dt);
    this._blit(this.velocity.write); this.velocity.swap();

    P.diverge.bind();
    gl.uniform2f(P.diverge.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(P.diverge.uniforms.uVelocity, this.velocity.read.attach(0));
    this._blit(this.divergence);

    P.clear.bind();
    gl.uniform1i(P.clear.uniforms.uTexture, this.pressure.read.attach(0));
    gl.uniform1f(P.clear.uniforms.value, 0.8);
    this._blit(this.pressure.write); this.pressure.swap();

    P.pressure.bind();
    gl.uniform2f(P.pressure.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(P.pressure.uniforms.uDivergence, this.divergence.attach(0));
    for (let i = 0; i < cfg.iterations; i++) {
      gl.uniform1i(P.pressure.uniforms.uPressure, this.pressure.read.attach(1));
      this._blit(this.pressure.write); this.pressure.swap();
    }

    P.gradSub.bind();
    gl.uniform2f(P.gradSub.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(P.gradSub.uniforms.uPressure, this.pressure.read.attach(0));
    gl.uniform1i(P.gradSub.uniforms.uVelocity, this.velocity.read.attach(1));
    this._blit(this.velocity.write); this.velocity.swap();

    P.advect.bind();
    gl.uniform2f(P.advect.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    // Advecting velocity into itself: source grid == velocity grid.
    gl.uniform2f(P.advect.uniforms.dyeTexelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(P.advect.uniforms.uVelocity, this.velocity.read.attach(0));
    gl.uniform1i(P.advect.uniforms.uSource, this.velocity.read.attach(0));
    gl.uniform1f(P.advect.uniforms.dt, dt);
    gl.uniform1f(P.advect.uniforms.dissipation, cfg.velDissipation);
    this._blit(this.velocity.write); this.velocity.swap();

    gl.uniform1i(P.advect.uniforms.uVelocity, this.velocity.read.attach(0));
    gl.uniform1i(P.advect.uniforms.uSource, this.dye.read.attach(1));
    gl.uniform2f(P.advect.uniforms.dyeTexelSize, this.dye.texelSizeX, this.dye.texelSizeY);
    gl.uniform1f(P.advect.uniforms.dissipation, cfg.dissipation / this.flow.trail);
    this._blit(this.dye.write); this.dye.swap();
  }

  _splat(x, y, dx, dy, color, radiusScale = 1) {
    const gl = this.gl, P = this.progs;
    if (!this.dye || !this.velocity) return;
    // _render leaves BLEND on; a blended splat writes the wrong values back
    // into the velocity field and the sim slowly goes wrong.
    gl.disable(gl.BLEND);
    P.splat.bind();
    gl.uniform1i(P.splat.uniforms.uTarget, this.velocity.read.attach(0));
    gl.uniform1f(P.splat.uniforms.aspectRatio, this.canvas.width / this.canvas.height);
    gl.uniform2f(P.splat.uniforms.point, x, y);
    gl.uniform3f(P.splat.uniforms.color, dx, dy, 0);
    gl.uniform1f(P.splat.uniforms.radius, this._splatRadius() * radiusScale);
    this._blit(this.velocity.write); this.velocity.swap();

    gl.uniform1i(P.splat.uniforms.uTarget, this.dye.read.attach(0));
    gl.uniform3f(P.splat.uniforms.color, color[0], color[1], color[2]);
    this._blit(this.dye.write); this.dye.swap();
  }

  _splatRadius() {
    let r = this.cfg.radius / 100 * this.flow.radius;
    const aspect = this.canvas.width / this.canvas.height;
    if (aspect > 1) r *= aspect;
    return r;
  }

  _palette() { return PALETTES[this.flow.palette] || PALETTES[this.theme] || PALETTES.dark; }

  _randomColor(scale) {
    const p = this._palette();
    const c = p[Math.floor(Math.random() * p.length)];
    const k = (scale === undefined ? 0.22 : scale) * this.flow.intensity;
    return [c[0] * k, c[1] * k, c[2] * k];
  }

  /* Autonomous splats so the welcome screen is alive without a pointer. */
  _autoSplat(now) {
    if (now < this._nextAutoSplat) return;
    this._nextAutoSplat = now + (1400 + Math.random() * 2200) / Math.max(0.3, this.flow.intensity);
    const n = this._tier === 'low' ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const x = Math.random(), y = Math.random() * 0.6 + 0.2;
      const a = Math.random() * Math.PI * 2;
      const power = (900 + Math.random() * 900) * Math.sqrt(this.flow.intensity);
      this._splat(x, y, Math.cos(a) * power, Math.sin(a) * power, this._randomColor(0.26));
    }
  }

  /* ── public API (mirrors ThemeFX) ─────────────────────────────── */
  setMode(mode) {
    this.mode = mode;
    if (mode === 'fluid') { this._targetAlpha = 1; this._start(); }
    else { this._targetAlpha = 0; }
  }
  /** The Flow theme's settings; {} puts everything back to neutral. */
  setFlow(o = {}) {
    const n = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : d;
    this.flow = { palette: PALETTES[o.palette] ? o.palette : null, intensity: n(o.intensity, 1, 0.2, 3), radius: n(o.radius, 1, 0.3, 3), swirl: n(o.swirl, 1, 0, 3), trail: n(o.trail, 1, 0.3, 3) };
  }
  setPalette(theme) {
    if (PALETTES[theme]) this.theme = theme;
  }
  pause()  { this.paused = true;  this._stop(); }
  resume() { this.paused = false; if (this.mode === 'fluid') this._start(); }

  /* The pointer's trail. It used the ambient splat size at a brighter colour
     and a hard push, so every mouse movement threw a big bright blob (called
     "too big" on a real machine). Now about a third of the size, under half
     as bright and a gentler push; the ambient swirls are unchanged. */
  addPointer(x, y, dx, dy) {
    if (this.mode !== 'fluid') return;
    this._splat(x, y, dx * POINTER.force, dy * POINTER.force, this._randomColor(POINTER.dye), POINTER.radius);
  }

  _start() {
    if (this._raf || this.paused) return;
    this._lastTime = performance.now();
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const now = performance.now();
      let dt = (now - this._lastTime) / 1000;
      // Clamp: a background tab or a long GC pause otherwise produces one
      // enormous dt that blows the advection step apart.
      dt = Math.min(dt, 0.0166);
      this._accum += now - this._lastTime;
      this._lastTime = now;
      if (this._accum < this._frameInterval) return;
      this._accum = 0;

      this._alpha += (this._targetAlpha - this._alpha) * 0.06;
      if (this._targetAlpha === 0 && this._alpha < 0.01) { this._stop(); this._clearScreen(); return; }

      try {
        this._resize();
        // The audio visualiser's fluid moves with the music only (v3.29.0).
        if (!this.audioDriven) this._autoSplat(now);
        this._step(dt);
        this._render();
      } catch (e) {
        console.warn('[FluidFX] frame failed, stopping:', e);
        this._stop();
      }
    };
    this._raf = requestAnimationFrame(loop);
  }

  _stop() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }

  _clearScreen() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  _render() {
    const gl = this.gl, P = this.progs;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    P.display.bind();
    gl.uniform2f(P.display.uniforms.texelSize, this.dye.texelSizeX, this.dye.texelSizeY);
    gl.uniform1i(P.display.uniforms.uTexture, this.dye.read.attach(0));
    gl.uniform1f(P.display.uniforms.uAlpha, this._alpha);
    gl.uniform1f(P.display.uniforms.uShading, this._tier === 'low' ? 0 : 1);
    this._blit(null);
  }

  destroy() {
    this._stop();
    this._disposeFramebuffers();
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}
