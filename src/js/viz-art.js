/**
 * viz-art: the visualiser's artistic styles (v3.31.0), drawn in 2D on the
 * visualiser's own canvas.
 *
 *   Neon       glowing points wander the screen, moved by the music, and trail
 *              luminous wisps along a swirling flow. A beat in the bass throws
 *              sparks.
 *   Bubbles    glowing rings rise in drifting columns, as many and as large as
 *              the music is loud, and a beat lets a cluster go.
 *   Particles  bursts from the centre fast enough to reach the edges, and
 *              sparks anywhere with the treble. It used to stay in a small
 *              patch in the middle, and drew every dot with a shadow blur.
 *
 * All three add their light together ('lighter'), so overlaps glow, and fade
 * what was drawn before rather than painting black, so the canvas stays
 * see-through. Drawing is grouped by colour and brightness: a few dozen
 * strokes a frame, not one per particle. Motion goes by the clock.
 */

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
function ringSprite(col, rb, dpr) {
  const r = RB[rb] * dpr, big = RB[rb] > 7, glow = (big ? 7 : 4) * dpr, n = Math.ceil((r + glow) * 2 + 2);
  return sprite(`ring|${col.join(',')}|${rb}|${dpr}`, n, (g, w) => {
    g.lineWidth = glow; g.strokeStyle = hsla(col, big ? 0.22 : 0.12); g.beginPath(); g.arc(w / 2, w / 2, r, 0, TAU); g.stroke();
    g.lineWidth = 1.4 * dpr; g.strokeStyle = hsla([col[0], col[1], col[2] + 14], big ? 0.95 : 0.75); g.beginPath(); g.arc(w / 2, w / 2, r, 0, TAU); g.stroke();
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
  const dt = Math.min(0.05, Math.max(0.001, (now - st.t) / 1000)); st.t = now;
  // Repeated small fades leave faint traces (8-bit alpha rounds them to a
  // standstill): four times a second they are cleared away (trim).
  const clean = now - st.clean > 250; if (clean) st.clean = now;
  // Quiet: the waveform is flat (the music stopped or paused), and nothing new
  // is made. The spectrum would say so only slowly, as it fades.
  const quiet = (viz._loudness?.() ?? 1) < 0.01;
  return { ctx: viz.ctx, W, H, S: Math.min(W, H), dpr: W / (canvas.clientWidth || W) || 1, now, st, dt, clean, quiet, lv: bands(viz._getFreq()) };
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
export function drawNeon(viz) {
  const { ctx, W, H, S, dpr, now, st, dt, clean, quiet, lv } = frame(viz, '_neon');
  fade(ctx, W, H, Math.min(0.5, 2.4 * dt));
  if (clean) trim(ctx, W, H);
  const n = 5, T = now / 1000;
  if (!st.em) {
    st.em = Array.from({ length: n }, (_, i) => ({ x: W * (0.2 + i * 0.15), y: H * (0.35 + (i % 2) * 0.3), ph: Math.random() * 50,
      fx: 0.55 + Math.random() * 0.5, fy: 0.45 + Math.random() * 0.5, ox: Math.random() * TAU, oy: Math.random() * TAU, rot: 0, vx: 0, vy: 0 }));
    st.p = []; st.sparks = [];
  }
  const hard = beatSince(viz, st), beat = quiet ? 0 : hard;
  // One swirling flow for every wisp, so they curl together like smoke.
  // Broad swirls (v3.31.0): neighbouring wisps travel together, as ribbons.
  const flowAt = (x, y) => Math.sin(x / S * 2.8 + T * 0.45) * 2.0 + Math.cos(y / S * 3.4 - T * 0.35) * 2.2 + Math.sin((x - y) / S * 1.9 + T * 0.2) * 1.3;
  st.em.forEach((e, i) => {
    const v = lv[i];
    e.ph += dt * (0.16 + v * 1.3);                       // louder, it wanders faster
    const tx = W * (0.5 + 0.4 * Math.sin(e.ph * e.fx + e.ox) * Math.cos(e.ph * 0.31 + e.oy));
    const ty = H * (0.5 + 0.38 * Math.sin(e.ph * e.fy + e.oy + i));
    const px = e.x, py = e.y, k = Math.min(1, dt * 2.2);
    e.x += (tx - e.x) * k; e.y += (ty - e.y) * k;
    e.vx = (e.x - px) / dt; e.vy = (e.y - py) / dt; e.rot += dt * (0.5 + v * 2.5);
    const count = quiet ? 0 : Math.min(20, Math.floor(v * v * 30 * dt * 60 + Math.random()));
    st.made = (st.made || 0) + count;
    for (let j = 0; j < count && st.p.length < 3000; j++) {
      // Starting almost still, they follow the flow together (a fast random
      // start fanned them out into separate strands). And they start all along
      // the way the emitter came this frame (v3.36.0): starting where it now is,
      // each frame's wisps left in one bunch, and a moving emitter drew a comb.
      const a = Math.random() * TAU, r = Math.random() * 5 * dpr, sp = S * 0.012, w = Math.random();
      st.p.push({ e: i, x: px + (e.x - px) * w + Math.cos(a) * r, y: py + (e.y - py) * w + Math.sin(a) * r, vx: e.vx * 0.2 + Math.cos(a) * sp, vy: e.vy * 0.2 + Math.sin(a) * sp, life: 1, decay: 0.22 + Math.random() * 0.18 });
    }
    if (beat && st.sparks.length < 400) for (let j = 0, m = Math.round(3 + beat * 9); j < m; j++) {   // more of them for a harder hit
      const a = Math.random() * TAU, sp = S * (0.2 + Math.random() * 0.45) * (0.6 + beat * 0.5);
      st.sparks.push({ e: i, x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
  });
  // The wisps: each frame's step as a short line, kept by the canvas and
  // faded slowly, so the steps build into glowing filaments.
  const groups = Array.from({ length: n * 3 }, () => []), keep = [], pull = S * 0.28, damp = Math.exp(-1.2 * dt);
  for (const p of st.p) {
    const a = flowAt(p.x, p.y);
    p.vx = (p.vx + Math.cos(a) * pull * dt) * damp;
    p.vy = (p.vy + Math.sin(a) * pull * dt - S * 0.04 * dt) * damp;   // rising a little, as smoke does
    const ox = p.x, oy = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
    if (p.life <= 0 || p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
    keep.push(p); groups[p.e * 3 + (p.life > 0.66 ? 2 : p.life > 0.33 ? 1 : 0)].push(ox, oy, p.x, p.y);
  }
  st.p = keep;
  ctx.lineCap = 'round';
  for (let g = 0; g < groups.length; g++) {
    const seg = groups[g]; if (!seg.length) continue;
    const i = Math.floor(g / 3), b = g % 3;
    // Wide and faint: overlapping strands merge into soft ribbons of light.
    ctx.strokeStyle = hsla(tone(viz, i, n, lv[i]), [0.07, 0.15, 0.3][b]);
    ctx.lineWidth = [1.6, 2.4, 3.2][b] * dpr;
    ctx.beginPath();
    for (let s = 0; s < seg.length; s += 4) { ctx.moveTo(seg[s], seg[s + 1]); ctx.lineTo(seg[s + 2], seg[s + 3]); }
    ctx.stroke();
  }
  // Sparks: small, fast, and gone in a moment.
  const sk = [];
  for (const p of st.sparks) {
    p.vx *= Math.exp(-2.2 * dt); p.vy = p.vy * Math.exp(-2.2 * dt) + S * 0.15 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 1.4 * dt;
    if (p.life > 0) sk.push(p);
  }
  st.sparks = sk;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = hsla([tone(viz, i, n, 1)[0], 100, 80], 0.85);
    ctx.beginPath(); for (const p of sk) if (p.e === i) { const r = (0.8 + p.life * 1.4) * dpr; ctx.rect(p.x - r, p.y - r, r * 2, r * 2); } ctx.fill();
  }
  // The emitters: little lanterns, a soft halo and a bright outline.
  st.em.forEach((e, i) => {
    const v = lv[i], col = tone(viz, i, n, v), s = (3.5 + v * 6) * dpr, R = s * (4 + v * 4);
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, R);
    g.addColorStop(0, hsla(col, 0.22 + v * 0.3)); g.addColorStop(1, hsla(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.PI / 4 + e.rot * 0.2);
    ctx.strokeStyle = hsla(col, 0.35); ctx.lineWidth = 4 * dpr; ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.strokeStyle = hsla([col[0], col[1], 86], 0.95); ctx.lineWidth = 1.5 * dpr; ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  });
  ctx.globalCompositeOperation = 'source-over';
}

// ── BUBBLES ───────────────────────────────────────────────────────────────
/* Rebalanced in v3.36.0, once it could be seen at true speed. The loudest
   column let go of nine bubbles a frame, 540 a second: it filled the limit of
   900 by itself within two seconds and stood there as one solid column while
   the others starved. It looked stuck. Now bubbles come by the second and not
   by the frame, every column has its own share, most are small and a few are
   large, the small ones rise faster, they fade in and out, and the columns
   wander right across the picture. */
export function drawBubbles(viz) {
  const { ctx, W, H, S, dpr, now, st, dt, quiet, lv } = frame(viz, '_bub');
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const N = 6, EACH = 90;                         // columns, and how many bubbles each may have at once
  if (!st.cols) { st.cols = Array.from({ length: N }, () => ({ ph: Math.random() * TAU, sp: 0.1 + Math.random() * 0.16, due: 0, n: 0, avg: 0, hit: 0 })); st.b = []; }
  const hard = beatSince(viz, st), beat = quiet ? 0 : hard;
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
  // Rise, sway a little, and go at the top.
  const keep = [];
  for (const b of st.b) {
    b.life += dt; b.y += b.vy * dt; b.x += Math.sin(now / 700 + b.ph) * S * 0.02 * dt;
    if (b.y < -b.r * 2) { b.c.n--; continue; }
    keep.push(b);
  }
  st.b = keep;
  // A soft glow behind each colour, where its bubbles are.
  for (let fam = 0; fam < 2; fam++) {
    const v = (lv[fam ? 3 : 0] + lv[fam ? 4 : 1]) / 2; if (v < 0.05) continue;
    const xs = st.cols.filter((_, i) => i % 2 === fam).map(c => c.x), x = xs.reduce((a, b) => a + b, 0) / xs.length;
    const y = fam ? H * 0.35 : H * 0.7, R = S * (0.35 + v * 0.3);
    ctx.globalAlpha = 0.1 + v * 0.12;
    ctx.drawImage(glowSprite(step(tone(viz, fam, 2, v, 'bubbles'))), x - R, y - R, R * 2, R * 2);
  }
  // The rings, from sprites: a faint wide glow and a thin bright line, drawn
  // once. Each fades in as it appears and out as it nears the top.
  const fcol = [0, 1].map(f => step(tone(viz, f, 2, lv[f ? 3 : 0], 'bubbles')));
  const spr = [[], []], top = H * 0.14;
  for (const b of st.b) {
    const c = spr[b.fam][b.rb] || (spr[b.fam][b.rb] = ringSprite(fcol[b.fam], b.rb, dpr));
    ctx.globalAlpha = Math.max(0, Math.min(1, b.life * 3, (b.y + b.r) / top));
    ctx.drawImage(c, b.x - c.width / 2, b.y - c.height / 2);
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
