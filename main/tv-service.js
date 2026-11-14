'use strict';
/**
 * Playlists for the TV tab (v3.52.0).
 *
 * The page used to fetch a playlist's address itself. A page is held to the
 * web's cross-origin rules, so a list on a server that does not allow other
 * sites could not be loaded at all. Here it is fetched with Electron's own
 * fetch, which is not held to them and goes through the system's proxy.
 *
 * The last playlist loaded is kept as it came, in the app's own folder
 * (userData/tv/last.m3u, with last.json saying where it is from and when),
 * so the TV tab has its channels at the next start with no network. It was
 * kept in the page's storage, 5,000 channels at most and for four hours.
 *
 *   tv:load (source)   -> { text, source, at } or { error }
 *   tv:restore ()      -> { text, source, at } or null
 *   tv:forget ()       -> true
 */
const { app, net: electronNet } = require('electron');
const fs = require('fs');
const path = require('path');

const MAX = 64 * 1024 * 1024;        // bytes of playlist read at most
const TIMEOUT = 25000;               // ms for a playlist on the web
const LIST = /\.(m3u8?|txt)$/i;

const dir = () => path.join(app.getPath('userData'), 'tv');
const isWeb = s => /^https?:\/\//i.test(s);

/** The text of a playlist, from the web or from a file on this computer. Throws with a reason to show. */
async function read(source) {
  if (isWeb(source)) {
    const stop = new AbortController(), t = setTimeout(() => stop.abort(), TIMEOUT);
    try {
      const r = await electronNet.fetch(source, { signal: stop.signal, headers: { Accept: '*/*' } });
      if (!r.ok) throw new Error('the server answered ' + r.status);
      const len = +r.headers.get('content-length') || 0;
      if (len > MAX) throw new Error('the playlist is larger than 64 MB');
      // read as it comes, so a list with no stated length cannot fill the memory
      const parts = []; let got = 0;
      if (r.body && r.body.getReader) {
        const rd = r.body.getReader();
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          got += value.length;
          if (got > MAX) { stop.abort(); throw new Error('the playlist is larger than 64 MB'); }
          parts.push(Buffer.from(value));
        }
      } else {
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length > MAX) throw new Error('the playlist is larger than 64 MB');
        parts.push(b);
      }
      return Buffer.concat(parts).toString('utf8');
    } catch (e) {
      if (stop.signal.aborted && !/larger than/.test(String(e.message))) throw new Error('no answer within ' + TIMEOUT / 1000 + ' seconds');
      throw e;
    } finally { clearTimeout(t); }
  }
  if (typeof source !== 'string' || !path.isAbsolute(source)) throw new Error('not a playlist on this computer');
  if (!LIST.test(source)) throw new Error('not an M3U playlist');
  const st = await fs.promises.stat(source);
  if (!st.isFile()) throw new Error('not a file');
  if (st.size > MAX) throw new Error('the playlist is larger than 64 MB');
  return fs.promises.readFile(source, 'utf8');
}

/** Kept whole or not at all: written beside, then put in place. */
async function keep(text, source) {
  const d = dir();
  await fs.promises.mkdir(d, { recursive: true });
  const at = Date.now();
  const tmp = path.join(d, 'last.m3u.tmp');
  await fs.promises.writeFile(tmp, text, 'utf8');
  await fs.promises.rename(tmp, path.join(d, 'last.m3u'));
  await fs.promises.writeFile(path.join(d, 'last.json'), JSON.stringify({ source, at }), 'utf8');
  return at;
}

async function restore() {
  try {
    const d = dir();
    const info = JSON.parse(await fs.promises.readFile(path.join(d, 'last.json'), 'utf8'));
    const st = await fs.promises.stat(path.join(d, 'last.m3u'));
    if (!st.isFile() || st.size > MAX || typeof info.source !== 'string') return null;
    return { text: await fs.promises.readFile(path.join(d, 'last.m3u'), 'utf8'), source: info.source, at: +info.at || 0 };
  } catch (_) { return null; }
}

function register(ipcMain) {
  ipcMain.handle('tv:load', async (_, source) => {
    try {
      const src = String(source || '').trim();
      if (!src) return { error: 'no playlist was given' };
      const text = (await read(src)).replace(/^﻿/, '');
      // a page of HTML, or anything else that is not a list of addresses
      if (/^\s*<(!doctype|html)/i.test(text.slice(0, 300))) return { error: 'that address gave a web page, not a playlist' };
      let at = Date.now();
      try { at = await keep(text, src); } catch (_) {}
      return { text, source: src, at };
    } catch (e) { return { error: String(e && e.message || e).split('\n')[0].slice(0, 200) }; }
  });
  ipcMain.handle('tv:restore', () => restore());
  ipcMain.handle('tv:forget', async () => {
    for (const f of ['last.m3u', 'last.json']) { try { await fs.promises.unlink(path.join(dir(), f)); } catch (_) {} }
    return true;
  });
}

module.exports = { register };
