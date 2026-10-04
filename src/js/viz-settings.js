/**
 * viz-settings: the visualiser settings panel (v3.28.0). It opens from the
 * settings button in the visual mode for audio and in the music player's
 * visualiser, and sets, for both: the style, the colours, the sensitivity,
 * the number of bars and the smoothing. Changes apply as you make them and
 * are kept (visualizer.js keeps them, under bm_viz).
 */
import { VIZ_DEFAULTS, vizSettings, saveVizSettings, allVisualisers } from './visualizer.js';

const SLIDERS = [['sens', 'sensitivity', v => v / 100, v => Math.round(v * 100), v => v + '%'],
                 ['bars', 'bars', v => v, v => v, v => String(v)],
                 ['smooth', 'smoothing', v => v / 100, v => Math.round(v * 100), v => v + '%']];

function apply(s) {
  for (const v of allVisualisers()) { v.setOptions(s); if (v.mode !== 'off' && v.mode !== s.style) v.setMode(s.style); }
}
function set(patch) { const s = { ...vizSettings(), ...patch }; saveVizSettings(s); apply(s); sync(); }

function sync() {
  const s = vizSettings(), p = document.getElementById('viz-settings'); if (!p) return;
  p.querySelectorAll('#vs-style button').forEach(b => b.classList.toggle('active', b.dataset.v === s.style));
  p.querySelectorAll('#vs-colors button').forEach(b => b.classList.toggle('active', b.dataset.v === s.colors));
  p.querySelectorAll('#vs-spin button').forEach(b => b.classList.toggle('active', (b.dataset.v === 'on') === (s.spin !== false)));
  p.querySelectorAll('#vs-md-auto button').forEach(b => b.classList.toggle('active', +b.dataset.v === (s.mdAuto ?? 30)));
  for (const [id, key, , toUI, label] of SLIDERS) {
    const i = document.getElementById('vs-' + id), v = toUI(s[key]); if (i) i.value = v;
    const t = document.getElementById('vs-' + id + '-val'); if (t) t.textContent = label(v);
  }
}

function open(btn) {
  const p = document.getElementById('viz-settings'); if (!p) return;
  sync(); p.classList.remove('hidden');
  const r = btn.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  // Beside the button, inside the window: above it when there is no room below.
  const x = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
  const below = r.bottom + 8, above = r.top - h - 8;
  p.style.left = x + 'px'; p.style.top = (below + h < window.innerHeight - 8 ? below : Math.max(8, above)) + 'px';
}
const close = () => document.getElementById('viz-settings')?.classList.add('hidden');

function wire() {
  const p = document.getElementById('viz-settings'); if (!p) return;
  for (const id of ['viz-btn-settings', 'mv-btn-settings']) {
    document.getElementById(id)?.addEventListener('click', e => { e.stopPropagation(); p.classList.contains('hidden') ? open(e.currentTarget) : close(); });
  }
  p.querySelector('#vs-style')?.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ style: b.dataset.v }); });
  p.querySelector('#vs-colors')?.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ colors: b.dataset.v }); });
  p.querySelector('#vs-spin')?.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ spin: b.dataset.v === 'on' }); });   // Radial (v3.30.1)
  // MilkDrop (v3.32.0): how often the preset changes by itself, and the next one now.
  p.querySelector('#vs-md-auto')?.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ mdAuto: +b.dataset.v }); });
  p.querySelector('#vs-md-next')?.addEventListener('click', () => { let n = null; for (const x of allVisualisers()) if (x.mode === 'milkdrop') n = x.mdNext(1.5) || n; if (n) window.bmApp?.showOSD?.(n); });
  for (const [id, key, fromUI] of SLIDERS) document.getElementById('vs-' + id)?.addEventListener('input', e => set({ [key]: fromUI(+e.target.value) }));
  document.getElementById('vs-reset')?.addEventListener('click', () => set({ ...VIZ_DEFAULTS }));
  document.addEventListener('mousedown', e => { if (!p.classList.contains('hidden') && !p.contains(e.target) && !e.target.closest('#viz-btn-settings, #mv-btn-settings')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.bmVizPanel = { sync, open, close };
  sync();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
}
