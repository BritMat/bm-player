/**
 * BM Player: lyrics on screen (v3.38.0).
 *
 * The words come from the main process (lyrics.js beside main.js): a .lrc
 * file beside the song, the song's own tags, then LRCLIB online. Timed
 * lyrics (LRC) follow the music: the line being sung is lit and kept in
 * the middle, and a click on a line goes to it. Lyrics without times are
 * shown as they are.
 *
 * Two places show them. Now Playing in the Music view has Up Next and
 * Lyrics side by side. The visual mode (the Video view while music plays)
 * has a button that puts the line being sung over the visualiser, with
 * the next one under it.
 *
 * The page is updated ten times a second while lyrics are on screen, and
 * not at all otherwise.
 */
import { setIcon } from '../icons.js';

const TIME = /^\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/;

/** LRC text as [{ t: seconds, text }], in order. Other tags ([ar:] and so on) and word times are left out. */
export function parseLRC(text) {
  const out = []; let offset = 0;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const off = /^\[offset:\s*([+-]?\d+)\s*\]$/i.exec(line);
    if (off) { offset = +off[1] / 1000; continue; }            // + brings the words sooner
    const at = []; let rest = line, m;
    while ((m = TIME.exec(rest))) { at.push(+m[1] * 60 + parseFloat(m[2].replace(':', '.'))); rest = rest.slice(m[0].length); }
    if (!at.length) continue;
    const words = rest.replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').replace(/\s+/g, ' ').trim();
    for (const t of at) out.push({ t: Math.max(0, t - offset), text: words });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The line being sung at time t: the last that has started, -1 before the first. */
export function lineAt(lines, t) {
  let lo = 0, hi = lines.length - 1, at = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].t <= t + 0.05) { at = mid; lo = mid + 1; } else hi = mid - 1; }
  return at;
}

const el = id => document.getElementById(id);

export class Lyrics {
  /** api: window.api. music: the MusicDash. app: the BMPlayer. */
  constructor ({ api, music, app }) {
    this.api = api; this.music = music; this.app = app;
    this.online = localStorage.getItem('bm_lyrics_online') !== '0';
    this.overlay = localStorage.getItem('bm_viz_lyrics') === '1';
    this.tab = localStorage.getItem('bm_np_tab') === 'lyrics' ? 'lyrics' : 'queue';
    this.path = null; this.lines = []; this.plain = null; this.status = 'idle'; this.source = null;
    this._req = 0; this._cur = -2; this._userScroll = 0; this._timer = null;
    this._wire();
  }

  _wire () {
    el('np-tab-queue')?.addEventListener('click', () => this.showTab('queue'));
    el('np-tab-lyrics')?.addEventListener('click', () => this.showTab('lyrics'));
    const pane = el('np-lyrics');
    // A wheel or a drag in the pane: leave the scrolling to the person for a while.
    for (const ev of ['wheel', 'touchmove', 'pointerdown']) pane?.addEventListener(ev, () => { this._userScroll = performance.now(); }, { passive: true });
    pane?.addEventListener('click', e => {
      const line = e.target.closest?.('.lyr-line[data-t]'); if (line) this._seek(+line.dataset.t);
      const box = e.target.closest?.('#lyr-online'); if (box) { this.online = box.checked; localStorage.setItem('bm_lyrics_online', this.online ? '1' : '0'); if (this.online && this.status === 'none') this.reload(); }
    });
    const b = el('viz-btn-lyrics');
    if (b) { setIcon(b, 'lyrics'); b.addEventListener('click', () => this.setOverlay(!this.overlay)); }
    this.showTab(this.tab, true);
    this.setOverlay(this.overlay, true);
  }

  showTab (tab, quiet) {
    this.tab = tab === 'lyrics' ? 'lyrics' : 'queue';
    if (!quiet) localStorage.setItem('bm_np_tab', this.tab);
    el('np-tab-queue')?.classList.toggle('active', this.tab === 'queue');
    el('np-tab-lyrics')?.classList.toggle('active', this.tab === 'lyrics');
    el('np-tab-queue')?.setAttribute('aria-selected', String(this.tab === 'queue'));
    el('np-tab-lyrics')?.setAttribute('aria-selected', String(this.tab === 'lyrics'));
    el('np-queue')?.classList.toggle('hidden', this.tab !== 'queue');
    el('np-lyrics')?.classList.toggle('hidden', this.tab !== 'lyrics');
    this._cur = -2; this._render(); this._run();
  }

  setOverlay (on, quiet) {
    this.overlay = !!on;
    if (!quiet) localStorage.setItem('bm_viz_lyrics', this.overlay ? '1' : '0');
    el('viz-btn-lyrics')?.classList.toggle('active-opt', this.overlay);
    el('viz-btn-lyrics')?.setAttribute('aria-pressed', String(this.overlay));
    el('viz-lyrics')?.classList.toggle('hidden', !this.overlay);
    this._cur = -2; this._tick(true); this._run();
  }

  /** A song started (MusicDash.play). meta: { title, artist, album, duration }. */
  async song (path, meta) {
    const id = ++this._req;
    this.path = path; this.lines = []; this.plain = null; this.source = null; this.status = 'loading'; this._cur = -2;
    this._render();
    let r = null;
    try { r = await this.api?.music?.lyrics?.(path, meta || {}, { online: this.online }); } catch (_) { r = null; }
    if (id !== this._req) return;                                        // another song has started since
    this._meta = meta || {};
    if (r?.instrumental) { this.status = 'instrumental'; this.source = r.source; }
    else if (r?.synced) { this.lines = parseLRC(r.synced); this.status = this.lines.length ? 'ready' : 'none'; this.source = r.source; if (!this.lines.length && r.plain) { this.plain = r.plain; this.status = 'ready'; } }
    else if (r?.plain) { this.plain = r.plain; this.status = 'ready'; this.source = r.source; }
    else this.status = r?.offline ? 'offline' : 'none';
    this._render(); this._run();
  }

  reload () { if (this.path) this.song(this.path, this._meta); }

  clear () {
    this._req++; this.path = null; this.lines = []; this.plain = null; this.status = 'idle'; this.source = null; this._cur = -2;
    this._render(); this._run();
  }

  _time () {
    const m = this.music;
    try { return m?.engineOwns?.() ? (m.engine.currentTime || 0) : (this.app?.currentTime || 0); } catch (_) { return 0; }
  }

  _seek (t) {
    const m = this.music;
    try { if (m?.engineOwns?.()) m.engine.seek(t); else this.app?.seekTo?.(t); } catch (_) {}
  }

  _render () {
    const pane = el('np-lyrics');
    if (pane) {
      pane.innerHTML = '';
      const note = text => { const d = document.createElement('div'); d.className = 'lyr-note'; d.textContent = text; pane.appendChild(d); };
      if (this.status === 'idle') note('Lyrics show here while a song plays.');
      else if (this.status === 'loading') note('Looking for lyrics…');
      else if (this.status === 'instrumental') note('Instrumental: no words.');
      else if (this.status === 'none') note(this.online ? 'No lyrics found for this song.' : 'No lyrics found beside this song or inside it.');
      else if (this.status === 'offline') note('No lyrics here, and the lyrics site could not be reached.');
      else if (this.lines.length) {
        for (const [i, l] of this.lines.entries()) {
          const d = document.createElement('div');
          d.className = 'lyr-line' + (l.text ? '' : ' lyr-gap'); d.dataset.t = String(l.t); d.dataset.i = String(i);
          d.textContent = l.text || '♪';
          pane.appendChild(d);
        }
      } else if (this.plain) {
        const d = document.createElement('div'); d.className = 'lyr-plain'; d.textContent = this.plain; pane.appendChild(d);
      }
      const foot = document.createElement('div'); foot.className = 'lyr-foot';
      const from = { file: 'From the .lrc file beside the song', tags: 'From the song file itself', lrclib: 'From LRCLIB (lrclib.net)' }[this.source];
      if (from && this.status === 'ready') { const s = document.createElement('div'); s.textContent = from; foot.appendChild(s); }
      const lab = document.createElement('label'); lab.className = 'lyr-online';
      lab.innerHTML = '<input type="checkbox" id="lyr-online"> Look online when a song has none (LRCLIB)';
      lab.querySelector('input').checked = this.online;
      foot.appendChild(lab);
      pane.appendChild(foot);
    }
    this._cur = -2; this._tick(true);
  }

  /** Lyrics on screen, and timed: keep them in step. */
  _visible () {
    const np = this.tab === 'lyrics' && !!el('np-lyrics')?.offsetParent;
    const viz = this.overlay && document.body.classList.contains('audio-viz');
    return (np || viz) && this.lines.length > 0;
  }

  _run () {
    if (this._visible()) { if (!this._timer) this._timer = setInterval(() => { if (!this._visible()) { clearInterval(this._timer); this._timer = null; return; } this._tick(); }, 100); }
    else if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _tick (force) {
    const i = this.lines.length ? lineAt(this.lines, this._time()) : -1;
    if (i === this._cur && !force) return;
    this._cur = i;
    const pane = el('np-lyrics');
    if (pane && this.lines.length) {
      pane.querySelector('.lyr-line.on')?.classList.remove('on');
      const line = i >= 0 ? pane.querySelector(`.lyr-line[data-i="${i}"]`) : null;
      if (line) {
        line.classList.add('on');
        if (performance.now() - this._userScroll > 4000 && pane.offsetParent) {
          // Measured on screen, so it holds whatever the pane sits in.
          const p = pane.getBoundingClientRect(), r = line.getBoundingClientRect();
          const top = Math.max(0, pane.scrollTop + (r.top - p.top) - (pane.clientHeight - r.height) / 2);
          try { pane.scrollTo({ top, behavior: 'smooth' }); } catch (_) { pane.scrollTop = top; }
        }
      }
    }
    const now = el('vl-now'), next = el('vl-next');
    if (now && next) {
      const on = this.status === 'ready' && this.lines.length > 0;
      const line = i >= 0 ? this.lines[i] : null, after = this.lines[i + 1];
      // A gap in the words (an empty line, or before the first) shows a
      // note, with the line that comes next under it.
      now.textContent = on ? (line?.text || (after ? '♪' : '')) : '';
      next.textContent = on ? (after?.text || '') : '';
      el('viz-lyrics')?.classList.toggle('vl-empty', !now.textContent && !next.textContent);
    }
  }
}
