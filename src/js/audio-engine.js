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
    this._vol = 1; this._muted = false;
    this._fx = { night: false, channels: 'stereo', boost: 1 };   // v3.46.0: setFx()

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

      // Peaking filters in series, one per band. Q of 1.1 gives roughly
      // one-octave bandwidth, which is what a 10-band graphic EQ implies.
      this.filters = EQ_FREQUENCIES.map((f, i) => {
        const b = this.ctx.createBiquadFilter();
        b.type = 'peaking';
        b.frequency.value = f;
        b.Q.value = 1.1;
        b.gain.value = this._eqGains[i] || 0;
        return b;
      });

      this.gain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;   // 1024 (v3.32.0): MilkDrop reads 1024 samples
      this.analyser.smoothingTimeConstant = 0.8;

      // v3.36.0: the visualiser hears the music as it is, whatever the volume.
      //   source -> f0 -> ... -> f9 -+-> gain -> speakers              the sound
      //                              +-> analyser -> tap (0) -> speakers   the measurement
      // The analyser used to sit after the volume, and the volume was the audio
      // element's own, which is applied before any of this: at a low volume
      // every visualiser shrank, and mute stopped them dead. Volume and mute
      // now live in the gain, after the point the analyser listens at. (The tap
      // is silent, and there so the analyser is always being fed.)
      let node = this.source;
      for (const f of this.filters) { node.connect(f); node = f; }
      this._eqOut = node;
      this._buildFx();
      this.gain.connect(this.ctx.destination);
      this.tap = this.ctx.createGain();
      this.tap.gain.value = 0;
      node.connect(this.analyser);
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
   * Sound effects (v3.46.0), between the equalizer and the volume:
   *
   *   EQ -> two channels -> splitter -> four gains -> merger   which ear hears what
   *      -> [compressor -> make-up gain]                      night mode
   *      -> boost -> [limiter]                                louder than 100%
   *      -> volume
   *
   * The first gain makes two channels of whatever comes in, a mono song or a
   * 5.1 one, mixed as speakers would, so the four gains always have a left
   * and a right to work with. The compressor and the limiter are only in the
   * chain while they are wanted: a compressor at rest still changes the sound.
   */
  _buildFx() {
    const c = this.ctx;
    this._two = c.createGain();
    this._two.channelCount = 2; this._two.channelCountMode = 'explicit'; this._two.channelInterpretation = 'speakers';
    this._split = c.createChannelSplitter(2);
    this._merge = c.createChannelMerger(2);
    // _route[from][to]: how much of the left (0) or right (1) goes to each ear
    this._route = [0, 1].map(from => [0, 1].map(to => {
      const g = c.createGain(); this._split.connect(g, from); g.connect(this._merge, 0, to); return g;
    }));
    this._eqOut.connect(this._two); this._two.connect(this._split);
    this._comp = c.createDynamicsCompressor();
    this._comp.threshold.value = -26; this._comp.knee.value = 12; this._comp.ratio.value = 4;
    this._comp.attack.value = 0.008; this._comp.release.value = 0.25;
    this._makeup = c.createGain(); this._makeup.gain.value = 2;     // +6 dB: the quiet parts come up
    this._comp.connect(this._makeup);
    this._boost = c.createGain();
    this._limit = c.createDynamicsCompressor();
    this._limit.threshold.value = -1.5; this._limit.knee.value = 0; this._limit.ratio.value = 20;
    this._limit.attack.value = 0.002; this._limit.release.value = 0.1;
    this._wireFx();
  }
  _wireFx() {
    if (!this.ctx || !this._merge) return;
    const fx = this._fx;
    const ROUTES = { stereo: [[1, 0], [0, 1]], mono: [[0.5, 0.5], [0.5, 0.5]], left: [[1, 1], [0, 0]], right: [[0, 0], [1, 1]], swap: [[0, 1], [1, 0]] };
    const r = ROUTES[fx.channels] || ROUTES.stereo;
    for (const from of [0, 1]) for (const to of [0, 1]) this._route[from][to].gain.value = r[from][to];
    for (const n of [this._merge, this._makeup, this._boost, this._limit]) { try { n.disconnect(); } catch (_) {} }
    try { this._comp.disconnect(); } catch (_) {}
    this._comp.connect(this._makeup);
    let node = this._merge;
    if (fx.night) { node.connect(this._comp); node = this._makeup; }
    node.connect(this._boost); node = this._boost;
    this._boost.gain.value = fx.boost;
    if (fx.boost > 1 || fx.night) { node.connect(this._limit); node = this._limit; }
    node.connect(this.gain);
  }
  /** night: true or false. channels: stereo, mono, left, right or swap. boost: 1 to 2. */
  setFx(opts) {
    const f = this._fx;
    if (opts && 'night' in opts) f.night = !!opts.night;
    if (opts && 'channels' in opts) f.channels = ['stereo', 'mono', 'left', 'right', 'swap'].includes(opts.channels) ? opts.channels : 'stereo';
    if (opts && 'boost' in opts) f.boost = Math.max(1, Math.min(2, Number(opts.boost) || 1));
    this._wireFx();   // no graph yet: it is made with these
  }
  getFx() { return { ...this._fx }; }

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
  setEQBand(index, gainDb) {
    if (!this.available || index < 0 || index >= EQ_FREQUENCIES.length) return;
    const g = Math.max(-12, Math.min(12, Number(gainDb) || 0));
    this._eqGains[index] = g;
    if (!this.filters) return;    // no graph yet: it starts with these
    // setTargetAtTime rather than a hard assignment: stepping a filter gain
    // instantly produces an audible click. At rest the value is set outright,
    // as in _applyGain.
    const p = this.filters[index].gain;
    try {
      if (this.ctx.state === 'running') p.setTargetAtTime(g, this.ctx.currentTime, 0.02);
      else { p.cancelScheduledValues(0); p.value = g; }
    } catch (_) { p.value = g; }
  }
  setEQ(gains) { (gains || []).forEach((g, i) => this.setEQBand(i, g)); }
  resetEQ()    { this.setEQ(new Array(EQ_FREQUENCIES.length).fill(0)); }
  getEQ()      { return [...this._eqGains]; }

  /** Handed to Visualizer so it draws real spectrum data instead of synth.
   *  Null until a song has loaded: asking does not make the graph, as the
   *  fox and Flow ask several times a second on the home screen. */
  getAnalyser() { return this.available && this.ctx ? this.analyser : null; }

  destroy() {
    try { this.stop(); } catch (_) {}
    clearTimeout(this._restT);
    try { this.ctx && this.ctx.close(); } catch (_) {}
    this.available = false;
    this._handlers.clear();
  }
}

/** How long nothing plays before the audio rests (v3.45.0). */
AudioEngine.REST_MS = 10000;
