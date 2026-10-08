/**
 * viz-art: the visualiser's artistic styles (v3.31.0), drawn in 2D on the
 * visualiser's own canvas.
 *
 *   Neon       lanterns wander the screen, moved by the music, and trail
 *              smoke in deep, pure colour that curls along a swirling flow.
 *              A beat makes them dash and throws sparks.
 *   Bubbles    glowing rings rise in drifting columns, as many and as large as
 *              the music is loud, bunch into clusters that light up where they
 *              overlap, and swell on the beat. A beat lets a cluster go.
 *   Particles  bursts from the centre fast enough to reach the edges, and
 *              sparks anywhere with the treble. It used to stay in a small
 *              patch in the middle, and drew every dot with a shadow blur.
 *
 * All three add their light together ('lighter'), so overlaps glow, and
 * none paints black, so the canvas stays see-through. Neon and Bubbles wipe
 * the canvas and draw afresh each frame. Particles fades what was drawn
 * before, which makes its tails. Drawing is grouped by colour and
 * brightness: a few dozen strokes a frame, not one per particle. Motion
 * goes by the clock.
 */

import { perf } from './perf.js';

const TAU = Math.PI * 2;

// Five parts of the sound, low to high, each 0 to 1.
export function bands(freq) {
  const n = freq.length, cut = [0, 0.08, 0.2, 0.4, 0.65, 1].map(c => Math.round(c * n));
  const out = [];
  for (let i = 0; i < 5; i++) {
    const a = cut[i], b = Math.max(a + 1, cut[i + 1]);
    // Average and peak together (v3.33.0): a narrow sound, a pure tone, made
    // only a small average over its part once the analyser grew finer.
    let s = 0, m = 0; for (let j = a; j < b; j++) { const x = freq[j] || 0; s += x; if (x > m) m = x; }
    out.push((s / (b - a) + m) / 2 / 255);
  }
  return out;
}

// The theme's accent as a hue, kept until the theme changes.
function accentHue() {
  const th = document.documentElement.getAttribute('data-theme');
  if (accentHue._th !== th) {
    accentHue._th = th; let h = 220;
    const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(c);
    if (m) {
      const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
      if (d) h = ((mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
    }
    accentHue._h = h;
  }
  return accentHue._h;
}

// A colour, [hue, saturation, lightness], for part i of n at loudness v, in
// the chosen colours. Fire gives orange flames and blue ones in turn.
export function tone(viz, i, n, v, set) {
  const pos = n > 1 ? i / (n - 1) : 0.5;
  switch (viz.opts.colors) {
    case 'fire':    return i % 2 ? [205 + v * 12, 95, 58 + v * 14] : [24 + v * 22, 100, 55 + v * 12];
    case 'ice':     return [185 + pos * 45, 90, 60 + v * 15];
    case 'theme':   return [accentHue() + (pos - 0.5) * 50, 85, 60 + v * 12];
    case 'rainbow': return [(pos * 300 + (viz._frames ? viz._frames() : (viz._tick || 0)) * 0.5) % 360, 95, 60];   // by the clock (v3.36.0), not by drawn frames
    case 'mono':    return [0, 0, 70 + v * 25];
    default:
      if (set === 'bubbles') return i % 2 ? [140, 90, 52 + v * 10] : [16, 100, 52 + v * 8];   // green and orange
      if (set === 'flow') return [[205, 258, 302, 346, 24][i % 5], 100, 55];                 // azure, violet, magenta, rose, orange: far enough apart to stay themselves
      return [[240, 268, 296, 326, 352][Math.round(pos * 4)] ?? 280, 100, 56 + v * 12];      // blue to red, through violet and pink: full saturation (v3.34.0)
  }
}
const hsla = ([h, s, l], a) => `hsla(${Math.round(h)},${s}%,${Math.round(Math.min(92, l))}%,${a.toFixed(3)})`;

// Sprites (v3.32.0): a glowing ring or dot drawn once into a small canvas, then
// copied each frame. Stroking hundreds of arcs with a wide glow, and two full-
// screen gradients, every frame, made Bubbles stutter on a real machine.
// Sizes and colours come in steps, so there are a few dozen sprites at most.
const SPRITES = new Map();
function sprite(key, size, paint) {
  let c = SPRITES.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = Math.max(2, Math.ceil(size));
    paint(c.getContext('2d'), c.width);
    SPRITES.set(key, c);
    if (SPRITES.size > 300) SPRITES.delete(SPRITES.keys().next().value);
  }
  return c;
}
const RB = [1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 9, 11, 13, 16, 19, 23];   // bubble radii, in CSS pixels
const nearestRB = r => { let k = 0; for (let i = 1; i < RB.length; i++) if (Math.abs(RB[i] - r) < Math.abs(RB[k] - r)) k = i; return k; };
const step = col => [Math.round(col[0] / 4) * 4, col[1], Math.round(col[2] / 6) * 6];
// A bubble (v3.37.0): a soft halo, a ring bright at its inner edge, a faint
// tint inside that is strongest at the rim, and a small highlight up and to
// the left. It was a thin line with hardly any glow: a wireframe circle. The
// tint inside is what makes a cluster light up, where bubbles overlap and add.
function ringSprite(col, rb, dpr) {
  const r = RB[rb] * dpr, big = RB[rb] > 7, mid = RB[rb] > 3.5, glow = (big ? 11 : mid ? 7 : 4) * dpr, n = Math.ceil((r + glow) * 2 + 2);
  return sprite(`ring|${col.join(',')}|${rb}|${dpr}`, n, (g, w) => {
    const c = w / 2, hot = [col[0], col[1], Math.min(90, col[2] + 26)];
    let gr = g.createRadialGradient(c, c, Math.max(0, r - glow * 0.35), c, c, r + glow);
    gr.addColorStop(0, hsla(col, 0)); gr.addColorStop(0.26, hsla(col, big ? 0.5 : mid ? 0.4 : 0.28)); gr.addColorStop(1, hsla(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, w, w);                                             // the halo, around the ring
    if (mid) {
      gr = g.createRadialGradient(c, c, 0, c, c, r);
      gr.addColorStop(0, hsla(col, 0.02)); gr.addColorStop(0.7, hsla(col, 0.06)); gr.addColorStop(1, hsla(col, big ? 0.2 : 0.13));
      g.fillStyle = gr; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();                  // the tint inside
    }
    g.lineWidth = (big ? 2.2 : mid ? 1.7 : 1.3) * dpr; g.strokeStyle = hsla(hot, big ? 1 : mid ? 0.92 : 0.8);
    g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke();                                    // the ring
    if (mid) {
      g.lineCap = 'round'; g.lineWidth = (big ? 1.6 : 1.1) * dpr; g.strokeStyle = 'rgba(255,255,255,' + (big ? 0.5 : 0.36) + ')';
      g.beginPath(); g.arc(c, c, r * 0.68, Math.PI * 1.12, Math.PI * 1.42); g.stroke();   // the highlight
    }
  });
}
function glowSprite(col) {
  return sprite(`glow|${col.join(',')}`, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, hsla(col, 1)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
// Neon (v3.34.0): a white-hot centre, a fully saturated ring, and a wide soft
// halo three times its size. Soft pastel dots read as dull, not as neon.
function dotSprite(col, r) {
  const n = Math.ceil(r * 6 + 2);
  return sprite(`dot|${col.join(',')}|${r}`, n, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.1, hsla([col[0], 100, 74], 1));
    gr.addColorStop(0.24, hsla([col[0], 100, 58], 0.7));
    gr.addColorStop(1, hsla([col[0], 100, 50], 0));
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

// Fade what is there (the trails), and draw what comes next as added light.
function fade(ctx, W, H, amount) {
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${amount.toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
}

// Clear away what the fade cannot (v3.36.0). A canvas keeps 256 levels, and a
// fade of 4% a frame rounds anything under 13 back to itself: it never
// leaves. Those leftovers stood as grey smudges where the trails had been,
// for ten seconds and more. Four times a second, every pixel is multiplied by
// sixteen times its own strength (at most by one): above a sixteenth, so
// anything that can be seen, is not touched, and what is fainter drops away in
// three or four goes. Worked out on a copy at half the size, which also
// averages each pixel with its neighbours, so a thin line's soft edge stays.
const TRIMS = new WeakMap();
function trim(ctx, W, H) {
  const w = Math.max(4, W >> 1), h = Math.max(4, H >> 1);
  let t = TRIMS.get(ctx);
  if (!t || t.c.width !== w || t.c.height !== h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    TRIMS.set(ctx, t = { c, g: c.getContext('2d') });
  }
  const g = t.g;
  g.globalCompositeOperation = 'copy'; g.drawImage(ctx.canvas, 0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) g.drawImage(t.c, 0, 0);       // doubled four times: sixteen times as strong
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in'; ctx.globalAlpha = 1;
  ctx.drawImage(t.c, 0, 0, W, H);
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
}

function frame(viz, key) {
  const { canvas } = viz, W = canvas.width, H = canvas.height, now = performance.now();
  const st = viz[key] || (viz[key] = { t: now, clean: now });
  const gap = now - st.t, dt = Math.min(0.05, Math.max(0.001, gap / 1000)); st.t = now;   // gap: the true time since the last frame, in ms
  // Repeated small fades leave faint traces (8-bit alpha rounds them to a
  // standstill): four times a second they are cleared away (trim).
  const clean = now - st.clean > 250; if (clean) st.clean = now;
  // Quiet: the waveform is flat (the music stopped or paused), and nothing new
  // is made. The spectrum would say so only slowly, as it fades.
  const quiet = (viz._loudness?.() ?? 1) < 0.01;
  return { ctx: viz.ctx, W, H, S: Math.min(W, H), dpr: W / (canvas.clientWidth || W) || 1, now, st, dt, gap, clean, quiet, lv: bands(viz._getFreq()) };
}

// A beat since this style last looked, as how hard it was (0.3 to 1), or 0 for
// none (v3.36.0). The visualiser follows the beat from the sound itself
// (viz-beat.js). Each style used to ask whether the bass's level was a quarter
// above its average, and on the analyser's scale it hardly ever is.
function beatSince(viz, st) {
  const b = viz.beat; if (!b) return 0;
  if (st.beatN === undefined) st.beatN = b.n;
  if (b.n === st.beatN) return 0;
  st.beatN = b.n; return b.strength || 1;
}

// ── NEON ──────────────────────────────────────────────────────────────────
/* Made again in v3.37.0. It was meant as smoke in pure colour, curling
   behind little lanterns, and it came out as grey hair. Why:
   - The colour was a light tint. Light added to light goes white, and a
     canvas that is faded and never wiped keeps what went over the top as
     grey: the smudges that stood where the smoke had been.
   - Every wisp was a dot that drew its own way across the picture, a little
     each frame. Hundreds of them leaving one lantern run side by side: a
     comb. What the eye follows in real smoke is another line: the one
     through everything that left the same place, in the order it left. That
     line is drawn now, afresh every frame, as one smooth curve from the
     lantern back to its oldest end. A lantern lets out several, and each
     sees the flow from a place a little to one side, so they leave as one
     line and part slowly into a ribbon of strands.
   - The wisps took their direction from an angle read off the place they
     were in. Such a field has lanes, and everything pours into them. The
     flow is now the curl of one smooth function, which has none: it turns
     in whirls, as a liquid does, and the lines wind up in them.
   - The lanterns and sparks were drawn into the same picture as the smoke,
     faded and never wiped: a moving lantern left a row of squares behind it,
     a spark a string of dots.
   Nothing is kept from one frame to the next but the points the lines go
   through: no fading, no clearing of leftovers, and at most some 1,600
   points where there were 3,000 wisps. A line is drawn up to three times:
   wide and faint in its pure colour for the glow, a tube of that colour,
   and a thin light middle. What a stroke costs goes by how many pieces it
   has far more than by how wide it is (measured at 1920x1080 without a
   graphics card: 14 ms for 2,500 pieces 4 pixels wide, 18 ms at 20 wide).
   So the oldest quarter of a line, which is faint, has no glow, and only
   the younger half has a middle.
   And it looks after itself, as the fluid and MilkDrop do: where frames
   stay slow (sixty in a row under about 37 a second, or under what the
   screen itself can show) it lets out fewer lines, 7, then 5, then 3 a
   lantern, and keeps to that for as long as the app runs (NEON.level). */
export const NEON = { lines: 7, rate: 12, life: 3.8, level: 0, most: [7, 5, 3] };
// The pure hue, which stays itself however much of it is added. Mono stays grey.
const pure = c => c[1] === 0 ? [0, 0, 60] : [c[0], 100, 50];

export function drawNeon(viz) {
  const { ctx, W, H, S, dpr, now, st, dt, gap, quiet, lv } = frame(viz, '_neon');
  const n = 5, T = now / 1000;
  if (!st.em) {
    st.em = Array.from({ length: n }, (_, i) => ({ x: W * (0.2 + i * 0.15), y: H * (0.35 + (i % 2) * 0.3), ph: Math.random() * 50,
      fx: 0.55 + Math.random() * 0.5, fy: 0.45 + Math.random() * 0.5, ox: Math.random() * TAU, oy: Math.random() * TAU, rot: 0, vx: 0, vy: 0, lv: 0, flash: 0 }));
    st.lines = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < NEON.lines; k++)
      st.lines.push({ e: i, k, sx: (Math.random() - 0.5) * 0.16, sy: (Math.random() - 0.5) * 0.16, pace: 0.8 + Math.random() * 0.4, due: Math.random(), on: false, until: 0, pts: [] });
    st.sparks = [];
  }
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  // Slow frames: fewer lines. A pause, or the first frames, say nothing.
  if (NEON.level < NEON.most.length - 1) {
    if (!(gap > 0 && gap < 250)) { st.slow = 0; st.ema = 0; }
    else if (st.skip === undefined || st.skip > 0) st.skip = (st.skip === undefined ? 30 : st.skip) - 1;
    else {
      st.ema = st.ema ? st.ema + (gap - st.ema) * 0.08 : gap;
      if (st.ema <= Math.max(27, (perf.refreshMs || 0) * 1.45 + 2)) st.slow = 0;
      else if ((st.slow = (st.slow || 0) + 1) >= 60) { NEON.level++; st.slow = 0; st.ema = 0; st.skip = 30; }
    }
  }
  const most = NEON.most[NEON.level];
  const hard = beatSince(viz, st), beat = quiet ? 0 : hard;
  // The flow: the curl of a smooth function of place and time, whirls of three
  // sizes, each lying at its own slant, drifting past one another. A place in
  // screen heights gives (u, v). With the function along the screen's own
  // axes the whirls stood in a grid, with straight lanes between them.
  const flow = (X, Y, out) => {
    const a = 1.9 * X + 1.1 * Y + 0.3 * T, b = 1.3 * Y - 0.9 * X - 0.25 * T;
    const cab = Math.cos(a) * Math.cos(b), sab = Math.sin(a) * Math.sin(b);
    const cc = Math.cos(3.7 * X - 2.9 * Y + 0.5 * T), sd = Math.sin(6.1 * X + 5.3 * Y - 0.8 * T), ce = Math.cos(5.2 * Y - 4.4 * X + 0.6 * T);
    out.u = 1.1 * cab - 1.3 * sab - 1.45 * cc - 1.59 * sd + 1.56 * ce;
    out.v = -(1.9 * cab + 0.9 * sab + 1.85 * cc - 1.83 * sd - 1.32 * ce);
  };
  st.em.forEach((e, i) => {
    const v = lv[i];
    e.lv += (v - e.lv) * Math.min(1, dt * 5);
    // Louder, it wanders faster, and on a beat it dashes: the low ones most.
    e.ph += dt * (0.12 + v * 0.75) + beat * (i < 2 ? 0.42 : 0.16);
    e.flash = Math.max(e.flash * Math.exp(-dt * 5), beat);
    const tx = W * (0.5 + 0.4 * Math.sin(e.ph * e.fx + e.ox) * Math.cos(e.ph * 0.31 + e.oy));
    const ty = H * (0.5 + 0.38 * Math.sin(e.ph * e.fy + e.oy + i));
    const k = Math.min(1, dt * 2.6);
    e.px = e.x; e.py = e.y; e.x += (tx - e.x) * k; e.y += (ty - e.y) * k;
    e.vx = (e.x - e.px) / dt; e.vy = (e.y - e.py) / dt; e.rot += dt * (0.5 + v * 2.5);
    if (beat && st.sparks.length < 400) for (let j = 0, m = Math.round(3 + beat * 9); j < m; j++) {   // more of them for a harder hit
      const a = Math.random() * TAU, sp = S * (0.2 + Math.random() * 0.45) * (0.6 + beat * 0.5);
      st.sparks.push({ e: i, x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
  });
  // The lines of smoke. Their points are carried by the flow, rising a little,
  // and the oldest go first. A lantern lets out more lines the louder its part
  // of the sound is, and all of them for a moment on a beat.
  const f = { u: 0, v: 0 }, sp = S * 0.066, ease = Math.min(1, dt * 2.4), age = dt / NEON.life;
  const groups = st.groups || (st.groups = Array.from({ length: n * 4 }, () => []));   // by lantern and by age, a quarter of a life each
  for (const g of groups) g.length = 0;
  for (const L of st.lines) {
    const e = st.em[L.e], pts = L.pts; let kept = 0, cut = false;
    for (let r = 0; r < pts.length; r++) {
      const p = pts[r];
      flow(p.x / S + L.sx, p.y / S + L.sy, f);
      p.vx += (f.u * sp * L.pace - p.vx) * ease; p.vy += (f.v * sp * L.pace - S * 0.012 - p.vy) * ease;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= age;
      if (p.life <= 0) { cut = cut || p.gap === true; continue; }       // gone, and if a stretch began with it, it begins with the next
      if (cut) { p.gap = true; cut = false; }
      pts[kept++] = p;
    }
    pts.length = kept;
    const many = quiet || e.lv < 0.04 ? 0 : Math.min(most, 1 + Math.round(Math.pow(e.lv, 1.3) * (NEON.lines - 1)) + (e.flash > 0.25 ? 3 : 0));
    // Once let out, a line runs on for a second, and once stopped it rests a
    // moment: a level hovering at a line's threshold made dashes of it.
    const run = L.k < many;
    if (run !== !!L.go && now >= L.until) { L.go = run; L.until = now + (run ? 1000 : 300); }
    if (quiet) L.go = false;
    // Where a line stops it thins out: its last few points are made older, or
    // it would end blunt and at its brightest.
    if (!L.go && L.on) for (let j = 1; j <= 4 && j <= pts.length; j++) pts[pts.length - j].life *= j * 0.2;
    if (L.go) {
      // A new point so many times a second, by the clock, at the place the
      // lantern was at that moment of this frame.
      const step = NEON.rate * dt; let d = L.due;
      while (d + step >= 1) {
        const w = Math.min(1, Math.max(0, (1 - d) / step)); d -= 1;
        pts.push({ x: e.px + (e.x - e.px) * w, y: e.py + (e.y - e.py) * w, vx: e.vx * 0.2, vy: e.vy * 0.2, life: 1, gap: !L.on });
        L.on = true; st.made = (st.made || 0) + 1;
      }
      L.due = d + step;
    } else L.on = false;
    // One smooth curve through the points (and on to the lantern, while this
    // line is still being let out), cut into its four ages. Each piece runs
    // from halfway to the point before to halfway to the one after, so the
    // pieces meet exactly and the whole has no corners.
    const m = pts.length + (L.on ? 1 : 0); if (m < 2) continue;
    const at = i => i < pts.length ? pts[i] : e;
    let pen = null;                                                // the group being drawn into, while the line runs on unbroken
    for (let i = 0; i < m; i++) {
      const p = at(i), first = i === 0 || p.gap === true, last = i === m - 1 || at(i + 1).gap === true;
      if (first && last) { pen = null; continue; }
      const g = groups[L.e * 4 + Math.max(0, Math.min(3, Math.floor((i < pts.length ? p.life : 1) * 4)))];
      let x0, y0;
      if (first) { x0 = p.x; y0 = p.y; } else { const q = at(i - 1); x0 = (q.x + p.x) / 2; y0 = (q.y + p.y) / 2; }
      if (pen !== g || first) g.push(NaN, x0, y0);                 // a new stroke starts here
      if (last) g.push(p.x, p.y, p.x, p.y); else { const q = at(i + 1); g.push(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2); }
      pen = last ? null : g;
    }
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const GLOW = [0, 0.13, 0.2, 0.3], TUBE = [0.24, 0.46, 0.66, 0.8], CORE = [0, 0, 0.8, 1];
  const WIDE = [16, 13, 10.5, 9], MID = [2.4, 3, 3.4, 3.8], THIN = [1, 1.2, 1.4, 1.6];
  for (let g = 0; g < groups.length; g++) {
    const d = groups[g]; if (!d.length) continue;
    const i = g >> 2, b = g & 3, col = pure(tone(viz, i, n, lv[i]));
    ctx.beginPath();
    for (let s = 0; s < d.length;) {
      if (d[s] !== d[s]) { ctx.moveTo(d[s + 1], d[s + 2]); s += 3; }
      ctx.quadraticCurveTo(d[s], d[s + 1], d[s + 2], d[s + 3]); s += 4;
    }
    if (b > 0) { ctx.strokeStyle = hsla(col, GLOW[b]); ctx.lineWidth = WIDE[b] * dpr; ctx.stroke(); }                     // the glow, wider as it thins out
    ctx.strokeStyle = hsla(col[1] ? [col[0], 100, 56] : col, TUBE[b]); ctx.lineWidth = MID[b] * dpr; ctx.stroke();        // the tube
    if (b > 1) { ctx.strokeStyle = hsla(col[1] ? [col[0], 100, 86] : [0, 0, 94], CORE[b]); ctx.lineWidth = THIN[b] * dpr; ctx.stroke(); }   // its hot middle
  }
  // Sparks: small, fast, and gone in a moment. Each is the stretch it flew in
  // the last thirtieth of a second, so it is a streak and not a row of dots.
  const sk = [];
  for (const p of st.sparks) {
    p.vx *= Math.exp(-2.2 * dt); p.vy = p.vy * Math.exp(-2.2 * dt) + S * 0.15 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 1.4 * dt;
    if (p.life > 0) sk.push(p);
  }
  st.sparks = sk;
  for (let i = 0; i < n; i++) {
    const hue = tone(viz, i, n, 1);
    for (let b = 0; b < 2; b++) {
      let any = false; ctx.beginPath();
      for (const p of sk) if (p.e === i && (p.life > 0.5 ? 1 : 0) === b) { any = true; ctx.moveTo(p.x - p.vx * 0.033, p.y - p.vy * 0.033); ctx.lineTo(p.x, p.y); }
      if (!any) continue;
      ctx.strokeStyle = hsla(pure(hue), b ? 0.5 : 0.2); ctx.lineWidth = (b ? 3.6 : 2.8) * dpr; ctx.stroke();                // its glow
      ctx.strokeStyle = hsla([hue[0], hue[1], 90], b ? 0.95 : 0.5); ctx.lineWidth = (b ? 1.3 : 1) * dpr; ctx.stroke();      // its core
    }
  }
  // The lanterns: a halo, a square standing on its corner with a bright
  // outline, and a white-hot middle. They swell with their part of the sound
  // and flare on a beat.
  st.em.forEach((e, i) => {
    const v = lv[i], col = tone(viz, i, n, v), lit = Math.min(1, v + e.flash * 0.6);
    const s = (3.2 + v * 5 + e.flash * 3) * dpr, R = s * (5 + lit * 5);
    ctx.globalAlpha = 0.3 + lit * 0.5;
    ctx.drawImage(glowSprite(step(pure(col))), e.x - R, e.y - R, R * 2, R * 2);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.PI / 4 + e.rot * 0.2);
    ctx.strokeStyle = hsla(pure(col), 0.55); ctx.lineWidth = 4.5 * dpr; ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.strokeStyle = hsla([col[0], col[1], 88], 1); ctx.lineWidth = 1.6 * dpr; ctx.strokeRect(-s, -s, s * 2, s * 2);
    const c = s * (0.28 + lit * 0.3);
    ctx.fillStyle = hsla([col[0], col[1], 92], 0.55 + lit * 0.4); ctx.fillRect(-c, -c, c * 2, c * 2);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ── BUBBLES ───────────────────────────────────────────────────────────────
/* Rebalanced in v3.36.0, once it could be seen at true speed. The loudest
   column let go of nine bubbles a frame, 540 a second: it filled the limit of
   900 by itself within two seconds and stood there as one solid column while
   the others starved. It looked stuck. Now bubbles come by the second and not
   by the frame, every column has its own share, most are small and a few are
   large, the small ones rise faster, they fade in and out, and the columns
   wander right across the picture.
   v3.37.0: they looked like wire circles in tidy rows. Each bubble now has a
   halo, a tint inside and a highlight (ringSprite), so a cluster lights up
   where its bubbles overlap. A slow sideways current, the same for all, lets
   the columns lean and bunch instead of rising straight. A bubble swells as
   it appears, every bubble swells a little on the beat, the larger ones
   most, and the haze behind a column sits where its bubbles are and
   brightens with them. */
export function drawBubbles(viz) {
  const { ctx, W, H, S, dpr, now, st, dt, quiet, lv } = frame(viz, '_bub');
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const N = 6, EACH = 90;                         // columns, and how many bubbles each may have at once
  if (!st.cols) { st.cols = Array.from({ length: N }, () => ({ ph: Math.random() * TAU, sp: 0.1 + Math.random() * 0.16, due: 0, n: 0, avg: 0, hit: 0 })); st.b = []; }
  const hard = beatSince(viz, st), beat = quiet ? 0 : hard, punch = quiet ? 0 : (viz.beat?.punch || 0);
  // Six columns: the even ones the low sounds, in one colour, the odd ones the
  // high sounds, in the other.
  const part = [0, 3, 1, 4, 2, 3];
  const add = (c, fam, x, y, rb, vy) => { c.n++; st.made = (st.made || 0) + 1; st.b.push({ c, x, y, rb, r: RB[rb] * dpr, fam, vy, ph: Math.random() * TAU, life: 0 }); };
  st.cols.forEach((c, i) => {
    c.ph += dt * c.sp;
    c.x = W * (0.08 + (i + 0.5) / N * 0.84 + Math.sin(c.ph) * 0.07 + Math.sin(c.ph * 2.3 + i) * 0.03);
    const v = quiet ? 0 : lv[part[i]], fam = i % 2;
    c.avg += (v - c.avg) * Math.min(1, dt * 1.5);
    c.hit = Math.max(c.hit * Math.exp(-dt * 5), Math.min(1, Math.max(0, v - c.avg) * 6));   // louder than a moment ago
    c.due = Math.min(3, c.due + (v < 0.1 ? 0 : 4 + v * v * 26 + c.hit * 30) * dt);          // so many a second
    while (c.due >= 1 && c.n < EACH) {
      c.due -= 1;
      const big = Math.random() < 0.08 + c.hit * 0.25 + v * 0.08;
      const rb = nearestRB(big ? 9 + Math.random() * 14 : 1.5 + Math.random() * Math.random() * 6);
      const g = (Math.random() + Math.random() + Math.random() - 1.5) * S * (big ? 0.07 : 0.16);   // bunched about the column
      add(c, fam, c.x + g, H + RB[rb] * dpr + Math.random() * S * 0.05, rb, -S * (0.07 + Math.random() * 0.08 + v * 0.1) * (big ? 0.8 : 1.15));
    }
    if (beat && fam === 0) for (let j = 0, m = Math.round(2 + beat * 4); j < m && c.n < EACH; j++)   // a cluster lets go, larger for a harder hit
      add(c, fam, c.x + (Math.random() - 0.5) * S * 0.14, H * (0.3 + Math.random() * 0.6), nearestRB(8 + Math.random() * 15), -S * (0.06 + Math.random() * 0.08));
  });
  // Rise, sway a little, lean with a slow current, and go at the top.
  const keep = [], T = now / 1000;
  for (const c of st.cols) { c.sx = c.sy = c.cnt = 0; }
  for (const b of st.b) {
    b.life += dt; b.y += b.vy * dt;
    const drift = Math.sin(b.y / S * 4.1 + T * 0.33) + 0.6 * Math.sin(b.y / S * 8.3 - b.x / S * 3.1 - T * 0.5);
    b.x += (Math.sin(now / 700 + b.ph) * 0.02 + drift * 0.035) * S * dt;
    if (b.y < -b.r * 2) { b.c.n--; continue; }
    keep.push(b); b.c.sx += b.x; b.c.sy += b.y; b.c.cnt++;
  }
  st.b = keep;
  // A soft haze behind each column, where its bubbles are, as strong as they
  // are many and brighter on the beat.
  st.cols.forEach((c, i) => {
    if (c.cnt < 3) return;
    const fam = i % 2, v = lv[part[i]], R = S * (0.2 + v * 0.16);
    ctx.globalAlpha = Math.min(0.42, (0.05 + c.cnt / EACH * 0.3) * (0.75 + punch * 0.6));
    ctx.drawImage(glowSprite(step(tone(viz, fam, 2, v, 'bubbles'))), c.sx / c.cnt - R, c.sy / c.cnt - R, R * 2, R * 2);
  });
  // The rings, from sprites: a faint wide glow and a thin bright line, drawn
  // once. Each fades in as it appears and out as it nears the top.
  const fcol = [0, 1].map(f => step(tone(viz, f, 2, lv[f ? 3 : 0], 'bubbles')));
  const spr = [[], []], top = H * 0.14;
  for (const b of st.b) {
    const c = spr[b.fam][b.rb] || (spr[b.fam][b.rb] = ringSprite(fcol[b.fam], b.rb, dpr));
    ctx.globalAlpha = Math.max(0, Math.min(1, b.life * 3, (b.y + b.r) / top));
    // Swelling as it appears, and with the beat: the larger, the more.
    const grow = Math.min(1, b.life * 3.5), k = (0.55 + 0.45 * grow * (2 - grow)) * (1 + punch * (RB[b.rb] > 7 ? 0.16 : 0.07));
    const w = c.width * k;
    ctx.drawImage(c, b.x - w / 2, b.y - w / 2, w, w);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ── PARTICLES ─────────────────────────────────────────────────────────────
export function drawParticles(viz) {
  const { ctx, W, H, S, dpr, st, dt, clean, quiet, lv } = frame(viz, '_pt');
  fade(ctx, W, H, Math.min(0.6, 3.2 * dt));
  if (clean) trim(ctx, W, H);
  if (!st.p) st.p = [];
  const bass = lv[0], cx = W / 2, cy = H / 2, n = 5;
  // Bursts from the centre, fast enough to reach the edges. On the beat
  // (v3.36.0): a steady stream as strong as the bass is loud, and a burst with
  // every hit, faster for a harder one. It went by the bass's level alone,
  // which in most music stays at the top, so the bursts were one even fountain.
  const punch = quiet ? 0 : (viz.beat?.punch || 0);
  const k = quiet ? 0 : Math.floor((1 + bass * 4 + punch * 14) * dt * 30 + Math.random());
  st.made = (st.made || 0) + k;
  for (let j = 0; j < k && st.p.length < 1200; j++) {
    const a = Math.random() * TAU, sp = S * (0.22 + bass * 0.55 + punch * 0.45 + Math.random() * 0.25);
    const r0 = S * (0.015 + Math.random() * 0.07);   // spread, so no hard ring forms at the centre
    st.p.push({ x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 1, decay: 0.22 + Math.random() * 0.2, size: (1 + Math.random() * 2.5 + bass * 2.5) * dpr, i: Math.floor(Math.random() * n) });
  }
  // Sparks anywhere, with the treble.
  const t = lv[4], k2 = quiet ? 0 : Math.floor(t * t * 8 * dt * 60 + Math.random() * t);
  for (let j = 0; j < k2 && st.p.length < 1200; j++) {
    st.p.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * S * 0.05, vy: (Math.random() - 0.5) * S * 0.05,
      life: 1, decay: 1.2 + Math.random(), size: (0.8 + Math.random() * 1.6) * dpr, i: n - 1, spark: true });
  }
  // v3.36.0: a burst particle draws the way it came this frame as a line, a
  // wide faint one for its glow and a thin bright one for its core, and the
  // canvas's fade makes the tail. It was a dot stamped once a frame: at any
  // speed the dots stood apart, and every streak was a string of beads. Lines
  // are also far fewer drawing calls: forty strokes a frame, not a thousand
  // stamps. The treble's sparks hardly move, and stay soft dots.
  const keep = [], groups = Array.from({ length: n * 4 }, () => []), sparks = Array.from({ length: 2 }, () => []);
  for (const p of st.p) {
    const ox = p.x, oy = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
    if (p.life <= 0 || p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
    keep.push(p);
    if (p.spark) sparks[p.life > 0.5 ? 1 : 0].push(p);
    else groups[p.i * 4 + (p.life > 0.5 ? 2 : 0) + (p.size > 3.4 * dpr ? 1 : 0)].push(ox, oy, p.x, p.y);
  }
  st.p = keep;
  ctx.lineCap = 'butt';   // each frame's piece ends where the next begins: round ends overlapped, and added up to a bead at every joint
  groups.forEach((seg, g) => {
    if (!seg.length) return;
    const i = g >> 2, young = (g >> 1) & 1, w = (g & 1 ? 3.6 : 2.1) * dpr, col = tone(viz, i, n, lv[i]);
    ctx.beginPath();
    for (let q = 0; q < seg.length; q += 4) { ctx.moveTo(seg[q], seg[q + 1]); ctx.lineTo(seg[q + 2], seg[q + 3]); }
    ctx.strokeStyle = hsla(col, young ? 0.2 : 0.09); ctx.lineWidth = w * 2.8; ctx.stroke();                    // the glow
    ctx.strokeStyle = hsla([col[0], col[1], 84], young ? 0.9 : 0.4); ctx.lineWidth = w * 0.5; ctx.stroke();   // the core
  });
  // Sparks, from sprites (v3.32.0): a soft dot, faded by its life.
  sparks.forEach((list, band) => {
    if (!list.length) return;
    const col = step(tone(viz, n - 1, n, lv[n - 1]));
    ctx.globalAlpha = band ? 0.9 : 0.45;
    for (const p of list) {
      const r = Math.max(1, Math.round(p.size * (0.4 + p.life * 0.6))), c = dotSprite(col, r);
      ctx.drawImage(c, p.x - c.width / 2, p.y - c.height / 2);
    }
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
