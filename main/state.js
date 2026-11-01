'use strict';
/**
 * What the main process's parts share (v3.47.0).
 *
 * main.js was one file of 1,500 lines, and these were variables at its top
 * that any line could read and set. It is in parts now (main/*.js), and the
 * state more than one part needs lives here, on one object every part
 * requires. A part's own state stays in that part.
 */
module.exports = {
  win: null,              // the window with the page: every control
  bgWin: null,            // full layout: the picture window behind it
  videoWin: null,         // Lite: the picture window over the page's video area
  fullOn: false,          // full screen (see windows.js, setFull)
  pipActive: false,       // picture-in-picture
  alwaysOnTopFlag: false, // the pin
  ipcOk: false,           // connected to mpv
  mpvProc: null,          // the mpv process
  mpvSock: null,          // the connection to it
  pendingOpenFile: null,  // a file to open once mpv is ready: a cold start, or macOS's open-file
};
