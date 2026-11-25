/**
 * Picture quality (v3.59.0, the plan's 3.56): how mpv draws the picture,
 * tuned to the machine, as a dedicated player does it.
 *
 * Three presets from mpv's own scalers:
 *
 *   fast       bilinear scaling and nothing more. For a weak graphics chip,
 *              or a laptop on its battery.
 *   balanced   spline36 to enlarge, mitchell to shrink, the colour planes by
 *              spline36, and dither to the screen's depth. Sharp, and cheap
 *              on any graphics card from the last ten years.
 *   high       ewa_lanczossharp to enlarge (Jinc, the sharpest of mpv's
 *              built-in scalers without ringing), shrinking in linear light
 *              with the picture's size corrected first, sigmoid enlarging,
 *              and debanding, which smooths the steps a stream's
 *              compression leaves in skies and shadows.
 *
 * Auto picks fast where the app runs in Lite (lite-mode.js decides that
 * from the machine), and balanced elsewhere: high is chosen by hand, as it
 * asks a real graphics card for room.
 *
 * Smooth motion: each frame is timed to the screen's refresh rather than to
 * the sound (video-sync=display-resample, the sound stretched by a hair to
 * keep up), and a frame that falls between two refreshes is blended
 * (interpolation, tscale=oversample, which only blends at the edges of a
 * frame, so the picture stays sharp). A 24 frames a second pan on a 60 Hz
 * screen stops juddering. Off by default: it costs some graphics work.
 *
 * HDR films on an ordinary screen: mpv tone maps them by itself (auto). The
 * two others choose how: natural is BT.2390, the broadcast standard's curve,
 * with the brightness measured scene by scene (hdr-compute-peak), so a dark
 * film stays dark and a bright one keeps its highlights. bright is the
 * spline curve, which lifts the middle and looks livelier on a dim laptop
 * screen. Both keep the colours inside what the screen can show
 * (gamut-mapping-mode=perceptual).
 *
 * Everything is mpv's own options, set while mpv runs. A video output that
 * does not have them (direct3d, Windows' last resort) ignores them, and the
 * refusal is caught. Nothing is spent on a setting that is left at auto.
 */
const KEY = 'bm_quality';

export const PRESETS = {
  fast: {
    scale: 'bilinear', cscale: 'bilinear', dscale: 'bilinear',
    deband: 'no', 'sigmoid-upscaling': 'no', 'linear-downscaling': 'no', 'correct-downscaling': 'no',
  },
  balanced: {
    scale: 'spline36', cscale: 'spline36', dscale: 'mitchell',
    deband: 'no', 'sigmoid-upscaling': 'yes', 'linear-downscaling': 'yes', 'correct-downscaling': 'yes',
    'dither-depth': 'auto',
  },
  high: {
    scale: 'ewa_lanczossharp', cscale: 'ewa_lanczossharp', dscale: 'mitchell',
    deband: 'yes', 'deband-iterations': 2, 'deband-threshold': 35,
    'sigmoid-upscaling': 'yes', 'linear-downscaling': 'yes', 'correct-downscaling': 'yes',
    'dither-depth': 'auto',
  },
};
export const PRESET_NAMES = [['auto', 'Auto'], ['fast', 'Fast'], ['balanced', 'Balanced'], ['high', 'High']];

const MOTION_ON = { 'video-sync': 'display-resample', interpolation: 'yes', tscale: 'oversample' };
const MOTION_OFF = { 'video-sync': 'audio', interpolation: 'no' };

export const HDR = {
  auto: { 'tone-mapping': 'auto', 'hdr-compute-peak': 'auto', 'gamut-mapping-mode': 'auto' },
  natural: { 'tone-mapping': 'bt.2390', 'hdr-compute-peak': 'yes', 'gamut-mapping-mode': 'perceptual' },
  bright: { 'tone-mapping': 'spline', 'hdr-compute-peak': 'yes', 'gamut-mapping-mode': 'perceptual' },
};
export const HDR_NAMES = [['auto', 'Auto'], ['natural', 'Natural'], ['bright', 'Bright']];

export class Quality {
  /**
   * mpv(): window.api.mpv, when it is there. lite(): true where the app runs
   * in Lite. osd(text): a short message on the picture.
   */
  constructor ({ mpv, lite, osd } = {}) {
    this.mpv = mpv || (() => null);
    this.lite = lite || (() => false);
    this.osd = osd || (() => {});
    this.preset = 'auto'; this.motion = false; this.hdr = 'auto';
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (PRESET_NAMES.some(([k]) => k === s.preset)) this.preset = s.preset;
      this.motion = s.motion === true;
      if (s.hdr in HDR) this.hdr = s.hdr;
    } catch (_) {}
  }

  /** The preset that is drawn: auto made into one of the three. */
  get used () { return this.preset === 'auto' ? (this.lite() ? 'fast' : 'balanced') : this.preset; }

  /** Every option mpv is given for what is chosen, in the order it is given. */
  options () {
    return { ...PRESETS[this.used], ...(this.motion ? MOTION_ON : MOTION_OFF), ...HDR[this.hdr] };
  }

  _set (name, value) {
    try { this.mpv()?.cmd('set_property', name, value)?.catch?.(() => {}); } catch (_) {}
  }
  _save () { try { localStorage.setItem(KEY, JSON.stringify({ preset: this.preset, motion: this.motion, hdr: this.hdr })); } catch (_) {} }

  /** Everything said to mpv again: after mpv starts, or starts again. */
  applyAll () { for (const [k, v] of Object.entries(this.options())) this._set(k, v); }

  setPreset (p, say) {
    if (!PRESET_NAMES.some(([k]) => k === p)) return;
    this.preset = p; this._save(); this.applyAll(); this.sync();
    if (say) this.osd('Picture quality: ' + PRESET_NAMES.find(([k]) => k === p)[1] + (p === 'auto' ? ' (' + this.used + ')' : ''));
  }
  setMotion (on, say) {
    this.motion = !!on; this._save();
    for (const [k, v] of Object.entries(this.motion ? MOTION_ON : MOTION_OFF)) this._set(k, v);
    this.sync();
    if (say) this.osd(this.motion ? 'Smooth motion on' : 'Smooth motion off');
  }
  setHdr (h, say) {
    if (!(h in HDR)) return;
    this.hdr = h; this._save();
    for (const [k, v] of Object.entries(HDR[h])) this._set(k, v);
    this.sync();
    if (say) this.osd('HDR films: ' + HDR_NAMES.find(([k]) => k === h)[1]);
  }

  /** The picture panel's buttons (index.html, #panel-picture). */
  wire (root) {
    this.root = root;
    if (!root) return;
    for (const b of root.querySelectorAll('[data-q-preset]')) b.addEventListener('click', () => this.setPreset(b.dataset.qPreset, true));
    for (const b of root.querySelectorAll('[data-q-hdr]')) b.addEventListener('click', () => this.setHdr(b.dataset.qHdr, true));
    root.querySelector('[data-q-motion]')?.addEventListener('change', e => this.setMotion(e.target.checked, true));
    this.sync();
  }
  sync () {
    const root = this.root; if (!root) return;
    for (const b of root.querySelectorAll('[data-q-preset]')) b.classList.toggle('active', b.dataset.qPreset === this.preset);
    for (const b of root.querySelectorAll('[data-q-hdr]')) b.classList.toggle('active', b.dataset.qHdr === this.hdr);
    const m = root.querySelector('[data-q-motion]'); if (m) m.checked = this.motion;
    const u = root.querySelector('[data-q-used]');
    if (u) u.textContent = this.preset === 'auto' ? `Auto draws this machine's picture as ${this.used === 'fast' ? 'Fast' : 'Balanced'}.` : '';
  }
}
