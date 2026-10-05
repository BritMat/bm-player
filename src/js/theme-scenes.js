/**
 * theme-scenes: an artistic, animated background for each of the ten
 * artistic themes (v3.27.0). Dark, Light, Dracula and Snow keep their
 * standard backgrounds, and Northern is the Flow theme (fluid.js). Until now every theme shared one fluid, recoloured.
 *
 * ThemeFX draws a scene in its 'scene:<theme>' mode, on its own canvas, in
 * canvas pixels, transparent over the theme's CSS background. A scene is
 * { frame(ctx, w, h, dt, t), resize(w, h) }: dt in seconds, t the clock.
 *
 * Glows and shapes are drawn once into small sprites, so a frame is mostly
 * drawImage. Counts scale with the quality tier, motion is per second rather
 * than per frame, and with reduced motion everything moves at a third of the
 * speed. Nothing here touches the page until a scene is created.
 */
// Northern is the Flow theme: the fluid it had before v3.27.0, with its own
// controls (flow-settings.js), so it is not a scene (v3.28.0).
export const SCENE_THEMES = ['ocean', 'forest', 'cyberpunk', 'midnight', 'sakura', 'sunset', 'golden', 'lavender', 'glass', 'light'];

const TIER = { low: 0.5, medium: 1, high: 1.5 };
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const count = (n, q) => Math.max(1, Math.round(n * q));

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }

// A soft round glow: full colour at the centre fading to nothing.
function glow(r, rgb, core = 0) {
  const c = canvas(r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  if (core) gr.addColorStop(core, `rgba(${rgb},0.55)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

// A four-pointed glint with a soft centre.
function glint(r, rgb) {
  const c = canvas(r * 2), g = c.getContext('2d');
  g.drawImage(glow(r * 0.45, rgb), r * 0.55, r * 0.55);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[r * 2, r * 0.16], [r * 0.16, r * 2]]) {
    const gr = w > h ? g.createLinearGradient(0, r, r * 2, r) : g.createLinearGradient(r, 0, r, r * 2);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.5, `rgba(${rgb},0.9)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(r - w / 2, r - h / 2, w, h);
  }
  return c;
}

const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/* ── Ocean: light from the surface, rising bubbles, drifting plankton ── */
function ocean(w, h, q, sp) {
  const bubbleSpr = [5, 9, 14].map(r => {
    const c = canvas(r * 2 + 4), g = c.getContext('2d'), m = r + 2;
    const gr = g.createRadialGradient(m - r * 0.35, m - r * 0.35, r * 0.1, m, m, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.7, 'rgba(150,225,255,0.05)'); gr.addColorStop(1, 'rgba(200,245,255,0.42)');
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(210,245,255,0.5)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(m - r * 0.4, m - r * 0.4, Math.max(1, r * 0.17), 0, TAU); g.fill();
    return c;
  });
  const speck = glow(3, '160,235,255');
  const rays = Array.from({ length: 6 }, (_, i) => ({ x: (i + 0.5) / 6 + rnd(-0.04, 0.04), w: rnd(0.04, 0.1), ph: rnd(0, TAU), sp: rnd(0.08, 0.16), a: rnd(0.05, 0.1) }));
  let bubbles, specks;
  const bubble = anywhere => { const s = pick([0, 0, 0, 1, 1, 2]); return { x: rnd(0, w), y: anywhere ? rnd(0, h) : h + 20, s, v: [26, 38, 52][s] * rnd(0.8, 1.25), ph: rnd(0, TAU), amp: rnd(3, 12) }; };
  const fill = () => {
    bubbles = Array.from({ length: count(38, q) }, () => bubble(true));
    specks = Array.from({ length: count(60, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), a: rnd(0.15, 0.55), vx: rnd(-5, 5), vy: rnd(-3, 3), ph: rnd(0, TAU) }));
  };
  fill();
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const r of rays) {
        const cx = (r.x + Math.sin(t * r.sp + r.ph) * 0.05) * w, bw = r.w * w, a = r.a * (0.75 + 0.25 * Math.sin(t * 0.7 + r.ph));
        const g = ctx.createLinearGradient(0, 0, 0, h * 0.9);
        g.addColorStop(0, `rgba(130,220,255,${a})`); g.addColorStop(1, 'rgba(130,220,255,0)');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(cx - bw * 0.25, 0); ctx.lineTo(cx + bw * 0.25, 0);
        ctx.lineTo(cx + bw + h * 0.15, h * 0.9); ctx.lineTo(cx - bw + h * 0.15, h * 0.9); ctx.closePath(); ctx.fill();
      }
      for (const s of specks) {
        s.x += s.vx * dt * sp; s.y += s.vy * dt * sp; s.ph += dt * sp;
        if (s.x < -4) s.x = w + 4; if (s.x > w + 4) s.x = -4; if (s.y < -4) s.y = h + 4; if (s.y > h + 4) s.y = -4;
        ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(s.ph * 1.7)); ctx.drawImage(speck, s.x - 3, s.y - 3);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const b of bubbles) {
        b.y -= b.v * dt * sp; b.ph += dt * 2.2 * sp;
        if (b.y < -24) Object.assign(b, bubble(false));
        const spr = bubbleSpr[b.s]; ctx.globalAlpha = 0.85;
        ctx.drawImage(spr, b.x + Math.sin(b.ph) * b.amp - spr.width / 2, b.y - spr.height / 2);
      }
      ctx.restore();
    },
  };
}

/* ── Forest: fireflies, tumbling leaves, faint sunbeams ─────────────── */
function forest(w, h, q, sp) {
  const fly = glow(16, '205,255,130', 0.12);
  const leafSpr = ['#4f7942', '#6b8e23', '#8fbc5a', '#c9a227', '#b5651d'].map(col => {
    const c = canvas(24), g = c.getContext('2d');
    g.translate(12, 12); g.fillStyle = col; g.beginPath();
    g.moveTo(0, -10); g.quadraticCurveTo(9, -1, 0, 10); g.quadraticCurveTo(-9, -1, 0, -10); g.fill();
    g.strokeStyle = 'rgba(30,40,20,0.45)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -9); g.lineTo(0, 9); g.stroke();
    return c;
  });
  let flies, leaves;
  const leaf = top => ({ x: rnd(-20, w), y: top ? rnd(-60, -10) : rnd(0, h), s: leafSpr.length && (Math.random() * leafSpr.length) | 0, sc: rnd(0.7, 1.25), rot: rnd(0, TAU), vr: rnd(-1.2, 1.2), flip: rnd(0, TAU), vy: rnd(22, 42), ph: rnd(0, TAU) });
  const fill = () => {
    flies = Array.from({ length: count(55, q) }, () => ({ x: rnd(0, w), y: rnd(h * 0.25, h), vx: rnd(-12, 12), vy: rnd(-8, 8), ph: rnd(0, TAU), f: rnd(0.6, 1.5) }));
    leaves = Array.from({ length: count(16, q) }, () => leaf(false));
  };
  fill();
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x0 = w * (0.15 + i * 0.22) + Math.sin(t * 0.1 + i) * 30, a = 0.035 + 0.015 * Math.sin(t * 0.3 + i * 2);
        const g = ctx.createLinearGradient(x0, 0, x0 + h * 0.5, h);
        g.addColorStop(0, `rgba(255,240,180,${a})`); g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 70, 0); ctx.lineTo(x0 + 70 + h * 0.5, h); ctx.lineTo(x0 + h * 0.5 - 30, h); ctx.closePath(); ctx.fill();
      }
      for (const f of flies) {
        f.vx += rnd(-30, 30) * dt; f.vy += rnd(-30, 30) * dt;
        const v = Math.hypot(f.vx, f.vy), max = 18; if (v > max) { f.vx *= max / v; f.vy *= max / v; }
        f.x += f.vx * dt * sp; f.y += f.vy * dt * sp; f.ph += dt * sp;
        if (f.x < -10) f.x = w + 10; if (f.x > w + 10) f.x = -10; if (f.y < h * 0.15) f.vy += 20 * dt; if (f.y > h + 10) f.y = h * 0.3;
        const b = Math.max(0, Math.sin(f.ph * f.f * 2)); ctx.globalAlpha = 0.15 + 0.85 * b * b;
        ctx.drawImage(fly, f.x - 16, f.y - 16);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const l of leaves) {
        l.y += l.vy * dt * sp; l.x += (Math.sin(t * 0.6 + l.ph) * 22 + 8) * dt * sp; l.rot += l.vr * dt * sp; l.flip += 1.6 * dt * sp;
        if (l.y > h + 20) Object.assign(l, leaf(true));
        ctx.globalAlpha = 0.85; ctx.setTransform(l.sc * Math.cos(l.rot), l.sc * Math.sin(l.rot), -l.sc * Math.sin(l.rot) * Math.abs(Math.cos(l.flip)), l.sc * Math.cos(l.rot) * Math.abs(Math.cos(l.flip)), l.x, l.y);
        ctx.drawImage(leafSpr[l.s], -12, -12);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.restore();
    },
  };
}

/* ── City lights (Cyberpunk): a skyline, neon rain, soft bokeh ────────── */
function cyberpunk(w, h, q, sp) {
  const bokehSpr = ['255,60,200', '60,230,255', '150,90,255'].map(rgb => glow(48, rgb, 0.5));
  let sky, windows, bokeh, rain;
  const fill = () => {
    // The skyline: drawn once, its windows lit and flickered per frame.
    const top = h * 0.7; sky = canvas(w, h - top); windows = [];
    const g = sky.getContext('2d');
    for (let x = -10; x < w; ) {
      const bw = rnd(36, 96), bh = rnd(h * 0.08, h * 0.28);
      g.fillStyle = `rgba(${(rnd(8, 18)) | 0},${(rnd(6, 14)) | 0},${(rnd(22, 40)) | 0},0.92)`;
      g.fillRect(x, sky.height - bh, bw, bh);
      if (Math.random() < 0.3) g.fillRect(x + bw * 0.4, sky.height - bh - rnd(10, 26), 3, 26);   // an antenna
      for (let wy = sky.height - bh + 8; wy < sky.height - 6; wy += 9)
        for (let wx = x + 6; wx < x + bw - 6; wx += 8)
          if (Math.random() < 0.38) windows.push({ x: wx, y: top + wy, c: (Math.random() * 3) | 0, on: Math.random() < 0.8 });
      x += bw + rnd(2, 10);
    }
    bokeh = Array.from({ length: count(26, q) }, () => ({ x: rnd(0, w), y: rnd(0, h * 0.8), s: rnd(0.5, 1.4), c: (Math.random() * 3) | 0, vx: rnd(-6, 6), vy: rnd(-5, -1), a: rnd(0.08, 0.2), ph: rnd(0, TAU) }));
    rain = Array.from({ length: count(110, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), v: rnd(650, 950), len: rnd(10, 26), c: Math.random() < 0.7 ? 0 : 1 }));
  };
  fill();
  const WIN = ['rgba(255,210,120,0.85)', 'rgba(120,240,255,0.85)', 'rgba(255,110,215,0.85)'];
  const RAIN = ['rgba(120,230,255,0.32)', 'rgba(255,120,220,0.3)'];
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const b of bokeh) {
        b.x += b.vx * dt * sp; b.y += b.vy * dt * sp;
        if (b.y < -60) { b.y = h * 0.8; b.x = rnd(0, w); } if (b.x < -60) b.x = w + 60; if (b.x > w + 60) b.x = -60;
        const spr = bokehSpr[b.c], r = 48 * b.s;
        ctx.globalAlpha = b.a * (0.7 + 0.3 * Math.sin(t * 0.8 + b.ph)); ctx.drawImage(spr, b.x - r, b.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.drawImage(sky, 0, h * 0.7);
      if (Math.random() < 3 * dt * sp && windows.length) { const wn = pick(windows); wn.on = !wn.on; }
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = WIN[c];
        for (const wn of windows) if (wn.c === c && wn.on) ctx.fillRect(wn.x, wn.y, 3, 4);
      }
      ctx.lineWidth = 1;
      for (let c = 0; c < 2; c++) {
        ctx.strokeStyle = RAIN[c]; ctx.beginPath();
        for (const r of rain) {
          if (r.c !== c) continue;
          r.y += r.v * dt * sp; r.x -= r.v * 0.12 * dt * sp;
          if (r.y > h) { r.y = rnd(-40, 0); r.x = rnd(0, w + 60); }
          ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.len * 0.12, r.y - r.len);
        }
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}

/* ── Midnight: a starfield, a moon glow, the odd shooting star ──────── */
function midnight(w, h, q, sp) {
  const moon = glow(220, '170,190,255'), star = glow(2.5, '235,240,255'), big = glint(12, '225,235,255');
  let stars, bright, shoot = null, next = rnd(3, 7);
  const fill = () => {
    stars = Array.from({ length: count(240, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), s: rnd(0.4, 1.3), a: rnd(0.3, 0.95), f: rnd(0.4, 2), ph: rnd(0, TAU) }));
    bright = Array.from({ length: 7 }, () => ({ x: rnd(0, w), y: rnd(0, h * 0.75), ph: rnd(0, TAU), r: rnd(0, TAU) }));
  };
  fill();
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 + 0.04 * Math.sin(t * 0.4); ctx.drawImage(moon, w * 0.82 - 220, h * 0.16 - 220);
      ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgba(235,240,255,0.9)'; ctx.beginPath(); ctx.arc(w * 0.82, h * 0.16, 16, 0, TAU); ctx.fill();
      for (const s of stars) {
        s.x += 1.5 * dt * sp; if (s.x > w + 2) s.x = -2;
        ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t * s.f + s.ph)); const r = 2.5 * s.s;
        ctx.drawImage(star, s.x - r, s.y - r, r * 2, r * 2);
      }
      for (const b of bright) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.9 + b.ph);
        ctx.setTransform(Math.cos(b.r), Math.sin(b.r), -Math.sin(b.r), Math.cos(b.r), b.x, b.y); ctx.drawImage(big, -12, -12);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      next -= dt * sp;
      if (!shoot && next <= 0) { shoot = { x: rnd(w * 0.3, w), y: rnd(0, h * 0.35), life: 0 }; next = rnd(5, 10); }
      if (shoot) {
        shoot.life += dt; const k = shoot.life / 0.9;
        const x = shoot.x - 700 * shoot.life, y = shoot.y + 260 * shoot.life;
        const g = ctx.createLinearGradient(x, y, x + 160, y - 60);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 160, y - 60); ctx.stroke();
        if (k >= 1) shoot = null;
      }
      ctx.restore();
    },
  };
}

/* ── Sakura: petals fluttering on a changing breeze ─────────────────── */
function sakura(w, h, q, sp) {
  const petalSpr = [['255,183,213', '255,225,238'], ['255,205,225', '255,245,250'], ['245,160,195', '255,215,232']].map(([a, b]) => {
    const c = canvas(22), g = c.getContext('2d'), gr = g.createLinearGradient(0, -9, 0, 9);
    gr.addColorStop(0, `rgb(${b})`); gr.addColorStop(1, `rgb(${a})`);
    g.translate(11, 11); g.fillStyle = gr; g.beginPath();
    g.moveTo(-2.2, -9); g.lineTo(0, -6.5); g.lineTo(2.2, -9);                       // the notch at the tip
    g.bezierCurveTo(8, -6, 7.5, 5, 0, 9.5); g.bezierCurveTo(-7.5, 5, -8, -6, -2.2, -9); g.fill();
    return c;
  });
  const soft = glow(40, '255,190,220', 0.4);
  let petals, glows;
  const petal = top => ({ x: rnd(-40, w), y: top ? rnd(-40, -10) : rnd(0, h), s: (Math.random() * 3) | 0, sc: rnd(0.55, 1.1), rot: rnd(0, TAU), vr: rnd(-1.5, 1.5), flip: rnd(0, TAU), fs: rnd(1.5, 3), vy: rnd(28, 55) });
  const fill = () => {
    petals = Array.from({ length: count(60, q) }, () => petal(false));
    glows = Array.from({ length: count(8, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), a: rnd(0.05, 0.12), ph: rnd(0, TAU) }));
  };
  fill();
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const g of glows) { ctx.globalAlpha = g.a * (0.7 + 0.3 * Math.sin(t * 0.5 + g.ph)); ctx.drawImage(soft, g.x - 40, g.y - 40); }
      ctx.globalCompositeOperation = 'source-over';
      const wind = Math.sin(t * 0.3) * 30 + Math.sin(t * 0.13 + 1) * 22 + 18;
      for (const p of petals) {
        p.y += p.vy * dt * sp; p.x += (wind + Math.sin(t * 1.3 + p.flip) * 14) * dt * sp; p.rot += p.vr * dt * sp; p.flip += p.fs * dt * sp;
        if (p.y > h + 20 || p.x > w + 40) Object.assign(p, petal(true));
        const fy = 0.25 + 0.75 * Math.abs(Math.cos(p.flip));
        ctx.globalAlpha = 0.9;
        ctx.setTransform(p.sc * Math.cos(p.rot), p.sc * Math.sin(p.rot), -p.sc * fy * Math.sin(p.rot), p.sc * fy * Math.cos(p.rot), p.x, p.y);
        ctx.drawImage(petalSpr[p.s], -11, -11);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.restore();
    },
  };
}

/* ── Sunset: a low sun, drifting warm clouds, rising motes, birds ───── */
function sunset(w, h, q, sp) {
  const sun = glow(300, '255,165,90'), mote = glow(4, '255,200,140');
  const cloudSpr = Array.from({ length: 4 }, () => {
    const c = canvas(320, 120), g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const r = rnd(26, 52), x = rnd(50, 270), y = rnd(45, 80);
      g.globalAlpha = 0.5; g.drawImage(glow(r, pick(['255,190,170', '255,170,140', '250,205,190'])), x - r, y - r);
    }
    return c;
  });
  let clouds, motes, birds = null, next = rnd(4, 9);
  const fill = () => {
    clouds = Array.from({ length: 5 }, (_, i) => ({ x: rnd(-320, w), y: h * rnd(0.08, 0.5), s: i % cloudSpr.length, v: rnd(5, 13), sc: rnd(0.8, 1.6), a: rnd(0.35, 0.6) }));
    motes = Array.from({ length: count(45, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), vy: rnd(-14, -5), ph: rnd(0, TAU), a: rnd(0.2, 0.7) }));
  };
  fill();
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.34 + 0.06 * Math.sin(t * 0.35); ctx.drawImage(sun, w * 0.74 - 300, h * 0.82 - 300);
      ctx.globalCompositeOperation = 'source-over';
      for (const c of clouds) {
        c.x += c.v * dt * sp; if (c.x > w + 40) { c.x = -320 * c.sc; c.y = h * rnd(0.08, 0.5); }
        ctx.globalAlpha = c.a; ctx.drawImage(cloudSpr[c.s], c.x, c.y, 320 * c.sc, 120 * c.sc);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        m.y += m.vy * dt * sp; m.ph += dt * sp; if (m.y < -6) { m.y = h + 6; m.x = rnd(0, w); }
        ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.ph * 2)); ctx.drawImage(mote, m.x + Math.sin(m.ph) * 8 - 4, m.y - 4);
      }
      ctx.globalCompositeOperation = 'source-over';
      next -= dt * sp;
      if (!birds && next <= 0) { const y = h * rnd(0.15, 0.4); birds = Array.from({ length: 3 + ((Math.random() * 4) | 0) }, (_, i) => ({ dx: -i * 26, dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 14, ph: rnd(0, TAU) })).map(b => ({ ...b, y })); birds.x = -60; next = rnd(8, 14); }
      if (birds) {
        birds.x += 70 * dt * sp; ctx.strokeStyle = 'rgba(45,22,35,0.65)'; ctx.lineWidth = 1.6; ctx.globalAlpha = 1; ctx.beginPath();
        for (const b of birds) {
          const x = birds.x + b.dx, y = b.y + b.dy, fl = Math.sin(t * 9 + b.ph) * 4;
          ctx.moveTo(x - 7, y - fl); ctx.quadraticCurveTo(x - 3, y - 2, x, y); ctx.quadraticCurveTo(x + 3, y - 2, x + 7, y - fl);
        }
        ctx.stroke();
        if (birds.x > w + 120) birds = null;
      }
      ctx.restore();
    },
  };
}

/* ── Golden: rising gold dust, glints, a slow sweep of light ───────── */
function golden(w, h, q, sp) {
  const dust = glow(4, '255,215,120'), spark = glint(10, '255,225,150'), orb = glow(60, '255,200,90', 0.4);
  let motes, orbs, sweep = -1;
  const fill = () => {
    motes = Array.from({ length: count(110, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), vy: rnd(-30, -9), ph: rnd(0, TAU), a: rnd(0.4, 1), g: Math.random() < 0.2, r: rnd(0, TAU) }));
    orbs = Array.from({ length: count(8, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-4, 4), vy: rnd(-4, 4), s: rnd(0.7, 1.5), a: rnd(0.08, 0.16) }));
  };
  fill();
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const o of orbs) {
        o.x += o.vx * dt * sp; o.y += o.vy * dt * sp;
        if (o.x < -80) o.x = w + 80; if (o.x > w + 80) o.x = -80; if (o.y < -80) o.y = h + 80; if (o.y > h + 80) o.y = -80;
        ctx.globalAlpha = o.a; ctx.drawImage(orb, o.x - 60 * o.s, o.y - 60 * o.s, 120 * o.s, 120 * o.s);
      }
      for (const m of motes) {
        m.y += m.vy * dt * sp; m.ph += dt * sp; m.r += 0.4 * dt * sp; if (m.y < -10) { m.y = h + 10; m.x = rnd(0, w); }
        const a = m.a * (0.5 + 0.5 * Math.sin(m.ph * 2.2)), x = m.x + Math.sin(m.ph) * 10;
        ctx.globalAlpha = a;
        if (m.g) { ctx.setTransform(Math.cos(m.r), Math.sin(m.r), -Math.sin(m.r), Math.cos(m.r), x, m.y); ctx.drawImage(spark, -10, -10); ctx.setTransform(1, 0, 0, 1, 0, 0); }
        else ctx.drawImage(dust, x - 4, m.y - 4);
      }
      // A broad band of light crosses now and then.
      if (sweep < 0 && Math.random() < dt * sp / 9) sweep = 0;
      if (sweep >= 0) {
        sweep += dt * sp / 3.2; const x = -w * 0.4 + sweep * w * 1.8, a = 0.07 * Math.sin(Math.min(1, sweep) * Math.PI);
        const g = ctx.createLinearGradient(x - 160, 0, x + 160, 0);
        g.addColorStop(0, 'rgba(255,220,140,0)'); g.addColorStop(0.5, `rgba(255,220,140,${a})`); g.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.setTransform(1, 0, -0.35, 1, h * 0.35, 0); ctx.fillRect(x - 160, 0, 320, h); ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (sweep >= 1) sweep = -1;
      }
      ctx.restore();
    },
  };
}

/* ── Lavender: stalks swaying at the bottom, drifting seeds ─────────── */
function lavender(w, h, q, sp) {
  const budSpr = ['183,156,242', '157,123,224', '201,179,245'].map(rgb => glow(4, rgb, 0.6));
  const seedSpr = (() => {
    const c = canvas(22), g = c.getContext('2d'); g.translate(11, 11);
    g.strokeStyle = 'rgba(245,238,255,0.75)'; g.lineWidth = 0.7;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); g.stroke(); }
    g.fillStyle = 'rgba(255,250,255,0.9)'; g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fill();
    return c;
  })();
  const soft = glow(50, '190,150,255', 0.4);
  let stalks, seeds, glows;
  const fill = () => {
    const n = count(46, q);
    stalks = Array.from({ length: n }, (_, i) => ({ x: (i + rnd(0.1, 0.9)) / n * w, ht: h * rnd(0.1, 0.22), ph: rnd(0, TAU), buds: 9 + ((Math.random() * 5) | 0), c: (Math.random() * 3) | 0 }));
    seeds = Array.from({ length: count(22, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), vx: rnd(8, 20), vy: rnd(-12, -4), r: rnd(0, TAU), vr: rnd(-0.6, 0.6), sc: rnd(0.6, 1.1), ph: rnd(0, TAU) }));
    glows = Array.from({ length: count(6, q) }, () => ({ x: rnd(0, w), y: rnd(0, h * 0.7), a: rnd(0.05, 0.1), ph: rnd(0, TAU) }));
  };
  fill();
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const g of glows) { ctx.globalAlpha = g.a * (0.7 + 0.3 * Math.sin(t * 0.4 + g.ph)); ctx.drawImage(soft, g.x - 50, g.y - 50); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(150,175,130,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath();
      const sway = s => Math.sin(t * 0.9 * sp + s.ph + s.x * 0.004) * s.ht * 0.12;
      for (const s of stalks) { const sw = sway(s); ctx.moveTo(s.x, h); ctx.quadraticCurveTo(s.x + sw * 0.3, h - s.ht * 0.5, s.x + sw, h - s.ht); }
      ctx.stroke();
      for (const s of stalks) {
        const sw = sway(s);
        for (let i = 0; i < s.buds; i++) {
          const k = 1 - i / (s.buds * 2.6), x = s.x + sw * k * k, y = h - s.ht * k, z = 1 - (i / s.buds) * 0.45;
          ctx.globalAlpha = 0.95; ctx.drawImage(budSpr[(s.c + i) % 3], x - 4 * z + (i % 2 ? 1.6 : -1.6) * z, y - 4 * z, 8 * z, 8 * z);
        }
      }
      for (const d of seeds) {
        d.x += (d.vx + Math.sin(t * 0.5 + d.ph) * 6) * dt * sp; d.y += (d.vy + Math.sin(t * 0.8 + d.ph) * 5) * dt * sp; d.r += d.vr * dt * sp;
        if (d.x > w + 20 || d.y < -20) { d.x = rnd(-20, w * 0.6); d.y = h + rnd(0, 20); }
        ctx.globalAlpha = 0.8; ctx.setTransform(d.sc * Math.cos(d.r), d.sc * Math.sin(d.r), -d.sc * Math.sin(d.r), d.sc * Math.cos(d.r), d.x, d.y); ctx.drawImage(seedSpr, -11, -11);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.restore();
    },
  };
}

/* ── Glass: drifting glass orbs and prismatic streaks ───────────────── */
function glass(w, h, q, sp) {
  const orbSpr = (() => {
    const r = 64, c = canvas(r * 2 + 4), g = c.getContext('2d'), m = r + 2;
    const gr = g.createRadialGradient(m, m, r * 0.55, m, m, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.02)'); gr.addColorStop(0.85, 'rgba(190,225,255,0.16)'); gr.addColorStop(1, 'rgba(225,240,255,0.42)');
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(235,245,255,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.arc(m, m, r - 0.6, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(m, m, r * 0.78, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(m + r * 0.42, m + r * 0.45, r * 0.07, 0, TAU); g.fill();
    return c;
  })();
  const twinkle = glint(8, '235,245,255');
  let orbs, sparks, streak = null;
  const fill = () => {
    orbs = Array.from({ length: count(12, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), r: rnd(16, 58), vx: rnd(-14, 14), vy: rnd(-10, 10), a: rnd(0.55, 0.9) }));
    sparks = Array.from({ length: count(16, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), ph: rnd(0, TAU), f: rnd(0.5, 1.4) }));
  };
  fill();
  const PRISM = ['255,90,90', '255,190,80', '120,255,140', '90,190,255', '190,120,255'];
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save();
      if (!streak && Math.random() < dt * sp / 5) streak = { y: rnd(h * 0.1, h * 0.8), life: 0, ang: rnd(-0.5, -0.2) };
      if (streak) {
        streak.life += dt * sp / 2.4; const a = 0.1 * Math.sin(Math.min(1, streak.life) * Math.PI);
        ctx.globalCompositeOperation = 'lighter';
        ctx.setTransform(Math.cos(streak.ang), Math.sin(streak.ang), -Math.sin(streak.ang), Math.cos(streak.ang), w * 0.5, streak.y);
        PRISM.forEach((rgb, i) => {
          const g = ctx.createLinearGradient(-w, 0, w, 0);
          g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = g; ctx.fillRect(-w, i * 7 - 18, w * 2, 7);
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (streak.life >= 1) streak = null;
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const o of orbs) {
        o.x += o.vx * dt * sp; o.y += o.vy * dt * sp;
        if (o.x < o.r || o.x > w - o.r) { o.vx *= -1; o.x = Math.max(o.r, Math.min(w - o.r, o.x)); }
        if (o.y < o.r || o.y > h - o.r) { o.vy *= -1; o.y = Math.max(o.r, Math.min(h - o.r, o.y)); }
        ctx.globalAlpha = o.a; ctx.drawImage(orbSpr, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) { ctx.globalAlpha = Math.max(0, Math.sin(t * s.f + s.ph)) ** 3; ctx.drawImage(twinkle, s.x - 8, s.y - 8); }
      ctx.restore();
    },
  };
}

// Light (v3.34.0): a bright morning, so the theme is more than plain white.
// Soft pastel orbs (lavender, peach, sky, mint, honey) drift slowly up through
// large washes of colour, with a few warm glints. Over a light page, so it
// paints with low alpha instead of adding light as the dark scenes do.
function light(w, h, q, sp) {
  const tints = ['140,120,255', '255,150,120', '90,180,255', '110,210,180', '255,190,100'];
  const orbSpr = tints.map(rgb => glow(40, rgb, 0.5));
  const washSpr = tints.map(rgb => glow(160, rgb, 0.2));
  const glint = glow(5, '255,196,110', 0.9);
  let orbs, washes, glints;
  const fill = () => {
    orbs = Array.from({ length: count(24, q) }, (_, i) => ({ x: rnd(0, w), y: rnd(0, h), r: rnd(10, 44), vy: rnd(-14, -5), ph: rnd(0, TAU), c: i % tints.length, a: rnd(0.25, 0.55) }));
    washes = Array.from({ length: 4 }, (_, i) => ({ x: rnd(0.1, 0.9) * w, y: rnd(0.1, 0.9) * h, ph: rnd(0, TAU), c: i % tints.length, s: rnd(2.2, 3.4) }));
    glints = Array.from({ length: count(16, q) }, () => ({ x: rnd(0, w), y: rnd(0, h), ph: rnd(0, TAU) }));
  };
  fill();
  return {
    resize(W, H) { w = W; h = H; fill(); },
    frame(ctx, W, H, dt, t) {
      ctx.save();
      for (const m of washes) {
        const x = m.x + Math.sin(t * 0.05 * sp + m.ph) * w * 0.08, y = m.y + Math.cos(t * 0.04 * sp + m.ph) * h * 0.06, R = 160 * m.s;
        ctx.globalAlpha = 0.85; ctx.drawImage(washSpr[m.c], x - R, y - R, R * 2, R * 2);
      }
      for (const o of orbs) {
        o.y += o.vy * dt * sp; o.x += Math.sin(t * 0.3 * sp + o.ph) * 6 * dt * sp;
        if (o.y < -o.r * 2) { o.y = h + o.r * 2; o.x = rnd(0, w); }
        ctx.globalAlpha = o.a * (0.8 + 0.2 * Math.sin(t * 0.7 + o.ph));
        const R = o.r * 1.6; ctx.drawImage(orbSpr[o.c], o.x - R, o.y - R, R * 2, R * 2);
      }
      for (const g of glints) {
        const a = Math.sin(t * 1.2 * sp + g.ph); if (a < 0.3) continue;
        ctx.globalAlpha = a * 0.85; ctx.drawImage(glint, g.x - 5, g.y - 5);
      }
      ctx.restore();
    },
  };
}

const SCENES = { ocean, forest, cyberpunk, midnight, sakura, sunset, golden, lavender, glass, light };

/** A scene for a theme, sized to the canvas, or null for a theme without one. */
export function createScene(name, w, h, tier = 'medium') {
  const make = SCENES[name]; if (!make) return null;
  const sp = reducedMotion() ? 0.33 : 1;
  return make(w, h, (TIER[tier] || 1) * (sp < 1 ? 0.6 : 1), sp);
}
