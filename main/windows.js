'use strict';
/**
 * The windows (v3.47.0, from main.js): making them, keeping the picture
 * window behind the controls, full screen, picture-in-picture and the pin,
 * and the page's messages about them.
 */
const { app, BaseWindow, BrowserWindow, screen, shell } = require('electron');
const path = require('path');
const S = require('./state');
const send = require('./send');
const { logFatal } = require('./log');
const { IS_WIN, IS_MAC, ROOT, FLAGS, IS_LITE_BUILD } = require('./env');
const PS = require('../plugin-safety');
// mpv is stopped as the windows close. Asked for when needed: mpv.js asks
// this file for the window to draw in, so neither may need the other while
// it is still being loaded.
const mpv = () => require('./mpv');

// Lite (v3.23.0): mpv draws into its own opaque window laid over the page's
// video area only, so the control bar below it stays visible. It used to draw
// into the Lite window itself and covered the controls on Windows.
let liteVideoRect=null;
let pipPrevBounds=null,pipWasMaximized=false,pipSizeIdx=0;
// Full screen (v3.37.0): the whole screen, the taskbar included. "Full screen"
// used to maximise the window, because it was never tried on a real screen.
// The state is kept here. On Windows a transparent window, as the controls
// window is, goes full screen by taking the screen's bounds, and Electron's
// isFullScreen() goes on saying false (native_window_views.cc, SetFullScreen:
// "this path will be used for transparent windows as well"). Asking it, the
// old code could never have left full screen again. And setFullScreen(false)
// on such a window that is not in full screen sets it to bounds it never
// saved: it is only ever called from here, after an enter.
let fullWasMax=false;
function winState(){const win=S.win;return S.fullOn?'fullscreen':(win&&!win.isDestroyed()&&win.isMaximized()?'maximized':'normal');}
function setFull(on){
  const win=S.win;
  on=!!on;
  if(!win||win.isDestroyed()||on===S.fullOn||(on&&S.pipActive))return S.fullOn;
  try{
    if(on){
      // A maximised window is restored first, on Windows in the full layout,
      // and maximised again on the way out: there the screen's bounds are set
      // on the window as it is, and a maximised window keeps its own ideas
      // about its size. Elsewhere the system remembers.
      fullWasMax=false;
      if(IS_WIN&&S.bgWin&&win.isMaximized()){fullWasMax=true;win.unmaximize();}
      S.fullOn=true;
      win.setFullScreen(true);
    }else{
      S.fullOn=false;
      win.setFullScreen(false);
      if(fullWasMax)win.maximize();
      fullWasMax=false;
    }
  }catch(e){logFatal('full screen',e);}
  send('win:state',winState());
  alignBg();syncLiteVideo();
  return S.fullOn;
}
// Left or entered some other way (a window manager's own key): follow it.
function watchFull(w){
  w.on('enter-full-screen',()=>{if(!S.fullOn){S.fullOn=true;send('win:state',winState());}});
  w.on('leave-full-screen',()=>{if(S.fullOn){S.fullOn=false;fullWasMax=false;send('win:state',winState());}});
}

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
  S.alwaysOnTopFlag = !!v;
  for (const w of [S.bgWin, S.win, S.videoWin]) { try { if (w && !w.isDestroyed()) w.setAlwaysOnTop(S.alwaysOnTopFlag); } catch (_) {} }
}

function alignBg() {
  const bgWin = S.bgWin, win = S.win;
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
  if (IS_LITE_BUILD && S.videoWin) return S.videoWin;
  return (FLAGS.videoLayer === 'back' && S.bgWin) ? S.bgWin : S.win;
}
// Fits the Lite video window over the rectangle the page reports (its video
// area, in page pixels), or hides it when no video is showing.
function syncLiteVideo() {
  const videoWin = S.videoWin, win = S.win;
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
// Reads the native window handle into the numeric ID mpv's --wid expects.
// Windows (HWND) and Linux/X11 (XID) are 32-bit values; macOS (NSView*) is
// a 64-bit pointer, so it needs a wider read or precision is silently lost.
// NOTE: macOS window embedding via --wid is documented by mpv as less
// mature than the Windows/X11 path — this is implemented per mpv's public
// docs but has not been verified on real Mac hardware from this environment.
function getWid() {
  const w = videoWindow();
  if (!w || w.isDestroyed()) return null;        // closing: there is nothing to draw in
  const buf = w.getNativeWindowHandle();
  if (IS_MAC) return buf.readBigUInt64LE(0).toString();
  return buf.readInt32LE(0);
}

/**
 * The app's page stays the app's page (v3.42.0). A link, or a file dropped
 * where nothing takes it, would make Chromium open that address in the
 * window, and the player would be gone until a restart. Web addresses open
 * in the browser instead; anything else is refused. Reloading (Lite and Pro
 * switch by reloading) is not a navigation and is not affected.
 */
function guardPage(w) {
  const wc = w.webContents;
  const ours = u => { try { const a = new URL(u), b = new URL(wc.getURL()); return a.protocol === b.protocol && a.pathname === b.pathname; } catch (_) { return false; } };
  const outside = u => { const safe = PS.safeExternalUrl(u); if (safe) shell.openExternal(safe).catch(() => {}); };
  wc.on('will-navigate', (e, url) => { if (!ours(url)) { e.preventDefault(); outside(url); } });
  wc.setWindowOpenHandler(({ url }) => { outside(url); return { action: 'deny' }; });
}

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

// CSP. 'unsafe-eval' was here on the claim that Three.js and dynamic
// imports need it. Neither does, and nothing in this codebase calls
// eval() or new Function() — verified by grep and enforced by the
// contract check. Removing it closes the widest hole in the policy.
function setCsp(w) {
  w.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' data: blob: bmfile:; script-src 'self' 'unsafe-inline' bmfile:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: bmfile: file: https:; media-src 'self' bmfile: file: data: blob:; connect-src 'self' bmfile: file: http: https: ws: wss:; font-src 'self' data:;"]
      }
    });
  });
}

/** Makes the windows, once the app is ready. boot(show) runs once the page can be shown. */
function createWindows(makeBoot) {
  if (IS_LITE_BUILD) {
    // ── Lite window setup ──
    // Single opaque window — no bgWin backdrop, no transparency compositing.
    // This is the single biggest GPU-saver on weak hardware: keeping two
    // frameless transparent windows in sync (resize, move, maximize) was
    // a per-frame compositor cost on the bgWin sync path that low-end GPUs
    // can't really afford. One window = one paint target.
    const win=S.win=new BrowserWindow({width:1280,height:780,minWidth:900,minHeight:560,frame:false,transparent:false,backgroundColor:'#0b0c10',show:false,title:'BM Player Lite',webPreferences:{nodeIntegration:false,contextIsolation:true,preload:path.join(ROOT,'preload.js'),webSecurity:FLAGS.fileScheme==='bmfile',sandbox:FLAGS.rendererSandbox,spellcheck:false}});
    win.on('maximize',()=>{send('win:state',winState());});
    // Minimised or hidden: the page pauses its decorative loops (v3.30.0).
    for(const [ev,h] of [['minimize',true],['hide',true],['restore',false],['show',false]]) win.on(ev,()=>send('win:hidden',h));
    win.on('unmaximize',()=>{send('win:state',winState());});
    watchFull(win);
    win.loadFile(path.join(ROOT,'src','index.html'),{query:flagQuery()});
    guardPage(win);
    setCsp(win);
    const boot=makeBoot(()=>win.show());
    win.once('ready-to-show',boot);
    setTimeout(boot,4000);
    win.on('closed',()=>{mpv().killMpv();try{S.videoWin?.destroy();}catch(_){}app.exit(0);});
    // thickFrame:false and roundedCorners:false, as bgWin has had since v3.26.2
    // (v3.35.0): without them Windows 11 drew its frame over the borderless
    // picture window, a translucent layer over the video in BM Player Lite only,
    // and Windows 11 and macOS rounded its corners, showing the page behind.
    S.videoWin=new BaseWindow({parent:win,show:false,frame:false,transparent:false,backgroundColor:'#000000',
      focusable:false,skipTaskbar:true,hasShadow:false,thickFrame:false,roundedCorners:false,resizable:false,movable:false,minimizable:false,maximizable:false,
      title:'BM Player Lite video'});
    // Clicks and the pointer pass through to the page underneath, which owns
    // every control, as bgWin does in the full layout.
    try{S.videoWin.setIgnoreMouseEvents(true);}catch(_){}
    for (const ev of ['move','resize','maximize','unmaximize','enter-full-screen','leave-full-screen','restore','show','focus'])
      win.on(ev, syncLiteVideo);
    // The pin and PiP make the Lite window always-on-top. The video window must
    // follow, or it drops behind the page and the picture disappears.
    // The picture window follows, from the window's state now rather than the
    // event's: on Windows, making an owned window non-topmost also makes its
    // OWNER non-topmost, so a late event saying false undid PiP (v3.30.1, on
    // a real machine: the PiP window was not on top). Never false during PiP.
    win.on('always-on-top-changed',()=>{try{S.videoWin?.setAlwaysOnTop(S.pipActive||win.isAlwaysOnTop());}catch(_){}syncLiteVideo();});
    win.on('minimize',()=>{try{S.videoWin?.hide();}catch(_){}});
    win.on('hide',()=>{try{S.videoWin?.hide();}catch(_){}});
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
    const bgWin=S.bgWin=new BaseWindow({width:1280,height:780,minWidth:900,minHeight:560,frame:false,transparent:false,backgroundColor:'#000000',show:false,title:'BM Player BG',
      thickFrame:false,hasShadow:false,roundedCorners:false});
    // bgWin is a pure opaque visual backdrop (no interactive content) — never
    // let it intercept clicks meant for the transparent UI window above it.
    try{bgWin.setIgnoreMouseEvents(true);}catch(_){}
    const win=S.win=new BrowserWindow({parent:bgWin,width:1280,height:780,minWidth:900,minHeight:560,frame:false,transparent:true,backgroundColor:'#00000000',show:false,title:'BM Player',webPreferences:{nodeIntegration:false,contextIsolation:true,preload:path.join(ROOT,'preload.js'),webSecurity:FLAGS.fileScheme==='bmfile',sandbox:FLAGS.rendererSandbox,spellcheck:false}});
    const sync=alignBg;
    win.on('resize',sync);win.on('move',sync);
    // Also the end of a drag, restoring and fullscreen, and a light check that
    // puts the picture back if anything leaves the two windows out of step.
    for (const ev of ['resized','moved','restore','enter-full-screen','leave-full-screen','show']) win.on(ev,sync);
    const bgAlignTimer=setInterval(alignBg,600);
    win.on('closed',()=>clearInterval(bgAlignTimer));
    win.on('maximize',()=>{sync();send('win:state',winState());});
    // Minimised or hidden: the page pauses its decorative loops (v3.30.0).
    for(const [ev,h] of [['minimize',true],['hide',true],['restore',false],['show',false]]) win.on(ev,()=>send('win:hidden',h));
    win.on('unmaximize',()=>{sync();send('win:state',winState());});
    watchFull(win);
    win.loadFile(path.join(ROOT,'src','index.html'),{query:flagQuery()});
    guardPage(win);
    setCsp(win);
    const boot=makeBoot(()=>{bgWin.show();win.show();});
    win.once('ready-to-show',boot);
    setTimeout(boot,4000);
    win.on('closed',()=>{mpv().killMpv();try{S.bgWin?.destroy();}catch(_){}app.exit(0);});
  }
}

function register(ipcMain) {
  // Lite: the page's video area, or null when no video is showing.
  ipcMain.on('video:rect', (e, r) => {
    if (e.sender !== S.win?.webContents) return;
    const ok = r && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(r[k]));
    liteVideoRect = ok ? { x: r.x, y: r.y, width: Math.max(0, r.width), height: Math.max(0, r.height) } : null;
    syncLiteVideo();
  });
  ipcMain.handle('win:minimize',()=>{try{(S.bgWin||S.win)?.minimize();}catch(_){}});
  // In full screen, maximise and theatre lead out of it, to the window as it was.
  ipcMain.handle('win:maximize',()=>{const win=S.win;if(!win)return;if(S.fullOn){setFull(false);return;}win.isMaximized()?win.unmaximize():win.maximize();});
  ipcMain.handle('win:fullscreen',()=>setFull(!S.fullOn));
  ipcMain.handle('win:close',()=>{mpv().killMpv();app.exit(0);});
  ipcMain.handle('win:alwaysTop',(_, v)=>{try{S.alwaysOnTopFlag=!!v;if(S.pipActive)return;applyOnTop(v);}catch(_){}});
  ipcMain.handle('win:isMax',()=>S.win?.isMaximized());
  ipcMain.handle('win:isFs',()=>S.fullOn);
  ipcMain.handle('win:snap',(_,zone)=>{
    const win=S.win;
    if(!win)return;
    setFull(false);
    const{workArea}=screen.getPrimaryDisplay();
    const{x,y,width:W,height:H}=workArea;
    const b={'half-left':{x,y,width:Math.floor(W/2),height:H},'half-right':{x:x+Math.floor(W/2),y,width:Math.ceil(W/2),height:H},'maximize':{x,y,width:W,height:H}}[zone];
    if(b){win.setBounds(b);if(S.bgWin)S.bgWin.setBounds(b);}
  });
  ipcMain.handle('win:theatre',()=>{const win=S.win;if(!win||S.pipActive)return;if(S.fullOn){setFull(false);return;}win.isMaximized()?win.unmaximize():win.maximize();});

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
    const win = S.win, bgWin = S.bgWin;
    if (!win) return;
    // Idempotent. A second "enter" used to overwrite the saved normal bounds
    // with the PiP bounds, so leaving PiP restored a 340x200 window that the
    // 900x560 minimum then forced open partly off screen.
    if (!!enable === S.pipActive) return;
    if (enable) {
      // setBounds on a maximised window is ignored on Windows. Leave full
      // screen and maximise first, and remember maximise so it can be put back.
      setFull(false);
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
      S.pipActive = true;
      try { S.videoWin?.setAlwaysOnTop(true); } catch(_){}
      // Held on top: once more as the transition settles, in case a late event
      // or Windows' owner rule took it away (see always-on-top-changed).
      for (const ms of [150, 600]) setTimeout(() => { if (!S.pipActive) return; for (const w of [S.bgWin, S.win, S.videoWin]) { try { if (w && !w.isDestroyed() && !w.isAlwaysOnTop()) w.setAlwaysOnTop(true); } catch(_){} } }, ms);
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
        try { bgWin.setAlwaysOnTop(S.alwaysOnTopFlag); } catch(_){}
        try { bgWin.setMinimumSize(900, 560); } catch(_){}
        bgWin.setBounds(prev);
        win.setAlwaysOnTop(S.alwaysOnTopFlag);
      } else {
        win.setAlwaysOnTop(S.alwaysOnTopFlag);
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
      S.pipActive = false;
      send('win:pipState', false);
    }
  });
  // Cycle PiP between three sizes, keeping the corner it's anchored to so it
  // grows away from the screen edge rather than off it.
  ipcMain.handle('win:pipSize', () => {
    const win = S.win;
    if (!win || !S.pipActive) return null;
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
    if (S.bgWin && FLAGS.videoLayer === 'back') { try { S.bgWin.setBounds({ x, y, width: w, height: h }); } catch(_){} }
    return { width: w, height: h };
  });
}

module.exports = { winState, setFull, watchFull, applyOnTop, alignBg, videoWindow, syncLiteVideo, getWid, guardPage, flagQuery, createWindows, register };
