'use strict';
/**
 * BM Player: YouTube captions as lyrics, through yt-dlp (v3.39.0).
 *
 * Asked for: many songs have no lyrics on LRCLIB, and the same song on
 * YouTube, of the same length, may have captions. yt-dlp is the program mpv
 * itself uses for YouTube. It is not in the installer: it is fetched the
 * first time the person turns this on, from yt-dlp's own releases on GitHub,
 * and checked against the SHA-256 sums published beside it before it is
 * kept (user data folder, tools/). It is fetched again when it is a month
 * old, as YouTube changes often and old copies stop working.
 *
 * For a song: YouTube is searched for the artist and title, and of the
 * first eight results those within four seconds of the song's length are
 * tried, the nearest first. A video's own captions (uploaded with it) are
 * taken before YouTube's speech recognition, in the video's language, then
 * English. The captions come back as WebVTT, which lyrics.js reads as timed
 * lyrics. YouTube's terms do not allow programs like yt-dlp, and its
 * captions for songs are often wrong, so it is off unless turned on.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const BASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const MONTH = 30 * 86400000;
const NEAR = 4;

/** The release file for this computer, or null where yt-dlp makes none. */
function binaryName(platform = process.platform, arch = process.arch) {
  if (platform === 'win32') return arch === 'arm64' ? 'yt-dlp_arm64.exe' : 'yt-dlp.exe';
  if (platform === 'darwin') return 'yt-dlp_macos';
  if (platform === 'linux') return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : (arch === 'x64' ? 'yt-dlp_linux' : null);
  return null;
}

function runFile(file, args, { timeout = 40000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) { err.message = (String(stderr || '').trim().split('\n').filter(l => /ERROR/.test(l)).pop() || err.message).slice(0, 300); return reject(err); }
      resolve(stdout);
    });
  });
}

/**
 * dir() is where yt-dlp is kept. fetchBuffer(url) gives the bytes at url or
 * throws. run(file, args, opts) runs it (child_process.execFile, or a stand-in
 * in the tests). now() is the clock.
 */
function makeYtdlp({ dir, fetchBuffer, run = runFile, now = Date.now, platform = process.platform, arch = process.arch }) {
  const name = binaryName(platform, arch);
  const bin = () => path.join(dir(), name);
  const checked = () => bin() + '.checked';            // written once the download matched its sum
  let fetching = null;

  function status() {
    if (!name) return { available: false, installed: false };
    try { const st = fs.statSync(bin()); return { available: true, installed: fs.existsSync(checked()), at: st.mtimeMs, size: st.size }; }
    catch (_) { return { available: true, installed: false }; }
  }

  async function download() {
    const sums = (await fetchBuffer(BASE + 'SHA2-256SUMS')).toString('utf8');
    const row = sums.split('\n').map(l => l.trim().split(/\s+/)).find(([, f]) => f === name || f === '*' + name);
    if (!row || !/^[0-9a-f]{64}$/i.test(row[0])) throw new Error('yt-dlp\'s list of checksums has no ' + name);
    const buf = await fetchBuffer(BASE + name);
    const sum = crypto.createHash('sha256').update(buf).digest('hex');
    if (sum.toLowerCase() !== row[0].toLowerCase()) throw new Error('the yt-dlp download did not match its checksum, so it was not kept');
    fs.mkdirSync(dir(), { recursive: true });
    const tmp = bin() + '.part';
    fs.writeFileSync(tmp, buf, { mode: 0o755 });
    try { fs.rmSync(checked(), { force: true }); } catch (_) {}
    fs.renameSync(tmp, bin());
    fs.writeFileSync(checked(), JSON.stringify({ at: new Date(now()).toISOString(), sha256: sum }));
  }

  /** yt-dlp, fetched first if it is not here, or a month old (the old one is used if that fails). */
  async function ensure() {
    if (!name) throw new Error('yt-dlp has no version for this computer');
    const s = status();
    if (s.installed && now() - s.at < MONTH) return bin();
    if (!fetching) fetching = download().finally(() => { fetching = null; });
    try { await fetching; } catch (e) { if (!s.installed) throw e; }
    return bin();
  }

  const BASE_ARGS = ['--ignore-config', '--no-warnings', '--no-playlist'];

  async function captions(p, id) {
    const url = 'https://www.youtube.com/watch?v=' + id;
    const info = JSON.parse(await run(p, [...BASE_ARGS, '--skip-download', '--dump-single-json', url], { timeout: 45000 }));
    const own = info.subtitles || {}, asr = info.automatic_captions || {};
    const langs = o => Object.keys(o).filter(k => k !== 'live_chat' && Array.isArray(o[k]) && o[k].length);
    const lang = String(info.language || '');
    const prefer = (ks, extra = []) => [lang, ...extra].filter(Boolean).find(k => ks.includes(k)) || ks.find(k => k.startsWith(lang + '-') && lang) || ks.find(k => /^en(\b|-)/.test(k));
    let want = prefer(langs(own), ['en']) || langs(own)[0] || null, auto = false;
    if (!want) {
      const a = langs(asr);
      want = a.find(k => /-orig$/.test(k)) || prefer(a, ['en']) || null; auto = true;
    }
    if (!want) return null;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-yt-'));
    try {
      await run(p, [...BASE_ARGS, '--skip-download', auto ? '--write-auto-subs' : '--write-subs', '--sub-langs', want, '--sub-format', 'vtt', '-o', path.join(tmp, 'c.%(ext)s'), url], { timeout: 45000 });
      const f = fs.readdirSync(tmp).find(n => /\.vtt$/i.test(n));
      return f ? { text: fs.readFileSync(path.join(tmp, f), 'utf8'), auto, lang: want } : null;
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  }

  /** Captions for the song { artist, title, duration }: { vtt, auto, video } or null. */
  async function find(song) {
    const p = await ensure();
    const q = [song.artist, song.title].filter(Boolean).join(' ').trim();
    if (!q) return null;
    const res = JSON.parse(await run(p, [...BASE_ARGS, '--flat-playlist', '--dump-single-json', 'ytsearch8:' + q], { timeout: 40000 }));
    const entries = (res.entries || []).filter(e => e && e.id);
    const near = e => song.duration && e.duration ? Math.abs(e.duration - song.duration) : 99;
    const tries = song.duration ? entries.filter(e => near(e) <= NEAR).sort((a, b) => near(a) - near(b)) : entries.slice(0, 2);
    for (const e of tries.slice(0, 3)) {
      let c = null;
      try { c = await captions(p, e.id); } catch (_) { c = null; }
      if (c && c.text) return { vtt: c.text, auto: c.auto, video: { id: e.id, title: e.title || '', duration: e.duration || 0 } };
    }
    return null;
  }

  return { status, ensure, find, binaryName: name };
}

module.exports = { makeYtdlp, binaryName };
