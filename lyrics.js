'use strict';
/**
 * BM Player: lyrics for a song (v3.38.0), in the main process.
 *
 * Looked for in this order, and the first found is used:
 *   1. a .lrc file beside the song, with the same name (song.mp3, song.lrc).
 *      LRC is lyrics with a time on each line, the usual way to keep them
 *      in step with the music. Many players and taggers write it.
 *   2. lyrics kept inside the song itself (ID3 USLT, a Vorbis LYRICS
 *      comment, MP4 lyr), as music-metadata reads them.
 *   3. LRCLIB (lrclib.net), a free, open collection of lyrics with no key or
 *      account, when looking online is on. It is asked for the exact song
 *      first (artist, title, album, length, which it matches to within a
 *      couple of seconds), then searched by artist and title. What it says,
 *      found or not, is kept in the user's data folder (lyrics/), so a song
 *      is asked about once: a song it has nothing for is asked again after
 *      a week. Only the artist, title, album and length go out.
 *
 * Answers { source: 'file' | 'tags' | 'lrclib' | 'none', synced, plain,
 * instrumental }. synced is LRC text, plain is text without times.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LRCLIB = 'https://lrclib.net';
const TIMED = /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/;      // [mm:ss], [mm:ss.xx]
const AGAIN_AFTER = 7 * 86400000;                        // a song with nothing found is asked again after a week

function shape(text, source) {
  const t = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!t) return null;
  return TIMED.test(t) ? { source, synced: t, plain: null } : { source, synced: null, plain: t };
}

/** The .lrc beside the song, whatever the case of its name. */
function besideFile(file) {
  try {
    const dir = path.dirname(file), base = path.basename(file, path.extname(file)).toLowerCase();
    const name = fs.readdirSync(dir).find(n => n.toLowerCase() === base + '.lrc');
    if (!name) return null;
    const p = path.join(dir, name), st = fs.statSync(p);
    if (!st.isFile() || st.size > 512 * 1024) return null;
    return shape(fs.readFileSync(p, 'utf8'), 'file');
  } catch (_) { return null; }
}

async function inTags(file) {
  try {
    const mm = require('music-metadata');
    const md = await mm.parseFile(file, { duration: false, skipCovers: true });
    const ly = (md.common && md.common.lyrics) || [];
    const text = ly.map(x => typeof x === 'string' ? x : (x && (x.text || x.lyrics)) || '').filter(Boolean).join('\n');
    return shape(text, 'tags');
  } catch (_) { return null; }
}

/**
 * fetchJson(url) gives { status, json } (the main process passes Electron's
 * net.fetch, which follows the system's proxy). cacheDir() is where answers
 * are kept. ua is the User-Agent: LRCLIB asks for the app's name and a link.
 */
function makeLyrics({ fetchJson, cacheDir, ua }) {
  const keyOf = m => crypto.createHash('sha1').update([m.artist, m.title, m.album, Math.round(m.duration || 0)].map(x => String(x || '').trim().toLowerCase()).join('|')).digest('hex');
  const readCache = k => { try { return JSON.parse(fs.readFileSync(path.join(cacheDir(), k + '.json'), 'utf8')); } catch (_) { return null; } };
  const writeCache = (k, v) => { try { fs.writeFileSync(path.join(cacheDir(), k + '.json'), JSON.stringify(v)); } catch (_) {} };

  const fromRecord = r => {
    if (!r) return null;
    if (r.instrumental) return { source: 'lrclib', synced: null, plain: null, instrumental: true };
    const synced = (r.syncedLyrics || '').trim() || null, plain = (r.plainLyrics || '').trim() || null;
    return synced || plain ? { source: 'lrclib', synced, plain } : null;
  };

  async function online(m) {
    const q = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    // The exact song first: it needs all four.
    if (m.album && m.duration) {
      const r = await fetchJson(`${LRCLIB}/api/get?${q({ artist_name: m.artist, track_name: m.title, album_name: m.album, duration: Math.round(m.duration) })}`, ua);
      if (r && r.status === 200) { const got = fromRecord(r.json); if (got) return got; }
      else if (!r || r.status !== 404) return undefined;            // not reached: try again another time
    }
    // Then a search, the closest in length, timed lyrics preferred.
    const r = await fetchJson(`${LRCLIB}/api/search?${q({ track_name: m.title, artist_name: m.artist })}`, ua);
    if (!r || r.status !== 200) return r && r.status === 404 ? null : undefined;
    const list = Array.isArray(r.json) ? r.json : [];
    const fits = x => !m.duration || !x.duration || Math.abs(x.duration - m.duration) <= 3;
    const pick = list.find(x => fits(x) && x.syncedLyrics) || list.find(x => fits(x) && (x.plainLyrics || x.instrumental));
    return fromRecord(pick) || null;
  }

  /** file: the song. meta: { artist, title, album, duration }. opts: { online }. */
  async function get(file, meta, opts) {
    if (typeof file !== 'string' || !file) return { source: 'none' };
    const m = meta && typeof meta === 'object' ? meta : {};
    if (!/^https?:/i.test(file) && path.isAbsolute(file)) {
      const a = besideFile(file); if (a) return a;
      const b = await inTags(file); if (b) return b;
    }
    if (!(opts && opts.online) || !m.artist || !m.title) return { source: 'none' };
    const k = keyOf(m), kept = readCache(k);
    if (kept && (kept.found || Date.now() - kept.at < AGAIN_AFTER)) return kept.found ? kept.found : { source: 'none' };
    let found;
    try { found = await online(m); } catch (_) { found = undefined; }
    if (found === undefined) return { source: 'none', offline: true };   // not kept: the network, not the song
    writeCache(k, { at: Date.now(), found });
    return found || { source: 'none' };
  }

  return { get };
}

module.exports = { makeLyrics, besideFile, shape };
