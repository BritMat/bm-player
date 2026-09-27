/**
 * A template BM Player script plugin.
 *
 * Script plugins run inside the player with its full access, so they start
 * switched off, and the player asks you to confirm before turning one on.
 * If any file in this folder changes afterwards, it is switched off again
 * until you approve it.
 *
 * The player calls the exported activate() with a small API object, BM:
 *   BM.on(event, fn)         'playback-start', 'playback-stop',
 *                            'time-update' ({ time, duration }),
 *                            'theme-change' ({ theme })
 *   BM.ui.toast(text)        a short message at the bottom of the window
 *   BM.ui.addPanel({ id, title, render })   a small floating panel;
 *                            render() returns HTML, and panel.open() shows it
 */
export function activate(BM) {
  let plays = 0;
  BM.on('playback-start', () => {
    plays += 1;
    // Keep plugins quiet: a toast on every playback would cover the video.
    if (plays === 1) BM.ui.toast('Sample Script is running');
  });
}
