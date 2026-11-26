/**
 * The equalizer as a curve (v3.59.0, the plan's 3.58): what the fifteen
 * bands do together, drawn over the music's spectrum as it plays.
 *
 *   - the curve is the bands' real response (sound-chain.js eqResponse),
 *     the same filters both players use, so a bump drawn here is what is
 *     heard, overlaps between bands included
 *   - behind it, the song's spectrum, live, when the in-app engine plays
 *     (a film's sound is mpv's, which the page cannot see: the curve alone)
 *   - drag a band's dot up or down; or draw across the picture, and the
 *     bands under the line follow it; a double click puts a band back at 0;
 *     the wheel over a dot moves it by half a decibel
 *
 * The sliders stay beside it, for the keyboard. It draws only while it is
 * on screen and something changes, or the music plays under it.
 */
import { EQ_FREQUENCIES, eqResponse } from './sound-chain.js';

const F0 = 20, F1 = 20000, TOP = 15;
const xOf = (f, w) => (Math.log(f / F0) / Math.log(F1 / F0)) * w;
const fOf = (x, w) => F0 * Math.pow(F1 / F0, x / w);

export class EqCurve {
  constructor (canvas, { gains = [], analyser = () => null, onChange = () => {}, shown = null } = {}) {
    this.cv = canvas; this.g = gains.slice(); this.analyser = analyser; this.onChange = onChange;
    this.shown = shown || (() => !!(canvas?.isConnected && canvas.offsetParent));
    this._raf = 0; this._drag = null; this._bins = null;
    if (!canvas) return;
    canvas.addEventListener('pointerdown', e => this._down(e));
    canvas.addEventListener('pointermove', e => this._move(e));
    for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, e => { this._drag = null; try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} });
    canvas.addEventListener('dblclick', e => { const i = this._near(e); if (i >= 0) this._setBand(i, 0, true); });
    canvas.addEventListener('wheel', e => { const i = this._near(e); if (i < 0) return; e.preventDefault(); this._setBand(i, this.g[i] + (e.deltaY < 0 ? 0.5 : -0.5), true); }, { passive: false });
    this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.draw()) : null;
    this._ro?.observe(canvas);
  }
  set (gains) { this.g = gains.slice(); this.draw(); }
  /** Live while shown and the music plays; one picture otherwise. */
  start () { if (this._raf) return; const tick = () => { this.draw(); this._raf = this._live() ? requestAnimationFrame(tick) : 0; }; tick(); }
  stop () { cancelAnimationFrame(this._raf); this._raf = 0; }
  _live () { return !!(this.shown() && this.analyser()); }

  _size () {
    const c = this.cv, r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return { w, h, d };
  }
  _y (db, h) { return h / 2 - (db / TOP) * (h / 2 - 6); }
  _db (y, h) { return Math.max(-12, Math.min(12, Math.round(((h / 2 - y) / (h / 2 - 6)) * TOP * 2) / 2)); }
  _pt (e) { const r = this.cv.getBoundingClientRect(), { w, h } = this._size(); return { x: (e.clientX - r.left) / r.width * w, y: (e.clientY - r.top) / r.height * h, w, h }; }
  _near (e) {
    const { x, w, d } = { ...this._pt(e), d: this._size().d };
    let best = -1, bd = 14 * d;
    EQ_FREQUENCIES.forEach((f, i) => { const dx = Math.abs(xOf(f, w) - x); if (dx < bd) { bd = dx; best = i; } });
    return best;
  }
  _nearest (x, w) { let best = 0, bd = Infinity; EQ_FREQUENCIES.forEach((f, i) => { const dx = Math.abs(xOf(f, w) - x); if (dx < bd) { bd = dx; best = i; } }); return best; }
  _setBand (i, db, done) {
    db = Math.max(-12, Math.min(12, Math.round(db * 2) / 2));
    if (this.g[i] === db) return;
    this.g[i] = db; this.draw(); this.onChange(this.g.slice(), done);
  }
  _down (e) {
    if (e.button !== 0) return;
    const p = this._pt(e), i = this._near(e);
    try { this.cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (i >= 0 && Math.abs(this._y(this.g[i], p.h) - p.y) < 20 * this._size().d) this._drag = { band: i };
    else { this._drag = { draw: true, last: this._nearest(p.x, p.w) }; this._setBand(this._drag.last, this._db(p.y, p.h)); }
  }
  _move (e) {
    const d = this._drag; if (!d) return;
    const p = this._pt(e);
    if (d.band != null) { this._setBand(d.band, this._db(p.y, p.h)); return; }
    // drawing: the bands from the last one touched to this one take the line between
    const i = this._nearest(p.x, p.w), db = this._db(p.y, p.h), was = this.g[d.last];
    const lo = Math.min(i, d.last), hi = Math.max(i, d.last);
    for (let k = lo; k <= hi; k++) { const t = hi === lo ? 1 : (k - d.last) / (i - d.last); this.g[k] = Math.round((was + (db - was) * t) * 2) / 2; }
    d.last = i; this.draw(); this.onChange(this.g.slice(), false);
  }

  draw () {
    const c = this.cv; if (!c || !c.isConnected) return;
    const { w, h, d } = this._size(), g = c.getContext('2d');
    const css = getComputedStyle(c), accent = css.getPropertyValue('--accent').trim() || '#7c6cff', muted = css.getPropertyValue('--text-muted').trim() || '#888';
    g.clearRect(0, 0, w, h);
    // the grid: 0, ±6 and ±12 dB; 100 Hz, 1 kHz, 10 kHz
    g.strokeStyle = muted; g.globalAlpha = 0.25; g.lineWidth = d;
    for (const db of [-12, -6, 0, 6, 12]) { const y = this._y(db, h); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (const f of [100, 1000, 10000]) { const x = xOf(f, w); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.globalAlpha = 0.6; g.fillStyle = muted; g.font = `${10 * d}px system-ui, sans-serif`;
    g.fillText('100', xOf(100, w) + 3 * d, h - 4 * d); g.fillText('1k', xOf(1000, w) + 3 * d, h - 4 * d); g.fillText('10k', xOf(10000, w) + 3 * d, h - 4 * d);
    // the music's spectrum, when the engine plays
    const a = this.analyser();
    if (a) {
      const n = a.frequencyBinCount; if (!this._bins || this._bins.length !== n) this._bins = new Uint8Array(n);
      a.getByteFrequencyData(this._bins);
      const rate = a.context?.sampleRate || 48000;
      g.globalAlpha = 0.28; g.fillStyle = accent; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 2 * d) { const k = Math.min(n - 1, Math.round(fOf(x, w) / (rate / 2) * n)); g.lineTo(x, h - (this._bins[k] / 255) * h * 0.9); }
      g.lineTo(w, h); g.closePath(); g.fill();
    }
    // the curve the bands make together
    g.globalAlpha = 1; g.strokeStyle = accent; g.lineWidth = 2 * d; g.beginPath();
    for (let x = 0; x <= w; x += 2 * d) { const y = this._y(Math.max(-TOP, Math.min(TOP, eqResponse(this.g, fOf(x, w)))), h); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    // a dot for each band
    EQ_FREQUENCIES.forEach((f, i) => {
      const x = xOf(f, w), y = this._y(this.g[i] || 0, h);
      g.beginPath(); g.arc(x, y, 4.5 * d, 0, Math.PI * 2); g.fillStyle = this.g[i] ? accent : muted; g.fill();
      g.lineWidth = 1.5 * d; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.stroke();
    });
  }
  destroy () { this.stop(); this._ro?.disconnect(); }
}
