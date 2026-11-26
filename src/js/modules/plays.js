/**
 * How often each song was played (v3.59.0, the plan's 3.58), for the smart
 * lists in the music view: Most played, Recently added and Never played.
 *
 * A song counts as played once half of it has been heard, or four minutes
 * of a long one, the rule most music services use: a song skipped after ten
 * seconds was not played. Seeking ahead does not count as hearing. Kept in
 * localStorage by path, with when it was last played, at most 6000 songs
 * (the ones played longest ago go first).
 */
const KEY = 'bm_music_plays', MAX = 6000;
export const SMART = [['most', 'Most played'], ['recent', 'Recently added'], ['never', 'Never played']];
const LIST_MAX = 100;

export class Plays {
  constructor () {
    try { this.map = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { this.map = {}; }
    this._cur = null;
  }
  count (path) { return this.map[path]?.n || 0; }
  /** A song started: what is heard of it from here is added up. */
  start (path) { this._cur = path ? { path, heard: 0, last: null, done: false } : null; }
  /** The playing song's time: only time that runs on, not a jump, is heard. */
  time (path, t, dur) {
    const c = this._cur;
    if (!c || c.path !== path || c.done || !Number.isFinite(t)) return false;
    if (c.last != null) { const d = t - c.last; if (d > 0 && d < 2) c.heard += d; }
    c.last = t;
    if (dur > 0 && (c.heard >= dur / 2 || c.heard >= 240)) { c.done = true; this.add(path); return true; }
    return false;
  }
  add (path) {
    const r = this.map[path] || { n: 0 };
    r.n++; r.at = Date.now();
    delete this.map[path]; this.map[path] = r;   // most recent last, for trimming
    const keys = Object.keys(this.map);
    if (keys.length > MAX) {
      keys.sort((a, b) => (this.map[a].at || 0) - (this.map[b].at || 0));
      for (const k of keys.slice(0, keys.length - MAX)) delete this.map[k];
    }
    try { localStorage.setItem(KEY, JSON.stringify(this.map)); } catch (_) {}
  }
  /**
   * A smart list from all the songs, in its own order:
   *   most    played at least once, the most first (the last played first among equals), 100 at most
   *   recent  the newest files first (when each came into its folder, else its date), 100 at most
   *   never   never played, in the order given
   */
  list (kind, tracks) {
    const t = [...(tracks || [])];
    if (kind === 'most') return t.filter(x => this.count(x.path) > 0).sort((a, b) => (this.count(b.path) - this.count(a.path)) || ((this.map[b.path].at || 0) - (this.map[a.path].at || 0))).slice(0, LIST_MAX);
    if (kind === 'recent') return t.sort((a, b) => ((b.added || b.mtime || 0) - (a.added || a.mtime || 0))).slice(0, LIST_MAX);
    if (kind === 'never') return t.filter(x => !this.count(x.path));
    return t;
  }
}
