/**
 * m-video: the Videos tab. The video player is m-vplayer.js (v3.47.0): it
 * was here, and moved as it was.
 *
 * Videos play with mpv (v3.41.0), built into the app: MKV, MP4, AVI and
 * nearly anything else, 4K and H.265, every audio track, and subtitles in
 * the film or beside it, styled ones included. mpv draws the picture
 * behind the page (m-mpv.js) and this page draws the controls over it.
 * Where mpv cannot run, or Settings says so, the phone's web engine plays
 * them (a video element), as before: then what plays is what the phone can
 * decode. Both sit behind the same controls (eng, below).
 *
 * v3.42.0, the tab: every video as a list or a grid, by folder (a folder
 * opens over the tab, as an album does over the music), and the ones left
 * part way (Continue). Under each picture, how far it was watched; NEW on
 * the ones not opened yet.
 *
 * v3.42.0, the player, as MX Player has it: swipes for brightness, volume
 * (and a boost) and the position, pinch to zoom, hold for double speed
 * (m-vgest.js), a lock, the picture's size (fit, fill, stretch, 100%,
 * 16:9, 4:3), the previous and next video of the folder and playing on to
 * the next, the decoder (HW, HW+, SW), speed, repeating a part (A-B), a
 * sleep timer, subtitle and sound timing, and carrying on where each video
 * was left. The clock and the battery show with the controls.
 *
 * v3.45.0: a long press on a video starts choosing several (m-select.js),
 * to share them or delete them from the phone (m-delete.js); a long press on
 * a folder offers to delete it; a video's ⋮ has Share and Delete too.
 */
import { lib, loadVideos } from './m-library.js';
import { VList } from './m-list.js';
import { $, esc, fmtTime, fmtSize, sheet, pickFile, artBg, onLongPress } from './m-ui.js';
import { ICONS, setIcon } from './icons.js';
import { call, has, permission } from './m-android.js';
import { openSub, setAct, closeSub } from './m-sub.js';
import { videoKey, position, progress } from './m-recent.js';
import { startSelect, selecting, toggle, mark, ring, endSelect, shareItems } from './m-select.js';
import { deleteItems, onDeleted, canDelete, howMany } from './m-delete.js';
import { openVideo, initPlayer, openPicked, details, quality, seen } from './m-vplayer.js';
// The player's, for the modules that have always imported them from here.
export { openVideo, videoBack, applySubStyle, playerNote } from './m-vplayer.js';

const st = { state: 'idle', show: 'all', view: 'list', sort: 'added', list: [], vl: null, folder: null, sub: null };
try { st.sort = localStorage.getItem('bm_m_vsort') || 'added'; st.view = localStorage.getItem('bm_m_vview') === 'grid' ? 'grid' : 'list'; } catch (_) {}
// All, Folders or Continue, kept too (v3.43.2). Only list or grid and the
// sort were, so when Android had closed the app in the background it came
// back on All, whatever had been chosen.
try { const s = localStorage.getItem('bm_m_vshow'); if (s === 'folders' || s === 'continue') st.show = s; } catch (_) {}

const SORTS = [['added', 'Recently added', (a, b) => b.added - a.added], ['name', 'Name', (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })],
  ['length', 'Longest', (a, b) => b.duration - a.duration], ['size', 'Largest', (a, b) => b.size - a.size]];
export function initVideos () {
  $('vd-chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; endSelect('videos'); st.show = b.dataset.k; try { localStorage.setItem('bm_m_vshow', st.show); } catch (_) {} render(); });
  $('vd-sort-btn').addEventListener('click', () => sheet({ title: 'Sort videos', items: SORTS.map(([k, label]) => ({ label, on: st.sort === k, action: () => { st.sort = k; try { localStorage.setItem('bm_m_vsort', k); } catch (_) {} render(); refreshSub(); } })) }));
  $('vd-view-btn').addEventListener('click', () => setView(st.view === 'grid' ? 'list' : 'grid'));
  setIcon($('vd-view-btn'), st.view === 'grid' ? 'list' : 'grid');
  $('vd-open').addEventListener('click', async () => {
    // Android's picker gives the file an address mpv can open (an 'open' event follows).
    if (has('pickMedia')) { call('pickMedia', 'video'); return; }
    const f = await pickFile('video/*');
    if (!f) return;
    openPicked(f);
  });
  const list = $('vd-list');
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-perm], [data-settings], [data-retry]');
    if (b) { if (b.dataset.perm) call('requestPermission', 'video'); else if (b.hasAttribute('data-settings')) call('openAppSettings'); else loadAll(); return; }
    const f = e.target.closest('[data-fi]');
    if (f) { const folder = st.list[+f.dataset.fi]; if (folder) openFolder(folder); return; }
    const row = e.target.closest('[data-vi]'); if (!row) return;
    const item = st.list[+row.dataset.vi]; if (!item) return;
    if (selecting('videos')) { toggle(item); return; }
    if (e.target.closest('.more')) { details(item); return; }
    openVideo(item, { list: st.list, index: +row.dataset.vi });
  });
  // A long press: a video starts choosing (or is added), a folder offers to go.
  onLongPress(list, '[data-vi], [data-fi]', t => {
    if (t.dataset.fi !== undefined) { const folder = st.list[+t.dataset.fi]; if (folder) folderMenu(folder); return; }
    const item = st.list[+t.dataset.vi]; if (!item?.id) return;
    if (selecting('videos')) toggle(item); else startSelect(chooser('videos'), item);
  });
  onLongPress($('sub-list'), '[data-vi]', t => {
    const item = st.sub?.items[+t.dataset.vi]; if (!item?.id) return;
    if (selecting('vfolder')) toggle(item); else startSelect(chooser('vfolder'), item);
  });
  onDeleted((kind, gone) => {
    if (kind !== 'video') return;
    if (st.state === 'ready') render();
    const sub = st.sub;
    if (!sub || !st.folder) return;
    sub.items = sub.items.filter(x => !gone.has(x.id));
    if (!sub.items.length) closeSub();
    else sub.vl.setCount(sub.grid ? Math.ceil(sub.items.length / sub.n) : sub.items.length, true);
  });
  $('vd-empty').addEventListener('click', e => {
    const b = e.target.closest('[data-perm], [data-settings], [data-retry]'); if (!b) return;
    if (b.dataset.perm) call('requestPermission', 'video'); else if (b.hasAttribute('data-settings')) call('openAppSettings'); else loadAll();
  });
  // The player (m-vplayer.js), told how to show how far each video was watched once one closes.
  initPlayer({ watched: () => { if (st.state === 'ready') render(); } });
}

function setView (view) {
  endSelect('videos'); endSelect('vfolder');
  st.view = view;
  try { localStorage.setItem('bm_m_vview', view); } catch (_) {}
  setIcon($('vd-view-btn'), view === 'grid' ? 'list' : 'grid');
  $('vd-view-btn').setAttribute('aria-label', view === 'grid' ? 'Show as a list' : 'Show as a grid');
  if (st.vl) { st.vl.destroy(); st.vl = null; }
  render(); refreshSub();
}

/** The videos, read once the tab is first opened (or again when asked). */
export async function loadAll (force = false) {
  if (st.state === 'ready' && !force) { render(); return; }
  const p = permission('video');
  if (p !== 'granted') { st.state = p === 'denied' ? 'denied' : 'ask'; render(); return; }
  st.state = 'loading'; render();
  try { await loadVideos(); st.state = 'ready'; }
  catch (e) { st.state = e.permission ? 'ask' : 'error'; st.error = String(e.message || e); }
  render();
}
export const videosState = () => st.state;

const cols = () => Math.max(2, Math.min(5, Math.floor((window.innerWidth - 20) / 170)));
const sorted = list => list.slice().sort((SORTS.find(s => s[0] === st.sort) || SORTS[0])[2]);

function render () {
  const box = $('vd-list'), empty = $('vd-empty'), chips = $('vd-chips');
  const say = html => { empty.innerHTML = html; empty.classList.remove('hidden'); box.classList.add('hidden'); chips.classList.add('hidden'); };
  if (st.state === 'ask' || st.state === 'idle') return say(`<div class="m-empty-ico">${ICONS.video}</div><p>BM Player can play the videos on this phone. Allow it to see them to list them here.</p><button class="m-btn" type="button" data-perm="video">Allow access to videos</button><p class="m-small">Or open one file with the folder button above.</p>`);
  if (st.state === 'denied') return say(`<div class="m-empty-ico">${ICONS.video}</div><p>Access to videos is turned off for BM Player. Turn it on in the app's settings, under Permissions, then Photos and videos.</p><button class="m-btn" type="button" data-settings>Open the app's settings</button>`);
  if (st.state === 'loading') return say('<div class="m-spin"></div><p>Looking for videos…</p>');
  if (st.state === 'error') return say(`<p>The videos could not be read.</p><p class="m-small">${esc(st.error || '')}</p><button class="m-btn" type="button" data-retry>Try again</button>`);
  const going = lib.videos.filter(x => position(videoKey(x)));
  if (st.show === 'continue' && !going.length) st.show = 'all';
  chips.classList.remove('hidden');
  chips.innerHTML = `<button class="chip${st.show === 'all' ? ' on' : ''}" type="button" data-k="all">All ${lib.videos.length}</button>` +
    `<button class="chip${st.show === 'folders' ? ' on' : ''}" type="button" data-k="folders">Folders ${lib.videoFolders.length}</button>` +
    (going.length ? `<button class="chip${st.show === 'continue' ? ' on' : ''}" type="button" data-k="continue">Continue ${going.length}</button>` : '');
  if (!lib.videos.length) return say(`<div class="m-empty-ico">${ICONS.video}</div><p>No videos found on this phone.</p><p class="m-small">Open one file with the folder button above.</p>`);
  empty.classList.add('hidden'); box.classList.remove('hidden');
  const grid = st.view === 'grid', n = cols();
  if (st.show === 'folders') st.list = lib.videoFolders;
  else if (st.show === 'continue') st.list = going.sort((a, b) => (position(videoKey(b))?.at || 0) - (position(videoKey(a))?.at || 0));
  else st.list = sorted(lib.videos);
  const kind = (st.show === 'folders' ? 'f' : 'v') + (grid ? 'g' : 'l') + n;
  if (st.vl && st.vlKind !== kind) { st.vl.destroy(); st.vl = null; }
  st.vlKind = kind;
  if (!st.vl) {
    if (st.show === 'folders') st.vl = grid ? new VList(box, { rowHeight: gridRowH(n, true), render: (i, row) => gridRow(row, i, n, k => folderCard(st.list[k], k)) })
      : new VList(box, { rowHeight: 76, render: (i, row) => folderRow(st.list[i], row, i) });
    else st.vl = grid ? new VList(box, { rowHeight: gridRowH(n), render: (i, row) => gridRow(row, i, n, k => videoCard(st.list[k], k)) })
      : new VList(box, { rowHeight: 84, render: (i, row) => videoRow(st.list[i], row, i) });
  }
  st.vl.setCount(grid ? Math.ceil(st.list.length / n) : st.list.length, true);
}

/** Choosing several videos: in the tab's list ('videos') or in a folder open over it ('vfolder'). */
function chooser (key) {
  const inFolder = key === 'vfolder';
  return {
    key, kind: 'video',
    scroller: inFolder ? $('sub-list') : $('vd-list'),
    items: () => (inFolder ? st.sub?.items || [] : st.show === 'folders' ? [] : st.list),
    refresh: () => (inFolder ? st.sub?.vl : st.vl)?.refresh(),
    actions: [
      { icon: 'share', label: 'Share', run: list => { shareItems('video', list); endSelect(); } },
      ...(canDelete() ? [{ icon: 'trash', label: 'Delete', run: list => deleteItems('video', list) }] : []),
    ],
  };
}

/** A folder's long press: open it, or delete every video in it. */
function folderMenu (f) {
  const items = [{ icon: 'folder', label: 'Open', action: () => openFolder(f) }];
  if (canDelete()) items.push({ icon: 'trash', label: 'Delete the folder', danger: true, note: howMany('video', f.count), action: () => deleteItems('video', lib.videos.filter(x => x.folder === f.name), { folder: f.name }) });
  sheet({ title: f.name, sub: `${howMany('video', f.count)}${f.size ? ' · ' + fmtSize(f.size) : ''}`, art: f.thumb, items });
}

const gridRowH = (n, folder) => Math.round((window.innerWidth - 32 - (n - 1) * 10) / n * 9 / 16 + (folder ? 58 : 62));
function gridRow (row, i, n, card, list = st.list) {
  row.className = 'vrow agrid vgrid'; row.style.setProperty('--cols', n);
  let html = '';
  for (let k = i * n; k < Math.min(list.length, (i + 1) * n); k++) html += card(k);
  row.innerHTML = html;
}


/** The marks on a video's picture: its length, how far it was watched, NEW. */
function thumbMarks (x) {
  const key = videoKey(x), p = progress(key);
  const fresh = !p && !seen.has(key) && x.added && (Date.now() / 1000 - x.added) < 7 * 86400;
  return `<span class="vdur">${fmtTime(x.duration)}</span>` + (p ? `<span class="vbar"><span style="width:${Math.round(p * 100)}%"></span></span>` : '') + (fresh ? '<span class="vnew">NEW</span>' : '');
}

/** A video in a list. key: the list's, for choosing several ('videos' or 'vfolder'). */
function videoRow (x, row, i, key = 'videos') {
  row.className = 'vrow video' + mark(key, x.id);
  row.dataset.vi = String(i);
  row.dataset.id = String(x.id || '');
  row.innerHTML = `<span class="vthumb art" style="background-image:${artBg(x.thumb)}">${thumbMarks(x)}${ring(key)}</span><span class="txt"><span class="t1 two">${esc(x.title)}</span><span class="t2">${esc([quality(x), x.size ? fmtSize(x.size) : '', st.show === 'all' || st.show === 'continue' ? x.folder : ''].filter(Boolean).join(' · '))}</span></span><button class="more" type="button" aria-label="About ${esc(x.title)}">${ICONS.more}</button>`;
}

function videoCard (x, k, key = 'videos') {
  return `<div class="vcard${mark(key, x.id)}" data-vi="${k}" data-id="${x.id || ''}"><span class="vcthumb art" style="background-image:${artBg(x.thumb)}">${thumbMarks(x)}${ring(key)}</span><span class="vct">${esc(x.title)}</span><span class="vcs">${esc([quality(x), x.size ? fmtSize(x.size) : ''].filter(Boolean).join(' · '))}</span></div>`;
}

function folderRow (f, row, i) {
  row.className = 'vrow vfolder';
  row.dataset.fi = String(i);
  row.innerHTML = `<span class="vthumb vfthumb art" style="background-image:${artBg(f.thumb)}"><span class="vfcount">${f.count}</span></span><span class="txt"><span class="t1">${esc(f.name)}</span><span class="t2">${f.count} video${f.count === 1 ? '' : 's'}${f.size ? ' · ' + fmtSize(f.size) : ''}${f.going ? ' · ' + f.going + ' part way' : ''}</span></span><span class="chev">${ICONS.chevRight}</span>`;
}

function folderCard (f, k) {
  return `<div class="vcard vfcard" data-fi="${k}"><span class="vcthumb art" style="background-image:${artBg(f.thumb)}"><span class="vfolder-ico">${ICONS.folder}</span><span class="vfcount">${f.count}</span></span><span class="vct">${esc(f.name)}</span><span class="vcs">${f.count} video${f.count === 1 ? '' : 's'}${f.size ? ' · ' + fmtSize(f.size) : ''}</span></div>`;
}

/** A folder of videos, over the tab, as an album opens over the music. */
function openFolder (f) {
  st.folder = f;
  openSub({
    title: f.name, owner: 'videos',
    act: { icon: st.view === 'grid' ? 'list' : 'grid', label: 'View', run: () => setView(st.view === 'grid' ? 'list' : 'grid') },
    fill: sc => fillFolder(sc),
    onClose: () => { endSelect('vfolder'); st.folder = null; st.sub = null; },
  });
}
function fillFolder (sc) {
  const f = st.folder; if (!f) return;
  const grid = st.view === 'grid', n = cols();
  st.sub?.vl?.destroy();
  // The rows read sub.items, so a delete can take videos out without building the list again.
  const sub = st.sub = { vl: null, items: sorted(lib.videos.filter(x => x.folder === f.name)), grid, n };
  sub.vl = grid ? new VList(sc, { rowHeight: gridRowH(n), render: (i, row) => gridRow(row, i, n, k => videoCard(sub.items[k], k, 'vfolder'), sub.items) })
    : new VList(sc, { rowHeight: 84, render: (i, row) => videoRow(sub.items[i], row, i, 'vfolder') });
  sub.vl.setCount(grid ? Math.ceil(sub.items.length / n) : sub.items.length);
  if (!sc._wired) {
    sc._wired = true;
    sc.addEventListener('click', e => {
      if (!st.sub || !st.folder) return;
      const row = e.target.closest('[data-vi]'); if (!row) return;
      const item = st.sub.items[+row.dataset.vi]; if (!item) return;
      if (selecting('vfolder')) { toggle(item); return; }
      if (e.target.closest('.more')) { details(item); return; }
      openVideo(item, { list: st.sub.items, index: +row.dataset.vi });
    });
  }
}
function refreshSub () {
  if (!st.folder) return;
  setAct({ icon: st.view === 'grid' ? 'list' : 'grid', label: 'View', run: () => setView(st.view === 'grid' ? 'list' : 'grid') });
  fillFolder($('sub-list'));
}
