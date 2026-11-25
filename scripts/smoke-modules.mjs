#!/usr/bin/env node
/**
 * BM Player — modules smoke test
 *
 * src/js/modules/ is ~1,500 lines across nine files that no test had ever
 * executed. These are the modules that own persisted user data — bookmarks,
 * history, settings — so a bug here quietly loses or corrupts something the
 * user cares about, rather than throwing somewhere anyone would notice.
 *
 * Run with: npm run test:modules
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const pass = n => { results.push(true); console.log('  \x1b[32m✓\x1b[0m ' + n); };
const fail = (n, e) => {
  results.push(false);
  console.log('  \x1b[31m✗\x1b[0m ' + n);
  if (e) console.log('      ' + String(e.stack || e.message || e).split('\n').slice(0, 3).join('\n      '));
};
const step = async (n, fn) => { try { await fn(); pass(n); } catch (e) { fail(n, e); } };
const load = rel => import(pathToFileURL(path.join(ROOT, rel)).href);

/* ── minimal browser surface: these modules persist to localStorage ── */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://bm.local/' });
const store = new Map();
const ls = {
  getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: k => store.delete(String(k)),
  clear: () => store.clear(),
  key: i => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};
Object.defineProperty(dom.window, 'localStorage', { value: ls, configurable: true });
for (const k of ['window', 'document', 'Event', 'CustomEvent']) {
  try { globalThis[k] = dom.window[k]; }
  catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); }
}
globalThis.localStorage = ls;
globalThis.fetch = async () => ({ ok: false, status: 404, text: async () => '' });

async function main() {
  console.log('\nBM Player — modules smoke test\n');

  /* ── bookmarks ────────────────────────────────────────────────── */
  const { bookmarks } = await load('src/js/modules/bookmarks.js');
  const FILE = 'C:\\Users\\b\\Videos\\Rock & Roll <live>.mkv';

  await step('bookmarks add/list round-trips a hostile path', () => {
    bookmarks.clearForFile(FILE);
    bookmarks.add(FILE, 42.5, 'Chapter one');
    const list = bookmarks.list(FILE);
    if (list.length !== 1) throw new Error('expected 1, got ' + list.length);
    if (Math.abs(list[0].t - 42.5) > 0.001) throw new Error('time not preserved: ' + list[0].t);
  });

  await step('bookmarks dedupe positions within a second', () => {
    bookmarks.clearForFile(FILE);
    bookmarks.add(FILE, 42.5, 'first');
    bookmarks.add(FILE, 42.9, 'near-duplicate');
    if (bookmarks.list(FILE).length !== 1) throw new Error('dedupe window not applied');
  });

  await step('bookmarks persist across a module reload', async () => {
    const fresh = await import(pathToFileURL(path.join(ROOT, 'src/js/modules/bookmarks.js')).href + '?reload=1');
    if (!fresh.bookmarks.list(FILE).length) throw new Error('nothing was written to localStorage');
  });

  await step('bookmarks remove by timestamp, then clear', () => {
    // remove() is keyed on time, not an id — the panel passes row.dataset.t.
    bookmarks.clearForFile(FILE);
    bookmarks.add(FILE, 10, 'a');
    bookmarks.add(FILE, 90, 'b');
    if (!bookmarks.remove(FILE, 10)) throw new Error('remove returned false for a real timestamp');
    if (bookmarks.list(FILE).length !== 1) throw new Error('remove did not take');
    if (bookmarks.remove(FILE, 999)) throw new Error('remove claimed success for a timestamp that does not exist');
    bookmarks.clearForFile(FILE);
    if (bookmarks.list(FILE).length) throw new Error('clearForFile left entries');
  });

  await step('bookmarks export/import round-trips', () => {
    bookmarks.clearForFile(FILE);
    bookmarks.add(FILE, 12, 'a');
    const dump = bookmarks.exportAll();
    bookmarks.clearForFile(FILE);
    bookmarks.importAll(dump);
    if (!bookmarks.list(FILE).length) throw new Error('import lost the entries');
  });

  await step('bookmarks tolerate corrupt stored JSON', async () => {
    localStorage.setItem('bm_bookmarks', '{not json');
    const fresh = await import(pathToFileURL(path.join(ROOT, 'src/js/modules/bookmarks.js')).href + '?corrupt=1');
    fresh.bookmarks.list(FILE);        // must not throw at import or on read
    localStorage.removeItem('bm_bookmarks');
  });

  /* ── history ──────────────────────────────────────────────────── */
  const { history } = await load('src/js/modules/history.js');

  await step('history records an open and resumes mid-file', () => {
    history.clear();
    history.onOpened({ path: FILE, isVideo: true });
    history.onTimeUpdate({ timePos: 300, duration: 1200 });
    history.onClose({ path: FILE, timePos: 300 });
    const pos = history.getResumePosition(FILE);
    if (!pos || Math.abs(pos - 300) > 1) throw new Error('resume position lost, got ' + pos);
  });

  await step('history does not offer to resume a finished file', () => {
    history.clear();
    history.onOpened({ path: FILE, isVideo: true });
    history.onTimeUpdate({ timePos: 1195, duration: 1200 });
    history.onClose({ path: FILE, timePos: 1195 });
    const pos = history.getResumePosition(FILE);
    // Resuming five seconds from the end is worse than starting over.
    if (pos && pos > 1100) throw new Error('offered to resume at ' + pos + 's of 1200s');
  });

  await step('history list and remove', () => {
    history.clear();
    history.onOpened({ path: FILE, isVideo: true });
    history.onTimeUpdate({ timePos: 10, duration: 100 });
    if (!history.list().length) throw new Error('list() is empty after an open');
    history.remove(FILE);
    if (history.list().some(e => e.path === FILE)) throw new Error('remove did nothing');
  });

  await step('history onChange fires and unsubscribes', () => {
    let fired = 0;
    const off = history.onChange(() => fired++);
    history.onOpened({ path: FILE, isVideo: true });
    if (!fired) throw new Error('no change event');
    off();
    const was = fired;
    history.onOpened({ path: FILE + '2', isVideo: true });
    if (fired !== was) throw new Error('listener still firing after unsubscribe');
  });

  /* ── settings ─────────────────────────────────────────────────── */
  const { settings } = await load('src/js/modules/settings.js');

  await step('settings get/set with a dotted path', () => {
    const all = settings.exportAll();
    if (!all || !Object.keys(all).length) throw new Error('no defaults defined');
    const probe = 'playback.autoResume';
    const original = settings.get(probe);
    settings.set(probe, !original);
    if (settings.get(probe) === original) throw new Error('set() had no effect on ' + probe);
    settings.set(probe, original);
  });

  await step('settings reject a malformed import instead of wiping state', () => {
    const before = JSON.stringify(settings.exportAll());
    for (const junk of [null, undefined, 'not an object', 42, []]) {
      try { settings.importAll(junk); } catch (_) {}
    }
    if (JSON.stringify(settings.exportAll()) !== before) {
      throw new Error('a bad import mutated the stored settings');
    }
  });

  await step('settings export/import round-trips', () => {
    const dump = settings.exportAll();
    settings.importAll(JSON.parse(JSON.stringify(dump)));
    if (JSON.stringify(settings.exportAll()) !== JSON.stringify(dump)) {
      throw new Error('round-trip changed the settings');
    }
  });

  await step('settings survive corrupt stored JSON', async () => {
    localStorage.setItem('bm_settings', '}{');
    const fresh = await import(pathToFileURL(path.join(ROOT, 'src/js/modules/settings.js')).href + '?corrupt=1');
    if (!fresh.settings.exportAll()) throw new Error('recovered to nothing');
    localStorage.removeItem('bm_settings');
  });

  /* ── playlist I/O ─────────────────────────────────────────────── */
  const m3u = await load('src/js/modules/playlist-io.js');

  await step('M3U parser handles EXTINF, comments and blank lines', () => {
    const text = [
      '#EXTM3U', '',
      '#EXTINF:183,Artist - Track One',
      'C:\\Music\\one.mp3',
      '# a plain comment',
      '#EXTINF:-1,Live Stream',
      'http://example.com/stream.m3u8',
      '   ',
      'D:\\Music\\no extinf.flac',
    ].join('\n');
    const out = m3u.parseM3u(text);
    if (out.length !== 3) throw new Error('expected 3 entries, got ' + out.length);
    if (!String(out[0].title || '').includes('Track One')) throw new Error('EXTINF title lost');
    if (!String(out[2].path || '').includes('no extinf')) throw new Error('entry without EXTINF was dropped');
  });

  await step('M3U parser survives junk input', () => {
    for (const junk of ['', '   ', '#EXTM3U', 'not a playlist at all', '\n\n\n']) {
      if (!Array.isArray(m3u.parseM3u(junk))) throw new Error('did not return an array for ' + JSON.stringify(junk));
    }
  });

  await step('M3U serialize/parse round-trips awkward paths', () => {
    const items = [
      { path: 'C:\\Music\\a & b.mp3', title: 'A & B', duration: 200 },
      { path: '/home/u/c#1.flac', title: 'C #1', duration: -1 },
    ];
    const out = m3u.parseM3u(m3u.serializeM3u(items));
    if (out.length !== 2) throw new Error('round-trip lost entries: ' + out.length);
    if (out[0].path !== items[0].path) throw new Error('path mangled: ' + out[0].path);
    if (out[1].path !== items[1].path) throw new Error('path with # mangled: ' + out[1].path);
  });

  await step('isM3uPath recognises both extensions and nothing else', () => {
    if (!m3u.isM3uPath('/a/b.m3u') || !m3u.isM3uPath('/a/b.M3U8')) throw new Error('missed a playlist');
    if (m3u.isM3uPath('/a/b.mp3') || m3u.isM3uPath('/a/m3u')) throw new Error('false positive');
  });

  /* ── TV / IPTV ────────────────────────────────────────────────── */
  const { TVModule } = await load('src/js/modules/tv.js');

  await step('TVModule constructs without a live player', () => {
    new TVModule({ onStatus: () => {}, onProgress: () => {}, onChannels: () => {} });
  });

  // v3.52.0
  const tvMod = await load('src/js/modules/tv.js');
  const LIST = [
    '﻿#EXTM3U',
    '#EXTINF:-1 tvg-id="one.in" tvg-logo="https://logos.example/one.png" group-title="News, World",One News',
    'http://tv.example/one.m3u8',
    '#EXTINF:-1 group-title="Sports",Zed Sport, HD',
    '#EXTVLCOPT:http-user-agent=Player/1.0',
    '#EXTVLCOPT:http-referrer=https://ref.example/',
    'http://tv.example/zed.m3u8',
    '#EXTINF:-1,Alpha Films',
    '#EXTGRP:Films',
    'http://tv.example/alpha.ts|User-Agent=Kodi%2F20&Referer=https://k.example/',
    '#EXTINF:-1 tvg-name="Named In The Tag" group-title="Sports",',
    'rtmp://tv.example/live/four',
    '# a note, not a channel',
    '',
  ].join('\r\n');

  await step('a playlist is read whole: a comma inside a quoted group, #EXTGRP, and a channel\'s own user agent and referrer', async () => {
    const ch = await tvMod.parseM3u(LIST);
    if (ch.length !== 4) throw new Error('expected 4 channels, got ' + ch.length + ': ' + JSON.stringify(ch.map(c => c.title)));
    const [one, zed, alpha, four] = ch;
    if (one.title !== 'One News' || one.group !== 'News, World') throw new Error('the comma inside the group\'s quotes cut the line: ' + JSON.stringify(one));
    if (one.logo !== 'https://logos.example/one.png' || one.id !== 'one.in') throw new Error('logo or id lost: ' + JSON.stringify(one));
    if (zed.title !== 'Zed Sport, HD') throw new Error('a comma in the name cut it: ' + zed.title);
    if (zed.ua !== 'Player/1.0' || zed.ref !== 'https://ref.example/') throw new Error('#EXTVLCOPT not read: ' + JSON.stringify(zed));
    if (alpha.group !== 'Films') throw new Error('#EXTGRP not read: ' + alpha.group);
    if (alpha.url !== 'http://tv.example/alpha.ts' || alpha.ua !== 'Kodi/20' || alpha.ref !== 'https://k.example/') throw new Error('headers after | not read: ' + JSON.stringify(alpha));
    if (four.title !== 'Named In The Tag' || four.url !== 'rtmp://tv.example/live/four') throw new Error('tvg-name or an rtmp address: ' + JSON.stringify(four));
    if (one.ua || one.ref) throw new Error('one channel\'s headers reached another');
  });

  await step('a long playlist is read in slices, saying how far it is, and none of it is lost', async () => {
    const lines = ['#EXTM3U']; for (let i = 0; i < 30000; i++) lines.push(`#EXTINF:-1 group-title="G${i % 7}",Ch ${i}`, `http://tv.example/${i}`);
    const said = [];
    const ch = await tvMod.parseM3u(lines.join('\n'), { slice: 2, onProgress: n => said.push(n) });
    if (ch.length !== 30000 || ch[29999].title !== 'Ch 29999') throw new Error('channels lost: ' + ch.length);
    if (!said.length) throw new Error('nothing was said of how far it was');
  });

  await step('TV: search by words, groups, favourites, recent, three orders, and next and previous round the ends', async () => {
    store.clear();
    const played = [];
    const tv = new TVModule({ onPlay: ch => played.push(ch.title), api: { load: async src => ({ text: LIST, source: src, at: 1000 }) } });
    const r = await tv.loadPlaylist('/lists/mine.m3u');
    if (r.error || tv.totalChannels !== 4) throw new Error('not loaded: ' + JSON.stringify(r.error));
    const names = () => tv.channels.map(c => c.title).join('|');
    if (names() !== 'One News|Zed Sport, HD|Alpha Films|Named In The Tag') throw new Error('not in the playlist\'s order: ' + names());
    tv.setSortBy('name'); if (names() !== 'Alpha Films|Named In The Tag|One News|Zed Sport, HD') throw new Error('by name: ' + names());
    tv.setSortBy('group'); if (tv.channels[0].group !== 'Films' || tv.channels[3].group !== 'Sports') throw new Error('by group: ' + names());
    tv.setSortBy('list');
    if (tv.groups.join('|') !== 'Films|News, World|Sports') throw new Error('groups: ' + tv.groups.join('|'));
    tv.setSearch('sport zed'); if (names() !== 'Zed Sport, HD') throw new Error('two words, either way round: ' + names());
    tv.setSearch('WORLD'); if (names() !== 'One News') throw new Error('a group\'s name is searched too: ' + names());
    tv.setSearch('');
    tv.setGroupFilter('Sports'); if (tv.channels.length !== 2) throw new Error('group: ' + names());
    tv.setGroupFilter(tvMod.FAVS); if (tv.channels.length) throw new Error('favourites before any');
    if (tv.toggleFavorite('http://tv.example/zed.m3u8') !== true || names() !== 'Zed Sport, HD') throw new Error('a favourite is not listed: ' + names());
    if (!JSON.parse(store.get('bm_tv_favs') || '[]').length && ![...store.values()].some(v => v.includes('zed.m3u8'))) throw new Error('the favourite was not saved');
    tv.setGroupFilter('all');
    tv.play(tv.channels[3]); if (played.join() !== 'Named In The Tag' || !tv.isLive) throw new Error('not played');
    tv.step(1); if (tv.currentChannel.title !== 'One News') throw new Error('next from the last is not the first: ' + tv.currentChannel.title);
    tv.step(-1); if (tv.currentChannel.title !== 'Named In The Tag') throw new Error('previous from the first is not the last');
    tv.setGroupFilter(tvMod.RECENT); if (names() !== 'Named In The Tag|One News') throw new Error('recent, latest first: ' + names());
    tv.stop(); if (tv.isLive || tv.currentChannel) throw new Error('still live after stop');
  });

  await step('TV: a playlist that cannot be read leaves the channels there, and the kept copy comes back at the next start', async () => {
    store.clear();
    let answer = { text: LIST, source: 'https://lists.example/a.m3u', at: Date.now() - 7 * 3600 * 1000 };
    const said = [];
    const api = { load: async () => answer, restore: async () => ({ text: LIST, source: 'https://lists.example/a.m3u', at: Date.now() - 7 * 3600 * 1000 }) };
    const tv = new TVModule({ onStatus: (t, m) => said.push(t), api });
    if (!(await tv.restore()) || tv.totalChannels !== 4) throw new Error('the kept playlist did not come back');
    if (tv.sourceName !== 'lists.example' && !/a\.m3u|lists\.example/.test(tv.sourceName)) throw new Error('where it is from: ' + tv.sourceName);
    if (!tv.needsRefresh) throw new Error('a web playlist seven hours old is not asked for again');
    answer = { error: 'the server answered 503' };
    const r = await tv.loadPlaylist(tv.source);
    if (!r.kept || tv.totalChannels !== 4 || said.at(-1) !== 'kept') throw new Error('the channels went with the failed reload: ' + JSON.stringify([r.kept, tv.totalChannels, said]));
    const none = new TVModule({ onStatus: (t) => said.push(t), api: { load: async () => ({ error: 'no' }), restore: async () => null } });
    if (await none.restore()) throw new Error('something restored from nothing');
    const e = await none.loadPlaylist('https://x.example/l.m3u'); if (!e.error || e.kept || said.at(-1) !== 'error') throw new Error('a first load that fails is not an error');
    const local = new TVModule({ api: { restore: async () => ({ text: LIST, source: '/lists/mine.m3u', at: 1 }) } });
    await local.restore(); if (local.needsRefresh) throw new Error('a file on this computer is read again by itself');
  });

  await step('TV: a channel that drops is tried again with longer waits, six times, then given up', async () => {
    store.clear();
    const said = [], again = [];
    const tv = new TVModule({ onPlay: (ch, retry) => { if (retry) again.push(ch.title); }, onStatus: (t, m, ms) => said.push([t, ms]) });
    if (tv.onStreamError() !== 0) throw new Error('tried again with nothing playing');
    tv.play({ url: 'http://tv.example/x', title: 'X', group: 'G' });
    const waits = []; for (let i = 0; i < 6; i++) waits.push(tv.onStreamError());
    if (waits[0] !== 2000 || waits.some((w, i) => i && w <= waits[i - 1] && w !== 30000) || Math.max(...waits) > 30000) throw new Error('the waits: ' + waits.join());
    if (!tv.isLive) throw new Error('given up before the sixth try');
    if (tv.onStreamError() !== 0 || tv.isLive || said.at(-1)[0] !== 'failed') throw new Error('not given up after six: ' + JSON.stringify(said.at(-1)));
    tv.play({ url: 'http://tv.example/y', title: 'Y', group: 'G' });
    tv.onStreamError(); tv.stop();
    await new Promise(r => setTimeout(r, 30));
    if (again.length) throw new Error('a stopped channel was tried again');
  });

  /* ── the remaining modules at least load and construct ────────── */
  await step('ABRepeat constructs', async () => {
    const mod = await load('src/js/modules/abrepeat.js');
    const Cls = mod.default || mod.ABRepeat;
    if (typeof Cls === 'function') new Cls({ mpvApi: () => null, osd: () => {} });
  });

  await step('SpeedMenu constructs', async () => {
    const mod = await load('src/js/modules/speed-menu.js');
    const Cls = mod.default || mod.SpeedMenu;
    if (typeof Cls === 'function') new Cls({ mpvApi: () => null, osd: () => {} });
  });

  await step('lite-mode module loads', async () => {
    const { liteMode } = await load('src/js/modules/lite-mode.js');
    if (!liteMode) throw new Error('no export');
  });

  // v3.46.0: the subtitle search opens opensubtitles.com with the film's name (its old service closed).
  await step('filmName: a film\'s name from its file, the release words taken off', async () => {
    const { filmName } = await load('src/js/util.js');
    const cases = [['C:\\Films\\12. The.Film.Name.2019.1080p.BluRay.x264-GRP.mkv', 'The Film Name 2019'], ['/m/Battle of Assassin [WEB-DL 720p].mp4', 'Battle of Assassin'],
      ['/m/Some_Show_S01E02_HDTV.avi', 'Some Show S01E02'], ['plain.mkv', 'plain'], ['', '']];
    for (const [p, want] of cases) { const got = filmName(p); if (got !== want) throw new Error(`${p}: ${got}`); }
  });

  // A stream's unknown length (Infinity) showed as "Infinity:NaN" (v3.25.0).
  await step('fmtSec: minutes, hours, and an unknown length as --:--', async () => {
    const { fmtSec } = await load('src/js/util.js');
    const cases = [[0, '0:00'], [NaN, '0:00'], [-5, '0:00'], [75, '1:15'], [3725, '1:02:05'], [Infinity, '--:--']];
    for (const [v, want] of cases) if (fmtSec(v) !== want) throw new Error(`fmtSec(${v}) is ${fmtSec(v)}, expected ${want}`);
  });

  // The sound chain (v3.47.0): each effect written once, for mpv and for the
  // in-app engine. What mpv is given must be what 3.46.0 gave it, exactly,
  // for each of these settings (the strings below were taken from that
  // version's sound.js), so films sound as they did.
  // v3.59.0: the equalizer has fifteen bands, the same peaking filter in both
  // players, and ten gains from before are spread over them, so its strings
  // are the new ones; everything else is as 3.46.0 gave it.
  await step('sound chain: mpv gets the filters 3.46.0 gave it (the equalizer as 3.59.0 makes it), and none when every effect is off', async () => {
    const { lavfi } = await load('src/js/sound-chain.js');
    const cases = [
      ["nothing", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}, ""],
      ["one band", {"eq": [0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}, "lavfi=[equalizer=f=63:width_type=q:width=1.8:g=6]"],
      ["rock, ten gains from before, spread over fifteen", {"eq": [5, 4, -2, -4, -2, 2, 5, 6, 6, 5]}, "lavfi=[equalizer=f=25:width_type=q:width=1.8:g=5,equalizer=f=40:width_type=q:width=1.8:g=4.5,equalizer=f=63:width_type=q:width=1.8:g=4,equalizer=f=160:width_type=q:width=1.8:g=-2.5,equalizer=f=250:width_type=q:width=1.8:g=-4,equalizer=f=400:width_type=q:width=1.8:g=-2.5,equalizer=f=630:width_type=q:width=1.8:g=-0.5,equalizer=f=1000:width_type=q:width=1.8:g=2,equalizer=f=1600:width_type=q:width=1.8:g=4,equalizer=f=2500:width_type=q:width=1.8:g=5.5,equalizer=f=4000:width_type=q:width=1.8:g=6,equalizer=f=6300:width_type=q:width=1.8:g=6,equalizer=f=10000:width_type=q:width=1.8:g=5.5,equalizer=f=16000:width_type=q:width=1.8:g=5]"],
      ["half dB", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -3.5]}, "lavfi=[equalizer=f=16000:width_type=q:width=1.8:g=-3.5]"],
      ["mono", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "channels": "mono"}, "lavfi=[aformat=channel_layouts=stereo,pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1]"],
      ["left", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "channels": "left"}, "lavfi=[aformat=channel_layouts=stereo,pan=stereo|c0=c0|c1=c0]"],
      ["right", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "channels": "right"}, "lavfi=[aformat=channel_layouts=stereo,pan=stereo|c0=c1|c1=c1]"],
      ["swap", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "channels": "swap"}, "lavfi=[aformat=channel_layouts=stereo,pan=stereo|c0=c1|c1=c0]"],
      ["stereo named", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "channels": "stereo"}, ""],
      ["night", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "night": true}, "lavfi=[acompressor=threshold=0.05:ratio=4:attack=8:release=250:makeup=2,alimiter=limit=0.95]"],
      ["boost 150", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "boost": 1.5}, "lavfi=[volume=1.5,alimiter=limit=0.95]"],
      ["boost 200", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "boost": 2.0}, "lavfi=[volume=2,alimiter=limit=0.95]"],
      ["boost 100", {"eq": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "boost": 1.0}, ""],
      ["all", {"eq": [3, 0, 0, 0, 0, 0, 0, 0, 0, 0], "channels": "mono", "night": true, "boost": 1.5}, "lavfi=[equalizer=f=25:width_type=q:width=1.8:g=3,equalizer=f=40:width_type=q:width=1.8:g=2,aformat=channel_layouts=stereo,pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1,acompressor=threshold=0.05:ratio=4:attack=8:release=250:makeup=2,volume=1.5,alimiter=limit=0.95]"],
    ];
    for (const [name, s, want] of cases) { const got = lavfi(s); if (got !== want) throw new Error(`${name}: ${got}\n      expected ${want}`); }
  });

  await step('sound chain: settings come out complete and in range, whatever is given', async () => {
    const { settings, EQ_FREQUENCIES, CHANNELS, EFFECTS } = await load('src/js/sound-chain.js');
    const s = settings({ eq: [40, -40, 'x', null, 3.5], channels: 'sideways', boost: 9, night: 1 });
    if (s.eq.length !== EQ_FREQUENCIES.length || s.eq.slice(0, 5).join(',') !== '12,-12,0,0,3.5' || s.eq.slice(5).some(g => g !== 0)) throw new Error('eq: ' + s.eq);
    if (s.channels !== 'stereo' || s.boost !== 2 || s.night !== true) throw new Error(JSON.stringify(s));
    const d = settings();
    if (d.eq.some(g => g) || d.channels !== 'stereo' || d.boost !== 1 || d.night) throw new Error('the defaults are not all off: ' + JSON.stringify(d));
    if (EFFECTS.some(e => e.on(d))) throw new Error('an effect is on with every setting off: ' + EFFECTS.filter(e => e.on(d)).map(e => e.id));
    if (settings({ boost: 0.5 }).boost !== 1 || settings({ boost: 'loud' }).boost !== 1) throw new Error('a boost under 100% or unreadable was not 100%');
    if (CHANNELS.map(c => c[0]).join() !== 'stereo,mono,left,right,swap') throw new Error('the channels are ' + CHANNELS.map(c => c[0]));
    for (const e of EFFECTS) if (typeof e.on !== 'function' || typeof e.mpv !== 'function' || typeof e.web !== 'function') throw new Error(e.id + ' is missing a form');
  });


  // Sound lab (v3.49.0): what mpv is given for each sound mode, clear voice
  // and the preamp, written out, so a change to any of them is seen here.
  // scripts/sound-check.mjs plays them against the engine's forms, and
  // scripts/integration-mpv.cjs gives them to a real mpv.
  await step('sound chain: mpv gets the sound modes, clear voice and the preamp as written', async () => {
    const { lavfi } = await load('src/js/sound-chain.js');
    const cases = [
      ["off", {"mode": "off"}, ""],
      ["slowed", {"mode": "slowed"}, "lavfi=[asplit=2[slowedd][slowedw];[slowedw]highpass=f=200,aecho=0:1:5.6|10.5|14|15.7:0.5|0.45|0.4|0.35,aecho=1:0.8:34|37.1|56.7|73.9:0.4|0.33|0.27|0.22,aecho=1:0.8:93|154.8|216.1|277.6:0.45|0.35|0.27|0.2,volume=0.7[slowedr];[slowedd][slowedr]amix=inputs=2,volume=2,alimiter=limit=0.95]"],
      ["nightcore", {"mode": "nightcore"}, ""],
      ["8d", {"mode": "8d"}, "lavfi=[aformat=channel_layouts=stereo,pan=stereo|c0=0.6*c0+0.4*c1|c1=0.4*c0+0.6*c1,apulsator=hz=0.1:amount=0.9,asplit=2[spaced][spacew];[spacew]highpass=f=200,aecho=0:1:8.4|11|13.9|15.9:0.5|0.45|0.4|0.35,aecho=1:0.8:27.3|35.8|50.4|68.7:0.35|0.3|0.25|0.2,volume=0.3[spacer];[spaced][spacer]amix=inputs=2,volume=2,alimiter=limit=0.95]"],
      ["bass", {"mode": "bass"}, "lavfi=[lowshelf=g=8:f=100:t=s:w=1,alimiter=limit=0.95]"],
      ["karaoke", {"mode": "karaoke"}, "lavfi=[aformat=channel_layouts=stereo,asplit=2[ka][kb];[kb]lowpass=f=180,lowpass=f=180,pan=stereo|c0=c1|c1=c0[kc];[ka]pan=stereo|c0=c0-c1|c1=c1-c0[kd];[kd][kc]amix=inputs=2,volume=2,alimiter=limit=0.95]"],
      ["hall", {"mode": "hall"}, "lavfi=[asplit=2[halld][hallw];[hallw]highpass=f=200,aecho=0:1:7.3|12.4|15.1|19.4:0.5|0.45|0.4|0.35,aecho=1:0.8:19.8|28.5|45.3|59.4:0.35|0.3|0.25|0.2,aecho=1:0.8:72.2|133|171.9|231.9:0.4|0.3|0.22|0.16,volume=0.5[hallr];[halld][hallr]amix=inputs=2,volume=2,alimiter=limit=0.95]"],
      ["lofi", {"mode": "lofi"}, "lavfi=[highpass=f=200,lowpass=f=3800,vibrato=f=0.5:d=0.6]"],
      ["wide", {"mode": "wide"}, "lavfi=[aformat=channel_layouts=stereo,pan=stereo|c0=1.3*c0-0.3*c1|c1=1.3*c1-0.3*c0,alimiter=limit=0.95]"],
      ["clear voice", {"voice": true}, "lavfi=[dialoguenhance,pan=stereo|c0=c0+0.4*c2|c1=c1+0.4*c2,alimiter=limit=0.95]"],
      ["preamp", {"preamp": -3.5, "eq": [2]}, "lavfi=[volume=-3.5dB,equalizer=f=25:width_type=q:width=1.8:g=2]"],
      ["preamp up", {"preamp": 3}, "lavfi=[volume=3dB,alimiter=limit=0.95]"],
    ];
    for (const [name, s, want] of cases) { const got = lavfi(s); if (got !== want) throw new Error(`${name}: ${got}\n      expected ${want}`); }
  });

  await step('sound chain: the modes, one at a time, with Slowed and Nightcore playing slower and faster', async () => {
    const { settings, MODES, RATES, rateOf, EFFECTS } = await load('src/js/sound-chain.js');
    const d = settings();
    if (d.mode !== 'off' || d.voice !== false || d.preamp !== 0) throw new Error('the new settings are not off by default: ' + JSON.stringify(d));
    if (settings({ mode: 'loud' }).mode !== 'off' || settings({ preamp: 40 }).preamp !== 12 || settings({ preamp: 'x' }).preamp !== 0) throw new Error('an unknown mode or preamp was let through');
    if (MODES.map(m => m[0]).join() !== 'off,slowed,nightcore,8d,bass,karaoke,hall,lofi,wide') throw new Error('the modes are ' + MODES.map(m => m[0]));
    if (rateOf({ mode: 'slowed' }) !== 0.85 || rateOf({ mode: 'nightcore' }) !== 1.25 || rateOf({ mode: 'hall' }) !== 1 || rateOf() !== 1) throw new Error('the rates: ' + JSON.stringify(RATES));
    // each mode turns on its own effect only (Nightcore has none: it is only faster)
    for (const [m] of MODES) {
      const on = EFFECTS.filter(e => e.on(settings({ mode: m }))).map(e => e.id).filter(id => id !== 'limit');
      const want = m === 'off' || m === 'nightcore' ? '' : m;
      if (on.join() !== want) throw new Error(`${m} turns on ${on.join() || 'nothing'}`);
    }
  });

  // v3.50.0: the lyrics of every song saved at once (Preferences, Settings).
  await step('lyrics saver: one song at a time, a pause only after LRCLIB was asked, the same song again when the connection is back, and Stop', async () => {
    const { LyricsSaver } = await load('src/js/modules/lyrics-saver.js');
    const asked = [], states = [];
    let down = false, running = 0, most = 0;
    const api = { music: { lyrics: async (file, meta, opts) => {
      running++; most = Math.max(most, running); asked.push({ file, meta, opts });
      await new Promise(r => setTimeout(r, 2)); running--;
      if (down) return { source: 'none', offline: true, fetched: true };
      if (file === 'b') return { source: 'none', fetched: true };
      if (file === 'c') return { source: 'tags', synced: '[00:01.00]own' };
      return { source: 'lrclib', synced: '[00:01.00]x', saved: true, fetched: true };
    } } };
    const songs = ['a', 'b', 'c', 'd'].map(p => ({ path: p, meta: { title: p.toUpperCase(), artist: 'X' } }));
    const sv = new LyricsSaver({ api, onChange: st => states.push(st), gap: 15, wait: 60000 });
    const t0 = Date.now();
    const end = await sv.start(songs);
    if (most !== 1) throw new Error(most + ' songs looked up at once');
    if (asked.map(a => a.file).join() !== 'a,b,c,d' || !asked.every(a => a.opts.online === true && a.opts.youtube === false)) throw new Error('asked ' + JSON.stringify(asked.map(a => [a.file, a.opts])));
    if (end.done !== 4 || end.found !== 3 || end.none !== 1 || end.running) throw new Error('the count: ' + JSON.stringify(end));
    if (Date.now() - t0 < 2 * 15) throw new Error('no pause after the songs LRCLIB was asked about');
    if (!states[0].running || states.at(-1).running) throw new Error('running not told: ' + JSON.stringify([states[0], states.at(-1)]));
    // out of reach: it waits, and goes on with the same song when the connection is back
    asked.length = 0; down = true;
    const run = sv.start(songs.slice(0, 2));
    await new Promise(r => setTimeout(r, 30));
    if (!sv.state.waiting || asked.length !== 1) throw new Error('not waiting for the connection: ' + JSON.stringify(sv.state) + ' asked ' + asked.length);
    down = false; window.dispatchEvent(new Event('online'));
    const back = await run;
    if (asked.map(a => a.file).join() !== 'a,a,b' || back.done !== 2) throw new Error('after the connection came back: ' + asked.map(a => a.file) + ' ' + JSON.stringify(back));
    // Stop: after the song being looked up, nothing more asked
    asked.length = 0;
    const long = Array.from({ length: 50 }, (_, i) => ({ path: 'a' + i, meta: { title: 'T' + i } }));
    const r2 = sv.start(long);
    await new Promise(r => setTimeout(r, 25));
    sv.stop();
    const st = await r2, n = asked.length;
    await new Promise(r => setTimeout(r, 40));
    if (!st.stopped || st.running || asked.length !== n || n >= 50) throw new Error('Stop: ' + JSON.stringify(st) + ', asked ' + n + ' then ' + asked.length);
    // a song that keeps failing while the device is online: left for next time, the rest go on
    const sv3 = new LyricsSaver({ api: { music: { lyrics: async f => f === 'x' ? { source: 'none', offline: true, fetched: true } : { source: 'lrclib', synced: 'y', fetched: true } } }, gap: 0, wait: 1 });
    const e3 = await sv3.start([{ path: 'x', meta: {} }, { path: 'y', meta: {} }]);
    if (e3.missed !== 1 || e3.found !== 1 || e3.none !== 0 || e3.done !== 2) throw new Error('a song that keeps failing: ' + JSON.stringify(e3));
    // a second start while running is not a second run
    const sv2 = new LyricsSaver({ api, gap: 0 });
    const p1 = sv2.start(songs), p2 = await sv2.start(songs);
    if (!p2.running) throw new Error('a second start ran alongside the first');
    await p1;
  });

  // v3.51.0: the graphics card's name is kept between starts, so a start does not make a WebGL context only to ask it.
  await step('performance info: the graphics card asked once and kept, not asked again at the next start', async () => {
    const { liteMode } = await load('src/js/modules/lite-mode.js');
    const L = liteMode.constructor, realCreate = document.createElement.bind(document);
    let made = 0;
    document.createElement = t => { if (t === 'canvas') { made++; return { getContext: () => ({ getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter: () => 'Test Card 9000' }) }; } return realCreate(t); };
    try {
      localStorage.removeItem('bm_gl_renderer');
      const first = new L().detectPerfInfo();
      if (first.webglRenderer !== 'Test Card 9000' || made !== 1 || localStorage.getItem('bm_gl_renderer') !== 'Test Card 9000') throw new Error(`the first start: ${first.webglRenderer}, ${made} contexts`);
      const next = new L().detectPerfInfo();
      if (next.webglRenderer !== 'Test Card 9000' || made !== 1) throw new Error(`the next start asked again: ${made} contexts`);
    } finally { document.createElement = realCreate; localStorage.removeItem('bm_gl_renderer'); }
  });

  // ── v3.59.0: picture quality, where the sound goes, what each film keeps ──
  const fakeMpv = () => { const said = []; return { said, cmd: (c, k, v) => { said.push([c, k, v]); return Promise.resolve(null); } }; };
  await step('picture quality: auto is Fast in Lite and Balanced elsewhere, each preset says its scalers to mpv', async () => {
    const { Quality, PRESETS } = await load('src/js/modules/quality.js');
    localStorage.removeItem('bm_quality');
    const m = fakeMpv(); let lite = true;
    const q = new Quality({ mpv: () => m, lite: () => lite });
    if (q.used !== 'fast') throw new Error('auto in Lite: ' + q.used);
    lite = false; if (q.used !== 'balanced') throw new Error('auto elsewhere: ' + q.used);
    q.setPreset('high');
    const got = Object.fromEntries(m.said.filter(x => x[0] === 'set_property').map(x => [x[1], x[2]]));
    for (const [k, v] of Object.entries(PRESETS.high)) if (got[k] !== v) throw new Error(`high: ${k} is ${got[k]}, not ${v}`);
    if (got['video-sync'] !== 'audio' || got.interpolation !== 'no') throw new Error('smooth motion was on: ' + got['video-sync']);
    q.setMotion(true); q.setHdr('natural');
    const later = Object.fromEntries(m.said.map(x => [x[1], x[2]]));
    if (later['video-sync'] !== 'display-resample' || later.interpolation !== 'yes' || later['tone-mapping'] !== 'bt.2390') throw new Error('motion and HDR: ' + JSON.stringify(later));
    const kept = new Quality({ mpv: () => fakeMpv(), lite: () => false });
    if (kept.preset !== 'high' || !kept.motion || kept.hdr !== 'natural') throw new Error('not kept: ' + JSON.stringify(kept));
    q.setPreset('nonsense'); if (q.preset !== 'high') throw new Error('an unknown preset was taken');
    localStorage.removeItem('bm_quality');
  });
  await step('where the sound goes: the browser device is found by the name mpv gives it', async () => {
    const { matchDevice } = await load('src/js/modules/output.js');
    const devs = [
      { kind: 'audiooutput', deviceId: 'default', label: 'Default - Speakers (Realtek(R) Audio)' },
      { kind: 'audiooutput', deviceId: 'a1', label: 'Speakers (Realtek(R) Audio)' },
      { kind: 'audiooutput', deviceId: 'b2', label: 'Headphones (WH-1000XM4 Stereo)' },
      { kind: 'audioinput', deviceId: 'c3', label: 'Microphone (Realtek(R) Audio)' },
    ];
    if (matchDevice('Speakers (Realtek(R) Audio)', devs)?.deviceId !== 'a1') throw new Error('the speakers');
    if (matchDevice('Headphones (WH-1000XM4 Stereo)', devs)?.deviceId !== 'b2') throw new Error('the headphones');
    if (matchDevice('HDMI (LG TV)', devs) !== null) throw new Error('a device that is not there was matched');
    if (matchDevice('', devs) !== null) throw new Error('nothing matched something');
  });
  await step('what each film keeps: the series from the name, its tracks matched by language, kept and given back', async () => {
    const { FilmMemory, seriesOf, pickTrack } = await load('src/js/modules/film-memory.js');
    const cases = [['D:/TV/Dark/Dark.S01E02.1080p.mkv', 'dark'], ['/m/The Office (US) - s03e07 - Branch Wars.mkv', 'the office (us)'], ['/m/show_name_2x05.avi', 'show name'], ['/m/Inception.2010.mkv', null], ['/m/Clip S1.mp4', null]];
    for (const [p, want] of cases) if (seriesOf(p) !== want) throw new Error(`${p}: ${seriesOf(p)}`);
    const tracks = [{ id: 1, type: 'video' }, { id: 1, type: 'audio', lang: 'jpn' }, { id: 2, type: 'audio', lang: 'eng', title: 'Commentary' }, { id: 3, type: 'audio', lang: 'eng' }, { id: 1, type: 'sub', lang: 'eng' }];
    if (pickTrack(tracks, 'audio', { id: 2, lang: 'eng', title: '' }, false) !== 3) throw new Error('by language, not by number, in another episode');
    if (pickTrack(tracks, 'audio', { id: 2, lang: 'eng', title: 'Commentary' }, true) !== 2) throw new Error('its own number in the same film');
    if (pickTrack(tracks, 'sub', { off: true }) !== 'no') throw new Error('subtitles off');
    localStorage.removeItem('bm_film_memory');
    const m = fakeMpv(); const zoom = []; const said = [];
    const fm = new FilmMemory({ mpv: () => m, picture: { setZoom: z => zoom.push(['z', z]), setPan: (x, y) => zoom.push(['p', x, y]) }, osd: t => said.push(t) });
    fm.open('D:/TV/Dark/Dark.S01E01.mkv'); fm.tracks(tracks); fm._quietUntil = 0;
    const chosen = tracks.map(t => ({ ...t, selected: (t.type === 'audio' && t.id === 1) || (t.type === 'video') }));
    fm.tracks(chosen); fm.delay('sub', -0.5); fm.view(150, [20, 0]);
    // the next episode, never opened: the series' choices, by language, and no zoom
    m.said.length = 0; fm.open('E:/Other/Dark.S01E02.mkv');
    const ep2 = [{ id: 1, type: 'video' }, { id: 1, type: 'audio', lang: 'eng' }, { id: 2, type: 'audio', lang: 'jpn' }, { id: 1, type: 'sub', lang: 'eng' }];
    fm.tracks(ep2);
    const got = Object.fromEntries(m.said.map(x => [x[1], x[2]]));
    if (got.aid !== 2 || got.sid !== 'no' || got['sub-delay'] !== -0.5) throw new Error('the next episode: ' + JSON.stringify(got));
    if (zoom.length) throw new Error('the zoom went to another episode');
    if (!/last episode/.test(said.at(-1) || '')) throw new Error('not said: ' + said.at(-1));
    // the first episode again: its own, with its zoom
    m.said.length = 0; fm.open('D:/TV/Dark/Dark.S01E01.mkv'); fm.tracks(tracks);
    if (!zoom.some(z => z[0] === 'z' && z[1] === 150)) throw new Error('its zoom: ' + JSON.stringify(zoom));
    // a song mpv plays, with its cover as a video: nothing kept
    const n = Object.keys(fm.files).length;
    fm.open('/music/a.mp3'); fm._quietUntil = 0; fm.tracks([{ id: 1, type: 'video', albumart: true, selected: true }, { id: 1, type: 'audio', selected: true }]);
    if (Object.keys(fm.files).length !== n) throw new Error('a song was kept as a film');
    localStorage.removeItem('bm_film_memory');
  });

  // v3.59.0: songs made equally loud: where the level comes from, never past the peak, and BS.1770's gates
  await step('even loudness: tags first, then what was measured, never past the peak, and the quiet parts gated out', async () => {
    const { levelFor, integrate, TARGET } = await load('src/js/loudness.js');
    const near = (a, b) => Math.abs(a - b) < 0.05;
    if (levelFor('off', { rgTrack: -6 }).db !== 0) throw new Error('off still levelled');
    let r = levelFor('track', { rgTrack: -6.5, rgAlbum: -4 });
    if (!near(r.db, -6.5) || r.from !== 'tags') throw new Error('the song\'s tags: ' + JSON.stringify(r));
    r = levelFor('album', { rgTrack: -6.5, rgAlbum: -4 });
    if (!near(r.db, -4) || r.from !== 'album tags') throw new Error('album mode: ' + JSON.stringify(r));
    r = levelFor('album', { rgTrack: -6.5 });
    if (!near(r.db, -6.5)) throw new Error('album mode with no album tag: ' + JSON.stringify(r));
    r = levelFor('track', {}, { lufs: -24, peak: 0.2 });
    if (!near(r.db, TARGET + 24) || r.from !== 'measured') throw new Error('measured: ' + JSON.stringify(r));
    // lifted 8 dB a peak of 0.5 would pass full: held at 5.5 (0.5 dB under it)
    r = levelFor('track', { rgTrack: 8, rgTrackPeak: 0.5 });
    if (!near(r.db, -20 * Math.log10(0.5) - 0.5)) throw new Error('past the peak: ' + JSON.stringify(r));
    if (levelFor('track', {}, null).from !== null) throw new Error('nothing known, and a level');
    // integrate: a steady -20 LUFS with silence and a quiet tail is -20
    const p = l => Math.pow(10, (l + 0.691) / 10);
    const blocks = [...Array(50).fill(p(-20)), ...Array(20).fill(0), ...Array(10).fill(p(-45))];
    if (!near(integrate(blocks), -20)) throw new Error('gated: ' + integrate(blocks));
    if (integrate([0, 0]) !== null) throw new Error('silence measured');
  });

  await step('play counts: half a song or four minutes heard is a play, a jump is not hearing, and the smart lists', async () => {
    localStorage.removeItem('bm_music_plays');
    const { Plays } = await load('src/js/modules/plays.js');
    const pl = new Plays();
    pl.start('/m/a.mp3');
    for (let t = 0; t <= 60; t += 0.25) pl.time('/m/a.mp3', t, 200);     // a minute of a 200 s song
    if (pl.count('/m/a.mp3')) throw new Error('counted after a minute of 200 s');
    pl.time('/m/a.mp3', 150, 200);                                         // a seek ahead: not heard
    for (let t = 150; t <= 160; t += 0.25) pl.time('/m/a.mp3', t, 200);
    if (pl.count('/m/a.mp3')) throw new Error('a seek counted as hearing');
    for (let t = 160; t <= 200; t += 0.25) pl.time('/m/a.mp3', t, 200);
    if (pl.count('/m/a.mp3') !== 1) throw new Error('half heard and not counted: ' + pl.count('/m/a.mp3'));
    for (let t = 0; t <= 200; t += 0.25) pl.time('/m/a.mp3', t, 200);
    if (pl.count('/m/a.mp3') !== 1) throw new Error('counted twice in one play');
    pl.start('/m/long.flac');
    for (let t = 0; t <= 241; t += 0.25) pl.time('/m/long.flac', t, 1200);
    if (pl.count('/m/long.flac') !== 1) throw new Error('four minutes of a long one not counted');
    pl.add('/m/long.flac');
    const tracks = [{ path: '/m/a.mp3', added: 3 }, { path: '/m/long.flac', added: 1 }, { path: '/m/new.mp3', added: 9 }];
    const names = l => l.map(t => t.path.split('/').pop()).join(',');
    if (names(pl.list('most', tracks)) !== 'long.flac,a.mp3') throw new Error('most played: ' + names(pl.list('most', tracks)));
    if (names(pl.list('recent', tracks)) !== 'new.mp3,a.mp3,long.flac') throw new Error('recently added: ' + names(pl.list('recent', tracks)));
    if (names(pl.list('never', tracks)) !== 'new.mp3') throw new Error('never played: ' + names(pl.list('never', tracks)));
    if (new Plays().count('/m/long.flac') !== 2) throw new Error('not kept');
    localStorage.removeItem('bm_music_plays');
  });

  await step('karaoke: word times kept from the lyrics, and guessed from each word\'s length where there are none', async () => {
    const { parseLRC, wordsOf } = await load('src/js/modules/lyrics.js');
    const L = parseLRC('[00:10.00]<00:10.00>Hello <00:10.60>there <00:11.30>world<00:12.00>\n[00:13.00]plain line here\n[00:20.00][00:30.00]<00:20.00>twice <00:20.50>sung');
    if (L.length !== 4 || L[0].text !== 'Hello there world') throw new Error('lines: ' + JSON.stringify(L));
    if (JSON.stringify(L[0].words.map(w => [w.t, w.w])) !== JSON.stringify([[10, 'Hello '], [10.6, 'there '], [11.3, 'world']])) throw new Error('words: ' + JSON.stringify(L[0].words));
    if (L[1].words) throw new Error('a line without word times has words');
    if (L[3].t !== 30 || L[3].words[1].t !== 30.5) throw new Error('a line sung again: its words at its own time: ' + JSON.stringify(L[3]));
    const g = wordsOf(L[1], 16);
    if (!g.est || g.words.length !== 3 || g.words[0].t !== 13 || !(g.words[1].t > 13 && g.words[2].t < 16)) throw new Error('guessed: ' + JSON.stringify(g));
    if (g.words.map(w => w.w).join('') !== 'plain line here') throw new Error('the words do not make the line: ' + g.words.map(w => w.w).join('|'));
    const real = wordsOf(L[0], 13);
    if (real.est || real.words.length !== 3) throw new Error('real word times taken as guessed');
  });

  const bad = results.filter(r => !r).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed.\n`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
