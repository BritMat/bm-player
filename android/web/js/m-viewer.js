/**
 * m-viewer (v3.42.0): pictures, full screen.
 *
 * Pinch, or a double tap, to zoom; drag to look around a zoomed picture;
 * swipe sideways to the next or previous one in the album; swipe down to
 * close; a tap shows or hides the bars. Turn the picture, share it, open it
 * in another app, see its details, or play the album as a slideshow.
 * Pictures another app opens in BM Player come here too, by themselves.
 *
 * Big photos are fetched no larger than the screen can show (Java scales
 * them, /media/image/ID?fit=N): a 50-megapixel photo decoded whole would
 * take hundreds of megabytes.
 */
import { $, esc, fmtSize, sheet, toast } from './m-ui.js';
import { call } from './m-android.js';
import { remember } from './m-recent.js';
import { isFav, toggleFav, imageFav, imageKey } from './m-favs.js';
import { setIcon } from './icons.js';

const v = { open: false, list: [], i: 0, z: 1, x: 0, y: 0, rot: 0, slideT: 0, uiT: 0 };
let strip, slides = [];

export function initViewer () {
  strip = $('iv-strip');
  strip.innerHTML = '<div class="iv-slide"><img alt="" draggable="false"></div>'.repeat(3);
  slides = [...strip.children];
  $('iv-back').addEventListener('click', closeViewer);
  $('iv-rotate').addEventListener('click', () => { v.rot = (v.rot + 270) % 360; reset(); apply(); });
  $('iv-share').addEventListener('click', () => { const it = cur(); if (it) call('shareFile', it.url, it.mime || 'image/*'); });
  $('iv-more').addEventListener('click', more);
  // v3.43.0: the star, for Home's Favourites row
  $('iv-fav').addEventListener('click', () => { const it = cur(); if (!it) return; toast(toggleFav(imageFav(it)) ? 'Added to favourites' : 'Taken out of favourites', 1300); markFav(); });
  $('iv-info').addEventListener('click', details);
  $('iv-show').addEventListener('click', () => (v.slideT ? stopShow() : startShow()));
  wireTouch($('iv'));
  window.addEventListener('resize', () => { if (v.open) { reset(); place(); apply(); } });
}

const cur = () => v.list[v.i];

/** Opens pictures: list of { url, title, mime, w, h, size, ... }, at index. */
export function openImages (list, index = 0) {
  v.list = list.slice(); v.i = Math.max(0, Math.min(index, v.list.length - 1));
  v.open = true; v.rot = 0;
  const iv = $('iv');
  iv.classList.remove('hidden');
  requestAnimationFrame(() => iv.classList.add('on'));
  iv.classList.add('ui');
  call('immersive', true);
  load(); reset(); place(); apply();
  const it = cur();
  if (it && /^\/opened\//.test(it.url)) remember({ kind: 'image', key: imageKey(it), title: it.title, sub: 'Picture', url: it.url, docKey: it.docKey || null });
}

export function closeViewer () {
  if (!v.open) return false;
  v.open = false; stopShow();
  const iv = $('iv');
  iv.classList.remove('on');
  setTimeout(() => { if (!v.open) { iv.classList.add('hidden'); for (const s of slides) s.firstElementChild.removeAttribute('src'); } }, 220);
  call('immersive', false);
  return true;
}
export const viewerOpen = () => v.open;

function src (it) {
  if (!it) return '';
  // Library pictures larger than the screen are fetched scaled (see above).
  const max = Math.min(4096, Math.round(Math.max(screen.width, screen.height) * Math.min(2, devicePixelRatio || 1) * 1.6));
  return /^\/media\/image\//.test(it.url) && it.w * it.h > max * max ? `${it.url}?fit=${max}` : it.url;
}

/** The three slides: previous, this one, next. */
function load () {
  for (let k = -1; k <= 1; k++) {
    const img = slides[k + 1].firstElementChild, it = v.list[v.i + k];
    const s = src(it);
    if (!s) { img.removeAttribute('src'); continue; }
    if (img.getAttribute('src') !== s) { img.src = s; img.onload = () => { if (k === 0) { place(); apply(); } }; }
  }
  const it = cur();
  $('iv-title').textContent = it?.title || '';
  $('iv-meta').textContent = [it?.w && it?.h ? `${it.w} × ${it.h}` : '', it?.size ? fmtSize(it.size) : '', it?.taken ? new Date(it.taken).toLocaleDateString() : ''].filter(Boolean).join(' · ');
  $('iv-count').textContent = v.list.length > 1 ? `${v.i + 1} / ${v.list.length}` : '';
  $('iv-show').classList.toggle('hidden', v.list.length < 2);
  markFav();
}

function markFav () {
  const it = cur(), on = !!it && isFav(imageKey(it)), b = $('iv-fav');
  setIcon(b, on ? 'starFill' : 'star');
  b.classList.toggle('on', on);
  b.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
  b.setAttribute('aria-pressed', String(on));
}

function reset () { v.z = 1; v.x = 0; v.y = 0; }
/** Where the slides sit: side by side, this one in the middle. */
function place (dx = 0, animate = false) {
  strip.style.transition = animate ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none';
  strip.style.transform = `translateX(${-window.innerWidth + dx}px)`;
}
function apply () {
  const img = slides[1].firstElementChild;
  img.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z}) rotate(${v.rot}deg)`;
  slides[0].firstElementChild.style.transform = slides[2].firstElementChild.style.transform = '';
}

/** How big the picture shows at zoom 1 (it fits the screen), turned as it is. */
function fitSize () {
  const img = slides[1].firstElementChild, W = window.innerWidth, H = window.innerHeight;
  let w = img.naturalWidth || W, h = img.naturalHeight || H;
  if (v.rot % 180) [w, h] = [h, w];
  const k = Math.min(W / w, H / h);
  return [w * k, h * k];
}
function clamp () {
  const [w, h] = fitSize(), W = window.innerWidth, H = window.innerHeight;
  const mx = Math.max(0, (w * v.z - W) / 2), my = Math.max(0, (h * v.z - H) / 2);
  v.x = Math.max(-mx, Math.min(mx, v.x)); v.y = Math.max(-my, Math.min(my, v.y));
}

function go (d) {
  const j = v.i + d;
  if (j < 0 || j >= v.list.length) { place(0, true); return false; }
  place(-d * window.innerWidth, true);
  setTimeout(() => {
    v.i = j; v.rot = 0; reset();
    // the slides move round: the one shown becomes the middle one
    if (d > 0) strip.appendChild(slides[0]); else strip.insertBefore(slides[2], slides[0]);
    slides = [...strip.children];
    place(); load(); apply();
  }, 230);
  return true;
}

function ui (on = !$('iv').classList.contains('ui')) { $('iv').classList.toggle('ui', on); }

function wireTouch (el) {
  const pts = new Map();
  let g = null, lastTap = 0, tapT = 0;
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.iv-top, .iv-bottom')) return;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopShow();
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      g = { pinch: true, d0: Math.hypot(a.x - b.x, a.y - b.y), z0: v.z, x0: v.x, y0: v.y, cx: (a.x + b.x) / 2 - window.innerWidth / 2, cy: (a.y + b.y) / 2 - window.innerHeight / 2 };
    } else if (pts.size === 1) g = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, t0: performance.now(), kind: null };
  });
  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p || !g) return;
    p.x = e.clientX; p.y = e.clientY;
    if (g.pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const z = Math.max(1, Math.min(6, g.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.d0)));
      // zoom about the fingers' middle
      const k = z / g.z0;
      v.x = g.cx - (g.cx - g.x0) * k; v.y = g.cy - (g.cy - g.y0) * k; v.z = z;
      clamp(); apply();
      return;
    }
    if (g.pinch) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.kind) {
      if (Math.hypot(dx, dy) < 10) return;
      g.kind = v.z > 1.01 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'swipe' : dy > 0 ? 'down' : 'none';
    }
    if (g.kind === 'pan') { v.x = g.vx + dx; v.y = g.vy + dy; clamp(); apply(); }
    else if (g.kind === 'swipe') place(dx);
    else if (g.kind === 'down') { slides[1].style.transform = `translateY(${Math.max(0, dy)}px)`; $('iv').style.background = `rgba(0,0,0,${Math.max(0.2, 1 - dy / 400)})`; }
  });
  const end = e => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (!g) return;
    if (g.pinch) { if (!pts.size) { g = null; if (v.z < 1.02) { reset(); apply(); } } return; }
    const was = g; g = null;
    if (!p) return;
    const dx = p.x - was.x0, dy = p.y - was.y0;
    if (was.kind === 'swipe') { if (Math.abs(dx) > window.innerWidth * 0.18) { if (!go(dx < 0 ? 1 : -1)) place(0, true); } else place(0, true); return; }
    if (was.kind === 'down') {
      slides[1].style.transform = ''; $('iv').style.background = '';
      if (dy > 140) closeViewer();
      return;
    }
    if (was.kind) return;
    // taps: one shows or hides the bars, two zoom in or out
    const now = performance.now();
    if (now - lastTap < 300) {
      clearTimeout(tapT); lastTap = 0;
      if (v.z > 1.01) reset();
      else { const z = 2.5, cx = p.x - window.innerWidth / 2, cy = p.y - window.innerHeight / 2; v.z = z; v.x = -cx * (z - 1); v.y = -cy * (z - 1); clamp(); }
      const img = slides[1].firstElementChild;
      img.style.transition = 'transform .2s'; apply(); setTimeout(() => { img.style.transition = ''; }, 220);
      return;
    }
    lastTap = now;
    tapT = setTimeout(() => ui(), 280);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function startShow () {
  if (v.list.length < 2) return;
  ui(false);
  toast('Slideshow: a tap stops it', 1400);
  v.slideT = setInterval(() => { if (!go(1)) stopShow(); }, 3200);
  $('iv-show').classList.add('on');
}
function stopShow () { clearInterval(v.slideT); v.slideT = 0; $('iv-show')?.classList.remove('on'); }

function details () {
  const it = cur(); if (!it) return;
  const rows = [['Name', it.title], ['Where', it.path || ''], ['Size', it.size ? fmtSize(it.size) : ''], ['Picture', it.w && it.h ? `${it.w} × ${it.h}` : ''],
    ['Taken', it.taken ? new Date(it.taken).toLocaleString() : ''], ['Added', it.added ? new Date(it.added * 1000).toLocaleString() : ''], ['Type', it.mime || '']];
  const body = document.createElement('div'); body.className = 'sh-info';
  body.innerHTML = rows.filter(r => r[1]).map(([k, val]) => `<div class="sh-info-row"><span>${esc(k)}</span><span>${esc(val)}</span></div>`).join('');
  sheet({ title: it.title, body });
}

function more () {
  const it = cur(); if (!it) return;
  sheet({ title: it.title, items: [
    { icon: 'share', label: 'Share', action: () => call('shareFile', it.url, it.mime || 'image/*') },
    { icon: 'playFile', label: 'Open in another app', action: () => call('openWith', it.url) },
    { icon: 'rotateL', label: 'Turn it', action: () => { v.rot = (v.rot + 270) % 360; reset(); apply(); } },
    ...(v.list.length > 1 ? [{ icon: 'slides', label: 'Slideshow', action: startShow }] : []),
    { icon: 'info', label: 'Details', action: details },
  ] });
}

/** Back: zoomed in, back to the whole picture; else close. */
export function viewerBack () {
  if (!v.open) return false;
  if (v.z > 1.01) { reset(); apply(); return true; }
  closeViewer();
  return true;
}
