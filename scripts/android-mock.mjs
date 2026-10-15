/**
 * A stand-in for the Android app's LocalServer (android/java/.../LocalServer.java),
 * so the phone's page can be tried in a desktop browser: the page itself
 * (dist/android-build/assets/www, made by node android/build-apk.mjs --stage),
 * a library of songs and videos, the files in parts (HTTP ranges), album
 * art, video pictures, a lyrics file beside a song, and LRCLIB answered from
 * a few made-up records. Used by scripts/android-page.mjs.
 *
 *   node scripts/android-mock.mjs [--media DIR] [--big N] [--port P]
 *
 * DIR holds the test songs and videos (scripts/android-page.mjs makes
 * them); without it, a few tones are made here as WAV files. --big adds N
 * made-up songs (all playing one file) to try a long list.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', mp3: 'audio/mpeg', flac: 'audio/flac', m4a: 'audio/mp4', ogg: 'audio/ogg',
  opus: 'audio/ogg', wav: 'audio/x-wav', mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska' };

/** A WAV of a simple beat (bass pulse, a tone, a tick), for when there is no ffmpeg. */
export function beatWav (seconds, rate = 22050, pitch = 1) {
  const n = Math.floor(seconds * rate), data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  let seed = 7;
  for (let i = 0; i < n; i++) {
    const t = i / rate, b = t % 0.5;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = 0.55 * Math.sin(2 * Math.PI * 55 * pitch * t) * Math.exp(-8 * b) + 0.22 * Math.sin(2 * Math.PI * (220 + 110 * Math.floor((t * 2) % 4)) * pitch * t)
      + 0.15 * ((seed / 0x7fffffff) - 0.5) * Math.exp(-30 * ((t + 0.25) % 0.5));
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 26000))), 44 + i * 2);
  }
  return data;
}

/** The library: songs and videos as MediaLibrary.java gives them, and where each file is. */
export function makeLibrary (media, big = 0) {
  const files = new Map();
  const has = f => media && fs.existsSync(path.join(media, f));
  let songs;
  if (has('s1.mp3')) {
    // Where a file comes in more than one kind, the first there is (a desktop Chromium plays no AAC).
    const pick = (...names) => names.find(has) || names[0];
    songs = [
      { i: 101, t: 'Night Lights', a: 'The Test Band', al: 'City Sounds', ai: 11, d: 32000, n: 1, y: 2024, f: 's1.mp3' },
      { i: 102, t: 'Ocean Drive', a: 'The Test Band', al: 'City Sounds', ai: 11, d: 25000, n: 2, y: 2024, f: 's2.flac' },
      { i: 103, t: 'Slow Morning', a: 'Quiet Hours', al: 'Dawn', ai: 12, d: 40000, n: 1, y: 2021, f: pick('s3.m4a', 's3.ogg') },
      { i: 104, t: 'Fast Lane', a: 'Quiet Hours', al: 'Dawn', ai: 12, d: 24000, n: 2, y: 2021, f: 's4.ogg' },
      { i: 105, t: 'Opus Number', a: '', al: 'Music', ai: 13, d: 26000, n: 0, y: 0, f: 's5.opus' },
      { i: 106, t: 'Plain Tone', a: '', al: 'Music', ai: 13, d: 20000, n: 0, y: 0, f: 's6.wav' },
    ];
    if (has('s7.mp3')) songs.push({ i: 107, t: 'Tagged Words', a: 'The Test Band', al: 'City Sounds', ai: 11, d: 32000, n: 3, y: 2024, f: 's7.mp3' });
  } else {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-mock-'));
    songs = [1, 1.12, 0.9, 1.25].map((p, k) => {
      const f = `tone${k + 1}.wav`;
      fs.writeFileSync(path.join(dir, f), beatWav(24 + k * 2, 22050, p));
      return { i: 101 + k, t: ['Night Lights', 'Ocean Drive', 'Slow Morning', 'Fast Lane'][k], a: k < 2 ? 'The Test Band' : 'Quiet Hours', al: k < 2 ? 'City Sounds' : 'Dawn', ai: k < 2 ? 11 : 12, d: (24 + k * 2) * 1000, n: (k % 2) + 1, y: 2024, f, dir };
    });
  }
  // A voice note and a ringtone: not music, so hidden unless every audio file is shown.
  songs.push({ i: 190, t: 'PTT-20240101-WA0001', a: '', al: 'WhatsApp Voice Notes', ai: 19, d: 9000, n: 0, y: 0, f: songs[0].f, dir: songs[0].dir, folder: '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Voice Notes', mu: 1 });
  songs.push({ i: 191, t: 'Ringtone', a: '', al: 'Ringtones', ai: 20, d: 30000, n: 0, y: 0, f: songs[0].f, dir: songs[0].dir, folder: '/storage/emulated/0/Ringtones', mu: 0 });
  for (let k = 0; k < big; k++) {
    const src = songs[k % 4];
    songs.push({ i: 1000 + k, t: `Song ${String(k + 1).padStart(5, '0')} ${['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'][k % 5]}`, a: `Artist ${k % 97}`, al: `Album ${k % 503}`, ai: 2000 + (k % 503), d: 60000 + (k % 300) * 1000, n: (k % 12) + 1, y: 1990 + (k % 35), f: src.f, dir: src.dir });
  }
  const audio = songs.map(s => {
    const dir = s.dir || media;
    files.set('audio/' + s.i, path.join(dir, s.f));
    const folder = s.folder || '/storage/emulated/0/Music/' + (s.al || 'Music');
    const p = `${folder}/${s.f}`;
    return { i: s.i, t: s.t, a: s.a, al: s.al, ai: s.ai, d: s.d, n: s.n, y: s.y, da: 1700000000 + s.i, s: fs.existsSync(path.join(dir, s.f)) ? fs.statSync(path.join(dir, s.f)).size : 0,
      m: TYPES[s.f.split('.').pop()] || 'audio/*', p, fn: path.basename(p), mu: s.mu ?? 1, aa: '', g: '' };
  });
  const videos = [];
  // A desktop Chromium has no H.264: the WebM copy is played when there is one (phones play both).
  const v1 = has('v1.webm') ? 'v1.webm' : has('v1.mp4') ? 'v1.mp4' : null;
  if (v1) { videos.push({ i: 201, t: 'Test card', fn: v1, d: 20000, s: fs.statSync(path.join(media, v1)).size, w: 1280, h: 720, da: 1700000300, m: TYPES[v1.split('.').pop()], f: 'Camera', p: '/storage/emulated/0/DCIM/Camera/' + v1 }); files.set('video/201', path.join(media, v1)); }
  if (has('v2.webm')) { videos.push({ i: 202, t: 'Portrait clip', fn: 'v2.webm', d: 12000, s: fs.statSync(path.join(media, 'v2.webm')).size, w: 720, h: 1280, da: 1700000200, m: 'video/webm', f: 'Download', p: '/storage/emulated/0/Download/v2.webm' }); files.set('video/202', path.join(media, 'v2.webm')); }
  // v3.42.0: pictures (made by scripts/android-page.mjs: p1.jpg, p2.jpg, p3.jpg) in two albums
  const images = [];
  for (const [k, album] of [[1, 'Camera'], [2, 'Camera'], [3, 'Screenshots']]) {
    const f = `p${k}.jpg`;
    if (!has(f)) continue;
    images.push({ i: 300 + k, fn: f, s: fs.statSync(path.join(media, f)).size, w: 1280, h: 720, da: 1700000400 + k, dt: (1700000400 + k) * 1000, m: 'image/jpeg', b: album, p: `/storage/emulated/0/DCIM/${album}/${f}`, o: 0 });
    files.set('image/' + (300 + k), path.join(media, f));
  }
  // files "opened from another app": /opened/1 a PDF, /opened/2 a picture
  if (has('doc.pdf')) files.set('opened/1', path.join(media, 'doc.pdf'));
  if (has('p1.jpg')) files.set('opened/2', path.join(media, 'p1.jpg'));
  return { audio, videos, images, files };
}

const LRCLIB = [
  { id: 9001, trackName: 'Slow Morning', artistName: 'Quiet Hours', albumName: 'Dawn', duration: 40, instrumental: false, plainLyrics: 'Sun comes up slow\nCoffee on the stove',
    syncedLyrics: '[00:00.50]Sun comes up slow\n[00:03.00]Coffee on the stove\n[00:06.00]Nothing much to do\n[00:09.00]Just the morning and you' },
  { id: 9002, trackName: 'Slow Morning (Live)', artistName: 'Quiet Hours', albumName: 'Live', duration: 260, instrumental: false, plainLyrics: 'Live words', syncedLyrics: null },
];

export function startMock ({ www = path.join(ROOT, 'dist', 'android-build', 'assets', 'www'), media = null, big = 0, port = 0 } = {}) {
  const lib = makeLibrary(media, big);
  const hits = { lrclib: [], ranges: 0, art: 0 };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);
    const send = (code, type, body, extra = {}) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra }); res.end(body); };
    try {
      if (p === '/api/library/audio') return send(200, 'application/json', JSON.stringify(lib.audio));
      if (p === '/api/library/video') return send(200, 'application/json', JSON.stringify(lib.videos));
      if (p === '/api/library/image') return send(200, 'application/json', JSON.stringify(lib.images));
      let m;
      if ((m = /^\/media\/(audio|video|image)\/(\d+)$/.exec(p))) return range(req, res, lib.files.get(m[1] + '/' + m[2]), hits);
      if ((m = /^\/opened\/(\d+)$/.exec(p))) return range(req, res, lib.files.get('opened/' + m[1]), hits);
      if ((m = /^\/thumb\/image\/(\d+)$/.exec(p))) { const f = lib.files.get('image/' + m[1]); return f ? send(200, 'image/jpeg', fs.readFileSync(f)) : send(404, 'text/plain', 'No picture.'); }
      if ((m = /^\/art\/(album|audio)\/(\d+)$/.exec(p))) {
        hits.art++;
        const id = +m[2], song = m[1] === 'audio' ? lib.audio.find(s => s.i === id) : null;
        const album = m[1] === 'album' ? id : song?.ai;
        const f = media && (album === 11 || album === 12) ? path.join(media, `art${album}.jpg`) : null;
        if (f && fs.existsSync(f)) return send(200, 'image/jpeg', fs.readFileSync(f), { 'Cache-Control': 'max-age=86400' });
        return send(404, 'text/plain', 'No picture.');
      }
      if ((m = /^\/thumb\/video\/(\d+)$/.exec(p))) {
        const f = media && path.join(media, `th${+m[1] - 200}.jpg`);
        if (f && fs.existsSync(f)) return send(200, 'image/jpeg', fs.readFileSync(f));
        return send(404, 'text/plain', 'No picture.');
      }
      if ((m = /^\/api\/beside\/(audio|video)\/(\d+)$/.exec(p))) {
        if (m[1] === 'audio' && m[2] === '104') return send(200, 'application/json', JSON.stringify({ name: 'Fast Lane.lrc', text: '[00:00.20]Beside the song, in a file\n[00:02.00]Read by Java where Android allows\n[00:05.00]Fast lane, fast lane' }));
        if (m[1] === 'video' && m[2] === '201' && media && fs.existsSync(path.join(media, 'v1.srt'))) return send(200, 'application/json', JSON.stringify({ name: 'v1.srt', text: fs.readFileSync(path.join(media, 'v1.srt'), 'utf8') }));
        return send(404, 'text/plain', 'None.');
      }
      if (p.startsWith('/net/lrclib/')) {
        const q = u.searchParams; hits.lrclib.push(p + u.search);
        const api = p.slice('/net/lrclib'.length);
        if (api === '/api/get') return send(404, 'application/json', JSON.stringify({ code: 404, name: 'TrackNotFound' }));
        if (api === '/api/search') {
          const words = (q.get('q') || `${q.get('artist_name') || ''} ${q.get('track_name') || ''}`).toLowerCase();
          return send(200, 'application/json', JSON.stringify(LRCLIB.filter(r => words.split(/\s+/).filter(Boolean).some(w => (r.trackName + ' ' + r.artistName).toLowerCase().includes(w)))));
        }
        if ((m = /^\/api\/get\/(\d+)$/.exec(api))) { const r = LRCLIB.find(x => x.id === +m[1]); return r ? send(200, 'application/json', JSON.stringify(r)) : send(404, 'application/json', '{}'); }
        return send(404, 'application/json', '{}');
      }
      if (p.startsWith('/api/')) return send(404, 'text/plain', 'Not found.');
      // the page
      const f = path.join(www, p === '/' ? 'index.html' : p);
      if (!f.startsWith(www) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'text/plain', 'Not found: ' + p);
      return send(200, TYPES[f.split('.').pop()] || 'application/octet-stream', fs.readFileSync(f), { 'Cache-Control': 'no-cache' });
    } catch (e) { send(500, 'text/plain', String(e)); }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, lib, hits, close: () => new Promise(r => server.close(r)) })));
}

function range (req, res, file, hits) {
  if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const total = fs.statSync(file).size, type = TYPES[file.split('.').pop()] || 'application/octet-stream';
  const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
  if (!r) { res.writeHead(200, { ...head, 'Content-Length': total }); fs.createReadStream(file).pipe(res); return; }
  hits.ranges++;
  let from = r[1] === '' ? Math.max(0, total - +r[2]) : +r[1], to = r[1] === '' || r[2] === '' ? total - 1 : Math.min(+r[2], total - 1);
  if (from >= total) { res.writeHead(416, { ...head, 'Content-Range': `bytes */${total}` }); res.end(); return; }
  res.writeHead(206, { ...head, 'Content-Range': `bytes ${from}-${to}/${total}`, 'Content-Length': to - from + 1 });
  fs.createReadStream(file, { start: from, end: to }).pipe(res);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  startMock({ media: arg('--media'), big: +(arg('--big') || 0), port: +(arg('--port') || 8124) }).then(m => console.log(`BM Player's phone page: http://127.0.0.1:${m.port}/index.html`));
}
