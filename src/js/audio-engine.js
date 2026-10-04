/**
 * BM Player — renderer audio engine
 *
 * mpv plays audio in a separate process, so the renderer can never see the
 * samples. That has two consequences the UI has been living with:
 *
 *   1. visualizer.js synthesises its waveform. It says so in its own header.
 *      The bars move, but they are not reacting to the music.
 *   2. The equalizer sends `af` filter strings to mpv, so nothing in the UI
 *      can show what the filter is actually doing.
 *
 * Playing audio-only files through an <audio> element in the renderer fixes
 * both: a real AnalyserNode, a real BiquadFilter chain, and sample-accurate
 * seeking. Video stays on mpv, which is where it belongs.
 *
 * Fallback is deliberate and layered, because this must never be the reason
 * a file won't play:
 *   - no Web Audio in this context      -> `available` is false, use mpv
 *   - codec the browser can't decode    -> canPlay() false, use mpv
 *   - decode error at runtime           -> 'fallback' event, caller uses mpv
 *   - user turns it off in settings     -> use mpv
 *
 * APE, WMA and MKA in particular are not decodable by Chromium, so those
 * always take the mpv path.
 */

/* Matches EQ_BANDS in app.js. Keep them in step: the UI sliders are built
   from that array and addressed here by index. */
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/* Extension -> MIME for canPlayType(). Anything absent is assumed mpv-only. */
const MIME = {
  mp3:  'audio/mpeg',
  m4a:  'audio/mp4; codecs="mp4a.40.2"',
  m4b:  'audio/mp4; codecs="mp4a.40.2"',
  aac:  'audio/aac',
  ogg:  'audio/ogg; codecs="vorbis"',
  opus: 'audio/ogg; codecs="opus"',
  flac: 'audio/flac',
  wav:  'audio/wav',
  webm: 'audio/webm; codecs="opus"',
};
/* Chromium has no decoder for these regardless of what canPlayType says. */
const NEVER = new Set(['ape', 'wma', 'mka', 'dsf', 'dff', 'tta', 'wv', 'mpc']);

export class AudioEngine {
  constructor() {
    this.available = false;
    this.active = false;          // true while this engine owns playback
    this._handlers = new Map();
    this._eqGains = new Array(EQ_FREQUENCIES.length).fill(0);

    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return;             // no Web Audio: stay unavailable, caller uses mpv

    try {
      this.ctx = new Ctx();
      this.el = new Audio();
      this.el.preload = 'auto';
      this.el.crossOrigin = 'anonymous';

      this.source = this.ctx.createMediaElementSource(this.el);

      // Peaking filters in series, one per band. Q of 1.1 gives roughly
      // one-octave bandwidth, which is what a 10-band graphic EQ implies.
      this.filters = EQ_FREQUENCIES.map(f => {
        const b = this.ctx.createBiquadFilter();
        b.type = 'peaking';
        b.frequency.value = f;
        b.Q.value = 1.1;
        b.gain.value = 0;
        return b;
      });

      this.gain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;   // 1024 (v3.32.0): MilkDrop reads 1024 samples
      this.analyser.smoothingTimeConstant = 0.8;

      // source -> f0 -> f1 -> ... -> f9 -> gain -> analyser -> speakers
      let node = this.source;
      for (const f of this.filters) { node.connect(f); node = f; }
      node.connect(this.gain);
      this.gain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this._wireElement();
      this.available = true;
    } catch (e) {
      // A failure here is expected on some configurations; it is not an error.
      console.warn('[AudioEngine] unavailable, falling back to mpv:', e && e.message);
      this.available = false;
    }
  }

  static isSupported() {
    return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  }

  /** Can the browser decode this file? Extension first, then the decoder. */
  canPlay(pathOrUrl) {
    if (!this.available) return false;
    const ext = String(pathOrUrl || '').split('.').pop().toLowerCase().split(/[?#]/)[0];
    if (NEVER.has(ext)) return false;
    const mime = MIME[ext];
    if (!mime) return false;
    const verdict = this.el.canPlayType(mime);
    return verdict === 'probably' || verdict === 'maybe';
  }

  /* ── events ──────────────────────────────────────────────────── */
  on(name, cb) {
    if (!this._handlers.has(name)) this._handlers.set(name, []);
    this._handlers.get(name).push(cb);
    return this;
  }
  _emit(name, data) {
    for (const cb of this._handlers.get(name) || []) {
      try { cb(data); } catch (e) { console.error('[AudioEngine] handler for "' + name + '":', e); }
    }
  }

  _wireElement() {
    const e = this.el;
    e.addEventListener('loadedmetadata', () => this._emit('loaded', { duration: e.duration || 0 }));
    e.addEventListener('timeupdate',     () => this._emit('time', { time: e.currentTime || 0, duration: e.duration || 0 }));
    e.addEventListener('play',           () => this._emit('play'));
    e.addEventListener('pause',          () => this._emit('pause'));
    e.addEventListener('ended',          () => this._emit('ended'));
    e.addEventListener('error', () => {
      // Decoder gave up mid-file. Hand the track back rather than dying.
      const err = e.error;
      console.warn('[AudioEngine] decode failed (code ' + (err && err.code) + '), handing back to mpv');
      this.active = false;
      this._emit('fallback', { path: this._path, code: err && err.code });
    });
  }

  /* ── transport ───────────────────────────────────────────────── */
  async load(url, path, autoplay = true) {
    if (!this.available) return false;
    this._path = path || url;
    this.active = true;
    this.el.src = url;
    try { this.el.load(); } catch (_) {}
    if (autoplay) return this.play();
    return true;
  }

  async play() {
    if (!this.available || !this.el.src) return false;
    // Browsers start the context suspended until a gesture; every call site
    // here is behind a click, so resuming on demand is safe.
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (_) {} }
    try { await this.el.play(); return true; }
    catch (e) { console.warn('[AudioEngine] play rejected:', e && e.message); return false; }
  }
  pause()  { if (this.available) this.el.pause(); }
  toggle() { return this.el && this.el.paused ? this.play() : this.pause(); }
  stop() {
    if (!this.available) return;
    this.el.pause();
    try { this.el.removeAttribute('src'); this.el.load(); } catch (_) {}
    this.active = false;
    this._path = null;
  }

  seek(seconds) {
    if (!this.available || !isFinite(seconds)) return;
    const d = this.el.duration;
    this.el.currentTime = Math.max(0, isFinite(d) ? Math.min(seconds, d) : seconds);
  }
  seekBy(delta) { this.seek((this.el.currentTime || 0) + delta); }

  get currentTime() { return this.el ? this.el.currentTime || 0 : 0; }
  get duration()    { return this.el && isFinite(this.el.duration) ? this.el.duration : 0; }
  get paused()      { return this.el ? this.el.paused : true; }

  /** Volume is 0-130 to match mpv's scale; above 100 uses the gain node. */
  setVolume(v) {
    if (!this.available) return;
    const pct = Math.max(0, Math.min(130, Number(v) || 0));
    this.el.volume = Math.min(1, pct / 100);
    this.gain.gain.value = pct > 100 ? pct / 100 : 1;
  }
  setMuted(on) { if (this.available) this.el.muted = !!on; }
  setSpeed(rate) {
    if (!this.available) return;
    this.el.preservesPitch = true;
    this.el.playbackRate = Math.max(0.25, Math.min(4, Number(rate) || 1));
  }

  /* ── equalizer ───────────────────────────────────────────────── */
  setEQBand(index, gainDb) {
    if (!this.available || !this.filters[index]) return;
    const g = Math.max(-12, Math.min(12, Number(gainDb) || 0));
    this._eqGains[index] = g;
    // setTargetAtTime rather than a hard assignment: stepping a filter gain
    // instantly produces an audible click.
    try { this.filters[index].gain.setTargetAtTime(g, this.ctx.currentTime, 0.02); }
    catch (_) { this.filters[index].gain.value = g; }
  }
  setEQ(gains) { (gains || []).forEach((g, i) => this.setEQBand(i, g)); }
  resetEQ()    { this.setEQ(new Array(EQ_FREQUENCIES.length).fill(0)); }
  getEQ()      { return [...this._eqGains]; }

  /** Handed to Visualizer so it draws real spectrum data instead of synth. */
  getAnalyser() { return this.available ? this.analyser : null; }

  destroy() {
    try { this.stop(); } catch (_) {}
    try { this.ctx && this.ctx.close(); } catch (_) {}
    this.available = false;
    this._handlers.clear();
  }
}
