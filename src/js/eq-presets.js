/**
 * The equalizer's presets (v3.59.0, the plan's 3.58), for the desktop and
 * the phone alike.
 *
 *   built in   Flat, Bass, Treble, Rock, Pop, Jazz, Classical, Vocal, Loudness,
 *              written once for ten bands (as they were) and spread over
 *              the fifteen (sound-chain.js eqFrom), so they sound as before
 *   yours      any curve saved under a name of your own, with its preamp
 *   by output  a preset tied to where the sound goes: the speakers, a pair
 *              of headphones, a Bluetooth headset. When the sound moves
 *              there (headphones plugged in, a headset connected), the
 *              equalizer changes to it by itself, and back when it leaves
 *
 * Kept in localStorage: bm_eq (the curve in use, its preamp and its name),
 * bm_eq_presets (yours) and bm_eq_outputs (output -> preset name). The
 * phone keeps its own under the same keys in its own page.
 */
import { eqFrom, EQ_FREQUENCIES } from './sound-chain.js';

const TEN_PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Bass: [8, 7, 5, 3, 1, 0, 0, 0, 0, 0],
  Treble: [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
  Rock: [5, 4, -2, -4, -2, 2, 5, 6, 6, 5],
  Pop: [-1, 2, 4, 4, 1, -1, -2, -2, -1, 1],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Classical: [4, 3, 2, 1, -1, -1, -1, 0, 2, 3],
  Vocal: [-2, -2, -1, 1, 3, 4, 4, 2, 0, -1],
  Loudness: [6, 4, 1, 0, -1, -1, 0, 1, 4, 5],
};
export const BUILT_IN = Object.fromEntries(Object.entries(TEN_PRESETS).map(([k, v]) => [k, { eq: eqFrom(v), preamp: 0 }]));
const CUR = 'bm_eq', MINE = 'bm_eq_presets', BY_OUT = 'bm_eq_outputs';
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const clean = eq => {
  const g = Array.isArray(eq) && eq.length === 10 ? eqFrom(eq) : eq;
  return EQ_FREQUENCIES.map((_, i) => Math.max(-12, Math.min(12, Math.round((+g?.[i] || 0) * 2) / 2)));
};
const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.01);

export class EqPresets {
  constructor () {
    const c = read(CUR, null);
    this.eq = clean(c?.eq || BUILT_IN.Flat.eq);
    this.preamp = Math.max(-12, Math.min(12, +c?.preamp || 0));
    this.name = typeof c?.name === 'string' ? c.name : 'Flat';
    this.mine = read(MINE, {}) || {};
    for (const k of Object.keys(this.mine)) this.mine[k] = { eq: clean(this.mine[k].eq), preamp: +this.mine[k].preamp || 0 };
    this.byOutput = read(BY_OUT, {}) || {};
    this._before = null;   // the curve before an output's own took over, to go back to
  }
  /** Every preset by name: the built-in ones, then yours. */
  all () { return { ...BUILT_IN, ...this.mine }; }
  names () { return [...Object.keys(BUILT_IN), ...Object.keys(this.mine).filter(k => !(k in BUILT_IN))]; }
  isMine (name) { return name in this.mine; }
  /** The curve now: its gains, preamp and the preset's name, or '' when changed by hand. */
  set (eq, preamp = this.preamp, name = '') {
    this.eq = clean(eq); this.preamp = Math.max(-12, Math.min(12, +preamp || 0));
    // a curve that is a preset's is that preset, however it was made
    if (!name) name = this.names().find(n => same(this.all()[n].eq, this.eq) && (this.all()[n].preamp || 0) === this.preamp) || '';
    this.name = name;
    write(CUR, { eq: this.eq, preamp: this.preamp, name: this.name });
    return this;
  }
  use (name) { const p = this.all()[name]; if (p) this.set(p.eq, p.preamp, name); return !!p; }
  /** The curve now, kept under a name of yours. A built-in name is not taken. */
  save (name) {
    name = String(name || '').trim().slice(0, 40);
    if (!name || name in BUILT_IN) return false;
    this.mine[name] = { eq: this.eq.slice(), preamp: this.preamp };
    write(MINE, this.mine);
    this.name = name; write(CUR, { eq: this.eq, preamp: this.preamp, name });
    return true;
  }
  remove (name) {
    if (!(name in this.mine)) return false;
    delete this.mine[name]; write(MINE, this.mine);
    for (const [o, n] of Object.entries(this.byOutput)) if (n === name) delete this.byOutput[o];
    write(BY_OUT, this.byOutput);
    if (this.name === name) this.name = '';
    return true;
  }
  /** A preset tied to an output (its name as the system gives it), or untied with ''. */
  tie (output, name) {
    if (!output) return;
    if (name) this.byOutput[output] = name; else delete this.byOutput[output];
    write(BY_OUT, this.byOutput);
  }
  tiedTo (output) { return output ? this.byOutput[output] || '' : ''; }
  /**
   * The sound moved to another output. Its own preset, if it has one, and
   * the curve from before when it moves to one that has none. Returns the
   * name now in use when it changed, else null.
   */
  outputChanged (output) {
    const want = this.tiedTo(output);
    if (want && this.all()[want]) {
      if (!this._before) this._before = { eq: this.eq.slice(), preamp: this.preamp, name: this.name };
      if (this.name === want) return null;
      this.use(want); return want;
    }
    if (this._before) { const b = this._before; this._before = null; this.set(b.eq, b.preamp, b.name); return this.name || 'Custom'; }
    return null;
  }
}
