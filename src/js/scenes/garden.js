/**
 * Butterfly Garden (v3.59.0, the plan's 3.56): a sunny garden bed seen from
 * above, a scene for the scene kit (runner.js says what a scene gives),
 * chosen on Home with the scene picker.
 *
 *   - soil and mulch under a carpet of leaves, a stepping-stone path and a
 *     stone birdbath whose water moves, lavender mounds, and drifts of
 *     cosmos, daisies, zinnias and coneflowers, each painted once
 *   - monarchs, blue morphos, swallowtails, red admirals and cabbage whites
 *     flutter, land on flowers, bask with their wings opening and closing,
 *     and cast soft shadows that grow as they rise
 *   - hold the pointer still and the nearest butterfly lands on it; a quick
 *     sweep scares the ones near it
 *   - a tap grows a flower where it lands, or sends a gust that tumbles the
 *     butterflies away (opts.tap)
 *   - a breeze sways the plants and moves the dappled shade (opts.breeze)
 *   - with music playing, the flowers pulse and the wings beat with it
 *
 * Options (runner.run(def, opts), runner.set): tap 'grow' | 'gust', breeze
 * true | false. The garden bed is drawn once for a size, and again a moment
 * after the window stops changing size. The leaves, plants and butterflies
 * follow the quality tier. Ported from the demo shown with the roadmap.
 */
import { TAU, rnd, clamp, canvas, free, seeded, TIER, scaleFor } from './kit.js';

export const TAPS = [['grow', 'Grow a flower'], ['gust', 'Gust']];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const SH = { x: 0.55, y: 0.75 };   // shadows fall to the lower right

const SPECIES = {
  monarch: { base: ['#f8a030', '#e06a10'], vein: '#1a120c', border: '#141010', dots: '#ffffff', size: 1.0 },
  morpho: { base: ['#40d8ff', '#1060e8'], vein: 'rgba(0,20,60,0.4)', border: '#0c0c18', dots: '#ffffff', size: 1.15, shine: true },
  swallow: { base: ['#ffe46a', '#f0c030'], vein: '#141010', border: '#141010', dots: '#ffe46a', size: 1.12, tails: true, stripes: true },
  admiral: { base: ['#2a1e1a', '#1a1210'], vein: 'rgba(0,0,0,0.3)', border: '#100c0a', dots: '#ffffff', size: 0.9, bands: '#ff5a1a' },
  white: { base: ['#fbfaf2', '#eae6d6'], vein: 'rgba(80,80,60,0.25)', border: 'rgba(60,60,60,0)', dots: '#2a2a2a', size: 0.8, tips: true },
};
const ORDER = ['monarch', 'monarch', 'morpho', 'swallow', 'admiral', 'white', 'monarch', 'morpho', 'swallow', 'white'];
const KINDS = ['cosmos', 'daisy', 'zinnia', 'cone'];

// a lumpy round shape, for the stepping stones
function blob (g, cx, cy, rx, ry, r, lumps) {
  const n = 16, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (r() - 0.5) * lumps; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  g.beginPath(); g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  g.closePath();
}

function wingPath (g, U, hind, tails) {
  g.beginPath();
  if (!hind) {
    g.moveTo(0.04 * U, -0.08 * U); g.bezierCurveTo(0.3 * U, -0.62 * U, 0.85 * U, -0.72 * U, 1.0 * U, -0.6 * U);
    g.bezierCurveTo(1.02 * U, -0.3 * U, 0.86 * U, -0.02 * U, 0.7 * U, 0.04 * U); g.bezierCurveTo(0.45 * U, 0.1 * U, 0.2 * U, 0.06 * U, 0.04 * U, 0.02 * U);
  } else {
    g.moveTo(0.04 * U, 0); g.bezierCurveTo(0.4 * U, -0.02 * U, 0.72 * U, 0.08 * U, 0.74 * U, 0.3 * U);
    g.bezierCurveTo(0.72 * U, 0.5 * U, 0.5 * U, 0.66 * U, tails ? 0.38 * U : 0.3 * U, 0.66 * U);
    if (tails) { g.lineTo(0.34 * U, 0.98 * U); g.lineTo(0.27 * U, 0.98 * U); g.lineTo(0.24 * U, 0.62 * U); }
    g.bezierCurveTo(0.12 * U, 0.6 * U, 0.05 * U, 0.4 * U, 0.04 * U, 0.12 * U);
  }
  g.closePath();
}

// A species' right wings, painted once at a fixed size, and their blurred shadow.
function makeWings (name) {
  const P = SPECIES[name], U = 60, size = 150, c = canvas(size * 2, size * 2), g = c.getContext('2d');
  g.translate(8, size);   // the hinge on the left edge, the body along it
  for (const hind of [true, false]) {
    g.save(); wingPath(g, U, hind, P.tails);
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, U * 1.05); gr.addColorStop(0, P.base[1]); gr.addColorStop(1, P.base[0]);
    g.fillStyle = gr; g.fill(); g.clip();
    if (P.shine) { const sh = g.createLinearGradient(0, -U * 0.6, U, U * 0.4); sh.addColorStop(0, 'rgba(180,255,255,0.45)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, -U, U * 1.2, U * 2); }
    if (P.stripes && !hind) { g.fillStyle = P.border; for (const s of [[0.18, 0.06], [0.36, 0.05], [0.56, 0.05]]) { g.save(); g.translate(s[0] * U, -0.3 * U); g.rotate(-0.5); g.fillRect(-s[1] * U, -0.5 * U, s[1] * 2 * U, U); g.restore(); } }
    if (P.bands) { g.strokeStyle = P.bands; g.lineWidth = U * 0.11; g.beginPath(); if (!hind) { g.moveTo(0.3 * U, -0.1 * U); g.quadraticCurveTo(0.55 * U, -0.35 * U, 0.66 * U, -0.62 * U); } else { g.moveTo(0.2 * U, 0.6 * U); g.quadraticCurveTo(0.6 * U, 0.55 * U, 0.72 * U, 0.25 * U); } g.stroke(); }
    if (P.tips && !hind) { g.fillStyle = 'rgba(40,40,40,0.75)'; g.beginPath(); g.ellipse(0.95 * U, -0.6 * U, 0.2 * U, 0.12 * U, -0.4, 0, TAU); g.fill(); g.beginPath(); g.arc(0.55 * U, -0.25 * U, 0.06 * U, 0, TAU); g.fill(); }
    // veins from the root outwards
    g.strokeStyle = P.vein; g.lineWidth = name === 'monarch' ? 2 : 1;
    for (let v = 0; v < 7; v++) { const a = hind ? -0.15 + v * 0.26 : -1.5 + v * 0.22, len = U * (hind ? 0.75 : 1.0); g.beginPath(); g.moveTo(0.04 * U, 0); g.quadraticCurveTo(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5 + (hind ? 0 : -U * 0.05), Math.cos(a) * len, Math.sin(a) * len); g.stroke(); }
    // the dark border with its row of pale spots
    g.restore(); wingPath(g, U, hind, P.tails); g.strokeStyle = P.border; g.lineWidth = name === 'white' ? 0 : U * 0.12; if (g.lineWidth) g.stroke();
    if (name !== 'white') {
      g.fillStyle = P.dots;
      for (let d = 0; d < 9; d++) { const t2 = d / 8; const x = hind ? U * (0.72 - 0.4 * t2) : U * (0.98 - 0.2 * t2), y = hind ? U * (0.28 + 0.36 * t2) : U * (-0.58 + 0.6 * t2); g.beginPath(); g.arc(x - 0.05 * U, y, U * 0.022, 0, TAU); g.fill(); }
    }
  }
  const sc = canvas(c.width, c.height), sg = sc.getContext('2d');
  sg.filter = 'blur(3px)'; sg.drawImage(c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = 'rgba(20,12,4,1)'; sg.fillRect(0, 0, sc.width, sc.height);
  return { c, shadow: sc, U, size };
}

export default {
  id: 'garden',
  name: 'Butterfly Garden',
  // A daylit scene with fine detail: one and a half pixels to a CSS pixel at most, 50 frames a second.
  maxDpr: 1.5,
  fps: 50,
  start (host) {
    const { ctx } = host;
    const q = TIER[host.tier] || 1, low = q < 0.75;
    const opts = { tap: 'grow', breeze: true, ...(host.opts || {}) };
    const speed = host.reduced ? 0.5 : 1;
    let W = host.w, H = host.h, DPR = host.dpr, S = scaleFor(W, H), rebuildT = 0;
    let groundL = null, dapple = null, dapPat = null, bath = null, vign = null;
    let plants = [], fliers = [], puffs = [], nearest = -1, clock = 0;
    const wings = {};
    const pointer = { x: 0, y: 0, in: false, still: 0, speed: 0, lt: 0, outT: 0 };
    const beat = { level: 0, armed: true, pulse: 0, phase: 0, lastHit: -1 };
    const breeze = { x: 0, y: 0 };
    const pathY = x => H * (0.58 + 0.12 * Math.sin(x / W * 3.3 + 0.5));

    // ── the ground, the path and the birdbath, made once per size ──
    function buildGround () {
      free(groundL); groundL = canvas(W * DPR, H * DPR); const g = groundL.getContext('2d'); g.scale(DPR, DPR);
      const r = seeded(3);
      g.fillStyle = '#4a3622'; g.fillRect(0, 0, W, H);   // dark, crumbly soil and mulch
      for (let i = 0; i < W * H / 60 * q; i++) {
        const x = r() * W, y = r() * H, s = (0.6 + r() * 2.4) * S, c = r();
        g.fillStyle = c < 0.3 ? 'rgba(30,20,12,0.5)' : c < 0.55 ? 'rgba(110,80,50,0.4)' : c < 0.7 ? 'rgba(150,110,60,0.3)' : 'rgba(70,52,34,0.5)';
        g.beginPath(); g.ellipse(x, y, s * (1 + r()), s, r() * 3, 0, TAU); g.fill();
      }
      for (let i = 0; i < W * H / 900; i++) { const mx = r() * W, my = r() * H, ml = (5 + r() * 9) * S; g.fillStyle = r() < 0.5 ? 'rgba(120,78,44,0.55)' : 'rgba(90,60,36,0.55)'; g.save(); g.translate(mx, my); g.rotate(r() * 3); g.fillRect(-ml / 2, -ml * 0.18, ml, ml * 0.36); g.restore(); }
      // a carpet of low leaves over most of the bed, clear of the path
      const greens = ['#3e6a28', '#4a7a30', '#5a8a38', '#355f22', '#6a9a40', '#2e5420'];
      const nleaf = Math.round(W * H / (110 * S * S) * (low ? 0.55 : 1));
      for (let i = 0; i < nleaf; i++) {
        const lx = r() * W, ly = r() * H;
        if (Math.abs(ly - pathY(lx)) < (48 + r() * 30) * S) continue;
        const ls = (5 + r() * 9) * S, la = r() * TAU, lc = greens[Math.floor(r() * greens.length)];
        g.save(); g.translate(lx, ly); g.rotate(la);
        g.fillStyle = 'rgba(20,30,10,0.35)'; g.beginPath(); g.ellipse(2 * S, 3 * S, ls, ls * 0.42, 0, 0, TAU); g.fill();
        const lgr = g.createLinearGradient(0, -ls * 0.4, 0, ls * 0.4); lgr.addColorStop(0, lc); lgr.addColorStop(1, '#22401a');
        g.fillStyle = lgr; g.beginPath(); g.moveTo(-ls, 0); g.quadraticCurveTo(0, -ls * 0.55, ls, 0); g.quadraticCurveTo(0, ls * 0.55, -ls, 0); g.fill();
        g.strokeStyle = 'rgba(200,230,150,0.25)'; g.lineWidth = 0.7 * S; g.beginPath(); g.moveTo(-ls * 0.8, 0); g.lineTo(ls * 0.85, 0); g.stroke();
        g.restore();
      }
      // tiny ground-cover flowers here and there
      for (let i = 0; i < W * H / (2200 * S * S); i++) {
        const fx = r() * W, fy = r() * H; if (Math.abs(fy - pathY(fx)) < 60 * S) continue;
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(150,180,255,0.85)';
        for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(fx + (r() - 0.5) * 10 * S, fy + (r() - 0.5) * 10 * S, 1.3 * S, 0, TAU); g.fill(); }
      }
      // a stepping-stone path, wandering across
      const n = Math.round(W / (110 * S)) + 2;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), px = u * W + (r() - 0.5) * 30 * S, py = H * (0.58 + 0.12 * Math.sin(u * 3.3 + 0.5)) + (r() - 0.5) * 16 * S, sr = (34 + r() * 14) * S;
        g.fillStyle = 'rgba(20,14,8,0.35)'; blob(g, px + 5 * S, py + 7 * S, sr, sr * 0.82, r, 0.18); g.fill();
        const sg = g.createRadialGradient(px - sr * 0.3, py - sr * 0.3, sr * 0.1, px, py, sr * 1.1);
        sg.addColorStop(0, '#c9c0b0'); sg.addColorStop(1, '#8e8678'); g.fillStyle = sg; blob(g, px, py, sr, sr * 0.82, r, 0.18); g.fill();
        g.save(); blob(g, px, py, sr, sr * 0.82, r, 0.18); g.clip();
        for (let k = 0; k < 40; k++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(60,50,40,0.14)'; g.beginPath(); g.arc(px + (r() - 0.5) * sr * 2, py + (r() - 0.5) * sr * 2, (1 + r() * 3) * S, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(120,150,80,0.35)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(px + (r() - 0.5) * sr * 1.6, py + (r() - 0.5) * sr * 1.4, (2 + r() * 5) * S, 0, TAU); g.fill(); }
        g.restore();
      }
      // the birdbath: a stone bowl of water holding the sky
      bath = { x: W * (W < H ? 0.72 : 0.8), y: H * (W < H ? 0.3 : 0.26), r: 62 * S };
      g.fillStyle = 'rgba(20,14,8,0.4)'; g.beginPath(); g.arc(bath.x + 14 * S, bath.y + 18 * S, bath.r * 1.08, 0, TAU); g.fill();
      const bg = g.createRadialGradient(bath.x - bath.r * 0.4, bath.y - bath.r * 0.4, 0, bath.x, bath.y, bath.r * 1.05);
      bg.addColorStop(0, '#d8d0c0'); bg.addColorStop(1, '#8a8274'); g.fillStyle = bg; g.beginPath(); g.arc(bath.x, bath.y, bath.r, 0, TAU); g.fill();
      const wg = g.createLinearGradient(bath.x - bath.r, bath.y - bath.r, bath.x + bath.r, bath.y + bath.r);
      wg.addColorStop(0, '#bfe6ff'); wg.addColorStop(0.5, '#7cc4ee'); wg.addColorStop(1, '#4f9ccc'); g.fillStyle = wg; g.beginPath(); g.arc(bath.x, bath.y, bath.r * 0.8, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,50,40,0.35)'; g.lineWidth = 3 * S; g.beginPath(); g.arc(bath.x, bath.y, bath.r * 0.8, 0, TAU); g.stroke();
      // the warm afternoon light and the edges darkened, baked in
      const lg = g.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.3, H * 0.2, Math.hypot(W, H)); lg.addColorStop(0, 'rgba(255,230,170,0.16)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
      free(vign); vign = canvas(W * DPR, H * DPR); const v = vign.getContext('2d'); v.scale(DPR, DPR);
      v.globalCompositeOperation = 'lighter'; v.fillStyle = lg; v.fillRect(0, 0, W, H); v.globalCompositeOperation = 'source-over';
      const vg = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,0.45)'); v.fillStyle = vg; v.fillRect(0, 0, W, H);
      // dappled light: soft patches of leaf shade that drift
      if (!dapple) {
        dapple = canvas(512, 512); const dg = dapple.getContext('2d'), dr = seeded(17);
        for (let i = 0; i < 46; i++) {
          const dx = dr() * 512, dy = dr() * 512, rr = 30 + dr() * 70;
          for (const p of [[dx, dy], [dx - 512, dy], [dx + 512, dy], [dx, dy - 512], [dx, dy + 512]]) { const gg = dg.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr); gg.addColorStop(0, 'rgba(0,0,0,0.5)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gg; dg.fillRect(p[0] - rr, p[1] - rr, rr * 2, rr * 2); }
        }
      }
      dapPat = null;
    }

    // ── plants: each painted once into its own picture ────────────
    function sprite (size, draw) { const c = canvas(size * DPR, size * DPR), g = c.getContext('2d'); g.scale(DPR, DPR); g.translate(size / 2, size / 2); draw(g); c.size = size; return c; }
    function lavender (r) {
      const R = (55 + r() * 30) * S;
      return sprite(R * 2.8, g => {
        const mg = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
        mg.addColorStop(0, '#9ab08a'); mg.addColorStop(0.7, '#6a8460'); mg.addColorStop(1, '#4a6244');
        g.fillStyle = mg; g.beginPath(); g.arc(0, 0, R * 0.92, 0, TAU); g.fill();
        g.lineWidth = 1.6 * S; g.lineCap = 'round';
        for (let i = 0; i < 520 * (low ? 0.5 : 1); i++) {
          const a = r() * TAU, d = Math.pow(r(), 0.7) * R * 0.95, l = (5 + r() * 7) * S, lit = (Math.cos(a - 3.9) * d / R + 1) * 0.5;
          g.strokeStyle = lit > 0.6 ? 'rgba(170,190,150,0.8)' : lit > 0.35 ? 'rgba(120,145,105,0.8)' : 'rgba(70,92,64,0.85)';
          const la = a + (r() - 0.5) * 1.2; g.beginPath(); g.moveTo(Math.cos(a) * d, Math.sin(a) * d); g.lineTo(Math.cos(a) * d + Math.cos(la) * l, Math.sin(a) * d + Math.sin(la) * l); g.stroke();
        }
        const cols = ['#6a4aa8', '#7a5ab8', '#8e6ccc', '#a58ad8', '#b9a0e6', '#c8b4ee'];
        for (let i = 0; i < 90; i++) {   // flower spikes rising out of the mound
          const a2 = r() * TAU, d1 = R * Math.pow(r(), 0.5) * 1.05, cx = Math.cos(a2) * d1, cy = Math.sin(a2) * d1, sa = a2 + (r() - 0.5) * 0.6, sl = (12 + r() * 10) * S;
          for (let k = 0; k < 6; k++) { const f = k / 5, bx = cx + Math.cos(sa) * sl * f, by = cy + Math.sin(sa) * sl * f; g.fillStyle = cols[k]; g.beginPath(); g.ellipse(bx, by, 2.3 * S * (1 - f * 0.3), 1.6 * S, sa, 0, TAU); g.fill(); }
        }
      });
    }
    function flower (kind, r, scale = 1) {
      const R = (16 + r() * 10) * S * scale;
      return sprite(R * 4.2, g => {
        for (let i = 0; i < 6; i++) {   // leaves underneath
          const a = i / 6 * TAU + r(), l = R * (1.3 + r() * 0.6); const lg = g.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l);
          lg.addColorStop(0, '#3e6a2a'); lg.addColorStop(1, '#6a9a40'); g.fillStyle = lg;
          g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a - 0.4) * l * 0.6, Math.sin(a - 0.4) * l * 0.6, Math.cos(a) * l, Math.sin(a) * l); g.quadraticCurveTo(Math.cos(a + 0.4) * l * 0.6, Math.sin(a + 0.4) * l * 0.6, 0, 0); g.fill();
        }
        const P = kind === 'cosmos' ? { n: 8, col: r() < 0.5 ? ['#f2a6c8', '#e070a8'] : ['#ffffff', '#f0e0f0'], w: 0.5, center: '#f0c030' }
          : kind === 'daisy' ? { n: 22, col: ['#ffffff', '#f2f0e8'], w: 0.17, center: '#f2b81a' }
          : kind === 'zinnia' ? { n: 14, col: r() < 0.5 ? ['#ff6a2a', '#e04010'] : ['#ff3a5a', '#c01a3a'], w: 0.34, center: '#7a3a10', layers: 2 }
          : { n: 13, col: ['#c86aa8', '#9a4a88'], w: 0.26, center: '#a8501a', cone: true };
        for (let layer = (P.layers || 1) - 1; layer >= 0; layer--) {
          const Rl = R * (1 - layer * 0.35);
          for (let i = 0; i < P.n; i++) {
            const pa = i / P.n * TAU + layer * 0.2 + r() * 0.08, pl = Rl * (0.95 + r() * 0.1);
            const pg = g.createLinearGradient(0, 0, Math.cos(pa) * pl, Math.sin(pa) * pl); pg.addColorStop(0, P.col[1]); pg.addColorStop(1, P.col[0]);
            g.fillStyle = pg; g.save(); g.rotate(pa); g.beginPath(); g.moveTo(Rl * 0.15, 0); g.quadraticCurveTo(pl * 0.55, -pl * P.w, pl, -pl * P.w * 0.3); g.quadraticCurveTo(pl * 1.05, 0, pl, pl * P.w * 0.3); g.quadraticCurveTo(pl * 0.55, pl * P.w, Rl * 0.15, 0); g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 0.8 * S; g.beginPath(); g.moveTo(Rl * 0.2, 0); g.lineTo(pl * 0.9, 0); g.stroke(); g.restore();
          }
        }
        const cr = R * (P.cone ? 0.42 : 0.28), cg = g.createRadialGradient(-cr * 0.3, -cr * 0.3, 0, 0, 0, cr);
        cg.addColorStop(0, '#fff2a0'); cg.addColorStop(0.3, P.center); cg.addColorStop(1, '#5a3a10'); g.fillStyle = cg; g.beginPath(); g.arc(0, 0, cr, 0, TAU); g.fill();
        g.fillStyle = 'rgba(80,40,10,0.5)'; for (let i = 0; i < 24; i++) { const da = r() * TAU, dd = Math.sqrt(r()) * cr * 0.85; g.beginPath(); g.arc(Math.cos(da) * dd, Math.sin(da) * dd, 0.9 * S, 0, TAU); g.fill(); }
      });
    }
    function makePlants () {
      const grown = plants.filter(p => p.grownByHand);   // flowers you grew stay
      plants = [];
      const r = seeded(9), area = W * H;
      const ok = (x, y, rad) => {
        if (Math.abs(y - pathY(x)) < 60 * S + rad * 0.6) return false;
        if (bath && Math.hypot(x - bath.x, y - bath.y) < bath.r + rad * 0.8) return false;
        return !plants.some(p => Math.hypot(p.x - x, p.y - y) < (p.rad + rad) * 0.75);
      };
      const nl = Math.round(area / (150000 * S * S) * (low ? 0.7 : 1));
      for (let i = 0, tries = 0; i < nl && tries < 400; tries++) { const x = r() * W, y = r() * H, sp = lavender(r), rad = sp.size * 0.36; if (ok(x, y, rad)) { plants.push({ x, y, sp, rad, ph: r() * TAU, kind: 'lavender', grow: 1 }); i++; } }
      const drifts = Math.round(clamp(area / (90000 * S * S), 5, 16) * (low ? 0.7 : 1));
      for (let dr = 0; dr < drifts; dr++) {
        const k = KINDS[dr % 4], dx = r() * W, dy = r() * H, cnt = 5 + Math.floor(r() * 7);
        for (let i = 0, tries = 0; i < cnt && tries < 80; tries++) {
          const fx = dx + (r() - 0.5) * 220 * S, fy = dy + (r() - 0.5) * 150 * S, fs = flower(k, r, 0.9 + r() * 0.4), fr = fs.size * 0.3;
          if (fx < 0 || fx > W || fy < 0 || fy > H) continue;
          if (ok(fx, fy, fr)) { plants.push({ x: fx, y: fy, sp: fs, rad: fr, ph: r() * TAU, kind: k, grow: 1, flower: true }); i++; }
        }
      }
      for (const p of grown) if (p.x <= W && p.y <= H) plants.push(p);
    }

    // ── butterflies ───────────────────────────────────────────────
    class Fly {
      constructor (name) {
        this.n = name; this.P = SPECIES[name]; this.s = (36 + rnd(-4, 5)) * this.P.size;
        this.x = rnd(0, W); this.y = rnd(0, H); this.z = rnd(30, 70) * S; this.vx = 0; this.vy = 0; this.a = rnd(0, TAU);
        this.state = 'fly'; this.timer = rnd(2, 6); this.target = null; this.flap = rnd(0, TAU); this.open = 1; this.seed = rnd(0, 100);
        this.scare = 0; this.fx = 0; this.fy = 0; this.onPointer = false;
      }
      pickFlower () {
        const fl = plants.filter(p => p.flower && p.grow > 0.8 && !p.taken);
        if (!fl.length) return null; const p = fl[Math.floor(Math.random() * fl.length)]; p.taken = this; return p;
      }
      letGo () { if (this.target && this.target.taken === this) this.target.taken = null; this.target = null; this.onPointer = false; }
      update (dt, t, i) {
        let tx = null, ty = null, sp = 120 * S;
        if (this.state === 'rest') {
          this.timer -= dt; this.z += (0 - this.z) * Math.min(1, dt * 6);
          this.open = 0.75 + 0.25 * Math.sin(t * 1.2 + this.seed);   // basking: wings opening and closing slowly
          if (this.onPointer) { if (!(pointer.in && pointer.still > 0.3)) this.timer = 0; else { this.x = pointer.x; this.y = pointer.y; } }
          if (this.timer <= 0 || this.scare > 0) { this.state = 'fly'; this.timer = rnd(3, 7); this.letGo(); this.vy = -60 * S; }
          return;
        }
        const synced = beat.level > 0.05 && beat.pulse > 0;
        this.flap = synced ? beat.phase * TAU * 2 : this.flap + dt * 70;
        this.open = Math.abs(Math.cos(this.flap * 0.5));
        if (this.state === 'fly') {
          this.timer -= dt;
          if (this.scare > 0) { this.scare -= dt; tx = this.x + this.fx * 400; ty = this.y + this.fy * 400; sp = 320 * S; }
          else if (pointer.in && pointer.still > 1.0 && i === nearest) { this.state = 'land'; this.onPointer = true; this.target = { x: pointer.x, y: pointer.y }; }
          else if (this.timer <= 0) { const f = this.pickFlower(); if (f) { this.state = 'land'; this.target = f; } else this.timer = 2; }
          else { tx = this.x + Math.cos(t * 0.7 + this.seed) * 200 + Math.sin(t * 1.9 + this.seed * 2) * 80; ty = this.y + Math.sin(t * 0.6 + this.seed * 3) * 200 + Math.cos(t * 1.7 + this.seed) * 80; }
          if (tx == null) { tx = this.target ? this.target.x : this.x; ty = this.target ? this.target.y : this.y; }
          // stay over the garden
          if (this.x < 40 * S || this.x > W - 40 * S) tx = W * 0.5;
          if (this.y < 40 * S || this.y > H - 40 * S) ty = H * 0.5;
          this.z += ((50 + 20 * Math.sin(t * 2 + this.seed)) * S - this.z) * Math.min(1, dt * 2);
        }
        if (this.state === 'land' && !this.onPointer && pointer.in && pointer.still > 1.0 && i === nearest) { this.letGo(); this.onPointer = true; this.target = { x: pointer.x, y: pointer.y }; }   // a hand held still wins over a flower
        if (this.state === 'land') {
          if (this.onPointer) { if (!(pointer.in && pointer.still > 0.3)) { this.state = 'fly'; this.letGo(); return; } this.target.x = pointer.x; this.target.y = pointer.y; }
          tx = this.target.x; ty = this.target.y; sp = 90 * S;
          const d = Math.hypot(tx - this.x, ty - this.y);
          this.z += ((d < 60 * S ? d * 0.4 : 40 * S) - this.z) * Math.min(1, dt * 3);
          if (d < 4 * S) { this.state = 'rest'; this.timer = rnd(4, 9); this.x = tx; this.y = ty; }
        }
        // a flutter: a wavering path towards where it is going
        const dx = tx - this.x, dy = ty - this.y, dd = Math.hypot(dx, dy) || 1;
        const wob = Math.sin(t * 7 + this.seed) * 0.9 + Math.sin(t * 13 + this.seed * 2) * 0.4;
        const want = Math.atan2(dy, dx) + (this.state === 'fly' ? wob * 0.6 : wob * 0.15);
        const sp2 = Math.min(sp, dd * 2.2 + 20 * S);
        this.vx += (Math.cos(want) * sp2 - this.vx) * Math.min(1, dt * 3) + breeze.x * dt * 0.5;
        this.vy += (Math.sin(want) * sp2 - this.vy) * Math.min(1, dt * 3) + breeze.y * dt * 0.5;
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (Math.hypot(this.vx, this.vy) > 10 * S) this.a += angDiff(this.a, Math.atan2(this.vy, this.vx) + Math.PI / 2) * Math.min(1, dt * 5);
      }
      draw (g, shadow) {
        const Wg = wings[this.n], k = this.s * S / Wg.U, open = clamp(this.open, 0.08, 1), z = this.z;
        g.save();
        if (shadow) { g.translate(this.x + z * SH.x, this.y + z * SH.y); g.globalAlpha = clamp(0.32 - z / (400 * S), 0.08, 0.32); }
        else g.translate(this.x, this.y);
        g.rotate(this.a); const lift = 1 + z / (300 * S); g.scale(k * lift, k * lift);
        const img = shadow ? Wg.shadow : Wg.c;
        // the right wings, then the left mirrored, the body down the middle
        g.save(); g.scale(open, 1); g.drawImage(img, -8, -Wg.size); g.restore();
        g.save(); g.scale(-open, 1); g.drawImage(img, -8, -Wg.size); g.restore();
        if (!shadow) {
          g.fillStyle = '#1a140e'; g.beginPath(); g.ellipse(0, 10, 3.2, 26, 0, 0, TAU); g.fill();
          g.fillStyle = '#2a2018'; g.beginPath(); g.ellipse(0, -16, 4.5, 8, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -26, 4, 0, TAU); g.fill();
          g.strokeStyle = '#1a140e'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-1.5, -29); g.quadraticCurveTo(-8, -44, -13, -52); g.moveTo(1.5, -29); g.quadraticCurveTo(8, -44, 13, -52); g.stroke();
          g.beginPath(); g.arc(-13, -52, 2, 0, TAU); g.arc(13, -52, 2, 0, TAU); g.fillStyle = '#1a140e'; g.fill();
        }
        g.restore();
      }
    }
    function makeFliers () {
      const n = Math.round(clamp(W * H / 140000, 5, 10) * (low ? 0.7 : 1));
      fliers = []; for (let i = 0; i < n; i++) fliers.push(new Fly(ORDER[i % ORDER.length]));
    }
    function scareFrom (x, y, radius, force) {
      for (const f of fliers) { const d = Math.hypot(f.x - x, f.y - y); if (d < radius) { f.scare = force; f.fx = (f.x - x) / (d + 1); f.fy = (f.y - y) / (d + 1); if (f.state === 'rest') f.timer = 0; } }
    }

    // ── every frame ───────────────────────────────────────────────
    function frame (dt0, t0) {
      const dt = dt0 * speed, t = (clock += dt), g = ctx;
      pointer.still = pointer.speed < 200 * S ? Math.min(3, pointer.still + dt) : 0; pointer.speed *= Math.pow(0.002, dt);
      // the music: a beat sets the wings' phase and pulses the flowers
      if (beat.armed && beat.level > 0.55 && t - beat.lastHit > 0.25) { beat.armed = false; beat.lastHit = t; beat.pulse = 1; beat.phase = 0; }
      else if (beat.level < 0.35) beat.armed = true;
      beat.phase = (beat.phase + dt * 2) % 1;
      beat.pulse = Math.max(0, beat.pulse - dt * 2.4);
      breeze.x = opts.breeze ? 40 * S * (0.6 + 0.4 * Math.sin(t * 0.3)) : 0; breeze.y = opts.breeze ? 14 * S * Math.sin(t * 0.21) : 0;
      nearest = -1;
      if (pointer.in && !fliers.some(f => f.onPointer)) { let best = 1e9; fliers.forEach((f, i) => { const d = Math.hypot(f.x - pointer.x, f.y - pointer.y); if (d < best && f.state !== 'rest') { best = d; nearest = i; } }); }
      fliers.forEach((f, i) => f.update(dt, t, i));
      for (const p of plants) if (p.grow < 1) p.grow = Math.min(1, p.grow + dt * 0.8);
      puffs = puffs.filter(p => { p.r += dt * 260 * S; p.life -= dt * 1.4; return p.life > 0; });

      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(groundL, 0, 0, W * DPR, H * DPR);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      // the birdbath's water moves a little
      if (bath) {
        g.save(); g.beginPath(); g.arc(bath.x, bath.y, bath.r * 0.78, 0, TAU); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5 * S;
        for (let k = 0; k < 3; k++) { const rr = ((t * 14 * S + k * bath.r * 0.3) % (bath.r * 0.9)); g.globalAlpha = 1 - rr / (bath.r * 0.9); g.beginPath(); g.arc(bath.x + 8 * S, bath.y - 6 * S, rr, 0, TAU); g.stroke(); }
        g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(bath.x - bath.r * 0.35, bath.y - bath.r * 0.35, bath.r * 0.18, bath.r * 0.08, -0.7, 0, TAU); g.fill(); g.restore();
      }
      // plants: a shadow, then the plant, swaying in the breeze and to the beat
      for (const p of plants) {
        const sway = opts.breeze ? Math.sin(t * 1.3 + p.ph) * 0.04 + Math.sin(t * 0.5 + p.x * 0.01) * 0.03 : 0, gs = p.grow, sz = p.sp.size * gs * (1 + beat.pulse * 0.04 * (p.flower ? 1 : 0.4));
        g.save(); g.translate(p.x + 9 * S * gs, p.y + 12 * S * gs); g.rotate(sway); g.globalAlpha = 0.3;
        g.fillStyle = 'rgba(20,12,4,1)'; g.beginPath(); g.arc(0, 0, p.rad * 0.9 * gs, 0, TAU); g.fill(); g.restore();
        g.save(); g.translate(p.x + (opts.breeze ? Math.sin(t * 1.1 + p.ph) * 2 * S : 0), p.y); g.rotate(sway); g.drawImage(p.sp, -sz / 2, -sz / 2, sz, sz); g.restore();
      }
      // butterflies: their shadows on the ground first, then the butterflies
      for (const f of fliers) f.draw(g, true);
      g.globalAlpha = 1;
      for (const f of fliers) f.draw(g, false);
      // dappled shade drifting over everything
      if (!low) {
        if (!dapPat) dapPat = g.createPattern(dapple, 'repeat');
        g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.scale(2.2 * S, 2.2 * S);
        g.translate((t * (opts.breeze ? 6 : 2)) % 512, (t * (opts.breeze ? 3 : 1)) % 512); g.fillStyle = dapPat; g.fillRect(-512, -512, W / (2.2 * S) + 1024, H / (2.2 * S) + 1024); g.restore();
      }
      for (const p of puffs) { g.strokeStyle = `rgba(255,255,240,${(0.3 * p.life).toFixed(3)})`; g.lineWidth = 3 * S; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke(); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(vign, 0, 0, W * DPR, H * DPR);
    }

    // first start: everything for this size
    for (const name of Object.keys(SPECIES)) wings[name] = makeWings(name);
    buildGround(); makePlants(); makeFliers();

    return {
      frame,
      resize (w, h, dpr) {
        const sx = w / Math.max(1, W), sy = h / Math.max(1, H);
        for (const f of fliers) { f.x *= sx; f.y *= sy; f.letGo(); f.state = 'fly'; }
        for (const p of plants) { p.x *= sx; p.y *= sy; }
        W = w; H = h; DPR = dpr; S = scaleFor(W, H);
        // the bed drawn again once the size settles; stretched until then
        clearTimeout(rebuildT); rebuildT = setTimeout(() => { buildGround(); makePlants(); }, 220);
      },
      pointer (kind, x, y) {
        if (kind === 'leave') { pointer.in = false; return; }
        const now = performance.now(), dtp = Math.max(1, now - (pointer.lt || now - 16)) / 1000;
        pointer.speed = pointer.in && kind === 'move' ? Math.hypot(x - pointer.x, y - pointer.y) / dtp : 0;
        pointer.x = x; pointer.y = y; pointer.in = true; pointer.lt = now;
        clearTimeout(pointer.outT);
        if (kind === 'up') pointer.outT = setTimeout(() => { pointer.in = false; }, 1500);
        if (kind === 'move' && pointer.speed > 1200 * S) scareFrom(x, y, 150 * S, 1);   // a quick sweep scares them
        if (kind === 'down') {
          pointer.still = 0;
          if (opts.tap === 'gust') { puffs.push({ x, y, r: 6, life: 1 }); scareFrom(x, y, 300 * S, 1.2); }
          else {
            const k = KINDS[Math.floor(Math.random() * 4)], sp = flower(k, seeded(Math.floor(Math.random() * 1e6)), 1.1);
            plants.push({ x, y, sp, rad: sp.size * 0.3, ph: rnd(0, TAU), kind: k, grow: 0.01, flower: true, grownByHand: true });
            if (plants.length > 140) { const i = plants.findIndex(p => p.flower && !p.taken); if (i >= 0) plants.splice(i, 1); }
          }
        }
      },
      beat (level) { beat.level = level; },
      set (key, value) {
        if (key === 'tap' && TAPS.some(([k]) => k === value)) opts.tap = value;
        if (key === 'breeze') opts.breeze = !!value;
      },
      stop () { clearTimeout(rebuildT); clearTimeout(pointer.outT); free(groundL, vign, dapple); groundL = dapple = dapPat = vign = null; plants = []; fliers = []; },
    };
  },
};
