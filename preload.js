'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const inv=(ch,...a)=>ipcRenderer.invoke(ch,...a);
const on=(ch,cb)=>ipcRenderer.on(ch,(_,d)=>cb(d));
contextBridge.exposeInMainWorld('api',{
  win:{
    minimize:  ()=>inv('win:minimize'),
    maximize:  ()=>inv('win:maximize'),
    close:     ()=>inv('win:close'),
    fullscreen:()=>inv('win:fullscreen'),
    alwaysTop: v=>inv('win:alwaysTop',v),
    isMax:     ()=>inv('win:isMax'),
    isFs:      ()=>inv('win:isFs'),
    snap:      zone=>inv('win:snap',zone),
    theatre:   ()=>inv('win:theatre'),
    onState:   cb=>on('win:state',cb),
  },
  dialog:{
    open:    ()=>inv('dialog:open'),
    openSub: ()=>inv('dialog:openSub'),
    openPDF: ()=>inv('dialog:openPDF'),
  },
  mpv:{
    cmd:         (c,...a)=>inv('mpv:cmd',c,...a),
    open:        files=>inv('mpv:open',files),
    append:      f=>inv('mpv:append',f),
    status:      ()=>inv('mpv:status'),
    getPlaylist: ()=>inv('mpv:getPlaylist'),
    onStatus:    cb=>on('mpv:status',cb),
    onEvent:     cb=>on('mpv:event',cb),
    onProp:      cb=>on('mpv:prop',cb),
    onOpened:    cb=>on('mpv:opened',cb),
    onMediaProps:cb=>on('mpv:mediaProps',cb),
    onTrackList: cb=>on('mpv:trackList',cb),
  },
  adj:{
    subDelay:   d=>inv('adj:subDelay',d),
    audioDelay: d=>inv('adj:audioDelay',d),
    resetSub:   ()=>inv('reset:subDelay'),
    resetAudio: ()=>inv('reset:audioDelay'),
  },
  app:{
    version:      ()=>inv('app:version'),
    external:     u=>inv('app:external',u),
    addRecent:    f=>inv('app:addRecent',f),
    checkUpdate:  ()=>inv('app:checkUpdate'),
    installUpdate:()=>inv('app:installUpdate'),
    isDefault:    ()=>inv('app:isDefault'),
    setDefault:   ()=>inv('app:setDefault'),
    onUpdater:    cb=>on('updater:status',cb),
    onFirstRun:   cb=>on('app:firstRun',cb),
  },
  gallery:{
    browse:()=>inv('gallery:browse'),
    scan:  f=>inv('gallery:scan',f),
  },
  showContextMenu:()=>inv('show-context-menu'),
});
