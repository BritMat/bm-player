/**
 * Koi Pond (v3.59.0, the plan's 3.58): a pond at night seen from above, a
 * scene for the scene kit (runner.js says what a scene gives), chosen on
 * Home with the scene picker.
 *
 *   - koi of seven kinds (kohaku, yamabuki, showa, platinum, sanke, tancho,
 *     chagoi) swim with a swimmer's wave down the body, two of them deeper,
 *     under a veil of water; light shimmers on the floor of the pond
 *   - lily pads turn slowly, two with flowers; petals fall now and then
 *     and drift; a tree's branches are reflected from the corner
 *   - hold the pointer still and the nearest come to look; a quick sweep
 *     over one frightens it
 *   - a tap makes a ripple that scares them off, or drops food they race
 *     for (opts.tap)
 *   - with music, they swim round in a ring in time with it, and each beat
 *     sends a ring across the water (opts.dance)
 *
 * Options (runner.run(def, opts), runner.set): tap 'touch' | 'feed',
 * petals true | false, dance true | false. The water, the floor and the
 * reflections are drawn once for a size, and again a moment after the
 * window stops changing size. The fish and the shimmer follow the quality
 * tier. Ported from the demo shown with the roadmap.
 */
import { TAU, rnd, clamp, canvas, seeded, TIER, scaleFor } from './kit.js';

export const TAPS = [['touch', 'Touch the water'], ['feed', 'Feed']];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// Light on the floor of a pond: the edges of a tiled Worley pattern, where
// the two nearest cells are nearly the same distance away. Two of them
// drifting apart make the shimmer.
function caustics (n, cells, seed) {
  const c = canvas(n, n), g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data, rand = seeded(seed);
  const pts = []; for (let i = 0; i < cells; i++) pts.push([rand() * n, rand() * n]);
  const ph = rand() * TAU, ph2 = rand() * TAU;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let f1 = 1e9, f2 = 1e9;
    // bent, so the cells are not straight-sided (the bends repeat with the tile)
    const wx = x + Math.sin(y / n * TAU * 2 + ph) * n * 0.05 + Math.sin(y / n * TAU * 5 + ph2) * n * 0.015;
    const wy = y + Math.sin(x / n * TAU * 2 + ph2) * n * 0.05 + Math.sin(x / n * TAU * 4 + ph) * n * 0.015;
    for (let k = 0; k < pts.length; k++) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const dx = pts[k][0] + ox * n - wx, dy = pts[k][1] + oy * n - wy, dd = dx * dx + dy * dy;
      if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
    }
    const e = Math.sqrt(f2) - Math.sqrt(f1), v = Math.pow(clamp(1 - e / (n * 0.03), 0, 1), 4);
    const o = (y * n + x) * 4; d[o] = 170; d[o + 1] = 235; d[o + 2] = 255; d[o + 3] = v * 255;
  }
  g.putImageData(img, 0, 0); return c;
}

const KINDS = {
  kohaku: { base: '#f6f1ec', fin: 'rgba(250,246,240,0.55)', spots: [['#e5381f', 0.08, 0, 0.14, 0.75], ['#e23a20', 0.38, 0.1, 0.17, 0.95], ['#e3401f', 0.66, -0.15, 0.11, 0.8]] },
  yamabuki: { base: '#f0ad0e', fin: 'rgba(248,196,60,0.55)', sheen: '#ffe25a', spots: [] },
  showa: { base: '#1c1a1f', fin: 'rgba(240,238,236,0.5)', spots: [['#e23c22', 0.12, 0.1, 0.15, 0.9], ['#f4f0ea', 0.42, -0.35, 0.16, 0.7], ['#e44a24', 0.56, 0.3, 0.12, 0.7], ['#f4f0ea', 0.78, 0.1, 0.1, 0.6]] },
  platinum: { base: '#e7ebee', fin: 'rgba(236,242,246,0.5)', sheen: '#ffffff', spots: [], butterfly: true },
  sanke: { base: '#f5f1eb', fin: 'rgba(250,246,240,0.55)', spots: [['#e4391f', 0.18, -0.1, 0.13, 0.8], ['#e33d21', 0.5, 0.2, 0.15, 0.85], ['#19181d', 0.36, -0.55, 0.05, 0.35], ['#19181d', 0.62, -0.4, 0.045, 0.3], ['#19181d', 0.7, 0.5, 0.04, 0.3]] },
  tancho: { base: '#f7f4f0', fin: 'rgba(250,247,243,0.55)', spots: [['#e1361d', 0.07, 0, 0.065, 0.62]], butterfly: true },
  chagoi: { base: '#9b6a3b', fin: 'rgba(176,128,82,0.55)', sheen: '#d9a46a', spots: [], scales: true },
};
const NSEG = 22;

// a fin as a fan of soft rays from a root, along an angle
function fin (g, x, y, a, len, spread, col, rays) {
  g.save(); g.translate(x, y); g.rotate(a);
  const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0.04)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.55, -spread * len, len, -spread * len * 0.35);
  g.quadraticCurveTo(len * 1.05, 0, len, spread * len * 0.35);
  g.quadraticCurveTo(len * 0.55, spread * len, 0, 0); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 0.8;
  for (let i = -rays; i <= rays; i++) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, i / rays * spread * len * 0.7, len * 0.96, i / rays * spread * len * 0.32); g.stroke(); }
  g.restore();
}

export default {
  id: 'koi',
  name: 'Koi Pond',
  maxDpr: 1.5,
  fps: 50,
  start (host) {
    const { ctx } = host;
    const q = TIER[host.tier] || 1, low = q < 0.75;
    const opts = { tap: 'touch', petals: true, dance: true, ...(host.opts || {}) };
    const speedK = host.reduced ? 0.6 : 1;
    let W = host.w, H = host.h, DPR = host.dpr, S = scaleFor(W, H), rebuildT = 0, clock = 0;
    let bgLayer = null, branchLayer = null, vignette = null, caustA = null, caustB = null, patA = null, patB = null;
    let fish = [], pads = [], petals = [], ripples = [], pellets = [], petalT = 0;
    const pointer = { x: 0, y: 0, in: false, still: 0, speed: 0, lt: 0 };
    const beat = { level: 0, armed: true, pulse: 0, lastHit: -9, on: false };

    function layer () { const c = canvas(W * DPR, H * DPR), g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); return [c, g]; }
    function buildLayers () {
      const r0 = seeded(5);
      let [c, g] = layer(); bgLayer = c;
      const r = Math.hypot(W, H) * 0.62;
      const gr = g.createRadialGradient(W * 0.46, H * 0.42, 0, W * 0.5, H * 0.5, r);
      gr.addColorStop(0, '#04384a'); gr.addColorStop(0.45, '#032636'); gr.addColorStop(1, '#010d16');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // a floor of soft stones, far below
      for (let i = 0; i < 70; i++) {
        const x = r0() * W, y = r0() * H, rr = (18 + r0() * 52) * S;
        const sg = g.createRadialGradient(x, y, 0, x, y, rr);
        sg.addColorStop(0, 'rgba(70,120,130,0.10)'); sg.addColorStop(1, 'rgba(70,120,130,0)');
        g.fillStyle = sg; g.beginPath(); g.ellipse(x, y, rr, rr * (0.6 + r0() * 0.3), r0() * TAU, 0, TAU); g.fill();
      }
      // reflections of a tree on the water, from the upper right
      [c, g] = layer(); branchLayer = c;
      g.lineCap = 'round';
      const branch = (x, y, a, len, w, depth) => {
        if (depth <= 0 || len < 6) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        const mx = (x + x2) / 2 + Math.cos(a + Math.PI / 2) * len * (r0() * 0.24 - 0.12), my = (y + y2) / 2 + Math.sin(a + Math.PI / 2) * len * (r0() * 0.24 - 0.12);
        g.strokeStyle = 'rgba(214,160,78,' + (0.18 + depth * 0.05) + ')'; g.lineWidth = w;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, x2, y2); g.stroke();
        const n = depth > 5 ? 2 : (r0() < 0.6 ? 2 : 3);
        for (let k = 0; k < n; k++) branch(x2, y2, a + (r0() * 1.5 - 0.75), len * (0.62 + r0() * 0.2), Math.max(0.6, w * 0.68), depth - 1);
      };
      const base = Math.max(W, H);
      g.filter = 'blur(' + 1.1 * S + 'px)';
      branch(W + 20, -20, Math.PI * 0.72, base * 0.16, 7 * S, low ? 7 : 8);
      branch(W + 30, H * 0.22, Math.PI * 0.95, base * 0.13, 5.5 * S, low ? 6 : 7);
      branch(W * 0.86, -30, Math.PI * 0.6, base * 0.12, 5 * S, low ? 6 : 7);
      g.filter = 'none';
      // the dark rim of the pond
      [c, g] = layer(); vignette = c;
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,4,8,0.72)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      if (!caustA) { const n = low ? 128 : 256; caustA = caustics(n, 9, 7); caustB = caustics(n, 12, 99); }
      patA = patB = null;
    }

    class Koi {
      constructor (kind, depth) {
        this.k = KINDS[kind]; this.depth = depth;
        this.len = rnd(0.82, 1.12) * 190 * S * (depth ? 0.88 : 1);
        this.x = rnd(W * 0.2, W * 0.8); this.y = rnd(H * 0.2, H * 0.8); this.a = rnd(0, TAU);
        this.v = rnd(30, 50) * S; this.turn = 0; this.phase = rnd(0, TAU); this.seed = rnd(0, 1000);
        this.fear = 0; this.mouth = 0; this.curious = false; this.ring = 0; this.fleeA = 0;
        this.seg = [];
        for (let i = 0; i < NSEG; i++) this.seg.push([this.x - Math.cos(this.a) * i * this.len / (NSEG - 1), this.y - Math.sin(this.a) * i * this.len / (NSEG - 1)]);
      }
      // half the width of the body at s (0 the nose, 1 the tail's root)
      half (s) {
        const m = this.len * 0.106;
        if (s < 0.22) return m * (0.5 + 0.5 * Math.sin(s / 0.22 * Math.PI / 2));
        if (s < 0.52) return m * (1 - (s - 0.22) * 0.25);
        return m * Math.max(0.07, 0.925 - Math.pow((s - 0.52) / 0.48, 1.15) * 0.86);
      }
      steer (want, rate, dt) { const d = angDiff(this.a, want); this.turn += (clamp(d * 2.2, -rate, rate) - this.turn) * Math.min(1, dt * 4); }
      update (dt, t) {
        const cx = W / 2, cy = H / 2, m = 90 * S;
        // a slow wander of its own
        let want = this.a + Math.sin(t * 0.21 + this.seed) * 0.9 + Math.sin(t * 0.53 + this.seed * 2.1) * 0.5;
        let rate = 1.1, vt = (38 + 14 * Math.sin(t * 0.3 + this.seed)) * S;
        // the pond's edge
        let ex = 0, ey = 0;
        if (this.x < m) ex = 1; else if (this.x > W - m) ex = -1;
        if (this.y < m) ey = 1; else if (this.y > H - m) ey = -1;
        if (ex || ey) { want = Math.atan2(cy - this.y + ey * 50, cx - this.x + ex * 50); rate = 1.8; }
        // the others: not too close
        for (const o of fish) {
          if (o === this || o.depth !== this.depth) continue;
          const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy);
          if (d < this.len * 0.7 && d > 0) { want += angDiff(want, Math.atan2(dy, dx)) * (1 - d / (this.len * 0.7)) * 0.9; rate = Math.max(rate, 1.6); }
        }
        // the music: round in a ring, in time
        if (beat.on && opts.dance) {
          const bx = this.x - cx, by = this.y - cy, br = Math.hypot(bx, by), R = Math.min(W, H) * (this.depth ? 0.2 : 0.22 + 0.045 * this.ring);
          const tang = Math.atan2(by, bx) + Math.PI / 2 * (this.depth ? -1 : 1);
          want = tang + clamp((br - R) / R, -1, 1) * 0.9 * (this.depth ? -1 : 1);
          vt = (54 + beat.pulse * 80) * S; rate = 1.6;
        }
        // food: the nearest pellet
        let food = null, fd = 1e9;
        for (const p of pellets) { const pd = Math.hypot(p.x - this.x, p.y - this.y); if (pd < fd) { fd = pd; food = p; } }
        if (food && fd < 900 * S && !this.depth) {
          const hx = this.seg[0][0], hy = this.seg[0][1];
          want = Math.atan2(food.y - hy, food.x - hx); vt = (fd < 120 * S ? 60 : 95) * S; rate = 2.1;
          if (Math.hypot(food.x - hx, food.y - hy) < this.len * 0.09) { food.eaten = true; this.mouth = 1; ripple(food.x, food.y, 0.5, 26 * S); }
        } else if (pointer.in && pointer.still > 0.3 && this.curious && !this.fear) {
          // curious: up to the pointer and hang about there
          const qx = pointer.x - this.seg[0][0], qy = pointer.y - this.seg[0][1], qd = Math.hypot(qx, qy);
          want = Math.atan2(qy, qx) + (qd < 70 * S ? Math.sin(t * 0.8 + this.seed) * 0.6 : 0); vt = clamp((qd - 40 * S) * 0.35, 6 * S, 72 * S); rate = 1.4;
          if (qd < 60 * S && Math.random() < dt * 1.2) this.mouth = 1;
        }
        // frightened: away, quickly
        if (this.fear > 0) { this.fear -= dt; want = this.fleeA; vt = 240 * S * Math.min(1, this.fear + 0.3); rate = 4.2; }
        vt *= speedK;
        this.steer(want, rate, dt);
        this.a += this.turn * dt;
        this.v += (vt - this.v) * Math.min(1, dt * (this.fear > 0 ? 6 : 1.4));
        this.x += Math.cos(this.a) * this.v * dt; this.y += Math.sin(this.a) * this.v * dt;
        this.phase += dt * (2.2 + this.v / (22 * S));
        this.mouth = Math.max(0, this.mouth - dt * 3);
        // the body follows the head, with a swimmer's wave down it
        const sp = this.len / (NSEG - 1);
        this.seg[0][0] = this.x; this.seg[0][1] = this.y;
        let prevA = this.a + Math.PI;
        for (let k = 1; k < NSEG; k++) {
          const a = this.seg[k - 1], b = this.seg[k];
          let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const bend = angDiff(prevA, ang), lim = 0.14;   // a koi's spine bends a little at each joint
          if (bend > lim) ang = prevA + lim; else if (bend < -lim) ang = prevA - lim;
          b[0] = a[0] + Math.cos(ang) * sp; b[1] = a[1] + Math.sin(ang) * sp; prevA = ang;
        }
      }
      frighten (x, y) { this.fear = rnd(0.7, 1.1); this.fleeA = Math.atan2(this.y - y, this.x - x) + rnd(-0.4, 0.4); }
      // the body's points, with the wave added: [x, y, nx, ny, s, tx, ty]
      spine () {
        const out = [], amp = this.len * clamp(0.018 + this.v / (S * 2600), 0.018, 0.075);
        for (let i = 0; i < NSEG; i++) {
          const p = this.seg[i], qq = this.seg[Math.max(0, i - 1)], r = this.seg[Math.min(NSEG - 1, i + 1)];
          const dx = qq[0] - r[0], dy = qq[1] - r[1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, s = i / (NSEG - 1);
          const w = Math.sin(this.phase - s * 4.4) * amp * Math.pow(s, 1.6);
          out.push([p[0] + nx * w, p[1] + ny * w, nx, ny, s, dx / dl, dy / dl]);
        }
        return out;
      }
      bodyPath (g, sp) {
        const L = [], R = [];
        for (const p of sp) { const h = this.half(p[4]); L.push([p[0] + p[2] * h, p[1] + p[3] * h]); R.push([p[0] - p[2] * h, p[1] - p[3] * h]); }
        const nose = [sp[0][0] + sp[0][5] * this.len * 0.05, sp[0][1] + sp[0][6] * this.len * 0.05];
        g.beginPath(); g.moveTo(nose[0], nose[1]);
        g.quadraticCurveTo(L[0][0] + sp[0][5] * this.len * 0.03, L[0][1] + sp[0][6] * this.len * 0.03, L[1][0], L[1][1]);
        for (let i = 1; i < L.length - 1; i++) g.quadraticCurveTo(L[i][0], L[i][1], (L[i][0] + L[i + 1][0]) / 2, (L[i][1] + L[i + 1][1]) / 2);
        g.lineTo(R[R.length - 1][0], R[R.length - 1][1]);
        for (let i = R.length - 2; i > 0; i--) g.quadraticCurveTo(R[i][0], R[i][1], (R[i][0] + R[i - 1][0]) / 2, (R[i][1] + R[i - 1][1]) / 2);
        g.quadraticCurveTo(R[0][0] + sp[0][5] * this.len * 0.03, R[0][1] + sp[0][6] * this.len * 0.03, nose[0], nose[1]);
        g.closePath();
      }
      draw (g, t, shadowOnly) {
        const sp = this.spine(), k = this.k, len = this.len;
        const head = sp[0], ha = Math.atan2(head[6], head[5]);
        if (shadowOnly) {
          const off = (this.depth ? 8 : 18) * S;
          g.fillStyle = this.depth ? 'rgba(0,6,10,0.07)' : 'rgba(0,6,10,0.09)';
          for (let pass = 0; pass < 2; pass++) {
            const grow = pass ? 1.55 : 1.05;
            g.beginPath();
            for (let si = 0; si < NSEG; si += 2) { const q0 = sp[si], rr = this.half(q0[4]) * grow + 2 * S; g.moveTo(q0[0] + off * 0.7 + rr, q0[1] + off); g.arc(q0[0] + off * 0.7, q0[1] + off, rr, 0, TAU); }
            g.fill(); g.fill();
          }
          return;
        }
        // tail: a forked fan behind the last point, swinging with the body
        const tl = sp[NSEG - 1], tb = sp[NSEG - 4], ta = Math.atan2(tl[1] - tb[1], tl[0] - tb[0]);
        const tlen = len * (k.butterfly ? 0.42 : 0.3), swing = Math.sin(this.phase - 4.4) * 0.35;
        fin(g, tl[0], tl[1], ta + swing * 0.6 - 0.32, tlen, 0.22, k.fin, 4);
        fin(g, tl[0], tl[1], ta + swing * 0.6 + 0.32, tlen, 0.22, k.fin, 4);
        // pectoral fins, rowing
        const pf = sp[Math.round(NSEG * 0.2)], row = Math.sin(this.phase * 0.5) * 0.25, plen = len * (k.butterfly ? 0.3 : 0.2);
        const pa = Math.atan2(pf[6], pf[5]) + Math.PI, ph = this.half(pf[4]);
        fin(g, pf[0] + pf[2] * ph * 0.8, pf[1] + pf[3] * ph * 0.8, pa - 1.05 - row, plen, 0.32, k.fin, 3);
        fin(g, pf[0] - pf[2] * ph * 0.8, pf[1] - pf[3] * ph * 0.8, pa + 1.05 + row, plen, 0.32, k.fin, 3);
        // pelvic fins, smaller, further back
        const vf = sp[Math.round(NSEG * 0.5)], vh = this.half(vf[4]), va = Math.atan2(vf[6], vf[5]) + Math.PI;
        fin(g, vf[0] + vf[2] * vh * 0.7, vf[1] + vf[3] * vh * 0.7, va - 0.8 + row * 0.5, len * 0.1, 0.3, k.fin, 2);
        fin(g, vf[0] - vf[2] * vh * 0.7, vf[1] - vf[3] * vh * 0.7, va + 0.8 - row * 0.5, len * 0.1, 0.3, k.fin, 2);
        // the body and its colours, clipped to it
        g.save(); this.bodyPath(g, sp); g.fillStyle = k.base; g.fill(); g.clip();
        for (const s of k.spots) {
          const at = sp[Math.min(NSEG - 1, Math.round(s[1] * (NSEG - 1)))], h = this.half(at[4]);
          const cxp = at[0] + at[2] * s[2] * h, cyp = at[1] + at[3] * s[2] * h, ang = Math.atan2(at[6], at[5]);
          g.save(); g.translate(cxp, cyp); g.rotate(ang); g.fillStyle = s[0];
          g.beginPath(); g.ellipse(0, 0, s[3] * len, s[4] * h * 1.1, 0, 0, TAU);
          g.ellipse(s[3] * len * 0.55, s[4] * h * 0.25, s[3] * len * 0.55, s[4] * h * 0.75, 0.3, 0, TAU); g.fill(); g.restore();
        }
        if (k.scales && !low) {
          g.strokeStyle = 'rgba(60,30,10,0.22)'; g.lineWidth = 1;
          for (let qi = 3; qi < NSEG - 3; qi++) { const c = sp[qi], hh = this.half(c[4]); for (let j = -2; j <= 2; j++) { g.beginPath(); g.arc(c[0] + c[2] * j * hh * 0.38, c[1] + c[3] * j * hh * 0.38, hh * 0.22, 0, TAU); g.stroke(); } }
        }
        // round: light down the back, the sides in shadow
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath(); for (let i = 1; i < NSEG - 2; i++) { if (i === 1) g.moveTo(sp[i][0], sp[i][1]); else g.lineTo(sp[i][0], sp[i][1]); }
        g.strokeStyle = 'rgba(255,255,255,' + (k.sheen ? 0.34 : 0.2) + ')'; g.lineWidth = len * 0.05; g.stroke();
        if (k.sheen) {
          const mid = sp[Math.round((0.3 + 0.25 * Math.sin(t * 0.7 + this.seed)) * (NSEG - 1))];
          const sg = g.createRadialGradient(mid[0], mid[1], 0, mid[0], mid[1], len * 0.18);
          sg.addColorStop(0, k.sheen); sg.addColorStop(1, 'rgba(255,255,255,0)');
          g.globalAlpha = 0.5; g.fillStyle = sg; g.fillRect(mid[0] - len * 0.2, mid[1] - len * 0.2, len * 0.4, len * 0.4); g.globalAlpha = 1;
        }
        this.bodyPath(g, sp); g.strokeStyle = 'rgba(0,10,16,0.32)'; g.lineWidth = len * 0.05; g.stroke();
        g.restore();
        // eyes and whiskers on the head
        const eh = this.half(0.07), e0 = sp[1];
        for (let sgn = -1; sgn <= 1; sgn += 2) {
          g.fillStyle = '#121014'; g.beginPath(); g.arc(e0[0] + e0[2] * eh * 0.78 * sgn, e0[1] + e0[3] * eh * 0.78 * sgn, len * 0.012, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(240,232,226,0.55)'; g.lineWidth = 1.1 * S;
          const bx = head[0] + head[5] * len * 0.045, by = head[1] + head[6] * len * 0.045;
          g.beginPath(); g.moveTo(bx + head[2] * eh * 0.3 * sgn, by + head[3] * eh * 0.3 * sgn);
          g.quadraticCurveTo(bx + head[5] * len * 0.03 + head[2] * eh * 0.9 * sgn, by + head[6] * len * 0.03 + head[3] * eh * 0.9 * sgn, bx + head[5] * len * 0.012 + head[2] * eh * 1.25 * sgn, by + head[6] * len * 0.012 + head[3] * eh * 1.25 * sgn); g.stroke();
        }
        if (this.mouth > 0.05) {
          g.fillStyle = 'rgba(30,10,10,' + this.mouth * 0.7 + ')';
          g.beginPath(); g.ellipse(head[0] + head[5] * len * 0.045, head[1] + head[6] * len * 0.045, len * 0.018 * this.mouth, len * 0.012 * this.mouth, ha, 0, TAU); g.fill();
        }
      }
    }

    function ripple (x, y, strength, max) { if (ripples.length < 40) ripples.push({ x, y, r: 2, max: max || 150 * S, life: 1, s: strength || 1 }); }

    // ── lily pads, each painted once ──
    function padSprite (p) {
      const size = Math.ceil(p.r * 2 + 40 * S), c = canvas(size * DPR, size * DPR), g = c.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0); g.translate(size / 2, size / 2);
      const gr = g.createRadialGradient(-p.r * 0.3, -p.r * 0.3, p.r * 0.1, 0, 0, p.r);
      gr.addColorStop(0, '#4f9a4c'); gr.addColorStop(0.7, '#2f6e37'); gr.addColorStop(1, '#22552b');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, p.r, p.notch, TAU); g.lineTo(0, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(160,210,130,0.22)'; g.lineWidth = 1.2 * S;
      for (let i = 0; i < 11; i++) { const a = p.notch + (TAU - p.notch) * (i + 0.5) / 11; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * p.r * 0.92, Math.sin(a) * p.r * 0.92); g.stroke(); }
      g.strokeStyle = 'rgba(190,235,160,0.28)'; g.lineWidth = 1.6 * S; g.beginPath(); g.arc(0, 0, p.r - 1, p.notch + 0.05, TAU - 0.05); g.stroke();
      p.sprite = c; p.size = size;
    }
    function makePads () {
      pads = [];
      const spots = [[0.14, 0.24, 1], [0.8, 0.7, 1.25], [0.26, 0.78, 0.8], [0.66, 0.2, 0.7], [0.9, 0.36, 0.6]];
      spots.forEach((p, i) => pads.push({ x: p[0] * W, y: p[1] * H, r: 58 * S * p[2], rot: rnd(0, TAU), vr: rnd(-0.02, 0.02), bob: 0, flower: i === 1 || i === 3, notch: rnd(0.35, 0.55) }));
      pads.forEach(padSprite);
    }
    function drawPad (g, p, t) {
      const bob = 1 + p.bob * 0.06 * Math.sin(t * 10) + (p.flower ? beat.pulse * 0.03 : 0);
      g.save(); g.translate(p.x, p.y);
      g.fillStyle = 'rgba(0,8,12,0.16)'; g.beginPath(); g.arc(10 * S, 14 * S, p.r * 1.04, 0, TAU); g.fill();
      g.beginPath(); g.arc(8 * S, 11 * S, p.r * 0.98, 0, TAU); g.fill();
      g.rotate(p.rot); g.scale(bob, bob);
      g.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
      if (p.flower) {
        for (let j = 0; j < 10; j++) {
          const fa = j / 10 * TAU + t * 0.05, fr = p.r * 0.32;
          g.fillStyle = j % 2 ? '#fbd3e2' : '#ffe9f0';
          g.beginPath(); g.ellipse(Math.cos(fa) * fr * 0.55, Math.sin(fa) * fr * 0.55, fr * 0.62, fr * 0.24, fa, 0, TAU); g.fill();
        }
        g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(0, 0, p.r * 0.1, 0, TAU); g.fill();
      }
      g.restore();
    }
    function addPetal (x, y) {
      petals.push({ x, y, rot: rnd(0, TAU), vr: rnd(-0.4, 0.4), s: rnd(7, 11) * S, life: 1, vx: rnd(-6, 6) * S, vy: rnd(-4, 6) * S });
      ripple(x, y, 0.35, 34 * S);
    }
    function drawPetal (g, p) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, p.life * 3);
      g.fillStyle = 'rgba(0,8,12,0.3)'; g.beginPath(); g.ellipse(3 * S, 4 * S, p.s, p.s * 0.62, 0, 0, TAU); g.fill();
      const gr = g.createLinearGradient(-p.s, 0, p.s, 0); gr.addColorStop(0, '#ffd9e6'); gr.addColorStop(1, '#ff9cc6');
      g.fillStyle = gr; g.beginPath();
      g.moveTo(-p.s, 0); g.quadraticCurveTo(-p.s * 0.2, -p.s * 0.9, p.s, -p.s * 0.25); g.lineTo(p.s * 0.7, 0); g.lineTo(p.s, p.s * 0.25);
      g.quadraticCurveTo(-p.s * 0.2, p.s * 0.9, -p.s, 0); g.fill(); g.restore(); g.globalAlpha = 1;
    }
    function makeFish () {
      const kinds = [['chagoi', 1], ['platinum', 1], ['kohaku', 0], ['yamabuki', 0], ['showa', 0], ['sanke', 0], ['tancho', 0]];
      fish = kinds.slice(0, low ? 5 : 7).map(([k, d]) => new Koi(k, d));
      fish.forEach((f, i) => { f.ring = i % 5; });
    }

    function frame (dt0) {
      const dt = Math.min(0.05, dt0), t = (clock += dt), g = ctx;
      pointer.still = pointer.speed < 260 * S ? Math.min(1.5, pointer.still + dt) : 0;
      pointer.speed *= Math.pow(0.002, dt);
      // which fish are curious: the three nearest to a still pointer
      if (pointer.in) {
        const byD = fish.filter(f => !f.depth).sort((a, b) => Math.hypot(a.x - pointer.x, a.y - pointer.y) - Math.hypot(b.x - pointer.x, b.y - pointer.y));
        fish.forEach(f => { f.curious = false; });
        byD.slice(0, 3).forEach(f => { if (Math.hypot(f.x - pointer.x, f.y - pointer.y) < 520 * S) f.curious = true; });
      }
      // the music: a beat, a ring across the water; music with a beat in the last few seconds, the dance
      if (beat.armed && beat.level > 0.55 && t - beat.lastHit > 0.28) { beat.armed = false; beat.lastHit = t; beat.pulse = 1; if (opts.dance && !host.reduced) ripple(W / 2, H / 2, 0.55, Math.min(W, H) * 0.42); }
      else if (beat.level < 0.35) beat.armed = true;
      beat.pulse = Math.max(0, beat.pulse - dt * 2.4);
      beat.on = t - beat.lastHit < 2.5;
      fish.forEach(f => f.update(dt, t));
      pellets = pellets.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt; return !p.eaten && p.age < 40; });
      if (opts.petals) { petalT -= dt; if (petalT <= 0) { petalT = rnd(2.2, 4.5); addPetal(rnd(W * 0.08, W * 0.92), rnd(H * 0.08, H * 0.92)); } }
      petals = petals.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt / 45; return p.life > 0; });
      pads.forEach(p => { p.rot += p.vr * dt; p.bob = Math.max(0, p.bob - dt * 0.8); });
      ripples = ripples.filter(r => { r.r += dt * (90 + 60 * r.s) * S; r.life = 1 - r.r / r.max; return r.life > 0; });

      // draw: the water, light on the floor, deep fish, a veil of water, the
      // shallow fish, then what floats, ripples and reflections
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(bgLayer, 0, 0, W * DPR, H * DPR);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.save(); g.globalCompositeOperation = 'screen';
      if (!patA) { patA = g.createPattern(caustA, 'repeat'); patB = g.createPattern(caustB, 'repeat'); }
      const n = caustA.width;
      const drift = (pat, a, sx, sy, scale) => {
        g.globalAlpha = a; g.save(); g.scale(scale, scale);
        g.translate((t * sx) % n, (t * sy) % n); g.fillStyle = pat; g.fillRect(-n, -n, W / scale + 2 * n, H / scale + 2 * n); g.restore();
      };
      const k = 256 / n;
      drift(patA, 0.085 + beat.pulse * 0.04, 9 / k, 5 / k, 2.2 * S * k);
      if (!low) drift(patB, 0.07, -6, 8, 1.7 * S);
      g.restore(); g.globalAlpha = 1;
      fish.forEach(f => { if (f.depth) f.draw(g, t, true); });
      fish.forEach(f => { if (f.depth) f.draw(g, t); });
      g.fillStyle = 'rgba(2,30,42,0.42)'; g.fillRect(0, 0, W, H);
      fish.forEach(f => { if (!f.depth) f.draw(g, t, true); });
      fish.forEach(f => { if (!f.depth) f.draw(g, t); });
      for (const p of pellets) {
        g.fillStyle = 'rgba(0,8,12,0.35)'; g.beginPath(); g.arc(p.x + 3 * S, p.y + 4 * S, p.r, 0, TAU); g.fill();
        g.fillStyle = '#8a5a2c'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,220,170,0.6)'; g.beginPath(); g.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.35, 0, TAU); g.fill();
      }
      pads.forEach(p => drawPad(g, p, t));
      petals.forEach(p => drawPetal(g, p));
      for (const r of ripples) {
        g.strokeStyle = 'rgba(210,245,255,' + (r.life * 0.38 * r.s).toFixed(3) + ')'; g.lineWidth = 2.2 * S;
        g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
        if (r.r > 18 * S) { g.strokeStyle = 'rgba(210,245,255,' + (r.life * 0.2 * r.s).toFixed(3) + ')'; g.lineWidth = 1.4 * S; g.beginPath(); g.arc(r.x, r.y, r.r * 0.72, 0, TAU); g.stroke(); }
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.55 + 0.08 * Math.sin(t * 1.3);
      const wob = Math.sin(t * 0.9) * 1.6 * S * DPR;
      g.drawImage(branchLayer, wob, -wob * 0.5, W * DPR, H * DPR); g.globalAlpha = 0.25; g.drawImage(branchLayer, -wob, wob, W * DPR, H * DPR); g.restore();
      g.drawImage(vignette, 0, 0, W * DPR, H * DPR);
    }

    // first start
    buildLayers(); makeFish(); makePads();
    for (let i = 0; i < 5; i++) petals.push({ x: rnd(0, W), y: rnd(0, H), rot: rnd(0, TAU), vr: rnd(-0.3, 0.3), s: rnd(7, 11) * S, life: rnd(0.4, 1), vx: rnd(-5, 5) * S, vy: rnd(-3, 5) * S });

    return {
      frame,
      resize (w, h, dpr) {
        const sx = w / Math.max(1, W), sy = h / Math.max(1, H), oldS = S;
        W = w; H = h; DPR = dpr; S = scaleFor(W, H);
        fish.forEach(f => { f.x *= sx; f.y *= sy; f.seg.forEach(p => { p[0] *= sx; p[1] *= sy; }); });
        pads.forEach(p => { p.x *= sx; p.y *= sy; p.r *= S / oldS; });
        clearTimeout(rebuildT); rebuildT = setTimeout(() => { buildLayers(); pads.forEach(padSprite); }, 220);
      },
      pointer (kind, x, y) {
        if (kind === 'leave') { pointer.in = false; return; }
        const now = performance.now(), dtp = Math.max(1, now - (pointer.lt || now - 16)) / 1000;
        const sp = Math.hypot(x - pointer.x, y - pointer.y) / dtp;
        pointer.speed = pointer.in && kind === 'move' ? sp : 0; pointer.x = x; pointer.y = y; pointer.in = true; pointer.lt = now;
        // a quick sweep over a fish frightens it
        if (kind === 'move' && sp > 1300 * S) fish.forEach(f => { if (!f.depth && Math.hypot(f.x - x, f.y - y) < 170 * S) f.frighten(x, y); });
        if (kind !== 'down') return;
        pointer.still = 0;
        if (opts.tap === 'feed') {
          for (let i = 0; i < 7; i++) pellets.push({ x: x + rnd(-28, 28) * S, y: y + rnd(-28, 28) * S, r: rnd(3, 4.5) * S, vx: rnd(-3, 3) * S, vy: rnd(-3, 3) * S, age: 0 });
          if (pellets.length > 70) pellets.splice(0, pellets.length - 70);
          ripple(x, y, 0.6, 60 * S);
          fish.forEach(f => { f.fear = 0; });
        } else {
          ripple(x, y, 1, 170 * S); setTimeout(() => ripple(x, y, 0.6, 120 * S), 180);
          fish.forEach(f => { if (Math.hypot(f.x - x, f.y - y) < 260 * S) f.frighten(x, y); });
          pads.forEach(pd => { if (Math.hypot(pd.x - x, pd.y - y) < 220 * S) pd.bob = 1; });
        }
      },
      beat (level) { beat.level = level; },
      set (key, value) {
        if (key === 'tap' && TAPS.some(([kk]) => kk === value)) opts.tap = value;
        if (key === 'petals') opts.petals = !!value;
        if (key === 'dance') opts.dance = !!value;
      },
      stop () { clearTimeout(rebuildT); fish = []; pads = []; petals = []; ripples = []; pellets = []; bgLayer = branchLayer = vignette = null; },
    };
  },
};
