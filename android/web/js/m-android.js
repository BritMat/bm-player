/**
 * m-android: the page's line to Android.
 *
 * Asking: window.BMAndroid, the Java side (Bridge.java). Every call goes
 * through call(), so a method missing from an older app, or a bridge that
 * failed, is an answer of undefined and never an error.
 *
 * Told: Android calls window.BMNative.event(type, data) with
 *   permission  { audio, video }    access changed
 *   remote      { action, value }   a button in the notification, on the
 *                                   lock screen or on headphones
 *   lifecycle   { state }           'foreground' or 'background'
 *   battery     { onBattery }
 *   open        { url, kind, name, mime, key }  a file opened from another
 *                                   app, or chosen with the file picker;
 *                                   kind is audio, video, image or pdf, and
 *                                   key is there when Android keeps the
 *                                   file for the app (reopen(key) later)
 *   mpv         { e, ... }          the video engine's news (m-mpv.js)
 *   update      { state, ... }      where an update from GitHub stands (m-update.js)
 *   memory      { level }           Android is short of memory: what is not
 *                                   on screen gives its memory back (m-main.js)
 * and window.BMNative.back() when Back is pressed: 'handled' when the page
 * closed something, 'background' to put the app behind the others.
 *
 * In a desktop browser (testing the page) there is no BMAndroid, and a
 * stand-in answers instead. Its mpv plays nothing, but answers as mpv
 * would, when localStorage has mock_mpv=1 (scripts/android-page.mjs).
 */
const real = typeof window.BMAndroid === 'object' && window.BMAndroid ? window.BMAndroid : null;
export const isAndroid = !!real;

const listeners = new Map();
/** fn(data) for each event of that type. Returns a function that stops it. */
export function on (type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type)?.delete(fn);
}
export function emit (type, data) {
  for (const fn of listeners.get(type) || []) { try { fn(data || {}); } catch (e) { console.error('[BM Player] ' + type + ' handler:', e); } }
}

let backHandler = () => 'background';
/** fn() decides what Back does: 'handled', 'background' or 'exit'. */
export function onBack (fn) { backHandler = fn; }

window.BMNative = {
  event (type, data) { emit(type, data); },
  back () { try { return backHandler() || 'background'; } catch (e) { console.error(e); return 'background'; } },
};

// mpv's stand-in: a clock and a few tracks, for testing the player's controls.
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const fakeMpv = {
  t: 0, d: 0, paused: false, speed: 1, timer: 0, tracks: [], subs: 0,
  send (o) { setTimeout(() => emit('mpv', o), 0); },
  open (src, start, paused) {
    this.close();
    window.__bmMpv = { src, start, paused, commands: [], subs: [] };
    this.send({ e: 'start' });
    if (/fail/.test(src) || ls('mock_mpv_fail') === '1') {
      setTimeout(() => this.send({ e: 'error', text: 'mpv could not open this file.', detail: '[ffmpeg/demuxer] mov: moov atom not found\n[cplayer] Failed to recognize file format.' }), 60);
      return;
    }
    this.t = +start || 0; this.d = 125; this.paused = !!paused; this.speed = 1; this.subs = 2;
    this.tracks = [
      { id: 1, type: 'video', codec: 'hevc', selected: true, 'demux-w': 3840, 'demux-h': 2160 },
      { id: 1, type: 'audio', codec: 'aac', lang: 'kor', selected: true, 'demux-channel-count': 2 },
      { id: 2, type: 'audio', codec: 'eac3', lang: 'eng', title: 'English dub', 'demux-channel-count': 6 },
      { id: 1, type: 'sub', codec: 'mov_text', lang: 'eng', selected: true },
      { id: 2, type: 'sub', codec: 'mov_text', lang: 'ind' },
    ];
    setTimeout(() => {
      this.send({ e: 'loaded', d: this.d, w: 3840, h: 2160, format: 'mov,mp4,m4a,3gp,3g2,mj2', video: 'hevc', audio: 'aac', tracks: this.tracks });
      this.send({ e: 'duration', d: this.d });
      this.send({ e: 'video', w: 3840, h: 2160, rotate: 0 });
      this.send({ e: 'hwdec', v: 'mediacodec' });
      this.send({ e: 'pause', v: this.paused });
      this.send({ e: 'restart' });
      this.send({ e: 'time', t: this.t });
    }, 80);
    this.timer = setInterval(() => {
      if (this.paused) return;
      this.t = Math.min(this.d, this.t + 0.25 * this.speed);
      this.send({ e: 'time', t: this.t });
      if (this.t >= this.d) { this.paused = true; this.send({ e: 'eof', v: true }); this.send({ e: 'pause', v: true }); }
    }, 250);
  },
  command (a) {
    window.__bmMpv?.commands.push(a);
    const [c, p, v] = a;
    if (c === 'set' && p === 'pause') { this.paused = v === 'yes'; this.send({ e: 'pause', v: this.paused }); }
    else if (c === 'cycle' && p === 'pause') { this.paused = !this.paused; this.send({ e: 'pause', v: this.paused }); }
    else if (c === 'seek') {
      this.t = Math.max(0, Math.min(this.d, v === 'relative' ? this.t + +p : +p));
      if (this.t < this.d) this.send({ e: 'eof', v: false });
      this.send({ e: 'time', t: this.t });
      this.send({ e: 'restart' });
    } else if (c === 'set' && (p === 'sid' || p === 'aid')) {
      const type = p === 'sid' ? 'sub' : 'audio';
      for (const t of this.tracks) if (t.type === type) t.selected = String(t.id) === v;
      this.send({ e: 'tracks', list: this.tracks });
    } else if (c === 'set' && p === 'speed') { this.speed = +v || 1; this.send({ e: 'speed', v: this.speed }); }
  },
  subAdd (name, text) {
    window.__bmMpv?.subs.push({ name, text });
    for (const t of this.tracks) if (t.type === 'sub') t.selected = false;
    this.tracks.push({ id: ++this.subs, type: 'sub', codec: /\.ass$/i.test(name) ? 'ass' : 'subrip', title: name, external: true, selected: true });
    this.send({ e: 'tracks', list: this.tracks });
  },
  close () { clearInterval(this.timer); this.timer = 0; if (window.__bmMpv) window.__bmMpv.closed = true; },
};

// The updater's stand-in (v3.44.0): GitHub has 9.9.0 when localStorage has
// mock_update=1, the check fails with mock_update_fail=1, and Android has not
// yet allowed installing with mock_update_perm=0. Install records the version.
const fakeUpd = {
  s: { state: 'idle', current: ls('mock_version') || 'dev', checked: 0, canInstall: true, metered: false },
  timer: 0,
  set (o) { this.s = { ...this.s, ...o }; const copy = { ...this.s }; setTimeout(() => emit('update', copy), 0); },
  check () {
    window.__bmUpdChecks = (window.__bmUpdChecks || 0) + 1;
    this.set({ state: 'checking', error: undefined, errorKind: undefined });
    setTimeout(() => {
      if (ls('mock_update_fail') === '1') { this.set({ state: 'error', error: 'GitHub could not be reached. Is the phone online?', errorKind: 'network' }); return; }
      if (ls('mock_update') === '1') this.set({ state: 'available', version: '9.9.0', latest: '9.9.0', size: 30402381, page: 'https://github.com/BritMat/bm-player/releases/tag/v9.9.0', checked: Date.now(), canInstall: ls('mock_update_perm') !== '0' });
      else this.set({ state: 'none', version: undefined, latest: this.s.current, checked: Date.now() });
    }, 120);
  },
  download () {
    if (this.s.state !== 'available') return;
    const total = this.s.size;
    let got = 0;
    this.set({ state: 'downloading', got, total, error: undefined });
    this.timer = setInterval(() => {
      got = Math.min(total, got + total / 6);
      if (got >= total) { clearInterval(this.timer); this.set({ state: 'ready', got: undefined, total: undefined }); }
      else this.set({ got });
    }, ls('mock_update_slow') === '1' ? 700 : 90);
  },
  cancel () { clearInterval(this.timer); window.__bmUpdCancelled = true; this.set({ state: 'available', got: undefined, total: undefined }); },
  install () {
    if (this.s.state !== 'ready' && this.s.state !== 'installing') return;
    if (this.s.canInstall === false) { this.set({ error: 'Android needs your OK first: allow BM Player to install apps, then come back.', errorKind: 'permission' }); return; }
    window.__bmInstalled = this.s.version;
    this.set({ state: 'installing', error: undefined });
  },
  allow () { window.__bmAllowAsked = true; ls('mock_update_perm', '1'); this.set({ canInstall: true, error: undefined }); },
};

// The stand-in, for a desktop browser.
const MOCK = {
  mpvState: () => JSON.stringify(ls('mock_mpv') === '1' ? { available: true, off: false, release: 'test' } : { available: false, reason: 'This is a desktop browser.' }),
  mpvEnable () {},
  mpvOpen (src, start, paused) { fakeMpv.open(src, start, paused); },
  mpvCommand (json) { fakeMpv.command(JSON.parse(json)); },
  mpvClose () { fakeMpv.close(); },
  mpvSubAdd (name, text) { fakeMpv.subAdd(name, text); },
  openWith (src) { window.__bmOpenWith = src; },
  info: () => JSON.stringify({ version: ls('mock_version') || 'dev', versionCode: 0, sdk: 34, release: '14', device: 'Desktop browser (test)', abis: [], webview: navigator.userAgent }),
  updateState: () => JSON.stringify(fakeUpd.s),
  updateCheck (manual) { fakeUpd.check(manual); },
  updateDownload () { fakeUpd.download(); },
  updateCancel () { fakeUpd.cancel(); },
  updateInstall () { fakeUpd.install(); },
  updateAllowInstalls () { fakeUpd.allow(); },
  ready () {},
  permission: k => { try { return localStorage.getItem('mock_perm_' + k) || 'granted'; } catch (e) { return 'granted'; } },
  requestPermission (k) { try { localStorage.setItem('mock_perm_' + k, 'granted'); } catch (e) {} setTimeout(() => emit('permission', { audio: MOCK.permission('audio'), video: MOCK.permission('video'), image: MOCK.permission('image') }), 200); },
  // v3.42.0: the video player's swipes, the battery in its corner, files kept for Home, sharing
  screenBrightness: () => (window.__bmBright ?? 0.5),
  volume: () => JSON.stringify({ v: window.__bmVol ?? 8, max: 15 }),
  setVolume (v) { window.__bmVol = v; },
  batteryLevel: () => 76,
  reopen: key => (window.__bmDocs || {})[key] || null,
  shareFile (src, type) { window.__bmSharedFile = [src, type]; },
  openAppSettings () {},
  playback (json) { window.__bmPlayback = JSON.parse(json); },
  orientation (m) { window.__bmOrientation = m; },
  immersive (on) { window.__bmImmersive = !!on; },
  keepScreenOn (on) { window.__bmAwake = !!on; },
  bars (c, light) { window.__bmBars = [c, light]; },
  brightness (v) { window.__bmBright = v; },
  onBattery: () => false,
  openUrl (u) { window.__bmOpened = u; },
  toast (t) { console.log('[toast]', t); },
  share (t) { window.__bmShared = t; },
  log (t) { console.log('[log]', t); },
  logText: () => '(The Android app keeps its log. This is a desktop browser.)',
  background () {},
  exit () {},
};
const bridge = real || MOCK;

/** Whether Android (or the stand-in) has that method: an older app may not. */
export const has = name => typeof bridge[name] === 'function';

/** BMAndroid[name](...args), or undefined if it is missing or fails. */
export function call (name, ...args) {
  try { const f = bridge[name]; return typeof f === 'function' ? f.apply(bridge, args) : undefined; }
  catch (e) { console.warn('[BM Player] Android ' + name + ':', e); return undefined; }
}

export const info = (() => { try { return JSON.parse(call('info') || '{}'); } catch (e) { return {}; } })();

/** 'granted', 'ask' or 'denied' for 'audio', 'video', 'image' or 'mic'. */
export const permission = kind => call('permission', kind) || 'granted';
