/**
 * Hi-fi sound (v3.59.0, the plan's 3.59): the sound panel's Hi-fi part, for
 * films and songs.
 *
 *   No clipping      headroom (sound-chain.js): the whole sound lowered by
 *                    as much as the equalizer, the preamp and the correction
 *                    lift it at most; and for songs the engine plays, a
 *                    true-peak limiter after the volume (worklets/limiter.js).
 *                    Both on to begin with.
 *   Crossfeed        for headphones: the lows reach both ears, as from
 *                    speakers (FFmpeg's crossfeed, and its sum in the engine)
 *   Headphone        a pair's measured curve from OPRA (main/opra.js), shown
 *   correction       with who made it and where it came from, as OPRA asks.
 *                    Kept for the output it was chosen on: plug in other
 *                    headphones and theirs comes on, or none
 *   Bit-perfect      songs from the library played by mpv with the device to
 *   songs            itself (WASAPI exclusive on Windows, Core Audio on the
 *                    Mac, PipeWire on Linux, where mpv can), at the file's
 *                    own rate and bits: no equalizer, effects, levelling or
 *                    volume in the way. Films keep everything.
 *   Signal path      what the playing sound goes through, from the file to
 *                    the device, from what mpv and the engine say of it
 *
 * mpv's resampler, where it has to resample, is set to libswresample's
 * longer filter (32 taps a phase, cutoff 0.97) for every file: the default
 * is 16. Kept in localStorage, bm_hifi.
 */
import { headroomOf, settings as soundSettings } from '../sound-chain.js';

const KEY = 'bm_hifi';
export const SWR = 'filter_size=32,phase_shift=10,cutoff=0.97';
const kHz = r => r ? (r / 1000).toFixed(r % 1000 ? 1 : 0) + ' kHz' : '?';
const FMT = { s16: '16-bit', s24: '24-bit', s32: '32-bit', float: '32-bit float', double: '64-bit float', s16p: '16-bit', s32p: '32-bit', floatp: '32-bit float', u8: '8-bit' };
const fmt = f => FMT[String(f || '').toLowerCase()] || String(f || '?');

export class HiFi {
  constructor ({ mpv, music, sound, output, osd, apply } = {}) {
    this.mpv = mpv || (() => null); this.music = music || (() => null); this.sound = sound || (() => ({}));
    this.output = output || (() => null); this.osd = osd || (() => {}); this.apply = apply || (() => {});
    let s = {}; try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
    this.headroom = s.headroom !== false; this.guard = s.guard !== false; this.crossfeed = !!s.crossfeed; this.pure = !!s.pure;
    this.byOutput = s.byOutput && typeof s.byOutput === 'object' ? s.byOutput : {};   // output name -> curve
    this.hp = s.hp || null; this._out = null;
  }
  _save () { try { localStorage.setItem(KEY, JSON.stringify({ headroom: this.headroom, guard: this.guard, crossfeed: this.crossfeed, pure: this.pure, hp: this.hp, byOutput: this.byOutput })); } catch (_) {} }
  /** What sound-chain.js is given from here. */
  get fx () { return { headroom: this.headroom, crossfeed: this.crossfeed, hp: this.hp ? { name: this.hp.name, gain: this.hp.gain, bands: this.hp.bands } : null }; }
  _changed (say) { this._save(); this.apply(); this.applyEngine(); this.sync(); if (say) this.osd(say); }
  /** The engine's limiter, on with No clipping. */
  applyEngine () { this.music()?.engine?.setGuard?.(this.guard); }
  /** mpv's resampler, said once mpv has started. */
  applyMpv () { this.mpv()?.cmd('set_property', 'audio-swresample-o', SWR)?.catch?.(() => {}); }

  setHeadroom (on) { this.headroom = !!on; this._changed(on ? 'Headroom: a boost can no longer clip' : 'Headroom off'); }
  setGuard (on) { this.guard = !!on; this._changed(on ? 'Peak limiter on' : 'Peak limiter off'); }
  setCrossfeed (on) { this.crossfeed = !!on; this._changed(on ? 'Crossfeed: the lows in both ears, as from speakers' : 'Crossfeed off'); }
  setPure (on) {
    this.pure = !!on; this._save(); this.sync();
    this.music()?.setPure?.(this.pure);
    this.osd(on ? 'Bit-perfect songs: played by mpv with the device to itself, nothing in the way' : 'Bit-perfect songs off');
  }
  /** A curve from OPRA (main/opra.js opra:eq), or null: kept for the output in use. */
  async setCorrection (curve) {
    this.hp = curve || null;
    const out = await this._outName();
    if (out) { if (curve) this.byOutput[out] = curve; else delete this.byOutput[out]; }
    this._changed(curve ? 'Headphone correction: ' + curve.name : 'Headphone correction off');
  }
  async _outName () { try { return await this.output()?.current?.() || ''; } catch (_) { return ''; } }
  /** The sound moved to another output (output.js onOutput): its own correction, or none. */
  outputChanged (name) {
    if (!name || this._out === name) return;
    this._out = name;
    const want = this.byOutput[name] || null;
    if ((want?.id || null) === (this.hp?.id || null)) return;
    this.hp = want; this._changed(want ? name + ': correction for ' + want.name : null);
  }

  /** Lines saying what the playing sound goes through, from the file to the device. */
  async signal () {
    const m = this.music(), e = m?.engine, lines = [];
    const s = soundSettings({ ...this.sound(), ...this.fx });
    if (m?.engineOwns?.() && e?.ctx) {
      const t = m.tags?.[m.currentPath] || {};
      lines.push(['File', [t.codec, t.sampleRate ? kHz(t.sampleRate) : '', t.bits ? t.bits + '-bit' : '', t.lossless ? 'lossless' : ''].filter(Boolean).join(', ') || 'not read yet']);
      const rate = e.ctx.sampleRate;
      lines.push(['Played by', 'the app\'s own engine (Web Audio), at ' + kHz(rate) + ' in 32-bit float' + (t.sampleRate && t.sampleRate !== rate ? ', converted from ' + kHz(t.sampleRate) + ' by the browser' : '')]);
      const live = e.chain?.live || [];
      const hr = headroomOf(s);
      lines.push(['On the way', [live.length ? live.join(', ') : 'no effects', e.level ? 'level ' + (e.level > 0 ? '+' : '') + e.level + ' dB' : '', hr ? hr + ' dB headroom' : '', e.guarded ? 'peak limiter' : ''].filter(Boolean).join(', ')]);
      lines.push(['Out', (e.ctx.sinkId ? 'the device chosen' : 'the system\'s own device') + ', mixed with other sound by the system']);
      lines.push(['Bit-perfect', 'no: the engine converts to its own rate and mixes. Turn on Bit-perfect songs for that.']);
      return lines;
    }
    const mpv = this.mpv(); if (!mpv) return [['Nothing', 'is playing']];
    const get = async k => { try { const r = await mpv.cmd('get_property', k); return r && typeof r === 'object' && 'data' in r ? r.data : r; } catch (_) { return null; } };
    const [codec, inP, outP, ao, af, vol, excl, speed, dev] = await Promise.all(['audio-codec-name', 'audio-params', 'audio-out-params', 'current-ao', 'af', 'volume', 'audio-exclusive', 'speed', 'audio-device'].map(get));
    if (!inP) return [['Nothing', 'is playing']];
    lines.push(['File', [codec, kHz(inP.samplerate), fmt(inP.format), (inP['channel-count'] || '') && inP['channel-count'] + ' channels'].filter(Boolean).join(', ')]);
    const afs = Array.isArray(af) ? af.filter(x => x && x.enabled !== false) : [];
    lines.push(['Played by', 'mpv' + (afs.length ? ', through ' + afs.length + ' filter' + (afs.length > 1 ? 's' : '') + ' (the equalizer and effects)' : ', with no filters') + (vol !== 100 ? ', volume ' + Math.round(vol) + '%' : '') + (speed && speed !== 1 ? ', at ' + speed + '×' : '')]);
    if (outP) lines.push(['Out', [kHz(outP.samplerate), fmt(outP.format), ao ? 'by ' + ao : '', excl ? 'the device to itself' : 'shared with other sound', dev && dev !== 'auto' ? dev : ''].filter(Boolean).join(', ') + (outP.samplerate !== inP.samplerate ? ' (resampled by mpv, ' + SWR.split(',')[0].replace('_', ' ').replace('=', ' ') + ')' : '')]);
    const pure = !!(excl && !afs.length && vol === 100 && (speed || 1) === 1 && outP && outP.samplerate === inP.samplerate && String(outP.format).replace(/p$/, '') === String(inP.format).replace(/p$/, ''));
    lines.push(['Bit-perfect', pure ? 'yes: the samples reach the device as they are in the file' : 'no' + (!excl ? ', the device is shared' : afs.length ? ', filters are on' : vol !== 100 ? ', the volume is not 100%' : outP && outP.samplerate !== inP.samplerate ? ', the device runs at another rate' : '')]);
    return lines;
  }

  /** The signal path in the panel, every two seconds while the panel is open. */
  startPath () {
    const box = this.root?.querySelector('[data-hifi-path]'); if (!box) return;
    const draw = async () => {
      if (!box.isConnected || !box.closest('.side-panel.open')) { clearInterval(this._pathT); this._pathT = 0; return; }
      const lines = await this.signal().catch(() => [['Nothing', 'could be read']]);
      box.innerHTML = '';
      for (const [k, v] of lines) { const r = document.createElement('div'); r.className = 'snd-path-row'; const a = document.createElement('span'); a.textContent = k; const b = document.createElement('span'); b.textContent = v; r.append(a, b); box.appendChild(r); }
    };
    clearInterval(this._pathT); this._pathT = setInterval(draw, 2000); draw();
  }

  wire (root) {
    this.root = root; if (!root) return;
    const box = (sel, fn) => root.querySelector(sel)?.addEventListener('change', e => fn(e.target.checked));
    box('[data-hifi-headroom]', on => this.setHeadroom(on));
    box('[data-hifi-guard]', on => this.setGuard(on));
    box('[data-hifi-crossfeed]', on => this.setCrossfeed(on));
    box('[data-hifi-pure]', on => this.setPure(on));
    // headphone correction: a search, the headphones found, then a curve
    const q = root.querySelector('[data-hp-q]'), list = root.querySelector('[data-hp-list]');
    let t = 0;
    q?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => this._search(q.value, list), 250); });
    list?.addEventListener('click', async e => {
      const b = e.target.closest('[data-hp-eq]'); if (!b) return;
      b.disabled = true;
      const r = await window.api?.music?.opraEq?.(b.dataset.hpEq).catch?.(() => null);
      if (!r?.ok || !r.eq) { this.osd('That curve could not be had' + (r?.error ? ': ' + r.error : '')); b.disabled = false; return; }
      await this.setCorrection(r.eq);
      list.innerHTML = ''; if (q) q.value = '';
    });
    root.querySelector('[data-hp-off]')?.addEventListener('click', () => this.setCorrection(null));
    this.sync();
  }
  async _search (query, list) {
    if (!list) return;
    if (String(query).trim().length < 2) { list.innerHTML = ''; return; }
    list.innerHTML = '<div class="hp-note">Looking… (the first time, OPRA\'s database, about 13 MB, is fetched and kept)</div>';
    const r = await window.api?.music?.opraSearch?.(query).catch?.(e => ({ ok: false, error: String(e) }));
    if (!r?.ok) { list.innerHTML = '<div class="hp-note"></div>'; list.firstChild.textContent = 'OPRA could not be reached' + (r?.error ? ': ' + r.error : '.'); return; }
    list.innerHTML = '';
    if (!r.results.length) { const d = document.createElement('div'); d.className = 'hp-note'; d.textContent = 'No headphones by that name in OPRA.'; list.appendChild(d); return; }
    for (const p of r.results) {
      const d = document.createElement('div'); d.className = 'hp-item';
      const n = document.createElement('div'); n.className = 'hp-name'; n.textContent = p.vendor + ' ' + p.name;
      d.appendChild(n);
      for (const e of p.eqs) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'eq-preset-btn hp-eq'; b.dataset.hpEq = e.id;
        b.textContent = 'EQ by ' + e.author + (e.details ? ' · ' + e.details : '');
        d.appendChild(b);
      }
      list.appendChild(d);
    }
  }
  sync () {
    const root = this.root; if (!root) return;
    const set = (sel, v) => { const i = root.querySelector(sel); if (i) i.checked = v; };
    set('[data-hifi-headroom]', this.headroom); set('[data-hifi-guard]', this.guard); set('[data-hifi-crossfeed]', this.crossfeed); set('[data-hifi-pure]', this.pure);
    const cur = root.querySelector('[data-hp-cur]');
    if (cur) {
      cur.innerHTML = '';
      if (this.hp) {
        // the curve's maker first and most prominent, then OPRA, as OPRA asks
        const a = document.createElement('div'); a.className = 'hp-by'; a.textContent = this.hp.name + ': EQ by ' + this.hp.author + (this.hp.details ? ' · ' + this.hp.details : '');
        cur.appendChild(a);
        if (this.hp.skipped) { const s = document.createElement('div'); s.className = 'hp-note'; s.textContent = this.hp.skipped + ' band' + (this.hp.skipped > 1 ? 's' : '') + ' of a kind not made here left out.'; cur.appendChild(s); }
      }
    }
    const off = root.querySelector('[data-hp-off]'); if (off) off.hidden = !this.hp;
  }
}
