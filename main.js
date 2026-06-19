'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const net  = require('net');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

// ── State ──────────────────────────────────────────────────────────────────
let win = null, bgWin = null, mpvProc = null, mpvSock = null;
let ipcOk = false, mpvBuf = '', reqId = 0;
const cbs = new Map();
const PIPE  = `\\\\.\\pipe\\bm-mpv-${process.pid}`;
const MEDIA = new Set([
  'mp4','mkv','avi','mov','wmv','flv','webm','ts','m2ts','m4v','3gp','rmvb',
  'ogv','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka',
  'vob','mpg','mpeg','m2v','divx','xvid','264','265','hevc','av1',
  'm3u','m3u8','pls'
]);

let trackList = [];
let currentSubDelay = 0;
let currentAudioDelay = 0;
let mediaProps = {};

// ── Single instance ────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { 
  app.quit(); 
  process.exit(0); 
}

app.on('second-instance', (_e, argv) => {
  if (win) { 
    if (win.isMinimized()) win.restore(); 
    win.focus(); 
  }
  const f = argv.slice(2).find(a => fs.existsSync(a) && isMedia(a));
  if (f) openFiles([f]);
});

// ── App ready ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  
  // 1. The Opaque Black Background Window
  bgWin = new BrowserWindow({
    width: 1200, height: 760, minWidth: 900, minHeight: 560,
    frame: false, transparent: false, backgroundColor: '#000000',
    show: false, title: 'BM Player BG'
  });
  
  // 2. The Transparent UI Window (Bound as child to fix Alt+Tab Z-order)
  win = new BrowserWindow({
    parent: bgWin,
    width: 1200, height: 760, minWidth: 900, minHeight: 560,
    frame: false, transparent: true, backgroundColor: '#00000000',
    show: false, title: 'BM Player',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    }
  });

  // 3. Perfect Bounds Syncing (Fixes Black Screen tearing)
  // bgWin silently mirrors win's exact dimensions instantly without OS interference
  const sync = () => { 
    if (!win || !bgWin) return;
    try { bgWin.setBounds(win.getBounds()); } catch(e){}
  };
  
  win.on('resize', sync); 
  win.on('move', sync);

  win.on('maximize', () => { 
    sync();   
    send('win:state','maximized'); 
  });
  
  win.on('unmaximize', () => { 
    sync();
    send('win:state','normal'); 
  });

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

app.on('window-all-closed', () => { 
  killMpv(); 
  if (process.platform !== 'darwin') app.quit(); 
});

app.on('will-quit', killMpv);

function send(ch, ...d) { 
  if (win) win.webContents.send(ch, ...d); 
}

// ── IPC Handlers ───────────────────────────────────────────────────────────
function registerIpc() {
  ipcMain.handle('win:minimize', () => { 
    if (bgWin) bgWin.minimize(); // Minimizing the parent minimizes the child safely
  });

  // 🌟 THE STAIRCASE SWITCH 🌟
  const toggleMaximize = () => {
    if (!win) return;
    
    // Safety catch: If stuck in true native OS fullscreen, break out of it
    if (win.isFullScreen()) win.setFullScreen(false);
    
    // Alternate safely between Maximized and Normal
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  };

  // Map both Fullscreen ('F') and Maximize button to the exact same safe switch
  ipcMain.handle('win:maximize', toggleMaximize);
  ipcMain.handle('win:fullscreen', toggleMaximize);

  ipcMain.handle('win:close', () => { 
    killMpv(); 
    app.exit(0); 
  });
  
  ipcMain.handle('win:alwaysTop', (_, v) => { 
    if (bgWin) bgWin.setAlwaysOnTop(v); // Applying to parent handles both
  });
  
  ipcMain.handle('win:isMax', () => win?.isMaximized());
  ipcMain.handle('win:isFs',  () => win?.isFullScreen());

  autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall(false, true));
  ipcMain.handle('app:checkUpdate', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: !!result };
    } catch (err) {
      return { error: 'No update available or network error.' };
    }
  });

  ipcMain.handle('dialog:open', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Open Media', properties: ['openFile','multiSelections'],
      filters: [{ name:'Media', extensions:[...MEDIA] }, { name:'All', extensions:['*'] }]
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('dialog:openSub', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Add Subtitle File', properties: ['openFile'],
      filters: [{ name:'Subtitles', extensions:['srt','ass','ssa','vtt','sub','idx','sup'] }]
    });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('mpv:cmd',    async (_, cmd, ...a) => mpvCmd(cmd, ...a).catch(e => ({ error: e.message })));
  ipcMain.handle('mpv:open',   async (_, files)     => openFiles(files));
  ipcMain.handle('mpv:append', async (_, f)         => mpvCmd('loadfile', f, 'append').catch(() => {}));
  ipcMain.handle('mpv:status', () => ({ ready: ipcOk }));
  
  ipcMain.handle('mpv:getPlaylist', async () => { 
    try { 
      return await mpvCmd('get_property', 'playlist'); 
    } catch(_) { 
      return []; 
    } 
  });

  ipcMain.handle('show-context-menu', async () => {
    if (ipcOk) { 
      try { 
        await new Promise(r => setTimeout(r, 50)); 
        const fresh = await mpvCmd('get_property', 'track-list'); 
        if (Array.isArray(fresh)) trackList = fresh; 
      } catch(_) {} 
    } else {
      trackList = [];
    }
    buildAndShowContextMenu();
  });

  ipcMain.handle('adj:subDelay', (_, d) => { 
    currentSubDelay += d; 
    mpvCmd('set_property','sub-delay', currentSubDelay).catch(()=>{}); 
    send('mpv:prop',{name:'sub-delay', data:currentSubDelay}); 
  });
  
  ipcMain.handle('adj:audioDelay', (_, d) => { 
    currentAudioDelay += d; 
    mpvCmd('set_property','audio-delay', currentAudioDelay).catch(()=>{}); 
    send('mpv:prop',{name:'audio-delay', data:currentAudioDelay}); 
  });
  
  ipcMain.handle('reset:subDelay', () => { 
    currentSubDelay = 0; 
    mpvCmd('set_property','sub-delay',0).catch(()=>{}); 
  });
  
  ipcMain.handle('reset:audioDelay', () => { 
    currentAudioDelay = 0; 
    mpvCmd('set_property','audio-delay',0).catch(()=>{}); 
  });
  
  ipcMain.handle('app:version',  () => app.getVersion());
  ipcMain.handle('app:external', (_, u) => shell.openExternal(u));
  ipcMain.handle('app:addRecent',(_, f) => { 
    try { 
      app.addRecentDocument(f); 
    } catch(_){} 
  });

  // ── Phase 2a: Image Gallery ──────────────────────────────────────────────
  ipcMain.handle('gallery:browse', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Open Image Folder', properties: ['openDirectory'],
    });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('gallery:scan', async (_, folderPath) => {
    if (!folderPath || !fs.existsSync(folderPath)) return [];
    const IMG = new Set(['jpg','jpeg','png','webp','gif','bmp','tiff','avif']);
    try {
      return fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(f => f.isFile() && IMG.has(path.extname(f.name).slice(1).toLowerCase()))
        .map(f => ({ path: path.join(folderPath, f.name), name: f.name }));
    } catch(e) { return []; }
  });
}

function buildAndShowContextMenu() {
  const audio = trackList.filter(t => t.type === 'audio');
  const subs  = trackList.filter(t => t.type === 'sub');
  const fmt = t => [t.lang ? `[${t.lang.toUpperCase()}]` : '', t.title || t.codec || `Track ${t.id}`].filter(Boolean).join(' ');

  const menu = Menu.buildFromTemplate([
    { label: '🎵 Audio Track', submenu: [
      { label:'Disable Audio', type:'radio', checked:!audio.some(t=>t.selected), click:()=>mpvCmd('set_property','aid','no').catch(()=>{}) }, 
      ...audio.map(t=>({ label: fmt(t), type:'radio', checked:!!t.selected, click:()=>mpvCmd('set_property','aid',t.id).catch(()=>{}) }))
    ]},
    { type:'separator' },
    { label: '💬 Subtitle Track', submenu: [
      { label:'Off', type:'radio', checked:!subs.some(t=>t.selected), click:()=>mpvCmd('set_property','sid','no').catch(()=>{}) }, 
      ...subs.map(t=>({ label: fmt(t), type:'radio', checked:!!t.selected, click:()=>{ mpvCmd('set_property','sub-visibility',true).catch(()=>{}); mpvCmd('set_property','sid',t.id).catch(()=>{}); } }))
    ]},
    { type:'separator' },
    { label:`⏱ Sub Delay (${currentSubDelay.toFixed(1)}s)`, submenu:[
      { label:'+0.5s', click:()=>{ currentSubDelay+=0.5; mpvCmd('set_property','sub-delay',currentSubDelay).catch(()=>{}); } }, 
      { label:'-0.5s', click:()=>{ currentSubDelay-=0.5; mpvCmd('set_property','sub-delay',currentSubDelay).catch(()=>{}); } }, 
      { label:'Reset',  click:()=>{ currentSubDelay=0; mpvCmd('set_property','sub-delay',0).catch(()=>{}); } }
    ]},
    { label:'📐 Sub Size', submenu:[
      { label:'Larger', click:()=>mpvCmd('add','sub-font-size',4).catch(()=>{}) }, 
      { label:'Smaller', click:()=>mpvCmd('add','sub-font-size',-4).catch(()=>{}) }
    ]},
    { type:'separator' },
    { label:'📸 Screenshot', click:()=>mpvCmd('screenshot','subtitles').catch(()=>{}) },
    { label:'🔁 Loop File',  click:()=>mpvCmd('cycle','loop-file').catch(()=>{}) }
  ]);
  menu.popup({ window: win });
}

function getMpv() {
  return [
    path.join(process.resourcesPath||'','mpv','mpv.exe'), 
    path.join(__dirname,'vendor','mpv','mpv.exe'), 
    path.join(__dirname,'bin','mpv.exe')
  ].find(p => fs.existsSync(p)) || null;
}

function initMpv() {
  const exe = getMpv();
  if (!exe) { 
    send('mpv:status',{state:'missing'}); 
    return; 
  }
  startMpv(exe);
}

function startMpv(exe) {
  killMpv();
  const wid = win.getNativeWindowHandle().readInt32LE(0);
  mpvProc = spawn(exe, [
    `--input-ipc-server=${PIPE}`, 
    `--wid=${wid}`, 
    '--idle=yes', 
    '--keep-open=yes', 
    '--no-border', 
    '--osd-level=0', 
    '--hwdec=auto-safe', 
    '--vo=direct3d', 
    '--volume=100', 
    '--sub-auto=fuzzy', 
    '--sub-ass-override=force', 
    '--sub-use-margins=yes', 
    '--sub-margin-y=90', 
    '--sub-bold=yes', 
    '--sub-font-size=38', 
    '--sub-shadow-offset=2', 
    '--sub-border-size=3', 
    '--sub-color=1.0/1.0/1.0/1.0'
  ], { stdio:'ignore', windowsHide:true });
  
  mpvProc.on('exit', () => { ipcOk = false; });
  setTimeout(() => connectIpc(), 1500);
}

function connectIpc(retry = 0) {
  if (!mpvProc || mpvProc.killed) return;
  if (mpvSock) mpvSock.destroy();
  
  mpvSock = net.createConnection(PIPE);
  mpvSock.on('connect', () => {
    ipcOk = true; 
    send('mpv:status', { state:'ready' });
    [
      [1,'pause'],[2,'time-pos'],[3,'duration'],[4,'volume'],
      [5,'mute'],[6,'media-title'],[7,'filename'],[8,'track-list'],
      [9,'playlist-pos'],[10,'playlist-count'],[11,'sub-delay'],
      [12,'audio-delay'],[13,'speed'],[14,'video-params'],
      [15,'audio-params'],[16,'video-codec'],[17,'audio-codec'],
      [18,'file-size'],[19,'container-format'],[20,'video-bitrate'],
      [21,'audio-bitrate'],[22,'chapter-list'],[23,'chapter'],
      [24,'loop-file'],[25,'loop-playlist']
    ].forEach(([id,name]) => mpvSock.write(JSON.stringify({command:['observe_property',id,name]})+'\n'));
  });
  
  mpvSock.on('data', chunk => {
    mpvBuf += chunk.toString(); 
    let nl;
    while ((nl = mpvBuf.indexOf('\n')) !== -1) {
      const line = mpvBuf.slice(0,nl).trim(); 
      mpvBuf = mpvBuf.slice(nl+1);
      if (line) { 
        try { 
          handleMsg(JSON.parse(line)); 
        } catch(_){} 
      }
    }
  });
  
  mpvSock.on('error', e => { 
    if ((e.code==='ENOENT'||e.code==='ECONNREFUSED') && retry<15) setTimeout(()=>connectIpc(retry+1), 500); 
  });
  
  mpvSock.on('close', () => { 
    ipcOk = false; 
    if (mpvProc && !mpvProc.killed) setTimeout(()=>connectIpc(),2000); 
  });
}

function handleMsg(msg) {
  if (msg.request_id !== undefined) {
    const cb = cbs.get(msg.request_id);
    if (cb) { 
      cbs.delete(msg.request_id); 
      if (msg.error && msg.error !== 'success') {
        cb.rej(new Error(msg.error)); 
      } else {
        cb.res(msg.data); 
      }
    }
    return;
  }
  
  if (!msg.event) return;
  
  if (msg.event === 'property-change') {
    if (msg.name === 'track-list') trackList = Array.isArray(msg.data) ? msg.data : [];
    if (msg.name === 'sub-delay') currentSubDelay = msg.data ?? 0;
    if (msg.name === 'audio-delay') currentAudioDelay = msg.data ?? 0;
    if (['video-params','audio-params','video-codec','audio-codec','file-size','container-format','video-bitrate','audio-bitrate','duration','chapter-list','filename'].includes(msg.name)) { 
      mediaProps[msg.name] = msg.data; 
      send('mpv:mediaProps', mediaProps); 
    }
  }
  
  send('mpv:event', msg);
  if (msg.event === 'property-change') send('mpv:prop', {name:msg.name, data:msg.data});
}

function mpvCmd(cmd,...args) {
  return new Promise((res,rej) => {
    if (!ipcOk||!mpvSock) return rej(new Error('mpv not ready'));
    const id = ++reqId; 
    cbs.set(id,{res,rej});
    mpvSock.write(JSON.stringify({command:[cmd,...args],request_id:id})+'\n');
    setTimeout(() => { 
      if (cbs.has(id)) { 
        cbs.delete(id); 
        rej(new Error('timeout')); 
      } 
    }, 8000);
  });
}

function openFiles(files) {
  if (!files || files.length === 0) return;
  const valid = files.filter(f => f.startsWith('http') || isMedia(f));
  if (valid.length === 0) return;
  
  mpvCmd('loadfile',valid[0],'replace').catch(()=>{});
  valid.slice(1).forEach(f => mpvCmd('loadfile',f,'append').catch(()=>{}));
  
  send('mpv:opened', valid);
  valid.forEach(f => { try { app.addRecentDocument(f); } catch(_){} });
}

function killMpv() {
  ipcOk = false;
  if (mpvSock) { 
    mpvSock.destroy(); 
    mpvSock = null; 
  }
  if (mpvProc) { 
    try { 
      mpvProc.kill(); 
    } catch(_) {} 
    mpvProc = null; 
  }
}

function isMedia(f) { 
  return MEDIA.has(path.extname(f).slice(1).toLowerCase()); 
}