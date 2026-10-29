/**
 * Sound (v3.46.0), beside the equalizer: night mode, which ear hears what,
 * and a boost past 100%, as VLC and KMPlayer have them.
 *
 *   Night mode   quiet voices come up and loud bangs come down, for a film
 *                late at night. A compressor and a limiter.
 *   Channels     stereo, mono (both ears hear everything, for one earphone
 *                or one good ear), the left or the right only to both ears,
 *                or the two swapped.
 *   Boost        150% or 200%, for a quiet film on quiet speakers, with a
 *                limiter so the loud parts do not crackle.
 *
 * The same settings reach both players: mpv as one audio filter with the
 * equalizer (audioFilter, below), and the in-app engine as Web Audio nodes
 * (AudioEngine.setFx). Night mode and the channels are kept. The boost goes
 * back to 100% with each start, so a loud setting does not wait for the next
 * film at full volume.
 */
const KEY = 'bm_sound';
export const CHANNELS = [['stereo', 'Stereo'], ['mono', 'Mono'], ['left', 'Left only'], ['right', 'Right only'], ['swap', 'Swapped']];
export const BOOSTS = [100, 150, 200];
// Two channels first, mixed as speakers would: a 5.1 film's centre (its
// voices) is in both, where pan's c0 and c1 alone would be the front left
// and right only.
const TWO = 'aformat=channel_layouts=stereo';
const PAN = {
  mono: 'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1',
  left: 'pan=stereo|c0=c0|c1=c0',
  right: 'pan=stereo|c0=c1|c1=c1',
  swap: 'pan=stereo|c0=c1|c1=c0',
};
const NIGHT = 'acompressor=threshold=0.05:ratio=4:attack=8:release=250:makeup=2';
// No level= here: FFmpeg before 5.1 has no such option, and an option it
// does not know fails the whole filter, equalizer and all.
const LIMIT = 'alimiter=limit=0.95';

/** mpv's `af` for the equalizer and these together, or '' for none. */
export function audioFilter(eq, bands, fx = {}) {
  const parts = [];
  (eq || []).forEach((g, i) => { if (g && bands?.[i]) parts.push(`equalizer=f=${bands[i].freq}:width_type=o:width=2:g=${g}`); });
  if (PAN[fx.channels]) parts.push(TWO, PAN[fx.channels]);
  if (fx.night) parts.push(NIGHT);
  const boost = Math.max(1, Math.min(2, (+fx.boost || 100) / 100));
  if (boost > 1) parts.push(`volume=${boost}`);
  if (fx.night || boost > 1) parts.push(LIMIT);
  return parts.length ? `lavfi=[${parts.join(',')}]` : '';
}

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
