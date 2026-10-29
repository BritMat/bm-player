/**
 * m-library: the phone's music and videos, from Android's media index
 * (/api/library/audio and /video, MediaLibrary.java), as songs, albums,
 * artists and folders, sorted and searchable.
 */
import { norm, collator } from './m-ui.js';

export const lib = {
  songs: [], all: [], albums: [], artists: [], folders: [],
  videos: [], videoFolders: [],
  byId: new Map(), albumById: new Map(),
  loaded: false, videosLoaded: false,
};

const ALL_KEY = 'bm_m_allaudio';
export const showAll = () => { try { return localStorage.getItem(ALL_KEY) === '1'; } catch (e) { return false; } };
export function setShowAll (on) { try { localStorage.setItem(ALL_KEY, on ? '1' : '0'); } catch (e) {} build(); }

// Not music: chat apps' voice notes, recordings, the phone's own sounds.
const NOT_MUSIC = /\/(whatsapp|telegram|signal|viber|messenger|recordings?|call ?rec[a-z]*|voice ?(recorder|notes?|memos?)|notifications|ringtones|alarms|ui)(\/|$)/i;

function song (x) {
  const p = x.p || '', slash = p.lastIndexOf('/');
  const folder = slash > 0 ? p.slice(0, slash) : '';
  const file = x.fn || (slash >= 0 ? p.slice(slash + 1) : '');
  const title = (x.t || '').trim() || file.replace(/\.[^.]+$/, '') || 'Unknown';
  const n = +x.n || 0;
  return {
    id: x.i, title, artist: (x.a || '').trim().replace(/^<unknown>$/i, ''), album: (x.al || '').trim(), albumId: +x.ai || 0, albumArtist: (x.aa || '').trim(),
    duration: (+x.d || 0) / 1000, track: n % 1000, disc: Math.floor(n / 1000), year: +x.y || 0, added: +x.da || 0,
    size: +x.s || 0, mime: x.m || '', path: p, file, folder, folderName: folder.slice(folder.lastIndexOf('/') + 1) || 'Phone',
    music: !!x.mu, genre: x.g || '',
    url: '/media/audio/' + x.i,
  };
}

const isMusic = s => s.music && s.duration >= 15 && !NOT_MUSIC.test(s.folder + '/');

/** Fetches the music from Android. Throws when the page may not read it. */
export async function loadSongs () {
  const r = await fetch('/api/library/audio', { cache: 'no-store' });
  if (r.status === 403) { const e = new Error('no permission'); e.permission = true; throw e; }
  if (!r.ok) throw new Error('the music list could not be read (' + r.status + ')');
  const raw = await r.json();
  lib.all = raw.map(song);
  lib.byId = new Map(lib.all.map(s => [s.id, s]));
  build();
  lib.loaded = true;
  return lib.songs;
}

/** Songs, albums, artists and folders from what was read, as the settings say. */
export function build () {
  const songs = showAll() ? lib.all.slice() : lib.all.filter(isMusic);
  songs.sort((a, b) => collator.compare(a.title, b.title));
  lib.songs = songs;
  const albums = new Map(), artists = new Map(), folders = new Map();
  for (const s of songs) {
    const ak = s.albumId ? 'i' + s.albumId : 'n' + norm(s.album);
    let a = albums.get(ak);
    if (!a) albums.set(ak, a = { id: s.albumId, key: ak, name: s.album || 'Unknown album', songs: [], artists: new Map(), year: 0, albumArtist: '' });
    a.songs.push(s);
    if (s.artist) a.artists.set(s.artist, (a.artists.get(s.artist) || 0) + 1);
    if (s.albumArtist && !a.albumArtist) a.albumArtist = s.albumArtist;
    if (s.year > a.year) a.year = s.year;
    const rk = norm(s.artist) || '?';
    let r = artists.get(rk);
    if (!r) artists.set(rk, r = { key: rk, name: s.artist || 'Unknown artist', songs: [], albums: new Set() });
    r.songs.push(s); r.albums.add(ak);
    let f = folders.get(s.folder);
    if (!f) folders.set(s.folder, f = { key: s.folder, path: s.folder, name: s.folderName, songs: [] });
    f.songs.push(s);
  }
  for (const a of albums.values()) {
    const top = [...a.artists.entries()].sort((x, y) => y[1] - x[1]);
    a.artist = a.albumArtist || (top.length > 1 && top[0][1] < a.songs.length * 0.6 ? 'Various artists' : top[0]?.[0] || '');
    a.songs.sort((x, y) => (x.disc - y.disc) || (x.track - y.track) || collator.compare(x.title, y.title));
    a.art = a.id ? `/art/album/${a.id}` : (a.songs[0] ? `/art/audio/${a.songs[0].id}` : '');
  }
  lib.albums = [...albums.values()].sort((x, y) => collator.compare(x.name, y.name));
  lib.albumById = new Map(lib.albums.filter(a => a.id).map(a => [a.id, a]));
  lib.artists = [...artists.values()].sort((x, y) => (x.key === '?') - (y.key === '?') || collator.compare(x.name, y.name));
  for (const r of lib.artists) r.songs.sort((x, y) => collator.compare(x.album, y.album) || (x.disc - y.disc) || (x.track - y.track));
  lib.folders = [...folders.values()].sort((x, y) => collator.compare(x.name, y.name) || collator.compare(x.path, y.path));
  for (const f of lib.folders) f.songs.sort((x, y) => collator.compare(x.file, y.file));
}

/** A song's picture: its album's when it has one (shared, so fewer to make), else its own. */
export const songArt = (s, px = 144) => !s ? '' : s.albumId ? `/art/album/${s.albumId}?s=${px}` : s.id ? `/art/audio/${s.id}?s=${px}` : '';

const SORTS = {
  songs: { title: (a, b) => collator.compare(a.title, b.title), artist: (a, b) => collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title),
    album: (a, b) => collator.compare(a.album, b.album) || (a.track - b.track), added: (a, b) => b.added - a.added, length: (a, b) => b.duration - a.duration },
  albums: { name: (a, b) => collator.compare(a.name, b.name), artist: (a, b) => collator.compare(a.artist, b.artist) || collator.compare(a.name, b.name), year: (a, b) => b.year - a.year },
  artists: { name: (a, b) => (a.key === '?') - (b.key === '?') || collator.compare(a.name, b.name), songs: (a, b) => b.songs.length - a.songs.length },
  folders: { name: (a, b) => collator.compare(a.name, b.name), songs: (a, b) => b.songs.length - a.songs.length },
};
export const SORT_NAMES = {
  songs: [['title', 'Title'], ['artist', 'Artist'], ['album', 'Album'], ['added', 'Recently added'], ['length', 'Length']],
  albums: [['name', 'Name'], ['artist', 'Artist'], ['year', 'Year']],
  artists: [['name', 'Name'], ['songs', 'Most songs']],
  folders: [['name', 'Name'], ['songs', 'Most songs']],
};

/** What a list shows: lib[kind], filtered by the words searched for, in the order chosen. */
export function view (kind, sort, q) {
  let list = lib[kind] || [];
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (words.length) {
    const text = kind === 'songs' ? s => s._q || (s._q = norm(`${s.title} ${s.artist} ${s.album}`))
      : kind === 'albums' ? a => a._q || (a._q = norm(`${a.name} ${a.artist}`))
        : x => x._q || (x._q = norm(`${x.name} ${x.path || ''}`));
    list = list.filter(x => { const t = text(x); return words.every(w => t.includes(w)); });
  }
  const f = SORTS[kind]?.[sort];
  if (f && !(sort === 'title' && kind === 'songs') && !(sort === 'name' && kind !== 'songs')) list = list.slice().sort(f);
  return list;
}

// ── videos ───────────────────────────────────────────────────────────
function video (x) {
  const p = x.p || '', slash = p.lastIndexOf('/');
  const file = x.fn || (slash >= 0 ? p.slice(slash + 1) : '');
  return {
    id: x.i, title: (x.t || '').trim() || file.replace(/\.[^.]+$/, '') || 'Video', file, duration: (+x.d || 0) / 1000, size: +x.s || 0,
    w: +x.w || 0, h: +x.h || 0, added: +x.da || 0, mime: x.m || '', folder: (x.f || '').trim() || (slash > 0 ? p.slice(p.lastIndexOf('/', slash - 1) + 1, slash) : 'Phone'),
    path: p, rotation: +x.o || 0, url: '/media/video/' + x.i, thumb: `/thumb/video/${x.i}?s=320`,
  };
}

export async function loadVideos () {
  const r = await fetch('/api/library/video', { cache: 'no-store' });
  if (r.status === 403) { const e = new Error('no permission'); e.permission = true; throw e; }
  if (!r.ok) throw new Error('the video list could not be read (' + r.status + ')');
  lib.videos = (await r.json()).map(video).sort((a, b) => b.added - a.added);
  lib.videoFolders = groups(lib.videos);
  lib.videosLoaded = true;
  return lib.videos;
}

/** Videos or pictures by folder: name, how many, their size, and the newest one's picture (v3.42.0). */
function groups (items) {
  const folders = new Map();
  for (const x of items) {
    let f = folders.get(x.folder);
    if (!f) folders.set(x.folder, f = { name: x.folder, count: 0, size: 0, thumb: x.thumb, added: x.added || 0 });
    f.count++; f.size += x.size || 0;
    if ((x.added || 0) > f.added) { f.added = x.added; f.thumb = x.thumb; }
  }
  return [...folders.values()].sort((a, b) => collator.compare(a.name, b.name));
}

// ── pictures (v3.42.0) ───────────────────────────────────────────────
lib.images = []; lib.imageAlbums = []; lib.imagesLoaded = false;
function image (x) {
  const p = x.p || '', slash = p.lastIndexOf('/');
  const file = x.fn || (slash >= 0 ? p.slice(slash + 1) : '');
  return {
    id: x.i, title: file || 'Picture', file, size: +x.s || 0, w: +x.w || 0, h: +x.h || 0, added: +x.da || 0, taken: +x.dt || 0,
    mime: x.m || '', folder: (x.b || '').trim() || (slash > 0 ? p.slice(p.lastIndexOf('/', slash - 1) + 1, slash) : 'Phone'), path: p, rotation: +x.o || 0,
    url: '/media/image/' + x.i, thumb: `/thumb/image/${x.i}?s=256`,
  };
}

export async function loadImages () {
  const r = await fetch('/api/library/image', { cache: 'no-store' });
  if (r.status === 403) { const e = new Error('no permission'); e.permission = true; throw e; }
  if (!r.ok) throw new Error('the pictures could not be read (' + r.status + ')');
  lib.images = (await r.json()).map(image).sort((a, b) => (b.taken || b.added * 1000) - (a.taken || a.added * 1000));
  lib.imageAlbums = groups(lib.images);
  lib.imagesLoaded = true;
  return lib.images;
}

// ── deleted from the phone (v3.45.0, m-delete.js) ────────────────────
/** What was deleted taken out of the lists: kind 'image', 'video' or 'audio', ids a Set. */
export function forgetMedia (kind, ids) {
  if (!ids?.size) return;
  if (kind === 'image') {
    lib.images = lib.images.filter(x => !ids.has(x.id));
    lib.imageAlbums = groups(lib.images);
  } else if (kind === 'video') {
    lib.videos = lib.videos.filter(x => !ids.has(x.id));
    lib.videoFolders = groups(lib.videos);
  } else if (kind === 'audio') {
    lib.all = lib.all.filter(s => !ids.has(s.id));
    for (const id of ids) lib.byId.delete(id);
    build();
  }
}
