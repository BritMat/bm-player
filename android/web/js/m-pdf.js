/**
 * m-pdf (v3.42.0): PDFs, read with pdf.js (Mozilla, Apache 2.0), the same
 * one the desktop's PDF tab uses.
 *
 * The pages scroll down, each drawn only while near the screen (a long
 * document stays light). Pinch to zoom, or a double tap; the page number
 * shows at the bottom and a tap on it goes to a page; find words (the
 * pages they are on, marked); the contents, where the document has them;
 * a dark page for reading at night; and each document opens again where
 * it was left. A document with a password asks for it.
 *
 * pdf.js is loaded the first time a PDF opens, so it costs nothing until
 * then. It reads the file in parts (HTTP ranges, LocalServer.java), so a
 * big document shows its first page without being read whole.
 */
import { $, esc, sheet, toast } from './m-ui.js';
import { call } from './m-android.js';
import { remember } from './m-recent.js';
import { isFav, toggleFav, pdfFav } from './m-favs.js';
import { setIcon } from './icons.js';

const POS = 'bm_m_pdfpos', NIGHT = 'bm_m_pdfnight';
const d = { open: false, doc: null, task: null, key: '', item: null, pages: [], zoom: 1, base: null, io: null, rendering: new Set(), find: null, uiT: 0, gen: 0 };
let libP = null;

function pdfjs () {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!libP) libP = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/pdf.min.js';
    s.onload = () => { if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; resolve(window.pdfjsLib); } else reject(new Error('pdf.js did not start')); };
    s.onerror = () => { libP = null; reject(new Error('pdf.js could not be loaded')); };
    document.head.appendChild(s);
  });
  return libP;
}

function markFav () {
  const on = !!d.key && isFav(d.key), b = $('pv-fav');
  setIcon(b, on ? 'starFill' : 'star');
  b.classList.toggle('on', on);
  b.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
  b.setAttribute('aria-pressed', String(on));
}

export function initPdf () {
  $('pv-back').addEventListener('click', closePdf);
  $('pv-more').addEventListener('click', more);
  // v3.43.0: the star, for Home's Favourites row
  $('pv-fav').addEventListener('click', () => { if (!d.item) return; toast(toggleFav(pdfFav(d.item, d.key)) ? 'Added to favourites' : 'Taken out of favourites', 1300); markFav(); });
  $('pv-find').addEventListener('click', () => { $('pv-search').classList.remove('hidden'); $('pv-q').focus(); });
  $('pv-search-x').addEventListener('click', closeFind);
  $('pv-search').addEventListener('submit', e => { e.preventDefault(); find($('pv-q').value); });
  $('pv-next-hit').addEventListener('click', () => hop(1));
  $('pv-prev-hit').addEventListener('click', () => hop(-1));
  $('pv-page').addEventListener('click', goToSheet);
  const body = $('pv-body');
  body.addEventListener('scroll', () => { pageLabel(); savePos(); }, { passive: true });
  wireZoom(body);
  $('pv').classList.toggle('night', localStorage.getItem(NIGHT) === '1');
}

/** Opens a PDF: { url, title, key, docKey }. */
export async function openPdf (item) {
  closePdf(true);
  const gen = ++d.gen;
  d.open = true; d.item = item; d.key = item.key || 'p' + (item.docKey || item.url);
  const pv = $('pv');
  pv.classList.remove('hidden');
  requestAnimationFrame(() => pv.classList.add('on'));
  $('pv-title').textContent = item.title || 'Document';
  $('pv-meta').textContent = 'Opening…';
  $('pv-pages').innerHTML = '';
  msg('<div class="m-spin"></div>');
  remember({ kind: 'pdf', key: d.key, title: item.title || 'Document', sub: 'PDF', url: item.url, docKey: item.docKey || null });
  markFav();
  let lib;
  try { lib = await pdfjs(); } catch (e) { return fail('This phone\'s web engine could not start the PDF reader (' + e.message + '). Updating Android System WebView from the Play Store may help.'); }
  if (gen !== d.gen) return;
  try {
    d.task = lib.getDocument({ url: item.url, rangeChunkSize: 262144, disableAutoFetch: true, isEvalSupported: false });
    d.task.onPassword = (update, reason) => askPassword(update, reason === lib.PasswordResponses?.INCORRECT_PASSWORD);
    d.doc = await d.task.promise;
  } catch (e) {
    if (gen !== d.gen) return;
    return fail(/password/i.test(e?.name || '') ? 'This PDF needs its password.' : 'This file could not be read as a PDF: ' + (e?.message || e));
  }
  if (gen !== d.gen) { d.doc?.destroy(); return; }
  msg('');
  const p1 = await d.doc.getPage(1);
  d.base = p1.getViewport({ scale: 1 });
  layout();
  $('pv-meta').textContent = `${d.doc.numPages} page${d.doc.numPages === 1 ? '' : 's'}`;
  // the pages' own sizes, as they come (most are all the same)
  (async () => { for (let n = 2; n <= d.doc.numPages && gen === d.gen; n++) { try { const pg = await d.doc.getPage(n); const vp = pg.getViewport({ scale: 1 }); if (Math.abs(vp.width / vp.height - d.base.width / d.base.height) > 0.01) { d.pages[n - 1].vp = vp; size(d.pages[n - 1]); } } catch (_) { break; } if (n % 20 === 0) await new Promise(r => setTimeout(r, 0)); } })();
  const at = (JSON.parse(localStorage.getItem(POS) || '{}') || {})[d.key];
  if (at > 1) { goTo(at, false); toast(`Page ${at}, where you left it`, 1600); }
  pageLabel();
}

export function closePdf (now = false) {
  if (!d.open) return false;
  savePos(true);
  d.open = false; d.gen++;
  d.io?.disconnect(); d.io = null;
  try { d.task?.destroy(); } catch (_) {}
  try { d.doc?.destroy(); } catch (_) {}
  d.doc = d.task = null; d.pages = []; d.find = null;
  const pv = $('pv');
  pv.classList.remove('on');
  closeFind();
  const done = () => { if (!d.open) { pv.classList.add('hidden'); $('pv-pages').innerHTML = ''; } };
  if (now) done(); else setTimeout(done, 220);
  return true;
}
export const pdfOpen = () => d.open;

function msg (html) { const m = $('pv-msg'); m.innerHTML = html; m.classList.toggle('hidden', !html); }
function fail (text) {
  msg(`<p>${esc(text)}</p><div class="vp-note-btns"><button class="m-btn" type="button" data-w>Open in another app</button></div>`);
  $('pv-msg').querySelector('[data-w]')?.addEventListener('click', () => call('openWith', d.item?.url));
  $('pv-meta').textContent = '';
}

function askPassword (update, wrong) {
  const body = document.createElement('form'); body.className = 'pv-pass';
  body.innerHTML = `<input type="password" autocomplete="off" placeholder="Password" aria-label="Password"><button class="m-btn" type="submit">Open</button>`;
  let sent = false;
  body.addEventListener('submit', e => { e.preventDefault(); sent = true; const p = body.querySelector('input').value; closeSheetSoon(); update(p); });
  const closeSheetSoon = sheet({ title: wrong ? 'That password is not right' : 'This PDF has a password', body, onClose: () => { if (!sent) fail('This PDF needs its password.'); } });
  setTimeout(() => body.querySelector('input')?.focus(), 250);
}

// ── the pages ────────────────────────────────────────────────────────
function width () { return Math.max(200, $('pv-body').clientWidth - 16) * d.zoom; }

function layout () {
  const box = $('pv-pages');
  box.innerHTML = '';
  d.pages = [];
  d.io?.disconnect();
  d.io = new IntersectionObserver(es => { for (const e of es) { const p = d.pages[+e.target.dataset.n - 1]; if (!p) continue; p.near = e.isIntersecting; if (p.near) draw(p); else drop(p); } }, { root: $('pv-body'), rootMargin: '120% 0px' });
  for (let n = 1; n <= d.doc.numPages; n++) {
    const el = document.createElement('div');
    el.className = 'pv-p'; el.dataset.n = String(n);
    el.innerHTML = `<span class="pv-pn">${n}</span>`;
    box.appendChild(el);
    const p = { n, el, vp: null, canvas: null, scale: 0, marks: null };
    d.pages.push(p);
    size(p);
    d.io.observe(el);
  }
  box.style.width = (width() + 16) + 'px';
}

function size (p) {
  const vp = p.vp || d.base, w = width();
  p.el.style.width = w + 'px';
  p.el.style.height = Math.round(w * vp.height / vp.width) + 'px';
}

async function draw (p) {
  if (!d.doc || d.rendering.has(p.n)) return;
  const w = width(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const vp1 = p.vp || d.base;
  // at most about 5 million pixels for one page, however far it is zoomed
  let scale = w / vp1.width * dpr;
  const px = vp1.width * vp1.height * scale * scale;
  if (px > 5e6) scale *= Math.sqrt(5e6 / px);
  if (p.canvas && Math.abs(p.scale - scale) < 0.01) return;
  d.rendering.add(p.n);
  const gen = d.gen;
  try {
    const page = await d.doc.getPage(p.n);
    if (gen !== d.gen || !p.near) return;
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    c.className = 'pv-c';
    await page.render({ canvasContext: c.getContext('2d', { alpha: false }), viewport: vp }).promise;
    if (gen !== d.gen || !p.near) return;
    p.canvas?.remove();
    p.canvas = c; p.scale = scale; p.vpDraw = vp;
    p.el.appendChild(c);
    if (d.find) markPage(p);
  } catch (e) {
    if (gen === d.gen) console.warn('[BM Player] pdf page ' + p.n + ':', e?.message || e);
  } finally { d.rendering.delete(p.n); }
}

/** A page far from the screen gives its picture back (memory). */
function drop (p) { if (p.canvas) { p.canvas.remove(); p.canvas = null; p.scale = 0; } p.marks?.remove(); p.marks = null; }

function current () {
  const body = $('pv-body'), mid = body.scrollTop + body.clientHeight * 0.35;
  for (const p of d.pages) if (p.el.offsetTop + p.el.offsetHeight > mid) return p.n;
  return d.pages.length || 1;
}
function pageLabel () {
  if (!d.doc) { $('pv-page').textContent = ''; return; }
  $('pv-page').textContent = `${current()} / ${d.doc.numPages}`;
  const b = $('pv-page'); b.classList.add('on'); clearTimeout(d.uiT); d.uiT = setTimeout(() => b.classList.remove('on'), 1800);
}
function goTo (n, smooth = true) {
  const p = d.pages[Math.max(1, Math.min(d.pages.length, n)) - 1]; if (!p) return;
  $('pv-body').scrollTo({ top: p.el.offsetTop - 8, behavior: smooth ? 'smooth' : 'auto' });
}
function savePos (now = false) {
  if (!d.doc || !d.key) return;
  clearTimeout(savePos.t);
  const save = () => { try { const all = JSON.parse(localStorage.getItem(POS) || '{}') || {}; all[d.key] = current(); const keys = Object.keys(all); if (keys.length > 200) delete all[keys[0]]; localStorage.setItem(POS, JSON.stringify(all)); } catch (_) {} };
  if (now) save(); else savePos.t = setTimeout(save, 600);
}

function goToSheet () {
  if (!d.doc) return;
  const body = document.createElement('form'); body.className = 'pv-pass';
  body.innerHTML = `<input type="number" min="1" max="${d.doc.numPages}" inputmode="numeric" placeholder="1 to ${d.doc.numPages}" aria-label="Page"><button class="m-btn" type="submit">Go</button>`;
  let close = null;
  body.addEventListener('submit', e => { e.preventDefault(); const n = parseInt(body.querySelector('input').value, 10); close?.(); if (n > 0) goTo(n); });
  close = sheet({ title: 'Go to a page', sub: `This document has ${d.doc.numPages}.`, body });
  setTimeout(() => body.querySelector('input')?.focus(), 250);
}

// ── zoom ─────────────────────────────────────────────────────────────
function setZoom (z, fx = 0.5, fy = 0.35) {
  const body = $('pv-body'), old = d.zoom;
  z = Math.max(0.6, Math.min(4, z));
  if (Math.abs(z - old) < 0.01) return;
  // keep the point under the fingers where it is
  const ax = body.scrollLeft + body.clientWidth * fx, ay = body.scrollTop + body.clientHeight * fy;
  d.zoom = z;
  for (const p of d.pages) size(p);
  $('pv-pages').style.width = (width() + 16) + 'px';
  body.scrollLeft = ax * z / old - body.clientWidth * fx;
  body.scrollTop = ay * z / old - body.clientHeight * fy;
  for (const p of d.pages) if (p.near) draw(p);
}

function wireZoom (body) {
  const pts = new Map();
  let g = null, lastTap = 0;
  body.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], r = body.getBoundingClientRect();
      g = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: d.zoom, fx: ((a.x + b.x) / 2 - r.left) / r.width, fy: ((a.y + b.y) / 2 - r.top) / r.height };
      $('pv-pages').style.transformOrigin = `${body.scrollLeft + g.fx * body.clientWidth}px ${body.scrollTop + g.fy * body.clientHeight}px`;
    }
  });
  body.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (g && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      g.k = Math.max(0.6 / g.z0, Math.min(4 / g.z0, Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.d0)));
      $('pv-pages').style.transform = `scale(${g.k})`;           // cheap while the fingers move; drawn again at the end
    }
  });
  const end = e => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (g && pts.size < 2) {
      const k = g.k || 1, was = g; g = null;
      $('pv-pages').style.transform = '';
      setZoom(was.z0 * k, was.fx, was.fy);
      return;
    }
    if (e.type !== 'pointerup' || !p) return;
    const now = performance.now();
    if (now - lastTap < 300) { lastTap = 0; const r = body.getBoundingClientRect(); setZoom(d.zoom > 1.2 ? 1 : 2, (p.x - r.left) / r.width, (p.y - r.top) / r.height); }
    else lastTap = now;
  };
  body.addEventListener('pointerup', end);
  body.addEventListener('pointercancel', end);
}

// ── finding words ────────────────────────────────────────────────────
async function textOf (n) {
  const p = d.pages[n - 1];
  if (p.text) return p.text;
  const page = await d.doc.getPage(n);
  const tc = await page.getTextContent();
  p.items = tc.items;
  p.text = tc.items.map(i => i.str).join(' ');
  return p.text;
}

async function find (q) {
  q = String(q || '').trim().toLowerCase();
  if (!d.doc || !q) return;
  const gen = d.gen;
  d.find = { q, hits: [], at: -1 };
  $('pv-hits').textContent = 'Looking…';
  for (let n = 1; n <= d.doc.numPages; n++) {
    if (gen !== d.gen || d.find?.q !== q) return;
    try { if ((await textOf(n)).toLowerCase().includes(q)) d.find.hits.push(n); } catch (_) {}
    if (n % 10 === 0) $('pv-hits').textContent = `${d.find.hits.length} so far…`;
  }
  $('pv-hits').textContent = d.find.hits.length ? `${d.find.hits.length} page${d.find.hits.length === 1 ? '' : 's'}` : 'Not found';
  for (const p of d.pages) if (p.canvas) markPage(p);
  if (d.find.hits.length) { const c = current(); d.find.at = Math.max(0, d.find.hits.findIndex(n => n >= c)); goTo(d.find.hits[d.find.at]); }
}

function hop (k) {
  const f = d.find; if (!f || !f.hits.length) return;
  f.at = (f.at + k + f.hits.length) % f.hits.length;
  $('pv-hits').textContent = `${f.at + 1} of ${f.hits.length} pages`;
  goTo(f.hits[f.at]);
}

/** The words found, marked on a page: the bits of text that hold them. */
async function markPage (p) {
  p.marks?.remove(); p.marks = null;
  const f = d.find;
  if (!f || !f.hits.includes(p.n) || !p.vpDraw) return;
  try { await textOf(p.n); } catch (_) { return; }
  const lib = window.pdfjsLib, box = document.createElement('div');
  box.className = 'pv-marks';
  const k = p.el.clientWidth / p.vpDraw.width;
  for (const it of p.items || []) {
    if (!it.str || !it.str.toLowerCase().includes(f.q)) continue;
    const t = lib.Util.transform(p.vpDraw.transform, it.transform);
    const h = Math.hypot(t[2], t[3]), w = it.width * p.vpDraw.scale;
    const m = document.createElement('span');
    Object.assign(m.style, { left: t[4] * k + 'px', top: (t[5] - h) * k + 'px', width: w * k + 'px', height: h * 1.15 * k + 'px' });
    box.appendChild(m);
  }
  p.el.appendChild(box); p.marks = box;
}

function closeFind () {
  $('pv-search').classList.add('hidden');
  d.find = null; $('pv-hits').textContent = '';
  for (const p of d.pages) { p.marks?.remove(); p.marks = null; }
}

// ── the menu ─────────────────────────────────────────────────────────
async function more () {
  const night = $('pv').classList.contains('night');
  const items = [
    { icon: 'moon', label: night ? 'Light pages' : 'Dark pages, for night', action: () => { $('pv').classList.toggle('night', !night); try { localStorage.setItem(NIGHT, night ? '0' : '1'); } catch (_) {} } },
    { icon: 'zoomIn', label: 'Zoom', note: Math.round(d.zoom * 100) + '%', action: () => sheet({ title: 'Zoom', items: [[0.75, 'Smaller'], [1, 'Page width'], [1.5, '150%'], [2, '200%'], [3, '300%']].map(([z, l]) => ({ label: l, on: Math.abs(d.zoom - z) < 0.01, action: () => setZoom(z) })) }) },
    { icon: 'page', label: 'Go to a page', action: goToSheet },
  ];
  try {
    const outline = d.doc && await d.doc.getOutline();
    if (outline?.length) items.push({ icon: 'list', label: 'Contents', action: () => sheet({ title: 'Contents', wide: true, items: outline.slice(0, 80).map(o => ({ label: o.title, action: () => goOutline(o) })) }) });
  } catch (_) {}
  items.push({ icon: 'share', label: 'Share', action: () => call('shareFile', d.item?.url, 'application/pdf') });
  items.push({ icon: 'playFile', label: 'Open in another app', action: () => call('openWith', d.item?.url) });
  sheet({ title: d.item?.title || 'Document', items });
}

async function goOutline (o) {
  try {
    const dest = typeof o.dest === 'string' ? await d.doc.getDestination(o.dest) : o.dest;
    if (!dest) return;
    const i = await d.doc.getPageIndex(dest[0]);
    goTo(i + 1);
  } catch (_) {}
}

/** Back: the search first, then the document. */
export function pdfBack () {
  if (!d.open) return false;
  if (!$('pv-search').classList.contains('hidden')) { closeFind(); return true; }
  closePdf();
  return true;
}
