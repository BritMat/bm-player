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
function bands(freq) {
  const n = freq.length, cut = [0, 0.08, 0.2, 0.4, 0.65, 1].map(c => Math.round(c * n));
  const out = [];
  for (let i = 0; i < 5; i++) {
    const a = cut[i], b = Math.max(a + 1, cut[i + 1]);
    let s = 0; for (let j = a; j < b; j++) s += freq[j] || 0;
    out.push(s / (b - a) / 255);
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
function tone(viz, i, n, v, set) {
  const pos = n > 1 ? i / (n - 1) : 0.5;
  switch (viz.opts.colors) {
    case 'fire':    return i % 2 ? [205 + v * 12, 95, 58 + v * 14] : [24 + v * 22, 100, 55 + v * 12];
    case 'ice':     return [185 + pos * 45, 90, 60 + v * 15];
    case 'theme':   return [accentHue() + (pos - 0.5) * 50, 85, 60 + v * 12];
    case 'rainbow': return [(pos * 300 + (viz._tick || 0) * 0.5) % 360, 95, 60];
    case 'mono':    return [0, 0, 70 + v * 25];
    default:
      if (set === 'bubbles') return i % 2 ? [140, 90, 52 + v * 10] : [16, 100, 52 + v * 8];   // green and orange
      return [[240, 268, 296, 326, 352][Math.round(pos * 4)] ?? 280, 92, 60 + v * 12];       // blue to red, through violet and pink
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
function dotSprite(col, r) {
  const n = Math.ceil(r * 4 + 2);
  return sprite(`dot|${col.join(',')}|${r}`, n, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, hsla([col[0], col[1], col[2] + 18], 1)); gr.addColorStop(0.35, hsla(col, 0.85)); gr.addColorStop(1, hsla(col, 0));
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

function frame(viz, key) {
  const { canvas } = viz, W = canvas.width, H = canvas.height, now = performance.now();
  const st = viz[key] || (viz[key] = { t: now, clean: now });
  const dt = Math.min(0.05, Math.max(0.001, (now - st.t) / 1000)); st.t = now;
  // Repeated small fades leave faint traces (8-bit alpha rounds them to a
  // standstill): a stronger fade every two seconds clears them.
  const clean = now - st.clean > 2000; if (clean) st.clean = now;
  // Quiet: the waveform is flat (the music stopped or paused), and nothing new
  // is made. The spectrum would say so only slowly, as it fades.
  const quiet = (viz._loudness?.() ?? 1) < 0.01;
  return { ctx: viz.ctx, W, H, S: Math.min(W, H), dpr: W / (canvas.clientWidth || W) || 1, now, st, dt, clean, quiet, lv: bands(viz._getFreq()) };
}

function beatAt(st, bass, now) {
  st.bassAvg = (st.bassAvg || 0) + (bass - (st.bassAvg || 0)) * 0.05;
  if (bass > 0.3 && bass > st.bassAvg * 1.25 && now - (st.lastBeat || 0) > 180) { st.lastBeat = now; return true; }
  return false;
}

// ── NEON ──────────────────────────────────────────────────────────────────
export function drawNeon(viz) {
  const { ctx, W, H, S, dpr, now, st, dt, clean, quiet, lv } = frame(viz, '_neon');
  fade(ctx, W, H, Math.min(0.5, 2.4 * dt));
  if (clean) fade(ctx, W, H, 0.18);
  const n = 5, T = now / 1000;
  if (!st.em) {
    st.em = Array.from({ length: n }, (_, i) => ({ x: W * (0.2 + i * 0.15), y: H * (0.35 + (i % 2) * 0.3), ph: Math.random() * 50,
      fx: 0.55 + Math.random() * 0.5, fy: 0.45 + Math.random() * 0.5, ox: Math.random() * TAU, oy: Math.random() * TAU, rot: 0, vx: 0, vy: 0 }));
    st.p = []; st.sparks = [];
  }
  const beat = !quiet && beatAt(st, lv[0], now);
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
      // start fanned them out into separate strands).
      const a = Math.random() * TAU, r = Math.random() * 5 * dpr, sp = S * 0.012;
      st.p.push({ e: i, x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, vx: e.vx * 0.2 + Math.cos(a) * sp, vy: e.vy * 0.2 + Math.sin(a) * sp, life: 1, decay: 0.22 + Math.random() * 0.18 });
    }
    if (beat && st.sparks.length < 400) for (let j = 0; j < 10; j++) {
      const a = Math.random() * TAU, sp = S * (0.2 + Math.random() * 0.45);
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
export function drawBubbles(viz) {
  const { ctx, W, H, S, dpr, now, st, dt, quiet, lv } = frame(viz, '_bub');
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  if (!st.cols) { st.cols = Array.from({ length: 6 }, () => ({ ph: Math.random() * TAU, sp: 0.12 + Math.random() * 0.18 })); st.b = []; }
  const beat = !quiet && beatAt(st, lv[0], now);
  // Six columns drifting side to side: the even ones the low sounds, in one
  // colour, the odd ones the high sounds, in the other.
  const part = [0, 3, 1, 4, 2, 3];
  st.cols.forEach((c, i) => {
    c.ph += dt * c.sp; c.x = W * (0.1 + i * 0.16 + Math.sin(c.ph) * 0.06);
    const v = lv[part[i]], fam = i % 2;
    const count = quiet ? 0 : Math.min(10, Math.floor(v * v * 9 * dt * 60 + Math.random() * v));
    st.made = (st.made || 0) + count;
    for (let j = 0; j < count && st.b.length < 900; j++) {
      const g = (Math.random() + Math.random() + Math.random() - 1.5) * S * 0.085;  // bunched about the column
      const rb = nearestRB(1.5 + Math.random() * Math.random() * 13 * (0.4 + v));
      st.b.push({ x: c.x + g, y: H + 12 * dpr, rb, r: RB[rb] * dpr,
        vy: -(S * (0.1 + v * 0.3) + Math.random() * S * 0.05), ph: Math.random() * TAU, fam, part: part[i] });
    }
    if (beat && fam === 0) for (let j = 0; j < 9 && st.b.length < 900; j++) {           // a cluster lets go
      const rb = nearestRB(6 + Math.random() * 14);
      st.b.push({ x: c.x + (Math.random() - 0.5) * S * 0.12, y: H * (0.45 + Math.random() * 0.45), rb, r: RB[rb] * dpr,
        vy: -S * (0.15 + Math.random() * 0.15), ph: Math.random() * TAU, fam, part: part[i] });
    }
  });
  // Rise, sway a little, and go at the top.
  const keep = [];
  for (const b of st.b) {
    b.y += b.vy * dt; b.x += Math.sin(now / 700 + b.ph) * S * 0.02 * dt;
    if (b.y < -b.r * 2) continue;
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
    ctx.globalAlpha = 1;
  }
  // The rings, from sprites: a faint wide glow and a thin bright line, drawn once.
  const fcol = [0, 1].map(f => step(tone(viz, f, 2, lv[f ? 3 : 0], 'bubbles')));
  const spr = [[], []];
  for (const b of st.b) {
    const c = spr[b.fam][b.rb] || (spr[b.fam][b.rb] = ringSprite(fcol[b.fam], b.rb, dpr));
    ctx.drawImage(c, b.x - c.width / 2, b.y - c.height / 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ── PARTICLES ─────────────────────────────────────────────────────────────
export function drawParticles(viz) {
  const { ctx, W, H, S, dpr, st, dt, clean, quiet, lv } = frame(viz, '_pt');
  fade(ctx, W, H, Math.min(0.6, 3.2 * dt));
  if (clean) fade(ctx, W, H, 0.2);
  if (!st.p) st.p = [];
  const bass = lv[0], cx = W / 2, cy = H / 2, n = 5;
  // Bursts from the centre, fast enough to reach the edges.
  const k = quiet ? 0 : Math.floor((1 + bass * 10) * dt * 30 + Math.random());
  st.made = (st.made || 0) + k;
  for (let j = 0; j < k && st.p.length < 1200; j++) {
    const a = Math.random() * TAU, sp = S * (0.22 + bass * 0.8 + Math.random() * 0.25);
    const r0 = S * (0.015 + Math.random() * 0.07);   // spread, so no hard ring forms at the centre
    st.p.push({ x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 1, decay: 0.22 + Math.random() * 0.2, size: (1 + Math.random() * 2.5 + bass * 2.5) * dpr, i: Math.floor(Math.random() * n) });
  }
  // Sparks anywhere, with the treble.
  const t = lv[4], k2 = quiet ? 0 : Math.floor(t * t * 8 * dt * 60 + Math.random() * t);
  for (let j = 0; j < k2 && st.p.length < 1200; j++) {
    st.p.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * S * 0.05, vy: (Math.random() - 0.5) * S * 0.05,
      life: 1, decay: 1.2 + Math.random(), size: (0.8 + Math.random() * 1.6) * dpr, i: n - 1 });
  }
  const keep = [], groups = Array.from({ length: n * 2 }, () => []);
  for (const p of st.p) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
    if (p.life <= 0 || p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
    keep.push(p); groups[p.i * 2 + (p.life > 0.5 ? 1 : 0)].push(p);
  }
  st.p = keep;
  // From sprites (v3.32.0): a soft dot per colour and size, faded by its life.
  groups.forEach((list, g) => {
    if (!list.length) return;
    const i = g >> 1, col = step(tone(viz, i, n, lv[i]));
    ctx.globalAlpha = g & 1 ? 0.9 : 0.45;
    for (const p of list) {
      const r = Math.max(1, Math.round(p.size * (0.4 + p.life * 0.6))), c = dotSprite(col, r);
      ctx.drawImage(c, p.x - c.width / 2, p.y - c.height / 2);
    }
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
