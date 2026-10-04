'use strict';
const { app, BaseWindow, BrowserWindow, ipcMain, dialog, Menu, shell, screen, nativeImage, protocol, net: electronNet } = require('electron');
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os'), crypto = require('crypto');
const { Readable } = require('stream');   // bmfile:// streams files from disk

// ── GPU FIX: Disable problematic GPU features that cause crashes ─────
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-software-rasterizer');
// Don't fully disable GPU - just fix the sandbox issue
// app.commandLine.appendSwitch('disable-gpu');  // Uncomment if still crashing

// ── Platform detection ───────────────────────────────────────────
const IS_WIN   = process.platform === 'win32';
const IS_MAC   = process.platform === 'darwin';
const IS_LINUX = process.platform === 'linux';

// ── Plugin system ────────────────────────────────────────────────
// Two plugin locations are scanned:
//   1. <app root>/plugins   — bundled/dev plugins shipped with the app
//   2. <userData>/plugins   — user-installed plugins (survives updates)
// Each plugin is a folder containing plugin.json + an entry .js file.
// Enable/disable state persists in <userData>/plugins-state.json.
function getPluginDirs() {
  return [
    path.join(__dirname, 'plugins'),
    path.join(app.getPath('userData'), 'plugins'),
  ];
}
function ensurePluginDirs() {
  getPluginDirs().forEach(d => { try { fs.mkdirSync(d, { recursive: true }); } catch(_) {} });
}
function getPluginStatePath() { return path.join(app.getPath('userData'), 'plugins-state.json'); }
function readPluginState() {
  try { return JSON.parse(fs.readFileSync(getPluginStatePath(), 'utf8')); } catch(_) { return {}; }
}
function writePluginState(state) {
  try { fs.writeFileSync(getPluginStatePath(), JSON.stringify(state, null, 2)); } catch(_) {}
}
const PS = require('./plugin-safety');
/* Plugins: see plugin-safety.js for the rules. Bundled plugins ship with the
   app and are trusted. Plugins you add are checked: files must stay inside
   their folder, script plugins start switched off and need a native
   confirmation, and are switched off again if their files change. */
function scanPlugins() {
  const state = readPluginState();
  const found = [];
  getPluginDirs().forEach((dir, di) => {
    const bundled = di === 0;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(_) { return; }
    entries.filter(e => e.isDirectory() && !/^[_.]/.test(e.name)).slice(0, PS.LIMITS.plugins).forEach(e => {
      const pluginDir = path.join(dir, e.name);
      try {
        const mPath = PS.safeChild(pluginDir, 'plugin.json', ['.json']);
        if (!mPath || fs.statSync(mPath).size > PS.LIMITS.manifestBytes) return;
        const m = PS.checkManifest(JSON.parse(fs.readFileSync(mPath, 'utf8')));
        if (!m) return;
        // Bundled ids keep their old form; yours get their own, so a plugin
        // you add can never borrow a bundled plugin's saved state.
        const id = bundled ? `plugins:${e.name}` : `user:${e.name}`;
        const saved = state[id];
        let entryPath = null, cssPath = null, enabled, changed = false;
        if (m.type === 'functional') {
          entryPath = PS.safeChild(pluginDir, m.entry, ['.js', '.mjs']);
          if (!entryPath || fs.statSync(entryPath).size > PS.LIMITS.scriptBytes) return;
          if (bundled) enabled = saved !== false;
          else {
            const digest = PS.folderDigest(pluginDir);
            if (!digest) return;
            const approved = !!(saved && typeof saved === 'object' && saved.enabled === true);
            changed = approved && saved.digest !== digest;
            enabled = approved && !changed;
          }
        } else {
          cssPath = PS.safeChild(pluginDir, m.css, ['.css']);
          if (!cssPath || fs.statSync(cssPath).size > PS.LIMITS.cssBytes) return;
          enabled = saved !== false;
        }
        found.push({ id, type: m.type, name: m.name, version: m.version, description: m.description,
          entryPath, cssPath, themeKey: m.themeKey || null, themeIcon: m.icon || null,
          enabled, bundled, needsApproval: m.type === 'functional' && !bundled, changed, dir: pluginDir });
      } catch(_) { /* a malformed plugin is skipped */ }
    });
  });
  return found;
}
/* The samples and README in your plugins folder. Never overwrites a file.
   Plain reads and writes rather than fs.cpSync, which may not read from the
   packaged app's asar archive. */
function installPluginTemplates(dest) {
  const copy = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name), b = path.join(to, e.name);
      if (e.isDirectory()) copy(a, b);
      else if (!fs.existsSync(b)) fs.writeFileSync(b, fs.readFileSync(a));
    }
  };
  try { copy(path.join(__dirname, 'plugin-templates'), dest); } catch(_) {}
}
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let win=null,bgWin=null,mpvProc=null,mpvSock=null;
// Lite (v3.23.0): mpv draws into its own opaque window laid over the page's
// video area only, so the control bar below it stays visible. It used to draw
// into the Lite window itself and covered the controls on Windows.
let videoWin=null,liteVideoRect=null;
let ipcOk=false,mpvBuf='',reqId=0;
const cbs=new Map();
// IPC transport path: Windows uses a named pipe; macOS/Linux use a Unix
// domain socket file. net.createConnection() accepts either format
// transparently, so no other code needs to branch on this.
const PIPE = IS_WIN
  ? `\\\\.\\pipe\\bm-mpv-${process.pid}`
  : path.join(os.tmpdir(), `bm-mpv-${process.pid}.sock`);
const MEDIA=new Set(['mp4','mkv','avi','mov','wmv','flv','webm','ts','m2ts','m4v','3gp','rmvb','ogv','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka','vob','mpg','mpeg','m2v','divx','hevc','av1','m3u','m3u8','pls']);
let trackList=[],currentSubDelay=0,currentAudioDelay=0,mediaProps={};
let alwaysOnTopFlag=false,pipPrevBounds=null,pipActive=false,pipWasMaximized=false,pipSizeIdx=0;
let pendingOpenFile=null;   // file path captured before the window exists (cold start / macOS open-file)

// In a packaged app, argv is [exePath, ...args] — in dev mode (electron .)
// it's [electronPath, appPath, ...args]. Using the wrong offset silently
// drops the file path when a user double-clicks a video to open it.
const argOffset = app.isPackaged ? 1 : 2;

if(!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
app.on('second-instance',(_e,argv)=>{
  if(win){if(win.isMinimized())win.restore();win.focus();}
  const f=argv.slice(argOffset).find(a=>fs.existsSync(a)&&isMedia(a));
  if(f)openFiles([f]);
});

// macOS delivers "open this file" as a dedicated app event, not via argv —
// this must be registered before app.whenReady() resolves since macOS can
// fire it immediately on cold start (e.g. double-clicking a video in Finder).
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (win && !win.isDestroyed() && ipcOk) openFiles([filePath]);
  else pendingOpenFile = filePath;   // mpv isn't ready yet — applied once connectIpc() fires
});

// Cold-start on Windows/Linux: a file path arrives via argv, not an event.
const coldStartFile = process.argv.slice(argOffset).find(a => { try { return fs.existsSync(a) && isMedia(a); } catch(_) { return false; } });
if (coldStartFile) pendingOpenFile = coldStartFile;

// ── Lite Mode detection (v1.9.0) ────────────────────────────────────
// Three sources, in priority order:
//   1. process.env.BM_LITE (set by --lite flag or by the Lite installer's wrapper)
//   2. --lite CLI arg
//   3. packaged Lite build: presence of buildResources/lite.flag file
// The packaged Lite build carries lite.flag as an extraResource, next to
// app.asar. It used to be looked for inside the package, under
// buildResources, but electron-builder never packs that folder into an app, so
// a packaged Lite build ran as the full version (found by smoke-packaged
// --expect-lite in v3.23.0).
const LITE_FLAG_FILE = path.join(process.resourcesPath || __dirname, 'lite.flag');
// Chromium switches: on Windows, DirectComposition off, which is what made
// the video visible on a real machine. The decision lives in switches.js so
// it can be tested; see there for the order of defaults and overrides.
const CHROMIUM_SWITCHES = (() => {
  let flags = {};
  try { flags = JSON.parse(require('fs').readFileSync(require('path').join(require('electron').app.getPath('userData'), 'flags.json'), 'utf8')); } catch {}
  const list = require('./switches').chromiumSwitches({ platform: process.platform, argv: process.argv, flags });
  for (const w of list) { try { require('electron').app.commandLine.appendSwitch(w); } catch {} }
  return list;
})();
const MPV_VO = (() => {
  const a = process.argv.find(x => x.startsWith('--mpv-vo='));
  let v = a ? a.slice('--mpv-vo='.length) : '';
  if (!v) { try { v = JSON.parse(require('fs').readFileSync(require('path').join(require('electron').app.getPath('userData'), 'flags.json'), 'utf8')).mpvVo || ''; } catch {} }
  // mpv output names are simple words; refuse anything else.
  return /^[a-z0-9_,-]{1,60}$/i.test(v) ? v : '';
})();
// mpv's audio output, like --mpv-vo (v3.29.0). A machine with no sound device,
// a test machine for one, cannot play an audio-only file at all ("Could not
// open/initialize audio device"), and --mpv-ao=null plays it into nothing, in
// real time. Nothing changes unless it is given.
const MPV_AO = (() => {
  const a = process.argv.find(x => x.startsWith('--mpv-ao='));
  const v = a ? a.slice('--mpv-ao='.length) : '';
  return /^[a-z0-9_,-]{1,60}$/i.test(v) ? v : '';
})();
const IS_LITE_BUILD = (process.env.BM_LITE === '1')
  || process.argv.includes('--lite')
  || (app.isPackaged && fs.existsSync(LITE_FLAG_FILE));
// Expose to preload so the renderer can adapt its UI on boot.
process.env.BM_LITE = IS_LITE_BUILD ? '1' : '0';

app.whenReady().then(()=>{
  setTimeout(() => { pruneCache('thumbs'); pruneCache('covers'); }, 30000).unref?.();   // v3.33.0
  try { protocol.handle('bmfile', serveBmFile); }
  catch (e) { console.error('[main] could not register bmfile://:', e); }
  registerIpc();
  if (IS_LITE_BUILD) {
    // ── Lite window setup ──
    // Single opaque window — no bgWin backdrop, no transparency compositing.
    // This is the single biggest GPU-saver on weak hardware: keeping two
    // frameless transparent windows in sync (resize, move, maximize) was
    // a per-frame compositor cost on the bgWin sync path that low-end GPUs
    // can't really afford. One window = one paint target.
    win=new BrowserWindow({width:1280,height:780,minWidth:900,minHeight:560,frame:false,transparent:false,backgroundColor:'#0b0c10',show:false,title:'BM Player Lite',webPreferences:{nodeIntegration:false,contextIsolation:true,preload:path.join(__dirname,'preload.js'),webSecurity:FLAGS.fileScheme==='bmfile',sandbox:false}});
    win.on('maximize',()=>{send('win:state','maximized');});
    // Minimised or hidden: the page pauses its decorative loops (v3.30.0).
    for(const [ev,h] of [['minimize',true],['hide',true],['restore',false],['show',false]]) win.on(ev,()=>send('win:hidden',h));
    win.on('unmaximize',()=>{send('win:state','normal');});
    win.loadFile(path.join(__dirname,'src','index.html'),{query:flagQuery()});
    // CSP. 'unsafe-eval' was here on the claim that Three.js and dynamic
    // imports need it. Neither does, and nothing in this codebase calls
    // eval() or new Function() — verified by grep and enforced by the
    // contract check. Removing it closes the widest hole in the policy.
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' data: blob: bmfile:; script-src 'self' 'unsafe-inline' bmfile:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: bmfile: file: https:; media-src 'self' bmfile: file: data: blob:; connect-src 'self' bmfile: file: http: https: ws: wss:; font-src 'self' data:;"]
        }
      });
    });
    const boot=makeBoot(()=>win.show());
    win.once('ready-to-show',boot);
    setTimeout(boot,4000);
    win.on('closed',()=>{killMpv();try{videoWin?.destroy();}catch(_){}app.exit(0);});
    videoWin=new BaseWindow({parent:win,show:false,frame:false,transparent:false,backgroundColor:'#000000',
      focusable:false,skipTaskbar:true,hasShadow:false,resizable:false,movable:false,minimizable:false,maximizable:false,
      title:'BM Player Lite video'});
    // Clicks and the pointer pass through to the page underneath, which owns
    // every control, as bgWin does in the full layout.
    try{videoWin.setIgnoreMouseEvents(true);}catch(_){}
    for (const ev of ['move','resize','maximize','unmaximize','enter-full-screen','leave-full-screen','restore','show','focus'])
      win.on(ev, syncLiteVideo);
    // The pin and PiP make the Lite window always-on-top. The video window must
    // follow, or it drops behind the page and the picture disappears.
    // The picture window follows, from the window's state now rather than the
    // event's: on Windows, making an owned window non-topmost also makes its
    // OWNER non-topmost, so a late event saying false undid PiP (v3.30.1, on
    // a real machine: the PiP window was not on top). Never false during PiP.
    win.on('always-on-top-changed',()=>{try{videoWin?.setAlwaysOnTop(pipActive||win.isAlwaysOnTop());}catch(_){}syncLiteVideo();});
    win.on('minimize',()=>{try{videoWin?.hide();}catch(_){}});
    win.on('hide',()=>{try{videoWin?.hide();}catch(_){}});
    // bgWin stays null — code below uses bgWin?. so this is safe.
  } else {
    // ── Full / Professional window setup (unchanged from v1.8.0) ──
    // A BaseWindow, not a BrowserWindow: a plain native window with no web
    // page in it. mpv draws its video in here, and on Windows Chromium paints
    // its page above child windows, so any page in this window covered the
    // picture. That is why video played black on a real Windows machine.
    // No thick frame, shadow or rounded corners (v3.26.2): a frameless window
    // with a thick frame has Windows' invisible resize borders on the left,
    // right and bottom, and on a real machine they showed as a see-through,
    // frosted band around the player (about 9px, light on a bright desktop,
    // dark in the field check's captures with a console behind). This window is
    // only ever placed by the app and ignores the mouse, so it needs none of
    // them. It stays resizable: resizable:false pins a window's size, and it
    // must follow the controls window.
    bgWin=new BaseWindow({width:1280,height:780,minWidth:900,minHeight:560,frame:false,transparent:false,backgroundColor:'#000000',show:false,title:'BM Player BG',
      thickFrame:false,hasShadow:false,roundedCorners:false});
    // bgWin is a pure opaque visual backdrop (no interactive content) — never
    // let it intercept clicks meant for the transparent UI window above it.
    try{bgWin.setIgnoreMouseEvents(true);}catch(_){}
    win=new BrowserWindow({parent:bgWin,width:1280,height:780,minWidth:900,minHeight:560,frame:false,transparent:true,backgroundColor:'#00000000',show:false,title:'BM Player',webPreferences:{nodeIntegration:false,contextIsolation:true,preload:path.join(__dirname,'preload.js'),webSecurity:FLAGS.fileScheme==='bmfile',sandbox:false}});
    const sync=alignBg;
    win.on('resize',sync);win.on('move',sync);
    // Also the end of a drag, restoring and fullscreen, and a light check that
    // puts the picture back if anything leaves the two windows out of step.
    for (const ev of ['resized','moved','restore','enter-full-screen','leave-full-screen','show']) win.on(ev,sync);
    const bgAlignTimer=setInterval(alignBg,600);
    win.on('closed',()=>clearInterval(bgAlignTimer));
    win.on('maximize',()=>{sync();send('win:state','maximized');});
    // Minimised or hidden: the page pauses its decorative loops (v3.30.0).
    for(const [ev,h] of [['minimize',true],['hide',true],['restore',false],['show',false]]) win.on(ev,()=>send('win:hidden',h));
    win.on('unmaximize',()=>{sync();send('win:state','normal');});
    win.loadFile(path.join(__dirname,'src','index.html'),{query:flagQuery()});
    // CSP. 'unsafe-eval' was here on the claim that Three.js and dynamic
    // imports need it. Neither does, and nothing in this codebase calls
    // eval() or new Function() — verified by grep and enforced by the
    // contract check. Removing it closes the widest hole in the policy.
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' data: blob: bmfile:; script-src 'self' 'unsafe-inline' bmfile:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: bmfile: file: https:; media-src 'self' bmfile: file: data: blob:; connect-src 'self' bmfile: file: http: https: ws: wss:; font-src 'self' data:;"]
        }
      });
    });
    const boot=makeBoot(()=>{bgWin.show();win.show();});
    win.once('ready-to-show',boot);
    setTimeout(boot,4000);
    win.on('closed',()=>{killMpv();try{bgWin?.destroy();}catch(_){}app.exit(0);});
  }
});
app.on('window-all-closed',()=>{killMpv();if(process.platform!=='darwin')app.quit();});
app.on('will-quit',killMpv);
const send=(ch,...d)=>{try{if(win&&!win.isDestroyed())win.webContents.send(ch,...d);}catch(_){}};

// ── Runtime flags ────────────────────────────────────────────────
// Several large changes have landed without ever running on real hardware:
// the bmfile:// scheme, the renderer audio engine and the GPU fluid solver.
// If the app misbehaves, the fastest way to find out which one is at fault
// is to switch them off individually, without editing code.
//
// Sources, later ones win:
//   1. userData/flags.json   {"compat": true} or individual keys
//   2. BM_COMPAT=1           environment
//   3. --compat              command line (npm run start:compat)
//
// `compat` turns every one of them off at once, which reproduces the last
// behaviour that is known to launch.
function resolveFlags() {
  // videoLayer: which window mpv draws into in the two-window layout.
  //   'back'  = the opaque window behind; the transparent front window with
  //             the controls composites over the picture.
  //   'front' = the transparent window that also holds the controls (the
  //             original v2.2.0 behaviour).
  // Seen in real Electron on Linux under a compositor: 'front' puts mpv's
  // native window on top of everything Chromium draws, so the titlebar and
  // controls vanish while video plays. 'back' shows both. Windows composites
  // Chromium above child windows, so 'front' may behave there; until that is
  // confirmed on real hardware, only Linux changes by default.
  const flags = { compat: false, fileScheme: 'bmfile', audioEngine: true, gpuFluid: true,
                  // Front mode on Windows was confirmed black by eye on a real machine.
                  videoLayer: (IS_LINUX || IS_WIN) ? 'back' : 'front' };
  try {
    const f = path.join(app.getPath('userData'), 'flags.json');
    if (fs.existsSync(f)) Object.assign(flags, JSON.parse(fs.readFileSync(f, 'utf8')));
  } catch (e) { console.warn('[main] ignoring unreadable flags.json:', e.message); }
  if (process.env.BM_COMPAT === '1') flags.compat = true;
  if (process.argv.includes('--compat')) flags.compat = true;
  if (process.argv.includes('--video-back'))  flags.videoLayer = 'back';
  if (process.argv.includes('--video-front')) flags.videoLayer = 'front';
  if (flags.compat) Object.assign(flags, { fileScheme: 'file', audioEngine: false, gpuFluid: false, videoLayer: 'front' });
  // The single-window layout has no back window to draw into.
  if (IS_LITE_BUILD || flags.videoLayer !== 'back') flags.videoLayer = 'front';
  if (flags.fileScheme !== 'file') flags.fileScheme = 'bmfile';
  return flags;
}
const FLAGS = resolveFlags();
if (FLAGS.compat) console.log('[main] compatibility mode: file://, mpv-only audio, particle background');

/** Query string the renderer reads in its boot script. */
function flagQuery() {
  return {
    fs: FLAGS.fileScheme,
    ae: FLAGS.audioEngine ? '1' : '0',
    gf: FLAGS.gpuFluid ? '1' : '0',
    compat: FLAGS.compat ? '1' : '0',
    lite: IS_LITE_BUILD ? '1' : '0',
    vl: FLAGS.videoLayer,
  };
}

// ── bmfile:// ────────────────────────────────────────────────────
// The renderer used to run with webSecurity:false so it could load local
// files directly. That disables the whole same-origin model for every
// window — a high price for what is really just "read files off disk".
//
// A custom scheme does the same job with the security model intact: the
// main process decides what gets served, and the renderer can be locked
// back down. This call has to happen before the app is ready.
protocol.registerSchemesAsPrivileged([{
  scheme: 'bmfile',
  privileges: {
    standard: true,          // parse as a normal hierarchical URL
    secure: true,            // treated as a trusted origin
    supportFetchAPI: true,   // pdf.js and the M3U loaders use fetch()
    stream: true,            // media elements need range/streaming
    bypassCSP: false,        // the CSP still applies; it lists bmfile: explicitly
    corsEnabled: true,
  },
}]);

/**
 * Serve one local file. The path arrives as a single percent-encoded
 * segment, so there is no drive-letter or separator parsing to get wrong.
 */
// The types bmfile:// states, by extension.
const BMFILE_TYPES = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.weba': 'audio/webm', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  // Scripts too: plugins load theirs through bmfile://, and a module script
  // served as octet-stream is refused (seen in the e2e suite, v3.28.0).
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.html': 'text/html', '.htm': 'text/html', '.txt': 'text/plain', '.wasm': 'application/wasm',
  '.vtt': 'text/vtt', '.srt': 'text/plain', '.ass': 'text/plain',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
async function serveBmFile(request) {
  try {
    const url = new URL(request.url);
    const raw = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!raw) return new Response('Bad request', { status: 400 });

    // Reject anything that isn't a plain existing file. Directory traversal
    // is not really meaningful here (the user can open any file they like
    // through the dialogs anyway), but serving a directory or a device node
    // is never intended.
    let st;
    try { st = fs.statSync(raw); } catch (_) { return new Response('Not found', { status: 404 }); }
    if (!st.isFile()) return new Response('Not a file', { status: 403 });

    // Byte ranges, served here (v3.28.0). This passed the request on to
    // net.fetch without its headers, so a media element's Range request got
    // the whole file back: MP3 coped (its length can be estimated), but a WAV
    // had no duration, and the music seek bar, which needs one, did nothing.
    // Streamed from disk either way, with the length and the type stated.
    const abs = path.resolve(raw), size = st.size;
    // Access-Control-Allow-Origin: the audio engine and the visualiser's
    // shadow load with crossOrigin, and an analyser is fed only zeros from a
    // response that does not allow it (v3.29.0). Only the app's own pages can
    // reach bmfile://.
    const head = { 'Content-Type': BMFILE_TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers?.get?.('range') || '');
    if (m && (m[1] || m[2])) {
      const start = m[1] ? +m[1] : Math.max(0, size - +m[2]);           // "bytes=-N": the last N
      const end = Math.min(size - 1, m[1] && m[2] ? +m[2] : size - 1);
      if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      return new Response(Readable.toWeb(fs.createReadStream(abs, { start, end })), {
        status: 206, headers: { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
    }
    return new Response(Readable.toWeb(fs.createReadStream(abs)), { status: 200, headers: { ...head, 'Content-Length': String(size) } });
  } catch (e) {
    console.error('[bmfile] failed to serve:', e);
    return new Response('Error', { status: 500 });
  }
}

let _ipcRegistered = false;

// SAFETY NET: ready-to-show is not guaranteed to fire for transparent /
// frameless windows when GPU compositing is degraded — and everything the app
// needs (show, mpv, updater, plugin dirs) was hanging off that one event.
// If it hasn't fired in 4s, boot anyway. boot() is idempotent.
function makeBoot(showFn){
  let done=false;
  return ()=>{
    if(done)return; done=true;
    try{showFn();}catch(e){console.error('[main] show failed:',e);}
    registerIpc();initMpv();setupUpdater();ensurePluginDirs();
    setTimeout(()=>send('app:firstRun',true),4000);
    setTimeout(pruneCaches,8000);
  };
}

function registerIpc(){
  // Lite: the page's video area, or null when no video is showing.
  ipcMain.on('video:rect', (e, r) => {
    if (e.sender !== win?.webContents) return;
    const ok = r && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(r[k]));
    liteVideoRect = ok ? { x: r.x, y: r.y, width: Math.max(0, r.width), height: Math.max(0, r.height) } : null;
    syncLiteVideo();
  });
  // IDEMPOTENT: registerIpc() is now called up-front in whenReady() instead of
  // from ready-to-show. ready-to-show is unreliable for transparent windows,
  // and any renderer invoke that landed before it fired got "No handler
  // registered for ..." — which app.js swallowed, producing a dead button.
  if (_ipcRegistered) return;
  _ipcRegistered = true;
  const sync=alignBg;
  ipcMain.handle('win:minimize',()=>{try{(bgWin||win)?.minimize();}catch(_){}});
  ipcMain.handle('win:maximize',()=>{if(!win)return;if(win.isFullScreen())win.setFullScreen(false);win.isMaximized()?win.unmaximize():win.maximize();});
  ipcMain.handle('win:fullscreen',()=>{if(!win||pipActive)return;if(win.isFullScreen())win.setFullScreen(false);else win.isMaximized()?win.unmaximize():win.maximize();});
  ipcMain.handle('win:close',()=>{killMpv();app.exit(0);});
  ipcMain.handle('win:alwaysTop',(_, v)=>{try{alwaysOnTopFlag=!!v;if(pipActive)return;applyOnTop(v);}catch(_){}});
  ipcMain.handle('win:isMax',()=>win?.isMaximized());
  ipcMain.handle('win:isFs',()=>win?.isFullScreen());
  ipcMain.handle('win:snap',(_,zone)=>{
    if(!win)return;
    const{workArea}=screen.getPrimaryDisplay();
    const{x,y,width:W,height:H}=workArea;
    const b={'half-left':{x,y,width:Math.floor(W/2),height:H},'half-right':{x:x+Math.floor(W/2),y,width:Math.ceil(W/2),height:H},'maximize':{x,y,width:W,height:H}}[zone];
    if(b){win.setBounds(b);if(bgWin)bgWin.setBounds(b);}
  });
  ipcMain.handle('win:theatre',()=>{if(win&&!pipActive)win.isMaximized()?win.unmaximize():win.maximize();});

  // Picture-in-Picture mode — small floating 340×200 window in bottom-right.
  //
  // IMPORTANT: unlike normal mode, PiP does NOT keep bgWin synced to win.
  // bgWin's whole purpose is providing an opaque backdrop behind win's
  // non-video regions (sidebar, menus) in the full-size UI. In PiP mode the
  // window is ALL video — so instead of syncing two separate native windows
  // in real time during a drag (which lags behind fast mouse movement and
  // produces a visible "ghosting" black area, since each cross-window bounds
  // update isn't instant), we simply hide bgWin entirely and give win its
  // own opaque background color for the duration of PiP. One window to
  // move means nothing can visually fall out of sync while dragging.
  //
  // Lite mode (v1.9.0): bgWin is null, so PiP is just a resize + always-on-
  // top toggle — no two-window sync concerns, no background color swap
  // (the window is already opaque from the start).
  ipcMain.handle('win:pip', (_, enable) => {
    if (!win) return;
    // Idempotent. A second "enter" used to overwrite the saved normal bounds
    // with the PiP bounds, so leaving PiP restored a 340x200 window that the
    // 900x560 minimum then forced open partly off screen.
    if (!!enable === pipActive) return;
    if (enable) {
      // "Fullscreen" in this app is really maximise, and setBounds on a
      // maximised window is ignored on Windows. Leave both states first and
      // remember maximise so it can be put back.
      try { if (win.isFullScreen()) win.setFullScreen(false); } catch(_){}
      pipWasMaximized = false;
      try { if (win.isMaximized()) { pipWasMaximized = true; win.unmaximize(); } } catch(_){}
      pipPrevBounds = win.getBounds();
      pipSizeIdx = 0;
      // Same monitor the app is on, not always the primary one.
      const { workArea } = screen.getDisplayMatching(pipPrevBounds);
      const W = 340, H = 200;
      const bounds = { x: workArea.x + workArea.width - W - 16, y: workArea.y + workArea.height - H - 48, width: W, height: H };
      win.setMinimumSize(240, 135);
      // 16:9 lock + resizable corners: without these the PiP window could be
      // dragged to any ratio and letterboxed the video into a sliver.
      try{ win.setAspectRatio(16/9); }catch(_){}
      try{ win.setResizable(true); }catch(_){}
      try{ win.setSkipTaskbar(true); }catch(_){}
      if (bgWin && FLAGS.videoLayer === 'back') {
        // The picture is in bgWin now. Hiding it, as PiP used to, would
        // leave the PiP window with controls and no video. Keep it behind
        // the front window instead, and on top with it, so another app can't
        // slide in between the picture and its controls.
        try { bgWin.setAlwaysOnTop(true); } catch(_){}
        // bgWin is created with a 900x560 minimum, and Electron silently
        // clamps setBounds to it. In real Electron the picture window stayed
        // 900x560 behind a 340x200 PiP window, so the video spilled out past
        // it and off the screen edge.
        try { bgWin.setMinimumSize(240, 135); } catch(_){}
      } else if (bgWin) {
        bgWin.hide();
        win.setBackgroundColor('#000000');
      } else {
        // Lite: window is already opaque black, nothing to swap.
      }
      // The PiP bar is a drag region, and double-clicking a drag region
      // maximises the window on Windows. A maximised PiP window is not PiP.
      try{ win.setMaximizable(false); }catch(_){}
      win.setBounds(bounds);
      if (bgWin && FLAGS.videoLayer === 'back') { try { bgWin.setBounds(bounds); } catch(_){} }
      win.setAlwaysOnTop(true);
      pipActive = true;
      try { videoWin?.setAlwaysOnTop(true); } catch(_){}
      // Held on top: once more as the transition settles, in case a late event
      // or Windows' owner rule took it away (see always-on-top-changed).
      for (const ms of [150, 600]) setTimeout(() => { if (!pipActive) return; for (const w of [bgWin, win, videoWin]) { try { if (w && !w.isDestroyed() && !w.isAlwaysOnTop()) w.setAlwaysOnTop(true); } catch(_){} } }, ms);
      send('win:pipState', true);
    } else {
      let prev = pipPrevBounds || { width: 1280, height: 780 };
      // If the monitor it came from has gone (laptop undocked during PiP),
      // don't restore to coordinates nobody can see.
      try {
        const onScreen = screen.getAllDisplays().some(d => {
          const a = d.workArea;
          return prev.x < a.x + a.width && prev.x + prev.width > a.x &&
                 prev.y < a.y + a.height && prev.y + prev.height > a.y;
        });
        if (!onScreen || prev.x === undefined) {
          const a = screen.getDisplayMatching(win.getBounds()).workArea;
          prev = { width: prev.width, height: prev.height,
                   x: a.x + Math.max(0, Math.round((a.width - prev.width) / 2)),
                   y: a.y + Math.max(0, Math.round((a.height - prev.height) / 2)) };
        }
      } catch(_){}
      try{ win.setMaximizable(true); }catch(_){}
      try{ win.setAspectRatio(0); }catch(_){}      // release the 16:9 lock
      try{ win.setSkipTaskbar(false); }catch(_){}
      win.setMinimumSize(900, 560);
      if (bgWin && FLAGS.videoLayer === 'back') {
        // Order matters. The front window used to drop always-on-top first,
        // while the picture window was still on top, so the picture ended up
        // above the controls. Seen in real Electron: after leaving PiP the
        // video covered the titlebar and, once stopped, the app showed black.
        // Drop the picture window first, and don't show() it: it was never
        // hidden in this layout, and show() raises it.
        try { bgWin.setAlwaysOnTop(alwaysOnTopFlag); } catch(_){}
        try { bgWin.setMinimumSize(900, 560); } catch(_){}
        bgWin.setBounds(prev);
        win.setAlwaysOnTop(alwaysOnTopFlag);
      } else {
        win.setAlwaysOnTop(alwaysOnTopFlag);
        if (bgWin) {
          win.setBackgroundColor('#00000000');
          bgWin.setBounds(prev);
          bgWin.show();
        }
      }
      win.setBounds(prev);
      // The controls window must end up above the picture window, whatever
      // the window manager did along the way.
      try { win.moveTop(); } catch(_){}
      if (pipWasMaximized) { try { win.maximize(); } catch(_){} }
      pipActive = false;
      send('win:pipState', false);
    }
  });
  // Cycle PiP between three sizes, keeping the corner it's anchored to so it
  // grows away from the screen edge rather than off it.
  ipcMain.handle('win:pipSize', () => {
    if (!win || !pipActive) return null;
    const SIZES = [[340, 200], [480, 270], [640, 360]];
    pipSizeIdx = (pipSizeIdx + 1) % SIZES.length;
    const [w, h] = SIZES[pipSizeIdx];
    const b = win.getBounds();
    const a = screen.getDisplayMatching(b).workArea;
    const right = b.x + b.width, bottom = b.y + b.height;
    let x = right - w, y = bottom - h;
    x = Math.max(a.x, Math.min(x, a.x + a.width - w));
    y = Math.max(a.y, Math.min(y, a.y + a.height - h));
    win.setBounds({ x, y, width: w, height: h });
    if (bgWin && FLAGS.videoLayer === 'back') { try { bgWin.setBounds({ x, y, width: w, height: h }); } catch(_){} }
    return { width: w, height: h };
  });
  // Force the window to front/focused before opening native dialogs — on
  // Windows, frameless+transparent windows can otherwise cause the OS file
  // picker to open BEHIND the app. Plain focus()/moveTop() alone is a
  // commonly-insufficient fix for this; briefly pulsing alwaysOnTop forces
  // a true OS-level foreground transition, and the short delay lets that
  // transition actually complete before the dialog attaches.
  const focusWin = async () => {
    try {
      if (win.isMinimized()) win.restore();
      win.show();
      win.setAlwaysOnTop(true);
      win.moveTop();
      win.focus();
      await new Promise(r => setTimeout(r, 60));
      applyOnTop(alwaysOnTopFlag); // the user's actual preference, on every window
    } catch(_) {}
  };

  ipcMain.handle('dialog:open',async()=>{await focusWin();const r=await openDialog({title:'Open Media',properties:['openFile','multiSelections'],filters:[{name:'Media',extensions:[...MEDIA]},{name:'All',extensions:['*']}]});return r.canceled?[]:r.filePaths;});
  ipcMain.handle('dialog:openSub',async()=>{await focusWin();const r=await openDialog({title:'Add Subtitle',properties:['openFile'],filters:[{name:'Subtitles',extensions:['srt','ass','ssa','vtt','sub','idx','sup','mks','ttml','dfxp']}]});return r.canceled?null:r.filePaths[0];});
  ipcMain.handle('dialog:openPDF',async()=>{
    try{
      await focusWin();
      const r=await openDialog({title:'Open PDF',properties:['openFile'],filters:[{name:'PDF',extensions:['pdf']}]});
      return r.canceled?null:r.filePaths[0];
    }catch(e){
      console.error('[main] dialog:openPDF failed:',e);
      throw new Error('PDF dialog failed: '+e.message);
    }
  });
  ipcMain.handle('dialog:savePDF',async(_,defaultName)=>{await focusWin();const r=await saveDialog({title:'Save PDF As',defaultPath:defaultName||'document.pdf',filters:[{name:'PDF Documents',extensions:['pdf']}]});return r.canceled?null:r.filePath;});
  ipcMain.handle('dialog:openM3u',async()=>{await focusWin();const r=await openDialog({title:'Open M3U Playlist',properties:['openFile'],filters:[{name:'Playlists',extensions:['m3u','m3u8']},{name:'All',extensions:['*']}]});return r.canceled?null:r.filePaths[0];});
  ipcMain.handle('dialog:saveM3u',async(_,defaultName)=>{await focusWin();const r=await saveDialog({title:'Save Playlist As',defaultPath:defaultName||'playlist.m3u',filters:[{name:'M3U Playlist',extensions:['m3u']}]});return r.canceled?null:r.filePath;});
  ipcMain.handle('pdf:writeFile',async(_,filePath,data)=>{try{fs.writeFileSync(filePath,Buffer.from(data));return{success:true};}catch(e){return{error:e.message};}});

  // ── Plugin system IPC ────────────────────────────────────────────
  ipcMain.handle('plugins:list', () => scanPlugins());
  ipcMain.handle('plugins:setEnabled', async (_, id, enabled) => {
    const p = scanPlugins().find(x => x.id === id);
    if (!p) return scanPlugins();
    const state = readPluginState();
    if (!enabled) state[id] = p.needsApproval ? { enabled: false } : false;
    else if (p.needsApproval) {
      // The approval comes from a native dialog, which page code cannot click.
      const r = await messageBox({ type: 'warning', buttons: ['Cancel', 'Turn on'], defaultId: 0, cancelId: 0, noLink: true,
        title: 'Turn on a script plugin?', message: `Turn on "${p.name}"?`,
        detail: 'Script plugins run inside BM Player with its full access: your files, playback, and everything the player can do. ' +
                'Only turn on plugins you wrote yourself or trust completely.\n\nIf any of its files change later, it will be switched off until you approve it again.' });
      if (!r || r.response !== 1) return scanPlugins();
      const digest = PS.folderDigest(p.dir);
      if (!digest) return scanPlugins();
      state[id] = { enabled: true, digest };
    } else state[id] = true;
    writePluginState(state);
    return scanPlugins();
  });
  // Theme CSS goes to the page already cleaned: nothing in it can load anything.
  ipcMain.handle('plugins:css', (_, id) => {
    const p = scanPlugins().find(x => x.id === id && x.type === 'theme' && x.enabled);
    if (!p) return '';
    try { return PS.cleanCss(fs.readFileSync(p.cssPath, 'utf8')); } catch(_) { return ''; }
  });
  ipcMain.handle('plugins:openFolder', () => {
    const userPluginsDir = getPluginDirs()[1];
    try { fs.mkdirSync(userPluginsDir, { recursive: true }); } catch(_) {}
    installPluginTemplates(userPluginsDir);
    shell.openPath(userPluginsDir);
  });
  ipcMain.handle('mpv:cmd',async(_,c,...a)=>mpvCmd(c,...a).catch(e=>({error:e.message})));
  ipcMain.handle('mpv:open',async(_,files)=>openFiles(files));
  ipcMain.handle('mpv:append',async(_,f)=>mpvCmd('loadfile',f,'append').catch(()=>{}));
  ipcMain.handle('mpv:status',()=>({ready:ipcOk}));
  ipcMain.handle('mpv:getPlaylist',async()=>{try{return await mpvCmd('get_property','playlist');}catch(_){return[];}});
  ipcMain.handle('show-context-menu',async()=>{
    if(ipcOk){try{const t=await mpvCmd('get_property','track-list');if(Array.isArray(t))trackList=t;}catch(_){}}
    send('mpv:trackList',trackList);
  });
  ipcMain.handle('adj:subDelay',(_,d)=>{if(d===0)currentSubDelay=0;else currentSubDelay+=d;mpvCmd('set_property','sub-delay',currentSubDelay).catch(()=>{});send('mpv:prop',{name:'sub-delay',data:currentSubDelay});});
  ipcMain.handle('adj:audioDelay',(_,d)=>{if(d===0)currentAudioDelay=0;else currentAudioDelay+=d;mpvCmd('set_property','audio-delay',currentAudioDelay).catch(()=>{});send('mpv:prop',{name:'audio-delay',data:currentAudioDelay});});
  ipcMain.handle('reset:subDelay',()=>{currentSubDelay=0;mpvCmd('set_property','sub-delay',0).catch(()=>{});});
  ipcMain.handle('reset:audioDelay',()=>{currentAudioDelay=0;mpvCmd('set_property','audio-delay',0).catch(()=>{});});
  ipcMain.handle('app:version',()=>app.getVersion());
  // Only web pages and email. Any address went straight to the operating
  // system, so a plugin could have launched any registered protocol handler.
  ipcMain.handle('app:external',(_,u)=>{ const safe = PS.safeExternalUrl(u); return safe ? shell.openExternal(safe).then(()=>true, ()=>false) : false; });
  // ── v1.9.0: Lite mode info ────────────────────────────────────
  // Renderer asks for the build-time lite flag on boot (before the renderer
  // has a chance to do its own auto-detect). Returns:
  //   { liteBuild: bool, envLite: bool, platform, arch, appPath, packaged }
  ipcMain.handle('app:perfInfo', () => ({
    liteBuild: IS_LITE_BUILD,
    envLite: process.env.BM_LITE === '1',
    platform: process.platform,
    arch: process.arch,
    appPath: app.getAppPath(),
    packaged: app.isPackaged,
    cpuCount: os.cpus()?.length || null,
    totalMemGB: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10,
    freeMemGB: Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10,
  }));
  // Everything a bug report needs, in one place: versions, where mpv was
  // found (or wasn't), GPU status, cache sizes, and what the window is
  // actually configured with.
  ipcMain.handle('app:diagnostics', async () => {
    const mpvExe = getMpv();
    const dirSize = sub => {
      try {
        const d = path.join(app.getPath('userData'), sub);
        if (!fs.existsSync(d)) return 0;
        return fs.readdirSync(d).reduce((n, f) => {
          try { return n + fs.statSync(path.join(d, f)).size; } catch (_) { return n; }
        }, 0);
      } catch (_) { return 0; }
    };
    let gpu = null;
    try { gpu = await app.getGPUInfo('basic'); } catch (e) { gpu = { error: e.message }; }

    // Where the windows are: the picture window must cover the controls window
    // exactly (v3.26.1). Copy report while the problem shows to see it.
    const wInfo = w => (w && !w.isDestroyed()) ? { content: w.getContentBounds(), bounds: w.getBounds(), maximized: !!w.isMaximized?.(), fullscreen: !!w.isFullScreen?.() } : null;
    let scale = null; try { scale = screen.getDisplayMatching(win.getBounds()).scaleFactor; } catch (_) {}
    return {
      windows: { controls: wInfo(win), picture: wInfo(bgWin), liteVideo: wInfo(videoWin), scale },
      flags: { ...FLAGS, mpvVo: MPV_VO || 'default', chromiumSwitches: CHROMIUM_SWITCHES },
      app: {
        version: app.getVersion(),
        packaged: app.isPackaged,
        liteBuild: IS_LITE_BUILD,
        appPath: app.getAppPath(),
        userData: app.getPath('userData'),
      },
      versions: {
        electron: process.versions.electron,
        chrome:   process.versions.chrome,
        node:     process.versions.node,
        v8:       process.versions.v8,
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        release: os.release(),
        cpu: (os.cpus()[0] || {}).model || null,
        cpuCount: os.cpus().length,
        totalMemGB: Math.round(os.totalmem() / 1073741824 * 10) / 10,
        freeMemGB:  Math.round(os.freemem()  / 1073741824 * 10) / 10,
      },
      mpv: {
        found: !!mpvExe,
        path: mpvExe,
        version: getMpvVersion(mpvExe),
        connected: !!mpvSock && !mpvSock.destroyed,
        searchedPath: !!process.env.PATH,
      },
      gpu,
      caches: {
        thumbsMB: Math.round(dirSize('thumbs') / 1048576 * 10) / 10,
        coversMB: Math.round(dirSize('covers') / 1048576 * 10) / 10,
      },
      window: (() => {
        const w = win;
        if (!w) return null;
        try {
          return {
            transparent: !!(w.opts ? w.opts.transparent : undefined),
            visible: w.isVisible(),
            bounds: w.getBounds(),
          };
        } catch (_) { return null; }
      })(),
      errorLog: (() => {
        try {
          const f = path.join(app.getPath('userData'), 'main-errors.log');
          if (!fs.existsSync(f)) return null;
          const t = fs.readFileSync(f, 'utf8').trim().split('\n');
          return { lines: t.length, tail: t.slice(-5) };
        } catch (_) { return null; }
      })(),
    };
  });

  ipcMain.handle('app:addRecent',(_,f)=>{try{app.addRecentDocument(f);}catch(_){}});
  ipcMain.handle('app:checkUpdate',async()=>{if(process.platform==='darwin')return{error:'On a Mac, download new versions from github.com/BritMat/bm-player/releases'};try{return await autoUpdater.checkForUpdates();}catch(e){return{error:e.message};}});
  ipcMain.handle('app:installUpdate',()=>autoUpdater.quitAndInstall(false,true));
  ipcMain.handle('app:isDefault',()=>app.isDefaultProtocolClient('bm-player'));
  ipcMain.handle('app:setDefault',()=>{try{app.setAsDefaultProtocolClient('bm-player');}catch(_){}});

  // createThumbnailFromPath uses the OS thumbnailer — Windows and macOS only.
  // On Linux it throws, we return null, and the renderer falls back to the
  // original file. No crash, just no cache.
  ipcMain.handle('gallery:thumb', async (_, filePath, size) => {
    size = size || 400;
    try{
      if(!filePath || !fs.existsSync(filePath)) return null;
      const st = fs.statSync(filePath);
      // JPEG (v3.32.0): a photo thumbnail as PNG was slow to write and large to load.
      const out = path.join(cacheDir('thumbs'), cacheKey(filePath, st.size, st.mtimeMs, size) + '.jpg');
      if (fs.existsSync(out)) return out;
      const img = await nativeImage.createThumbnailFromPath(filePath, { width: size, height: size });
      if (!img || img.isEmpty()) return null;
      fs.writeFileSync(out, img.toJPEG(84));
      return out;
    }catch(_){ return null; }
  });

  // The album art for one file (v3.32.0): its own, embedded (read as the tags
  // are, kept in the same covers cache), or a cover image beside it: cover,
  // folder, front or album, as .jpg, .png or .webp. A path, or null.
  ipcMain.handle('media:art', async (_, fp) => {
    try{
      if (typeof fp !== 'string' || !fp || !fs.existsSync(fp)) return null;
      try{
        const md = await require('music-metadata').parseFile(fp, { duration: false, skipCovers: false });
        const pic = md.common && md.common.picture && md.common.picture[0];
        if (pic && pic.data) {
          const ext = (pic.format || 'image/jpeg').split('/').pop().replace('jpeg','jpg');
          const cp = path.join(cacheDir('covers'), cacheKey(fp, pic.data.length) + '.' + ext);
          if (!fs.existsSync(cp)) fs.writeFileSync(cp, pic.data);
          return cp;
        }
      }catch(_){}
      const dir = path.dirname(fp), hit = fs.readdirSync(dir).find(n => /^(cover|folder|front|album)\.(jpe?g|png|webp)$/i.test(n));
      return hit ? path.join(dir, hit) : null;
    }catch(_){ return null; }
  });

  // ── Audio tags ─────────────────────────────────────────────────
  // Track names came from filenames run through a regex. Real ID3/Vorbis/MP4
  // tags give title, artist, album, track number, duration and embedded art.
  ipcMain.handle('music:tags', async (_, filePaths) => {
    let mm;
    try { mm = require('music-metadata'); }
    catch(e){ console.warn('[main] music-metadata not installed — run npm install'); return []; }
    const list = Array.isArray(filePaths) ? filePaths.slice(0, 300) : [];
    const out = [];
    for (const fp of list) {
      try{
        const md = await mm.parseFile(fp, { duration: true, skipCovers: false });
        const c = md.common || {}, f = md.format || {};
        let cover = null;
        const pic = c.picture && c.picture[0];
        if (pic && pic.data) {
          const ext = (pic.format || 'image/jpeg').split('/').pop().replace('jpeg','jpg');
          const cp = path.join(cacheDir('covers'), cacheKey(fp, pic.data.length) + '.' + ext);
          if (!fs.existsSync(cp)) fs.writeFileSync(cp, Buffer.from(pic.data));
          cover = cp;
        }
        out.push({
          path: fp,
          title:  c.title  || null,
          artist: c.artist || c.albumartist || null,
          album:  c.album  || null,
          year:   c.year   || null,
          trackNo: (c.track && c.track.no) || null,
          duration: f.duration || null,
          bitrate:  f.bitrate ? Math.round(f.bitrate/1000) : null,
          cover
        });
      }catch(_){ out.push({ path: fp }); }
    }
    return out;
  });

  ipcMain.handle('gallery:browse',async()=>{
    try{
      await focusWin();
      const r=await openDialog({title:'Select Folder',properties:['openDirectory']});
      return r.canceled?null:r.filePaths[0];
    }catch(e){
      console.error('[main] gallery:browse failed:',e);
      // Rejecting is what the renderer needs — an undefined return is
      // indistinguishable from the user pressing Cancel.
      throw new Error('Folder dialog failed: '+e.message);
    }
  });
  // RECURSIVE: the old scan was readdirSync on the top level only, so any music
  // library laid out as Artist/Album/*.flac came back empty. Depth + count are
  // capped so pointing this at C:\\ can't hang the renderer.
  ipcMain.handle('gallery:scan',async(_,folderPath)=>{
    if(!folderPath||!fs.existsSync(folderPath))return[];
    const ALL=new Set(['jpg','jpeg','png','webp','gif','bmp','tiff','avif','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka','m4b']);
    const MAX_FILES=8000, MAX_DEPTH=6;
    const out=[];
    const walk=(dir,depth)=>{
      if(depth>MAX_DEPTH||out.length>=MAX_FILES)return;
      let entries;
      try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch(_){return;}
      for(const e of entries){
        if(out.length>=MAX_FILES)return;
        if(e.name.startsWith('.'))continue;
        const full=path.join(dir,e.name);
        if(e.isDirectory()){walk(full,depth+1);}
        else if(e.isFile()&&ALL.has(path.extname(e.name).slice(1).toLowerCase())){
          // size/mtime feed the new Size and Newest sort modes and the
          // lightbox info drawer. statSync per file is the cost of the scan
          // being useful; it's already bounded by MAX_FILES.
          let size=0, mtime=0;
          try{ const st=fs.statSync(full); size=st.size; mtime=st.mtimeMs; }catch(_){}
          out.push({path:full,name:e.name,dir,size,mtime});
        }
      }
    };
    walk(folderPath,0);
    return out;
  });
}


// ── Thumbnail + cover art cache ──────────────────────────────────
// Pointing the gallery straight at originals meant a folder of 24MP JPEGs
// decoded full-resolution into renderer memory. Thumbnails are generated once
// and cached on disk, keyed by path+size+mtime so edits invalidate cleanly.
function cacheDir(sub){
  const d = path.join(app.getPath('userData'), sub);
  try { fs.mkdirSync(d, { recursive: true }); } catch(_) {}
  return d;
}
// The thumbnail and cover caches were never trimmed (v3.33.0): files unused
// for 90 days go, and each cache is kept under 300 MB, oldest first. Run once,
// half a minute after start, in the background.
function pruneCache(sub, maxBytes = 300 * 1024 * 1024, maxDays = 90){
  fs.promises.readdir(cacheDir(sub)).then(async names => {
    const dir = cacheDir(sub), cut = Date.now() - maxDays * 86400000, files = [];
    for (const n of names) {
      try { const st = await fs.promises.stat(path.join(dir, n)); if (st.isFile()) files.push({ p: path.join(dir, n), t: Math.max(st.atimeMs, st.mtimeMs), size: st.size }); } catch(_) {}
    }
    files.sort((a, b) => a.t - b.t);
    let total = files.reduce((s, f) => s + f.size, 0);
    for (const f of files) {
      if (f.t >= cut && total <= maxBytes) break;
      try { await fs.promises.unlink(f.p); total -= f.size; } catch(_) {}
    }
  }).catch(() => {});
}
function cacheKey(){
  return crypto.createHash('sha1').update([...arguments].join('|')).digest('hex');
}

// The thumbnail and cover caches are write-only — nothing ever removed an
// entry, so browsing a few large photo folders grew userData without limit.
// Trim oldest-first on startup, off the critical path.
// Main-process failures had nowhere to go in a packaged build: no terminal,
// and DevTools only shows the renderer. Append them to a file the user can
// actually be asked for.
function logFatal(kind, e) {
  const line = `[${new Date().toISOString()}] ${kind}: ${e && (e.stack || e.message) || e}\n`;
  try {
    const f = path.join(app.getPath('userData'), 'main-errors.log');
    // Keep it from growing without bound across a long-lived install.
    try { if (fs.statSync(f).size > 512 * 1024) fs.renameSync(f, f + '.1'); } catch (_) {}
    fs.appendFileSync(f, line);
  } catch (_) {}
  console.error(line.trim());
}
process.on('uncaughtException',  e => logFatal('uncaughtException', e));
process.on('unhandledRejection', e => logFatal('unhandledRejection', e));

function pruneCaches(){
  const LIMITS = { thumbs: 300 * 1024 * 1024, covers: 60 * 1024 * 1024 };
  for (const [name, limit] of Object.entries(LIMITS)) {
    try{
      const dir = path.join(app.getPath('userData'), name);
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).map(f => {
        const full = path.join(dir, f);
        try { const st = fs.statSync(full); return { full, size: st.size, atime: st.atimeMs }; }
        catch(_) { return null; }
      }).filter(Boolean);
      let total = files.reduce((n, f) => n + f.size, 0);
      if (total <= limit) continue;
      files.sort((a, b) => a.atime - b.atime);          // least recently used first
      for (const f of files) {
        if (total <= limit * 0.8) break;
        try { fs.unlinkSync(f.full); total -= f.size; } catch(_) {}
      }
      console.log('[main] pruned ' + name + ' cache to ' + Math.round(total / 1048576) + ' MB');
    }catch(e){ console.warn('[main] cache prune failed for ' + name + ':', e.message); }
  }
}

function setupUpdater(){
  // No feed is configured unless electron-builder wrote app-update.yml into
  // the packaged resources. Running the check anyway guarantees an error
  // event on every launch, which the renderer then shows as a failed update.
  if (!app.isPackaged) { console.log('[main] updater disabled in development'); return; }
  const feed = path.join(process.resourcesPath || '', 'app-update.yml');
  if (!fs.existsSync(feed)) {
    console.log('[main] no app-update.yml — updater disabled (add a publish target to electron-builder.yml)');
    return;
  }
  autoUpdater.on('update-available',info=>send('updater:status',{state:'available',ver:info.version}));
  autoUpdater.on('download-progress',p=>send('updater:status',{state:'progress',pct:Math.round(p.percent)}));
  autoUpdater.on('update-downloaded',info=>send('updater:status',{state:'ready',ver:info.version}));
  autoUpdater.on('error',err=>send('updater:status',{state:'error',msg:err.message}));
  // Not on a Mac (v3.27.0): an app updates itself there only when signed with
  // an Apple Developer ID, which this build is not, and the check failed with
  // "Cannot find latest-mac.yml" at every start (and stopped the Mac release).
  if (process.platform !== 'darwin') setTimeout(()=>{try{autoUpdater.checkForUpdates();}catch(_){}},12000);
}

// mpv binary discovery — checks the app-bundled copy first (vendor/mpv,
// same convention on every OS), then falls back to common system install
// locations so users with mpv already installed via a package manager
// (brew, apt) don't need a bundled copy at all.
const MPV_BIN = IS_WIN ? 'mpv.exe' : 'mpv';
function getMpv() {
  const candidates = [
    path.join(process.resourcesPath || '', 'mpv', MPV_BIN),
    path.join(__dirname, 'vendor', 'mpv', MPV_BIN),
    path.join(__dirname, 'bin', MPV_BIN),
  ];
  if (IS_MAC)   candidates.push('/opt/homebrew/bin/mpv', '/usr/local/bin/mpv');
  if (IS_LINUX) candidates.push('/usr/bin/mpv', '/usr/local/bin/mpv', '/snap/bin/mpv',
                                '/var/lib/flatpak/exports/bin/io.mpv.Mpv');

  // PATH, which winget / scoop / chocolatey / apt / brew all rely on.
  // On Windows only mpv.exe will do. This used to follow PATHEXT, which puts
  // .COM first, so it picked mpv.com: a console launcher that starts mpv.exe
  // as a child. Stopping the launcher leaves the real player running. And
  // since Node 20.12.2, .cmd and .bat shims can't be spawned without a shell.
  // Seen on a real Windows machine, where the mpv found was mpv.com.
  const sep = IS_WIN ? ';' : ':';
  const exts = IS_WIN ? ['.exe'] : [''];
  for (const dir of (process.env.PATH || '').split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      const base = IS_WIN ? 'mpv' + ext.toLowerCase() : 'mpv';
      candidates.push(path.join(dir.replace(/^"|"$/g, ''), base));
    }
  }

  return candidates.find(p => {
    try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch(_) { return false; }
  }) || null;
}

/** Ask mpv what version it is. Null when it can't be run at all. */
function getMpvVersion(exe) {
  if (!exe) return null;
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync(exe, ['--version'], { timeout: 4000, windowsHide: true }).toString();
    return (out.split('\n')[0] || '').trim() || null;
  } catch (_) { return null; }
}
function initMpv(){const exe=getMpv();if(!exe){send('mpv:status',{state:'missing'});return;}startMpv(exe);}

// Reads the native window handle into the numeric ID mpv's --wid expects.
// Windows (HWND) and Linux/X11 (XID) are 32-bit values; macOS (NSView*) is
// a 64-bit pointer, so it needs a wider read or precision is silently lost.
// NOTE: macOS window embedding via --wid is documented by mpv as less
// mature than the Windows/X11 path — this is implemented per mpv's public
// docs but has not been verified on real Mac hardware from this environment.
// The picture window (bgWin) must cover exactly what the controls window
// shows. It followed win.getBounds(), the window rectangle, on resize and move
// only, and on a real machine the picture ended about 8px short of the right
// and bottom edges, the desktop showing through there like frosted glass
// (v3.26.1). Content bounds are what each window actually shows, whatever its
// state (maximised, snapped, any display scale). Only acts on a difference.
// A display scale can round the two windows a pixel apart however they are
// asked: then it is left as the system settles it, rather than resized again
// at every check. It acts again when the target changes or the picture window
// drifts from what it settled at.
let bgAsked = '', bgSettled = '';
// The pin, on every BM window at once (v3.27.0). It used to go to the picture
// window only, while focusWin() (before every file dialog) left the controls
// window on top along with the pin: turning the pin off then left the window
// you see above everything until a restart.
function applyOnTop(v) {
  alwaysOnTopFlag = !!v;
  for (const w of [bgWin, win, videoWin]) { try { if (w && !w.isDestroyed()) w.setAlwaysOnTop(alwaysOnTopFlag); } catch (_) {} }
}

function alignBg() {
  if (!bgWin || !win || bgWin.isDestroyed() || win.isDestroyed()) return;
  try {
    const key = b => b.x + ',' + b.y + ',' + b.width + ',' + b.height;
    const want = win.getContentBounds(), have = bgWin.getContentBounds();
    if (key(have) === key(want) || (bgAsked === key(want) && bgSettled === key(have))) return;
    bgWin.setContentBounds(want);
    bgAsked = key(want); bgSettled = key(bgWin.getContentBounds());
  } catch (_) {}
}

function videoWindow() {
  if (IS_LITE_BUILD && videoWin) return videoWin;
  return (FLAGS.videoLayer === 'back' && bgWin) ? bgWin : win;
}
// Fits the Lite video window over the rectangle the page reports (its video
// area, in page pixels), or hides it when no video is showing.
function syncLiteVideo() {
  if (!videoWin || videoWin.isDestroyed() || !win || win.isDestroyed()) return;
  try {
    const r = liteVideoRect;
    if (!r || win.isMinimized() || !win.isVisible() || r.width < 2 || r.height < 2) { videoWin.hide(); return; }
    const cb = win.getContentBounds();
    videoWin.setBounds({ x: Math.round(cb.x + r.x), y: Math.round(cb.y + r.y), width: Math.round(r.width), height: Math.round(r.height) });
    if (!videoWin.isVisible()) {
      videoWin.showInactive();
      // A window manager may place a window as it first appears, ignoring the
      // position asked for before: ask again once it is on screen.
      videoWin.setBounds({ x: Math.round(cb.x + r.x), y: Math.round(cb.y + r.y), width: Math.round(r.width), height: Math.round(r.height) });
    }
    // Above the Lite window. Windows and macOS keep an owned window above its
    // owner anyway; on Linux that is the window manager's job, and without
    // one (or when the app raises its window on opening a file) the picture
    // ended up underneath the page.
    videoWin.moveTop();
  } catch (_) {}
}
function getWid() {
  const buf = videoWindow().getNativeWindowHandle();
  if (IS_MAC) return buf.readBigUInt64LE(0).toString();
  return buf.readInt32LE(0);
}

function startMpv(exe, minimalArgs){
  killMpv();
  // Clean up a stale socket file from a previous crashed run (Unix only —
  // named pipes on Windows don't leave a filesystem artifact like this).
  if (!IS_WIN) { try { fs.unlinkSync(PIPE); } catch(_) {} }

  const wid = getWid();
  const coreArgs = [
    `--input-ipc-server=${PIPE}`, `--wid=${wid}`,
    '--idle=yes', '--keep-open=yes', '--no-border', '--osd-level=0',
    '--hwdec=auto-safe',
    // A trailing comma tells mpv to fall back if the listed outputs fail.
    // With a single output and no fallback, a machine whose GPU output can't
    // start (old driver, VM, remote desktop) failed every file silently.
    // Verified against real mpv 0.37: plain --vo=gpu exits with "Errors when
    // loading file" where no GPU context exists, --vo=gpu, recovers. On
    // Linux, xv and x11 are listed explicitly because they can draw inside
    // the app's window via --wid.
    // --mpv-vo=<list> (or "mpvVo" in flags.json) picks mpv's video output, so
    // a machine where the default draws nothing can be tested and fixed
    // without a new build.
    // Windows used direct3d, mpv's legacy Direct3D 9 output. On a real Windows
    // 11 machine it played sound with a black picture inside the app while
    // the same mpv showed the picture in its own window. gpu-next is mpv's
    // own default there now; the list falls back to gpu, then direct3d.
    MPV_VO ? `--vo=${MPV_VO}` : (IS_WIN ? '--vo=gpu-next,gpu,direct3d,' : (IS_LINUX ? '--vo=gpu,xv,x11,' : '--vo=gpu,')),
    ...(MPV_AO ? [`--ao=${MPV_AO}`] : []),
    '--volume=100',
  ];
  const extraArgs = [
    '--sub-auto=fuzzy',
    '--sub-ass-override=force', '--sub-use-margins=yes', '--sub-margin-y=90',
    '--sub-bold=yes',
    // Let Electron's DOM handle mouse/keyboard input instead of mpv's own
    // embedded VO surface swallowing it — without these, right-click and
    // other input on the video area never reaches the app's own context
    // menu / shortcut handling. Deliberately NOT including
    // --input-media-keys here: unlike the other two, media-key support is
    // often conditionally compiled per platform/build, making it the most
    // likely of the three to be genuinely unrecognized and fail the launch.
    '--input-cursor=no', '--input-vo-keyboard=no',
    ...(IS_WIN ? ['--sub-font=Segoe UI'] : []),
    '--sub-font-size=44', '--sub-shadow-offset=2', '--sub-border-size=3',
    '--sub-color=1.0/1.0/1.0/1.0',
  ];
  const args = minimalArgs ? coreArgs : [...coreArgs, ...extraArgs];

  const spawnedAt = Date.now();
  mpvProc = spawn(exe, args, { stdio: 'ignore', windowsHide: true });
  mpvProc.on('exit', code => {
    ipcOk = false;
    const aliveMs = Date.now() - spawnedAt;
    const cleanExit = (code === 0 || code === null);

    if (cleanExit) { send('mpv:status', { state: 'crashed' }); return; }

    // A launch that dies almost immediately (under 2.5s) means mpv rejected
    // something about how it was started — a bad CLI flag, a missing codec
    // library, etc — NOT a runtime crash after genuine playback. Retrying
    // with identical args forever just loops the same failure endlessly.
    const isFastFail = aliveMs < 2500;

    if (isFastFail && !minimalArgs) {
      // One-shot fallback: retry with only the essential flags, dropping
      // every optional/convenience flag that could plausibly be rejected.
      send('mpv:status', { state: 'retrying-minimal' });
      setTimeout(() => startMpv(exe, /* minimalArgs */ true), 400);
    } else if (isFastFail && minimalArgs) {
      // Even the minimal, maximally-compatible arg set failed fast — this
      // points to something more fundamental (broken mpv binary, missing
      // shared library, incompatible OS) rather than any specific flag.
      // Stop looping and surface a diagnosable state instead of crash-
      // restarting forever with no way for the user to tell what's wrong.
      send('mpv:status', { state: 'crash-loop' });
    } else {
      // Ran for a while first, then genuinely crashed — the previous
      // simple auto-restart behavior is the right response here.
      send('mpv:status', { state: 'crashed' });
      setTimeout(() => initMpv(), 2000);
    }
  });
  setTimeout(()=>connectIpc(),1500);
}
function connectIpc(retry=0){
  if(!mpvProc||mpvProc.killed)return;
  try{mpvSock?.destroy();}catch(_){}
  mpvSock=net.createConnection(PIPE);
  mpvSock.on('connect',()=>{
    ipcOk=true;voLocked=false;send('mpv:status',{state:'ready'});
    if(pendingOpenFile){const f=pendingOpenFile;pendingOpenFile=null;openFiles([f]);}
    if(pendingOpenFiles){const f=pendingOpenFiles;pendingOpenFiles=null;openFiles(f);}
    [[1,'pause'],[2,'time-pos'],[3,'duration'],[4,'volume'],[5,'mute'],[6,'media-title'],[7,'filename'],[8,'track-list'],[9,'playlist-pos'],[10,'playlist-count'],[11,'sub-delay'],[12,'audio-delay'],[13,'speed'],[14,'video-params'],[15,'audio-params'],[16,'video-codec'],[17,'audio-codec'],[18,'file-size'],[19,'container-format'],[20,'video-bitrate'],[21,'audio-bitrate'],[22,'chapter-list'],[23,'chapter'],[24,'loop-file'],[25,'loop-playlist'],[26,'demuxer-cache-state'],[27,'eof-reached'],[28,'idle-active'],[29,'current-vo']]
    .forEach(([id,name])=>{try{mpvSock.write(JSON.stringify({command:['observe_property',id,name]})+'\n');}catch(_){}});
  });
  mpvSock.on('data',chunk=>{
    mpvBuf+=chunk.toString();let nl;
    while((nl=mpvBuf.indexOf('\n'))!==-1){const line=mpvBuf.slice(0,nl).trim();mpvBuf=mpvBuf.slice(nl+1);if(line){try{handleMsg(JSON.parse(line));}catch(_){}}}
  });
  mpvSock.on('error',e=>{if((e.code==='ENOENT'||e.code==='ECONNREFUSED')&&retry<20)setTimeout(()=>connectIpc(retry+1),500);});
  mpvSock.on('close',()=>{ipcOk=false;if(mpvProc&&!mpvProc.killed)setTimeout(()=>connectIpc(),2500);});
}
// Lock in the video output that worked. With a list such as gpu,xv,x11, mpv
// tries each output again for every file. Where gpu fails (Linux without
// GPU acceleration), mpv's cleanup of the failed attempt calls close(0):
// the first time it closes stdin, and the time after it closes the video
// file that was given handle 0, which then reads as empty. So stopping a
// video and opening it again jumped straight to its end. Found with strace.
// Once an output has worked, later files use it and skip the failing one.
let voLocked=false;
function handleMsg(msg){
  if(msg.request_id!==undefined){const cb=cbs.get(msg.request_id);if(cb){cbs.delete(msg.request_id);msg.error&&msg.error!=='success'?cb.rej(new Error(msg.error)):cb.res(msg.data);}return;}
  if(!msg.event)return;
  if(msg.event==='property-change'){
    if(msg.name==='current-vo'&&msg.data&&!voLocked){voLocked=true;mpvCmd('set_property','vo',msg.data).catch(()=>{});}
    if(msg.name==='track-list')trackList=Array.isArray(msg.data)?msg.data:[];
    if(msg.name==='sub-delay')currentSubDelay=msg.data??0;
    if(msg.name==='audio-delay')currentAudioDelay=msg.data??0;
    if(['video-params','audio-params','video-codec','audio-codec','file-size','container-format','video-bitrate','audio-bitrate','duration','chapter-list','filename'].includes(msg.name)){mediaProps[msg.name]=msg.data;send('mpv:mediaProps',mediaProps);}
  }
  send('mpv:event',msg);
  if(msg.event==='property-change')send('mpv:prop',{name:msg.name,data:msg.data});
}
function mpvCmd(cmd,...args){return new Promise((res,rej)=>{if(!ipcOk||!mpvSock)return rej(new Error('mpv not ready'));const id=++reqId;cbs.set(id,{res,rej});try{mpvSock.write(JSON.stringify({command:[cmd,...args],request_id:id})+'\n');}catch(e){cbs.delete(id);return rej(e);}setTimeout(()=>{if(cbs.has(id)){cbs.delete(id);rej(new Error('timeout'));}},10000);});}
// Every dialog opens as a child of the player window. Without a parent the
// file picker is just another window, and on Windows it opened behind the
// player (reported on a real machine, despite focusWin's workaround). An
// owned dialog always stays above its owner. Electron reads
// showOpenDialog(undefined, opts) as having no options, so the window is
// passed only when there is one.
const dialogParent = () => (win && !win.isDestroyed()) ? win : null;
// And while a dialog is open, neither window is always-on-top. With the pin
// on, or left on by PiP, the player stayed in front of its own folder picker
// on Windows (reported on a real machine, after the parent fix above).
async function withoutTopmost(fn) {
  // Every BM window, as the pin covers (applyOnTop), Lite's video window included.
  const was = [win, bgWin, videoWin].map(w => [w, w?.isAlwaysOnTop?.()]);
  for (const [w, top] of was) if (w && top && !w.isDestroyed()) { try { w.setAlwaysOnTop(false); } catch {} }
  try { return await fn(); }
  finally { for (const [w, top] of was) if (w && top && !w.isDestroyed()) { try { w.setAlwaysOnTop(true); } catch {} } }
}
const openDialog = opts => withoutTopmost(() => { const p = dialogParent(); return p ? dialog.showOpenDialog(p, opts) : dialog.showOpenDialog(opts); });
const messageBox = opts => withoutTopmost(() => { const p = dialogParent(); return p ? dialog.showMessageBox(p, opts) : dialog.showMessageBox(opts); });
const saveDialog = opts => withoutTopmost(() => { const p = dialogParent(); return p ? dialog.showSaveDialog(p, opts) : dialog.showSaveDialog(opts); });

// Files opened before mpv has connected. mpvCmd rejects until then, and the
// .catch below swallowed that, so a file opened in the first second or two
// after launch (a recent file, a quick double-click) silently never played.
// Reproduced every time in the real app; held here and opened on connect.
let pendingOpenFiles=null;
function openFiles(files){if(!files?.length)return;const valid=files.filter(f=>f.startsWith('http')||isMedia(f));if(!valid.length)return;if(!ipcOk){pendingOpenFiles=valid;return;}mpvCmd('loadfile',valid[0],'replace').catch(()=>{});mpvCmd('set_property','pause',false).catch(()=>{});valid.slice(1).forEach(f=>mpvCmd('loadfile',f,'append').catch(()=>{}));send('mpv:opened',valid);valid.forEach(f=>{try{app.addRecentDocument(f);}catch(_){}});}
function killMpv(){ipcOk=false;try{mpvSock?.destroy();}catch(_){}mpvSock=null;try{mpvProc?.kill();}catch(_){}mpvProc=null;if(!IS_WIN){try{fs.unlinkSync(PIPE);}catch(_){}}}
function isMedia(f){return MEDIA.has(path.extname(f).slice(1).toLowerCase());}
