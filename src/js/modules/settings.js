/**
 * BM Player — centralized Settings module (v1.7.0)
 *
 * Goal: a single source of truth for user-tunable preferences, with a
 * tiny pub/sub so feature modules can react to changes without each
 * rolling its own localStorage read/write. Persists under one
 * namespaced key so the whole preference set can be exported / reset /
 * migrated as one unit.
 *
 * Schema is intentionally flat and additive — new keys default to a
 * sane value and merge over stored state on load, so older saved
 * settings stay forward-compatible.
 */

const STORAGE_KEY = 'bm_settings_v1';

const DEFAULTS = Object.freeze({
  // ── Playback ───────────────────────────────────────────────
  playback: {
    resumePrompt:        true,   // ask "resume from where you left off?"
    resumeThreshold:     5,     // ignore positions shorter than N seconds
    resumeRewindSec:     3,     // rewind N seconds when resuming (safety)
    defaultSpeed:        1,
    defaultVolume:       100,
    rememberVolume:      true,
    historyEnabled:      true,
    historyMaxItems:     200,
  },

  // ── Subtitles ──────────────────────────────────────────────
  subtitles: {
    fontFamily:          'Segoe UI',
    fontSize:            44,
    bold:                true,
    color:               '#FFFFFF',
    outlineSize:         3,
    shadowOffset:        2,
    position:            100,        // 50 (top) … 150 (below bottom)
    autoLoadExternal:    true,       // mpv's --sub-auto=fuzzy
    secondaryColor:      '#FFD700',  // not currently used by mpv but exposed for plugins
  },

  // ── Behaviour ──────────────────────────────────────────────
  behaviour: {
    alwaysOnTop:         false,
    hideControlsDelayMs: 3000,
    seekSmallSec:        5,
    seekLargeSec:        30,
    volumeStep:          5,
  },
});

// Deep-clone the defaults so callers never accidentally mutate them.
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

class Settings {
  constructor() {
    this._listeners = new Set();
    this._state = this._load();
    // Apply persisted playback defaults that mpv needs immediately.
    this._applyToMpvInitial();
  }

  _load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (_) { saved = {}; }
    // Merge so newly-added keys in DEFAULTS still apply to older saved state.
    return this._merge(deepClone(DEFAULTS), saved);
  }

  _merge(base, override) {
    for (const k of Object.keys(override || {})) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
          && override[k] && typeof override[k] === 'object') {
        base[k] = this._merge(base[k], override[k]);
      } else {
        base[k] = override[k];
      }
    }
    return base;
  }

  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state)); }
    catch (_) {}
  }

  _applyToMpvInitial() {
    // No mpv yet at construction time — these get applied lazily via
    // applyToMpv() once the renderer learns mpv is ready.
  }

  /** Apply subtitle styling settings to the currently-running mpv instance. */
  applyToMpv(mpvApi) {
    if (!mpvApi) return;
    const s = this._state.subtitles;
    const promises = [
      mpvApi.cmd('set_property', 'sub-font', s.fontFamily),
      mpvApi.cmd('set_property', 'sub-font-size', s.fontSize),
      mpvApi.cmd('set_property', 'sub-bold', s.bold ? 'yes' : 'no'),
      mpvApi.cmd('set_property', 'sub-color', hexToMpvRgba(s.color)),
      mpvApi.cmd('set_property', 'sub-border-size', s.outlineSize),
      mpvApi.cmd('set_property', 'sub-shadow-offset', s.shadowOffset),
      mpvApi.cmd('set_property', 'sub-pos', s.position),
    ];
    promises.forEach(p => p?.catch?.(() => {})); // mpv may not be ready yet
  }

  get(path) {
    // path = 'playback.resumeThreshold'
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this._state);
  }

  set(path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((o, k) => (o[k] = o[k] || {}), this._state);
    target[last] = value;
    this._save();
    this._emit(path, value);
  }

  /** Reset a whole section, or all of it if no path given. */
  reset(path) {
    if (!path) {
      this._state = deepClone(DEFAULTS);
    } else {
      const parts = path.split('.');
      const last = parts.pop();
      const target = parts.reduce((o, k) => o[k], this._state);
      const defTarget = parts.reduce((o, k) => o[k], DEFAULTS);
      target[last] = deepClone(defTarget[last]);
    }
    this._save();
    this._emit('*', null);
  }

  exportAll() { return deepClone(this._state); }

  importAll(obj) {
    if (!obj || typeof obj !== 'object') return;
    this._state = this._merge(deepClone(DEFAULTS), obj);
    this._save();
    this._emit('*', null);
  }

  onChange(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _emit(path, value) {
    this._listeners.forEach(cb => {
      try { cb(path, value); } catch (_) {}
    });
  }
}

// mpv expects color as "R/G/B/A" floats in 0..1, not hex.
function hexToMpvRgba(hex) {
  if (!hex || !hex.startsWith('#')) return '1.0/1.0/1.0/1.0';
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)}/${g.toFixed(3)}/${b.toFixed(3)}/1.0`;
}

export const settings = new Settings();
export default settings;
