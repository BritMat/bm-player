/**
 * sub-style: subtitle font and colour (v3.28.0), chosen in the right-click
 * menu's Subtitles submenu, kept between sessions and applied whenever a file
 * starts (app.js playMedia). Default leaves a file's own styling alone. A
 * chosen font or colour applies to every subtitle, styled ASS ones included
 * (sub-ass-override=force). The fonts are buttons, not a dropdown: a native
 * dropdown's list sits outside a hover submenu and would close it.
 */
const KEY = 'bm_sub_style';
export const SUB_DEFAULTS = { font: '', color: '' };
export function subStyle() {
  try { return { ...SUB_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...SUB_DEFAULTS }; }
}

export function applySubStyle(api = window.bmApp?.api) {
  const s = subStyle(), mpv = api?.mpv; if (!mpv) return;
  mpv.cmd('set_property', 'sub-font', s.font || 'sans-serif');
  mpv.cmd('set_property', 'sub-color', s.color || '#FFFFFFFF');
  mpv.cmd('set_property', 'sub-ass-override', (s.font || s.color) ? 'force' : 'scale');
}

function sync() {
  const s = subStyle();
  document.querySelectorAll('#ctx-sub-colors button').forEach(b => b.classList.toggle('active', (b.dataset.c || '') === s.color));
  document.querySelectorAll('#ctx-sub-fonts button').forEach(b => b.classList.toggle('active', (b.dataset.f || '') === s.font));
}

function set(patch, osd) {
  const s = { ...subStyle(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  applySubStyle(); sync();
  window.bmApp?.showOSD?.(osd);
}

function wire() {
  const colors = document.getElementById('ctx-sub-colors'), fonts = document.getElementById('ctx-sub-fonts');
  if (!colors || !fonts) return;
  colors.querySelectorAll('button[data-c]').forEach(b => { if (b.dataset.c) b.style.background = b.dataset.c; });
  fonts.querySelectorAll('button[data-f]').forEach(b => { if (b.dataset.f) b.style.fontFamily = `"${b.dataset.f}", sans-serif`; });
  colors.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ color: b.dataset.c || '' }, 'Subtitle colour: ' + b.title); });
  fonts.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set({ font: b.dataset.f || '' }, 'Subtitle font: ' + b.textContent); });
  sync();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
}
