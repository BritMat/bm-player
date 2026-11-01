/**
 * Sound (v3.46.0), beside the equalizer: night mode, which ear hears what,
 * and a boost past 100%, as VLC and KMPlayer have them. This file is the
 * panel and what is kept; how each sounds, in mpv and in the in-app engine,
 * is sound-chain.js (v3.47.0).
 *
 *   Night mode   quiet voices come up and loud bangs come down, for a film
 *                late at night. A compressor and a limiter.
 *   Channels     stereo, mono (both ears hear everything, for one earphone
 *                or one good ear), the left or the right only to both ears,
 *                or the two swapped.
 *   Boost        150% or 200%, for a quiet film on quiet speakers, with a
 *                limiter so the loud parts do not crackle.
 *
 * The same settings reach both players, with the equalizer (app/panels.js,
 * _applyEQ): mpv as one audio filter, the in-app engine as Web Audio nodes.
 * Night mode and the channels are kept. The boost goes back to 100% with
 * each start, so a loud setting does not wait for the next film at full
 * volume.
 */
import { CHANNELS } from '../sound-chain.js';
export { CHANNELS };
const KEY = 'bm_sound';
export const BOOSTS = [100, 150, 200];

export class Sound {
  /** apply(): the app sends the equalizer and these to both players. */
  constructor({ apply, osd } = {}) {
    this.apply = apply || (() => {});
    this.osd = osd || (() => {});
    this.night = false; this.channels = 'stereo'; this.boost = 100;
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      this.night = s.night === true;
      if (CHANNELS.some(([k]) => k === s.channels)) this.channels = s.channels;
    } catch (_) {}
  }
  get fx() { return { night: this.night, channels: this.channels, boost: this.boost }; }
  _save() { try { localStorage.setItem(KEY, JSON.stringify({ night: this.night, channels: this.channels })); } catch (_) {} }
  _changed(say) { this._save(); this.apply(); this.sync(); if (say) this.osd(say); }
  setNight(on) { this.night = !!on; this._changed(this.night ? 'Night mode: quiet parts up, loud parts down' : 'Night mode off'); }
  setChannels(c) {
    if (!CHANNELS.some(([k]) => k === c)) c = 'stereo';
    this.channels = c;
    this._changed('Sound: ' + CHANNELS.find(([k]) => k === c)[1].toLowerCase());
  }
  setBoost(pct) {
    this.boost = BOOSTS.includes(+pct) ? +pct : 100;
    this._changed(this.boost > 100 ? `Volume boost: ${this.boost}%` : 'Volume boost off');
  }
  reset() { this.night = false; this.channels = 'stereo'; this.boost = 100; this._changed(); }

  /** The panel's buttons (index.html, the Sound part of #panel-eq). */
  wire(root) {
    this.root = root;
    if (!root) return;
    for (const b of root.querySelectorAll('[data-snd-night]')) b.addEventListener('click', () => this.setNight(b.dataset.sndNight === 'on'));
    for (const b of root.querySelectorAll('[data-snd-ch]')) b.addEventListener('click', () => this.setChannels(b.dataset.sndCh));
    for (const b of root.querySelectorAll('[data-snd-boost]')) b.addEventListener('click', () => this.setBoost(b.dataset.sndBoost));
    this.sync();
  }
  sync() {
    const root = this.root; if (!root) return;
    const mark = (sel, on) => { for (const b of root.querySelectorAll(sel)) { const a = on(b); b.classList.toggle('active', a); b.setAttribute('aria-pressed', String(a)); } };
    mark('[data-snd-night]', b => (b.dataset.sndNight === 'on') === this.night);
    mark('[data-snd-ch]', b => b.dataset.sndCh === this.channels);
    mark('[data-snd-boost]', b => +b.dataset.sndBoost === this.boost);
  }
}
