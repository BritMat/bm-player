# BM Player

A desktop media player built on [Electron](https://www.electronjs.org), with
[mpv](https://mpv.io) doing the playback. It plays video and music, and has an
image gallery, PDF tools, IPTV, 14 themes and a plugin system.

[![CI](https://github.com/BritMat/bm-player/actions/workflows/ci.yml/badge.svg)](https://github.com/BritMat/bm-player/actions/workflows/ci.yml)
![license](https://img.shields.io/badge/license-MIT-green)

## Download

Get the latest version from the **[Releases page](https://github.com/BritMat/bm-player/releases)**.
You only need one file.

**Windows (64-bit):** `BM-Player-Setup-<version>-x64.exe`. While it installs,
it downloads mpv from mpv's Windows builds on GitHub and checks it against the
build tested for that release, so it needs an internet connection. The
installer is not code-signed yet, so Windows SmartScreen may warn: choose
**More info**, then **Run anyway**.

**BM Player Lite (Windows, 64-bit):** `BM-Player-Lite-Setup-<version>-x64.exe`.
A lighter version for older or low-spec PCs, with simpler visuals, one window,
and the picture above a fixed control bar. It installs alongside the full
version.

**Linux (64-bit):** on Ubuntu or Debian, install
`BM-Player-<version>-amd64.deb` with `sudo apt install ./BM-Player-<version>-amd64.deb`,
which installs mpv too. On other distributions, install mpv from your package
manager, then make `BM-Player-<version>-x86_64.AppImage` executable and run it.

**macOS (experimental):** `BM-Player-<version>-arm64.dmg` for Apple Silicon,
`BM-Player-<version>-x64.dmg` for Intel. Install mpv first with
`brew install mpv`. The app is not notarized by Apple, so the first time,
open System Settings, Privacy & Security, and choose **Open Anyway**. Video
playback has not been tested on a Mac yet.

The `latest.yml`, `latest-linux.yml` and `.blockmap` files on a release are
read by BM Player's built-in updater. You don't need to download them.

## What it does

- Plays video with mpv: subtitles, audio tracks, chapters, A-B loop,
  screenshots, playback speed, an equalizer, and resume where you left off.
- A music library with tag reading, playlists (including M3U) and a
  visualizer.
- An image gallery, PDF tools and IPTV.
- Picture-in-picture, in a small window that stays on top.
- 14 themes, some with animated effects, and a 3D fox mascot.
- Plugins: themes and scripts you add yourself (see below).
- Lite mode for weak hardware: lighter visuals, switched on automatically on
  low-spec machines and available as a setting in any build.

## If something goes wrong

Open the menu, choose **Diagnostics…**, then **Copy report**. It lists
versions, where mpv was found, the graphics features available and recent
errors. Paste it into a
[new issue](https://github.com/BritMat/bm-player/issues) with what you were
doing when it happened.

## Building from source

You need [Node.js](https://nodejs.org) 22.12 or newer, and mpv on your `PATH`
(or its files in `vendor/mpv/`).

```bash
npm ci
npm start              # the app
npm run start:lite     # the one-window Lite layout
npm test               # the automated checks
```

To build installers, generate the icons first, then build for your platform:

```bash
npm run gen-icon
npm run build:win64        # or build:linux, build:mac, build:lite-win64
```

The installers land in `dist/`. GitHub Actions builds and publishes every
release from its version tag (`.github/workflows/ci.yml`).

## Plugins

Press **Folder** in the Plugins panel to open your plugins folder. BM Player
puts a README and two samples there: a theme and a script. Theme styles are
cleaned before use, and a script plugin you add stays switched off until you
approve it, and switches off again if its files change.

## License

MIT, see [LICENSE](LICENSE). The Unbounded and Outfit fonts in `src/fonts` are
bundled under the SIL Open Font License 1.1. mpv is a separate project with its own license,
downloaded from its Windows builds on GitHub or installed from your system's
package manager.
