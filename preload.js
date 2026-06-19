'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const inv = (ch,...a) => ipcRenderer.invoke(ch,...a);
const on  = (ch,cb)   => ipcRenderer.on(ch, (_,d) => cb(d));

contextBridge.exposeInMainWorld('api', {
  win: {
    minimize:   () => inv('win:minimize'),
    maximize:   () => inv('win:maximize'),
    close:      () => inv('win:close'),
    fullscreen: () => inv('win:fullscreen'),
    alwaysTop:  v  => inv('win:alwaysTop', v),
    isMax:      () => inv('win:isMax'),
    isFs:       () => inv('win:isFs'),
    onState:    cb => on('win:state', cb),
  },
  dialog: {
    open:    () => inv('dialog:open'),
    openSub: () => inv('dialog:openSub'),
  },
  mpv: {
    cmd:         (c,...a) => inv('mpv:cmd', c, ...a),
    open:        files    => inv('mpv:open', files),
    append:      f        => inv('mpv:append', f),
    status:      ()       => inv('mpv:status'),
    getPlaylist: ()       => inv('mpv:getPlaylist'),
    onStatus:     cb => on('mpv:status',     cb),
    onEvent:      cb => on('mpv:event',      cb),
    onProp:       cb => on('mpv:prop',       cb),
    onTracks:     cb => on('mpv:tracks',     cb),
    onOpened:     cb => on('mpv:opened',     cb),
    onMediaProps: cb => on('mpv:mediaProps', cb),
  },
  adj: {
    subDelay:     d => inv('adj:subDelay', d),
    audioDelay:   d => inv('adj:audioDelay', d),
    resetSub:     () => inv('reset:subDelay'),
    resetAudio:   () => inv('reset:audioDelay'),
  },
  app: {
    version:     () => inv('app:version'),
    external:    u  => inv('app:external', u),
    addRecent:   f  => inv('app:addRecent', f),
    checkUpdate: () => inv('app:checkUpdate'),
  },
  showContextMenu: () => inv('show-context-menu'),

  gallery: {
    browse: ()         => inv('gallery:browse'),
    scan:   folderPath => inv('gallery:scan', folderPath),
  },
});