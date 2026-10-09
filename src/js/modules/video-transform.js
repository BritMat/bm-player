/**
 * BM Player: turning and mirroring the picture (v3.38.0).
 *
 * Both are mpv's. Turning is its video-rotate, done where the picture is
 * drawn, on the graphics card, with nothing extra decoded: 0, 90, 180 or 270
 * degrees, added to whatever turn the file itself asks for (a phone's
 * video stood on its side). Mirroring is mpv's hflip filter, under a label
 * of its own (@bmmirror) so it is added and taken away without touching any
 * other filter. With the graphics card decoding, mpv copies each picture
 * back to run the filter: a little more work, and only while it is on.
 *
 * Paused, mpv goes on showing the picture it has: a turn or a mirror made
 * then showed only once the film played on. So when paused, a seek to the
 * very place it is (to the frame) has the picture drawn again, changed.
 *
 * Both are for the file that is open: a new file starts straight, as a
 * phone video turned the right way is no reason to turn the next one.
 * The renderer smoke test and the real-mpv integration test read the
 * commands from here, so they cannot drift from what the app sends.
 */

export const MIRROR_LABEL = '@bmmirror';
export const MIRROR_FILTER = MIRROR_LABEL + ':hflip';

/** What to send mpv to turn the picture to deg (0, 90, 180 or 270). */
export const rotateCmd = deg => ['set_property', 'video-rotate', deg];
/** What to send mpv to mirror the picture, or not. */
export const mirrorCmd = on => on ? ['vf', 'add', MIRROR_FILTER] : ['vf', 'remove', MIRROR_LABEL];
/** What to send mpv, paused, to draw the picture again where it is. */
export const REDRAW = ['seek', 0, 'relative+exact'];

export default class VideoTransform {
  /** mpv: { cmd(...args) }. osd: (message) => void. paused: () => boolean. */
  constructor ({ mpv, osd, paused = () => false }) {
    this._mpv = mpv; this._osd = osd; this._paused = paused;
    this.rotation = 0; this.mirrored = false;
  }

  _send (c) { try { return this._mpv()?.cmd(...c); } catch (_) { return null; } }
  _say (m) { try { this._osd?.(m); } catch (_) {} }
  _redraw () { let p = false; try { p = !!this._paused(); } catch (_) {} if (p) this._send(REDRAW); }

  /** Turn by a quarter: 90 clockwise, -90 the other way. */
  rotate (by = 90) {
    this.rotation = (((this.rotation + by) % 360) + 360) % 360;
    this._send(rotateCmd(this.rotation)); this._redraw();
    this._say(this.rotation ? `Rotated ${this.rotation}°` : 'Rotation off');
  }

  mirror (on = !this.mirrored) {
    if (on === this.mirrored) return;
    this.mirrored = on;
    this._send(mirrorCmd(on)); this._redraw();
    this._say(on ? 'Mirrored' : 'Mirror off');
  }

  /** Straight again. quiet: no message (a new file). */
  reset (quiet = false) {
    const was = this.rotation || this.mirrored;
    if (this.rotation) { this.rotation = 0; this._send(rotateCmd(0)); }
    if (this.mirrored) { this.mirrored = false; this._send(mirrorCmd(false)); }
    if (was && !quiet) { this._redraw(); this._say('Rotation and mirror off'); }
  }
}
