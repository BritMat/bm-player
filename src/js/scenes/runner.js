/**
 * The scene runner (v3.47.0): one scene on one canvas, run the same way
 * whatever the scene is. The scene kit is this and kit.js.
 *
 * A scene is one file whose default export says what it is and starts it:
 *
 *   export default {
 *     id: 'crows', name: 'Crow Field',
 *     start (host) { ...; return { frame (dt, t) { ... }, resize (w, h, dpr) { ... } } },
 *   };
 *
 * start(host) is given { canvas, ctx, w, h, dpr, tier, reduced, kit, opts } and
 * gives back the running scene (opts: what run() was given for it, such as
 * Aurora Lake's colour). Of its parts only frame is needed:
 *
 *   frame(dt, t)          draw one frame. dt: the seconds since the last
 *                         frame, never more than 0.05, so a stall does not
 *                         make anything jump. t: the clock, in seconds.
 *   resize(w, h, dpr)     the view's size in CSS pixels, and the pixel ratio
 *                         the canvas is drawn at (at most 2, or the scene's
 *                         maxDpr). The canvas is w * dpr by h * dpr.
 *   pointer(kind, x, y)   'move', 'down', 'up' or 'leave', in CSS pixels
 *   beat(level)           the music, 0 (none) to 1, while something plays
 *   rest(on)              drawing stops (Home out of sight, a film playing,
 *                         nobody there) or starts again
 *   set(key, value)       one of its options changed (runner.set)
 *   stop()                the scene is put away: let go of what it holds
 *
 * host.reduced is true when the system asks for less motion: the scene
 * slows itself (the realistic scenes go at half speed, the theme ones at a
 * third). host.tier is perf.js's quality tier, for how much to draw.
 *
 * The runner keeps to the battery saver and to a window behind others
 * (power.js frameGap: 30 frames a second, else at most about 72), sizes the
 * canvas to its box and the pixel ratio, and contains a scene's errors: a
 * scene that throws is stopped and its canvas cleared, and Home goes on. It
 * counts what a scene costs (cost(): frames and milliseconds a frame), for
 * the checks and for Diagnostics.
 *
 * v3.48.0: opts.level, a function giving the music's level, is asked each
 * frame and handed to the scene's beat(). A scene may ask for fewer frames
 * than the runner allows (def.fps: a slow one looks the same at 40 a second
 * and costs half). With opts.still (Lite), a scene is
 * a still picture: one frame is drawn, and it moves only when touched, for a
 * few seconds (wake).
 */
import { frameGap } from '../power.js';
import { perf } from '../perf.js';
import * as kit from './kit.js';

export class SceneRunner {
  /**
   * canvas: where the scene draws. The rest are for the checks: the frame
   * clock (raf, caf, now) and the least time between frames (gap, in ms).
   */
  constructor (canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._raf = opts.raf || (f => requestAnimationFrame(f));
    this._caf = opts.caf || (id => cancelAnimationFrame(id));
    this._now = opts.now || (() => performance.now());
    this._gap = opts.gap || (() => frameGap('decor'));
    this._level = opts.level || null;
    this.still = !!opts.still;
    this._awake = 0;
    this.def = null; this.scene = null;
    this.running = false; this.resting = false;
    this.w = 0; this.h = 0; this.dpr = 1;
    this._stats = { frames: 0, ms: 0, errors: 0 };
    this._onResize = () => this.resize();
    try { window.addEventListener('resize', this._onResize); } catch (_) {}
    try { if (typeof ResizeObserver === 'function') { this._ro = new ResizeObserver(this._onResize); this._ro.observe(canvas); } } catch (_) { this._ro = null; }
  }

  /** Puts a scene on the canvas, the one there stopped first, and starts it drawing. False if it would not start. */
  run (def, opts = {}) {
    this.stop();
    if (!def || typeof def.start !== 'function') return false;
    this.def = def;
    this._stats = { frames: 0, ms: 0, errors: 0 };
    this._size();
    let scene;
    try {
      scene = def.start({ canvas: this.canvas, ctx: this.ctx, w: this.w, h: this.h, dpr: this.dpr, tier: perf.tier, reduced: kit.reducedMotion(), kit, opts });
      if (!scene || typeof scene.frame !== 'function') throw new Error('start() gave no frame()');
    } catch (e) { this._fail('start', e); return false; }
    this.scene = scene;
    this._last = 0;
    if (!this.resting) this._show();
    return true;
  }

  /** One of the scene's options (Aurora Lake's colour): a still is drawn again. */
  set (key, value) {
    if (!this.scene?.set) return;
    this._call('set', key, value);
    if (this.still && !this.running && !this.resting) this._stillFrame();
  }

  /** A still scene moves for a while (a touch), then stands still again. */
  wake (ms = 5000) {
    if (!this.scene || this.resting) return;
    this._awake = this._now() + ms;
    this._go();
  }

  /** The canvas's box changed: the canvas is sized again, and the scene told. */
  resize () {
    if (!this.def) return;
    // A canvas out of sight (its view hidden) has no size: the scene keeps the
    // one it had, rather than drawing itself again for a single pixel and once
    // more on the way back.
    const box = this.canvas.getBoundingClientRect?.();
    if (box && (!box.width || !box.height)) return;
    const { w, h, dpr } = this;
    this._size();
    const changed = w !== this.w || h !== this.h || dpr !== this.dpr;
    if (this.scene?.resize && changed) this._call('resize', this.w, this.h, this.dpr);
    // a still: drawn again at the new size, and once more when a scene has redrawn its layers
    if (changed && this.still && !this.running && !this.resting) { this._stillFrame(); clearTimeout(this._stillT); this._stillT = setTimeout(() => this._stillFrame(), 400); }
  }

  /**
   * Drawing stops (true) or starts again (false), and the scene is told. The
   * first frame after a rest is a normal step, not the whole time away.
   */
  rest (on) {
    on = !!on;
    if (on === this.resting) return;
    this.resting = on;
    if (on) { this.running = false; this._caf(this._id); }
    if (this.scene?.rest) this._call('rest', on);
    if (!on && this.scene) { this._last = 0; this._show(); }
  }

  /** A pointer event from the page, in window coordinates: the scene gets it in its own. */
  pointer (kind, clientX, clientY) {
    if (!this.scene) return;
    if (this.still && kind === 'down') this.wake();
    if (!this.scene.pointer) return;
    const r = this.canvas.getBoundingClientRect();
    this._call('pointer', kind, clientX - r.left, clientY - r.top);
  }

  /** The music's level, 0 to 1. */
  beat (level) {
    if (this.scene?.beat) this._call('beat', Math.max(0, Math.min(1, Number(level) || 0)));
  }

  /** Frames drawn since the scene started, and the milliseconds a frame took on average. */
  cost () {
    const s = this._stats;
    return { frames: s.frames, msPerFrame: s.frames ? s.ms / s.frames : 0, errors: s.errors };
  }

  /** The scene put away, and the canvas cleared. */
  stop () {
    this.running = false; this._caf(this._id); clearTimeout(this._stillT);
    const s = this.scene; this.scene = null; this.def = null;
    if (s?.stop) { try { s.stop(); } catch (e) { console.warn('[BM Player] a scene failed to stop:', e); } }
    this._clear();
  }

  /** The runner itself put away, with what it listens to. */
  destroy () {
    this.stop();
    try { window.removeEventListener('resize', this._onResize); } catch (_) {}
    try { this._ro?.disconnect(); } catch (_) {}
  }

  _size () {
    const r = this.canvas.getBoundingClientRect?.() || {};
    const max = this.def?.maxDpr ?? 2;
    this.dpr = Math.max(0.5, Math.min(max, globalThis.devicePixelRatio || 1));
    this.w = Math.max(1, Math.round(r.width || this.canvas.offsetWidth || 1));
    this.h = Math.max(1, Math.round(r.height || this.canvas.offsetHeight || 1));
    const cw = Math.round(this.w * this.dpr), ch = Math.round(this.h * this.dpr);
    if (this.canvas.width !== cw) this.canvas.width = cw;
    if (this.canvas.height !== ch) this.canvas.height = ch;
  }

  // Drawing, or for a still one frame of it.
  _show () { if (this.still && this._now() >= this._awake) this._stillFrame(); else this._go(); }

  _stillFrame () {
    if (!this.scene || this.running) return;
    this._caf(this._sid);
    this._sid = this._raf(() => { if (this.scene && !this.running && !this.resting) this._draw(this._now(), 1 / 60); });
  }

  _go () {
    if (this.running || !this.scene) return;
    this.running = true;
    this._id = this._raf(() => this._tick());
  }

  _tick () {
    if (!this.running) return;
    const now = this._now();
    // a still that was touched stands still again after its while
    if (this.still && now >= this._awake) { this.running = false; return; }
    this._id = this._raf(() => this._tick());
    const gap = Math.max(this._gap(), this.def?.fps ? 1000 / this.def.fps - 2 : 0);
    if (this._last && now - this._last < gap) return;
    const dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 1 / 60;
    this._last = now;
    this._draw(now, dt);
  }

  _draw (now, dt) {
    if (this._level && this.scene.beat) { let v = 0; try { v = this._level() || 0; } catch (_) {} this._call('beat', Math.max(0, Math.min(1, v))); if (!this.scene) return; }
    const t0 = this._now();
    try { this.scene.frame(dt, now / 1000); } catch (e) { this._fail('frame', e); return; }
    this._stats.frames++; this._stats.ms += this._now() - t0;
  }

  _call (what, ...args) {
    try { this.scene[what](...args); } catch (e) { this._fail(what, e); }
  }

  // A scene that throws is stopped and its canvas left clear: Home goes on.
  _fail (where, e) {
    this._stats.errors++;
    console.warn(`[BM Player] the scene ${this.def?.id || ''} stopped (${where}):`, e);
    this.running = false; this._caf(this._id);
    const s = this.scene; this.scene = null;
    try { s?.stop?.(); } catch (_) {}
    this._clear();
  }

  _clear () {
    try { this.ctx?.setTransform(1, 0, 0, 1, 0, 0); this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height); } catch (_) {}
  }
}
