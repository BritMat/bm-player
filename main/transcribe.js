'use strict';
/**
 * Subtitles from the audio (v3.59.0, the plan's 3.57): a film's speech
 * written out as subtitles on this computer, by whisper.cpp (MIT,
 * github.com/ggml-org/whisper.cpp). Nothing is sent anywhere.
 *
 *   whisper.cpp  fetched the first time it is wanted, from its own GitHub
 *                releases (Windows, Linux: the nightly build a numbered
 *                release names, see findAsset); on the Mac, Homebrew's
 *                (brew install whisper-cpp), or one found on the PATH
 *   a model      tiny (75 MB), base (142 MB) or small (466 MB), fetched the
 *                first time from Hugging Face, where whisper.cpp keeps them,
 *                checked against the SHA-1 sums whisper.cpp gives, and kept
 *
 * How it goes: the film's sound is taken in pieces of 30 seconds by mpv
 * (the app's own, writing 16 kHz mono to a file, faster than it plays),
 * from where the film is, each piece written out by whisper.cpp, its times
 * moved to where the piece starts, and added to a .srt that mpv shows as a
 * subtitle track ("From the audio") and reads again as it grows. It keeps
 * about a minute and a half ahead of the film; a seek past what is written
 * starts it from there. What is written is kept for the film, so watching
 * again is at once. A translation into English is whisper's own (-tr).
 *
 * Live TV (a stream with no end): mpv takes eight seconds of it at a time,
 * as it comes, and each piece's words are shown over the picture when they
 * are ready, a few seconds after they were said.
 *
 *   transcribe:start ({ file, aid, at, lang, translate, model, live })
 *   transcribe:at (seconds)        where the film is now
 *   transcribe:stop
 *   transcribe:status              what is here: the tool and the models
 *   events  transcribe:progress { what, got, total }   while fetching
 *           transcribe:update { srt, upTo, speed }     a piece added
 *           transcribe:live { text }                    live, a piece's words
 *           transcribe:error { error }
 */
const { app, net: electronNet } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const MODELS = {
  tiny: { file: 'ggml-tiny.bin', sha1: 'bd577a113a864445d4c299885e0cb97d4ba92b5f', mb: 75 },
  base: { file: 'ggml-base.bin', sha1: '465707469ff3a37a2b9b8d8f89f2f99de7299dac', mb: 142 },
  small: { file: 'ggml-small.bin', sha1: '55356645c2b361a969dfd0ef2c5a50d530afd8d5', mb: 466 },
};
const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
const RELEASES = 'https://api.github.com/repos/ggml-org/whisper.cpp/releases';
const PIECE = 30, AHEAD = 90, LIVE_PIECE = 8;
const EXE = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';

/** The release's file for this computer, or null (the Mac has none: Homebrew's is used). */
function assetName (platform = process.platform, arch = process.arch) {
  if (platform === 'win32' && arch === 'x64') return 'whisper-bin-x64.zip';
  if (platform === 'linux' && arch === 'x64') return 'whisper-bin-ubuntu-x64.tar.gz';
  if (platform === 'linux' && arch === 'arm64') return 'whisper-bin-ubuntu-arm64.tar.gz';
  return null;
}

/**
 * The release that has this computer's file, and the file. Since v1.9.3
 * whisper.cpp's numbered releases carry no programs: those are on the
 * nightly build (a b* tag) that each release names in its notes ("Nightly
 * build: [b4938](...)"). So: the latest release if it has the file, then the
 * nightly it names, then the newest release of any kind that has it.
 * getJson(url) gives the parsed answer of GitHub's API, or null.
 */
async function findAsset (name, getJson) {
  const has = r => r && !r.draft && (r.assets || []).find(a => a.name === name);
  const latest = await getJson(RELEASES + '/latest');
  let a = has(latest); if (a) return { rel: latest, asset: a };
  const nightly = /Nightly build:\W*\[?(b\d+)\]?/i.exec((latest && latest.body) || '');
  if (nightly) { const r = await getJson(RELEASES + '/tags/' + nightly[1]); a = has(r); if (a) return { rel: r, asset: a }; }
  const list = await getJson(RELEASES + '?per_page=30');
  for (const r of Array.isArray(list) ? list : []) { a = has(r); if (a) return { rel: r, asset: a }; }
  return { rel: latest, asset: null };
}

// ── subtitles: read, moved, added up, written ───────────────────────
const t2s = t => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : NaN; };
const s2t = s => { const ms = Math.max(0, Math.round(s * 1000)), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, x = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
/** A .srt as [{ a, b, text }], seconds. Silence and sounds whisper marks in brackets left out. */
function parseSrt (text) {
  const out = [];
  for (const block of String(text || '').replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter(Boolean);
    const i = lines.findIndex(l => l.includes('-->')); if (i < 0) continue;
    const [a, b] = lines[i].split('-->').map(t2s);
    const words = lines.slice(i + 1).join('\n').trim();
    if (!words || /^[[(][^\])]*[\])]$/.test(words) || !(b > a)) continue;
    out.push({ a, b, text: words });
  }
  return out;
}
/** A piece's lines moved to where it starts, after what is written already. */
function addPiece (cues, piece, start, end) {
  const kept = cues.filter(c => c.b <= start + 0.05 || c.a >= end);
  for (const c of piece) { const a = c.a + start, b = Math.min(c.b + start, end); if (b > a) kept.push({ a, b, text: c.text }); }
  return kept.sort((x, y) => x.a - y.a);
}
function writeSrt (cues) { return cues.map((c, i) => `${i + 1}\n${s2t(c.a)} --> ${s2t(c.b)}\n${c.text}\n`).join('\n'); }
/** Where the next piece starts: the first second from the film's place not written yet, or null when far enough ahead. */
function nextPiece (done, at, duration) {
  let t = Math.max(0, Math.floor(at) - 2);
  const covered = s => done.some(([a, b]) => s >= a && s < b);
  while (covered(t)) t = done.find(([a, b]) => t >= a && t < b)[1];
  if (duration > 0 && t >= duration - 0.5) return null;
  if (t > at + AHEAD) return null;
  return t;
}
/** Pieces done, joined where they touch. */
function addRange (done, a, b) {
  const all = [...done, [a, b]].sort((x, y) => x[0] - y[0]), out = [];
  for (const r of all) { const l = out[out.length - 1]; if (l && r[0] <= l[1] + 0.01) l[1] = Math.max(l[1], r[1]); else out.push(r.slice()); }
  return out;
}

// ── fetching, with progress ─────────────────────────────────────────
async function fetchTo (url, file, { ua, progress, headers = {} } = {}) {
  const r = await electronNet.fetch(url, { headers: { 'User-Agent': ua, ...headers } });
  if (!r.ok) throw new Error(`${url.split('/').pop()}: the server answered ${r.status}`);
  const total = +r.headers.get('content-length') || 0, part = file + '.part';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const out = fs.createWriteStream(part), reader = r.body.getReader();
  let got = 0, last = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise(z => out.once('drain', z));
      if (Date.now() - last > 300) { last = Date.now(); progress?.(got, total); }
    }
  } finally { await new Promise(z => out.end(z)); }
  progress?.(got, total);
  fs.renameSync(part, file);
  return file;
}
const hashFile = (file, algo) => new Promise((ok, no) => { const h = crypto.createHash(algo); fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', no); });

function makeService ({ userData, mpvBin, send, ua, env = process.env } = {}) {
  const dir = path.join(userData, 'whisper'), bins = path.join(dir, 'bin'), models = path.join(dir, 'models'), subs = path.join(dir, 'subs');
  const say = (ev, d) => { try { send(ev, d); } catch (_) {} };

  function findIn (root) {
    let found = null;
    const walk = (d, depth) => { if (found || depth > 4) return; let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; } for (const e of es) { const p = path.join(d, e.name); if (e.isFile() && e.name === EXE) { found = p; return; } if (e.isDirectory()) walk(p, depth + 1); } };
    walk(root, 0); return found;
  }
  function onPath () {
    const extra = process.platform === 'darwin' ? ['/opt/homebrew/bin', '/usr/local/bin'] : [];
    for (const d of [...String(env.PATH || '').split(path.delimiter), ...extra]) { const p = path.join(d, EXE); try { if (d && fs.statSync(p).isFile()) return p; } catch (_) {} }
    return null;
  }
  /** whisper-cli: the one set for tests, the one fetched, or one on the PATH. */
  function cliNow () { return env.BM_WHISPER_CLI || findIn(bins) || onPath(); }
  async function ensureCli () {
    const have = cliNow(); if (have) return have;
    const name = assetName();
    if (!name) throw new Error(process.platform === 'darwin' ? 'whisper.cpp is needed: install it with Homebrew (brew install whisper-cpp), then try again' : 'whisper.cpp has no ready-made version for this computer; install it so whisper-cli is on the PATH');
    const getJson = async url => { const r = await electronNet.fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/vnd.github+json' } }); return r.ok ? r.json() : null; };
    const { rel, asset } = await findAsset(name, getJson);
    if (!asset) throw new Error(`no whisper.cpp release has ${name} (the latest is ${(rel && rel.tag_name) || 'not known'})`);
    const file = path.join(dir, name);
    await fetchTo(asset.browser_download_url, file, { ua, progress: (got, total) => say('transcribe:progress', { what: 'whisper.cpp', got, total: total || asset.size }) });
    // GitHub gives each release file's SHA-256 now; checked where it does
    const want = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || '');
    if (want && (await hashFile(file, 'sha256')) !== want[1].toLowerCase()) { fs.rmSync(file, { force: true }); throw new Error('the whisper.cpp download did not match its checksum, so it was not kept'); }
    fs.rmSync(bins, { recursive: true, force: true }); fs.mkdirSync(bins, { recursive: true });
    // tar reads a .zip too, on Windows 10 and later as on Linux
    execFileSync('tar', ['-xf', file, '-C', bins], { windowsHide: true, timeout: 120000 });
    fs.rmSync(file, { force: true });
    const exe = findIn(bins);
    if (!exe) throw new Error('whisper-cli was not in what was fetched');
    try { fs.chmodSync(exe, 0o755); } catch (_) {}
    fs.writeFileSync(path.join(bins, 'from.json'), JSON.stringify({ tag: rel.tag_name, asset: name, at: new Date().toISOString() }));
    return exe;
  }
  const modelFile = m => env.BM_WHISPER_MODEL || path.join(models, MODELS[m].file);
  async function ensureModel (m) {
    if (!MODELS[m]) m = 'base';
    const f = modelFile(m);
    if (env.BM_WHISPER_MODEL || fs.existsSync(f + '.checked')) return f;
    await fetchTo(HF + MODELS[m].file, f, { ua, progress: (got, total) => say('transcribe:progress', { what: 'the ' + m + ' model', got, total: total || MODELS[m].mb * 1048576 }) });
    if ((await hashFile(f, 'sha1')) !== MODELS[m].sha1) { fs.rmSync(f, { force: true }); throw new Error('the ' + m + ' model did not match its checksum, so it was not kept'); }
    fs.writeFileSync(f + '.checked', MODELS[m].sha1);
    return f;
  }
  function status () {
    const have = {}; for (const m of Object.keys(MODELS)) have[m] = !!env.BM_WHISPER_MODEL || fs.existsSync(modelFile(m) + '.checked');
    return { cli: !!cliNow(), canFetch: !!assetName(), models: Object.fromEntries(Object.entries(MODELS).map(([k, v]) => [k, { mb: v.mb, here: have[k] }])) };
  }

  const run = (exe, args, timeout) => new Promise((ok, no) => {
    const p = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', d => { err = (err + d).slice(-2000); });
    const t = setTimeout(() => { try { p.kill(); } catch (_) {} }, timeout);
    job && (job.proc = p);
    p.on('error', e => { clearTimeout(t); no(e); });
    p.on('exit', code => { clearTimeout(t); if (job) job.proc = null; code === 0 ? ok() : no(new Error((path.basename(exe) + ' stopped (' + code + ') ' + err.split('\n').filter(Boolean).pop()).trim())); });
  });
  /** mpv writes a piece of the sound, 16 kHz mono, to a file. */
  function cut (j, start, length, wav) {
    const a = ['--no-config', '--vo=null', '--video=no', '--sub=no', '--ao=pcm', '--ao-pcm-file=' + wav, '--ao-pcm-waveheader=yes',
      '--audio-format=s16', '--audio-samplerate=16000', '--audio-channels=mono', '--length=' + length, '--really-quiet'];
    if (!j.live) a.push('--start=' + start);
    if (j.aid) a.push('--aid=' + j.aid);
    return run(mpvBin(), [...a, j.file], j.live ? (length + 30) * 1000 : 120000);
  }
  async function words (j, wav, base) {
    const args = ['-m', j.modelFile, '-f', wav, '-osrt', '-of', base, '-l', j.lang || 'auto', '-np', '-t', String(Math.max(1, Math.min(8, os.cpus().length - 1))), '-ml', '60', '-sow'];
    if (j.translate) args.push('-tr');
    await run(j.cli, args, 600000);
    try { return parseSrt(fs.readFileSync(base + '.srt', 'utf8')); } finally { try { fs.rmSync(base + '.srt', { force: true }); } catch (_) {} }
  }

  let job = null;
  function key (o) { let st = {}; try { st = fs.statSync(o.file); } catch (_) {} return crypto.createHash('sha1').update([o.file, st.size, st.mtimeMs, o.aid, o.lang, o.translate, o.model].join('|')).digest('hex').slice(0, 20); }
  async function loop (j) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-whisper-'));
    try {
      while (job === j) {
        if (j.live) {
          const wav = path.join(tmp, 'live.wav'), t0 = Date.now();
          await cut(j, 0, LIVE_PIECE, wav);
          if (job !== j) break;
          const ws = await words(j, wav, path.join(tmp, 'live'));
          if (job !== j) break;
          const text = ws.map(c => c.text).join(' ').trim();
          if (text) say('transcribe:live', { text, behind: Math.round((Date.now() - t0) / 1000) });
          continue;
        }
        const start = nextPiece(j.done, j.at, j.duration);
        if (start == null) { await new Promise(z => { j.wake = z; setTimeout(z, 1500); }); continue; }
        const len = j.duration > 0 ? Math.min(PIECE, j.duration - start) : PIECE;
        const wav = path.join(tmp, 'piece.wav'), t0 = Date.now();
        await cut(j, start, len, wav);
        if (job !== j) break;
        const ws = await words(j, wav, path.join(tmp, 'piece'));
        if (job !== j) break;
        j.cues = addPiece(j.cues, ws, start, start + len);
        j.done = addRange(j.done, start, start + len);
        fs.writeFileSync(j.srt + '.part', writeSrt(j.cues)); fs.renameSync(j.srt + '.part', j.srt);
        fs.writeFileSync(j.srt + '.json', JSON.stringify({ done: j.done }));
        j.speed = Math.round(len / ((Date.now() - t0) / 1000) * 10) / 10;
        say('transcribe:update', { srt: j.srt, upTo: j.done.find(([a, b]) => j.at >= a - 2 && j.at < b)?.[1] || start + len, speed: j.speed, lines: j.cues.length });
      }
    } catch (e) {
      if (job === j) { say('transcribe:error', { error: String(e?.message || e) }); job = null; }
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  }
  async function start (o = {}) {
    stop();
    const j = { file: String(o.file || ''), aid: o.aid ? String(o.aid) : '', at: +o.at || 0, duration: +o.duration || 0, lang: /^[a-z]{2,3}$|^auto$/.test(o.lang) ? o.lang : 'auto', translate: !!o.translate, model: MODELS[o.model] ? o.model : 'base', live: !!o.live, done: [], cues: [] };
    if (!j.file) throw new Error('nothing is playing');
    job = j;
    j.cli = await ensureCli();
    j.modelFile = await ensureModel(j.model);
    if (job !== j) return { stopped: true };
    if (!j.live) {
      fs.mkdirSync(subs, { recursive: true });
      j.srt = path.join(subs, key(j) + '.srt');
      // what was written before for this film, kept
      try { j.done = JSON.parse(fs.readFileSync(j.srt + '.json', 'utf8')).done || []; j.cues = parseSrt(fs.readFileSync(j.srt, 'utf8')); } catch (_) { j.done = []; j.cues = []; fs.writeFileSync(j.srt, ''); }
      // written before: shown at once, the rest written from there
      if (j.cues.length) setTimeout(() => { if (job === j) say('transcribe:update', { srt: j.srt, upTo: j.done.find(([a, b]) => j.at >= a - 2 && j.at < b)?.[1] || j.at, speed: 0, lines: j.cues.length, kept: true }); }, 0);
    }
    loop(j);
    return { srt: j.srt || null, live: j.live, model: j.model };
  }
  function stop () { const j = job; job = null; if (j?.proc) { try { j.proc.kill(); } catch (_) {} } j?.wake?.(); }
  function at (t) { if (job && !job.live) { job.at = +t || 0; job.wake?.(); } }
  return { start, stop, at, status, ensureCli, ensureModel, get job () { return job; } };
}

let service = null;
function register (ipcMain) {
  const send = require('./send');
  const ua = `BM Player ${app.getVersion()} (https://github.com/BritMat/bm-player)`;
  const get = () => service || (service = makeService({ userData: app.getPath('userData'), mpvBin: () => require('./mpv').getMpv(), send, ua }));
  ipcMain.handle('transcribe:start', async (_, o) => { try { return { ok: true, ...(await get().start(o || {})) }; } catch (e) { return { ok: false, error: String(e?.message || e) }; } });
  ipcMain.handle('transcribe:stop', () => { get().stop(); return { ok: true }; });
  ipcMain.handle('transcribe:at', (_, t) => { get().at(t); return true; });
  ipcMain.handle('transcribe:status', () => get().status());
  app.on?.('before-quit', () => service?.stop());
}

module.exports = { register, makeService, parseSrt, addPiece, writeSrt, nextPiece, addRange, assetName, findAsset, MODELS };
