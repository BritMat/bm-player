/**
 * BM Player — Audio Visualizer
 * Modes: bars | radial | wave | particles | fluid (Smoke) | flow (HD Flow) | neon | bubbles | milkdrop | off
 * Falls back to beautiful synthetic animation when no audio stream is available.
  *
 * NOTE: this class prefers a real AnalyserNode whenever one is attached, and
 * only falls back to the synthetic path below when there isn't one. Since
 * v3.1.0 audio-engine.js supplies a real analyser for any audio-only file the
 * browser can decode, so the bars react to the actual signal. mpv-backed
 * playback (video, and codecs Chromium can't decode) still gets the synth.
*/

import { FluidFX } from './fluid.js';
import { drawNeon, drawBubbles, drawParticles } from './viz-art.js';   // v3.31.0

/* MilkDrop (v3.32.0): butterchurn (MIT) plays the MilkDrop presets that
   Poweramp and Winamp are known for, on a WebGL canvas over the visualiser's.
   The presets come ready-built as functions (scripts/build-milkdrop.mjs), so
   the app's policy against eval holds. Both load the first time the style is
   chosen, and hear the same waveform as every other style. */
let MD_LOAD = null;
function loadMilkdrop () {
  if (!MD_LOAD) MD_LOAD = new Promise((res, rej) => {
    if (window.butterchurn) return res();
    const s = document.createElement('script');
    s.src = 'vendor/milkdrop/butterchurn.min.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('butterchurn did not load'));
    document.head.appendChild(s);
  }).then(() => import('../vendor/milkdrop/presets.js'));
  return MD_LOAD;
}

/* v3.29.0: an analyser any visualiser falls back on, the audio shadow's while
   mpv plays a song (audio-shadow.js). One made after the song started finds
   it here; those that exist are given it directly. */
let SHARED = null;
export function setSharedAnalyser (a) { SHARED = a || null; }

/* v3.33.0: the current album art, which every visualiser follows as it draws,
   including one made after the song began. It no longer depends on the
   audio analysis starting (a test machine where that failed showed none). */
let ART = null;
export function setSharedArt (url) { ART = url || null; }

function hsl2rgb (h, s, l) {
  const k = n => (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/* v3.28.0: the visualiser's settings, kept, and shared by every visualiser
   (the visual mode for audio and the music player's). Set in the panel that
   opens from their settings button (viz-settings.js). */
const VIZ_KEY = 'bm_viz';
export const VIZ_DEFAULTS = { style: 'bars', colors: 'auto', sensitivity: 1, bars: 80, smoothing: 0.8, spin: true, mdAuto: 30 };   // mdAuto: seconds per MilkDrop preset, 0 for never (v3.32.0)   // spin: Radial turns (v3.30.1)
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
    // A new style starts clean: no trails or state from the last (v3.31.0).
    if (mode !== this.mode) {
      this._neon = this._bub = this._pt = null;
      if (this.ctx) { this.ctx.globalCompositeOperation = 'source-over'; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    }
    this.mode = mode;
    if (mode !== 'fluid' && mode !== 'flow') { this._fluid?.halt?.(); if (this._fluidCanvas) this._fluidCanvas.style.display = 'none'; }   // halt: hidden, so no fade (v3.33.0)
    if (mode !== 'milkdrop' && this._mdCanvas) this._mdCanvas.style.display = 'none';
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
    this._fluid?.halt?.();
    if (this._fluidCanvas) this._fluidCanvas.style.display = 'none';
    if (this._mdCanvas) this._mdCanvas.style.display = 'none';
  }

  // How loud it is right now, 0 to 1, from the waveform (v3.31.0). The
  // spectrum fades out slowly after a pause (its smoothing, counted in frames),
  // the waveform goes flat at once: this is what tells the drawing styles that
  // the music stopped, so they make nothing new.
  _loudness () {
    if (this._ldTick === this._tick) return this._ld;
    const d = this._getTime(); let s = 0;
    for (let i = 0; i < d.length; i++) { const x = (d[i] - 128) / 128; s += x * x; }
    this._ldTick = this._tick; this._ld = Math.sqrt(s / Math.max(1, d.length));
    return this._ld;
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
    // At most about 72 frames a second (v3.30.1): on a 144 Hz screen every
    // style drew 144 times a second, twice the work for motion the eye cannot
    // tell apart. A 60 Hz screen draws every frame as before.
    const now = performance.now();
    if (now - (this._lastDraw || 0) < 12) return;
    this._lastDraw = now;
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
      // Fire is a flame (v3.30.1): blue at the root, quiet, and orange to
      // yellow at the tips, loud.
      case 'fire':    return v < 0.38 ? `hsla(${214 - v * 55}, 95%, ${46 + v * 28}%, ${a})` : `hsla(${(v - 0.38) * 82}, 100%, ${44 + v * 24}%, ${a})`;
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
      case 'particles':drawParticles(this);break;
      case 'neon':     drawNeon(this);     break;
      case 'bubbles':  drawBubbles(this);  break;
      case 'milkdrop': this._drawMilk();   break;
      case 'flow':     this._drawFluid();  break;
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
    // Smoke and HD Flow share the fluid: each sets it up its own way (v3.33.0).
    if (this._fluidStyle !== this.mode) {
      this._fluidStyle = this.mode;
      const f = this._fluid; f._baseTier = f._baseTier || f._tier;
      // HD Flow: neon threads on dark, not clouds. A fine brush, little dye per
      // stroke, a quick fade and a gentle glow (it filled the screen at first).
      // HD Flow (v3.34.0): Ultra (dye 2048) on a strong machine, neon (high-range
      // dye, tone-mapped) and a two-level glow. It looked dull and soft before.
      if (this.mode === 'flow') { f.setQuality({ high: 'ultra', medium: 'high' }[f._baseTier] || 'low'); f.setFlow({ swirl: 2.6, trail: 0.7, radius: 0.35 }); f.setNeon(true, 1.4); f.setBloom(0.6); }
      else { f.setQuality(f._baseTier); f.setFlow({ swirl: 1.7, trail: 0.42, radius: 0.6 }); f.setNeon(false); f.setBloom(0); }
    }
    if (this.mode === 'flow') this._feedFlow(this._getFreq()); else this._feedFluid(this._getFreq());
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
      this._fluid.setFlow({ swirl: 1.7, trail: 0.42, radius: 0.6 });   // smoke: curling, fading fast (v3.30.1)
    } catch (e) {
      console.warn('[BM Player] fluid visualiser unavailable, drawing bars:', e);
      this._fluidFailed = true; this._fluidCanvas?.remove(); this._fluidCanvas = null; this._fluid = null;
    }
  }

  // Four plumes of smoke rising from the bottom (v3.30.1), one for each part of
  // the sound: bass, low mids, high mids and treble. Each puffs as strongly as
  // its part is loud, a beat in the bass puffs harder, and a quiet part's plume
  // dies away. Thin and translucent, curling and fading fast: the screen
  // filled with fluid before.
  _feedFluid (freq) {
    const f = this._fluid, n = freq.length, now = performance.now();
    // Average and peak together (v3.33.0): a narrow sound, a pure tone, made
    // only a small average over its part, once the analyser grew finer.
    const band = (a, b) => { let t = 0, m = 0; for (let i = a; i < b; i++) { t += freq[i]; if (freq[i] > m) m = freq[i]; } return (t / Math.max(1, b - a) + m) / 2 / 255; };
    const cut = [0, 0.1, 0.3, 0.6, 1].map(c => Math.round(c * n));
    const lv = [0, 1, 2, 3].map(i => band(cut[i], Math.max(cut[i] + 1, cut[i + 1])));
    const st = this._fl || (this._fl = { last: 0, bassAvg: 0, splats: 0, drift: Math.random(), phase: [0, 1.7, 3.1, 4.4] });
    if (this._loudness() < 0.01) return;                 // silent or paused: no puffs
    st.bassAvg += (lv[0] - st.bassAvg) * 0.04; st.drift = (st.drift + 0.0006) % 1;
    if (now - st.last < 40) return;                       // about 25 puffs a second
    st.last = now;
    const X = [0.2, 0.4, 0.6, 0.8];
    for (let i = 0; i < 4; i++) {
      const v = lv[i]; if (v < 0.12) continue;   // a quiet part, or a pause fading out: no puff
      const beat = i === 0 && v > 0.22 && v > st.bassAvg * 1.2;
      const x = X[i] + Math.sin(now / 900 + st.phase[i]) * 0.035;     // a plume sways
      const side = Math.sin(now / 600 + st.phase[i]) * 90, up = 300 + v * 750 + (beat ? 700 : 0);
      const k = 0.05 + v * 0.11 + (beat ? 0.05 : 0);                  // thin smoke, but seen
      f._splat(x, 0.04, side, up, this._rgb(v, i / 3, 0, st.drift, i).map(c => c * k), 0.22 + v * 0.32 + (beat ? 0.2 : 0));
      st.splats++;
    }
  }

  // ── HD FLOW (v3.33.0) ── Four emitters wander the screen and stir the fluid
  // as they go, leaving their colour along the way, like a brush: faster and
  // denser as their part of the sound gets louder, and a beat in the bass
  // bursts. Strong swirl keeps the filaments fine, and the glow lights them.
  _feedFlow (freq) {
    const f = this._fluid, n = freq.length, now = performance.now();
    const band = (a, b) => { let t = 0, m = 0; for (let i = a; i < b; i++) { t += freq[i]; if (freq[i] > m) m = freq[i]; } return (t / Math.max(1, b - a) + m) / 2 / 255; };
    const cut = [0, 0.1, 0.3, 0.6, 1].map(c => Math.round(c * n));
    const lv = [0, 1, 2, 3].map(i => band(cut[i], Math.max(cut[i] + 1, cut[i + 1])));
    const st = this._fw || (this._fw = { t: now, last: 0, bassAvg: 0, splats: 0, drift: Math.random(),
      em: Array.from({ length: 4 }, (_, i) => ({ ph: Math.random() * 50, fx: 0.5 + Math.random() * 0.4, fy: 0.4 + Math.random() * 0.4, ox: Math.random() * 6.28, oy: Math.random() * 6.28, x: 0.2 + i * 0.2, y: 0.5 })) });
    const dt = Math.min(0.05, Math.max(0.001, (now - st.t) / 1000)); st.t = now;
    st.bassAvg += (lv[0] - st.bassAvg) * 0.05; st.drift = (st.drift + 0.0006) % 1;
    const quiet = this._loudness() < 0.01;
    const beat = !quiet && lv[0] > 0.3 && lv[0] > st.bassAvg * 1.25 && now - (st.beatAt || 0) > 200;
    if (beat) st.beatAt = now;
    const due = now - st.last >= 22; if (due) st.last = now;   // about 45 strokes a second each
    st.em.forEach((e, i) => {
      const v = lv[i];
      e.ph += dt * (0.5 + v * 1.8);   // sweeping: a moving brush draws a line, a still one a blob
      const nx = 0.5 + 0.38 * Math.sin(e.ph * e.fx + e.ox) * Math.cos(e.ph * 0.27 + e.oy);
      const ny = 0.5 + 0.36 * Math.sin(e.ph * e.fy + e.oy + i);
      const dx = nx - e.x, dy = ny - e.y; e.x = nx; e.y = ny;
      if (quiet || !due || v < 0.06) return;
      const len = Math.hypot(dx, dy) || 1e-6, force = 1800 + v * 5200;
      const col = this._rgb(v, i / 3, 0, st.drift, i).map(c => c * (0.3 + v * 0.9));   // high range: the tone map shapes it (v3.34.0)
      // Strokes along the way it came (up to three), sharing the dye, so a fast
      // emitter leaves one continuous thread rather than dots.
      const k = Math.min(3, Math.max(1, Math.ceil(len / 0.012)));
      const part = col.map(c => c / Math.sqrt(k));
      for (let j = 1; j <= k; j++) {
        const t = j / k;
        f._splat(e.x - dx * (1 - t), e.y - dy * (1 - t), dx / len * force, dy / len * force, part, 0.05 + v * 0.07);
      }
      st.splats++;
      if (beat && i < 2) {
        const a = Math.random() * Math.PI * 2;
        f._splat(e.x, e.y, Math.cos(a) * 4200, Math.sin(a) * 4200, col.map(c => c * 1.3), 0.25);
      }
    });
  }

  // A dye colour (red, green, blue from 0 to 1) in the chosen colours. In
  // Original each part of the sound has its own: the bass (pos near 0) is
  // magenta turning warm as it hits harder, the mids blue turning teal for a
  // brighter sound, and the treble golden sparks, whiter when loud.
  _rgb (v, pos, bright, drift, plume) {
    let h = 0, s = 0.9, l = 0.55;
    switch (this.opts.colors) {
      case 'theme': {
        const th = document.documentElement.getAttribute('data-theme');
        if (this._thName !== th) { this._thName = th; this._thHue = hueOf(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) ?? 220; }
        h = this._thHue / 360 + (pos - 0.5) * 0.12; break;
      }
      // Fire (v3.30.1): orange flames and blue ones, the plumes taking turns,
      // brighter as they get louder.
      case 'fire':
        if (plume % 2 === 1 || (plume === undefined && v < 0.38)) { h = 0.58 + v * 0.04; l = 0.48 + v * 0.22; }
        else { h = 0.03 + v * 0.09; l = 0.46 + v * 0.2; }
        break;
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

  // ── MILKDROP (v3.32.0) ── Bars while it loads, and instead if WebGL 2 is
  // missing or in Lite. Drawn at about 60% of the screen's pixels, at most
  // 1280 by 720: MilkDrop is soft by nature, and it saves the GPU a lot.
  _drawMilk () {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this._mdFailed || document.documentElement.classList.contains('lite-mode')) { this._drawBars(); return; }
    if (!this._md) { this._makeMilk(); this._drawBars(); return; }
    const mc = this._mdCanvas, c = this.canvas, px = v => v + 'px';
    mc.style.display = '';
    if (mc.style.left !== px(c.offsetLeft)) mc.style.left = px(c.offsetLeft);
    if (mc.style.top !== px(c.offsetTop)) mc.style.top = px(c.offsetTop);
    if (mc.style.width !== px(c.offsetWidth)) mc.style.width = px(c.offsetWidth);
    if (mc.style.height !== px(c.offsetHeight)) mc.style.height = px(c.offsetHeight);
    const w = Math.max(320, Math.min(1280, Math.round(c.offsetWidth * 0.6 * (window.devicePixelRatio || 1))));
    const h = Math.max(180, Math.round(w * c.offsetHeight / Math.max(1, c.offsetWidth)));
    if (w !== this._mdW || h !== this._mdH) { this._mdW = w; this._mdH = h; mc.width = w; mc.height = h; this._md.setRendererSize(w, h); }
    const td = this._getTime(), b = this._mdBuf || (this._mdBuf = new Uint8Array(1024));
    if (td.length >= 1024) b.set(td.subarray(0, 1024)); else for (let i = 0; i < 1024; i++) b[i] = td[Math.floor(i * td.length / 1024)];
    const every = this.opts.mdAuto ?? 30;
    if (every && performance.now() - this._mdAt > every * 1000) this.mdNext(2.5);
    try { this._md.render({ audioLevels: { timeByteArray: b, timeByteArrayL: b, timeByteArrayR: b } }); }
    catch (e) { console.warn('[BM Player] MilkDrop stopped, drawing bars:', e); this._mdFailed = true; mc.style.display = 'none'; }
  }

  _makeMilk () {
    if (this._mdLoading) return;
    this._mdLoading = true;
    loadMilkdrop().then(mod => {
      const fc = document.createElement('canvas');
      fc.className = 'viz-milk-canvas';
      fc.style.cssText = 'position:absolute;pointer-events:none;display:none;';
      const z = getComputedStyle(this.canvas).zIndex; if (z && z !== 'auto') fc.style.zIndex = z;
      this.canvas.parentNode.insertBefore(fc, this.canvas.nextSibling);
      const bc = window.butterchurn?.default || window.butterchurn;
      // butterchurn wants an audio context to build itself. It is given the
      // sound frame by frame, so an offline one does: no device, no thread.
      const actx = new OfflineAudioContext(2, 44100, 44100);
      this._md = bc.createVisualizer(actx, fc, { width: 640, height: 360, pixelRatio: 1, textureRatio: 1 });
      this._mdCanvas = fc; this._mdPresets = mod.PRESETS; this._mdNames = Object.keys(mod.PRESETS);
      this.mdNext(0);
    }).catch(e => { console.warn('[BM Player] MilkDrop unavailable, drawing bars:', e); this._mdFailed = true; });
  }

  /** Another MilkDrop preset, at random, blended over `blend` seconds. Its name, or null. */
  mdNext (blend = 2.5) {
    if (!this._md || !this._mdNames?.length) return null;
    const names = this._mdNames; let i;
    do { i = Math.floor(Math.random() * names.length); } while (names.length > 1 && names[i] === this._mdName);
    this._mdName = names[i]; this._mdAt = performance.now();
    try { this._md.loadPreset(this._mdPresets[this._mdName](), blend); }
    catch (e) { console.warn('[BM Player] MilkDrop preset failed:', this._mdName, e); }
    return this._mdName;
  }

  /** The album art for the middle of Radial (v3.32.0), or null for none. */
  setArt (url) {
    if (url === this._artUrl) return;
    this._artUrl = url || null; this._art = null;
    if (!url) return;
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { if (this._artUrl === url) this._art = im; };
    im.src = url;
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
    // Spin off (v3.30.1): the spokes stand still and so do their colours, which
    // drifting round the ring looked like turning too.
    const spin  = this.opts.spin !== false;
    const t     = spin ? this._tick * 0.012 : 0;
    const drift = spin ? this._tick * 0.4 : 0;

    ctx.clearRect(0, 0, W, H);

    // The inner glow: made again only when its colour or the size changes.
    const gHue = 220 + (spin ? Math.round((this._tick % 120) / 4) * 4 : 60);
    const gKey = `${W}x${H}|${gHue}|${this.opts.colors}|${this._thName || ''}`;
    if (this._rgKey !== gKey) {
      this._rgKey = gKey;
      this._rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.9);
      this._rg.addColorStop(0, this._col(gHue, 80, 60, 0.5, 0.5, 0.12));
      this._rg.addColorStop(1, 'transparent');
    }
    ctx.fillStyle = this._rg;
    ctx.beginPath(); ctx.arc(cx, cy, baseR * 0.9, 0, Math.PI * 2); ctx.fill();

    // The album art inside the ring (v3.32.0): turning with Spin, like a record,
    // and swelling a little with the bass.
    if (this._artUrl !== ART) this.setArt(ART);   // follows the current art (v3.33.0)
    if (this._art) {
      const a = this._art, bass = ((freq[0] || 0) + (freq[1] || 0) + (freq[2] || 0)) / 765;
      const rr = baseR * 0.84 * (1 + bass * 0.05), k = Math.max(rr * 2 / a.naturalWidth, rr * 2 / a.naturalHeight);
      ctx.save(); ctx.translate(cx, cy); if (t) ctx.rotate(t * 0.5);
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(a, -a.naturalWidth * k / 2, -a.naturalHeight * k / 2, a.naturalWidth * k, a.naturalHeight * k);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.lineWidth = 2 * (W / (this.canvas.clientWidth || W)); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
    }

    // Faster (v3.30.1): each spoke's direction worked out once, not every frame,
    // and the ring turned by one rotation of the canvas.
    if (!this._uv || this._uv.length !== len) {
      this._uv = Array.from({ length: len }, (_, i) => { const a = (i / len) * Math.PI * 2 - Math.PI / 2; return [Math.cos(a), Math.sin(a)]; });
    }
    ctx.save();
    ctx.translate(cx, cy); if (t) ctx.rotate(t);
    ctx.lineCap = 'round';
    for (let i = 0; i < len; i++) {
      const v = freq[i] / 255, [ux, uy] = this._uv[i];
      const outer = baseR + v * baseR * 1.6;
      const hue   = (i / len) * 360 + drift;
      ctx.strokeStyle = this._col(hue, 100, 65, v, i / len, 0.4 + v * 0.6);
      ctx.lineWidth   = 2.2;
      ctx.beginPath(); ctx.moveTo(ux * baseR, uy * baseR); ctx.lineTo(ux * outer, uy * outer); ctx.stroke();
      // the faint mirror, opposite
      ctx.strokeStyle = this._col(hue, 100, 65, v, i / len, (0.4 + v * 0.6) * 0.3);
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(-ux * baseR, -uy * baseR); ctx.lineTo(-ux * outer * 0.6, -uy * outer * 0.6); ctx.stroke();
    }
    ctx.restore();
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
}
