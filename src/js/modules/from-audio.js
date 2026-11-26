/**
 * Subtitles from the audio (v3.59.0, the plan's 3.57): the panel, and the
 * subtitle track mpv shows (main/transcribe.js does the writing, with
 * whisper.cpp, on this computer).
 *
 * Start it on a film: the words are written about a minute and a half ahead
 * of where the film is, added as a subtitle track, "From the audio", that
 * grows as it goes. A seek past what is written starts it from there. On
 * live TV the words are shown over the picture as each few seconds is done.
 * It stops when another file opens.
 */
export const LANGS = [['auto', 'Found by itself'], ['en', 'English'], ['ml', 'Malayalam'], ['hi', 'Hindi'], ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'],
  ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic']];
export const MODEL_NAMES = [['tiny', 'Tiny, 75 MB: the quickest'], ['base', 'Base, 142 MB'], ['small', 'Small, 466 MB: the most right, the slowest']];
const KEY = 'bm_from_audio';
const mb = n => (n / 1048576).toFixed(n > 104857600 ? 0 : 1) + ' MB';
const clock = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

export class FromAudio {
  constructor ({ api, app, osd } = {}) {
    this.api = api; this.app = app; this.osd = osd || (() => {});
    let s = {}; try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
    this.lang = LANGS.some(([k]) => k === s.lang) ? s.lang : 'auto';
    this.model = MODEL_NAMES.some(([k]) => k === s.model) ? s.model : 'base';
    this.translate = !!s.translate;
    this.on = false; this.file = null; this.srt = null; this.sid = null; this._t = 0;
    const t = api?.transcribe; if (!t) return;
    t.onProgress(d => this._say(`Fetching ${d.what}: ${mb(d.got)}${d.total ? ' of ' + mb(d.total) : ''}`));
    t.onUpdate(d => this._update(d));
    t.onLive(d => { if (this.on) this.api.mpv.cmd('show-text', d.text, 6500)?.catch?.(() => {}); this._say(`Live: the words come about ${d.behind} seconds after they are said.`); });
    t.onError(d => { this.on = false; clearInterval(this._t); this._say('Stopped: ' + d.error); this.sync(); });
  }
  _keep () { try { localStorage.setItem(KEY, JSON.stringify({ lang: this.lang, model: this.model, translate: this.translate })); } catch (_) {} }
  _say (text) { this.note = text; const n = this.root?.querySelector('[data-fa-note]'); if (n) n.textContent = text; }

  async start () {
    const app = this.app, mpv = this.api?.mpv, t = this.api?.transcribe;
    if (!t || !mpv) return;
    const file = app._currentFilePath || app._lastOpened;
    if (!file || !app._hasVideo) { this._say('Open a film first.'); return; }
    let aid = null; try { const r = await mpv.cmd('get_property', 'aid'); aid = r && typeof r === 'object' && 'data' in r ? r.data : r; } catch (_) {}
    const live = /^[a-z]+:\/\//i.test(file) && !(app.duration > 0);
    this.on = true; this.file = file; this.srt = null; this.sid = null;
    this._say('Getting ready…'); this.sync();
    const r = await t.start({ file, aid: aid && aid !== 'no' ? aid : '', at: app.currentTime || 0, duration: app.duration || 0, lang: this.lang, translate: this.translate, model: this.model, live });
    if (!r?.ok) { this.on = false; this._say(r?.error || 'It could not start.'); this.sync(); return; }
    if (r.stopped) return;
    this._say(live ? 'Listening to the live sound…' : 'Writing the words…');
    clearInterval(this._t);
    this._t = setInterval(() => { if (this.on) t.at(this.app.currentTime || 0); }, 3000);
  }
  stop (say = true) {
    if (!this.on) return;
    this.on = false; clearInterval(this._t);
    this.api?.transcribe?.stop();
    if (say) this._say('Stopped. What was written is kept for this film.');
    this.sync();
  }
  /** A film opened: one that is not the one being written stops it. */
  opened (file) { if (this.on && file !== this.file) this.stop(false); }

  async _update (d) {
    if (!this.on) return;
    const mpv = this.api.mpv;
    const ahead = d.upTo - (this.app.currentTime || 0);
    this._say(d.kept ? `Written before for this film: ${d.lines} lines, up to ${clock(d.upTo)}.` : `Written up to ${clock(d.upTo)}${ahead > 0 ? ' (' + Math.round(ahead) + ' s ahead)' : ''}, ${d.speed}× as fast as it plays. ${d.lines} lines.`);
    // mpv's sub-reload loads the file again under its file name, the track's
    // title lost: the grown file is added again as a new track, chosen if
    // the old one was, and the old one taken away
    const val = r => (r && typeof r === 'object' && 'data' in r ? r.data : r);
    const was = this.sid, chosen = was != null && String(val(await mpv.cmd('get_property', 'sid')?.catch?.(() => null))) === String(was);
    this.srt = d.srt;
    await mpv.cmd('sub-add', d.srt, was == null || chosen ? 'select' : 'auto', this.translate ? 'From the audio, in English' : 'From the audio', this.lang === 'auto' ? '' : this.lang)?.catch?.(() => {});
    try {
      const list = val(await mpv.cmd('get_property', 'track-list')) || [];
      const mine = list.filter(x => x.type === 'sub' && String(x['external-filename'] || '').replace(/\\/g, '/') === d.srt.replace(/\\/g, '/'));
      const now = mine.pop();
      this.sid = now ? now.id : null;
      for (const old of mine) await mpv.cmd('sub-remove', old.id)?.catch?.(() => {});
    } catch (_) {}
  }

  wire (root) {
    this.root = root; if (!root) return;
    const sel = (q, list, v) => { const s = root.querySelector(q); if (!s) return null; s.innerHTML = list.map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); s.value = v; return s; };
    sel('[data-fa-lang]', LANGS, this.lang)?.addEventListener('change', e => { this.lang = e.target.value; this._keep(); });
    sel('[data-fa-model]', MODEL_NAMES, this.model)?.addEventListener('change', e => { this.model = e.target.value; this._keep(); this.status(); });
    const tr = root.querySelector('[data-fa-tr]'); if (tr) { tr.checked = this.translate; tr.addEventListener('change', e => { this.translate = e.target.checked; this._keep(); }); }
    root.querySelector('[data-fa-go]')?.addEventListener('click', () => this.on ? this.stop() : this.start());
    this.sync();
  }
  /** What is here already, said before anything is fetched. */
  async status () {
    const s = await this.api?.transcribe?.status?.().catch?.(() => null); if (!s || this.on) return;
    const m = s.models?.[this.model];
    const need = [!s.cli && (s.canFetch ? 'whisper.cpp (a few MB)' : null), m && !m.here ? 'the ' + this.model + ' model (' + m.mb + ' MB)' : null].filter(Boolean);
    this._say(!s.cli && !s.canFetch ? 'whisper.cpp is needed: on a Mac, install it with Homebrew (brew install whisper-cpp).' : need.length ? 'The first time, ' + need.join(' and ') + ' will be fetched and kept.' : 'Ready: everything is on this computer.');
  }
  sync () {
    const root = this.root; if (!root) return;
    const b = root.querySelector('[data-fa-go]'); if (b) b.textContent = this.on ? 'Stop' : 'Start';
    for (const q of ['[data-fa-lang]', '[data-fa-model]', '[data-fa-tr]']) { const x = root.querySelector(q); if (x) x.disabled = this.on; }
    if (this.note) this._say(this.note);
  }
}
