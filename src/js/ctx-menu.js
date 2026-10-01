/**
 * ctx-menu: the right-click menu's submenus (v3.27.0). The menu used to show
 * seven sections at once, sliders and track lists included, with a close
 * button in the middle of it. Now the everyday actions are a short list, and
 * Audio, Subtitles, Video, Volume and View open as submenus: on hover, after
 * a moment, so moving across into one does not close it, or on click. A
 * submenu opens to the left, or moves up, when it would leave the window.
 * app.js still runs every action (data-a) and hides what does not apply now.
 */
const OPEN_DELAY = 90, CLOSE_DELAY = 280;

function place(item) {
  const sub = item.querySelector(':scope > .ctx-sub'); if (!sub) return;
  item.classList.remove('flip-x'); sub.style.top = '';
  let r = sub.getBoundingClientRect();
  if (r.right > window.innerWidth - 6) { item.classList.add('flip-x'); r = sub.getBoundingClientRect(); }
  const over = r.bottom - (window.innerHeight - 6);
  if (over > 0) sub.style.top = `${parseFloat(getComputedStyle(sub).top) - over}px`;
}

function open(item) {
  for (const sib of item.parentElement.querySelectorAll(':scope > .ctx-has-sub.open')) if (sib !== item) sib.classList.remove('open');
  item.classList.add('open');
  place(item);
}

function wire(panel) {
  for (const item of panel.querySelectorAll('.ctx-has-sub')) {
    let t = null;
    item.addEventListener('mouseenter', () => { clearTimeout(t); t = setTimeout(() => open(item), OPEN_DELAY); });
    item.addEventListener('mouseleave', () => { clearTimeout(t); t = setTimeout(() => item.classList.remove('open'), CLOSE_DELAY); });
    item.querySelector(':scope > .ctx-label')?.addEventListener('click', e => {
      e.stopPropagation(); clearTimeout(t);
      item.classList.contains('open') ? item.classList.remove('open') : open(item);
    });
  }
  // Closed menu: no submenu left open for next time. (The renderer smoke test's
  // simulated page has no MutationObserver, and app.js must load there.)
  if (typeof MutationObserver === 'undefined') return;
  new MutationObserver(() => {
    if (panel.classList.contains('hidden')) panel.querySelectorAll('.ctx-has-sub.open').forEach(i => i.classList.remove('open'));
  }).observe(panel, { attributes: true, attributeFilter: ['class'] });
}

if (typeof document !== 'undefined') {
  const go = () => { const p = document.getElementById('ctx-panel'); if (p) wire(p); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}
