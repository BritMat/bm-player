/**
 * m-sub (v3.42.0): a folder of videos or an album of pictures, sliding in
 * over its tab, as an album does over the music. One at a time.
 *
 *   openSub({ title, act: { icon, label, run }, fill(scroller), onClose })
 *
 * fill(scroller) fills the list (a VList, usually); act is an optional
 * button at the top right (the list or grid switch).
 */
import { $ } from './m-ui.js';
import { ICONS } from './icons.js';

let cur = null;

export function initSub () {
  $('sub-back').addEventListener('click', () => closeSub());
  $('sub-act').addEventListener('click', () => cur?.act?.run?.());
}

export function openSub (o) {
  closeSub(true);
  cur = o;
  const v = $('v-sub');
  $('sub-title').textContent = o.title || '';
  setAct(o.act);
  v.classList.remove('hidden');
  o.fill($('sub-list'));
  requestAnimationFrame(() => v.classList.add('on'));
}

/** The button at the top right: { icon, label, run }, or none. */
export function setAct (act) {
  const b = $('sub-act');
  if (cur) cur.act = act;
  b.classList.toggle('hidden', !act);
  if (act) { b.innerHTML = ICONS[act.icon] || ''; b.setAttribute('aria-label', act.label || ''); }
}

export function closeSub (now = false) {
  if (!cur) return false;
  const o = cur; cur = null;
  const v = $('v-sub');
  v.classList.remove('on');
  const done = () => { if (!cur) { v.classList.add('hidden'); $('sub-list').textContent = ''; } };
  if (now) done(); else setTimeout(done, 230);
  try { o.onClose?.(); } catch (_) {}
  return true;
}

export const subOpen = () => !!cur;
export const subOwner = () => cur?.owner || null;
