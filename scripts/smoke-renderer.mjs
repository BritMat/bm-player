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
    constructor(v) { this.value = v; }
    setTargetAtTime(v) { this.value = v; }
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
    // source -> 10 filters -> gain -> analyser -> destination
    const chain = window.__audioConnections.map(c => c.join('>'));
    if (!chain.includes('gain>analyser')) throw new Error('gain is not feeding the analyser: ' + chain.join(', '));
    if (!chain.includes('analyser>destination')) throw new Error('analyser is not reaching the output');
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

  await step('volume above 100 uses the gain node, not element volume', () => {
    const eng = new AudioEngine();
    eng.setVolume(80);
    if (eng.el.volume !== 0.8 || eng.gain.gain.value !== 1) throw new Error('80% wrong');
    eng.setVolume(130);
    if (eng.el.volume !== 1) throw new Error('element volume should cap at 1');
    if (eng.gain.gain.value !== 1.3) throw new Error('gain node should carry the boost, got ' + eng.gain.gain.value);
    eng.setVolume(-5);
    if (eng.el.volume !== 0) throw new Error('negative volume not clamped');
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
