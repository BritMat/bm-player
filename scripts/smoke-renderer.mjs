#!/usr/bin/env node
/**
 * BM Player — headless renderer smoke test
 *
 * Parsing proves a file is valid JavaScript. Contracts prove the seams line
 * up. Neither proves the app actually starts. This does: it loads the real
 * index.html into jsdom, stubs the preload bridge and the browser APIs
 * Electron would provide (WebGL, canvas, IntersectionObserver, pdfjsLib),
 * imports app.js for real, and asserts the renderer reaches a live state.
 *
 * Any exception thrown during boot — a null dereference, a missing method,
 * a bad destructure — fails the run with a real stack trace.
 *
 * Run with: npm run test:smoke
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const pass = n => { results.push({ n, ok: true }); console.log('  \x1b[32m✓\x1b[0m ' + n); };
const fail = (n, e) => {
  results.push({ n, ok: false, e });
  console.log('  \x1b[31m✗\x1b[0m ' + n);
  if (e) console.log('      ' + String(e.stack || e.message || e).split('\n').slice(0, 4).join('\n      '));
};

/* Fixture folder: a mix of images and audio, with names chosen to exercise
   the escaping and URL-encoding paths that have broken before. */
const FIXTURE_FILES = [
  { path: '/fixtures/photos/beach.jpg',            name: 'beach.jpg',            dir: '/fixtures/photos', size: 240000, mtime: 1700000000000 },
  { path: '/fixtures/photos/Rock & Roll <live>.png', name: 'Rock & Roll <live>.png', dir: '/fixtures/photos', size: 100,   mtime: 1700000100000 },
  { path: '/fixtures/photos/holiday #3.webp',      name: 'holiday #3.webp',      dir: '/fixtures/photos', size: 999999, mtime: 1700000200000 },
  { path: '/fixtures/music/01 - track.mp3',        name: '01 - track.mp3',       dir: '/fixtures/music',  size: 5000000, mtime: 1700000300000 },
  { path: '/fixtures/music/02 - another.flac',     name: '02 - another.flac',    dir: '/fixtures/music',  size: 9000000, mtime: 1700000400000 },
  { path: '/fixtures/music/song & co.ogg',         name: 'song & co.ogg',        dir: '/fixtures/music',  size: 300,     mtime: 1700000500000 },
];

/* Callbacks the renderer registers with the preload bridge. The old stub
   discarded them, so PiP state and mpv property handling never ran at all. */
const bridge = { pip: [], prop: [], pipCalls: [] };
const firePip  = on => bridge.pip.forEach(cb => cb(on));
const fireProp = (name, data) => bridge.prop.forEach(cb => cb({ name, data }));

/* ── stub the Electron preload bridge ───────────────────────────── */
const ipcCalls = [];
const noop = () => {};
const asyncNull = (...a) => { ipcCalls.push(a); return Promise.resolve(null); };
function makeApi() {
  const group = (...names) => Object.fromEntries(names.map(n => [n, asyncNull]));
  return {
    // Only methods the real preload exposes. This used to offer getProp,
    // setProp and tracks, which don't exist, so a test could pass against them.
    mpv: { ...group('cmd', 'open'),
           onProp: cb => { bridge.prop.push(cb); }, onEvent: noop, onStatus: noop, onOpened: noop,
           onMediaProps: noop, onTrackList: noop },
    win: { ...group('minimize', 'maximize', 'close', 'fullscreen', 'theatre', 'alwaysOnTop'),
           isFs: async () => false,
           pip: async v => { bridge.pipCalls.push(v); },
           pipSize: async () => { bridge.pipSizeCalls = (bridge.pipSizeCalls || 0) + 1; return { width: 480, height: 270 }; },
           onPipState: cb => { bridge.pip.push(cb); } },
    dialog: group('openFiles', 'openSub', 'openPDF', 'savePDF', 'openM3u', 'saveM3u'),
    gallery: {
      browse: async () => '/fixtures/photos',
      scan:   async () => FIXTURE_FILES,
      thumb:  async () => null,          // no OS thumbnailer under test
    },
    music: { tags: async paths => paths.map(p => ({
      path: p, title: 'Title ' + p.slice(-5), artist: 'Artist A',
      album: 'Album One', year: 2024, trackNo: 1, duration: 183, cover: null,
    })) },
    adj: group('subDelay', 'audioDelay', 'resetSub', 'resetAudio'),
    app: { ...group('perfInfo', 'version', 'getPlugins', 'setPluginEnabled', 'openPluginsDir'),
           diagnostics: async () => ({
             app: { version: '3.2.0', packaged: false, liteBuild: false, appPath: '/app', userData: '/ud' },
             versions: { electron: '44.3.0', chrome: '140', node: '22', v8: '14' },
             system: { platform: 'linux', arch: 'x64', release: '6.0', cpu: 'Test CPU', cpuCount: 4, totalMemGB: 8, freeMemGB: 4 },
             mpv: { found: false, path: null, version: null, connected: false },
             gpu: {}, caches: { thumbsMB: 1.2, coversMB: 0.3 }, window: null, errorLog: null,
           }),
           onFirstRun: noop, onUpdaterStatus: noop },
    pdfFile: group('write'),
    plugins: group('list', 'enable', 'disable'),
    subs: group('openFile'),
    onOpenFile: noop, onMenu: noop,
  };
}

/* ── stub the browser APIs Electron would provide ───────────────── */
function installBrowserStubs(win) {
  const ctx2d = () => new Proxy({}, {
    get: (_, p) => {
      if (p === 'canvas') return { width: 800, height: 600 };
      if (p === 'createRadialGradient' || p === 'createLinearGradient')
        return () => ({ addColorStop: noop });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'measureText') return () => ({ width: 10 });
      return () => undefined;
    }
  });
  win.HTMLCanvasElement.prototype.getContext = function (type) {
    // No WebGL in jsdom. FluidFX and Fox are both written to throw here and
    // fall back, so returning null is the realistic test.
    if (String(type).startsWith('webgl')) return null;
    return ctx2d();
  };
  win.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  win.HTMLMediaElement.prototype.play = () => Promise.resolve();
  win.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0);
  win.cancelAnimationFrame = clearTimeout;
  win.matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop });
  win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  win.scrollTo = noop;
  win.Element.prototype.scrollIntoView = noop;
  // pdf.js / three.js / pdf-lib are vendored <script> tags jsdom won't run.
  win.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve(null) }), Util: { transform: () => [1, 0, 0, 1, 0, 0] } };
  win.THREE = undefined;
  win.PDFLib = undefined;
}

const tick = ms => new Promise(r => setTimeout(r, ms));
async function step(name, fn) {
  try { await fn(); pass(name); } catch (e) { fail(name, e); }
}


/* ── stub Web Audio so audio-engine.js builds a real graph ──────── */
function installAudioStubs(win) {
  const connections = [];
  class Param {
    constructor(v) { this.value = v; this.glides = 0; this.cancels = 0; }
    setTargetAtTime(v) { this.value = v; this.glides++; }
    cancelScheduledValues() { this.cancels++; }
  }
  class Node {
    constructor(kind) { this.kind = kind; }
    connect(dest) { connections.push([this.kind, dest && dest.kind]); return dest; }
    disconnect() {}
  }
  class Analyser extends Node {
    constructor() { super('analyser'); this.fftSize = 2048; this.smoothingTimeConstant = 0.8; }
    get frequencyBinCount() { return this.fftSize / 2; }
    getByteFrequencyData(a) { a.fill(0); }
    getByteTimeDomainData(a) { a.fill(128); }
  }
  win.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = new Node('destination'); }
    createMediaElementSource() { return new Node('source'); }
    createBiquadFilter() { const n = new Node('biquad'); n.type = ''; n.frequency = new Param(0); n.Q = new Param(1); n.gain = new Param(0); return n; }
    createGain() { const n = new Node('gain'); n.gain = new Param(1); return n; }
    createAnalyser() { return new Analyser(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
  // jsdom's HTMLAudioElement can't decode anything; make it announce support
  // for the formats Chromium handles so canPlay() exercises the real branch.
  win.HTMLMediaElement.prototype.canPlayType = function (mime) {
    return /mpeg|mp4|aac|ogg|flac|wav|webm/.test(mime) ? 'probably' : '';
  };
  win.HTMLMediaElement.prototype.load = function () {};
  // jsdom defines `paused` as a getter only, so the stub needs its own
  // backing field rather than assigning through it.
  Object.defineProperty(win.HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get() { return this.__paused !== false; },
    set(v) { this.__paused = !!v; },
  });
  win.HTMLMediaElement.prototype.play = function () { this.__paused = false; this.dispatchEvent(new win.Event('play')); return Promise.resolve(); };
  win.HTMLMediaElement.prototype.pause = function () { this.__paused = true; this.dispatchEvent(new win.Event('pause')); };
  win.__audioConnections = connections;
}

async function main() {
  console.log('\nBM Player — renderer smoke test\n');

  const html = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: pathToFileURL(path.join(ROOT, 'src/index.html')).href,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    resources: undefined,
  });
  const { window } = dom;

  // Make the DOM globally visible; app.js and its modules are written for a
  // browser and reference these as free variables.
  for (const k of ['window', 'document', 'navigator', 'location', 'localStorage',
                   'sessionStorage', 'HTMLElement', 'Element', 'Node', 'Event',
                   'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle',
                   'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver',
                   'ResizeObserver', 'matchMedia', 'Image', 'DOMParser', 'FileReader', 'Blob']) {
    if (!(k in window)) continue;
    // Node 20+ defines some of these (navigator, location) as getter-only on
    // globalThis, so plain assignment throws. defineProperty works for both.
    try { globalThis[k] = window[k]; }
    catch { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); }
  }
  // jsdom gives a file:// document an opaque origin, which leaves
  // window.localStorage undefined — and perf.js reads it at import time.
  if (!window.localStorage) {
    const store = new Map();
    const ls = {
      getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
      setItem: (k, v) => store.set(String(k), String(v)),
      removeItem: k => store.delete(String(k)),
      clear: () => store.clear(),
      key: i => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    };
    Object.defineProperty(window, 'localStorage', { value: ls, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: ls, configurable: true });
  }
  globalThis.localStorage = window.localStorage;
  globalThis.sessionStorage = window.sessionStorage;

  installBrowserStubs(window);
  installAudioStubs(window);
  // Must come AFTER installAudioStubs: audio-engine.js calls `new Audio()` as
  // a free variable, and AudioContext is only defined by the stub above.
  for (const k of ['Audio', 'AudioContext', 'HTMLMediaElement', 'HTMLAudioElement']) {
    if (k in window) {
      try { globalThis[k] = window[k]; }
      catch { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); }
    }
  }
  for (const k of ['requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver',
                   'ResizeObserver', 'matchMedia']) {
    try { globalThis[k] = window[k]; }
    catch { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); }
  }

  // Any switchDest() call with a name the app doesn't know is logged and
  // ignored. The static check only sees literal names, so a test passing one
  // through an array slipped past it. Catch every route at runtime instead.
  // app.js runs as a module under Node, so its `console` is Node's global
  // one, not jsdom's window.console. The first version of this hook watched
  // window.console and could never fire; a deliberate bad navigation proved it.
  const warnings = [];
  for (const c of new Set([globalThis.console, window.console])) {
    const realWarn = c.warn.bind(c);
    c.warn = (...a) => { warnings.push(a.map(String).join(' ')); realWarn(...a); };
  }
  globalThis.__bmWarnings = warnings;

  window.api = makeApi();
  globalThis.api = window.api;
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 404, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0), blob: async () => ({}) });

  const errs = [];
  window.addEventListener('error', e => errs.push(e.error || e.message));
  process.on('unhandledRejection', r => errs.push(r));

  /* ── 1. boot ─────────────────────────────────────────────────── */
  let mod;
  try {
    mod = await import(pathToFileURL(path.join(ROOT, 'src/js/app.js')).href);
    pass('app.js imports without throwing');
  } catch (e) {
    fail('app.js imports without throwing', e);
    return report();
  }

  /* ── 2. DOMContentLoaded wiring ──────────────────────────────── */
  try {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    pass('DOMContentLoaded handlers run without throwing');
  } catch (e) {
    fail('DOMContentLoaded handlers run without throwing', e);
  }

  /* ── 3. the app object actually exists ───────────────────────── */
  const app = window.bmApp || globalThis.bmApp;
  app ? pass('window.bmApp is constructed') : fail('window.bmApp is constructed');

  /* ── 4. dashboards constructed ───────────────────────────────── */
  (window.bmMusic || globalThis.bmMusic)
    ? pass('window.bmMusic is constructed')
    : fail('window.bmMusic is constructed');

  /* ── 5. exercise the paths that have been broken before ──────── */
  if (app) {
    for (const [name, fn] of [
      ['switchDest("gallery")', () => app.switchDest('images')],
      ['switchDest("music")',   () => app.switchDest('music')],
      ['switchDest("pdf")',     () => app.switchDest('pdf')],
      ['switchDest("video")',   () => app.switchDest('video')],
      ['goHome()',              () => app.goHome()],
      ['showOSD()',             () => {
        app.showOSD('smoke test');
        const o = window.document.getElementById('osd');
        if (!o) throw new Error('#osd is missing from index.html');
        if (o.textContent !== 'smoke test') throw new Error('#osd was not written to');
        if (!o.classList.contains('show')) throw new Error('#osd never got the .show class');
      }],
      ['stop()',                () => app.stop()],
      ['trackStep(1)',          () => app.trackStep(1)],
      ['_openCtxPanel(10,10)',  () => app._openCtxPanel(10, 10)],
      ['_closeCtxPanel()',      () => app._closeCtxPanel()],
    ]) {
      try { fn(); pass(name); } catch (e) { fail(name, e); }
    }

  }


  /* ── 6. Gallery: browse -> render -> lightbox -> filmstrip ───── */
  const gallery = window.bmGallery;
  if (!gallery) fail('window.bmGallery is constructed');
  else {
    pass('window.bmGallery is constructed');
    await step('gallery._browse() loads and renders', async () => {
      await gallery._browse();
      await tick(60);
      const cards = window.document.querySelectorAll('#gallery-grid .g-card');
      if (cards.length !== 3) throw new Error(`expected 3 image cards, got ${cards.length}`);
    });
    await step('filenames are escaped, not interpolated', () => {
      const grid = window.document.getElementById('gallery-grid');
      // 'Rock & Roll <live>.png' must not have produced a <live> element
      if (grid.querySelector('live')) throw new Error('filename was parsed as markup');
      const names = [...grid.querySelectorAll('.g-card-name')].map(n => n.textContent);
      if (!names.includes('Rock & Roll <live>.png')) throw new Error('escaped name lost: ' + names.join(' | '));
    });
    await step('gallery filter narrows the grid', async () => {
      gallery._filter = 'holiday';
      gallery._render();
      await tick(20);
      const n = window.document.querySelectorAll('#gallery-grid .g-card').length;
      if (n !== 1) throw new Error(`filter should leave 1 card, left ${n}`);
      gallery._filter = '';
      gallery._render();
      await tick(20);
    });
    for (const mode of ['name', 'name-desc', 'type', 'size', 'date']) {
      await step(`gallery sort "${mode}"`, () => {
        gallery.sortMode = mode;
        const out = gallery._sorted();
        if (out.length !== 3) throw new Error('sort dropped rows');
      });
    }
    await step('lightbox open / nav / filmstrip / info', async () => {
      gallery._openLB(0);
      await tick(20);
      gallery._nav(1);
      gallery._nav(-1);
      const strip = window.document.getElementById('lb-filmstrip');
      if (!strip || !strip.children.length) throw new Error('filmstrip rendered nothing');
      const drawer = window.document.getElementById('lb-info-drawer');
      if (!drawer || !drawer.children.length) throw new Error('info drawer rendered nothing');
      gallery._closeLB();
    });
    await step('slideshow toggles on and off cleanly', () => {
      gallery._toggleSlideshow(true);
      if (!gallery._slideshow) throw new Error('slideshow did not start');
      gallery._toggleSlideshow(false);
      if (gallery._slideshow) throw new Error('slideshow did not stop');
    });
  }

  /* ── 7. Music: load -> tags -> sort -> shuffle/repeat -> advance ─ */
  const music = window.bmMusic;
  if (music) {
    await step('music._load() finds audio and builds a queue', async () => {
      await music._load('/fixtures/music');
      await tick(120);
      if (music.tracks.length !== 3) throw new Error(`expected 3 tracks, got ${music.tracks.length}`);
      if (!music.queue || !music.queue.length) throw new Error('queue was not built');
    });
    await step('tags arrive and reach the rendered rows', async () => {
      await tick(150);
      const names = [...window.document.querySelectorAll('#music-tracks .tr-name')].map(n => n.textContent);
      if (!names.some(n => n.startsWith('Title '))) throw new Error('tag titles never rendered: ' + names.join(' | '));
    });
    for (const mode of ['name', 'artist', 'album', 'year', 'type']) {
      await step(`music sort "${mode}"`, () => {
        const out = music._sorted(music.tracks, mode);
        if (out.length !== 3) throw new Error('sort dropped rows');
      });
    }
    await step('music filter narrows the list', () => {
      music._filter = 'another';
      const out = music._sorted(music.tracks, 'name');
      if (out.length !== 1) throw new Error(`filter should leave 1 track, left ${out.length}`);
      music._filter = '';
    });
    await step('shuffle keeps every track exactly once', () => {
      const before = music.tracks.map(t => t.path).sort().join('|');
      music._toggleShuffle();
      const after = music.queue.map(t => t.path).sort().join('|');
      if (before !== after) throw new Error('shuffle lost or duplicated tracks');
      music._toggleShuffle();
    });
    await step('repeat cycles off -> all -> one -> off', () => {
      music.repeat = 'off';
      const seq = [music._cycleRepeat(), music._cycleRepeat(), music._cycleRepeat()];
      if (seq.join(',') !== 'all,one,off') throw new Error('got ' + seq.join(','));
    });
    await step('advance() walks the queue and stops at the end', () => {
      music.repeat = 'off';
      music.play(music.queue[0].path, 0);
      music.advance();
      if (music.queueIdx !== 1) throw new Error('advance did not move to index 1, got ' + music.queueIdx);
      music.queueIdx = music.queue.length - 1;
      music.advance();                       // past the end: must not throw
    });
    await step('repeat=all wraps to the first track', () => {
      music.repeat = 'all';
      music.queueIdx = music.queue.length - 1;
      music.advance();
      if (music.queueIdx !== 0) throw new Error('did not wrap, idx=' + music.queueIdx);
      music.repeat = 'off';
    });
    await step('album grouping renders headers', async () => {
      music.groupByAlbum = true;
      music._resort();
      await tick(30);
      const heads = window.document.querySelectorAll('#music-tracks .track-album-header');
      if (!heads.length) throw new Error('no album headers rendered');
      music.groupByAlbum = false;
      music._resort();
    });
  }

  /* ── 8. PDF: search debounce and cancellation ─────────────────── */
  const pdf = window.bmPDF;
  if (pdf) {
    pass('window.bmPDF is constructed');
    await step('search with no document degrades quietly', async () => {
      pdf._searchDebounced('anything');
      await tick(320);
    });
    await step('empty query clears results without a scan', () => {
      pdf._sr = [1, 2]; pdf._si = 0;
      pdf._searchDebounced('   ');
      if (pdf._sr.length) throw new Error('results were not cleared');
    });
    await step('outline build handles a missing document', async () => {
      await pdf._buildOutline();
    });
  }


  /* ── 9. Audio engine ─────────────────────────────────────────── */
  const { AudioEngine } = await import(pathToFileURL(path.join(ROOT, 'src/js/audio-engine.js')).href);
  await step('AudioEngine builds its graph', () => {
    const eng = new AudioEngine();
    if (!eng.available) throw new Error('engine reported unavailable');
    if (eng.filters.length !== 10) throw new Error('expected 10 EQ bands, got ' + eng.filters.length);
    // source -> 10 filters -> gain -> destination, and the analyser listening
    // BEFORE the gain (v3.36.0): the visualiser must not depend on the volume.
    const chain = window.__audioConnections.map(c => c.join('>'));
    if (!chain.includes('gain>destination')) throw new Error('the gain is not reaching the output: ' + chain.join(', '));
    if (!chain.includes('biquad>analyser')) throw new Error('the analyser is not fed from before the volume: ' + chain.join(', '));
    if (chain.includes('gain>analyser')) throw new Error('the analyser listens after the volume again');
    if (!chain.includes('analyser>gain')) throw new Error('the analyser has no silent tap to keep it fed');
    // volume and mute are the gain's, and the audio element stays at full
    eng.setVolume(50);
    if (Math.abs(eng.gain.gain.value - 0.5) > 1e-6) throw new Error('volume 50 gave a gain of ' + eng.gain.gain.value);
    if (eng.el.volume !== 1 || eng.el.muted) throw new Error('the audio element itself was turned down, which the analyser would hear');
    eng.setMuted(true);
    if (eng.gain.gain.value !== 0) throw new Error('mute left the gain at ' + eng.gain.gain.value);
    eng.setMuted(false); eng.setVolume(130);
    if (Math.abs(eng.gain.gain.value - 1.3) > 1e-6) throw new Error('volume 130 gave a gain of ' + eng.gain.gain.value);
    if (eng.tap.gain.value !== 0) throw new Error('the tap is not silent');
    // a glide only while sound is running: one set before that would play out, from full volume, when the first song starts
    const g0 = eng.gain.gain.glides; eng.ctx.state = 'suspended'; eng.setVolume(20);
    if (eng.gain.gain.glides !== g0 || Math.abs(eng.gain.gain.value - 0.2) > 1e-6) throw new Error('with the sound not running the volume was not set at once');
    eng.ctx.state = 'running'; eng.setVolume(60);
    if (eng.gain.gain.glides !== g0 + 1) throw new Error('with the sound running the volume did not glide');
    if (!(eng.gain.gain.cancels > 0)) throw new Error('earlier glides are not cancelled, so a later volume could be ignored');
    eng.destroy();
  });

  await step('codec gating routes undecodable formats to mpv', () => {
    const eng = new AudioEngine();
    for (const ok of ['/a/x.mp3', '/a/x.flac', '/a/x.m4a', '/a/x.wav', '/a/x.opus']) {
      if (!eng.canPlay(ok)) throw new Error('should handle ' + ok);
    }
    // Chromium has no decoder for these; they must fall through to mpv.
    for (const no of ['/a/x.ape', '/a/x.wma', '/a/x.mka', '/a/x.mkv']) {
      if (eng.canPlay(no)) throw new Error('should NOT claim ' + no);
    }
    eng.destroy();
  });

  await step('EQ gains clamp and land on the filters', () => {
    const eng = new AudioEngine();
    eng.setEQBand(0, 40);       // over the limit
    eng.setEQBand(1, -40);
    if (eng.filters[0].gain.value !== 12)  throw new Error('high gain not clamped: ' + eng.filters[0].gain.value);
    if (eng.filters[1].gain.value !== -12) throw new Error('low gain not clamped: ' + eng.filters[1].gain.value);
    eng.setEQ([1,2,3,4,5,6,7,8,9,10]);
    if (eng.getEQ().join(',') !== '1,2,3,4,5,6,7,8,9,10') throw new Error('setEQ did not apply: ' + eng.getEQ());
    eng.resetEQ();
    if (eng.getEQ().some(g => g !== 0)) throw new Error('resetEQ left gain behind');
    eng.destroy();
  });

  // Since v3.36.0 all of the volume is the gain node's, and the audio element
  // stays at full: the element's own volume is applied before the analyser.
  await step('the whole volume range is the gain node\'s, and the element stays at full', () => {
    const eng = new AudioEngine();
    eng.setVolume(80);
    if (eng.el.volume !== 1 || Math.abs(eng.gain.gain.value - 0.8) > 1e-9) throw new Error('80% wrong: element ' + eng.el.volume + ', gain ' + eng.gain.gain.value);
    eng.setVolume(130);
    if (eng.el.volume !== 1) throw new Error('element volume should stay at 1');
    if (eng.gain.gain.value !== 1.3) throw new Error('gain node should carry the boost, got ' + eng.gain.gain.value);
    eng.setVolume(-5);
    if (eng.gain.gain.value !== 0) throw new Error('negative volume not clamped');
    eng.setVolume(500);
    if (eng.gain.gain.value !== 1.3) throw new Error('volume not capped at 130');
    eng.destroy();
  });

  await step('transport events fire in order', async () => {
    const eng = new AudioEngine();
    const seen = [];
    eng.on('play', () => seen.push('play')).on('pause', () => seen.push('pause')).on('ended', () => seen.push('ended'));
    await eng.load('file:///a/x.mp3', '/a/x.mp3', true);
    eng.pause();
    eng.el.dispatchEvent(new window.Event('ended'));
    if (seen.join(',') !== 'play,pause,ended') throw new Error('got ' + seen.join(','));
    eng.destroy();
  });

  await step('a decode error hands the track back instead of dying', () => {
    const eng = new AudioEngine();
    let handed = null;
    eng.on('fallback', d => { handed = d.path; });
    eng.load('file:///a/broken.mp3', '/a/broken.mp3', false);
    eng.el.dispatchEvent(new window.Event('error'));
    if (handed !== '/a/broken.mp3') throw new Error('fallback never fired');
    if (eng.active) throw new Error('engine still claims ownership after a decode failure');
    eng.destroy();
  });

  await step('music routes a playable file to the engine, not mpv', async () => {
    const m = window.bmMusic;
    if (!m.engine?.available) throw new Error('engine not constructed on MusicDash');
    m.play('/fixtures/music/01 - track.mp3', 0);
    await tick(30);
    if (!m.engineOwns()) throw new Error('engine did not take ownership of an mp3');
  });

  await step('music routes an undecodable file to mpv', async () => {
    const m = window.bmMusic;
    m.play('/fixtures/music/weird.ape', 0);
    await tick(30);
    if (m.engineOwns()) throw new Error('engine wrongly claimed an .ape file');
  });

  // The first version of this test said `if (v && !v.analyser)`: with no
  // visualiser in existence it checked nothing and passed. That hid a real
  // bug. The Video tab's visualiser is created when the tab first opens,
  // usually after a track has started, and only got the analyser at play().
  // A Windows screenshot showed it. So: music first, then the tab.
  await step('the Video-tab visualiser gets the engine analyser even when created after the music started', async () => {
    const app = window.bmApp, m = window.bmMusic;
    app.viz?.stop?.(); app.viz = null;                    // the state before the tab is first opened
    app.switchDest('music'); m.engineEnabled = true; app._hasVideo = false;
    m.play('/fixtures/music/01 - track.mp3', 0); await tick(30);
    app.isPlaying = true;
    app.switchDest('video'); await tick(30);
    if (!app.viz) throw new Error('the Video tab did not create its visualiser');
    if (app.viz.analyser !== m.engine.analyser) throw new Error("the visualiser does not have the engine's analyser, so it would draw synthetic bars");
    app.switchDest('music');
  });

  await step('music playback leaves the sidebar and menus in place', async () => {
    const m = window.bmMusic;
    m.play('/fixtures/music/01 - track.mp3', 0); await tick(20);
    m.engine._emit('play');
    if (window.document.body.classList.contains('playing'))
      throw new Error('music set body.playing, the video state that hides the sidebar and menus');
  });

  await step('the main controls bar follows the in-app engine', async () => {
    const app = window.bmApp, m = window.bmMusic, doc = window.document;
    m.play('/fixtures/music/01 - track.mp3', 0); await tick(20);
    m.engine._emit('play');
    const pairs = doc.querySelectorAll('#btn-play .ico-pair');
    if (pairs.length === 2 && !pairs[0].classList.contains('ico-hidden')) throw new Error('main play button still shows play while music plays');
    m.engine._emit('time', { time: 42, duration: 200 });
    const cur = doc.getElementById('time-current').textContent, tot = doc.getElementById('time-total').textContent;
    if (cur !== '0:42' || tot !== '3:20') throw new Error(`main bar reads ${cur} / ${tot}, expected 0:42 / 3:20`);
  });


  /* ── 10. Diagnostics ─────────────────────────────────────────── */
  await step('diagnostics collect and format without a GPU', async () => {
    const { collectDiagnostics, formatDiagnostics } =
      await import(pathToFileURL(path.join(ROOT, 'src/js/diagnostics.js')).href);
    const d = await collectDiagnostics(window.api);
    const text = formatDiagnostics(d);
    for (const section of ['Application', 'Versions', 'System', 'mpv', 'Graphics', 'Audio', 'Caches']) {
      if (!text.includes(section)) throw new Error('report is missing the ' + section + ' section');
    }
    // jsdom has no WebGL, so this must read as a hard no rather than crash.
    if (!/webgl2\s+false/.test(text)) throw new Error('webgl2 should report false under jsdom');
    // A missing mpv is the single most common cause of "nothing plays".
    if (!text.includes('playback will not start')) throw new Error('missing mpv is not called out');
  });

  await step('diagnostics survive a main process that refuses', async () => {
    const { collectDiagnostics, formatDiagnostics } =
      await import(pathToFileURL(path.join(ROOT, 'src/js/diagnostics.js')).href);
    const broken = { app: { diagnostics: async () => { throw new Error('IPC down'); } } };
    const text = formatDiagnostics(await collectDiagnostics(broken));
    if (!text.includes('IPC down')) throw new Error('the failure should be reported, not swallowed');
  });

  await step('openDiagnostics() fills the panel', async () => {
    await window.bmApp.openDiagnostics();
    const out = window.document.getElementById('diag-output');
    if (!out || !out.textContent.includes('BM Player diagnostics')) {
      throw new Error('panel was not populated');
    }
  });


  /* ── 11. Boot script and compatibility flags ─────────────────── */
  // The inline boot script in index.html has never been executed by any
  // test, because the main harness runs with runScripts:'outside-only'.
  // Run it for real in a separate document so its query parsing is proven.
  const bootSrc = (() => {
    const html = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
    const m = html.match(/<script>\s*([\s\S]*?__BM_FLAGS__[\s\S]*?)<\/script>/);
    return m ? m[1] : null;
  })();

  const runBoot = (search, breakStorage) => {
    const d = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://bm.local/index.html' + search, runScripts: 'outside-only',
    });
    if (breakStorage) {
      Object.defineProperty(d.window, 'localStorage', {
        configurable: true, get() { throw new Error('storage unavailable'); },
      });
    }
    d.window.eval(bootSrc);
    return d.window;
  };

  await step('boot script can be found in index.html', () => {
    if (!bootSrc) throw new Error('no inline script mentions __BM_FLAGS__');
  });

  await step('boot script: no query means normal mode', () => {
    const f = runBoot('', false).__BM_FLAGS__;
    if (!f || f.fileScheme !== 'bmfile' || !f.audioEngine || !f.gpuFluid || f.compat) {
      throw new Error('defaults wrong: ' + JSON.stringify(f));
    }
  });

  await step('boot script: compat query sets every fallback', () => {
    const f = runBoot('?fs=file&ae=0&gf=0&compat=1', false).__BM_FLAGS__;
    if (f.fileScheme !== 'file' || f.audioEngine || f.gpuFluid || !f.compat) {
      throw new Error('compat flags wrong: ' + JSON.stringify(f));
    }
  });

  await step('boot script: compat survives localStorage throwing', () => {
    // The bug fixed in this version: flags lived inside the lite-mode try,
    // so a storage failure skipped them and compat mode quietly vanished.
    const w = runBoot('?fs=file&ae=0&gf=0&compat=1', true);
    if (!w.__BM_FLAGS__ || !w.__BM_FLAGS__.compat) {
      throw new Error('flags were lost when localStorage threw');
    }
    if (w.__BM_LITE__ !== false) throw new Error('lite should fall back to false');
  });

  const { fileURL } = await import(pathToFileURL(path.join(ROOT, 'src/js/util.js')).href);
  const SAMPLE = 'C:\\Users\\b\\Music\\Rock & Roll #1.flac';

  await step('fileURL uses bmfile:// in normal mode', () => {
    window.__BM_FLAGS__ = { fileScheme: 'bmfile', audioEngine: true, gpuFluid: true, compat: false };
    const u = fileURL(SAMPLE);
    if (!u.startsWith('bmfile://local/')) throw new Error('got ' + u);
    // the whole path is one segment, so it must decode back exactly
    if (decodeURIComponent(u.slice('bmfile://local/'.length)) !== SAMPLE.replace(/\\/g, '/')) {
      throw new Error('path did not round-trip: ' + u);
    }
  });

  await step('fileURL falls back to file:/// in compat mode', () => {
    window.__BM_FLAGS__ = { fileScheme: 'file', audioEngine: false, gpuFluid: false, compat: true };
    const u = fileURL(SAMPLE);
    if (!u.startsWith('file:///C:/')) throw new Error('got ' + u);
    if (!u.includes('%23')) throw new Error('# was not encoded: ' + u);
  });

  await step('audio engine stays off when its flag is off', async () => {
    window.__BM_FLAGS__ = { fileScheme: 'file', audioEngine: false, gpuFluid: false, compat: true };
    const { MusicDash } = await import(pathToFileURL(path.join(ROOT, 'src/js/dash/music.js')).href);
    const m = new MusicDash(window.api);
    if (m.engineEnabled) throw new Error('engine enabled despite audioEngine:false');
    m.play('/fixtures/music/01 - track.mp3', 0);
    await tick(20);
    if (m.engineOwns()) throw new Error('engine took ownership despite the flag');
  });

  await step('audio engine is on by default', async () => {
    window.__BM_FLAGS__ = { fileScheme: 'bmfile', audioEngine: true, gpuFluid: true, compat: false };
    const { MusicDash } = await import(pathToFileURL(path.join(ROOT, 'src/js/dash/music.js')).href);
    const m = new MusicDash(window.api);
    if (!m.engineEnabled) throw new Error('engine disabled in normal mode');
  });

  delete window.__BM_FLAGS__;


  /* ── 12. Visible where it's needed, not just present ─────────── */
  // v2.7.0 put the A-B indicator inside the music mini player purely to
  // satisfy the element-exists contract. That container is hidden during
  // video, the one place A-B looping gets used, so the indicator existed
  // and could never be seen.
  await step('A-B indicator lives outside the music mini player', () => {
    const ind = window.document.getElementById('ab-indicator');
    if (!ind) throw new Error('#ab-indicator missing');
    if (ind.closest('#music-mini-player')) throw new Error('still inside #music-mini-player, hidden during video');
  });

  await step('A-B indicator shows both points once a loop is set', () => {
    const app = window.bmApp;
    const real = app.abRepeat?.snapshot;
    app.abRepeat = app.abRepeat || {};
    app.abRepeat.snapshot = () => ({ a: 12, b: 47, active: true, paused: false });
    app._renderABIndicator();
    const ind = window.document.getElementById('ab-indicator');
    if (ind.classList.contains('hidden')) throw new Error('indicator stayed hidden with a loop set');
    const a = window.document.getElementById('ab-a').textContent;
    const b = window.document.getElementById('ab-b').textContent;
    if (a !== '0:12' || b !== '0:47') throw new Error(`points read ${a} / ${b}`);
    app.abRepeat.snapshot = () => ({ a: null, b: null });
    app._renderABIndicator();
    if (!ind.classList.contains('hidden')) throw new Error('indicator did not hide when cleared');
    if (real) app.abRepeat.snapshot = real;
  });

  await step('bottom-centre prompts share one stack', () => {
    for (const id of ['resume-prompt', 'update-banner', 'default-player-prompt']) {
      const e = window.document.getElementById(id);
      if (!e) throw new Error('#' + id + ' missing');
      if (e.parentElement?.id !== 'toast-stack') throw new Error('#' + id + ' is outside #toast-stack and will overlap the others');
    }
  });


  /* ── 13. Keyboard: overlays before playback ──────────────────── */
  // Escape used to reach the global handler, which calls stop() and then
  // goHome(). Dismissing the right-click menu stopped the video, closing an
  // image threw you out of the gallery, and arrows in the lightbox also
  // seeked whatever was playing in the background.
  {
    const app = window.bmApp, gal = window.bmGallery;
    const press = (key, code) => window.document.body.dispatchEvent(
      new window.KeyboardEvent('keydown', { key, code: code || key, bubbles: true, cancelable: true }));
    let stops = 0, toggles = 0;
    const realStop = app.stop.bind(app), realToggle = app.togglePlay.bind(app);
    app.stop = () => { stops++; };
    app.togglePlay = () => { toggles++; };
    const sent = [];
    const realCmd = window.api.mpv.cmd;
    window.api.mpv.cmd = (...a) => { sent.push(a[0]); return Promise.resolve(null); };
    const reset = () => { stops = 0; toggles = 0; sent.length = 0; };

    // Escape's stop() runs inside isFs().then(...), a tick later. Checking
    // synchronously passed even with the fix removed, so every Escape test
    // waits before asserting.
    await step('Escape closes the right-click menu without stopping playback', async () => {
      reset(); app.isPlaying = true;
      app._openCtxPanel(40, 40);
      press('Escape');
      await tick(10);
      if (!window.document.getElementById('ctx-panel').classList.contains('hidden')) throw new Error('menu still open');
      if (stops) throw new Error('Escape also stopped playback');
    });

    await step('Escape closes the lightbox without leaving the gallery', async () => {
      reset();
      app.switchDest('images');
      if (!gal.images?.length) { await gal._browse(); await tick(40); }
      gal._openLB(0);
      press('Escape');
      await tick(10);
      if (window.document.getElementById('lightbox').classList.contains('open')) throw new Error('lightbox still open');
      if (stops) throw new Error('Escape also called stop(), which sends you home');
      if (app.currentDash !== 'images') throw new Error('left the gallery: now on ' + app.currentDash);
    });

    await step('arrow keys in the lightbox move images, not the playhead', () => {
      reset();
      gal._openLB(0);
      press('ArrowRight');
      if (sent.includes('seek')) throw new Error('ArrowRight also seeked background playback');
      if (gal.lbIdx !== 1) throw new Error('lightbox did not advance, index ' + gal.lbIdx);
      gal._closeLB();
    });

    await step('S in the lightbox is slideshow, not stop', () => {
      reset();
      gal._openLB(0);
      press('s', 'KeyS');
      if (stops) throw new Error('S stopped playback while the lightbox was open');
      gal._toggleSlideshow(false);
      gal._closeLB();
    });

    await step('Escape closes a side panel without stopping playback', async () => {
      reset();
      app.openPanel('history');
      press('Escape');
      await tick(10);
      if (window.document.querySelector('.side-panel.open')) throw new Error('panel still open');
      if (stops) throw new Error('Escape also stopped playback');
    });

    await step('playback keys still work while a side panel is open', () => {
      reset();
      app.openPanel('history');
      press(' ', 'Space');
      if (toggles !== 1) throw new Error('Space did not reach playback, a side panel is not modal');
      app._topOverlay()?.close();
    });

    await step('Escape with nothing open keeps its original meaning', async () => {
      reset();
      press('Escape');
      await tick(10);
      if (stops !== 1) throw new Error('expected the original stop-on-Escape, got ' + stops + ' stop call(s)');
    });

    app.stop = realStop; app.togglePlay = realToggle; window.api.mpv.cmd = realCmd;
  }


  /* ── 14. Picture-in-picture, renderer side ───────────────────── */
  {
    const app = window.bmApp, doc = window.document;
    const press = (key, code) => doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key, code: code || key, bubbles: true }));
    const settle = () => tick(20);

    await step('PiP state reaches the renderer at all', () => {
      if (!bridge.pip.length) throw new Error('nothing registered for win:pipState');
    });

    await step('entering PiP shows only the player and remembers the tab', async () => {
      app.switchDest('images'); app.isPlaying = true; app._hasVideo = true;
      firePip(true); await settle();
      if (!doc.body.classList.contains('pip-mode')) throw new Error('body.pip-mode not set');
      if (!doc.getElementById('player-view').classList.contains('active')) throw new Error('player view not shown');
      if (doc.querySelector('.dashboard-view.active')) throw new Error('a dashboard is still drawn over the video');
      if (app._pipReturnDash !== 'images') throw new Error('did not remember the gallery tab');
    });

    await step('Escape in PiP leaves PiP instead of stopping playback', async () => {
      let stops = 0; const real = app.stop.bind(app); app.stop = () => { stops++; };
      bridge.pipCalls.length = 0; app._pipPending = false;
      press('Escape'); await tick(15);
      app.stop = real;
      if (stops) throw new Error('Escape stopped playback in PiP');
      if (bridge.pipCalls.at(-1) !== false) throw new Error('Escape did not ask main to leave PiP');
    });

    await step('leaving PiP returns to the tab it started from', async () => {
      firePip(false); await settle();
      if (doc.body.classList.contains('pip-mode')) throw new Error('pip-mode still set');
      if (app.currentDash !== 'images') throw new Error('landed on ' + app.currentDash + ', expected the gallery');
    });

    await step('two quick PiP clicks send one request', async () => {
      bridge.pipCalls.length = 0; app._pipPending = false; app._pipActive = false;
      app.togglePiP(); app.togglePiP();
      await settle();
      if (bridge.pipCalls.length !== 1) throw new Error(`sent ${bridge.pipCalls.length} requests`);
      firePip(true); await settle(); firePip(false); await settle();
    });

    await step('stop in PiP ends on the home screen, not the old tab', async () => {
      app.switchDest('music'); app.isPlaying = true; app._hasVideo = true;
      app._pipPending = false; firePip(true); await settle();
      app.stop();
      firePip(false); await settle();              // main's reply arrives after stop
      if (app.currentDash !== 'video') throw new Error('stop in PiP landed on ' + app.currentDash);
      if (!doc.getElementById('welcome-screen').classList.contains('active')) throw new Error('home screen not shown');
    });

    await step('audio PiP turns the visualiser off again on the way out', async () => {
      app.switchDest('images'); app.isPlaying = true; app._hasVideo = false; app._audioVizMode = false;
      doc.body.classList.remove('audio-viz');
      app._pipPending = false; app._pipActive = false;
      app.togglePiP(true); await settle();
      if (!doc.body.classList.contains('audio-viz')) throw new Error('audio PiP did not show the visualiser');
      firePip(true); await settle(); firePip(false); await settle();
      if (doc.body.classList.contains('audio-viz')) throw new Error('visualiser overlay left switched on after PiP');
    });

    await step('nothing else can draw over the video in PiP', () => {
      const css = fs.readFileSync(path.join(ROOT, 'src/css/components.css'), 'utf8');
      for (const sel of ['.lightbox', '.theme-customizer', '.toast-stack', '#ab-indicator']) {
        if (!new RegExp('body\\.pip-mode ' + sel.replace('.', '\\.').replace('#', '#')).test(css)) {
          throw new Error(sel + ' is not hidden in PiP');
        }
      }
    });
  }

  /* ── 15. End of file, as real mpv reports it ─────────────────── */
  // With --keep-open=yes mpv sends eof-reached, not end-file. Verified
  // against real mpv by scripts/integration-mpv.cjs.
  {
    const app = window.bmApp, m = window.bmMusic;
    let advances = 0; const realAdv = m.advance.bind(m);
    m.advance = () => { advances++; };
    const reset = () => { advances = 0; app._eofHandled = false; };

    await step('mpv audio advances when eof-reached turns true', () => {
      reset(); app._hasVideo = false; m.currentPath = '/fixtures/music/weird.ape';
      m.engine.active = false;
      fireProp('eof-reached', false); fireProp('eof-reached', true);
      if (advances !== 1) throw new Error('advanced ' + advances + ' times');
    });

    await step('a repeated eof-reached does not skip a second track', () => {
      reset();
      fireProp('eof-reached', true); fireProp('eof-reached', true);
      if (advances !== 1) throw new Error('advanced ' + advances + ' times on one end of file');
      fireProp('eof-reached', false); fireProp('eof-reached', true);
      if (advances !== 2) throw new Error('the next real end of file was ignored');
    });

    await step('video reaching its end does not touch the music queue', () => {
      reset(); app._hasVideo = true;
      fireProp('eof-reached', false); fireProp('eof-reached', true);
      if (advances) throw new Error('a finished video advanced the music queue');
      app._hasVideo = false;
    });

    await step('the in-app engine is left to its own ended event', () => {
      reset(); m.engine.active = true; m.engineEnabled = true;
      fireProp('eof-reached', false); fireProp('eof-reached', true);
      m.engine.active = false;
      if (advances) throw new Error('mpv eof advanced while the engine owned playback');
    });

    m.advance = realAdv;
  }


  /* ── 16. Every control reaches the in-app engine ─────────────── */
  // For most music the in-app engine plays and mpv sits idle. About twenty
  // controls sent their command to mpv alone and so did nothing at all.
  {
    const app = window.bmApp, m = window.bmMusic, doc = window.document, eng = m.engine;
    const press = (key, code) => doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key, code: code || key, bubbles: true }));
    const click = id => doc.getElementById(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX: 50 }));
    const calls = [];
    const spy = name => { const real = eng[name].bind(eng); eng[name] = (...a) => { calls.push([name, ...a]); return real(...a); }; return real; };
    const reals = Object.fromEntries(['seek', 'seekBy', 'setVolume', 'setMuted', 'toggle', 'stop'].map(n => [n, spy(n)]));
    Object.defineProperty(eng, 'duration', { configurable: true, get: () => 200 });
    const own = async () => {
      app.switchDest('music'); m.engineEnabled = true;
      m.play('/fixtures/music/01 - track.mp3', 0); await tick(20);
      app.duration = 200; calls.length = 0;
      if (!m.engineOwns()) throw new Error('setup: the engine did not take the mp3');
    };
    const got = name => calls.some(c => c[0] === name);

    const cases = [
      ['Now Playing seek bar',   () => click('np-seek-track'), 'seek'],
      ['Now Playing volume',     () => { const v = doc.getElementById('np-volume'); v.value = 40; v.dispatchEvent(new window.Event('input', { bubbles: true })); }, 'setVolume'],
      ['mini-bar seek',          () => click('mmp-progress'), 'seek'],
      ['main seek bar',          () => doc.getElementById('seek-container')?.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 30 })), 'seek'],
      ['skip back button',       () => click('btn-rew'), 'seekBy'],
      ['skip forward button',    () => click('btn-fwd'), 'seekBy'],
      ['mute button',            () => click('btn-mute'), 'setMuted'],
      ['M key',                  () => press('m', 'KeyM'), 'setMuted'],
      ['right arrow',            () => press('ArrowRight'), 'seekBy'],
      ['left arrow',             () => press('ArrowLeft'), 'seekBy'],
      ['number key 5',           () => press('5', 'Digit5'), 'seek'],
    ];
    for (const [what, act, expect] of cases) {
      await step(`${what} reaches the in-app engine`, async () => {
        await own();
        await act();
        await tick(5);
        if (!got(expect)) throw new Error(`engine.${expect}() was never called; the command went to mpv only`);
      });
    }

    await step('N and P move through the music queue', async () => {
      await own();
      let steps = [];
      const realAdv = m.advance.bind(m), realPlay = m.play.bind(m);
      m.advance = () => { steps.push('next'); };
      m.play = (fp, i) => { steps.push('prev:' + i); };
      m.queueIdx = 1;
      press('n', 'KeyN'); press('p', 'KeyP');
      m.advance = realAdv; m.play = realPlay;
      if (steps.join(',') !== 'next,prev:0') throw new Error('got ' + (steps.join(',') || 'nothing'));
    });

    await step('Now Playing stop really stops, and stays on the music tab', async () => {
      await own();
      click('np-btn-stop'); await tick(5);
      if (eng.active) throw new Error('the engine is still playing after stop');
      if (app.isPlaying) throw new Error('app still thinks it is playing');
      if (app.currentDash !== 'music') throw new Error('stop moved you to ' + app.currentDash);
    });

    await step('switching to TV silences the in-app engine', async () => {
      await own(); app.isPlaying = true; app._hasVideo = false;
      app.switchDest('tv'); await tick(5);
      if (eng.active) throw new Error('music kept playing under the TV stream');
    });

    Object.assign(eng, reals);
    delete eng.duration;
  }

  /* ── 17. Mini bar and the video-mode visualiser ──────────────── */
  {
    const app = window.bmApp, m = window.bmMusic, doc = window.document;
    const mini = () => !doc.getElementById('music-mini-player').classList.contains('hidden');
    const playMusic = async () => {
      app.switchDest('music'); m.engineEnabled = true; app._hasVideo = false;
      m.play('/fixtures/music/01 - track.mp3', 0); await tick(20);
      app.isPlaying = true;
    };

    await step('mini bar appears in Gallery and PDF while music plays', async () => {
      await playMusic();
      for (const tab of ['images', 'pdf']) {
        app.switchDest(tab); app._updateMiniPlayer();
        // Assert the switch happened. With a wrong name the guard ignores
        // it, and this test used to pass without ever reaching the gallery.
        if (app.currentDash !== tab) throw new Error(`switchDest('${tab}') did not take effect`);
        if (!mini()) throw new Error('no mini bar on the ' + tab + ' tab');
      }
    });

    await step('mini bar returns after visiting the Video-tab visualiser', async () => {
      // Music, then the Video tab (visualiser on, mini bar off), then the
      // gallery. The visualiser's state must not follow you there.
      await playMusic();
      app.switchDest('video'); await tick(10);
      if (!app._audioVizMode) throw new Error('setup: visualiser did not turn on');
      app.switchDest('images'); app._updateMiniPlayer();
      if (app._audioVizMode) throw new Error('visualiser mode followed you to the gallery');
      if (!mini()) throw new Error('no mini bar in the gallery after visiting the visualiser');
    });

    await step('mini bar stays out of the way on the Music tab', async () => {
      await playMusic(); app.switchDest('music'); app._updateMiniPlayer();
      if (mini()) throw new Error('mini bar shown on the music tab itself');
    });

    await step('mini bar carries the track title', async () => {
      await playMusic(); app.switchDest('images'); app._updateMiniPlayer();
      const t = doc.getElementById('mmp-title').textContent;
      if (!t || /not playing/i.test(t)) throw new Error('mini bar title reads ' + JSON.stringify(t));
    });

    await step('Video tab shows the visualiser instead, with no mini bar', async () => {
      await playMusic(); app.switchDest('video'); await tick(10);
      if (!doc.body.classList.contains('audio-viz')) throw new Error('no visualiser on the video tab');
      if (!doc.getElementById('player-view').classList.contains('active')) throw new Error('player view not shown');
      if (mini()) throw new Error('mini bar shown on top of the visualiser');
    });

    await step('visualiser buttons sit above the video controls, not under them', () => {
      const css = fs.readFileSync(path.join(ROOT, 'src/css/components.css'), 'utf8');
      const m2 = css.match(/body\.audio-viz \.viz-overlay\s*\{[^}]*bottom:\s*(\d+)px/);
      if (!m2 || +m2[1] < 96) throw new Error('overlay is not lifted clear of the ~100px controls bar');
    });

    await step('stop in video mode: visualiser off, music off, home screen', async () => {
      await playMusic(); app.switchDest('video'); await tick(10);
      app.stop(); await tick(10);
      if (doc.body.classList.contains('audio-viz')) throw new Error('visualiser state left behind');
      if (m.engine.active) throw new Error('music still playing');
      if (app.currentDash !== 'video' || !doc.getElementById('welcome-screen').classList.contains('active')) {
        throw new Error('not on the home screen');
      }
      if (doc.getElementById('player-view').classList.contains('active')) throw new Error('player view still shown');
    });

    await step('the next video is never drawn under the music overlay', async () => {
      doc.body.classList.add('audio-viz'); app._audioVizMode = true;   // worst case: stale state
      app.updateVisualizerVisibility([{ type: 'video', id: 1 }]);
      if (doc.body.classList.contains('audio-viz')) throw new Error('music overlay still on for a video');
      app._hasVideo = false;
    });

    // v3.36.0. A song mpv plays, with the music view open, made a second
    // visualiser on the music view's canvas: two drawing at once, each clearing
    // the other. And the music view's own went on drawing after a stop.
    await step('the music view has one visualiser, and it stops with the music', async () => {
      if (!m._viz) throw new Error('the music view has no visualiser to test');
      const was = { dash: app.currentDash, viz: app.musicViz, file: app._currentFilePath, lite: app.isLite };
      try {
        app.musicViz = undefined; app.currentDash = 'music'; app._currentFilePath = null;
        app.isLite = false;                                                   // the full app: Lite has no visualiser
        app.updateVisualizerVisibility([{ type: 'audio', id: 1 }]);          // as mpv reports an audio-only file
        if (!app.musicViz) throw new Error('no visualiser for a song mpv plays in the music view');
        if (app.musicViz !== m._viz) throw new Error('a second visualiser was made on the music view\'s canvas');
        m._viz.setMode('bars'); m._viz.start();
        if (!m._viz.active) throw new Error('the music view\'s visualiser did not start');
        app.stop({ stay: true }); await tick(10);
        if (m._viz.active) throw new Error('the music view\'s visualiser kept drawing after a stop');
        // and for a song the in-app engine plays, where the app holds no visualiser of its own for that view
        app.musicViz = undefined; m._viz.setMode('bars'); m._viz.start();
        app.stop({ stay: true }); await tick(10);
        if (m._viz.active) throw new Error('after a song the in-app engine played, the music view\'s visualiser kept drawing');
      } finally { app.currentDash = was.dash; app._currentFilePath = was.file; app.isLite = was.lite; m._viz?.stop?.(); }
    });
  }

  /* ── 18. PiP controls ────────────────────────────────────────── */
  {
    const app = window.bmApp, doc = window.document;
    const settle = () => tick(20);
    await step('PiP has close, size and expand, all with spoken names', () => {
      for (const id of ['pip-play', 'pip-size', 'pip-exit', 'pip-close']) {
        const b = doc.getElementById(id);
        if (!b) throw new Error('#' + id + ' missing from the PiP bar');
        if (!b.closest('.pip-bar')) throw new Error('#' + id + ' is not in the PiP bar');
      }
    });

    await step('PiP bar buttons are clickable inside the drag region', () => {
      const css = fs.readFileSync(path.join(ROOT, 'src/css/enhance.css'), 'utf8');
      if (!/\.pip-btn\s*\{[^}]*-webkit-app-region:\s*no-drag/.test(css)) {
        throw new Error('.pip-btn lacks -webkit-app-region:no-drag; clicks would drag the window instead');
      }
    });

    await step('the size button asks main to resize', async () => {
      app.isPlaying = true; app._hasVideo = true; app._pipPending = false;
      firePip(true); await settle();
      bridge.pipSizeCalls = 0;
      doc.getElementById('pip-size').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await settle();
      if (bridge.pipSizeCalls !== 1) throw new Error('win:pipSize was not requested');
    });

    await step('the close button stops and ends on the home screen', async () => {
      bridge.pipCalls.length = 0;
      doc.getElementById('pip-close').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await settle();
      firePip(false); await settle();
      if (bridge.pipCalls.at(-1) !== false) throw new Error('did not leave PiP');
      if (app.isPlaying) throw new Error('playback not stopped');
      if (!doc.getElementById('welcome-screen').classList.contains('active')) throw new Error('not on the home screen');
    });

    await step('controls are shown briefly on entering PiP', async () => {
      app.isPlaying = true; app._pipPending = false; app._pipActive = false;
      firePip(true); await settle();
      if (!doc.body.classList.contains('pip-intro')) throw new Error('no reveal on entry');
      firePip(false); await settle();
    });
  }

  /* ── 19. The visualiser and the fluid (v3.36.0) ──────────────── */
  {
    const url = f => pathToFileURL(path.join(ROOT, 'src/js', f)).href;
    const { perf, autoDetectTier } = await import(url('perf.js'));
    const { FluidFX } = await import(url('fluid.js'));
    const VZ = await import(url('visualizer.js'));
    const { Visualizer, MD, MD_SCALES, FLOW } = VZ;
    const art = await import(url('viz-art.js'));

    await step('the quality tier: a strong machine is High, and Lite does not leave Low behind', () => {
      // navigator.deviceMemory never says more than 8: from the page, 8 means "8 or more"
      if (autoDetectTier(20, 8) !== 'high') throw new Error('20 cores and 8+ GB gave ' + autoDetectTier(20, 8) + ': High could not be reached');
      if (autoDetectTier(20, 8, true) !== 'medium') throw new Error('a machine known to have just 8 GB is not Medium');
      if (autoDetectTier(4, 8) !== 'medium' || autoDetectTier(2, 8) !== 'low' || autoDetectTier(8, 4) !== 'low') throw new Error('the small machines are judged wrongly');
      const before = perf.tier, kept = localStorage.getItem('bm_perf_quality_user');
      perf.setSessionTier('low');
      if (perf.tier !== 'low') throw new Error('the tier for this run was not applied');
      if (localStorage.getItem('bm_perf_quality_user') !== kept || localStorage.getItem('bm_perf_quality') !== null) throw new Error('Lite mode saved its tier: it would stay on Low for good');
      perf.setSessionTier(null);
      if (perf.tier !== before) throw new Error('lifting the tier for this run did not bring back ' + before);
    });

    // The fluid's loop on a clock of its own: `hz` screen refreshes a second for one second.
    const runLoop = (hz, interval) => {
      const realNow = Object.getOwnPropertyDescriptor(performance, 'now'), realRaf = globalThis.requestAnimationFrame, realCaf = globalThis.cancelAnimationFrame;
      let t = 1000, q = [];
      Object.defineProperty(performance, 'now', { value: () => t, configurable: true, writable: true });
      globalThis.requestAnimationFrame = cb => { q.push(cb); return q.length; };
      globalThis.cancelAnimationFrame = () => {};
      const f = Object.create(FluidFX.prototype);
      Object.assign(f, { paused: false, mode: 'fluid', _raf: null, _alpha: 1, _targetAlpha: 1, _frameInterval: interval, audioDriven: true, dts: [],
        _resize() {}, _render() {}, _govern() {}, _step(dt) { this.dts.push(dt); } });
      try {
        f._start();
        for (let i = 0; i < hz; i++) { t += 1000 / hz; const run = q; q = []; run.forEach(cb => cb(t)); }
      } finally {
        if (realNow) Object.defineProperty(performance, 'now', realNow); else delete performance.now;
        globalThis.requestAnimationFrame = realRaf; globalThis.cancelAnimationFrame = realCaf;
      }
      return { steps: f.dts.length, time: f.dts.reduce((a, b) => a + b, 0) };
    };
    await step('the fluid runs at the same speed on a 60, 120 and 144 Hz screen', () => {
      for (const [hz, interval, steps] of [[60, 1000 / 60, 60], [144, 1000 / 60, 72], [120, 1000 / 60, 60], [144, 1000 / 30, 28], [60, 1000 / 30, 30], [240, 1000 / 60, 60]]) {
        const r = runLoop(hz, interval);
        if (Math.abs(r.time - 1) > 0.06) throw new Error(`${hz} Hz, a frame every ${interval.toFixed(1)} ms: one second on the clock moved the fluid ${r.time.toFixed(2)} s (it was 0.33 on a 144 Hz screen)`);
        if (Math.abs(r.steps - steps) > 2) throw new Error(`${hz} Hz, a frame every ${interval.toFixed(1)} ms: ${r.steps} frames drawn in a second, expected about ${steps}`);
      }
    });

    await step('the fluid steps its quality down when frames stay slow, and only then', () => {
      const make = () => { const f = Object.create(FluidFX.prototype); let applied = [];
        Object.assign(f, { governed: true, _ladderKey: 'smoke-test', _ladder: [{ name: 'a', fps: 60 }, { name: 'b', fps: 60 }, { name: 'c', fps: 60 }, { name: 'd', fps: 30 }], _ready: false });
        f._applyLevel(0); return f; };
      FluidFX._settled.delete('smoke-test');
      let f = make();
      for (let i = 0; i < 400; i++) f._govern(16.7);
      if (f._level !== 0) throw new Error('it stepped down at a steady 60 frames a second');
      for (let i = 0; i < 30; i++) f._govern(60);                 // a short stumble: under the count that matters
      for (let i = 0; i < 400; i++) f._govern(18);
      if (f._level !== 0) throw new Error('a short stumble took the quality down');
      f._govern(900);                                              // a pause (another window, a breakpoint)
      if (f._level !== 0) throw new Error('a pause took the quality down');
      let n = 0; for (; n < 400 && f._level === 0; n++) f._govern(34);
      if (f._level !== 1 || f.cfg.name !== 'b') throw new Error('30 frames a second did not take it down one level: at ' + f._level);
      if (n < 60 || n > 150) throw new Error('it took ' + n + ' slow frames to step down: it should be about two seconds of them');
      if (FluidFX._settled.get('smoke-test') !== 'b') throw new Error('where it settled was not kept for this run');
      for (let i = 0; i < 200 && f._level === 1; i++) f._govern(70);
      if (f._level !== 3) throw new Error('under 15 frames a second should take it down two levels at once: at ' + f._level);
      for (let i = 0; i < 400; i++) f._govern(200);
      if (f._level !== 3) throw new Error('it went past the last level');
      f = make(); f.governed = false;
      for (let i = 0; i < 400; i++) f._govern(60);
      if (f._level !== 0) throw new Error('a tier the user chose was stepped down');
      FluidFX._settled.delete('smoke-test');
    });

    // Found by a second reader of the code, before it shipped (v3.36.0).
    await step('a slow screen is not a slow machine: at 30 Hz nothing steps down', () => {
      const make = () => { const f = Object.create(FluidFX.prototype);
        Object.assign(f, { governed: true, _ladderKey: 'smoke-30', _ladder: [{ name: 'a', fps: 60 }, { name: 'b', fps: 60 }, { name: 'c', fps: 30 }], _ready: false });
        f._applyLevel(0); return f; };
      const wasMs = perf.refreshMs, md = { level: MD.level };
      try {
        FluidFX._settled.delete('smoke-30');
        perf.setRefresh(30);
        if (Math.abs(perf.refreshMs - 33.33) > 0.1) throw new Error('30 Hz is kept as ' + perf.refreshMs + ' ms');
        let f = make(); for (let i = 0; i < 900; i++) f._govern(33.4);
        if (f._level !== 0) throw new Error('on a 30 Hz screen the fluid stepped down to level ' + f._level + ' with every frame on time');
        for (let i = 0; i < 400 && f._level === 0; i++) f._govern(75);
        if (f._level === 0) throw new Error('on a 30 Hz screen 13 frames a second did not step it down');
        const v = Object.create(Visualizer.prototype); MD.level = 0;
        for (let i = 0; i < 900; i++) v._mdGovern(33.4);
        if (v._mdLevel() !== 0) throw new Error('on a 30 Hz screen MilkDrop went down a size with every frame on time');
        for (let i = 0; i < 400 && v._mdLevel() === 0; i++) v._mdGovern(75);
        if (v._mdLevel() === 0) throw new Error('on a 30 Hz screen 13 frames a second did not take MilkDrop down a size');
        // a rate that is no rate means "not known", and the usual 60 is assumed
        for (const bad of [0, -1, NaN, undefined, null, 5, 5000]) { perf.setRefresh(bad); if (perf.refreshMs !== 0) throw new Error('a refresh rate of ' + bad + ' was taken'); }
        FluidFX._settled.delete('smoke-30'); f = make(); for (let i = 0; i < 400 && f._level === 0; i++) f._govern(34);
        if (f._level === 0) throw new Error('with the screen not known, 30 frames a second no longer steps down');
      } finally { perf.refreshMs = wasMs; MD.level = md.level; FluidFX._settled.delete('smoke-30'); }
    });

    await step('a tier the user chose is taken as given, and a slider does not rebuild the fluid', () => {
      const was = { base: perf._base, chosen: perf.chosen, session: perf._session, custom: perf._customOverrides, kept: localStorage.getItem('bm_perf_quality_user'), ckept: localStorage.getItem('bm_perf_custom'), settled: FluidFX._settled.get('tier') };
      const make = () => { const f = Object.create(FluidFX.prototype); f._ready = false; return f; };
      try {
        perf._session = null; perf._base = 'high'; perf.chosen = false;
        FluidFX._settled.set('tier', 'low');                       // frames were slow once, and it settled on Low
        let f = make(); f.setQuality('high');
        if (f._tier !== 'low' || !f.governed || !f.lowered) throw new Error('a detected tier should start where this run settled: ' + JSON.stringify({ tier: f._tier, governed: f.governed, lowered: f.lowered }));
        perf.setTier('high');                                      // the user presses High in Fluid Settings
        f = make(); f.setQuality(perf.tier);
        if (f._tier !== 'high') throw new Error('the user chose High and the fluid is at ' + f._tier + ': what it settled on before overrode the choice');
        if (f.governed || f.lowered || FluidFX._settled.has('tier')) throw new Error('a chosen tier is still governed, or marked as stepped down');
        // the app's own listener: a change of tier sets the quality once, a slider not at all
        const calls = []; const real = app.auroraFX; app.auroraFX = { setQuality: t => calls.push(t) };
        try {
          perf.setTier('medium');
          if (calls.join() !== 'medium') throw new Error('pressing Medium set the quality ' + calls.length + ' times: ' + calls.join());
          for (let i = 0; i < 20; i++) { perf.setCustom('density', 100 + i); perf.setCustom('glow', 0.5 + i / 100); }
          perf.resetCustom();
          if (calls.length !== 1) throw new Error(`dragging a slider in Fluid Settings rebuilt the fluid ${calls.length - 1} times: it empties it each time`);
          perf.setTier('medium');                                  // the same tier again: nothing to do
          if (calls.length !== 1) throw new Error('pressing the tier it is already on rebuilt the fluid');
        } finally { app.auroraFX = real; }
      } finally {
        perf._base = was.base; perf.chosen = was.chosen; perf._session = was.session; perf._customOverrides = was.custom;
        if (was.kept === null) localStorage.removeItem('bm_perf_quality_user'); else localStorage.setItem('bm_perf_quality_user', was.kept);
        if (was.ckept === null) localStorage.removeItem('bm_perf_custom'); else localStorage.setItem('bm_perf_custom', was.ckept);
        if (was.settled) FluidFX._settled.set('tier', was.settled); else FluidFX._settled.delete('tier');
      }
    });

    await step('the fluid\'s canvas: pixel for pixel where a level says how many, and a resize is not a slow frame', () => {
      const wasDpr = window.devicePixelRatio, set = d => Object.defineProperty(window, 'devicePixelRatio', { value: d, configurable: true, writable: true });
      const make = (tier, cfg) => { const f = Object.create(FluidFX.prototype); let built = 0;
        Object.assign(f, { canvas: { clientWidth: 1366, clientHeight: 768, width: 0, height: 0 }, cfg, _tier: tier, _initFramebuffers() { built++; }, built: () => built }); return f; };
      try {
        set(2);
        let f = make('hd', { maxPixels: 3.7e6 }); f._resize(true);
        if (!(f.canvas.width > 2500) || f.canvas.width * f.canvas.height > 3.75e6) throw new Error(`at 200% the top level's canvas is ${f.canvas.width}x${f.canvas.height} for a 2732x1536 screen (it stopped at 2049 across)`);
        f = make('high', {}); f._resize(true);
        if (f.canvas.width !== 2049) throw new Error('a level with no cap of its own is no longer held to one and a half times: ' + f.canvas.width);
        f = make('low', { maxPixels: 2.1e6 }); f._resize(true);
        if (f.canvas.width !== 1366) throw new Error('the lightest level is drawn at ' + f.canvas.width + ' across, not the plain 1366');
        set(1.25); f = make('hd', { maxPixels: 3.7e6 }); f.canvas.clientWidth = 1536; f.canvas.clientHeight = 800; f._resize(true);
        if (f.canvas.width !== 1920 || f.canvas.height !== 1000) throw new Error(`at 125% a 1536x800 picture is ${f.canvas.width}x${f.canvas.height}`);
        // resized on every frame, as a window being dragged is: the frames in between are not counted as slow
        Object.assign(f, { governed: true, _ladderKey: 'smoke-drag', _ladder: [{ name: 'a', fps: 60 }, { name: 'b', fps: 60 }], _level: 0, _frameInterval: 16.7, _govN: 0, _govEma: 0, _govSkip: 0 });
        for (let i = 0; i < 400; i++) { f.canvas.clientWidth = 1200 + (i % 50); f._resize(); f._govern(60); }
        if (f._level !== 0) throw new Error('a window dragged to a new size for seven seconds stepped the quality down');
        FluidFX._settled.delete('smoke-drag');
      } finally { set(wasDpr); FluidFX._settled.delete('smoke-drag'); }
    });

    await step('HD Flow asks for dye pixel for pixel at its top level, and for lines and a glow', () => {
      const calls = [];
      const fluid = { mode: 'fluid', configure(fn) { fn(this); }, setFlow() {}, setMarkers() {}, setQuality() {},
        setNeon(on, exposure, o) { calls.push(['neon', on, exposure, o]); }, setBloom(v, o) { calls.push(['bloom', v, o]); }, setLadder(key, levels) { calls.push(['ladder', key, levels]); } };
      const c = window.document.createElement('canvas');
      const v = Object.create(Visualizer.prototype);
      Object.assign(v, { canvas: c, ctx: c.getContext('2d'), mode: 'flow', _fluid: fluid, _fluidCanvas: { style: {} }, opts: {} });
      v._drawFluid();
      const neon = calls.find(x => x[0] === 'neon'), bloom = calls.find(x => x[0] === 'bloom'), ladder = calls.find(x => x[0] === 'ladder');
      if (!neon || neon[1] !== true || !(neon[3].edge > 0)) throw new Error('no contour lines asked for');
      if (!bloom || !(bloom[1] > 0)) throw new Error('no glow asked for');
      if (!ladder || ladder[1] !== 'flow') throw new Error('no quality levels of its own');
      const L = ladder[2];
      if (L[0].dyeScale !== 1) throw new Error('the top level is not pixel for pixel: ' + L[0].dyeScale);
      for (let i = 1; i < L.length; i++) if (!(L[i].dyeScale < L[i - 1].dyeScale) || !(L[i].sim <= L[i - 1].sim)) throw new Error('level ' + L[i].name + ' is not lighter than ' + L[i - 1].name);
      if (typeof fluid.onFrame !== 'function') throw new Error('the music is not fed once per step of the fluid');
      if (!(FLOW.neon.width > 0 && FLOW.bloom.amount > 0)) throw new Error('the look has no line width or glow');
    });

    await step('a visualiser draws in the screen\'s own pixels, within a limit, and not on Low', () => {
      const v = Object.create(Visualizer.prototype), set = d => Object.defineProperty(window, 'devicePixelRatio', { value: d, configurable: true, writable: true });
      const was = window.devicePixelRatio;
      try {
        perf.setSessionTier('high');   // the machine running this may itself be a small one
        v.canvas = { offsetWidth: 1536, offsetHeight: 800 };
        set(1.25); if (Math.abs(v._scale() - 1.25) > 1e-9) throw new Error('at 125% it draws at ' + v._scale() + ' of the CSS size, not 1.25');
        set(1);    if (v._scale() !== 1) throw new Error('at 100% it draws at ' + v._scale());
        set(3);    if (v._scale() > 2) throw new Error('more than twice the CSS size: ' + v._scale());
        v.canvas = { offsetWidth: 1920, offsetHeight: 1080 };
        set(2);    if (v._scale() * v._scale() * 1920 * 1080 > 3.75e6) throw new Error('a 4K screen is drawn at ' + Math.round(v._scale() * v._scale() * 1920 * 1080) + ' pixels');
        perf.setSessionTier('low'); v.canvas = { offsetWidth: 1536, offsetHeight: 800 }; set(1.25);
        if (v._scale() !== 1) throw new Error('on Low it draws at ' + v._scale());
      } finally { perf.setSessionTier(null); set(was); }
    });

    await step('a visualiser that is not on screen draws nothing, and its fluid waits', () => {
      const c = window.document.createElement('canvas'); window.document.body.appendChild(c);
      const v = new Visualizer(c); let drawn = 0, paused = 0, resumed = 0;
      v._draw = () => { drawn++; }; v._fluid = { pause() { paused++; }, resume() { resumed++; }, halt() {} };
      const realRaf = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => 0;
      try {
        v.active = true; v._lastDraw = -1e9; v._loop();
        if (drawn !== 0) throw new Error('it drew with no size on screen (a hidden view)');
        if (paused !== 1) throw new Error('its fluid was not paused');
        Object.defineProperty(c, 'offsetWidth', { value: 640, configurable: true });
        v._lastDraw = -1e9; v._loop();
        if (drawn !== 1) throw new Error('it did not draw once it was on screen again');
        if (resumed !== 1) throw new Error('its fluid was not resumed');
      } finally { globalThis.requestAnimationFrame = realRaf; v.active = false; v._fluid = null; c.remove(); }
    });

    await step('under the fluid and MilkDrop the 2D canvas is emptied once, not every frame', () => {
      let clears = 0; const c = window.document.createElement('canvas');
      const v = Object.create(Visualizer.prototype);
      Object.assign(v, { canvas: c, ctx: { clearRect() { clears++; } } });
      v._wipe(); v._wipe(); v._wipe();
      if (clears !== 1) throw new Error(clears + ' clears for three frames');
      v._inked = true; v._wipe();
      if (clears !== 2) throw new Error('not emptied again after a 2D style drew');
    });

    await step('Wave fills the picture for quiet and loud music alike, and never leaves it', () => {
      const c = window.document.createElement('canvas'); window.document.body.appendChild(c);
      const v = new Visualizer(c); c.width = 1000; c.height = 600;
      const ys = [], rec = new Proxy({}, { get: (_, p) => {
        if (p === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (p === 'moveTo' || p === 'lineTo') return (x, y) => { ys.push(y); };
        if (p === 'quadraticCurveTo') return (a, b, x, y) => { ys.push(b, y); };
        return () => undefined; }, set: () => true });
      v.ctx = rec;
      const realNow = Object.getOwnPropertyDescriptor(performance, 'now'); let t = 5000;
      Object.defineProperty(performance, 'now', { value: () => t, configurable: true, writable: true });
      const height = amp => {
        v._waveLvl = undefined; v._waveT = undefined;
        v.analyser = { fftSize: 1024, frequencyBinCount: 512, smoothingTimeConstant: 0.8,
          getFloatTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin(i / 1024 * Math.PI * 2 * 5); },
          getByteTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = 128 + 127 * amp * Math.sin(i / 1024 * Math.PI * 2 * 5); },
          getByteFrequencyData(a) { a.fill(90); } };
        for (let i = 0; i < 120; i++) { t += 16.7; ys.length = 0; v._drawWave(); }
        let m = 0; for (const y of ys) if (y !== 300 && Math.abs(y - 300) > m) m = Math.abs(y - 300);
        return m;
      };
      try {
        const quiet = height(0.03), loud = height(0.9), silent = height(0);
        if (!(quiet > 600 * 0.15)) throw new Error('quiet music draws a wave ' + quiet.toFixed(0) + ' px high in a 600 px picture');
        if (!(loud > 600 * 0.15)) throw new Error('loud music draws a wave ' + loud.toFixed(0) + ' px high');
        if (quiet > 300 || loud > 300) throw new Error('the wave leaves the picture: ' + Math.max(quiet, loud).toFixed(0) + ' px from the middle');
        if (silent > 8) throw new Error('silence is not a flat line (but for the echo\'s ripple): ' + silent.toFixed(1) + ' px');
        v.analyser = { fftSize: 1024, frequencyBinCount: 512, getByteTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = 128 + 60 * Math.sin(i / 20); }, getByteFrequencyData(a) { a.fill(90); } };
        const f = v._getTimeF();
        if (!(f instanceof Float32Array) || Math.abs(f[10] - (Math.round(128 + 60 * Math.sin(10 / 20)) - 128) / 128) > 0.02) throw new Error('an analyser without float data is not read through its bytes');
      } finally { if (realNow) Object.defineProperty(performance, 'now', realNow); else delete performance.now; v.analyser = null; c.remove(); }
    });

    await step('MilkDrop is drawn in the screen\'s own pixels, steps down when slow, and deals every preset once', () => {
      const was = { level: MD.level, set: MD.set, dpr: window.devicePixelRatio };
      const setDpr = d => Object.defineProperty(window, 'devicePixelRatio', { value: d, configurable: true, writable: true });
      try {
        const v = Object.create(Visualizer.prototype);
        v.canvas = { offsetWidth: 1536, offsetHeight: 800 }; setDpr(1.25); MD.level = 0;
        let [w, h] = v._mdSize();
        if (w !== 1920 || h !== 1000) throw new Error(`a 1536 by 800 picture at 125% is drawn at ${w} by ${h}, not 1920 by 1000 (it was 1152 across)`);
        v.canvas = { offsetWidth: 1920, offsetHeight: 1080 }; setDpr(2); [w, h] = v._mdSize();
        if (w * h > 2.35e6) throw new Error('a 4K screen is drawn at ' + w * h + ' pixels');
        v.canvas = { offsetWidth: 1536, offsetHeight: 800 }; setDpr(1.25);
        // slow frames take this preset down a size, a new preset's first frames and a pause do not
        for (let i = 0; i < 300; i++) v._mdGovern(16.7);
        if (v._mdLevel() !== 0) throw new Error('it stepped down at 60 frames a second');
        v._mdSkip = 30; for (let i = 0; i < 30; i++) v._mdGovern(120);
        v._mdGovern(2000);
        for (let i = 0; i < 300; i++) v._mdGovern(17);
        if (v._mdLevel() !== 0) throw new Error('a new preset building its shaders, or a pause, took it down a size');
        for (let i = 0; i < 300 && v._mdLevel() === 0; i++) v._mdGovern(36);
        if (v._mdLevel() !== 1 || MD.level !== 0) throw new Error('28 frames a second should take this preset down a size and leave the machine\'s own alone: preset ' + v._mdLevel() + ', machine ' + MD.level);
        if (!(v._mdSize()[0] < 1920)) throw new Error('a size down is not smaller');
        v._mdDown = MD_SCALES.length - 1; for (let i = 0; i < 300; i++) v._mdGovern(80);
        if (v._mdLevel() !== MD_SCALES.length - 1) throw new Error('it went past the smallest size');
        // every preset once, in a new order, before any comes round again
        const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        Object.assign(v, { _md: { loadPreset() {} }, _mdNames: names, _mdPresets: Object.fromEntries(names.map(n => [n, () => ({})])), _mdBag: null, _mdName: null, _mdDown: 0 });
        // the next preset starts from the machine's own size again, and one slow preset does not change that
        v.mdNext(0); v._mdDown = 1; v.mdNext(0);
        if (v._mdLevel() !== 0 || MD.level !== 0) throw new Error('one slow preset made the next one smaller');
        if (!(v._mdSkip >= 30)) throw new Error('a new preset\'s first frames are counted');
        // three slow presets running: it is the machine, and its own size goes down
        v._mdDown = 1; v.mdNext(0); v._mdDown = 1; v.mdNext(0); v._mdDown = 1; v.mdNext(0);
        if (MD.level !== 1) throw new Error('three slow presets running did not take the machine\'s own size down: ' + MD.level);
        v.mdNext(0); v.mdNext(0);
        if (MD.level !== 1) throw new Error('it went down again with nothing slow');
        // a new preset's first frames are still not counted when its size changes on the first of them
        Object.assign(v, { _mdCanvas: { style: {}, width: 0, height: 0 }, ctx: { clearRect() {} }, _mdDown: 0, _mdW: 0, _mdH: 0, opts: { mdAuto: 0 }, analyser: null, _tick: 0, _synthValues: new Float32Array(128), _mdLast: 0 });
        v._md.setRendererSize = () => {}; v._md.render = () => {};
        const root = window.document.documentElement.classList, lite = root.contains('lite-mode'); root.remove('lite-mode');   // Lite draws bars in its place
        try {
          v.mdNext(2.5); const skip = v._mdSkip; v._drawMilk();
          if (!(v._mdW > 0)) throw new Error('MilkDrop was not drawn: its size is ' + v._mdW);
          if (!(skip >= 150) || v._mdSkip < skip - 1) throw new Error(`a new preset waits ${skip} frames before it is judged, and a change of size on its first frame cut that to ${v._mdSkip}`);
        } finally { if (lite) root.add('lite-mode'); }
        MD.level = 0; MD.streak = 0; v._mdBag = null; v._mdName = null;
        const seen = []; for (let i = 0; i < names.length * 6; i++) seen.push(v.mdNext(0));
        for (let r = 0; r < 6; r++) { const round = seen.slice(r * names.length, (r + 1) * names.length); if (new Set(round).size !== names.length) throw new Error('round ' + (r + 1) + ' repeated a preset: ' + round.join('')); }
        for (let i = 1; i < seen.length; i++) if (seen[i] === seen[i - 1]) throw new Error('the same preset twice running');
      } finally { MD.level = was.level; MD.set = was.set; MD.streak = 0; setDpr(was.dpr); }
    });

    await step('the drawn styles have their colours and survive a frame', () => {
      const hues = [0, 1, 2, 3, 4].map(i => art.tone({ opts: { colors: 'auto' } }, i, 5, 0.5, 'flow')[0]);
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) { const d = Math.abs(hues[i] - hues[j]) % 360, gap = Math.min(d, 360 - d); if (gap < 30) throw new Error(`HD Flow's emitters ${i} and ${j} are ${gap} degrees apart: they would look the same`); }
      const b = art.bands(new Uint8Array(64).fill(128));
      if (b.length !== 5 || b.some(x => Math.abs(x - 128 / 255) > 0.01)) throw new Error('the five parts of the sound are read wrongly: ' + b.join(' '));
      const c = window.document.createElement('canvas'); window.document.body.appendChild(c);
      const v = new Visualizer(c);
      // on a clock that moves a sixtieth of a second a frame: the styles go by the clock, and frames drawn in one millisecond would make next to nothing
      const realNow = Object.getOwnPropertyDescriptor(performance, 'now'); let t = 9000;
      Object.defineProperty(performance, 'now', { value: () => t, configurable: true, writable: true });
      try {
        v.analyser = { fftSize: 1024, frequencyBinCount: 512, getByteTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = 128 + 90 * Math.sin(i / 7); }, getByteFrequencyData(a) { a.fill(170); } };
        for (const mode of ['bars', 'radial', 'wave', 'particles', 'neon', 'bubbles']) { v.mode = mode; for (let i = 0; i < 30; i++) { t += 16.7; v._tick++; v._draw(); } }
        if (!(v._pt?.made > 0)) throw new Error('Particles made nothing with music');
        if (!(v._neon?.made > 0) || v._neon?.em?.length !== 5) throw new Error('Neon made nothing with music');
        if (!(v._bub?.made > 0)) throw new Error('Bubbles made nothing with music');
        // with the music stopped (a flat waveform) nothing new is made
        v.analyser = { fftSize: 1024, frequencyBinCount: 512, getByteTimeDomainData(a) { a.fill(128); }, getByteFrequencyData(a) { a.fill(170); } };
        const made = [v._pt.made, v._neon.made, v._bub.made];
        for (const mode of ['particles', 'neon', 'bubbles']) { v.mode = mode; for (let i = 0; i < 30; i++) { t += 16.7; v._tick++; v._draw(); } }
        if (v._pt.made !== made[0] || v._neon.made !== made[1] || v._bub.made !== made[2]) throw new Error('something was made with the music stopped');
      } finally { if (realNow) Object.defineProperty(performance, 'now', realNow); else delete performance.now; v.analyser = null; c.remove(); }
    });

    await step('the loud end of the scale: a drum shows above the bass line, and quieter sound is drawn as it was', () => {
      const c = window.document.createElement('canvas'); window.document.body.appendChild(c);
      const v = new Visualizer(c);
      try {
        // an analyser as the browser's: what it reads in decibels, turned into bytes over the window it is set to
        let db = -50;
        const an = { fftSize: 1024, frequencyBinCount: 512, smoothingTimeConstant: 0.8, minDecibels: -100, maxDecibels: -30,
          getByteTimeDomainData(a) { a.fill(128); },
          getByteFrequencyData(a) { const r = this.maxDecibels - this.minDecibels; a.fill(Math.max(0, Math.min(255, Math.floor(255 / r * (db - this.minDecibels))))); } };
        v.analyser = an;
        const bar = d => { db = d; return v._getFreq()[3]; };
        const quiet = bar(-50), line = bar(-28), drum = bar(-18), full = bar(-10), over = bar(-2);
        if (an.maxDecibels !== -10) throw new Error('the analyser still stops at ' + an.maxDecibels + ' decibels: louder than that is all "full"');
        if (Math.abs(quiet - Math.floor(255 * 50 / 70)) > 2) throw new Error(`sound at -50 decibels is drawn at ${quiet} of 255, and was ${Math.floor(255 * 50 / 70)}: the styles were made for that`);
        if (!(line < 250 && drum >= line + 12 && drum < 255)) throw new Error(`a bass line at -28 decibels is drawn at ${line} and a drum at -18 at ${drum}: the drum should stand clear of it, and neither at the top`);
        if (full < 250 || over !== 255) throw new Error(`full scale is drawn at ${full} and louder still at ${over}`);
        const steps = [-60, -50, -45, -40, -35, -30, -25, -20, -15, -10].map(bar);
        for (let i = 1; i < steps.length; i++) if (!(steps[i] > steps[i - 1])) throw new Error('louder is not drawn higher: ' + steps.join(' '));
        // sensitivity still scales it, and an analyser that cannot be told is read as it comes
        v.opts.sensitivity = 0.5; if (Math.abs(bar(-50) - quiet / 2) > 2) throw new Error('half the sensitivity is not half the height');
        v.opts.sensitivity = 1;
        v.analyser = { fftSize: 1024, frequencyBinCount: 512, getByteTimeDomainData(a) { a.fill(128); }, getByteFrequencyData(a) { a.fill(230); } };
        if (v._getFreq()[3] !== 230) throw new Error('an analyser with no decibel window was rescaled: ' + v._getFreq()[3]);
      } finally { v.analyser = null; c.remove(); }
    });

    // The beat (viz-beat.js), on made-up music. The styles used to ask whether the
    // bass's level was a fifth above its average, and on the test track that
    // found 6 beats in 24 seconds, none of them where everything plays.
    const { BeatTracker } = await import(url('viz-beat.js'));
    const { synthTrack } = await import(pathToFileURL(path.join(ROOT, 'scripts/viz-preview.mjs')).href);
    const RATE = 48000, BEAT = 60 / 124;
    // The tracker run over a piece, called `fps` times a second, as the
    // visualiser calls it: each beat as [seconds, how hard]. The sound comes
    // the way a real analyser gets it, in batches: blocks of 128 samples,
    // enough of them at once every 10 ms to cover the 480 the sound card asks
    // for. A first version of the tracker was only tried on sound that ended
    // exactly on the clock, and counted nine beats in a steady hum once it met
    // a batch. `smooth` gives that kinder feed, for comparison.
    const hear = (data, fps, to, tracker = new BeatTracker(), from = 0, smooth = false) => {
      const win = new Float32Array(1024), out = [];
      for (let t = from; t < to; t += 1 / fps) {
        const end = smooth ? Math.floor(t * RATE) : Math.ceil(480 * (Math.floor(t / 0.01) + 1) / 128) * 128;
        for (let i = 0; i < 1024; i++) { const k = end - 1024 + i; win[i] = k < 0 || k >= data.length ? 0 : data[k]; }
        if (tracker.update(win, RATE, t * 1000)) out.push([t, tracker.strength]);
      }
      return out;
    };
    const tone = (seconds, fn) => { const d = new Float32Array(Math.floor(seconds * RATE)); for (let i = 0; i < d.length; i++) d[i] = fn(i / RATE, i); return d; };
    const TAU2 = Math.PI * 2;
    let seedB = 5; const noise = () => ((seedB = (seedB * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

    await step('a beat is found where the drum hits, however many frames a second are drawn', () => {
      const track = synthTrack(24, RATE).samples;                 // a drum on every beat from 4 s to 20 s
      const hits = []; for (let b = 0; b * BEAT < 20; b++) if (b * BEAT >= 8.5) hits.push(b * BEAT);
      for (const smooth of [false, true]) for (const fps of [30, 60, 72, 75, 120, 144]) {
        const beats = hear(track, fps, 20, new BeatTracker(), 0, smooth).filter(([t]) => t >= 8.4);
        const found = hits.filter(h => beats.some(([t]) => t >= h - 0.03 && t <= h + 0.12)).length;
        const extra = beats.filter(([t]) => !hits.some(h => t >= h - 0.03 && t <= h + 0.12)).length;
        if (found < hits.length - 2) throw new Error(`called ${fps} times a second it found ${found} of ${hits.length} drum hits`);
        if (extra > 3) throw new Error(`called ${fps} times a second it reported ${extra} beats where there is no drum`);
      }
      // dense and loud, as most records are: the same drums under noise and a held bass, driven hard
      let b0 = 0, b1 = 0;
      const loud = tone(12, (t, i) => { const w = noise(); b0 = 0.997 * b0 + w * 0.1; b1 = 0.96 * b1 + w * 0.3; const bt = t % BEAT;
        return Math.tanh((track[12 * RATE + (i % (8 * RATE))] * 2.6 + (b0 + b1) * 0.12 + Math.sin(TAU2 * 52 * t) * 0.35 * Math.exp(-3 * bt)) * 1.5) * 0.95; });
      for (const fps of [60, 72, 144]) {
        const lb = hear(loud, fps, 12).filter(([t]) => t >= 2);
        if (lb.length < 16 || lb.length > 27) throw new Error(`dense, loud music with a drum 21 times in ten seconds: ${lb.length} beats found at ${fps} calls a second`);
        const hard = lb.map(x => x[1]).sort((a, b) => a - b)[lb.length >> 1];
        if (!(hard >= 0.6)) throw new Error('in dense, loud music a usual drum hit counts for ' + hard.toFixed(2) + ' of a full one: it should count as one does in a sparse piece');
      }
    });

    await step('a held note, a hum, a chord, hiss and silence are not beats', () => {
      const held = (seconds, fn) => tone(seconds, t => fn(t) * Math.min(1, t * 2));
      const hum = held(10, t => (0.3 * Math.sin(TAU2 * 60 * t) + 0.15 * Math.sin(TAU2 * 120 * t)) * (1 + 0.1 * Math.sin(TAU2 * 0.2 * t)));
      const low = held(8, t => 0.5 * Math.sin(TAU2 * 41 * t));                                                   // a 41 Hz note: its own swing, 82 times a second, is not a beat
      const saw = held(10, t => { let x = 0; for (let k = 1; k <= 12; k++) x += Math.sin(TAU2 * 41 * k * t) / k; return 0.3 * x; });   // the same note as a bass plays it
      const fifth = held(12, t => 0.3 * (Math.sin(TAU2 * 65.41 * t) + Math.sin(TAU2 * 98 * t)));                 // two low notes a fifth apart: together they swell 33 times a second
      const triad = held(12, t => 0.22 * (Math.sin(TAU2 * 110 * t) + Math.sin(TAU2 * 130.81 * t) + Math.sin(TAU2 * 164.81 * t)));
      const hiss = tone(6, () => 0.003 * noise());
      const swell = tone(8, t => t < 0.5 ? 0 : 0.4 * (Math.sin(TAU2 * 55 * t) + 0.5 * Math.sin(TAU2 * 220 * t)) * Math.min(1, (t - 0.5) / 3));
      for (const fps of [60, 72, 75, 120, 144]) {
        const n = (d, to, from) => hear(d, fps, to).filter(([t]) => t >= from).length;
        for (const [what, d, to, from, most] of [['a steady hum', hum, 10, 1.5, 0], ['a held 41 Hz note', low, 8, 1, 0], ['a held bass note', saw, 10, 1.5, 0],
          ['two held notes a fifth apart', fifth, 12, 1, 2], ['a held chord', triad, 12, 1, 3], ['hiss', hiss, 6, 0, 0], ['silence', new Float32Array(RATE * 3), 3, 0, 0], ['a sound swelling in over three seconds', swell, 8, 0, 1]]) {
          const got = n(d, to, from);
          if (got > most) throw new Error(`${what} gave ${got} beats at ${fps} calls a second${most ? ' (' + most + ' at the most)' : ''}`);
        }
      }
      // With few frames a second there are holes between the pieces: still none in one held note.
      if (hear(hum, 30, 10).filter(([t]) => t >= 1.5).length || hear(low, 30, 8).filter(([t]) => t >= 1).length) throw new Error('a held note gave beats at 30 calls a second');
      // How hard a beat was dies away in a moment.
      const bt = new BeatTracker(), one = tone(3, t => t >= 1 && t < 1.3 ? 0.8 * Math.sin(TAU2 * 60 * (t - 1)) * Math.exp(-7 * (t - 1)) : 0);
      const got = hear(one, 60, 1.1, bt);
      if (got.length !== 1 || !(bt.punch > 0.25)) throw new Error('one drum hit: ' + got.length + ' beats, punch ' + bt.punch.toFixed(2));
      hear(one, 60, 3, bt, 1.1);
      if (bt.n !== 1 || !(bt.punch < 0.05)) throw new Error(`two seconds after one hit: ${bt.n} beats, punch ${bt.punch.toFixed(2)}`);
      // Coming back to sound that is already playing (the visual mode opened in the
      // middle of a song, a stall of a second) is not a beat.
      for (const fps of [60, 72, 144]) {
        const b2 = new BeatTracker(); hear(hum, fps, 3, b2); const before = b2.n;
        hear(hum, fps, 6, b2, 4.2);
        if (b2.n !== before) throw new Error(`picking a steady sound up again after a pause gave ${b2.n - before} beats at ${fps} calls a second`);
      }
      // The same piece handed over twice, and nothing at all, are taken in its stride.
      const b3 = new BeatTracker(), w = new Float32Array(1024).fill(0.2);
      for (let k = 0; k < 50; k++) { b3.update(w, RATE, 1000 + k * 7); b3.update(w, RATE, 1000 + k * 7); b3.update(null, 0, 1000 + k * 7 + 3); }
      if (b3.n || !Number.isFinite(b3.punch) || !Number.isFinite(b3._slow) || b3._hist.length > 200) throw new Error('the same piece twice, or none: ' + JSON.stringify({ n: b3.n, punch: b3.punch, slow: b3._slow, hist: b3._hist.length }));
    });

    await step('the styles answer the beat: sparks, a burst, a dash, a puff', () => {
      const c = window.document.createElement('canvas'); window.document.body.appendChild(c);
      const v = new Visualizer(c); c.width = 1280; c.height = 720;
      // a drum every half second over a held bass note, from the second second on
      const music = tone(8, t => { const bt = t % 0.5; return 0.12 * Math.sin(2 * Math.PI * 55 * t) + (t >= 1 ? 0.8 * Math.sin(2 * Math.PI * (45 * bt + 3.9 * (1 - Math.exp(-28 * bt)))) * Math.exp(-7 * bt) : 0); });
      const realNow = Object.getOwnPropertyDescriptor(performance, 'now'); let t = 0;
      Object.defineProperty(performance, 'now', { value: () => 20000 + t * 1000, configurable: true, writable: true });
      const at = (a, scale, off) => { const end = Math.floor(t * RATE); for (let i = 0; i < a.length; i++) { const k = end - a.length + i; a[i] = off + scale * (k < 0 || k >= music.length ? 0 : music[k]); } };
      v.analyser = { fftSize: 1024, frequencyBinCount: 512, context: { sampleRate: RATE }, getFloatTimeDomainData(a) { at(a, 1, 0); }, getByteTimeDomainData(a) { at(a, 127, 128); }, getByteFrequencyData(a) { a.fill(150); a[0] = a[1] = a[2] = a[3] = 250; } };
      try {
        const frame = () => { t += 1 / 60; v._tick++; v._hear(20000 + t * 1000); };
        // Neon: no sparks before the first drum, some after it
        v.mode = 'neon'; while (t < 0.9) { frame(); v._draw(); }
        if (v.beat.n > 1) throw new Error(v.beat.n + ' beats in a held note');
        const before = v._neon.sparks.length; while (t < 1.2) { frame(); v._draw(); }
        if (before !== 0 || !(v._neon.sparks.length > 0)) throw new Error(`Neon: ${before} sparks before the first drum, ${v._neon.sparks.length} after it`);
        // Particles: more are made in the tenth of a second after a drum than in the one before the next
        v.mode = 'particles'; while (t < 2.0) { frame(); v._draw(); }
        const count = to => { const m0 = v._pt.made; while (t < to) { frame(); v._draw(); } return v._pt.made - m0; };
        const burst = count(2.1), lull = (count(2.38), count(2.48));
        if (!(burst > lull * 1.6)) throw new Error(`Particles made ${burst} in the tenth of a second after a drum and ${lull} just before the next: no burst`);
        // HD Flow: the emitters dash and the glow swells on the beat, and fall back after it
        const glow = []; let pushes = 0;
        const fluid = { canvas: { width: 1280, height: 720 }, velocity: { height: 256 }, splat(x, y, dx, dy, col) { if (!col && (dx || dy)) pushes++; }, setMarkers() {}, setBloom(a) { glow.push(a); } };
        v._fluid = fluid; v.mode = 'flow'; v._fw = null;
        while (t < 2.52) { frame(); v._feedFlow(1 / 60, 20000 + t * 1000); }      // the drum at 2.5 has just landed
        const kick = v._fw.kick, top = Math.max(...glow.slice(-4));
        while (t < 2.95) { frame(); v._feedFlow(1 / 60, 20000 + t * 1000); }
        if (!(kick > 0.25)) throw new Error('HD Flow: no dash on the drum (kick ' + kick.toFixed(2) + ')');
        if (!(v._fw.kick < kick * 0.3)) throw new Error('HD Flow: the dash did not die away');
        if (!(top > FLOW.bloom.amount * 1.1) || !(glow[glow.length - 1] < FLOW.bloom.amount * 1.1)) throw new Error(`HD Flow: the glow was ${top.toFixed(2)} on the drum and ${glow[glow.length - 1].toFixed(2)} before the next, around ${FLOW.bloom.amount}`);
        if (top > FLOW.bloom.amount * 1.8) throw new Error('HD Flow: the glow nearly doubles on a beat: that is a flash, not a swell');
        if (!(pushes > 0)) throw new Error('HD Flow: no push on the beat');
        // Smoke: the bass's plume carries more smoke on the drum than between two
        const dye = []; fluid.splat = (x, y, dx, dy, col) => { if (col && x < 0.3) dye.push(col[0] + col[1] + col[2]); };
        v.mode = 'fluid'; v._fl = null;
        while (t < 3.03) { frame(); v._feedFluid(1 / 60, 20000 + t * 1000); }
        const on = dye[dye.length - 1]; while (t < 3.45) { frame(); v._feedFluid(1 / 60, 20000 + t * 1000); }
        if (!(on > dye[dye.length - 1] * 1.15)) throw new Error(`Smoke: the bass's plume had ${on.toFixed(3)} of smoke on the drum and ${dye[dye.length - 1].toFixed(3)} between two`);
      } finally { if (realNow) Object.defineProperty(performance, 'now', realNow); else delete performance.now; v.analyser = null; v._fluid = null; c.remove(); }
    });
  }

  await step('no test navigated to a destination that does not exist', () => {
    const bad = (globalThis.__bmWarnings || []).filter(w => /unknown destination/.test(w));
    if (bad.length) throw new Error(bad.length + ' call(s): ' + bad.slice(0, 3).join(' | '));
  });

  if (errs.length) {
    console.log('\n  \x1b[33mruntime errors captured during boot:\x1b[0m');
    errs.slice(0, 6).forEach(e => console.log('      ' + String(e && e.stack || e).split('\n')[0]));
  }
  report();
}

function report() {
  const bad = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed.\n`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
