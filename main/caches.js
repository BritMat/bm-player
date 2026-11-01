'use strict';
const { app } = require('electron');
const path = require('path'), fs = require('fs'), crypto = require('crypto');

// ── Thumbnail + cover art cache ──────────────────────────────────
// Pointing the gallery straight at originals meant a folder of 24MP JPEGs
// decoded full-resolution into renderer memory. Thumbnails are generated once
// and cached on disk, keyed by path+size+mtime so edits invalidate cleanly.
function cacheDir(sub){
  const d = path.join(app.getPath('userData'), sub);
  try { fs.mkdirSync(d, { recursive: true }); } catch(_) {}
  return d;
}
// The thumbnail and cover caches were never trimmed (v3.33.0): files unused
// for 90 days go, and each cache is kept under 300 MB, oldest first. Run once,
// half a minute after start, in the background.
function pruneCache(sub, maxBytes = 300 * 1024 * 1024, maxDays = 90){
  fs.promises.readdir(cacheDir(sub)).then(async names => {
    const dir = cacheDir(sub), cut = Date.now() - maxDays * 86400000, files = [];
    for (const n of names) {
      try { const st = await fs.promises.stat(path.join(dir, n)); if (st.isFile()) files.push({ p: path.join(dir, n), t: Math.max(st.atimeMs, st.mtimeMs), size: st.size }); } catch(_) {}
    }
    files.sort((a, b) => a.t - b.t);
    let total = files.reduce((s, f) => s + f.size, 0);
    for (const f of files) {
      if (f.t >= cut && total <= maxBytes) break;
      try { await fs.promises.unlink(f.p); total -= f.size; } catch(_) {}
    }
  }).catch(() => {});
}
function cacheKey(){
  return crypto.createHash('sha1').update([...arguments].join('|')).digest('hex');
}

// The thumbnail and cover caches are write-only — nothing ever removed an
// entry, so browsing a few large photo folders grew userData without limit.
// Trim oldest-first on startup, off the critical path.
function pruneCaches(){
  const LIMITS = { thumbs: 300 * 1024 * 1024, covers: 60 * 1024 * 1024 };
  for (const [name, limit] of Object.entries(LIMITS)) {
    try{
      const dir = path.join(app.getPath('userData'), name);
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).map(f => {
        const full = path.join(dir, f);
        try { const st = fs.statSync(full); return { full, size: st.size, atime: st.atimeMs }; }
        catch(_) { return null; }
      }).filter(Boolean);
      let total = files.reduce((n, f) => n + f.size, 0);
      if (total <= limit) continue;
      files.sort((a, b) => a.atime - b.atime);          // least recently used first
      for (const f of files) {
        if (total <= limit * 0.8) break;
        try { fs.unlinkSync(f.full); total -= f.size; } catch(_) {}
      }
      console.log('[main] pruned ' + name + ' cache to ' + Math.round(total / 1048576) + ' MB');
    }catch(e){ console.warn('[main] cache prune failed for ' + name + ':', e.message); }
  }
}

module.exports = { cacheDir, pruneCache, cacheKey, pruneCaches };
