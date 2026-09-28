'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const inv=(ch,...a)=>ipcRenderer.invoke(ch,...a);
const on=(ch,cb)=>ipcRenderer.on(ch,(_,d)=>cb(d));
contextBridge.exposeInMainWorld('api',{
  // Lite: where the page's video area is, so the video window can sit over it
  // (null when no video is showing). Sent, not invoked: it follows resizes.
  video:{
    setRect: r=>ipcRenderer.send('video:rect', r ? { x:+r.x, y:+r.y, width:+r.width, height:+r.height } : null),
  },
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
    pipSize:()=>inv('win:pipSize'),
    pip:       on=>inv('win:pip',on),
    onState:   cb=>on('win:state',cb),
    onPipState:cb=>on('win:pipState',cb),
  },
  dialog:{
    open:    ()=>inv('dialog:open'),
    openSub: ()=>inv('dialog:openSub'),
    openPDF: ()=>inv('dialog:openPDF'),
    savePDF: defaultName=>inv('dialog:savePDF',defaultName),
    openM3u:  ()=>inv('dialog:openM3u'),
    saveM3u:  defaultName=>inv('dialog:saveM3u',defaultName),
  },
  pdfFile:{
    write:(path,data)=>inv('pdf:writeFile',path,data),
  },
  plugins:{
    list:       ()=>inv('plugins:list'),
    setEnabled: (id,en)=>inv('plugins:setEnabled',id,en),
    openFolder: ()=>inv('plugins:openFolder'),
    css:        (id)=>inv('plugins:css',id),
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
    // v1.9.0: Lite mode info from main process — build-time flag, platform,
    // arch, real CPU/RAM counts (used by the renderer's auto-detect).
    perfInfo:     ()=>inv('app:perfInfo'),
    diagnostics:  ()=>inv('app:diagnostics'),
  },
  gallery:{
    browse:()=>inv('gallery:browse'),
    scan:  f=>inv('gallery:scan',f),
    thumb: (f,size)=>inv('gallery:thumb',f,size),
  },
  music:{
    tags: paths=>inv('music:tags',paths),
  },
  showContextMenu:()=>inv('show-context-menu'),
});
