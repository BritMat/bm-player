'use strict';
/**
 * mpv (v3.47.0, from main.js): finding it, starting it inside the picture
 * window, the one connection to it, what it reports, starting it again
 * after a crash, and the page's messages for it.
 */
const { app } = require('electron');
const path = require('path'), fs = require('fs'), net = require('net'), os = require('os');
const { spawn } = require('child_process');
const S = require('./state');
const send = require('./send');
const { logFatal } = require('./log');
const { IS_WIN, IS_MAC, IS_LINUX, ROOT, MPV_VO, MPV_AO } = require('./env');
const { getWid } = require('./windows');
const { makeThumbs } = require('../thumbs');   // v3.46.0: pictures for the seek bar

let mpvBuf='',reqId=0;
const cbs=new Map();
// IPC transport path: Windows uses a named pipe; macOS/Linux use a Unix
// domain socket file. net.createConnection() accepts either format
// transparently, so no other code needs to branch on this.
const PIPE = IS_WIN
  ? `\\\\.\\pipe\\bm-mpv-${process.pid}`
  : path.join(os.tmpdir(), `bm-mpv-${process.pid}.sock`);
const MEDIA=new Set(['mp4','mkv','avi','mov','wmv','flv','webm','ts','m2ts','m4v','3gp','rmvb','ogv','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka','vob','mpg','mpeg','m2v','divx','hevc','av1','m3u','m3u8','pls']);
let trackList=[],currentSubDelay=0,currentAudioDelay=0,mediaProps={};

// mpv binary discovery — checks the app-bundled copy first (vendor/mpv,
// same convention on every OS), then falls back to common system install
// locations so users with mpv already installed via a package manager
// (brew, apt) don't need a bundled copy at all.
const MPV_BIN = IS_WIN ? 'mpv.exe' : 'mpv';
function getMpv() {
  const candidates = [
    path.join(process.resourcesPath || '', 'mpv', MPV_BIN),
    path.join(ROOT, 'vendor', 'mpv', MPV_BIN),
    path.join(ROOT, 'bin', MPV_BIN),
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

function startMpv(exe, minimalArgs){
  killMpv();
  // Clean up a stale socket file from a previous crashed run (Unix only —
  // named pipes on Windows don't leave a filesystem artifact like this).
  if (!IS_WIN) { try { fs.unlinkSync(PIPE); } catch(_) {} }

  const wid = getWid();
  if (wid === null) return;
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
    // A song's cover art is not a video (v3.35.0): mpv showed a cover beside
    // the file, or one inside it, as a picture, and BM Player took the song for
    // a video. BM Player shows the art itself, in the visual mode.
    '--audio-display=no',
    '--volume=100',
  ];
  const extraArgs = [
    '--sub-auto=fuzzy',
    '--sub-ass-override=scale', '--sub-use-margins=yes', '--sub-margin-y=90',
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
    // A thin outline and no shadow, as sub-style.js's default look (v3.39.0).
    // Outline 3 with shadow 2 drew a dark smudge round the letters on newer
    // mpv (0.41 on the laptop), where the shadow is 70% black.
    '--sub-font-size=44', '--sub-shadow-offset=0', '--sub-border-size=2.2',
    '--sub-color=1.0/1.0/1.0/1.0',
    // What mpv keeps of a stream in memory (v3.45.0): 64 MB ahead and 32
    // behind, against its own 150 and 50. A minute or more of a 1080p stream
    // either way; a file on the disk is read as it plays and keeps none.
    '--demuxer-max-bytes=64MiB', '--demuxer-max-back-bytes=32MiB',
  ];
  const args = minimalArgs ? coreArgs : [...coreArgs, ...extraArgs];

  const spawnedAt = Date.now();
  const proc = S.mpvProc = spawn(exe, args, { stdio: 'ignore', windowsHide: true });
  proc.on('exit', (code, signal) => {
    // Stopped on purpose: killMpv() lets go of the process before it ends,
    // for a restart or as the app closes. Nothing to report.
    if (proc !== S.mpvProc) return;
    S.ipcOk = false;
    S.mpvProc = null;
    const aliveMs = Date.now() - spawnedAt;
    // Any other end is a crash. A crash on Linux or macOS ends mpv with a
    // signal and no exit code, which was read as a clean exit, so mpv was
    // never started again and nothing played until BM Player was restarted
    // (v3.46.0). Found by killing mpv in the middle of a film. Each crash is
    // written to main-errors.log, which Diagnostics shows.
    logFatal('mpv ended by itself', `exit code ${code}, signal ${signal || 'none'}, after ${Math.round(aliveMs / 1000)} s`);
    // Crashing again and again, a minute after start each time, is a loop
    // too: after four in two minutes it waits for the next file opened.
    const now = Date.now();
    crashTimes = crashTimes.filter(t => now - t < 120000).concat(now);
    if (crashTimes.length > 4) { send('mpv:status', { state: 'crash-loop' }); return; }

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
      setTimeout(() => { if (!S.mpvProc) initMpv(); }, 1000);
    }
  });
  scheduleIpc(1500,0);
}
// One connection to mpv at a time, and one try at it waiting (v3.46.0). Every
// socket closed on purpose, the old one for a new one or mpv's after a crash,
// asked for a new connection 2.5 s on, and that one closed the connection in
// use to make its own: after mpv was started again it was torn down and made
// again every 2.5 s for good, and what was asked of mpv in between was lost.
// Found by killing mpv in the middle of a film in e2e part D.
let ipcRetryT=null;
function scheduleIpc(ms,retry){clearTimeout(ipcRetryT);ipcRetryT=setTimeout(()=>{ipcRetryT=null;connectIpc(retry);},ms);}
function connectIpc(retry=0){
  clearTimeout(ipcRetryT);ipcRetryT=null;
  if(!S.mpvProc||S.mpvProc.killed)return;
  const old=S.mpvSock;S.mpvSock=null;
  try{old?.destroy();}catch(_){}
  mpvBuf='';
  const sock=S.mpvSock=net.createConnection(PIPE);
  sock.on('connect',()=>{
    if(sock!==S.mpvSock)return;
    S.ipcOk=true;voLocked=false;send('mpv:status',{state:'ready'});
    if(S.pendingOpenFile){const f=S.pendingOpenFile;S.pendingOpenFile=null;openFiles([f]);}
    if(pendingOpenFiles){const f=pendingOpenFiles;pendingOpenFiles=null;openFiles(f);}
    [[1,'pause'],[2,'time-pos'],[3,'duration'],[4,'volume'],[5,'mute'],[6,'media-title'],[7,'filename'],[8,'track-list'],[9,'playlist-pos'],[10,'playlist-count'],[11,'sub-delay'],[12,'audio-delay'],[13,'speed'],[14,'video-params'],[15,'audio-params'],[16,'video-codec'],[17,'audio-codec'],[18,'file-size'],[19,'container-format'],[20,'video-bitrate'],[21,'audio-bitrate'],[22,'chapter-list'],[23,'chapter'],[24,'loop-file'],[25,'loop-playlist'],[26,'demuxer-cache-state'],[27,'eof-reached'],[28,'idle-active'],[29,'current-vo']]
    .forEach(([id,name])=>{try{sock.write(JSON.stringify({command:['observe_property',id,name]})+'\n');}catch(_){}});
  });
  sock.on('data',chunk=>{
    if(sock!==S.mpvSock)return;
    mpvBuf+=chunk.toString();let nl;
    while((nl=mpvBuf.indexOf('\n'))!==-1){const line=mpvBuf.slice(0,nl).trim();mpvBuf=mpvBuf.slice(nl+1);if(line){try{handleMsg(JSON.parse(line));}catch(_){}}}
  });
  sock.on('error',e=>{if(sock!==S.mpvSock)return;if((e.code==='ENOENT'||e.code==='ECONNREFUSED')&&retry<20)scheduleIpc(500,retry+1);});
  sock.on('close',()=>{
    if(sock!==S.mpvSock)return;   // replaced or let go on purpose
    S.ipcOk=false;S.mpvSock=null;
    // What was asked and not yet answered never will be: say so now rather
    // than after the ten seconds each request waits.
    for(const [id,cb] of cbs){cbs.delete(id);try{cb.rej(new Error('mpv went away'));}catch(_){}}
    if(S.mpvProc&&!S.mpvProc.killed&&!ipcRetryT)scheduleIpc(2500,0);
  });
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
function mpvCmd(cmd,...args){return new Promise((res,rej)=>{if(!S.ipcOk||!S.mpvSock)return rej(new Error('mpv not ready'));const id=++reqId;cbs.set(id,{res,rej});try{S.mpvSock.write(JSON.stringify({command:[cmd,...args],request_id:id})+'\n');}catch(e){cbs.delete(id);return rej(e);}setTimeout(()=>{if(cbs.has(id)){cbs.delete(id);rej(new Error('timeout'));}},10000);});}

// Files opened before mpv has connected. mpvCmd rejects until then, and the
// .catch below swallowed that, so a file opened in the first second or two
// after launch (a recent file, a quick double-click) silently never played.
// Reproduced every time in the real app; held here and opened on connect.
let pendingOpenFiles=null;
// The seek bar's pictures (v3.46.0), each made by an mpv of its own.
const thumbs=makeThumbs({getMpv});
// mpv's crashes in the last two minutes (v3.46.0). After too many, mpv is
// started again only when a file is opened.
let crashTimes=[];
function openFiles(files){if(!files?.length)return;const valid=files.filter(f=>f.startsWith('http')||isMedia(f));if(!valid.length)return;if(!S.ipcOk){pendingOpenFiles=valid;if(!S.mpvProc&&crashTimes.length){crashTimes=[];initMpv();}return;}mpvCmd('loadfile',valid[0],'replace').catch(()=>{});mpvCmd('set_property','pause',false).catch(()=>{});valid.slice(1).forEach(f=>mpvCmd('loadfile',f,'append').catch(()=>{}));send('mpv:opened',valid);valid.forEach(f=>{try{app.addRecentDocument(f);}catch(_){}});}
function killMpv(){S.ipcOk=false;clearTimeout(ipcRetryT);ipcRetryT=null;const sock=S.mpvSock;S.mpvSock=null;try{sock?.destroy();}catch(_){}try{S.mpvProc?.kill();}catch(_){}S.mpvProc=null;if(!IS_WIN){try{fs.unlinkSync(PIPE);}catch(_){}}}
function isMedia(f){return MEDIA.has(path.extname(f).slice(1).toLowerCase());}

function register(ipcMain) {
  ipcMain.handle('mpv:cmd',async(_,c,...a)=>mpvCmd(c,...a).catch(e=>({error:e.message})));
  ipcMain.handle('mpv:open',async(_,files)=>openFiles(files));
  ipcMain.handle('mpv:append',async(_,f)=>mpvCmd('loadfile',f,'append').catch(()=>{}));
  ipcMain.handle('mpv:status',()=>({ready:S.ipcOk}));
  ipcMain.handle('mpv:getPlaylist',async()=>{try{return await mpvCmd('get_property','playlist');}catch(_){return[];}});
  // A picture of the film where the pointer is on the seek bar (v3.46.0).
  ipcMain.handle('media:thumbAt',(_,f,t)=>thumbs.thumbAt(f,t));
  ipcMain.handle('show-context-menu',async()=>{
    if(S.ipcOk){try{const t=await mpvCmd('get_property','track-list');if(Array.isArray(t))trackList=t;}catch(_){}}
    send('mpv:trackList',trackList);
  });
  ipcMain.handle('adj:subDelay',(_,d)=>{if(d===0)currentSubDelay=0;else currentSubDelay+=d;mpvCmd('set_property','sub-delay',currentSubDelay).catch(()=>{});send('mpv:prop',{name:'sub-delay',data:currentSubDelay});});
  ipcMain.handle('adj:audioDelay',(_,d)=>{if(d===0)currentAudioDelay=0;else currentAudioDelay+=d;mpvCmd('set_property','audio-delay',currentAudioDelay).catch(()=>{});send('mpv:prop',{name:'audio-delay',data:currentAudioDelay});});
  ipcMain.handle('reset:subDelay',()=>{currentSubDelay=0;mpvCmd('set_property','sub-delay',0).catch(()=>{});});
  ipcMain.handle('reset:audioDelay',()=>{currentAudioDelay=0;mpvCmd('set_property','audio-delay',0).catch(()=>{});});
}

module.exports = { MEDIA, PIPE, getMpv, getMpvVersion, initMpv, startMpv, mpvCmd, openFiles, killMpv, isMedia, register };
