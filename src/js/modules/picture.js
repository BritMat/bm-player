/**
 * Picture (v3.46.0): brightness, contrast, saturation, gamma and hue, as
 * VLC and KMPlayer have them, and zoom, moving a zoomed picture about, and
 * filling the screen by cutting the edges off. All of them are mpv's own
 * properties, applied as the picture is drawn: nothing to change in the file
 * and nothing spent while they are left at zero.
 *
 * The colours stay from film to film and from one start to the next, as a
 * screen's settings do, and so does filling the screen. Zoom and where the
 * zoomed picture sits are for the one film, and go back with the next.
 *
 *   Alt + =  and  Alt + -        zoom in and out
 *   Alt + arrows                 move the zoomed picture
 *   Alt + Backspace              the whole picture again
 */
const KEY = 'bm_picture';
export const ADJUST = [['brightness', 'Brightness'], ['contrast', 'Contrast'], ['saturation', 'Saturation'], ['gamma', 'Gamma'], ['hue', 'Hue']];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ZOOM_MIN = 50, ZOOM_MAX = 400;

export class Picture {
  /** api: window.api. osd(text): a short message on the picture. */
  constructor(api, { osd } = {}) {
    this.api = api;
    this.osd = osd || (() => {});
    this.v = Object.fromEntries(ADJUST.map(([k]) => [k, 0]));
    this.zoom = 100;          // per cent of the size the film is shown at
    this.pan = [0, 0];        // per cent: -100 to 100 either way
    this.fill = false;        // the screen filled, the edges cut (mpv's panscan)
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      for (const [k] of ADJUST) if (Number.isFinite(s[k])) this.v[k] = clamp(Math.round(s[k]), -100, 100);
      this.fill = s.fill === true;
    } catch (_) {}
  }

  _cmd(name, value) { try { this.api?.mpv?.cmd('set_property', name, value)?.catch?.(() => {}); } catch (_) {} }
  _save() { try { localStorage.setItem(KEY, JSON.stringify({ ...this.v, fill: this.fill })); } catch (_) {} }
  /** True when anything differs from the film as it is. */
  get changed() { return ADJUST.some(([k]) => this.v[k]) || this.zoom !== 100 || this.pan[0] || this.pan[1] || this.fill; }

  /** One of brightness, contrast, saturation, gamma or hue, from -100 to 100. */
  set(name, value) {
    if (!(name in this.v)) return;
    this.v[name] = clamp(Math.round(+value || 0), -100, 100);
    this._cmd(name, this.v[name]);
    this._save(); this.sync();
  }
  setZoom(pct, say) {
    this.zoom = clamp(Math.round(+pct || 100), ZOOM_MIN, ZOOM_MAX);
    if (this.zoom === 100) this.pan = [0, 0];
    this._applyView();
    if (say) this.osd(this.zoom === 100 ? 'Zoom: normal' : `Zoom: ${this.zoom}%`);
    this.sync();
  }
  zoomBy(steps) { this.setZoom(this.zoom + steps * 10, true); }
  /** Moves the zoomed picture, in per cent of the room it has to move. */
  setPan(x, y) {
    this.pan = [clamp(Math.round(+x || 0), -100, 100), clamp(Math.round(+y || 0), -100, 100)];
    this._applyView(); this.sync();
  }
  panBy(dx, dy) {
    if (this.zoom <= 100) { this.osd('Zoom in first to move the picture'); return; }
    this.setPan(this.pan[0] + dx * 10, this.pan[1] + dy * 10);
  }
  setFill(on) {
    this.fill = !!on;
    this._cmd('panscan', this.fill ? 1 : 0);
    this._save(); this.sync();
    this.osd(this.fill ? 'Filling the screen: the edges are cut' : 'The whole picture');
  }
  /** Zoom and where the picture sits back to normal, as for a new film. */
  resetView(say) {
    this.zoom = 100; this.pan = [0, 0];
    this._applyView(); this.sync();
    if (say) this.osd('Zoom: normal');
  }
  /** Everything back as the film is. */
  reset() {
    for (const [k] of ADJUST) { this.v[k] = 0; this._cmd(k, 0); }
    this.fill = false; this._cmd('panscan', 0);
    this._save(); this.resetView();
  }
  /**
   * mpv's video-zoom is a power of two, 0 being the film's own size, and its
   * pan a share of the picture's size: half of what is zoomed beyond the
   * screen is how far the picture can move either way.
   */
  _applyView() {
    const z = Math.log2(this.zoom / 100);
    this._cmd('video-zoom', +z.toFixed(4));
    const room = Math.max(0, 1 - 100 / this.zoom) / 2;
    this._cmd('video-pan-x', +(this.pan[0] / 100 * room).toFixed(4));
    this._cmd('video-pan-y', +(this.pan[1] / 100 * room).toFixed(4));
  }
  /** Everything said to mpv again: after mpv starts, or starts again. */
  applyAll() {
    for (const [k] of ADJUST) this._cmd(k, this.v[k]);
    this._cmd('panscan', this.fill ? 1 : 0);
    this._applyView();
  }
  /** A new film: its own size again, the colours kept. */
  newFile() { if (this.zoom !== 100 || this.pan[0] || this.pan[1]) this.resetView(); }

  /** The panel's sliders and buttons (index.html, #panel-picture). */
  wire(root) {
    this.root = root;
    if (!root) return;
    for (const [k] of ADJUST) {
      const s = root.querySelector(`[data-pic="${k}"]`);
      s?.addEventListener('input', () => this.set(k, s.value));
      s?.addEventListener('dblclick', () => this.set(k, 0));        // a double-click puts one back
    }
    const z = root.querySelector('[data-pic="zoom"]');
    z?.addEventListener('input', () => this.setZoom(z.value));
    z?.addEventListener('dblclick', () => this.resetView());
    const px = root.querySelector('[data-pic="pan-x"]'), py = root.querySelector('[data-pic="pan-y"]');
    px?.addEventListener('input', () => this.setPan(px.value, this.pan[1]));
    py?.addEventListener('input', () => this.setPan(this.pan[0], py.value));
    for (const b of root.querySelectorAll('[data-pic-fill]')) b.addEventListener('click', () => this.setFill(b.dataset.picFill === 'on'));
    root.querySelector('[data-pic="reset"]')?.addEventListener('click', () => { this.reset(); this.osd('Picture as the film is'); });
    this.sync();
  }
  /** The panel shows what is set. */
  sync() {
    const root = this.root; if (!root) return;
    const put = (k, val, txt) => {
      const s = root.querySelector(`[data-pic="${k}"]`); if (s && String(s.value) !== String(val)) s.value = val;
      const o = root.querySelector(`[data-pic-val="${k}"]`); if (o) o.textContent = txt;
    };
    for (const [k] of ADJUST) put(k, this.v[k], (this.v[k] > 0 ? '+' : '') + this.v[k]);
    put('zoom', this.zoom, this.zoom + '%');
    put('pan-x', this.pan[0], this.pan[0] + '%');
    put('pan-y', this.pan[1], this.pan[1] + '%');
    const canPan = this.zoom > 100;
    for (const k of ['pan-x', 'pan-y']) { const s = root.querySelector(`[data-pic="${k}"]`); if (s) s.disabled = !canPan; }
    for (const b of root.querySelectorAll('[data-pic-fill]')) b.classList.toggle('active', (b.dataset.picFill === 'on') === this.fill);
  }
}
