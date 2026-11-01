'use strict';
/**
 * The app itself (v3.47.0, from main.js): its version, links out, what the
 * machine is, Diagnostics, updates, the default player, and battery power.
 */
const { app, screen, shell } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os');
// electron-updater, read when it is first needed (v3.47.0): only a packaged
// build checks for updates, 12 seconds after it starts, so a start no longer
// waits for the updater and its packages to load.
const updater = () => require('electron-updater').autoUpdater;
const S = require('./state');
const send = require('./send');
const { FLAGS, IS_LITE_BUILD, MPV_VO, CHROMIUM_SWITCHES } = require('./env');
const PS = require('../plugin-safety');
const { getMpv, getMpvVersion } = require('./mpv');

// On battery power (v3.39.0): Electron's powerMonitor, after the app is ready.
// --simulate-battery: as if on battery, for the field check.
function onBattery(){ if(process.argv.includes('--simulate-battery'))return true; try{ return !!require('electron').powerMonitor.isOnBatteryPower(); }catch(_){ return false; } }

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
  const autoUpdater = updater();
  autoUpdater.on('update-available',info=>send('updater:status',{state:'available',ver:info.version}));
  autoUpdater.on('download-progress',p=>send('updater:status',{state:'progress',pct:Math.round(p.percent)}));
  autoUpdater.on('update-downloaded',info=>send('updater:status',{state:'ready',ver:info.version}));
  autoUpdater.on('error',err=>send('updater:status',{state:'error',msg:err.message}));
  // Not on a Mac (v3.27.0): an app updates itself there only when signed with
  // an Apple Developer ID, which this build is not, and the check failed with
  // "Cannot find latest-mac.yml" at every start (and stopped the Mac release).
  if (process.platform !== 'darwin') setTimeout(()=>{try{autoUpdater.checkForUpdates();}catch(_){}},12000);
}

function register(ipcMain) {
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
    // The refresh rate of the screen the window is on (v3.36.0), which a page
    // cannot ask for. The fluid and MilkDrop lower their quality when frames
    // come slowly, and on a 30 Hz screen (a 4K set on an old cable, some
    // docks) they come 33 ms apart on the fastest machine there is.
    displayHz: (() => { try { return Math.round(screen.getDisplayMatching(S.win.getBounds()).displayFrequency) || null; } catch (_) { return null; } })(),
  }));
  // Everything a bug report needs, in one place: versions, where mpv was
  // found (or wasn't), GPU status, cache sizes, and what the window is
  // actually configured with.
  ipcMain.handle('app:diagnostics', async () => {
    const win = S.win;
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
    const wInfo = w => (w && !w.isDestroyed()) ? { content: w.getContentBounds(), bounds: w.getBounds(), maximized: !!w.isMaximized?.(), fullscreen: w === win ? S.fullOn : !!w.isFullScreen?.() } : null;
    let scale = null; try { scale = screen.getDisplayMatching(win.getBounds()).scaleFactor; } catch (_) {}
    return {
      windows: { controls: wInfo(win), picture: wInfo(S.bgWin), liteVideo: wInfo(S.videoWin), scale },
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
        connected: !!S.mpvSock && !S.mpvSock.destroyed,
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
          // Whole entries, from the line that says what went wrong (v3.37.0).
          // It was the last five lines of the file: of a stack trace, the
          // part that says where it was called from and never what it was.
          const at = []; t.forEach((l, i) => { if (/^\[\d{4}-\d\d-\d\dT/.test(l)) at.push(i); });
          const tail = at.slice(-2).flatMap((from, k, two) => {
            const to = k + 1 < two.length ? two[k + 1] : t.length, part = t.slice(from, Math.min(to, from + 7));
            if (to - from > 7) part.push('    (' + (to - from - 7) + ' more lines)');
            return part;
          });
          return { lines: t.length, entries: at.length, tail: tail.length ? tail : t.slice(-5) };
        } catch (_) { return null; }
      })(),
    };
  });

  ipcMain.handle('app:addRecent',(_,f)=>{try{app.addRecentDocument(f);}catch(_){}});
  ipcMain.handle('app:checkUpdate',async()=>{if(process.platform==='darwin')return{error:'On a Mac, download new versions from github.com/BritMat/bm-player/releases'};try{return await updater().checkForUpdates();}catch(e){return{error:e.message};}});
  ipcMain.handle('app:installUpdate',()=>updater().quitAndInstall(false,true));
  ipcMain.handle('app:isDefault',()=>app.isDefaultProtocolClient('bm-player'));
  ipcMain.handle('app:setDefault',()=>{try{app.setAsDefaultProtocolClient('bm-player');}catch(_){}});
  ipcMain.handle('power:battery', () => onBattery());   // v3.39.0
}

module.exports = { onBattery, setupUpdater, register };
