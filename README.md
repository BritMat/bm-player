# 🎵 BM Player

A modern, gorgeous media player powered by **mpv** — with a Three.js fox mascot, liquid-glass UI, music visualizer, and auto-updates.

---

## Features

| Feature | Details |
|---|---|
| **Engine** | mpv — plays every format (MP4, MKV, AVI, MP3, FLAC, OGG, OPUS, HEVC, AV1 …) |
| **UI Themes** | 🌙 Dark · ☀️ Light · 🔮 Liquid Glass |
| **3D Fox Mascot** | Three.js, cursor tracking, media-reactive states |
| **Fox Interactions** | Waves hello · Gets excited when media starts · Dances to music · Covers ears at loud volume · Sleeps when idle · Confused on error |
| **Visualizer** | Spectrum Bars · Radial Ring · Waveform · Particles |
| **Keybindings** | VLC-style (Space, ←/→ seek, ↑/↓ volume, F fullscreen, M mute …) |
| **Auto-update** | Electron-updater via GitHub Releases |
| **Installer** | NSIS — x64 + x86, Start Menu, desktop shortcut |
| **File associations** | MP4, MKV, AVI, MP3, FLAC … |

---

## Keybindings

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek −5s / +5s |
| `Ctrl+←` / `Ctrl+→` | Seek −30s / +30s |
| `↑` / `↓` | Volume +5% / −5% |
| `F` / `F11` | Toggle fullscreen |
| `M` | Toggle mute |
| `S` | Stop |
| `N` / `P` | Next / Previous in playlist |
| `1`–`9` | Jump to 10%–90% |
| `[` / `]` | Speed −/+ |
| `Backspace` | Reset speed to 1× |
| `G` / `V` | Cycle subtitle tracks |
| `A` | Cycle audio tracks |
| `Ctrl+O` | Open file |
| `Ctrl+T` | Screenshot |
| `Escape` | Exit fullscreen / stop |

---

## Fox Mascot States

| State | Trigger |
|---|---|
| **Wave** | App launches |
| **Idle** | No media / paused briefly |
| **Excited** | Media file opened |
| **Watching** | Playing video |
| **Dancing** | Audio-only files |
| **Sleeping** | Paused > 35 seconds |
| **Cover Ears** | Volume > 115% |
| **Confused** | Playback error |
| **Happy** | End of playback |
| **Scared** | Sudden loud start |

---

## Building

### Option A — GitHub Actions (recommended, automatic)

1. Fork / push this repo to GitHub  
2. Edit `electron-builder.yml` → set your GitHub username/repo under `publish`  
3. Tag a release: `git tag v1.0.0 && git push origin v1.0.0`  
4. GitHub Actions builds both x64 and x86 installers and uploads them to the release  
5. Download from the **Releases** tab  

### Option B — Build locally on Windows

```bash
git clone https://github.com/YOUR_USER/bm-player
cd bm-player
npm install
npm run build:win64   # or build:win32 for 32-bit
```

Requires: Node.js 20+, and mpv placed in `vendor/mpv/` (download from https://mpv.io).

---

## Auto-update

The app checks for new GitHub Releases on startup and every 4 hours.  
- Minor/patch updates: auto-download in background, prompt to restart  
- The user is notified in Settings → About  

---

## Project Structure

```
bm-player/
├── main.js              ← Electron main process (mpv, IPC, updater)
├── preload.js           ← Secure contextBridge API
├── src/
│   ├── index.html       ← UI layout
│   ├── css/app.css      ← All styles (3 themes)
│   └── js/
│       ├── app.js       ← App bootstrap
│       ├── fox.js       ← Three.js fox mascot
│       ├── visualizer.js← Audio visualizer (4 modes)
│       ├── player.js    ← VLC keybindings + controls
│       └── themes.js    ← Theme manager
├── scripts/
│   └── generate-icon.js ← Programmatic icon generation
├── buildResources/
│   └── installer.nsh    ← NSIS customization
├── vendor/mpv/          ← mpv binaries (filled by CI or manually)
└── .github/workflows/
    └── release.yml      ← Build + publish workflow
```

---

## License

MIT — © 2024 BM Player
