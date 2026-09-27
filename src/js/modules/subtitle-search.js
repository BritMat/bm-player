/**
 * BM Player — Online Subtitle Search (v1.7.0)
 *
 * Searches OpenSubtitles' public XML-RPC API for subtitles matching the
 * currently-playing file, by either:
 *   (a) file hash + size (most accurate, returns exact-match subs), or
 *   (b) filename keyword search (fallback when hashing fails).
 *
 * Implementation notes:
 *   - XML-RPC is wrapped by hand because pulling in an XML-RPC lib for a
 *     single endpoint is overkill. The request body is small.
 *   - The OpenSubtitles XML-RPC endpoint requires no token for the legacy
 *     LogIn('','','en','BMPlayer') flow. We still call LogIn to honor the
 *     spec and pick up a token; anonymous use is the documented path.
 *   - Hashing follows the published OpenSubtitles hash algorithm: 64KB
 *     from head + 64KB from tail + total size, summed as 64-bit little-
 *     endian. We do this in the renderer with File.slice() + ArrayBuffer.
 */

const OPENSUBS_XMLRPC = 'https://api.opensubtitles.org/xml-rpc';
const UA = 'BMPlayer v1.8.0';

// ── Hashing ────────────────────────────────────────────────────

/** Read 64KB from head + 64KB from tail, sum as 64-bit LE, return hex + size. */
async function hashFile(file) {
  const HASH_SIZE = 64 * 1024;       // 64KiB from each end
  const size = file.size;
  if (size < HASH_SIZE * 2) return null;
  const headBuf = await file.slice(0, HASH_SIZE).arrayBuffer();
  const tailBuf = await file.slice(size - HASH_SIZE, size).arrayBuffer();
  return { hash: computeHash(headBuf, tailBuf, size), size };
}

function computeHash(head, tail, size) {
  // The OS hash algorithm sums uint64 LE chunks; we accumulate via BigInt.
  const u64 = (buf) => {
    const dv = new DataView(buf);
    let sum = 0n;
    for (let i = 0; i < buf.byteLength; i += 8) {
      // Read as two 32-bit halves to stay safe with Uint64 precision.
      const lo = BigInt(dv.getUint32(i, true));
      const hi = BigInt(dv.getUint32(i + 4, true));
      const v = (hi << 32n) | lo;
      sum = (sum + v) & 0xFFFFFFFFFFFFFFFFn;
    }
    return sum;
  };
  const SIZE_MOD = 0xFFFFFFFFFFFFFFFFn;
  let total = BigInt(size) & SIZE_MOD;
  total = (total + u64(head)) & SIZE_MOD;
  total = (total + u64(tail)) & SIZE_MOD;
  return total.toString(16).padStart(16, '0');
}

// ── XML-RPC helpers ─────────────────────────────────────────────

async function xmlRpcCall(method, params) {
  const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>
    ${params.map(p => `<param><value>${xmlValue(p)}</value></param>`).join('\n    ')}
  </params>
</methodCall>`;
  const res = await fetch(OPENSUBS_XMLRPC, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'text/xml' },
    body,
  });
  if (!res.ok) throw new Error('OpenSubtitles HTTP ' + res.status);
  const text = await res.text();
  return parseXmlRpcResponse(text);
}

function xmlValue(v) {
  if (v == null) return '<string></string>';
  if (typeof v === 'string') return `<string>${escapeXml(v)}</string>`;
  if (typeof v === 'number') return `<int>${v}</int>`;
  if (typeof v === 'boolean') return `<boolean>${v ? 1 : 0}</boolean>`;
  if (Array.isArray(v)) {
    return `<array><data>${v.map(x => `<value>${xmlValue(x)}</value>`).join('')}</data></array>`;
  }
  if (typeof v === 'object') {
    return `<struct>${Object.keys(v).map(k =>
      `<member><name>${escapeXml(k)}</name><value>${xmlValue(v[k])}</value></member>`).join('')}</struct>`;
  }
  return `<string>${escapeXml(String(v))}</string>`;
}
function escapeXml(s) {
  return s.replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
}

function parseXmlRpcResponse(text) {
  // Tiny XML-RPC parser — sufficient for OpenSubtitles' simple return shape.
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const err = doc.querySelector('struct > member > name:matches-case-insensitive\\(status\\), fault');
  // Just walk to the first <value><struct> ... and flatten to JS.
  const rootVal = doc.querySelector('methodResponse > params > param > value');
  if (!rootVal) {
    const fault = doc.querySelector('fault > value');
    if (fault) throw new Error('XML-RPC fault: ' + (fault.textContent || '').trim());
    return null;
  }
  return valueToJs(rootVal);
}

function valueToJs(valueEl) {
  const child = valueEl.firstElementChild;
  if (!child) return valueEl.textContent.trim();
  const tag = child.tagName.toLowerCase();
  if (tag === 'string') return child.textContent;
  if (tag === 'int' || tag === 'i4' || tag === 'i8') return parseInt(child.textContent, 10) || 0;
  if (tag === 'double') return parseFloat(child.textContent) || 0;
  if (tag === 'boolean') return child.textContent === '1';
  if (tag === 'array') {
    return [...child.querySelectorAll(':scope > data > value')].map(valueToJs);
  }
  if (tag === 'struct') {
    const obj = {};
    child.querySelectorAll(':scope > member').forEach(m => {
      const name = m.querySelector(':scope > name')?.textContent || '';
      const val = m.querySelector(':scope > value');
      obj[name] = val ? valueToJs(val) : null;
    });
    return obj;
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────

class SubtitleSearch {
  constructor({ mpvApi, osd }) {
    this._mpv = mpvApi;            // () => window.api.mpv
    this._osd = osd;
    this._token = null;
  }

  _api() { return typeof this._mpv === 'function' ? this._mpv() : this._mpv; }
  _show(msg, ms = 2200) { try { this._osd?.(msg, ms); } catch (_) {} }

  async _login() {
    if (this._token) return this._token;
    const r = await xmlRpcCall('LogIn', ['', '', 'en', 'BMPlayer v1.8.0']);
    this._token = r?.token || null;
    return this._token;
  }

  /**
   * Search for subtitles for the given File (renderer File object —
   * note: NOT a file path; we need to read bytes for hashing).
   * Returns an array of { id, lang, filename, downloadLink, rating, fromHash }.
   */
  async searchForFile(file, lang = 'eng') {
    if (!file) throw new Error('No file');
    this._show('Searching subtitles…', 1500);
    await this._login();
    const hashed = await hashFile(file);
    let results = [];
    if (hashed) {
      try {
        const r = await xmlRpcCall('SearchSubtitles', [
          this._token,
          [{ moviehash: hashed.hash, moviebytesize: hashed.size, sublanguageid: lang }],
          { limit: 50 },
        ]);
        results = (r?.data || []).map(s => ({
          id: s.IDSubtitleFile,
          lang: s.SubLanguageID,
          filename: s.MovieReleaseName || s.SubFileName,
          downloadLink: s.ZipDownloadLink,
          rating: parseFloat(s.SubRating) || 0,
          fromHash: true,
        }));
      } catch (_) { /* fall through to keyword search */ }
    }
    // Fallback: keyword search by filename
    if (!results.length) {
      const keyword = file.name.replace(/\.[^.]+$/, '');
      const r = await xmlRpcCall('SearchSubtitles', [
        this._token,
        [{ query: keyword, sublanguageid: lang }],
        { limit: 30 },
      ]);
      results = (r?.data || []).map(s => ({
        id: s.IDSubtitleFile,
        lang: s.SubLanguageID,
        filename: s.MovieReleaseName || s.SubFileName,
        downloadLink: s.ZipDownloadLink,
        rating: parseFloat(s.SubRating) || 0,
        fromHash: false,
      }));
    }
    return results;
  }
}

export default SubtitleSearch;
