/**
 * BM Player: finding lyrics, the part that is the same everywhere (v3.40.0).
 *
 * The desktop app runs this in its main process (lyrics.js wraps it with the
 * disk: files beside the song, the song's tags, a cache folder) and the
 * Android app runs it in its page (with the phone's storage and its own
 * fetch). What it does is described in lyrics.js. Here it is kept apart from
 * any disk, so both ask the same way and match the same way.
 *
 * Loaded with require() (Node) or a plain <script> (BMLyricsCore on window).
 */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.BMLyricsCore = make();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LRCLIB = 'https://lrclib.net';
  const TIMED = /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/;      // [mm:ss], [mm:ss.xx]
  const AGAIN_AFTER = 7 * 86400000;                        // a song with nothing found is asked again after a week
  const NEAR = 4;                                          // seconds: the most a match's length may differ from the song's

  function shape(text, source) {
    const t = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    if (!t) return null;
    return TIMED.test(t) ? { source, synced: t, plain: null } : { source, synced: null, plain: t };
  }

  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const lrcTime = t => `[${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}.${pad(Math.floor((t % 1) * 100))}]`;
  const SOUND_ONLY = /^[\s♪♫#*~-]*(?:[[(](?:music|applause|laughter|instrumental|silence|no audio|inaudible|cheering|music playing)[\])])?[\s♪♫#*~-]*$/i;

  /**
   * Subtitles (SRT or WebVTT) as timed lyrics: one line a cue. YouTube's own
   * captions repeat each line as the next is typed in, word by word (VTT with
   * <c> tags), so a cue that only shows again what was there gives nothing,
   * and a line said twice in a row is kept once. Cues that are only a sound
   * ([Music], a note) are left out. Where the words stop for more than four
   * seconds a blank line is put in, so the last line is not left lit through
   * a solo. Read line by line, not by blank lines: YouTube's cues have lines
   * of one space inside them, which looked like the gap between two cues.
   */
  function subsToLrc(text) {
    const t = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const TS = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
    const secs = (h, m, s, ms) => (+h || 0) * 3600 + (+m) * 60 + (+s) + (+String(ms).padEnd(3, '0')) / 1000;
    const clean = s => s.replace(/<\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}>/g, '').replace(/<\/?[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/[♪♫]/g, ' ').replace(/\s+/g, ' ').trim();
    const lines = t.split('\n'), raw = [];
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const m = TS.exec(lines[i]);
      if (m) { cur = { start: secs(m[1], m[2], m[3], m[4]), end: secs(m[5], m[6], m[7], m[8]), body: [] }; raw.push(cur); continue; }
      if (!cur) continue;                                                    // the header, notes, styles
      if (/^\s*\d+\s*$/.test(lines[i]) && i + 1 < lines.length && TS.test(lines[i + 1])) continue;   // an SRT cue's number
      cur.body.push(lines[i]);
    }
    const cues = raw.map(c => {
      // Typed in word by word: the new words are on the line with word times.
      const typed = c.body.filter(l => /<\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}>|<c[ .>]/.test(l));
      return { start: c.start, end: c.end, words: clean((typed.length ? typed : c.body).join(' ')), typed: typed.length > 0 };
    });
    // A caption file typed in word by word: a cue without new words only repeats.
    const rolling = cues.some(c => c.typed);
    const out = [];
    for (const c of cues) {
      if (rolling && !c.typed) continue;
      if (!c.words || SOUND_ONLY.test(c.words)) continue;
      const last = out[out.length - 1];
      if (last && last.words === c.words) { last.end = Math.max(last.end, c.end); continue; }
      if (last && c.start - last.end > NEAR) out.push({ start: last.end, end: last.end, words: '' });
      out.push({ start: c.start, end: c.end, words: c.words });
    }
    if (out.filter(c => c.words).length < 2) return '';
    return out.map(c => lrcTime(c.start) + c.words).join('\n');
  }

  /** Lyrics or subtitles, by the file's name: .lrc and .txt as they are, .srt and .vtt read as subtitles. */
  function fromText(name, text, source) {
    if (/\.(srt|vtt)$/i.test(String(name || ''))) { const lrc = subsToLrc(text); return lrc ? { source, synced: lrc, plain: null } : null; }
    return shape(text, source);
  }

  /** A title as a lyrics site knows it: no track number, no "(Official Video)", no "feat. ...", no "- Remastered". */
  function cleanTitle(s) {
    return String(s || '')
      .replace(/\.(mp3|flac|m4a|ogg|oga|opus|wav|aac|wma|alac|aiff?|ape|mka|webm)$/i, '')
      .replace(/^\s*\d{1,3}\s*[-._)]\s+/, '')
      .replace(/\s*[[(](?:official|lyrics?|lyric video|audio|video|music video|hd|hq|4k|visuali[sz]er|explicit|clean|remaster(?:ed)?|\d{4} remaster(?:ed)?|live|mono|stereo|radio edit|extended|full version|color coded)\b[^\])]*[\])]/gi, '')
      .replace(/\s*[[(](?:feat|ft|featuring|with)\.?\s[^\])]*[\])]/gi, '')
      .replace(/\s+(?:feat|ft|featuring)\.?\s.+$/i, '')
      .replace(/\s+-\s+(?:(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?|radio edit|single version|album version|mono|stereo)\b.*$/i, '')
      .replace(/\s+/g, ' ').trim();
  }

  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

  /** The song as it is looked for: titles cleaned, "Artist - Title" read as such when the tags have no artist. */
  function songOf(meta) {
    const m = meta && typeof meta === 'object' ? meta : {};
    let artist = String(m.artist || '').trim(), title = cleanTitle(m.title);
    if (!artist || /^<?unknown>?$/i.test(artist)) { artist = ''; const i = title.indexOf(' - '); if (i > 0) { artist = title.slice(0, i).trim(); title = cleanTitle(title.slice(i + 3)); } }
    const duration = +m.duration > 0 ? +m.duration : 0;
    return { artist, title, album: String(m.album || '').trim(), duration };
  }

  /** How well a LRCLIB record fits the song; below 0 it does not. */
  function fit(x, m) {
    if (!x || !(x.syncedLyrics || x.plainLyrics || x.instrumental)) return -1;
    let sc = 0;
    if (m.duration && x.duration) { const d = Math.abs(x.duration - m.duration); if (d > NEAR) return -1; sc += 3 - d * 0.6; }
    const tt = norm(x.trackName || x.name), mt = norm(m.title);
    if (!tt || !mt) return -1;
    if (tt === mt) sc += 3; else if (tt.includes(mt) || mt.includes(tt)) sc += 1.5; else return -1;
    if (m.artist) {
      const ta = norm(x.artistName), ma = norm(m.artist);
      if (ta === ma) sc += 2; else if (ta.includes(ma) || ma.includes(ta)) sc += 1; else sc -= 2.5;
    }
    if (x.syncedLyrics) sc += 1.5; else if (x.plainLyrics) sc += 0.3;
    return sc;
  }

  /** A short, steady name for a string (FNV-1a, 64 bits as hex), where Node's crypto is not to hand. */
  function fnv(s) {
    let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x0100019d) >>> 0; }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  /**
   * fetchJson(url, ua) gives { status, json }, or null (or { status: 0,
   * error }, v3.43.0) when not reached. store
   * keeps answers and choices: { read(name), write(name, value) }. hash(s)
   * names a song in it. beside(file) and inTags(file) look on the disk, where
   * there is one (the desktop), and youtube(song) asks YouTube, where it can.
   */
  function makeLyrics({ fetchJson, store, ua, hash = fnv, beside = null, inTags = null, readFile = null, youtube = null, local = f => false }) {
    const keyOf = m => hash([m.artist, m.title, m.album, Math.round(m.duration || 0)].map(x => String(x || '').trim().toLowerCase()).join('|'));
    const pins = () => store.read('pins') || {};
    const pinKey = (file, m) => (typeof file === 'string' && file) ? 'f:' + file : 'm:' + keyOf(m);

    const fromRecord = r => {
      if (!r) return null;
      if (r.instrumental) return { source: 'lrclib', synced: null, plain: null, instrumental: true };
      const synced = (r.syncedLyrics || '').trim() || null, plain = (r.plainLyrics || '').trim() || null;
      return synced || plain ? { source: 'lrclib', synced, plain } : null;
    };
    const q = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

    // Why LRCLIB was last not reached (v3.43.0): its answer, or the network's
    // error, for the log and the field check. It said only "could not be
    // reached" on a real machine, where YouTube worked.
    let why = '';
    const unreached = r => !r || !r.status;
    const whyOf = r => (r && r.error) || 'no answer';

    async function online(m) {
      let reached = false, failed = false;
      why = '';
      const ask = async url => { const r = await fetchJson(url, ua); if (unreached(r)) { failed = true; why = whyOf(r); return null; } reached = true; return r; };
      // The exact song first: it needs all four.
      if (m.artist && m.album && m.duration) {
        const r = await ask(`${LRCLIB}/api/get?${q({ artist_name: m.artist, track_name: m.title, album_name: m.album, duration: Math.round(m.duration) })}`);
        if (r && r.status === 200) { const got = fromRecord(r.json); if (got) return got; }
        else if (r && r.status !== 404) { failed = true; why = 'LRCLIB answered ' + r.status; }
      }
      // Then searches, the closest kept: by artist and title, then by their words together.
      const seen = new Map();
      const search = async o => {
        const r = await ask(`${LRCLIB}/api/search?${q(o)}`);
        if (!r) return;
        if (r.status === 200 && Array.isArray(r.json)) { for (const x of r.json) if (x && x.id !== undefined && !seen.has(x.id)) seen.set(x.id, x); }
        else if (r.status !== 404) { failed = true; why = 'LRCLIB answered ' + r.status; }
      };
      // Without the song's length, only the same title by the same artist will do.
      const best = () => { let top = null, sc = -1; for (const x of seen.values()) { const s = fit(x, m); if (s > sc) { sc = s; top = x; } } return sc >= (m.duration ? 2 : 5) ? top : null; };
      if (m.artist) await search({ track_name: m.title, artist_name: m.artist });
      if (!best()) await search({ q: [m.artist, m.title].filter(Boolean).join(' ') });
      const got = fromRecord(best());
      if (got) return got;
      return failed && !reached ? undefined : (failed && !seen.size ? undefined : null);
    }

    /** file: the song. meta: { artist, title, album, duration }. opts: { online }. */
    async function get(file, meta, opts) {
      if (typeof file !== 'string' || !file) return { source: 'none' };
      const m = songOf(meta);
      const pin = pins()[pinKey(file, m)];
      if (pin && pin.found) return Object.assign({}, pin.found, { pinned: true });
      if (local(file)) {
        // Awaited: on the desktop these read the disk at once, on the phone they ask Java.
        const a = beside ? await beside(file) : null; if (a) return a;
        const b = inTags ? await inTags(file) : null; if (b) return b;
      }
      if (!(opts && opts.online) || !m.title) return { source: 'none' };
      const k = keyOf(m), kept = store.read(k);
      if (kept && kept.found && kept.found.source === 'lrclib') return kept.found;
      if (kept && !kept.found && Date.now() - kept.at < AGAIN_AFTER) return { source: 'none' };
      let found;
      try { found = await online(m); } catch (_) { found = undefined; }
      if (found === undefined) return { source: 'none', offline: true, why };   // not kept: the network, not the song
      store.write(k, { at: Date.now(), found });
      return found || { source: 'none' };
    }

    /** LRCLIB searched by the person: { q } or { artist, title }. Up to 20 results, those that fit the song first. */
    async function search(query, meta) {
      const o = query && typeof query === 'object' ? query : { q: String(query || '') };
      const words = String(o.q || '').trim();
      const params = words ? { q: words } : { track_name: cleanTitle(o.title), artist_name: o.artist || undefined };
      if (!params.q && !params.track_name) return { results: [] };
      const r = await fetchJson(`${LRCLIB}/api/search?${q(params)}`, ua);
      if (unreached(r)) return { results: [], offline: true, why: whyOf(r) };
      const list = r.status === 200 && Array.isArray(r.json) ? r.json : [];
      const m = songOf(meta), dur = m.duration;
      const near = x => dur && x.duration ? Math.abs(x.duration - dur) : 999;
      return {
        results: list.filter(x => x && x.id !== undefined).map(x => ({
          id: x.id, title: x.trackName || x.name || '', artist: x.artistName || '', album: x.albumName || '', duration: x.duration || 0,
          synced: !!x.syncedLyrics, plain: !!x.plainLyrics, instrumental: !!x.instrumental,
        })).sort((a, b) => (near(a) <= NEAR ? 0 : 1) - (near(b) <= NEAR ? 0 : 1) || (b.synced - a.synced) || near(a) - near(b)).slice(0, 20),
      };
    }

    function keep(file, meta, found) {
      const all = pins(); all[pinKey(file, songOf(meta))] = { at: Date.now(), found };
      store.write('pins', all);
      return Object.assign({}, found, { pinned: true });
    }

    /** The person chose a search result: its lyrics are this song's from now on. */
    async function pick(file, meta, id) {
      const r = await fetchJson(`${LRCLIB}/api/get/${encodeURIComponent(id)}`, ua);
      if (unreached(r)) return { source: 'none', offline: true, why: whyOf(r) };
      const found = r.status === 200 ? fromRecord(r.json) : null;
      if (!found) return { source: 'none' };
      return keep(file, meta, found);
    }

    /** A file the person loaded, by its place on disk (the desktop). */
    function load(file, meta, p) {
      let found = null;
      try { found = readFile ? readFile(String(p || '')) : null; } catch (_) { found = null; }
      if (!found) return { source: 'none', unreadable: true };
      return keep(file, meta, found);
    }

    /** A file the person loaded, by its name and words (the phone's file picker). */
    function loadText(file, meta, name, text) {
      const found = fromText(name, text, 'file');
      if (!found) return { source: 'none', unreadable: true };
      return keep(file, meta, found);
    }

    /** The choice taken back: the song is looked for again as before. */
    function unpin(file, meta) {
      const all = pins(), k = pinKey(file, songOf(meta));
      if (k in all) { delete all[k]; store.write('pins', all); }
      return true;
    }

    /** YouTube's captions for the song (ytdlp.js), kept like LRCLIB's answers. */
    async function fromYoutube(file, meta) {
      if (!youtube) return { source: 'none', unavailable: true };
      const m = songOf(meta);
      if (!m.title) return { source: 'none' };
      const k = 'yt-' + keyOf(m), kept = store.read(k);
      if (kept && (kept.found || Date.now() - kept.at < AGAIN_AFTER)) return kept.found || { source: 'none' };
      let got;
      try { got = await youtube(m); } catch (e) { return { source: 'none', error: String((e && e.message) || e).slice(0, 200) }; }
      if (got && got.error) return { source: 'none', error: got.error };
      const lrc = got && got.vtt ? subsToLrc(got.vtt) : '';
      const found = lrc ? { source: 'youtube', synced: lrc, plain: null, auto: !!got.auto, video: got.video || null } : null;
      store.write(k, { at: Date.now(), found });
      return found || { source: 'none' };
    }

    return { get, search, pick, load, loadText, unpin, youtube: fromYoutube };
  }

  return { makeLyrics, shape, subsToLrc, fromText, cleanTitle, songOf, fit, norm, fnv, LRCLIB, NEAR };
});
