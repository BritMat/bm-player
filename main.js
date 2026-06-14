'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
const PIPE   = `\\\\.\\pipe\\bm-mpv-${process.pid}`;
const MEDIA  = new Set(['mp4','mkv','avi','mov','wmv','flv','webm','ts','m2ts','m4v','3gp','rmvb','ogv','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka']);

app.whenReady().then(() => {
  // 1. The Backstop Window (Solid Black to block the desktop)
  bgWin = new BrowserWindow({
    width: 1200, height: 760,
    minWidth: 800, minHeight: 520,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    show: false,
    title: "BM Player"
  });

  // 2. The Main UI Window (Transparent, holds the UI and Video)
  win = new BrowserWindow({
    parent: bgWin,               // CRITICAL: Locks the UI window permanently on top of the black background
    width: 1200, height: 760,
    minWidth: 800, minHeight: 520,
    frame: false,
    transparent: true,           // CRITICAL: Must be transparent so the video can shine through
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Keeps the black background perfectly glued to the main window when you move it
  const syncWins = () => {
    if (!win || !bgWin) return;
    bgWin.setBounds(win.getBounds());
  };
  win.on('resize', syncWins);
  win.on('move', syncWins);

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { 
    bgWin.show(); 
    win.show(); 
    registerIpc(); 
    initMpv(); 
  });
  
  win.on('closed', () => { 
    killMpv(); 
    if (bgWin) bgWin.destroy();
    app.exit(0); 
  });
});

function registerIpc() {
  ipcMain.handle('win:minimize', () => { win?.minimize(); bgWin?.minimize(); });
  ipcMain.handle('win:maximize', () => {
    if (win?.isMaximized()) { win.unmaximize(); bgWin?.unmaximize(); }
    else { bgWin?.maximize(); win.maximize(); }
  });
  ipcMain.handle('win:close', () => { killMpv(); app.exit(0); });
  
  ipcMain.handle('dialog:open', async () => {
    if (!win) return [];
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name:'Media', extensions:[...MEDIA] }] });
    return r.canceled ? [] : r.filePaths;
  });
  
  ipcMain.handle('mpv:cmd', async (_e, cmd, ...args) => mpvCmd(cmd, ...args).catch(()=>{}));
  ipcMain.handle('mpv:open', async (_e, files) => {
    if (!files?.length) return;
    mpvCmd('loadfile', files[0], 'replace').catch(e => console.error("MPV Load Error:", e));
  });
}

function getMpv() {
  const candidates = [
    path.join(__dirname, 'vendor', 'mpv', 'mpv.exe'),
    path.join(__dirname, 'bin', 'mpv.exe'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'BM Player', 'mpv', 'mpv.exe'),
    path.join(process.resourcesPath || '', 'mpv', 'mpv.exe')
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function initMpv() {
  const exe = getMpv();
  if (exe) startMpv(exe);
}

function startMpv(exe) {
  killMpv();
  
  // Bind MPV to the transparent UI window!
  const wid = win.getNativeWindowHandle().readInt32LE();

  mpvProc = spawn(exe, [
    `--input-ipc-server=${PIPE}`,
    `--wid=${wid}`,
    '--idle=yes',
    '--keep-open=yes',
    '--no-border',
    '--osd-level=0',
    '--hwdec=auto-safe',
    '--vo=direct3d',       // THE MAGIC FLAG: This exact setting produced your successful toast image!
    '--volume=100'
  ], { stdio:'ignore', windowsHide: true }); 

  mpvProc.on('exit', () => { ipcOk = false; });
  setTimeout(() => connectIpc(), 1500);
}

function connectIpc(retry=0) {
  if (!mpvProc || mpvProc.killed) return;
  mpvSock = net.createConnection(PIPE);
  
  mpvSock.on('connect', () => {
    ipcOk = true;
    [['pause',1],['time-pos',2],['duration',3]].forEach(([n,id]) => 
      mpvSock.write(JSON.stringify({command:['observe_property',id,n]})+'\n')
    );
  });

  mpvSock.on('data', chunk => {
    mpvBuf += chunk.toString();
    let nl;
    while ((nl = mpvBuf.indexOf('\n')) !== -1) {
      const line = mpvBuf.slice(0,nl).trim(); mpvBuf = mpvBuf.slice(nl+1);
      if (!line) continue;
      try { 
        const msg = JSON.parse(line);
        if (msg.event === 'property-change') win?.webContents.send('mpv:prop', {name: msg.name, data: msg.data});
      } catch(_){}
    }
  });

  mpvSock.on('error', () => { if (retry < 15) setTimeout(() => connectIpc(retry+1), 500); });
}

function mpvCmd(cmd,...args) {
  return new Promise((res,rej) => {
    if (!ipcOk || !mpvSock) return rej(new Error('MPV dead'));
    const id = ++reqId; cbs.set(id, {res,rej});
    mpvSock.write(JSON.stringify({command:[cmd,...args],request_id:id})+'\n');
    setTimeout(() => { if(cbs.has(id)) { cbs.delete(id); rej(new Error('timeout')); }}, 5000);
  });
}

function killMpv() {
  ipcOk = false; mpvSock?.destroy(); mpvSock = null;
  if (mpvProc) { try { mpvProc.kill(); } catch(_){} mpvProc = null; }
}