# First-launch runbook

The automated suite checks that the wiring is sound. It cannot check that
anything *renders*, that mpv connects, or that audio sounds right — jsdom has
no GPU and no sound card. This is the list of things only a real launch can
answer, ordered so that a failure early on explains the failures after it.

If something goes wrong: **Menu → Diagnostics… → Copy report**. That report
answers most of the questions anyone would otherwise have to ask you.

```bash
npm install     # dependency set changed: Electron 44, jsdom, music-metadata
node -v         # must be v22.12 or newer
npm test        # everything should pass before you launch anything
npm run test:e2e   # optional: the real app, driven automatically (needs a display)
npm start

# if it misbehaves
npm run start:compat
```

---

## 1. It starts at all

| Check | If it fails |
|---|---|
| A window appears within ~4s | The boot safety net force-shows after 4s, so a blank screen past that means the renderer threw. `Ctrl+Shift+I` → Console. |
| Welcome screen, not a white page | A module failed to import. The console names the file. |
| No error toast on launch | The updater used to fire one on every start; that's fixed, so a toast now means something real. |

This is the biggest single unknown in the whole handover. Electron 28 → 44 is
sixteen majors. The API audit says every call the app makes still exists, but
that cannot predict behavioural change — particularly around the transparent
frameless window and the `--wid` embedding mpv uses.

## 2. The fox

| Check | Meaning |
|---|---|
| A 3D faceted fox, turning slowly | WebGL path works. |
| A flat angular fox | WebGL failed and the SVG fallback took over. Diagnostics → Graphics. |
| Nothing at all | Neither path ran. Console. |

The 3D fox has, on your own report, **never** rendered — `CapsuleGeometry`
didn't exist in three r128, so `_initThreeJS()` threw and the fallback caught
it every time. This is the first launch where it should appear.

## 3. The fluid background

Drag the pointer across the welcome screen. Colour should follow it and curl
into vortices.

If it looks like drifting dots, the GPU solver failed and the old particle
system took over — check `half-float targets` in Diagnostics. On integrated
graphics this is a real possibility and it's a designed fallback, not a bug.

## 4. mpv

Open a video file. If nothing plays, Diagnostics → mpv tells you whether the
binary was found and whether the socket connected.

Note `getMpv()` now searches `PATH`, which it never did before. If you
installed mpv with winget, scoop or chocolatey, this is the first build that
will find it.

## 4b. Local media loads at all

This build turns `webSecurity` back on and serves local files through a custom
`bmfile://` scheme. It is the single most likely thing to have broken, because
it touches every image, every audio file and every PDF.

If gallery thumbnails are blank, a PDF won't open, or music won't play, open
DevTools and look for CSP violations or failed `bmfile://` requests.

Then try `npm run start:compat`. If everything loads there, the custom scheme
is the problem. See "If something is broken" below for narrowing it further.

## 4c. The one question I most need answered

On Windows, play a video two ways:

```bash
npm start
npm start -- --video-back
```

**In which one can you see the titlebar and the controls over the picture?**

- `npm start` draws the video into the same window as the controls. That is
  the original behaviour.
- `--video-back` draws it into the window behind, with the controls over it.
  On Linux this is the only one that shows both, and it is now the default
  there. PiP and stop were fixed and tested for it in the real app.

Tell me which of these you see for each:

- controls visible over the video
- video visible but controls hidden
- controls visible but no picture

If `--video-back` is the one that works, it becomes the Windows default. You
can also make it permanent yourself with `{ "videoLayer": "back" }` in
`flags.json`.

## 5. The four tabs

Switch between Video, Gallery, Music and PDF several times, in both
directions.

- No 2px seam at the top, no gap at the left — the geometry is driven by CSS
  variables now, but only a real render proves it.
- Panels should not overlap the mini player.
- Everything should have padding. The old `*{padding:0!important}` reset was
  flattening every component in the app.

## 6. Right-click

On the video surface. The context panel should open **at the pointer** with
Audio Track, Subtitles and Video sections, and only the sections that apply.

This never worked before: `init()` threw two lines before the `contextmenu`
listener was attached, so it was never bound at all.

Then: load an external `.srt`, nudge subtitle delay, switch audio track.

## 7. Music

1. Open a folder with nested album subfolders — the scan is recursive now.
2. Real titles and artists should replace filenames within a few seconds.
3. Album art should appear in the track rows and Now Playing.
4. **Let a track play to the end.** It should advance by itself. Before this
   build it simply stopped — mpv's playlist only ever held one file.
5. Shuffle, then repeat (off → all → one).
6. Watch the visualiser while music plays. It should track the *actual*
   music. If it moves independently of what you're hearing, the engine fell
   back to mpv — Diagnostics → Audio.
7. Move an EQ slider mid-track. It should be audible immediately.
8. Play a `.ape` or `.wma` if you have one: it should still play, via mpv.

## 8. Gallery

Open a folder of a few hundred photos. Scrolling should stay smooth — cards
page in 120 at a time and thumbnails are queued five at a time. Check `S` for
slideshow, `I` for info, and the filmstrip in the lightbox.

A file with `&` or `#` in its name is worth testing specifically; that was
broken for a long time.

## 9. PDF

Open something long, then type in the search box. It should stay responsive:
text is extracted once and cached, and typing is debounced. Before, every
keystroke re-scanned the entire document.

Then: select text on the page (new), open the Contents panel (new).

## 10. Lite mode

`npm run start:lite`. The chrome should be flat — no blur, no shadows — with a
slow gradient drift behind the welcome screen and a flat fox silhouette. A
LITE badge sits in the titlebar.

If it looks identical to normal mode, the `.lite-mode` class isn't being
applied; check the boot script in `index.html`.

## 9b. Picture-in-picture

With a video playing:

- Alt+P. A small window appears bottom right, above everything else.
- Drag it by the top bar. Double-clicking the top bar should **not** maximise it.
- Press Escape. You're back at your previous size and position, video still playing.
- Maximise the window, enter PiP, leave it. It should come back maximised.
- Enter PiP from the Gallery tab with music playing. You get the visualiser.
  Leave it and you should be back in the Gallery.
- Enter PiP, then press S (stop). You should end up on the home screen.
- Hover the PiP window: the bar should show play/pause, a size button, Expand
  and ✕. The size button steps through three sizes without leaving the screen.
  ✕ stops playback and takes you home.
- If you have two monitors, move the app to the second one first. PiP should
  open on that monitor.

Music under mpv: run `npm run start:compat`, which plays music through mpv
rather than the in-app engine, and let a track finish. The next one should
start by itself. Before this build it stopped after every track.

## 9c. Music player, mini bar and video-mode visualiser

Open a folder of mp3 or flac files on the Music tab and play one.

- Click the Now Playing seek bar, drag the volume, press ⏹. All three should
  work. Stop should silence the music and leave you on the Music tab.
- Play again, switch to Gallery, then PDF. A mini bar should sit at the
  bottom of both, with the track title and artwork. Click its progress bar to
  seek, and try play/pause and next.
- Switch to the Video tab. The visualiser fills the player with the track
  title, art and its own buttons. Move the mouse so the video controls appear:
  the visualiser buttons should sit above them and still be clickable.
- Use the arrow keys, M, N and P there. Seek, mute, next and previous.
- Press stop. The visualiser goes, the music stops, and you're on the home
  screen. Now open a video: no album art or music buttons over it.

Every one of those controls did nothing for in-app music before this build,
apart from play/pause and the mini bar's show/hide.

## 10a. Keyboard and overlays

With a video playing:

- Right-click, then press Escape. The menu closes and the video keeps playing.
- Open a side panel (Bookmarks, say), press Space. The video pauses.
  Press Escape. The panel closes and nothing else happens.

In the gallery, with music playing in the background:

- Open an image, press the arrow keys. Images change, the music does not seek.
- Press Escape. You stay in the gallery and the music keeps playing.
- The lightbox now starts below the titlebar. Its close button used to sit
  half under the window's close button, so aiming slightly high closed the app.

## 10b. Components that were never styled

These had no CSS at all until v3.6.0, so this is the first time they will look
like anything. Worth a glance each:

- Right-click menu rows: should have padding and a hover highlight
- The resume prompt: reopen a file you stopped partway through
- Theme customizer: should float on the right as a card
- TV tab: toolbar, search box, status bar and channel rows
- History and Bookmarks panels: rows with icons, progress and timestamps
- Subtitle search results

## 11. Themes

Click through all 13. Every one should change the titlebar, sidebar, menubar
and all four dashboards, not just the welcome screen. Button labels on
coloured fills are now dark in most themes. That is deliberate: white on
those accents was unreadable. Eight of them had no
CSS at all until recently, and Cyberpunk should show a scanline.

---

## If something is broken

Start here before reading any code.

```bash
npm run start:compat
```

Compatibility mode switches off the three biggest changes that have never run
on real hardware, all at once:

| Subsystem | Normal | Compat |
|---|---|---|
| Local files | `bmfile://`, webSecurity on | `file://`, webSecurity off |
| Music playback | renderer audio engine | mpv only |
| Welcome background | GPU fluid solver | particle system |

**If compat works and normal doesn't,** one of those three is the cause. Find
out which by turning them off one at a time. Create `flags.json` in the
userData folder (Diagnostics shows the path) with one line:

```json
{ "fileScheme": "file" }
```

Launch with plain `npm start`. Still broken? Swap it for
`{ "audioEngine": false }`, then `{ "gpuFluid": false }`. Whichever one makes
the problem disappear is the culprit. Delete the file afterwards.

**If compat is broken too,** the cause is something else. The likeliest
suspect is Electron 44 itself, which is sixteen major versions newer than what
this was written against. Diagnostics will still work there and is the first
thing to send.

Every Diagnostics report now starts with the active mode and flags, so it is
always clear which configuration a report came from.

## Reporting back

Diagnostics → Copy report, plus:

- what you did
- what you expected
- what happened
- anything in `Ctrl+Shift+I` → Console
- `%APPDATA%/bm-player/main-errors.log` on Windows (`~/.config/bm-player/` on
  Linux, `~/Library/Application Support/bm-player/` on macOS) for
  main-process crashes, which never reach DevTools

## Known deliberate fallbacks

These are not bugs. Diagnostics will tell you which are active.

| Condition | Behaviour |
|---|---|
| No half-float render targets | Fluid sim → particle system |
| No WebGL | Fox → flat SVG |
| Linux | No OS thumbnailer, gallery uses full-size images |
| `.ape` / `.wma` / `.mka` | Audio engine declines, mpv plays it |
| No `music-metadata` installed | Titles fall back to filenames |
| Unpackaged, or no `app-update.yml` | Updater stays quiet |
