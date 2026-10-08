#!/usr/bin/env node
'use strict';
/**
 * BM Player — main-process smoke test
 *
 * main.js has never been executed outside Electron. It owns window creation,
 * every IPC handler, the mpv socket and the plugin scanner — and a throw
 * anywhere in `registerIpc()` silently unregisters every handler declared
 * after it, which is exactly the failure mode that made "Open Folder does
 * nothing" so hard to pin down.
 *
 * This loads main.js against a stubbed `electron` module, drives the
 * whenReady path, and then calls the real IPC handlers against real
 * temporary files.
 *
 * Run with: npm run test:main
 */

const Module = require('module');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

const ROOT = path.join(__dirname, '..');
const results = [];
const pass = n => { results.push(true);  console.log('  \x1b[32m✓\x1b[0m ' + n); };
const fail = (n, e) => {
  results.push(false);
  console.log('  \x1b[31m✗\x1b[0m ' + n);
  if (e) console.log('      ' + String(e.stack || e.message || e).split('\n').slice(0, 3).join('\n      '));
};
const step = async (n, fn) => { try { await fn(); pass(n); } catch (e) { fail(n, e); } };

/* ── recording electron stub ─────────────────────────────────────── */
const rec = {
  handlers: new Map(),      // ipcMain.handle
  dialogs: [],              // arguments of every showOpenDialog/showSaveDialog
  topAtDialog: [],          // how many windows were always-on-top as each dialog opened
  external: [],             // addresses handed to shell.openExternal
  boxes: [], boxAnswer: 0,  // message boxes shown, and which button the fake user presses
  listeners: new Map(),     // ipcMain.on
  switches: [],
  whenReady: null,
  windows: [],
  sent: [],
  schemes: null,
  spawned: [],
  protocols: new Map(),
};

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bmplayer-smoke-'));
const PRIMARY = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, workAreaSize: { width: 1920, height: 1040 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, displayFrequency: 143.98 };
const SECOND  = { id: 2, workArea: { x: 1920, y: 0, width: 2560, height: 1400 }, workAreaSize: { width: 2560, height: 1400 }, bounds: { x: 1920, y: 0, width: 2560, height: 1440 }, scaleFactor: 1 };
let DISPLAYS = [PRIMARY, SECOND];

class FakeWebContents {
  constructor() { this.session = { webRequest: { onHeadersReceived: () => {} } }; }
  send(ch, data) { rec.sent.push([ch, data]); }
  on() {} once() {} setWindowOpenHandler() {} openDevTools() {} closeDevTools() {}
  isDevToolsOpened() { return false; }
}
class FakeBrowserWindow {
  constructor(opts = {}) {
    this.opts = opts;
    // Electron clamps setBounds to the minimum size. Not modelling that let
    // a 900x560 minimum silently defeat PiP in the real app while this
    // stub reported success.
    this.minSize = [opts.minWidth || 0, opts.minHeight || 0];
    this.webContents = new FakeWebContents();
    this._events = new Map();
    rec.windows.push(this);
  }
  // Every listener, as in Electron (v3.37.0). It kept only the last one for an
  // event, so a second listener silently replaced the first in these tests.
  on(e, cb) { if (!this._events.has(e)) this._events.set(e, []); this._events.get(e).push(cb); return this; }
  once(e, cb) { return this.on(e, cb); }
  emit(e, ...a) { for (const cb of [...(this._events.get(e) || [])]) cb(...a); }
  loadFile(f, opts) { this.loaded = { file: f, opts: opts || {} }; return Promise.resolve(); }
  loadURL() { return Promise.resolve(); }
  show() { this.visible = true; } hide() { this.visible = false; }
  focus() {} blur() {} minimize() {} maximize() {} unmaximize() {} restore() {} close() {} destroy() {}
  isMinimized() { return false; } isMaximized() { return !!this._max; }
  isDestroyed() { return false; } isVisible() { return !!this.visible; }
  isFullScreen() { return !!this._fs; } setFullScreen(v) { this._fs = !!v; }
  // Distinct per window, so a test can tell which one mpv was handed.
  getNativeWindowHandle() { const b = Buffer.alloc(8); b.writeInt32LE(1000 + rec.windows.indexOf(this), 0); return b; }
  setMaximizable(v) { this.maximizable = !!v; }
  maximize() { this._max = true; } unmaximize() { this._max = false; }
  setBounds(b) {
    const cur = this._bounds || { x: 0, y: 0, width: 1280, height: 780 };
    const n = { ...cur, ...b };
    n.width = Math.max(n.width, this.minSize[0]); n.height = Math.max(n.height, this.minSize[1]);
    this._bounds = n;
  } getBounds() { return this._bounds || { x: 0, y: 0, width: 1280, height: 780 }; }
  // Frameless windows: the content is the whole window. main.js aligns the
  // picture window by content bounds (v3.26.1).
  getContentBounds() { return { ...this.getBounds() }; }
  setContentBounds(b) { this.setBounds(b); }
  setMinimumSize(w, h) { this.minSize = [w, h]; } setAspectRatio(r) { this.aspect = r; }
  setResizable() {} setSkipTaskbar(v) { this.skipTaskbar = !!v; }
  setAlwaysOnTop(v) { this.onTop = !!v; } isAlwaysOnTop() { return !!this.onTop; } setIgnoreMouseEvents() {} setMenuBarVisibility() {}
  moveTop() {}
  setOpacity() {} setBackgroundColor() {} setTitle() {} setParentWindow() {}
  static getAllWindows() { return rec.windows; }
  static fromWebContents() { return rec.windows[0]; }
}

const electronStub = {
  app: {
    commandLine: { appendSwitch: (...a) => rec.switches.push(a) },
    whenReady: () => ({ then: cb => { rec.whenReady = cb; return { catch: () => {} }; } }),
    on: () => {}, once: () => {}, quit: () => {}, exit: () => {},
    getPath: name => { const d = path.join(TMP, name); fs.mkdirSync(d, { recursive: true }); return d; },
    getVersion: () => '2.8.0',
    getName: () => 'BM Player',
    getAppPath: () => ROOT,
    setAsDefaultProtocolClient: () => true,
    isDefaultProtocolClient: () => false,
    setUserTasks: () => {}, addRecentDocument: () => {},
    requestSingleInstanceLock: () => true,
    isPackaged: false,
    setLoginItemSettings: () => {},
  },
  BrowserWindow: FakeBrowserWindow,
  // A native window with no web page: what the picture window now is.
  BaseWindow: class FakeBaseWindow extends FakeBrowserWindow {
    constructor(opts) { super(opts); delete this.webContents; this.loadFile = this.loadURL = undefined; }
  },
  ipcMain: {
    handle: (ch, fn) => {
      if (rec.handlers.has(ch)) throw new Error(`duplicate ipcMain.handle('${ch}')`);
      rec.handlers.set(ch, fn);
    },
    handleOnce: (ch, fn) => rec.handlers.set(ch, fn),
    on: (ch, fn) => rec.listeners.set(ch, fn),
    removeHandler: ch => rec.handlers.delete(ch),
  },
  dialog: {
    // Recorded, so a test can see which window each dialog belongs to.
    showOpenDialog:  async (...a) => { rec.dialogs.push(a); rec.topAtDialog.push(rec.windows.filter(w => w.onTop).length); return { canceled: true, filePaths: [] }; },
    showSaveDialog:  async (...a) => { rec.dialogs.push(a); return { canceled: true, filePath: undefined }; },
    showMessageBox:  async (...a) => { rec.boxes.push(a); return { response: rec.boxAnswer }; },
    showErrorBox: () => {},
  },
  Menu: { buildFromTemplate: () => ({ popup: () => {}, closePopup: () => {} }), setApplicationMenu: () => {} },
  shell: { openExternal: async u => { rec.external.push(u); }, openPath: async () => '', showItemInFolder: () => {}, beep: () => {} },
  screen: {
    // Two monitors side by side. PiP used to always go to the primary one.
    getDisplayMatching: b => (b && b.x >= 1920 ? SECOND : PRIMARY),
    getPrimaryDisplay: () => PRIMARY,
    getAllDisplays: () => DISPLAYS,
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    getDisplayNearestPoint: () => ({ workAreaSize: { width: 1920, height: 1080 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
  },
  nativeImage: {
    // Mirrors Linux behaviour: no OS thumbnailer, so the handler must cope.
    createThumbnailFromPath: async () => { throw new Error('not supported on this platform'); },
    createFromPath: () => ({ isEmpty: () => true, toPNG: () => Buffer.alloc(0) }),
  },
  nativeTheme: { shouldUseDarkColors: true, on: () => {} },
  globalShortcut: { register: () => true, unregisterAll: () => {} },
  powerSaveBlocker: { start: () => 1, stop: () => {}, isStarted: () => false },
  protocol: {
    registerFileProtocol: () => true,
    registerSchemesAsPrivileged: schemes => { rec.schemes = schemes; },
    handle: (scheme, fn) => { rec.protocols.set(scheme, fn); },
  },
  net: { fetch: async url => ({ ok: true, status: 200, url, __servedFrom: url }) },
};

/* ── intercept require('electron') and friends ───────────────────── */
const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electronStub;
  if (request === 'child_process') {
    const real = realLoad.apply(this, arguments);
    return { ...real, spawn: (exe, args) => {
      const EE = require('events');
      const p = new EE(); p.kill = () => {}; p.pid = 4242;
      rec.spawned.push({ exe, args, proc: p });
      return p;
    } };
  }
  if (request === 'electron-updater') {
    return { autoUpdater: {
      autoDownload: false, on: () => {}, checkForUpdates: async () => null,
      checkForUpdatesAndNotify: async () => null, downloadUpdate: async () => {},
      quitAndInstall: () => {}, logger: null,
    } };
  }
  return realLoad.apply(this, arguments);
};

// Set from a CLI flag rather than an `BM_COMPAT=1 node ...` prefix, which is
// POSIX shell syntax and fails in Windows cmd, the same bug start:lite had.
if (process.argv.includes('--compat-run')) process.env.BM_COMPAT = '1';
// Lite mode builds a single window with no bgWin behind it. Several bugs
// (always-on-top, minimise) only existed there, so run the suite in it too.
const LITE = process.argv.includes('--lite-run');
if (LITE && !process.argv.includes('--lite')) process.argv.push('--lite');
const COMPAT = process.env.BM_COMPAT === '1';

async function main() {
  console.log('\nBM Player — main-process smoke test' + (COMPAT ? ' (compat mode)' : '') + (LITE ? ' (lite mode)' : '') + '\n');

  /* ── 1. module loads ─────────────────────────────────────────── */
  // On a real Windows machine the video was black until DirectComposition
  // was switched off. That default, and every way to override it.
  await step('Windows starts with DirectComposition off; overrides behave', () => {
    const { chromiumSwitches: cs } = require(path.join(ROOT, 'switches.js'));
    const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); };
    eq(cs({ platform: 'win32' }), ['disable-direct-composition'], 'Windows default');
    eq(cs({ platform: 'linux' }), [], 'Linux default');
    eq(cs({ platform: 'darwin' }), [], 'macOS default');
    eq(cs({ platform: 'win32', flags: { chromiumSwitches: [] } }), [], 'flags.json [] turns it off');
    eq(cs({ platform: 'win32', argv: ['--bm-switch=none'] }), [], '--bm-switch=none turns it off');
    eq(cs({ platform: 'win32', argv: ['--bm-switch=disable-gpu'] }), ['disable-direct-composition', 'disable-gpu'], 'adding one');
    eq(cs({ platform: 'linux', argv: ['--bm-switch=remote-debugging-port=9222', '--bm-switch=disable-gpu-compositing'] }), ['disable-gpu-compositing'], 'only allow-listed names');
    eq(cs({ platform: 'win32', flags: { chromiumSwitches: ['disable-gpu', 'evil'] } }), ['disable-gpu'], 'flags.json filtered');
  });

  await step('main.js loads without throwing', () => {
    delete require.cache[require.resolve(path.join(ROOT, 'main.js'))];
    require(path.join(ROOT, 'main.js'));
  });

  await step('GPU switches applied at module scope', () => {
    const names = rec.switches.map(s => s[0]);
    if (!names.includes('disable-gpu-sandbox')) throw new Error('got ' + names.join(', '));
  });

  /* ── 2. whenReady drives window creation + registerIpc ───────── */
  await step('whenReady() callback was registered', () => {
    if (typeof rec.whenReady !== 'function') throw new Error('app.whenReady().then() never called');
  });

  await step('whenReady() runs and creates a window', async () => {
    await rec.whenReady();
    if (!rec.windows.length) throw new Error('no BrowserWindow constructed');
  });

  /* ── 3. registerIpc() must complete, not throw part-way ──────── */
  // On Windows the file picker opened behind the player: no dialog had a
  // parent window. Each one must now belong to the player window.
  await step('every dialog opens as a child of the player window', async () => {
    const front = rec.windows.find(w => w.webContents && !w.isDestroyed?.());
    const channels = ['dialog:open', 'dialog:openSub', 'dialog:openPDF', 'dialog:savePDF', 'dialog:openM3u', 'dialog:saveM3u', 'gallery:browse'];
    const orphans = [];
    for (const ch of channels) {
      const h = rec.handlers.get(ch);
      if (!h) { orphans.push(ch + ' (no handler)'); continue; }
      const before = rec.dialogs.length;
      await Promise.race([h({ sender: front?.webContents }, 'x.pdf'), new Promise(r => setTimeout(r, 400))]);
      const call = rec.dialogs[before];
      if (!call) orphans.push(ch + ' (no dialog opened)');
      else if (call[0] !== front) orphans.push(ch);
    }
    if (orphans.length) throw new Error('dialogs without the player window as parent: ' + orphans.join(', '));
  });

  // With the pin on, or left on by PiP, the player stayed in front of its own
  // folder picker on Windows. While a dialog is open nothing is on top.
  await step('no window is always-on-top while a dialog is open, and it comes back', async () => {
    // The pin, through the app's own handler: that is what keeps it on top.
    await rec.handlers.get('win:alwaysTop')({}, true);
    const topBefore = rec.windows.filter(w => w.onTop).length;
    const n = rec.topAtDialog.length;
    await Promise.race([rec.handlers.get('gallery:browse')({}), new Promise(r => setTimeout(r, 400))]);
    const during = rec.topAtDialog[n];
    const after = rec.windows.filter(w => w.onTop).length;
    await rec.handlers.get('win:alwaysTop')({}, false);
    if (!topBefore) throw new Error('the pin did not make any window always-on-top');
    if (during === undefined) throw new Error('the folder dialog did not open');
    if (during !== 0) throw new Error(`${during} window(s) still always-on-top while the dialog was open`);
    if (after < topBefore) throw new Error(`always-on-top not restored afterwards (${after}, was ${topBefore})`);
  });

  // Plugins you add: checked, script ones off until a native confirmation,
  // and off again if their files change. Through the real IPC handlers.
  await step('plugins you add: script ones need a confirmation and are switched off if changed', async () => {
    const userDir = path.join(TMP, 'userData', 'plugins');
    fs.mkdirSync(userDir, { recursive: true });
    const mk = (name, files) => { const d = path.join(userDir, name); fs.mkdirSync(d, { recursive: true }); for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(d, f), c); return d; };
    const good = mk('my-script', { 'plugin.json': JSON.stringify({ name: 'My Script', type: 'functional', entry: 'index.js' }), 'index.js': 'export function activate(){}' });
    mk('escape', { 'plugin.json': JSON.stringify({ name: 'Escape', type: 'theme', css: '../../outside.css', themeKey: 'esc' }) });
    fs.writeFileSync(path.join(TMP, 'outside.css'), 'a{}');
    mk('_ignored', { 'plugin.json': JSON.stringify({ name: 'Ignored', type: 'theme', css: 'a.css', themeKey: 'ign' }), 'a.css': 'a{}' });
    const list = () => rec.handlers.get('plugins:list')();
    const find = async name => (await list()).find(p => p.name === name);
    const all = (await list()).map(p => p.name);
    if (all.includes('Escape')) throw new Error('a plugin pointing outside its folder was listed');
    if (all.includes('Ignored')) throw new Error('an underscore folder was listed');
    let p = await find('My Script');
    if (!p) throw new Error('the script plugin was not listed');
    if (p.enabled || !p.needsApproval) throw new Error('a script plugin you added started switched on');
    rec.boxAnswer = 0;
    await rec.handlers.get('plugins:setEnabled')({}, p.id, true);
    if ((await find('My Script')).enabled) throw new Error('it was switched on although Cancel was pressed');
    if (!rec.boxes.length) throw new Error('no confirmation was shown');
    rec.boxAnswer = 1;
    await rec.handlers.get('plugins:setEnabled')({}, p.id, true);
    if (!(await find('My Script')).enabled) throw new Error('confirming did not switch it on');
    fs.writeFileSync(path.join(good, 'index.js'), 'export function activate(){ /* changed */ }');
    p = await find('My Script');
    if (p.enabled || !p.changed) throw new Error('it stayed on after its file changed');
    rec.boxAnswer = 0;
  });

  await step('the plugins folder gets a README and samples, never overwriting yours', async () => {
    const userDir = path.join(TMP, 'userData', 'plugins');
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(path.join(userDir, 'README.txt'), 'mine');
    await rec.handlers.get('plugins:openFolder')();
    for (const f of ['_sample-theme/plugin.json', '_sample-theme/theme.css', '_sample-script/plugin.json', '_sample-script/index.js'])
      if (!fs.existsSync(path.join(userDir, f))) throw new Error('missing ' + f);
    if (fs.readFileSync(path.join(userDir, 'README.txt'), 'utf8') !== 'mine') throw new Error('your README was overwritten');
  });

  await step('only web pages and email are opened from the app', async () => {
    const n = rec.external.length;
    const ok = await rec.handlers.get('app:external')({}, 'https://github.com/BritMat/bm-player');
    const bad1 = await rec.handlers.get('app:external')({}, 'file:///C:/Windows/System32/calc.exe');
    const bad2 = await rec.handlers.get('app:external')({}, 'ms-settings:privacy');
    const opened = rec.external.slice(n);
    if (!ok || opened.length !== 1 || !opened[0].startsWith('https://github.com/')) throw new Error('the web page was not opened: ' + JSON.stringify(opened));
    if (bad1 || bad2) throw new Error('a program or settings address was passed on');
  });

  await step('registerIpc() registered a full handler set', () => {
    // A throw inside registerIpc leaves every later handler unregistered and
    // fails silently, which is precisely how Open Folder died.
    const required = [
      'gallery:browse', 'gallery:scan', 'gallery:thumb', 'music:tags',
      'dialog:openPDF', 'dialog:openSub', 'win:minimize',
    ];
    const missing = required.filter(c => !rec.handlers.has(c));
    if (missing.length) throw new Error('missing handlers: ' + missing.join(', '));
  });

  await step('registerIpc() is idempotent', async () => {
    // ready-to-show also calls it; the guard must stop a duplicate-handle throw.
    const before = rec.handlers.size;
    const win = rec.windows.find(w => w.opts && w.opts.webPreferences) || rec.windows[rec.windows.length - 1];
    win.emit('ready-to-show');
    if (rec.handlers.size !== before) throw new Error('handler count changed on second call');
  });

  await step('preload path points at a real file', () => {
    const w = rec.windows.find(x => x.opts?.webPreferences?.preload);
    if (!w) throw new Error('no window declared a preload script');
    const p = w.opts.webPreferences.preload;
    if (!fs.existsSync(p)) throw new Error('preload not on disk: ' + p);
  });

  await step('renderer entry file exists', () => {
    const f = path.join(ROOT, 'src', 'index.html');
    if (!fs.existsSync(f)) throw new Error('missing ' + f);
  });

  /* ── 4. exercise the real handlers against real files ────────── */
  const call = (ch, ...args) => rec.handlers.get(ch)({}, ...args);

  const fixture = path.join(TMP, 'library', 'Artist', 'Album');
  fs.mkdirSync(fixture, { recursive: true });
  fs.writeFileSync(path.join(fixture, 'track one.mp3'), 'x');
  fs.writeFileSync(path.join(fixture, 'Rock & Roll.flac'), 'x');
  fs.writeFileSync(path.join(TMP, 'library', 'cover.jpg'), 'x');
  fs.writeFileSync(path.join(TMP, 'library', 'notes.txt'), 'x');

  await step('gallery:scan recurses into subfolders', async () => {
    const out = await call('gallery:scan', path.join(TMP, 'library'));
    if (out.length !== 3) throw new Error(`expected 3 media files, got ${out.length}: ${out.map(o => o.name).join(', ')}`);
    if (out.some(o => o.name === 'notes.txt')) throw new Error('non-media file leaked through');
  });

  await step('gallery:scan returns size and mtime', async () => {
    const out = await call('gallery:scan', path.join(TMP, 'library'));
    const bad = out.filter(o => typeof o.size !== 'number' || typeof o.mtime !== 'number');
    if (bad.length) throw new Error('missing size/mtime on ' + bad.length + ' entries');
  });

  await step('gallery:scan tolerates a missing folder', async () => {
    const out = await call('gallery:scan', path.join(TMP, 'does-not-exist'));
    if (!Array.isArray(out) || out.length) throw new Error('expected an empty array');
  });

  await step('gallery:thumb returns null when no OS thumbnailer exists', async () => {
    const out = await call('gallery:thumb', path.join(TMP, 'library', 'cover.jpg'), 320);
    if (out !== null) throw new Error('expected null, got ' + out);
  });

  await step('music:tags degrades gracefully on unreadable files', async () => {
    const out = await call('music:tags', [path.join(fixture, 'track one.mp3')]);
    if (!Array.isArray(out)) throw new Error('expected an array');
    if (out.length && !out[0].path) throw new Error('entries must always carry a path');
  });

  await step('music:tags handles a non-array argument', async () => {
    const out = await call('music:tags', null);
    if (!Array.isArray(out)) throw new Error('expected an array');
  });

/* ── 5. bmfile:// — the new trust boundary ───────────────────── */
  await step('bmfile scheme is registered as privileged', () => {
    if (!rec.schemes) throw new Error('registerSchemesAsPrivileged was never called');
    const s = rec.schemes.find(x => x.scheme === 'bmfile');
    if (!s) throw new Error('bmfile not among the registered schemes');
    for (const p of ['standard', 'secure', 'supportFetchAPI', 'stream']) {
      if (!s.privileges[p]) throw new Error(`bmfile is missing the "${p}" privilege`);
    }
    // bypassCSP would undo the point of listing bmfile: in the policy.
    if (s.privileges.bypassCSP) throw new Error('bmfile must NOT bypass the CSP');
  });

  await step('bmfile handler is registered on ready', () => {
    if (!rec.protocols.has('bmfile')) throw new Error('protocol.handle("bmfile") was never called');
  });

  const serve = url => rec.protocols.get('bmfile')({ url });

  await step('bmfile serves a real file', async () => {
    const f = path.join(TMP, 'library', 'cover.jpg');
    const res = await serve('bmfile://local/' + encodeURIComponent(f.replace(/\\/g, '/')));
    if (res.status && res.status !== 200) throw new Error('status ' + res.status);
  });

  await step('bmfile round-trips a path with & # and spaces', async () => {
    const f = path.join(TMP, 'library', 'Artist', 'Album', 'Rock & Roll.flac');
    const res = await serve('bmfile://local/' + encodeURIComponent(f.replace(/\\/g, '/')));
    if (res.status && res.status !== 200) throw new Error('status ' + res.status + ' for ' + f);
  });

  // Byte ranges (v3.28.0): a media element asks for parts of a file, and some
  // formats only get a duration from a ranged reply (a WAV had none, so the
  // music seek bar did nothing). And a plugin's script is served as one.
  await step('bmfile serves byte ranges, with the length and the type', async () => {
    const f = path.join(TMP, 'ranges.wav');
    fs.writeFileSync(f, Buffer.from(Array.from({ length: 100 }, (_, i) => i)));
    const url = 'bmfile://local/' + encodeURIComponent(f.replace(/\\/g, '/'));
    const get = range => rec.protocols.get('bmfile')({ url, headers: new Headers(range ? { range } : {}) });
    const full = await get(null);
    if (full.status !== 200 || full.headers.get('content-length') !== '100' || full.headers.get('accept-ranges') !== 'bytes') throw new Error(`whole file: ${full.status}, length ${full.headers.get('content-length')}, ${full.headers.get('accept-ranges')}`);
    if (full.headers.get('content-type') !== 'audio/wav') throw new Error('served as ' + full.headers.get('content-type'));
    const part = await get('bytes=10-19'), body = new Uint8Array(await part.arrayBuffer());
    if (part.status !== 206 || part.headers.get('content-range') !== 'bytes 10-19/100' || body.length !== 10 || body[0] !== 10 || body[9] !== 19)
      throw new Error(`bytes 10-19: ${part.status}, ${part.headers.get('content-range')}, ${body.length} bytes from ${body[0]} to ${body[9]}`);
    const tail = new Uint8Array(await (await get('bytes=-5')).arrayBuffer());
    if (tail.length !== 5 || tail[0] !== 95) throw new Error('the last 5 bytes: ' + tail.length + ' from ' + tail[0]);
    const open = await get('bytes=90-');
    if (open.headers.get('content-range') !== 'bytes 90-99/100') throw new Error('bytes 90 on: ' + open.headers.get('content-range'));
    if ((await get('bytes=500-')).status !== 416) throw new Error('a range past the end was not refused');
    const js = path.join(TMP, 'plugin.js'); fs.writeFileSync(js, 'export default 1;');
    const jr = await rec.protocols.get('bmfile')({ url: 'bmfile://local/' + encodeURIComponent(js.replace(/\\/g, '/')) });
    if (jr.headers.get('content-type') !== 'text/javascript') throw new Error('a script is served as ' + jr.headers.get('content-type'));
  });

  await step('bmfile 404s a file that does not exist', async () => {
    const res = await serve('bmfile://local/' + encodeURIComponent('/no/such/file.jpg'));
    if (res.status !== 404) throw new Error('expected 404, got ' + res.status);
  });

  await step('bmfile refuses to serve a directory', async () => {
    const res = await serve('bmfile://local/' + encodeURIComponent(TMP.replace(/\\/g, '/')));
    if (res.status !== 403) throw new Error('expected 403, got ' + res.status);
  });

  await step('bmfile rejects an empty path', async () => {
    const res = await serve('bmfile://local/');
    if (res.status !== 400) throw new Error('expected 400, got ' + res.status);
  });

  await step(COMPAT ? 'compat mode disables webSecurity for file://' : 'windows run with webSecurity enabled', () => {
    for (const w of rec.windows) {
      const wp = w.opts && w.opts.webPreferences;
      if (!wp) continue;
      if (!COMPAT && wp.webSecurity === false) throw new Error('a window still disables webSecurity');
      if (COMPAT && wp.webSecurity !== false) throw new Error('compat mode must turn webSecurity off, or file:// will not load');
      if (wp.nodeIntegration) throw new Error('nodeIntegration is on');
      if (wp.contextIsolation === false) throw new Error('contextIsolation is off');
    }
  });

/* ── 6. flags reach the renderer ─────────────────────────────── */
  await step(COMPAT ? 'compat launch passes fallback flags to the renderer'
                    : 'normal launch passes default flags to the renderer', () => {
    const w = rec.windows.find(x => x.loaded);
    if (!w) throw new Error('no window called loadFile');
    const q = w.loaded.opts.query || {};
    const want = COMPAT
      ? { fs: 'file',   ae: '0', gf: '0', compat: '1' }
      : { fs: 'bmfile', ae: '1', gf: '1', compat: '0' };
    for (const [k, v] of Object.entries(want)) {
      if (q[k] !== v) throw new Error(`flag ${k} is ${q[k]}, expected ${v}: ${JSON.stringify(q)}`);
    }
  });

  await step('diagnostics report which mode is active', async () => {
    const d = await call('app:diagnostics');
    if (!d.flags) throw new Error('flags missing from diagnostics');
    if (d.flags.compat !== COMPAT) throw new Error('diagnostics reports compat=' + d.flags.compat);
  });

  // v3.36.0: the page is told the screen's refresh rate, which it cannot ask
  // for. What lowers quality when frames are slow measures against it.
  await step('the page is told the refresh rate of the screen the window is on', async () => {
    const info = await call('app:perfInfo');
    if (info.displayHz !== 144) throw new Error('a 143.98 Hz screen is reported as ' + info.displayHz);
    if (!(info.cpuCount > 0) || !(info.totalMemGB > 0)) throw new Error('the cores and memory are gone from it: ' + JSON.stringify(info));
  });

/* ── 7. Picture-in-picture, driven through the real handler ─────── */
  const LAYER = (rec.windows.find(w => w.loaded)?.loaded.opts.query || {}).vl || 'front';

  const LITE_RUN = process.argv.includes('--lite-run');
  await step(`mpv is handed the ${LITE_RUN ? 'Lite video' : LAYER === 'back' ? 'background' : 'front'} window`, () => {
    const spawned = rec.spawned[0];
    if (!spawned) { console.log('      (no mpv on this machine: not checked)'); return; }
    const wid = (spawned.args.find(a => a.startsWith('--wid=')) || '').split('=')[1];
    const front = rec.windows.find(w => w.opts && w.opts.webPreferences);
    // Lite (v3.23.0): mpv draws into its own window over the page's video area.
    const liteVideo = rec.windows.find(w => w.opts && /Lite video/.test(w.opts.title || ''));
    if (LITE_RUN && !liteVideo) throw new Error('the Lite build created no video window');
    const back = rec.windows.find(w => w !== front && w !== liteVideo);
    const expect = LITE_RUN ? liteVideo : LAYER === 'back' ? back : front;
    const want = String(1000 + rec.windows.indexOf(expect));
    if (wid !== want) throw new Error(`--wid=${wid}, expected ${want} (${LAYER} layer)`);
  });

  await step('the video layer matches the platform and mode', () => {
    const lite = process.argv.includes('--lite-run'), compat = process.argv.includes('--compat-run');
    const want = (lite || compat) ? 'front' : (['linux', 'win32'].includes(process.platform) ? 'back' : 'front');
    if (LAYER !== want) throw new Error(`layer is ${LAYER}, expected ${want}`);
  });
  // The page's window: the only one created with webPreferences. "The one with
  // a parent" stopped meaning that when Lite got its own video window (v3.23.0).
  const W = rec.windows.find(w => w.opts && w.opts.webPreferences) || rec.windows[rec.windows.length - 1];
  const BG = rec.windows.find(w => w !== W && !(w.opts && w.opts.parent));
  const NORMAL = { x: 200, y: 120, width: 1280, height: 780 };
  const pipSent = () => rec.sent.filter(([ch]) => ch === 'win:pipState').map(([, v]) => v);
  const inside = (b, a) => b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;

  await step('entering PiP shrinks, locks 16:9 and floats on top', async () => {
    W._bounds = { ...NORMAL }; W._max = false; W.onTop = false;
    await call('win:pip', true);
    const b = W.getBounds();
    if (b.width !== 340 || b.height !== 200) throw new Error('PiP size is ' + b.width + 'x' + b.height);
    if (Math.abs(W.aspect - 16 / 9) > 1e-6) throw new Error('aspect ratio not locked, got ' + W.aspect);
    if (!W.onTop) throw new Error('PiP window is not always on top');
    if (!W.skipTaskbar) throw new Error('PiP window still shows in the taskbar');
    if (W.maximizable !== false) throw new Error('PiP window can still be maximised by double-clicking the drag bar');
    if (BG && LAYER === 'front' && BG.visible !== false) throw new Error('the background window stayed visible behind PiP');
    if (BG && LAYER === 'back') {
      // The picture lives in bgWin in this layout, so hiding it would leave
      // PiP with controls and no video.
      if (BG.visible === false) throw new Error('back layer: bgWin was hidden, taking the video with it');
      const bb = BG.getBounds(), wb = W.getBounds();
      if (bb.width !== wb.width || bb.height !== wb.height || bb.x !== wb.x || bb.y !== wb.y) {
        throw new Error('back layer: the picture window did not follow PiP: ' + JSON.stringify(bb));
      }
      if (!BG.onTop) throw new Error('back layer: another app could slide between the picture and its controls');
    }
    if (pipSent().at(-1) !== true) throw new Error('renderer was not told PiP started');
  });

  await step('a second "enter" is ignored, so the saved size survives', async () => {
    const before = rec.sent.length;
    await call('win:pip', true);
    if (rec.sent.length !== before) throw new Error('a duplicate enter was processed');
  });

  await step('leaving PiP restores size, position and every window flag', async () => {
    await call('win:pip', false);
    const b = W.getBounds();
    for (const k of ['x', 'y', 'width', 'height']) {
      if (b[k] !== NORMAL[k]) throw new Error(`${k} restored to ${b[k]}, expected ${NORMAL[k]} — was the saved size overwritten?`);
    }
    if (W.aspect !== 0) throw new Error('16:9 lock not released');
    if (!W.minSize || W.minSize[0] !== 900) throw new Error('normal minimum size not restored');
    if (W.onTop) throw new Error('still always on top after leaving PiP');
    if (W.skipTaskbar) throw new Error('still hidden from the taskbar');
    if (W.maximizable !== true) throw new Error('window left unable to maximise');
    if (BG && !BG.visible) throw new Error('background window not shown again');
    if (pipSent().at(-1) !== false) throw new Error('renderer was not told PiP ended');
  });

  await step('a second "exit" is ignored', async () => {
    const before = rec.sent.length;
    await call('win:pip', false);
    if (rec.sent.length !== before) throw new Error('a duplicate exit was processed');
  });

  await step('a maximised window comes back maximised', async () => {
    W._bounds = { ...NORMAL }; W._max = true;
    await call('win:pip', true);
    if (W.isMaximized()) throw new Error('entered PiP while still maximised; setBounds is ignored on Windows then');
    await call('win:pip', false);
    if (!W.isMaximized()) throw new Error('maximised state was lost');
    W._max = false;
  });

  await step('PiP opens on the monitor the app is on', async () => {
    W._bounds = { x: 2400, y: 200, width: 1280, height: 780 };   // second screen
    await call('win:pip', true);
    const b = W.getBounds();
    if (!inside(b, SECOND.workArea)) throw new Error('PiP jumped to another monitor: ' + JSON.stringify(b));
    await call('win:pip', false);
  });

  await step('unplugging that monitor mid-PiP still restores on screen', async () => {
    W._bounds = { x: 2400, y: 200, width: 1280, height: 780 };
    await call('win:pip', true);
    DISPLAYS = [PRIMARY];                                      // second screen gone
    W._bounds = { x: 1500, y: 800, width: 340, height: 200 };   // OS moved PiP to the survivor
    await call('win:pip', false);
    const b = W.getBounds();
    if (!inside({ ...b, width: Math.min(b.width, PRIMARY.workArea.width) }, PRIMARY.workArea)) {
      throw new Error('restored off screen at ' + JSON.stringify(b));
    }
    DISPLAYS = [PRIMARY, SECOND];
  });

  await step('fullscreen and theatre are ignored while in PiP', async () => {
    W._bounds = { ...NORMAL }; W._max = false;
    // Checked one at a time: fullscreen and theatre both toggle maximise, so
    // calling them back to back cancelled out and hid the bug.
    for (const key of ['win:fullscreen', 'win:theatre']) {
      W._max = false;
      await call('win:pip', true);
      await call(key);
      const hit = W.isMaximized();
      await call('win:pip', false);
      W._max = false;
      if (hit) throw new Error(`${key} maximised the PiP window`);
    }
  });

  await step('always-on-top: kept on during PiP, applied on exit, works in any mode', async () => {
    W._bounds = { ...NORMAL };
    await call('win:pip', true);
    await call('win:alwaysTop', false);
    if (!W.onTop) throw new Error('turning the option off dropped the PiP window behind others');
    await call('win:pip', false);
    if (W.onTop) throw new Error('the recorded preference (off) was not applied on exit');
    await call('win:alwaysTop', true);
    const target = BG || W;
    if (!target.onTop) throw new Error('always-on-top did not reach any window (Lite has no bgWin)');
    await call('win:alwaysTop', false);
  });

await step('PiP size button cycles three sizes, anchored and on screen', async () => {
    W._bounds = { ...NORMAL }; W._max = false;
    await call('win:pip', true);
    const corner = b => [b.x + b.width, b.y + b.height];
    const start = corner(W.getBounds());
    const seen = [];
    for (let i = 0; i < 3; i++) {
      const r = await call('win:pipSize');
      const b = W.getBounds();
      seen.push(b.width + 'x' + b.height);
      if (!inside(b, (b.x >= 1920 ? SECOND : PRIMARY).workArea)) throw new Error('resized off screen: ' + JSON.stringify(b));
      const c = corner(b);
      if (Math.abs(c[0] - start[0]) > 1 || Math.abs(c[1] - start[1]) > 1) throw new Error('bottom-right corner moved');
      if (!r || r.width !== b.width) throw new Error('reply does not match the window');
    }
    if (seen.join(',') !== '480x270,640x360,340x200') throw new Error('sizes went ' + seen.join(','));
    await call('win:pip', false);
  });

  await step('the size control does nothing outside PiP', async () => {
    W._bounds = { ...NORMAL };
    const r = await call('win:pipSize');
    const b = W.getBounds();
    if (r !== null || b.width !== NORMAL.width) throw new Error('resized a normal window');
  });

  // v3.37.0, from a real machine's main-errors.log: quitting in the first
  // moments of a start had mpv started on a picture window that was already
  // destroyed ("Object has been destroyed"). mpv dying at once is one of the
  // ways back into that code: it is started again 400 ms later.
  await step('mpv is not started on a window that is gone', async () => {
    const last = rec.spawned.at(-1);
    if (!last) { console.log('      (no mpv on this machine: not checked)'); return; }
    const vw = rec.windows[+(last.args.find(a => a.startsWith('--wid=')) || '').split('=')[1] - 1000];
    if (!vw) throw new Error('could not tell which window mpv draws in');
    const real = vw.isDestroyed, n = rec.spawned.length;
    vw.isDestroyed = () => true;
    try { last.proc.emit('exit', 1); await new Promise(r => setTimeout(r, 650)); }
    finally { vw.isDestroyed = real; }
    if (rec.spawned.length !== n) throw new Error('mpv was started again, for a window that no longer exists');
  });

  /* ── 7b. Full screen (v3.37.0) ──────────────────────────────────── */
  // On Windows a transparent window goes full screen by taking the screen's
  // bounds and isFullScreen() goes on saying false. The stub is made to
  // behave so, and the app has to find its own way out again.
  await step('full screen: entered and left by the app\'s own count, never asked of the window', async () => {
    const real = { is: W.isFullScreen, set: W.setFullScreen };
    const asked = [];
    W.isFullScreen = () => false; W.setFullScreen = v => asked.push(!!v);
    const states = () => rec.sent.filter(([ch]) => ch === 'win:state').map(([, v]) => v);
    try {
      W._bounds = { ...NORMAL }; W._max = false;
      if (await call('win:isFs') !== false) throw new Error('full screen before it was asked for');
      await call('win:fullscreen');
      if (asked.join() !== 'true') throw new Error('entering asked the window for ' + JSON.stringify(asked));
      if (await call('win:isFs') !== true) throw new Error('the app does not know it is in full screen');
      if (states().at(-1) !== 'fullscreen') throw new Error('the page was told ' + states().at(-1));
      await call('win:fullscreen');
      if (asked.join() !== 'true,false') throw new Error('leaving asked the window for ' + JSON.stringify(asked) + ': it cannot leave full screen');
      if (await call('win:isFs') !== false) throw new Error('still in full screen after leaving');
      if (states().at(-1) !== 'normal') throw new Error('after leaving the page was told ' + states().at(-1));
      // the maximise button leads out, and does not maximise on top of it
      await call('win:fullscreen'); await call('win:maximize');
      if (await call('win:isFs') !== false || W.isMaximized()) throw new Error('maximise in full screen did not simply leave it');
      // PiP leaves it first, and it is not entered from PiP
      asked.length = 0;
      await call('win:fullscreen'); await call('win:pip', true);
      if (await call('win:isFs') !== false) throw new Error('PiP was entered with the window still in full screen');
      await call('win:fullscreen');
      if (await call('win:isFs') !== false) throw new Error('full screen was entered from PiP');
      await call('win:pip', false);
      // never "leave" a window that is not in full screen: on Windows that sets bounds it never saved
      if (asked.filter(v => v === false).length !== 1) throw new Error('setFullScreen(false) was called ' + asked.filter(v => v === false).length + ' times for one full screen');
      // left by the system's own means: the app follows
      await call('win:fullscreen'); W.emit('leave-full-screen');
      if (await call('win:isFs') !== false || states().at(-1) === 'fullscreen') throw new Error('the app did not notice full screen being left');
    } finally { W.isFullScreen = real.is; W.setFullScreen = real.set; W._bounds = { ...NORMAL }; W._max = false; }
  });

  /* ── 8. mpv launch contract the end-of-file logic relies on ─────── */
  await step('mpv runs with keep-open and eof-reached is observed', () => {
    const src = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
    const args = rec.spawned[0] ? rec.spawned[0].args : null;
    const keepOpen = args ? args.includes('--keep-open=yes') : /'--keep-open=yes'/.test(src);
    if (!keepOpen) throw new Error('keep-open changed: the renderer advances on eof-reached, which assumes keep-open=yes');
    if (!/\[\d+,'eof-reached'\]/.test(src)) throw new Error('eof-reached is not observed, so music will not advance under mpv');
    if (!/'loadfile',valid\[0\],'replace'\)[^;]*;mpvCmd\('set_property','pause',false\)/.test(src)) {
      throw new Error('openFiles no longer unpauses; a file opened after another ended loads paused');
    }
  });

  await step('every invoked preload channel has a handler', () => {
    const preload = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
    const invoked = [...preload.matchAll(/inv\(\s*'([^']+)'/g)].map(m => m[1]);
    const missing = invoked.filter(c => !rec.handlers.has(c));
    if (missing.length) throw new Error('unhandled: ' + missing.join(', '));
  });

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

  const bad = results.filter(r => !r).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed.\n`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
