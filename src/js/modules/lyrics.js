/**
 * BM Player: lyrics on screen (v3.38.0, more in v3.39.0).
 *
 * The words come from the main process (lyrics.js beside main.js): lyrics
 * the person chose for the song, a .lrc, .srt or .vtt file beside it, the
 * song's own tags, then LRCLIB online. Timed lyrics (LRC) follow the music:
 * the line being sung is lit and kept in the middle, and a click on a line
 * goes to it. Lyrics without times are shown as they are.
 *
 * Two places show them. Now Playing in the Music view has Up Next and
 * Lyrics side by side. The visual mode (the Video view while music plays)
 * has a button that puts the line being sung over the visualiser, with
 * the next one under it.
 *
 * v3.39.0, for songs where none were found or the wrong ones were:
 *   Search    LRCLIB searched with words the person can change, the
 *             results listed with their length, a click to choose one.
 *   Load      a .lrc, .srt, .vtt or .txt file, from a dialog or dropped on
 *             the lyrics. What is chosen or loaded stays with the song.
 *   Timing    earlier or later by a quarter of a second, kept for the song.
 *   YouTube   when turned on, a song with nothing found is looked for there
 *             too, by its title and length (ytdlp.js). Off by default.
 *
 * The page is updated ten times a second while lyrics are on screen, and
 * not at all otherwise.
 *
 * v3.46.0, lyrics in another alphabet (Hindi, Malayalam, Tamil, Korean and
 * more) can be shown in English letters, spelled as they sound
 * (translit.js), or both, the English letters under each line. The choice
 * is kept, and offered only where the lyrics are in a script it can spell.
 */
import { setIcon } from '../icons.js';
import { romanize, canRomanize } from '../translit.js';

const SCRIPT = 'bm_lyrics_script';
const SCRIPTS = [['original', 'Original'], ['latin', 'English letters'], ['both', 'Both']];

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
const OFFSETS = 'bm_lyrics_offsets';
const fmtLen = s => s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '';
const LYRIC_FILE = /\.(lrc|srt|vtt|txt)$/i;
// A touch screen with no mouse (the Android app, v3.40.0): nothing is dropped there.
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;

export class Lyrics {
  /** api: window.api. music: the MusicDash. app: the BMPlayer. */
  constructor ({ api, music, app }) {
    this.api = api; this.music = music; this.app = app;
    this.online = localStorage.getItem('bm_lyrics_online') !== '0';
    this.youtube = localStorage.getItem('bm_lyrics_youtube') === '1';
    this.overlay = localStorage.getItem('bm_viz_lyrics') === '1';
    this.tab = localStorage.getItem('bm_np_tab') === 'lyrics' ? 'lyrics' : 'queue';
    this.script = SCRIPTS.some(s => s[0] === localStorage.getItem(SCRIPT)) ? localStorage.getItem(SCRIPT) : 'original';
    this.spellable = false; this.plainRoman = null;
    try { this.offsets = JSON.parse(localStorage.getItem(OFFSETS) || '{}') || {}; } catch (_) { this.offsets = {}; }
    this.path = null; this.lines = []; this.plain = null; this.status = 'idle'; this.source = null;
    this.pinned = false; this.auto = false; this.video = null; this.note = '';
    this.searching = false; this.results = null; this.query = '';
    this._req = 0; this._cur = -2; this._userScroll = 0; this._timer = null; this._meta = {};
    this._wire();
  }

  _wire () {
    el('np-tab-queue')?.addEventListener('click', () => this.showTab('queue'));
    el('np-tab-lyrics')?.addEventListener('click', () => this.showTab('lyrics'));
    const pane = el('np-lyrics');
    // A wheel or a drag in the pane: leave the scrolling to the person for a while.
    for (const ev of ['wheel', 'touchmove', 'pointerdown']) pane?.addEventListener(ev, () => { this._userScroll = performance.now(); }, { passive: true });
    pane?.addEventListener('click', e => this._click(e));
    pane?.addEventListener('submit', e => { e.preventDefault(); this._search(el('lyr-q')?.value || ''); });
    // A lyrics file dropped on the lyrics is for this song, and is not opened as media.
    pane?.addEventListener('dragover', e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
    pane?.addEventListener('drop', e => {
      const f = [...(e.dataTransfer?.files || [])].find(x => LYRIC_FILE.test(x.name || ''));
      if (!f || !this.path) return;
      e.preventDefault(); e.stopPropagation(); e.__bmHandled = true;
      const p = this.api?.files?.pathOf?.(f) || f.path || '';
      if (p) this._load(p);
    });
    const b = el('viz-btn-lyrics');
    if (b) { setIcon(b, 'lyrics'); b.addEventListener('click', () => this.setOverlay(!this.overlay)); }
    this.showTab(this.tab, true);
    this.setOverlay(this.overlay, true);
  }

  _click (e) {
    const t = e.target, act = t.closest?.('[data-lyr]')?.dataset.lyr;
    const line = t.closest?.('.lyr-line[data-t]');
    if (line && !act) { this._seek(+line.dataset.t); return; }
    const box = t.closest?.('#lyr-online, #lyr-youtube');
    if (box?.id === 'lyr-online') { this.online = box.checked; localStorage.setItem('bm_lyrics_online', this.online ? '1' : '0'); if (this.online && this.status === 'none') this.reload(); return; }
    if (box?.id === 'lyr-youtube') { this.youtube = box.checked; localStorage.setItem('bm_lyrics_youtube', this.youtube ? '1' : '0'); if (this.youtube && (this.status === 'none' || this.status === 'offline')) this._fromYoutube(this._req); return; }
    const res = t.closest?.('.lyr-result[data-id]');
    if (res) { this._pick(res.dataset.id); return; }
    if (!act) return;
    e.preventDefault();
    if (act === 'script') { this.setScript(t.closest('[data-v]')?.dataset.v); return; }
    if (act === 'search') this._openSearch();
    else if (act === 'search-close') { this.searching = false; this.results = null; this._render(); }
    else if (act === 'load') this._load();
    else if (act === 'unpin') this._unpin();
    else if (act === 'earlier') this._nudge(-0.25);
    else if (act === 'later') this._nudge(0.25);
    else if (act === 'timing-reset') this._nudge(0, true);
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

  /** 'original', 'latin' (English letters) or 'both'. Kept for every song. */
  setScript (v) {
    if (!SCRIPTS.some(s => s[0] === v)) return;
    this.script = v;
    try { localStorage.setItem(SCRIPT, v); } catch (_) {}
    const pane = el('np-lyrics'), top = pane ? pane.scrollTop : 0;
    this._render();
    if (pane) pane.scrollTop = top;
  }

  /** Each line's English letters, made once when the lyrics come (lines and plain words alike). */
  _spell () {
    this.plainRoman = null;
    const text = this.lines.length ? this.lines.map(l => l.text).join('\n') : (this.plain || '');
    this.spellable = canRomanize(text);
    if (!this.spellable) return;
    for (const l of this.lines) l.roman = l.text ? romanize(l.text) : '';
    if (this.plain) this.plainRoman = this.plain.split('\n').map(x => romanize(x));
  }

  /** A line's text as the letters chosen show it: { main, under }. */
  _shown (text, roman) {
    if (!this.spellable || this.script === 'original' || roman === undefined || roman === text) return { main: text, under: '' };
    if (this.script === 'latin') return { main: roman, under: '' };
    return { main: text, under: roman };
  }

  setOverlay (on, quiet) {
    this.overlay = !!on;
    if (!quiet) localStorage.setItem('bm_viz_lyrics', this.overlay ? '1' : '0');
    el('viz-btn-lyrics')?.classList.toggle('active-opt', this.overlay);
    el('viz-btn-lyrics')?.setAttribute('aria-pressed', String(this.overlay));
    el('viz-lyrics')?.classList.toggle('hidden', !this.overlay);
    this._cur = -2; this._tick(true); this._run();
  }

  /** What the main process answered, put on screen. True when there are words (or an instrumental). */
  _apply (r) {
    this.lines = []; this.plain = null; this.source = r?.source || null; this.pinned = !!r?.pinned; this.auto = !!r?.auto; this.video = r?.video || null;
    if (r?.instrumental) { this.status = 'instrumental'; return true; }
    if (r?.synced) { this.lines = parseLRC(r.synced); if (!this.lines.length && r.plain) this.plain = r.plain; }
    else if (r?.plain) this.plain = r.plain;
    this._spell();
    if (this.lines.length || this.plain) { this.status = 'ready'; return true; }
    this.status = r?.offline ? 'offline' : 'none';
    return false;
  }

  /** A song started (MusicDash.play). meta: { title, artist, album, duration }. */
  async song (path, meta) {
    const id = ++this._req;
    this.path = path; this._meta = meta || {}; this.lines = []; this.plain = null; this.source = null; this.status = 'loading'; this._cur = -2;
    this.note = ''; this.noteTitle = ''; this.searching = false; this.results = null; this.query = '';
    this._render();
    let r = null;
    try { r = await this.api?.music?.lyrics?.(path, meta || {}, { online: this.online }); } catch (_) { r = null; }
    if (id !== this._req) return;                                        // another song has started since
    const got = this._apply(r);
    this._render(); this._run();
    if (!got && this.youtube) await this._fromYoutube(id);
  }

  /** YouTube's captions, asked for once all else found nothing (and only if turned on). */
  async _fromYoutube (id) {
    if (!this.path || !this.api?.music?.lyricsYoutube) return;
    const before = this.status;
    let first = false;
    try { first = !(await this.api.music.ytdlp?.())?.installed; } catch (_) {}
    if (id !== this._req) return;
    this.status = 'youtube'; this.note = first ? 'Getting yt-dlp first (about 18 MB, only this once)…' : ''; this._render();
    let y = null;
    try { y = await this.api.music.lyricsYoutube(this.path, this._meta); } catch (e) { y = { source: 'none', error: String(e?.message || e) }; }
    if (id !== this._req) return;
    // yt-dlp's own words go in the note's tooltip: they are for whoever looks closer.
    if (!this._apply(y)) { this.status = before === 'offline' ? 'offline' : 'none'; this.note = y?.error ? 'YouTube could not be searched just now.' : 'Nothing on YouTube either.'; this.noteTitle = y?.error || ''; }
    else { this.note = ''; this.noteTitle = ''; }
    this._render(); this._run();
  }

  reload () { if (this.path) this.song(this.path, this._meta); }

  clear () {
    this._req++; this.path = null; this.lines = []; this.plain = null; this.status = 'idle'; this.source = null;
    this.pinned = false; this.auto = false; this.video = null; this.note = ''; this.searching = false; this.results = null; this._cur = -2;
    this._render(); this._run();
  }

  // ── Search, load, timing ────────────────────────────────────────────
  _openSearch () {
    const m = this._meta || {};
    this.searching = true; this.results = null;
    this.query = this.query || [m.artist, m.title].filter(Boolean).join(' ');
    this._render();
    const q = el('lyr-q'); q?.focus({ preventScroll: true }); q?.select();
  }

  async _search (words) {
    this.query = String(words || '').trim(); if (!this.query) return;
    const id = this._req;
    this.results = 'loading'; this._render();
    let r = null;
    try { r = await this.api?.music?.lyricsSearch?.({ q: this.query }, this._meta); } catch (_) { r = null; }
    if (id !== this._req || !this.searching) return;
    this.results = r?.offline ? 'offline' : (r?.results || []);
    this._render();
  }

  async _pick (lrclibId) {
    const id = this._req;
    this.status = 'loading'; this.searching = false; this._render();
    let r = null;
    try { r = await this.api?.music?.lyricsPick?.(this.path, this._meta, lrclibId); } catch (_) { r = null; }
    if (id !== this._req) return;
    if (!this._apply(r)) this.note = r?.offline ? 'LRCLIB could not be reached.' : 'Those lyrics could not be had.';
    this._render(); this._run();
  }

  async _load (filePath) {
    if (!this.path) return;
    const id = this._req;
    let r = null;
    try { r = await this.api?.music?.lyricsLoad?.(this.path, this._meta, filePath || null); } catch (_) { r = null; }
    if (id !== this._req || r?.canceled) return;
    this.searching = false;
    if (!this._apply(r)) this.note = 'That file has no lyrics in it that could be read.';
    else this.note = '';
    this._render(); this._run();
  }

  async _unpin () {
    try { await this.api?.music?.lyricsUnpin?.(this.path, this._meta); } catch (_) {}
    this.reload();
  }

  _offset () { return this.path ? (+this.offsets[this.path] || 0) : 0; }

  _nudge (by, reset) {
    if (!this.path) return;
    const v = reset ? 0 : Math.max(-30, Math.min(30, Math.round((this._offset() + by) * 100) / 100));
    if (v) this.offsets[this.path] = v; else delete this.offsets[this.path];
    const keys = Object.keys(this.offsets);
    if (keys.length > 500) for (const k of keys.slice(0, keys.length - 500)) delete this.offsets[k];
    try { localStorage.setItem(OFFSETS, JSON.stringify(this.offsets)); } catch (_) {}
    const t = el('lyr-timing-val'); if (t) t.textContent = this._offsetLabel();
    this._cur = -2; this._tick(true);
  }

  _offsetLabel () { const v = this._offset(); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + ' s'; }

  /** The song's time, moved by the timing set for it (later lyrics: shown later). */
  _time () {
    const m = this.music;
    let t = 0;
    try { t = m?.engineOwns?.() ? (m.engine.currentTime || 0) : (this.app?.currentTime || 0); } catch (_) { t = 0; }
    return t - this._offset();
  }

  _seek (t) {
    const m = this.music, to = Math.max(0, t + this._offset());
    try { if (m?.engineOwns?.()) m.engine.seek(to); else this.app?.seekTo?.(to); } catch (_) {}
  }

  // ── Drawing ─────────────────────────────────────────────────────────
  _render () {
    const pane = el('np-lyrics');
    if (pane) {
      pane.innerHTML = '';
      const add = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; pane.appendChild(d); return d; };
      const note = text => add('div', 'lyr-note', text);
      if (this.searching) this._renderSearch(add);
      else if (this.status === 'idle') note('Lyrics show here while a song plays.');
      else if (this.status === 'loading') note('Looking for lyrics…');
      else if (this.status === 'youtube') note(this.note || 'Looking on YouTube…');
      else if (this.status === 'instrumental') note('Instrumental: no words.');
      else if (this.status === 'none') { note(this.online ? 'No lyrics found for this song.' : 'No lyrics found beside this song or inside it.'); add('div', 'lyr-hint', 'Search for them, or load a .lrc, .srt or .vtt file' + (TOUCH ? '.' : ' (or drop one here).')); }
      else if (this.status === 'offline') note('No lyrics here, and the lyrics site could not be reached.');
      else if (this.lines.length || this.plain) {
        if (this.spellable) this._renderScript(pane);
        if (this.lines.length) {
          for (const [i, l] of this.lines.entries()) {
            const s = this._shown(l.text, l.roman);
            const d = add('div', 'lyr-line' + (l.text ? '' : ' lyr-gap'), s.main || '♪');
            if (s.under) { const u = document.createElement('span'); u.className = 'lyr-rom'; u.textContent = s.under; d.appendChild(u); }
            d.dataset.t = String(l.t); d.dataset.i = String(i);
          }
        } else {
          const box = add('div', 'lyr-plain');
          if (!this.spellable || this.script === 'original') box.textContent = this.plain;
          else if (this.script === 'latin') box.textContent = this.plainRoman.join('\n');
          else {
            // each line, and its English letters under it
            this.plain.split('\n').forEach((x, k) => {
              const d = document.createElement('div'); d.className = 'lyr-pl'; d.textContent = x || '\u00a0';
              const r = this.plainRoman[k];
              if (r && r !== x) { const u = document.createElement('span'); u.className = 'lyr-rom'; u.textContent = r; d.appendChild(u); }
              box.appendChild(d);
            });
          }
        }
      }
      if (this.note && this.status !== 'youtube' && !this.searching) { const h = add('div', 'lyr-hint', this.note); if (this.noteTitle) h.title = this.noteTitle; }
      if (!this.searching) this._renderFoot(pane);
    }
    this._cur = -2; this._tick(true);
  }

  /** Original, English letters or Both: kept at the top of the lyrics while they scroll. */
  _renderScript (pane) {
    const g = document.createElement('div');
    g.className = 'lyr-script'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Letters the lyrics are shown in');
    for (const [v, label] of SCRIPTS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lyr-sbtn' + (this.script === v ? ' on' : ''); b.dataset.lyr = 'script'; b.dataset.v = v;
      b.setAttribute('aria-pressed', String(this.script === v)); b.textContent = label;
      if (v === 'latin') b.title = 'The words spelled in English letters, as they sound';
      g.appendChild(b);
    }
    pane.appendChild(g);
  }

  _renderSearch (add) {
    const f = document.createElement('form'); f.className = 'lyr-search';
    f.innerHTML = '<input type="search" id="lyr-q" class="lyr-q" placeholder="Artist and title" aria-label="Search for lyrics" autocomplete="off" spellcheck="false"><button type="submit" class="lyr-btn lyr-go">Search</button><button type="button" class="lyr-btn lyr-x" data-lyr="search-close" title="Close the search" aria-label="Close the search">×</button>';
    f.querySelector('input').value = this.query;
    el('np-lyrics').appendChild(f);
    if (this.results === null) add('div', 'lyr-hint', 'Searches LRCLIB. Results near this song\'s length come first.');
    else if (this.results === 'loading') add('div', 'lyr-note', 'Searching…');
    else if (this.results === 'offline') add('div', 'lyr-note', 'LRCLIB could not be reached.');
    else if (!this.results.length) add('div', 'lyr-note', 'Nothing found. Fewer words often find more.');
    else {
      const dur = +this._meta?.duration || 0;
      for (const x of this.results) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'lyr-result'; b.dataset.id = String(x.id);
        const t = document.createElement('span'); t.className = 'lyr-r-title'; t.textContent = x.title || '?';
        const s = document.createElement('span'); s.className = 'lyr-r-sub';
        const near = dur && x.duration && Math.abs(x.duration - dur) <= 4;
        s.textContent = [x.artist, x.album, fmtLen(x.duration) + (near ? ' (same length)' : ''), x.instrumental ? 'instrumental' : x.synced ? 'timed' : 'words only'].filter(Boolean).join(' · ');
        b.append(t, s); el('np-lyrics').appendChild(b);
      }
    }
  }

  _renderFoot (pane) {
    const foot = document.createElement('div'); foot.className = 'lyr-foot';
    const from = { file: 'From a file beside the song', tags: 'From the song file itself', lrclib: 'From LRCLIB (lrclib.net)',
      youtube: this.auto ? 'From YouTube\'s automatic captions (made by speech recognition, so often wrong)' : 'From the captions of a YouTube video' }[this.source];
    if (this.status === 'ready' || this.status === 'instrumental') {
      const s = document.createElement('div');
      s.textContent = (from || '') + (this.pinned ? (from ? ', chosen by you' : 'Chosen by you') : '');
      if (this.source === 'youtube' && this.video?.title) s.title = this.video.title;
      if (s.textContent) foot.appendChild(s);
    }
    if (this.path) {
      const tools = document.createElement('div'); tools.className = 'lyr-tools';
      const btn = (act, text, title) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lyr-btn'; b.dataset.lyr = act; b.textContent = text; if (title) b.title = title; tools.appendChild(b); return b; };
      btn('search', 'Search', 'Search LRCLIB for this song\'s lyrics');
      btn('load', 'Load file…', 'A .lrc, .srt, .vtt or .txt file for this song');
      if (this.pinned) btn('unpin', 'Undo choice', 'Look for this song\'s lyrics again as before');
      foot.appendChild(tools);
      if (this.lines.length) {
        const tm = document.createElement('div'); tm.className = 'lyr-timing';
        tm.innerHTML = '<span class="lyr-timing-label">Timing</span><button type="button" class="lyr-btn lyr-sq" data-lyr="earlier" title="Show the words earlier" aria-label="Show the words earlier">−</button><span class="lyr-timing-val" id="lyr-timing-val"></span><button type="button" class="lyr-btn lyr-sq" data-lyr="later" title="Show the words later" aria-label="Show the words later">+</button><button type="button" class="lyr-btn" data-lyr="timing-reset" title="Back to the lyrics\' own timing">Reset</button>';
        tm.querySelector('#lyr-timing-val').textContent = this._offsetLabel();
        foot.appendChild(tm);
      }
    }
    const check = (id, on, text, title) => {
      const lab = document.createElement('label'); lab.className = 'lyr-online';
      const i = document.createElement('input'); i.type = 'checkbox'; i.id = id; i.checked = on;
      lab.append(i, document.createTextNode(' ' + text)); if (title) lab.title = title;
      foot.appendChild(lab);
    };
    check('lyr-online', this.online, 'Look online when a song has none (LRCLIB)');
    // Only where YouTube can be asked (the desktop): the Android app cannot (v3.40.0).
    if (this.api?.music?.lyricsYoutube) check('lyr-youtube', this.youtube, 'Also look on YouTube (gets yt-dlp, 18 MB, the first time)',
      'Looks for a video of the song with the same length and reads its captions. yt-dlp comes from its own GitHub page. YouTube\'s terms do not allow tools like it, and captions for songs are often made by speech recognition, so they can be wrong.');
    pane.appendChild(foot);
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
    if (pane && this.lines.length && !this.searching) {
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
    const now = el('vl-now'), next = el('vl-next'), rom = el('vl-roman');
    if (now && next) {
      const on = this.status === 'ready' && this.lines.length > 0;
      const line = i >= 0 ? this.lines[i] : null, after = this.lines[i + 1];
      // A gap in the words (an empty line, or before the first) shows a
      // note, with the line that comes next under it. v3.46.0: in the
      // letters chosen; with Both, the English letters under the line sung.
      const s = line?.text ? this._shown(line.text, line.roman) : { main: '', under: '' };
      const n = after?.text ? this._shown(after.text, after.roman) : { main: '' };
      now.textContent = on ? (s.main || (after ? '♪' : '')) : '';
      next.textContent = on ? (n.main || '') : '';
      if (rom) { rom.textContent = on ? s.under : ''; rom.classList.toggle('hidden', !rom.textContent); }
      else if (on && s.under) now.textContent += ' · ' + s.under;
      el('viz-lyrics')?.classList.toggle('vl-empty', !now.textContent && !next.textContent);
    }
  }
}
