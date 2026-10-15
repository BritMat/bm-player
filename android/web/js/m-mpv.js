/**
 * m-mpv: mpv, the video engine built into the app (v3.41.0).
 *
 * Java plays the video (MpvPlayer.java) on a surface behind the page, and
 * the page draws the controls over it, see-through. Asking goes through
 * BMAndroid (mpvOpen, mpvCommand, mpvClose, mpvSubAdd), and mpv's news
 * comes back as 'mpv' events, kept here in mpv.st:
 *
 *   start                         a file begins to open
 *   loaded { d, w, h, format, video, audio, tracks }
 *   restart                       the picture shows (after opening, or a seek)
 *   time { t }, duration { d }
 *   pause, eof, buffering, seeking { v }
 *   speed { v }, hwdec { v }      hwdec: the phone's decoder in use, or 'no'
 *   tracks { list }               video, audio and subtitle tracks (mpv's track-list)
 *   video { w, h, rotate }        the picture's size, once it is decoded
 *   error { text, detail }        the file would not open
 *   end { text }                  it stopped part way
 *   unavailable { reason }        mpv could not run: the web engine takes over
 */
import { call, on } from './m-android.js';

const info = (() => { try { return JSON.parse(call('mpvState') || '{}'); } catch (_) { return {}; } })();
const fresh = () => ({ t: 0, d: 0, pause: false, eof: false, buffering: false, seeking: false, speed: 1, tracks: [],
  w: 0, h: 0, rotate: 0, loaded: false, shown: false, hwdec: '', format: '', video: '', audio: '' });
const listeners = new Set();

/** 'mpv' or 'web': the player Settings chose for videos. */
export function choice () {
  try { return localStorage.getItem('bm_m_vplayer') === 'web' ? 'web' : 'mpv'; } catch (_) { return 'mpv'; }
}
export function setChoice (v) {
  try { localStorage.setItem('bm_m_vplayer', v === 'web' ? 'web' : 'mpv'); } catch (_) {}
  // Chosen again after it stopped the app once: Java tries it again.
  if (v !== 'web') { info.off = false; call('mpvEnable', true); }
}

export const mpv = {
  info,
  st: fresh(),
  /** mpv can play here, and is the player chosen. */
  get ready () { return !!info.available && !info.off && choice() === 'mpv'; },
  open (src, { start = 0, paused = false } = {}) { this.st = fresh(); this.st.pause = !!paused; call('mpvOpen', src, +start || 0, !!paused); },
  close () { call('mpvClose'); this.st = fresh(); },
  cmd (...args) { call('mpvCommand', JSON.stringify(args.map(String))); },
  set (name, value) { this.cmd('set', name, value === true ? 'yes' : value === false ? 'no' : String(value)); },
  seek (t) { this.cmd('seek', Math.max(0, +t || 0).toFixed(3), 'absolute'); },
  jump (d) { this.cmd('seek', String(d), 'relative'); },
  subAdd (name, text) { call('mpvSubAdd', String(name || 'Subtitles'), String(text)); },
  /** fn(event, st) for each event. Returns a function that stops it. */
  listen (fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

on('mpv', d => {
  const s = mpv.st, num = x => typeof x === 'number' && isFinite(x);
  switch (d.e) {
    case 'start': s.loaded = false; s.eof = false; s.shown = false; break;
    case 'loaded':
      s.loaded = true;
      if (num(d.d)) s.d = d.d;
      s.w = d.w || 0; s.h = d.h || 0; s.rotate = d.rotate || 0;
      s.format = d.format || ''; s.video = d.video || ''; s.audio = d.audio || '';
      if (Array.isArray(d.tracks)) s.tracks = d.tracks;
      break;
    case 'restart': s.shown = true; break;
    case 'time': if (num(d.t)) s.t = d.t; break;
    case 'duration': if (num(d.d)) s.d = d.d; break;
    case 'pause': s.pause = !!d.v; break;
    case 'eof': s.eof = !!d.v; break;
    case 'buffering': s.buffering = !!d.v; break;
    case 'seeking': s.seeking = !!d.v; break;
    case 'speed': if (num(d.v)) s.speed = d.v; break;
    case 'hwdec': s.hwdec = d.v || ''; break;
    case 'tracks': if (Array.isArray(d.list)) s.tracks = d.list; break;
    case 'video': if (d.w && d.h) { s.w = d.w; s.h = d.h; s.rotate = d.rotate || 0; } break;
    case 'unavailable': info.available = false; info.reason = d.reason || ''; break;
  }
  for (const fn of listeners) { try { fn(d, s); } catch (e) { console.error('[BM Player] mpv listener:', e); } }
});

// ── words for what mpv reports ───────────────────────────────────────
const CODECS = {
  hevc: 'H.265', h264: 'H.264', av1: 'AV1', vp9: 'VP9', vp8: 'VP8', mpeg4: 'MPEG-4', mpeg2video: 'MPEG-2', vc1: 'VC-1', wmv3: 'WMV',
  aac: 'AAC', ac3: 'Dolby Digital', eac3: 'Dolby Digital Plus', truehd: 'Dolby TrueHD', dts: 'DTS', flac: 'FLAC', opus: 'Opus',
  vorbis: 'Vorbis', mp3: 'MP3', mp2: 'MP2', alac: 'ALAC', pcm_s16le: 'PCM', pcm_s24le: 'PCM',
  subrip: 'SRT', ass: 'ASS', ssa: 'SSA', mov_text: 'MP4 text', webvtt: 'WebVTT', hdmv_pgs_subtitle: 'PGS', dvd_subtitle: 'VobSub', dvb_subtitle: 'DVB',
};
export const codecName = c => (c ? CODECS[String(c).toLowerCase()] || String(c).toUpperCase() : '');

let names = null;
/** A language code as a film carries it (eng, en, ind) as its name (English, Indonesian). */
export function langName (code) {
  if (!code || code === 'und') return '';
  try {
    names = names || new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' });
    const n = names.of(code);
    if (n && n.toLowerCase() !== String(code).toLowerCase()) return n;
  } catch (_) {}
  return String(code).toUpperCase();
}

/** A track as a line in a menu: its title and language, or what kind it is. */
export function trackLabel (t) {
  const lang = langName(t.lang), title = String(t.title || '').trim();
  const parts = [title, lang && !title.toLowerCase().includes(lang.toLowerCase()) ? lang : ''].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return (t.type === 'sub' ? 'Subtitles' : t.type === 'audio' ? 'Audio' : 'Video') + ' ' + t.id;
}

/** An audio track's channels: stereo, 5.1. */
export function channels (t) {
  const n = +(t['demux-channel-count'] || t['audio-channels'] || 0);
  return n === 1 ? 'mono' : n === 2 ? 'stereo' : n === 6 ? '5.1' : n === 8 ? '7.1' : n ? n + ' channels' : '';
}
