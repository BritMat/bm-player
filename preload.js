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
    alwaysTop:  v  => inv('win:alwaysTop',v),
    isMax:      () => inv('win:isMax'),
    isFs:       () => inv('win:isFs'),
    onState:    cb => on('win:state', cb),
  },
  dialog: {
    open: () => inv('dialog:open'),
  },
  mpv: {
    cmd:    (c,...a) => inv('mpv:cmd',c,...a),
    open:   files   => inv('mpv:open',files),
    append: f       => inv('mpv:append',f),
    status: ()      => inv('mpv:status'),
    onStatus: cb    => on('mpv:status',  cb),
    onEvent:  cb    => on('mpv:event',   cb),
    onProp:   cb    => on('mpv:prop',    cb),
    onOpened: cb    => on('mpv:opened',  cb),
  },
  app: {
    version:  () => inv('app:version'),
    external: u  => inv('app:external',u),
  },
  updater: {
    install: () => inv('updater:install'),
    onUpdate: cb => on('updater', cb),
  }
});