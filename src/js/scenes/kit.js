/**
 * The scene kit's helpers (v3.47.0): what every scene on the home screen
 * draws with, written once.
 *
 * The theme backgrounds (theme-scenes.js) and the realistic scenes (from
 * 3.48: Aurora Lake, Crow Field, the reef and the others) each had their own
 * copy of these. A scene is one file now (runner.js says what it gives), and
 * takes what it needs from here:
 *
 *   TAU, rnd(a, b), pick(list), clamp(x, a, b), lerp(a, b, k), smooth(a, b, x)
 *   seeded(n)            a random sequence that is the same every time, for
 *                        a layout that must not change between starts
 *   count(n, q)          how many of something at quality q, at least one
 *   TIER                 quality tiers as a multiplier (perf.js's names)
 *   canvas(w, h)         an off-screen canvas, never 0 pixels wide
 *   glow(r, rgb, core)   a soft round glow, drawn once as a sprite
 *   glint(r, rgb)        a four-pointed glint with a soft centre
 *   noise(x)             smooth noise along a line, 0 to 1
 *   noise2(x, y), fbm(x, y)   smooth noise on a plane, and four octaves of it
 *   reducedMotion()      the system asks for less motion
 *   scaleFor(w, h)       a size factor for a w x h view (900 px is 1)
 *   beatMeter()          a function that, given the music's analyser, says
 *                        how much of a beat there is now: the bass against
 *                        its own recent level, 0 to 1 (v3.48.0)
 *
 * Nothing here draws or runs anything by itself.
 */
export const TAU = Math.PI * 2;
export const TIER = { low: 0.5, medium: 1, high: 1.5 };

export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[(Math.random() * a.length) | 0];
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
export const count = (n, q) => Math.max(1, Math.round(n * q));

/** xorshift32: the same numbers, 0 to 1, every time for the same seed. */
export function seeded (seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function canvas (w, h = w) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** A soft round glow: full colour at the centre fading to nothing. */
export function glow (r, rgb, core = 0) {
  const c = canvas(r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  if (core) gr.addColorStop(core, `rgba(${rgb},0.55)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

/** A four-pointed glint with a soft centre. */
export function glint (r, rgb) {
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

// Value noise from fixed tables, so a scene looks the same at every start.
const NT = new Float32Array(512), PM = new Uint8Array(512);
{
  const r = seeded(7); for (let i = 0; i < 512; i++) NT[i] = r();
  const q = seeded(19), p = []; for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(q() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PM[i] = p[i & 255];
}
export function noise (x) {
  const i = Math.floor(x); let f = x - i; const a = NT[i & 511], b = NT[(i + 1) & 511];
  f = f * f * (3 - 2 * f); return a + (b - a) * f;
}
const hash2 = (x, y) => NT[PM[(PM[x & 255] + y) & 255]];
export function noise2 (x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y) => noise2(x, y) * 0.5 + noise2(x * 2.03, y * 2.03) * 0.25 + noise2(x * 4.1, y * 4.1) * 0.15 + noise2(x * 8.3, y * 8.3) * 0.1;

export const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export const scaleFor = (w, h) => clamp(Math.min(w, h) / 900, 0.55, 1.6);

/** The bass against its own recent level: 0 between beats, towards 1 on one. */
export function beatMeter () {
  let avg = 0, buf = null;
  return analyser => {
    if (!analyser) { avg *= 0.95; return 0; }
    const n = Math.min(analyser.frequencyBinCount || 0, 512);
    if (!n) return 0;
    if (!buf || buf.length !== n) buf = new Uint8Array(n);
    analyser.getByteFrequencyData(buf);
    // the lowest bins: below about 200 Hz at 44.1 or 48 kHz with 1024 points
    const k = Math.max(2, Math.round(n / 64));
    let sum = 0; for (let i = 1; i <= k; i++) sum += buf[i];
    const bass = sum / k / 255;
    avg += (bass - avg) * 0.04;
    return clamp((bass - avg) / (avg + 0.08) * 1.6, 0, 1);
  };
}
