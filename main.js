'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, screen } = require('electron');
const path = require('path'), fs = require('fs'), net = require('net');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let win=null,bgWin=null,mpvProc=null,mpvSock=null;
let ipcOk=false,mpvBuf='',reqId=0;
const cbs=new Map();
const PIPE=`\\\\.\\pipe\\bm-mpv-${process.pid}`;
const MEDIA=new Set(['mp4','mkv','avi','mov','wmv','flv','webm','ts','m2ts','m4v','3gp','rmvb','ogv','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka','vob','mpg','mpeg','m2v','divx','hevc','av1','m3u','m3u8','pls']);
let trackList=[],currentSubDelay=0,currentAudioDelay=0,mediaProps={};

if(!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
app.on('second-instance',(_e,argv)=>{
  if(win){if(win.isMinimized())win.restore();win.focus();}
  const f=argv.slice(2).find(a=>fs.existsSync(a)&&isMedia(a));
  if(f)openFiles([f]);
});

app.whenReady().then(()=>{
  bgWin=new BrowserWindow({width:1280,height:780,minWidth:900,minHeight:560,frame:false,transparent:false,backgroundColor:'#000000',show:false,title:'BM Player BG'});
  win=new BrowserWindow({parent:bgWin,width:1280,height:780,minWidth:900,minHeight:560,frame:false,transparent:true,backgroundColor:'#00000000',show:false,title:'BM Player',webPreferences:{nodeIntegration:false,contextIsolation:true,preload:path.join(__dirname,'preload.js'),webSecurity:false}});
  const sync=()=>{try{if(win&&bgWin)bgWin.setBounds(win.getBounds());}catch(_){}};
  win.on('resize',sync);win.on('move',sync);
  win.on('maximize',()=>{sync();send('win:state','maximized');});
  win.on('unmaximize',()=>{sync();send('win:state','normal');});
  win.loadFile(path.join(__dirname,'src','index.html'));
  win.once('ready-to-show',()=>{bgWin.show();win.show();registerIpc();initMpv();setupUpdater();setTimeout(()=>send('app:firstRun',true),4000);});
  win.on('closed',()=>{killMpv();try{bgWin?.destroy();}catch(_){}app.exit(0);});
});
app.on('window-all-closed',()=>{killMpv();if(process.platform!=='darwin')app.quit();});
app.on('will-quit',killMpv);
const send=(ch,...d)=>{try{if(win&&!win.isDestroyed())win.webContents.send(ch,...d);}catch(_){}};

function registerIpc(){
  const sync=()=>{try{if(win&&bgWin)bgWin.setBounds(win.getBounds());}catch(_){}};
  ipcMain.handle('win:minimize',()=>{try{bgWin?.minimize();}catch(_){}});
  ipcMain.handle('win:maximize',()=>{if(!win)return;if(win.isFullScreen())win.setFullScreen(false);win.isMaximized()?win.unmaximize():win.maximize();});
  ipcMain.handle('win:fullscreen',()=>{if(!win)return;if(win.isFullScreen())win.setFullScreen(false);else win.isMaximized()?win.unmaximize():win.maximize();});
  ipcMain.handle('win:close',()=>{killMpv();app.exit(0);});
  ipcMain.handle('win:alwaysTop',(_, v)=>{try{bgWin?.setAlwaysOnTop(v);}catch(_){}});
  ipcMain.handle('win:isMax',()=>win?.isMaximized());
  ipcMain.handle('win:isFs',()=>win?.isFullScreen());
  ipcMain.handle('win:snap',(_,zone)=>{
    if(!win||!bgWin)return;
    const{workArea}=screen.getPrimaryDisplay();
    const{x,y,width:W,height:H}=workArea;
    const b={'half-left':{x,y,width:Math.floor(W/2),height:H},'half-right':{x:x+Math.floor(W/2),y,width:Math.ceil(W/2),height:H},'maximize':{x,y,width:W,height:H}}[zone];
    if(b){win.setBounds(b);sync();}
  });
  ipcMain.handle('win:theatre',()=>{if(win)win.isMaximized()?win.unmaximize():win.maximize();});
  ipcMain.handle('dialog:open',async()=>{const r=await dialog.showOpenDialog(win,{title:'Open Media',properties:['openFile','multiSelections'],filters:[{name:'Media',extensions:[...MEDIA]},{name:'All',extensions:['*']}]});return r.canceled?[]:r.filePaths;});
  ipcMain.handle('dialog:openSub',async()=>{const r=await dialog.showOpenDialog(win,{title:'Add Subtitle',properties:['openFile'],filters:[{name:'Subtitles',extensions:['srt','ass','ssa','vtt','sub','idx','sup']}]});return r.canceled?null:r.filePaths[0];});
  ipcMain.handle('dialog:openPDF',async()=>{const r=await dialog.showOpenDialog(win,{title:'Open PDF',properties:['openFile'],filters:[{name:'PDF',extensions:['pdf']}]});return r.canceled?null:r.filePaths[0];});
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
  ipcMain.handle('app:external',(_,u)=>shell.openExternal(u));
  ipcMain.handle('app:addRecent',(_,f)=>{try{app.addRecentDocument(f);}catch(_){}});
  ipcMain.handle('app:checkUpdate',async()=>{try{return await autoUpdater.checkForUpdates();}catch(e){return{error:e.message};}});
  ipcMain.handle('app:installUpdate',()=>autoUpdater.quitAndInstall(false,true));
  ipcMain.handle('app:isDefault',()=>app.isDefaultProtocolClient('bm-player'));
  ipcMain.handle('app:setDefault',()=>{try{app.setAsDefaultProtocolClient('bm-player');}catch(_){}});
  ipcMain.handle('gallery:browse',async()=>{const r=await dialog.showOpenDialog(win,{title:'Select Folder',properties:['openDirectory']});return r.canceled?null:r.filePaths[0];});
  ipcMain.handle('gallery:scan',async(_,folderPath)=>{
    if(!folderPath||!fs.existsSync(folderPath))return[];
    const ALL=new Set(['jpg','jpeg','png','webp','gif','bmp','tiff','avif','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka','m4b']);
    try{return fs.readdirSync(folderPath,{withFileTypes:true}).filter(f=>f.isFile()&&ALL.has(path.extname(f.name).slice(1).toLowerCase())).map(f=>({path:path.join(folderPath,f.name),name:f.name}));}catch(_){return[];}
  });
}

function setupUpdater(){
  autoUpdater.on('update-available',info=>send('updater:status',{state:'available',ver:info.version}));
  autoUpdater.on('download-progress',p=>send('updater:status',{state:'progress',pct:Math.round(p.percent)}));
  autoUpdater.on('update-downloaded',info=>send('updater:status',{state:'ready',ver:info.version}));
  autoUpdater.on('error',err=>send('updater:status',{state:'error',msg:err.message}));
  setTimeout(()=>{try{autoUpdater.checkForUpdates();}catch(_){}},12000);
}

function getMpv(){return[path.join(process.resourcesPath||'','mpv','mpv.exe'),path.join(__dirname,'vendor','mpv','mpv.exe'),path.join(__dirname,'bin','mpv.exe')].find(p=>fs.existsSync(p))||null;}
function initMpv(){const exe=getMpv();if(!exe){send('mpv:status',{state:'missing'});return;}startMpv(exe);}
function startMpv(exe){
  killMpv();
  const wid=win.getNativeWindowHandle().readInt32LE(0);
  mpvProc=spawn(exe,[`--input-ipc-server=${PIPE}`,`--wid=${wid}`,'--idle=yes','--keep-open=yes','--no-border','--osd-level=0','--hwdec=auto-safe','--vo=direct3d','--volume=100','--sub-auto=fuzzy','--sub-ass-override=force','--sub-use-margins=yes','--sub-margin-y=90','--sub-bold=yes','--sub-font=Segoe UI','--sub-font-size=44','--sub-shadow-offset=2','--sub-border-size=3','--sub-color=1.0/1.0/1.0/1.0'],{stdio:'ignore',windowsHide:true});
  mpvProc.on('exit',code=>{ipcOk=false;send('mpv:status',{state:'crashed'});if(code!==0&&code!==null)setTimeout(()=>initMpv(),2000);});
  setTimeout(()=>connectIpc(),1500);
}
function connectIpc(retry=0){
  if(!mpvProc||mpvProc.killed)return;
  try{mpvSock?.destroy();}catch(_){}
  mpvSock=net.createConnection(PIPE);
  mpvSock.on('connect',()=>{
    ipcOk=true;send('mpv:status',{state:'ready'});
    [[1,'pause'],[2,'time-pos'],[3,'duration'],[4,'volume'],[5,'mute'],[6,'media-title'],[7,'filename'],[8,'track-list'],[9,'playlist-pos'],[10,'playlist-count'],[11,'sub-delay'],[12,'audio-delay'],[13,'speed'],[14,'video-params'],[15,'audio-params'],[16,'video-codec'],[17,'audio-codec'],[18,'file-size'],[19,'container-format'],[20,'video-bitrate'],[21,'audio-bitrate'],[22,'chapter-list'],[23,'chapter'],[24,'loop-file'],[25,'loop-playlist'],[26,'demuxer-cache-state']]
    .forEach(([id,name])=>{try{mpvSock.write(JSON.stringify({command:['observe_property',id,name]})+'\n');}catch(_){}});
  });
  mpvSock.on('data',chunk=>{
    mpvBuf+=chunk.toString();let nl;
    while((nl=mpvBuf.indexOf('\n'))!==-1){const line=mpvBuf.slice(0,nl).trim();mpvBuf=mpvBuf.slice(nl+1);if(line){try{handleMsg(JSON.parse(line));}catch(_){}}}
  });
  mpvSock.on('error',e=>{if((e.code==='ENOENT'||e.code==='ECONNREFUSED')&&retry<20)setTimeout(()=>connectIpc(retry+1),500);});
  mpvSock.on('close',()=>{ipcOk=false;if(mpvProc&&!mpvProc.killed)setTimeout(()=>connectIpc(),2500);});
}
function handleMsg(msg){
  if(msg.request_id!==undefined){const cb=cbs.get(msg.request_id);if(cb){cbs.delete(msg.request_id);msg.error&&msg.error!=='success'?cb.rej(new Error(msg.error)):cb.res(msg.data);}return;}
  if(!msg.event)return;
  if(msg.event==='property-change'){
    if(msg.name==='track-list')trackList=Array.isArray(msg.data)?msg.data:[];
    if(msg.name==='sub-delay')currentSubDelay=msg.data??0;
    if(msg.name==='audio-delay')currentAudioDelay=msg.data??0;
    if(['video-params','audio-params','video-codec','audio-codec','file-size','container-format','video-bitrate','audio-bitrate','duration','chapter-list','filename'].includes(msg.name)){mediaProps[msg.name]=msg.data;send('mpv:mediaProps',mediaProps);}
  }
  send('mpv:event',msg);
  if(msg.event==='property-change')send('mpv:prop',{name:msg.name,data:msg.data});
}
function mpvCmd(cmd,...args){return new Promise((res,rej)=>{if(!ipcOk||!mpvSock)return rej(new Error('mpv not ready'));const id=++reqId;cbs.set(id,{res,rej});try{mpvSock.write(JSON.stringify({command:[cmd,...args],request_id:id})+'\n');}catch(e){cbs.delete(id);return rej(e);}setTimeout(()=>{if(cbs.has(id)){cbs.delete(id);rej(new Error('timeout'));}},10000);});}
function openFiles(files){if(!files?.length)return;const valid=files.filter(f=>f.startsWith('http')||isMedia(f));if(!valid.length)return;mpvCmd('loadfile',valid[0],'replace').catch(()=>{});valid.slice(1).forEach(f=>mpvCmd('loadfile',f,'append').catch(()=>{}));send('mpv:opened',valid);valid.forEach(f=>{try{app.addRecentDocument(f);}catch(_){}});}
function killMpv(){ipcOk=false;try{mpvSock?.destroy();}catch(_){}mpvSock=null;try{mpvProc?.kill();}catch(_){}mpvProc=null;}
const isMedia=f=>MEDIA.has(path.extname(f).slice(1).toLowerCase());
