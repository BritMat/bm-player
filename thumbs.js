'use strict';
/**
 * Seek bar previews (v3.46.0): a small picture of a film at the place the
 * pointer is over on the seek bar, as KMPlayer and VLC show.
 *
 * A second mpv makes each one: it opens the file at that time, writes one
 * frame as a JPEG 256 pixels wide and quits. About 150 ms a picture for a
 * 1080p film on a laptop, with the nearest keyframe rather than the exact
 * frame, which is what keeps it quick. One is made at a time: while one is
 * made only the newest asked for waits, as the pointer moves on faster than
 * pictures can be made, and the ones passed over are answered with null.
 * The last 120 are kept in memory.
 *
 *   const { thumbAt } = makeThumbs({ getMpv });
 *   await thumbAt('C:\\Films\\A Film.mkv', 754)   // 'data:image/jpeg;base64,...' or null
 */
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');

function makeThumbs({ getMpv, width = 256, keep = 120, timeoutMs = 6000, spawnFn = spawn } = {}) {
  const cache = new Map();
  let running = null, waiting = null;
  const remember = (k, v) => { cache.delete(k); cache.set(k, v); while (cache.size > keep) cache.delete(cache.keys().next().value); };

  /** One picture: mpv started, waited for, and its JPEG read. */
  function make(file, t) {
    const exe = getMpv && getMpv();
    if (!exe) return Promise.resolve(null);
    let dir;
    try { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-thumb-')); } catch (_) { return Promise.resolve(null); }
    return new Promise(resolve => {
      let done = false, timer = null, p = null;
      const finish = () => {
        if (done) return; done = true; clearTimeout(timer);
        let url = null;
        try {
          const f = fs.readdirSync(dir).find(n => /\.jpe?g$/i.test(n));
          if (f) { const b = fs.readFileSync(path.join(dir, f)); if (b.length) url = 'data:image/jpeg;base64,' + b.toString('base64'); }
        } catch (_) {}
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
        resolve(url);
      };
      try {
        p = spawnFn(exe, [
          '--no-config', '--really-quiet', '--terminal=no', '--msg-level=all=no',
          '--ao=null', '--aid=no', '--sid=no', '--osd-level=0', '--hwdec=no',
          '--vo=image', '--vo-image-format=jpg', '--vo-image-jpeg-quality=75', `--vo-image-outdir=${dir}`,
          `--start=${t.toFixed(2)}`, '--hr-seek=no', '--frames=1', `--vf=scale=${width}:-2`,
          '--', file,
        ], { stdio: 'ignore', windowsHide: true });
      } catch (_) { finish(); return; }
      timer = setTimeout(() => { try { p.kill(); } catch (_) {} }, timeoutMs);
      p.on('error', finish);
      p.on('exit', finish);
    });
  }

  function pump() {
    if (running || !waiting) return;
    const job = running = waiting; waiting = null;
    make(job.file, job.t)
      .then(url => { if (url) remember(job.key, url); job.resolve(url); }, () => job.resolve(null))
      .then(() => { running = null; pump(); });
  }

  /** A picture of `file` at `t` seconds: a data: URL, or null. */
  function thumbAt(file, t) {
    t = Number(t);
    // Files on this computer only: a stream would be fetched all over again.
    if (typeof file !== 'string' || !file || /^[a-z][a-z0-9+.-]*:\/\//i.test(file) || !Number.isFinite(t) || t < 0) return Promise.resolve(null);
    try { if (!fs.statSync(file).isFile()) return Promise.resolve(null); } catch (_) { return Promise.resolve(null); }
    const key = file + '\n' + Math.round(t);
    if (cache.has(key)) { const v = cache.get(key); remember(key, v); return Promise.resolve(v); }
    if (running && running.key === key) return new Promise(r => { const prev = running.resolve; running.resolve = u => { prev(u); r(u); }; });
    return new Promise(resolve => {
      if (waiting) waiting.resolve(null);       // the pointer has moved on
      waiting = { file, t, key, resolve };
      pump();
    });
  }

  return { thumbAt, _cache: cache };
}

module.exports = { makeThumbs };
