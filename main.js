'use strict';

const {
  app, BrowserWindow, ipcMain, dialog, shell,
  Menu, Tray, nativeImage, screen
} = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');
const https = require('https');
const http = require('http');

// ── Constants ──────────────────────────────────────────────────────────────
const IS_WIN = process.platform === 'win32';
const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;
const APP_NAME = 'BM Player';
const APP_DATA = path.join(os.homedir(), 'AppData', 'Roaming', APP_NAME);
const MPV_USER_DIR = path.join(APP_DATA, 'mpv');
const IPC_PIPE = `\\\\.\\pipe\\bm-player-mpv-${process.pid}`;
const MEDIA_EXTS = new Set([
  'mp4','mkv','avi','mov','wmv','flv','webm','ts','m2ts','m4v','3gp',
  'rmvb','rm','ogv','vob','divx','xvid','hevc','264','265',
  'mp3','flac','aac','ogg','wav','m4a','wma','opus','alac','ape','mka',
  'm3u','m3u8','pls','xspf'
]);

// ── Global state ───────────────────────────────────────────────────────────
let mainWindow   = null;
let mpvProcess   = null;
let mpvSocket    = null;
let tray         = null;
let ipcReady     = false;
let pendingFiles  = [];
let mpvRequestId  = 0;
const mpvCallbacks = new Map();
let mpvBuffer    = '';

// ── Single-instance lock ───────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

app.on('second-instance', (_ev, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  const files = argv.slice(2).filter(a => fs.existsSync(a) && isMedia(a));
  if (files.length) openFiles(files);
});

// ── App ready ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (IS_WIN) fs.mkdirSync(APP_DATA, { recursive: true });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killMpv();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => killMpv());

app.on('open-file', (ev, filePath) => {
  ev.preventDefault();
  if (mainWindow && ipcReady) openFiles([filePath]);
  else pendingFiles.push(filePath);
});

// ── Window creation ────────────────────────────────────────────────────────
function createWindow () {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width - 40),
    height: Math.min(740, height - 40),
    minWidth: 820,
    minHeight: 520,
    center: true,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0d18',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false   // allow local file:// for media thumbnails
    },
    icon: path.join(__dirname, 'buildResources', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setupWindowEvents();
    registerIpcHandlers();
    initMpv();
    if (!IS_DEV) setupUpdater();
    createTray();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    killMpv();
  });
}

// ── Window events ──────────────────────────────────────────────────────────
function setupWindowEvents () {
  mainWindow.on('maximize',          () => sendWin('maximized'));
  mainWindow.on('unmaximize',        () => sendWin('normal'));
  mainWindow.on('enter-full-screen', () => sendWin('fullscreen'));
  mainWindow.on('leave-full-screen', () => sendWin('normal'));
  mainWindow.on('focus',             () => sendWin('focus'));
  mainWindow.on('blur',              () => sendWin('blur'));
  mainWindow.on('resize', () => {
    const [w, h] = mainWindow.getContentSize();
    mainWindow?.webContents.send('window:resize', { width: w, height: h });
  });
}

function sendWin (state) {
  mainWindow?.webContents.send('window:state', state);
}

// ── IPC handlers ───────────────────────────────────────────────────────────
function registerIpcHandlers () {
  ipcMain.handle('window:minimize',    () => mainWindow?.minimize());
  ipcMain.handle('window:maximize',    () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close',       () => mainWindow?.close());
  ipcMain.handle('window:fullscreen',  () => {
    mainWindow?.setFullScreen(!mainWindow.isFullScreen());
  });
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());
  ipcMain.handle('window:isFullscreen',() => mainWindow?.isFullScreen());
  ipcMain.handle('window:alwaysOnTop', (_ev, val) => mainWindow?.setAlwaysOnTop(val));

  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return [];
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Media',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media Files', extensions: [...MEDIA_EXTS] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return res.canceled ? [] : res.filePaths;
  });

  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Folder',
      properties: ['openDirectory']
    });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle('mpv:command', async (_ev, cmd, ...args) => {
    try { return await mpvCmd(cmd, ...args); }
    catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('mpv:openFiles', async (_ev, files) => {
    await openFiles(files);
  });

  ipcMain.handle('mpv:addToPlaylist', async (_ev, filePath) => {
    try { return await mpvCmd('loadfile', filePath, 'append-play'); }
    catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('mpv:getStatus', () => ({
    ready: ipcReady,
    pid: mpvProcess?.pid
  }));

  ipcMain.handle('app:getVersion',  () => app.getVersion());
  ipcMain.handle('app:openExternal', (_ev, url) => shell.openExternal(url));
  ipcMain.handle('app:getMpvPath',  () => getMpvPath());
  ipcMain.handle('app:downloadMpv', async () => { await downloadMpv(); });

  ipcMain.handle('updater:check',   () => { if (!IS_DEV) autoUpdater.checkForUpdates(); });
  ipcMain.handle('updater:install', () => { autoUpdater.quitAndInstall(false, true); });
}

// ── mpv ────────────────────────────────────────────────────────────────────
function getMpvPath () {
  // 1. Bundled in app resources (production GitHub build)
  const resPaths = [
    path.join(process.resourcesPath || '', 'mpv', 'mpv.exe'),
    path.join(process.resourcesPath || '', 'mpv', 'mpv-x64', 'mpv.exe'),
    path.join(process.resourcesPath || '', 'mpv', 'mpv-x86', 'mpv.exe'),
    // Dev: vendor folder
    path.join(__dirname, 'vendor', 'mpv', 'mpv.exe'),
    path.join(__dirname, 'vendor', 'mpv', 'mpv-x64', 'mpv.exe'),
    path.join(__dirname, 'vendor', 'mpv', 'mpv-x86', 'mpv.exe'),
    // User downloaded
    path.join(MPV_USER_DIR, 'mpv.exe'),
  ];
  return resPaths.find(p => fs.existsSync(p)) || null;
}

function initMpv () {
  if (!IS_WIN) {
    // Non-Windows: just signal "no mpv" - show UI without embedding
    mainWindow?.webContents.send('mpv:status', { state: 'unsupported' });
    return;
  }

  const mpvExe = getMpvPath();
  if (!mpvExe) {
    mainWindow?.webContents.send('mpv:status', { state: 'missing' });
    return;
  }

  startMpv(mpvExe);
}

function startMpv (mpvExe) {
  killMpv();

  // Get Electron window handle for embedding
  let hwndArg = null;
  if (mainWindow && IS_WIN) {
    try {
      const buf = mainWindow.getNativeWindowHandle();
      // HWND on x64 Windows is 32-bit but returned in a larger buffer
      const hwndVal = buf.length >= 8
        ? Number(buf.readBigUInt64LE(0)) & 0xFFFFFFFF
        : buf.readUInt32LE(0);
      if (hwndVal) hwndArg = String(hwndVal);
    } catch (_) {}
  }

  const args = [
    `--input-ipc-server=${IPC_PIPE}`,
    '--idle=yes',
    '--keep-open=yes',
    '--no-border',
    '--no-window-dragging',
    '--osd-level=0',
    '--no-osc',
    '--force-seekable=yes',
    '--cache=yes',
    '--cache-secs=30',
    '--demuxer-max-bytes=200MiB',
    '--hwdec=auto-safe',
    '--video-sync=display-resample',
    '--interpolation=yes',
    '--tscale=oversample',
    '--sub-auto=fuzzy',
    '--sub-bold=yes',
    '--sub-font-size=38',
    '--sub-shadow-color=0.0/0.0/0.0/0.8',
    '--sub-shadow-offset=2',
    '--screenshot-format=png',
    '--screenshot-png-compression=3',
  ];

  if (hwndArg) {
    args.push(`--wid=${hwndArg}`);
    args.push('--vo=gpu');
    args.push('--gpu-context=angle');
  }

  mpvProcess = spawn(mpvExe, args, { stdio: 'ignore', windowsHide: false });
  mpvProcess.on('error', err => {
    console.error('mpv error:', err);
    mainWindow?.webContents.send('mpv:status', { state: 'error', message: err.message });
  });
  mpvProcess.on('exit', code => {
    ipcReady = false;
    mpvSocket = null;
    mainWindow?.webContents.send('mpv:status', { state: 'exited', code });
  });

  mainWindow?.webContents.send('mpv:status', { state: 'starting' });
  setTimeout(() => connectMpvIPC(), 1500);
}

function connectMpvIPC (retry = 0) {
  if (!mpvProcess || mpvProcess.killed) return;
  if (mpvSocket) { try { mpvSocket.destroy(); } catch (_) {} }

  mpvSocket = net.createConnection(IPC_PIPE);

  mpvSocket.on('connect', () => {
    ipcReady = true;
    mainWindow?.webContents.send('mpv:status', { state: 'ready' });

    // Observe key properties
    const props = [
      [1,'pause'], [2,'time-pos'], [3,'duration'], [4,'volume'],
      [5,'mute'], [6,'media-title'], [7,'playlist-pos'], [8,'playlist-count'],
      [9,'chapter'], [10,'chapter-list'], [11,'track-list'],
      [12,'sub-delay'], [13,'audio-delay'], [14,'speed'],
      [15,'percent-pos'], [16,'video-params'], [17,'audio-params'],
      [18,'filename'], [19,'file-format'], [20,'avsync'],
      [21,'video-codec'], [22,'audio-codec'], [23,'loop-playlist'],
      [24,'loop-file'],
    ];
    props.forEach(([id, name]) => observeProp(name, id));

    // Flush pending files
    if (pendingFiles.length) {
      openFiles(pendingFiles);
      pendingFiles = [];
    }
  });

  mpvSocket.on('data', chunk => {
    mpvBuffer += chunk.toString();
    let nl;
    while ((nl = mpvBuffer.indexOf('\n')) !== -1) {
      const line = mpvBuffer.slice(0, nl).trim();
      mpvBuffer = mpvBuffer.slice(nl + 1);
      if (line) {
        try { handleMpvMsg(JSON.parse(line)); } catch (_) {}
      }
    }
  });

  mpvSocket.on('error', err => {
    if ((err.code === 'ENOENT' || err.code === 'ECONNREFUSED') && retry < 15) {
      setTimeout(() => connectMpvIPC(retry + 1), 800);
    } else {
      mainWindow?.webContents.send('mpv:status', { state: 'ipc-error', message: err.code });
    }
  });

  mpvSocket.on('close', () => {
    ipcReady = false;
    if (mpvProcess && !mpvProcess.killed) {
      setTimeout(() => connectMpvIPC(), 2000);
    }
  });
}

function handleMpvMsg (msg) {
  if (msg.request_id !== undefined) {
    const cb = mpvCallbacks.get(msg.request_id);
    if (cb) {
      mpvCallbacks.delete(msg.request_id);
      if (msg.error && msg.error !== 'success') cb.reject(new Error(msg.error));
      else cb.resolve(msg.data);
    }
    return;
  }
  if (msg.event) {
    mainWindow?.webContents.send('mpv:event', msg);
    if (msg.event === 'property-change') {
      mainWindow?.webContents.send('mpv:prop', { name: msg.name, data: msg.data, id: msg.id });
    }
  }
}

function mpvCmd (command, ...args) {
  return new Promise((resolve, reject) => {
    if (!ipcReady || !mpvSocket) {
      return reject(new Error('mpv IPC not ready'));
    }
    const id = ++mpvRequestId;
    mpvCallbacks.set(id, { resolve, reject });
    const msg = JSON.stringify({ command: [command, ...args], request_id: id }) + '\n';
    try {
      mpvSocket.write(msg);
    } catch (e) {
      mpvCallbacks.delete(id);
      reject(e);
    }
    setTimeout(() => {
      if (mpvCallbacks.has(id)) {
        mpvCallbacks.delete(id);
        reject(new Error('mpv timeout'));
      }
    }, 8000);
  });
}

function observeProp (name, id) {
  if (!ipcReady || !mpvSocket) return;
  mpvSocket.write(JSON.stringify({ command: ['observe_property', id, name] }) + '\n');
}

async function openFiles (files) {
  if (!files.length) return;
  const [first, ...rest] = files.filter(f => isMedia(f));
  if (!first) return;
  try {
    await mpvCmd('loadfile', first, 'replace');
    for (const f of rest) await mpvCmd('loadfile', f, 'append');
    mainWindow?.webContents.send('player:files-opened', { files });
  } catch (e) {
    console.error('openFiles error:', e);
  }
}

function killMpv () {
  ipcReady = false;
  if (mpvSocket) { try { mpvSocket.destroy(); } catch (_) {} mpvSocket = null; }
  if (mpvProcess) {
    try { mpvProcess.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => {
      try { if (mpvProcess && !mpvProcess.killed) mpvProcess.kill('SIGKILL'); } catch (_) {}
    }, 1500);
    mpvProcess = null;
  }
}

// ── Download mpv on first run ──────────────────────────────────────────────
async function downloadMpv () {
  mainWindow?.webContents.send('mpv:download-progress', { phase: 'fetching', pct: 0 });
  try {
    const arch   = process.arch === 'ia32' ? 'i686' : 'x86_64';
    const apiUrl = 'https://api.github.com/repos/shinchiro/mpv-winbuild-cmake/releases/latest';
    const rel    = await fetchJson(apiUrl);
    const asset  = rel.assets?.find(a => a.name.includes(arch) && a.name.endsWith('.7z'));
    if (!asset) throw new Error('No mpv asset found');

    const dest7z = path.join(APP_DATA, 'mpv-download.7z');
    mainWindow?.webContents.send('mpv:download-progress', { phase: 'downloading', pct: 0 });
    await downloadFile(asset.browser_download_url, dest7z, pct =>
      mainWindow?.webContents.send('mpv:download-progress', { phase: 'downloading', pct })
    );

    mainWindow?.webContents.send('mpv:download-progress', { phase: 'extracting', pct: 100 });
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(dest7z);
    fs.mkdirSync(MPV_USER_DIR, { recursive: true });
    zip.extractAllTo(MPV_USER_DIR, true);
    fs.unlinkSync(dest7z);

    mainWindow?.webContents.send('mpv:download-progress', { phase: 'done', pct: 100 });
    initMpv();
  } catch (e) {
    mainWindow?.webContents.send('mpv:download-progress', { phase: 'error', message: e.message });
  }
}

function fetchJson (url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'BM-Player/' + app.getVersion() } };
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadFile (url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get  = url.startsWith('https') ? https.get : http.get;
    const opts = { headers: { 'User-Agent': 'BM-Player/' + app.getVersion() } };
    get(url, opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      res.on('data', chunk => {
        received += chunk.length;
        if (total) onProgress?.(Math.round(received / total * 100));
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

// ── Auto-updater ───────────────────────────────────────────────────────────
function setupUpdater () {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null; // silence log spam

  autoUpdater.on('checking-for-update',
    ()   => mainWindow?.webContents.send('updater:status', { state: 'checking' }));
  autoUpdater.on('update-available',
    info => mainWindow?.webContents.send('updater:status', {
      state: 'available', version: info.version,
      isMajor: isMajorUpdate(app.getVersion(), info.version)
    }));
  autoUpdater.on('update-not-available',
    ()   => mainWindow?.webContents.send('updater:status', { state: 'latest' }));
  autoUpdater.on('download-progress',
    p    => mainWindow?.webContents.send('updater:status', { state: 'downloading', pct: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded',
    info => mainWindow?.webContents.send('updater:status', { state: 'ready', version: info.version }));
  autoUpdater.on('error',
    err  => mainWindow?.webContents.send('updater:status', { state: 'error', message: err.message }));

  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

function isMajorUpdate (cur, next) {
  return parseInt(next.split('.')[0]) > parseInt(cur.split('.')[0]);
}

// ── Tray ───────────────────────────────────────────────────────────────────
function createTray () {
  try {
    const iconPath = path.join(__dirname, 'buildResources', 'icon.png');
    if (!fs.existsSync(iconPath)) return;
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('BM Player');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open BM Player', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'Quit', click: () => { killMpv(); app.quit(); } }
    ]));
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
  } catch (_) {}
}

// ── Helpers ────────────────────────────────────────────────────────────────
function isMedia (filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return MEDIA_EXTS.has(ext);
}
