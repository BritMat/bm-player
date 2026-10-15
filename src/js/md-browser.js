/**
 * md-browser: the MilkDrop preset browser (v3.39.0).
 *
 * MilkDrop came with 61 presets and showed them one at a time, by the clock
 * or with Next, and only its name said which one it was. This is a drawer at
 * the right of the window with a picture and the name of every preset, a
 * search box, a star to keep a preset among the favourites, and the shuffle's
 * settings: how often it changes, and whether from the favourites alone.
 *
 * A click starts that preset on every visualiser drawing MilkDrop, and
 * switches to MilkDrop first when another style is on. The drawer stays open
 * and the picture goes on beside it, so presets can be tried one after the
 * other. It opens from the presets button in the visual mode (shown while the
 * style is MilkDrop) and from Browse in the visualiser settings.
 *
 * The pictures are one sheet, vendor/milkdrop/previews.jpg, made from the
 * presets themselves by scripts/build-md-previews.mjs, so the drawer loads
 * one image the first time it opens and none before. A preset with no
 * picture (one added since the sheet was made) shows its name alone.
 */
import { MD_PREVIEWS } from '../vendor/milkdrop/previews.js';
import { vizSettings, saveVizSettings, allVisualisers, mdFavs, setMdFav, mdWatchers } from './visualizer.js';
import { setIcon } from './icons.js';

const el = id => document.getElementById(id);

/** A preset's name as { title, by }: "Author - Title", underscores as spaces. */
export function presetLabel (name) {
  const s = String(name || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const i = s.indexOf(' - ');
  const by = i > 0 ? s.slice(0, i).replace(/^[\s$]+/, '').trim() : '';
  const title = (i > 0 ? s.slice(i + 3) : s).trim();
  return { title: title || s, by };
}

const INDEX = new Map(MD_PREVIEWS.names.map((n, i) => [n, i]));

export class MdBrowser {
  constructor () {
    this.filter = 'all'; this.q = ''; this._wired = false; this._cards = new Map();
    this._onPreset = name => this._mark(name);
  }

  get isOpen () { const d = el('md-browser'); return !!d && !d.classList.contains('hidden'); }

  /** Every preset: the sheet's, in its order, then any loaded one without a picture. */
  names () {
    const v = allVisualisers().find(x => x._mdNames?.length);
    const extra = v ? v._mdNames.filter(n => !INDEX.has(n)) : [];
    return [...MD_PREVIEWS.names, ...extra];
  }

  /** The preset on screen now, or null. */
  current () {
    for (const v of allVisualisers()) if (v.mode === 'milkdrop' && v._mdName) return v._mdName;
    return null;
  }

  show () {
    const d = el('md-browser'); if (!d) return;
    this._wire();
    // The sheet, the first time only.
    // An address in full: a url() in a custom property is read against the
    // style sheet that uses it (css/), not the page.
    if (!d.style.getPropertyValue('--mdb-sheet')) d.style.setProperty('--mdb-sheet', `url("${new URL(MD_PREVIEWS.src, document.baseURI).href}")`);
    mdWatchers.add(this._onPreset);
    d.classList.remove('hidden');
    el('viz-btn-presets')?.setAttribute('aria-expanded', 'true');
    this.render();
    const cur = this._cards.get(this.current());
    (cur || d.querySelector('.mdb-card'))?.scrollIntoView({ block: 'center' });
    el('mdb-search')?.focus({ preventScroll: true });
  }

  hide () {
    const d = el('md-browser'); if (!d || d.classList.contains('hidden')) return;
    d.classList.add('hidden');
    mdWatchers.delete(this._onPreset);
    el('viz-btn-presets')?.setAttribute('aria-expanded', 'false');
  }

  toggle () { this.isOpen ? this.hide() : this.show(); }

  /** Start a preset everywhere MilkDrop is drawn, switching to it first if need be. */
  pick (name) {
    const s = vizSettings();
    if (s.style !== 'milkdrop') {
      saveVizSettings({ ...s, style: 'milkdrop' });
      for (const v of allVisualisers()) if (v.mode !== 'off') v.setMode('milkdrop');
      window.bmVizPanel?.sync?.();
    }
    for (const v of allVisualisers()) if (v.mode === 'milkdrop') v.mdPick(name);
    window.bmApp?.showOSD?.(presetLabel(name).title);
    this._mark(name);
  }

  favourite (name, on) {
    const favs = setMdFav(name, on);
    // Showing them all: only that star changes (the grid keeps its place).
    // Showing the favourites: the list itself changes.
    const card = this._cards.get(name), star = card?.querySelector('.mdb-star');
    if (this.filter !== 'all' || !star) { this.render(); return; }
    star.classList.toggle('on', on); star.setAttribute('aria-pressed', String(on));
    star.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
    setIcon(star, on ? 'starFill' : 'star');
    const fb = el('mdb-filter-fav'); if (fb) fb.textContent = favs.length ? `Favourites (${favs.length})` : 'Favourites';
  }

  render () {
    const grid = el('mdb-grid'); if (!grid) return;
    const favs = new Set(mdFavs()), cur = this.current(), q = this.q.trim().toLowerCase();
    const all = this.names();
    const shown = all.filter(n => (this.filter !== 'fav' || favs.has(n)) && (!q || n.toLowerCase().includes(q)));
    grid.textContent = ''; this._cards.clear();
    const cols = MD_PREVIEWS.cols, rows = Math.ceil(MD_PREVIEWS.names.length / cols);
    for (const n of shown) {
      const { title, by } = presetLabel(n), at = INDEX.get(n);
      const card = document.createElement('div');
      card.className = 'mdb-card' + (n === cur ? ' on' : ''); card.dataset.n = n;
      card.setAttribute('role', 'option'); card.setAttribute('aria-selected', String(n === cur)); card.tabIndex = -1;
      card.title = n;
      const pic = document.createElement('div'); pic.className = 'mdb-pic';
      if (at === undefined) pic.classList.add('none');
      else {
        const c = at % cols, r = Math.floor(at / cols);
        pic.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
        pic.style.backgroundPosition = `${cols > 1 ? c / (cols - 1) * 100 : 0}% ${rows > 1 ? r / (rows - 1) * 100 : 0}%`;
      }
      const star = document.createElement('button');
      star.type = 'button'; star.className = 'mdb-star' + (favs.has(n) ? ' on' : '');
      star.setAttribute('aria-label', favs.has(n) ? 'Remove from favourites' : 'Add to favourites');
      star.setAttribute('aria-pressed', String(favs.has(n)));
      setIcon(star, favs.has(n) ? 'starFill' : 'star');
      pic.appendChild(star);
      const t = document.createElement('div'); t.className = 'mdb-title'; t.textContent = title;
      const b = document.createElement('div'); b.className = 'mdb-by'; b.textContent = by ? 'by ' + by : '';
      card.append(pic, t, b);
      grid.appendChild(card); this._cards.set(n, card);
    }
    if (!shown.length) {
      const e = document.createElement('div'); e.className = 'mdb-empty';
      e.textContent = this.filter === 'fav' && !favs.size ? 'No favourites yet. The star on a preset keeps it here.' : 'No preset has that in its name.';
      grid.appendChild(e);
    }
    const count = el('mdb-count'); if (count) count.textContent = shown.length === all.length ? `${all.length}` : `${shown.length} of ${all.length}`;
    const fb = el('mdb-filter-fav'); if (fb) fb.textContent = favs.size ? `Favourites (${favs.size})` : 'Favourites';
    for (const b of document.querySelectorAll('#mdb-filter button')) b.classList.toggle('active', b.dataset.f === this.filter);
    this._syncShuffle();
  }

  _syncShuffle () {
    const s = vizSettings();
    for (const b of document.querySelectorAll('#mdb-auto button')) b.classList.toggle('active', +b.dataset.v === (s.mdAuto ?? 30));
    const fo = el('mdb-fav-only'); if (fo) fo.checked = !!s.mdFav;
  }

  _mark (name) {
    for (const [n, c] of this._cards) { const on = n === name; c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); }
  }

  _setViz (patch) {
    const s = { ...vizSettings(), ...patch }; saveVizSettings(s);
    for (const v of allVisualisers()) { v.setOptions(s); if (patch.mdFav !== undefined) v.mdReshuffle?.(); }
    window.bmVizPanel?.sync?.(); this._syncShuffle();
  }

  // Arrow keys move between pictures, Enter or Space starts one, Escape closes.
  _key (e) {
    const card = e.target.closest?.('.mdb-card');
    if (e.key === 'Escape') { e.preventDefault(); e.__bmHandled = true; this.hide(); return; }
    if (!card) {
      if (e.target.id === 'mdb-search' && e.key === 'ArrowDown') { e.preventDefault(); e.__bmHandled = true; el('mdb-grid')?.querySelector('.mdb-card')?.focus(); }
      return;
    }
    const cards = [...el('mdb-grid').querySelectorAll('.mdb-card')], i = cards.indexOf(card);
    const across = cards.filter(c => c.offsetTop === cards[0].offsetTop).length || 1;
    const go = j => { const c = cards[Math.max(0, Math.min(cards.length - 1, j))]; c?.focus(); c?.scrollIntoView({ block: 'nearest' }); };
    const keys = { ArrowRight: () => go(i + 1), ArrowLeft: () => go(i - 1), ArrowDown: () => go(i + across), ArrowUp: () => (i < across ? el('mdb-search')?.focus() : go(i - across)), Home: () => go(0), End: () => go(cards.length - 1), Enter: () => this.pick(card.dataset.n), ' ': () => this.pick(card.dataset.n) };
    if (keys[e.key]) { e.preventDefault(); e.__bmHandled = true; keys[e.key](); }
  }

  _wire () {
    if (this._wired) return; this._wired = true;
    const d = el('md-browser'); if (!d) return;
    setIcon(el('mdb-close'), 'x'); setIcon(el('mdb-search-ico'), 'search');
    el('mdb-close')?.addEventListener('click', () => this.hide());
    el('mdb-search')?.addEventListener('input', e => { this.q = e.target.value; this.render(); });
    el('mdb-filter')?.addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (b) { this.filter = b.dataset.f; this.render(); } });
    el('mdb-grid')?.addEventListener('click', e => {
      const star = e.target.closest('.mdb-star'), card = e.target.closest('.mdb-card');
      if (!card) return;
      if (star) { e.stopPropagation(); this.favourite(card.dataset.n, !star.classList.contains('on')); this._cards.get(card.dataset.n)?.querySelector('.mdb-star')?.focus(); return; }
      this.pick(card.dataset.n);
    });
    el('mdb-auto')?.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) this._setViz({ mdAuto: +b.dataset.v }); });
    el('mdb-fav-only')?.addEventListener('change', e => this._setViz({ mdFav: e.target.checked }));
    el('mdb-shuffle')?.addEventListener('click', () => {
      let n = null; for (const v of allVisualisers()) if (v.mode === 'milkdrop') n = v.mdNext(1.5) || n;
      if (n) { window.bmApp?.showOSD?.(presetLabel(n).title); this._cards.get(n)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
    d.addEventListener('keydown', e => this._key(e));
  }
}

function wire () {
  const b = new MdBrowser();
  window.bmMdBrowser = b;
  const btn = el('viz-btn-presets');
  if (btn) { setIcon(btn, 'grid'); btn.addEventListener('click', e => { e.stopPropagation(); b.toggle(); }); }
  el('vs-md-browse')?.addEventListener('click', () => { window.bmVizPanel?.close?.(); b.show(); });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
}
