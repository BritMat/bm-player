/**
 * Aurora Lake (v3.48.0): a mountain lake under the northern lights, the sky
 * held in still water. A scene for the scene kit (runner.js says what a scene
 * gives), chosen on Home with the scene picker.
 *
 *   - curtains of rays that wave and drift, green, violet or both
 *   - snowy ranges lit on one face, spruce along the shores, the near shores
 *     dark in the corners
 *   - the lake: the sky turned over, row by row, moved by small waves, with
 *     glints of the aurora on them
 *   - tap the sky for a new star, tap the lake for ripples; the aurora leans
 *     towards the pointer over the sky
 *   - shooting stars now and then, and the lights sway with the music
 *
 * Options (runner.run(def, opts), runner.set): colour 'green' | 'violet' |
 * 'both', shoot true | false. The sky, the land and the shores are drawn once
 * for a size, and again a moment after the window stops changing size: in
 * between the old ones are stretched to fit. The land is worked out a pixel
 * at a time, in as many pixels as the quality tier allows (a big window's at
 * a lower resolution, then scaled up).
 */
import { TAU, rnd, clamp, canvas, seeded, noise, fbm, TIER } from './kit.js';

const PAL = {
  green: [[120, 255, 170], [60, 230, 140], [90, 120, 255], [150, 80, 220]],
  violet: [[255, 130, 230], [200, 90, 255], [120, 90, 255], [80, 60, 200]],
  both: [[110, 255, 170], [70, 230, 160], [235, 90, 220], [170, 70, 230]],
};
export const COLOURS = [['green', 'Green'], ['violet', 'Violet'], ['both', 'Both']];

// A ridge's spruce, drawn with strokes: a stem and tiers of drooping branches.
function spruce (g, x, base, h, col, r) {
  const w = h * 0.24;
  g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
  g.lineWidth = Math.max(1, h * 0.03); g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - h); g.stroke();
  const tiers = Math.max(6, Math.round(h / 3.2));
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, y = base - h * (0.06 + 0.94 * t), bw = w * (1 - t) * (0.75 + r() * 0.5) + h * 0.02;
    g.lineWidth = Math.max(0.8, h * 0.028);
    g.beginPath(); g.moveTo(x, y - h * 0.02); g.lineTo(x - bw, y + h * 0.03 * (1 - t)); g.moveTo(x, y - h * 0.02); g.lineTo(x + bw, y + h * 0.03 * (1 - t)); g.stroke();
  }
  g.beginPath(); g.moveTo(x - w * 0.18, base - h * 0.85); g.lineTo(x, base - h * 1.05); g.lineTo(x + w * 0.18, base - h * 0.85); g.fill();
}

export default {
  id: 'aurora',
  name: 'Aurora Lake',
  // A soft picture: one and a half pixels to a CSS pixel at most, and 40
  // frames a second (its curtains and waves move slowly).
  maxDpr: 1.5,
  fps: 40,
  start (host) {
    const { ctx } = host;
    const q = TIER[host.tier] || 1, low = q < 0.75;
    const opts = { colour: 'green', shoot: true, ...(host.opts || {}) };
    const speed = host.reduced ? 0.5 : 1;
    // the size the layers were drawn for (B), and the view's now (W, H)
    let W = host.w, H = host.h, DPR = host.dpr, BW = 0, BH = 0, BDPR = 1, S = 1, HZ = 0, rebuildT = 0;
    let skyL = null, landL = null, landTint = null, landTintC = null, fgL = null, starSprite = null, half = null, halfG = null, aur = null, aurG = null, strip = null;
    let bright = [];

    function buildSky () {
      skyL = canvas(BW * BDPR, HZ * BDPR + 2); const g = skyL.getContext('2d'); g.scale(BDPR, BDPR);
      let gr = g.createLinearGradient(0, 0, 0, HZ);
      gr.addColorStop(0, '#01030a'); gr.addColorStop(0.45, '#030a18'); gr.addColorStop(0.8, '#0a1a2c'); gr.addColorStop(1, '#13283a');
      g.fillStyle = gr; g.fillRect(0, 0, BW, HZ + 1);
      const r = seeded(11);
      // the Milky Way: a hazy band of light with dark lanes of dust, corner to corner
      const ax = -BW * 0.05, ay = HZ * 0.95, bx = BW * 1.05, by = -HZ * 0.15, len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux;
      for (let i = 0; i < 260; i++) {
        const t = r(), off = (r() - 0.5) * (r() * 0.16) * len, x = ax + ux * len * t + nx * off, y = ay + uy * len * t + ny * off, rr = (20 + r() * 60) * S;
        const bg = g.createRadialGradient(x, y, 0, x, y, rr); bg.addColorStop(0, `rgba(170,186,220,${(0.018 + r() * 0.025).toFixed(3)})`); bg.addColorStop(1, 'rgba(170,186,220,0)');
        g.fillStyle = bg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      for (let i = 0; i < 70; i++) {
        const t = r(), off = (r() - 0.45) * 0.03 * len, x = ax + ux * len * t + nx * off, y = ay + uy * len * t + ny * off, rr = (10 + r() * 34) * S;
        const bg = g.createRadialGradient(x, y, 0, x, y, rr); bg.addColorStop(0, `rgba(2,5,12,${(0.25 + r() * 0.25).toFixed(3)})`); bg.addColorStop(1, 'rgba(2,5,12,0)');
        g.fillStyle = bg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      // stars: mostly faint, a few bright, thicker along the band
      const n = Math.round(BW * HZ / 330 * Math.min(1, 0.6 + q * 0.4)), most = Math.round(220 * Math.min(1, q));
      bright = [];
      for (let i = 0; i < n; i++) {
        let x, y;
        if (r() < 0.4) { const t = r(), off = (r() - 0.5) * (r() * 0.2) * len; x = ax + ux * len * t + nx * off; y = ay + uy * len * t + ny * off; }
        else { x = r() * BW; y = Math.pow(r(), 1.15) * HZ; }
        if (y < 0 || y > HZ - 4 || x < 0 || x > BW) continue;
        const m = Math.pow(r(), 5.5), sz = (0.35 + m * 1.6) * Math.max(0.8, S), hue = r();
        const col = hue < 0.2 ? '255,214,180' : hue < 0.55 ? '255,248,240' : '200,220,255';
        if (m > 0.35 && bright.length < most) { bright.push({ x, y, s: sz, c: col, ph: r() * TAU, f: 1 + r() * 3 }); continue; }
        g.fillStyle = `rgba(${col},${(0.25 + m * 0.75).toFixed(2)})`; g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill();
      }
      // air glow just above the horizon
      gr = g.createLinearGradient(0, HZ * 0.72, 0, HZ);
      gr.addColorStop(0, 'rgba(40,90,90,0)'); gr.addColorStop(1, 'rgba(40,96,92,0.22)');
      g.fillStyle = gr; g.fillRect(0, HZ * 0.72, BW, HZ * 0.28);
    }

    function buildLand () {
      // The ranges as peaks, each with a lit face to the left of its ridge and a
      // shaded face to the right, snow in the gullies, worked out a pixel at a
      // time: at LQ pixels to a CSS pixel, then scaled up. A phone's is worked
      // out whole; a big window's in fewer pixels, so it is ready in a moment.
      const budget = low ? 350000 : q > 1.25 ? 1200000 : 700000;
      const LQ = clamp(Math.sqrt(budget / Math.max(1, BW * HZ)), 0.4, 1);
      const mw = Math.max(1, Math.ceil(BW * LQ)), mh = Math.ceil(HZ * LQ) + 2, mc = canvas(mw, mh), mg = mc.getContext('2d'), img = mg.createImageData(mw, mh), D = img.data;
      const ranges = [
        { seed: 5, majors: 5, top: 0.4, low: 0.66, w: [0.2, 0.34], subs: 2, snowLit: [176, 192, 208], snowDark: [92, 110, 136], rockLit: [70, 82, 96], rockDark: [30, 40, 54], haze: [38, 62, 78], hz: 0.55, snow: 0.6, det: 1.0 },
        { seed: 12, majors: 6, top: 0.6, low: 0.78, w: [0.18, 0.28], subs: 1, snowLit: [150, 166, 182], snowDark: [62, 78, 98], rockLit: [44, 54, 66], rockDark: [14, 20, 30], haze: [24, 42, 54], hz: 0.3, snow: 0.35, det: 1.5 },
      ];
      for (const rg of ranges) {
        const r = seeded(rg.seed), peaks = [], span = Math.max(BW, BH * 1.15), majors = Math.max(3, Math.round(rg.majors * BW / span));
        // a few big peaks, higher towards the sides so the lake looks out through a gap, each with smaller shoulders
        for (let i = 0; i < majors; i++) {
          const u = (i + 0.2 + r() * 0.6) / majors, mid = 1 - Math.abs(u - 0.5) * 2;
          const top = HZ * (rg.top + (rg.low - rg.top) * (Math.pow(mid, 1.4) * 0.8 + r() * 0.25));
          const wd = span * (rg.w[0] + r() * (rg.w[1] - rg.w[0]));
          const pk = { x: u * BW, y: Math.min(top, HZ * 0.95), lw: wd * (0.4 + r() * 0.25), rw: wd * (0.4 + r() * 0.25), lean: (r() - 0.5) * 0.4, seed: r() * 100 };
          peaks.push(pk);
          for (let k = 0; k < rg.subs; k++) {
            const sd = r() < 0.5 ? -1 : 1, off = (0.25 + r() * 0.35) * (sd < 0 ? pk.lw : pk.rw);
            peaks.push({ x: pk.x + sd * off, y: pk.y + (HZ - pk.y) * (0.18 + r() * 0.22), lw: pk.lw * (0.45 + r() * 0.2), rw: pk.rw * (0.45 + r() * 0.2), lean: (r() - 0.5) * 0.5, seed: r() * 100 });
          }
        }
        const prof = (pk, x) => {
          const d = x < pk.x ? (pk.x - x) / pk.lw : (x - pk.x) / pk.rw;
          const jag = (noise(x * 0.05 + pk.seed) - 0.5) * 0.09 + (noise(x * 0.22 + pk.seed * 3) - 0.5) * 0.03;
          return pk.y + (HZ - pk.y) * (Math.pow(d, 1.2) * 0.7 + jag * Math.min(1, d * 2.5));
        };
        const Y = new Float32Array(mw), P = new Float32Array(peaks.length * mw);
        for (let X = 0; X < mw; X++) {
          const x = X / LQ; let best = 1e9;
          for (let i = 0; i < peaks.length; i++) { const py = prof(peaks[i], x); P[i * mw + X] = py; if (py < best) best = py; }
          Y[X] = best;
        }
        for (let X = 0; X < mw; X++) {
          const x = X / LQ, yr = Y[X];
          for (let Yp = Math.max(0, Math.floor(yr * LQ)); Yp < mh; Yp++) {
            const y = Yp / LQ;
            // the peak this point belongs to: the one it sits most squarely inside, so valleys run down in a V
            let bi = -1, bs = 1e9;
            for (let i = 0; i < peaks.length; i++) {
              if (P[i * mw + X] > y + 0.5) continue;
              const pq = peaks[i], dd = Math.max(1, y - pq.y), wdt = (x < pq.x ? pq.lw : pq.rw) * Math.pow(dd / (HZ - pq.y), 0.85) + 1;
              const sc = Math.abs(x - pq.x - dd * pq.lean) / wdt - (HZ - pq.y) / HZ * 0.35;
              if (sc < bs) { bs = sc; bi = i; }
            }
            if (bi < 0) continue;
            const pk = peaks[bi], dep = y - pk.y, depN = clamp(dep / (HZ - pk.y), 0, 1);
            const ridgeX = pk.x + dep * pk.lean + (noise(y * 0.05 + pk.seed) - 0.5) * 14 * S * Math.min(1, depN * 4);
            const side = x < ridgeX ? 1 : 0, fallDir = side ? -0.7 : 0.7;
            const su = (x + dep * fallDir) * 0.035 * rg.det, sv = y * 0.008 * rg.det;
            const n1 = fbm(su, sv), n2 = fbm(su * 3.1 + 7, sv * 2.2 + 3);
            let cover = (1 - depN / rg.snow) * 1.15 + (n1 - 0.5) * 1.3 + (n2 - 0.5) * 0.6;
            cover = clamp((cover - 0.35) * 3, 0, 1);
            const shade = 0.8 + (n2 - 0.5) * 0.5;
            const sL = side ? rg.snowLit : rg.snowDark, rL = side ? rg.rockLit : rg.rockDark;
            const hz2 = clamp(rg.hz * (0.2 + depN * 1.1), 0, 0.92);
            const j = (Yp * mw + X) * 4, edge = clamp((y - yr) * LQ + 0.5, 0, 1);
            for (let c = 0; c < 3; c++) {
              let v = (rL[c] + (sL[c] - rL[c]) * cover) * shade;
              v = v * (1 - hz2) + rg.haze[c] * hz2;
              D[j + c] = v * edge + D[j + c] * (1 - edge) * (D[j + 3] / 255);
            }
            D[j + 3] = Math.max(D[j + 3], 255 * edge);
          }
        }
      }
      mg.putImageData(img, 0, 0);
      landL = canvas(BW * BDPR, HZ * BDPR + 2); let g = landL.getContext('2d');
      g.imageSmoothingQuality = 'high'; g.drawImage(mc, 0, 0, BW * BDPR, (mh / LQ) * BDPR); g.scale(BDPR, BDPR);
      // the aurora's light on the snow: the land's own shape, tinted later
      landTint = canvas(BW * 0.5, HZ * 0.5 + 1); landTint.getContext('2d').drawImage(mc, 0, 0, BW * 0.5, (mh / LQ) * 0.5);
      // the forest along both shores
      let r = seeded(21);
      for (let row = 0; row < 3; row++) {
        const col = ['rgb(10,18,24)', 'rgb(6,12,16)', 'rgb(3,7,10)'][row];
        for (let i = 0; i < 260; i++) {
          const x = r() * BW, c = Math.abs(x / BW - 0.5) * 2, keep = Math.pow(c, 1.6) * 1.4 - 0.05 + row * 0.05;
          if (r() > keep) continue;
          spruce(g, x, HZ + 1 - row * 0.5, (10 + r() * 22 + c * 30) * S * (0.7 + row * 0.25), col, r);
        }
      }
      // a low dark shore all along the waterline
      g.fillStyle = 'rgb(3,7,10)'; g.fillRect(0, HZ - 2, BW, 4);
      // the near shores, in the corners
      fgL = canvas(BW * BDPR, BH * BDPR); g = fgL.getContext('2d'); g.scale(BDPR, BDPR);
      r = seeded(33);
      g.fillStyle = 'rgb(2,4,7)';
      for (const [x0, d] of [[0, 1], [BW, -1]]) {
        const w = BW * 0.2, y0 = BH * 0.86;
        g.beginPath(); g.moveTo(x0, BH); g.lineTo(x0, y0);
        for (let k = 0; k <= 10; k++) g.lineTo(x0 + d * w * k / 10, y0 + Math.pow(k / 10, 1.8) * (BH - y0) + (r() - 0.5) * 6 * S);
        g.closePath(); g.fill();
        for (let k = 0; k < 7; k++) spruce(g, x0 + d * r() * w * 0.55, y0 + 4 * S + r() * BH * 0.04, (60 + r() * 120) * S, 'rgb(2,4,7)', r);
        // rocks at the water's edge
        for (let k = 0; k < 6; k++) { const rx = x0 + d * (w * 0.5 + r() * w * 0.6), ry = BH * 0.95 + r() * BH * 0.04, rr = (10 + r() * 26) * S; g.beginPath(); g.ellipse(rx, ry, rr, rr * 0.5, 0, Math.PI, TAU); g.fill(); }
      }
      // sprites
      const nn = 64; starSprite = canvas(nn, nn); g = starSprite.getContext('2d');
      const sg = g.createRadialGradient(nn / 2, nn / 2, 0, nn / 2, nn / 2, nn / 2);
      sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(0.12, 'rgba(255,255,255,0.8)'); sg.addColorStop(0.3, 'rgba(200,220,255,0.18)'); sg.addColorStop(1, 'rgba(200,220,255,0)');
      g.fillStyle = sg; g.fillRect(0, 0, nn, nn);
      half = canvas(BW * 0.5, HZ * 0.5 + 1); halfG = half.getContext('2d');
      aur = canvas(BW * 0.5, HZ * 0.5 + 1); aurG = aur.getContext('2d');
    }

    // one column of the curtain: bright at its lower edge, fading up into another colour
    function makeStrip () {
      const P = PAL[opts.colour] || PAL.green, n = 256;
      strip = canvas(2, n); const g = strip.getContext('2d'), gr = g.createLinearGradient(0, n, 0, 0);
      gr.addColorStop(0, `rgba(${P[0]},0)`); gr.addColorStop(0.02, `rgba(${P[0]},0.95)`); gr.addColorStop(0.12, `rgba(${P[1]},0.75)`);
      gr.addColorStop(0.45, `rgba(${P[1]},0.32)`); gr.addColorStop(0.72, `rgba(${P[2]},0.16)`); gr.addColorStop(1, `rgba(${P[3]},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 2, n);
      if (landTint) {
        landTintC = canvas(landTint.width, landTint.height); const tg = landTintC.getContext('2d');
        tg.drawImage(landTint, 0, 0); tg.globalCompositeOperation = 'multiply'; tg.fillStyle = `rgb(${P[1]})`; tg.fillRect(0, 0, landTintC.width, landTintC.height);
        tg.globalCompositeOperation = 'destination-in'; tg.drawImage(landTint, 0, 0);
      }
    }

    function build () {
      clearTimeout(rebuildT); rebuildT = 0;
      const sx = BW ? W / BW : 1, sy = BH ? H / BH : 1;
      BW = W; BH = H; BDPR = DPR;
      S = clamp(Math.min(BW, BH) / 900, 0.55, 1.6);
      HZ = Math.round(BH * (BH > BW ? 0.56 : 0.6));
      buildSky(); buildLand(); makeStrip();
      for (const s of mine) { s.x *= sx; s.y *= sy; }
    }

    /* ── the aurora: curtains of rays that wave and drift ──────────── */
    const curtains = [
      { y: 0.5, amp: 0.1, k: 1.4, sp: 0.05, h: 0.5, a: 1.0, seed: 3, ray: 70 },
      { y: 0.3, amp: 0.07, k: 2.3, sp: -0.04, h: 0.26, a: 0.55, seed: 17, ray: 96 },
    ];
    const col = low ? 2 : 1;
    function drawAurora (t, energy) {
      const g = aurG, w = aur.width;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, aur.height);
      g.globalCompositeOperation = 'lighter';
      const pull = pointer.in && pointer.y < HZ ? 1 : 0, sway = 1 + beat.pulse * 0.35;
      for (const c of curtains) {
        for (let x = 0; x < w; x += col) {
          const u = x / w;
          let yb = c.y + c.amp * sway * Math.sin(u * TAU * c.k * 0.5 + t * c.sp * 6 + c.seed) + c.amp * 0.5 * Math.sin(u * TAU * c.k * 1.3 - t * c.sp * 9 + c.seed * 2);
          yb += (noise(u * 6 + t * 0.05 + c.seed) - 0.5) * c.amp * 0.8;
          if (pull) { const dx = (u * BW - pointer.x) / (BW * 0.18); yb += Math.exp(-dx * dx) * (pointer.y / HZ - yb) * 0.25; }
          const body = noise(u * 3.2 - t * 0.04 + c.seed) * 0.7 + noise(u * 9 + t * 0.07 + c.seed * 3) * 0.3;
          const rays = Math.pow(noise(u * c.ray + t * c.sp * 4 + c.seed * 5), 3) * 1.6;
          const env = clamp((noise(u * 1.6 + t * 0.012 + c.seed * 11) - 0.12) * 2.4, 0, 1) * (0.55 + 0.45 * Math.cos((u - 0.5) * Math.PI * 0.9));
          const inten = c.a * energy * env * clamp(body * body * 1.8 + rays * body, 0, 1.4);
          if (inten < 0.02) continue;
          const hh = c.h * HZ * 0.5 * (0.55 + 0.6 * noise(u * 5 + t * 0.03 + c.seed * 7)), y0 = yb * HZ * 0.5;
          g.globalAlpha = clamp(inten, 0, 1);
          g.drawImage(strip, x, y0 - hh, col * 2, hh * 1.04);   // each pixel under two columns, whatever the step
        }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }

    /* ── stars you light, shooting stars, ripples ─────────────────── */
    let mine = [], meteors = [], ripples = [], meteorT = 4;
    const pointer = { x: 0, y: 0, in: false };
    const beat = { level: 0, pulse: 0 };
    let clock = 0;
    function drawStars (g, t, sc) {
      // the brightest stars twinkle, more near the horizon
      g.globalCompositeOperation = 'lighter';
      for (const s of bright) {
        const lo = s.y / HZ, tw = 0.6 + 0.4 * Math.sin(t * s.f * (1 + lo * 2) + s.ph) * (0.4 + lo * 0.6) + beat.pulse * 0.3;
        const r = s.s * 3.2 * tw * sc; g.globalAlpha = clamp(0.5 + tw * 0.5, 0, 1);
        g.drawImage(starSprite, s.x * sc - r, s.y * sc - r, r * 2, r * 2);
      }
      for (const s of mine) {
        const age = Math.max(0, t - s.born), grow = Math.min(1, 0.05 + age / 0.6), r = s.r * sc * (1 + Math.max(0, 1 - age) * 2.5) * grow;
        const tw = 0.8 + 0.2 * Math.sin(t * 3 + s.ph) + beat.pulse * 0.3;
        g.globalAlpha = clamp(tw * s.life, 0, 1);
        g.drawImage(starSprite, s.x * sc - r * 2.2, s.y * sc - r * 2.2, r * 4.4, r * 4.4);
        // the four points of a bright star
        g.strokeStyle = `rgba(220,235,255,${(0.55 * tw * s.life).toFixed(3)})`; g.lineWidth = Math.max(0.5, 0.8 * sc);
        const sp = r * 4 * (1 + Math.max(0, 0.8 - age) * 3);
        g.beginPath(); g.moveTo(s.x * sc - sp, s.y * sc); g.lineTo(s.x * sc + sp, s.y * sc); g.moveTo(s.x * sc, s.y * sc - sp); g.lineTo(s.x * sc, s.y * sc + sp); g.stroke();
        if (age < 1.2) { g.strokeStyle = `rgba(200,230,255,${(0.35 * (1 - age / 1.2)).toFixed(3)})`; g.lineWidth = 1.5 * sc; g.beginPath(); g.arc(s.x * sc, s.y * sc, age * 60 * S * sc, 0, TAU); g.stroke(); }
      }
      for (const m of meteors) {
        const tx = m.x - m.vx * 0.12, ty = m.y - m.vy * 0.12, a = Math.sin(Math.PI * m.life);
        const gr = g.createLinearGradient(m.x * sc, m.y * sc, tx * sc, ty * sc);
        gr.addColorStop(0, `rgba(255,255,255,${(0.9 * a).toFixed(3)})`); gr.addColorStop(1, 'rgba(180,220,255,0)');
        g.strokeStyle = gr; g.lineWidth = 1.6 * sc; g.lineCap = 'round'; g.globalAlpha = 1;
        g.beginPath(); g.moveTo(m.x * sc, m.y * sc); g.lineTo(tx * sc, ty * sc); g.stroke();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }

    const glints = Math.round(70 * Math.min(1, q)), rowH = low ? 3 : 2;
    function frame (dt) {
      if (!skyL) build();
      clock += dt * speed;
      const t = clock, g = ctx;
      // the music: a quick rise, a slow fall
      beat.pulse = Math.max(beat.pulse - dt * 1.8, beat.level);
      const energy = 0.85 + 0.15 * Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1) + beat.pulse * 0.45;
      if (opts.shoot) {
        meteorT -= dt;
        if (meteorT <= 0) {
          meteorT = rnd(5, 12);
          const a = rnd(0.35, 0.65) + (Math.random() < 0.5 ? 0 : Math.PI - 1.0), sp = rnd(700, 1100) * S;
          meteors.push({ x: rnd(BW * 0.1, BW * 0.9), y: rnd(HZ * 0.05, HZ * 0.45), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, dur: rnd(0.5, 0.9) });
        }
      }
      meteors = meteors.filter(m => { m.life += dt / m.dur; m.x += m.vx * dt; m.y += m.vy * dt; return m.life < 1; });
      if (mine.length > 40) mine[0].life -= dt * 0.5;
      mine = mine.filter(s => s.life > 0);
      ripples = ripples.filter(r => { r.r += dt * 70 * S; r.life -= dt / 3.2; return r.life > 0; });
      drawAurora(t, energy);

      // everything is drawn in the size the layers were made for, stretched to the view's
      const k = DPR * W / BW, ky = DPR * H / BH;
      g.setTransform(k, 0, 0, ky, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(skyL, 0, 0, BW, HZ + 2 / BDPR);
      g.globalCompositeOperation = 'lighter';
      // drawn three times a little apart: a soft blur across the rays (twice on Low)
      if (low) { g.globalAlpha = 0.8; g.drawImage(aur, -0.8, 0, BW, HZ + 1); g.globalAlpha = 0.55; g.drawImage(aur, -BW * 0.004, -HZ * 0.01, BW * 1.008, HZ * 1.03); }
      else {
        g.globalAlpha = 0.45; g.drawImage(aur, -1.6, 0, BW, HZ + 1); g.drawImage(aur, 1.6, 0, BW, HZ + 1); g.globalAlpha = 0.55; g.drawImage(aur, 0, 0, BW, HZ + 1);
        g.globalAlpha = 0.35; g.drawImage(aur, -BW * 0.004, -HZ * 0.01, BW * 1.008, HZ * 1.03);
      }
      g.globalAlpha = 1;
      // the aurora's light on the sky low down
      const P = (PAL[opts.colour] || PAL.green)[1];
      const gl = g.createLinearGradient(0, HZ * 0.55, 0, HZ);
      gl.addColorStop(0, `rgba(${P},0)`); gl.addColorStop(1, `rgba(${P},${(0.07 * energy).toFixed(3)})`);
      g.fillStyle = gl; g.fillRect(0, HZ * 0.55, BW, HZ * 0.45);
      g.globalCompositeOperation = 'source-over';
      drawStars(g, t, 1);
      g.drawImage(landL, 0, 0, BW, HZ + 2 / BDPR);
      // the aurora's light on the snow
      if (landTintC) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * energy; g.drawImage(landTintC, 0, 0, BW, HZ + 1); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }

      // the same sky, small, for the lake to hold
      const hs = half.width / BW;
      halfG.setTransform(1, 0, 0, 1, 0, 0); halfG.globalAlpha = 1; halfG.globalCompositeOperation = 'source-over';
      halfG.drawImage(skyL, 0, 0, half.width, half.height);
      halfG.globalCompositeOperation = 'lighter'; halfG.drawImage(aur, 0, 0, half.width, half.height); halfG.globalCompositeOperation = 'source-over';
      drawStars(halfG, t, hs);
      halfG.drawImage(landL, 0, 0, half.width, half.height);
      // the lake: rows of the sky turned over, moved by small waves
      const lake = BH - HZ;
      for (let y = 0; y < lake; y += rowH) {
        const d = y / lake, src = HZ - y - 1;
        if (src < 0) break;
        const amp = (0.6 + d * 9) * S;
        let off = Math.sin(y * 0.14 / (0.4 + d) - t * 1.6) * amp * 0.6 + Math.sin(y * 0.05 - t * 0.9 + 2) * amp * 0.5;
        for (const r of ripples) {
          const dy = (y + HZ - r.y) / (r.r * (0.18 + 0.35 * (r.y - HZ) / lake) + 1);
          if (Math.abs(dy) < 1.4) off += Math.sin(r.r * 0.12 - t * 6) * r.life * 10 * S * Math.exp(-dy * dy);
        }
        g.drawImage(half, 0, src * hs, half.width, Math.max(1, rowH * hs), off, HZ + y, BW, rowH + 0.6);
      }
      // water is darker than the sky it holds, and darkest close by
      const wg = g.createLinearGradient(0, HZ, 0, BH);
      wg.addColorStop(0, 'rgba(2,10,18,0.3)'); wg.addColorStop(1, 'rgba(1,5,10,0.7)');
      g.fillStyle = wg; g.fillRect(0, HZ, BW, lake);
      // glints of the aurora on small waves
      g.globalCompositeOperation = 'lighter';
      const r2 = seeded(Math.floor(t * 3) + 1);
      for (let i = 0; i < glints; i++) {
        const gx = r2() * BW, gy = HZ + Math.pow(r2(), 1.4) * lake * 0.9, gw = (6 + r2() * 30) * S * (0.4 + (gy - HZ) / lake);
        g.fillStyle = `rgba(${P},${(0.05 + r2() * 0.1 * energy).toFixed(3)})`; g.fillRect(gx, gy, gw, 1);
      }
      // ripples made by a tap
      for (const r of ripples) {
        const persp = 0.18 + 0.35 * (r.y - HZ) / lake;
        g.strokeStyle = `rgba(190,230,240,${(0.22 * r.life).toFixed(3)})`; g.lineWidth = 1.4 * S;
        g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * persp, 0, 0, TAU); g.stroke();
        if (r.r > 20 * S) { g.strokeStyle = `rgba(190,230,240,${(0.12 * r.life).toFixed(3)})`; g.beginPath(); g.ellipse(r.x, r.y, r.r * 0.7, r.r * 0.7 * persp, 0, 0, TAU); g.stroke(); }
      }
      g.globalCompositeOperation = 'source-over';
      // a thin bright line where the far shore meets the water
      g.fillStyle = `rgba(${P},${(0.05 * energy).toFixed(3)})`; g.fillRect(0, HZ, BW, 1.2);
      g.drawImage(fgL, 0, 0, BW, BH);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    // the view's point in the layers' own size
    const at = (x, y) => [x * BW / Math.max(1, W), y * BH / Math.max(1, H)];
    return {
      frame,
      resize (w, h, dpr) {
        W = w; H = h; DPR = dpr;
        // drawn again once the size settles; stretched until then
        clearTimeout(rebuildT); rebuildT = setTimeout(build, skyL ? 220 : 0);
      },
      pointer (kind, x, y) {
        const [px, py] = at(x, y);
        if (kind === 'leave') { pointer.in = false; return; }
        pointer.x = px; pointer.y = py; pointer.in = true;
        if (kind !== 'down') return;
        if (py < HZ - 4) mine.push({ x: px, y: py, r: rnd(2.2, 3.0) * Math.max(0.9, S), born: clock, ph: rnd(0, TAU), life: 1 });
        else { ripples.push({ x: px, y: py, r: 2, life: 1 }); setTimeout(() => ripples.push({ x: px, y: py, r: 2, life: 0.7 }), 260); }
      },
      beat (level) { beat.level = level; },
      set (key, value) {
        if (key === 'colour' && PAL[value]) { opts.colour = value; makeStrip(); }
        if (key === 'shoot') { opts.shoot = !!value; if (!value) meteors = []; }
      },
      stop () { clearTimeout(rebuildT); skyL = landL = landTint = landTintC = fgL = half = aur = strip = null; },
    };
  },
};
