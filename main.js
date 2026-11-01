'use strict';
/**
 * BM Player's main process: where it starts.
 *
 * Until v3.47.0 everything the main process does was in this one file, 1,500
 * lines of it. It is in parts now, in main/, each with the page's messages
 * it answers (its register()):
 *
 *   main/env.js       the platform, Chromium switches, mpv's outputs, Lite, flags
 *   main/state.js     the windows and mpv's connection, shared by the parts
 *   main/windows.js   making the windows, full screen, picture-in-picture, the pin
 *   main/mpv.js       mpv: finding it, starting it, its connection, its crashes
 *   main/dialogs.js   open and save dialogs, owned by the player window
 *   main/library.js   bmfile://, gallery thumbnails, album art, tags, folder scans
 *   main/lyrics-service.js  lyrics.js and ytdlp.js for the page
 *   main/plugins.js   finding plugins and their saved state
 *   main/appinfo.js   the version, Diagnostics, updates, battery power
 *   main/caches.js, log.js, send.js   small shared helpers
 *
 * This file sets the switches Chromium needs before anything else, loads
 * the parts, answers the operating system's "open this file", and makes the
 * windows once the app is ready. Splitting it changed nothing that runs: the
 * code moved as it was, and the checks that read it read the parts too.
 */
const { app, ipcMain, Menu, protocol } = require('electron');
const fs = require('fs');

// ── GPU FIX: Disable problematic GPU features that cause crashes ─────
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-software-rasterizer');
// Don't fully disable GPU - just fix the sandbox issue
// app.commandLine.appendSwitch('disable-gpu');  // Uncomment if still crashing
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

const S = require('./main/state');
const send = require('./main/send');
const { logFatal } = require('./main/log');
// The rest of Chromium's switches, the flags and Lite are worked out as this
// loads, which has to be before the app is ready.
const { IS_MAC } = require('./main/env');
// bmfile:// is registered as privileged as this loads, also before ready.
const library = require('./main/library');
const windows = require('./main/windows');
const mpv = require('./main/mpv');
const dialogs = require('./main/dialogs');
const plugins = require('./main/plugins');
const lyricsService = require('./main/lyrics-service');
const appinfo = require('./main/appinfo');
const { pruneCache, pruneCaches } = require('./main/caches');

// In a packaged app, argv is [exePath, ...args] — in dev mode (electron .)
// it's [electronPath, appPath, ...args]. Using the wrong offset silently
// drops the file path when a user double-clicks a video to open it.
const argOffset = app.isPackaged ? 1 : 2;

if(!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
app.on('second-instance',(_e,argv)=>{
  const win=S.win;
  if(win){if(win.isMinimized())win.restore();win.focus();}
  const f=argv.slice(argOffset).find(a=>fs.existsSync(a)&&mpv.isMedia(a));
  if(f)mpv.openFiles([f]);
});

// macOS delivers "open this file" as a dedicated app event, not via argv —
// this must be registered before app.whenReady() resolves since macOS can
// fire it immediately on cold start (e.g. double-clicking a video in Finder).
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (S.win && !S.win.isDestroyed() && S.ipcOk) mpv.openFiles([filePath]);
  else S.pendingOpenFile = filePath;   // mpv isn't ready yet — applied once connectIpc() fires
});

// Cold-start on Windows/Linux: a file path arrives via argv, not an event.
const coldStartFile = process.argv.slice(argOffset).find(a => { try { return fs.existsSync(a) && mpv.isMedia(a); } catch(_) { return false; } });
if (coldStartFile) S.pendingOpenFile = coldStartFile;

app.whenReady().then(()=>{
  // No built-in menu (v3.38.0). The windows have no menu bar, but Electron's
  // default menu was there all the same, with its keys: Ctrl+R reloaded the
  // whole page in the middle of a film or a song, Ctrl+W closed the window,
  // Ctrl+minus shrank everything. The app's own keys are its shortcuts. On a
  // Mac the menu stays: copy and paste go through it there.
  if (!IS_MAC) { try { Menu.setApplicationMenu(null); } catch (_) {} }
  // On battery or not (v3.39.0), for the page's battery saver (power.js).
  try {
    const { powerMonitor } = require('electron');
    const tell = () => send('power:battery', appinfo.onBattery());
    powerMonitor.on('on-battery', tell); powerMonitor.on('on-ac', tell);
  } catch (_) {}
  setTimeout(() => { pruneCache('thumbs'); pruneCache('covers'); pruneCache('lyrics', 20 * 1024 * 1024, 365); }, 30000).unref?.();   // v3.33.0, lyrics v3.38.0
  try { protocol.handle('bmfile', library.serveBmFile); }
  catch (e) { console.error('[main] could not register bmfile://:', e); }
  registerIpc();
  windows.createWindows(makeBoot);
});
app.on('window-all-closed',()=>{mpv.killMpv();if(process.platform!=='darwin')app.quit();});
app.on('will-quit',mpv.killMpv);

// SAFETY NET: ready-to-show is not guaranteed to fire for transparent /
// frameless windows when GPU compositing is degraded — and everything the app
// needs (show, mpv, updater, plugin dirs) was hanging off that one event.
// If it hasn't fired in 4s, boot anyway. boot() is idempotent.
function makeBoot(showFn){
  let done=false;
  return ()=>{
    if(done)return; done=true;
    // The window can be gone by now (v3.37.0). Quitting in the first moments
    // of a start let ready-to-show arrive after the picture window had been
    // destroyed, and mpv was started on a window handle that no longer was:
    // "Object has been destroyed", in main-errors.log on a real machine.
    if(!S.win||S.win.isDestroyed())return;
    // Each step by itself: that error also took the updater, the plugin
    // folders, the first-run prompt and the cache pruning with it, since they
    // came after mpv on the same line.
    const step=(name,fn)=>{try{fn();}catch(e){logFatal('start, '+name,e);}};
    step('show',showFn);
    step('ipc',registerIpc);step('mpv',mpv.initMpv);step('updater',appinfo.setupUpdater);step('plugin folders',plugins.ensurePluginDirs);
    setTimeout(()=>send('app:firstRun',true),4000);
    setTimeout(()=>step('cache pruning',pruneCaches),8000);
  };
}

// IDEMPOTENT: registerIpc() is called up-front in whenReady() instead of
// from ready-to-show. ready-to-show is unreliable for transparent windows,
// and any renderer invoke that landed before it fired got "No handler
// registered for ..." — which app.js swallowed, producing a dead button.
// Each part registers its own messages, each by itself (v3.47.0): a throw in
// one used to leave every handler after it unregistered, and now leaves only
// that part's, written to main-errors.log.
let _ipcRegistered = false;
function registerIpc(){
  if (_ipcRegistered) return;
  _ipcRegistered = true;
  const parts = { windows, dialogs, plugins, mpv, appinfo, library, lyrics: lyricsService };
  for (const [name, part] of Object.entries(parts)) {
    try { part.register(ipcMain); } catch (e) { logFatal('ipc, ' + name, e); }
  }
}

process.on('uncaughtException',  e => logFatal('uncaughtException', e));
process.on('unhandledRejection', e => logFatal('unhandledRejection', e));
