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
 *
 * v3.49.0, Sound lab: the sound modes (Slowed + reverb, Nightcore, 8D, Bass
 * boost, Vocal remover, Concert hall, Lo-fi, Wider stereo), one at a time,
 * and clear voice for films. Both are kept, as night mode is.
 */
import { CHANNELS, MODES } from '../sound-chain.js';
export { CHANNELS, MODES };
const KEY = 'bm_sound';
export const BOOSTS = [100, 150, 200];

export class Sound {
  /** apply(): the app sends the equalizer and these to both players. */
  constructor({ apply, osd } = {}) {
    this.apply = apply || (() => {});
    this.osd = osd || (() => {});
    this.night = false; this.channels = 'stereo'; this.boost = 100; this.mode = 'off'; this.voice = false;
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      this.night = s.night === true;
      if (CHANNELS.some(([k]) => k === s.channels)) this.channels = s.channels;
      if (MODES.some(([k]) => k === s.mode)) this.mode = s.mode;
      this.voice = s.voice === true;
    } catch (_) {}
  }
  get fx() { return { night: this.night, channels: this.channels, boost: this.boost, mode: this.mode, voice: this.voice }; }
  _save() { try { localStorage.setItem(KEY, JSON.stringify({ night: this.night, channels: this.channels, mode: this.mode, voice: this.voice })); } catch (_) {} }
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
  setMode(m) {
    if (!MODES.some(([k]) => k === m)) m = 'off';
    this.mode = m;
    this._changed(m === 'off' ? 'Sound mode off' : 'Sound mode: ' + MODES.find(([k]) => k === m)[1]);
  }
  setVoice(on) { this.voice = !!on; this._changed(this.voice ? 'Clear voice: the words come forward' : 'Clear voice off'); }
  reset() { this.night = false; this.channels = 'stereo'; this.boost = 100; this.mode = 'off'; this.voice = false; this._changed(); }

  /** The panel's buttons (index.html, the Sound part of #panel-eq). */
  wire(root) {
    this.root = root;
    if (!root) return;
    for (const b of root.querySelectorAll('[data-snd-night]')) b.addEventListener('click', () => this.setNight(b.dataset.sndNight === 'on'));
    for (const b of root.querySelectorAll('[data-snd-ch]')) b.addEventListener('click', () => this.setChannels(b.dataset.sndCh));
    for (const b of root.querySelectorAll('[data-snd-boost]')) b.addEventListener('click', () => this.setBoost(b.dataset.sndBoost));
    for (const b of root.querySelectorAll('[data-snd-mode]')) b.addEventListener('click', () => this.setMode(b.dataset.sndMode));
    for (const b of root.querySelectorAll('[data-snd-voice]')) b.addEventListener('click', () => this.setVoice(b.dataset.sndVoice === 'on'));
    this.sync();
  }
  sync() {
    const root = this.root; if (!root) return;
    const mark = (sel, on) => { for (const b of root.querySelectorAll(sel)) { const a = on(b); b.classList.toggle('active', a); b.setAttribute('aria-pressed', String(a)); } };
    mark('[data-snd-night]', b => (b.dataset.sndNight === 'on') === this.night);
    mark('[data-snd-ch]', b => b.dataset.sndCh === this.channels);
    mark('[data-snd-boost]', b => +b.dataset.sndBoost === this.boost);
    mark('[data-snd-mode]', b => b.dataset.sndMode === this.mode);
    mark('[data-snd-voice]', b => (b.dataset.sndVoice === 'on') === this.voice);
  }
}
