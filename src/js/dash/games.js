/**
 * The Games tab (v3.53.0).
 *
 * Nothing here is loaded until the tab is opened (app/parts.js), and no
 * game is part of the app: a built-in game is fetched the first time it is
 * wanted, the GBA player's core the first time a GBA game is played, and
 * your own games stay in your folder. The main process's side is
 * main/games-service.js.
 *
 * A game runs in a frame of its own on bmgame://. It is not part of this
 * page: it has its own origin and storage, cannot reach the app's, and is
 * served with a policy that keeps it off the network. The frame is made
 * when a game is started and removed when it is closed, so a closed game
 * costs nothing.
 */
import { el, escapeHtml, escapeAttr } from '../util.js';
import { ICONS } from '../icons.js';

const tint = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return `hsl(${Math.abs(h) % 360} 45% 32%)`; };
const initials = s => (String(s || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(w => [...w][0] || '').join('') || '?').toUpperCase();
const size = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const GBA_KEYS = 'Arrow keys, X is A, Z is B, A and S are L and R, Enter is Start, Backspace is Select';

/** A colour of the theme as #rrggbb, for a game's address. */
function hex(name, fallback) {
  try {
    const v = getComputedStyle(document.body).getPropertyValue(name).trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = fallback; c.fillStyle = v;
    return /^#[0-9a-f]{6}$/i.test(c.fillStyle) ? c.fillStyle : fallback;
  } catch (_) { return fallback; }
}
const colours = () => new URLSearchParams({ bg: hex('--bg', '#0b0f1a'), fg: hex('--text', '#e8ecf5'), mu: hex('--text-muted', '#8a93a8'), ac: hex('--accent', '#6c8cff'), pn: hex('--surface', '#151b2b') }).toString();

export class GamesDash {
  constructor(api, { osd } = {}) {
    this.svc = api?.games;   // the main process's side (main/games-service.js)
    this.osd = osd || (() => {});
    this.state = { builtin: [], open: [], core: null, roms: [], folder: null, mine: [] };
    this.playing = null;      // { kind, id, name }
    this._busy = new Set();
    this._wire();
    this.ready = this.refresh();
  }

  async refresh() {
    try { const s = await this.svc?.list?.(); if (s) this.state = s; }
    catch (e) { console.warn('[BM Player] games, the list:', e); }
    this._draw();
  }

  /* ── the lobby ── */
  _wire() {
    el('games-view')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-act]'); if (!b || b.disabled) return;
      const f = this['_do_' + b.dataset.act]; if (f) f.call(this, b.dataset.id, b);
    });
    // what a game's frame says of itself: only the GBA player speaks
    window.addEventListener('message', e => {
      if (!this._frame || e.source !== this._frame.contentWindow || !/^bmgame:\/\//.test(e.origin) || e.data?.bm !== 'gba') return;
      this._gbaSaid(e.data);
    });
  }

  _tile({ kind, id, name, sub, state, actions, missing }) {
    return `<div class="gm-tile${missing ? ' gm-missing' : ''}" role="listitem" data-kind="${kind}" data-id="${escapeAttr(id)}">`
      + `<span class="gm-art" style="background:${tint(name)}" aria-hidden="true">${escapeHtml(initials(name))}</span>`
      + `<span class="gm-info"><span class="gm-name">${escapeHtml(name)}</span><span class="gm-sub">${escapeHtml(sub || '')}</span>${state ? `<span class="gm-state">${escapeHtml(state)}</span>` : ''}</span>`
      + `<span class="gm-acts">${actions}</span></div>`;
  }

  _draw() {
    const s = this.state;
    const built = el('games-builtin'), gba = el('games-gba'), mine = el('games-mine');
    if (built) built.innerHTML = s.builtin.map(g => {
      const busy = this._busy.has('b:' + g.id);
      return this._tile({ kind: 'builtin', id: g.id, name: g.name, sub: g.blurb, state: busy ? 'Getting it…' : g.installed ? '' : size(g.size) + ', fetched when you get it',
        actions: g.installed
          ? `<button class="dash-action-btn" type="button" data-act="play" data-id="${g.id}" aria-label="Play ${escapeAttr(g.name)}">Play</button><button class="gm-x" type="button" data-act="remove" data-id="${g.id}" title="Remove from this computer" aria-label="Remove ${escapeAttr(g.name)} from this computer">${ICONS.close || '×'}</button>`
          : `<button class="dash-action-btn st-quiet" type="button" data-act="get" data-id="${g.id}" aria-label="Get ${escapeAttr(g.name)}"${busy ? ' disabled' : ''}>Get</button>` });
    }).join('');
    // by other people: who, under which licence, and how much comes with the first of a family
    const open = el('games-open');
    if (open) open.innerHTML = (s.open || []).map(g => {
      const busy = this._busy.has('b:' + g.id);
      return this._tile({ kind: 'open', id: g.id, name: g.name, sub: g.blurb, state: busy ? 'Getting it…' : `by ${g.by}, ${g.licence}` + (g.installed ? '' : `, ${size(g.size + (g.extra || 0))}`),
        actions: g.installed
          ? `<button class="dash-action-btn" type="button" data-act="play" data-id="${g.id}" aria-label="Play ${escapeAttr(g.name)}">Play</button><button class="gm-x" type="button" data-act="remove" data-id="${g.id}" title="Remove from this computer" aria-label="Remove ${escapeAttr(g.name)} from this computer">${ICONS.close || '×'}</button>`
          : `<button class="dash-action-btn st-quiet" type="button" data-act="get" data-id="${g.id}" aria-label="Get ${escapeAttr(g.name)}"${busy ? ' disabled' : ''}>Get</button>` });
    }).join('');
    const core = s.core, coreNote = el('games-core-note');
    if (coreNote && core) coreNote.textContent = core.installed
      ? `Played with ${core.name} ${core.version}, which is on this computer. Only your own game files: none come with the app.`
      : `Played with ${core.name} ${core.version} (${size(core.size)}), fetched the first time you play. Only your own game files: none come with the app.`;
    el('btn-games-uncore')?.toggleAttribute('hidden', !core?.installed);
    if (gba) gba.innerHTML = s.roms.map(r => this._tile({ kind: 'gba', id: r.id, name: r.name, sub: r.missing ? 'The file is not where it was' : r.file, missing: r.missing,
      state: this._busy.has('core') && this._wanted === r.id ? 'Getting the player…' : '',
      actions: `<button class="dash-action-btn" type="button" data-act="rom" data-id="${r.id}" aria-label="Play ${escapeAttr(r.name)}"${r.missing ? ' disabled' : ''}>Play</button><button class="gm-x" type="button" data-act="unlist" data-id="${r.id}" title="Take out of the list. The file stays." aria-label="Take ${escapeAttr(r.name)} out of the list">${ICONS.close || '×'}</button>` })).join('');
    const none = el('games-gba-none'); if (none) none.hidden = s.roms.length > 0;
    const fold = el('games-folder'); if (fold) fold.textContent = s.folder || 'No folder chosen';
    el('btn-games-folder') && (el('btn-games-folder').textContent = s.folder ? 'Change folder' : 'Choose folder');
    for (const id of ['btn-games-rescan', 'btn-games-unfolder']) el(id)?.toggleAttribute('hidden', !s.folder);
    if (mine) mine.innerHTML = s.mine.map(g => this._tile({ kind: 'mine', id: g.id, name: g.name, sub: g.entry === 'index.html' ? 'A folder with an index.html' : g.entry,
      actions: `<button class="dash-action-btn" type="button" data-act="mine" data-id="${g.id}" aria-label="Play ${escapeAttr(g.name)}">Play</button>` })).join('');
    const mnone = el('games-mine-none');
    if (mnone) { mnone.hidden = s.mine.length > 0; mnone.textContent = s.folder ? 'No games found in it. A game is a folder with an index.html inside, or an .html file.' : 'Choose a folder of HTML games. Each folder in it with an index.html is a game, and so is each .html file.'; }
  }

  async _do_get(id) {
    if (this._busy.has('b:' + id)) return;
    this._busy.add('b:' + id); this._draw();
    const r = await this.svc.get(id).catch(e => ({ error: String(e.message || e) }));
    this._busy.delete('b:' + id);
    if (r?.error) this.osd(`That game could not be fetched: ${r.error}`, 5000);
    await this.refresh();
    return !r?.error;
  }
  async _do_remove(id) { await this.svc.remove(id).catch(() => {}); await this.refresh(); }
  async _do_play(id) {
    const all = () => this.state.builtin.concat(this.state.open || []);
    let g = all().find(x => x.id === id); if (!g) return;
    if (!g.installed) { if (!(await this._do_get(id))) return; g = all().find(x => x.id === id); }
    // one of ours takes the theme's colours; a game by someone else is opened as its author made it
    const url = g.by ? `bmgame://b-${id}/${g.entry}${g.query ? '?' + g.query : ''}` : `bmgame://b-${id}/index.html?${colours()}`;
    this._open({ kind: g.by ? 'open' : 'builtin', id, name: g.name, keys: g.keys || (g.by ? `by ${g.by}, ${g.licence}` : ''), url });
  }
  async _do_rom(id) {
    const r = this.state.roms.find(x => x.id === id); if (!r || r.missing) return;
    if (!this.state.core?.installed) {
      if (this._busy.has('core')) return;
      this._busy.add('core'); this._wanted = id; this._draw();
      const got = await this.svc.core().catch(e => ({ error: String(e.message || e) }));
      this._busy.delete('core'); this._wanted = null;
      await this.refresh();
      if (got?.error) { this.osd(`The GBA player could not be fetched: ${got.error}`, 5000); return; }
    }
    this._open({ kind: 'gba', id, name: r.name, keys: GBA_KEYS, url: `bmgame://gba/index.html?rom=${id}&${colours()}` });
  }
  _do_mine(id) {
    const g = this.state.mine.find(x => x.id === id); if (!g) return;
    this._open({ kind: 'mine', id, name: g.name, keys: '', url: `bmgame://u-${id}/${g.entry.split('/').map(encodeURIComponent).join('/')}` });
  }
  async _do_addroms() { await this.svc.addRoms().catch(() => {}); await this.refresh(); }
  async _do_uncore() { await this.svc.removeCore().catch(() => {}); await this.refresh(); }
  async _do_unlist(id) { await this.svc.removeRom(id).catch(() => {}); await this.refresh(); }
  async _do_folder() { await this.svc.pickFolder().catch(() => {}); await this.refresh(); }
  async _do_unfolder() { await this.svc.clearFolder().catch(() => {}); await this.refresh(); }
  _do_rescan() { return this.refresh(); }

  /* ── a game playing ── */
  _open(game) {
    this.close(true);
    this.playing = game; this._paused = false; this._speed = 1; this._muted = false;
    const f = document.createElement('iframe');
    f.className = 'games-frame';
    f.title = game.name;
    // Scripts, and its own origin's storage for its saves. No pop-ups, no forms, no way to the top page.
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
    f.setAttribute('allow', 'gamepad; autoplay');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.src = game.url;
    f.addEventListener('load', () => { try { f.focus(); } catch (_) {} });
    this._frame = f;
    el('games-frame-box')?.appendChild(f);
    el('games-playing-name') && (el('games-playing-name').textContent = game.name);
    el('games-playing-keys') && (el('games-playing-keys').textContent = game.keys || '');
    el('games-gba-bar')?.toggleAttribute('hidden', game.kind !== 'gba');
    this._gbaBar();
    el('games-lobby')?.setAttribute('hidden', '');
    el('games-stage')?.removeAttribute('hidden');
  }

  close(quiet) {
    if (this._frame) { this._frame.remove(); this._frame = null; }
    const was = this.playing; this.playing = null;
    el('games-stage')?.setAttribute('hidden', '');
    el('games-lobby')?.removeAttribute('hidden');
    if (was && !quiet) this.refresh();   // a GBA game just played goes to the front of its list
  }
  _do_close() { this.close(); }
  _do_restart() { const g = this.playing; if (g) this._open(g); }

  /** The tab is left: a game stops taking keys, and the GBA player waits. */
  away() {
    if (!this._frame) return;
    try { this._frame.blur(); } catch (_) {}
    if (this.playing?.kind === 'gba' && !this._paused) { this._tell('pause'); this._awayPaused = true; }
  }
  back() {
    if (!this._frame) return;
    if (this._awayPaused) { this._awayPaused = false; this._tell('resume'); }
    try { this._frame.focus(); } catch (_) {}
  }

  /* ── the GBA player's buttons ── */
  _tell(cmd, value) { try { this._frame?.contentWindow?.postMessage({ bm: 'gba', cmd, value }, '*'); } catch (_) {} }
  _gbaBar() {
    const p = el('btn-gba-pause'); if (p) { p.textContent = this._paused ? 'Resume' : 'Pause'; p.setAttribute('aria-pressed', String(!!this._paused)); }
    const sp = el('btn-gba-speed'); if (sp) sp.textContent = 'Speed ' + (this._speed || 1) + 'x';
    const m = el('btn-gba-mute'); if (m) { m.textContent = this._muted ? 'Sound off' : 'Sound on'; m.setAttribute('aria-pressed', String(!!this._muted)); }
  }
  _do_gbapause() { this._awayPaused = false; this._tell(this._paused ? 'resume' : 'pause'); }
  _do_gbareset() { this._tell('reset'); }
  _do_gbasave() { this._tell('save'); }
  _do_gbaload() { this._tell('load'); }
  _do_gbaspeed() { this._tell('speed', this._speed === 1 ? 2 : this._speed === 2 ? 4 : 1); }
  _do_gbamute() { this._muted = !this._muted; this._tell('volume', this._muted ? 0 : 1); this._gbaBar(); this._frame?.focus(); }
  _gbaSaid(d) {
    if (d.event === 'error') { this.osd(String(d.message || 'The game could not be started').slice(0, 160), 5000); return; }
    if (d.event !== 'done') return;
    if (typeof d.paused === 'boolean') this._paused = d.paused;
    if (d.cmd === 'speed' && d.speed) this._speed = d.speed;
    if (d.cmd === 'save') this.osd(d.ok ? 'Saved where you are' : 'That could not be saved', 2200);
    if (d.cmd === 'load') this.osd(d.ok ? 'Back to where you saved' : 'Nothing saved for this game yet', 2200);
    this._gbaBar();
    if (d.cmd !== 'pause') this._frame?.focus();
  }
}
