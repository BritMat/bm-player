# Bundled mpv

Drop an `mpv` binary here to ship it with the app:

- Windows: `mpv.exe` (plus any DLLs it needs)
- macOS:   `mpv`
- Linux:   `mpv`

`electron-builder.yml` copies this folder to `resources/mpv` via `extraResources`.
If it's empty, BM Player falls back to searching the system PATH and the usual
package-manager install locations, so a bundled copy is optional.
