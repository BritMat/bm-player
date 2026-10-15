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
import { call, on } from './m-android.js';
import { lib } from './m-library.js';
import { toast } from './m-ui.js';

const KEEP = 'bm_m_queue', SPEED = 'bm_m_speed', EQ = 'bm_m_eq', KEEPQ = 'bm_m_keepq';
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
  emit (type, data) { for (const fn of listeners.get(type) || []) { try { fn(data); } catch (e) { console.error('[BM Player] player ' + type + ':', e); } } },

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
    e.on('play', () => { this.failed = 0; this.emit('state'); this.tell(); this._wake(); });
    e.on('pause', () => { this.emit('state'); this.tell(); this.save(); this._sleepLater(); });
    e.on('loaded', () => { this.emit('time'); this.tell(); });
    e.on('time', () => this.emit('time'));
    e.on('ended', () => this.ended());
    e.on('fallback', d => this.failedSong(d));
    try { const s = +localStorage.getItem(SPEED); if (s > 0 && s !== 1) e.setSpeed(s); } catch (_) {}
    try { const g = JSON.parse(localStorage.getItem(EQ) || 'null'); if (Array.isArray(g?.gains)) e.setEQ(g.gains); } catch (_) {}
    e.setVolume(100);
    on('remote', d => this.remote(d));
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
  },

  // ── controls ──────────────────────────────────────────────────────
  play () { if (!this.current) return; this._meant = true; this._wake(); this.engine.play(); },
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
    this._sleepLater();
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

  setEQ (gains, name) {
    this.engine?.setEQ(gains);
    try { localStorage.setItem(EQ, JSON.stringify({ gains, name })); } catch (_) {}
  },
  eq () { try { return JSON.parse(localStorage.getItem(EQ) || 'null') || { gains: new Array(10).fill(0), name: 'Flat' }; } catch (_) { return { gains: new Array(10).fill(0), name: 'Flat' }; } },

  // ── what happens by itself ────────────────────────────────────────
  ended () {
    if (this.repeat === 'one') { this.seek(0); this.engine.play(); return; }
    this.next(true);
  },

  failedSong () {
    const s = this.current;
    this.failed++;
    const ext = (s?.file || s?.path || '').split('.').pop().toUpperCase();
    console.warn('[BM Player] could not play', s?.path || s?.url);
    if (this.failed >= 4) { toast('These songs could not be played on this phone.'); this.failed = 0; this.emit('state'); return; }
    const what = `This phone could not play ${s?.title ? '"' + s.title + '"' : 'that song'}${ext && ext.length <= 4 ? ' (' + ext + ')' : ''}`;
    // Restored at start-up and not playing: say so, but start nothing by itself.
    if (!this._meant) { toast(what + '.'); this.emit('state'); return; }
    toast(what + '. Skipping it.');
    setTimeout(() => { if (this.current === s) this.next(true); }, 900);
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
    const o = s ? { has: true, playing: !this.paused, title: s.title, artist: s.artist, album: s.album, duration: this.duration, position: this.time, speed: this.speed, artId: s.id || -1, albumId: s.albumId || -1 } : { has: false };
    call('playback', JSON.stringify(o));
  },

  // Paused for a while: Web Audio is put to sleep, so the phone's sound
  // hardware can rest. Playing wakes it.
  _sleepLater () {
    clearTimeout(this._sleepT);
    this._sleepT = setTimeout(() => { if (this.paused && this.engine?.ctx?.state === 'running') this.engine.ctx.suspend().catch(() => {}); }, 8000);
  },
  _wake () {
    clearTimeout(this._sleepT);
    if (this.engine?.ctx?.state === 'suspended') this.engine.ctx.resume().catch(() => {});
  },

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
