/**
 * Where the sound goes (v3.59.0, the plan's 3.56): the speakers, headphones,
 * HDMI, a USB DAC, chosen in the app rather than in the system's settings,
 * and Dolby and DTS sent on to an amplifier as they are.
 *
 * The app has two players, and each is told. mpv (films, and the songs it
 * plays itself) takes the device by its own name from audio-device-list.
 * The in-app engine (songs, Web Audio) takes the browser's id for the same
 * device: the two lists name a device alike (both ask the system for its
 * name), so the browser's is found by its label. Where none matches, songs
 * stay on the system's own device, and the panel says so.
 *
 * Passthrough: an AC3, E-AC3, DTS, DTS-HD or TrueHD track goes to the
 * device as it is (audio-spdif), for an amplifier or a soundbar that
 * decodes it itself. While it does, nothing in the app touches that sound:
 * no volume, no equaliser, no effects. A device that cannot take it is
 * given PCM by mpv as before.
 */
const KEY = 'bm_output';
export const SPDIF = 'ac3,eac3,dts,dts-hd,truehd';

/** The browser's device for mpv's description, by name. Null when none matches. */
export function matchDevice (description, devices) {
  const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const want = norm(description);
  if (!want) return null;
  const outs = (devices || []).filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
  return outs.find(d => norm(d.label) === want)
    || outs.find(d => norm(d.label).includes(want) || (norm(d.label) && want.includes(norm(d.label))))
    || null;
}

export class Output {
  /**
   * mpv(): window.api.mpv. engine(): the in-app audio engine, when there is
   * one. osd(text): a short message.
   */
  constructor ({ mpv, engine, osd } = {}) {
    this.mpv = mpv || (() => null);
    this.engine = engine || (() => null);
    this.osd = osd || (() => {});
    this.device = 'auto'; this.label = ''; this.passthrough = false;
    this.list = [];              // mpv's devices: [{ name, description }]
    this.songsHere = true;       // songs follow the chosen device too
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (typeof s.device === 'string' && s.device) { this.device = s.device; this.label = String(s.label || ''); }
      this.passthrough = s.passthrough === true;
    } catch (_) {}
    try { navigator.mediaDevices?.addEventListener?.('devicechange', () => { this.refresh(); this._watchOut(); }); } catch (_) {}
    this.onOutput = null; this._outNow = null;   // v3.59.0: told when the sound moves to another output (the equalizer's own preset)
  }

  _set (name, value) { try { return this.mpv()?.cmd('set_property', name, value)?.catch?.(() => {}); } catch (_) {} }
  _save () { try { localStorage.setItem(KEY, JSON.stringify({ device: this.device, label: this.label, passthrough: this.passthrough })); } catch (_) {} }

  /** mpv's list of devices again, and the panel with it. */
  async refresh () {
    try {
      const r = await this.mpv()?.cmd('get_property', 'audio-device-list');
      const list = Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []);
      this.list = list.filter(d => d && d.name).map(d => ({ name: String(d.name), description: String(d.description || d.name) }));
    } catch (_) {}
    this.sync();
    return this.list;
  }

  /**
   * Where the sound goes now, by name (v3.59.0): the device chosen, or for
   * the system's own, the one the system uses at the moment (the browser's
   * "Default - ..." entry). '' when the system does not say.
   */
  async current () {
    if (this.device !== 'auto') return this.label || this.device;
    try {
      const devs = await navigator.mediaDevices?.enumerateDevices?.() || [];
      const d = devs.find(x => x.kind === 'audiooutput' && x.deviceId === 'default');
      return d ? String(d.label || '').replace(/^Default\s*-\s*/i, '').trim() : '';
    } catch (_) { return ''; }
  }
  async _watchOut () {
    const now = await this.current();
    if (now === this._outNow) return;
    const was = this._outNow; this._outNow = now;
    if (was !== null) this.onOutput?.(now);
  }

  /** The browser's id of the chosen device, for the in-app engine. '' is the system's own. */
  async _sinkFor () {
    if (this.device === 'auto') return '';
    try {
      const devs = await navigator.mediaDevices?.enumerateDevices?.();
      const d = matchDevice(this.label, devs);
      return d ? d.deviceId : null;
    } catch (_) { return null; }
  }

  async _applySongs () {
    const id = await this._sinkFor();
    this.songsHere = id !== null;
    try { await this.engine()?.setSink?.(id || ''); } catch (_) { this.songsHere = false; }
    this.sync();
  }

  /** Everything said to mpv and to the engine again: after mpv starts. */
  applyAll () {
    this._watchOut();
    this._set('audio-device', this.device);
    this._set('audio-spdif', this.passthrough ? SPDIF : '');
    this._applySongs();
  }

  /** name: one of mpv's device names, or 'auto' for the system's own. */
  setDevice (name, say) {
    const d = this.list.find(x => x.name === name);
    this.device = d ? d.name : 'auto';
    this.label = d ? d.description : '';
    this._save();
    this._set('audio-device', this.device);
    this._applySongs();
    if (say) this.osd('Sound to ' + (d ? d.description : "the system's own device"));
    this._watchOut();
  }
  setPassthrough (on, say) {
    this.passthrough = !!on; this._save();
    this._set('audio-spdif', this.passthrough ? SPDIF : '');
    this.sync();
    if (say) this.osd(this.passthrough ? 'Dolby and DTS sent on to the amplifier' : 'Dolby and DTS decoded here');
  }

  /** The sound panel's list and switch (index.html, #snd-output). */
  wire (root) {
    this.root = root;
    if (!root) return;
    root.querySelector('[data-out-device]')?.addEventListener('change', e => this.setDevice(e.target.value, true));
    root.querySelector('[data-out-pass]')?.addEventListener('change', e => this.setPassthrough(e.target.checked, true));
    root.querySelector('[data-out-device]')?.addEventListener('focus', () => this.refresh());
    this.sync();
  }
  sync () {
    const root = this.root; if (!root) return;
    const sel = root.querySelector('[data-out-device]');
    if (sel) {
      const opts = [['auto', "The system's own"], ...this.list.filter(d => d.name !== 'auto').map(d => [d.name, d.description])];
      // a device chosen before that is not there now still shows, as away
      if (this.device !== 'auto' && !opts.some(([n]) => n === this.device)) opts.push([this.device, (this.label || this.device) + ' (not connected)']);
      sel.replaceChildren(...opts.map(([n, d]) => { const o = document.createElement('option'); o.value = n; o.textContent = d; return o; }));
      sel.value = this.device;
    }
    const p = root.querySelector('[data-out-pass]'); if (p) p.checked = this.passthrough;
    const note = root.querySelector('[data-out-note]');
    if (note) note.textContent = this.device !== 'auto' && !this.songsHere ? 'Songs could not be sent there and play on the system’s own device. Films go there.' : '';
  }
}
