/**
 * m-ui: small pieces the phone's screens share. The icons the desktop does
 * not have, times and sizes as text, the toast, the sheet of choices that
 * comes up from the bottom, the file picker, and a long press.
 */
import { ICONS, applyIcons } from './icons.js';

export const $ = id => document.getElementById(id);

const S = inner => `<svg viewBox="0 0 24 24" class="ico" fill="none">${inner}</svg>`;
const line = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
Object.assign(ICONS, {
  back: S(`<path d="M15 5l-7 7 7 7" ${line}/>`),
  chevDown: S(`<path d="M5 9l7 7 7-7" ${line}/>`),
  chevRight: S(`<path d="M9 5l7 7-7 7" ${line}/>`),
  more: S('<circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/>'),
  person: S(`<circle cx="12" cy="8" r="4" ${line}/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" ${line}/>`),
  disc: S(`<circle cx="12" cy="12" r="9" ${line}/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>`),
  sparkle: S('<path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor"/>'),
  sub: S(`<rect x="2.5" y="5" width="19" height="14" rx="2.5" ${line}/><path d="M6.5 13.5h4M13 13.5h4.5M6.5 10h7M15.5 10h2" ${line}/>`),
  rotate: S(`<path d="M20 12a8 8 0 1 1-2.3-5.6" ${line}/><path d="M20 4v4.5h-4.5" ${line}/>`),
  speed: S(`<path d="M4.5 17a8 8 0 1 1 15 0" ${line}/><path d="M12 13l4-4" ${line}/><circle cx="12" cy="13" r="1.4" fill="currentColor"/>`),
  timer: S(`<circle cx="12" cy="13" r="8" ${line}/><path d="M12 9v4l2.5 2.5M9.5 2.5h5" ${line}/>`),
  queueNext: S(`<path d="M4 6h11M4 11h11M4 16h6" ${line}/><path d="M15 14.5v6l5-3z" fill="currentColor"/>`),
  queueAdd: S(`<path d="M4 6h11M4 11h11M4 16h7" ${line}/><path d="M17 13v7M13.5 16.5h7" ${line}/>`),
  share: S(`<circle cx="18" cy="5" r="2.5" ${line}/><circle cx="6" cy="12" r="2.5" ${line}/><circle cx="18" cy="19" r="2.5" ${line}/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" ${line}/>`),
  trash: S(`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" ${line}/>`),
  // v3.42.0: home, the video player's new controls, pictures and documents
  home: S(`<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" ${line}/>`),
  // v3.44.0: an update to download
  download: S(`<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" ${line}/>`),
  lock: S(`<rect x="5" y="11" width="14" height="10" rx="2" ${line}/><path d="M8 11V8a4 4 0 0 1 8 0v3" ${line}/>`),
  unlock: S(`<rect x="5" y="11" width="14" height="10" rx="2" ${line}/><path d="M8 11V8a4 4 0 0 1 7.5-2" ${line}/>`),
  aspect: S(`<rect x="3" y="6" width="18" height="12" rx="2" ${line}/><path d="M7 10V9h2M17 14v1h-2" ${line}/>`),
  mic: S(`<rect x="9" y="3" width="6" height="11" rx="3" ${line}/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" ${line}/>`),
  sun: S(`<circle cx="12" cy="12" r="4" ${line}/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" ${line}/>`),
  moon: S(`<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" ${line}/>`),
  slides: S(`<rect x="3" y="5" width="18" height="12" rx="2" ${line}/><path d="M10 8.5v5l4-2.5z" fill="currentColor"/><path d="M8 20h8" ${line}/>`),
  zoomIn: S(`<circle cx="11" cy="11" r="7" ${line}/><path d="M20 20l-4-4M11 8v6M8 11h6" ${line}/>`),
  abloop: S(`<path d="M4 7h11a5 5 0 0 1 0 10H9" ${line}/><path d="M7 14l-3 3 3 3" ${line}/>`),
  chip: S(`<rect x="6" y="6" width="12" height="12" rx="2" ${line}/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" ${line}/>`),
  burst: S(`<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" ${line}/>`),
  page: S(`<path d="M6 3h8l4 4v14H6z" ${line}/><path d="M14 3v4h4M9 12h6M9 16h6" ${line}/>`),
  rotateL: S(`<path d="M4 12a8 8 0 1 0 2.3-5.6" ${line}/><path d="M4 4v4.5h4.5" ${line}/>`),
  // v3.45.0: several chosen at once (m-select.js)
  selectAll: S(`<rect x="3.5" y="3.5" width="17" height="17" rx="4" ${line}/><path d="M8 12.2l2.8 2.8L16.2 9.5" ${line}/>`),
});
applyIcons();

/** Seconds as 3:07, or 1:02:07. */
export function fmtTime (s) {
  s = Math.max(0, Math.floor(+s || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
}

export function fmtSize (b) {
  b = +b || 0;
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return Math.round(b / 1048576) + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' KB';
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * A picture as a CSS background-image, with the placeholder (a note on the
 * theme's colours, mobile.css --art-ph) under it for when there is none or
 * it does not load. Single quotes: it goes inside style="...".
 */
export const artBg = url => `${url ? `url('${String(url).replace(/'/g, '%27')}')` : 'none'}, var(--art-ph)`;

/** A range input's filled part follows its value (mobile.css --p). */
export function fillRange (r) { const min = +r.min || 0, max = +r.max || 100; r.style.setProperty('--p', ((+r.value - min) / ((max - min) || 1) * 100) + '%'); }

// ── the toast ────────────────────────────────────────────────────────
let toastTimer = 0;
export function toast (text, ms = 2400) {
  const t = $('toast'); if (!t) return;
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

// ── the sheet: choices from the bottom of the screen ────────────────
let sheetClose = null;
// v3.45.0: a sheet a long press opens comes up under the finger still held
// there, and the click that ends that press landed on it: on the shade
// behind (which closed the sheet at once) or on one of its choices (which
// it then made). That click is not a choice: the press began before the
// sheet was there.
let pressing = false, guard = false;
document.addEventListener('pointerdown', () => { pressing = true; guard = false; }, true);
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { pressing = false; }, true);
const fresh = () => { if (!guard) return false; guard = false; return true; };
/**
 * open({ title, sub, art, items: [{ icon, label, note, on, danger, action }], body })
 * shows a sheet. An item's action runs after the sheet closes. body is an
 * element put under the items (the equaliser, the log). Returns close().
 */
export function sheet ({ title = '', sub = '', art = '', items = [], body = null, wide = false, onClose = null } = {}) {
  closeSheet();
  const s = $('sheet'), back = $('sheet-back');
  s.innerHTML = '';
  s.classList.toggle('m-sheet-wide', !!wide);
  if (title || sub || art) {
    const h = document.createElement('div'); h.className = 'sh-head';
    if (art) { const a = document.createElement('span'); a.className = 'sh-art art'; a.style.backgroundImage = artBg(art); h.appendChild(a); }
    const t = document.createElement('div'); t.className = 'sh-titles';
    t.innerHTML = `<div class="sh-title">${esc(title)}</div>` + (sub ? `<div class="sh-sub">${esc(sub)}</div>` : '');
    h.appendChild(t); s.appendChild(h);
  }
  for (const it of items) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sh-item' + (it.on ? ' on' : '') + (it.danger ? ' danger' : '');
    if (it.on !== undefined) b.setAttribute('aria-checked', String(!!it.on));
    b.innerHTML = (it.icon ? `<span class="sh-ico">${ICONS[it.icon] || ''}</span>` : '') + `<span class="sh-lbl">${esc(it.label)}${it.note ? `<span class="sh-note">${esc(it.note)}</span>` : ''}</span>` + (it.on ? `<span class="sh-check">${ICONS.check}</span>` : '');
    b.addEventListener('click', () => { if (fresh()) return; closeSheet(); setTimeout(() => it.action?.(), 0); });
    s.appendChild(b);
  }
  if (body) s.appendChild(body);
  back.classList.remove('hidden'); s.classList.remove('hidden');
  requestAnimationFrame(() => { back.classList.add('on'); s.classList.add('on'); });
  const close = () => {
    if (sheetClose !== close) return;
    sheetClose = null;
    back.classList.remove('on'); s.classList.remove('on');
    setTimeout(() => { if (!sheetClose) { back.classList.add('hidden'); s.classList.add('hidden'); s.innerHTML = ''; } }, 220);
    onClose?.();
  };
  sheetClose = close;
  back.onclick = () => { if (!fresh()) close(); };
  guard = pressing;
  return close;
}
export function closeSheet () { if (sheetClose) { sheetClose(); return true; } return false; }
export const sheetOpen = () => !!sheetClose;

// ── files ────────────────────────────────────────────────────────────
/** Android's file picker: the File chosen, or null. accept: '.lrc,.srt' or 'video/*'. */
export function pickFile (accept) {
  return new Promise(resolve => {
    const i = $('m-file');
    i.value = ''; i.accept = accept || '';
    let done = false;
    const finish = f => { if (done) return; done = true; window.removeEventListener('focus', onFocus); resolve(f || null); };
    const onFocus = () => setTimeout(() => finish(i.files?.[0]), 800);    // closed with nothing chosen
    i.onchange = () => finish(i.files?.[0]);
    window.addEventListener('focus', onFocus);
    i.click();
  });
}

// ── a long press ─────────────────────────────────────────────────────
/** fn(target, event) after a press held still for half a second, within root, on what matches sel. */
export function onLongPress (root, sel, fn) {
  let timer = 0, x = 0, y = 0, target = null, eat = false;
  const cancel = () => { clearTimeout(timer); timer = 0; target = null; };
  root.addEventListener('pointerdown', e => {
    eat = false;
    // A button inside the target (a row's ⋮) is its own. v3.43.0: the target
    // may be a button itself, as Home's cards are: their long press never came.
    const b = e.target.closest('button');
    target = e.target.closest(sel); if (!target || (b && b !== target && target.contains(b))) return;
    x = e.clientX; y = e.clientY;
    timer = setTimeout(() => { const t = target; cancel(); if (t) { t.dataset.long = '1'; eat = true; navigator.vibrate?.(12); fn(t, e); } }, 520);
  }, { passive: true });
  root.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - x, e.clientY - y) > 10) cancel(); }, { passive: true });
  for (const ev of ['pointerup', 'pointercancel', 'scroll']) root.addEventListener(ev, cancel, { passive: true, capture: ev === 'scroll' });
  // The click that ends a long press is not a tap. v3.45.0: also when the
  // long press drew the row again (choosing several does), so the element
  // the click lands on is a new one, not the one marked.
  root.addEventListener('click', e => {
    const t = e.target.closest(sel);
    if (t?.dataset.long || eat) { if (t) delete t.dataset.long; eat = false; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
}

/** Text for sorting and searching: lower case, no accents. */
export const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
export const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
