# 🎬 BM Player — v1.3.0

A modern, VLC-grade media player powered by **mpv** — gorgeous UI, full audio/video/subtitle control, and a Three.js fox mascot.

---

## What's new in v1.3

**Bug fixes**
- Subtitles no longer clip or double-render — forced ASS override + margin honouring keeps them clear of the controls bar
- Controls bar now auto-hides after 3 seconds of inactivity during playback (VLC-style), and stays visible while paused, hovered, or a side panel is open
- Audio/subtitle track menus do a fresh `get_property` fetch right before opening (both the right-click context menu *and* the new toolbar menus), so tracks are never stale or missing

**VLC-parity controls**
- Full menu bar: Media · Playback · Audio · Video · Subtitle · Tools
- Hardware decoder selection (Auto / NVIDIA nvdec / D3D11VA / DXVA2 / Software)
- 10-band graphic equalizer with presets (Flat, Bass Boost, Treble Boost, Rock, Pop, Jazz, Classical)
- Media Info panel (codec, resolution, fps, bitrate, container, sample rate, channels)
- Playlist panel with add/remove/clear and click-to-play
- Aspect ratio, zoom, deinterlace, audio channel mapping, audio/sub delay, subtitle position & size
- Jump-to-time dialog, chapter navigation, screenshot, loop modes

**Polish**
- Two new themes: Dracula and Northern Lights (Aurora), alongside Dark / Light / Glass
- Fox mascot now tints to match the active theme
- Refined welcome screen with a recent-files grid (click to resume instantly)
- Drag-and-drop anywhere, OSD feedback for every action

---

## Keybindings

| Key | Action | Key | Action |
|---|---|---|---|
| `Space` | Play / Pause | `M` | Mute |
| `←` `→` | Seek ±5s | `F` / `F11` | Fullscreen |
| `↑` `↓` | Volume ±5% | `S` | Stop |
| `Z` / `X` | Sub delay ±0.5s | `P` / `N` | Prev / Next |
| `Shift+K` / `Shift+J` | Audio delay ±0.5s | `G` / `V` | Cycle subtitle |
| `[` / `]` | Speed −/+ | `Backspace` | Reset speed |
| `1`-`9` | Jump to 10-90% | `Ctrl+O` | Open file |
| `Ctrl+I` | Media info | `Ctrl+L` | Playlist |
| `Ctrl+T` | Screenshot | `Ctrl+Q` | Quit |
| `Esc` | Exit fullscreen / Stop | | |

---

## Roadmap status

| Item | Status |
|---|---|
| Subtitle rendering fix, smart control-bar hide, track-menu sync | Shipped in v1.3 |
| Hardware decoder selection, channel mapping, equalizer | Shipped in v1.3 |
| Themed fox skins (snow wolf, dracula cape, monochrome) | Planned — v1.3 ships theme-tinted colours as a preview |
| Refined welcome dashboard | Shipped in v1.3 (recent grid); further polish ongoing |
| AI-powered live subtitles (Whisper.cpp pipeline) | Ambition — not yet started |

---

## Installation

**Option 1: Quick Download (Recommended)**
The easiest way to use BM-Player is to download the latest ready-to-run release.
1. Navigate to the **Releases** tab on the right side of this repository.
2. Download the latest executable file (e.g., `bm-player-win64.exe`).
3. Double-click to run the player immediately.

**Option 2: Clone the Source Code**
If you prefer to review the code or run the application from source, you can clone the repository:

```bash
git clone https://github.com/BritMat/bm-player
cd https://github.com/BritMat/bm-player
```

---

## Project structure

```
bm-player/
├── main.js                   <- Electron main: mpv process, IPC, context menu, track state
├── preload.js                <- contextBridge API surface
├── src/
│   ├── index.html            <- Full UI: titlebar, menu bar, welcome, player, panels, dialogs
│   ├── css/style.css         <- All 5 themes + every UI component
│   └── js/
│       ├── app.js            <- All renderer logic (transport, panels, EQ, playlist, keys, menus)
│       ├── fox.js            <- Three.js mascot (boop, sleep, theme tinting)
│       └── visualizer.js     <- Synthetic audio visualizer for audio-only files
├── scripts/generate-icon.js  <- Programmatic icon generation (pngjs)
├── buildResources/           <- installer.nsh, icon (generated at build time)
└── .github/workflows/release.yml  <- CI: build x64+x86, publish to Releases
```

## License
MIT
