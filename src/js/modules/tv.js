/**
 * BM Player — TV / IPTV Module (v2.0.0)
 *
 * Handles M3U/M3U8 playlist loading for live TV / IPTV streams with:
 *   - Progressive (eco-balanced) loading — never parse more than N entries
 *     per tick to keep the UI thread responsive
 *   - Configurable timeouts on network fetches (default 15 s)
 *   - Channel count warning before loading huge playlists (>500 entries)
 *   - Search, group-by-category, favorites, and recent history
 *   - Auto-reconnect on stream failure with exponential backoff
 *   - Resource governor: caps concurrent stream probes to 3
 */

import { fileURL } from '../util.js';

const STORAGE_FAVS  = 'bm_tv_favs';
const STORAGE_RECENT = 'bm_tv_recent';
const STORAGE_PLAYLIST = 'bm_tv_playlist_cache';

// ── Eco governor tunables ──────────────────────────────────────────
const ECO = {
  parseChunkSize: 80,        // entries per animation frame
  fetchTimeout: 15000,        // ms — network fetch abort
  warnThreshold: 500,         // show warning dialog above this many entries
  maxProbes: 3,               // concurrent stream probes
  probeTimeout: 8000,         // per-probe timeout
  reconnectBaseMs: 2000,     // base reconnect delay
  reconnectMaxMs: 30000,      // max reconnect delay
  staleCacheMs: 4 * 3600000, // 4 h — re-fetch cached playlist
};

/** Simple AbortController-based fetch with timeout. */
async function fetchWithTimeout(url, timeoutMs = ECO.fetchTimeout) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    return res;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

/** Probe a stream URL — returns true if reachable within timeout. */
export async function probeStream(url, timeoutMs = ECO.probeTimeout) {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, method: 'HEAD' });
    clearTimeout(tid);
    return res.ok;
  } catch (_) {
    return false;
  }
}

// ── Progressive M3U parser (yields chunks to avoid blocking) ──────
function* parseM3uProgressive(lines) {
  let pending = null;
  const chunk = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      const rest = line.slice(8);
      const comma = rest.indexOf(',');
      let title = '', duration = -1, group = '', logo = '';
      if (comma === -1) {
        const d = parseInt(rest, 10);
        if (!isNaN(d)) duration = d;
      } else {
        const d = parseInt(rest.slice(0, comma), 10);
        if (!isNaN(d)) duration = d;
        const attrs = rest.slice(comma + 1).trim();
        // Parse tvg-logo, group-title from attributes before comma
        const attrMatch = rest.slice(0, comma).match(/group-title="([^"]*)"/i);
        if (attrMatch) group = attrMatch[1];
        const logoMatch = rest.slice(0, comma).match(/tvg-logo="([^"]*)"/i);
        if (logoMatch) logo = logoMatch[1];
        title = attrs;
      }
      pending = { title, duration, group, logo };
    } else if (line.startsWith('#')) {
      // Other directives — skip (but capture group-title if present)
      const gm = line.match(/group-title="([^"]*)"/i);
      if (gm && pending) pending.group = pending.group || gm[1];
      const lm = line.match(/tvg-logo="([^"]*)"/i);
      if (lm && pending) pending.logo = pending.logo || lm[1];
      continue;
    } else {
      const url = line;
      chunk.push({
        url,
        title: pending?.title || '',
        duration: pending?.duration ?? -1,
        group: pending?.group || 'Uncategorized',
        logo: pending?.logo || '',
      });
      pending = null;
      if (chunk.length >= ECO.parseChunkSize) {
        yield chunk.splice(0, ECO.parseChunkSize);
      }
    }
  }
  if (chunk.length) yield chunk;
}

// ── Main TV Module Class ───────────────────────────────────────────

export class TVModule {
  constructor({ onPlay, onStatus }) {
    this._channels = [];
    this._filtered = [];
    this._groups = [];
    this._favorites = this._loadJson(STORAGE_FAVS, []);
    this._recent = this._loadJson(STORAGE_RECENT, []);
    this._search = '';
    this._groupFilter = 'all';
    this._sortBy = 'name';
    this._isLive = false;      // true when a stream is actively playing
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._currentChannel = null;
    this._onPlay = onPlay || (() => {});
    this._onStatus = onStatus || (() => {});
    this._probeSem = 0;       // semaphore for concurrent probes
    this._loadError = null;
  }

  /* ─── Public getters ─────────────────────────────────────── */
  get channels()   { return this._filtered; }
  get groups()     { return this._groups; }
  get isLive()     { return this._isLive; }
  get currentChannel() { return this._currentChannel; }
  get loadError()  { return this._loadError; }
  get totalChannels() { return this._channels.length; }

  /* ─── Load a playlist (URL or file path) ─────────────────── */
  async loadPlaylist(source) {
    this._loadError = null;
    this._onStatus('loading', 'Loading playlist…');

    let text;
    try {
      if (source.startsWith('http://') || source.startsWith('https://')) {
        const res = await fetchWithTimeout(source);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      } else {
        // Local file — fetch via file:// protocol (Electron allows this)
        const res = await fetch(fileURL(source));
        if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
        text = await res.text();
      }
    } catch (e) {
      this._loadError = `Failed to load playlist: ${e.message}`;
      this._onStatus('error', this._loadError);
      return { channels: [], warned: false };
    }

    const lines = text.split(/\r?\n/);
    // Quick count before heavy parse
    let entryCount = 0;
    for (const l of lines) { if (l.trim() && !l.trim().startsWith('#')) entryCount++; }

    // Eco warning for huge playlists
    let warned = false;
    if (entryCount > ECO.warnThreshold) {
      warned = true;
      this._onStatus('warn', `Large playlist detected (${entryCount} channels). Loading progressively…`);
    }

    // Progressive parse — yields to UI thread between chunks
    this._channels = [];
    const parser = parseM3uProgressive(lines);
    let result = parser.next();
    while (!result.done) {
      this._channels.push(...result.value);
      this._onStatus('progress', `Parsing… ${this._channels.length} channels`);
      // Yield to the UI thread
      await new Promise(r => setTimeout(r, 0));
      result = parser.next();
    }
    // Drain any remaining
    if (result.value) this._channels.push(...result.value);

    // Build group list
    const gset = new Set();
    for (const ch of this._channels) gset.add(ch.group || 'Uncategorized');
    this._groups = [...gset].sort((a, b) => a.localeCompare(b));

    // Cache to localStorage (cap at 5000 entries to avoid quota issues)
    if (this._channels.length <= 5000) {
      this._saveJson(STORAGE_PLAYLIST, {
        source,
        channels: this._channels,
        ts: Date.now(),
      });
    }

    this._applyFilters();
    this._onStatus('done', `${this._channels.length} channels loaded`);
    return { channels: this._channels, warned };
  }

  /** Try to restore from cache. Returns true if cache was fresh. */
  restoreFromCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_PLAYLIST) || 'null');
      if (!cached || !cached.channels) return false;
      if (Date.now() - cached.ts > ECO.staleCacheMs) return false;
      this._channels = cached.channels;
      const gset = new Set();
      for (const ch of this._channels) gset.add(ch.group || 'Uncategorized');
      this._groups = [...gset].sort((a, b) => a.localeCompare(b));
      this._applyFilters();
      return true;
    } catch (_) { return false; }
  }

  /* ─── Filters & search ───────────────────────────────────── */
  setSearch(q) { this._search = (q || '').toLowerCase(); this._applyFilters(); }
  setGroupFilter(g) { this._groupFilter = g; this._applyFilters(); }
  setSortBy(s) { this._sortBy = s; this._applyFilters(); }

  _applyFilters() {
    let list = [...this._channels];
    if (this._groupFilter !== 'all') {
      list = list.filter(ch => (ch.group || 'Uncategorized') === this._groupFilter);
    }
    if (this._search) {
      list = list.filter(ch =>
        (ch.title || '').toLowerCase().includes(this._search) ||
        (ch.url || '').toLowerCase().includes(this._search) ||
        (ch.group || '').toLowerCase().includes(this._search)
      );
    }
    // Sort
    if (this._sortBy === 'name') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (this._sortBy === 'group') list.sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.title || '').localeCompare(b.title || ''));
    this._filtered = list;
  }

  /* ─── Favorites ───────────────────────────────────────────── */
  isFavorite(url) { return this._favorites.includes(url); }
  toggleFavorite(url) {
    const idx = this._favorites.indexOf(url);
    if (idx >= 0) this._favorites.splice(idx, 1);
    else this._favorites.push(url);
    this._saveJson(STORAGE_FAVS, this._favorites);
    this._applyFilters();
  }
  get favorites() { return this._favorites; }

  /* ─── Recent ──────────────────────────────────────────────── */
  addRecent(ch) {
    this._recent = this._recent.filter(r => r.url !== ch.url);
    this._recent.unshift({ url: ch.url, title: ch.title, group: ch.group, ts: Date.now() });
    if (this._recent.length > 50) this._recent.length = 50;
    this._saveJson(STORAGE_RECENT, this._recent);
  }
  get recent() { return this._recent; }

  /* ─── Play a channel ──────────────────────────────────────── */
  play(channel) {
    this._currentChannel = channel;
    this._isLive = true;
    this._reconnectAttempts = 0;
    clearTimeout(this._reconnectTimer);
    this.addRecent(channel);
    this._onPlay(channel);
  }

  /** Call when a stream errors — handles auto-reconnect. */
  onStreamError() {
    if (!this._isLive || !this._currentChannel) return;
    this._reconnectAttempts++;
    const delay = Math.min(
      ECO.reconnectBaseMs * Math.pow(1.8, this._reconnectAttempts - 1),
      ECO.reconnectMaxMs
    );
    this._onStatus('reconnect', `Reconnecting in ${Math.round(delay / 1000)}s… (attempt ${this._reconnectAttempts})`);
    this._reconnectTimer = setTimeout(() => {
      if (this._currentChannel && this._isLive) {
        this._onPlay(this._currentChannel);
      }
    }, delay);
  }

  onStreamOk() {
    this._reconnectAttempts = 0;
    clearTimeout(this._reconnectTimer);
    this._onStatus('streaming', 'Streaming…');
  }

  stop() {
    this._isLive = false;
    this._currentChannel = null;
    this._reconnectAttempts = 0;
    clearTimeout(this._reconnectTimer);
  }

  /* ─── Eco: Probe a channel with semaphore ─────────────────── */
  async probeWithEco(channel) {
    if (this._probeSem >= ECO.maxProbes) return false;
    this._probeSem++;
    try {
      return await probeStream(channel.url);
    } finally {
      this._probeSem--;
    }
  }

  /* ─── Helpers ─────────────────────────────────────────────── */
  _loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (_) { return fallback; }
  }
  _saveJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }
}

export default TVModule;
