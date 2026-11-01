'use strict';
/**
 * Files for the page (v3.47.0, from main.js): bmfile://, gallery
 * thumbnails, album art, song tags and folder scans.
 */
const { protocol, nativeImage } = require('electron');
const path = require('path'), fs = require('fs');
const { Readable } = require('stream');   // bmfile:// streams files from disk
const { cacheDir, cacheKey } = require('./caches');

// ── bmfile:// ────────────────────────────────────────────────────
// The renderer used to run with webSecurity:false so it could load local
// files directly. That disables the whole same-origin model for every
// window — a high price for what is really just "read files off disk".
//
// A custom scheme does the same job with the security model intact: the
// main process decides what gets served, and the renderer can be locked
// back down. This call has to happen before the app is ready, which is why
// main.js requires this file at its start.
protocol.registerSchemesAsPrivileged([{
  scheme: 'bmfile',
  privileges: {
    standard: true,          // parse as a normal hierarchical URL
    secure: true,            // treated as a trusted origin
    supportFetchAPI: true,   // pdf.js and the M3U loaders use fetch()
    stream: true,            // media elements need range/streaming
    bypassCSP: false,        // the CSP still applies; it lists bmfile: explicitly
    corsEnabled: true,
  },
}]);

/**
 * Serve one local file. The path arrives as a single percent-encoded
 * segment, so there is no drive-letter or separator parsing to get wrong.
 */
// The types bmfile:// states, by extension.
const BMFILE_TYPES = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.weba': 'audio/webm', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  // Scripts too: plugins load theirs through bmfile://, and a module script
  // served as octet-stream is refused (seen in the e2e suite, v3.28.0).
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.html': 'text/html', '.htm': 'text/html', '.txt': 'text/plain', '.wasm': 'application/wasm',
  '.vtt': 'text/vtt', '.srt': 'text/plain', '.ass': 'text/plain',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
async function serveBmFile(request) {
  try {
    const url = new URL(request.url);
    const raw = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!raw) return new Response('Bad request', { status: 400 });

    // Reject anything that isn't a plain existing file. Directory traversal
    // is not really meaningful here (the user can open any file they like
    // through the dialogs anyway), but serving a directory or a device node
    // is never intended.
    let st;
    try { st = fs.statSync(raw); } catch (_) { return new Response('Not found', { status: 404 }); }
    if (!st.isFile()) return new Response('Not a file', { status: 403 });

    // Byte ranges, served here (v3.28.0). This passed the request on to
    // net.fetch without its headers, so a media element's Range request got
    // the whole file back: MP3 coped (its length can be estimated), but a WAV
    // had no duration, and the music seek bar, which needs one, did nothing.
    // Streamed from disk either way, with the length and the type stated.
    const abs = path.resolve(raw), size = st.size;
    // Access-Control-Allow-Origin: the audio engine and the visualiser's
    // shadow load with crossOrigin, and an analyser is fed only zeros from a
    // response that does not allow it (v3.29.0). Only the app's own pages can
    // reach bmfile://.
    const head = { 'Content-Type': BMFILE_TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers?.get?.('range') || '');
    if (m && (m[1] || m[2])) {
      const start = m[1] ? +m[1] : Math.max(0, size - +m[2]);           // "bytes=-N": the last N
      const end = Math.min(size - 1, m[1] && m[2] ? +m[2] : size - 1);
      if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      return new Response(Readable.toWeb(fs.createReadStream(abs, { start, end })), {
        status: 206, headers: { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
    }
    return new Response(Readable.toWeb(fs.createReadStream(abs)), { status: 200, headers: { ...head, 'Content-Length': String(size) } });
  } catch (e) {
    console.error('[bmfile] failed to serve:', e);
    return new Response('Error', { status: 500 });
  }
}

function register(ipcMain) {
  // createThumbnailFromPath uses the OS thumbnailer — Windows and macOS only.
  // On Linux it throws, we return null, and the renderer falls back to the
  // original file. No crash, just no cache.
  ipcMain.handle('gallery:thumb', async (_, filePath, size) => {
    size = size || 400;
    try{
      if(!filePath || !fs.existsSync(filePath)) return null;
      const st = fs.statSync(filePath);
      // JPEG (v3.32.0): a photo thumbnail as PNG was slow to write and large to load.
      const out = path.join(cacheDir('thumbs'), cacheKey(filePath, st.size, st.mtimeMs, size) + '.jpg');
      if (fs.existsSync(out)) return out;
      const img = await nativeImage.createThumbnailFromPath(filePath, { width: size, height: size });
      if (!img || img.isEmpty()) return null;
      fs.writeFileSync(out, img.toJPEG(84));
      return out;
    }catch(_){ return null; }
  });

  // The album art for one file (v3.32.0): its own, embedded (read as the tags
  // are, kept in the same covers cache), or a cover image beside it: cover,
  // folder, front or album, as .jpg, .png or .webp. A path, or null.
  ipcMain.handle('media:art', async (_, fp) => {
    try{
      if (typeof fp !== 'string' || !fp || !fs.existsSync(fp)) return null;
      try{
        const md = await require('music-metadata').parseFile(fp, { duration: false, skipCovers: false });
        const pic = md.common && md.common.picture && md.common.picture[0];
        if (pic && pic.data) {
          const ext = (pic.format || 'image/jpeg').split('/').pop().replace('jpeg','jpg');
          const cp = path.join(cacheDir('covers'), cacheKey(fp, pic.data.length) + '.' + ext);
          if (!fs.existsSync(cp)) fs.writeFileSync(cp, pic.data);
          return cp;
        }
      }catch(_){}
      const dir = path.dirname(fp), hit = fs.readdirSync(dir).find(n => /^(cover|folder|front|album)\.(jpe?g|png|webp)$/i.test(n));
      return hit ? path.join(dir, hit) : null;
    }catch(_){ return null; }
  });

  // ── Audio tags ─────────────────────────────────────────────────
  // Track names came from filenames run through a regex. Real ID3/Vorbis/MP4
  // tags give title, artist, album, track number, duration and embedded art.
  ipcMain.handle('music:tags', async (_, filePaths) => {
    let mm;
    try { mm = require('music-metadata'); }
    catch(e){ console.warn('[main] music-metadata not installed — run npm install'); return []; }
    const list = Array.isArray(filePaths) ? filePaths.slice(0, 300) : [];
    const out = [];
    for (const fp of list) {
      try{
        const md = await mm.parseFile(fp, { duration: true, skipCovers: false });
        const c = md.common || {}, f = md.format || {};
        let cover = null;
        const pic = c.picture && c.picture[0];
        if (pic && pic.data) {
          const ext = (pic.format || 'image/jpeg').split('/').pop().replace('jpeg','jpg');
          const cp = path.join(cacheDir('covers'), cacheKey(fp, pic.data.length) + '.' + ext);
          if (!fs.existsSync(cp)) fs.writeFileSync(cp, Buffer.from(pic.data));
          cover = cp;
        }
        out.push({
          path: fp,
          title:  c.title  || null,
          artist: c.artist || c.albumartist || null,
          album:  c.album  || null,
          year:   c.year   || null,
          trackNo: (c.track && c.track.no) || null,
          duration: f.duration || null,
          bitrate:  f.bitrate ? Math.round(f.bitrate/1000) : null,
          cover
        });
      }catch(_){ out.push({ path: fp }); }
    }
    return out;
  });

  // RECURSIVE: the old scan was readdirSync on the top level only, so any music
  // library laid out as Artist/Album/*.flac came back empty. Depth + count are
  // capped so pointing this at C:\\ can't hang the renderer.
  ipcMain.handle('gallery:scan',async(_,folderPath)=>{
    if(!folderPath||!fs.existsSync(folderPath))return[];
    const ALL=new Set(['jpg','jpeg','png','webp','gif','bmp','tiff','avif','mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka','m4b']);
    const MAX_FILES=8000, MAX_DEPTH=6;
    const out=[];
    const walk=(dir,depth)=>{
      if(depth>MAX_DEPTH||out.length>=MAX_FILES)return;
      let entries;
      try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch(_){return;}
      for(const e of entries){
        if(out.length>=MAX_FILES)return;
        if(e.name.startsWith('.'))continue;
        const full=path.join(dir,e.name);
        if(e.isDirectory()){walk(full,depth+1);}
        else if(e.isFile()&&ALL.has(path.extname(e.name).slice(1).toLowerCase())){
          // size/mtime feed the new Size and Newest sort modes and the
          // lightbox info drawer. statSync per file is the cost of the scan
          // being useful; it's already bounded by MAX_FILES.
          let size=0, mtime=0;
          try{ const st=fs.statSync(full); size=st.size; mtime=st.mtimeMs; }catch(_){}
          out.push({path:full,name:e.name,dir,size,mtime});
        }
      }
    };
    walk(folderPath,0);
    return out;
  });
}

module.exports = { BMFILE_TYPES, serveBmFile, register };
