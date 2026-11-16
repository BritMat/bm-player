/**
 * The TV tab (v3.47.0, from app.js; rebuilt in v3.52.0). The channels
 * themselves are modules/tv.js.
 *
 * v3.52.0:
 *   - The list draws only the rows in view, whatever its length. It drew
 *     the first 200 channels and no more, so in a list of 50,000 the other
 *     49,800 could be reached only by searching.
 *   - The playlist kept from before is shown at once, and one from the web
 *     is fetched again in the background when it is older than six hours.
 *   - A channel that drops while playing is tried again, said over the
 *     picture. Next and Previous go to the next and previous channel.
 *   - Favourites and Recent are lists of their own, beside the groups.
 *   - A channel's own user agent and referrer from the playlist are given
 *     to mpv, and mpv waits 20 s for a channel rather than a minute.
 *   - Channel logos can be shown. Off until switched on: each logo is
 *     fetched from the address the playlist gives for it.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player
 * (mixin.js), so `this` is the player.
 */
import { el, escapeHtml, escapeAttr } from '../util.js';
import { ICONS } from '../icons.js';

const ROW = 56;          // px, each channel's row (studio.css: .tv-ch)
const OVER = 8;          // rows drawn above and below the ones in view
const FAVS = '__fav', RECENT = '__recent';
const MPV_OPTS = ['user-agent', 'referrer', 'network-timeout'];

const tint = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return `hsl(${Math.abs(h) % 360} 45% 32%)`; };
const initials = s => (String(s || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(w => [...w][0] || '').join('') || 'TV').toUpperCase();
function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return 'just now';
  if (m < 90) return m + ' minutes ago';
  const h = Math.round(m / 60);
  if (h < 36) return h + ' hours ago';
  return Math.round(h / 24) + ' days ago';
}

export default class TvTabFeature {

  // Set up the first time the TV tab opens (app/parts.js, v3.47.0), not at
  // every start.
  _tvStart(TVModule){
    this.tvModule = new TVModule({
      onPlay: (ch) => this._tvPlayChannel(ch),
      onStatus: (type, msg, ms) => this._tvStatusUpdate(type, msg, ms),
      api: this.api?.tv,
    });
    this._tvLogos = false;
    try { this._tvLogos = localStorage.getItem('bm_tv_logos') === '1'; } catch (_) {}
    this.wireTV();
    this._tvRenderChannels();
    // The playlist kept from before, then a newer copy of it when it is old.
    this._tvReady = this.tvModule.restore().then(async had => {
      if (!had) return;
      this._tvAfterLoad();
      if (this.tvModule.needsRefresh) { await this.tvModule.loadPlaylist(this.tvModule.source); this._tvAfterLoad(true); }
    }).catch(e => console.warn('[BM Player] TV, the kept playlist:', e));
  }

  wireTV(){
    const tv = this.tvModule;
    const load = async source => { await tv.loadPlaylist(source); this._tvAfterLoad(); };
    el('btn-tv-open-m3u')?.addEventListener('click', async () => {
      const file = await this.api?.dialog.openM3u?.();
      if (file) load(file);
    });
    el('btn-tv-open-url')?.addEventListener('click', () => {
      el('dlg-tv-url')?.classList.remove('hidden');
      el('tv-url-input')?.focus();
    });
    el('tv-url-cancel')?.addEventListener('click', () => el('dlg-tv-url')?.classList.add('hidden'));
    el('tv-url-go')?.addEventListener('click', () => {
      const url = el('tv-url-input')?.value?.trim();
      if (!url) return;
      el('dlg-tv-url')?.classList.add('hidden');
      load(url);
    });
    el('tv-url-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') el('tv-url-go')?.click(); });
    el('btn-tv-reload')?.addEventListener('click', async () => { if (tv.source) { await tv.loadPlaylist(tv.source); this._tvAfterLoad(true); } });
    // A letter typed filters after a moment, not at each one.
    let typing = 0;
    el('tv-search')?.addEventListener('input', e => {
      clearTimeout(typing);
      const q = e.target.value;
      typing = setTimeout(() => { tv.setSearch(q); this._tvRenderChannels(); }, 90);
    });
    el('tv-group-filter')?.addEventListener('change', e => { tv.setGroupFilter(e.target.value); this._tvRenderChannels(); });
    el('tv-sort')?.addEventListener('change', e => { tv.setSortBy(e.target.value); this._tvRenderChannels(); });
    const logos = el('btn-tv-logos');
    if (logos) {
      logos.setAttribute('aria-pressed', String(this._tvLogos));
      logos.addEventListener('click', () => {
        this._tvLogos = !this._tvLogos;
        try { localStorage.setItem('bm_tv_logos', this._tvLogos ? '1' : '0'); } catch (_) {}
        logos.setAttribute('aria-pressed', String(this._tvLogos));
        this._tvDraw(true);
      });
    }

    // The list: only the rows in view are there.
    const box = el('tv-channels');
    if (box) {
      let due = 0;
      box.addEventListener('scroll', () => { if (!due) due = requestAnimationFrame(() => { due = 0; this._tvDraw(); }); }, { passive: true });
      try { new ResizeObserver(() => this._tvDraw()).observe(box); } catch (_) {}
      box.addEventListener('click', e => {
        const row = e.target.closest?.('.tv-ch'); if (!row) return;
        const ch = tv.channels[+row.dataset.i]; if (!ch) return;
        const star = e.target.closest('.tv-ch-fav');
        if (star) {
          const on = tv.toggleFavorite(ch.url);
          if (tv.groupFilter === FAVS) this._tvRenderChannels(true);
          else { star.classList.toggle('active', on); star.setAttribute('aria-pressed', String(on)); star.innerHTML = on ? ICONS.starFill : ICONS.star; }
          return;
        }
        tv.play(ch);
      });
      // a logo that will not load gives way to the channel's initials
      box.addEventListener('error', e => { if (e.target?.classList?.contains('tv-ch-img')) e.target.remove(); }, true);
    }
    el('tv-recent-list')?.addEventListener('click', e => {
      const item = e.target.closest?.('.tv-recent'); if (!item) return;
      const r = tv.recent[+item.dataset.i]; if (r) tv.play(r);
    });

    // The channel playing: started, or dropped.
    this.api?.mpv.onEvent?.(ev => { if (ev?.event === 'file-loaded' && tv.isLive) tv.onStreamOk(); });
  }

  /** After a playlist is loaded or restored: the groups, the list, the line under the head. */
  _tvAfterLoad(keepPlace){
    this._tvPopulateGroups();
    this._tvRenderChannels(keepPlace);
    this._tvSourceLine();
  }

  _tvSourceLine(){
    const tv = this.tvModule, s = el('tv-status-text');
    el('btn-tv-reload')?.toggleAttribute('hidden', !tv.source);
    if (!s || !tv.totalChannels || tv.loadError) return;
    s.textContent = `${tv.totalChannels.toLocaleString()} channels from ${tv.sourceName}, loaded ${ago(tv.loadedAt)}`;
  }

  _tvPopulateGroups(){
    const sel = el('tv-group-filter');
    if (!sel) return;
    const tv = this.tvModule;
    sel.textContent = '';
    const add = (value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; sel.appendChild(o); };
    add('all', 'All channels'); add(FAVS, 'Favourites'); add(RECENT, 'Recent');
    for (const g of tv.groups) add(g, g);
    sel.value = tv.groupFilter;
    if (sel.value !== tv.groupFilter) sel.value = 'all';
  }

  /** The list for the filters as they are now. From the top, unless keepPlace. */
  _tvRenderChannels(keepPlace){
    const box = el('tv-channels'), list = el('tv-list'), empty = el('tv-empty');
    if (!box || !list) return;
    const tv = this.tvModule, n = tv.channels.length;
    const count = el('tv-count');
    if (count) count.textContent = !tv.totalChannels && !n ? '' : n === tv.totalChannels ? `${n.toLocaleString()} channel${n === 1 ? '' : 's'}` : `${n.toLocaleString()} of ${tv.totalChannels.toLocaleString()}`;
    list.hidden = !n;
    if (empty) {
      empty.hidden = !!n;
      const has = tv.totalChannels > 0;
      const t = el('tv-empty-text'), h = el('tv-empty-hint');
      if (t) t.textContent = !has ? 'Load an M3U playlist to browse TV channels' : tv.groupFilter === FAVS ? 'No favourites yet' : tv.groupFilter === RECENT ? 'No channels played yet' : 'No channels match';
      if (h) h.textContent = !has ? 'An M3U or M3U8 file, or the address of one. It is kept for the next start.' : tv.groupFilter === FAVS ? 'Press the star on a channel to keep it here.' : tv.groupFilter === RECENT ? 'Channels you play are listed here.' : 'Try another search or group.';
      if (!n) this._tvRenderRecent(!has);
    }
    list.style.height = n * ROW + 'px';
    if (!keepPlace) box.scrollTop = 0;
    this._tvDraw(true);
  }

  /** Draws the rows in view. Called as the list scrolls: does nothing while the same rows are in view. */
  _tvDraw(force){
    const box = el('tv-channels'), rows = el('tv-rows');
    if (!box || !rows || !this.tvModule) return;
    const tv = this.tvModule, list = tv.channels, n = list.length;
    if (!n) { rows.textContent = ''; this._tvDrawn = ''; return; }
    const top = box.scrollTop, h = box.clientHeight || 600;
    const first = Math.max(0, Math.floor(top / ROW) - OVER), last = Math.min(n, Math.ceil((top + h) / ROW) + OVER);
    const sig = first + ':' + last + ':' + n;
    if (!force && sig === this._tvDrawn) return;
    this._tvDrawn = sig;
    const cur = tv.currentChannel?.url, logos = this._tvLogos;
    let html = '';
    for (let i = first; i < last; i++) {
      const ch = list[i], name = ch.title || ch.url, fav = tv.isFavorite(ch.url);
      // logos over https only, as the page allows no other
      const img = logos && /^https:\/\//i.test(ch.logo) ? `<img class="tv-ch-img" src="${escapeAttr(ch.logo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
      html += `<div class="tv-ch${ch.url === cur ? ' now-playing' : ''}" role="listitem" data-i="${i}">`
        + `<button class="tv-ch-play" type="button" aria-label="Play ${escapeAttr(name)}">`
        + `<span class="tv-ch-num">${i + 1}</span>`
        + `<span class="tv-ch-logo" style="background:${escapeAttr(tint(name))}" aria-hidden="true">${escapeHtml(initials(name))}${img}</span>`
        + `<span class="tv-ch-info"><span class="tv-ch-title">${escapeHtml(name)}</span><span class="tv-ch-group">${escapeHtml(ch.group)}</span></span>`
        + `</button>`
        + `<button class="tv-ch-fav${fav ? ' active' : ''}" type="button" title="Favourite" aria-label="Favourite: ${escapeAttr(name)}" aria-pressed="${fav}">${fav ? ICONS.starFill : ICONS.star}</button>`
        + `</div>`;
    }
    rows.style.transform = `translateY(${first * ROW}px)`;
    rows.innerHTML = html;
  }

  _tvStatusUpdate(type, msg, ms){
    const statusEl = el('tv-status-text'), spinner = el('tv-status-spinner');
    const busy = type === 'loading' || type === 'progress';
    spinner?.classList.toggle('hidden', !busy);
    if (type === 'reconnect') { this.showOSD(msg, Math.max(3000, (ms || 0) + 1500)); return; }
    if (type === 'failed') { this.showOSD(msg, 5000); this._tvMpvBack(); if (this.currentDash === 'video') this.stop(); return; }
    if (type === 'streaming') return;
    if (statusEl) statusEl.textContent = msg;
    if (type === 'error' || type === 'kept') this.showOSD(msg, 5000);
  }

  /** Recent channels under the empty state, when no playlist is loaded: each plays from what was kept of it. */
  _tvRenderRecent(show){
    const section = el('tv-recent-section'), list = el('tv-recent-list');
    if (!section || !list) return;
    const recent = this.tvModule.recent.slice(0, 8);
    section.hidden = !show || !recent.length;
    if (section.hidden) { list.textContent = ''; return; }
    list.innerHTML = recent.map((r, i) =>
      `<button class="tv-recent" type="button" data-i="${i}"><span class="tv-ch-logo" style="background:${escapeAttr(tint(r.title || r.url))}" aria-hidden="true">${escapeHtml(initials(r.title || r.url))}</span><span class="tv-ch-title">${escapeHtml(r.title || r.url)}</span></button>`
    ).join('');
  }

  /** mpv told what this channel needs before it is opened: its own headers, and less of a wait for one that is not there. */
  async _tvMpvFor(ch){
    const mpv = this.api?.mpv; if (!mpv?.cmd) return;
    try {
      if (!this._tvMpvWas) {
        const was = {};
        for (const k of MPV_OPTS) { const v = await mpv.cmd('get_property', k); if (v != null && typeof v !== 'object') was[k] = v; }
        this._tvMpvWas = was;
      }
      const was = this._tvMpvWas;
      await mpv.cmd('set_property', 'user-agent', ch.ua || was['user-agent'] || '');
      await mpv.cmd('set_property', 'referrer', ch.ref || was.referrer || '');
      await mpv.cmd('set_property', 'network-timeout', 20);
      this._tvMpvSet = true;
    } catch (_) {}
  }

  /** mpv as it was, for whatever is opened after the channel. */
  _tvMpvBack(){
    if (!this._tvMpvSet) return;
    this._tvMpvSet = false;
    const mpv = this.api?.mpv, was = this._tvMpvWas || {};
    for (const k of MPV_OPTS) if (was[k] != null) mpv?.cmd?.('set_property', k, was[k])?.catch?.(() => {});
  }

  /** Something else is opened, or playback is stopped: the channel is no longer the thing playing. */
  _tvLeave(files){
    const tv = this.tvModule; if (!tv?.isLive) return;
    if (files && files[0] === tv.currentChannel?.url) return;
    tv.stop();
    this._tvMpvBack();
    this._tvMarkPlaying();
  }

  /**
   * mpv says the file ended. True when that was the channel playing and it
   * is being tried again, so nothing else should be done about it. An end
   * with no error counts only for a stream with no length: a film in a
   * playlist that plays to its end is not a dropped channel.
   */
  _tvStreamEnded(reason){
    const tv = this.tvModule; if (!tv?.isLive || !tv.currentChannel) return false;
    if (this._lastOpened !== tv.currentChannel.url) return false;
    if (reason !== 'error' && this.duration > 0) return false;
    tv.onStreamError();
    return true;
  }

  _tvMarkPlaying(){
    const cur = this.tvModule?.currentChannel?.url, list = this.tvModule?.channels || [];
    document.querySelectorAll('#tv-rows .tv-ch').forEach(r => r.classList.toggle('now-playing', !!cur && list[+r.dataset.i]?.url === cur));
  }

  async _tvPlayChannel(ch){
    await this._tvMpvFor(ch);
    if (this.tvModule.currentChannel !== ch) return;   // another was chosen meanwhile
    this.switchDest('video');
    this.playMedia([ch.url]);
    el('title-text') && (el('title-text').textContent = ch.title || 'TV: ' + (ch.group || ''));
    this._tvMarkPlaying();
  }
}
