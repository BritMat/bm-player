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

  await step('subtitle-search module loads', async () => {
    await load('src/js/modules/subtitle-search.js');
  });

  // A stream's unknown length (Infinity) showed as "Infinity:NaN" (v3.25.0).
  await step('fmtSec: minutes, hours, and an unknown length as --:--', async () => {
    const { fmtSec } = await load('src/js/util.js');
    const cases = [[0, '0:00'], [NaN, '0:00'], [-5, '0:00'], [75, '1:15'], [3725, '1:02:05'], [Infinity, '--:--']];
    for (const [v, want] of cases) if (fmtSec(v) !== want) throw new Error(`fmtSec(${v}) is ${fmtSec(v)}, expected ${want}`);
  });

  const bad = results.filter(r => !r).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed.\n`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
