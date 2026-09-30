/**
 * lite-video: in the Lite build, tells the main process where the video area
 * is, so it can lay mpv's window over exactly that rectangle (v3.23.0).
 *
 * mpv used to draw into the Lite window itself, a child window covering the
 * whole page: on Windows the controls disappeared behind the picture during
 * playback (the field check's "lite" row). Now the picture covers #video-area
 * only, and the PiP bar, which must stay visible, makes the picture leave room
 * for it. Prompts sit over the menu row, so the picture never moves.
 */
const LITE = new URLSearchParams(location.search).get('lite') === '1';
// Overlays the picture leaves room for: only the PiP bar, which is there for
// the whole of PiP. Prompts used to be here too, and the picture shrank when
// one came up and grew back when it closed (v3.25.3): in Lite playback they
// now sit over the menu row instead (components.css).
const KEEP_VISIBLE = ['body.pip-mode .pip-bar'];

function shown(el) {
  if (!el || el.classList.contains('hidden')) return null;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

/** The rectangle for the video window, in page pixels, or null for none. */
export function videoRect() {
  const pv = document.getElementById('player-view');
  const area = document.getElementById('video-area');
  if (!pv?.classList.contains('active') || !document.body.classList.contains('playing')) return null;
  const a = shown(area);
  if (!a) return null;
  let top = a.top, bottom = a.bottom;
  const mid = (a.top + a.bottom) / 2;
  for (const sel of KEEP_VISIBLE) {
    for (const el of document.querySelectorAll(sel)) {
      const r = shown(el);
      if (!r || r.bottom <= top || r.top >= bottom || r.right <= a.left || r.left >= a.right) continue;
      if ((r.top + r.bottom) / 2 < mid) top = Math.max(top, r.bottom + 6);   // near the top: start below it
      else bottom = Math.min(bottom, r.top - 6);                              // near the bottom: end above it
    }
  }
  if (bottom - top < 2) return null;
  return { x: Math.round(a.left), y: Math.round(top), width: Math.round(a.width), height: Math.round(bottom - top) };
}

let last = '', queued = false;
function report() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const r = videoRect();
    const key = JSON.stringify(r);
    if (key === last) return;
    last = key;
    try { window.api?.video?.setRect(r); } catch {}
  });
}

if (LITE) {
  document.documentElement.classList.add('lite-window');
  const watch = new MutationObserver(report);
  const attach = () => {
    watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const pv = document.getElementById('player-view');
    if (pv) watch.observe(pv, { attributes: true, attributeFilter: ['class'] });
    for (const sel of ['#resume-prompt', '#default-player-prompt', '#update-banner', '#pip-overlay']) {
      const el = document.querySelector(sel);
      if (el) watch.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    }
    const area = document.getElementById('video-area');
    if (area && 'ResizeObserver' in window) new ResizeObserver(report).observe(area);
    window.addEventListener('resize', report);
    report();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
}
