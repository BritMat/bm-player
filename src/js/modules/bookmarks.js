/**
 * BM Player — Bookmarks / Markers (v1.7.0)
 *
 * User-defined timestamped markers per file. Each bookmark can have an
 * optional short note. Clicking a bookmark in the side panel seeks to
 * that position. Bookmarks persist in localStorage keyed by file path,
 * so they survive across sessions.
 *
 * Default keymap (handled in app.js):
 *   Ctrl+B    — add bookmark at current position (prompt for note)
 *   Alt+B     — quick-add (no note, auto-titled "Marker #N")
 *   Ctrl+M    — toggle bookmarks panel
 */

const STORE_KEY = 'bm_bookmarks_v1';

function fileKey(path) {
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/^([a-z]):/i, (_, d) => d.toLowerCase() + ':');
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch (_) { return {}; }
}
function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (_) {}
}

class BookmarkStore {
  constructor() {
    this._store = load();
    this._listeners = new Set();
  }

  /** Returns the bookmark list for a file (newest-first, by creation time). */
  list(path) {
    const list = this._store[fileKey(path)] || [];
    return [...list].sort((a, b) => a.t - b.t); // chronological for display
  }

  /** Add a bookmark; returns the created record. */
  add(path, time, note = '') {
    if (!path || time == null) return null;
    const key = fileKey(path);
    const list = this._store[key] || [];
    const existing = list.find(b => Math.abs(b.t - time) < 1.0);
    if (existing) return existing;     // dedupe near-identical positions
    const bm = { t: time, note, created: Date.now() };
    list.push(bm);
    this._store[key] = list;
    save(this._store);
    this._emit('added', { path, bookmark: bm });
    return bm;
  }

  remove(path, time) {
    const key = fileKey(path);
    const list = this._store[key] || [];
    const idx = list.findIndex(b => Math.abs(b.t - time) < 0.1);
    if (idx === -1) return false;
    list.splice(idx, 1);
    this._store[key] = list;
    save(this._store);
    this._emit('removed', { path, time });
    return true;
  }

  clearForFile(path) {
    const key = fileKey(path);
    if (!this._store[key]) return;
    delete this._store[key];
    save(this._store);
    this._emit('cleared', { path });
  }

  /** Iterate bookmarks of all files (used by export). */
  exportAll() { return JSON.parse(JSON.stringify(this._store)); }

  importAll(obj) {
    if (!obj || typeof obj !== 'object') return;
    this._store = { ...this._store, ...obj };
    save(this._store);
    this._emit('imported', null);
  }

  onChange(cb) { this._listeners.add(cb); return () => this._listeners.delete(cb); }
  _emit(type, data) {
    this._listeners.forEach(cb => { try { cb(type, data); } catch (_) {} });
  }
}

export const bookmarks = new BookmarkStore();
export default bookmarks;
