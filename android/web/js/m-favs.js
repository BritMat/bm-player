/**
 * m-favs (v3.43.0): the favourites, for Home's Favourites row. A song, a
 * video, a picture or a PDF is starred from its menu, the player, the
 * picture viewer, the PDF reader or Home's recent row, and kept here, the
 * newest first. Each is shaped as a recent thing is (m-recent.js), so Home
 * shows and opens both rows the same way. A song is kept by its id in the
 * phone's library, so a tap plays the starred songs one after another.
 *
 * Which of Home's two rows show is kept here as well (homeRows).
 */
import { songArt } from './m-library.js';
import { videoKey } from './m-recent.js';
import { toast } from './m-ui.js';

const KEY = 'bm_m_favs', ROWS = 'bm_m_home_rows', MAX = 100;
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch (_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

let list = read(KEY, []);
if (!Array.isArray(list)) list = [];
list = list.filter(x => x && typeof x.key === 'string' && x.kind);
const fns = new Set();
function changed (save = true) {
  if (save) write(KEY, list);
  for (const fn of fns) { try { fn(); } catch (e) { console.error('[BM Player] favourites:', e); } }
}

/** The favourites, the newest first. */
export const favs = () => list.slice();
export const isFav = key => !!key && list.some(x => x.key === key);
/** fn() when the favourites, or which rows Home shows, change. */
export const onFavs = fn => { fns.add(fn); };
export function addFav (e) {
  if (!e?.key) return;
  list = [{ ...e, at: Date.now() }, ...list.filter(x => x.key !== e.key)].slice(0, MAX);
  changed();
}
export function removeFav (key) {
  const n = list.length;
  list = list.filter(x => x.key !== key);
  if (list.length !== n) changed();
}
/** Stars it, or takes the star away: true when it is a favourite now. */
export function toggleFav (e) {
  if (!e?.key) return false;
  if (isFav(e.key)) { removeFav(e.key); return false; }
  addFav(e);
  return true;
}
export function clearFavs () { const n = list.length; list = []; changed(); return n; }
/** Several taken away at once, one write (things deleted from the phone, v3.45.0). */
export function removeFavs (keys) {
  const n = list.length;
  list = list.filter(x => !keys.has(x.key));
  if (list.length !== n) changed();
}

/** The star as an item for a menu (sheet): adds or takes away, and says so. */
export function favItem (e) {
  if (!e?.key) return null;
  const on = isFav(e.key);
  return { icon: on ? 'starFill' : 'star', label: on ? 'Remove from favourites' : 'Add to favourites',
    action: () => toast(toggleFav(e) ? 'Added to favourites' : 'Taken out of favourites', 1300) };
}

// ── what each kind of thing is kept as ──────────────────────────────
/** A song in the phone's library (one opened from another app has no id, and is not kept). */
export const songFav = s => s?.id ? { kind: 'music', key: 's' + s.id, id: s.id, title: s.title || 'Song', sub: s.artist || s.album || 'Music', art: songArt(s, 256) } : null;
export const videoFav = x => x ? { kind: 'video', key: videoKey(x), title: x.title || 'Video', sub: x.folder || '', url: x.url, id: x.id || 0, thumb: x.thumb || '', docKey: x.docKey || null, file: x.file || '', size: x.size || 0 } : null;
export const imageKey = it => it?.docKey ? 'd' + it.docKey : 'i' + (it?.url || '');
export const imageFav = it => it ? { kind: 'image', key: imageKey(it), title: it.title || 'Picture', sub: it.folder || 'Picture', url: it.url, id: it.id || 0, thumb: it.thumb || '', docKey: it.docKey || null } : null;
export const pdfFav = (item, key) => item ? { kind: 'pdf', key, title: item.title || 'Document', sub: 'PDF', url: item.url, docKey: item.docKey || null } : null;

// ── Home's rows ──────────────────────────────────────────────────────
/** Which rows Home shows: { recent, favs }, both by default. */
export function homeRows () {
  const r = read(ROWS, {}) || {};
  return { recent: r.recent !== false, favs: r.favs !== false };
}
export function setHomeRow (k, on) {
  const r = homeRows();
  r[k] = !!on;
  write(ROWS, r);
  changed(false);
}
