'use strict';
/**
 * BM Player: lyrics for a song (v3.38.0, more in v3.39.0), in the main process.
 * The asking and matching are in lyrics-core.js (v3.40.0), shared with the
 * Android app. This file gives it the disk.
 *
 * Looked for in this order, and the first found is used:
 *   0. lyrics the person chose for this song (searched for, or a file they
 *      loaded), kept in the user's data folder (lyrics/pins.json).
 *   1. a file beside the song, with the same name: song.lrc first, then
 *      song.srt or song.vtt (subtitles, read as timed lyrics, v3.39.0). LRC
 *      is lyrics with a time on each line, the usual way to keep them in step
 *      with the music. Many players and taggers write it.
 *   2. lyrics kept inside the song itself (ID3 USLT, a Vorbis LYRICS
 *      comment, MP4 lyr), as music-metadata reads them.
 *   3. LRCLIB (lrclib.net), a free, open collection of lyrics with no key or
 *      account, when looking online is on. Asked for the exact song first
 *      (artist, title, album, length), then searched by artist and title,
 *      then by the words of both together, and the closest is taken: within
 *      four seconds of the song's length where that is known, the title and
 *      artist alike, timed lyrics first. Titles are cleaned first ("01 -",
 *      "(Official Video)", "feat. ...", "- Remastered 2011" taken off), and a
 *      song with no artist in its tags and "Artist - Title" as its name is
 *      read that way (v3.39.0). Before, a song with no artist was not looked
 *      for at all, and a title with "(Official Video)" in it was never found.
 *      What it says, found or not, is kept (lyrics/), so a song is asked
 *      about once, and a song it has nothing for is asked again after a week.
 *      Only the artist, title, album and length go out.
 *   4. YouTube captions (v3.39.0, youtube()), asked for separately by the
 *      page when all of that found nothing and the person has turned it on.
 *
 * Answers { source: 'pin' | 'file' | 'tags' | 'lrclib' | 'youtube' | 'none',
 * synced, plain, instrumental }. synced is LRC text, plain is text without
 * times.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const core = require('./lyrics-core');
const { shape, subsToLrc, fromText, cleanTitle, songOf, fit } = core;

/** A file of lyrics or subtitles, by its name: .lrc and .txt as they are, .srt and .vtt read as subtitles. */
function readLyricsFile(p, source) {
  const st = fs.statSync(p);
  if (!st.isFile() || st.size > 2 * 1024 * 1024) return null;
  return fromText(p, fs.readFileSync(p, 'utf8'), source);
}

/** The .lrc beside the song, or its .srt or .vtt, whatever the case of the name. */
function besideFile(file) {
  try {
    const dir = path.dirname(file), base = path.basename(file, path.extname(file)).toLowerCase();
    const names = fs.readdirSync(dir);
    for (const ext of ['.lrc', '.srt', '.vtt']) {
      const name = names.find(n => n.toLowerCase() === base + ext);
      if (!name) continue;
      const got = readLyricsFile(path.join(dir, name), 'file');
      if (got) return got;
    }
    return null;
  } catch (_) { return null; }
}

/**
 * One lyrics tag as text. music-metadata 12 (v3.42.0) gives an object: the
 * words as text, and where the tag was timed (an ID3 SYLT frame, or LRC
 * inside a Vorbis or MP4 tag) the lines with their times in milliseconds as
 * syncText, with the times taken out of the text. Those are put back as LRC,
 * or timed lyrics kept in a FLAC would show untimed. Version 7 gave strings.
 */
function tagText(x) {
  if (typeof x === 'string') return x;
  if (!x) return '';
  const sync = Array.isArray(x.syncText) ? x.syncText.filter(l => l && Number.isFinite(l.timestamp)) : [];
  if (x.timeStampFormat === 2 && sync.length) {
    const pad = n => String(n).padStart(2, '0');
    return sync.map(l => { const t = Math.max(0, l.timestamp) / 1000; return `[${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}.${pad(Math.floor((t % 1) * 100))}]${l.text || ''}`; }).join('\n');
  }
  return x.text || x.lyrics || (Array.isArray(x.syncText) ? x.syncText.map(l => (l && l.text) || '').join('\n') : '');
}

async function inTags(file) {
  try {
    const mm = require('music-metadata');
    const md = await mm.parseFile(file, { duration: false, skipCovers: true });
    const ly = (md.common && md.common.lyrics) || [];
    const text = ly.map(tagText).filter(Boolean).join('\n');
    return shape(text, 'tags');
  } catch (_) { return null; }
}

/**
 * fetchJson(url, ua) gives { status, json } or null when not reached (the
 * main process passes Electron's net.fetch, which follows the system's proxy).
 * cacheDir() is where answers are kept, a file each (pins.json for the
 * person's choices). ua is the User-Agent: LRCLIB asks for the app's name and
 * a link. youtube(song) is the YouTube lookup (ytdlp.js), or null.
 */
function makeLyrics({ fetchJson, cacheDir, ua, youtube = null }) {
  const store = {
    read: name => { try { return JSON.parse(fs.readFileSync(path.join(cacheDir(), name + '.json'), 'utf8')); } catch (_) { return null; } },
    write: (name, v) => { try { fs.writeFileSync(path.join(cacheDir(), name + '.json'), JSON.stringify(v)); } catch (_) {} },
  };
  return core.makeLyrics({
    fetchJson, store, ua, youtube,
    hash: s => crypto.createHash('sha1').update(s).digest('hex'),
    local: f => !/^https?:/i.test(f) && path.isAbsolute(f),
    beside: besideFile, inTags,
    readFile: p => readLyricsFile(p, 'file'),
  });
}

module.exports = { makeLyrics, besideFile, shape, subsToLrc, cleanTitle, songOf, fit, tagText, inTags };
