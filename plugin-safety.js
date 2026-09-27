/**
 * Safety rules for plugins, kept apart from main.js so each can be tested.
 *
 * Plugins are either themes (a CSS file) or scripts (JavaScript that runs in
 * the player with the same access as BM Player itself). So:
 *   - every file a manifest names must be inside that plugin's own folder,
 *     after following links; "../../elsewhere.js" used to load anything
 *   - manifests, names and theme keys are checked and length-limited
 *   - plugin folders, files and total sizes are capped
 *   - a script plugin's files are fingerprinted when the user approves it,
 *     and it is switched off again if they change afterwards
 *   - theme CSS cannot load anything: @import and url() other than data:
 *     are removed, so a theme cannot fetch from the internet
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LIMITS = {
  plugins: 60,              // plugin folders read per directory
  manifestBytes: 16 * 1024,
  cssBytes: 512 * 1024,
  scriptBytes: 1024 * 1024, // the entry file
  folderFiles: 60,          // files fingerprinted in one plugin
  folderBytes: 4 * 1024 * 1024,
};

/** A file inside dir, or null. Refuses absolute paths, "..", and links that lead outside. */
function safeChild(dir, rel, exts) {
  if (typeof rel !== 'string' || !rel || rel.length > 120) return null;
  if (path.isAbsolute(rel) || /^[a-z]:/i.test(rel) || rel.includes('\0')) return null;
  const parts = rel.split(/[\\/]+/);
  if (parts.some(p => p === '..' || p === '' || p.startsWith('.'))) return null;
  if (exts && !exts.includes(path.extname(rel).toLowerCase())) return null;
  const full = path.resolve(dir, rel);
  let realDir, realFull;
  try { realDir = fs.realpathSync(dir); realFull = fs.realpathSync(full); } catch { return null; }
  const r = path.relative(realDir, realFull);
  if (!r || r.startsWith('..') || path.isAbsolute(r)) return null;
  try { if (!fs.statSync(realFull).isFile()) return null; } catch { return null; }
  return realFull;
}

const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');

/** A checked, normalised manifest, or null. */
function checkManifest(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const name = text(m.name, 60);
  if (!name) return null;
  const out = {
    name,
    version: text(m.version, 20) || '0.0.0',
    description: text(m.description, 240),
    type: m.type === 'theme' ? 'theme' : 'functional',
  };
  if (out.type === 'theme') {
    if (typeof m.themeKey !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(m.themeKey)) return null;
    out.themeKey = m.themeKey;
    out.css = m.css;
    const icon = [...text(m.icon, 16)].slice(0, 2).join('');
    out.icon = icon || '🎨';
  } else {
    out.entry = m.entry;
  }
  return out;
}

/** A fingerprint of every file in a plugin folder, or null if it is too big to vouch for. */
function folderDigest(dir) {
  const files = [];
  const walk = (d, depth) => {
    if (depth > 4 || files.length > LIMITS.folderFiles) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) { files.push({ rel: path.relative(dir, p), link: true }); continue; }
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile()) files.push({ rel: path.relative(dir, p), p });
    }
  };
  try { walk(dir, 0); } catch { return null; }
  if (files.length > LIMITS.folderFiles) return null;
  const h = crypto.createHash('sha256');
  let total = 0;
  for (const f of files) {
    h.update(f.rel.replace(/\\/g, '/') + '\0');
    if (f.link) { h.update('link\0'); continue; }
    const buf = fs.readFileSync(f.p);
    total += buf.length;
    if (total > LIMITS.folderBytes) return null;
    h.update(buf); h.update('\0');
  }
  return h.digest('hex');
}

/** Theme CSS with every way to load something removed. */
function cleanCss(css) {
  let s = String(css || '').slice(0, LIMITS.cssBytes);
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');                                 // comments, so nothing hides in them
  s = s.replace(/@import[^;]*;?/gi, '/* @import removed */');
  s = s.replace(/url\(\s*(['"]?)(?!data:)[^)]*\1\s*\)/gi, 'none');          // url(...) unless data:
  s = s.replace(/image-set\([^)]*\)/gi, 'none');
  s = s.replace(/expression\s*\(|-moz-binding|behavior\s*:/gi, '/* removed */');
  return s;
}

/** Only web pages and email may be opened from inside the app. */
function safeExternalUrl(u) {
  if (typeof u !== 'string' || u.length > 2048) return null;
  let url;
  try { url = new URL(u); } catch { return null; }
  if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return null;
  if (url.protocol !== 'mailto:' && !url.hostname) return null;
  return url.href;
}

module.exports = { LIMITS, safeChild, checkManifest, folderDigest, cleanCss, safeExternalUrl };
