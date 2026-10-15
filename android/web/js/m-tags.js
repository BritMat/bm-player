/**
 * m-tags: lyrics kept inside a song file, read in the page. The desktop
 * reads them with music-metadata in its main process; on the phone the
 * start of the file is fetched (a range request to LocalServer) and the tag
 * read here:
 *
 *   MP3   ID3v2 (2.2, 2.3, 2.4): USLT, the words; SYLT, timed words (in
 *         milliseconds), made into LRC; TXXX named LYRICS or the like.
 *   FLAC  Vorbis comments: LYRICS, UNSYNCEDLYRICS, SYNCEDLYRICS.
 *   Ogg   the same comments, in a Vorbis or Opus stream (v3.42.0).
 *   M4A   the lyrics atom (moov, udta, meta, ilst, ©lyr), wherever moov
 *         is in the file, before or after the sound (v3.42.0).
 *
 * Answers the text, or null.
 */
const MAX_TAG = 8 * 1024 * 1024;

async function range (url, from, to) {
  try {
    const r = await fetch(url, { headers: { Range: `bytes=${from}-${to}` } });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    return r.status === 206 ? b : b.subarray(from, to + 1);
  } catch (_) { return null; }
}

export async function tagLyrics (url) {
  const head = await range(url, 0, 65535);
  if (!head || head.length < 10) return null;
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {            // "ID3"
    const size = 10 + syncsafe(head, 6) + (head[5] & 0x10 ? 10 : 0);
    if (size > MAX_TAG) return null;
    const tag = size <= head.length ? head.subarray(0, size) : await range(url, 0, size - 1);
    return tag ? id3(tag) : null;
  }
  if (head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) return flac(url, head);   // "fLaC"
  if (head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) return ogg(url, head);    // "OggS"
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return m4a(url, head);    // "ftyp"
  return null;
}

/**
 * Ogg: the comments are the stream's second packet, which may run over
 * several pages (a cover picture in the comments makes it long). Pages are
 * read in order and that packet put together, then read as FLAC's are.
 */
async function ogg (url, head) {
  let buf = head, base = 0, o = 0, packet = 0, parts = [], total = 0;
  for (let pages = 0; pages < 400; pages++) {
    if (o + 27 > base + buf.length) { buf = await range(url, o, o + 65535); base = o; if (!buf || buf.length < 27) return null; }
    let h = o - base;
    if (buf[h] !== 0x4f || buf[h + 1] !== 0x67 || buf[h + 2] !== 0x67 || buf[h + 3] !== 0x53) return null;
    const nseg = buf[h + 26];
    if (h + 27 + nseg > buf.length) { buf = await range(url, o, o + 65535 + 255 * 255); base = o; h = 0; if (!buf || buf.length < 27 + nseg) return null; }
    const segs = buf.subarray(h + 27, h + 27 + nseg);
    let at = o + 27 + nseg;
    const size = segs.reduce((a, b) => a + b, 0);
    if (at + size > base + buf.length) { buf = await range(url, o, at + size - 1); base = o; if (!buf || buf.length < at + size - o) return null; }
    for (let i = 0; i < nseg; i++) {
      if (packet === 1) { parts.push(buf.subarray(at - base, at - base + segs[i])); total += segs[i]; if (total > MAX_TAG) return null; }
      at += segs[i];
      if (segs[i] < 255) {                                            // a packet ends here
        if (packet === 1) {
          const b = new Uint8Array(total); let k = 0;
          for (const p of parts) { b.set(p, k); k += p.length; }
          const skip = b[0] === 3 && b[1] === 0x76 ? 7 : b[0] === 0x4f && b[1] === 0x70 ? 8 : -1;   // "\x03vorbis" or "OpusTags"
          return skip < 0 ? null : vorbis(b.subarray(skip));
        }
        packet++;
      }
    }
    o = at;
  }
  return null;
}

/** M4A: the atoms, top to bottom, to moov (which may come after the sound), then down to the lyrics. */
async function m4a (url, head) {
  let o = 0;
  for (let n = 0; n < 64; n++) {
    const h = o + 16 <= head.length ? head.subarray(o, o + 16) : await range(url, o, o + 15);
    if (!h || h.length < 8) return null;
    let size = u32(h, 0);
    const type = String.fromCharCode(h[4], h[5], h[6], h[7]);
    if (size === 1 && h.length >= 16) size = u32(h, 8) * 4294967296 + u32(h, 12);
    if (size < 8) return null;
    if (type === 'moov') {
      if (size > MAX_TAG) return null;
      const moov = o + size <= head.length ? head.subarray(o, o + size) : await range(url, o, o + size - 1);
      return moov ? lyrAtom(moov) : null;
    }
    o += size;
  }
  return null;
}

function lyrAtom (moov) {
  const child = (b, from, to, want) => {
    for (let o = from; o + 8 <= to;) {
      const size = u32(b, o), type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
      if (size < 8 || o + size > to) return null;
      if (type === want) return [o + 8, o + size];
      o += size;
    }
    return null;
  };
  const udta = child(moov, 8, moov.length, 'udta'); if (!udta) return null;
  const meta = child(moov, udta[0], udta[1], 'meta'); if (!meta) return null;
  const ilst = child(moov, meta[0] + 4, meta[1], 'ilst'); if (!ilst) return null;     // meta has 4 bytes of version and flags first
  const lyr = child(moov, ilst[0], ilst[1], '\u00a9lyr'); if (!lyr) return null;
  const data = child(moov, lyr[0], lyr[1], 'data'); if (!data) return null;
  return clean(new TextDecoder('utf-8').decode(moov.subarray(data[0] + 8, data[1]))) || null;   // type and locale, then the text
}

const syncsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const u32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const le32 = (b, o) => b[o] + (b[o + 1] << 8) + (b[o + 2] << 16) + ((b[o + 3] << 24) >>> 0);

/** Undoes ID3's "unsynchronisation": every FF 00 was written for FF. */
function unsync (b) {
  const out = new Uint8Array(b.length); let n = 0;
  for (let i = 0; i < b.length; i++) { out[n++] = b[i]; if (b[i] === 0xff && b[i + 1] === 0x00) i++; }
  return out.subarray(0, n);
}

function decode (b, enc) {
  try {
    if (enc === 1) {                                                     // UTF-16 with a byte order mark
      if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
      if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
      return new TextDecoder('utf-16le').decode(b);
    }
    if (enc === 2) return new TextDecoder('utf-16be').decode(b);
    if (enc === 3) return new TextDecoder('utf-8').decode(b);
    return new TextDecoder('windows-1252').decode(b);
  } catch (_) { return ''; }
}

/** Where the text that starts at o ends (its terminator), for an encoding. */
function stringEnd (b, o, enc) {
  if (enc === 1 || enc === 2) { for (let i = o; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i; return b.length; }
  for (let i = o; i < b.length; i++) if (b[i] === 0) return i; return b.length;
}
const termLen = enc => (enc === 1 || enc === 2 ? 2 : 1);
const clean = s => String(s || '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();

function id3 (tag) {
  const ver = tag[3], flags = tag[5];
  let body = tag.subarray(10);
  if (ver < 4 && (flags & 0x80)) body = unsync(body);
  let o = 0;
  if (flags & 0x40) o = ver === 4 ? syncsafe(body, 0) : u32(body, 0) + 4;   // an extended header
  const idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
  let plain = '', timed = '';
  while (o + hdr <= body.length) {
    const id = String.fromCharCode(...body.subarray(o, o + idLen));
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;                            // padding
    const size = ver === 2 ? (body[o + 3] << 16) + (body[o + 4] << 8) + body[o + 5] : ver === 4 ? syncsafe(body, o + 4) : u32(body, o + 4);
    const fflags = ver === 2 ? 0 : body[o + 9];
    let f = body.subarray(o + hdr, o + hdr + size);
    o += hdr + size;
    if (size <= 0) continue;
    if (ver === 4 && (fflags & 0x02)) f = unsync(f);
    if (ver === 4 && (fflags & 0x01)) f = f.subarray(4);               // a data length indicator first
    if (fflags & 0x0c) continue;                                       // compressed or encrypted: not read
    if ((id === 'USLT' || id === 'ULT') && !plain) {
      const enc = f[0], d = stringEnd(f, 4, enc);
      plain = clean(decode(f.subarray(d + termLen(enc)), enc));
    } else if ((id === 'SYLT' || id === 'SLT') && !timed) {
      timed = sylt(f);
    } else if ((id === 'TXXX' || id === 'TXX') && !plain) {
      const enc = f[0], d = stringEnd(f, 1, enc), desc = clean(decode(f.subarray(1, d), enc));
      // Taggers name it differently: LYRICS, UNSYNCEDLYRICS, lyrics-eng, and ffmpeg writes USLT.
      if (/^(uslt|(un)?synced ?lyrics|lyrics)([-_ ]?[a-z]{2,3})?$/i.test(desc)) plain = clean(decode(f.subarray(d + termLen(enc)), enc));
    }
  }
  return timed || plain || null;
}

/** ID3's timed words (SYLT) in milliseconds, as LRC. */
function sylt (f) {
  const enc = f[0], format = f[4];
  if (format !== 2) return '';                                         // MPEG frames: not used in practice
  let o = stringEnd(f, 6, enc) + termLen(enc);                         // after the description
  const lines = [];
  while (o < f.length - 4) {
    const e = stringEnd(f, o, enc);
    const text = clean(decode(f.subarray(o, e), enc));
    o = e + termLen(enc);
    if (o + 4 > f.length) break;
    const ms = u32(f, o); o += 4;
    lines.push({ ms, text });
  }
  if (lines.length < 2) return '';
  const pad = n => String(n).padStart(2, '0');
  return lines.map(l => `[${pad(Math.floor(l.ms / 60000))}:${pad(Math.floor(l.ms / 1000) % 60)}.${pad(Math.floor(l.ms / 10) % 100)}]${l.text.replace(/\n/g, ' ')}`).join('\n');
}

async function flac (url, head) {
  let buf = head, base = 0, o = 4;
  for (let n = 0; n < 64; n++) {
    if (o + 4 > base + buf.length) { buf = await range(url, o, o + 65535); base = o; if (!buf || buf.length < 4) return null; }
    const h = o - base, last = buf[h] & 0x80, type = buf[h] & 0x7f, len = (buf[h + 1] << 16) + (buf[h + 2] << 8) + buf[h + 3];
    if (type === 4) {
      let b = o + 4 + len <= base + buf.length ? buf.subarray(h + 4, h + 4 + len) : await range(url, o + 4, o + 4 + len - 1);
      return b ? vorbis(b) : null;
    }
    if (last) return null;
    o += 4 + len;
  }
  return null;
}

function vorbis (b) {
  const td = new TextDecoder('utf-8');
  let o = 4 + le32(b, 0);
  const count = le32(b, o); o += 4;
  const found = {};
  for (let i = 0; i < count && o + 4 <= b.length; i++) {
    const len = le32(b, o); o += 4;
    const s = td.decode(b.subarray(o, o + len)); o += len;
    const eq = s.indexOf('='); if (eq < 0) continue;
    const k = s.slice(0, eq).toUpperCase();
    if (['LYRICS', 'UNSYNCEDLYRICS', 'UNSYNCED LYRICS', 'SYNCEDLYRICS'].includes(k) && !found[k]) found[k] = clean(s.slice(eq + 1));
  }
  return found.SYNCEDLYRICS || found.LYRICS || found.UNSYNCEDLYRICS || found['UNSYNCED LYRICS'] || null;
}
