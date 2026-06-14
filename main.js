'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const net    = require('net');
const { spawn } = require('child_process');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let win = null, bgWin = null, mpvProc = null, mpvSock = null;
let ipcOk = false, mpvBuf = '', reqId = 0;
const cbs = new Map();
const PIPE  = `\\\\.\\pipe\\bm-mpv-${process.pid}`;
const MEDIA = new Set(['mp4','mkv','avi','mov','wmv','flv','webm','ts','m2ts',
  'm4v','3gp','rmvb','ogv','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka']);

let trackList      = [];
let currentSubDelay = 0;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

app.on('second-instance', (_e, argv) => {
  if (win) { win.isMinimized() && win.restore(); win.focus(); }
  const f = argv.slice(2).find(a => fs.existsSync(a) && MEDIA.has(path.extname(a).slice(1).toLowerCase()));
  if (f) openFiles([f]);
});

app.whenReady().then(() => {
  bgWin = new BrowserWindow({
    width: 1200, height: 760, minWidth: 800, minHeight: 520,
    frame: false, transparent: false, backgroundColor: '#000000',
    show: false, title: 'BM Player'
  });

  win = new BrowserWindow({
    parent: bgWin,
    width: 1200, height: 760, minWidth: 800, minHeight: 520,
    frame: false, transparent: true, backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    }
  });

  const sync = () => { if (win && bgWin) bgWin.setBounds(win.getBounds()); };
  win.on('resize', sync);
  win.on('move',   sync);
  win.on('maximize',          () => { bgWin?.maximize();   win?.webContents.send('win:state','maximized'); });
  win.on('unmaximize',        () => { bgWin?.unmaximize(); win?.webContents.send('win:state','normal'); });
  win.on('enter-full-screen', () => win?.webContents.send('win:state','fullscreen'));
  win.on('leave-full-screen', () => win?.webContents.send('win:state','normal'));

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => {
    bgWin.show(); win.show();
    registerIpc();
    initMpv();
  });
  win.on('closed', () => { killMpv(); if (bgWin) bgWin.destroy(); app.exit(0); });
});

app.on('window-all-closed', () => { killMpv(); if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', killMpv);

function registerIpc() {
  ipcMain.handle('win:minimize',   () => { win?.minimize(); bgWin?.minimize(); });
  ipcMain.handle('win:maximize',   () => {
    if (win?.isMaximized()) { win.unmaximize(); bgWin?.unmaximize(); }
    else { bgWin?.maximize(); win?.maximize(); }
  });
  ipcMain.handle('win:close',      () => { killMpv(); app.exit(0); });
  ipcMain.handle('win:fullscreen', () => win?.setFullScreen(!win.isFullScreen()));
  ipcMain.handle('win:alwaysTop',  (_, v) => win?.setAlwaysOnTop(v));
  ipcMain.handle('win:isMax',      () => win?.isMaximized());
  ipcMain.handle('win:isFs',       () => win?.isFullScreen());

  ipcMain.handle('dialog:open', async () => {
    if (!win) return [];
    const r = await dialog.showOpenDialog(win, {
      title: 'Open Media', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Media', extensions: [...MEDIA] }, { name: 'All Files', extensions: ['*'] }]
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('mpv:cmd',    async (_, cmd, ...a) => mpvCmd(cmd, ...a).catch(e => ({ error: e.message })));
  ipcMain.handle('mpv:open',   async (_, files)     => openFiles(files));
  ipcMain.handle('mpv:append', async (_, f)         => mpvCmd('loadfile', f, 'append-play').catch(() => {}));
  ipcMain.handle('mpv:status', () => ({ ready: ipcOk }));

  ipcMain.handle('show-context-menu', async () => {
    if (!ipcOk) return;

    try {
      const tracks = await mpvCmd('get_property', 'track-list');
      if (Array.isArray(tracks)) trackList = tracks;
    } catch (e) {
      console.log("Track fetch skipped");
    }

    const audio = trackList.filter(t => t.type === 'audio');
    const subs  = trackList.filter(t => t.type === 'sub');
    const trackLabel = t =>
      [t.lang ? `[${t.lang.toUpperCase()}]` : '', t.title || t.codec || `Track ${t.id}`]
        .filter(Boolean).join(' ');

    const menu = Menu.buildFromTemplate([
      {
        label: 'Audio Track',
        submenu: [
          // ── NEW: DISABLE AUDIO OPTION ──
          {
            label: 'Disable Audio', type: 'radio', checked: !audio.some(t => t.selected),
            click: () => mpvCmd('set_property', 'aid', 'no').catch(() => {})
          },
          { type: 'separator' },
          ...audio.map(t => ({
            label: trackLabel(t), type: 'radio', checked: !!t.selected,
            click: () => mpvCmd('set_property', 'aid', t.id).catch(() => {})
          }))
        ]
      },
      { type: 'separator' },
      {
        label: 'Subtitle Track',
        submenu: [
          {
            label: 'Off', type: 'radio', checked: !subs.some(t => t.selected),
            click: () => mpvCmd('set_property', 'sub-visibility', false).catch(() => {})
          },
          ...subs.map(t => ({
            label: trackLabel(t), type: 'radio', checked: !!t.selected,
            click: () => {
              mpvCmd('set_property', 'sub-visibility', true).catch(() => {});
              mpvCmd('set_property', 'sid', t.id).catch(() => {});
            }
          }))
        ]
      },
      { type: 'separator' },
      {
        label: `Subtitle Delay  (${currentSubDelay.toFixed(1)}s)`,
        submenu: [
          { label: '+0.5 s', accelerator: 'z', click: () => adjustSubDelay(+0.5) },
          { label: '-0.5 s', accelerator: 'x', click: () => adjustSubDelay(-0.5) },
          { label: 'Reset', click: () => setSubDelay(0) },
        ]
      },
      {
        label: 'Subtitle Size',
        submenu: [
          { label: 'Larger  (+4)', click: () => mpvCmd('add', 'sub-font-size', 4).catch(() => {}) },
          { label: 'Smaller (-4)', click: () => mpvCmd('add', 'sub-font-size', -4).catch(() => {}) },
        ]
      },
      { type: 'separator' },
      { label: 'Loop File', click: () => mpvCmd('cycle', 'loop-file').catch(() => {}) },
    ]);
    menu.popup({ window: win });
  });

  ipcMain.handle('app:version',  () => app.getVersion());
}

function adjustSubDelay(delta) {
  currentSubDelay += delta;
  mpvCmd('set_property', 'sub-delay', currentSubDelay).catch(() => {});
  win?.webContents.send('mpv:prop', { name: 'sub-delay', data: currentSubDelay });
}

function setSubDelay(v) {
  currentSubDelay = v;
  mpvCmd('set_property', 'sub-delay', v).catch(() => {});
  win?.webContents.send('mpv:prop', { name: 'sub-delay', data: v });
}

function getMpv() {
  const paths = [
    path.join(process.resourcesPath || '', 'mpv', 'mpv.exe'),
    path.join(__dirname, 'vendor', 'mpv', 'mpv.exe')
  ];
  return paths.find(p => fs.existsSync(p)) || null;
}

function initMpv() {
  const exe = getMpv();
  if (!exe) { win?.webContents.send('mpv:status', { state: 'missing' }); return; }
  startMpv(exe);
}

function startMpv(exe) {
  killMpv();
  const wid = win.getNativeWindowHandle().readInt32LE(0);
  mpvProc = spawn(exe, [
    `--input-ipc-server=${PIPE}`,
    `--wid=${wid}`,
    '--idle=yes', '--keep-open=yes',
    '--no-border', '--osd-level=0',
    '--hwdec=auto-safe',
    '--vo=direct3d',
    '--volume=100',
    '--sid=no', // Forces subs off by default (if they aren't hardcoded)
    '--sub-auto=fuzzy',
    '--sub-bold=yes',
    '--sub-font-size=38',
    '--sub-margin-y=90',
  ], { stdio: 'ignore', windowsHide: true });
  
  mpvProc.on('exit', () => { ipcOk = false; });
  setTimeout(() => connectIpc(), 1500);
}

function connectIpc(retry = 0) {
  if (!mpvProc || mpvProc.killed) return;
  mpvSock?.destroy();
  mpvSock = net.createConnection(PIPE);
  mpvSock.on('connect', () => {
    ipcOk = true;
    win?.webContents.send('mpv:status', { state: 'ready' });
    [
      [1, 'pause'], [2, 'time-pos'], [3, 'duration'], [4, 'volume'],
      [5, 'mute'], [6, 'media-title'], [9, 'sub-delay'], [10, 'sub-font-size'], 
      [11, 'sub-visibility'], [12, 'track-list']
    ].forEach(([id, name]) =>
      mpvSock.write(JSON.stringify({ command: ['observe_property', id, name] }) + '\n')
    );
  });
  mpvSock.on('data', chunk => {
    mpvBuf += chunk.toString();
    let nl;
    while ((nl = mpvBuf.indexOf('\n')) !== -1) {
      const line = mpvBuf.slice(0, nl).trim();
      mpvBuf = mpvBuf.slice(nl + 1);
      if (!line) continue;
      try { handleMsg(JSON.parse(line)); } catch (_) {}
    }
  });
  mpvSock.on('error', e => {
    if ((e.code === 'ENOENT' || e.code === 'ECONNREFUSED') && retry < 15)
      setTimeout(() => connectIpc(retry + 1), 500);
  });
  mpvSock.on('close', () => {
    ipcOk = false;
    if (mpvProc && !mpvProc.killed) setTimeout(() => connectIpc(), 2000);
  });
}

function handleMsg(msg) {
  if (msg.request_id !== undefined) {
    const cb = cbs.get(msg.request_id);
    if (cb) {
      cbs.delete(msg.request_id);
      (msg.error && msg.error !== 'success') ? cb.rej(new Error(msg.error)) : cb.res(msg.data);
    }
    return;
  }
  if (!msg.event) return;
  if (msg.event === 'property-change' && msg.name === 'track-list') {
    trackList = Array.isArray(msg.data) ? msg.data : [];
    win?.webContents.send('mpv:tracks', trackList);
  }
  if (msg.event === 'property-change' && msg.name === 'sub-delay') currentSubDelay = msg.data ?? 0;
  win?.webContents.send('mpv:event', msg);
  if (msg.event === 'property-change') win?.webContents.send('mpv:prop', { name: msg.name, data: msg.data });
}

function mpvCmd(cmd, ...args) {
  return new Promise((res, rej) => {
    if (!ipcOk || !mpvSock) return rej(new Error('mpv not ready'));
    const id = ++reqId;
    cbs.set(id, { res, rej });
    mpvSock.write(JSON.stringify({ command: [cmd, ...args], request_id: id }) + '\n');
    setTimeout(() => { if (cbs.has(id)) { cbs.delete(id); rej(new Error('timeout')); } }, 8000);
  });
}

function openFiles(files) {
  if (!files?.length) return;
  const valid = files.filter(f => f.startsWith('http') || MEDIA.has(path.extname(f).slice(1).toLowerCase()));
  if (!valid.length) return;
  mpvCmd('loadfile', valid[0], 'replace').catch(() => {});
  valid.slice(1).forEach(f => mpvCmd('loadfile', f, 'append').catch(() => {}));
}

function killMpv() {
  ipcOk = false;
  mpvSock?.destroy(); mpvSock = null;
  if (mpvProc) { try { mpvProc.kill(); } catch (_) {} mpvProc = null; }
}