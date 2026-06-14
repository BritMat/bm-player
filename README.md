# 🎵 BM Player

A modern, gorgeous, hardware-accelerated media player powered by **mpv** — featuring a Three.js interactive 3D fox mascot, liquid-glass UI themes, dynamic on-screen display (OSD) notifications, and automated CI/CD deployment pipelines.

---

## Features

| Feature | Details |
|---|---|
| **Engine** | mpv — native hardware-accelerated playback for almost all formats (MP4, MKV, AVI, MP3, FLAC, OGG, OPUS, HEVC, AV1…) |
| **Dynamic Themes** | 🌙 Dark · ☀️ Light · 🔮 Liquid Glass · 🧛 Dracula (Animated Blood Flow) · 🌌 Northern Lights (Animated Aurora) |
| **3D Fox Mascot** | Interactive Three.js fox with cursor tracking, blink cycles, ear twitching, and "boop" physics |
| **OSD System** | Real-time elegant overlay notifications for volume, seeking, and playback state |
| **VLC Shortcuts** | VLC-style controls (`Space`, `←`/`→`, `↑`/`↓`, `F`, `M`) |
| **Automated Build** | CI/CD pipeline compiles Windows (x64/x86) installers automatically on version tag |

---

## Keybindings (VLC Style)

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek −5s / +5s |
| `Ctrl+←` / `Ctrl+→` | Seek −30s / +30s |
| `↑` / `↓` | Volume +10% / −10% |
| `F` | Toggle Fullscreen |
| `M` | Toggle Mute |

---

## How to Build Locally

**Prerequisites:** Node.js 20+ installed on your system.

```bash
# 1. Clone the repository
git clone [https://github.com/BritMat/bm-player.git](https://github.com/BritMat/bm-player.git)

# 2. Enter the directory
cd bm-player

# 3. Install the dependencies
npm install

# 4. Start the app in development mode
npm start  

---

bm-player/
├── .github/workflows/
│   └── release.yml      ← CI/CD Pipeline for auto-compiling/publishing installers
├── src/
│   ├── index.html       ← Core application DOM and structure
│   ├── css/
│   │   └── style.css    ← Liquid glass UI, theme animations, OSD styles
│   └── js/
│       ├── app.js       ← Main frontend logic, IPC, VLC keybinds, OSD controller
│       └── fox.js       ← Three.js interactive math engine & 3D geometry
├── main.js              ← Electron backend (mpv instantiation, Win32 pipes, IPC, menus)
├── preload.js           ← Secure contextBridge API for frontend-backend communication
├── package.json         ← Scripts, dependencies, and application versioning
├── electron-builder.yml ← NSIS Installer configuration
└── scripts/
    └── generate-icon.js ← Programmatic icon generation
```

---

## License

MIT — © 2024 BM Player
