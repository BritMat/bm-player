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
 *
 * The solver and its shaders follow Pavel Dobryakov's WebGL Fluid Simulation
 * (MIT, Copyright (c) 2017 Pavel Dobryakov,
 * https://github.com/PavelDoGreat/WebGL-Fluid-Simulation), and so does the
 * bloom since v3.36.0. Its licence is in src/vendor/webgl-fluid/LICENSE.txt.
 *
 * v3.36.0, for the HD Flow visualiser and for every use of this engine:
 *   - splats are drawn only where they land (scissored, added by blending).
 *     Each one was a pass over the whole dye buffer, a dozen of them a frame
 *   - time: a step is as long as the time since the last drawn frame. It was
 *     the time since the last screen refresh, so on a 144 Hz screen the fluid
 *     ran three times too slow, and five times at the 30-a-second tier
 *   - quality steps down by itself when frames are slow (the governor)
 *   - a shading pass that draws the dye as glowing contour lines, with markers,
 *     and a bloom pyramid, both off unless a caller asks
 * Tried and not kept: cubic (Catmull-Rom, limited) advection for the dye. The
 * limiter flattens peaks into terraces, and the contour lines then drew every
 * terrace. Plain bilinear advection gives a smooth cloud and clean lines.
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
  // HD Flow on a strong machine (v3.34.0): dye close to the screen's own size.
  ultra:  { sim: 256, dye: 2048, iterations: 20, dissipation: 0.9, velDissipation: 0.20, curl: 30, radius: 0.2,  fps: 60 },
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

/* The same blob, added by blending inside a scissor box (v3.36.0): nothing is
   read back, and only the pixels it reaches are shaded. */
const SPLAT_ADD_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float aspectRatio, radius;
uniform vec3 color;
uniform vec2 point;
void main () {
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  gl_FragColor = vec4(exp(-dot(p, p) / radius) * color, 0.0);
}`;

/* Semi-Lagrangian advection: trace backwards along the velocity field.
   Where the graphics card can blend between the texels of these buffers by
   itself (nearly all can), it does (v3.36.0): two reads a pixel. The blend
   worked out by hand, eight reads, is kept for the cards that cannot
   (MANUAL_FILTERING). The dye is the largest buffer there is, so this pass is
   one of the two most costly of a frame. */
const ADVECTION_FRAG = `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uVelocity, uSource;
uniform vec2 texelSize, dyeTexelSize;
uniform float dt, dissipation;

#ifdef MANUAL_FILTERING
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
#endif
void main () {
#ifdef MANUAL_FILTERING
  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
  vec4 result = bilerp(uSource, coord, dyeTexelSize);
#else
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  vec4 result = texture2D(uSource, coord);
#endif
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
   without a second render pass. With uNeon the picture comes ready-shaded
   (SHADE_FRAG), the glow is added, and the result is tone-mapped: the dye runs
   past white, so the hottest parts burn white and the rest keeps its colour. */
const DISPLAY_FRAG = `
precision highp float; precision highp sampler2D;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uTexture;
uniform sampler2D uBloom;   // the glow, added when uBloomAmt is above 0
uniform vec2 texelSize;
uniform float uAlpha, uShading, uBloomAmt, uNeon, uExposure;
void main () {
  vec3 c = texture2D(uTexture, vUv).rgb;
  if (uShading > 0.5 && uNeon < 0.5) {
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
  c += texture2D(uBloom, vUv).rgb * uBloomAmt;
  if (uNeon > 0.5) {
    c = vec3(1.0) - exp(-c * uExposure);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = clamp(mix(vec3(l), c, 1.25), 0.0, 1.0);
    // A grain of noise, under one step of 8-bit colour: a soft glow on a dark
    // screen otherwise shows as bands.
    c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  }
  float a = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c, a * uAlpha);
}`;

/* The neon look (v3.36.0), one pass before the glow, so the glow comes from
   what is seen. The dye is a smooth cloud. This draws it as contour lines,
   the way a map draws a hill: a thin bright line wherever the dye's density
   crosses a level, the levels a fixed ratio apart (uOctaves doublings). The
   distance to the nearest level is worked out in pixels (the level's value
   over how fast it changes here), so every line is the same width however
   steep or shallow the cloud, and stays sharp at the screen's own resolution
   even when the dye is kept at half of it. Inner lines are hotter. As the dye
   fades its levels move inwards, so the lines are never still. The cloud's
   body shows faintly (uFill). Then the markers: a bright ring at each emitter. */
const SHADE_FRAG = `
precision highp float; precision highp sampler2D;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uTexture;
uniform float uEdge, uFill, uAspect, uMarkSize, uLevel0, uOctaves, uWidth;
uniform vec3 uMarkPos[6];      // x, y, strength
uniform vec3 uMarkCol[6];
float top (vec3 v) { return max(v.r, max(v.g, v.b)); }
void main () {
  vec3 c = texture2D(uTexture, vUv).rgb;
  float d = top(c);
  // The body, held back where the dye is dense: a thick patch stays a dim haze
  // with its lines showing through, not a solid slab of colour.
  vec3 lit = c * (uFill / (1.0 + d * 0.4));
  if (uEdge > 0.0 && d > uLevel0 * 0.6) {
    vec2 g = vec2(top(texture2D(uTexture, vR).rgb) - top(texture2D(uTexture, vL).rgb),
                  top(texture2D(uTexture, vT).rgb) - top(texture2D(uTexture, vB).rgb)) * 0.5;
    float q = log2(d / uLevel0) / uOctaves;                       // which level this is, as a number
    float gq = length(g) / (d * 0.6931 * uOctaves);               // and how fast that changes, per pixel
    float dist = abs(fract(q + 0.5) - 0.5) / max(gq, 0.0005);     // pixels to the nearest level
    float line = 1.0 - smoothstep(uWidth * 0.5, uWidth * 0.5 + 1.2, dist);
    line *= smoothstep(-0.45, 0.0, q);                            // nothing below the first level
    line *= smoothstep(0.004, 0.02, gq);                          // nor on a flat: there the faintest ripple would draw stripes
    float heat = clamp(0.5 + q * 0.4, 0.4, 1.8);                  // inner lines are hotter
    lit += c / d * (line * uEdge * heat);
  }
  // Nested ifs, no early exits from the loop: the plainest form a shader translator can be given.
  for (int k = 0; k < 6; k++) {
    if (uMarkPos[k].z > 0.0) {
      vec2 p = vUv - uMarkPos[k].xy; p.x *= uAspect;
      float r2 = dot(p, p) / (uMarkSize * uMarkSize);
      if (r2 <= 5.0) {                                            // further out there is nothing to see: nearly every pixel stops here
        float r = sqrt(r2);
        float q2 = (r - 1.0) * 3.2;
        lit += uMarkCol[k] * ((exp(-q2 * q2) * 1.6 + exp(-r * r * 9.0) * 2.4) * uMarkPos[k].z);
      }
    }
  }
  gl_FragColor = vec4(lit, 1.0);
}`;

/* Bloom, as in the WebGL Fluid Simulation: keep what is bright (with a soft
   knee, so nothing pops in), then halve it again and again, and add the
   levels back up. Small levels are wide glows, large ones tight. */
const BLOOM_PRE_FRAG = `
precision mediump float; precision mediump sampler2D;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec3 curve;
uniform float threshold;
void main () {
  vec3 c = texture2D(uTexture, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - curve.x, 0.0, curve.y);
  rq = curve.z * rq * rq;
  c *= max(rq, br - threshold) / max(br, 0.0001);
  gl_FragColor = vec4(min(c, vec3(24.0)), 0.0);
}`;
const BLOOM_BLUR_FRAG = `
precision mediump float; precision mediump sampler2D;
varying vec2 vL, vR, vT, vB;
uniform sampler2D uTexture;
uniform float uGain;
void main () {
  vec4 sum = texture2D(uTexture, vL) + texture2D(uTexture, vR) + texture2D(uTexture, vT) + texture2D(uTexture, vB);
  gl_FragColor = sum * 0.25 * uGain;
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
    (FluidFX.all || (FluidFX.all = new Set())).add(this);   // every instance, for diagnostics (v3.33.0)
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
    this.neon = false; this.exposure = 1.4; this.edge = 0; this.fill = 1;   // the neon look (setNeon)
    this.lines = { level0: 0.06, octaves: 2, width: 1.4 };
    this.bloom = 0; this.bloomOpts = { threshold: 0.1, knee: 0.7 };
    this._marks = [];                                 // emitter markers (setMarkers)
    this._ladder = null; this._level = 0;             // quality levels, best first (setLadder)
    this.governed = true;                             // step down when frames are slow

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
    this._fastSplat = this._probeBlend();
    this._software = /swiftshader|llvmpipe|software|basic render/i.test(this.rendererName());
    this._ready = false;              // _resize(true) below does the first build
    this.setQuality(perf.tier || 'medium');
    this._ready = true;

    // Context loss on a laptop GPU switch or driver reset used to leave a
    // permanently black canvas. Tear down cleanly and rebuild on restore.
    this._onLost = e => { e.preventDefault(); this._stop(); };
    this._onRestored = () => {
      try {
        this._initFormats(); this._initPrograms(); this._initBlit();
        this._fastSplat = this._probeBlend();
        this._resize(true);
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

  /** The graphics card's name, or '' where the browser will not say. */
  rendererName() {
    try {
      const gl = this.gl, ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
    } catch (_) { return ''; }
  }

  /* Can a half-float target be blended into? The fast splats need it. Tried
     once, on a 4 by 4 target: an error, or a framebuffer that will not take
     it, means the old way (read, add, write the whole buffer). */
  _probeBlend() {
    const gl = this.gl;
    if (!this.isWebGL2 || !this.progs.splatAdd) return false;
    try {
      while (gl.getError() !== gl.NO_ERROR) { /* clear */ }
      const t = this._createFBO(4, 4, this.fmtRGBA, gl.NEAREST);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      this.progs.splatAdd.bind();
      gl.uniform1f(this.progs.splatAdd.uniforms.aspectRatio, 1);
      gl.uniform1f(this.progs.splatAdd.uniforms.radius, 1);
      gl.uniform2f(this.progs.splatAdd.uniforms.point, 0.5, 0.5);
      gl.uniform3f(this.progs.splatAdd.uniforms.color, 1, 1, 1);
      this._blit(t);
      gl.disable(gl.BLEND);
      const ok = gl.getError() === gl.NO_ERROR;
      gl.deleteTexture(t.texture); gl.deleteFramebuffer(t.fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok;
    } catch (_) { return false; }
  }

  _initPrograms() {
    const gl = this.gl;
    // The extras (v3.36.0: the lines, the glow, the quick splats) are each tried
    // by themselves. A driver that will not take one of them loses that one
    // thing, and the fluid itself, the home screen's too, carries on without.
    const extra = (frag, what) => {
      try { return new Program(gl, BASE_VERT, frag); }
      catch (e) { console.warn(`[FluidFX] no ${what} on this graphics card:`, e && e.message); return null; }
    };
    this.progs = {
      copy:     new Program(gl, BASE_VERT, COPY_FRAG),
      clear:    new Program(gl, BASE_VERT, CLEAR_FRAG),
      splat:    new Program(gl, BASE_VERT, SPLAT_FRAG),
      advect:   new Program(gl, BASE_VERT, (this._linearOK ? '' : '#define MANUAL_FILTERING\n') + ADVECTION_FRAG),
      diverge:  new Program(gl, BASE_VERT, DIVERGENCE_FRAG),
      curl:     new Program(gl, BASE_VERT, CURL_FRAG),
      vorticity:new Program(gl, BASE_VERT, VORTICITY_FRAG),
      pressure: new Program(gl, BASE_VERT, PRESSURE_FRAG),
      gradSub:  new Program(gl, BASE_VERT, GRADIENT_SUBTRACT_FRAG),
      display:  new Program(gl, BASE_VERT, DISPLAY_FRAG),
      bloomPre: extra(BLOOM_PRE_FRAG, 'glow'),
      bloomBlur:extra(BLOOM_BLUR_FRAG, 'glow'),
      splatAdd: extra(SPLAT_ADD_FRAG, 'quick splats'),
      shade:    extra(SHADE_FRAG, 'contour lines'),
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

  /* Quality. A tier name (low, medium, high, ultra) for the theme's fluid,
     where the tier is a ceiling: when frames are slow it steps down by itself,
     unless the user chose the tier. setLadder gives a caller its own levels. */
  setQuality(tier) {
    const top = TIER[tier] ? tier : 'medium';
    const names = ['ultra', 'high', 'medium', 'low'];
    const levels = names.slice(names.indexOf(top)).map(n => ({ name: n, ...TIER[n] }));
    // Start where this run already settled, never above the ceiling. Not when
    // the tier is the user's own choice: that is taken as given, and what the
    // governor settled on before the choice is forgotten. (It started from
    // there all the same, with the governor off, so a choice of High after one
    // slow moment stayed on Low: the buttons were dead again.)
    if (perf.chosen) FluidFX._settled.delete('tier');
    const settled = FluidFX._settled.get('tier'), at = settled ? Math.max(0, levels.findIndex(l => l.name === settled)) : 0;
    this._setLadder('tier', levels, at, !perf.chosen);
  }

  /**
   * A caller's own quality levels, best first (the HD Flow visualiser's).
   * Each: { name, sim, iterations, fps, dissipation, velDissipation, curl,
   * radius } and either dye (its short side) or dyeScale (a share of the
   * canvas's own size, 1 for pixel for pixel), and optionally maxPixels (a cap
   * on the canvas's backing store).
   */
  setLadder(key, levels) {
    const settled = FluidFX._settled.get(key);
    let at = settled ? Math.max(0, levels.findIndex(l => l.name === settled)) : 0;
    if (!settled && this._software) at = levels.length - 1;     // no graphics card: straight to the lightest
    this._setLadder(key, levels, at, true);
  }

  _setLadder(key, levels, at, governed) {
    this._ladderKey = key; this._ladder = levels; this.governed = governed;
    // "Stepped down" is said of this ladder, in this run: not of another one
    // this fluid drew with before (Smoke after HD Flow), and it is said when
    // the level it starts at is one the governor settled on earlier.
    this.lowered = at > 0 && FluidFX._settled.has(key);
    this._applyLevel(Math.min(at, levels.length - 1));
  }

  _applyLevel(i) {
    this._level = i;
    this.cfg = this._ladder[i];
    this._tier = this.cfg.name;
    this._frameInterval = 1000 / this.cfg.fps;
    this._govN = 0; this._govEma = 0; this._govSkip = 24;   // the first frames after a change do not count
    if (this._ready && this.gl && this.canvas.width) this._resize(true);
  }

  /* The governor: called with the real time between drawn frames. When that
     stays well over what the level asks for, for about two seconds, the next
     level down takes over,
     two at once if it is over twice. It only goes down, and what it settles on
     holds for this run (FluidFX._settled), so nothing is tried twice, and
     nothing is kept on disk, where one bad moment would stick for good. */
  _govern(gap) {
    if (!this.governed || !this._ladder || this._level >= this._ladder.length - 1) return;
    if (gap > 250) { this._govN = 0; this._govEma = 0; return; }       // a pause, not a slow frame
    if (this._govSkip > 0) { this._govSkip--; return; }
    this._govEma = this._govEma ? this._govEma + (gap - this._govEma) * 0.08 : gap;
    // 26 ms at 60 a second: under 38 frames a second. Measured against the
    // screen where that is slower than the level: on a 30 Hz screen frames come
    // 33 ms apart on any machine, and every level stepped down in turn.
    const limit = Math.max(this._frameInterval, 16.7, perf.refreshMs || 0) * 1.45 + 2;
    // Slow for 60 frames running, about two seconds: a stumble of half a second
    // (another program starting, a window being dragged) is not a slow machine.
    if (this._govEma <= limit) { this._govN = 0; return; }
    if (++this._govN < 60) return;
    const to = Math.min(this._ladder.length - 1, this._level + (this._govEma > limit * 2 ? 2 : 1));
    FluidFX._settled.set(this._ladderKey, this._ladder[to].name);
    this.lowered = true;
    this._applyLevel(to);
    try { this.onQuality?.(this.cfg.name); } catch (_) {}
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
    kill(this.divergence); kill(this.curlFBO); kill(this.shaded); kill(this.bloomOut);
    for (const b of this.bloomLevels || []) kill(b);
    this.dye = this.velocity = this.pressure = this.divergence = this.curlFBO = this.shaded = this.bloomOut = null;
    this.bloomLevels = [];
  }

  _initFramebuffers() {
    const gl = this.gl, cfg = this.cfg;
    // Every resize and quality change rebuilds these. Without the dispose
    // the old dye buffer (up to 1024^2 x RGBA16F) is simply orphaned.
    this._disposeFramebuffers();
    const filter = this._linearOK ? gl.LINEAR : gl.NEAREST;
    const s = this._dims(cfg.sim);
    // dyeScale: a share of the canvas's own size, so 1 is pixel for pixel
    const d = cfg.dyeScale
      ? { width: Math.max(16, Math.round(gl.drawingBufferWidth * cfg.dyeScale)), height: Math.max(16, Math.round(gl.drawingBufferHeight * cfg.dyeScale)) }
      : this._dims(cfg.dye);
    this.dye      = this._createDouble(d.width, d.height, this.fmtRGBA, filter);
    this.velocity = this._createDouble(s.width, s.height, this.fmtRG,  filter);
    this.divergence = this._createFBO(s.width, s.height, this.fmtR, gl.NEAREST);
    this.curlFBO    = this._createFBO(s.width, s.height, this.fmtR, gl.NEAREST);
    this.pressure   = this._createDouble(s.width, s.height, this.fmtR, gl.NEAREST);
    // What is seen, at the screen's own size: the lines stay sharp whatever the dye's.
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    if (this.neon && this.progs.shade) this.shaded = this._createFBO(W, H, this.fmtRGBA, filter);
    if (this.bloom > 0 && this.progs.bloomPre && this.progs.bloomBlur) {
      // The glow starts at half the picture's size and halves from there, down
      // to about 8 pixels: the last levels are the wide halo.
      const src = this.shaded ? { width: W, height: H } : d;
      let w = Math.max(8, Math.round(src.width / 2)), h = Math.max(8, Math.round(src.height / 2));
      this.bloomOut = this._createFBO(w, h, this.fmtRGBA, filter);
      for (let n = 0; n < 8 && Math.min(w, h) > 12; n++) {
        w = Math.max(4, w >> 1); h = Math.max(4, h >> 1);
        this.bloomLevels.push(this._createFBO(w, h, this.fmtRGBA, filter));
      }
    }
  }

  /** The glow over the picture, 0 for none. { threshold, knee } shape what counts as bright. */
  setBloom(v, opts) {
    const was = this.bloom > 0;
    this.bloom = Math.max(0, +v || 0);
    if (opts) this.bloomOpts = { ...this.bloomOpts, ...opts };
    if (was !== this.bloom > 0 && this.dye) this._initFramebuffers();
  }

  /**
   * Neon: the dye runs past white and is tone-mapped. edge above 0 lights the
   * dye's edges and folds and fill dims its body (see SHADE_FRAG), which is
   * what makes threads of it.
   */
  setNeon(on, exposure = 1.4, { edge = 0, fill = 1, level0 = 0.06, octaves = 2, width = 1.4 } = {}) {
    const was = this.neon;
    this.neon = !!on; this.exposure = exposure; this.edge = edge; this.fill = fill;
    this.lines = { level0, octaves, width };   // the first contour's density, doublings between contours, width in pixels
    if (was !== this.neon && this.dye) this._initFramebuffers();
  }

  /** Several settings at once, with the buffers rebuilt once at the end and not after each. */
  configure(fn) {
    const was = this._ready; this._ready = false;
    const dye = this.dye; this.dye = null;            // setBloom and setNeon rebuild only while there is dye
    try { fn(this); } finally { this.dye = dye; this._ready = was; }
    if (was && this.gl && this.canvas.width) this._resize(true);
  }

  /** Up to six glowing markers: [{ x, y, color: [r, g, b], strength }], in the picture's own 0 to 1. */
  setMarkers(list) { this._marks = (list || []).slice(0, 6); }

  _resize(force) {
    const c = this.canvas;
    // Cap the backing store: on a 4K display a 1:1 dye buffer is the single
    // biggest cost here, and the effect is a soft background either way.
    // A level may cap the pixels outright (v3.36.0): pixel for pixel on a 4K
    // screen is four times the work of 1080p. Such a level is held by that cap
    // alone, not by the 1.5 as well: at a display scale of 200% the top level
    // was otherwise not pixel for pixel, which is what it is there for.
    const cap = this.cfg?.maxPixels;
    let dpr = Math.min(window.devicePixelRatio || 1, this._tier === 'low' ? 1 : cap ? 3 : 1.5);
    const px = c.clientWidth * c.clientHeight * dpr * dpr;
    if (cap && px > cap) dpr *= Math.sqrt(cap / px);
    const w = Math.max(1, Math.floor(c.clientWidth  * dpr));
    const h = Math.max(1, Math.floor(c.clientHeight * dpr));
    if (!force && c.width === w && c.height === h) return;
    c.width = w; c.height = h;
    this._initFramebuffers();
    // Frames spent rebuilding are not slow frames: a window being dragged to a
    // new size rebuilds on every one of them.
    this._govSkip = 24; this._govN = 0; this._govEma = 0;
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
    if (this._fastSplat) return this._splatFast(x, y, dx, dy, color, this._splatRadius() * radiusScale);
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
    this.splats = (this.splats || 0) + 1;
  }

  /* A splat drawn only where it lands (v3.36.0). The blob is under a two-
     thousandth of its peak 2.8 "radii" out, so a scissor box that size is all
     that needs shading, and blending adds it in place: no read of the target,
     no pass over the rest of it. dye and push can each be left out (null). */
  _splatFast(x, y, dx, dy, color, r) {
    const gl = this.gl, P = this.progs.splatAdd;
    const aspect = this.canvas.width / this.canvas.height, ext = 2.8 * Math.sqrt(r);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.enable(gl.SCISSOR_TEST);
    P.bind();
    gl.uniform1f(P.uniforms.aspectRatio, aspect);
    gl.uniform2f(P.uniforms.point, x, y);
    gl.uniform1f(P.uniforms.radius, r);
    const draw = (t, a, b, c) => {
      const w = t.width, h = t.height, ex = ext / aspect * w, ey = ext * h;
      const x0 = Math.max(0, Math.floor(x * w - ex)), y0 = Math.max(0, Math.floor(y * h - ey));
      const x1 = Math.min(w, Math.ceil(x * w + ex)), y1 = Math.min(h, Math.ceil(y * h + ey));
      if (x1 <= x0 || y1 <= y0) return;
      gl.viewport(0, 0, w, h); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.scissor(x0, y0, x1 - x0, y1 - y0);
      gl.uniform3f(P.uniforms.color, a, b, c);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
    if (dx || dy) draw(this.velocity.read, dx, dy, 0);
    if (color) draw(this.dye.read, color[0], color[1], color[2]);
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
    this.splats = (this.splats || 0) + 1;
  }

  /** A splat by its own radius (the Gaussian's, in units of the picture's height squared), for callers that size their own. */
  splat(x, y, dx, dy, color, r) {
    if (!this.dye || !this.velocity) return;
    if (this._fastSplat) return this._splatFast(x, y, dx, dy, color, r);
    const base = this._splatRadius();
    this._splat(x, y, dx, dy, color || [0, 0, 0], r / base);
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
  /* Stop at once, no fade (v3.33.0): the visualiser's fluid, once its canvas
     is hidden. setMode('off') lets the loop fade the picture out, about 74
     frames of full simulation, drawn into a canvas no one could see (seven
     seconds of it on a slow machine). The theme's background keeps its fade. */
  halt() {
    this.mode = 'off'; this._targetAlpha = 0; this._alpha = 0;
    this._stop();
    try { this._clearScreen(); } catch(_) {}
  }
  resume() { this.paused = false; if (this.mode === 'fluid') this._start(); }

  /* The pointer's trail. It used the ambient splat size at a brighter colour
     and a hard push, so every mouse movement threw a big bright blob (called
     "too big" on a real machine). Now about a third of the size, under half
     as bright and a gentler push; the ambient swirls are unchanged. */
  addPointer(x, y, dx, dy, color) {
    if (this.mode !== 'fluid') return;
    this._splat(x, y, dx * POINTER.force, dy * POINTER.force, color || this._randomColor(POINTER.dye), POINTER.radius);
  }

  _start() {
    if (this._raf || this.paused) return;
    this._lastTime = performance.now();
    this._accum = 0;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const now = performance.now();
      this._accum += now - this._lastTime;
      this._lastTime = now;
      // 4 ms of slack (v3.36.0): on a 144 Hz screen two refreshes are 13.9 ms,
      // just short of a 60-a-second level's 16.7, so it drew every third: 48.
      if (this._accum < this._frameInterval - 4) return;
      const gap = this._accum;
      this._accum = 0;
      // The step is the time since the last DRAWN frame (v3.36.0). It was the
      // time since the last refresh: 6.9 ms on a 144 Hz screen for a frame
      // drawn every 20.8, so the fluid ran three times too slow there, five
      // times at the 30-a-second tier, and dye piled up into a white fog.
      // Clamped: a background tab or a long pause otherwise gives one enormous
      // step that blows the advection apart. At a twentieth of a second, so a
      // level drawn 30 times a second keeps true time on any screen (five
      // refreshes of a 144 Hz one are 34.7 ms, three of a 75 Hz one are 40).
      const dt = Math.min(gap / 1000, 1 / 20);

      this._alpha += (this._targetAlpha - this._alpha) * 0.06;
      if (this._targetAlpha === 0 && this._alpha < 0.01) { this._stop(); this._clearScreen(); return; }

      try {
        this._resize();
        // The audio visualiser's fluid moves with the music only (v3.29.0).
        if (!this.audioDriven) this._autoSplat(now);
        if (this.onFrame) this.onFrame(dt, now);   // a caller's splats, once per step
        this._step(dt);
        this._render();
        this.frames = (this.frames || 0) + 1;
        this._govern(gap);
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

  /* The glow: what is bright in `source`, halved down the levels and added
     back up, into bloomOut. */
  _bloomPass(source) {
    const gl = this.gl, P = this.progs, L = this.bloomLevels;
    gl.disable(gl.BLEND);
    P.bloomPre.bind();
    const th = this.bloomOpts.threshold, knee = th * this.bloomOpts.knee + 0.0001;
    gl.uniform3f(P.bloomPre.uniforms.curve, th - knee, knee * 2, 0.25 / knee);
    gl.uniform1f(P.bloomPre.uniforms.threshold, th);
    gl.uniform1i(P.bloomPre.uniforms.uTexture, source.attach(0));
    this._blit(this.bloomOut);
    P.bloomBlur.bind();
    gl.uniform1f(P.bloomBlur.uniforms.uGain, 1);
    let last = this.bloomOut;
    for (const dest of L) {
      gl.uniform2f(P.bloomBlur.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
      gl.uniform1i(P.bloomBlur.uniforms.uTexture, last.attach(0));
      this._blit(dest); last = dest;
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = L.length - 2; i >= 0; i--) {
      gl.uniform2f(P.bloomBlur.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
      gl.uniform1i(P.bloomBlur.uniforms.uTexture, last.attach(0));
      this._blit(L[i]); last = L[i];
    }
    gl.disable(gl.BLEND);
    // the sum, over the bright picture itself; shared out, so more levels are wider, not brighter
    gl.uniform2f(P.bloomBlur.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
    gl.uniform1i(P.bloomBlur.uniforms.uTexture, last.attach(0));
    gl.uniform1f(P.bloomBlur.uniforms.uGain, 1 / Math.max(1, L.length * 0.5));
    this._blit(this.bloomOut);
  }

  _render() {
    const gl = this.gl, P = this.progs;
    let picture = this.dye.read;
    gl.disable(gl.BLEND);
    if (this.neon && this.shaded && P.shade) {
      // dye to what is seen: edges lit, body dimmed, markers on
      P.shade.bind();
      // the slope is read one screen pixel either side, or one dye texel where those are larger
      gl.uniform2f(P.shade.uniforms.texelSize, Math.max(this.dye.texelSizeX, this.shaded.texelSizeX), Math.max(this.dye.texelSizeY, this.shaded.texelSizeY));
      gl.uniform1i(P.shade.uniforms.uTexture, this.dye.read.attach(0));
      gl.uniform1f(P.shade.uniforms.uEdge, this.edge);
      gl.uniform1f(P.shade.uniforms.uFill, this.fill);
      gl.uniform1f(P.shade.uniforms.uLevel0, this.lines.level0);
      gl.uniform1f(P.shade.uniforms.uOctaves, this.lines.octaves);
      // A line's width is given in CSS pixels, so it is as bold on a display
      // scaled to 125% as on a plain one. The slope above is per step, so it is
      // divided by the step's size in the canvas's own pixels.
      const perCss = this.canvas.width / Math.max(1, this.canvas.clientWidth || this.canvas.width);
      gl.uniform1f(P.shade.uniforms.uWidth, this.lines.width * Math.max(1, perCss) / Math.max(1, this.shaded.width * Math.max(this.dye.texelSizeX, this.shaded.texelSizeX)));
      gl.uniform1f(P.shade.uniforms.uAspect, this.canvas.width / this.canvas.height);
      gl.uniform1f(P.shade.uniforms.uMarkSize, this.markSize || 0.012);
      const pos = this._markPos || (this._markPos = new Float32Array(18)), col = this._markCol || (this._markCol = new Float32Array(18));
      pos.fill(0); col.fill(0);
      this._marks.forEach((m, i) => { pos.set([m.x, m.y, m.strength ?? 1], i * 3); col.set(m.color, i * 3); });
      gl.uniform3fv(P.shade.uniforms['uMarkPos[0]'], pos);
      gl.uniform3fv(P.shade.uniforms['uMarkCol[0]'], col);
      this._blit(this.shaded);
      picture = this.shaded;
    }
    const glow = this.bloom > 0 && this.bloomOut && this.bloomLevels.length > 1 && P.bloomPre && P.bloomBlur;
    if (glow) this._bloomPass(picture);
    // Written, not blended (v3.36.0). It was blended over whatever the canvas
    // held, trusting the browser to have emptied it since the last frame. That
    // holds when every frame is shown, but two frames drawn before one is shown
    // pile up, and a faint glow piled up a few times turns solid. On an empty
    // canvas the two give the same picture, so nothing else changes.
    gl.disable(gl.BLEND);
    P.display.bind();
    gl.uniform2f(P.display.uniforms.texelSize, this.dye.texelSizeX, this.dye.texelSizeY);
    gl.uniform1i(P.display.uniforms.uTexture, picture.attach(0));
    gl.uniform1f(P.display.uniforms.uAlpha, this._alpha);
    gl.uniform1f(P.display.uniforms.uShading, this._tier === 'low' ? 0 : 1);
    gl.uniform1i(P.display.uniforms.uBloom, glow ? this.bloomOut.attach(1) : picture.attach(1));
    gl.uniform1f(P.display.uniforms.uBloomAmt, glow ? this.bloom : 0);
    gl.uniform1f(P.display.uniforms.uNeon, this.neon ? 1 : 0);
    gl.uniform1f(P.display.uniforms.uExposure, this.exposure || 1.4);
    this._blit(null);
  }

  destroy() {
    FluidFX.all?.delete(this);
    this._stop();
    this._disposeFramebuffers();
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}

/* Where each kind of quality ladder settled, for this run: 'tier' for the
   theme's fluid, and a caller's own key. Not kept on disk (see _govern). */
FluidFX._settled = new Map();
