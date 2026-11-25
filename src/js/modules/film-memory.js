/**
 * What each film keeps (v3.59.0, the plan's 3.56): its sound track, its
 * subtitle, the sound and subtitle delays, and the zoom with where the
 * zoomed picture sits. Opened again, a film comes back as it was left.
 *
 * A series shares them. An episode opened for the first time takes what
 * the last episode of its series had: the same language, the same subtitle
 * (or none), the same delay a badly timed set of files needs. Tracks are
 * matched by language and name, as an episode's track numbers can differ.
 * A series is known by the name before S01E02 (or 1x02) in the file's name,
 * so the episodes of one show in different folders are one series.
 *
 * The colours stay as they were, the same for every film (picture.js).
 *
 * Kept in localStorage, the 600 films used last and the 200 series.
 */
const KEY = 'bm_film_memory';
const MAX_FILES = 600, MAX_SERIES = 200;

/** The series a file belongs to, as a plain lower-case name, or null. */
export function seriesOf (path) {
  const base = String(path || '').split(/[\\/]/).pop().replace(/\.[a-z0-9]{2,4}$/i, '');
  const m = base.match(/^(.*?)[\s._\-[(]*(?:s(\d{1,2})[\s._-]*e(\d{1,3})|(\d{1,2})x(\d{2,3}))(?!\d)/i);
  if (!m) return null;
  const name = m[1].replace(/[._]+/g, ' ').replace(/[\s\-–[(]+$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return name || null;
}

/** A file's own key: the path with one kind of slash and a lower-case drive. */
export const fileKey = p => String(p || '').replace(/\\/g, '/').replace(/^([a-z]):/i, (_, d) => d.toLowerCase() + ':');

/** The track of this type that best matches what was kept, or undefined. */
export function pickTrack (tracks, type, kept, sameFile) {
  const of = (tracks || []).filter(t => t && t.type === type);
  if (!kept) return undefined;
  if (kept.off) return 'no';
  if (sameFile && kept.id != null && of.some(t => t.id === kept.id)) return kept.id;
  const lang = kept.lang || '', title = kept.title || '';
  const both = of.find(t => (t.lang || '') === lang && (t.title || '') === title && (lang || title));
  if (both) return both.id;
  const byLang = lang && of.find(t => (t.lang || '') === lang);
  if (byLang) return byLang.id;
  return undefined;
}

export class FilmMemory {
  /**
   * mpv(): window.api.mpv. picture: the Picture (zoom and pan).
   * osd(text): a short message.
   */
  constructor ({ mpv, picture, osd } = {}) {
    this.mpv = mpv || (() => null);
    this.picture = picture || null;
    this.osd = osd || (() => {});
    this.key = ''; this.series = null; this.restored = true; this._quietUntil = 0;
    this.rec = null;
    this._load();
  }

  _load () {
    try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); this.files = s.files || {}; this.seriesRec = s.series || {}; }
    catch (_) { this.files = {}; this.seriesRec = {}; }
  }
  _persist () {
    const trim = (o, max) => {
      const ks = Object.keys(o); if (ks.length <= max) return o;
      ks.sort((a, b) => (o[b].t || 0) - (o[a].t || 0));
      return Object.fromEntries(ks.slice(0, max).map(k => [k, o[k]]));
    };
    this.files = trim(this.files, MAX_FILES); this.seriesRec = trim(this.seriesRec, MAX_SERIES);
    try { localStorage.setItem(KEY, JSON.stringify({ files: this.files, series: this.seriesRec })); } catch (_) {}
  }
  _set (name, value) { try { this.mpv()?.cmd('set_property', name, value)?.catch?.(() => {}); } catch (_) {} }

  /** What is kept for this path, its own or its series'. { rec, own } */
  find (path) {
    const own = this.files[fileKey(path)];
    if (own) return { rec: own, own: true };
    const s = seriesOf(path);
    if (s && this.seriesRec[s]) return { rec: this.seriesRec[s], own: false };
    return { rec: null, own: false };
  }

  /** A file was loaded: what it keeps is given back when its tracks are known. */
  open (path) {
    if (!path) { this.key = ''; this.restored = true; return; }
    this.key = fileKey(path); this.series = seriesOf(path);
    const { rec, own } = this.find(path);
    this.rec = rec; this.own = own;
    this.restored = !rec;
    this._quietUntil = Date.now() + 1500;   // mpv's own first choices are not the person's
  }

  /** mpv's track list changed: given back once, kept after that. */
  tracks (list) {
    // films only: a song's cover is a video track mpv marks as album art
    if (!this.key || !Array.isArray(list) || !list.some(t => t.type === 'video' && !t.albumart && !t.image)) return;
    if (!this.restored) { this._restore(list); return; }
    if (Date.now() < this._quietUntil) return;
    const sel = type => {
      const t = list.find(x => x.type === type && x.selected);
      return t ? { id: t.id, lang: t.lang || '', title: t.title || '' } : (type === 'sub' && list.some(x => x.type === 'sub') ? { off: true } : null);
    };
    this._save({ audio: sel('audio'), sub: sel('sub') });
  }

  _restore (list) {
    const r = this.rec; this.restored = true;
    this._quietUntil = Date.now() + 1500;
    const aid = pickTrack(list, 'audio', r.audio, this.own);
    const sid = pickTrack(list, 'sub', r.sub, this.own);
    if (aid !== undefined) this._set('aid', aid);
    if (sid !== undefined) this._set('sid', sid);
    if (Number.isFinite(r.adelay) && r.adelay) this._set('audio-delay', r.adelay);
    if (Number.isFinite(r.sdelay) && r.sdelay) this._set('sub-delay', r.sdelay);
    if (this.own && this.picture && Number.isFinite(r.zoom) && r.zoom !== 100) {
      this.picture.setZoom(r.zoom);
      if (Array.isArray(r.pan)) this.picture.setPan(r.pan[0], r.pan[1]);
    }
    const said = [aid !== undefined && 'sound', sid !== undefined && 'subtitles', (r.adelay || r.sdelay) && 'delays'].filter(Boolean);
    if (said.length) this.osd((this.own ? 'As you left it: ' : 'As the last episode: ') + said.join(', '));
  }

  /** A delay changed, in seconds. kind: 'audio' or 'sub'. */
  delay (kind, seconds) {
    if (!this.key || !this.restored || Date.now() < this._quietUntil) return;
    this._save(kind === 'audio' ? { adelay: +seconds || 0 } : { sdelay: +seconds || 0 });
  }
  /** The zoom or where the picture sits changed (picture.js). */
  view (zoom, pan) {
    if (!this.key || !this.restored) return;
    this._save({ zoom, pan: [pan[0], pan[1]] }, true);
  }

  _save (part, ownOnly) {
    const now = Date.now();
    const f = this.files[this.key] = { ...(this.files[this.key] || {}), ...part, t: now };
    if (this.series && !ownOnly) {
      const { zoom, pan, ...shared } = f;
      this.seriesRec[this.series] = { ...(this.seriesRec[this.series] || {}), ...shared, t: now };
    }
    this._persist();
  }

  /** Forget this film (and nothing of its series). */
  forget (path) { delete this.files[fileKey(path || this.key)]; this._persist(); }
}
