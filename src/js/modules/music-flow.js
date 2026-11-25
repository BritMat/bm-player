/**
 * Between songs, and songs made equally loud (v3.59.0, the plan's 3.58): the
 * two settings in the sound panel for the music the in-app engine plays.
 *
 *   Between songs   Off (each song ends, then the next starts, as before),
 *                   Gapless (no silence between) or Crossfade, over 1 to 12
 *                   seconds. Gapless is on to begin with.
 *   Even loudness   Off, Song by song, or Album by album (loudness.js).
 *
 * The engine does the work (audio-engine.js, loudness.js); this keeps the
 * choice in localStorage (bm_flow, bm_loudness) and tells the music view, so
 * the song waiting next is made ready again.
 */
import { LEVEL_MODES } from '../loudness.js';
export const FLOWS = [['off', 'Off'], ['gapless', 'Gapless'], ['crossfade', 'Crossfade']];

export class MusicFlowPanel {
  constructor ({ music, osd } = {}) {
    this.music = music; this.osd = osd || (() => {});
  }
  get engine () { return this.music?.engine; }
  setFlow (mode, seconds, say = true) {
    const e = this.engine; if (!e) return;
    e.setFlow({ mode, seconds });
    try { localStorage.setItem('bm_flow', JSON.stringify(e.flow)); } catch (_) {}
    this.music?._prepNext?.();
    if (say) this.osd(e.flow.mode === 'off' ? 'Between songs: each ends, then the next starts' : e.flow.mode === 'gapless' ? 'Between songs: gapless, no silence between' : `Between songs: a crossfade of ${e.flow.seconds} seconds`);
    this.sync();
  }
  setLevel (mode) {
    const m = this.music; if (!m?.level) return;
    m.level.setMode(mode, true);
    // the playing song now, and the next when it is ready
    if (m.engineOwns?.() && m.currentPath) m.engine.setLevel(m.level.level(m.currentPath).db);
    m._prepNext?.();
    this.sync();
  }
  wire (root) {
    this.root = root; if (!root) return;
    for (const b of root.querySelectorAll('[data-flow]')) b.addEventListener('click', () => this.setFlow(b.dataset.flow));
    const r = root.querySelector('[data-flow-secs]');
    r?.addEventListener('input', () => { const v = root.querySelector('[data-flow-secs-val]'); if (v) v.textContent = r.value + ' s'; });
    r?.addEventListener('change', () => this.setFlow('crossfade', +r.value));
    for (const b of root.querySelectorAll('[data-level]')) b.addEventListener('click', () => this.setLevel(b.dataset.level));
    this.sync();
  }
  sync () {
    const root = this.root, e = this.engine; if (!root || !e) return;
    const mark = (sel, on) => { for (const b of root.querySelectorAll(sel)) { const a = on(b); b.classList.toggle('active', a); b.setAttribute('aria-pressed', String(a)); } };
    mark('[data-flow]', b => b.dataset.flow === e.flow.mode);
    mark('[data-level]', b => b.dataset.level === (this.music?.level?.mode || 'off'));
    const r = root.querySelector('[data-flow-secs]'); if (r) { r.value = e.flow.seconds; r.disabled = e.flow.mode !== 'crossfade'; }
    const v = root.querySelector('[data-flow-secs-val]'); if (v) v.textContent = e.flow.seconds + ' s';
  }
}
export { LEVEL_MODES };
