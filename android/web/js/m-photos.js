/**
 * m-photos (v3.42.0): the Photos tab. Every picture on the phone, newest
 * first, as a grid, or by album (the folders the pictures are in; an album
 * opens over the tab, as a folder of videos does). A tap opens the picture
 * viewer (m-viewer.js) with its album around it, to swipe through. The
 * folder button opens a picture or a PDF from anywhere on the phone.
 *
 * v3.45.0: a long press on a picture starts choosing several (m-select.js),
 * to share them or delete them from the phone (m-delete.js); a long press on
 * an album offers to delete it.
 */
import { lib, loadImages } from './m-library.js';
import { VList } from './m-list.js';
import { $, esc, fmtSize, sheet, artBg, onLongPress } from './m-ui.js';
import { ICONS } from './icons.js';
import { call, has, permission } from './m-android.js';
import { openSub, closeSub } from './m-sub.js';
import { openImages } from './m-viewer.js';
import { startSelect, selecting, toggle, mark, ring, endSelect, shareItems } from './m-select.js';
import { deleteItems, onDeleted, canDelete, howMany } from './m-delete.js';

// album: the one open over the tab, { name, items, vl, n }
const st = { state: 'idle', show: 'all', sort: 'newest', list: [], vl: null, vlKind: '', album: null };
try { st.sort = localStorage.getItem('bm_m_psort') || 'newest'; } catch (_) {}
// All or Albums, kept as the sort is (v3.43.2).
try { if (localStorage.getItem('bm_m_pshow') === 'albums') st.show = 'albums'; } catch (_) {}
const SORTS = [['newest', 'Newest first', (a, b) => (b.taken || b.added * 1000) - (a.taken || a.added * 1000)], ['oldest', 'Oldest first', (a, b) => (a.taken || a.added * 1000) - (b.taken || b.added * 1000)],
  ['name', 'Name', (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })], ['size', 'Largest', (a, b) => b.size - a.size]];
const sorted = list => list.slice().sort((SORTS.find(s => s[0] === st.sort) || SORTS[0])[2]);
const cols = () => Math.max(3, Math.min(8, Math.floor((window.innerWidth - 8) / 112)));

export function initPhotos () {
  $('ph-chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; endSelect('photos'); st.show = b.dataset.k; try { localStorage.setItem('bm_m_pshow', st.show); } catch (_) {} render(); });
  $('ph-sort-btn').addEventListener('click', () => sheet({ title: 'Sort pictures', items: SORTS.map(([k, label]) => ({ label, on: st.sort === k, action: () => { st.sort = k; try { localStorage.setItem('bm_m_psort', k); } catch (_) {} render(); } })) }));
  $('ph-open').addEventListener('click', () => sheet({ title: 'Open', items: [
    { icon: 'images', label: 'A picture…', action: () => call('pickMedia', 'image') },
    { icon: 'pdf', label: 'A PDF…', action: () => call('pickMedia', 'pdf') },
  ] }));
  const box = $('ph-list');
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-perm], [data-settings], [data-retry]');
    if (b) { if (b.dataset.perm) call('requestPermission', 'image'); else if (b.hasAttribute('data-settings')) call('openAppSettings'); else loadPhotos(true); return; }
    const a = e.target.closest('[data-ai]');
    if (a) { const al = st.list[+a.dataset.ai]; if (al) openAlbum(al); return; }
    const p = e.target.closest('[data-pi]');
    if (!p) return;
    if (selecting('photos')) toggle(st.list[+p.dataset.pi]);
    else openImages(st.list, +p.dataset.pi);
  });
  // A long press: a picture starts choosing (or is added), an album offers to go.
  onLongPress(box, '[data-pi], [data-ai]', t => {
    if (t.dataset.ai !== undefined) { const al = st.list[+t.dataset.ai]; if (al) albumMenu(al); return; }
    const it = st.list[+t.dataset.pi]; if (!it) return;
    if (selecting('photos')) toggle(it); else startSelect(chooser('photos'), it);
  });
  onLongPress($('sub-list'), '[data-pi]', t => {
    const it = st.album?.items[+t.dataset.pi]; if (!it) return;
    if (selecting('album')) toggle(it); else startSelect(chooser('album'), it);
  });
  onDeleted((kind, gone) => {
    if (kind !== 'image') return;
    if (st.state === 'ready') render();
    const al = st.album;
    if (!al) return;
    al.items = al.items.filter(x => !gone.has(x.id));
    if (!al.items.length) closeSub();
    else al.vl?.setCount(Math.ceil(al.items.length / al.n), true);
  });
  $('ph-empty').addEventListener('click', e => {
    const b = e.target.closest('[data-perm], [data-settings], [data-retry]'); if (!b) return;
    if (b.dataset.perm) call('requestPermission', 'image'); else if (b.hasAttribute('data-settings')) call('openAppSettings'); else loadPhotos(true);
  });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (st.vl && !$('v-photos').classList.contains('hidden')) { st.vl.destroy(); st.vl = null; render(); } }, 200); });
}

export async function loadPhotos (force = false) {
  if (st.state === 'ready' && !force) { render(); return; }
  const p = permission('image');
  if (p !== 'granted') { st.state = p === 'denied' ? 'denied' : 'ask'; render(); return; }
  st.state = 'loading'; render();
  try { await loadImages(); st.state = 'ready'; }
  catch (e) { st.state = e.permission ? 'ask' : 'error'; st.error = String(e.message || e); }
  render();
}
export const photosState = () => st.state;

function render () {
  const box = $('ph-list'), empty = $('ph-empty'), chips = $('ph-chips');
  const say = html => { empty.innerHTML = html; empty.classList.remove('hidden'); box.classList.add('hidden'); chips.classList.add('hidden'); };
  const ico = ICONS.images;
  if (st.state === 'ask' || st.state === 'idle') return say(`<div class="m-empty-ico">${ico}</div><p>BM Player can show the pictures on this phone. Allow it to see them to list them here.</p><button class="m-btn" type="button" data-perm="image">Allow access to pictures</button><p class="m-small">Or open one picture or PDF with the folder button above.</p>`);
  if (st.state === 'denied') return say(`<div class="m-empty-ico">${ico}</div><p>Access to pictures is turned off for BM Player. Turn it on in the app's settings, under Permissions, then Photos and videos.</p><button class="m-btn" type="button" data-settings>Open the app's settings</button>`);
  if (st.state === 'loading') return say('<div class="m-spin"></div><p>Looking for pictures…</p>');
  if (st.state === 'error') return say(`<p>The pictures could not be read.</p><p class="m-small">${esc(st.error || '')}</p><button class="m-btn" type="button" data-retry>Try again</button>`);
  if (!lib.images.length) return say(`<div class="m-empty-ico">${ico}</div><p>No pictures found on this phone.</p><p class="m-small">Open one with the folder button above.</p>`);
  chips.classList.remove('hidden');
  chips.innerHTML = `<button class="chip${st.show === 'all' ? ' on' : ''}" type="button" data-k="all">All ${lib.images.length}</button><button class="chip${st.show === 'albums' ? ' on' : ''}" type="button" data-k="albums">Albums ${lib.imageAlbums.length}</button>`;
  empty.classList.add('hidden'); box.classList.remove('hidden');
  const n = st.show === 'albums' ? Math.max(2, Math.min(5, Math.floor((window.innerWidth - 20) / 160))) : cols();
  st.list = st.show === 'albums' ? lib.imageAlbums : sorted(lib.images);
  const kind = st.show + n;
  if (st.vl && st.vlKind !== kind) { st.vl.destroy(); st.vl = null; }
  st.vlKind = kind;
  if (!st.vl) {
    st.vl = st.show === 'albums'
      ? new VList(box, { rowHeight: Math.round((window.innerWidth - 32 - (n - 1) * 10) / n) + 52, render: (i, row) => cards(row, i, n, k => albumCard(st.list[k], k)) })
      : new VList(box, { rowHeight: Math.floor((window.innerWidth - 8) / n), render: (i, row) => tiles(row, i, n, st.list, 'photos') });
  }
  st.vl.setCount(Math.ceil(st.list.length / n), true);
}

function cards (row, i, n, card) {
  row.className = 'vrow agrid'; row.style.setProperty('--cols', n);
  let html = '';
  for (let k = i * n; k < Math.min(st.list.length, (i + 1) * n); k++) html += card(k);
  row.innerHTML = html;
}

/** A row of square pictures, edge to edge with a hairline between. key: the list's, for choosing several. */
function tiles (row, i, n, list, key) {
  row.className = 'vrow ptiles'; row.style.setProperty('--cols', n);
  let html = '';
  const r = ring(key);
  for (let k = i * n; k < Math.min(list.length, (i + 1) * n); k++) { const x = list[k]; html += `<span class="ptile${mark(key, x.id)}" data-pi="${k}" data-id="${x.id}" style="background-image:${artBg(x.thumb)}">${r}</span>`; }
  row.innerHTML = html;
}

function albumCard (a, k) {
  return `<div class="acard" data-ai="${k}"><span class="aart art" style="background-image:${artBg(a.thumb)}"></span><span class="at1">${esc(a.name)}</span><span class="at2">${a.count} picture${a.count === 1 ? '' : 's'}${a.size ? ' · ' + fmtSize(a.size) : ''}</span></div>`;
}

function openAlbum (a) {
  const al = st.album = { name: a.name, items: sorted(lib.images.filter(x => x.folder === a.name)), vl: null, n: cols() };
  openSub({
    title: a.name, owner: 'photos',
    fill: sc => {
      al.vl = new VList(sc, { rowHeight: Math.floor((window.innerWidth - 8) / al.n), render: (i, row) => tiles(row, i, al.n, al.items, 'album') });
      al.vl.setCount(Math.ceil(al.items.length / al.n));
      sc.onclick = e => {
        const p = e.target.closest('[data-pi]'); if (!p) return;
        if (selecting('album')) toggle(al.items[+p.dataset.pi]);
        else openImages(al.items, +p.dataset.pi);
      };
    },
    onClose: () => { endSelect('album'); $('sub-list').onclick = null; if (st.album === al) st.album = null; },
  });
}

/** Choosing several pictures: in the tab's grid ('photos') or in an album open over it ('album'). */
function chooser (key) {
  const inAlbum = key === 'album';
  return {
    key, kind: 'image',
    scroller: inAlbum ? $('sub-list') : $('ph-list'),
    items: () => (inAlbum ? st.album?.items || [] : st.show === 'all' ? st.list : []),
    refresh: () => (inAlbum ? st.album?.vl : st.vl)?.refresh(),
    actions: [
      { icon: 'share', label: 'Share', run: list => { shareItems('image', list); endSelect(); } },
      ...(canDelete() ? [{ icon: 'trash', label: 'Delete', run: list => deleteItems('image', list) }] : []),
    ],
  };
}

/** An album's long press: open it, or delete every picture in it. */
function albumMenu (a) {
  const items = [{ icon: 'images', label: 'Open', action: () => openAlbum(a) }];
  if (canDelete()) items.push({ icon: 'trash', label: 'Delete the album', danger: true, note: howMany('image', a.count), action: () => deleteItems('image', lib.images.filter(x => x.folder === a.name), { folder: a.name }) });
  sheet({ title: a.name, sub: `${howMany('image', a.count)}${a.size ? ' · ' + fmtSize(a.size) : ''}`, art: a.thumb, items });
}

/** For Settings: how many pictures there are. */
export const photoCount = () => lib.images.length;
export const canPick = () => has('pickMedia');
