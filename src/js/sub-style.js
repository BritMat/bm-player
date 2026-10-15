/**
 * sub-style: how subtitles look (v3.28.0, more in v3.39.0): the font, the
 * colour, the edge round the letters and bold. Chosen in the right-click
 * menu's Subtitles submenu, or in the Subtitle style window it opens, kept
 * between sessions, and applied when mpv starts and whenever a file starts
 * (app.js). The fonts in the submenu are buttons, not a dropdown: a native
 * dropdown's list sits outside a hover submenu and would close it.
 *
 * The edge (v3.39.0). Subtitles always had a thick black outline and a
 * shadow under it. Newer mpv (0.41 on the laptop) draws that shadow in black
 * at 70% (its sub-back-color, light grey in 0.37), so the letters sat in a
 * dark smudge, whatever the subtitle. Now it is a choice, and plain outline is the default:
 *   outline  a thin black outline, no shadow
 *   shadow   a thinner outline and a soft shadow
 *   box      the text on a see-through dark box
 *   none     the letters alone
 * Subtitles that come styled (ASS) keep their own look, unless something
 * here was changed from the default, which then applies to them too.
 *
 * More fonts (v3.39.0): every font installed on the computer, listed in the
 * window with a search box, each shown in itself. mpv finds an installed
 * font by its name, so any of them works.
 */
const KEY = 'bm_sub_style';
export const SUB_DEFAULTS = { font: '', color: '', edge: 'outline', bold: true };
// In order: mpv takes them one after another. mpv 0.37 has no
// sub-border-style, draws a box whenever sub-back-color is not clear, and
// keeps the shadow's colour apart (sub-shadow-color). Newer mpv has the box
// as a border style, and sub-shadow-color is another name for sub-back-color. So
// the back colour is cleared first and the shadow's colour set after it,
// which comes out right on both, and the box works on both (tried on 0.37).
export const SUB_EDGES = {
  outline: { label: 'Outline', props: [['sub-border-style', 'outline-and-shadow'], ['sub-back-color', '#00000000'], ['sub-border-size', 2.2], ['sub-shadow-offset', 0], ['sub-blur', 0]] },
  shadow:  { label: 'Shadow',  props: [['sub-border-style', 'outline-and-shadow'], ['sub-back-color', '#00000000'], ['sub-shadow-color', '#99000000'], ['sub-border-size', 1.2], ['sub-shadow-offset', 1.8], ['sub-blur', 0.7]] },
  box:     { label: 'Box',     props: [['sub-border-style', 'background-box'], ['sub-back-color', '#A6000000'], ['sub-border-size', 0], ['sub-shadow-offset', 6], ['sub-blur', 0]] },
  none:    { label: 'None',    props: [['sub-border-style', 'outline-and-shadow'], ['sub-back-color', '#00000000'], ['sub-border-size', 0], ['sub-shadow-offset', 0], ['sub-blur', 0]] },
};
// Fonts most Windows machines have, for when the installed ones cannot be listed.
const COMMON_FONTS = ['Arial', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
  'Courier New', 'Franklin Gothic Medium', 'Gabriola', 'Georgia', 'Impact', 'Lucida Console', 'Palatino Linotype', 'Segoe Print',
  'Segoe Script', 'Segoe UI', 'Sitka Text', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

export function subStyle() {
  let s;
  try { s = { ...SUB_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { s = { ...SUB_DEFAULTS }; }
  if (!SUB_EDGES[s.edge]) s.edge = SUB_DEFAULTS.edge;
  s.bold = s.bold !== false;
  return s;
}
/** Anything changed from how subtitles look by default. */
export const subStyled = s => !!(s.font || s.color || s.edge !== SUB_DEFAULTS.edge || s.bold !== SUB_DEFAULTS.bold);

export function applySubStyle(api = window.bmApp?.api) {
  const s = subStyle(), mpv = api?.mpv; if (!mpv) return;
  const set = (k, v) => { try { const r = mpv.cmd('set_property', k, v); r?.catch?.(() => {}); } catch (_) {} };
  set('sub-font', s.font || (navigator.userAgent.includes('Windows') ? 'Segoe UI' : 'sans-serif'));
  set('sub-color', s.color || '#FFFFFFFF');
  set('sub-bold', s.bold ? 'yes' : 'no');
  for (const [k, v] of SUB_EDGES[s.edge].props) set(k, v);
  set('sub-ass-override', subStyled(s) ? 'force' : 'scale');
}

export function setSubStyle(patch, osd) {
  const s = { ...subStyle(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  applySubStyle(); sync();
  if (osd) window.bmApp?.showOSD?.(osd);
}

function sync() {
  const s = subStyle();
  document.querySelectorAll('#ctx-sub-colors button, #ss-colors button').forEach(b => b.classList.toggle('active', (b.dataset.c || '') === s.color));
  document.querySelectorAll('#ctx-sub-fonts button[data-f]').forEach(b => b.classList.toggle('active', (b.dataset.f || '') === s.font));
  document.querySelectorAll('#ctx-sub-edges button, #ss-edges button').forEach(b => b.classList.toggle('active', b.dataset.e === s.edge));
  const bold = document.getElementById('ss-bold'); if (bold) bold.checked = s.bold;
  const col = document.getElementById('set-sub-color'); if (col) col.value = (s.color || '#FFFFFF').slice(0, 7).toLowerCase();
  const lab = document.getElementById('set-sub-color-val'); if (lab) lab.textContent = (s.color || '#FFFFFF').toUpperCase();
  for (const r of document.querySelectorAll('#ss-fonts .ss-font')) { const on = (r.dataset.f || '') === s.font; r.classList.toggle('active', on); r.setAttribute('aria-selected', String(on)); }
  const fn = document.getElementById('ss-font-now'); if (fn) fn.textContent = s.font || 'Default';
  preview(s);
}

/** The sample in the window, drawn as near to mpv's look as CSS can. */
function preview(s = subStyle()) {
  const p = document.getElementById('ss-preview-text'); if (!p) return;
  p.style.fontFamily = s.font ? `"${s.font}", sans-serif` : '';
  p.style.color = (s.color || '#FFFFFF').slice(0, 7);
  p.style.fontWeight = s.bold ? '700' : '400';
  p.dataset.edge = s.edge;
}

// Every installed font family, once (the Local Font Access API, which Electron
// grants the page), or the common ones where that cannot be had.
let fontList = null;
export async function installedFonts() {
  if (fontList) return fontList;
  let fams = [];
  try { const all = await window.queryLocalFonts?.(); fams = [...new Set((all || []).map(f => f.family).filter(Boolean))]; } catch (_) {}
  const listed = fams.length > 0;
  if (!listed) fams = COMMON_FONTS.slice();
  fontList = { fams: fams.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), listed };
  return fontList;
}

async function fillFonts(q = '') {
  const box = document.getElementById('ss-fonts'); if (!box) return;
  const { fams, listed } = await installedFonts();
  const want = q.trim().toLowerCase(), s = subStyle();
  box.textContent = '';
  // The name in the app's own letters (a symbol font's name in itself is not
  // readable), and a sample in the font beside it.
  const row = (f, label) => {
    const r = document.createElement('div');
    r.className = 'ss-font'; r.dataset.f = f; r.tabIndex = -1; r.setAttribute('role', 'option');
    const n = document.createElement('span'); n.className = 'ss-font-name'; n.textContent = label || f;
    const x = document.createElement('span'); x.className = 'ss-font-sample'; x.textContent = 'Subtitles 123'; x.setAttribute('aria-hidden', 'true');
    if (f) x.style.fontFamily = `"${f}", sans-serif`;
    r.append(n, x);
    const on = f === s.font; r.classList.toggle('active', on); r.setAttribute('aria-selected', String(on));
    box.appendChild(r);
  };
  if (!want) row('', 'Default');
  const shown = fams.filter(f => !want || f.toLowerCase().includes(want));
  for (const f of shown) row(f);
  if (!shown.length && want) { const e = document.createElement('div'); e.className = 'ss-empty'; e.textContent = 'No installed font has that in its name.'; box.appendChild(e); }
  const note = document.getElementById('ss-fonts-note');
  if (note) note.textContent = listed ? `${fams.length} fonts on this computer` : 'The installed fonts could not be listed: these are common ones.';
}

export function openSubStyle() {
  const d = document.getElementById('dlg-substyle'); if (!d) return;
  wireDialog();
  d.classList.remove('hidden');
  sync();
  const q = document.getElementById('ss-search'); if (q) q.value = '';
  fillFonts().then(() => {
    document.querySelector('#ss-fonts .ss-font.active')?.scrollIntoView({ block: 'center' });
    q?.focus({ preventScroll: true });
  });
}
export const closeSubStyle = () => document.getElementById('dlg-substyle')?.classList.add('hidden');

let dialogWired = false;
function wireDialog() {
  if (dialogWired) return; dialogWired = true;
  const d = document.getElementById('dlg-substyle');
  d.addEventListener('mousedown', e => { if (e.target === d) closeSubStyle(); });
  document.getElementById('ss-done')?.addEventListener('click', closeSubStyle);
  document.getElementById('ss-reset')?.addEventListener('click', () => setSubStyle({ ...SUB_DEFAULTS }, 'Subtitles: default look'));
  document.getElementById('ss-search')?.addEventListener('input', e => fillFonts(e.target.value));
  const fonts = document.getElementById('ss-fonts');
  fonts?.addEventListener('click', e => { const r = e.target.closest('.ss-font'); if (r) setSubStyle({ font: r.dataset.f || '' }, 'Subtitle font: ' + (r.dataset.f || 'Default')); });
  fonts?.addEventListener('keydown', e => {
    const rows = [...fonts.querySelectorAll('.ss-font')], i = rows.indexOf(e.target.closest('.ss-font'));
    const go = j => { const r = rows[Math.max(0, Math.min(rows.length - 1, j))]; r?.focus(); r?.scrollIntoView({ block: 'nearest' }); };
    if (e.key === 'ArrowDown') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); i <= 0 ? document.getElementById('ss-search')?.focus() : go(i - 1); }
    else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); rows[i].click(); }
  });
  document.getElementById('ss-search')?.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); fonts?.querySelector('.ss-font')?.focus(); } });
  document.getElementById('ss-edges')?.addEventListener('click', e => { const b = e.target.closest('button[data-e]'); if (b) setSubStyle({ edge: b.dataset.e }, 'Subtitle edge: ' + SUB_EDGES[b.dataset.e].label); });
  document.getElementById('ss-colors')?.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSubStyle({ color: b.dataset.c || '' }, 'Subtitle colour: ' + b.title); });
  document.getElementById('ss-bold')?.addEventListener('change', e => setSubStyle({ bold: e.target.checked }, e.target.checked ? 'Subtitles in bold' : 'Subtitles not in bold'));
  d.querySelectorAll('#ss-colors button[data-c]').forEach(b => { if (b.dataset.c) b.style.background = b.dataset.c; });
}

function wire() {
  const colors = document.getElementById('ctx-sub-colors'), fonts = document.getElementById('ctx-sub-fonts'), edges = document.getElementById('ctx-sub-edges');
  if (!colors || !fonts) return;
  colors.querySelectorAll('button[data-c]').forEach(b => { if (b.dataset.c) b.style.background = b.dataset.c; });
  fonts.querySelectorAll('button[data-f]').forEach(b => { if (b.dataset.f) b.style.fontFamily = `"${b.dataset.f}", sans-serif`; });
  colors.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSubStyle({ color: b.dataset.c || '' }, 'Subtitle colour: ' + b.title); });
  fonts.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'ctx-sub-more') { window.bmApp?._closeCtxPanel?.(); openSubStyle(); return; }
    setSubStyle({ font: b.dataset.f || '' }, 'Subtitle font: ' + b.textContent);
  });
  edges?.addEventListener('click', e => { const b = e.target.closest('button[data-e]'); if (b) setSubStyle({ edge: b.dataset.e }, 'Subtitle edge: ' + SUB_EDGES[b.dataset.e].label); });
  // The settings panel's colour is this colour (it was a second one, and the
  // next file put this one back over it).
  document.getElementById('set-sub-color')?.addEventListener('change', e => setSubStyle({ color: (e.target.value || '').toUpperCase() }, 'Subtitle colour changed'));
  window.bmSubStyle = { open: openSubStyle, close: closeSubStyle, apply: applySubStyle, set: setSubStyle, get: subStyle };
  sync();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
}
