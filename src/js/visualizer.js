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
import { drawNeon, drawBubbles, drawParticles, bands, tone } from './viz-art.js';   // v3.31.0
import { perf } from './perf.js';
import { BeatTracker } from './viz-beat.js';   // v3.36.0
import { NeonGL } from './neon-gl.js';          // v3.38.0

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
/* v3.36.0: MilkDrop is drawn in the screen's own pixels. It was drawn at 60%
   of them and stretched (1152 across a 1920-pixel laptop screen), which is a
   large part of why it looked soft. At most about 2.3 million pixels, so a 4K
   screen is not drawn pixel for pixel.
   A preset can cost eight times what another does, so the size is settled
   preset by preset: one that stays slow is drawn a size smaller, and the next
   starts again from the machine's own size (MD.level). When three presets
   running needed that, it is the machine and not the presets, and its own
   size goes down for the rest of this run. */
export const MD_SCALES = [1, 0.8, 0.64, 0.5];
export const MD = { level: 0, start: 0, set: false, streak: 0 };   // the machine's size, the one it began at, whether that was decided, and how many presets running were slow

/* v3.29.0: an analyser any visualiser falls back on, the audio shadow's while
   mpv plays a song (audio-shadow.js). One made after the song started finds
   it here; those that exist are given it directly. */
let SHARED = null;
export function setSharedAnalyser (a) { SHARED = a || null; }

/* HD Flow's quality levels, best first (v3.36.0). At the top the dye is pixel
   for pixel with the screen, which is what HD means, and the fluid steps down
   by itself on a machine that cannot hold it (fluid.js, the governor). Before,
   it took the theme's tier, which Lite mode had left on Low for good: 256
   pixels of dye across a 1920-pixel screen. */
const FLOW_LEVELS = [
  { name: 'hd',     sim: 256, dyeScale: 1,    iterations: 20, fps: 60, maxPixels: 3.7e6 },
  { name: 'high',   sim: 192, dyeScale: 0.72, iterations: 16, fps: 60, maxPixels: 3.7e6 },
  { name: 'medium', sim: 128, dyeScale: 0.5,  iterations: 12, fps: 60, maxPixels: 2.1e6 },
  { name: 'low',    sim: 96,  dyeScale: 0.36, iterations: 8,  fps: 30, maxPixels: 2.1e6 },
].map(l => ({ dissipation: 1.4, velDissipation: 0.3, curl: 10, radius: 0.2, ...l }));

/* HD Flow's look, in one place. Lengths are in picture heights. */
export const FLOW = {
  line: 0.010,        // half-width of the line an emitter draws (the dye's, not the contour lines')
  bright: 1.6,        // the line's density at its middle, before loudness and hits add to it
  speed: [0.06, 0.2, 0.45, 0.15],  // an emitter's speed: at rest, per loudness, per hit, per beat
  hook: 3,            // how much harder an emitter turns while it dashes: a dash is a hook or a whirl, not a straight rod
  push: 0.5,          // how much of its own speed an emitter gives the fluid it passes through (0 to 1)
  pushWidth: 0.03,    // and over what width
  beat: 700,          // a hard beat's push outwards
  pulse: 0.4,         // and how much brighter the glow is on it, for a moment
  neon: { exposure: 1.4, edge: 1.7, fill: 0.24, level0: 0.05, octaves: 2, width: 1.4 },
  bloom: { amount: 1.5, threshold: 0.5, knee: 0.7 },
};

/* The loudest an analyser is asked to tell apart, in decibels, and the height
   (of 255) up to which a bar is drawn as it always was (v3.36.0, _getFreq). */
const TOP_DB = -10, KNEE = 200;

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
    this.beat          = new BeatTracker();   // when the music hits (v3.36.0): beat.n counts them, beat.punch is how hard, dying away
    ALL.add(this);

    this._resize();
    window.addEventListener('resize', () => this._resize());
    // It follows its own size too (v3.36.0), not only the window's: a side pane
    // opening, or the view it is in being shown, changes it with no resize event.
    try { if (canvas && typeof ResizeObserver === 'function') { this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(canvas); } } catch (_) {}
    try { perf.onChange?.(() => this._resize()); } catch (_) {}
  }

  // v3.36.0: drawn in the screen's own pixels. It was drawn in CSS pixels, so on
  // a display scaled to 125% or 150% (most laptops) every style was drawn small
  // and stretched: soft lines, soft dots. At most twice the CSS size and about
  // 3.7 million pixels, and on the Low quality setting it stays as it was.
  _scale () {
    const c = this.canvas, w = c.offsetWidth || 800, h = c.offsetHeight || 400;
    if (perf.tier === 'low') return 1;
    return Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3.7e6 / (w * h))));
  }

  _resize () {
    if (!this.canvas) return;
    const k = this._scale();
    const w = Math.round((this.canvas.offsetWidth  || 800) * k), h = Math.round((this.canvas.offsetHeight || 400) * k);
    // Only when it changed: setting a canvas's size wipes it.
    if (w !== this.canvas.width)  this.canvas.width  = w;
    if (h !== this.canvas.height) this.canvas.height = h;
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
    if (mode !== 'fluid' && mode !== 'flow') { this._fluid?.halt?.(); this._fluidStyle = null; if (this._fluidCanvas) this._fluidCanvas.style.display = 'none'; }   // halt: hidden, so no fade (v3.33.0)
    if (mode !== 'milkdrop' && this._mdCanvas) this._mdCanvas.style.display = 'none';
    if (mode !== 'neon' && this._neonCanvas) this._neonCanvas.style.display = 'none';
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
    this._fluid?.halt?.(); this._fluidStyle = null;   // set up afresh when it comes back
    if (this._fluidCanvas) this._fluidCanvas.style.display = 'none';
    if (this._mdCanvas) this._mdCanvas.style.display = 'none';
    if (this._neonCanvas) this._neonCanvas.style.display = 'none';
  }

  // Neon on the graphics card (v3.38.0, neon-gl.js): a canvas of its own over
  // the visualiser's, made when Neon is first drawn, and kept in place over
  // it. Null without WebGL, in Lite, or once its picture has been taken away
  // four times (a driver restarting, say): Neon then draws in 2D as before.
  _neonLayer () {
    if (this._neonFailed || document.documentElement.classList.contains('lite-mode') || !this.canvas?.parentNode) return null;
    let r = this._neonR;
    if (r && r.lost) {
      r.destroy(); this._neonCanvas?.remove(); this._neonCanvas = null; this._neonR = r = null;
      if ((this._neonLost = (this._neonLost || 0) + 1) > 3) { this._neonFailed = true; return null; }
    }
    if (!r) {
      const nc = document.createElement('canvas');
      nc.className = 'viz-neon-canvas';                       // placed absolutely, clicks pass through (components.css)
      const z = getComputedStyle(this.canvas).zIndex; if (z && z !== 'auto') nc.style.zIndex = z;
      this.canvas.parentNode.insertBefore(nc, this.canvas.nextSibling);
      r = NeonGL.make(nc);
      if (!r) { nc.remove(); this._neonFailed = true; return null; }
      this._neonCanvas = nc; this._neonR = r;
    }
    const nc = this._neonCanvas, c = this.canvas, px = v => v + 'px';
    nc.style.display = '';
    if (nc.style.left !== px(c.offsetLeft)) nc.style.left = px(c.offsetLeft);
    if (nc.style.top !== px(c.offsetTop)) nc.style.top = px(c.offsetTop);
    if (nc.style.width !== px(c.offsetWidth)) nc.style.width = px(c.offsetWidth);
    if (nc.style.height !== px(c.offsetHeight)) nc.style.height = px(c.offsetHeight);
    return r;
  }

  // The clock in sixtieths of a second (v3.36.0), for what turns or drifts at a
  // steady pace: Radial's spin, Wave's echo, the Rainbow colours. They went by
  // the count of drawn frames, which is 72 a second on a 144 Hz screen, 60 on a
  // 60 Hz one and 45 on a 90 Hz one, and so they ran a fifth fast or a quarter
  // slow by the screen.
  _frames () { return performance.now() * 0.06; }

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
    // Not on screen: nothing is drawn (v3.36.0). The music view's visualiser
    // went on drawing, and reading the sound, after the view was left for
    // another, 72 times a second into a canvas no one could see. Its fluid, if
    // that is its style, waits too.
    const hidden = !this.canvas.offsetWidth;
    if (hidden !== !!this._hid) { this._hid = hidden; if (hidden) this._fluid?.pause?.(); else this._fluid?.resume?.(); }
    if (hidden) return;
    this._lastDraw = now;
    this._tick++;
    this._hear(now);
    this._draw();
  }

  // The beat, followed on every drawn frame whatever the style (viz-beat.js),
  // from the sound itself. Made-up sound, where there is no analyser, has none.
  _hear (now) {
    const an = this._an();
    if (an) this.beat.update(this._getTimeF(), an.context?.sampleRate || 44100, now);
    else this.beat.update(null, 0, now);
  }

  _getFreq () {
    let raw;
    const an = this._an();
    this._wide = 1;
    if (an) {
      an.smoothingTimeConstant = Math.max(0, Math.min(0.95, this.opts.smoothing));
      // The top of the scale (v3.36.0). An analyser reads from -100 to -30
      // decibels unless told otherwise, and anything louder than -30 is simply
      // "full". The bass of nearly any record is louder than that, all the
      // time, so the first bars stood at the top as one flat block and the
      // drum could not be seen in them. It reads up to -10 now, and _bands
      // puts the result back on the scale the styles were made for.
      if ('maxDecibels' in an) {
        if (an.maxDecibels !== TOP_DB) { try { an.maxDecibels = TOP_DB; } catch (_) {} }
        if (an.maxDecibels === TOP_DB) this._wide = (TOP_DB - (an.minDecibels ?? -100)) / 70;
      }
      an.getByteFrequencyData(this._fd);
      raw = this._fd;
    } else raw = this._synth();
    return this._bands(raw);
  }

  // The chosen number of bars, spaced the way we hear (more of them for the
  // low notes), scaled by the sensitivity. The top quarter of the spectrum
  // is left out: music has little up there.
  // Up to KNEE a bar is exactly as high as it always was. What used to be
  // everything from there to "full or louder" now has the loud end of the
  // scale shared out over it: a drum's 10 decibels over the bass line show
  // as a twentieth of the picture's height where they showed as nothing.
  _bands (raw) {
    const n = Math.max(8, Math.min(256, Math.round(this.opts.bars) || 80)), g = this.opts.sensitivity || 1;
    const use = Math.max(1, Math.floor(raw.length * 0.75));
    const wide = this._wide > 1 ? this._wide : 1, squeeze = wide > 1 ? (255 - KNEE) / (255 * wide - KNEE) : 1;
    if (!this._band || this._band.length !== n) this._band = new Uint8Array(n);
    for (let b = 0; b < n; b++) {
      const a = Math.floor(use * Math.pow(b / n, 1.6)), z = Math.max(a + 1, Math.floor(use * Math.pow((b + 1) / n, 1.6)));
      let m = 0; for (let k = a; k < z && k < raw.length; k++) if (raw[k] > m) m = raw[k];
      m *= wide; if (m > KNEE) m = KNEE + (m - KNEE) * squeeze;
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
      case 'rainbow': return `hsla(${(pos * 330 + this._frames() * 0.4) % 360}, 95%, 64%, ${a})`;
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

  // The waveform as numbers from -1 to 1 (v3.36.0), for Wave. As bytes it has
  // 256 steps, and a quiet passage drawn large showed every one of them.
  _getTimeF () {
    const an = this._an();
    if (an && typeof an.getFloatTimeDomainData === 'function') {
      if (!this._tf || this._tf.length !== an.fftSize) this._tf = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(this._tf); return this._tf;
    }
    const d = this._getTime();
    if (!this._tf || this._tf.length !== d.length) this._tf = new Float32Array(d.length);
    for (let i = 0; i < d.length; i++) this._tf[i] = (d[i] - 128) / 128;
    return this._tf;
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

  // The 2D canvas emptied, once (v3.36.0). The fluid and MilkDrop draw on
  // canvases of their own, over this one, and it was cleared on every frame
  // all the same: a full-screen layer handed to the compositor 72 times a
  // second with nothing on it.
  _wipe () {
    if (this._inked === false) return;
    this._inked = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _draw () {
    if (!this.ctx || !this.canvas) return;
    if (this.mode !== 'fluid' && this.mode !== 'flow' && this.mode !== 'milkdrop') this._inked = true;
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
    this._wipe();
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
      const f = this._fluid;
      if (this.mode === 'flow') {
        // HD Flow (v3.36.0): the dye drawn as glowing contour lines with its body
        // dim between them, a glow from the lines, the lot tone-mapped, and its
        // own quality levels.
        this._fw = null;
        f.configure(() => {
          f.setFlow({});
          f.setNeon(true, FLOW.neon.exposure, FLOW.neon);
          f.setBloom(FLOW.bloom.amount, FLOW.bloom);
          f.setLadder('flow', FLOW_LEVELS);
        });
        f.onFrame = (dt, now) => this._feedFlow(dt, now);   // once per step of the fluid
      } else {
        this._fl = null;
        f.configure(() => {
          f.setMarkers([]);
          f.setNeon(false); f.setBloom(0);
          f.setFlow({ swirl: 0.7, trail: 0.7, radius: 0.6 });   // a gentle curl: smoke, not froth
          f.setQuality(perf.tier);
        });
        f.onFrame = (dt, now) => this._feedFluid(dt, now);
      }
    }
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
      // The pointer stirs it (v3.36.0): moving over the picture pushes the fluid
      // and leaves a little light, in Smoke and in HD Flow.
      this._onStir = e => {
        const f = this._fluid; if (!f || (this.mode !== 'fluid' && this.mode !== 'flow') || !this.active) return;
        const r = this.canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
        const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) { this._stirAt = null; return; }
        const p = this._stirAt, now = performance.now();
        if (!p || now - p.t > 200) { this._stirAt = { x, y, t: now }; return; }
        // Measured from where it last stirred, not from the last event: a fast
        // screen reports the pointer more often, in smaller steps, and a step
        // too small to count was thrown away each time.
        const dx = (x - p.x) * (r.width / r.height), dy = y - p.y, d = Math.hypot(dx, dy); if (d < 0.0015) return;
        this._stirAt = { x, y, t: now };
        // In picture heights a second, whatever the size of the fluid's grid: on a
        // lighter level the grid is smaller, and the same number of its cells a
        // second was nearly three times the push.
        const push = Math.min(900, d * 26000) * (f.velocity?.height || 256) / 256;
        const col = this.mode === 'flow' ? [0.5, 0.5, 0.5].map((c, i) => c * 0.5 + this._flowRgb(Math.floor(performance.now() / 4000) % 5, 5, 0.5)[i] * 0.9) : [0.05, 0.05, 0.06];
        f.splat(x, y, dx / d * push, dy / d * push, col.map(c => c * Math.min(1, d * 40)), this.mode === 'flow' ? 0.00025 : 0.002);
      };
      window.addEventListener('pointermove', this._onStir, { passive: true });
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
  _feedFluid (dt, now) {
    const f = this._fluid, freq = this._getFreq(), n = freq.length;
    // Average and peak together (v3.33.0): a narrow sound, a pure tone, made
    // only a small average over its part, once the analyser grew finer.
    const band = (a, b) => { let t = 0, m = 0; for (let i = a; i < b; i++) { t += freq[i]; if (freq[i] > m) m = freq[i]; } return (t / Math.max(1, b - a) + m) / 2 / 255; };
    const cut = [0, 0.1, 0.3, 0.6, 1].map(c => Math.round(c * n));
    const lv = [0, 1, 2, 3].map(i => band(cut[i], Math.max(cut[i] + 1, cut[i + 1])));
    const st = this._fl || (this._fl = { splats: 0, drift: Math.random(), phase: [0, 1.7, 3.1, 4.4] });
    if (this._loudness() < 0.01) return;                 // silent or paused: no smoke
    st.drift = (st.drift + dt * 0.036) % 1;
    // A beat (viz-beat.js): the bass's plume puffs, harder for a harder hit, and
    // the puff dies away with it. It asked whether the bass was a fifth above
    // its average, on a scale where music's bass is always near the top.
    const punch = this.beat.punch;
    // Fed at every step of the fluid, by the step's length (v3.36.0), and pushed
    // only as hard as it takes to rise at the speed wanted. It was 25 puffs a
    // second, each thrown up so fast that the next landed a tenth of the screen
    // behind it: the gaps showed as scales all the way up the plume. Now each
    // step's smoke overlaps the last.
    const X = [0.2, 0.4, 0.6, 0.8], texels = f.velocity.height;
    for (let i = 0; i < 4; i++) {
      const v = lv[i]; if (v < 0.12) continue;   // a quiet part, or a pause fading out: none
      const puff = i === 0 ? punch : punch * 0.35;                    // the others feel it too, a little
      const x = X[i] + Math.sin(now / 900 + st.phase[i]) * 0.035;     // a plume sways
      const sig = 0.022 + v * 0.014, U = 0.45 + v * 0.75 + puff * 0.45;   // its half-width and its speed, in picture heights
      const lift = U * U / (4 * sig) * dt * texels, lean = Math.sin(now / 600 + st.phase[i]) * 0.12;
      const k = (3 + v * 6 + puff * 3) * dt;                          // thin smoke, but seen
      f.splat(x, 0.03, lean * lift, lift, this._rgb(v, i / 3, 0, st.drift, i).map(c => c * k), 2 * sig * sig);
      st.splats++;
    }
  }

  // ── HD FLOW (v3.36.0) ── Five emitters, one for each part of the sound, wander
  // the screen in arcs, each drawing a thin line of its own colour into the
  // fluid, which curls it into threads. A louder part moves its emitter faster
  // and draws brighter, a beat makes them all dash, and in silence nothing is
  // drawn and the picture fades. Called once per step of the fluid, with the
  // step's own length, so it looks the same at any frame rate.
  _feedFlow (dt, now) {
    const f = this._fluid, lv = bands(this._getFreq()), N = 5;
    const aspect = f.canvas.width / Math.max(1, f.canvas.height);
    const st = this._fw || (this._fw = { avg: lv.slice(), beatN: this.beat.n, splats: 0, kick: 0,
      // spread across the picture to begin with, each on its own heading
      em: Array.from({ length: N }, (_, i) => ({ x: 0.14 + 0.72 * ((i + 0.5) / N) + (Math.random() - 0.5) * 0.08, y: 0.25 + Math.random() * 0.5,
        dir: Math.random() * Math.PI * 2, turn: (i % 2 ? 1 : -1) * (0.8 + Math.random() * 0.6), sway: Math.random() * 6.3, hit: 0 })) });
    const quiet = this._loudness() < 0.01;
    // A beat since the last step (viz-beat.js), and how hard: 0 for none.
    const beat = !quiet && this.beat.n !== st.beatN ? this.beat.strength : 0; st.beatN = this.beat.n;
    if (beat) st.kick = Math.max(st.kick, beat);
    st.kick *= Math.exp(-dt * 5);
    // and the glow swells with it, for a moment
    f.setBloom(FLOW.bloom.amount * (1 + FLOW.pulse * (quiet ? 0 : this.beat.punch)));
    const marks = [];
    st.em.forEach((e, i) => {
      const v = quiet ? 0 : lv[i];
      st.avg[i] += (v - st.avg[i]) * Math.min(1, dt * 1.6);
      e.hit = Math.max(e.hit * Math.exp(-dt * 6), Math.min(1, Math.max(0, v - st.avg[i]) * 7));   // how much louder than a moment ago
      if (beat && i === 0) e.hit = Math.max(e.hit, beat);   // the bass's own level sits near the top of its scale in most music and moves too little to say
      // wander: a heading that turns in slow arcs, kept inside the picture
      e.sway += dt * (0.5 + i * 0.07);
      e.dir += (e.turn + Math.sin(e.sway) * 1.3) * dt * (0.7 + v + (e.hit + st.kick) * FLOW.hook);
      // near an edge it turns back towards the middle, harder the closer it is
      const m = 0.16, ex = Math.max(0, m - e.x) - Math.max(0, e.x - (1 - m)), ey = Math.max(0, m - e.y) - Math.max(0, e.y - (1 - m));
      if (ex || ey) { const want = Math.atan2(0.5 - e.y, (0.5 - e.x) * aspect); let d = want - e.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); e.dir += d * Math.min(1, dt * 14 * Math.hypot(ex, ey) / m); }
      // and they keep apart, so the picture stays spread and no corner is left empty
      let rx = 0, ry = 0;
      for (const o of st.em) { if (o === e) continue; const ox = (e.x - o.x) * aspect, oy = e.y - o.y, d2 = ox * ox + oy * oy; if (d2 < 0.09 && d2 > 1e-6) { const k = (0.3 - Math.sqrt(d2)) / Math.sqrt(d2); rx += ox * k; ry += oy * k; } }
      if (rx || ry) { let d = Math.atan2(ry, rx) - e.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); e.dir += d * Math.min(1, dt * 3.5 * Math.min(1, Math.hypot(rx, ry) * 4)); }
      const S = FLOW.speed, speed = quiet ? S[0] * 0.5 : S[0] + v * S[1] + e.hit * S[2] + st.kick * S[3];   // picture heights a second
      const px = e.x, py = e.y;
      e.x = Math.max(0.01, Math.min(0.99, e.x + Math.cos(e.dir) * speed * dt / aspect));
      e.y = Math.max(0.01, Math.min(0.99, e.y + Math.sin(e.dir) * speed * dt));
      const col = this._flowRgb(i, N, v);
      marks.push({ x: e.x, y: e.y, color: col.map(c => c * (0.5 + v * 1.2 + e.hit)), strength: quiet ? 0.25 : 0.55 + v * 0.6 });
      if (quiet || v < 0.08) return;
      // the line: blobs half their own width apart from where it was to where it is
      const sig = FLOW.line * (1 + e.hit * 0.4), r = 2 * sig * sig;
      const dx = (e.x - px) * aspect, dy = e.y - py, dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.min(24, Math.ceil(dist / (sig * 0.5))));
      const bright = FLOW.bright * (0.6 + v + e.hit * 1.4);            // past white at its core: the tone map shapes it
      const each = bright * Math.max(dist / steps, sig * 0.5 * dt * 60 * 0.25) / (sig * 2.5);
      const dye = col.map(c => c * each);
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        f.splat(px + (e.x - px) * t, py + (e.y - py) * t, 0, 0, dye, r);
      }
      // and it drags the fluid with it, over a wider patch
      // Enough that the fluid ends up at about `push` of the emitter's speed in the
      // time the emitter takes to cross it: any more and the fluid outruns the
      // emitter and tears its line into ripples, one a frame.
      const pw = FLOW.pushWidth, a = FLOW.push * (1 - FLOW.push) * speed * speed / pw * f.velocity.height * dt;
      f.splat(e.x, e.y, Math.cos(e.dir) * a, Math.sin(e.dir) * a, null, 2 * pw * pw);
      st.splats += steps;
    });
    if (beat) {   // a beat stirs the whole picture: a push outwards from one emitter
      const e = st.em[Math.floor(Math.random() * N)], a = Math.random() * Math.PI * 2, F = FLOW.beat * beat * f.velocity.height / 256;   // the same push on every level's grid
      f.splat(e.x, e.y, Math.cos(a) * F, Math.sin(a) * F, null, 0.006);
    }
    f.setMarkers(marks);
  }

  // An emitter's colour, pure and saturated, in the chosen colours (the same
  // families as the other drawn styles, viz-art.js).
  _flowRgb (i, n, v) {
    const [h, s] = tone(this, i, n, v, 'flow');
    return hsl2rgb((((h % 360) + 360) % 360) / 360, Math.min(1, s / 100), s === 0 ? 0.85 : 0.5);
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
        // Smoke's four plumes (v3.36.0): warm red, blue, violet and teal. The
        // treble's was gold, and gold as thin as smoke is olive drab.
        if (plume !== undefined) { h = [0.95 + v * 0.1, 0.61, 0.75, 0.49][plume % 4] + drift * 0.05; l = 0.55 + v * 0.08; }
        else if (pos < 0.3) h = 0.93 + v * 0.12 + drift * 0.05;
        else if (pos < 0.7) h = 0.62 - bright * 0.25 + drift * 0.1;
        else { h = 0.13 + drift * 0.03; s = 0.75; l = 0.6 + v * 0.2; }
    }
    return hsl2rgb(((h % 1) + 1) % 1, s, l);
  }

  // ── MILKDROP (v3.32.0) ── Bars while it loads, and instead if WebGL 2 is
  // missing or in Lite. In the screen's own pixels since v3.36.0 (see MD_SCALES).
  _drawMilk () {
    this._wipe();
    if (this._mdFailed || document.documentElement.classList.contains('lite-mode')) { this._drawBars(); return; }
    if (!this._md) { this._makeMilk(); this._drawBars(); return; }
    const mc = this._mdCanvas, c = this.canvas, px = v => v + 'px';
    mc.style.display = '';
    if (mc.style.left !== px(c.offsetLeft)) mc.style.left = px(c.offsetLeft);
    if (mc.style.top !== px(c.offsetTop)) mc.style.top = px(c.offsetTop);
    if (mc.style.width !== px(c.offsetWidth)) mc.style.width = px(c.offsetWidth);
    if (mc.style.height !== px(c.offsetHeight)) mc.style.height = px(c.offsetHeight);
    const [w, h] = this._mdSize();
    if (w !== this._mdW || h !== this._mdH) { this._mdW = w; this._mdH = h; mc.width = w; mc.height = h; this._md.setRendererSize(w, h); this._mdSkip = Math.max(this._mdSkip || 0, 24); }   // at least 24: a new preset's own, longer wait is not cut short
    const td = this._getTime(), b = this._mdBuf || (this._mdBuf = new Uint8Array(1024));
    if (td.length >= 1024) b.set(td.subarray(0, 1024)); else for (let i = 0; i < 1024; i++) b[i] = td[Math.floor(i * td.length / 1024)];
    const every = this.opts.mdAuto ?? 30, now = performance.now();
    if (every && now - this._mdAt > every * 1000) this.mdNext(2.5);
    try { this._md.render({ audioLevels: { timeByteArray: b, timeByteArrayL: b, timeByteArrayR: b } }); }
    catch (e) { console.warn('[BM Player] MilkDrop stopped, drawing bars:', e); this._mdFailed = true; mc.style.display = 'none'; }
    this._mdGovern(now - (this._mdLast || now)); this._mdLast = now;
  }

  // Which size MilkDrop is drawn at now: the machine's, and smaller for a preset that was slow.
  _mdLevel () { return Math.min(MD_SCALES.length - 1, Math.max(0, MD.level) + (this._mdDown || 0)); }

  // The size in pixels: the canvas's own, times that size's share.
  _mdSize () {
    const c = this.canvas, dpr = window.devicePixelRatio || 1, fw = c.offsetWidth * dpr, fh = c.offsetHeight * dpr;
    const k = MD_SCALES[this._mdLevel()] * Math.min(1, Math.sqrt(2.3e6 / Math.max(1, fw * fh)));
    return [Math.max(320, Math.round(fw * k)), Math.max(180, Math.round(fh * k))];
  }

  // Slow frames, kept up for about two seconds, take this preset down a size.
  // The first frames of a preset do not count (its shaders are being built, and
  // the last one is still fading out under it), nor does a pause or a short
  // stumble.
  _mdGovern (gap) {
    if (this._mdLevel() >= MD_SCALES.length - 1) return;
    if (!(gap > 0) || gap > 250) { this._mdN = 0; this._mdEma = 0; return; }
    if (this._mdSkip > 0) { this._mdSkip--; return; }
    this._mdEma = this._mdEma ? this._mdEma + (gap - this._mdEma) * 0.08 : gap;
    // 27 ms: under about 37 frames a second. More on a screen that is itself
    // slower than that (30 Hz: a frame every 33 ms on any machine).
    if (this._mdEma <= Math.max(27, (perf.refreshMs || 0) * 1.45 + 2)) { this._mdN = 0; return; }
    if (++this._mdN < 60) return;
    this._mdDown = (this._mdDown || 0) + 1; this._mdN = 0; this._mdEma = 0; this._mdSkip = 24;
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
      try { this._md = bc.createVisualizer(actx, fc, { width: 640, height: 360, pixelRatio: 1, textureRatio: 1 }); }
      catch (e) { fc.remove(); throw e; }               // no canvas left behind: bars are drawn on the one underneath
      this._mdCanvas = fc; this._mdPresets = mod.PRESETS; this._mdNames = Object.keys(mod.PRESETS);
      // The graphics card can take a canvas's picture away (a driver restarting,
      // a laptop waking up or changing cards), and this one then stayed black
      // until the style was changed (v3.36.0). It is dropped, and the next frame
      // makes another. A canvas that is lost within half a minute of being made,
      // four times running, is not coming back: bars from then on.
      const born = performance.now();
      fc.addEventListener('webglcontextlost', () => {
        if (this._mdCanvas !== fc) return;
        fc.remove(); this._md = null; this._mdCanvas = null; this._mdLoading = false; this._mdW = this._mdH = 0;
        this._mdLost = performance.now() - born < 30000 ? (this._mdLost || 0) + 1 : 1;
        if (this._mdLost > 3) { this._mdFailed = true; console.warn('[BM Player] MilkDrop keeps losing its picture, drawing bars'); }
      });
      // Where to start (v3.36.0), once: smaller on the Low setting, and the
      // smallest where there is no graphics card at all.
      if (!MD.set) {
        MD.set = true;
        let soft = false;
        try { const gl = fc.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info'); soft = /swiftshader|llvmpipe|software|basic render/i.test(String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || '')); } catch (_) {}
        MD.level = MD.start = soft ? MD_SCALES.length - 1 : perf.tier === 'low' ? 2 : 0;
      }
      this.mdNext(0);
    }).catch(e => { console.warn('[BM Player] MilkDrop unavailable, drawing bars:', e); this._mdFailed = true; });
  }

  /** Another MilkDrop preset, blended over `blend` seconds. Its name, or null. */
  mdNext (blend = 2.5) {
    if (!this._md || !this._mdNames?.length) return null;
    // Dealt like cards (v3.36.0): every preset once, in a new order, before any
    // comes round again. Picked at random each time, a few kept coming back and
    // others were not seen in an hour.
    if (!this._mdBag?.length) {
      const bag = this._mdNames.slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1] === this._mdName) bag.unshift(bag.pop());   // not the same one twice running
      this._mdBag = bag;
    }
    // The preset just left: was it slow? Three slow ones running, and the machine's own size goes down.
    if (this._mdName) {
      MD.streak = this._mdDown ? MD.streak + 1 : 0;
      if (MD.streak >= 3 && MD.level < MD_SCALES.length - 1) { MD.level++; MD.streak = 0; }
    }
    this._mdDown = 0;
    this._mdName = this._mdBag.pop(); this._mdAt = performance.now(); this._mdSkip = 30 + Math.round(blend * 60);
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

    this._inked = true;   // also when it stands in for the fluid or MilkDrop
    ctx.clearRect(0, 0, W, H);

    const barW = (W / len) * 1.5;
    const gap  = barW * 0.15;
    const dpr  = W / (canvas.clientWidth || W) || 1;

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
      const r = Math.min(barW * 0.4, 3 * dpr);
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
    const row = Math.max(1, Math.round(dpr));
    for (let y = 0; y < H; y += row * 4) ctx.fillRect(0, y, W, row);
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
    const dpr   = W / (canvas.clientWidth || W) || 1;
    // Spin off (v3.30.1): the spokes stand still and so do their colours, which
    // drifting round the ring looked like turning too.
    const spin  = this.opts.spin !== false;
    const fr    = this._frames();
    const t     = spin ? fr * 0.012 : 0;
    const drift = spin ? fr * 0.4 : 0;

    ctx.clearRect(0, 0, W, H);

    // The inner glow: made again only when its colour or the size changes.
    const gHue = 220 + (spin ? Math.round((fr % 120) / 4) * 4 : 60);
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
      const rr = baseR * 0.84 * (1 + bass * 0.02 + this.beat.punch * 0.045), k = Math.max(rr * 2 / a.naturalWidth, rr * 2 / a.naturalHeight);   // on the beat (v3.36.0): the bass's level hardly moves
      ctx.save(); ctx.translate(cx, cy); if (t) ctx.rotate(t * 0.5);
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(a, -a.naturalWidth * k / 2, -a.naturalHeight * k / 2, a.naturalWidth * k, a.naturalHeight * k);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.lineWidth = 2 * dpr; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
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
      ctx.lineWidth   = 2.2 * dpr;
      ctx.beginPath(); ctx.moveTo(ux * baseR, uy * baseR); ctx.lineTo(ux * outer, uy * outer); ctx.stroke();
      // the faint mirror, opposite
      ctx.strokeStyle = this._col(hue, 100, 65, v, i / len, (0.4 + v * 0.6) * 0.3);
      ctx.lineWidth   = dpr;
      ctx.beginPath(); ctx.moveTo(-ux * baseR, -uy * baseR); ctx.lineTo(-ux * outer * 0.6, -uy * outer * 0.6); ctx.stroke();
    }
    ctx.restore();
  }

  // ── WAVE ─────────────────────────────────────────────
  _drawWave () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const time  = this._getTimeF(), n = time.length;
    const freq  = this._getFreq();
    const avg   = freq.reduce((a, b) => a + b, 0) / freq.length / 255;
    const cy    = H / 2, dpr = W / (canvas.clientWidth || W) || 1;
    const now   = performance.now(), dt = Math.min(0.1, Math.max(0, (now - (this._waveT || now)) / 1000)); this._waveT = now;

    ctx.clearRect(0, 0, W, H);

    // v3.36.0. The picture starts where the wave crosses the middle going up,
    // as an oscilloscope does, so it stands still and does not jitter. Half
    // of what was read is drawn, as 256 points, each the mean of its samples:
    // 1024 raw samples made a scribble. The glow is wider, fainter strokes
    // added together. It was a shadow blur of up to 36 pixels on every
    // stroke, the most costly thing any style drew (34 ms a frame without a
    // graphics card, against 12 for Bars).
    let start = 0;
    for (let i = 1; i < n / 2; i++) if (time[i - 1] < 0 && time[i] >= 0) { start = i; break; }
    const span = Math.floor(n / 2), P = Math.min(256, span), per = span / P;
    const ys = this._waveY && this._waveY.length === P ? this._waveY : (this._waveY = new Float32Array(P));
    let mean = 0, peak = 0;
    for (let p = 0; p < P; p++) {
      const a = start + Math.floor(p * per), b = Math.max(a + 1, start + Math.floor((p + 1) * per));
      let sum = 0; for (let k = a; k < b; k++) sum += time[Math.min(n - 1, k)];
      ys[p] = sum / (b - a);
      const m = Math.abs(ys[p]); mean += m; if (m > peak) peak = m;
    }
    mean /= P;
    // Its height follows how loud the music is, over about a second: a quiet
    // song fills the picture as a loud one does. It was drawn at the sound's
    // own size, and most music then made a ripple a tenth of the picture high.
    // Up to ten times, so silence is a line. A sudden hit, louder than the
    // second before it, is drawn as tall as the picture allows and no taller:
    // the whole wave is scaled, so its shape is kept and its tops are not cut.
    const lvl  = this._waveLvl = (this._waveLvl ?? mean) + (mean - (this._waveLvl ?? mean)) * Math.min(1, dt * (mean > (this._waveLvl ?? 0) ? 4 : 1.2));
    const want = Math.min(10, 0.3 / Math.max(lvl, 0.012)) * 1.4 * Math.max(0.4, Math.min(2.5, this.opts.sensitivity || 1));
    const gain = Math.min(want, 0.96 / Math.max(peak, 1e-4));
    const lim  = H * 0.46;
    const yAt  = p => cy + lim * ys[p] * gain;
    const hue  = 200 + avg * 80;
    // a smooth curve through the points: each bend ends midway to the next
    const wobAt = now * 0.0024;   // the echo's ripple, by the clock (it went by drawn frames)
    const path = (scale, wob) => {
      const y = p => cy + (yAt(p) - cy) * scale + (wob ? Math.sin(p * 0.6 + wobAt) * 6 * dpr : 0);
      ctx.beginPath(); ctx.moveTo(0, y(0));
      for (let p = 1; p < P - 1; p++) {
        const x = p / (P - 1) * W, xn = (p + 1) / (P - 1) * W;
        ctx.quadraticCurveTo(x, y(p), (x + xn) / 2, (y(p) + y(p + 1)) / 2);
      }
      ctx.lineTo(W, y(P - 1));
    };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    // light between the wave and the middle, brighter towards the wave's tips
    path(1, false);
    ctx.lineTo(W, cy); ctx.lineTo(0, cy); ctx.closePath();
    const g = ctx.createLinearGradient(0, cy - lim, 0, cy + lim);
    g.addColorStop(0, this._col(hue, 100, 60, avg, 0.5, 0.26)); g.addColorStop(0.5, this._col(hue, 100, 60, avg, 0.5, 0.02)); g.addColorStop(1, this._col(hue, 100, 60, avg, 0.5, 0.26));
    ctx.fillStyle = g; ctx.fill();
    // the echo behind it, smaller and a little out of step
    ctx.strokeStyle = this._col(hue + 40, 80, 70, avg, 0.7, 0.2);
    ctx.lineWidth   = 1.5 * dpr;
    path(0.55, true);
    ctx.stroke();
    // the wave, and its glow
    path(1, false);
    for (const [w, a] of [[26, 0.04], [14, 0.08], [7, 0.16], [3.2, 0.5]]) {
      ctx.strokeStyle = this._col(hue, 100, 62, avg, 0.5, a);
      ctx.lineWidth   = w * dpr;
      ctx.stroke();
    }
    ctx.strokeStyle = this._col(hue, 100, 84, avg, 0.5, 0.95);   // the bright core
    ctx.lineWidth   = 1.5 * dpr;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── PARTICLES ───────────────────────────────────────
}
