/**
 * BM Player — Watch History & Resume Playback (v1.7.0)
 *
 * Two complementary services backed by localStorage:
 *
 *   history  — every file the user has actually started playing, with the
 *              last known position, total duration, last-played timestamp,
 *              play-count and accumulated watch-time. Used both by the
 *              "Watch History" side panel AND by the resume-prompt logic.
 *
 *   resume   — same record, different consumer: when a file is opened that
 *              has a saved position past the resumeThreshold, prompt the
 *              user with a non-blocking toast offering to continue where
 *              they left off. Clicking "Resume" seeks back; dismissing
 *              starts from zero.
 *
 * The two are intentionally co-located: every property-change tick that
 * updates history is also the source of truth resume reads. One source
 * of truth, no drift.
 */

import settings from './settings.js';

const HISTORY_KEY = 'bm_watch_history_v1';

function fileKey(path) {
  // Path normalization: forward-slash + lowercase drive letter on Windows
  // so the same file reached via different relative paths still hits the
  // same record. Hashing would be even safer, but loses debug-ability.
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/^([a-z]):/i, (_, d) => d.toLowerCase() + ':');
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch (_) { return []; }
}
function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }
  catch (_) {}
}

class HistoryStore {
  constructor() {
    this._listeners = new Set();
    this._list = loadHistory();
    this._currentPath = null;
    this._currentStartTs = 0;       // when the current playback started (for watch-time)
    this._lastTickPos = 0;
  }

  _touch(path) {
    if (!path) return null;
    const key = fileKey(path);
    let rec = this._list.find(r => r.key === key);
    if (!rec) {
      rec = { key, path, title: basename(path), lastPosition: 0, duration: 0,
              lastPlayed: 0, playCount: 0, watchSeconds: 0, kind: 'video' };
      this._list.unshift(rec);
    }
    return rec;
  }

  /** Called when mpv starts playing a new file. */
  onOpened({ path, isVideo }) {
    if (!settings.get('playback.historyEnabled')) return;
    const rec = this._touch(path);
    if (!rec) return;
    rec.lastPlayed = Date.now();
    rec.playCount = (rec.playCount || 0) + 1;
    rec.kind = isVideo ? 'video' : 'audio';
    rec.title = basename(path);
    this._currentPath = path;
    this._currentStartTs = Date.now();
    this._lastTickPos = rec.lastPosition || 0;
    this._persist();
    this._emit('opened', rec);
    return rec;
  }

  /** Called every time mpv sends a time-pos update. */
  onTimeUpdate({ timePos, duration }) {
    if (!this._currentPath || timePos == null) return;
    const rec = this._touch(this._currentPath);
    if (!rec) return;
    if (duration && duration > 0) rec.duration = duration;
    // Only persist position changes every ~3s of playback to avoid
    // spamming localStorage on every frame tick.
    if (Math.abs(timePos - this._lastTickPos) >= 3) {
      rec.lastPosition = timePos;
      this._lastTickPos = timePos;
      this._persist();
    }
  }

  /** Called when playback stops / file closes / app quits. */
  onClose({ path, timePos } = {}) {
    if (path || this._currentPath) {
      const p = path || this._currentPath;
      const rec = this._touch(p);
      if (rec && timePos != null) rec.lastPosition = timePos;
      if (rec) rec.lastPlayed = Date.now();
      // Accumulate watch-time from this session
      if (this._currentStartTs) {
        const secs = Math.floor((Date.now() - this._currentStartTs) / 1000);
        if (secs > 0 && secs < 86400) {   // sanity guard
          rec.watchSeconds = (rec.watchSeconds || 0) + secs;
        }
      }
    }
    this._currentPath = null;
    this._currentStartTs = 0;
    this._persist();
    this._emit('closed', null);
  }

  /** Returns the saved resume position for a path (or 0). */
  getResumePosition(path) {
    if (!path) return 0;
    const rec = this._list.find(r => r.key === fileKey(path));
    if (!rec) return 0;
    const threshold = settings.get('playback.resumeThreshold') || 5;
    if (!rec.lastPosition || rec.lastPosition < threshold) return 0;
    // Don't offer resume if the saved position is within 10s of the end.
    if (rec.duration && rec.lastPosition > rec.duration - 10) return 0;
    return rec.lastPosition;
  }

  list() { return [...this._list]; }

  clear() { this._list = []; saveHistory([]); this._emit('cleared', null); }

  remove(path) {
    const key = fileKey(path);
    this._list = this._list.filter(r => r.key !== key);
    this._persist();
    this._emit('removed', path);
  }

  _persist() {
    const cap = settings.get('playback.historyMaxItems') || 200;
    if (this._list.length > cap) this._list.length = cap;
    saveHistory(this._list);
  }

  onChange(cb) { this._listeners.add(cb); return () => this._listeners.delete(cb); }
  _emit(type, data) { this._listeners.forEach(cb => { try { cb(type, data, this._list); } catch (_) {} }); }
}

function basename(p) {
  if (!p) return '';
  const clean = p.replace(/\\/g, '/').split('/').pop() || p;
  return clean.replace(/\.[^.]+$/, '');
}

export const history = new HistoryStore();
export default history;
