'use strict';
/**
 * The system's dialogs (v3.47.0, from main.js): open and save, folders,
 * questions, each owned by the player window and never behind it.
 */
const { dialog } = require('electron');
const fs = require('fs');
const S = require('./state');
const { applyOnTop } = require('./windows');

// Every dialog opens as a child of the player window. Without a parent the
// file picker is just another window, and on Windows it opened behind the
// player (reported on a real machine, despite focusWin's workaround). An
// owned dialog always stays above its owner. Electron reads
// showOpenDialog(undefined, opts) as having no options, so the window is
// passed only when there is one.
const dialogParent = () => (S.win && !S.win.isDestroyed()) ? S.win : null;
// And while a dialog is open, neither window is always-on-top. With the pin
// on, or left on by PiP, the player stayed in front of its own folder picker
// on Windows (reported on a real machine, after the parent fix above).
async function withoutTopmost(fn) {
  // Every BM window, as the pin covers (applyOnTop), Lite's video window included.
  const was = [S.win, S.bgWin, S.videoWin].map(w => [w, w?.isAlwaysOnTop?.()]);
  for (const [w, top] of was) if (w && top && !w.isDestroyed()) { try { w.setAlwaysOnTop(false); } catch {} }
  try { return await fn(); }
  finally { for (const [w, top] of was) if (w && top && !w.isDestroyed()) { try { w.setAlwaysOnTop(true); } catch {} } }
}
const openDialog = opts => withoutTopmost(() => { const p = dialogParent(); return p ? dialog.showOpenDialog(p, opts) : dialog.showOpenDialog(opts); });
const messageBox = opts => withoutTopmost(() => { const p = dialogParent(); return p ? dialog.showMessageBox(p, opts) : dialog.showMessageBox(opts); });
const saveDialog = opts => withoutTopmost(() => { const p = dialogParent(); return p ? dialog.showSaveDialog(p, opts) : dialog.showSaveDialog(opts); });

// Force the window to front/focused before opening native dialogs — on
// Windows, frameless+transparent windows can otherwise cause the OS file
// picker to open BEHIND the app. Plain focus()/moveTop() alone is a
// commonly-insufficient fix for this; briefly pulsing alwaysOnTop forces
// a true OS-level foreground transition, and the short delay lets that
// transition actually complete before the dialog attaches.
const focusWin = async () => {
  const win = S.win;
  try {
    if (win.isMinimized()) win.restore();
    win.show();
    win.setAlwaysOnTop(true);
    win.moveTop();
    win.focus();
    await new Promise(r => setTimeout(r, 60));
    applyOnTop(S.alwaysOnTopFlag); // the user's actual preference, on every window
  } catch(_) {}
};

function register(ipcMain) {
  const { MEDIA } = require('./mpv');
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
}

module.exports = { dialogParent, withoutTopmost, openDialog, messageBox, saveDialog, focusWin, register };
