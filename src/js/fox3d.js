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
 */

import { TRIANGLES, MATERIALS, MATERIAL_ORDER, PARTS, PIVOTS } from './fox3d-mesh.js';
import { GeoFox } from './geofox.js';

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

const VS = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec4 aCol; attribute float aPart;
uniform mat4 uProj; uniform mat4 uModel; uniform mat4 uPart[6];
uniform mat4 uBody;   // v3.30.1: where the chest stays
varying vec3 vN; varying vec4 vCol;
void main() {
  int p = int(aPart + 0.5);
  mat4 pm = uPart[0];
  if (p == 1) pm = uPart[1]; else if (p == 2) pm = uPart[2]; else if (p == 3) pm = uPart[3];
  else if (p == 4) pm = uPart[4]; else if (p == 5) pm = uPart[5];
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
                    twitch: null, nextTwitch: 0, perkUntil: 0, happy: false, energy: 0, energyS: 0 };
    const now = performance.now();
    this._state.nextBlink = now + 2500 + Math.random() * 3000;
    this._state.nextTwitch = now + 5000 + Math.random() * 6000;
    this._reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this._rim = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    this._onMove = e => {
      const r = canvas.getBoundingClientRect(); if (!r.width) return;
      this._state.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      this._state.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      this._state.lastMove = performance.now();
    };
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
    // The hat: same layout, all on the head (part 0), drawn only in Snow.
    const hat = hatTriangles(), hd = new Float32Array(hat.length * 3 * 11);
    let q = 0;
    for (const t of hat) for (const p of t.p) {
      hd[q++] = p[0]; hd[q++] = p[1]; hd[q++] = p[2]; hd[q++] = t.n[0]; hd[q++] = t.n[1]; hd[q++] = t.n[2];
      hd[q++] = t.col[0]; hd[q++] = t.col[1]; hd[q++] = t.col[2]; hd[q++] = 1; hd[q++] = 0;
    }
    this.hatBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hatBuf);
    gl.bufferData(gl.ARRAY_BUFFER, hd, gl.STATIC_DRAW);
    this.hatCount = hat.length * 3;
    this.loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'), aNorm: gl.getAttribLocation(prog, 'aNorm'),
      aCol: gl.getAttribLocation(prog, 'aCol'), aPart: gl.getAttribLocation(prog, 'aPart'),
      uProj: gl.getUniformLocation(prog, 'uProj'), uModel: gl.getUniformLocation(prog, 'uModel'), uBody: gl.getUniformLocation(prog, 'uBody'),
      uPart: gl.getUniformLocation(prog, 'uPart'), uKey: gl.getUniformLocation(prog, 'uKey'),
      uFill: gl.getUniformLocation(prog, 'uFill'), uRim: gl.getUniformLocation(prog, 'uRim'),
    };
  }

  /** Head pose and part matrices for time `now`. Exposed as renderAt() for tests and previews. */
  _pose(now) {
    const s = this._state, t = (now - s.t0) / 1000, still = this._reduced;
    // look around on its own; follow the pointer while it is moving
    const idleYaw = still ? 0 : 0.20 * Math.sin(t * 0.37) + 0.08 * Math.sin(t * 0.91 + 1.3);
    const idlePitch = still ? 0 : 0.05 * Math.sin(t * 0.53 + 0.4);
    // A curious tilt: the pointer resting near the fox makes it cock its head.
    const rest = now - s.lastMove, near = Math.hypot(s.tx, s.ty) < 0.4;
    const tiltTo = (!still && near && rest > 800 && rest < 6000) ? 0.09 * (s.tx < 0 ? -1 : 1) : 0;
    s.tilt = (s.tilt || 0) + (tiltTo - (s.tilt || 0)) * 0.05;
    const roll = still ? 0 : 0.035 * Math.sin(t * 0.29 + 2.1) + s.tilt;
    const follow = still ? 0 : Math.max(0, 1 - (now - s.lastMove) / 4000);
    s.mx += (s.tx * follow - s.mx) * 0.08; s.my += (s.ty * follow - s.my) * 0.08;
    const yaw = this._yaw ?? (idleYaw * (1 - follow) + s.mx * 0.48);
    const pitch = this._pitch ?? (idlePitch * (1 - follow) + s.my * 0.22);
    s.energyS += (s.energy - s.energyS) * 0.15;
    const perk = now < s.perkUntil ? Math.sin(Math.PI * (1 - (s.perkUntil - now) / 700)) : 0;
    // v3.28.0: the head turns from the neck, and nothing else moves the fox.
    // It used to rise and fall (with music and when excited), grow and shrink
    // (breathing) and swivel about its middle, so the whole fox drifted like a
    // balloon. Now the base of the chest stays put: music and excitement make
    // it nod, and turning, nodding and tilting pivot at the neck. The ears,
    // eyes and nose still move on their own.
    const nod = perk * 0.10 + s.energyS * 0.07;
    // The chest ruff makes the fox taller: lifted and framed a little wider.
    // pitch + nod, not -(pitch + nod) (v3.30.1): with the pointer above the fox
    // (s.my below 0) it looked down. Now it looks up, and a nod dips the chin.
    let model = mul(T(0, 0.12, 0), about(NECK, mul(R([0, 1, 0], yaw), mul(R([1, 0, 0], pitch + nod), R([0, 0, 1], roll)))));
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
      const sw = still ? 0 : 0.10 * Math.sin(t * 0.47 + (side < 0 ? 0 : 1.9)) + 0.05 * Math.sin(t * 1.3 + side) + s.mx * 0.22;
      let a = -perk * 0.18;
      if (s.twitch && s.twitch.side === side) {
        const k = (now - s.twitch.at) / 460;
        if (k >= 1) s.twitch = null; else a += (k < 0.3 ? -0.45 * k / 0.3 : k < 0.6 ? -0.45 + 0.6 * (k - 0.3) / 0.3 : 0.15 * (1 - (k - 0.6) / 0.4));
      }
      let m = sw ? about(piv, R(up, sw)) : I();
      if (a) m = mul(m, about(piv, R(ax, a)));
      return m;
    };
    // eyes: blink, and squint when happy
    let eyeY = s.happy ? 0.55 : 1;
    if (now < s.blinkUntil) { const k = 1 - (s.blinkUntil - now) / 160; eyeY *= 0.12 + 0.88 * Math.abs(1 - 2 * k); }
    const eyeM = side => {
      const piv = side < 0 ? PIVOTS.eye_l : [-PIVOTS.eye_l[0], PIVOTS.eye_l[1], PIVOTS.eye_l[2]];
      return eyeY === 1 ? I() : about(piv, S(1, eyeY, 1));
    };
    // The nose: now and then a quick triple sniff.
    let noseM = I();
    if (s.sniffAt && now - s.sniffAt < 480) {
      const k = 1 + 0.12 * Math.abs(Math.sin(Math.PI * 3 * (now - s.sniffAt) / 480));
      noseM = about(PIVOTS.nose, S(k, k, k));
    }
    // PARTS order: head, nose, ear_l, ear_r, eye_l, eye_r
    return { model, parts: [I(), noseM, earM(-1), earM(1), eyeM(-1), eyeM(1)] };
  }

  _schedule(now) {
    const s = this._state;
    if (this._reduced) return;
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
    attr(L.aPos, 3, 0); attr(L.aNorm, 3, 3); attr(L.aCol, 4, 6); attr(L.aPart, 1, 10);
    gl.uniformMatrix4fv(L.uProj, false, new Float32Array(perspective(13 * Math.PI / 180, w / h, 15, 30)));
    gl.uniformMatrix4fv(L.uModel, false, new Float32Array(model));
    gl.uniformMatrix4fv(L.uBody, false, new Float32Array(this._body || model));
    gl.uniformMatrix4fv(L.uPart, false, new Float32Array(parts.flat()));
    gl.uniform3fv(L.uKey, KEY); gl.uniform3fv(L.uFill, FILL); gl.uniform3fv(L.uRim, this._rim);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    if (this._hat && this.hatBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.hatBuf);
      attr(L.aPos, 3, 0); attr(L.aNorm, 3, 3); attr(L.aCol, 4, 6); attr(L.aPart, 1, 10);
      gl.drawArrays(gl.TRIANGLES, 0, this.hatCount);
    }
  }

  _frame(now) {
    this._raf = 0;
    if (this._paused || document.hidden) return;   // the app resumes it (app.js _syncEffects)
    // At most about 72 frames a second (v3.30.1); its motion goes by the clock.
    if (now - (this._lastDraw || 0) < 12) { this._raf = requestAnimationFrame(this._frame); return; }
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
    try { this.gl.deleteBuffer(this.buf); this.gl.deleteBuffer(this.hatBuf); this.gl.deleteProgram(this.prog); } catch {}
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
