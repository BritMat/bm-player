/**
 * m-music: the Music tab. Songs, albums, artists and folders, each a long
 * list (m-list.js), with search and sort; an album, artist or folder opens
 * over it with its songs. A tap plays from there; the button at the end of
 * a row offers Play next, Add to queue and the rest.
 *
 * v3.45.0: a long press on a song starts choosing several (m-select.js), to
 * play, queue, share or delete them from the phone (m-delete.js). A long
 * press on an album or a folder offers its choices, deleting it among them.
 */
import { lib, loadSongs, view, songArt, SORT_NAMES, build, showAll, setShowAll } from './m-library.js';
import { player } from './m-player.js';
import { VList } from './m-list.js';
import { $, esc, fmtTime, fmtSize, sheet, toast, onLongPress, artBg } from './m-ui.js';
import { ICONS } from './icons.js';
import { call, permission } from './m-android.js';
import { favItem, songFav } from './m-favs.js';
import { startSelect, selecting, toggle, mark, ring, endSelect, shareItems } from './m-select.js';
import { deleteItems, onDeleted, canDelete, howMany } from './m-delete.js';

const st = {
  kind: 'songs', q: '', sorts: {}, list: [], vl: null, cols: 2,
  detail: null, dvl: null, dsongs: [],
  state: 'loading',                       // 'loading', 'ask', 'denied', 'ready', 'error'
};
try { st.sorts = JSON.parse(localStorage.getItem('bm_m_sorts') || '{}') || {}; } catch (_) {}
const sortOf = k => st.sorts[k] || SORT_NAMES[k][0][0];

export function initMusic () {
  $('mu-chips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    endSelect('songs');
    st.kind = b.dataset.k;
    for (const c of $('mu-chips').children) { c.classList.toggle('on', c === b); c.setAttribute('aria-selected', String(c === b)); }
    try { localStorage.setItem('bm_m_kind', st.kind); } catch (_) {}
    render();
  });
  try { const k = localStorage.getItem('bm_m_kind'); if (SORT_NAMES[k]) { st.kind = k; for (const c of $('mu-chips').children) c.classList.toggle('on', c.dataset.k === k); } } catch (_) {}
  $('mu-search-btn').addEventListener('click', openSearch);
  $('mu-search-x').addEventListener('click', closeSearch);
  $('mu-search').addEventListener('submit', e => { e.preventDefault(); $('mu-q').blur(); });
  let t = 0;
  $('mu-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = $('mu-q').value; render(); }, 120); });
  $('mu-sort-btn').addEventListener('click', sortMenu);
  $('mu-shuffle-all').addEventListener('click', () => {
    if (!lib.songs.length) return;
    player.playList(lib.songs, -1, { shuffle: true, from: 'All songs' });
  });
  const list = $('mu-list');
  list.addEventListener('click', e => tapRow(e, false));
  // The notes shown instead of the list (access, nothing found) have buttons
  // too. They are in a box of their own, beside the list, and until v3.41.0
  // nothing listened there: "Allow access to music" did nothing.
  $('mu-empty').addEventListener('click', e => tapRow(e, false));
  onLongPress(list, '.vrow, .acard', t => longPress(t, false));
  const dl = $('dt-list');
  dl.addEventListener('click', e => tapRow(e, true));
  onLongPress(dl, '.vrow', t => longPress(t, true));
  onDeleted(kind => { if (kind === 'audio') afterDelete(); });
  $('dt-back').addEventListener('click', closeDetail);
  window.addEventListener('resize', () => { if (st.kind === 'albums') render(true); });
  player.on('track', markPlaying);
  player.on('state', markPlaying);
}

// ── loading ──────────────────────────────────────────────────────────
export async function loadMusic () {
  const p = permission('audio');
  if (p !== 'granted') { st.state = p === 'denied' ? 'denied' : 'ask'; render(); return false; }
  st.state = 'loading'; render();
  try {
    await loadSongs();
    st.state = 'ready';
  } catch (e) {
    st.state = e.permission ? 'ask' : 'error';
    st.error = String(e.message || e);
    console.warn('[BM Player] music:', e);
  }
  render();
  return st.state === 'ready';
}

export function rebuild () { build(); render(); if (st.detail) openDetail(st.detail.kind, st.detail.key, true); }

/** Songs deleted from the phone (the library is already without them): the lists drawn again. */
function afterDelete () {
  render(true);
  const d = st.detail;
  if (!d) return;
  const there = d.kind === 'album' ? lib.albums.some(a => a.key === d.key) : d.kind === 'artist' ? lib.artists.some(a => a.key === d.key) : lib.folders.some(f => f.key === d.key);
  if (there) openDetail(d.kind, d.key, true); else closeDetail();
}

// ── the list ─────────────────────────────────────────────────────────
function render (keepScroll = false) {
  const box = $('mu-list'), empty = $('mu-empty');
  const say = (html) => { empty.innerHTML = html; empty.classList.remove('hidden'); box.classList.add('hidden'); };
  if (st.state === 'ask') return say(`<div class="m-empty-ico">${ICONS.music}</div><p>BM Player plays the music on this phone. Allow it to see your music to begin.</p><button class="m-btn" type="button" data-perm="audio">Allow access to music</button>`);
  if (st.state === 'denied') return say(`<div class="m-empty-ico">${ICONS.music}</div><p>Access to music is turned off for BM Player. Turn it on in the app's settings, under Permissions, then Music and audio.</p><button class="m-btn" type="button" data-settings>Open the app's settings</button>`);
  if (st.state === 'loading') return say('<div class="m-spin"></div><p>Looking for music…</p>');
  if (st.state === 'error') return say(`<p>The music could not be read.</p><p class="m-small">${esc(st.error || '')}</p><button class="m-btn" type="button" data-retry>Try again</button>`);
  st.list = view(st.kind, sortOf(st.kind), st.q);
  if (!st.list.length) {
    if (st.q) return say(`<p>Nothing here matches “${esc(st.q)}”.</p>`);
    const hidden = lib.all.length - lib.songs.length;
    return say(`<div class="m-empty-ico">${ICONS.music}</div><p>No music found on this phone.</p><p class="m-small">Songs anywhere on the phone show here once Android has found them (usually within a minute of copying them over).</p>` +
      (hidden > 0 && !showAll() ? `<button class="m-btn" type="button" data-showall>Show every audio file (${hidden})</button>` : ''));
  }
  empty.classList.add('hidden'); box.classList.remove('hidden');
  const kind = st.kind;
  if (kind === 'albums') {
    const w = box.clientWidth || window.innerWidth;
    st.cols = w >= 760 ? 5 : w >= 600 ? 4 : w >= 420 ? 3 : 2;
    const cw = (w - 32 - 12 * (st.cols - 1)) / st.cols;
    box.style.setProperty('--cols', st.cols);
    if (st.vl?.kind !== 'albums' || st.vl.cw !== cw) {
      st.vl?.destroy();
      st.vl = new VList(box, { rowHeight: Math.round(cw + 58), rowClass: 'vrow agrid', render: (i, row) => albumRow(i, row) });
      st.vl.kind = 'albums'; st.vl.cw = cw;
    }
    st.vl.setCount(Math.ceil(st.list.length / st.cols), keepScroll);
    return;
  }
  if (st.vl?.kind !== kind) {
    st.vl?.destroy();
    st.vl = new VList(box, { rowHeight: 64, render: (i, row) => (kind === 'songs' ? songRow : kind === 'artists' ? artistRow : folderRow)(st.list[i], row, i) });
    st.vl.kind = kind;
  }
  st.vl.setCount(st.list.length, keepScroll);
}

/** A song in a list. key: the list's, for choosing several ('songs' or 'detail'). */
function songRow (s, row, i, { number = false, key = 'songs' } = {}) {
  const cur = player.current;
  row.className = 'vrow song' + (cur && cur.id === s.id ? ' playing' + (player.paused ? ' paused' : '') : '') + mark(key, s.id);
  row.dataset.id = String(s.id);
  const r = ring(key);
  const lead = number ? `<span class="num">${s.track || i + 1}${r}</span>` : `<span class="art" style="background-image:${artBg(songArt(s))}">${r}</span>`;
  row.innerHTML = `${lead}<span class="txt"><span class="t1">${esc(s.title)}</span><span class="t2">${esc([s.artist || 'Unknown artist', number ? '' : s.album].filter(Boolean).join(' · '))}</span></span><span class="dur">${fmtTime(s.duration)}</span><button class="more" type="button" aria-label="More for ${esc(s.title)}">${ICONS.more}</button>`;
}

function albumRow (r, row) {
  row.innerHTML = '';
  for (let c = 0; c < st.cols; c++) {
    const a = st.list[r * st.cols + c]; if (!a) break;
    const d = document.createElement('div'); d.className = 'acard'; d.dataset.k = a.key;
    d.innerHTML = `<span class="aart art" style="background-image:${artBg(a.art ? a.art + '?s=384' : '')}"></span><span class="at1">${esc(a.name)}</span><span class="at2">${esc(a.artist || 'Unknown artist')}</span>`;
    row.appendChild(d);
  }
}

function artistRow (a, row) {
  row.className = 'vrow artist'; row.dataset.k = a.key;
  const first = a.songs.find(s => s.albumId) || a.songs[0];
  row.innerHTML = `<span class="art round" style="background-image:${artBg(songArt(first))}"></span><span class="txt"><span class="t1">${esc(a.name)}</span><span class="t2">${a.songs.length} song${a.songs.length === 1 ? '' : 's'} · ${a.albums.size} album${a.albums.size === 1 ? '' : 's'}</span></span><span class="chev">${ICONS.chevRight}</span>`;
}

function folderRow (f, row) {
  row.className = 'vrow folder'; row.dataset.k = f.key;
  const where = f.path.replace(/^\/storage\/emulated\/0\/?/, '').replace(/^\/storage\/[^/]+\/?/, 'SD card/');
  row.innerHTML = `<span class="art ico">${ICONS.folder}</span><span class="txt"><span class="t1">${esc(f.name)}</span><span class="t2">${f.songs.length} song${f.songs.length === 1 ? '' : 's'} · ${esc(where || 'Phone')}</span></span><span class="chev">${ICONS.chevRight}</span>`;
}

/** The playing song lit in the lists on screen. */
function markPlaying () {
  const cur = player.current;
  for (const box of [$('mu-list'), $('dt-list')]) {
    for (const r of box.querySelectorAll('.vrow.song')) {
      const on = !!cur && +r.dataset.id === cur.id;
      r.classList.toggle('playing', on);
      r.classList.toggle('paused', on && player.paused);
    }
  }
}

function tapRow (e, inDetail) {
  const empty = e.target.closest('[data-perm], [data-settings], [data-retry], [data-showall]');
  if (empty) {
    if (empty.dataset.perm) call('requestPermission', empty.dataset.perm);
    else if (empty.hasAttribute('data-settings')) call('openAppSettings');
    else if (empty.hasAttribute('data-retry')) loadMusic();
    else if (empty.hasAttribute('data-showall')) { setShowAll(true); render(); }
    return;
  }
  const more = e.target.closest('.more');
  const card = e.target.closest('.acard');
  if (card) { if (!more) openDetail('album', card.dataset.k); return; }
  const row = e.target.closest('.vrow'); if (!row) return;
  if (selecting(inDetail ? 'detail' : 'songs')) { const s = songAt(row, inDetail); if (s) toggle(s); return; }
  if (more) { menuFor(row, inDetail); return; }
  if (inDetail) {
    const i = +row.dataset.i, d = st.detail;
    player.playList(st.dsongs, i, { shuffle: false, from: d.from });
    return;
  }
  const item = st.list[+row.dataset.i]; if (!item) return;
  if (st.kind === 'songs') player.playList(st.list, +row.dataset.i, { shuffle: false, from: st.q ? 'Search' : 'All songs' });
  else if (st.kind === 'artists') openDetail('artist', item.key);
  else if (st.kind === 'folders') openDetail('folder', item.key);
}

// ── an album, an artist or a folder ──────────────────────────────────
export function openDetail (kind, key, keep = false) {
  let item, songs, title, sub, art = '', from;
  if (kind === 'album') {
    item = lib.albums.find(a => a.key === key) || lib.albumById.get(+String(key).slice(1));
    if (!item) return toast('That album is not in the library any more.');
    songs = item.songs; title = item.name; art = item.art ? item.art + '?s=720' : '';
    const len = songs.reduce((n, s) => n + s.duration, 0);
    sub = [item.artist, item.year || '', `${songs.length} song${songs.length === 1 ? '' : 's'}`, fmtTime(len)].filter(Boolean).join(' · ');
    from = 'Album: ' + item.name;
  } else if (kind === 'artist') {
    item = lib.artists.find(a => a.key === key);
    if (!item) return toast('That artist is not in the library any more.');
    songs = item.songs; title = item.name; art = songArt(songs.find(s => s.albumId) || songs[0], 480);
    sub = `${songs.length} song${songs.length === 1 ? '' : 's'} · ${item.albums.size} album${item.albums.size === 1 ? '' : 's'}`;
    from = 'Artist: ' + item.name;
  } else {
    item = lib.folders.find(f => f.key === key);
    if (!item) return toast('That folder is not in the library any more.');
    songs = item.songs; title = item.name;
    sub = `${songs.length} song${songs.length === 1 ? '' : 's'} · ${item.path.replace(/^\/storage\/emulated\/0\/?/, '')}`;
    from = 'Folder: ' + item.name;
  }
  st.detail = { kind, key, from };
  st.dsongs = songs;
  $('dt-title').textContent = kind === 'album' ? 'Album' : kind === 'artist' ? 'Artist' : 'Folder';
  const head = document.createElement('div');
  head.className = 'dt-head dt-' + kind;
  head.innerHTML = (kind === 'folder' ? `<span class="dt-art art ico">${ICONS.folder}</span>` : `<span class="dt-art art${kind === 'artist' ? ' round' : ''}" style="background-image:${artBg(art)}"></span>`) +
    `<div class="dt-titles"><div class="dt-t1">${esc(title)}</div><div class="dt-t2">${esc(sub)}</div></div>` +
    `<div class="dt-btns"><button class="m-btn" type="button" data-play>${ICONS.play}<span>Play</span></button><button class="m-btn m-btn-2" type="button" data-shuffle>${ICONS.shuffle}<span>Shuffle</span></button></div>`;
  head.querySelector('[data-play]').addEventListener('click', () => player.playList(songs, 0, { shuffle: false, from }));
  head.querySelector('[data-shuffle]').addEventListener('click', () => player.playList(songs, -1, { shuffle: true, from }));
  // Drawn again (after a delete): where it was scrolled to stays.
  const y = keep ? $('dt-list').scrollTop : 0;
  st.dvl?.destroy();
  st.dvl = new VList($('dt-list'), { rowHeight: 64, head, render: (i, row) => songRow(songs[i], row, i, { number: kind === 'album', key: 'detail' }) });
  st.dvl.setCount(songs.length);
  if (y) { $('dt-list').scrollTop = y; st.dvl.refresh(); }
  const v = $('v-detail');
  if (!keep) { v.classList.remove('hidden'); requestAnimationFrame(() => v.classList.add('on')); }
  setTimeout(() => st.dvl?.refresh(), 60);                     // the header's height, once laid out
}

export function closeDetail () {
  const v = $('v-detail');
  if (!st.detail) return false;
  endSelect('detail');
  st.detail = null;
  v.classList.remove('on');
  setTimeout(() => { if (!st.detail) { v.classList.add('hidden'); st.dvl?.destroy(); st.dvl = null; } }, 220);
  return true;
}
export const detailOpen = () => !!st.detail;

// ── search and sort ──────────────────────────────────────────────────
function openSearch () {
  $('mu-search').classList.remove('hidden');
  $('mu-q').focus();
}
export function closeSearch () {
  const f = $('mu-search');
  if (f.classList.contains('hidden')) return false;
  f.classList.add('hidden'); $('mu-q').value = ''; $('mu-q').blur();
  if (st.q) { st.q = ''; render(); }
  return true;
}

function sortMenu () {
  const k = st.kind, cur = sortOf(k);
  sheet({
    title: 'Sort ' + k,
    items: SORT_NAMES[k].map(([v, label]) => ({ label, on: v === cur, action: () => { st.sorts[k] = v; try { localStorage.setItem('bm_m_sorts', JSON.stringify(st.sorts)); } catch (_) {} render(); } })),
  });
}

// ── a song's choices ─────────────────────────────────────────────────
const songAt = (row, inDetail) => (inDetail ? st.dsongs[+row.dataset.i] : st.kind === 'songs' ? st.list[+row.dataset.i] : null) || null;

/** A long press: on a song, choosing several starts (or it is added); on an album or a folder, its choices. */
function longPress (row, inDetail) {
  const key = inDetail ? 'detail' : 'songs';
  const s = row.classList.contains('song') ? songAt(row, inDetail) : null;
  if (!s) { menuFor(row, inDetail); return; }
  if (!s.id) { songMenu(s); return; }
  if (selecting(key)) toggle(s); else startSelect(chooser(key), s);
}

/** Choosing several songs: in the Songs list ('songs') or in an album, artist or folder ('detail'). */
function chooser (key) {
  const inDetail = key === 'detail';
  const from = () => (inDetail ? st.detail?.from || '' : '');
  return {
    key, kind: 'audio',
    scroller: inDetail ? $('dt-list') : $('mu-list'),
    items: () => (inDetail ? st.dsongs : st.kind === 'songs' ? st.list : []),
    refresh: () => (inDetail ? st.dvl : st.vl)?.refresh(),
    actions: [
      { icon: 'share', label: 'Share', run: list => { shareItems('audio', list); endSelect(); } },
      ...(canDelete() ? [{ icon: 'trash', label: 'Delete', run: list => deleteItems('audio', list) }] : []),
      { icon: 'more', label: 'More', run: list => sheet({ title: howMany('audio', list.length), items: [
        { icon: 'play', label: 'Play', action: () => { endSelect(); player.playList(list, 0, { shuffle: false, from: from() }); } },
        { icon: 'shuffle', label: 'Shuffle', action: () => { endSelect(); player.playList(list, -1, { shuffle: true, from: from() }); } },
        { icon: 'queueNext', label: 'Play next', action: () => { endSelect(); playNext(list); } },
        { icon: 'queueAdd', label: 'Add to queue', action: () => { endSelect(); addToQueue(list); } },
      ] }) },
    ],
  };
}

/** After the song playing, in their order. Nothing playing: they play. */
function playNext (list) {
  if (!player.current) { player.playList(list, 0, { shuffle: false, from: '' }); return; }
  for (let k = list.length - 1; k >= 0; k--) player.playNext(list[k]);
  toast(list.length === 1 ? 'Plays next: ' + list[0].title : `${list.length} songs play next`);
}
/** At the end of the queue. Nothing playing: they play. */
function addToQueue (list) {
  if (!player.current) { player.playList(list, 0, { shuffle: false, from: '' }); return; }
  for (const s of list) player.addToQueue(s);
  toast(list.length === 1 ? 'Added to the queue' : `${list.length} songs added to the queue`);
}

function menuFor (row, inDetail) {
  if (row.classList.contains('acard')) {
    const a = lib.albums.find(x => x.key === row.dataset.k); if (!a) return;
    return sheet({ title: a.name, sub: a.artist, art: a.art ? a.art + '?s=144' : '', items: [
      { icon: 'play', label: 'Play', action: () => player.playList(a.songs, 0, { shuffle: false, from: 'Album: ' + a.name }) },
      { icon: 'shuffle', label: 'Shuffle', action: () => player.playList(a.songs, -1, { shuffle: true, from: 'Album: ' + a.name }) },
      { icon: 'queueAdd', label: 'Add to queue', action: () => addToQueue(a.songs) },
      ...(canDelete() ? [{ icon: 'trash', label: 'Delete the album', danger: true, note: howMany('audio', a.songs.length), action: () => deleteItems('audio', a.songs) }] : []),
    ] });
  }
  // v3.45.0: a folder of songs, its choices
  if (!inDetail && st.kind === 'folders' && row.classList.contains('folder')) {
    const f = lib.folders.find(x => x.key === row.dataset.k); if (!f) return;
    return sheet({ title: f.name, sub: f.path.replace(/^\/storage\/emulated\/0\/?/, '') || 'Phone', items: [
      { icon: 'play', label: 'Play', action: () => player.playList(f.songs, 0, { shuffle: false, from: 'Folder: ' + f.name }) },
      { icon: 'shuffle', label: 'Shuffle', action: () => player.playList(f.songs, -1, { shuffle: true, from: 'Folder: ' + f.name }) },
      { icon: 'queueAdd', label: 'Add to queue', action: () => addToQueue(f.songs) },
      ...(canDelete() ? [{ icon: 'trash', label: 'Delete the folder', danger: true, note: howMany('audio', f.songs.length), action: () => deleteItems('audio', f.songs, { folder: f.name }) }] : []),
    ] });
  }
  const s = songAt(row, inDetail);
  if (!s) return;
  songMenu(s);
}

export function songMenu (s, { fromPlayer = false } = {}) {
  const album = lib.albums.find(a => (s.albumId && a.id === s.albumId) || (!s.albumId && a.name === (s.album || 'Unknown album')));
  const artist = lib.artists.find(a => a.name === (s.artist || 'Unknown artist'));
  const items = [];
  if (!fromPlayer) {
    items.push({ icon: 'queueNext', label: 'Play next', action: () => { player.playNext(s); toast('Plays next: ' + s.title); } });
    items.push({ icon: 'queueAdd', label: 'Add to queue', action: () => { player.addToQueue(s); toast('Added to the queue'); } });
  }
  if (album) items.push({ icon: 'disc', label: 'Go to the album', note: album.name, action: () => { window.bmClosePlayer?.(); openDetail('album', album.key); } });
  if (artist) items.push({ icon: 'person', label: 'Go to the artist', note: artist.name, action: () => { window.bmClosePlayer?.(); openDetail('artist', artist.key); } });
  if (s.folder) items.push({ icon: 'folder', label: 'Go to the folder', note: s.folderName, action: () => { window.bmClosePlayer?.(); openDetail('folder', s.folder); } });
  const star = fromPlayer ? null : favItem(songFav(s));   // v3.43.0: for Home's Favourites row (Now Playing has its own)
  if (star) items.push(star);
  // v3.45.0: the file itself to another app, or deleted from the phone
  if (s.id) items.push({ icon: 'share', label: 'Share', action: () => shareItems('audio', [s]) });
  items.push({ icon: 'info', label: 'Details', action: () => details(s) });
  if (s.id && canDelete()) items.push({ icon: 'trash', label: 'Delete', danger: true, action: () => deleteItems('audio', [s]) });
  sheet({ title: s.title, sub: [s.artist, s.album].filter(Boolean).join(' · '), art: songArt(s), items });
}

function details (s) {
  const rows = [['Title', s.title], ['Artist', s.artist], ['Album', s.album], ['Album artist', s.albumArtist], ['Track', s.track ? (s.disc ? `${s.disc}.${s.track}` : String(s.track)) : ''],
    ['Year', s.year || ''], ['Genre', s.genre], ['Length', fmtTime(s.duration)], ['Type', s.mime], ['Size', s.size ? fmtSize(s.size) : ''], ['File', s.path || s.file]].filter(r => r[1]);
  const body = document.createElement('div'); body.className = 'sh-info';
  body.innerHTML = rows.map(([k, v]) => `<div class="sh-info-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
  sheet({ title: 'Details', body });
}
