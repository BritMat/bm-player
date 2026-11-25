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
 *   - the stream lost partway (v3.48.0) -> the same file again, from the same
 *                                          second, up to three times, then
 *                                          'fallback' with where it got to
 *   - user turns it off in settings     -> use mpv
 *
 * APE, WMA and MKA in particular are not decodable by Chromium, so those
 * always take the mpv path.
 *
 * On the phone (v3.55.1) there is one more case. When the web engine says
 * its sound runs at a call's rate (8 or 16 kHz, a Bluetooth headset on its
 * call channel), Web Audio would play every song at that rate, muffled like
 * a phone call, whatever rate the context itself is made at. The song then
 * plays from the audio element alone, which the web engine sends out at the
 * song's own rate (`plain`), without the equalizer and the visualiser, until
 * the way out changes (renew()).
 */

/* The equalizer's bands and the sound's effects are sound-chain.js's
   (v3.47.0), the same list mpv's filter is made from. EQ_FREQUENCIES is
   still given from here for whatever imported it from this file. */
import { EQ_FREQUENCIES, WebChain, settings as soundSettings, rateOf } from './sound-chain.js';
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
    // v3.48.0: carrying on after the stream is lost partway (_recover)
    this._src = null; this._at = 0; this._tries = 0; this._triedAt = 0; this._recovering = false; this._wantPlay = false;
    this._vol = 1; this._muted = false;
    this._rate = 1;               // the speed chosen, and a sound mode may play faster or slower on top (v3.49.0, _applyRate)
    // v3.55.1: on the phone, a song with no Web Audio when the sound runs at a call's rate (_graph)
    this._phone = typeof navigator !== 'undefined' && /BMPlayerAndroid/.test(navigator.userAgent || '');
    this.plain = false; this._probedAt = 0;

    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return;             // no Web Audio: stay unavailable, caller uses mpv
    this._Ctx = Ctx;
    // v3.45.0: the audio element now, the Web Audio graph when the first song
    // loads (_graph). An AudioContext made at start-up ran from then on: a
    // sound process of its own and its thread mixing silence, all day, in an
    // app opened only for a film. It also rests now (_restSoon) once nothing
    // has played for a little while.
    try {
      this._newElement();
      this.available = true;
    } catch (e) {
      console.warn('[AudioEngine] unavailable, falling back to mpv:', e && e.message);
      this.available = false;
    }
  }

  /** The Web Audio graph, made once, the first time a song loads. False if it cannot be. */
  _graph() {
    if (this.ctx || this.plain) return true;
    if (!this.available) return false;
    try {
      // On the phone (v3.48.0) the sound is mixed in larger blocks: fewer
      // wake-ups for the processor, and no gap when the phone is busy for a
      // moment. On the desktop it stays as quick as it can be.
      const opts = this._phone ? { latencyHint: 'playback' } : undefined;
      this.ctx = new this._Ctx(opts);
      this._probedAt = Date.now();
      // At a call's rate (a headset on its call channel runs at 8 or 16 kHz,
      // as a phone's log showed: "BiquadFilter 8000 outside [0, 4000]"),
      // every song would sound like a phone call. v3.48.0 made the context
      // again at 48000, but the web engine still sent it out at the call's
      // rate, and on a neckband songs stayed muffled. On the phone (v3.55.1)
      // the song plays from the audio element instead, which goes out at the
      // song's own rate (see the top of this file).
      if (this.ctx.sampleRate < 32000 && this._phone) {
        const low = this.ctx.sampleRate;
        this._closeCtx();
        this.plain = true;
        this.el.volume = Math.min(1, this._muted ? 0 : this._vol);
        console.warn('[AudioEngine] the web engine\'s sound runs at ' + low + ' Hz, a call\'s rate: songs play from the audio element, at their own rate, without the equalizer and the visualiser, until the way out changes');
        this._emit('plain', { rate: low });
        return true;
      }
      if (this._phone) console.warn('[AudioEngine] sound made at ' + this.ctx.sampleRate + ' Hz' + (this.ctx.baseLatency ? ', ' + Math.round(this.ctx.baseLatency * 1000) + ' ms' : ''));
      // On the desktop it is made again at a music rate, which the browser
      // converts to whatever the speakers take (mpv plays what Web Audio cannot).
      if (this.ctx.sampleRate < 32000) {
        const low = this.ctx.sampleRate;
        try { this.ctx.close(); } catch (_) {}
        this.ctx = new this._Ctx({ ...(opts || {}), sampleRate: 48000 });
        console.warn('[AudioEngine] the sound ran at ' + low + ' Hz (a call\'s rate): made again at 48000');
      }
      if (this._sinkId) this._applySink().catch(() => {});   // the device chosen (v3.59.0)
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
      this._closeCtx();
      this.available = false;
      return false;
    }
  }

  /**
   * The device songs go to (v3.59.0, output.js): a browser device id, or ''
   * for the system's own. The context is sent there where it can be
   * (AudioContext.setSinkId), else the element (plain, or before Web Audio).
   * Kept, and given again to a context or an element made after.
   */
  async setSink(id = '') {
    this._sinkId = id || '';
    return this._applySink();
  }
  async _applySink() {
    const id = this._sinkId || '';
    try {
      if (this.ctx && typeof this.ctx.setSinkId === 'function') { if ((this.ctx.sinkId || '') !== id) await this.ctx.setSinkId(id); return true; }
      if (this.el && typeof this.el.setSinkId === 'function') { if ((this.el.sinkId || '') !== id) await this.el.setSinkId(id); return true; }
    } catch (e) { console.warn('[AudioEngine] the sound could not go to that device:', e && e.message); throw e; }
    return !id;
  }

  /** A new audio element, wired, at the speed chosen (the old one is let go by renew). */
  _newElement() {
    this.el = new Audio();
    this.el.preload = 'auto';
    this.el.crossOrigin = 'anonymous';
    this._wireElement();
    if (this._rate !== 1 || rateOf(this._sound) !== 1) this._applyRate();
  }

  /** The context and its graph let go. */
  _closeCtx() {
    clearTimeout(this._restT); this._restT = 0;
    try { this.chain?.destroy(); } catch (_) {}
    try { this.ctx && this.ctx.close().catch(() => {}); } catch (_) {}
    this.ctx = this.source = this.gain = this.analyser = this._heard = this.tap = this.chain = null;
  }

  /**
   * The sound made again (v3.55.1): a new audio element and a new context,
   * the song going on from the same second, playing if it was. The phone
   * calls it when the way the sound goes out changes (a headset on or off,
   * its call channel opened or closed, a call) and when the microphone is
   * let go. The web engine keeps the stream it opened for the old way out,
   * at the old rate and as a call's sound or music's, until a new one is
   * asked for, and an audio element feeds one context only, ever.
   */
  renew(reason = '') {
    if (!this.available || !this.el) return false;
    const old = this.el, src = this._src, at = this.currentTime, play = this._wantPlay;
    clearTimeout(this._recT); this._unwatch();
    this._closeCtx();
    this.plain = false;
    // its events come after this, and are its own (_wireElement): not heard
    try { old.pause(); old.removeAttribute('src'); old.load(); } catch (_) {}
    this._newElement();
    console.warn('[AudioEngine] the sound made again' + (reason ? ' (' + reason + ')' : '') + (src ? ', the song going on from ' + Math.floor(at / 60) + ':' + String(Math.floor(at % 60)).padStart(2, '0') : ''));
    if (!src || !this.active) { this._recovering = false; this._wantPlay = false; this._emit('renewed', { plain: false }); return true; }
    if (!this._graph()) return false;
    this._applyGain();
    const el = this.el;
    this._recovering = true; this._at = at; this._wantPlay = play;
    const onMeta = () => {
      el.removeEventListener('loadedmetadata', onMeta);
      if (this.el !== el || this._src !== src) return;
      try { el.currentTime = Math.max(0, Math.min(at, (el.duration || at + 1) - 0.5)); } catch (_) {}
      this._recovering = false;
      if (this._wantPlay) this.play();
      else this._restSoon();
    };
    el.addEventListener('loadedmetadata', onMeta);
    el.src = src;
    try { el.load(); } catch (_) {}
    this._emit('renewed', { plain: this.plain });
    return true;
  }

  /**
   * The equalizer and the sound effects (sound-chain.js, v3.47.0): night mode,
   * which ear hears what, a boost past 100%. Kept here, and given to the
   * graph when there is one; with none yet it is made with them.
   *   setSound({ eq, channels, night, boost })   any of them; the rest stay
   *   setFx({ night, channels, boost })          the effects alone (v3.46.0)
   */
  setSound(next) {
    const rate = rateOf(this._sound);
    this._sound = soundSettings({ ...this._sound, ...next });
    this.chain?.set(this._sound);
    // Slowed and Nightcore (v3.49.0) play faster or slower, the pitch following
    if (rateOf(this._sound) !== rate) this._applyRate();
  }
  /** The equalizer and the effects as they are now (sound-chain.js settings). */
  get sound() { return this._sound; }
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
    // An element let go by renew() still tells of its last moments: not heard.
    const mine = () => e === this.el;
    e.addEventListener('loadedmetadata', () => { if (mine() && !this._recovering) this._emit('loaded', { duration: e.duration || 0 }); });
    e.addEventListener('timeupdate', () => {
      if (!mine() || this._recovering) return;      // the same song again: its position goes on from where it was
      this._at = e.currentTime || 0;
      if (this._tries && this._at > this._triedAt + 30) this._tries = 0;   // half a minute on since the last loss: tries anew
      this._emit('time', { time: this._at, duration: e.duration || 0 });
    });
    e.addEventListener('play', () => {
      if (!mine()) return;
      clearTimeout(this._restT); this._restT = 0;
      this._wantPlay = true;
      // Started some other way than play() (a test, the system's media keys):
      // the context is woken all the same, or the song would stand still.
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this._watch();
      this._emit('play');
    });
    e.addEventListener('pause', () => { if (!mine() || this._recovering) return; this._wantPlay = false; this._unwatch(); this._restSoon(); this._emit('pause'); });
    e.addEventListener('ended', () => { if (!mine()) return; this._wantPlay = false; this._unwatch(); this._restSoon(); this._emit('ended'); });
    e.addEventListener('error', () => {
      if (!mine()) return;
      const code = e.error && e.error.code;
      if (!this.active || !this._src) return;      // put away already: nothing to carry on with
      this._lost(code);
    });
  }

  /**
   * The song stopped with an error (v3.48.0). A network error partway (2:
   * the file's stream was lost, as the phone's log showed, mid-song) is
   * tried again from the same second, three times at most, and only then is
   * the song handed back, with where it got to. A file that cannot be decoded
   * (3) or opened (4) partway has one more try (a stream that came mangled
   * decodes the second time; a file broken there fails there again). Before
   * it played at all it is handed back at once, as before. A loss in the
   * last two seconds is the song ending.
   */
  _lost(code) {
    const at = this._at || 0, d = this.duration;
    const what = { 1: 'stopped loading', 2: 'lost its stream (a network error)', 3: 'could not be decoded', 4: 'could not be opened', stall: 'stood still for ' + Math.round(AudioEngine.STALL_MS / 1000) + ' seconds' }[code] || ('failed (code ' + code + ')');
    const when = at ? ' at ' + Math.floor(at / 60) + ':' + String(Math.floor(at % 60)).padStart(2, '0') : '';
    if (d && at > d - 2) { console.warn('[AudioEngine] the song ' + what + when + ', at its end: on to the next'); this._recovering = false; this._wantPlay = false; this._unwatch(); this._emit('ended'); return; }
    // A file that played and then failed to decode or read (3, 4) has one try:
    // what fails at the same place again is the file. Before it played at all
    // it is handed back at once, as before (a format the browser lacks).
    const lostStream = code === 1 || code === 2 || code === 'stall';
    if ((lostStream && this._tries < 3) || (!lostStream && at > 1 && this._tries < 1)) {
      this._tries++; this._triedAt = at;
      console.warn('[AudioEngine] the song ' + what + when + ': carrying on from there, try ' + this._tries + ' of 3');
      this._recover();
      return;
    }
    console.warn('[AudioEngine] the song ' + what + when + ': handing it back');
    this._recovering = false; this._unwatch();
    this.active = false;
    this._emit('fallback', { path: this._path, code, at });
  }

  // The same file loaded again, then the position it had, then playing if it
  // was. A short wait first, longer with each try: whatever cut the stream
  // (the phone busy, the file held by another app) may still be at it.
  _recover() {
    const src = this._src, el = this.el;
    this._recovering = true;
    clearTimeout(this._recT);
    this._recT = setTimeout(() => {
      if (this._src !== src || !this.active) { this._recovering = false; return; }
      const onMeta = () => {
        el.removeEventListener('loadedmetadata', onMeta);
        if (this._src !== src) return;
        try { el.currentTime = Math.max(0, Math.min(this._at, (el.duration || this._at + 1) - 0.5)); } catch (_) {}
        this._recovering = false;
        if (this._wantPlay) el.play().catch(() => {});
        this._emit('recovered', { at: this._at, tries: this._tries });
      };
      el.addEventListener('loadedmetadata', onMeta);
      // Asked for afresh, by an address of its own: the browser's own tries
      // to go on with the stream that broke keep the old one (the servers on
      // the desktop and the phone read only the path). A blob or data address
      // takes no query.
      el.src = /^(blob|data):/i.test(src) ? src : src + (src.includes('?') ? '&' : '?') + 'bmtry=' + this._tries;
      try { el.load(); } catch (_) {}
    }, 300 * this._tries);
  }

  // A song that stands still while it should play, with no error at all (a
  // stream that hangs): after STALL_MS (twelve seconds) it is treated as lost.
  _watch() {
    if (this._watchT) return;
    const every = AudioEngine.STALL_MS / 6;
    let last = -1, still = 0;
    this._watchT = setInterval(() => {
      const el = this.el;
      if (!this._wantPlay || this._recovering || el.paused || el.seeking || !this.active) { still = 0; last = -1; return; }
      const t = el.currentTime || 0;
      if (Math.abs(t - last) < 0.05 && el.readyState < 3) { still += every; if (still >= AudioEngine.STALL_MS) { still = 0; last = -1; this._lost('stall'); } }
      else still = 0;
      last = t;
    }, every);
  }
  _unwatch() { clearInterval(this._watchT); this._watchT = 0; }

  /* ── transport ───────────────────────────────────────────────── */
  async load(url, path, autoplay = true) {
    // Playing plain (v3.55.1): a new song looks again whether Web Audio can
    // be used, a minute on. This element has fed no context, so it can.
    if (this.plain && Date.now() - this._probedAt > AudioEngine.LOOK_AGAIN_MS) { this.plain = false; this.el.volume = 1; }
    if (!this.available || !this._graph()) return false;
    this._path = path || url;
    this.active = true;
    clearTimeout(this._recT);
    this._src = url; this._at = 0; this._tries = 0; this._triedAt = 0; this._recovering = false;
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
    if (this.ctx && this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (_) {} }
    this._wantPlay = true;
    if (this._recovering) return true;            // it plays once it is back (_recover)
    try { await this.el.play(); return true; }
    catch (e) {
      // A pause in between (the user, or the phone's audio focus) is not a failure.
      if (e && e.name === 'AbortError') return false;
      console.warn('[AudioEngine] play rejected:', e && e.message); return false;
    }
  }
  pause()  { if (this.available) { this._wantPlay = false; this.el.pause(); } }
  toggle() { return this.el && this.el.paused ? this.play() : this.pause(); }
  stop() {
    if (!this.available) return;
    clearTimeout(this._recT); this._unwatch();
    this._wantPlay = false; this._recovering = false; this._src = null;
    this.el.pause();
    try { this.el.removeAttribute('src'); this.el.load(); } catch (_) {}
    this.active = false;
    this._path = null;
    this._restSoon();
  }

  seek(seconds) {
    if (!this.available || !isFinite(seconds)) return;
    const d = this.el.duration;
    const t = Math.max(0, isFinite(d) ? Math.min(seconds, d) : seconds);
    this._at = t;                                  // where a song being carried on goes back to, too
    if (this._recovering) return;
    this.el.currentTime = t;
  }
  seekBy(delta) { this.seek((this.el.currentTime || 0) + delta); }

  get currentTime() { return this.el ? (this._recovering ? this._at : this.el.currentTime || 0) : 0; }
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
    // Plain (v3.55.1): the element's own volume, which stops at 100%.
    if (this.plain) { try { this.el.volume = Math.min(1, this._muted ? 0 : this._vol); } catch (_) {} return; }
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
    this._rate = Math.max(0.25, Math.min(4, Number(rate) || 1));
    this._applyRate();
  }
  /**
   * The speed chosen, times the sound mode's (v3.49.0): Slowed plays at 0.85
   * and Nightcore at 1.25 with the pitch following, as a record played
   * slower or faster would. Otherwise the pitch is kept, as before.
   */
  _applyRate() {
    if (!this.available) return;
    const mode = rateOf(this._sound), r = Math.max(0.25, Math.min(4, this._rate * mode));
    this.el.preservesPitch = mode === 1;
    // The default as well (v3.38.0): loading the next song sets an audio
    // element's speed back to its default, so the speed held for one song.
    this.el.defaultPlaybackRate = r;
    this.el.playbackRate = r;
  }
  /** The speed chosen (what the speed menus show). */
  get speed() { return this.available ? this._rate : 1; }
  /** The speed it plays at: the one chosen, times a sound mode's. */
  get rate() { return this.available ? this.el.playbackRate : 1; }

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
    clearTimeout(this._recT); this._unwatch();
    clearTimeout(this._restT);
    this._closeCtx();
    this.available = false;
    this._handlers.clear();
  }
}

/** How long nothing plays before the audio rests (v3.45.0). */
AudioEngine.REST_MS = 10000;
/** How long a song may stand still, while it should play, before it is taken as lost (v3.48.0). */
AudioEngine.STALL_MS = 12000;
/** Playing plain, how long before a new song looks again whether Web Audio can be used (v3.55.1). */
AudioEngine.LOOK_AGAIN_MS = 60000;
