/**
 * The TV tab (v3.47.0, from app.js). The channel lists themselves are modules/tv.js.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { el, seedGrad, escapeHtml, escapeAttr, basenameOf } from '../util.js';
import { ICONS } from '../icons.js';

export default class TvTabFeature {

  // ════════════════════════════════════════════════════════════════
  // RELOCATED: these lived inside PDFViewer while BMPlayer.init() called
  // this._tvRenderRecent() — so init() threw on every single launch.
  // Everything after that line never ran: wireTV(), the always-on-top
  // restore, the window-state listener, and critically
  //     window.addEventListener('contextmenu', ...)
  // which is why right-click did nothing. window.bmPlayer was never
  // assigned either, since the constructor never returned.
  // ════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  // v2.0.0 — TV / IPTV
  // ════════════════════════════════════════════════════════════════

  // Set up the first time the TV tab opens (app/parts.js, v3.47.0), not at
  // every start: until then the saved channel list is not read, sorted or
  // drawn. Its groups are put in the filter as well, which a restart left
  // empty before (only a playlist loaded there and then filled it).
  _tvStart(TVModule){
    this.tvModule = new TVModule({
      onPlay: (ch) => this._tvPlayChannel(ch),
      onStatus: (type, msg) => this._tvStatusUpdate(type, msg),
    });
    if (this.tvModule.restoreFromCache()) { this._tvPopulateGroups(); this._tvRenderChannels(); }
    this._tvRenderRecent();
    this.wireTV();
  }

  wireTV(){
    const tv = this.tvModule;
    // Open M3U file
    el('btn-tv-open-m3u')?.addEventListener('click', async () => {
      const file = await this.api?.dialog.openM3u?.();
      if (!file) return;
      const result = await tv.loadPlaylist(file);
      if (result.warned) el('tv-eco-warning')?.classList.remove('hidden');
      this._tvPopulateGroups();
      this._tvRenderChannels();
    });
    // Open URL dialog
    el('btn-tv-open-url')?.addEventListener('click', () => {
      el('dlg-tv-url')?.classList.remove('hidden');
      el('tv-url-input')?.focus();
    });
    el('tv-url-cancel')?.addEventListener('click', () => el('dlg-tv-url')?.classList.add('hidden'));
    el('tv-url-go')?.addEventListener('click', async () => {
      const url = el('tv-url-input')?.value?.trim();
      if (!url) return;
      el('dlg-tv-url')?.classList.add('hidden');
      const result = await tv.loadPlaylist(url);
      if (result.warned) el('tv-eco-warning')?.classList.remove('hidden');
      this._tvPopulateGroups();
      this._tvRenderChannels();
    });
    el('tv-url-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') el('tv-url-go')?.click(); });
    // Search
    el('tv-search')?.addEventListener('input', e => {
      tv.setSearch(e.target.value);
      this._tvRenderChannels();
    });
    // Group filter
    el('tv-group-filter')?.addEventListener('change', e => {
      tv.setGroupFilter(e.target.value);
      this._tvRenderChannels();
    });
    // Sort
    el('tv-sort')?.addEventListener('change', e => {
      tv.setSortBy(e.target.value);
      this._tvRenderChannels();
    });
    // Eco warning dismiss
    el('tv-eco-dismiss')?.addEventListener('click', () => el('tv-eco-warning')?.classList.add('hidden'));
    // Reconnect stop
    el('tv-reconnect-stop')?.addEventListener('click', () => { tv.stop(); el('tv-reconnect-bar')?.classList.add('hidden'); });
  }

  _tvPopulateGroups(){
    const sel = el('tv-group-filter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="all">All Groups</option>';
    for (const g of this.tvModule.groups) {
      const opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      sel.appendChild(opt);
    }
    sel.value = current;
  }

  _tvRenderChannels(){
    const container = el('tv-channels');
    const countEl = el('tv-count');
    if (!container) return;
    const channels = this.tvModule.channels;
    if (countEl) countEl.textContent = channels.length ? `${channels.length} channel${channels.length !== 1 ? 's' : ''}` : '';
    if (!channels.length) {
      // Show empty state with recent
      container.innerHTML = `<div class="tv-empty"><span class="st-empty-ico" aria-hidden="true">${ICONS.tv}</span><p>No channels match your filter</p></div>`;
      return;
    }
    // Virtual render: only render visible chunk for perf
    const FRAG_SIZE = 200;
    const html = [];
    const limit = Math.min(channels.length, FRAG_SIZE);
    for (let i = 0; i < limit; i++) {
      const ch = channels[i];
      const isNow = this.tvModule.currentChannel?.url === ch.url;
      const isFav = this.tvModule.isFavorite(ch.url);
      html.push(`<div class="tv-ch${isNow ? ' now-playing' : ''}" data-idx="${i}" data-url="${escapeAttr(ch.url)}">
      <div class="tv-ch-num">${i + 1}</div>
      <div class="tv-ch-info"><div class="tv-ch-title">${escapeHtml(ch.title || ch.url)}</div><div class="tv-ch-group">${escapeHtml(ch.group)}</div></div>
      <button class="tv-ch-fav${isFav ? ' active' : ''}" data-url="${escapeAttr(ch.url)}" title="Favorite" aria-label="Toggle favourite for ${escapeAttr(ch.title || ch.url)}" aria-pressed="${isFav}">★</button>
      <div class="tv-ch-probe" data-url="${escapeAttr(ch.url)}"></div>
    </div>`);
    }
    container.innerHTML = html.join('');
    // Wire clicks (event delegation)
    container.onclick = (e) => {
      const card = e.target.closest('.tv-ch');
      if (!card) return;
      // Fav button?
      if (e.target.closest('.tv-ch-fav')) {
        const url = e.target.closest('.tv-ch-fav').dataset.url;
        this.tvModule.toggleFavorite(url);
        this._tvRenderChannels();
        return;
      }
      // Play channel
      const idx = parseInt(card.dataset.idx, 10);
      const ch = channels[idx];
      if (ch) this.tvModule.play(ch);
    };
  }

  _tvStatusUpdate(type, msg){
    const statusEl = el('tv-status-text');
    const spinnerEl = el('tv-status-spinner');
    const warningEl = el('tv-eco-warning');
    const warnMsgEl = el('tv-eco-msg');
    const reconBar = el('tv-reconnect-bar');
    const reconText = el('tv-reconnect-text');
    if (!statusEl) return;
    if (type === 'loading' || type === 'progress') {
      statusEl.textContent = msg;
      spinnerEl?.classList.remove('hidden');
    } else if (type === 'warn') {
      warningEl?.classList.remove('hidden');
      if (warnMsgEl) warnMsgEl.textContent = msg;
    } else if (type === 'done') {
      statusEl.textContent = msg;
      spinnerEl?.classList.add('hidden');
    } else if (type === 'error') {
      statusEl.textContent = msg;
      spinnerEl?.classList.add('hidden');
      this.showOSD(msg, 4000);
    } else if (type === 'streaming') {
      statusEl.textContent = msg;
      reconBar?.classList.add('hidden');
    } else if (type === 'reconnect') {
      reconBar?.classList.remove('hidden');
      if (reconText) reconText.textContent = msg;
    }
  }

  _tvRenderRecent(){
    const section = el('tv-recent-section');
    const list = el('tv-recent-list');
    if (!section || !list) return;
    const recent = this.tvModule.recent;
    if (!recent.length) return;
    section.style.display = '';
    list.innerHTML = recent.slice(0, 12).map(r =>
      `<div class="recent-item" data-url="${escapeAttr(r.url)}"><div class="recent-thumb" style="${seedGrad(r.title||r.url)}"></div><div class="recent-meta"><span class="recent-name">${escapeHtml(r.title||basenameOf(r.url))}</span></div></div>`
    ).join('');
    list.onclick = (e) => {
      const item = e.target.closest('.recent-item');
      if (!item) return;
      const url = item.dataset.url;
      const ch = this.tvModule.channels.find(c => c.url === url);
      if (ch) { this.tvModule.play(ch); this.switchDest('tv'); }
    };
  }

  _tvPlayChannel(ch){
    // Switch to video player and open the stream URL
    this.switchDest('video');
    this.playMedia([ch.url]);
    el('title-text') && (el('title-text').textContent = ch.title || 'TV — ' + (ch.group || ''));
    this._tvRenderChannels(); // refresh now-playing highlight
  }
}
