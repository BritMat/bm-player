/**
 * What the player keeps for you (v3.47.0, from app.js): A-B loops, bookmarks, history and
 * carrying on where you stopped, playlists in and out, and subtitles from the web.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import settings from '../modules/settings.js';
import history from '../modules/history.js';
import bookmarks from '../modules/bookmarks.js';
import { readM3uFile, writeM3uFile } from '../modules/playlist-io.js';
import { el, fmtSec, escapeHtml, escapeAttr, basenameOf, relativeTime, filmName } from '../util.js';

export default class LibraryFeature {

  // ════════════════════════════════════════════════════════════════
  // v1.7.0 — Professional Media Player features
  // ════════════════════════════════════════════════════════════════

  // ── A-B Repeat: wire the on-screen clear button + indicator ───────
  wireABRepeat(){
    el('ab-clear-btn')?.addEventListener('click',()=>this.abRepeat?.clear());
    this._renderABIndicator();
  }
  _renderABIndicator(){
    const ind = el('ab-indicator');
    if(!ind) return;
    const snap = this.abRepeat?.snapshot();
    if(!snap || !snap.a || snap.a == null){ ind.classList.add('hidden'); return; }
    ind.classList.remove('hidden');
    ind.classList.toggle('ab-paused', snap.paused || !snap.active);
    const a = el('ab-a'), b = el('ab-b');
    if(a) a.textContent = fmtSec(snap.a);
    if(b) b.textContent = snap.b != null ? fmtSec(snap.b) : '…';
  }

  // ── Bookmarks panel + seekbar markers ─────────────────────────────
  wireBookmarks(){
    el('bm-add-now')?.addEventListener('click',()=>this.addBookmarkAtCurrent());
    el('bm-clear-file')?.addEventListener('click',()=>{
      if(!this._currentFilePath){this.showOSD('No file open');return;}
      bookmarks.clearForFile(this._currentFilePath);
      this._renderBookmarksOnSeekbar();
      this.showOSD('Bookmarks cleared');
    });
  }
  wireBookmarkControls(){
    // Player-control bookmark button already wired in wireTransport.
    // Hook for context-menu integration is intentionally a no-op until
    // we add a dedicated context menu entry.
  }
  async addBookmarkAtCurrent(opts = {}){
    if(!this._currentFilePath){this.showOSD('Open a file first');return;}
    const t = await this.api?.mpv?.cmd('get_property','time-pos').catch(()=>null);
    if(t == null){this.showOSD('Cannot add bookmark — no playback');return;}
    let note = '';
    if(!opts.quick){
      // Use a tiny inline prompt (the existing dlg-jump pattern)
      const raw = prompt('Bookmark note (optional):', '');
      if(raw === null) return;            // user cancelled
      note = (raw || '').slice(0, 120);
    }
    const bm = bookmarks.add(this._currentFilePath, t, note);
    if(bm){this.showOSD(`Bookmark @ ${fmtSec(t)}`);}
    this._renderBookmarksOnSeekbar();
    if(el('panel-bookmarks')?.classList.contains('open')) this._renderBookmarksPanel();
  }
  _renderBookmarksPanel(){
    const list = el('bm-list');
    if(!list) return;
    const hint = el('bm-hint');
    if(!this._currentFilePath){
      if(hint) hint.style.display = '';
      list.innerHTML = '';
      return;
    }
    const items = bookmarks.list(this._currentFilePath);
    if(hint) hint.style.display = items.length ? 'none' : '';
    if(!items.length){ list.innerHTML = ''; return; }
    list.innerHTML = items.map(bm => `
      <div class="bm-item" data-t="${bm.t}">
        <span class="bm-time">${fmtSec(bm.t)}</span>
        <span class="bm-note ${bm.note ? '' : 'empty'}">${bm.note ? escapeHtml(bm.note) : '— no note —'}</span>
        <button class="bm-jump" title="Seek to here" aria-label="Seek to bookmark">▸</button>
        <button class="bm-del" title="Remove" aria-label="Remove bookmark">✕</button>
      </div>`).join('');
    list.querySelectorAll('.bm-item').forEach(row => {
      const t = parseFloat(row.dataset.t);
      row.querySelector('.bm-jump').addEventListener('click',()=>{
        this.seekTo(t);
        this.showOSD(`Jump to ${fmtSec(t)}`);
      });
      row.querySelector('.bm-del').addEventListener('click',()=>{
        bookmarks.remove(this._currentFilePath, t);
        this._renderBookmarksOnSeekbar();
      });
      row.addEventListener('dblclick',()=>{
        this.seekTo(t);
      });
    });
  }
  _renderBookmarksOnSeekbar(){
    const track = el('seek-track');
    if(!track) return;
    // Clear any previous markers (we re-render the whole set).
    track.querySelectorAll('.seek-bookmark-marker').forEach(m => m.remove());
    if(!this._currentFilePath || !this.duration) return;
    const items = bookmarks.list(this._currentFilePath);
    if(!items.length) return;
    items.forEach(bm => {
      const pct = Math.max(0, Math.min(100, (bm.t / this.duration) * 100));
      const m = document.createElement('div');
      m.className = 'seek-bookmark-marker';
      m.style.left = pct + '%';
      m.title = `${fmtSec(bm.t)}${bm.note ? ' — ' + bm.note : ''}`;
      m.addEventListener('click',(e)=>{
        e.stopPropagation();
        this.seekTo(bm.t);
      });
      track.appendChild(m);
    });
  }

  // ── Watch History panel ───────────────────────────────────────────
  wireHistory(){
    el('hist-clear')?.addEventListener('click',()=>{
      if(!confirm('Clear all watch history?')) return;
      history.clear();
      this._renderHistoryPanel();
      this.showOSD('History cleared');
    });
  }
  _renderHistoryPanel(){
    const list = el('hist-list'), summary = el('hist-summary');
    if(!list) return;
    const items = history.list();
    // Summary
    if(summary){
      if(!items.length){ summary.innerHTML = ''; }
      else {
        const totalSec = items.reduce((s, r) => s + (r.watchSeconds || 0), 0);
        const videos = items.filter(r => r.kind !== 'audio').length;
        const audios = items.length - videos;
        summary.innerHTML = `
          <div><strong>${items.length}</strong> files</div>
          <div><strong>${videos}</strong> videos</div>
          <div><strong>${audios}</strong> audio</div>
          <div><strong>${fmtSec(totalSec)}</strong> watched</div>`;
      }
    }
    if(!items.length){
      list.innerHTML = '<div class="hist-empty">No history yet.</div>';
      return;
    }
    list.innerHTML = items.map(r => {
      const name = (r.title || basenameOf(r.path)) + (r.path ? '' : '');
      // Straight off the filename, so it is untrusted: a file called
      // `movie.<img src=x onerror=...>` would otherwise be interpolated
      // into innerHTML verbatim. Same class as the gallery/music bugs.
      const ext = escapeHtml((r.path || '').split('.').pop().toUpperCase().slice(0, 8));
      const pct = (r.duration && r.lastPosition) ? Math.min(100, Math.round(r.lastPosition / r.duration * 100)) : 0;
      const when = r.lastPlayed ? relativeTime(r.lastPlayed) : '—';
      return `
      <div class="hist-item" data-path="${escapeAttr(r.path)}">
        <span class="hist-icon">${r.kind === 'audio' ? '🎵' : '🎬'}</span>
        <div class="hist-info">
          <div class="hist-title">${escapeHtml(name)}</div>
          <div class="hist-meta">
            <span>${ext}</span>
            <span>·</span>
            <span>${when}</span>
            <span>·</span>
            <span>${r.playCount || 1}×</span>
          </div>
          <div class="hist-progress"><div class="hist-progress-fill" style="width:${pct}%"></div></div>
        </div>
        <span class="hist-time">${fmtSec(r.lastPosition || 0)} / ${fmtSec(r.duration || 0)}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.hist-item').forEach(row => {
      row.addEventListener('click',()=>{
        const p = row.dataset.path;
        if(p) this.playMedia([p]);
      });
    });
  }

  // ── Online subtitle search ───────────────────────────────────────
  // v3.46.0: OpenSubtitles shut the XML-RPC service this searched (early
  // 2026), so every search ended in an error. Before that, it also read the
  // whole film into the page to hash 128 KB of it: a 4 GB film, 4 GB in
  // memory. Now the search opens on opensubtitles.com with the film's name,
  // and the subtitle found is loaded from a file or dropped on the video.
  wireSubSearch(){
    el('subs-search-btn')?.addEventListener('click',()=>{
      const q=(el('subsearch-query')?.value||'').trim()||filmName(this._currentFilePath||'');
      if(!q){this.showOSD('Open a film first, or type its name');return;}
      this.api?.app?.external?.('https://www.opensubtitles.com/en/search-all/q-'+encodeURIComponent(q).replace(/%20/g,'+'));
    });
    el('subs-load-btn')?.addEventListener('click',()=>this.api?.dialog.openSub().then(s=>{if(s){this.api?.mpv.cmd('sub-add',s,'select');this.showOSD('Subtitle loaded');}}));
  }
  /** The film's name filled in when the panel opens. */
  _fillSubSearch(){
    const q=el('subsearch-query');
    if(q&&!q.value) q.value=filmName(this._currentFilePath||'');
  }

  // ── Resume prompt ─────────────────────────────────────────────────
  wireResumePrompt(){
    el('resume-yes')?.addEventListener('click',()=>this._doResume(true));
    el('resume-no')?.addEventListener('click',()=>this._doResume(false));
    el('resume-dismiss')?.addEventListener('click',()=>el('resume-prompt')?.classList.add('hidden'));
  }
  _maybePromptResume(path){
    if(!path || path.startsWith('http')) return;
    if(!settings.get('playback.resumePrompt')) return;
    const pos = history.getResumePosition(path);
    if(!pos) return;
    // Wait briefly for mpv to actually start the file before we prompt
    // (otherwise the seek-to-position won't take effect).
    clearTimeout(this._resumePromptTimer);
    this._resumePromptTimer = setTimeout(()=>{
      const prompt = el('resume-prompt');
      if(!prompt) return;
      const meta = el('resume-prompt-meta');
      if(meta) meta.textContent = `Stopped at ${fmtSec(pos)}${this.duration ? ' of ' + fmtSec(this.duration) : ''}`;
      prompt.classList.remove('hidden');
      this._pendingResumePos = pos;
      // Auto-dismiss after 12s if no interaction
      setTimeout(()=>{ if(!prompt.matches('.hidden')){ prompt.classList.add('hidden'); this._pendingResumePos = null; } }, 12000);
    }, 800);
  }
  _doResume(resume){
    el('resume-prompt')?.classList.add('hidden');
    if(resume && this._pendingResumePos){
      const rewind = settings.get('playback.resumeRewindSec') || 0;
      const target = Math.max(0, this._pendingResumePos - rewind);
      this.seekTo(target);
      this.showOSD(`Resumed from ${fmtSec(target)}`, 2200);
    }
    this._pendingResumePos = null;
  }

  // ── M3U playlist IO ───────────────────────────────────────────────
  wirePlaylistIO(){
    // Wiring is via handleAction — import-m3u / export-m3u call into
    // the methods below. No additional listeners needed.
  }
  async importM3u(){
    const file = await this.api?.dialog.openM3u();
    if(!file) return;
    try{
      const items = await readM3uFile(file);
      if(!items.length){ this.showOSD('Playlist is empty'); return; }
      const paths = items.map(i => i.path).filter(Boolean);
      if(!paths.length){ this.showOSD('No playable paths in playlist'); return; }
      this.playMedia(paths);
      this.showOSD(`Loaded ${paths.length} items from playlist`, 2200);
    }catch(err){
      this.showOSD('Failed to load playlist: ' + err.message, 4000);
    }
  }
  async exportM3u(){
    let pl;
    try{ pl = await this.api?.mpv.getPlaylist(); }catch(_){}
    if(!pl || !Array.length || !pl.length){
      this.showOSD('Playlist is empty');
      return;
    }
    const items = pl.map(p => ({
      path: p.filename,
      title: p.title || (p.filename ? (p.filename.split(/[\\/]/).pop() || p.filename) : ''),
      duration: p.duration || -1,
    })).filter(i => i.path && !i.path.startsWith('cdda://'));
    if(!items.length){
      this.showOSD('Playlist is empty');
      return;
    }
    const defaultName = (this._currentFilePath ? this._currentFilePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : 'playlist') + '.m3u';
    const savePath = await this.api?.dialog.saveM3u(defaultName);
    if(!savePath) return;
    try{
      await writeM3uFile(savePath, items, this.api);
      this.showOSD(`Saved ${items.length} items to .m3u`, 2200);
    }catch(err){
      this.showOSD('Failed to save playlist: ' + err.message, 4000);
    }
  }
}
