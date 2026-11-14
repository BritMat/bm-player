'use strict';
/**
 * The Games tab's side of the main process (v3.53.0).
 *
 * Three kinds of game, none of them inside the app itself:
 *
 *   built-in   small games written for BM Player. Each is fetched the first
 *              time it is wanted and kept in userData/games/builtin/<id>/.
 *   open       games by other people under open licences, unchanged, each
 *              with its licence. Fetched and kept the same way. Several
 *              share an engine, kept once in userData/games/shared/.
 *   GBA        your own .gba files, played by mGBA built for the web
 *              (@thenick775/mgba-wasm 1.1.1, MPL-2.0). The core is fetched
 *              the first time too. No game comes with the app.
 *   your own   a folder of HTML games you choose.
 *
 * What is fetched is listed in main/games-catalog.json with each file's
 * length and SHA-256, made by scripts/games-catalog.mjs from games/. A file
 * that does not match is not kept. It comes from games/ in the app's
 * repository on GitHub, or from the games/ folder beside the app when it is
 * run from its source.
 *
 * Games run in a frame of their own on bmgame://, never as part of the
 * page: each has its own origin, so its own storage, and no way to the
 * app's. Every answer carries a policy that keeps it off the network.
 *
 *   bmgame://b-<id>/...       a built-in game's files
 *   bmgame://gba/...          the GBA player (src/games/gba), its core
 *                             (/core/...) and a game from the list (/rom/<id>)
 *   bmgame://u-<id>/...       a game from your folder
 */
const { app, net: electronNet } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { ROOT } = require('./env');

const CATALOG = require('./games-catalog.json');
const BASE = 'https://raw.githubusercontent.com/BritMat/bm-player/main/games/';
const TIMEOUT = 30000;                 // ms for one file
const ROM_MAX = 64 * 1024 * 1024;      // a GBA cartridge holds 32 MB at most
const MINE_MAX = 300;                  // games listed from your folder
const ROM = /\.gba$/i;

// bmgame:// is registered as a scheme with bmfile://, in library.js, before the app is ready.

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif', '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.weba': 'audio/webm',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
// Nothing from the network, and nothing of the app's. The built-in games
// and the GBA player need no eval. Games of your own may be built with an
// engine that does.
const OWN = "default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'none'; form-action 'none'; base-uri 'self'; object-src 'none'";
const POLICY = {
  builtin: OWN + "; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  gba: OWN + "; script-src 'self' 'wasm-unsafe-eval'",
  mine: OWN.replace("frame-src 'none'", "frame-src 'self'") + "; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
};

const home = () => path.join(app.getPath('userData'), 'games');
const builtinDir = g => path.join(home(), 'builtin', g.id, String(g.version));
// Every game that is fetched: ours, and the ones by other people (v3.53.0).
const GAMES = CATALOG.builtin.concat(CATALOG.open);
const sharedOf = g => (g.shared || []).map(id => CATALOG.shared.find(s => s.id === id)).filter(Boolean);
const sharedDir = s => path.join(home(), 'shared', s.id, String(s.version));
const coreDir = () => path.join(home(), 'cores', CATALOG.core.id, String(CATALOG.core.version));
const libFile = () => path.join(home(), 'library.json');
const idOf = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const bytesOf = item => item.files.reduce((n, f) => n + f.size, 0);

/* ── what you have added: GBA games and your folder ── */
let lib = null;
function library() {
  if (lib) return lib;
  lib = { roms: [], folder: null };
  try {
    const j = JSON.parse(fs.readFileSync(libFile(), 'utf8'));
    if (Array.isArray(j.roms)) lib.roms = j.roms.filter(r => r && typeof r.file === 'string' && ROM.test(r.file)).map(r => ({ id: idOf(r.file), file: r.file, name: String(r.name || path.basename(r.file, path.extname(r.file))).slice(0, 120), added: +r.added || 0, played: +r.played || 0 }));
    if (typeof j.folder === 'string' && path.isAbsolute(j.folder)) lib.folder = j.folder;
  } catch (_) {}
  return lib;
}
function saveLibrary() {
  try {
    fs.mkdirSync(home(), { recursive: true });
    const tmp = libFile() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(library(), null, 1), 'utf8');
    fs.renameSync(tmp, libFile());
  } catch (e) { console.error('[games] the list could not be saved:', e.message); }
}

/** The games in your folder: each folder in it with an index.html, and each .html file in it. */
let mine = { folder: null, list: [] };
function scanMine() {
  const folder = library().folder;
  mine = { folder, list: [] };
  if (!folder) return mine.list;
  let names;
  try { names = fs.readdirSync(folder, { withFileTypes: true }); } catch (_) { return mine.list; }
  names.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  for (const d of names) {
    if (mine.list.length >= MINE_MAX) break;
    if (d.name.startsWith('.')) continue;
    if (d.isDirectory()) {
      const dir = path.join(folder, d.name);
      if (fs.existsSync(path.join(dir, 'index.html'))) mine.list.push({ id: idOf(dir), name: d.name, dir, entry: 'index.html' });
    } else if (d.isFile() && /\.html?$/i.test(d.name)) {
      // loose pages share the folder, and so one origin: each gets its own id all the same
      mine.list.push({ id: idOf(path.join(folder, d.name)), name: d.name.replace(/\.html?$/i, ''), dir: folder, entry: d.name, loose: true });
    }
  }
  return mine.list;
}

const installed = (dir, item) => item.files.every(f => { try { return fs.statSync(path.join(dir, f.path)).size === f.size; } catch (_) { return false; } });

function state() {
  const l = library();
  return {
    builtin: CATALOG.builtin.map(g => ({ id: g.id, name: g.name, blurb: g.blurb, keys: g.keys, version: g.version, size: bytesOf(g), installed: installed(builtinDir(g), g) })),
    // by other people: the size is the game's own, and what it shares with others is said beside it until that is here
    open: CATALOG.open.map(g => { const need = sharedOf(g).filter(s => !installed(sharedDir(s), s));
      return { id: g.id, name: g.name, blurb: g.blurb, keys: g.keys || '', by: g.by, licence: g.licence, source: g.source, entry: g.entry, query: g.query || '', version: g.version,
        size: bytesOf(g), extra: need.reduce((n, s) => n + bytesOf(s), 0), installed: installed(builtinDir(g), g) && !need.length }; }),
    core: { name: CATALOG.core.name, version: CATALOG.core.version, licence: CATALOG.core.licence, source: CATALOG.core.source, size: bytesOf(CATALOG.core), installed: installed(coreDir(), CATALOG.core) },
    roms: l.roms.slice().sort((a, b) => (b.played || b.added) - (a.played || a.added)).map(r => ({ id: r.id, name: r.name, file: r.file, missing: !fs.existsSync(r.file) })),
    folder: l.folder,
    mine: scanMine().map(g => ({ id: g.id, name: g.name, entry: g.loose ? g.entry : 'index.html' })),
  };
}

/* ── fetching ── */
async function one(rel) {
  // run from its source: the copy beside the app
  const local = path.join(ROOT, 'games', ...rel.split('/'));
  if (!app.isPackaged) { try { return await fs.promises.readFile(local); } catch (_) {} }
  const stop = new AbortController(), t = setTimeout(() => stop.abort(), TIMEOUT);
  try {
    const r = await electronNet.fetch(BASE + rel.split('/').map(encodeURIComponent).join('/'), { signal: stop.signal });
    if (!r.ok) throw new Error('the server answered ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    if (stop.signal.aborted) throw new Error('no answer within ' + TIMEOUT / 1000 + ' seconds');
    throw e;
  } finally { clearTimeout(t); }
}

const busy = new Map();
/** Every file of a catalogue entry, each checked, put in place together or not at all. */
function fetchItem(item, from, dir) {
  if (busy.has(dir)) return busy.get(dir);
  const p = (async () => {
    if (installed(dir, item)) return { ok: true };
    const tmp = dir + '.part';
    try {
      await fs.promises.rm(tmp, { recursive: true, force: true });
      for (const f of item.files) {
        const buf = await one(from + '/' + (f.src || f.path));   // src: kept under another name in the repository
        if (buf.length !== f.size || sha256(buf) !== f.sha256) throw new Error(f.path + ' is not the file this version expects');
        const to = path.join(tmp, ...f.path.split('/'));
        await fs.promises.mkdir(path.dirname(to), { recursive: true });
        await fs.promises.writeFile(to, buf);
      }
      await fs.promises.rm(dir, { recursive: true, force: true });
      await fs.promises.mkdir(path.dirname(dir), { recursive: true });
      await fs.promises.rename(tmp, dir);
      return { ok: true };
    } catch (e) {
      await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {});
      return { error: String(e && e.message || e).split('\n')[0].slice(0, 200) };
    }
  })();
  busy.set(dir, p);
  p.finally(() => busy.delete(dir));
  return p;
}

/* ── serving bmgame:// ── */
const refuse = (status, why) => new Response(why, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
function send(file, size, policy, type) {
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: {
    'Content-Type': type || TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': String(size), 'Content-Security-Policy': policy, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
  } });
}
/** A file inside a folder and nowhere else: no way up and out of it, by name or by link. */
function inside(dir, rel) {
  if (!rel || rel.includes('\0')) return null;
  const file = path.resolve(dir, ...rel.split('/'));
  try {
    const realDir = fs.realpathSync(dir), real = fs.realpathSync(file);
    if (real !== realDir && !real.startsWith(realDir + path.sep)) return null;
    const st = fs.statSync(real);
    return st.isFile() ? { file: real, size: st.size } : null;
  } catch (_) { return null; }
}

async function serve(request) {
  try {
    if (request.method && request.method !== 'GET' && request.method !== 'HEAD') return refuse(405, 'Not allowed');
    const url = new URL(request.url), host = url.hostname;
    let rel; try { rel = decodeURIComponent(url.pathname.replace(/^\/+/, '')); } catch (_) { return refuse(400, 'Bad request'); }
    if (!rel) rel = 'index.html';

    if (host === 'gba') {
      if (rel.startsWith('core/')) {
        const name = rel.slice(5);
        if (!CATALOG.core.files.some(f => f.path === name)) return refuse(404, 'Not found');
        const f = inside(coreDir(), name);
        return f ? send(f.file, f.size, POLICY.gba) : refuse(404, 'Not found');
      }
      if (rel.startsWith('rom/')) {
        const rom = library().roms.find(r => r.id === rel.slice(4));
        if (!rom) return refuse(404, 'Not found');
        let st; try { st = fs.statSync(rom.file); } catch (_) { return refuse(404, 'Not found'); }
        if (!st.isFile() || st.size > ROM_MAX) return refuse(403, 'Not a game');
        rom.played = Date.now(); saveLibrary();
        return send(rom.file, st.size, POLICY.gba, 'application/octet-stream');
      }
      const f = inside(path.join(ROOT, 'src', 'games', 'gba'), rel);
      return f ? send(f.file, f.size, POLICY.gba) : refuse(404, 'Not found');
    }
    if (host.startsWith('b-')) {
      const g = GAMES.find(x => 'b-' + x.id === host);
      if (!g) return refuse(404, 'Not found');
      // its own files, or those of what it shares with other games: the ones listed and no others
      const dir = g.files.some(f => f.path === rel) ? builtinDir(g) : (s => s && sharedDir(s))(sharedOf(g).find(s => s.files.some(f => f.path === rel)));
      const f = dir && inside(dir, rel);
      return f ? send(f.file, f.size, POLICY.builtin) : refuse(404, 'Not found');
    }
    if (host.startsWith('u-')) {
      const g = (mine.folder === library().folder ? mine.list : scanMine()).find(x => 'u-' + x.id === host);
      if (!g) return refuse(404, 'Not found');
      const f = inside(g.dir, rel);
      return f ? send(f.file, f.size, POLICY.mine) : refuse(404, 'Not found');
    }
    return refuse(404, 'Not found');
  } catch (e) {
    console.error('[bmgame] failed to serve:', e);
    return refuse(500, 'Error');
  }
}

function register(ipcMain) {
  const dialogs = require('./dialogs');
  ipcMain.handle('games:list', () => state());
  ipcMain.handle('games:get', async (_, id) => {
    const g = GAMES.find(x => x.id === id);
    if (!g) return { error: 'there is no such game' };
    for (const s of sharedOf(g)) { const r = await fetchItem(s, s.id + '/' + s.version, sharedDir(s)); if (r.error) return r; }
    return fetchItem(g, g.id + '/' + g.version, builtinDir(g));
  });
  ipcMain.handle('games:remove', async (_, id) => {
    const g = GAMES.find(x => x.id === id);
    if (!g) return { error: 'there is no such game' };
    try {
      await fs.promises.rm(path.join(home(), 'builtin', g.id), { recursive: true, force: true });
      // what it shared goes with the last game that used it
      for (const s of sharedOf(g)) if (!GAMES.some(x => x !== g && sharedOf(x).includes(s) && installed(builtinDir(x), x))) await fs.promises.rm(path.join(home(), 'shared', s.id), { recursive: true, force: true });
      return { ok: true };
    }
    catch (e) { return { error: String(e.message || e) }; }
  });
  ipcMain.handle('games:core', () => fetchItem(CATALOG.core, 'cores/' + CATALOG.core.id + '/' + CATALOG.core.version, coreDir()));
  ipcMain.handle('games:removeCore', async () => {
    try { await fs.promises.rm(path.join(home(), 'cores'), { recursive: true, force: true }); return { ok: true }; }
    catch (e) { return { error: String(e.message || e) }; }
  });
  // Your own GBA games: the files stay where they are, the list keeps where that is.
  ipcMain.handle('games:addRoms', async () => {
    await dialogs.focusWin();
    const r = await dialogs.openDialog({ title: 'Add GBA games', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Game Boy Advance games', extensions: ['gba'] }] });
    if (r.canceled) return { added: 0 };
    const l = library(); let added = 0;
    for (const file of r.filePaths) {
      if (!ROM.test(file) || l.roms.some(x => x.file === file)) continue;
      l.roms.push({ id: idOf(file), file, name: path.basename(file, path.extname(file)).slice(0, 120), added: Date.now(), played: 0 });
      added++;
    }
    if (added) saveLibrary();
    return { added };
  });
  ipcMain.handle('games:removeRom', (_, id) => {
    const l = library(), n = l.roms.length;
    l.roms = l.roms.filter(r => r.id !== id);
    if (l.roms.length !== n) saveLibrary();
    return { ok: true };
  });
  ipcMain.handle('games:pickFolder', async () => {
    await dialogs.focusWin();
    const r = await dialogs.openDialog({ title: 'The folder with your HTML games', properties: ['openDirectory'] });
    if (r.canceled) return { folder: library().folder };
    library().folder = r.filePaths[0]; saveLibrary();
    return { folder: library().folder };
  });
  ipcMain.handle('games:clearFolder', () => { library().folder = null; saveLibrary(); scanMine(); return { ok: true }; });
}

module.exports = { register, serve, _test: { inside, state, POLICY, forget: () => { lib = null; mine = { folder: null, list: [] }; } } };
