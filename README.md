# BM Player

A desktop media player built on Electron with [mpv](https://mpv.io) as the
playback engine. Video, a music library with tag reading, an image gallery, a
PDF suite, IPTV, 15 themes, and a plugin system.

![version](https://img.shields.io/badge/version-3.22.2-5B6FF8)
![license](https://img.shields.io/badge/license-MIT-green)

## First launch

See **[RUNBOOK.md](RUNBOOK.md)** — an ordered list of what to check on a real
machine, since the test suite deliberately cannot answer any of it.

If something misbehaves: **Menu → Diagnostics… → Copy report**. It reports
versions, where mpv was found, which GPU features are actually available,
which audio codecs the browser will decode, cache sizes, and the tail of the
main-process error log. `npm run diag:sample` prints an example.

## Requirements

- Node.js 20 or newer
- `mpv` — either on your `PATH` or dropped into `vendor/mpv/` (see the README
  in that folder). Without it, playback won't start; everything else will.

## Running

```bash
npm install
npm start          # normal
npm run start:lite # low-spec mode: one opaque window, reduced effects
npm run start:safe # GPU disabled, for driver trouble
npm run start:compat  # the three untested subsystems off, see RUNBOOK
```

All start scripts use CLI flags rather than `VAR=1 command` prefixes, which
are POSIX shell syntax and fail in Windows cmd. A contract check enforces it.

## Building

```bash
npm run build:win64      # also :win32, :mac, :linux
npm run build:lite-win64 # Lite variant
```

Every build script runs `gen-icon` first, which regenerates
`buildResources/icon.png` from `assets/icon-source.png`. electron-builder
derives `.ico` / `.icns` / the Linux png set from that single file.

## Layout

```
main.js              Electron main: windows, IPC, mpv IPC socket, plugin scan
preload.js           contextBridge — the only surface the renderer can reach
scripts/             Build helpers (icon generation, syntax pre-flight)
src/index.html       Markup + the critical inline stylesheet
src/css/style.css    Theme tokens and base component styles
src/css/enhance.css  Enhancement layer, loaded after themes.css
src/css/components.css  Styles for components that previously had none (loaded last)
src/vendor/          three.js, pdf.js, pdf-lib (vendored; no CDN at runtime)
src/js/app.js        BMPlayer — window chrome, playback, panels, bootstrap
src/js/util.js       Shared helpers: el, fileURL, fmtSec, escaping, pickFolder
src/js/dash/         GalleryDash, MusicDash, PDFViewer — one file each
src/js/plugins.js    PluginManager
src/js/fox.js        3D low-poly mascot (WebGL, SVG fallback)
src/js/fluid.js      GPU Navier-Stokes fluid simulation
src/js/audio-engine.js  Renderer playback for audio-only files (Web Audio)
src/js/diagnostics.js   Runtime environment report (Menu -> Diagnostics)
src/js/modules/      Settings, history, bookmarks, playlists, TV, subtitles…
plugins/             Bundled plugins; user plugins live in userData/plugins
```

## Architecture notes

**Two windows.** In full mode an opaque `bgWin` sits behind a transparent,
frameless `win` so themes like Glass can blur the real desktop. Lite mode uses
a single opaque window — keeping two frameless windows in sync costs a
compositor pass per frame, which weak GPUs can't spare.

**Chrome geometry lives in CSS variables.** `--titlebar-h`, `--menubar-h`,
`--chrome-h`, `--sidebar-w` and `--mini-h` are declared once in `index.html`.
Both stylesheets read from them. Hardcoding these numbers in two places is what
previously made views misalign when switching panels.

**Colours come from theme tokens.** Anything hardcoded stops responding to the
theme picker. Use `var(--accent)`, `var(--surface)`, `var(--text-muted)` and
`color-mix(in srgb, var(--accent) N%, transparent)` for tints.

## Audio: two backends

mpv plays audio in a separate process, so the renderer can never see the
samples. That is why `visualizer.js` synthesised its waveform and why the
equalizer could only send `af` strings into mpv.

Audio-only files the browser can decode now play through an `<audio>` element
in the renderer instead, giving a real `AnalyserNode` and a real
`BiquadFilter` chain. Video stays on mpv, where it belongs.

The fallback is layered, because this must never be why a file won't play:

| condition | result |
|---|---|
| no Web Audio in this context | `available` is false, mpv plays it |
| codec Chromium can't decode (ape, wma, mka) | `canPlay()` false, mpv plays it |
| decode error part-way through | `fallback` event, handed to mpv mid-track |
| user unticks it in Settings | mpv plays everything |

Every playback control goes through one routing layer on `BMPlayer`:
`togglePlay`, `seekTo`, `seekBy`, `setVolume`, `toggleMute`, `trackStep` and
`stop`. Each decides which player gets the command. A control that sends
straight to mpv does nothing while the in-app engine is playing, and 26 of
them did: every seek bar, mute, jump-to-time, bookmarks, the arrow, number,
M, P and N keys, the Now Playing stop and volume, and the switch to TV. A
contract check now fails the build for any playback command sent from
outside those functions.

Both backends share one set of EQ sliders, so `EQ_BANDS` in `app.js` and
`EQ_FREQUENCIES` in `audio-engine.js` must stay index-aligned. A contract
check enforces that — if they drift, every slider silently controls the wrong
frequency, which is audible but very hard to attribute.

## Colour contrast

Every theme is measured against WCAG AA (4.5:1) rather than judged by eye,
and a contract check fails the build if any theme drops below it. Five pairs
per theme: body text on background, secondary text on background and on
surfaces, and the label on accent-filled buttons against both ends of the
accent gradient.

Labels on accent fills use `var(--on-accent)`, never a hard-coded white. When
this was first measured, white labels failed in 12 of the 13 themes. On
Cyberpunk it was 1.25:1, white on cyan. A plugin theme that doesn't define
`--on-accent` falls back to a near-black label.

## Picture-in-picture

Alt+P, the titlebar button or the right-click menu. The window shrinks to
340×200 in the bottom-right corner of the monitor it is on, locks to 16:9,
floats above other windows and leaves the taskbar. Audio-only playback shows
the visualiser rather than an empty black box.

The bar at the top of the PiP window (shown for a moment on entry, then on
hover) has play/pause, a size button that cycles 340×200, 480×270 and 640×360
while keeping the bottom-right corner in place, Expand, and ✕ to stop and go
home. The titlebar is hidden in PiP, so before this there was no way to close
or resize from inside it, and transparent frameless windows can't be resized
by their edges on Windows.

Leave it with Escape, a double-click on the video, or Expand. The
window comes back at the same size and place, maximised if it was maximised,
and on the tab you started from. If the monitor it came from was unplugged in
the meantime, it is centred on one that still exists.

Entering is idempotent, fullscreen and theatre are ignored while in PiP, and
the always-on-top option is held until you leave. Stop inside PiP takes you
to the home screen.

"Fullscreen" (F, F11) and "theatre" (T) in this app both toggle **maximise**.
Neither enters true fullscreen, so Escape's "leave fullscreen" branch never
runs. That predates the recent work and is recorded here rather than changed,
because true fullscreen across a transparent window and the background window
behind it is exactly the kind of change that needs a real screen to verify.

## Requirements

**Node.js 22.12 or newer.** Electron 44 and its downloader declare it, and
`.npmrc` sets `engine-strict=true` so `npm install` refuses an older Node up
front with a plain message. Without that, npm only warns, installs anyway,
and Electron's download then fails with `ERR_REQUIRE_ESM`. That is exactly
what happened on the first real Windows run, with Node 20.12.2. A contract
check keeps our declared minimum at or above Electron's.

mpv must be reachable as `mpv.exe` on Windows. The app no longer follows
`PATHEXT` when searching PATH, because `.COM` comes first and would pick
`mpv.com`, a console launcher that leaves the real player running when it
is stopped.

## Checking a Windows machine

`dist/BM-Player-Check.bat` (build it with `npm run build:check-bat`) runs
everything unattended next to a release zip: it upgrades Node if needed,
finds mpv, installs, runs the fast checks, the real-app checks and the
video-layer question, and packs `BM-Player-results.zip`. Skipped checks are
reported as skipped, never as passed.

Put a video of your own next to the `.bat` and it is used too: the check
reports its container, codecs and every track, switches each audio and
subtitle track through the app's own right-click menu and confirms with mpv
that the switch happened, finds a line on screen for each subtitle track and
has mpv screenshot it, and tests seeking, pause and stop. Run it directly
with `node scripts/field-check.mjs --video <file>` (add `--video-only` to
skip the video-layer comparison).

The check also asks mpv, through the app's own IPC channel, asking which video output
is running and whether frames are advancing, and has mpv screenshot its own
rendered frame. A screen grab can miss GPU video. mpv's own screenshot can't,
so the two together tell "not drawing" apart from "drawing, but invisible to
the capture".

A control experiment plays the test pattern in a plain mpv window outside
the app and captures it the same way. If the capture can see that, a black
picture area inside the app means the picture really is hidden there.

Files opened before mpv has connected are held and opened when it does.
They used to be dropped silently, so a quick click on a recent file after
launch did nothing. Part B of the real-app suite opens a file the moment the
window appears to keep it that way.

The video-layer check runs three layouts, each launched with its flag and
confirmed from inside the app: back, front, and Lite's single window. Lite
cannot show the picture and its controls together: in one window the video
either covers the page (Linux) or sits under it (Windows). Only launches
that ask for Lite get that layout (`BM_LITE=1` or `--lite`); weak machines
get Lite visuals but keep the two-window layout.

The bundled "Now Playing Stats" example plugin no longer opens its panel and
shows toasts on every playback. It covered the corner of every video. Its
panel still updates, and opens when you choose.

Every PowerShell script the checks carry is parsed by PowerShell itself in
`npm run lint:powershell` (Windows PowerShell 5.1 on Windows, the version
the scripts run under; pwsh elsewhere, plus a scan for syntax 5.1 lacks).

The batch file switches off QuickEdit for its console window, because a
click inside it freezes whatever is running until a key is pressed, and it
starts the app once to warm up before the real-app checks: the first start
after a download can be slow while Windows scans the new program.

The real-app checks launch the app with a throwaway profile
(`--user-data-dir` pointing at a temporary folder, deleted afterwards). The
development copy and an installed BM Player share a settings folder, and the
first Windows run showed the tests reading the real library and history,
adding test files to that history and leaving the theme changed.

The video-layer screen capture uses `BitBlt` with `SRCCOPY | CAPTUREBLT`
directly. .NET's `CopyFromScreen` rejects that flag combination as an invalid
enum value, which made the first Windows capture silently all black. A
capture that comes back as one flat colour is now reported as blank rather
than read as evidence.

## Video output

mpv draws into its own native window inside the app window (`--wid`). The
video output is given as a list with a trailing comma, `gpu,` or
`direct3d,`, so if the preferred output can't start mpv falls back to one
that can instead of failing every file. That was verified against real mpv:
where no GPU context exists, plain `--vo=gpu` exits with "Errors when loading
file" and `--vo=gpu,` plays. On Linux, `xv` and `x11` are listed explicitly
because they can draw inside the app's window.

If mpv can't play a file at all, the app now says so (`Couldn't play …`) and
returns home, rather than leaving an empty player.

### The fox

The welcome-screen fox is a real 3D low-poly head (`src/js/fox3d.js`),
drawn by a small WebGL renderer written for it: 163 triangles, each with
its own normal, so every facet gets one crisp colour. A key light from the
upper left, a soft fill from the right, warm rather than grey shadows, and
a rim in the theme's accent colour.

The mesh (`src/js/fox3d-mesh.js`) is generated from a hand-placed design in
`tools/fox3d/`. Its front is the flat design, with a skull, throat and ear
thickness added and checked from every side. It replaced a three.js fox
built from spheres in code, whose head floated above its body and whose
facets had cracked apart. That one was never looked at from any angle.

It glances around on its own, follows the pointer, breathes, blinks, flicks
an ear, perks up when media starts, squints when happy and bobs with music.
In Lite mode, or where WebGL is unavailable, the flat SVG version of the
same design (`src/js/geofox.js`) is used. Part A of the real-app suite draws
the 3D fox in real WebGL at two angles and requires the turn to change the
picture.

### Dialogs and music playback (v3.18.0)

Every file and folder dialog now opens as a child of the player window.
None had a parent, so on Windows the file picker could open behind the
player. A main-process test opens all seven and checks each one's parent.

Music no longer sets `body.playing`, the video state that slides the
sidebar away and fades the title bar and menus. With it set, there was no
way to leave the Music tab, so the mini player never appeared. The real-app
test for this now clicks the sidebar with a real mouse click; it used to
switch tabs in code, which is why it passed while the sidebar was hidden.

### GitHub's checks, and what an installer contains (v3.22.2)

The CI workflow set up Node 20 after package.json moved to Node 22.12, so on
GitHub every job stopped at `npm ci` with EBADENGINE, on all three systems,
before a single test ran. It now uses Node 22 and runs every layer
(PowerShell parsing, plugin safety and the module tests were missing), and a
contract checks that the workflow's Node meets package.json's minimum.

`electron-builder.yml` packages only the files it lists, and from v3.19 to
v3.22 it did not list `switches.js`, `plugin-safety.js` or
`plugin-templates/`. main.js loads `./switches` at startup, so an installer
built then would have crashed on launch; every test ran from the folder,
never the package. The Lite config also never listed `buildResources/lite.flag`,
although its own comment said it did, so a packaged Lite build would have run
as the full version. A contract now follows every local module main.js
loads, and the folders it reads at runtime, and checks both configs list
them (and that only Lite has lite.flag). The build job on GitHub now starts
the packaged app (`scripts/smoke-packaged.mjs`): a package without
switches.js fails it.

### Publishing to GitHub (v3.22.0)

When every check passes on a real Windows machine and the video check
confirms the default layout, `BM-Player-Check.bat` publishes the release to
github.com/BritMat/bm-player (the `publish` action in `tools/bm-helper.ps1`).

- It never force-pushes. The release is committed on top of what is already
  on GitHub, so nothing there is overwritten; someone else's commit stays.
- It never publishes a version twice: each release is tagged (`v3.22.0`),
  and an existing tag means it skips. It only ever goes forwards: a version
  that is not newer than the newest tag on GitHub is skipped, so running the
  checker with an old zip can never publish old code over new.
- Anything the video check flags stops it too: a failed step with your own
  video, a timeout, an error, the app not launching or not reaching mpv, a
  layout mismatch, or the default not showing the picture. (Not the
  comparison run's note that the controls could not be checked, which only
  means the mouse moved.) Checked against every real run so far: the good
  ones pass, and the one run with a real error is stopped.
- No password is stored anywhere. Git uses your own sign-in; the first time,
  Git for Windows asks through the browser.
- The repository's files are made to match the release, leaving out
  node_modules, build output and test results. Make changes in the app, not
  on GitHub: a file added only on GitHub drops out of the current files at
  the next publish (it stays in the history).
- It works in its own clone, `bm-player-git`, next to the batch file, and
  refuses to touch that folder if it is not that clone.
- A file named `BM-NO-PUBLISH.txt` next to the batch file turns it off.

The outcome is the fifth line of the results summary. Tested against a local
repository: first publish, a repeat, someone else's commit in between, an
empty repository, and a folder that is not a clone.

### The fox, polished (v3.22.0)

The fox now sits on a chest ruff of fur, cream at the front and orange
behind with a spiky edge, instead of floating as a head. Its ears have dark
tips, dark brown backs and pale fur tufts inside. It swivels each ear on its
own, out of step with the other and leaning towards the pointer, sniffs now
and then, and cocks its head when the pointer rests near it.

### The Snow theme (v3.21.0)

Icy blues over a deep night, with snow falling in the effects layer
(`theme-fx.js`, mode `snow`): flakes at different depths, near ones bigger,
brighter and faster, a gusting wind and each flake's own sway. While the
pointer moves it clears a soft circle, pushing flakes aside. Fewer, slower
flakes with reduced motion. The fox wears a Santa hat: low-poly in 3D
(built in `fox3d.js`, part of the head so it turns and breathes with it)
and flat in Lite. Part A of the real-app suite checks the flakes, the push
from the pointer, and the hat's pixels in Snow against Dark.

The contrast check now takes its list of themes from the picker, so adding
or removing a theme cannot leave it checking the wrong set.

### Plugins: samples and safety (v3.20.0)

Pressing Folder in the Plugins panel opens your plugins folder and puts a
README and two samples in it (`_sample-theme`, `_sample-script`), never
overwriting a file. Folders starting with `_` are ignored, so copy a sample
and rename it to start your own. The bundled examples live inside the app.

The rules, in `plugin-safety.js` and tested in `scripts/smoke-plugins.cjs`:
every file a plugin.json names must be inside that plugin's folder, after
following links (a manifest could load any file on disk before); script
plugins you add start switched off, and turning one on needs a native
confirmation that page code cannot click; their files are fingerprinted at
approval, and any change switches them off again; theme CSS reaches the page
cleaned, with @import and every url() except data: removed; manifests, names
and theme keys are checked and limited, and folder, file and size limits
apply. The Plugins panel escapes everything it shows: a plugin.json
description used to be inserted as HTML, so it could run code just by being
listed. `app:external` opens only web pages and email; it used to pass any
address to the operating system.

### About, PiP and dialogs (v3.20.0)

Help, About BM Player opens an in-app window with the version, the author
and links to the project; links go through `app:external`.

In PiP the overlay holding the PiP bar covered the whole window and caught
every click, so pause and seek did nothing. It now lets clicks through and
only the bar takes them; a real-app test clicks the controls in PiP. PiP
also opens while paused: it refuses only when nothing is loaded. During
playback the picture area carries a 0.8% black tint: with DirectComposition
off, Windows passes clicks on fully transparent pixels through the window.

While a dialog is open neither window is always-on-top, and both are put
back afterwards: with the pin on, or left on by PiP, the player could stay
in front of its own folder picker.

The pointer's trail in the fluid background is about a third of the size,
under half as bright and pushes more gently.

### Video on Windows: DirectComposition off (v3.19.0)

On Windows, Chromium draws each window through DirectComposition, a layer
that sits above the window's child windows, and mpv's picture is a child
window. On a real Windows 11 machine the video played black in every layout
and with every mpv output, sound fine, while mpv embedded in a plain
Windows window showed the picture. With DirectComposition off, the picture
and the controls over it both showed, and a 1080p film played with its
subtitles. So Windows now starts with `disable-direct-composition`.

The decision lives in `switches.js`, tested in `smoke-main`. To go back to
the old behaviour on a machine: `"chromiumSwitches": []` in `flags.json`,
or `--bm-switch=none`. `--bm-switch=<name>` adds one of
`disable-gpu-compositing`, `disable-direct-composition`, `disable-gpu`.
Nothing else is accepted. Diagnostics shows what is in effect.

The field check now runs the default, the old behaviour as a witness
(it should be black), front and Lite. `--experiments` adds the diagnostic
runs that found the answer, and mpv in its own window behind the controls.

### Reopening a file, and music under a video (v3.19.0)

Stopping a video and opening the same file again jumped straight to its
end. Traced with strace to mpv itself: with an output list such as
`gpu,xv,x11,`, mpv retries each output for every file, and where `gpu`
fails (Linux without GPU acceleration) its cleanup calls `close(0)`. The
first time that closes stdin; the next time it closes the video file,
which had been given handle 0, and the file then reads as empty. The app
now locks mpv onto the output that worked, the first time one does.

Opening a video while music played in the in-app engine left the music
playing under the film. The engine now stops, and its late 'pause' event
no longer marks the app as stopped while the film plays.

During video, prompts sit at the top of the window: at the bottom they
covered subtitle lines.

### mpv's video output on Windows

On a real Windows 11 machine the app played sound with a black picture in
every layout, while the same mpv showed the picture in its own window. The
Windows default was `direct3d`, mpv's legacy Direct3D 9 output. It is now
`gpu-next,gpu,direct3d,`: mpv's own modern default first, falling back.

Any machine can be pointed at a different output without a new build:
`--mpv-vo=gpu` on the command line, or `"mpvVo": "gpu"` in `flags.json` in
the app's settings folder. Only plain output names are accepted.

The field check compares outputs as well as layouts on Windows (back with
`gpu-next`, `gpu` and `direct3d`, front with two, and Lite). For back
layouts it also captures with the controls window made invisible, which
shows whether the picture is there behind it. Outside the app it runs mpv
in its own window and embedded (`--wid`) in a plain Windows window with no
Chromium in it, for each output, so a failure can be pinned on embedding
itself or on the app's windows. A video of yours is then played in the
best configuration found, with a screen capture of it.

### Which window the video is drawn in

The normal layout has two windows: an opaque one behind, and a transparent
one in front holding the titlebar, menubar and controls. The `videoLayer`
setting chooses where mpv draws.

- **`back`**: mpv draws into the window behind, and the controls composite
  over the picture. This is what the two-window design was built for (the
  original `body.playing` styles, such as the translucent menubar, only make
  sense with the picture behind them).
- **`front`**: mpv draws into the same window as the controls, as in v2.2.0.

Seen in real Electron on Linux under a compositor, `front` puts mpv's native
window on top of everything Chromium draws, so the titlebar and controls
disappear while a video plays. `back` shows both, and PiP and stop work
correctly with it. Linux therefore defaults to `back`.

On Windows `front` was confirmed black by eye on a real machine, so Windows
defaults to `back` too. The picture window is an Electron `BaseWindow`: a
plain native window with no web page in it. As a `BrowserWindow` it held a
page, and on Windows Chromium paints its page above child windows, so the
page covered mpv's picture. macOS keeps `front` until tested. To try the
other:

```bash
npm start -- --video-back       # or --video-front
```

or put `{ "videoLayer": "back" }` in `flags.json` in the userData folder.
The single-window Lite layout has no window behind, so it always uses `front`.

In `back` mode, PiP keeps the picture window with the controls window
instead of hiding it (hiding it would hide the video), relaxes its minimum
size (Electron otherwise holds it at 900x560 behind a 340x200 PiP window),
and on the way out restores the two windows in an order that keeps the
controls on top. `npm run test:e2e -- --part=c` checks all of this in the
real two-window app, including the X stacking order.

## Keyboard and overlays

Open overlays get the first look at every key press, through a capture-phase
listener on `window` that runs before any other keyboard handler whatever
order they were registered in.

Escape closes the topmost overlay and goes no further. The order is dialogs,
right-click menu, theme customizer, lightbox, side panels, then the resume
prompt. Only when nothing is open does Escape fall through to its original
meaning, which is to leave fullscreen or stop.

The menu, dialogs, customizer and lightbox are modal, so playback keys don't
reach the player underneath them. Side panels are not modal: Space still
pauses while the playlist or equalizer is open.

Before this, Escape on the right-click menu stopped the video, closing an
image with Escape threw you out of the gallery, and arrow keys in the
lightbox also seeked any music playing in the background.

## Local files: bmfile://

Both windows used to run with `webSecurity: false` so the renderer could load
local files directly. That switches off the same-origin model for everything,
which is a large price for what is really just "read files off disk".

A custom scheme does the same job with the security model intact. `fileURL()`
returns `bmfile://local/<percent-encoded path>` — the whole path as a single
segment, so nothing has to parse `C:` as a drive letter inside a URL. The main
process serves it through `protocol.handle()` and `net.fetch()`, which keeps
range requests working for media elements and pdf.js.

The scheme is registered `standard`, `secure`, `supportFetchAPI` and `stream`,
but **not** `bypassCSP` — the policy still applies and lists `bmfile:`
explicitly in `img-src`, `media-src` and `connect-src`.

`rawFileURL()` still exists in `util.js` for anything that genuinely needs a
`file://` URL. Nothing currently does, and a contract check fails if one
appears in renderer code.

If local media stops loading after a change here, check three things: the
scheme registration runs before app-ready, `protocol.handle` was called, and
the CSP directive for that media type lists `bmfile:`. All three are covered
by tests.

## Traps worth knowing about

These each cost real debugging time. They're listed so they don't get
reintroduced.

**Never put `!important` in the reset.** `*{padding:0!important}` overrides
every component in the app, because `!important` beats specificity regardless
of selector weight.

**Local file URLs need `fileURL()`.** `'file://' + 'C:/x.jpg'` parses `C:` as
the hostname and silently loads nothing. Use the helper in `app.js`, which
emits three slashes and percent-encodes the path.

**three.js colours must be numbers.** `'#E06020'.replace('#','0x')` yields a
string, and `new THREE.Color(string)` routes to `setStyle()`, which doesn't
understand `0x…` and leaves the colour white. Use `hexNum()` in `fox.js`.

**`this` inside `registerIpc()`.** The file is `'use strict'`, so `this` is
`undefined` in a plain function call. A stray `this.` there throws, and every
handler registered after that line silently disappears.

**Dialogs must not be parented to `win`.** `showOpenDialog(win, …)` makes the
picker modal to a transparent frameless child window, which on Windows opens
behind the app or not at all. Call it without a parent.

**Don't `click()` an `<input type=file>` after an `await`.** The user-activation
token is already spent, so Chromium refuses — silently, with no error.

**Build lists with DOM nodes, not string concatenation.** Filenames are
untrusted input; `'<div>' + name + '</div>'` breaks on `&` and `<`.

## Development

```bash
npm test              # syntax, contracts, Electron API, main (x3), modules, renderer, real mpv
```

Five layers, each catching what the previous one can't. `build:*` runs all of
them first, so a broken contract can't ship, and CI runs them on Linux, Windows
and macOS for every push — the `file://` handling, the OS thumbnailer fallback
and path splitting all behave differently per platform, which is how several
of these bugs shipped in the first place.

**`lint:syntax`** parses every JS file (renderer as ESM, main as CJS). Catches
typos. Nothing more.

**`lint:contracts`** checks the seams *between* files, which is where every
expensive bug in this project has lived. Both sides parse fine on their own:

- `el('x')` with no matching element id — right-click was dead for months
  because the markup said `ctx-menu` and the code said `ctx-panel`
- duplicate ids, since `el()` only ever returns the first match
- `data-a` actions in the markup with no handler reading them
- preload invoking an IPC channel `main.js` doesn't handle
- `api.*` groups the preload never exposed
- classes applied from JS that no stylesheet defines
- a module using a shared helper it neither imports nor declares — the
  failure mode the app.js split introduced
- a playback command sent straight to mpv from outside the routing layer
- untrusted text interpolated into generated HTML without an escaper. This
  has now been found four times in four different files: gallery card names,
  music track titles, the history panel's file extension, and plugin
  manifest fields. Filenames and plugin JSON are user-controlled

**`lint:electron`** extracts every Electron API the app calls and checks each
one against `electron.d.ts` from the version in `package.json`, rather than
against anyone's memory of the release notes. Upgrading across majors removes
APIs, and the failure is a `TypeError` on whichever code path happens to touch
the missing method. It also checks `webPreferences` keys, which are silently
ignored when removed — worse than a crash, because the window is then built
with different security settings than the code claims.

**`test:main`** loads `main.js` against a stubbed `electron`, drives the
`whenReady` path, and then calls the real IPC handlers against real temporary
files. It asserts `registerIpc()` completes rather than throwing part-way —
that failure mode unregisters every handler declared after the throw and
reports nothing, which is how "Open Folder does nothing" stayed unexplained
for so long. The `nativeImage` stub throws like Linux does, so the thumbnail
handler has to prove it degrades to `null`.

**`test:modules`** exercises `src/js/modules/` directly — the nine files that
own persisted user data. Bookmarks, history and settings are all checked for
round-tripping, for surviving corrupt stored JSON, and for refusing a
malformed import rather than wiping state. The M3U parser is checked against
comments, missing `#EXTINF` lines and paths containing `&` and `#`. A bug in
these quietly loses something the user cares about instead of throwing
somewhere anyone would notice.

**`test:mpv`** is the only test that talks to the real mpv. Everything else
stubs it, and a stub can only confirm what its author already believed. The
belief was wrong once: with `--keep-open=yes`, mpv does not send `end-file` at
the end of the last file. It sets `eof-reached` and pauses on the final frame.
Music auto-advance listened for `end-file` and so never fired under mpv. It
also turned out that mpv keeps its pause state across `loadfile`, so a file
opened after another had finished loaded paused at 0:00.

This test launches the real binary with the launch arguments read out of
`main.js`, and mirrors `openFiles()` as it currently is rather than as it is
meant to be, so removing the unpause from the app fails it. It skips when mpv
isn't installed. CI installs mpv on Linux.

**`test:e2e`** launches the real app in real Electron and drives it with
Playwright. On Linux it needs a display, so run it under Xvfb:

```bash
xvfb-run -a -s "-screen 0 1600x1000x24" npm run test:e2e
```

Part A covers boot, layout, every tab, all 13 themes, and the WebGL fox and
fluid solver in real Chromium. Part B covers music through the in-app engine
and `bmfile://`, the mini bar, the video-mode visualiser, stop, mpv playing a
real video, and PiP resizing the real window. Its first run found five bugs
the other layers could not see: plugins blocked by the CSP since v3.4.0, an
invalid `connect-src` token blocking every remote fetch, the mini bar showing
on launch because idle mpv reports `pause=false`, the top of the welcome
screen hidden behind the menubar, and a Lite override key that nothing wrote.
It also showed that five smoke tests had been navigating to a tab name that
doesn't exist.

Limits worth knowing: it runs the single-window layout, because the normal
mode's transparent window needs a desktop compositor. Page screenshots only
contain what Chromium draws, so mpv's own video window never appears in
them. An X-level capture (`import -window root`) does include it.

**`test:smoke`** loads the real `index.html` into jsdom, stubs the preload
bridge and the browser APIs Electron provides, imports `app.js` for real, and
asserts the renderer reaches a live state. It then drives the dashboards
end to end against fixture data: browse a folder, render the grid, open the
lightbox, walk the filmstrip, filter and sort both gallery and music, load
tags, shuffle (asserting no track is lost or duplicated), cycle repeat, and
walk `advance()` off the end of the queue and around again. Fixture filenames
include `Rock & Roll <live>.png` and `holiday #3.webp` so the escaping and
URL-encoding paths are exercised on every run.

This is the layer that matters most. It found `BMPlayer.init()` calling
`this._tvRenderRecent()` when that method was defined on `PDFViewer` — so
`init()` threw on **every launch**, and everything after that line never ran:
`wireTV()`, the always-on-top restore, and the `contextmenu` listener. Static
analysis can't see it; the method exists, just on the wrong class.

### Do the layers actually catch anything?

Verified by mutation — break something on purpose and check the suite notices:

| Mutation | syntax | contracts | smoke |
|---|---|---|---|
| `throw` inserted part-way through `registerIpc()` | pass | pass | **fail** |
| `id="ctx-panel"` renamed back to `ctx-menu` | pass | **fail** | pass |
| `goHome()` moved from `BMPlayer` to `GalleryDash` | pass | pass | **fail** |
| an escaper removed from a filename interpolation | pass | **fail** | pass |
| an Electron API that no longer exists | pass | pass (**lint:electron** fails) | pass |

The third row is the real bug this suite was built after. It parses, every
identifier resolves, no contract is violated — the method simply lives on the
wrong class. Only execution finds it.

When you add a feature, add a line to the smoke test. Open DevTools with
`Ctrl+Shift+I`.

## License

MIT — see [LICENSE](LICENSE).
