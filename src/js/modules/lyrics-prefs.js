/**
 * Lyrics in Preferences (v3.50.0): how many songs have lyrics saved on this
 * computer, clearing them, and saving the lyrics of every song in the music
 * folders at once (lyrics-saver.js), so they show later without a
 * connection. The lyrics of a song are saved anyway the first time they are
 * found online, so the count grows as songs play.
 *
 *   const lp = wireLyricsPrefs({ api, music: () => window.bmMusic, osd })
 *   lp.refresh()      the count again (when Preferences opens)
 */
import { LyricsSaver } from './lyrics-saver.js';

const num = x => Number(x || 0).toLocaleString();
const songs = x => `${num(x)} song${x === 1 ? '' : 's'}`;

export function wireLyricsPrefs ({ api, music = () => window.bmMusic, osd = () => {} } = {}) {
  const $ = id => document.getElementById(id);
  const count = $('set-lyr-count'), note = $('set-lyr-save-note'), save = $('set-lyr-save'), clear = $('set-lyr-clear');
  if (!count || !note || !save || !clear || !api?.music?.lyricsSaved) return { refresh () {} };
  const intro = note.textContent;
  let saver = null, reading = false;

  async function refresh () {
    let c = 0;
    try { c = (await api.music.lyricsSaved())?.count || 0; } catch (_) {}
    count.textContent = c ? `Lyrics for ${songs(c)} are saved on this computer, so they show without a connection.`
      : 'No lyrics saved yet. A song\'s lyrics are saved the first time they are found online.';
    return c;
  }

  function show (st) {
    save.textContent = st.running ? 'Stop' : 'Save all';
    if (st.running) {
      note.textContent = st.waiting ? `LRCLIB cannot be reached just now. It goes on by itself when the connection is back (${num(st.done)} of ${songs(st.total)} done).`
        : `Looking: ${num(st.done)} of ${songs(st.total)}. Lyrics for ${num(st.found)} so far.`;
      if (st.done && st.done % 10 === 0) refresh();
      return;
    }
    note.textContent = st.stopped ? `Stopped after ${num(st.done)} of ${songs(st.total)}. ${num(st.found)} of them have lyrics. Save all again skips the songs done already.`
      : `Done: ${num(st.found)} of ${songs(st.total)} have lyrics.` + (st.none ? ` LRCLIB had none for ${songs(st.none)}.` : '')
      + (st.missed ? ` ${songs(st.missed)} could not be looked up just now. Save all again tries them.` : '');
    refresh();
  }

  save.addEventListener('click', async () => {
    if (saver?.running) { saver.stop(); return; }
    if (reading) return;
    let online = true; try { online = localStorage.getItem('bm_lyrics_online') !== '0'; } catch (_) {}
    if (!online) { note.textContent = 'Looking online is off. Turn on "Look online when a song has none" under the lyrics, then Save all.'; return; }
    const m = music();
    if (!m?.lyricsSongs || !m.folders?.length) { note.textContent = 'There are no music folders yet. Add one in Music, then Save all.'; return; }
    reading = true; save.disabled = true;
    note.textContent = 'Reading the songs in your music folders…';
    let list = [];
    try { list = await m.lyricsSongs(); } catch (_) { list = []; }
    reading = false; save.disabled = false;
    if (!list.length) { note.textContent = 'No songs were found in your music folders.'; return; }
    saver = new LyricsSaver({ api, onChange: show });
    await saver.start(list);
  });

  clear.addEventListener('click', async () => {
    if (saver?.running) saver.stop();
    const c = await refresh();
    if (c && !window.confirm(`Clear the lyrics saved for ${songs(c)}? Your own choices are kept, and lyrics files beside songs are not touched.`)) return;
    try { await api.music.lyricsClearSaved(); } catch (_) {}
    await refresh();
    note.textContent = intro;
    osd(c ? `Saved lyrics cleared for ${songs(c)}` : 'There were no saved lyrics');
  });

  refresh();
  return { refresh };
}
