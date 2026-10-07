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

// v3.36.0: only what the user chose in Fluid Settings is kept, under a new
// key. Until v3.35.0 Lite mode wrote 'low' under the old key, for good, so
// one press of the Pro/Lite switch left the app on Low even back in Pro:
// the fluid at 256 pixels and 30 frames a second on a machine that could do
// far more. Found in a real machine's diagnostics ("perf tier low" on an i7).
const STORAGE_KEY = 'bm_perf_quality_user';
const LEGACY_KEY  = 'bm_perf_quality';
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
export function autoDetectTier(cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8, exact = false) {
  if (mem <= 4 || cores <= 2) return 'low';
  // navigator.deviceMemory never says more than 8, so from the page "8" means
  // 8 GB or more, and "mem <= 8" made High unreachable on any machine
  // (v3.36.0). Only the main process's real figure (exact) can say "just 8".
  if (cores <= 4 || (exact && mem <= 8)) return 'medium';
  return 'high';
}

class PerfSettings {
  constructor() {
    this._listeners = [];
    this.chosen = false;      // the user picked this tier in Fluid Settings
    this._session = null;     // a tier for this run only, never saved (Lite mode)
    this.refreshMs = 0;       // the time between two refreshes of the screen, 0 while not known (setRefresh)
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
      // The old key: 'medium' and 'high' can only have been the user's choice
      // and are kept. 'low' cannot be told from Lite mode's, and is dropped.
      const old = localStorage.getItem(LEGACY_KEY);
      if (old !== null) {
        if (!saved && (old === 'medium' || old === 'high')) { saved = old; localStorage.setItem(STORAGE_KEY, old); }
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch (_) {}
    if (saved && QUALITY_TIERS[saved]) { this._base = saved; this.chosen = true; }
    else this._base = autoDetectTier();
    this._customOverrides = this._loadCustom();
  }

  /** The tier in effect: this run's (Lite mode), else the user's or the detected one. */
  get tier() { return this._session || this._base; }

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

  /** The user's choice, from Fluid Settings: kept. */
  setTier(tier) {
    if (!QUALITY_TIERS[tier]) return;
    this._base = tier; this.chosen = true;
    this._customOverrides = {};   // switching preset clears manual tweaks
    try { localStorage.setItem(STORAGE_KEY, tier); } catch (_) {}
    this._saveCustom();
    this._notify();
  }

  /** A tier for this run only, never saved: Lite mode's 'low'. null lifts it. */
  setSessionTier(tier) {
    const was = this.tier;
    this._session = QUALITY_TIERS[tier] ? tier : null;
    if (this.tier !== was) this._notify();
  }

  /** The main process knows the real RAM and core count: detect again, unless the user chose. */
  refine({ cores, memGB } = {}) {
    if (this.chosen || !cores || !memGB) return;
    const t = autoDetectTier(cores, memGB, true);
    if (t === this._base) return;
    const was = this.tier; this._base = t;
    if (this.tier !== was) this._notify();
  }

  /**
   * The screen's refresh rate in Hz, from the main process (the page cannot
   * ask). What steps quality down when frames are slow (the fluid, MilkDrop)
   * must not take a slow screen for a slow machine: on a 30 Hz one, frames come
   * 33 ms apart whatever draws them. Anything that is not a plausible rate
   * means "not known".
   */
  setRefresh(hz) { this.refreshMs = (hz >= 20 && hz <= 1000) ? 1000 / hz : 0; }

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
