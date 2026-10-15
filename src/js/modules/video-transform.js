/**
 * BM Player: turning and mirroring the picture (v3.38.0).
 *
 * Both are mpv's. Turning is its video-rotate, done where the picture is
 * drawn, on the graphics card, with nothing extra decoded: 0, 90, 180 or 270
 * degrees, added to whatever turn the file itself asks for (a phone's
 * video stood on its side). Mirroring is mpv's hflip filter, under a label
 * of its own (@bmmirror) so it is added and taken away without touching any
 * other filter.
 *
 * A filter only works on pictures in the computer's memory (v3.43.1). When
 * the graphics card decodes into its own memory (d3d11va on Windows, nvdec,
 * vaapi, videotoolbox and the like), mpv cannot run the filter: it drops it
 * ("Disabling filter ... because it has failed"), the picture stays as it
 * was, and the filter is still listed. The field check found that with a
 * real MKV on a laptop, where the test video, decoded by the processor, had
 * mirrored. So while the mirror is on, the decoding switches to the copying
 * kind of the same decoder (d3d11va-copy and so on), which hands each picture
 * back to the memory. mpv decodes again from where it is when the decoder
 * changes, and the filter is put in afresh once the pictures come that way.
 * Mirror off, or a new file, puts the decoding back as it was. A little more
 * work for the computer, and only while the picture is mirrored.
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

/**
 * Whether mpv's decoder (its hwdec-current) keeps the pictures on the
 * graphics card, out of a filter's reach: any hardware decoder but the
 * copying kind. '' or 'no' is the processor.
 */
export const onCard = cur => typeof cur === 'string' && cur !== '' && cur !== 'no' && !/-copy$/.test(cur);
/** The decoders to try, in turn, while mirrored: the same one copying, any that copies, then the processor. */
export const copyingFor = cur => [`${cur}-copy`, 'auto-copy-safe', 'auto-copy', 'no'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default class VideoTransform {
  /** mpv: { cmd(...args) }. osd: (message) => void. paused: () => boolean. */
  constructor ({ mpv, osd, paused = () => false }) {
    this._mpv = mpv; this._osd = osd; this._paused = paused;
    this.rotation = 0; this.mirrored = false;
    this._gen = 0; this._job = null; this._hwdecBefore = null;
  }

  _send (c) { try { return this._mpv()?.cmd(...c); } catch (_) { return null; } }
  async _get (name) { try { const v = await this._send(['get_property', name]); return v && typeof v === 'object' && v.error ? null : v; } catch (_) { return null; } }
  _say (m) { try { this._osd?.(m); } catch (_) {} }
  _redraw () { let p = false; try { p = !!this._paused(); } catch (_) {} if (p) this._send(REDRAW); }

  /** Turn by a quarter: 90 clockwise, -90 the other way. */
  rotate (by = 90) {
    this.rotation = (((this.rotation + by) % 360) + 360) % 360;
    this._send(rotateCmd(this.rotation)); this._redraw();
    this._say(this.rotation ? `Rotated ${this.rotation}°` : 'Rotation off');
  }

  /**
   * Mirrors the picture, or not. The filter goes to mpv at once. Where the
   * graphics card decodes, the decoding is then switched (_fitDecoder), so
   * the promise this gives (also ready()) is when the mirror can be seen.
   */
  mirror (on = !this.mirrored) {
    if (on === this.mirrored) return this.ready();
    this.mirrored = on;
    const gen = ++this._gen;
    this._send(mirrorCmd(on)); this._redraw();
    this._say(on ? 'Mirrored' : 'Mirror off');
    if (on) this._job = this._fitDecoder(gen).catch(() => {});
    else { this._restoreDecoder(); this._job = null; }
    return this.ready();
  }

  /** Done when the last mirror has taken effect (the decoder switched, if it had to be). */
  ready () { return this._job || Promise.resolve(); }

  /** Straight again. quiet: no message (a new file). */
  reset (quiet = false) {
    const was = this.rotation || this.mirrored;
    if (this.rotation) { this.rotation = 0; this._send(rotateCmd(0)); }
    if (this.mirrored) { this.mirrored = false; this._gen++; this._send(mirrorCmd(false)); this._restoreDecoder(); this._job = null; }
    if (was && !quiet) { this._redraw(); this._say('Rotation and mirror off'); }
  }

  /** The decoding as it was before the mirror, if the mirror changed it. */
  _restoreDecoder () {
    const before = this._hwdecBefore;
    this._hwdecBefore = null;
    if (before != null) this._send(['set_property', 'hwdec', before]);
  }

  /** While mirrored, pictures the filter can reach: see the top of this file. */
  async _fitDecoder (gen) {
    const live = () => gen === this._gen && this.mirrored;
    const cur = await this._get('hwdec-current');
    if (!live() || !onCard(cur)) return;
    // mpv 0.36 and newer give the option as a list (["auto-safe"]), older as a string.
    const before = await this._get('hwdec');
    if (!live()) return;
    const was = Array.isArray(before) ? before.filter(x => typeof x === 'string' && x).join(',') : typeof before === 'string' ? before : '';
    this._hwdecBefore = was || 'auto-safe';
    let fitted = false;
    for (const v of copyingFor(cur)) {
      const r = await this._send(['set_property', 'hwdec', v]);
      if (!live()) return;                                   // mirror off meanwhile: it put the decoding back
      if (r && typeof r === 'object' && r.error) continue;   // not a decoder this mpv has
      for (let i = 0; i < 20 && live(); i++) {               // mpv starts the new decoder from where the film is
        await sleep(150);
        if (!onCard(await this._get('hwdec-current'))) { fitted = true; break; }
      }
      if (fitted || !live()) break;
    }
    if (!live()) return;
    // The filter afresh, now that the pictures come to the memory.
    this._send(mirrorCmd(false)); this._send(mirrorCmd(true)); this._redraw();
  }
}
