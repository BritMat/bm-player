/**
 * BM Player — M3U Playlist Import/Export (v1.7.0)
 *
 * Reads / writes the de-facto standard .m3u / .m3u8 playlist format.
 * Strictly renderer-side: file IO is delegated to the main process
 * via the existing dialog + pdfFile.write IPC channels (we reuse
 * savePDF's writer since it accepts arbitrary binary buffers).
 *
 * Format supported:
 *   #EXTM3U header
 *   #EXTINF:<duration>,<title>
 *   <absolute-or-relative-path>
 *
 * Comment lines (#...), blank lines, and missing EXTINF entries are
 * tolerated on import. On export we always emit absolute paths so
 * the playlist is portable when moved next to the media.
 */

import { fileURL } from '../util.js';

const M3U_EXT = ['m3u', 'm3u8'];

function isM3uPath(p) {
  const ext = (p || '').split('.').pop().toLowerCase();
  return M3U_EXT.includes(ext);
}

/** Parse an M3U string. Returns an array of { path, title, duration }. */
export function parseM3u(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out = [];
  let pending = null; // {title?, duration?}
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      // #EXTINF:<duration>,<title>
      const rest = line.slice(8);
      const comma = rest.indexOf(',');
      let duration = -1, title = '';
      if (comma === -1) {
        const d = parseInt(rest, 10);
        if (!isNaN(d)) duration = d;
      } else {
        const d = parseInt(rest.slice(0, comma), 10);
        if (!isNaN(d)) duration = d;
        title = rest.slice(comma + 1).trim();
      }
      pending = { title, duration };
    } else if (line.startsWith('#')) {
      // ignore other directives (#EXTGRP, #EXTVLCOPT, etc.)
      continue;
    } else {
      out.push({
        path: line,
        title: pending?.title || '',
        duration: pending?.duration ?? -1,
      });
      pending = null;
    }
  }
  return out;
}

/** Serialize a list of { path, title?, duration? } into M3U text. */
export function serializeM3u(items) {
  const lines = ['#EXTM3U'];
  for (const it of items || []) {
    if (!it?.path) continue;
    const title = it.title || '';
    const dur = (it.duration != null && it.duration >= 0) ? it.duration : -1;
    lines.push(`#EXTINF:${dur},${title}`);
    lines.push(it.path);
  }
  return lines.join('\n') + '\n';
}

/**
 * Convenience: read a .m3u file (via fetch on file:// URL — Electron allows
 * this since the renderer has webSecurity:false for file://), parse it,
 * return the path list.
 */
export async function readM3uFile(filePath) {
  const url = fileURL(filePath);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to read playlist: ' + res.status);
  const text = await res.text();
  return parseM3u(text);
}

/**
 * Convenience: write an .m3u file via the existing pdfFile.write IPC.
 * Encodes the text as UTF-8 bytes.
 */
export async function writeM3uFile(filePath, items, api) {
  const text = serializeM3u(items);
  const bytes = new TextEncoder().encode(text);
  if (!api?.pdfFile?.write) throw new Error('File writer unavailable');
  const result = await api.pdfFile.write(filePath, bytes);
  if (result?.error) throw new Error(result.error);
  return true;
}

export { M3U_EXT, isM3uPath };
