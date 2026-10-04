/**
 * audio-shadow: the exact visualiser for audio that mpv plays (v3.29.0).
 * mpv's sound never passes through the page, so the visualiser had nothing to
 * measure and drew a made-up animation. The shadow loads the same file into a
 * hidden audio element, follows mpv (position, pause, speed) and runs it
 * through a real analyser into a gain of zero: silent, but measured. The
 * visualiser then shows the frequencies of what is playing. A file the page
 * cannot decode keeps the old animation.
 *
 * The analyser matches the in-app engine's (audio-engine.js): fftSize 1024,
 * smoothing 0.8, so every visualiser setting behaves the same either way.
 */
import { fileURL } from './util.js';

const RESYNC = 0.3;   // seconds of drift from mpv before the shadow jumps

export class AudioShadow {
  constructor () { this.el = null; this.ctx = null; this.analyser = null; this.path = null; }

  _ensure () {
    if (this.el) return true;
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return false;
    try {
      this.el = new Audio(); this.el.preload = 'auto';
      // CORS, as the in-app engine asks: the page and the song are different
      // origins (file:// and bmfile://), and without it the analyser is fed
      // only zeros, by design, so a page cannot read other sites' audio.
      this.el.crossOrigin = 'anonymous';
      this.ctx = new Ctx();
      const src = this.ctx.createMediaElementSource(this.el);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.8;
      // Measured, never heard: the analyser is pulled through a gain of zero.
      const silent = this.ctx.createGain(); silent.gain.value = 0;
      src.connect(this.analyser); this.analyser.connect(silent); silent.connect(this.ctx.destination);
      return true;
    } catch (e) { console.warn('[BM Player] audio shadow unavailable:', e); this.el = null; return false; }
  }

  /** Follow mpv playing path from `at` seconds. Returns the analyser, or null. */
  load (path, at = 0, paused = false) {
    if (!path || !this._ensure()) return null;
    this.path = path;
    this.el.src = fileURL(path);
    const go = () => { try { this.el.currentTime = at || 0; } catch {} if (!paused) this.el.play().catch(() => {}); };
    this.el.addEventListener('loadedmetadata', go, { once: true });
    this.ctx.resume?.().catch?.(() => {});
    return this.analyser;
  }

  follow ({ time, paused, speed } = {}) {
    const el = this.el; if (!el || !this.path) return;
    if (typeof speed === 'number' && speed > 0 && el.playbackRate !== speed) el.playbackRate = speed;
    if (paused === true && !el.paused) el.pause();
    if (paused === false && el.paused) el.play().catch(() => {});
    if (typeof time === 'number' && isFinite(time) && el.readyState >= 1 && Math.abs(el.currentTime - time) > RESYNC) {
      try { el.currentTime = time; } catch {}
    }
  }

  get active () { return !!this.path; }

  stop () {
    if (!this.el) return;
    this.path = null;
    try { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); } catch {}
  }
}
