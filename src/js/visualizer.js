/**
 * BM Player — Audio Visualizer
 * Modes: bars | radial | wave | particles | fluid | off
 * Falls back to beautiful synthetic animation when no audio stream is available.
  *
 * NOTE: this class prefers a real AnalyserNode whenever one is attached, and
 * only falls back to the synthetic path below when there isn't one. Since
 * v3.1.0 audio-engine.js supplies a real analyser for any audio-only file the
 * browser can decode, so the bars react to the actual signal. mpv-backed
 * playback (video, and codecs Chromium can't decode) still gets the synth.
*/

import { FluidFX } from './fluid.js';

/* v3.29.0: an analyser any visualiser falls back on, the audio shadow's while
   mpv plays a song (audio-shadow.js). One made after the song started finds
   it here; those that exist are given it directly. */
let SHARED = null;
export function setSharedAnalyser (a) { SHARED = a || null; }

function hsl2rgb (h, s, l) {
  const k = n => (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/* v3.28.0: the visualiser's settings, kept, and shared by every visualiser
   (the visual mode for audio and the music player's). Set in the panel that
   opens from their settings button (viz-settings.js). */
const VIZ_KEY = 'bm_viz';
export const VIZ_DEFAULTS = { style: 'bars', colors: 'auto', sensitivity: 1, bars: 80, smoothing: 0.8 };
export function vizSettings() {
  try { return { ...VIZ_DEFAULTS, ...JSON.parse(localStorage.getItem(VIZ_KEY) || '{}') }; } catch { return { ...VIZ_DEFAULTS }; }
}
export function saveVizSettings(o) { try { localStorage.setItem(VIZ_KEY, JSON.stringify(o)); } catch {} }
const ALL = new Set();
export const allVisualisers = () => [...ALL];
// The hue of a CSS colour (#rgb, #rrggbb or rgb()), for the Theme colours.
function hueOf(c) {
  let r, g, b, m;
  if ((m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c))) { const h = m[1].length === 3 ? m[1].replace(/./g, x => x + x) : m[1]; [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  else if ((m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c))) [r, g, b] = m.slice(1, 4).map(Number);
  else return null;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export class Visualizer {
  constructor (canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas?.getContext('2d');
    this.mode     = 'bars';
    this.active   = false;
    this._tick    = 0;
    this._raf     = null;

    // Web Audio
    this.audioCtx = null;
    this.analyser = null;
    this.freqData = null;
    this.timeData = null;

    // Synthetic state
    this._synthValues  = new Float32Array(128).fill(0);
    this._particles    = [];
    this._hue          = 220;
    this.opts          = vizSettings();
    ALL.add(this);

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize () {
    if (!this.canvas) return;
    this.canvas.width  = this.canvas.offsetWidth  || 800;
    this.canvas.height = this.canvas.offsetHeight || 400;
  }

  // ── Public control ──────────────────────────────────
  setOptions (o) { this.opts = { ...this.opts, ...o }; }

  setMode (mode) {
    this.mode = mode;
    if (mode !== 'fluid') { this._fluid?.setMode('off'); if (this._fluidCanvas) this._fluidCanvas.style.display = 'none'; }
    if (mode === 'off') { this.stop(); return; }
    if (!this.active) this.start();
  }

  start () {
    if (this.active || this.mode === 'off') return;
    this.active = true;
    this.canvas?.classList.add('active');
    this._loop();
  }

  stop () {
    this.active = false;
    this.canvas?.classList.remove('active');
    cancelAnimationFrame(this._raf);
    this.ctx?.clearRect(0, 0, this.canvas?.width, this.canvas?.height);
    this._fluid?.setMode('off');
    if (this._fluidCanvas) this._fluidCanvas.style.display = 'none';
  }

  // The analyser to read: this visualiser's own (the in-app engine's), or
  // the shared one (the audio shadow's), with buffers sized to it.
  _an () {
    const an = this.analyser || SHARED; if (!an) return null;
    if (!this._fd || this._fd.length !== an.frequencyBinCount) this._fd = new Uint8Array(an.frequencyBinCount);
    if (!this._td || this._td.length !== an.fftSize) this._td = new Uint8Array(an.fftSize);
    return an;
  }

  /** Try to connect a media element (audio or video) for real analysis */
  connectElement (mediaEl) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.fftSize);
        this.analyser.connect(this.audioCtx.destination);
      }
      const src = this.audioCtx.createMediaElementSource(mediaEl);
      src.connect(this.analyser);
    } catch (_) { /* unsupported codec — use synthetic */ }
  }

  // ── Main render loop ─────────────────────────────────
  _loop () {
    if (!this.active) return;
    this._raf = requestAnimationFrame(() => this._loop());
    this._tick++;
    this._draw();
  }

  _getFreq () {
    let raw;
    const an = this._an();
    if (an) {
      an.smoothingTimeConstant = Math.max(0, Math.min(0.95, this.opts.smoothing));
      an.getByteFrequencyData(this._fd);
      raw = this._fd;
    } else raw = this._synth();
    return this._bands(raw);
  }

  // The chosen number of bars, spaced the way we hear (more of them for the
  // low notes), scaled by the sensitivity. The top quarter of the spectrum
  // is left out: music has little up there.
  _bands (raw) {
    const n = Math.max(8, Math.min(256, Math.round(this.opts.bars) || 80)), g = this.opts.sensitivity || 1;
    const use = Math.max(1, Math.floor(raw.length * 0.75));
    if (!this._band || this._band.length !== n) this._band = new Uint8Array(n);
    for (let b = 0; b < n; b++) {
      const a = Math.floor(use * Math.pow(b / n, 1.6)), z = Math.max(a + 1, Math.floor(use * Math.pow((b + 1) / n, 1.6)));
      let m = 0; for (let k = a; k < z && k < raw.length; k++) if (raw[k] > m) m = raw[k];
      this._band[b] = Math.min(255, m * g);
    }
    return this._band;
  }

  // A colour: the style's own (h, s, l) for 'auto', or the chosen scheme's,
  // from the level v (0 to 1) and the place pos (0 to 1) along the display.
  _col (h, s, l, v, pos, a) {
    switch (this.opts.colors) {
      case 'theme': {
        const th = document.documentElement.getAttribute('data-theme');
        if (this._thName !== th) { this._thName = th; this._thHue = hueOf(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) ?? 220; }
        return `hsla(${this._thHue + v * 35}, 85%, ${55 + v * 20}%, ${a})`;
      }
      case 'fire':    return `hsla(${v * 52}, 100%, ${42 + v * 26}%, ${a})`;
      case 'ice':     return `hsla(${188 + v * 26}, 85%, ${62 + v * 22}%, ${a})`;
      case 'rainbow': return `hsla(${(pos * 330 + this._tick * 0.4) % 360}, 95%, 64%, ${a})`;
      case 'mono':    return `hsla(0, 0%, ${70 + v * 28}%, ${a})`;
      default:        return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }
  }

  _getTime () {
    const an = this._an();
    if (an) { an.getByteTimeDomainData(this._td); return this._td; }
    // Synthesise time-domain
    const arr = new Uint8Array(128);
    const t   = this._tick * 0.04;
    for (let i = 0; i < 128; i++) {
      arr[i] = 128 + Math.sin(t + i * 0.3) * 40 * this._synthValues[i % this._synthValues.length] / 255;
    }
    return arr;
  }

  _synth () {
    const t  = this._tick;
    const sv = this._synthValues;
    for (let i = 0; i < sv.length; i++) {
      const target = (
        Math.abs(Math.sin(t * 0.03 + i * 0.15)) * 180 +
        Math.abs(Math.sin(t * 0.05 + i * 0.08)) * 60  +
        Math.abs(Math.sin(t * 0.008 + i * 0.4)) * 30
      );
      sv[i] += (target - sv[i]) * 0.08;
    }
    return new Uint8Array(sv.map(v => Math.min(255, v)));
  }

  _draw () {
    if (!this.ctx || !this.canvas) return;
    switch (this.mode) {
      case 'bars':     this._drawBars();     break;
      case 'radial':   this._drawRadial();   break;
      case 'wave':     this._drawWave();     break;
      case 'particles':this._drawParticles();break;
      case 'fluid':    this._drawFluid();    break;
    }
  }

  // ── BARS ─────────────────────────────────────────────
  // ── FLUID (v3.29.0) ── The Flow theme's fluid, moved by the music: a beat in
  // the bass sends a plume up from the bottom, the mids stir the middle and the
  // treble sparks near the top, each as strong and as large as it is loud. The
  // colours follow the sound's brightness, or the chosen colours, and in
  // silence nothing is added, so the flow fades. Without WebGL, or in Lite,
  // it draws bars instead.
  _drawFluid () {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this._fluid && !this._fluidFailed) this._makeFluid();
    if (!this._fluid) { this._drawBars(); return; }
    const fc = this._fluidCanvas, c = this.canvas, px = v => v + 'px';
    fc.style.display = '';
    if (fc.style.left !== px(c.offsetLeft)) fc.style.left = px(c.offsetLeft);
    if (fc.style.top !== px(c.offsetTop)) fc.style.top = px(c.offsetTop);
    if (fc.style.width !== px(c.offsetWidth)) fc.style.width = px(c.offsetWidth);
    if (fc.style.height !== px(c.offsetHeight)) fc.style.height = px(c.offsetHeight);
    if (this._fluid.mode !== 'fluid') this._fluid.setMode('fluid');
    this._feedFluid(this._getFreq());
  }

  _makeFluid () {
    if (document.documentElement.classList.contains('lite-mode') || !this.canvas?.parentNode) { this._fluidFailed = true; return; }
    try {
      const fc = document.createElement('canvas');
      fc.className = 'viz-fluid-canvas';
      fc.style.cssText = 'position:absolute;pointer-events:none;';
      const z = getComputedStyle(this.canvas).zIndex; if (z && z !== 'auto') fc.style.zIndex = z;
      this.canvas.parentNode.insertBefore(fc, this.canvas.nextSibling);   // under what follows it
      this._fluidCanvas = fc;
      this._fluid = new FluidFX(fc);
      this._fluid.audioDriven = true;
      this._fluid.setFlow({ swirl: 1.25, trail: 1.15 });
    } catch (e) {
      console.warn('[BM Player] fluid visualiser unavailable, drawing bars:', e);
      this._fluidFailed = true; this._fluidCanvas?.remove(); this._fluidCanvas = null; this._fluid = null;
    }
  }

  _feedFluid (freq) {
    const f = this._fluid, n = freq.length, now = performance.now();
    const band = (a, b) => { let t = 0; for (let i = a; i < b; i++) t += freq[i]; return t / Math.max(1, b - a) / 255; };
    const b1 = Math.max(1, Math.round(n * 0.12)), b2 = Math.max(b1 + 1, Math.round(n * 0.5));
    const bass = band(0, b1), mid = band(b1, b2), treble = band(b2, n);
    let num = 0, den = 0; for (let i = 0; i < n; i++) { num += i * freq[i]; den += freq[i]; }
    const bright = den ? num / den / n : 0;   // where the sound's weight sits: 0 dull, 1 bright
    const st = this._fl || (this._fl = { bassAvg: 0, lastBass: 0, lastMid: 0, lastHi: 0, drift: Math.random(), splats: 0 });
    st.bassAvg += (bass - st.bassAvg) * 0.04; st.drift = (st.drift + 0.0006) % 1;
    const dye = (v, pos, k) => this._rgb(v, pos, bright, st.drift).map(x => x * k);
    // a beat: the bass rising clearly above its recent level
    if (bass > 0.22 && bass > st.bassAvg * 1.2 && now - st.lastBass > 140) {
      st.lastBass = now; st.splats++;
      f._splat(0.25 + Math.random() * 0.5, 0.06, (Math.random() - 0.5) * 400, 700 + bass * 2600, dye(bass, 0.1, 0.25 + bass * 0.35), 1.2 + bass * 1.8);
    }
    if (mid > 0.1 && now - st.lastMid > 70) {
      st.lastMid = now; st.splats++;
      const a = Math.random() * Math.PI * 2, p = 250 + mid * 1500;
      f._splat(0.12 + Math.random() * 0.76, 0.28 + Math.random() * 0.44, Math.cos(a) * p, Math.sin(a) * p, dye(mid, 0.5, 0.1 + mid * 0.3), 0.5 + mid * 1.1);
    }
    if (treble > 0.08 && now - st.lastHi > 90) {
      st.lastHi = now; st.splats++;
      f._splat(Math.random(), 0.72 + Math.random() * 0.22, (Math.random() - 0.5) * 520, -150 - treble * 450, dye(treble, 0.9, 0.12 + treble * 0.4), 0.3 + treble * 0.5);
    }
  }

  // A dye colour (red, green, blue from 0 to 1) in the chosen colours. In
  // Original each part of the sound has its own: the bass (pos near 0) is
  // magenta turning warm as it hits harder, the mids blue turning teal for a
  // brighter sound, and the treble golden sparks, whiter when loud.
  _rgb (v, pos, bright, drift) {
    let h = 0, s = 0.9, l = 0.55;
    switch (this.opts.colors) {
      case 'theme': {
        const th = document.documentElement.getAttribute('data-theme');
        if (this._thName !== th) { this._thName = th; this._thHue = hueOf(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) ?? 220; }
        h = this._thHue / 360 + (pos - 0.5) * 0.12; break;
      }
      case 'fire':    h = v * 0.14; l = 0.45 + v * 0.15; break;
      case 'ice':     h = 0.52 + v * 0.07; l = 0.6; break;
      case 'rainbow': h = pos + drift * 3; break;
      case 'mono':    s = 0; l = 0.8; break;
      default:
        if (pos < 0.3) h = 0.93 + v * 0.12 + drift * 0.05;
        else if (pos < 0.7) h = 0.62 - bright * 0.25 + drift * 0.1;
        else { h = 0.13 + drift * 0.03; s = 0.75; l = 0.6 + v * 0.2; }
    }
    return hsl2rgb(((h % 1) + 1) % 1, s, l);
  }

  _drawBars () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const freq  = this._getFreq();
    const len   = freq.length;

    ctx.clearRect(0, 0, W, H);

    const barW = (W / len) * 1.5;
    const gap  = barW * 0.15;

    for (let i = 0; i < len; i++) {
      const v = freq[i] / 255;
      const h = v * H * 0.85;
      const x = (i / len) * W;

      const hue = 220 + v * 140;
      const grad = ctx.createLinearGradient(x, H - h, x, H);
      grad.addColorStop(0, this._col(hue, 90, 68, v, i / len, 0.95));
      grad.addColorStop(1, this._col(hue - 20, 100, 40, v * 0.6, i / len, 0.3));

      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = Math.min(barW * 0.4, 3);
      ctx.roundRect
        ? ctx.roundRect(x, H - h, barW - gap, h, [r, r, 0, 0])
        : ctx.fillRect(x, H - h, barW - gap, h);
      ctx.fill();

      // Reflection
      ctx.fillStyle = this._col(hue, 90, 68, v, i / len, 0.08);
      ctx.fillRect(x, H, barW - gap, h * 0.25);
    }

    // Scanline bloom
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  // ── RADIAL ───────────────────────────────────────────
  _drawRadial () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const freq  = this._getFreq();
    const len   = freq.length;
    const cx    = W / 2;
    const cy    = H / 2;
    const baseR = Math.min(cx, cy) * 0.38;
    const t     = this._tick * 0.012;

    ctx.clearRect(0, 0, W, H);

    // Inner glow circle
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.9);
    innerGlow.addColorStop(0, this._col(220 + this._tick % 120, 80, 60, 0.5, 0.5, 0.12));
    innerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 0.9, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < len; i++) {
      const v     = freq[i] / 255;
      const angle = (i / len) * Math.PI * 2 - Math.PI / 2 + t;
      const inner = baseR;
      const outer = baseR + v * baseR * 1.6;
      const hue   = (i / len) * 360 + this._tick * 0.4;

      ctx.strokeStyle = this._col(hue, 100, 65, v, i / len, 0.4 + v * 0.6);
      ctx.lineWidth   = 2.2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.stroke();

      // Mirror
      ctx.strokeStyle = this._col(hue, 100, 65, v, i / len, (0.4 + v * 0.6) * 0.3);
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle + Math.PI) * inner, cy + Math.sin(angle + Math.PI) * inner);
      ctx.lineTo(cx + Math.cos(angle + Math.PI) * outer * 0.6, cy + Math.sin(angle + Math.PI) * outer * 0.6);
      ctx.stroke();
    }
  }

  // ── WAVE ─────────────────────────────────────────────
  _drawWave () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const time  = this._getTime();
    const freq  = this._getFreq();
    const avg   = freq.reduce((a, b) => a + b, 0) / freq.length / 255;
    const cy    = H / 2;

    ctx.clearRect(0, 0, W, H);

    // Glow layers
    const layers = [
      { w: 6, a: 0.10 }, { w: 3, a: 0.25 }, { w: 1.5, a: 0.9 }
    ];
    const hue = 200 + avg * 80;

    layers.forEach(({ w, a }) => {
      ctx.strokeStyle = this._col(hue, 100, 65, avg, 0.5, a);
      ctx.lineWidth   = w;
      ctx.shadowColor = this._col(hue, 100, 65, avg, 0.5, 0.6);
      ctx.shadowBlur  = w * 6;
      ctx.beginPath();
      time.forEach((v, i) => {
        const x = (i / time.length) * W;
        const y = cy + ((v - 128) / 128) * H * 0.42;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

    // Second harmonics (slightly offset)
    ctx.strokeStyle = this._col(hue + 40, 80, 70, avg, 0.7, 0.15);
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    time.forEach((v, i) => {
      const x = (i / time.length) * W;
      const y = cy + ((v - 128) / 128) * H * 0.25 + Math.sin(i * 0.15 + this._tick * 0.04) * 8;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // ── PARTICLES ───────────────────────────────────────
  _drawParticles () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const freq  = this._getFreq();
    const avg   = freq.reduce((a, b) => a + b, 0) / freq.length / 255;

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, W, H);

    // Spawn particles
    if (this._tick % 2 === 0) {
      const bass = freq[2] / 255;
      const count = 1 + Math.floor(bass * 4);
      for (let i = 0; i < count; i++) {
        this._particles.push({
          x: W / 2 + (Math.random() - 0.5) * 80 * bass,
          y: H / 2 + (Math.random() - 0.5) * 80 * bass,
          vx: (Math.random() - 0.5) * 3 * (1 + avg * 3),
          vy: (Math.random() - 0.5) * 3 * (1 + avg * 3) - 1.5,
          life: 1.0,
          hue: 200 + Math.random() * 140,
          v: bass, pos: Math.random(),
          size: 1 + Math.random() * 4 * bass,
        });
      }
    }

    // Update & draw particles
    this._particles = this._particles.filter(p => {
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.04;
      p.life -= 0.018;
      if (p.life <= 0) return false;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = this._col(p.hue, 100, 70, p.v, p.pos, p.life * 0.9);
      ctx.shadowColor= this._col(p.hue, 100, 70, p.v, p.pos, 0.5);
      ctx.shadowBlur = p.size * 3;
      ctx.fill();
      ctx.shadowBlur = 0;
      return true;
    });

    // Cap particles
    if (this._particles.length > 400) this._particles.splice(0, 60);
  }
}
