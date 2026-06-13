'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ── Safe invoke helper ─────────────────────────────────────────────────────
const invoke = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

// ── Expose secure API to renderer ──────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

  // Window controls
  window: {
    minimize:      () => invoke('window:minimize'),
    maximize:      () => invoke('window:maximize'),
    close:         () => invoke('window:close'),
    fullscreen:    () => invoke('window:fullscreen'),
    alwaysOnTop:   val => invoke('window:alwaysOnTop', val),
    isMaximized:   () => invoke('window:isMaximized'),
    isFullscreen:  () => invoke('window:isFullscreen'),
    onState:       cb => ipcRenderer.on('window:state', (_ev, s)  => cb(s)),
    onResize:      cb => ipcRenderer.on('window:resize', (_ev, s) => cb(s)),
  },

  // Dialogs
  dialog: {
    openFile:   () => invoke('dialog:openFile'),
    openFolder: () => invoke('dialog:openFolder'),
  },

  // mpv playback
  mpv: {
    command:       (cmd, ...args)  => invoke('mpv:command', cmd, ...args),
    openFiles:     files           => invoke('mpv:openFiles', files),
    addToPlaylist: filePath        => invoke('mpv:addToPlaylist', filePath),
    getStatus:     ()              => invoke('mpv:getStatus'),
    downloadMpv:   ()              => invoke('app:downloadMpv'),

    onStatus:    cb => ipcRenderer.on('mpv:status',    (_ev, d) => cb(d)),
    onEvent:     cb => ipcRenderer.on('mpv:event',     (_ev, d) => cb(d)),
    onProp:      cb => ipcRenderer.on('mpv:prop',      (_ev, d) => cb(d)),
    onFilesOpen: cb => ipcRenderer.on('player:files-opened', (_ev, d) => cb(d)),
    onDownload:  cb => ipcRenderer.on('mpv:download-progress', (_ev, d) => cb(d)),
  },

  // App info
  app: {
    getVersion:   () => invoke('app:getVersion'),
    openExternal: url => invoke('app:openExternal', url),
    getMpvPath:   () => invoke('app:getMpvPath'),
  },

  // Auto-updater
  updater: {
    check:     () => invoke('updater:check'),
    install:   () => invoke('updater:install'),
    onStatus:  cb => ipcRenderer.on('updater:status', (_ev, d) => cb(d)),
  }
});
