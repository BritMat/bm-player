/**
 * flow-settings: the Flow theme's controls (v3.28.0). Northern is the Flow
 * theme again, the WebGL fluid it had before v3.27.0 turned it into a scene.
 * Its colours (Northern lights by default), intensity, radius, swirl and
 * trail are set in the theme customizer, apply as you drag, and are kept.
 */
import { PALETTES } from './fluid.js';

const KEY = 'bm_flow';
export const FLOW_DEFAULTS = { palette: 'northern', intensity: 1, radius: 1, swirl: 1, trail: 1 };
const NAMES = { northern: 'Northern lights', ocean: 'Ocean', sunset: 'Sunset', cyberpunk: 'Neon', sakura: 'Sakura',
  lavender: 'Lavender', golden: 'Gold', forest: 'Forest', midnight: 'Midnight', dracula: 'Crimson' };
const SLIDERS = [['intensity', 'tc-flow-intensity'], ['radius', 'tc-flow-radius'], ['swirl', 'tc-flow-swirl'], ['trail', 'tc-flow-trail']];

export function flowSettings() {
  try { return { ...FLOW_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...FLOW_DEFAULTS }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

// Live: the fluid follows each change while the Flow theme is showing.
function applyNow(s) {
  if (document.documentElement.getAttribute('data-theme') === 'northern') window.bmApp?.auroraFX?.setFlow?.(s);
}

function wire() {
  const box = document.getElementById('tc-flow-palettes'); if (!box) return;
  const rgb = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
  for (const [key, name] of Object.entries(NAMES)) {
    if (!PALETTES[key]) continue;
    const b = document.createElement('button');
    b.className = 'tc-flow-swatch'; b.dataset.palette = key; b.title = name; b.setAttribute('aria-label', name);
    b.style.background = `linear-gradient(135deg, ${PALETTES[key].map(rgb).join(', ')})`;
    box.appendChild(b);
  }
  const sync = () => {
    const s = flowSettings();
    box.querySelectorAll('.tc-flow-swatch').forEach(b => b.classList.toggle('active', b.dataset.palette === s.palette));
    const nm = document.getElementById('tc-flow-palette-name'); if (nm) nm.textContent = NAMES[s.palette] || '';
    for (const [k, id] of SLIDERS) {
      const i = document.getElementById(id); if (i) i.value = Math.round(s[k] * 100);
      const v = document.getElementById(id + '-val'); if (v) v.textContent = Math.round(s[k] * 100) + '%';
    }
  };
  const set = patch => { const s = { ...flowSettings(), ...patch }; save(s); applyNow(s); sync(); };
  box.addEventListener('click', e => { const b = e.target.closest('.tc-flow-swatch'); if (b) set({ palette: b.dataset.palette }); });
  for (const [k, id] of SLIDERS) document.getElementById(id)?.addEventListener('input', e => set({ [k]: +e.target.value / 100 }));
  document.getElementById('tc-flow-reset')?.addEventListener('click', () => set({ ...FLOW_DEFAULTS }));
  sync();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
}
