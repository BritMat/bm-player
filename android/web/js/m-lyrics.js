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
 * v3.50.0: answers, saved lyrics and the person's choices are kept in the
 * app's own storage (LyricsStore.java, a small file each), where they stay
 * until cleared. They were in the page's storage, a thousand songs' worth at
 * most and a few megabytes for everything the page keeps, so the lyrics of
 * songs played a while ago went, and a song found once came back without
 * them. What was there is moved across once, on the first start. Saved
 * lyrics mean a song has its words without a connection.
 */
import { tagLyrics } from './m-tags.js';
import { pickFile } from './m-ui.js';
import { call, has } from './m-android.js';

const core = window.BMLyricsCore;
const PREFIX = 'bm_ly_';
const NAME = /^[a-z0-9-]{1,96}$/;

// The app's files when it has them (every APK from v3.50.0, and the stand-in), the page's storage when not.
const files = has('lyricsWrite');
let moving = false;          // what the page's storage held is still being moved across
const store = files ? {
  read (name) {
    let v = call('lyricsRead', name);
    if (v == null && moving) { try { v = localStorage.getItem(PREFIX + name); } catch (_) {} }
    try { return JSON.parse(v || 'null'); } catch (_) { return null; }
  },
  write (name, v) { if (NAME.test(name)) call('lyricsWrite', name, JSON.stringify(v)); },
} : {
  read (name) { try { return JSON.parse(localStorage.getItem(PREFIX + name) || 'null'); } catch (_) { return null; } },
  write (name, v) { try { localStorage.setItem(PREFIX + name, JSON.stringify(v)); } catch (_) {} },
};

/**
 * What the page's storage held before v3.50.0, moved to the app's files
 * once. The person's choices first, at once, then the rest a few at a time after
 * the app has started, with reads looking in the page's storage too until
 * it is done.
 */
function moveAcross () {
  if (!files) return;
  let keys = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) keys.push(k); } } catch (_) { return; }
  if (!keys.length) return;
  const pins = PREFIX + 'pins';
  if (keys.includes(pins)) {
    // theirs and the files' together, the files' winning where both have one
    let mine = {}, kept = {};
    try { mine = JSON.parse(localStorage.getItem(pins)) || {}; } catch (_) {}
    try { kept = JSON.parse(call('lyricsRead', 'pins') || '{}') || {}; } catch (_) {}
    if (call('lyricsWrite', 'pins', JSON.stringify({ ...mine, ...kept })) === true) localStorage.removeItem(pins);
    keys = keys.filter(k => k !== pins);
  }
  moving = true;
  const step = () => {
    for (const k of keys.splice(0, 25)) {
      const name = k.slice(PREFIX.length);
      let v = null; try { v = localStorage.getItem(k); } catch (_) {}
      if (NAME.test(name) && v != null && call('lyricsRead', name) == null && call('lyricsWrite', name, v) !== true) continue;
      try { localStorage.removeItem(k); } catch (_) {}
    }
    if (keys.length) setTimeout(step, 50); else moving = false;
  };
  setTimeout(step, 3000);
}
try { moveAcross(); } catch (_) {}

/** How many songs have lyrics saved on the phone. */
export function savedCount () {
  if (files) return +call('lyricsCount') || 0;
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX + 'sf-')) n++; }
  return n;
}
/** All that LRCLIB said cleared, the person's choices kept. Gives how many songs had lyrics saved. */
export function clearSaved () {
  if (files) return +call('lyricsClear') || 0;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && k !== PREFIX + 'pins') keys.push(k); }
  for (const k of keys) localStorage.removeItem(k);
  return keys.filter(k => k.startsWith(PREFIX + 'sf-')).length;
}

/** LRCLIB through Java: { status, json }, or { status: 0, error } when it was not reached (Java's reason, v3.50.0). */
async function fetchJson (url) {
  if (!url.startsWith(core.LRCLIB + '/')) return null;
  try {
    const r = await fetch('/net/lrclib/' + url.slice(core.LRCLIB.length + 1), { cache: 'no-store' });
    if (r.status === 599) {
      let error = '';
      try { error = (await r.text()).replace(/^LRCLIB could not be reached[:.]?\s*/, '').trim().slice(0, 200); } catch (_) {}
      return { status: 0, error: error || 'not reached' };
    }
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

// LRCLIB not reached, in the app's log (v3.50.0), for a problem report: at most once a minute.
let saidAt = 0;
function sayUnreached (r) {
  if (!r?.offline || !r.fetched || Date.now() - saidAt < 60000) return;
  saidAt = Date.now();
  call('log', 'lyrics: LRCLIB not reached (' + (r.why || 'no answer') + ')' + (r.synced || r.plain ? ', the saved ones shown' : ''));
}

/** What the lyrics view asks of window.api.music, on the phone. No YouTube here. */
export const lyricsApi = {
  music: {
    lyrics: async (file, meta, opts) => { const r = await lyr.get(file, meta, opts); sayUnreached(r); return r; },
    lyricsSearch: (q, meta) => lyr.search(q, meta),
    lyricsPick: (file, meta, id) => lyr.pick(file, meta, id),
    lyricsUnpin: (file, meta) => lyr.unpin(file, meta),
    // v3.50.0: the words to another app (Android's share sheet)
    lyricsShare: (text, subject) => call('share', text, subject || 'Lyrics'),
    async lyricsLoad (file, meta) {
      const f = await pickFile('.lrc,.srt,.vtt,.txt,text/plain');
      if (!f) return { canceled: true };
      if (f.size > 2 * 1024 * 1024) return { source: 'none', unreadable: true };
      return lyr.loadText(file, meta, f.name, await f.text());
    },
  },
};
