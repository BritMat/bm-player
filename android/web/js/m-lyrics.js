/**
 * m-lyrics: finding a song's lyrics on the phone, for the desktop's lyrics
 * view (modules/lyrics.js), which is used here as it is. The finding and
 * matching are the desktop's too (lyrics-core.js); this gives them the
 * phone's ways of reaching things:
 *
 *   a file beside the song (song.lrc, .srt, .vtt), where Android lets the
 *   app read it (/api/beside, MediaLibrary.java), then the words kept
 *   inside the song (m-tags.js), then LRCLIB through Java, which can say
 *   the app's name as LRCLIB asks (/net/lrclib, LocalServer.java).
 *
 * Answers and the person's choices are kept in the page's storage, a
 * thousand songs' worth at most: the oldest answers go first, the choices
 * never.
 */
import { tagLyrics } from './m-tags.js';
import { pickFile } from './m-ui.js';

const core = window.BMLyricsCore;
const PREFIX = 'bm_ly_', MAX = 1000;

const store = {
  read (name) { try { return JSON.parse(localStorage.getItem(PREFIX + name) || 'null'); } catch (_) { return null; } },
  write (name, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem(PREFIX + name, s); }
    catch (_) { prune(200); try { localStorage.setItem(PREFIX + name, s); } catch (__) {} }
    if (name !== 'pins' && Math.random() < 0.05) prune(0);
  },
};

/** Keeps at most MAX answers, dropping the oldest, and n more besides. */
function prune (n) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && k !== PREFIX + 'pins') keys.push(k); }
  const drop = keys.length - MAX + n;
  if (drop <= 0) return;
  const aged = keys.map(k => { let at = 0; try { at = JSON.parse(localStorage.getItem(k))?.at || 0; } catch (_) {} return [k, at]; }).sort((a, b) => a[1] - b[1]);
  for (const [k] of aged.slice(0, drop)) localStorage.removeItem(k);
}

export function savedCount () {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && k !== PREFIX + 'pins') n++; }
  return n;
}
export function clearSaved () {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && k !== PREFIX + 'pins') keys.push(k); }
  for (const k of keys) localStorage.removeItem(k);
  return keys.length;
}

/** LRCLIB through Java: { status, json }, or null when it was not reached. */
async function fetchJson (url) {
  if (!url.startsWith(core.LRCLIB + '/')) return null;
  try {
    const r = await fetch('/net/lrclib/' + url.slice(core.LRCLIB.length + 1), { cache: 'no-store' });
    if (r.status === 599) return null;
    let json = null;
    try { json = await r.json(); } catch (_) {}
    return { status: r.status, json };
  } catch (_) { return null; }
}

// The song each name stands for (what the lyrics view calls a song's "path").
const songs = new Map();
/** The name the lyrics view knows a song by: its place on the phone. */
export function lyricsKey (s) {
  const k = s.path || s.url;
  songs.set(k, s);
  return k;
}

const lyr = core.makeLyrics({
  fetchJson, store, ua: '',
  local: f => !!songs.get(f),
  beside: async f => {
    const s = songs.get(f); if (!s?.id) return null;
    try {
      const r = await fetch(`/api/beside/audio/${s.id}?ext=lrc,srt,vtt`, { cache: 'no-store' });
      if (!r.ok) return null;
      const o = await r.json();
      return core.fromText(o.name, o.text, 'file');
    } catch (_) { return null; }
  },
  inTags: async f => {
    const s = songs.get(f); if (!s?.url) return null;
    const text = await tagLyrics(s.url);
    return text ? core.shape(text, 'tags') : null;
  },
});

/** What the lyrics view asks of window.api.music, on the phone. No YouTube here. */
export const lyricsApi = {
  music: {
    lyrics: (file, meta, opts) => lyr.get(file, meta, opts),
    lyricsSearch: (q, meta) => lyr.search(q, meta),
    lyricsPick: (file, meta, id) => lyr.pick(file, meta, id),
    lyricsUnpin: (file, meta) => lyr.unpin(file, meta),
    async lyricsLoad (file, meta) {
      const f = await pickFile('.lrc,.srt,.vtt,.txt,text/plain');
      if (!f) return { canceled: true };
      if (f.size > 2 * 1024 * 1024) return { source: 'none', unreadable: true };
      return lyr.loadText(file, meta, f.name, await f.text());
    },
  },
};
