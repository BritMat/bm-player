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
/**
 * Extract the first .srt file from a ZIP byte array using the spec-defined
 * ZIP central-directory format. Renderer-native (no adm-zip needed) — the
 * OpenSubtitles ZIP is small (a single subtitle file).
 */
async function extractSrtFromZip(buf){
  if(!buf || buf.length < 22) return null;
  // Find End-of-Central-Directory record (0x06054b50) by scanning backwards
  let eocd = -1;
  for(let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--){
    if(buf[i]===0x50 && buf[i+1]===0x4b && buf[i+2]===0x05 && buf[i+3]===0x06){ eocd = i; break; }
  }
  if(eocd === -1) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const cdEntries = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  let offset = cdOffset;
  for(let i = 0; i < cdEntries; i++){
    if(offset + 46 > buf.length) break;
    const sig = dv.getUint32(offset, true);
    if(sig !== 0x02014b50) break;
    const compMethod = dv.getUint16(offset + 10, true);
    const compSize = dv.getUint32(offset + 20, true);
    const uncompSize = dv.getUint32(offset + 24, true);
    const fnameLen = dv.getUint16(offset + 28, true);
    const extraLen = dv.getUint16(offset + 30, true);
    const commentLen = dv.getUint16(offset + 32, true);
    const localHeaderOffset = dv.getUint32(offset + 42, true);
    // Read filename
    let fname = '';
    for(let j = 0; j < fnameLen; j++){
      fname += String.fromCharCode(buf[offset + 46 + j]);
    }
    // Move to next entry
    offset += 46 + fnameLen + extraLen + commentLen;
    // Is this an .srt file?
    if(!fname.toLowerCase().endsWith('.srt')) continue;
    // Find the local file header to get the actual data offset
    if(localHeaderOffset + 30 > buf.length) continue;
    const localFnameLen = dv.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = dv.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localFnameLen + localExtraLen;
    const compressed = buf.slice(dataOffset, dataOffset + compSize);
    if(compMethod === 0){
      // Stored — no decompression needed
      return compressed;
    } else if(compMethod === 8){
      // Deflate — use the renderer's DecompressionStream
      try{
        const blob = new Blob([compressed]);
        const ds = blob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const decompressed = await new Response(ds).arrayBuffer();
        return new Uint8Array(decompressed);
      }catch(_){ continue; }
    }
  }
  return null;
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
