/**
 * Fox3D: the welcome-screen fox as a real 3D low-poly head.
 *
 * The mesh (fox3d-mesh.js) is generated from a hand-placed design by
 * tools/fox3d/fox3d.py: the approved flat design is its front, with a skull,
 * throat and ear thickness added and checked from every side. 163 triangles,
 * drawn here by a small WebGL renderer written for it, so three.js does not
 * come back. Each triangle carries its own normal, so every facet gets one
 * crisp colour: a key light from the upper left (the same one the flat
 * design used), a soft fill from the right, warm rather than grey shadows,
 * and a rim in the theme's accent colour.
 *
 * Its head turns from the neck: it looks around on its own, follows the
 * pointer, blinks, flicks an ear, perks up when media starts, squints when
 * happy and nods with music. The base of the chest stays put (v3.28.0). Where WebGL is not available, and in Lite mode, the flat
 * SVG fox (geofox.js) is used instead: createFox() picks.
 *
 * v3.42.0: it can be played with (play/fox-play.js). react(name) runs a
 * reaction (a boop on the nose, a flicked ear, a bonk on the head, a tickle,
 * a sneeze, a yawn, a spin), pet() makes it lean into a stroking hand with
 * its eyes half shut, setSleep() lets it doze, and it has a mouth: dark,
 * with a tongue, opening down from under the nose like a jaw dropping, for
 * yawns, laughs and talking (setMouth). hit(x, y) says which part of it a
 * point on the screen is over.
 */

import { TRIANGLES, MATERIALS, MATERIAL_ORDER, PARTS, PIVOTS } from './fox3d-mesh.js';
import { GeoFox } from './geofox.js';
import { frameGap } from './power.js';   // v3.39.0

/* ── a few 4x4 matrix helpers, column-major ─────────────────────── */
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
  }
  return o;
}
const T = (x, y, z) => { const m = I(); m[12] = x; m[13] = y; m[14] = z; return m; };
const S = (x, y, z) => { const m = I(); m[0] = x; m[5] = y; m[10] = z; return m; };
function R(axis, a) {
  let [x, y, z] = axis; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
          t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1];
}
// The neck: just above the flat base of the chest ruff (the mesh spans y -2.08
// to 1.80), where the head turns, nods and tilts from (v3.28.0).
const NECK = [0, -1.55, -0.1];

const about = (p, m) => mul(T(p[0], p[1], p[2]), mul(m, T(-p[0], -p[1], -p[2])));
const R_ = R;   // the pose below names its reaction R
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

/* ── The Santa hat, for the Snow theme ───────────────────────────────
   Built here rather than in the fox's mesh: a white fur brim on the crown
   between the ears, a red cone in two sections whose tip flops over to one
   side, and a white pompom. Low-poly and lit like the fox, and part of the
   head, so it turns and nods with it. */
export function hatTriangles() {   // also drawn flat by geofox.js
  const out = [];
  const RED = [0.84, 0.16, 0.22], WHITE = [0.96, 0.96, 0.97];
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const axis = [[0, 0.90, 0.03], [0, 1.12, 0.03], [0.18, 1.64, -0.02], [0.62, 1.94, -0.10]];
  const axisAt = y => {
    for (let i = 1; i < axis.length; i++) if (y <= axis[i][1]) {
      const a = axis[i - 1], b = axis[i], k = (y - a[1]) / ((b[1] - a[1]) || 1);
      return [a[0] + (b[0] - a[0]) * k, y, a[2] + (b[2] - a[2]) * k];
    }
    return axis[axis.length - 1];
  };
  const ring = (c, rx, rz, n) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [c[0] + Math.cos(a) * rx, c[1], c[2] + Math.sin(a) * rz]; });
  const tri = (a, b, c, col, ref) => {
    let n = cross(sub3(b, a), sub3(c, a)); const l = Math.hypot(...n) || 1; n = n.map(v => v / l);
    const cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot(n, sub3(cen, ref || axisAt(cen[1]))) < 0) { n = n.map(v => -v); [b, c] = [c, b]; }   // face outwards
    out.push({ p: [a, b, c], n, col });
  };
  const N = 12, below = [0, 0.95, 0.03];
  const b0 = ring([0, 0.90, 0.03], 0.56, 0.44, N), b1 = ring([0, 1.12, 0.03], 0.56, 0.44, N);
  const c0 = ring([0, 1.12, 0.03], 0.43, 0.34, N), m = ring([0.18, 1.64, -0.02], 0.21, 0.17, N);
  const tip = [0.62, 1.94, -0.10];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    tri(b0[i], b0[j], b1[j], WHITE); tri(b0[i], b1[j], b1[i], WHITE);                 // brim band
    tri(b1[i], b1[j], c0[j], WHITE, below); tri(b1[i], c0[j], c0[i], WHITE, below);   // top of the brim
    tri(c0[i], c0[j], m[j], RED); tri(c0[i], m[j], m[i], RED);                       // lower cone
    tri(m[i], m[j], tip, RED);                                                        // the part that flops over
  }
  // The pompom: an octahedron split once and pushed out to a sphere, so it
  // reads as a ball rather than a diamond.
  const P = [0.68, 1.92, -0.10], r = 0.17;
  const onBall = q => { const d = [q[0] - P[0], q[1] - P[1], q[2] - P[2]], l = Math.hypot(...d) || 1; return [P[0] + d[0] / l * r, P[1] + d[1] / l * r, P[2] + d[2] / l * r]; };
  const mid = (a, b) => onBall([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  const v = [[P[0] + r, P[1], P[2]], [P[0] - r, P[1], P[2]], [P[0], P[1] + r, P[2]], [P[0], P[1] - r, P[2]], [P[0], P[1], P[2] + r], [P[0], P[1], P[2] - r]];
  for (const [a, b, c] of [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]) {
    const A = v[a], B = v[b], C = v[c], ab = mid(A, B), bc = mid(B, C), ca = mid(C, A);
    for (const [x1, x2, x3] of [[A, ab, ca], [ab, B, bc], [ca, bc, C], [ab, bc, ca]]) tri(x1, x2, x3, WHITE, P);
  }
  return out;
}

/* ── The mouth (v3.42.0) ────────────────────────────────────────────
   Not in the mesh: the approved design has none. A dark opening with a
   tongue, part 6, in front of the muzzle just under the nose and turned
   towards the camera. Its matrix stretches it down from its top edge, so
   closed it is a line (not drawn at all) and open it drops like a jaw. */
const MOUTH_TOP = [0, -1.425, 1.30];
const MOUTH_DOWN = (() => { const v = [0, -1, -0.55], l = Math.hypot(...v); return v.map(c => c / l); })();
const MOUTH_H = 0.40;
export function mouthTriangles() {
  const out = [], u = [1, 0, 0], w = MOUTH_DOWN, n = [0, w[2], -w[1]];    // n = w x u: forward and a little down
  const at = (a, d, off = 0) => [MOUTH_TOP[0] + u[0] * a + w[0] * d + n[0] * off, MOUTH_TOP[1] + u[1] * a + w[1] * d + n[1] * off, MOUTH_TOP[2] + u[2] * a + w[2] * d + n[2] * off];
  const fan = (cd, rx, ry, off, col, N) => {
    const c = at(0, cd, off);
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
      let p = at(Math.cos(a0) * rx, cd + Math.sin(a0) * ry, off), q = at(Math.cos(a1) * rx, cd + Math.sin(a1) * ry, off);
      // facing the camera: the triangle's own normal along n
      const e1 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], e2 = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
      const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (g[0] * n[0] + g[1] * n[1] + g[2] * n[2] < 0) [p, q] = [q, p];
      out.push({ p: [c, p, q], n, col });
    }
  };
  fan(MOUTH_H / 2, 0.2, MOUTH_H / 2, 0, [0.22, 0.05, 0.06], 18);                // the opening
  fan(MOUTH_H * 0.70, 0.13, MOUTH_H * 0.2, 0.006, [0.93, 0.43, 0.49], 14);      // the tongue
  return out;
}

const VS = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec4 aCol; attribute float aPart;
uniform mat4 uProj; uniform mat4 uModel; uniform mat4 uPart[7];
uniform mat4 uBody;   // v3.30.1: where the chest stays
varying vec3 vN; varying vec4 vCol;
void main() {
  int p = int(aPart + 0.5);
  mat4 pm = uPart[0];
  if (p == 1) pm = uPart[1]; else if (p == 2) pm = uPart[2]; else if (p == 3) pm = uPart[3];
  else if (p == 4) pm = uPart[4]; else if (p == 5) pm = uPart[5]; else if (p == 6) pm = uPart[6];
  // Skinning (v3.30.1): the head turns, the chest stays where it is, and the
  // neck bends between them. Each point follows the head by its height: none
  // below y -1.85 (the chest), fully above -1.35 (the nose is at -1.24).
  // The whole fox used to turn as one piece, so it swayed like a balloon.
  float w = smoothstep(-1.85, -1.35, aPos.y);
  mat4 m = (uBody * (1.0 - w) + uModel * w) * pm;
  vN = (m * vec4(aNorm, 0.0)).xyz;
  vCol = aCol;
  gl_Position = uProj * m * vec4(aPos, 1.0);
}`;
const FS = `
precision mediump float;
varying vec3 vN; varying vec4 vCol;
uniform vec3 uKey; uniform vec3 uFill; uniform vec3 uRim;
void main() {
  vec3 n = normalize(vN);
  float d = max(dot(n, uKey), 0.0);
  float f = max(dot(n, uFill), 0.0);
  vec3 lit = vCol.rgb * (0.70 + 0.38 * d + 0.10 * f) + vec3(0.035, 0.018, 0.0) * (1.0 - d);
  float rim = pow(1.0 - max(n.z, 0.0), 2.4);
  lit += uRim * rim * 0.30;
  gl_FragColor = vec4(min(mix(vCol.rgb, lit, vCol.a), 1.0), 1.0);
}`;

const norm3 = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const KEY = norm3([-0.45, 0.55, 0.70]), FILL = norm3([0.7, 0.1, 0.6]);

function hexToRgb(h) {
  const m = String(h || '').trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [0.36, 0.44, 0.97];
  const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export class Fox3D {
  constructor(canvas) {
    this.kind = 'webgl';
    this.canvas = canvas;
    this.triangles = TRIANGLES.length;
    const opts = { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl || typeof gl.createShader !== 'function') throw new Error('WebGL unavailable');
    this.gl = gl;
    this.renderer = gl;                        // diagnostics and tests read this
    this._build();
    this._state = { t0: performance.now(), mx: 0, my: 0, tx: 0, ty: 0, lastMove: 0, blinkUntil: 0, nextBlink: 0,
                    twitch: null, nextTwitch: 0, perkUntil: 0, happy: false, energy: 0, energyS: 0,
                    // v3.42.0: play
                    react: null, mouthTalk: 0, mouth: 0, pet: 0, petDir: 0, sleep: false, sleepS: 0, spinYaw: 0, spinV: 0 };
    const now = performance.now();
    this._state.nextBlink = now + 2500 + Math.random() * 3000;
    this._state.nextTwitch = now + 5000 + Math.random() * 6000;
    this._reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this._rim = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    this._onMove = e => this.lookAt(e.clientX, e.clientY);
    window.addEventListener('mousemove', this._onMove, { passive: true });
    this._onLost = e => { e.preventDefault(); this._lost = true; };
    this._onRestored = () => { this._lost = false; this._build(); };
    canvas.addEventListener('webglcontextlost', this._onLost);
    canvas.addEventListener('webglcontextrestored', this._onRestored);
    this._paused = false;
    this._frame = this._frame.bind(this);
    this._raf = requestAnimationFrame(this._frame);
  }

  _build() {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('fox shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('fox program: ' + gl.getProgramInfoLog(prog));
    this.prog = prog;
    // Interleaved: position 3, normal 3, colour 4, part 1 = 11 floats per vertex.
    const data = new Float32Array(TRIANGLES.length * 3 * 11);
    let o = 0;
    for (const t of TRIANGLES) {
      const mat = MATERIAL_ORDER[t[12]], rgb = MATERIALS[mat].map(c => c / 255);
      const lit = mat === 'glint' ? 0 : 1;
      for (let v = 0; v < 3; v++) {
        data[o++] = t[v * 3]; data[o++] = t[v * 3 + 1]; data[o++] = t[v * 3 + 2];
        data[o++] = t[9]; data[o++] = t[10]; data[o++] = t[11];
        data[o++] = rgb[0]; data[o++] = rgb[1]; data[o++] = rgb[2]; data[o++] = lit;
        data[o++] = t[13];
      }
    }
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.count = TRIANGLES.length * 3;
    // Built shapes in the same layout: the hat (part 0, drawn only in Snow)
    // and the mouth (part 6, drawn only while it is open). lit 0: flat colour.
    const pack = (tris, part, lit) => {
      const d = new Float32Array(tris.length * 3 * 11);
      let q = 0;
      for (const t of tris) for (const p of t.p) {
        d[q++] = p[0]; d[q++] = p[1]; d[q++] = p[2]; d[q++] = t.n[0]; d[q++] = t.n[1]; d[q++] = t.n[2];
        d[q++] = t.col[0]; d[q++] = t.col[1]; d[q++] = t.col[2]; d[q++] = lit; d[q++] = part;
      }
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
      return { b, n: tris.length * 3 };
    };
    const hat = pack(hatTriangles(), 0, 1), mouth = pack(mouthTriangles(), 6, 0);
    this.hatBuf = hat.b; this.hatCount = hat.n;
    this.mouthBuf = mouth.b; this.mouthCount = mouth.n;
    this.loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'), aNorm: gl.getAttribLocation(prog, 'aNorm'),
      aCol: gl.getAttribLocation(prog, 'aCol'), aPart: gl.getAttribLocation(prog, 'aPart'),
      uProj: gl.getUniformLocation(prog, 'uProj'), uModel: gl.getUniformLocation(prog, 'uModel'), uBody: gl.getUniformLocation(prog, 'uBody'),
      uPart: gl.getUniformLocation(prog, 'uPart'), uKey: gl.getUniformLocation(prog, 'uKey'),
      uFill: gl.getUniformLocation(prog, 'uFill'), uRim: gl.getUniformLocation(prog, 'uRim'),
    };
  }

  /* What a reaction (v3.42.0) adds to the pose at k, from 0 to 1 of its time.
     Angles in radians; eye multiplies how open the eyes are, wide scales
     them, ear adds to each ear's flick (below 0 flattens it back, as a
     flick does), nose scales the nose, mouth opens it (0 to 1). */
  _reactPose(R, k) {
    const o = { yaw: 0, pitch: 0, roll: 0, eye: 1, wide: 1, earL: 0, earR: 0, nose: 1, mouth: 0, happy: false };
    const up = x => Math.sin(Math.PI * Math.min(1, Math.max(0, x)));     // 0 to 1 and back
    const side = R.side || 1;
    switch (R.name) {
      case 'boop':
        o.nose = k < 0.3 ? 1 - 0.24 * up(k / 0.3) : 1;
        o.eye = k < 0.35 ? 0.1 : k < 0.5 ? 0.1 + 0.9 * (k - 0.35) / 0.15 : 1;
        o.pitch = -0.10 * up(k / 0.55);
        o.earL = o.earR = -0.3 * up(k / 0.6);
        break;
      case 'sneeze':
        if (k < 0.45) { const a = k / 0.45; o.pitch = -0.13 * a; o.eye = 1 - 0.5 * a; o.mouth = 0.35 * a; o.nose = 1 + 0.06 * a; }
        else if (k < 0.62) { const a = (k - 0.45) / 0.17; o.pitch = -0.13 + 0.38 * a; o.eye = 0.05; o.mouth = 0.95; o.nose = 1.12; o.earL = o.earR = -0.35; }
        else { const a = (k - 0.62) / 0.38; o.pitch = 0.25 * (1 - a); o.eye = 0.05 + 0.95 * a; o.mouth = 0.95 * (1 - a) * (1 - a); o.earL = o.earR = -0.35 * (1 - a); }
        break;
      case 'ear':
        if (side < 0) o.earL = -0.95 * up(k); else o.earR = -0.95 * up(k);
        o.roll = side * 0.09 * up(k);
        o.eye = k < 0.25 ? 0.4 : 1;
        break;
      case 'eye':
        o.eye = k < 0.45 ? 0.05 : k < 0.6 ? 0.05 + 0.95 * (k - 0.45) / 0.15 : 1;
        o.yaw = -side * 0.24 * up(k / 0.8);
        o.pitch = -0.05 * up(k);
        o.earL = o.earR = -0.35 * up(k);
        break;
      case 'bonk':
        o.pitch = 0.18 * up(k / 0.45) * (k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55);
        o.eye = k < 0.45 ? 0.12 : 0.55;
        o.earL = o.earR = -0.4 * up(k / 0.7);
        o.nose = k < 0.2 ? 1 - 0.1 * up(k / 0.2) : 1;
        break;
      case 'tickle': case 'laugh': {
        const fade = 1 - k * k;
        o.roll = 0.11 * Math.sin(k * Math.PI * 2 * 5.5) * fade;
        o.yaw = 0.06 * Math.sin(k * Math.PI * 2 * 3.3) * fade;
        o.pitch = 0.05 * Math.abs(Math.sin(k * Math.PI * 2 * 4)) * fade;
        o.eye = 0.32; o.happy = true;
        o.mouth = (0.3 + 0.5 * Math.abs(Math.sin(k * Math.PI * 2 * 4.5))) * fade;
        o.earL = o.earR = -0.15 * fade;
        break;
      }
      case 'cheek':
        o.yaw = side * 0.26 * up(k); o.roll = side * 0.09 * up(k); o.eye = 0.45; o.happy = true;
        o.mouth = 0.18 * up(k);
        break;
      case 'surprise':
        o.wide = 1 + 0.32 * up(k / 0.5) * (k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5);
        o.pitch = -0.08 * up(k);
        o.earL = o.earR = 0.3 * up(k);
        o.mouth = 0.35 * up(k / 0.7);
        break;
      case 'yawn': {
        const m = k < 0.32 ? Math.sin(Math.PI / 2 * k / 0.32) : k < 0.72 ? 1 : Math.cos(Math.PI / 2 * (k - 0.72) / 0.28);
        o.mouth = m; o.eye = 1 - 0.85 * m; o.pitch = -0.13 * m; o.earL = o.earR = -0.25 * m;
        o.roll = 0.05 * m;
        break;
      }
      case 'dizzy':
        o.roll = 0.13 * Math.sin(k * Math.PI * 2 * 2.6) * (1 - k);
        o.eye = 0.5 + 0.5 * k;
        o.mouth = 0.2 * (1 - k);
        break;
      case 'happy': o.eye = 0.4; o.happy = true; o.pitch = 0.07 * Math.sin(k * Math.PI * 4) * (1 - k); o.mouth = 0.22 * up(k); break;
      case 'listen': o.roll = side * 0.13 * up(Math.min(1, k * 1.6)); o.earL = o.earR = 0.32 * up(k); o.pitch = -0.04 * up(k); break;
      case 'nod': o.pitch = 0.12 * Math.sin(k * Math.PI * 4) * (1 - k); break;
      case 'hug': o.eye = 0.25; o.happy = true; o.pitch = 0.06 * up(k); o.roll = 0.07 * up(k); o.earL = o.earR = -0.25 * up(k); break;
    }
    return o;
  }

  /** Head pose and part matrices for time `now`. Exposed as renderAt() for tests and previews. */
  _pose(now) {
    const s = this._state, t = (now - s.t0) / 1000, still = this._reduced;
    const dt = Math.min(0.05, Math.max(0.001, (now - (s.lastPose || now)) / 1000)); s.lastPose = now;
    // v3.42.0: a reaction under way, petting, dozing, a spin
    let R = null;
    if (s.react) { const k = (now - s.react.at) / s.react.dur; if (k >= 1) s.react = null; else R = this._reactPose(s.react, Math.max(0, k)); }
    s.pet *= Math.exp(-dt * 2.2);
    s.sleepS += ((s.sleep ? 1 : 0) - s.sleepS) * Math.min(1, dt * 1.6);
    s.spinV += (-36 * s.spinYaw - 3.4 * s.spinV) * dt; s.spinYaw = Math.max(-1.3, Math.min(1.3, s.spinYaw + s.spinV * dt));
    // look around on its own; follow the pointer while it is moving
    const idleYaw = still ? 0 : (0.20 * Math.sin(t * 0.37) + 0.08 * Math.sin(t * 0.91 + 1.3)) * (1 - 0.8 * s.sleepS);
    const idlePitch = still ? 0 : 0.05 * Math.sin(t * 0.53 + 0.4);
    // A curious tilt: the pointer resting near the fox makes it cock its head.
    const rest = now - s.lastMove, near = Math.hypot(s.tx, s.ty) < 0.4;
    const tiltTo = (!still && near && rest > 800 && rest < 6000) ? 0.09 * (s.tx < 0 ? -1 : 1) : 0;
    s.tilt = (s.tilt || 0) + (tiltTo - (s.tilt || 0)) * 0.05;
    const roll = (still ? 0 : 0.035 * Math.sin(t * 0.29 + 2.1) + s.tilt) + (R ? R.roll : 0) + s.petDir * 0.10 * s.pet;
    const follow = still ? 0 : Math.max(0, 1 - (now - s.lastMove) / 4000) * (1 - s.sleepS);
    s.mx += (s.tx * follow - s.mx) * 0.08; s.my += (s.ty * follow - s.my) * 0.08;
    const yaw = this._yaw ?? (idleYaw * (1 - follow) + s.mx * 0.48 + (R ? R.yaw : 0) + s.spinYaw);
    const pitch = this._pitch ?? (idlePitch * (1 - follow) + s.my * 0.22 + (R ? R.pitch : 0) + 0.06 * s.pet
      + s.sleepS * (0.13 + 0.015 * Math.sin(t * 1.3)));
    s.energyS += (s.energy - s.energyS) * 0.15;
    const perk = now < s.perkUntil ? Math.sin(Math.PI * (1 - (s.perkUntil - now) / 700)) : 0;
    // The mouth: talking, or what a reaction asks; it opens fast and closes a little slower.
    const mouthTo = Math.max(s.mouthTalk, R ? R.mouth : 0);
    s.mouth += (mouthTo - s.mouth) * (mouthTo > s.mouth ? 0.55 : 0.3);
    // v3.28.0: the head turns from the neck, and nothing else moves the fox.
    // It used to rise and fall (with music and when excited), grow and shrink
    // (breathing) and swivel about its middle, so the whole fox drifted like a
    // balloon. Now the base of the chest stays put: music and excitement make
    // it nod, and turning, nodding and tilting pivot at the neck. The ears,
    // eyes and nose still move on their own.
    const nod = perk * 0.10 + s.energyS * 0.07 + s.mouth * 0.035;
    // The chest ruff makes the fox taller: lifted and framed a little wider.
    // pitch + nod, not -(pitch + nod) (v3.30.1): with the pointer above the fox
    // (s.my below 0) it looked down. Now it looks up, and a nod dips the chin.
    let model = mul(T(0, 0.12, 0), about(NECK, mul(R_([0, 1, 0], yaw), mul(R_([1, 0, 0], pitch + nod), R_([0, 0, 1], roll)))));
    model = mul(T(0, 0, -22), model);                          // a long lens: 22 units back
    this._body = mul(T(0, 0, -22), T(0, 0.12, 0));             // the chest: placed, never turned
    this._model = model;                                       // for tests: where the head points
    // ears: flick back about the base edge, perk forward when excited
    const earM = side => {
      const piv = side < 0 ? PIVOTS.ear_l : [-PIVOTS.ear_l[0], PIVOTS.ear_l[1], PIVOTS.ear_l[2]];
      const ax = side < 0 ? PIVOTS.ear_axis_l : [PIVOTS.ear_axis_l[0], -PIVOTS.ear_axis_l[1], -PIVOTS.ear_axis_l[2]];
      // Each ear swivels on its own axis, out of step with the other, and
      // both lean towards the pointer, like a fox listening.
      const up = side < 0 ? PIVOTS.ear_up_l : [-PIVOTS.ear_up_l[0], PIVOTS.ear_up_l[1], PIVOTS.ear_up_l[2]];
      const sw = still ? 0 : (0.10 * Math.sin(t * 0.47 + (side < 0 ? 0 : 1.9)) + 0.05 * Math.sin(t * 1.3 + side)) * (1 - 0.7 * s.sleepS) + s.mx * 0.22;
      let a = -perk * 0.18 + (R ? (side < 0 ? R.earL : R.earR) : 0) - 0.22 * s.pet - 0.2 * s.sleepS;
      if (s.twitch && s.twitch.side === side) {
        const k = (now - s.twitch.at) / 460;
        if (k >= 1) s.twitch = null; else a += (k < 0.3 ? -0.45 * k / 0.3 : k < 0.6 ? -0.45 + 0.6 * (k - 0.3) / 0.3 : 0.15 * (1 - (k - 0.6) / 0.4));
      }
      let m = sw ? about(piv, R_(up, sw)) : I();
      if (a) m = mul(m, about(piv, R_(ax, a)));
      return m;
    };
    // eyes: blink, squint when happy or stroked, shut when asleep, wide when surprised
    let eyeY = s.happy ? 0.55 : 1;
    if (now < s.blinkUntil) { const k = 1 - (s.blinkUntil - now) / 160; eyeY *= 0.12 + 0.88 * Math.abs(1 - 2 * k); }
    if (R) eyeY = Math.min(eyeY, R.eye);
    eyeY = Math.min(eyeY, 1 - 0.62 * s.pet);
    eyeY *= 1 - 0.9 * s.sleepS;
    const wide = R ? R.wide : 1;
    const eyeM = side => {
      const piv = side < 0 ? PIVOTS.eye_l : [-PIVOTS.eye_l[0], PIVOTS.eye_l[1], PIVOTS.eye_l[2]];
      return eyeY === 1 && wide === 1 ? I() : about(piv, S(wide, Math.max(0.04, eyeY) * wide, wide));
    };
    // The nose: now and then a quick triple sniff; squashed by a boop.
    let noseM = I();
    let nk = R ? R.nose : 1;
    if (s.sniffAt && now - s.sniffAt < 480) nk *= 1 + 0.12 * Math.abs(Math.sin(Math.PI * 3 * (now - s.sniffAt) / 480));
    if (nk !== 1) noseM = about(PIVOTS.nose, nk < 1 ? S(1 + (1 - nk) * 0.5, 1 + (1 - nk) * 0.3, nk) : S(nk, nk, nk));
    // The mouth: stretched down from its top edge (MOUTH_DOWN), by how open it is.
    const m = Math.max(0.0001, s.mouth), w = MOUTH_DOWN, mm = I();
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) mm[c * 4 + r] += (m - 1) * w[r] * w[c];
    // PARTS order: head, nose, ear_l, ear_r, eye_l, eye_r, and the mouth
    return { model, parts: [I(), noseM, earM(-1), earM(1), eyeM(-1), eyeM(1), about(MOUTH_TOP, mm)] };
  }

  _schedule(now) {
    const s = this._state;
    if (this._reduced || s.sleep) return;
    if (now > s.nextBlink) {
      s.blinkUntil = now + 160;
      s.nextBlink = now + (Math.random() < 0.25 ? 260 : 3200 + Math.random() * 4200);
    }
    if (!s.nextSniff) s.nextSniff = now + 4000 + Math.random() * 4000;
    if (now > s.nextSniff) { s.sniffAt = now; s.nextSniff = now + 5500 + Math.random() * 4500; }
    if (now > s.nextTwitch) {
      s.twitch = { side: Math.random() < 0.5 ? -1 : 1, at: now };
      s.nextTwitch = now + 6500 + Math.random() * 7000;
    }
  }

  _draw(now) {
    const gl = this.gl, c = this.canvas;
    if (this._lost || gl.isContextLost()) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const { model, parts } = this._pose(now);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const L = this.loc, stride = 11 * 4;
    const attr = (loc, n, off) => { if (loc < 0) return; gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off * 4); };
    const all = () => { attr(L.aPos, 3, 0); attr(L.aNorm, 3, 3); attr(L.aCol, 4, 6); attr(L.aPart, 1, 10); };
    all();
    this._proj = perspective(13 * Math.PI / 180, w / h, 15, 30);
    gl.uniformMatrix4fv(L.uProj, false, new Float32Array(this._proj));
    gl.uniformMatrix4fv(L.uModel, false, new Float32Array(model));
    gl.uniformMatrix4fv(L.uBody, false, new Float32Array(this._body || model));
    gl.uniformMatrix4fv(L.uPart, false, new Float32Array(parts.flat()));
    gl.uniform3fv(L.uKey, KEY); gl.uniform3fv(L.uFill, FILL); gl.uniform3fv(L.uRim, this._rim);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    if (this._hat && this.hatBuf) { gl.bindBuffer(gl.ARRAY_BUFFER, this.hatBuf); all(); gl.drawArrays(gl.TRIANGLES, 0, this.hatCount); }
    if (this._state.mouth > 0.02 && this.mouthBuf) { gl.bindBuffer(gl.ARRAY_BUFFER, this.mouthBuf); all(); gl.drawArrays(gl.TRIANGLES, 0, this.mouthCount); }
  }

  _frame(now) {
    this._raf = 0;
    if (this._paused || document.hidden) return;   // the app resumes it (app.js _syncEffects)
    // At most about 72 frames a second (v3.30.1); its motion goes by the clock.
    if (now - (this._lastDraw || 0) < frameGap('decor')) { this._raf = requestAnimationFrame(this._frame); return; }   // 30 a second on battery (v3.39.0)
    this._lastDraw = now;
    this._schedule(now);
    this._draw(now);
    this._raf = requestAnimationFrame(this._frame);
  }

  /** Draw once at a fixed angle (degrees). For tests and previews. */
  renderAt(yawDeg, pitchDeg = 0) {
    this._yaw = yawDeg * Math.PI / 180; this._pitch = pitchDeg * Math.PI / 180;
    this._draw(performance.now());
  }
  releaseAngle() { this._yaw = undefined; this._pitch = undefined; }

  describe() { return `3D, ${this.triangles} triangles (WebGL)`; }
  wake() { this._state.perkUntil = performance.now() + 700; }
  setExpression(name) {
    this._state.happy = name === 'happy';
    if (name === 'excited') this._state.perkUntil = performance.now() + 700;
  }
  setMusicEnergy(e) { this._state.energy = Math.max(0, Math.min(1, +e || 0)); }
  setTheme(name) {
    this._hat = name === 'snow';     // a Santa hat in the Snow theme
    // the rim follows the theme accent; read it after the theme's CSS applies
    requestAnimationFrame(() => { this._rim = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--accent')); });
  }

  // ── v3.42.0: being played with ─────────────────────────────────────
  /** The head turns towards a point on the screen (a finger, as the mouse does). */
  lookAt(x, y) {
    const r = this.canvas.getBoundingClientRect(); if (!r.width) return;
    const s = this._state;
    s.tx = Math.max(-1, Math.min(1, (x - (r.left + r.width / 2)) / (window.innerWidth / 2)));
    s.ty = Math.max(-1, Math.min(1, (y - (r.top + r.height / 2)) / (window.innerHeight / 2)));
    s.lastMove = performance.now();
  }
  /** A reaction: boop, sneeze, ear, eye, bonk, tickle, laugh, cheek, surprise, yawn, dizzy, happy, listen, nod, hug. side: -1 left, 1 right. */
  react(name, { side = 1, dur = 0 } = {}) {
    const D = { boop: 900, sneeze: 1150, ear: 620, eye: 850, bonk: 950, tickle: 1500, laugh: 1700, cheek: 1000, surprise: 900, yawn: 2300, dizzy: 2100, happy: 950, listen: 1600, nod: 750, hug: 1700 };
    const s = this._state, now = performance.now();
    if (this._reduced) { s.blinkUntil = now + 160; return; }
    s.react = { name, side: side < 0 ? -1 : 1, at: now, dur: dur || D[name] || 900 };
    if (name === 'dizzy') s.spinV += 11 * (side < 0 ? -1 : 1);
    if (name !== 'yawn' && name !== 'listen') s.sleep = false;
    if (this._paused) return;
    if (!this._raf && !this._dead) this._raf = requestAnimationFrame(this._frame);
  }
  /** How open the mouth is for talking, 0 to 1. */
  setMouth(v) { this._state.mouthTalk = Math.max(0, Math.min(1, +v || 0)); }
  /** Being stroked: strength 0 to 1, dir the way the hand moves (-1 left, 1 right). */
  pet(strength = 1, dir = 0) { const s = this._state; s.pet = Math.max(s.pet, Math.min(1, strength)); s.petDir += ((dir < 0 ? -1 : dir > 0 ? 1 : 0) - s.petDir) * 0.2; s.sleep = false; }
  setSleep(on) { this._state.sleep = !!on; }
  get asleep() { return this._state.sleep; }

  /**
   * Which part of the fox is under a point on the screen (CSS pixels):
   * nose, eye (with side), ear (with side), head, cheek (with side), chin,
   * chest, or null when the point is off the fox. Measured on the head as it
   * was last drawn, so it follows the turning head.
   */
  hit(x, y) {
    const c = this.canvas, r = c.getBoundingClientRect();
    if (!r.width || !r.height || !this._model || !this._proj) return null;
    const px = x - r.left, py = y - r.top;
    if (px < 0 || py < 0 || px > r.width || py > r.height) return null;
    const P = this._proj;
    const project = (m, p) => {
      const q = [0, 0, 0, 0];
      for (let row = 0; row < 4; row++) q[row] = m[row] * p[0] + m[4 + row] * p[1] + m[8 + row] * p[2] + m[12 + row];
      const v = [0, 0, 0, 0];
      for (let row = 0; row < 4; row++) v[row] = P[row] * q[0] + P[4 + row] * q[1] + P[8 + row] * q[2] + P[12 + row] * q[3];
      return [(v[0] / v[3] * 0.5 + 0.5) * r.width, (1 - (v[1] / v[3] * 0.5 + 0.5)) * r.height];
    };
    const head = this._model, body = this._body || head;
    const spots = [
      ['nose', 0, [0, -1.24, 1.5], 0.34], ['eye', -1, [-0.56, -0.22, 0.72], 0.30], ['eye', 1, [0.56, -0.22, 0.72], 0.30],
      ['ear', -1, [-0.95, 1.25, 0.1], 0.52], ['ear', 1, [0.95, 1.25, 0.1], 0.52], ['head', 0, [0, 0.45, 0.6], 0.62],
      ['cheek', -1, [-1.02, -0.72, 0.45], 0.45], ['cheek', 1, [1.02, -0.72, 0.45], 0.45], ['chin', 0, [0, -1.66, 1.0], 0.34],
    ];
    let best = null, bestD = 1.25;
    for (const [part, side, p, rad] of spots) {
      const a = project(head, p), b = project(head, [p[0] + rad, p[1], p[2]]);
      const d = Math.hypot(px - a[0], py - a[1]) / Math.max(4, Math.hypot(b[0] - a[0], b[1] - a[1]));
      if (d < bestD) { bestD = d; best = { part, side }; }
    }
    if (best) return best;
    const ch = project(body, [0, -1.95, 0.75]), chw = project(body, [0.9, -1.95, 0.75]);
    if (Math.abs(px - ch[0]) < Math.abs(chw[0] - ch[0]) * 1.2 && Math.abs(py - ch[1]) < Math.abs(chw[0] - ch[0]) * 0.6) return { part: 'chest', side: 0 };
    // Anywhere else on the head's outline counts as the head.
    const top = project(head, [0, 1.8, 0]), bot = project(body, [0, -2.08, 0.9]), lft = project(head, [-1.34, 0.44, 0.1]), rgt = project(head, [1.34, 0.44, 0.1]);
    if (py > top[1] && py < bot[1] && px > lft[0] && px < rgt[0]) return { part: 'head', side: px < (lft[0] + rgt[0]) / 2 ? -1 : 1 };
    return null;
  }

  // Paused, the loop stops, and resume() starts it again (v3.30.0). It used to
  // keep asking for a frame at every refresh and skip the drawing.
  pause() { this._paused = true; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } }
  resume() { this._paused = false; if (!this._raf && !this._dead) this._raf = requestAnimationFrame(this._frame); }
  destroy() {
    this._dead = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    try { this.gl.deleteBuffer(this.buf); this.gl.deleteBuffer(this.hatBuf); this.gl.deleteBuffer(this.mouthBuf); this.gl.deleteProgram(this.prog); } catch {}
  }
}

/** The 3D fox where WebGL works; the flat SVG fox in Lite mode or without WebGL. */
export function createFox(canvas, { lite = false } = {}) {
  if (!lite) {
    try { return new Fox3D(canvas); }
    catch (e) { console.warn('[BM Player] 3D fox unavailable, using the flat one:', e.message); }
  }
  return new GeoFox(canvas, { lite });
}
