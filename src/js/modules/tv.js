/**
 * BM Player: the TV tab's channels (v2.0.0, rebuilt in v3.52.0).
 *
 * An M3U playlist read into channels, with search, groups, favourites,
 * recent channels and trying a dropped channel again. The tab itself is
 * app/tv-tab.js.
 *
 * What v3.52.0 changed, each from a measurement or a fault found:
 *   - The playlist is fetched by the app (main/tv-service.js), not the page,
 *     so a server that does not allow other sites can be loaded. The last
 *     one is kept in the app's folder and is there at the next start. It was
 *     in the page's storage: 5,000 channels at most, gone after four hours.
 *   - Reading is by time (12 ms at a go, then the page breathes), not 80
 *     channels a tick. 50,000 channels took 3.7 s, mostly waiting.
 *   - A group name with a comma in it ("News, Local") cut the line at that
 *     comma, so the channel got half a group and a wrong name.
 *   - Sorting is done once for each order and kept, and each channel has its
 *     search text ready, so a letter typed does not sort the list again.
 *   - Favourites and recent channels can be shown by themselves.
 *   - A channel that drops is tried again a few times, then given up on.
 *     This was written before and never called.
 *
 *   const tv = new TVModule({ onPlay, onStatus, api })
 *   await tv.restore()            the playlist kept from before, if any
 *   await tv.loadPlaylist(src)    an address or a file
 *   tv.channels                   what the filters leave, in the chosen order
 */
import { fileURL } from '../util.js';

const STORAGE_FAVS = 'bm_tv_favs';
const STORAGE_RECENT = 'bm_tv_recent';
const STORAGE_PLAYLIST = 'bm_tv_playlist_cache';   // the page's storage, before v3.52.0

export const FAVS = '__fav', RECENT = '__recent';   // the two lists beside the playlist's own groups

const TUNE = {
  slice: 12,                 // ms of reading before the page gets a turn
  fetchTimeout: 20000,       // ms, only without the app's own fetch
  refreshAfter: 6 * 3600000, // a playlist from the web is fetched again when older than this
  tries: 6,                  // times a dropped channel is tried again
  retryBase: 2000, retryMax: 30000,
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const pause = () => new Promise(r => setTimeout(r, 0));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** "#EXTINF:-1 a="b" c="d, e",Name" into its attributes and the name. The name starts at the first comma outside quotes. */
function extinf(line) {
  let quoted = false, cut = -1;
  for (let i = 8; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c === 34) quoted = !quoted;
    else if (c === 44 && !quoted) { cut = i; break; }
  }
  // a line with an odd number of quotes: the last comma, as most players do
  if (cut < 0) cut = line.lastIndexOf(',');
  const head = cut < 0 ? line : line.slice(0, cut), out = { title: cut < 0 ? '' : line.slice(cut + 1).trim() };
  if (head.indexOf('="') > 0) {
    const re = /([a-zA-Z0-9_-]+)="([^"]*)"/g; let m;
    while ((m = re.exec(head))) {
      const k = m[1].toLowerCase();
      if (k === 'group-title') out.group = m[2].trim();
      else if (k === 'tvg-logo') out.logo = m[2].trim();
      else if (k === 'tvg-id') out.id = m[2].trim();
      else if (k === 'tvg-name') out.name = m[2].trim();
    }
  }
  return out;
}

/**
 * One channel from what the lines before its address said. An address may
 * carry its own headers after a bar, as Kodi writes them:
 * http://host/a.m3u8|User-Agent=X&Referer=Y
 */
function channel(url, p) {
  let ua = p.ua || '', ref = p.ref || '';
  const bar = url.indexOf('|');
  if (bar > 0 && /^https?:/i.test(url)) {
    for (const part of url.slice(bar + 1).split('&')) {
      const eq = part.indexOf('='); if (eq < 0) continue;
      const k = part.slice(0, eq).trim().toLowerCase();
      let v = part.slice(eq + 1); try { v = decodeURIComponent(v); } catch (_) {}
      if (k === 'user-agent') ua = v; else if (k === 'referer' || k === 'referrer') ref = v;
    }
    url = url.slice(0, bar);
  }
  const title = p.title || p.name || '';
  const group = p.group || 'Uncategorized';
  const ch = { url, title, group, logo: p.logo || '', key: (title + '\n' + group).toLowerCase() };
  if (p.id) ch.id = p.id;
  if (ua) ch.ua = ua;
  if (ref) ch.ref = ref;
  return ch;
}

/**
 * The channels of an M3U playlist. Reads for `slice` ms at a go and then
 * lets the page have a turn, telling onProgress how many it has. With
 * slice 0 it reads straight through.
 */
export async function parseM3u(text, { slice = TUNE.slice, onProgress } = {}) {
  const out = [];
  let p = {}, at = 0, t0 = now();
  const n = text.length;
  while (at < n) {
    let end = text.indexOf('\n', at); if (end < 0) end = n;
    let line = text.slice(at, end); at = end + 1;
    if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
    line = line.trim();
    if (!line) continue;
    if (line.charCodeAt(0) === 35) {            // #
      if (line.startsWith('#EXTINF:')) p = Object.assign(extinf(line), { ua: p.ua, ref: p.ref, grp: p.grp });
      else if (line.startsWith('#EXTGRP:')) p.grp = line.slice(8).trim();
      else if (line.startsWith('#EXTVLCOPT:')) {
        const o = line.slice(11), eq = o.indexOf('=');
        if (eq > 0) {
          const k = o.slice(0, eq).trim().toLowerCase(), v = o.slice(eq + 1).trim();
          if (k === 'http-user-agent') p.ua = v; else if (k === 'http-referrer' || k === 'http-referer') p.ref = v;
        }
      }
      continue;
    }
    if (!p.group && p.grp) p.group = p.grp;
    out.push(channel(line, p));
    p = {};
    if (slice > 0 && (out.length & 255) === 0 && now() - t0 > slice) {
      onProgress?.(out.length);
      await pause();
      t0 = now();
    }
  }
  return out;
}

const hostOf = s => { try { return new URL(s).host; } catch (_) { return ''; } };

export class TVModule {
  constructor({ onPlay, onStatus, api } = {}) {
    this._channels = [];
    this._filtered = [];
    this._groups = [];
    this._sorted = {};
    this._favorites = new Set(this._loadJson(STORAGE_FAVS, []));
    this._recent = this._loadJson(STORAGE_RECENT, []);
    this._search = '';
    this._words = [];
    this._groupFilter = 'all';
    this._sortBy = 'list';
    this._isLive = false;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._currentChannel = null;
    this._onPlay = onPlay || (() => {});
    this._onStatus = onStatus || (() => {});
    this._api = api || null;
    this._loadError = null;
    this._loading = 0;
    this.source = '';       // where the playlist is from: an address or a file
    this.loadedAt = 0;      // when it was last fetched
  }

  get channels() { return this._filtered; }
  get groups() { return this._groups; }
  get isLive() { return this._isLive; }
  get currentChannel() { return this._currentChannel; }
  get loadError() { return this._loadError; }
  get totalChannels() { return this._channels.length; }
  get sourceName() {
    if (!this.source) return '';
    return /^https?:/i.test(this.source) ? hostOf(this.source) || this.source : this.source.split(/[\\/]/).pop();
  }
  /** A playlist from the web, fetched long enough ago to fetch again. */
  get needsRefresh() { return /^https?:/i.test(this.source) && Date.now() - this.loadedAt > TUNE.refreshAfter; }

  _take(channels, source, at) {
    this._channels = channels;
    this._sorted = {};
    const gset = new Set();
    for (const ch of channels) gset.add(ch.group);
    this._groups = [...gset].sort(collator.compare);
    if (this._groupFilter !== 'all' && this._groupFilter !== FAVS && this._groupFilter !== RECENT && !gset.has(this._groupFilter)) this._groupFilter = 'all';
    this.source = source || ''; this.loadedAt = at || Date.now();
    this._applyFilters();
  }

  /**
   * Loads a playlist from an address or a file. When one is loaded already
   * and this one cannot be read, the channels there stay (kept: true).
   */
  async loadPlaylist(source) {
    const run = ++this._loading;
    const had = this._channels.length > 0;
    this._loadError = null;
    this._onStatus('loading', had && source === this.source ? 'Updating the playlist…' : 'Loading the playlist…');
    let text = '', at = Date.now();
    try {
      if (this._api?.load) {
        const r = await this._api.load(source);
        if (!r || r.error) throw new Error(r?.error || 'no answer');
        text = r.text; at = r.at || at;
      } else {
        // no app behind the page (a browser, a test): the page's own fetch
        const web = /^https?:/i.test(source);
        const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), TUNE.fetchTimeout);
        try {
          const res = await fetch(web ? source : fileURL(source), { signal: ctrl.signal });
          if (!res.ok) throw new Error('the server answered ' + res.status);
          text = await res.text();
        } finally { clearTimeout(tid); }
      }
    } catch (e) {
      if (run !== this._loading) return { channels: this._channels, stale: true };
      this._loadError = String(e.message || e);
      if (had) this._onStatus('kept', `The playlist could not be read just now (${this._loadError}). These are the channels from before.`);
      else this._onStatus('error', `The playlist could not be loaded: ${this._loadError}`);
      return { channels: this._channels, error: this._loadError, kept: had };
    }
    const channels = await parseM3u(text, { onProgress: n => { if (run === this._loading) this._onStatus('progress', `Reading… ${n.toLocaleString()} channels`); } });
    if (run !== this._loading) return { channels: this._channels, stale: true };
    if (!channels.length) {
      this._loadError = 'there are no channels in it';
      this._onStatus(had ? 'kept' : 'error', had ? 'That playlist has no channels in it. These are the channels from before.' : 'That playlist has no channels in it.');
      return { channels: this._channels, error: this._loadError, kept: had };
    }
    this._take(channels, source, at);
    if (this._api?.load) { try { localStorage.removeItem(STORAGE_PLAYLIST); } catch (_) {} }
    else if (channels.length <= 5000) this._saveJson(STORAGE_PLAYLIST, { source, channels: channels.map(({ key, ...c }) => c), ts: at });
    this._onStatus('done', `${channels.length.toLocaleString()} channels loaded`);
    return { channels };
  }

  /** The playlist kept from before: the app's copy, or what the page's storage held before v3.52.0. */
  async restore() {
    try {
      const r = this._api?.restore ? await this._api.restore() : null;
      if (r?.text) {
        const channels = await parseM3u(r.text);
        if (channels.length) { this._take(channels, r.source, r.at); return true; }
      }
    } catch (_) {}
    return this.restoreFromCache();
  }

  /** What the page's storage held (before v3.52.0, and where there is no app behind the page). */
  restoreFromCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_PLAYLIST) || 'null');
      if (!cached || !Array.isArray(cached.channels) || !cached.channels.length) return false;
      const channels = cached.channels.filter(c => c && typeof c.url === 'string').map(c => channel(c.url, { title: c.title, group: c.group, logo: c.logo, id: c.id, ua: c.ua, ref: c.ref }));
      this._take(channels, cached.source, cached.ts);
      return true;
    } catch (_) { return false; }
  }

  /* ── filters ── */
  setSearch(q) {
    this._search = String(q || '').toLowerCase().trim();
    this._words = this._search ? this._search.split(/\s+/) : [];
    this._applyFilters();
  }
  setGroupFilter(g) { this._groupFilter = g || 'all'; this._applyFilters(); }
  setSortBy(s) { this._sortBy = s; this._applyFilters(); }
  get groupFilter() { return this._groupFilter; }
  get sortBy() { return this._sortBy; }

  /** The whole playlist in one order, sorted once and kept until another playlist is loaded. */
  _order(by) {
    if (by !== 'name' && by !== 'group') return this._channels;
    if (!this._sorted[by]) {
      const list = this._channels.slice();
      if (by === 'name') list.sort((a, b) => collator.compare(a.title, b.title));
      else list.sort((a, b) => collator.compare(a.group, b.group) || collator.compare(a.title, b.title));
      this._sorted[by] = list;
    }
    return this._sorted[by];
  }

  _applyFilters() {
    let list;
    const g = this._groupFilter;
    if (g === RECENT) list = this._recent.map(r => this._byUrl(r.url) || channel(r.url, r));
    else {
      list = this._order(this._sortBy);
      if (g === FAVS) list = list.filter(ch => this._favorites.has(ch.url));
      else if (g !== 'all') list = list.filter(ch => ch.group === g);
    }
    const w = this._words;
    if (w.length) {
      // an address is looked in only when what is typed looks like part of one
      const inUrl = /[/:.]/.test(this._search);
      list = list.filter(ch => {
        for (let i = 0; i < w.length; i++) if (ch.key.indexOf(w[i]) < 0 && !(inUrl && ch.url.toLowerCase().indexOf(w[i]) >= 0)) return false;
        return true;
      });
    }
    this._filtered = list;
  }

  _byUrl(url) {
    if (!this._urls || this._urls.for !== this._channels) {
      const m = new Map(); for (const ch of this._channels) if (!m.has(ch.url)) m.set(ch.url, ch);
      this._urls = { for: this._channels, m };
    }
    return this._urls.m.get(url);
  }

  /* ── favourites ── */
  isFavorite(url) { return this._favorites.has(url); }
  toggleFavorite(url) {
    const on = !this._favorites.has(url);
    if (on) this._favorites.add(url); else this._favorites.delete(url);
    this._saveJson(STORAGE_FAVS, [...this._favorites]);
    if (this._groupFilter === FAVS) this._applyFilters();
    return on;
  }
  get favorites() { return [...this._favorites]; }

  /* ── recent ── */
  addRecent(ch) {
    this._recent = this._recent.filter(r => r.url !== ch.url);
    const r = { url: ch.url, title: ch.title, group: ch.group, ts: Date.now() };
    if (ch.logo) r.logo = ch.logo; if (ch.ua) r.ua = ch.ua; if (ch.ref) r.ref = ch.ref;
    this._recent.unshift(r);
    if (this._recent.length > 50) this._recent.length = 50;
    this._saveJson(STORAGE_RECENT, this._recent);
    if (this._groupFilter === RECENT) this._applyFilters();
  }
  get recent() { return this._recent; }

  /* ── playing ── */
  play(ch) {
    this._currentChannel = ch;
    this._isLive = true;
    this._reconnectAttempts = 0;
    clearTimeout(this._reconnectTimer);
    this.addRecent(ch);
    this._onPlay(ch);
  }

  /** The channel after (1) or before (-1) the one playing, in the list as it is shown. Round at the ends. */
  step(dir) {
    const list = this._filtered, cur = this._currentChannel;
    if (!list.length) return null;
    let i = cur ? list.findIndex(c => c.url === cur.url) : -1;
    i = i < 0 ? 0 : (i + (dir < 0 ? -1 : 1) + list.length) % list.length;
    this.play(list[i]);
    return list[i];
  }

  /**
   * The channel playing has dropped or would not start: it is tried again
   * after a pause that grows, a few times. Gives the pause in ms, or 0 when
   * it has been given up on.
   */
  onStreamError() {
    if (!this._isLive || !this._currentChannel) return 0;
    clearTimeout(this._reconnectTimer);
    if (this._reconnectAttempts >= TUNE.tries) {
      const ch = this._currentChannel;
      this.stop();
      this._onStatus('failed', `${ch.title || 'The channel'} could not be reached.`);
      return 0;
    }
    this._reconnectAttempts++;
    const delay = Math.min(TUNE.retryBase * Math.pow(1.8, this._reconnectAttempts - 1), TUNE.retryMax);
    this._onStatus('reconnect', `The channel dropped. Trying again in ${Math.round(delay / 1000)} s (${this._reconnectAttempts} of ${TUNE.tries})…`, delay);
    this._reconnectTimer = setTimeout(() => { if (this._currentChannel && this._isLive) this._onPlay(this._currentChannel, true); }, delay);
    return delay;
  }

  /** The channel is playing: the count of tries starts again once it has held for a while. */
  onStreamOk() {
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._okTimer);
    // counted as holding after 20 s, so a channel that starts and drops at once is still given up on
    this._okTimer = setTimeout(() => { this._reconnectAttempts = 0; }, 20000);
    this._onStatus('streaming', 'Playing');
  }

  stop() {
    this._isLive = false;
    this._currentChannel = null;
    this._reconnectAttempts = 0;
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._okTimer);
  }

  _loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }
  _saveJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }
}

export default TVModule;
