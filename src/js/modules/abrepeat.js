/**
 * BM Player — A-B Repeat Controller (v1.7.0)
 *
 * Lets the user mark two points in the current file (A and B) and have
 * playback automatically loop the segment between them. Designed to be
 * a small, stateless wrapper around mpv's seek + a per-frame tick
 * listener on time-pos.
 *
 * States:
 *   idle     — no A or B set, looping disabled
 *   a-set    — A is set, awaiting B
 *   armed    — both A and B set, loop active (seeks back to A at B)
 *   paused   — both points remembered but loop disabled (toggle on/off)
 *
 * Keys (default):
 *   B        — set / clear A point    (cycles to A-set if idle, then to armed when B exists)
 *   N        — set B point            (only valid after A is set)
 *   C        — clear A-B loop entirely
 *   G        — toggle pause/resume of an existing loop without clearing it
 */

class ABRepeat {
  constructor({ mpvApi, osd }) {
    this._mpv   = mpvApi;     // () => window.api.mpv  (lazy getter)
    this._osd   = osd;        // (msg, ms) => void
    this.aTime  = null;
    this.bTime  = null;
    this.paused = false;      // remembered loop disabled (toggle)
    this._tickHandler = null;
  }

  _api() { return typeof this._mpv === 'function' ? this._mpv() : this._mpv; }
  _show(msg, ms = 1400) { try { this._osd?.(msg, ms); } catch (_) {} }

  /** Set A point at the given time (or fetch current time if omitted). */
  async setA(t) {
    if (t == null) t = await this._api()?.cmd('get_property', 'time-pos').catch(() => null);
    if (t == null) return;
    this.aTime = t;
    // If B is set and now precedes A, swap them.
    if (this.bTime != null && this.bTime < this.aTime) { [this.aTime, this.bTime] = [this.bTime, this.aTime]; }
    this._show(`A set: ${fmtSec(this.aTime)}`);
    this._emit();
  }

  async setB(t) {
    if (this.aTime == null) { this._show('Set A first (B)'); return; }
    if (t == null) t = await this._api()?.cmd('get_property', 'time-pos').catch(() => null);
    if (t == null) return;
    this.bTime = t;
    if (this.bTime < this.aTime) { [this.aTime, this.bTime] = [this.bTime, this.aTime]; }
    this._show(`B set: ${fmtSec(this.bTime)} — loop armed`);
    this.paused = false;
    this._emit();
  }

  clear() {
    this.aTime = null;
    this.bTime = null;
    this.paused = false;
    this._show('A-B loop cleared');
    this._emit();
  }

  togglePause() {
    if (this.aTime == null || this.bTime == null) { this._show('No A-B loop to toggle'); return; }
    this.paused = !this.paused;
    this._show(this.paused ? 'A-B loop: paused' : 'A-B loop: resumed');
    this._emit();
  }

  /** Returns true if the loop is currently active (armed AND not paused). */
  isActive() { return !this.paused && this.aTime != null && this.bTime != null; }

  /** Called on every time-pos property change from mpv. */
  onTimePos(currentTime) {
    if (!this.isActive()) return;
    if (currentTime == null) return;
    // Loop end: when we cross B, jump back to A.
    if (currentTime >= this.bTime) {
      this._api()?.cmd('seek', String(this.aTime), 'absolute')?.catch(() => {});
    }
    // Safety: if the user seeks BEFORE A while armed, snap to A so we don't drift out of the loop.
    else if (currentTime < this.aTime - 0.5) {
      this._api()?.cmd('seek', String(this.aTime), 'absolute')?.catch(() => {});
    }
  }

  _emit() {
    try { window.dispatchEvent(new CustomEvent('bm:abrepeat', { detail: this.snapshot() })); } catch (_) {}
  }

  snapshot() {
    return { a: this.aTime, b: this.bTime, paused: this.paused, active: this.isActive() };
  }
}

function fmtSec(s) {
  if (!s || isNaN(s)) return '0:00';
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
           : `${m}:${String(ss).padStart(2,'0')}`;
}

export default ABRepeat;
