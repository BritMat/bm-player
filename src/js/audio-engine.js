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

/* The equalizer's bands and the sound's effects are sound-chain.js's
   (v3.47.0), the same list mpv's filter is made from. EQ_FREQUENCIES is
   still given from here for whatever imported it from this file. */
import { EQ_FREQUENCIES, WebChain, settings as soundSettings } from './sound-chain.js';
export { EQ_FREQUENCIES };

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
    this._sound = soundSettings();   // the equalizer and the effects (sound-chain.js), kept for the graph
    this._vol = 1; this._muted = false;

    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return;             // no Web Audio: stay unavailable, caller uses mpv
    this._Ctx = Ctx;
    // v3.45.0: the audio element now, the Web Audio graph when the first song
    // loads (_graph). An AudioContext made at start-up ran from then on: a
    // sound process of its own and its thread mixing silence, all day, in an
    // app opened only for a film. It also rests now (_restSoon) once nothing
    // has played for a little while.
    try {
      this.el = new Audio();
      this.el.preload = 'auto';
      this.el.crossOrigin = 'anonymous';
      this._wireElement();
      this.available = true;
    } catch (e) {
      console.warn('[AudioEngine] unavailable, falling back to mpv:', e && e.message);
      this.available = false;
    }
  }

  /** The Web Audio graph, made once, the first time a song loads. False if it cannot be. */
  _graph() {
    if (this.ctx) return true;
    if (!this.available) return false;
    try {
      this.ctx = new this._Ctx();
      this.source = this.ctx.createMediaElementSource(this.el);

      this.gain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;   // 1024 (v3.32.0): MilkDrop reads 1024 samples
      this.analyser.smoothingTimeConstant = 0.8;

      // v3.36.0: the visualiser hears the music as it is, whatever the volume.
      //   source -> [equalizer] -> heard -+-> [channels, night, boost, limiter] -> gain -> speakers
      //                                   +-> analyser -> tap (0) -> speakers   the measurement
      // The analyser used to sit after the volume, and the volume was the audio
      // element's own, which is applied before any of this: at a low volume
      // every visualiser shrank, and mute stopped them dead. Volume and mute
      // now live in the gain, after the point the analyser listens at. (The tap
      // is silent, and there so the analyser is always being fed.)
      // The effects in brackets are put in only while they are on (v3.47.0,
      // sound-chain.js): with none, the song goes straight to the volume.
      this._heard = this.ctx.createGain();
      this.chain = new WebChain(this.ctx, { from: this.source, heard: this._heard, to: this.gain });
      this.chain.set(this._sound);
      this.gain.connect(this.ctx.destination);
      this.tap = this.ctx.createGain();
      this.tap.gain.value = 0;
      this._heard.connect(this.analyser);
      this.analyser.connect(this.tap);
      this.tap.connect(this.ctx.destination);
      this._applyGain();
      this._restSoon();             // made for a song that waits (the phone's queue at start-up): it rests
      return true;
    } catch (e) {
      // A failure here is expected on some configurations; it is not an error.
      console.warn('[AudioEngine] unavailable, falling back to mpv:', e && e.message);
      try { this.ctx && this.ctx.close(); } catch (_) {}
      this.ctx = null;
      this.available = false;
      return false;
    }
  }

  /**
   * The equalizer and the sound effects (sound-chain.js, v3.47.0): night mode,
   * which ear hears what, a boost past 100%. Kept here, and given to the
   * graph when there is one; with none yet it is made with them.
   *   setSound({ eq, channels, night, boost })   any of them; the rest stay
   *   setFx({ night, channels, boost })          the effects alone (v3.46.0)
   */
  setSound(next) {
    this._sound = soundSettings({ ...this._sound, ...next });
    this.chain?.set(this._sound);
  }
  setFx(opts) {
    const o = {};
    for (const k of ['night', 'channels', 'boost']) if (opts && k in opts) o[k] = opts[k];
    this.setSound(o);
  }
  getFx() { const { night, channels, boost } = this._sound; return { night, channels, boost }; }
  /** The equalizer's ten filters, while it has been on (they are made then). */
  get filters() { return this.chain?.made.get('eq')?.bands || null; }

  /**
   * Nothing playing for REST_MS: the context is suspended, so its thread
   * stops and the sound device is let go (v3.45.0). Playing resumes it, in
   * the few milliseconds that takes, before the song starts.
   */
  _restSoon() {
    clearTimeout(this._restT);
    this._restT = setTimeout(() => {
      this._restT = 0;
      if (this.ctx && this.ctx.state === 'running' && (!this.el || this.el.paused)) this.ctx.suspend().catch(() => {});
    }, AudioEngine.REST_MS);
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
    e.addEventListener('play', () => {
      clearTimeout(this._restT); this._restT = 0;
      // Started some other way than play() (a test, the system's media keys):
      // the context is woken all the same, or the song would stand still.
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this._emit('play');
    });
    e.addEventListener('pause',          () => { this._restSoon(); this._emit('pause'); });
    e.addEventListener('ended',          () => { this._restSoon(); this._emit('ended'); });
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
    if (!this.available || !this._graph()) return false;
    this._path = path || url;
    this.active = true;
    this.el.src = url;
    try { this.el.load(); } catch (_) {}
    if (autoplay) return this.play();
    return true;
  }

  async play() {
    if (!this.available || !this.el.src || !this._graph()) return false;
    clearTimeout(this._restT); this._restT = 0;
    // Browsers start the context suspended until a gesture, and it is put to
    // rest when nothing plays (_restSoon): resumed here, before the song.
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
    this._restSoon();
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

  /** Volume is 0-130 to match mpv's scale. All of it is the gain node's (v3.36.0). */
  setVolume(v) {
    if (!this.available) return;
    this._vol = Math.max(0, Math.min(130, Number(v) || 0)) / 100;
    this._applyGain();
  }
  setMuted(on) { if (this.available) { this._muted = !!on; this._applyGain(); } }
  _applyGain() {
    if (!this.gain) return;       // no graph yet: the first song starts at this volume
    const g = this._muted ? 0 : this._vol, p = this.gain.gain;
    try {
      // While sound is running, a short glide: a jump in gain is heard as a
      // click. Before it runs there is nothing to click, and a glide set now
      // would be played out when the first song starts, from full volume. So
      // then the value is set outright, with nothing left scheduled that could
      // override it.
      const t = this.ctx.currentTime;
      if (this.ctx.state === 'running') { p.cancelScheduledValues(t); p.setTargetAtTime(g, t, 0.015); }
      else { p.cancelScheduledValues(0); p.value = g; }
    } catch (_) { p.value = g; }
  }
  setSpeed(rate) {
    if (!this.available) return;
    const r = Math.max(0.25, Math.min(4, Number(rate) || 1));
    this.el.preservesPitch = true;
    // The default as well (v3.38.0): loading the next song sets an audio
    // element's speed back to its default, so the speed held for one song.
    this.el.defaultPlaybackRate = r;
    this.el.playbackRate = r;
  }
  get speed() { return this.available ? this.el.playbackRate : 1; }

  /* ── equalizer ───────────────────────────────────────────────── */
  // A band's gain glides while the sound runs (stepping a filter's gain
  // clicks) and is set outright at rest: sound-chain.js's WebChain._to.
  setEQBand(index, gainDb) {
    if (!this.available || index < 0 || index >= EQ_FREQUENCIES.length) return;
    const eq = this._sound.eq.slice(); eq[index] = gainDb;
    this.setSound({ eq });
  }
  setEQ(gains) {
    if (!this.available) return;
    const eq = this._sound.eq.slice();
    (gains || []).forEach((g, i) => { if (i < eq.length) eq[i] = g; });
    this.setSound({ eq });
  }
  resetEQ()    { this.setEQ(new Array(EQ_FREQUENCIES.length).fill(0)); }
  getEQ()      { return [...this._sound.eq]; }

  /** Handed to Visualizer so it draws real spectrum data instead of synth.
   *  Null until a song has loaded: asking does not make the graph, as the
   *  fox and Flow ask several times a second on the home screen. */
  getAnalyser() { return this.available && this.ctx ? this.analyser : null; }

  destroy() {
    try { this.stop(); } catch (_) {}
    clearTimeout(this._restT);
    try { this.chain?.destroy(); } catch (_) {}
    try { this.ctx && this.ctx.close(); } catch (_) {}
    this.available = false;
    this._handlers.clear();
  }
}

/** How long nothing plays before the audio rests (v3.45.0). */
AudioEngine.REST_MS = 10000;
