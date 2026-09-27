/**
 * BM Player — Performance / Quality Tiers
 *
 * One small module that decides how much visual richness (particle counts,
 * animation speed, glow) the fluid/theme effects are allowed to spend per
 * frame, and lets the user override that choice from the Fluid Settings
 * panel. Explicit design goal: stay comfortable on a ~4GB RAM machine with
 * an Intel UHD 610 (weak integrated graphics) by default, not just on
 * whatever machine happens to be doing the testing.
 *
 * Nothing here touches the DOM or Canvas directly — it just hands out
 * numbers and a way to be notified when they change.
 */

export const QUALITY_TIERS = {
  low:    { label: 'Low (weak / integrated graphics)', density: 70,  speedScale: 0.75, glow: 0.65, trail: 0.75 },
  medium: { label: 'Medium (balanced)',                 density: 180, speedScale: 1.0,  glow: 1.0,  trail: 1.0  },
  high:   { label: 'High (dedicated GPU)',               density: 340, speedScale: 1.2,  glow: 1.25, trail: 1.15 },
};

const STORAGE_KEY = 'bm_perf_quality';
const CUSTOM_KEY  = 'bm_perf_custom';

/**
 * Rough, conservative auto-detection. There is no reliable, privacy-safe
 * way to ask "what GPU is this" from a renderer process, so this uses two
 * proxies that ARE available and reasonably informative:
 *   - navigator.hardwareConcurrency (logical CPU cores)
 *   - navigator.deviceMemory (Chromium-only, approximate RAM in GB)
 * Either signal alone can mislead (e.g. a high-core low-power CPU), so the
 * more conservative of the two verdicts wins — defaulting DOWN on
 * uncertainty is the right failure mode for this app's stated priority.
 */
function autoDetectTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem   = navigator.deviceMemory || 8; // assume capable if unknown

  if (mem <= 4 || cores <= 2) return 'low';
  if (mem <= 8 || cores <= 4) return 'medium';
  return 'high';
}

class PerfSettings {
  constructor() {
    this._listeners = [];
    const saved = localStorage.getItem(STORAGE_KEY);
    this.tier = (saved && QUALITY_TIERS[saved]) ? saved : autoDetectTier();
    this._customOverrides = this._loadCustom();
  }

  _loadCustom() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || {}; }
    catch(_) { return {}; }
  }
  _saveCustom() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(this._customOverrides)); } catch(_) {}
  }

  /** Current effective params: tier base values + any per-field custom overrides. */
  getParams() {
    const base = QUALITY_TIERS[this.tier] || QUALITY_TIERS.medium;
    return { ...base, ...this._customOverrides };
  }

  setTier(tier) {
    if (!QUALITY_TIERS[tier]) return;
    this.tier = tier;
    this._customOverrides = {};   // switching preset clears manual tweaks
    localStorage.setItem(STORAGE_KEY, tier);
    this._saveCustom();
    this._notify();
  }

  /** Manual per-field tweak (density/speedScale/glow/trail), layered on top of the current tier. */
  setCustom(field, value) {
    this._customOverrides[field] = value;
    this._saveCustom();
    this._notify();
  }

  resetCustom() {
    this._customOverrides = {};
    this._saveCustom();
    this._notify();
  }

  onChange(cb) { this._listeners.push(cb); }
  _notify() { const p = this.getParams(); this._listeners.forEach(cb => { try { cb(p); } catch(_) {} }); }
}

// Single shared instance — every effect reads from the same source of truth.
export const perf = new PerfSettings();
