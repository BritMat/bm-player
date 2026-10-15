/**
 * favourites (v3.43.0): files kept on the welcome screen in a row of their
 * own, under the recent ones, and which of the two rows show. A star adds
 * one: on a recent card, on a song in the music library, and in the
 * right-click menu for what is playing. They open as a recent file does.
 *
 * Both rows are drawn here, as one line each that scrolls sideways, with a
 * drawn icon for each kind of file. The recent row used to put a file's
 * name into the page as it was, so a name with markup in it became markup.
 * Here every name and path is escaped. Preferences, Home screen, shows or
 * hides each row, and so does the Hide button on the row itself.
 */
import { ICONS } from './icons.js';
import { escapeHtml } from './util.js';

const KEY = 'bm_favs', ROWS = 'bm_home_rows', MAX = 60;
const AUDIO = /\.(mp3|flac|wav|m4a|aac|ogg|oga|opus|wma|ape|mka|m4b|aiff?|alac|dsf)$/i;
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch (_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

let list = read(KEY, []);
if (!Array.isArray(list)) list = [];
list = list.filter(x => x && typeof x.path === 'string' && x.path);
const fns = new Set();
function changed (save = true) {
  if (save) write(KEY, list);
  for (const fn of fns) { try { fn(); } catch (e) { console.error('[BM Player] favourites:', e); } }
}

/** The favourite files, the newest first: [{ path, at }]. */
export const favs = () => list.slice();
export const isFav = p => !!p && list.some(x => x.path === p);
/** fn() when the favourites, or which rows show, change. */
export const onFavs = fn => { fns.add(fn); };
/** Stars a file, or takes the star away: true when it is a favourite now. */
export function toggleFav (p) {
  if (typeof p !== 'string' || !p || /^https?:/i.test(p)) return false;
  if (isFav(p)) { list = list.filter(x => x.path !== p); changed(); return false; }
  list = [{ path: p, at: Date.now() }, ...list].slice(0, MAX);
  changed();
  return true;
}
export function clearFavs () { const n = list.length; list = []; changed(); return n; }

/** Which rows the welcome screen shows: { recent, favs }, both unless turned off. */
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

const nameOf = p => String(p).split(/[\\/]/).pop() || String(p);
const kindOf = p => AUDIO.test(p) ? 'music' : /\.pdf$/i.test(p) ? 'pdf' : 'video';

function card (p) {
  const name = nameOf(p), ext = (name.includes('.') ? name.split('.').pop() : '').toUpperCase().slice(0, 6), on = isFav(p);
  const star = on ? 'Remove from favourites' : 'Add to favourites';
  return `<div class="recent-card" role="button" tabindex="0" data-f="${escapeHtml(p)}" title="${escapeHtml(p)}">`
    + `<div class="recent-thumb">${ICONS[kindOf(p)] || ICONS.video}</div>`
    + `<div class="recent-info"><div class="recent-name">${escapeHtml(name)}</div><div class="recent-ext">${escapeHtml(ext)}</div></div>`
    + `<button class="rc-star${on ? ' on' : ''}" type="button" aria-pressed="${on}" aria-label="${star}" title="${star}">${ICONS[on ? 'starFill' : 'star']}</button></div>`;
}

let app = null;
/** Draws both rows from app.recent (paths, the newest first). */
export function renderRows () {
  const rec = app?.recent || [], on = homeRows();
  const rs = document.getElementById('welcome-recent-section'), fs = document.getElementById('welcome-fav-section');
  const rg = document.getElementById('recent-grid'), fg = document.getElementById('fav-grid');
  if (rs) rs.classList.toggle('hidden', !on.recent);
  if (fs) fs.classList.toggle('hidden', !on.favs || !list.length);
  if (rg) rg.innerHTML = rec.length ? rec.slice(0, 16).map(card).join('')
    : `<div class="recent-empty"><span class="re-ico">${ICONS.video}</span><p>No recent files</p></div>`;
  if (fg) fg.innerHTML = list.map(x => card(x.path)).join('');
  const a = document.getElementById('set-home-recent'), b = document.getElementById('set-home-favs');
  if (a) a.checked = on.recent;
  if (b) b.checked = on.favs;
}

/**
 * Once, at start: a = the app ({ recent, playMedia(paths), showOSD(text) }).
 * Clicks on either row open a file or move its star; the rows' own buttons
 * and Preferences' two boxes show and hide them.
 */
export function wireRows (a) {
  app = a;
  const say = t => app?.showOSD?.(t, 2600);
  const onRow = e => {
    const c = e.target.closest('.recent-card'); if (!c) return;
    const p = c.dataset.f;
    if (e.target.closest('.rc-star')) { e.stopPropagation(); say(toggleFav(p) ? 'Added to favourites' : 'Taken out of favourites'); return; }
    app?.playMedia?.([p]);
  };
  for (const id of ['recent-grid', 'fav-grid']) {
    const g = document.getElementById(id); if (!g) continue;
    g.addEventListener('click', onRow);
    g.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('recent-card')) { e.preventDefault(); app?.playMedia?.([e.target.dataset.f]); } });
  }
  document.getElementById('btn-hide-recent')?.addEventListener('click', () => { setHomeRow('recent', false); say('Recent files hidden. Preferences, Home screen, shows them again.'); });
  document.getElementById('btn-hide-favs')?.addEventListener('click', () => { setHomeRow('favs', false); say('Favourites hidden. Preferences, Home screen, shows them again.'); });
  document.getElementById('btn-clear-favs')?.addEventListener('click', () => { const n = clearFavs(); say(n ? 'No favourites now' : 'There were none'); });
  document.getElementById('set-home-recent')?.addEventListener('change', e => setHomeRow('recent', e.target.checked));
  document.getElementById('set-home-favs')?.addEventListener('change', e => setHomeRow('favs', e.target.checked));
  onFavs(renderRows);
  renderRows();
}
