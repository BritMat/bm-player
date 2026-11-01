'use strict';
/**
 * Lyrics for the page (v3.47.0, from main.js): lyrics.js and ytdlp.js set
 * up with Electron's own fetch, and the page's messages for them.
 */
const { app, dialog, net: electronNet } = require('electron');
const path = require('path');
const S = require('./state');
const { cacheDir } = require('./caches');
const { makeLyrics } = require('../lyrics');   // v3.38.0
const { makeYtdlp } = require('../ytdlp');     // v3.39.0: YouTube captions as lyrics

function register(ipcMain) {
  // Lyrics for a song (v3.38.0, lyrics.js): chosen by the person, beside it,
  // inside it, then LRCLIB when looking online is on, and YouTube's captions
  // when that is on too (v3.39.0). Electron's own fetch: it goes through the
  // system's proxy, as the rest of Chromium does.
  const lyricsUA = `BM Player ${app.getVersion()} (https://github.com/BritMat/bm-player)`;
  // yt-dlp, fetched on first use (ytdlp.js). BM_TOOLS_DIR: the field check
  // keeps it in one place between runs, rather than in each run's profile.
  const ytdlp = makeYtdlp({
    dir: () => process.env.BM_TOOLS_DIR || path.join(app.getPath('userData'), 'tools'),
    fetchBuffer: async url => {
      const stop = new AbortController(), t = setTimeout(() => stop.abort(), 180000);
      try {
        const r = await electronNet.fetch(url, { headers: { 'User-Agent': lyricsUA }, signal: stop.signal });
        if (!r.ok) throw new Error('GitHub answered ' + r.status);
        return Buffer.from(await r.arrayBuffer());
      } finally { clearTimeout(t); }
    },
  });
  const lyricsWarned = { error: '', at: 0 };
  const lyrics = makeLyrics({
    fetchJson: async (url, ua) => {
      const stop = new AbortController(), t = setTimeout(() => stop.abort(), 8000);
      try {
        const r = await electronNet.fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' }, signal: stop.signal });
        let json = null; try { json = await r.json(); } catch (_) {}
        return { status: r.status, json };
      } catch (e) {
        // v3.43.0: why, for the log and the field check, which said only
        // "could not be reached" on a real machine.
        const error = stop.signal.aborted ? 'no answer in 8 seconds' : String((e && e.message) || e).slice(0, 160);
        // Once a minute in the log at most: a song asks up to three times.
        if (error !== lyricsWarned.error || Date.now() - lyricsWarned.at > 60000) { lyricsWarned.error = error; lyricsWarned.at = Date.now(); console.warn('[lyrics] LRCLIB not reached: ' + error); }
        return { status: 0, error };
      } finally { clearTimeout(t); }
    },
    cacheDir: () => cacheDir('lyrics'),
    ua: lyricsUA,
    youtube: song => ytdlp.find(song),
  });
  const songArg = f => (typeof f === 'string' ? f : '');
  ipcMain.handle('lyrics:get', (_, file, meta, opts) => lyrics.get(file, meta, opts));
  ipcMain.handle('lyrics:search', (_, query, meta) => lyrics.search(query, meta));
  ipcMain.handle('lyrics:pick', (_, file, meta, id) => lyrics.pick(songArg(file), meta, id));
  ipcMain.handle('lyrics:unpin', (_, file, meta) => lyrics.unpin(songArg(file), meta));
  ipcMain.handle('lyrics:youtube', (_, file, meta) => lyrics.youtube(songArg(file), meta));
  ipcMain.handle('lyrics:ytdlp', () => ytdlp.status());
  // A lyrics file for this song: the one dropped on the lyrics (only these
  // kinds of file), or one chosen in a dialog.
  ipcMain.handle('lyrics:load', async (_, file, meta, p) => {
    if (typeof p === 'string' && p) {
      if (!/\.(lrc|srt|vtt|txt)$/i.test(p) || !path.isAbsolute(p)) return { source: 'none', unreadable: true };
      return lyrics.load(songArg(file), meta, p);
    }
    const win = S.win;
    const r = await dialog.showOpenDialog(win && !win.isDestroyed() ? win : undefined, {
      title: 'Lyrics for this song', properties: ['openFile'],
      filters: [{ name: 'Lyrics or subtitles', extensions: ['lrc', 'srt', 'vtt', 'txt'] }],
    });
    if (r.canceled || !r.filePaths || !r.filePaths[0]) return { source: 'none', canceled: true };
    return lyrics.load(songArg(file), meta, r.filePaths[0]);
  });
}

module.exports = { register };
