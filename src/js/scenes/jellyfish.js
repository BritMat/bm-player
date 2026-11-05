/**
 * Jellyfish Drift (v3.49.0): deep water seen from the side, a scene for the
 * scene kit (runner.js says what a scene gives), chosen on Home with the
 * scene picker.
 *
 *   - moon jellies and sea nettles pulse their bells (quick in, slow out)
 *     and drift on each pulse, their tentacles and mouth arms trailing
 *     behind, and comb jellies glide, their rows of combs shimmering in colour
 *   - rays of light from the surface, marine snow falling, bubbles rising
 *   - the pointer is a light: rest it and they turn towards it, and a tap sends
 *     a current through the water that pushes them and lights them up
 *   - with music playing, the bells fall in with the beat and the water
 *     brightens on each one
 *
 * Options (runner.run(def, opts), runner.set): look 'natural' | 'glow' (the
 * same jellies in neon colours). The water is drawn once for a size, and
 * again a moment after the window stops changing size. Until then the old
 * one is stretched to fit. How many jellies and specks there are follows
 * the quality tier, and the far jellies are drawn at half size and scaled
 * up, softer, as they would be through water.
 */
import { TAU, rnd, clamp, canvas, TIER } from './kit.js';

export const LOOKS = [['natural', 'Natural'], ['glow', 'Glow']];

const KINDS = {
  moon: { w: [110, 175], hr: 0.36, period: [2.6, 3.6], col: [176, 214, 250], rim: [214, 238, 255], gon: [214, 168, 240], arm: [205, 220, 255], neon: [120, 240, 255], neon2: [255, 120, 230] },
  nettle: { w: [90, 125], hr: 0.6, period: [1.9, 2.6], col: [255, 176, 100], rim: [255, 214, 160], stripe: [200, 70, 40], tent: [255, 120, 86], arm: [255, 236, 214], neon: [255, 150, 70], neon2: [255, 90, 140] },
  comb: { w: [46, 70], hr: 1.45, period: [0, 0], col: [190, 228, 255], rim: [220, 240, 255], neon: [160, 255, 220], neon2: [180, 140, 255] },
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${(a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3)})`;
// how far the bell is squeezed: quick in, slow out
const squeeze = u => u < 0.28 ? Math.sin(u / 0.28 * Math.PI / 2) : 0.5 + 0.5 * Math.cos((u - 0.28) / 0.72 * Math.PI);

// A tentacle: points that follow the first, each a fixed length from the one before.
class Chain {
  constructor (n, seg, x, y, grav = 40) { this.n = n; this.seg = seg; this.grav = grav; this.p = []; for (let i = 0; i < n; i++) this.p.push([x, y + i * seg, x, y + i * seg]); }
  step (ax, ay, dt, drag, cur, S) {
    const p = this.p, n = this.n, seg = this.seg;
    p[0][2] = p[0][0]; p[0][3] = p[0][1]; p[0][0] = ax; p[0][1] = ay;
    for (let i = 1; i < n; i++) {
      const q = p[i], vx = (q[0] - q[2]) * drag, vy = (q[1] - q[3]) * drag;
      q[2] = q[0]; q[3] = q[1];
      q[0] += vx + cur[0] * dt * dt; q[1] += vy + (this.grav * S + cur[1]) * dt * dt;
    }
    for (let it = 0; it < 2; it++) for (let i = 1; i < n; i++) {
      const a = p[i - 1], b = p[i], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, k = seg / d;
      b[0] = a[0] + dx * k; b[1] = a[1] + dy * k;
    }
  }
  // moved with the view when its size changes
  scale (sx, sy) { for (const q of this.p) { q[0] *= sx; q[2] *= sx; q[1] *= sy; q[3] *= sy; } }
}

// the bell, as a path round its outline: apex up, mouth at (0,0)
function bellPath (g, r, h, rm, lip) {
  g.beginPath();
  g.moveTo(-rm, 0);
  g.bezierCurveTo(-rm - (r - rm) * 0.6, -h * 0.04, -r, -h * 0.14, -r, -h * 0.34);
  g.bezierCurveTo(-r, -h * 0.74, -r * 0.56, -h, 0, -h);
  g.bezierCurveTo(r * 0.56, -h, r, -h * 0.74, r, -h * 0.34);
  g.bezierCurveTo(r, -h * 0.14, rm + (r - rm) * 0.6, -h * 0.04, rm, 0);
  g.quadraticCurveTo(0, lip, -rm, 0);
  g.closePath();
}
// the half-width of the dome at height y (0 the mouth, -h the apex)
function domeX (r, h, rm, y) { const s = clamp(-y / h, 0, 1); return s < 0.34 ? rm + (r - rm) * Math.sin(s / 0.34 * Math.PI / 2) : r * Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.34) / 0.66, 2))); }

export default {
  id: 'jellyfish',
  name: 'Jellyfish Drift',
  // Soft water and slow drifting: one and a half pixels to a CSS pixel at
  // most, and 40 frames a second.
  maxDpr: 1.5,
  fps: 40,
  start (host) {
    const { ctx } = host;
    const q = TIER[host.tier] || 1, low = q < 0.75;
    const opts = { look: 'natural', ...(host.opts || {}) };
    const speed = host.reduced ? 0.5 : 1;
    let W = host.w, H = host.h, DPR = host.dpr, S = 1, BW = 0, BH = 0, rebuildT = 0;
    let bg = null, vign = null, farCv = null, farG = null, dot = null;
    let rays = [], snow = [], bubbles = [], jellies = [], currents = [];
    const pointer = { x: 0, y: 0, in: false, still: 0, speed: 0, lt: 0, outT: 0 };
    const beat = { level: 0, armed: true, pulse: 0, hit: false, lastHit: -1 };
    let light = 0, clock = 0;

    // ── the water, made once per size ──────────────────────────────
    function buildLayers () {
      BW = W; BH = H;
      bg = canvas(W * DPR, H * DPR); let g = bg.getContext('2d'); g.scale(DPR, DPR);
      let gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#0b4a6a'); gr.addColorStop(0.18, '#06324e'); gr.addColorStop(0.5, '#031a2e'); gr.addColorStop(0.85, '#020b16'); gr.addColorStop(1, '#01050b');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // the surface far above: a brighter patch of light
      const sx = W * 0.42, sr = Math.max(W, H) * 0.7, sg = g.createRadialGradient(sx, -H * 0.1, 0, sx, -H * 0.1, sr);
      sg.addColorStop(0, 'rgba(120,210,240,0.35)'); sg.addColorStop(0.35, 'rgba(60,150,190,0.12)'); sg.addColorStop(1, 'rgba(30,90,130,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
      vign = canvas(W * DPR * 0.25, H * DPR * 0.25); g = vign.getContext('2d');
      const vg = g.createRadialGradient(vign.width / 2, vign.height * 0.45, Math.min(vign.width, vign.height) * 0.3, vign.width / 2, vign.height / 2, Math.hypot(vign.width, vign.height) * 0.6);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,3,8,0.8)'); g.fillStyle = vg; g.fillRect(0, 0, vign.width, vign.height);
      const fr = low ? 0.4 : 0.5;
      farCv = canvas(W * DPR * fr, H * DPR * fr); farG = farCv.getContext('2d');
      const n = 48; dot = canvas(n, n); g = dot.getContext('2d'); gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }

    function makeRays () {
      rays = [];
      for (let i = 0; i < (low ? 6 : 9); i++) rays.push({ x: rnd(-0.1, 1.0), w: rnd(0.02, 0.07), lean: rnd(0.05, 0.22), len: rnd(0.55, 1.0), f: rnd(0.08, 0.25), ph: rnd(0, TAU), a: rnd(0.04, 0.09) });
    }
    function makeSnow () {
      snow = [];
      const n = Math.round(clamp(W * H / 4500, 120, 420) * Math.min(1, q));
      for (let i = 0; i < n; i++) snow.push({ x: rnd(0, W), y: rnd(0, H), z: rnd(0.3, 1.6), ph: rnd(0, TAU), vy: rnd(4, 12) });
    }

    // ── the jellies ────────────────────────────────────────────────
    function makeJelly (kind, z) {
      const k = KINDS[kind], j = { k, kind, z };
      j.w0 = rnd(k.w[0], k.w[1]) * S * (0.45 + 0.55 * z);
      j.x = rnd(0.08, 0.92) * W; j.y = rnd(0.2, 0.92) * H; j.vx = rnd(-6, 6) * S; j.vy = rnd(-8, 4) * S;
      j.tilt = rnd(-0.35, 0.35);
      j.period = rnd(k.period[0], k.period[1]) || 1; j.ph = rnd(0, 1); j.c = 0; j.glow = 0; j.seed = rnd(0, 100);
      j.spin = rnd(0, TAU); j.lit = 0; j.rm = 0;
      j.tents = []; j.arms = [];
      const w0 = j.w0, nt = low ? 10 : 18, np = low ? 12 : 16;
      if (kind === 'nettle') {
        for (let i = 0; i < nt; i++) j.tents.push({ a: (i / (nt - 1)) * 2 - 1, ch: new Chain(np, w0 * rnd(2.0, 3.4) / (np - 1), j.x, j.y, 140) });
        for (let i = 0; i < 4; i++) j.arms.push({ a: (i / 3 - 0.5) * 0.5, ch: new Chain(np, w0 * rnd(1.7, 2.4) / (np - 1), j.x, j.y, 90), w: rnd(0.13, 0.17) * w0, spiral: true });
      } else if (kind === 'moon') {
        for (let i = 0; i < 4; i++) j.arms.push({ a: (i / 3 - 0.5) * 0.5, ch: new Chain(9, w0 * rnd(0.45, 0.62) / 8, j.x, j.y, 60), w: rnd(0.07, 0.09) * w0 });
      }
      return j;
    }
    function makeJellies () {
      jellies = [];
      const area = W * H / (900 * 900), n = Math.round(clamp(6 * area * Math.min(1.2, q), low ? 3 : 5, low ? 6 : 9));
      for (let i = 0; i < n; i++) jellies.push(makeJelly(i % 4 === 1 ? 'nettle' : 'moon', rnd(0.35, 1.25)));
      for (let i = 0; i < Math.max(low ? 1 : 2, Math.round(n / 3)); i++) jellies.push(makeJelly('comb', rnd(0.5, 1.2)));
      jellies.sort((a, b) => a.z - b.z);
    }

    function update (j, dt, t) {
      const prevC = j.c;
      if (j.kind !== 'comb') {
        j.ph += dt / j.period;
        if (beat.hit) j.ph += (Math.round(j.ph) - j.ph) * 0.6;        // fall in with the beat
        j.c = squeeze(((j.ph % 1) + 1) % 1);
        const thrust = Math.max(0, j.c - prevC) / Math.max(dt, 0.001), push = thrust * 26 * S * (0.6 + 0.4 * j.z);
        j.vx += Math.sin(j.tilt) * push * dt; j.vy -= Math.cos(j.tilt) * push * dt;
        j.vy += 7 * S * dt;                                           // a slow sink between beats of the bell
      } else {
        j.spin += dt * 0.25;
        j.vx += Math.sin(t * 0.2 + j.seed) * 3 * S * dt; j.vy += Math.cos(t * 0.17 + j.seed) * 3 * S * dt;
      }
      // where it heads: a slow wander, back from the edges, to the light
      let want = Math.sin(t * 0.13 + j.seed) * 0.35 + Math.sin(t * 0.31 + j.seed * 2) * 0.15;
      const m = j.w0;
      if (j.x < m) want = 0.6; else if (j.x > W - m) want = -0.6;
      if (j.y < H * 0.12) { want *= 0.3; j.vy += 10 * S * dt; }
      if (j.y > H * 0.9) want *= 0.3;
      if (pointer.in && pointer.still > 0.6) {
        const dx = pointer.x - j.x, dy = pointer.y - j.y, d = Math.hypot(dx, dy);
        if (d < Math.max(W, H) * 0.55) { want = clamp(Math.atan2(dx, -dy), -0.9, 0.9); j.vx += dx / (d + 1) * 6 * S * dt; j.vy += dy / (d + 1) * 6 * S * dt; }
      }
      j.tilt += (clamp(want, -0.8, 0.8) - j.tilt) * Math.min(1, dt * 0.5);
      // the currents from taps
      for (const c of currents) {
        const dx = j.x - c.x, dy = j.y - c.y, d = Math.hypot(dx, dy), r = c.r;
        if (d < r + j.w0 && d > r - 120 * S) {
          const f = c.s * (1 - Math.abs(d - r) / (120 * S)) * 220 * S;
          j.vx += dx / (d + 1) * f * dt; j.vy += dy / (d + 1) * f * dt;
          if (!c.hit.has(j)) { c.hit.add(j); j.glow = 1; }
        }
      }
      if (pointer.in && pointer.speed > 400 * S) {
        const px = j.x - pointer.x, py = j.y - pointer.y, pd = Math.hypot(px, py);
        if (pd < j.w0 * 1.6) { j.vx += px / (pd + 1) * 60 * S * dt; j.vy += py / (pd + 1) * 60 * S * dt; j.glow = Math.max(j.glow, 0.5); }
      }
      // room for each other: they drift apart rather than pile up
      for (const o of jellies) {
        if (o === j || Math.abs(o.z - j.z) > 0.35) continue;
        const ox = j.x - o.x, oy = j.y - o.y, od = Math.hypot(ox, oy), need = (j.w0 + o.w0) * 0.6;
        if (od < need && od > 0) { const f = (1 - od / need) * 40 * S; j.vx += ox / od * f * dt; j.vy += oy / od * f * dt; }
      }
      const drag = Math.pow(0.35, dt); j.vx *= drag; j.vy *= drag;
      j.x += j.vx * dt; j.y += j.vy * dt;
      j.x = clamp(j.x, -j.w0, W + j.w0); j.y = clamp(j.y, -j.w0 * 2, H + j.w0);
      j.glow = Math.max(0, j.glow - dt * 0.6);
      // tentacles trail behind
      const cur = [-j.vx * 0.6, -j.vy * 0.6], cs = Math.cos(j.tilt), sn = Math.sin(j.tilt), r = j.rm || j.w0 * 0.5;
      for (const tn of j.tents) { const lx = tn.a * r * 0.95; tn.ch.step(j.x + lx * cs, j.y + lx * sn, dt, 0.9, cur, S); }
      for (const am of j.arms) { const lx = am.a * r * 0.5, ly = -j.w0 * 0.05; am.ch.step(j.x + lx * cs - ly * sn, j.y + lx * sn + ly * cs, dt, 0.88, cur, S); }
      // the pointer's light on it
      let lit = 0;
      if (pointer.in) { const ld = Math.hypot(pointer.x - j.x, pointer.y - j.y); lit = Math.max(0, 1 - ld / (330 * S)); lit *= lit; }
      j.lit += (lit - j.lit) * Math.min(1, dt * 3);
    }

    function colours (k) {
      const g = opts.look === 'glow';
      return { body: g ? k.neon : k.col, rim: g ? k.neon : k.rim, inner: g ? k.neon2 : (k.gon || k.stripe || k.col), tent: g ? k.neon2 : (k.tent || k.rim), arm: g ? k.neon : (k.arm || k.rim) };
    }

    function draw (j, g, t, sc) {
      const k = j.k, C = colours(k), bright = (0.55 + 0.45 * j.z) * (1 + j.lit * 0.75 + j.glow + beat.pulse * 0.45 + beat.level * 0.25) * (opts.look === 'glow' ? 1.25 : 1);
      const w0 = j.w0;
      g.save(); g.scale(sc, sc);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
      if (j.kind === 'comb') { drawComb(j, g, t, C, bright); g.restore(); return; }
      const c = j.c, r = w0 * 0.5 * (1 - 0.2 * c), h = w0 * k.hr * (1 + 0.22 * c), rm = r * (1 - 0.16 * c), lip = r * 0.16;
      j.rm = rm;
      // long tentacles, then the mouth arms, behind the bell
      g.strokeStyle = rgba(C.tent, 0.32 * bright); g.lineWidth = Math.max(0.6, w0 * 0.012);
      for (const tn of j.tents) {
        const p = tn.ch.p;
        g.beginPath(); g.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length - 1; i++) g.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
        g.stroke();
      }
      j.arms.forEach((am, ix) => {
        const p = am.ch.p, n = p.length, L = [], R = [];
        for (let i = 0; i < n; i++) {
          const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
          const ww = am.w * (1 - i / n * 0.6) * (am.spiral ? Math.abs(Math.sin(i * 0.55 + t * 0.9 + ix * 1.7)) * 0.85 + 0.15 : 1 + 0.35 * Math.sin(i * 1.9 + t * 1.3 + ix));
          const off = am.spiral ? Math.sin(i * 0.55 + t * 0.9 + ix * 1.7 + 1.57) * am.w * 0.6 : 0;
          const cx = p[i][0] - dy / d * off, cy = p[i][1] + dx / d * off;
          L.push([cx - dy / d * ww, cy + dx / d * ww]); R.push([cx + dy / d * ww, cy - dx / d * ww]);
        }
        g.fillStyle = rgba(C.arm, (am.spiral ? 0.12 : 0.07) * bright); g.strokeStyle = rgba(C.arm, (am.spiral ? 0.3 : 0.22) * bright); g.lineWidth = Math.max(0.6, w0 * 0.008);
        g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]); for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); g.fill();
        // the frilled edges
        for (const E of [L, R]) { g.beginPath(); g.moveTo(E[0][0], E[0][1]); for (let i = 1; i < n; i++) g.lineTo(E[i][0] + Math.sin(i * 3.1 + t * 2 + ix) * w0 * 0.012, E[i][1]); g.stroke(); }
      });
      // the bell
      g.save(); g.translate(j.x, j.y); g.rotate(j.tilt);
      bellPath(g, r, h, rm, lip);
      const fg = g.createLinearGradient(0, -h, 0, lip);
      fg.addColorStop(0, rgba(C.body, 0.16 * bright)); fg.addColorStop(0.55, rgba(C.body, 0.07 * bright)); fg.addColorStop(1, rgba(C.body, 0.12 * bright));
      g.fillStyle = fg; g.fill();
      g.save(); bellPath(g, r, h, rm, lip); g.clip();
      // light inside the bell, brightest near its edge
      const ig = g.createRadialGradient(0, -h * 0.45, r * 0.15, 0, -h * 0.4, r * 1.05);
      ig.addColorStop(0, rgba(C.body, 0)); ig.addColorStop(0.75, rgba(C.body, 0.05 * bright)); ig.addColorStop(1, rgba(C.rim, 0.28 * bright));
      g.fillStyle = ig; g.fillRect(-r * 1.2, -h * 1.1, r * 2.4, h * 1.3);
      // canals or stripes running down the dome
      const lines = j.kind === 'nettle' ? (low ? 9 : 14) : (low ? 10 : 16);
      for (let i = 0; i < lines; i++) {
        const lon = (i + 0.5) / lines * Math.PI - Math.PI / 2, sl = Math.sin(lon), front = Math.cos(lon);
        g.strokeStyle = j.kind === 'nettle' ? rgba(C.inner, (0.16 + 0.12 * front) * bright) : rgba(C.rim, (0.05 + 0.05 * front) * bright);
        g.lineWidth = j.kind === 'nettle' ? w0 * (0.03 + 0.03 * front) : Math.max(0.6, w0 * 0.006);
        g.beginPath();
        for (let s = 0; s <= 12; s++) { const y = -h + h * s / 12, x = domeX(r, h, rm, y) * sl; if (s) g.lineTo(x, y + front * lip * (s / 12) * 0.6); else g.moveTo(x, y); }
        g.stroke();
      }
      if (j.kind === 'moon') {
        // the four rings seen through the bell, each a horseshoe at a slant
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU + Math.PI / 4 + Math.sin(t * 0.05 + j.seed) * 0.2, gx = Math.cos(a) * r * 0.3, gz = Math.sin(a), gy = -h * 0.55 + gz * h * 0.07;
          for (let pass = 0; pass < 2; pass++) {
            g.strokeStyle = rgba(C.inner, (pass ? 0.16 : 0.06) * (0.7 + 0.3 * gz) * bright); g.lineWidth = w0 * (pass ? 0.022 : 0.06);
            g.beginPath(); g.ellipse(gx, gy, r * 0.17, h * 0.09, 0, a + 0.9, a + 0.9 + TAU * 0.72); g.stroke();
          }
        }
      }
      g.restore();
      // the rim of the bell glows
      bellPath(g, r, h, rm, lip);
      g.strokeStyle = rgba(C.rim, 0.10 * bright); g.lineWidth = w0 * 0.07; g.stroke();
      g.strokeStyle = rgba(C.rim, 0.22 * bright); g.lineWidth = w0 * 0.03; g.stroke();
      g.strokeStyle = rgba(C.rim, 0.5 * bright); g.lineWidth = Math.max(0.8, w0 * 0.009); g.stroke();
      // the mouth of the bell, a ring seen a little from the side
      g.strokeStyle = rgba(C.rim, 0.35 * bright); g.lineWidth = Math.max(0.8, w0 * 0.012);
      g.beginPath(); g.ellipse(0, lip * 0.35, rm, lip * 0.8, 0, 0, TAU); g.stroke();
      // a sheen on the top
      const hl = g.createRadialGradient(-r * 0.35, -h * 0.78, 0, -r * 0.35, -h * 0.78, r * 0.6);
      hl.addColorStop(0, rgba([255, 255, 255], 0.16 * bright)); hl.addColorStop(1, rgba([255, 255, 255], 0));
      g.fillStyle = hl; g.fillRect(-r, -h * 1.05, r * 1.4, h * 0.8);
      if (j.kind === 'moon') {
        // short fringe round the mouth
        g.strokeStyle = rgba(C.rim, 0.2 * bright); g.lineWidth = Math.max(0.5, w0 * 0.004);
        const sway = clamp(-j.vx * 0.04, -1, 1), n = low ? 28 : 46;
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const aa = i / n * TAU, mx = Math.cos(aa) * rm, my = lip * 0.35 + Math.sin(aa) * lip * 0.8, len = w0 * (0.1 + 0.06 * Math.sin(i * 7.3)) * (1 + c * 0.3);
          g.moveTo(mx, my); g.quadraticCurveTo(mx + sway * len * 0.4, my + len * 0.6, mx + sway * len + Math.sin(t * 1.5 + i) * len * 0.15, my + len);
        }
        g.stroke();
      } else {
        // scalloped lappets round the mouth
        g.fillStyle = rgba(C.rim, 0.12 * bright);
        for (let i = 0; i < 16; i++) { const la = (i + 0.5) / 16 * Math.PI, lx = -Math.cos(la) * rm, ly = Math.sin(la) * lip * 0.8 + lip * 0.35; g.beginPath(); g.ellipse(lx, ly, rm * 0.09, lip * 0.5, 0, 0, TAU); g.fill(); }
      }
      g.restore();
      g.restore();
    }
    // a comb jelly: a clear egg with rows of beating combs that split light into colour
    function drawComb (j, g, t, C, bright) {
      const w0 = j.w0, rx = w0 * 0.5, ry = w0 * 0.72;
      g.save(); g.translate(j.x, j.y); g.rotate(j.tilt * 0.6 + Math.sin(t * 0.3 + j.seed) * 0.2);
      const bgd = g.createRadialGradient(0, -ry * 0.1, rx * 0.2, 0, 0, ry);
      bgd.addColorStop(0, rgba(C.body, 0.02 * bright)); bgd.addColorStop(0.8, rgba(C.body, 0.06 * bright)); bgd.addColorStop(1, rgba(C.rim, 0.2 * bright));
      g.fillStyle = bgd; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba(C.rim, 0.3 * bright); g.lineWidth = Math.max(0.7, w0 * 0.015); g.stroke();
      // the gut, a faint line down the middle
      g.strokeStyle = rgba(C.rim, 0.12 * bright); g.lineWidth = Math.max(0.6, w0 * 0.03);
      g.beginPath(); g.moveTo(0, -ry * 0.55); g.quadraticCurveTo(rx * 0.08, 0, 0, ry * 0.7); g.stroke();
      // eight comb rows; those on the front are seen
      const dots = low ? 12 : 18;
      for (let i = 0; i < 8; i++) {
        const lon = j.spin + i / 8 * TAU, front = Math.cos(lon); if (front < -0.15) continue;
        const sl = Math.sin(lon);
        for (let s = 1; s < dots; s++) {
          const u = s / dots, y = -ry + 2 * ry * u * 0.92, x = sl * rx * Math.sqrt(Math.max(0, 1 - Math.pow(y / ry, 2)));
          const hue = (t * 160 - s * 22 + i * 40) % 360, a = (0.35 + 0.5 * front) * (0.5 + 0.5 * Math.sin(t * 9 - s * 0.9 + i)) * bright;
          g.fillStyle = `hsla(${hue.toFixed(0)},100%,66%,${clamp(a, 0, 1).toFixed(3)})`;
          g.beginPath(); g.ellipse(x, y, w0 * 0.028, w0 * 0.012, 0, 0, TAU); g.fill();
        }
      }
      g.restore();
    }

    function frame (dt, now) {
      dt *= speed; clock += dt;
      const t = clock, g = ctx;
      pointer.still = pointer.speed < 220 * S ? Math.min(3, pointer.still + dt) : 0;
      pointer.speed *= Math.pow(0.002, dt);
      // the music: a beat is the level rising past a mark after falling below another
      beat.hit = false;
      if (beat.armed && beat.level > 0.55 && clock - beat.lastHit > 0.25) { beat.hit = true; beat.armed = false; beat.lastHit = clock; beat.pulse = 1; }
      else if (beat.level < 0.35) beat.armed = true;
      beat.pulse = Math.max(0, beat.pulse - dt * 2);
      light += ((pointer.in ? 1 : 0) - light) * Math.min(1, dt * 3);
      for (const j of jellies) update(j, dt, t);
      currents = currents.filter(c => { c.r += dt * 260 * S; c.s *= Math.pow(0.4, dt); return c.r < c.max; });
      for (const p of snow) {
        p.y += p.vy * S * p.z * dt; p.x += Math.sin(t * 0.4 + p.ph) * 4 * S * dt;
        for (const c of currents) { const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy); if (Math.abs(d - c.r) < 60 * S) { p.x += dx / (d + 1) * c.s * 90 * S * dt; p.y += dy / (d + 1) * c.s * 90 * S * dt; } }
        if (p.y > H + 10) { p.y = -10; p.x = rnd(0, W); }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      }
      if (Math.random() < dt * 0.35) { const bx = rnd(W * 0.05, W * 0.95); for (let b = 0; b < 6; b++) bubbles.push({ x: bx + rnd(-6, 6) * S, y: H + b * 14 * S, r: rnd(2, 5) * S, ph: rnd(0, TAU), v: rnd(50, 80) * S }); }
      bubbles = bubbles.filter(p => { p.y -= p.v * dt; p.x += Math.sin(t * 3 + p.ph) * 12 * S * dt; return p.y > -20; });

      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // the water as drawn for its size (stretched while the window is changing size)
      g.drawImage(bg, 0, 0, W * DPR, H * DPR);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      // rays of light swaying down from the surface
      g.globalCompositeOperation = 'lighter';
      for (const r of rays) {
        const x = (r.x + Math.sin(t * r.f + r.ph) * 0.03) * W, w0 = r.w * W * 0.4, w1 = r.w * W * 2.2, len = r.len * H, lean = r.lean * W;
        const a = r.a * (0.55 + 0.45 * Math.sin(t * r.f * 1.7 + r.ph * 2)) * (1 + beat.pulse * 0.4);
        const gr = g.createLinearGradient(x, 0, x + lean, len); gr.addColorStop(0, `rgba(150,225,250,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(150,225,250,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - w0, 0); g.lineTo(x + w0, 0); g.lineTo(x + lean + w1, len); g.lineTo(x + lean - w1, len); g.closePath(); g.fill();
      }
      // marine snow
      for (const p of snow) {
        let lit = 0; if (light > 0.01) { const d = Math.hypot(p.x - pointer.x, p.y - pointer.y); lit = Math.max(0, 1 - d / (260 * S)) * light; }
        const r = (0.6 + p.z * 1.4) * S * (1 + lit * 0.6), a = (0.12 + 0.18 * p.z) * (1 + lit * 3);
        g.globalAlpha = clamp(a, 0, 1); g.drawImage(dot, p.x - r * 2, p.y - r * 2, r * 4, r * 4);
      }
      g.globalAlpha = 1;
      // far jellies, softer, drawn small and scaled up
      farG.setTransform(1, 0, 0, 1, 0, 0); farG.clearRect(0, 0, farCv.width, farCv.height);
      farG.setTransform(farCv.width / W, 0, 0, farCv.height / H, 0, 0);
      for (const j of jellies) if (j.z < 0.75) draw(j, farG, t, 1);
      g.globalCompositeOperation = 'lighter'; g.drawImage(farCv, 0, 0, W, H);
      for (const j of jellies) if (j.z >= 0.75) draw(j, g, t, 1);
      // the pointer's light
      if (light > 0.01) {
        const R = 300 * S, lg = g.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, R);
        lg.addColorStop(0, `rgba(255,246,220,${(0.16 * light).toFixed(3)})`); lg.addColorStop(0.3, `rgba(200,236,255,${(0.06 * light).toFixed(3)})`); lg.addColorStop(1, 'rgba(160,220,255,0)');
        g.fillStyle = lg; g.fillRect(pointer.x - R, pointer.y - R, R * 2, R * 2);
      }
      // currents from taps, seen as a faint ring of disturbed water
      for (const c of currents) {
        g.strokeStyle = `rgba(170,230,255,${(c.s * 0.05).toFixed(3)})`; g.lineWidth = 34 * S; g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(190,240,255,${(c.s * 0.05).toFixed(3)})`; g.lineWidth = 8 * S; g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      for (const p of bubbles) {
        g.strokeStyle = 'rgba(200,240,255,0.35)'; g.lineWidth = Math.max(0.7, p.r * 0.25); g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.28, 0, TAU); g.fill();
      }
      g.drawImage(vign, 0, 0, W, H);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    // first start: everything for this size
    S = clamp(Math.min(W, H) / 900, 0.55, 1.6);
    buildLayers(); makeRays(); makeSnow(); makeJellies();

    return {
      frame,
      resize (w, h, dpr) {
        const sx = w / Math.max(1, W), sy = h / Math.max(1, H);
        for (const j of jellies) { j.x *= sx; j.y *= sy; for (const tn of j.tents) tn.ch.scale(sx, sy); for (const am of j.arms) am.ch.scale(sx, sy); }
        for (const p of snow) { p.x *= sx; p.y *= sy; }
        for (const p of bubbles) { p.x *= sx; p.y *= sy; }
        W = w; H = h; DPR = dpr; S = clamp(Math.min(W, H) / 900, 0.55, 1.6);
        // the water drawn again once the size settles; stretched until then
        clearTimeout(rebuildT); rebuildT = setTimeout(buildLayers, 220);
      },
      pointer (kind, x, y) {
        if (kind === 'leave') { pointer.in = false; return; }
        const now = performance.now(), dtp = Math.max(1, now - (pointer.lt || now - 16)) / 1000;
        pointer.speed = pointer.in && kind === 'move' ? Math.hypot(x - pointer.x, y - pointer.y) / dtp : 0;
        pointer.x = x; pointer.y = y; pointer.in = true; pointer.lt = now;
        // a finger lifted: its light fades a moment later (a mouse that stays keeps moving it)
        clearTimeout(pointer.outT);
        if (kind === 'up') pointer.outT = setTimeout(() => { pointer.in = false; }, 1500);
        if (kind === 'down') currents.push({ x, y, r: 10, s: 1, max: Math.max(W, H) * 0.6, hit: new Set() });
      },
      beat (level) { beat.level = level; },
      set (key, value) { if (key === 'look' && LOOKS.some(l => l[0] === value)) opts.look = value; },
      stop () { clearTimeout(rebuildT); clearTimeout(pointer.outT); bg = vign = farCv = farG = dot = null; jellies = []; snow = []; },
    };
  },
};
