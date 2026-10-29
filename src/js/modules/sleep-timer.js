/**
 * Sleep timer (v3.46.0): playing stops by itself after a while, or at the
 * end of the film or song that is playing, as VLC's and KMPlayer's do and
 * as the phone's already did. Over the last ten seconds the sound fades out,
 * then playing pauses, and the volume is put back for the next time.
 *
 * The app tells it how to read and set the volume and how to pause; at the
 * end of a file it asks atEnd(), which says whether to stop there.
 */
export const SLEEP_CHOICES = [[0, 'Off'], [15, 'In 15 minutes'], [30, 'In 30 minutes'], [45, 'In 45 minutes'], [60, 'In 1 hour'], [90, 'In 1 hour 30 minutes'], [120, 'In 2 hours'], ['end', 'At the end of this file']];
const FADE_MS = 10000, STEP_MS = 250;

export class SleepTimer {
  constructor({ playing, pause, volume, setVolume, osd, onChange } = {}) {
    this.playing = playing || (() => false);
    this.pause = pause || (() => {});
    this.volume = volume || (() => 100);
    this.setVolume = setVolume || (() => {});
    this.osd = osd || (() => {});
    this.onChange = onChange || (() => {});
    this.mode = null;      // null, 'time' or 'end'
    this.at = 0;           // when it fires, for 'time'
    this.minutes = 0;
    this._t = 0; this._fade = 0; this._start = null;
    this.fadeMs = FADE_MS;   // tests make it short
  }

  /** minutes, 'end' for the end of this file, or 0 for off. */
  set(choice) {
    this.cancel();
    if (choice === 'end') {
      this.mode = 'end';
      this.osd('Sleep timer: playing stops at the end of this file');
    } else if (+choice > 0) {
      const ms = +choice * 60000;
      this.mode = 'time'; this.minutes = +choice; this.at = Date.now() + ms;
      this._t = setTimeout(() => this._fadeOut(), Math.max(0, ms - this.fadeMs));
      this.osd(`Sleep timer: playing stops in ${label(+choice)}`);
    } else {
      this.osd('Sleep timer off');
    }
    this.onChange();
  }
  /** Milliseconds left, or null when not counting down. */
  remaining() { return this.mode === 'time' ? Math.max(0, this.at - Date.now()) : null; }
  /** A file came to its end. True when playing should stop there. */
  atEnd() {
    if (this.mode !== 'end') return false;
    this.mode = null; this.onChange();
    this.osd('Sleep timer: stopped at the end of the file', 3000);
    return true;
  }
  /** Off, with the volume put back if it was fading. */
  cancel() {
    clearTimeout(this._t); clearInterval(this._fade); this._t = 0; this._fade = 0;
    if (this._start != null) { this.setVolume(this._start); this._start = null; }
    const was = this.mode; this.mode = null; this.at = 0;
    return was;
  }
  _fadeOut() {
    this._t = 0;
    if (!this.playing()) { this._done(false); return; }
    const start = this._start = this.volume();
    const steps = Math.max(1, Math.round(this.fadeMs / STEP_MS));
    let i = 0;
    this._fade = setInterval(() => {
      i++;
      if (i < steps) { this.setVolume(Math.round(start * (1 - i / steps))); return; }
      clearInterval(this._fade); this._fade = 0;
      this._done(true);
    }, STEP_MS);
  }
  _done(paused) {
    if (paused && this.playing()) this.pause();
    if (this._start != null) { this.setVolume(this._start); this._start = null; }
    this.mode = null; this.at = 0;
    if (paused) this.osd('Sleep timer: paused', 3000);
    this.onChange();
  }
}

export function label(min) {
  if (min < 60) return `${min} minutes`;
  const h = Math.floor(min / 60), m = min % 60;
  return (h === 1 ? '1 hour' : `${h} hours`) + (m ? ` ${m} minutes` : '');
}
