/**
 * Songs made equally loud (v3.59.0, the plan's 3.58).
 *
 * One song in a library can be twice as loud as the next. With this on, each
 * song plays at a level that brings it to the same loudness, -18 LUFS, the
 * reference ReplayGain 2 uses. Where that level comes from, in order:
 *
 *   1. the song's ReplayGain tags (read in main/library.js): the album's
 *      gain in album mode, when the file has one, else the song's own
 *   2. what this app measured the last time the song played (Meter below),
 *      kept in localStorage, so a library without tags is levelled too
 *   3. nothing: the song plays as it is, and is measured while it plays
 *
 * A song is not made louder past its peak, with half a decibel to spare,
 * so levelling never makes a quiet song crackle. A song measured for the
 * first time keeps its level to its end: the figure is used from its next
 * play on. Turning levelling on or off changes the playing song at once,
 * with a short glide. Songs mpv plays (formats the
 * engine cannot read) get mpv's own ReplayGain from their tags.
 *
 * The meter is BS.1770's, simply done: the two K-weighting filters as
 * biquads, each ear's power read from an analyser ten times a second, in
 * blocks of 400 ms, then the blocks below -70 LUFS and those more than
 * 10 LU under the rest left out. It reads the song before its level, its
 * equalizer and its effects (the engine's tapIn), so what it measures is
 * the file. It measures only songs it has no figure for, and only while
 * they play at their own speed.
 */
export const TARGET = -18;
export const LEVEL_MODES = [['off', 'Off'], ['track', 'Song by song'], ['album', 'Album by album']];
const KEY = 'bm_loudness', SEEN = 'bm_loudness_seen', MAX_SEEN = 4000;
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) {} return null; };
const db = x => 20 * Math.log10(x);

/**
 * The level for a song, in dB, and where it came from.
 *   tags   { rgTrack, rgTrackPeak, rgAlbum, rgAlbumPeak } (dB, and peaks as ratios)
 *   seen   what was measured: { lufs, peak }
 */
export function levelFor (mode, tags = {}, seen = null) {
  if (mode !== 'track' && mode !== 'album') return { db: 0, from: null };
  let gain = null, peak = null, from = null;
  const t = tags || {};
  if (mode === 'album' && Number.isFinite(t.rgAlbum)) { gain = t.rgAlbum; peak = t.rgAlbumPeak; from = 'album tags'; }
  else if (Number.isFinite(t.rgTrack)) { gain = t.rgTrack; peak = t.rgTrackPeak; from = 'tags'; }
  else if (seen && Number.isFinite(seen.lufs)) { gain = TARGET - seen.lufs; peak = seen.peak; from = 'measured'; }
  if (gain == null) return { db: 0, from: null };
  // never past the peak: a song lifted until it would clip is lifted less
  if (gain > 0 && Number.isFinite(peak) && peak > 0) gain = Math.min(gain, -db(peak) - 0.5);
  gain = Math.max(-18, Math.min(12, gain));
  return { db: Math.round(gain * 10) / 10, from };
}

/** Integrated loudness from block powers (each the sum of the ears' mean squares), gated as BS.1770 does. */
export function integrate (blocks) {
  const L = z => -0.691 + 10 * Math.log10(z);
  const abs = blocks.filter(z => z > 0 && L(z) > -70);
  if (!abs.length) return null;
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const rel = L(mean(abs)) - 10;
  const kept = abs.filter(z => L(z) > rel);
  return kept.length ? Math.round(L(mean(kept)) * 10) / 10 : null;
}

/** The meter: K-weighting, then each ear's power. */
export class Meter {
  constructor (ctx, input) {
    this.ctx = ctx;
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1681; shelf.gain.value = 4;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = -6.02;   // Q 0.5, in dB for Web Audio
    const split = ctx.createChannelSplitter(2);
    this.ears = [0, 1].map(ch => { const a = ctx.createAnalyser(); a.fftSize = 2048; split.connect(a, ch); return a; });
    // the analysers are fed, never heard: a silent gain after them keeps them running
    this.sink = ctx.createGain(); this.sink.gain.value = 0;
    for (const a of this.ears) a.connect(this.sink);
    this.sink.connect(ctx.destination);
    input.connect(shelf); shelf.connect(hp); hp.connect(split);
    this.nodes = [shelf, hp, split, ...this.ears, this.sink];
    this.input = input; this.first = shelf;
    this.buf = new Float32Array(2048);
  }
  /** The ears' mean squares added, and the highest sample, of the latest window. */
  read () {
    let sum = 0, peak = 0;
    for (const a of this.ears) {
      if (typeof a.getFloatTimeDomainData !== 'function') return null;
      a.getFloatTimeDomainData(this.buf);
      let ms = 0; for (let i = 0; i < this.buf.length; i++) { const v = this.buf[i]; ms += v * v; const m = v < 0 ? -v : v; if (m > peak) peak = m; }
      sum += ms / this.buf.length;
    }
    return { power: sum, peak };
  }
  destroy () { try { this.input.disconnect(this.first); } catch (_) {} for (const n of this.nodes) { try { n.disconnect(); } catch (_) {} } }
}

/**
 * The music's levelling: the mode, what was measured, and the meter on the
 * engine. The music view asks it for each song's level (level(path)).
 */
export class Leveller {
  constructor (engine, { tags = () => null, osd = () => {} } = {}) {
    this.engine = engine; this.tags = tags; this.osd = osd;
    const m = store(KEY);
    this.mode = LEVEL_MODES.some(([k]) => k === m) ? m : 'off';
    try { this.seen = JSON.parse(store(SEEN) || '{}') || {}; } catch (_) { this.seen = {}; }
    this.meter = null; this._m = null; this._t = 0;
    if (!engine) return;
    engine.on('graph', () => this._build());
    engine.on('loaded', () => this._begin(engine._path));   // also after 'advanced', for a song that flowed in
    engine.on('ended', () => this._finish());
    engine.on('fallback', () => this._drop());
    engine.on('renewed', () => this._drop());
  }
  setMode (m, say) {
    if (!LEVEL_MODES.some(([k]) => k === m)) m = 'off';
    this.mode = m; store(KEY, m);
    if (say) this.osd(m === 'off' ? 'Songs play at their own loudness' : m === 'album' ? 'Songs made equally loud, album by album' : 'Songs made equally loud');
  }
  /** A song's level in dB, for the mode: 0 when off or nothing is known. */
  level (path) { return levelFor(this.mode, this.tags(path) || {}, this.seen[path] || null); }

  _build () {
    this.meter?.destroy(); this.meter = null;
    const e = this.engine;
    if (e?.ctx && e.tapIn) { try { this.meter = new Meter(e.ctx, e.tapIn); } catch (_) { this.meter = null; } }
  }
  /** Measuring the song that started, if nothing is known of it yet. */
  _begin (path) {
    this._finish();
    if (!path || this.seen[path]) return;
    const t = this.tags(path) || {};
    if (Number.isFinite(t.rgTrack)) return;
    if (!this.meter) this._build();
    if (!this.meter) return;
    this._m = { path, blocks: [], win: [], peak: 0, secs: 0, dur: this.engine.duration || 0 };
    this._t = setInterval(() => this._tick(), 100);
  }
  _tick () {
    const m = this._m, e = this.engine;
    if (!m || e._path !== m.path) { this._finish(); return; }
    // only the song as it is: playing, at its own speed, not going into the next
    if (e.paused || e._recovering || e._xf || e.el?.seeking || Math.abs((e.rate || 1) - 1) > 0.01) { m.win.length = 0; return; }
    if (!m.dur) m.dur = e.duration || 0;   // known once the song has begun, if not when it loaded
    const r = this.meter.read(); if (!r) return;
    m.win.push(r.power); m.secs += 0.1; if (r.peak > m.peak) m.peak = r.peak;
    if (m.win.length >= 4) { m.blocks.push(m.win.reduce((a, b) => a + b, 0) / 4); m.win.shift(); }   // 400 ms blocks, 75% overlap
  }
  /** What was measured kept, when enough of the song was heard. */
  _finish () {
    clearInterval(this._t); this._t = 0;
    const m = this._m; this._m = null;
    if (!m) return;
    if (m.secs < Math.min(60, m.dur * 0.4 || 60)) return;
    const lufs = integrate(m.blocks);
    if (lufs == null) return;
    this.seen[m.path] = { lufs, peak: Math.round(m.peak * 1000) / 1000 };
    const keys = Object.keys(this.seen);
    if (keys.length > MAX_SEEN) for (const k of keys.slice(0, keys.length - MAX_SEEN)) delete this.seen[k];
    store(SEEN, JSON.stringify(this.seen));
  }
  _drop () { clearInterval(this._t); this._t = 0; this._m = null; }
}
