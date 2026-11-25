/**
 * m-player: what plays, in what order. The music plays in the page, through
 * the desktop's AudioEngine (an audio element into Web Audio), so the
 * visualiser hears the real sound and the equaliser works. Android shows it
 * in the notification and on the lock screen (PlaybackService, told by
 * android playback()), and its buttons come back as 'remote' events.
 *
 * The queue is kept (song ids, the order, the place and the time), so the
 * app opens where it was left, paused, unless Settings says not to.
 *
 * close() (v3.43.0) stops the music and puts it all away: the bar above the
 * tabs, Android's notification and the queue kept for next time. The bar
 * had no way to go once something had played, and came back each time the
 * app opened.
 */
import { AudioEngine } from './audio-engine.js';
import { eqFrom, EQ_FREQUENCIES } from './sound-chain.js';   // v3.59.0: fifteen bands
import { EqPresets } from './eq-presets.js';                  // v3.59.0: presets of your own, and by output
import { call, on } from './m-android.js';
import { lib } from './m-library.js';
import { toast, fmtTime } from './m-ui.js';

const KEEP = 'bm_m_queue', SPEED = 'bm_m_speed', EQ = 'bm_m_eq', KEEPQ = 'bm_m_keepq', SOUND = 'bm_m_sound', FLOW = 'bm_m_flow';
const listeners = new Map();

/** Whether the queue is kept for the next time the app opens (Settings, v3.43.0). */
export const keepQueue = () => { try { return localStorage.getItem(KEEPQ) !== '0'; } catch (_) { return true; } };
export function setKeepQueue (on) {
  try { localStorage.setItem(KEEPQ, on ? '1' : '0'); if (!on) localStorage.removeItem(KEEP); } catch (_) {}
  if (on) player.save();
}

export const player = {
  engine: null,
  queue: [],            // the songs, in the order they were given
  order: [],            // positions in queue, in the order they play (shuffled or not)
  at: -1,               // where in order
  shuffle: false,
  repeat: 'off',        // 'off', 'all' or 'one'
  from: '',             // what the queue came from ("Album: ...")
  failed: 0,            // songs in a row that would not play

  on (type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
  emit (type, data) {
    for (const fn of listeners.get(type) || []) { try { fn(data); } catch (e) { console.error('[BM Player] player ' + type + ':', e); } }
    // v3.59.0: any change to the queue, its order or repeat: the song waiting next is told again, once
    if (type === 'queue' && !this._nextSoon) { this._nextSoon = true; queueMicrotask(() => { this._nextSoon = false; this.prepNext(); }); }
  },

  get current () { return this.at >= 0 ? this.queue[this.order[this.at]] || null : null; },
  get paused () { return !this.engine || this.engine.paused; },
  get time () { return this.engine ? this.engine.currentTime : 0; },
  get duration () { return (this.engine && this.engine.duration) || this.current?.duration || 0; },
  /** The songs still to come, in order. */
  upNext () { return this.order.slice(this.at + 1).map(i => this.queue[i]); },

  init () {
    this.engine = new AudioEngine();
    if (!this.engine.available) toast('This phone\'s web engine has no Web Audio: no visualiser or equaliser.');
    const e = this.engine;
    e.on('play', () => { this.failed = 0; this.emit('state'); this.tell(); });
    e.on('pause', () => { this.emit('state'); this.tell(); this.save(); });
    e.on('loaded', () => { this.emit('time'); this.tell(); });
    e.on('time', () => this.emit('time'));
    e.on('ended', () => this.ended());
    e.on('fallback', d => this.failedSong(d));
    e.on('plain', d => this.plainSound(d));
    e.on('renewed', d => this.emit('engine', d));
    // v3.59.0: songs that flow, gapless or crossfaded (audio-engine.js)
    e.on('advanced', d => this.flowed(d));
    try { e.setFlow(JSON.parse(localStorage.getItem(FLOW) || 'null') || { mode: 'gapless', seconds: 6 }); } catch (_) { e.setFlow({ mode: 'gapless', seconds: 6 }); }
    try { const s = +localStorage.getItem(SPEED); if (s > 0 && s !== 1) e.setSpeed(s); } catch (_) {}
    try { const g = this.eq(); e.setEQ(g.gains); if (isFinite(g.preamp)) e.setSound({ preamp: g.preamp }); } catch (_) {}
    this.presets = new EqPresets();
    e.setSound(this.sound());
    e.setVolume(100);
    on('remote', d => this.remote(d));
    on('route', d => this.route(d));
    try { this.way = JSON.parse(call('audioRoute') || '{}'); } catch (_) { this.way = {}; }
    setInterval(() => { if (!this.paused) this.save(); }, 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  },

  // ── starting ──────────────────────────────────────────────────────
  /** Plays songs from item i. shuffle: in a random order (i first, unless i is -1). */
  playList (songs, i = 0, { shuffle = this.shuffle, from = '' } = {}) {
    if (!songs.length) return;
    this.queue = songs.slice();
    this.from = from;
    this.shuffle = shuffle;
    if (i < 0) i = shuffle ? Math.floor(Math.random() * songs.length) : 0;
    this._arrange(i);
    this.start(true);
    this.emit('queue');
  },

  /** The order to play in, from song `first`: the list's own order (the songs before it come back with Previous), or shuffled with it first. */
  _arrange (first) {
    const n = this.queue.length;
    if (!this.shuffle) { this.order = [...Array(n).keys()]; this.at = Math.max(0, Math.min(n - 1, first)); return; }
    const rest = [];
    for (let k = 0; k < n; k++) if (k !== first) rest.push(k);
    for (let k = rest.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [rest[k], rest[j]] = [rest[j], rest[k]]; }
    this.order = [first, ...rest]; this.at = 0;
  },

  /** One file that is not in the library (opened from another app). */
  playFile ({ url, name }) {
    const title = String(name || 'Audio').replace(/\.[^.]+$/, '');
    this.playList([{ id: 0, title, artist: '', album: '', albumId: 0, duration: 0, url, path: url, file: name || '' }], 0, { shuffle: false, from: 'Opened file' });
  },

  start (play) {
    const s = this.current; if (!s || !this.engine) return;
    this._meant = !!play;                                      // a song that fails is skipped only if it was meant to play
    this.engine.load(s.url, s.path || s.url, play);
    this.emit('track', s);
    this.tell();
    this.save();
    this.prepNext();
  },

  // ── songs that flow (v3.59.0) ─────────────────────────────────────
  /** Where in the order the next song is, as next(true) would go, or -1: none waits (shuffled, a new round is a new order). */
  _nextAt () {
    if (this.at < 0 || !this.order.length) return -1;
    if (this.repeat === 'one') return this.at;
    if (this.at < this.order.length - 1) return this.at + 1;
    return this.repeat === 'all' && !this.shuffle ? 0 : -1;
  },
  /** The engine told which song comes next, so it waits loaded and comes in without a gap. */
  prepNext () {
    const e = this.engine; if (!e?.available) return;
    const at = e.flow.mode === 'off' ? -1 : this._nextAt(), s = at >= 0 ? this.queue[this.order[at]] : null;
    if (!s?.url) { this._pendingAt = -1; e.queueNext(null); return; }
    const cur = this.current, runsOn = !!(cur && cur.albumId && cur.albumId === s.albumId && at === this.at + 1);
    this._pendingAt = at;
    e.queueNext(s.url, s.path || s.url, { join: runsOn ? 'gapless' : null });
  },
  /** The next song came in by itself. */
  flowed () {
    if (this._pendingAt >= 0) this.at = this._pendingAt;
    this._pendingAt = -1; this.failed = 0;
    this.emit('track', this.current); this.tell(); this.save();
    this.emit('queue');
  },
  /** How one song goes into the next: 'off', 'gapless' or 'crossfade', and the crossfade's seconds. Kept. */
  setFlow (mode, seconds) {
    const e = this.engine; if (!e) return;
    e.setFlow({ mode, seconds });
    try { localStorage.setItem(FLOW, JSON.stringify(e.flow)); } catch (_) {}
    this.prepNext();
  },

  // ── controls ──────────────────────────────────────────────────────
  play () { if (!this.current) return; this._meant = true; this.engine.play(); },
  pause () { this.engine?.pause(); },
  toggle () { if (this.paused) this.play(); else this.pause(); },

  /** Stops, and puts the music away: the bar, the notification and the kept queue. */
  close () {
    clearTimeout(this._saveT);
    this._meant = false;
    try { this.engine?.stop(); } catch (_) {}
    this.queue = []; this.order = []; this.at = -1; this.from = ''; this.failed = 0;
    try { localStorage.removeItem(KEEP); } catch (_) {}
    this.tell();                                             // nothing playing: Android takes its notification away
    this.emit('track', null); this.emit('queue'); this.emit('state'); this.emit('time');
  },
  seek (t) { this.engine?.seek(t); this.emit('time'); this.tell(); },
  seekBy (d) { this.seek(this.time + d); },

  next (auto = false) {
    if (!this.order.length) return;
    if (this.at < this.order.length - 1) this.at++;
    else if (this.repeat === 'all' || !auto) {
      if (this.repeat !== 'all' && !auto) return;                  // the last song: Next does nothing
      if (this.shuffle) {
        // A new round in a new order, not starting with the song just heard.
        const last = this.order[this.at], n = this.queue.length;
        let first = Math.floor(Math.random() * n);
        if (n > 1 && first === last) first = (first + 1) % n;
        this._arrange(first);
      } else this.at = 0;
    } else { this.pause(); this.seek(0); this.emit('state'); return; }   // the end of the queue
    this.start(true);
    this.emit('queue');
  },

  prev () {
    if (!this.order.length) return;
    // Into the song a little: back to its start. At its start: the one before.
    if (this.time > 3 || this.at === 0) { this.seek(0); if (this.paused) this.play(); return; }
    this.at--;
    this.start(true);
    this.emit('queue');
  },

  /** Plays the song that is n places on in Up Next (0 is the next one). */
  jump (n) {
    const to = this.at + 1 + n;
    if (to < 0 || to >= this.order.length) return;
    this.at = to;
    this.start(true);
    this.emit('queue');
  },

  setShuffle (on) {
    if (on === this.shuffle) return;
    this.shuffle = on;
    const cur = this.order[this.at];
    if (cur === undefined) { this.emit('queue'); return; }
    this._arrange(cur);
    this.emit('queue'); this.save();
  },

  cycleRepeat () {
    this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
    this.emit('queue'); this.save();
    return this.repeat;
  },

  /** Next after the one playing. */
  playNext (s) {
    if (!this.current) { this.playList([s], 0, { from: '' }); return; }
    this.queue.push(s);
    this.order.splice(this.at + 1, 0, this.queue.length - 1);
    this.emit('queue'); this.save();
  },

  /** At the end of the queue. */
  addToQueue (s) {
    if (!this.current) { this.playList([s], 0, { from: '' }); return; }
    this.queue.push(s);
    this.order.push(this.queue.length - 1);
    this.emit('queue'); this.save();
  },

  /**
   * Songs deleted from the phone taken out of the queue (v3.45.0, a Set of
   * ids). If the one playing went, the next one left takes its place:
   * playing if it was playing, waiting if it was paused.
   */
  forget (ids) {
    if (!ids?.size || !this.queue.length) return;
    const queue = [], to = new Map();
    this.queue.forEach((s, i) => { if (!ids.has(s.id)) { to.set(i, queue.length); queue.push(s); } });
    if (queue.length === this.queue.length) return;
    if (!queue.length) { this.close(); return; }
    const cur = this.current, gone = !!cur && ids.has(cur.id), playing = !this.paused;
    let at = -1, after = -1;
    const order = [];
    this.order.forEach((qi, k) => {
      const ni = to.get(qi); if (ni === undefined) return;
      if (k <= this.at) at = order.length;                 // the last one left up to where it is
      else if (after < 0) after = order.length;            // the first one left after it
      order.push(ni);
    });
    this.queue = queue; this.order = order;
    if (!gone) { this.at = at; this.emit('queue'); this.save(); return; }
    this.at = after >= 0 ? after : Math.max(0, at);
    try { this.engine?.stop(); } catch (_) {}
    this.start(playing && after >= 0);
    this.emit('queue');
  },

  /** Takes the song n places on in Up Next out of the queue. */
  removeNext (n) {
    const k = this.at + 1 + n;
    if (k <= this.at || k >= this.order.length) return;
    this.order.splice(k, 1);
    this.emit('queue'); this.save();
  },

  setSpeed (r) {
    this.engine?.setSpeed(r);
    try { localStorage.setItem(SPEED, String(r)); } catch (_) {}
    this.emit('speed'); this.tell();
  },
  get speed () { return this.engine?.speed || 1; },

  setEQ (gains, name, preamp = this.eq().preamp || 0) {
    this.engine?.setEQ(gains);
    this.engine?.setSound({ preamp });
    try { localStorage.setItem(EQ, JSON.stringify({ gains, name, preamp })); } catch (_) {}
  },
  eq () {
    let g = null; try { g = JSON.parse(localStorage.getItem(EQ) || 'null'); } catch (_) {}
    if (!g || !Array.isArray(g.gains)) return { gains: new Array(EQ_FREQUENCIES.length).fill(0), name: 'Flat', preamp: 0 };
    // ten bands, kept before v3.59.0: spread over the fifteen, sounding as they did
    if (g.gains.length !== EQ_FREQUENCIES.length) g.gains = eqFrom(g.gains);
    return g;
  },
  /** The output the sound goes to, as the equalizer's presets are tied to it (v3.59.0). */
  outName (d = this.way || {}) { return { speaker: 'The speaker', wired: 'Wired headphones', usb: 'USB', bluetooth: 'Bluetooth' }[d.out] || ''; },

  /**
   * The sound mode, clear voice and night mode (v3.49.0, Sound lab), kept
   * like the equaliser: { mode, voice, night }, for the music and the videos
   * (m-sound.js). Slowed and Nightcore play the music slower
   * or faster too (the engine does that from the mode), and the speed menu goes
   * on showing the speed chosen.
   */
  // v3.59.0: the key (semitones, the speed kept) and the voice changer, not kept between runs
  sound () {
    const now = { key: this._key || 0, voicefx: this._vfx || 'off' };
    try { const o = JSON.parse(localStorage.getItem(SOUND) || '{}'); return { mode: typeof o.mode === 'string' ? o.mode : 'off', voice: o.voice === true, night: o.night === true, ...now }; }
    catch (_) { return { mode: 'off', voice: false, night: false, ...now }; }
  },
  setSound (next) {
    if ('key' in next) this._key = Math.max(-12, Math.min(12, Math.round(+next.key || 0)));
    if ('voicefx' in next) this._vfx = next.voicefx || 'off';
    const o = { ...this.sound(), ...next, key: this._key || 0, voicefx: this._vfx || 'off' };
    try { localStorage.setItem(SOUND, JSON.stringify({ mode: o.mode, voice: o.voice, night: o.night })); } catch (_) {}
    this.engine?.setSound(o);
    this.emit('sound', o); this.tell();
  },

  // ── what happens by itself ────────────────────────────────────────
  ended () {
    if (this.repeat === 'one') { this.seek(0); this.engine.play(); return; }
    this.next(true);
  },

  // The engine has tried a song that lost its stream partway three times,
  // from where it was, before it gives up on it (v3.48.0, audio-engine.js):
  // a song that comes here could not be read on, or not at all.
  failedSong (d = {}) {
    const s = this.current;
    this.failed++;
    const ext = (s?.file || s?.path || '').split('.').pop().toUpperCase();
    const partway = d.at > 5;
    console.warn('[BM Player] could not play', s?.path || s?.url, partway ? `(stopped at ${fmtTime(d.at)})` : '');
    if (this.failed >= 4) { toast('These songs could not be played on this phone.'); this.failed = 0; this.emit('state'); return; }
    const name = s?.title ? '"' + s.title + '"' : 'that song';
    const what = partway ? `${name} stopped at ${fmtTime(d.at)}: the rest of the file could not be read`
      : `This phone could not play ${name}${ext && ext.length <= 4 ? ' (' + ext + ')' : ''}`;
    // Restored at start-up and not playing: say so, but start nothing by itself.
    if (!this._meant) { toast(what + '.'); this.emit('state'); return; }
    toast(what + '. Skipping it.');
    setTimeout(() => { if (this.current === s) this.next(true); }, 900);
  },

  // ── where the sound goes (v3.55.1) ────────────────────────────────
  // Android says when the way out changes (AudioRoute.java): a headset on
  // or off, its call channel opened or closed, a call. The web engine kept
  // the stream it opened before, at the old rate and as music or a call,
  // and songs on a neckband sounded like a phone call. The engine makes its
  // sound again for the new way out.
  route (d = {}) {
    const was = this.outName();
    this.way = d;
    if (!this.engine?.available) return;
    this.engine.renew(d.why || 'the way out changed');
    // v3.59.0: an output with its own equalizer preset gets it, and the curve from before comes back after
    const now = this.outName(d);
    if (now !== was && this.presets) {
      const c = this.eq(); this.presets.set(c.gains, c.preamp, c.name);
      const used = this.presets.outputChanged(now);
      if (used) { this.setEQ(this.presets.eq.slice(), used, this.presets.preamp); toast(now + ': the ' + used + ' equaliser', 2500); this.emit('eq'); }
    }
    // Taken by a call or another app, the headset's call channel carries all
    // the sound: nothing here can change that, and it is said once.
    if (d.callChannel && !this.micOn && !this._toldCall) {
      this._toldCall = true;
      toast('The headset is on its call channel (a call, or an app using its microphone), so music sounds like a phone call until that ends.', 6000);
    }
  },

  // The web engine's sound runs at a call's rate: the songs play from the
  // audio element (audio-engine.js, plain), said once while the app is open.
  plainSound (d = {}) {
    if (this._toldPlain) return;
    this._toldPlain = true;
    toast('Songs play without the equaliser and the visualiser for now, so they keep their full sound' + (this.way?.bluetooth ? ' on this headset.' : '.'), 5000);
  },

  /**
   * The fox's Talk has the microphone, or has let it go (m-home.js). While
   * it is held the web engine sends sound out as a call's, and the engine's
   * sound is made again once it is let go, a moment after.
   */
  mic (on) {
    const was = !!this.micOn;
    this.micOn = !!on;
    if (was && !on) setTimeout(() => { const e = this.engine; if (!this.micOn && e?.available && (e.ctx || e.plain)) e.renew('the microphone was let go'); }, 500);
  },

  remote (d) {
    // While a video is open the buttons are its (m-video.js sets this).
    if (this.videoRemote?.(d)) return;
    const a = d.action;
    if (a === 'play') this.play();
    else if (a === 'pause') this.pause();
    else if (a === 'toggle') this.toggle();
    else if (a === 'next') this.next();
    else if (a === 'prev') this.prev();
    else if (a === 'seek') this.seek(+d.value || 0);
    else if (a === 'seekBy') this.seekBy(+d.value || 0);
    else if (a === 'close') this.close();                   // the notification's Close, or swiped away
  },

  /** Android is told what plays: the notification, the lock screen, a car's screen. */
  tell () {
    const s = this.current;
    const o = s ? { has: true, playing: !this.paused, title: s.title, artist: s.artist, album: s.album, duration: this.duration, position: this.time, speed: this.engine?.rate || this.speed, artId: s.id || -1, albumId: s.albumId || -1 } : { has: false };
    call('playback', JSON.stringify(o));
  },

  // Paused for a while, Web Audio rests so the phone's sound hardware can:
  // the engine does that itself now (audio-engine.js, v3.45.0), here as on
  // the desktop.

  // ── kept between runs ─────────────────────────────────────────────
  save () {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try {
        if (!this.current || !keepQueue()) { localStorage.removeItem(KEEP); return; }
        if (this.queue.some(s => !s.id)) return;                     // an opened file is not kept
        localStorage.setItem(KEEP, JSON.stringify({ ids: this.queue.map(s => s.id), order: this.order, at: this.at, t: Math.floor(this.time), shuffle: this.shuffle, repeat: this.repeat, from: this.from }));
      } catch (_) {}
    }, 400);
  },

  /** The queue as it was left, paused at its place. After the library has loaded. */
  restore () {
    if (!keepQueue()) return false;
    let k = null;
    try { k = JSON.parse(localStorage.getItem(KEEP) || 'null'); } catch (_) {}
    if (!k || !Array.isArray(k.ids) || !k.ids.length) return false;
    const map = new Map();
    const queue = [];
    k.ids.forEach((id, i) => { const s = lib.byId.get(id); if (s) { map.set(i, queue.length); queue.push(s); } });
    if (!queue.length) return false;
    const order = (Array.isArray(k.order) ? k.order : []).map(i => map.get(i)).filter(i => i !== undefined);
    const full = order.length === queue.length ? order : [...Array(queue.length).keys()];
    const cur = k.order?.[k.at];
    let at = map.has(cur) ? full.indexOf(map.get(cur)) : 0;
    if (at < 0) at = 0;
    this.queue = queue; this.order = full; this.at = at;
    this.shuffle = !!k.shuffle; this.repeat = ['off', 'all', 'one'].includes(k.repeat) ? k.repeat : 'off'; this.from = k.from || '';
    const t = +k.t || 0;
    this.start(false);
    if (t > 0) {
      const el = this.engine.el;
      const go = () => { el.removeEventListener('loadedmetadata', go); this.seek(Math.min(t, Math.max(0, (this.engine.duration || t) - 1))); };
      if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', go);
    }
    this.emit('queue');
    return true;
  },
};
