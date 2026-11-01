'use strict';
/**
 * How this run of the app is set up (v3.47.0, from main.js): the platform,
 * the Chromium switches, mpv's outputs, Lite or not, and the runtime flags.
 * Worked out once, when main.js first requires this, before the app is ready.
 */
const { app } = require('electron');
const path = require('path'), fs = require('fs');

// ── Platform detection ───────────────────────────────────────────
const IS_WIN   = process.platform === 'win32';
const IS_MAC   = process.platform === 'darwin';
const IS_LINUX = process.platform === 'linux';
// The app's own folder: main.js, src/, plugins/ and the rest.
const ROOT = path.join(__dirname, '..');

// ── Lite Mode detection (v1.9.0) ────────────────────────────────────
// Three sources, in priority order:
//   1. process.env.BM_LITE (set by --lite flag or by the Lite installer's wrapper)
//   2. --lite CLI arg
//   3. packaged Lite build: presence of buildResources/lite.flag file
// The packaged Lite build carries lite.flag as an extraResource, next to
// app.asar. It used to be looked for inside the package, under
// buildResources, but electron-builder never packs that folder into an app, so
// a packaged Lite build ran as the full version (found by smoke-packaged
// --expect-lite in v3.23.0).
const LITE_FLAG_FILE = path.join(process.resourcesPath || ROOT, 'lite.flag');
// Chromium switches: on Windows, DirectComposition off, which is what made
// the video visible on a real machine. The decision lives in switches.js so
// it can be tested; see there for the order of defaults and overrides.
const CHROMIUM_SWITCHES = (() => {
  let flags = {};
  try { flags = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'flags.json'), 'utf8')); } catch {}
  const list = require('../switches').chromiumSwitches({ platform: process.platform, argv: process.argv, flags });
  for (const w of list) { try { app.commandLine.appendSwitch(w); } catch {} }
  return list;
})();
const MPV_VO = (() => {
  const a = process.argv.find(x => x.startsWith('--mpv-vo='));
  let v = a ? a.slice('--mpv-vo='.length) : '';
  if (!v) { try { v = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'flags.json'), 'utf8')).mpvVo || ''; } catch {} }
  // mpv output names are simple words; refuse anything else.
  return /^[a-z0-9_,-]{1,60}$/i.test(v) ? v : '';
})();
// mpv's audio output, like --mpv-vo (v3.29.0). A machine with no sound device,
// a test machine for one, cannot play an audio-only file at all ("Could not
// open/initialize audio device"), and --mpv-ao=null plays it into nothing, in
// real time. Nothing changes unless it is given.
const MPV_AO = (() => {
  const a = process.argv.find(x => x.startsWith('--mpv-ao='));
  const v = a ? a.slice('--mpv-ao='.length) : '';
  return /^[a-z0-9_,-]{1,60}$/i.test(v) ? v : '';
})();
const IS_LITE_BUILD = (process.env.BM_LITE === '1')
  || process.argv.includes('--lite')
  || (app.isPackaged && fs.existsSync(LITE_FLAG_FILE));
// Expose to preload so the renderer can adapt its UI on boot.
process.env.BM_LITE = IS_LITE_BUILD ? '1' : '0';

// ── Runtime flags ────────────────────────────────────────────────
// Several large changes have landed without ever running on real hardware:
// the bmfile:// scheme, the renderer audio engine and the GPU fluid solver.
// If the app misbehaves, the fastest way to find out which one is at fault
// is to switch them off individually, without editing code.
//
// Sources, later ones win:
//   1. userData/flags.json   {"compat": true} or individual keys
//   2. BM_COMPAT=1           environment
//   3. --compat              command line (npm run start:compat)
//
// `compat` turns every one of them off at once, which reproduces the last
// behaviour that is known to launch.
function resolveFlags() {
  // videoLayer: which window mpv draws into in the two-window layout.
  //   'back'  = the opaque window behind; the transparent front window with
  //             the controls composites over the picture.
  //   'front' = the transparent window that also holds the controls (the
  //             original v2.2.0 behaviour).
  // Seen in real Electron on Linux under a compositor: 'front' puts mpv's
  // native window on top of everything Chromium draws, so the titlebar and
  // controls vanish while video plays. 'back' shows both. Windows composites
  // Chromium above child windows, so 'front' may behave there; until that is
  // confirmed on real hardware, only Linux changes by default.
  // rendererSandbox (v3.42.0): the windows' pages run in Chromium's sandbox,
  // as every web page in a browser does. The preload only needs what a
  // sandboxed one has (contextBridge, ipcRenderer, webUtils). Measured on
  // Linux with the whole sandbox on and off (the field check's sandbox
  // section, which the .bat runs on Windows too): the same frame rates on
  // the home screen and in Flow, the same start, 30 to 45 MB less memory,
  // and a call to this process up to 0.07 ms slower, which the page's few
  // calls a second never feel. flags.json can turn it off.
  const flags = { compat: false, fileScheme: 'bmfile', audioEngine: true, gpuFluid: true, rendererSandbox: true,
                  // Front mode on Windows was confirmed black by eye on a real machine.
                  videoLayer: (IS_LINUX || IS_WIN) ? 'back' : 'front' };
  try {
    const f = path.join(app.getPath('userData'), 'flags.json');
    if (fs.existsSync(f)) Object.assign(flags, JSON.parse(fs.readFileSync(f, 'utf8')));
  } catch (e) { console.warn('[main] ignoring unreadable flags.json:', e.message); }
  if (process.env.BM_COMPAT === '1') flags.compat = true;
  if (process.argv.includes('--compat')) flags.compat = true;
  if (process.argv.includes('--video-back'))  flags.videoLayer = 'back';
  if (process.argv.includes('--video-front')) flags.videoLayer = 'front';
  if (process.argv.includes('--no-renderer-sandbox')) flags.rendererSandbox = false;
  if (flags.compat) Object.assign(flags, { fileScheme: 'file', audioEngine: false, gpuFluid: false, videoLayer: 'front', rendererSandbox: false });
  flags.rendererSandbox = flags.rendererSandbox !== false;
  // The single-window layout has no back window to draw into.
  if (IS_LITE_BUILD || flags.videoLayer !== 'back') flags.videoLayer = 'front';
  if (flags.fileScheme !== 'file') flags.fileScheme = 'bmfile';
  return flags;
}
const FLAGS = resolveFlags();
if (FLAGS.compat) console.log('[main] compatibility mode: file://, mpv-only audio, particle background');

module.exports = { IS_WIN, IS_MAC, IS_LINUX, ROOT, LITE_FLAG_FILE, CHROMIUM_SWITCHES, MPV_VO, MPV_AO, IS_LITE_BUILD, FLAGS };
