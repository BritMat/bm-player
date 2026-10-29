/**
 * BM Player — shared renderer utilities
 *
 * Small, dependency-free helpers that more than one module needs. Kept in its
 * own file specifically so modules/ can import them without reaching into
 * app.js, which would create a circular import (app.js already imports
 * modules/tv.js, modules/playlist-io.js and friends).
 */

/**
 * Build a working file:// URL from an absolute filesystem path.
 *
 * CRITICAL: `'file://' + 'C:/Users/x/a.jpg'` parses as HOST="c",
 * PATH="/Users/x/a.jpg". Chromium resolves that to a nonexistent network
 * host and silently loads nothing — no error, no console warning, just an
 * empty <img> or a fetch that never resolves to anything useful. Windows
 * paths need THREE slashes.
 *
 * The path must also be percent-encoded: any filename containing a space,
 * '#', '?', '%' or '&' otherwise truncates or fails outright. encodeURI
 * leaves '#' and '?' alone, so those two are handled explicitly.
 *
 * Works for POSIX paths too: '/home/u/a.pdf' -> 'file:///home/u/a.pdf'.
 *
 * @param {string} p Absolute path, either Windows or POSIX style.
 * @returns {string} A percent-encoded file:// URL, or '' for empty input.
 */
export function fileURL(p) {
  if (!p) return '';
  // Compatibility mode (npm run start:compat) goes back to plain file://
  // with webSecurity off, for bisecting a problem with the custom scheme.
  const flags = (typeof window !== 'undefined' && window.__BM_FLAGS__) || null;
  if (flags && flags.fileScheme === 'file') return rawFileURL(p);
  // The whole path goes in as ONE percent-encoded segment. Putting it in
  // unencoded would mean parsing `C:` as a drive letter inside a URL path,
  // which is the same class of mess that made 'file://' + 'C:/x' resolve to
  // host="c" and silently load nothing.
  return 'bmfile://local/' + encodeURIComponent(String(p).replace(/\\/g, '/'));
}

/**
 * The plain file:// form, kept for anything that genuinely needs it.
 * Prefer fileURL(): bmfile:// is what the CSP allows and what lets
 * webSecurity stay on.
 */
export function rawFileURL(p) {
  if (!p) return '';
  const s = String(p).replace(/\\/g, '/').replace(/^\/+/, '');
  return 'file:///' + encodeURI(s).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

/**
 * True when the string looks like a remote URL rather than a local path.
 * Used to decide whether something needs fileURL() at all.
 */
export function isRemoteURL(s) {
  return /^(https?|rtsp|rtmp|udp|rtp|srt|mms|hls):\/\//i.test(String(s || ''));
}

/* ═══════════════════════════════════════════════════════════════════
   Formatting and DOM helpers.

   These were module-scope functions in app.js, which meant every class
   that needed one had to live in that same 3,000-line file. Exporting
   them is what makes the dashboards splittable.
   ═══════════════════════════════════════════════════════════════════ */

export function fmtBytes(n){
  if(!n||isNaN(n))return'\u2014';
  const u=['B','KB','MB','GB'];let i=0;
  while(n>=1024&&i<u.length-1){n/=1024;i++;}
  return (i?n.toFixed(1):n)+' '+u[i];
}
// A stream, or a file still being read, reports an unknown length as Infinity,
// which came out as "Infinity:NaN" (v3.25.0).
export function fmtSec(s){if(s===Infinity||s===-Infinity)return'--:--';if(!s||isNaN(s)||s<0)return'0:00';s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return h?h+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0'):m+':'+String(ss).padStart(2,'0');}
export function el(id){return document.getElementById(id);}
// fileURL lives in util.js so modules/ can use it without importing app.js.
export function seedGrad(s){let h=5381;for(let i=0;i<s.length;i++)h=(h*33)^s.charCodeAt(i);h=Math.abs(h);return'linear-gradient(135deg,hsl('+(h%360)+',70%,45%),hsl('+((h+137)%360)+',75%,50%))';}
export function cleanTitle(n){return n.replace(/\.[^.]+$/,'').replace(/^\d+[\s.\-_]+/,'').replace(/[_-]/g,' ').trim();}
// ── v1.7.0 helpers ─────────────────────────────────────────────
export function escapeHtml(s){return String(s==null?'':s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
export function escapeAttr(s){return String(s==null?'':s).replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
export function basenameOf(p){if(!p)return'';return p.replace(/\\/g,'/').split('/').pop()||p;}
export function relativeTime(ts){
  if(!ts) return '—';
  const diff = Date.now() - ts;
  const s = Math.floor(diff/1000);
  if(s < 60) return 'just now';
  const m = Math.floor(s/60);
  if(m < 60) return m+'m ago';
  const h = Math.floor(m/60);
  if(h < 24) return h+'h ago';
  const d = Math.floor(h/24);
  if(d < 7) return d+'d ago';
  const w = Math.floor(d/7);
  if(w < 5) return w+'w ago';
  return new Date(ts).toLocaleDateString();
}

// Shared folder picker.
// The old per-module code had three "fallbacks": Electron IPC, then
// showDirectoryPicker(), then a hidden <input webkitdirectory> it clicked.
// In Electron showDirectoryPicker is undefined, and input.click() after an
// `await` is a SILENT NO-OP because the user-activation token is already
// spent. So a failing IPC call produced literally nothing — no dialog, no
// error. That is the "Open Folder does nothing" bug. One path, loud failure.
export async function pickFolder(api){
  if(!api?.gallery?.browse){
    alert('File dialogs are unavailable — the preload bridge did not load.\nOpen DevTools (Ctrl+Shift+I) and check for a preload error.');
    return null;
  }
  try{
    return await api.gallery.browse();   // null === user cancelled
  }catch(e){
    console.error('[pickFolder]',e);
    alert('Could not open the folder dialog:\n'+(e?.message||e));
    return null;
  }
}

// ── Gallery ────────────────────────────────────────────────────

/**
 * A film's name from its file, for a subtitle search (v3.46.0): the
 * folder, the extension, a leading number and the release words (1080p,
 * x264, BluRay, the group's name in brackets) taken off, the year kept.
 * "12. The.Film.2019.1080p.BluRay.x264-GRP.mkv" gives "The Film 2019".
 */
export function filmName(p){
  let n=basenameOf(String(p||'')).replace(/\.[^.]{1,5}$/,'');
  n=n.replace(/^\d{1,3}[\s.\-_]+(?=\D)/,'').replace(/[._]+/g,' ').replace(/\[[^\]]*\]/g,' ');
  // everything from the first release word on is the release, not the name
  const tag=/\b(2160p|1080p|720p|480p|4k|uhd|hdr|10bit|x26[45]|h\.?26[45]|hevc|avc|bluray|blu ray|brrip|bdrip|web ?dl|web ?rip|webrip|hdrip|dvdrip|hdtv|remux|aac|ac3|dts|ddp?5 1|yify|rarbg|proper|repack|extended|unrated)\b/i;
  const m=tag.exec(n); if(m&&m.index>0) n=n.slice(0,m.index);
  return n.replace(/\(\s*\)/g,' ').replace(/\s*-\s*$/,'').replace(/\s+/g,' ').trim();
}
