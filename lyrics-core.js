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

  // Names compared with case, accents and punctuation set aside. v3.50.0:
  // letters of every script are kept. Only a to z and digits were, so a title
  // in Malayalam or Hindi came out empty and was never matched.
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[\s!-\/:-@[-`{-~\u00a0-\u00bf\u2000-\u206f\u3000-\u303f\uff01-\uff0f]+/g, ' ').trim();

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

    /*
     * Saved lyrics (v3.50.0). Lyrics found online, on LRCLIB or YouTube,
     * are kept on the device under two more names than the song's exact one
     * (its artist, title, album and length): the song's file, and the song
     * loosely (its artist and title). A song is looked for online only when
     * none of the three has words for it, so lyrics found once are there
     * without a connection, even when the length or the album reads a
     * little differently another time (a song started before its tags were
     * read). Loosely, a different length (another version of the song)
     * does not count. Kept until the person clears them.
     */
    const fileKey = file => (typeof file === 'string' && file) ? 'sf-' + hash('file|' + file) : '';
    const looseKey = m => m.artist && norm(m.title) ? 'sl-' + hash('song|' + norm(m.artist) + '|' + norm(m.title)) : '';
    const entry = (m, found) => ({ at: Date.now(), found, duration: Math.round(m.duration || 0), artist: m.artist || '', title: m.title || '' });
    function save(file, m, found) {
      if (!found || (!found.synced && !found.plain && !found.instrumental)) return;
      const v = entry(m, found);
      for (const k of [fileKey(file), looseKey(m)]) if (k) store.write(k, v);
    }
    /*
     * How the song some lyrics were saved for compares with this one, by its
     * title and artist: 2 the same song (or known better then), 1 known
     * better now (its artist was not known then, a song started before its
     * tags were read), 0 another song. A file can be given other tags, or
     * be another song by now.
     */
    function agree(v, m) {
      if (norm(v.title) !== norm(m.title)) return 0;
      const a = norm(v.artist), ma = norm(m.artist);
      if (a === ma || !ma) return 2;
      return a ? 0 : 1;
    }
    /**
     * The saved lyrics for this song, as { found, sure }, or null. YouTube's
     * only when YouTube is on (opts.youtube). Found under the song or
     * loosely, they are saved under its file too, so the next time is one
     * look (and lyrics kept before v3.50.0, under the song alone, are
     * counted as saved). Not sure: saved for the song when less was known
     * about it, so they are only for when LRCLIB cannot be asked.
     */
    function saved(file, m, opts) {
      const ok = f => f && (f.synced || f.plain || f.instrumental) && (f.source !== 'youtube' || (opts && opts.youtube));
      const fk = fileKey(file), byFile = fk && store.read(fk);
      const how = byFile && ok(byFile.found) ? agree(byFile, m) : 0;
      if (how === 2) return { found: byFile.found, sure: true };
      let found = null;
      const exact = m.title && store.read(keyOf(m));
      if (exact && exact.found && exact.found.source === 'lrclib' && ok(exact.found)) found = exact.found;
      const lk = !found && looseKey(m), loose = lk && store.read(lk);
      if (loose && ok(loose.found) && !(m.duration && loose.duration && Math.abs(loose.duration - m.duration) > NEAR)) found = loose.found;
      if (found) { if (fk) store.write(fk, entry(m, found)); return { found, sure: true }; }
      return how === 1 ? { found: byFile.found, sure: false } : null;
    }

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
      let reached = false, failed = false, lost = false;
      why = '';
      // Once a question goes unanswered the rest are not asked (v3.50.0):
      // with the network down each waited its full time, one after another.
      const ask = async url => { if (lost) return null; const r = await fetchJson(url, ua); if (unreached(r)) { failed = true; lost = true; why = whyOf(r); return null; } reached = true; return r; };
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
      // v3.50.0: nothing found while any question went unanswered is not
      // "nothing found": it was kept as that for a week when the network
      // dropped between two searches, and the song's lyrics stayed away.
      return failed ? undefined : null;
    }

    /**
     * file: the song. meta: { artist, title, album, duration }.
     * opts: { online, youtube, fresh }. fresh (v3.50.0, Try again and
     * Refresh): LRCLIB is asked again, past the saved lyrics and past a week's
     * "nothing found". If it cannot be reached then, the saved lyrics are
     * the answer still, with offline set, so nothing on screen is lost.
     * Answers carry saved: true when the words are kept on the device, and
     * fetched: true when LRCLIB was asked just now (lyrics-saver.js waits a
     * moment after those, to ask LRCLIB gently).
     */
    async function get(file, meta, opts) {
      if (typeof file !== 'string' || !file) return { source: 'none' };
      const m = songOf(meta), fresh = !!(opts && opts.fresh);
      const pin = pins()[pinKey(file, m)];
      if (pin && pin.found) return Object.assign({}, pin.found, { pinned: true });
      if (local(file)) {
        // Awaited: on the desktop these read the disk at once, on the phone they ask Java.
        const a = beside ? await beside(file) : null; if (a) return a;
        const b = inTags ? await inTags(file) : null; if (b) return b;
      }
      const have = saved(file, m, opts);
      const keep = extra => have ? Object.assign({}, have.found, { saved: true }, extra) : null;
      if (have && have.sure && !fresh) return keep();
      if (!(opts && opts.online) || !m.title) return keep() || { source: 'none' };
      const k = keyOf(m), kept = store.read(k);
      if (!fresh && kept && !kept.found && Date.now() - kept.at < AGAIN_AFTER) return { source: 'none' };
      let found;
      try { found = await online(m); } catch (_) { found = undefined; }
      // not kept: the network, not the song
      if (found === undefined) return keep({ offline: true, why, fetched: true }) || { source: 'none', offline: true, why, fetched: true };
      store.write(k, { at: Date.now(), found });
      if (found) { save(file, m, found); return Object.assign({}, found, { saved: true, fetched: true }); }
      // asked again, and LRCLIB has nothing now: the saved lyrics stay (gone
      // says so), unless they were saved when less was known about the song
      return (have && have.sure ? keep({ fetched: true, gone: true }) : null) || { source: 'none', fetched: true };
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
      if (found) { save(file, m, found); return Object.assign({}, found, { saved: true }); }
      return { source: 'none' };
    }

    return { get, search, pick, load, loadText, unpin, youtube: fromYoutube };
  }

  return { makeLyrics, shape, subsToLrc, fromText, cleanTitle, songOf, fit, norm, fnv, LRCLIB, NEAR };
});
