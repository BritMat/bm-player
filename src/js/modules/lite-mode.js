/**
 * BM Player — Lite Mode (v1.9.0)
 *
 * A single source of truth for "should this instance run in lite mode?"
 *
 * Lite mode disables GPU-heavy visual flair on machines that can't
 * comfortably sustain 60fps with the v2 effects:
 *   - WebGL fox mascot (Three.js scene running every frame)
 *   - Theme-FX v2 (curl-noise fluid sim with 120–600 particles + connections)
 *   - Music visualizer canvas
 *   - PDF viewer (pdf.js + pdf-lib are ~1MB of CDN JS)
 *   - Backdrop-filter blur (notoriously slow on Intel UHD 610 class GPUs)
 *   - Large box-shadow glows (composited every paint)
 *
 * Detection (in priority order):
 *   1. Explicit env var BM_LITE=1 from main process (set by build target
 *      or by --lite CLI flag) — always wins.
 *   2. localStorage 'bm_lite_user' — manual override from Preferences.
 *      Values: '1' force lite, '0' force full, unset = auto.
 *   3. Auto-detect from navigator.deviceMemory and hardwareConcurrency,
 *      defaulting DOWN on uncertainty.
 *
 * The detection result is cached for the session to keep isLiteMode()
 * cheap to call from per-frame render paths.
 */

const STORAGE_KEY = 'bm_lite_user';

class LiteMode {
  constructor() {
    this._listeners = new Set();
    this._envFlag = null;            // set by main via setEnvFlag()
    this._userOverride = null;      // '1' | '0' | null
    this._auto = null;              // boolean
    this._perfInfo = null;          // cached navigator perf signals
    this._cached = null;            // cached final verdict
    this._loadUserOverride();
  }

  _loadUserOverride() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === '1' || v === '0') this._userOverride = v;
    } catch (_) {}
  }

  /** Called by main process preload — sets the build-time/env flag. */
  setEnvFlag(flag) {
    // flag = 1 (force lite) | 0 (force full) | null (no env preference)
    this._envFlag = flag;
    this._cached = null;
  }

  /** Snapshots the navigator's perf signals (called once at boot). */
  detectPerfInfo() {
    if (this._perfInfo) return this._perfInfo;
    this._perfInfo = {
      deviceMemory: navigator.deviceMemory || null,         // GB (Chromium-only, approx)
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      // webgl basic capability check — returns the renderer string if any
      webglRenderer: this._probeWebGLRenderer(),
    };
    return this._perfInfo;
  }

  _probeWebGLRenderer() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return null;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return 'unknown';
      return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown';
    } catch (_) { return null; }
  }

  /**
   * Rough, conservative auto-detection. No reliable privacy-safe way to
   * ask "what GPU is this", so we use navigator signals + a small denylist
   * of known-weak GPU strings from the WebGL renderer probe.
   *
   * The verdict defaults DOWN on uncertainty — that's the right failure
   * mode for an app whose stated priority is staying comfortable on weak
   * hardware.
   */
  autoDetectLite() {
    if (this._auto != null) return this._auto;
    const info = this.detectPerfInfo();
    let lite = false;

    // Memory: <6GB → lite. (deviceMemory buckets: 0.25/0.5/1/2/4/8 — so
    // a 4GB machine reports exactly 4, an 8GB reports 8.)
    if (info.deviceMemory != null && info.deviceMemory <= 4) lite = true;

    // Cores: ≤2 → lite, ≤4 → lean toward lite but not alone
    if (info.hardwareConcurrency != null && info.hardwareConcurrency <= 2) lite = true;

    // GPU denylist: known-weak integrated graphics strings
    if (info.webglRenderer) {
      const r = info.webglRenderer.toLowerCase();
      const weakGpuPatterns = [
        'uhd 610', 'hd 610', 'hd 510',           // Intel 7th-gen lowest
        'uhd 600', 'uhd 605',                     // Apollo Lake / Gemini Lake
        'hd graphics 4000', 'hd graphics 3000',   // 3rd-gen Intel
        'mali-400', 'mali-450', 'mali-470',       // old ARM Mali
        'powervr',                                 // PowerVR anything
        'vesa',                                    // fallback VESA driver = no real GPU
        'microsoft basic render',                  // Windows fallback
        'gma ',                                    // Intel GMA series
        'geforce 210', 'geforce 310',             // pre-Fermi Nvidia
        'radeon hd 5450', 'radeon hd 4350',       // pre-Evergreen AMD
      ];
      for (const p of weakGpuPatterns) {
        if (r.includes(p)) { lite = true; break; }
      }
    }

    this._auto = lite;
    return lite;
  }

  /** The effective verdict — env > user override > auto. */
  isLiteMode() {
    if (this._cached != null) return this._cached;
    if (this._envFlag === 1) return (this._cached = true);
    if (this._envFlag === 0) return (this._cached = false);
    if (this._userOverride === '1') return (this._cached = true);
    if (this._userOverride === '0') return (this._cached = false);
    return (this._cached = this.autoDetectLite());
  }

  /** Human-readable reason for the current verdict (for the Preferences panel). */
  getReason() {
    if (this._envFlag === 1) return 'Forced by build (BM Player Lite installer)';
    if (this._envFlag === 0) return 'Forced by build (full installer)';
    if (this._userOverride === '1') return 'User preference (Lite)';
    if (this._userOverride === '0') return 'User preference (Full)';
    const info = this.detectPerfInfo();
    const reasons = [];
    if (info.deviceMemory != null && info.deviceMemory <= 4) reasons.push(`RAM ${info.deviceMemory}GB ≤ 4GB`);
    if (info.hardwareConcurrency != null && info.hardwareConcurrency <= 2) reasons.push(`${info.hardwareConcurrency} CPU cores ≤ 2`);
    if (info.webglRenderer && /uhd 610|hd 610|hd 510|uhd 600|uhd 605|gma |powervr|vesa|microsoft basic/i.test(info.webglRenderer)) {
      reasons.push(`weak GPU: ${info.webglRenderer}`);
    }
    if (this.autoDetectLite()) {
      return reasons.length ? `Auto-detected: ${reasons.join(', ')}` : 'Auto-detected (low-end hardware)';
    }
    return 'Auto-detected (capable hardware)';
  }

  /** Persist a manual override. value = true|false|null (null = auto). */
  setUserOverride(value) {
    if (value === true) this._userOverride = '1';
    else if (value === false) this._userOverride = '0';
    else this._userOverride = null;
    try {
      if (this._userOverride == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, this._userOverride);
    } catch (_) {}
    this._cached = null;
    const verdict = this.isLiteMode();
    this._emit(verdict);
    return verdict;
  }

  /** Reset just the cache (useful after perfInfo changes). */
  invalidate() {
    this._auto = null;
    this._perfInfo = null;
    this._cached = null;
  }

  onChange(cb) { this._listeners.add(cb); return () => this._listeners.delete(cb); }
  _emit(verdict) { this._listeners.forEach(cb => { try { cb(verdict, this.getReason()); } catch (_) {} }); }
}

export const liteMode = new LiteMode();
export default liteMode;
