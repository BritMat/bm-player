/**
 * m-select (v3.45.0): several pictures, videos or songs chosen at once, to
 * share them or delete them from the phone. A long press on one starts it,
 * with that one chosen; taps then add or take away, and a bar over the top
 * of the screen says how many and what can be done with them. The X, Back,
 * another tab or taking the last one away ends it.
 *
 *   startSelect({ key, kind, scroller, items, refresh, actions }, first)
 *
 * key names the list (a tab's own, or a folder's over it); kind is 'image',
 * 'video' or 'audio'; scroller is the element the list scrolls in; items()
 * is the list as shown (for Select all); refresh() draws its rows again;
 * actions are the bar's buttons: [{ icon, label, run(items) }].
 *
 * A list's rows say whether they are chosen with mark(key, id) (a class)
 * and ring(key) (the round mark drawn on them), and carry data-id, so a tap
 * changes one row without drawing the others again.
 */
import { $, esc, toast } from './m-ui.js';
import { ICONS } from './icons.js';
import { call, has } from './m-android.js';

const s = { key: null, o: null, picked: new Map() };

export function initSelect () {
  $('sel-x').addEventListener('click', () => endSelect());
  $('sel-all').addEventListener('click', () => {
    if (!s.o) return;
    const all = s.o.items();
    if (all.length && all.every(x => s.picked.has(x.id))) { endSelect(); return; }
    for (const x of all) s.picked.set(x.id, x);
    s.o.refresh();
    bar();
  });
  $('sel-acts').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b || !s.o) return;
    const a = s.o.actions[+b.dataset.a]; if (!a) return;
    // In the list's order, whatever order they were chosen in.
    const at = new Map(s.o.items().map((x, i) => [x.id, i]));
    a.run([...s.picked.values()].sort((x, y) => (at.get(x.id) ?? 1e9) - (at.get(y.id) ?? 1e9)));
  });
}

const TYPES = { image: 'image/*', video: 'video/*', audio: 'audio/*' };
/** Sends them to another app, as the files themselves: one, or several at once. */
export function shareItems (kind, items) {
  const list = (items || []).filter(x => x?.url);
  if (!list.length) return;
  if (list.length === 1 || !has('shareFiles')) { call('shareFile', list[0].url, list[0].mime || TYPES[kind] || '*/*'); return; }
  if (list.length > 500) toast('The first 500 go: Android takes no more at once.', 3000);
  call('shareFiles', JSON.stringify({ srcs: list.slice(0, 500).map(x => x.url), type: TYPES[kind] || '*/*' }));
}

/** Whether a choosing is going on (in that list, when key is given). */
export const selecting = key => s.key !== null && (key === undefined || s.key === key);
export const selectedItems = () => [...s.picked.values()];

/** ' sel' for a row of that list that is chosen, else ''. */
export const mark = (key, id) => (s.key === key && s.picked.has(id) ? ' sel' : '');
/** The round mark on each row while that list is being chosen from. */
export const ring = key => (s.key === key ? '<i class="sel-mark" aria-hidden="true"></i>' : '');

export function startSelect (o, first) {
  if (s.key !== null) endSelect();
  s.key = o.key; s.o = o; s.picked = new Map();
  if (first) s.picked.set(first.id, first);
  o.scroller.classList.add('selecting');
  const acts = $('sel-acts');
  acts.innerHTML = o.actions.map((a, i) => `<button class="m-ib" type="button" data-a="${i}" aria-label="${esc(a.label)}">${ICONS[a.icon] || ''}</button>`).join('');
  o.refresh();
  bar();
  const b = $('sel-bar');
  b.classList.remove('hidden');
  requestAnimationFrame(() => b.classList.add('on'));
}

/** Chooses it, or takes it away. Taking the last one away ends the choosing. */
export function toggle (item) {
  if (!s.o || !item) return;
  const on = !s.picked.has(item.id);
  if (on) s.picked.set(item.id, item); else s.picked.delete(item.id);
  if (!s.picked.size) { endSelect(); return; }
  for (const el of s.o.scroller.querySelectorAll(`[data-id="${CSS.escape(String(item.id))}"]`)) el.classList.toggle('sel', on);
  bar();
}

/** Ends it (only that list's, when key is given). True when there was one. */
export function endSelect (key) {
  if (s.key === null || (key !== undefined && s.key !== key)) return false;
  const o = s.o;
  s.key = null; s.o = null; s.picked = new Map();
  o.scroller.classList.remove('selecting');
  try { o.refresh(); } catch (_) {}
  const b = $('sel-bar');
  b.classList.remove('on');
  setTimeout(() => { if (s.key === null) b.classList.add('hidden'); }, 200);
  return true;
}

/** The items deleted from the phone taken out of what is chosen (m-delete.js). */
export function dropChosen (ids) {
  if (!s.o) return;
  for (const id of ids) s.picked.delete(id);
  if (!s.picked.size) endSelect(); else bar();
}

function bar () {
  const n = s.picked.size, all = s.o?.items() || [];
  $('sel-n').textContent = `${n} selected`;
  const every = all.length > 0 && all.every(x => s.picked.has(x.id));
  $('sel-all').setAttribute('aria-label', every ? 'Select none' : 'Select all');
  $('sel-all').classList.toggle('on', every);
}
