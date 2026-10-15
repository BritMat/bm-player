/**
 * FlowToy: Flow as a fluid simulator to play with (v3.42.0).
 *
 * The home screen's Flow background is a real fluid (fluid.js, after Pavel
 * Dobryakov's WebGL Fluid Simulation, MIT). In this mode it is handed to
 * the fingers: every finger (or the mouse) pushes it and pours colour into
 * it, a tap blooms, and its look and feel are the player's to set: colours,
 * swirl, how long the colour lasts, how quickly it settles, the brush, glow,
 * neon contour lines, shading, stirring by itself, moving with the music,
 * and on a phone, pouring when the phone is tilted.
 *
 * It borrows the background's fluid rather than starting a second one (a
 * second WebGL context would double the memory), and gives it back as it
 * was on leave(). The fluid's own governor still steps the quality down
 * when frames are slow, from the level chosen here.
 *
 * Shared by the desktop's welcome screen and the phone's home tab;
 * buildToyPanel() makes the settings as plain elements each styles.
 */
import { perf } from '../perf.js';
import { PALETTES } from '../fluid.js';

const KEY = 'bm_flow_toy';
export const TOY_DEFAULTS = Object.freeze({
  colors: 'rainbow', color: '#5b6ff8', swirl: 30, fade: 1, settle: 0.2, brush: 1, force: 1,
  glow: 0.6, lines: false, shading: true, auto: true, music: true, tilt: false, quality: 'auto',
});
export const TOY_COLORS = [['rainbow', 'Rainbow'], ['random', 'Random'], ['theme', 'Theme'], ['fire', 'Fire'], ['ice', 'Ice'], ['neon', 'Neon'], ['single', 'One colour']];
// Quality levels, best first. 'ultra' keeps the colour pixel for pixel with the screen.
const LEVELS = [
  { name: 'ultra', sim: 256, dyeScale: 1, maxPixels: 2.4e6, iterations: 22, fps: 60 },
  { name: 'high', sim: 192, dye: 1024, iterations: 20, fps: 60 },
  { name: 'medium', sim: 128, dye: 640, iterations: 14, fps: 60 },
  { name: 'low', sim: 96, dye: 384, iterations: 8, fps: 30 },
];

export function loadToy () {
  try { return { ...TOY_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { return { ...TOY_DEFAULTS }; }
}
function saveToy (s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }

function hsv (h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
}
function hexRgb (h) { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x5b6ff8; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

export class FlowToy {
  /**
   * fx: a FluidFX. surface: the element the fingers play on (over the
   * fluid's canvas). analyser(): the music's AnalyserNode, or null.
   */
  constructor ({ fx, surface, analyser = () => null }) {
    this.fx = fx; this.surface = surface; this.analyser = analyser;
    this.s = loadToy();
    this.on = false; this.paused = false;
    this._pointers = new Map();
    this._lastTouch = 0; this._nextAuto = 0; this._hue = Math.random();
    this._bands = null; this._bassAvg = 0; this._nextBeat = 0;
    this._em = [0, 1, 2].map(i => ({ ph: i * 2.1 + Math.random(), x: 0.5, y: 0.5, px: 0.5, py: 0.5 }));
    this._down = e => this._pointer(e, 'down');
    this._move = e => this._pointer(e, 'move');
    this._up = e => this._pointer(e, 'up');
    this._tilt = e => this._onTilt(e);
  }

  get settings () { return this.s; }

  enter () {
    if (this.on || !this.fx) return;
    this.on = true; this.paused = false;
    this._saved = this.fx.snapshot();
    const sf = this.surface;
    sf.addEventListener('pointerdown', this._down);
    sf.addEventListener('pointermove', this._move);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) sf.addEventListener(ev, this._up);
    this._apply(true);
    this.fx.audioDriven = true;                 // no ambient splats of its own: this stirs it
    this.fx.onFrame = (dt, now) => this._frame(dt, now);
    this.fx.setMode('fluid');
    this.fx.resume();
    this._lastTouch = performance.now();
  }

  leave () {
    if (!this.on) return;
    this.on = false;
    const sf = this.surface;
    sf.removeEventListener('pointerdown', this._down);
    sf.removeEventListener('pointermove', this._move);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) sf.removeEventListener(ev, this._up);
    window.removeEventListener('deviceorientation', this._tilt);
    this._pointers.clear();
    this.fx.setGravity(0, 0);
    this.fx.restore(this._saved);
    if (this.paused) { this.paused = false; this.fx.resume(); }
  }

  /** One setting changed (or several): applied at once, and kept. */
  set (patch) {
    const qualityWas = this.s.quality, linesWas = this.s.lines;
    Object.assign(this.s, patch);
    saveToy(this.s);
    if (this.on) this._apply(this.s.quality !== qualityWas || this.s.lines !== linesWas);
  }
  reset () { this.s = { ...TOY_DEFAULTS }; saveToy(this.s); if (this.on) this._apply(true); }

  pause (on = !this.paused) {
    if (!this.on) return;
    this.paused = !!on;
    if (this.paused) this.fx.pause(); else this.fx.resume();
  }
  clear () { if (this.on) this.fx.clear(); }

  /** A handful of colour at once, all over: the toy's "surprise me". */
  burst (n = 8) {
    if (!this.on) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, p = 700 + Math.random() * 900;
      this.fx.splat(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8, Math.cos(a) * p, Math.sin(a) * p, this._color(1.2), this._radius(1.4));
    }
    if (this.paused) this.pause(false);
  }

  _apply (rebuild) {
    const s = this.s, fx = this.fx;
    for (const l of LEVELS) { l.curl = s.swirl; l.dissipation = s.fade; l.velDissipation = s.settle; l.radius = 0.25 * s.brush; }
    const tier = perf.tier === 'high' ? 'high' : perf.tier === 'low' ? 'low' : 'medium';
    const want = s.quality === 'auto' ? tier : s.quality;
    const at = Math.max(0, LEVELS.findIndex(l => l.name === want));
    const look = f => {
      f.flow = { palette: null, intensity: 1, radius: 1, swirl: 1, trail: 1 };
      f.setBloom(s.glow, { threshold: 0.08, knee: 0.7 });
      if (s.lines) f.setNeon(true, 1.5, { edge: 1.1, fill: 0.5, level0: 0.05, octaves: 1.6, width: 1.6 });
      else f.setNeon(false);
      f.shading = !!s.shading;
    };
    if (rebuild) fx.configure(f => { look(f); f.useLadder('toy', LEVELS.slice(at), 0, s.quality === 'auto'); });
    else { fx.setBloom(s.glow, { threshold: 0.08, knee: 0.7 }); fx.shading = !!s.shading; }
    if (s.tilt && typeof DeviceOrientationEvent !== 'undefined') window.addEventListener('deviceorientation', this._tilt);
    else { window.removeEventListener('deviceorientation', this._tilt); fx.setGravity(0, 0); }
  }

  _radius (k = 1) {
    const c = this.fx.canvas, aspect = c.width / Math.max(1, c.height);
    return 0.25 / 100 * this.s.brush * k * (aspect > 1 ? aspect : 1);
  }

  /** A colour for the mode chosen, at a dye's strength (about 0.15, as Dobryakov's). */
  _color (k = 1, hue = null) {
    const s = this.s, b = 0.15 * k;
    let c;
    switch (s.colors) {
      case 'rainbow': c = hsv(hue ?? (this._hue = (this._hue + 0.013) % 1), 1, 1); break;
      case 'theme': { const p = PALETTES[this.fx.theme] || PALETTES.dark; c = p[Math.floor(Math.random() * p.length)]; break; }
      case 'fire': c = hsv(Math.random() * 0.12, 1, 1); break;
      case 'ice': c = hsv(0.5 + Math.random() * 0.13, 0.85, 1); break;
      case 'neon': c = [[1, 0.1, 0.8], [0.1, 1, 1], [0.6, 1, 0.1], [1, 0.95, 0.1]][Math.floor(Math.random() * 4)]; break;
      case 'single': c = hexRgb(s.color); break;
      default: c = hsv(Math.random(), 1, 1);
    }
    return [c[0] * b, c[1] * b, c[2] * b];
  }

  _uv (e) {
    const r = this.fx.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / Math.max(1, r.width), 1 - (e.clientY - r.top) / Math.max(1, r.height)];
  }

  _pointer (e, kind) {
    if (!this.on) return;
    const now = performance.now();
    this._lastTouch = now;
    const [x, y] = this._uv(e);
    let p = this._pointers.get(e.pointerId);
    if (kind === 'down') {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { this.surface.setPointerCapture(e.pointerId); } catch (_) {}
      p = { x, y, px: x, py: y, down: true, moved: 0, at: now, color: this._color(), hue: Math.random() };
      this._pointers.set(e.pointerId, p);
      if (this.paused) this.pause(false);
      return;
    }
    if (!p) {
      // The mouse moving over the toy with no button down stirs it gently, as on the desktop's welcome screen.
      if (kind === 'move' && e.pointerType === 'mouse') {
        const q = this._hover || (this._hover = { x, y });
        this._splatMove(x, y, q.x, q.y, 0.35, this._color(0.5));
        q.x = x; q.y = y;
      }
      return;
    }
    if (kind === 'move') {
      p.moved += Math.hypot(x - p.x, y - p.y);
      if (now - p.at > 140) { p.color = this._color(); p.at = now; }
      this._splatMove(x, y, p.x, p.y, 1, p.color);
      p.px = p.x; p.py = p.y; p.x = x; p.y = y;
      return;
    }
    // up: a tap that hardly moved blooms like a flower
    if (p.moved < 0.01) {
      const c = this._color(1.1);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.fx.splat(x, y, Math.cos(a) * 520 * this.s.force, Math.sin(a) * 520 * this.s.force, c, this._radius(0.9)); }
    }
    this._pointers.delete(e.pointerId);
  }

  _splatMove (x, y, px, py, k, color) {
    const c = this.fx.canvas, aspect = c.width / Math.max(1, c.height);
    let dx = x - px, dy = y - py;
    if (aspect < 1) dx *= aspect; else dy /= aspect;
    const f = 6000 * this.s.force * k;
    this.fx.splat(x, y, dx * f, dy * f, color, this._radius());
  }

  _onTilt (e) {
    if (e.beta == null || e.gamma == null) return;
    const rad = Math.PI / 180;
    let gx = Math.sin((e.gamma || 0) * rad), gy = -Math.sin((e.beta || 0) * rad);
    const ang = (screen.orientation?.angle ?? window.orientation ?? 0) * rad;
    if (ang) { const c = Math.cos(ang), s = Math.sin(ang); [gx, gy] = [gx * c + gy * s, -gx * s + gy * c]; }
    this.fx.setGravity(gx * 900, gy * 900);
  }

  _frame (dt, now) {
    const s = this.s;
    // The music: three emitters wander and pour with the bass, the middle and the top; a strong bass note blooms.
    const an = s.music ? this.analyser() : null;
    if (an) {
      const n = an.frequencyBinCount;
      if (!this._bands || this._bands.length !== n) this._bands = new Uint8Array(n);
      an.getByteFrequencyData(this._bands);
      const band = (a, b) => { let t = 0; for (let i = a; i < b && i < n; i++) t += this._bands[i]; return t / Math.max(1, Math.min(b, n) - a) / 255; };
      const lv = [band(1, 7), band(7, 48), band(48, 180)];
      if (lv[0] + lv[1] + lv[2] > 0.06) {
        this._em.forEach((m, i) => {
          m.ph += dt * (0.35 + i * 0.17);
          m.px = m.x; m.py = m.y;
          m.x = 0.5 + 0.36 * Math.sin(m.ph * 1.3 + i) * Math.cos(m.ph * 0.41);
          m.y = 0.5 + 0.34 * Math.sin(m.ph * 0.9 + i * 2.2);
          const e = Math.pow(lv[i], 1.6);
          if (e > 0.02) this._splatMove(m.x, m.y, m.px, m.py, 0.9 + e * 3, this._color(0.35 + e * 1.4, (i * 0.33 + now / 9000) % 1));
        });
        this._bassAvg += (lv[0] - this._bassAvg) * 0.05;
        if (lv[0] > this._bassAvg * 1.35 + 0.08 && now > this._nextBeat) {
          this._nextBeat = now + 260;
          const x = 0.2 + Math.random() * 0.6, y = 0.2 + Math.random() * 0.6, c = this._color(1.3);
          for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + Math.random(); this.fx.splat(x, y, Math.cos(a) * 650, Math.sin(a) * 650, c, this._radius(1.1)); }
        }
        this._lastTouch = Math.max(this._lastTouch, now - 1500);   // the music stirs it: no stirring by itself as well
      }
    }
    // Stirring by itself while nobody plays.
    if (s.auto && now - this._lastTouch > 2500 && now > this._nextAuto) {
      this._nextAuto = now + 900 + Math.random() * 1100;
      const a = Math.random() * Math.PI * 2, p = 600 + Math.random() * 700;
      this.fx.splat(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8, Math.cos(a) * p, Math.sin(a) * p, this._color(0.9), this._radius());
    }
  }
}

/**
 * The toy's settings as plain elements in root: rows of a label and a
 * control (fp-row, fp-label, fp-seg, fp-range, fp-switch), styled by each
 * platform's CSS. Changes go straight to the toy.
 */
export function buildToyPanel (toy, root, { tilt = typeof DeviceOrientationEvent !== 'undefined' && 'ontouchstart' in window } = {}) {
  const s = toy.settings;
  root.textContent = '';
  const row = (label, ctl) => { const r = document.createElement('div'); r.className = 'fp-row'; const l = document.createElement('span'); l.className = 'fp-label'; l.textContent = label; r.append(l, ctl); root.appendChild(r); return r; };
  const seg = (key, opts, after) => {
    const box = document.createElement('div'); box.className = 'fp-seg';
    for (const [v, label] of opts) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.textContent = label;
      b.classList.toggle('on', String(s[key]) === v);
      b.addEventListener('click', () => { for (const x of box.children) x.classList.toggle('on', x === b); toy.set({ [key]: v }); after?.(v); });
      box.appendChild(b);
    }
    return box;
  };
  const range = (key, min, max, step, fmt) => {
    const w = document.createElement('div'); w.className = 'fp-range';
    const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = s[key];
    const v = document.createElement('span'); v.className = 'fp-val'; v.textContent = fmt(+s[key]);
    i.addEventListener('input', () => { v.textContent = fmt(+i.value); toy.set({ [key]: +i.value }); });
    w.append(i, v);
    return w;
  };
  const sw = key => {
    const l = document.createElement('label'); l.className = 'fp-switch';
    const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!s[key];
    i.addEventListener('change', () => toy.set({ [key]: i.checked }));
    l.appendChild(i);
    return l;
  };
  const pick = document.createElement('input');
  pick.type = 'color'; pick.className = 'fp-color'; pick.value = s.color;
  pick.addEventListener('input', () => toy.set({ color: pick.value, colors: 'single' }));
  const colorRow = row('Colours', seg('colors', TOY_COLORS, v => { pickRow.hidden = v !== 'single'; }));
  colorRow.classList.add('fp-wide');
  const pickRow = row('Colour', pick); pickRow.hidden = s.colors !== 'single';
  row('Swirl', range('swirl', 0, 60, 1, v => String(Math.round(v))));
  row('Colour lasts', range('fade', 0.1, 4, 0.05, v => v < 0.35 ? 'long' : v > 2.5 ? 'short' : v.toFixed(1)));
  row('Settles', range('settle', 0, 1.2, 0.02, v => v < 0.05 ? 'never' : v.toFixed(2)));
  row('Brush', range('brush', 0.3, 3, 0.05, v => v.toFixed(1) + '×'));
  row('Push', range('force', 0.2, 3, 0.05, v => v.toFixed(1) + '×'));
  row('Glow', range('glow', 0, 1.5, 0.05, v => v < 0.03 ? 'off' : v.toFixed(2)));
  row('Neon lines', sw('lines'));
  row('Shading', sw('shading'));
  row('Stirs by itself', sw('auto'));
  row('Moves with music', sw('music'));
  if (tilt) row('Tilt to pour', sw('tilt'));
  row('Quality', seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']])).classList.add('fp-wide');
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'fp-reset'; reset.textContent = 'Reset';
  reset.addEventListener('click', () => { toy.reset(); buildToyPanel(toy, root, { tilt }); });
  root.appendChild(reset);
}
