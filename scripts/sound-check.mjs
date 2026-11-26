#!/usr/bin/env node
/**
 * The two players' sound, side by side (v3.49.0, Sound lab).
 *
 * sound-chain.js writes each sound effect twice: as FFmpeg filters for mpv
 * (films, and songs the in-app engine cannot read) and as Web Audio nodes
 * for the engine (the library's songs, on the desktop and the phone). This
 * plays the same test sounds through both and compares what comes out, ear
 * by ear: FFmpeg's filters through ffmpeg itself (mpv's af is the same
 * library), the engine's nodes through the browser's own Web Audio, in an
 * OfflineAudioContext. A mode that sounds one way in a film and another in a
 * song is found here, not by ear.
 *
 * What is compared is each ear's level (RMS) over the second half of the
 * sound, after any reverb has filled in. The tolerances are in dB: tight
 * where the two are the same sum (the stereo tables, the echoes, the low
 * shelf), looser where the two are made differently (night mode detects
 * peaks in Web Audio and the average in FFmpeg, and clear voice is FFmpeg's own
 * dialoguenhance against a band lift). Since v3.59.0 the equalizer is in:
 * its fifteen bands are the same filter in both. So are the key change and
 * the voice changer, whose pitch shift is made differently in the two (a
 * change of rate and FFmpeg's atempo, against a pitch shifter in a worklet):
 * what is compared there is the level, and the note each lands on.
 *
 * FFmpeg 5.1 and later raise the sound after alimiter by its limit
 * (level=1, +0.45 dB at 0.95). Older ones have no such option, so it cannot
 * be turned off from the filter string. The tolerances allow for it.
 *
 * Skips, successfully, without ffmpeg or a Chromium. Run with:
 *   node scripts/sound-check.mjs
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, what) => { console.log((cond ? '  ok   ' : '  FAIL ') + what); if (!cond) fails.push(what); };

try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); }
catch (_) { console.log('sound-check: ffmpeg is not installed: skipped'); process.exit(0); }
const { chromium } = await import('playwright-core').catch(() => ({}));
const chrome = (() => {
  if (!chromium) return null;
  const c = [process.env.BM_CHROME, '/opt/pw-browsers/chromium'];
  try { c.push(chromium.executablePath()); } catch (_) {}
  c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  return c.find(p => p && fs.existsSync(p)) || null;
})();
if (!chrome) { console.log('sound-check: no Chromium or Chrome found (set BM_CHROME): skipped'); process.exit(0); }

const { lavfi, settings } = await import(pathToFileURL(path.join(ROOT, 'src/js/sound-chain.js')).href);

// ── the test sounds ─────────────────────────────────────────────────────
const RATE = 48000;
let seed = 12345;
const rand = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296 - 0.5; };
const make = (secs, f) => { const n = Math.round(RATE * secs), L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { const [l, r] = f(i / RATE); L[i] = l; R[i] = r; } return [L, R]; };
const sin = (hz, t) => Math.sin(2 * Math.PI * hz * t);
// noise softened at the top (a running average), as music is
const noise = (secs, same) => { let a = 0, b = 0; return make(secs, () => { a = a * 0.6 + rand() * 0.4; b = b * 0.6 + (same ? 0 : rand()) * 0.4; return [a * 0.5, (same ? a : b) * 0.5]; }); };
const SOUNDS = {
  left: make(2, t => [0.1 * sin(330, t), 0]),
  centre: make(2, t => [0.1 * sin(700, t), 0.1 * sin(700, t)]),
  bass: make(2, t => [0.1 * sin(60, t), 0.1 * sin(60, t)]),
  noise: noise(2, false),
  centreNoise: noise(2, true),           // the same in both ears
  long: noise(10, false),               // a whole turn of 8D (ten seconds)
  bassLeft: make(2, t => [0.1 * sin(60, t), 0]),   // v3.59.0: for crossfeed
};

// [name, settings, sound, tolerance in dB]
const CASES = [
  ['preamp -6 dB', { preamp: -6 }, 'noise', 0.2],
  ['preamp +4 dB (and the limiter)', { preamp: 4 }, 'noise', 0.7],
  ['mono', { channels: 'mono' }, 'left', 0.2],
  ['swapped', { channels: 'swap' }, 'left', 0.2],
  ['left only', { channels: 'left' }, 'left', 0.2],
  ['boost 200%', { boost: 2 }, 'left', 0.7],
  ['night mode, a quiet tone', { night: true }, 'left', 2.5],
  ['night mode, noise', { night: true }, 'noise', 2.5],
  ['clear voice, a voice in the middle', { voice: true }, 'centre', 1.5],
  ['slowed + reverb', { mode: 'slowed' }, 'noise', 1],
  ['concert hall', { mode: 'hall' }, 'noise', 1],
  ['concert hall, a tone on the left', { mode: 'hall' }, 'left', 1.5],
  ['8D, a whole turn', { mode: '8d' }, 'long', 1],
  ['bass boost, 60 Hz', { mode: 'bass' }, 'bass', 0.7],
  ['bass boost, noise', { mode: 'bass' }, 'noise', 0.7],
  ['vocal remover, a tone on the left', { mode: 'karaoke' }, 'left', 0.8],
  ['vocal remover, the bass in the middle', { mode: 'karaoke' }, 'bass', 0.8],
  ['lo-fi', { mode: 'lofi' }, 'noise', 1],
  ['wider stereo', { mode: 'wide' }, 'left', 0.7],
  // v3.59.0: the fifteen bands, the key and the voice changer
  ['equalizer, +6 dB at 63 and 100 Hz, 60 Hz', { eq: [0, 0, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, 'bass', 0.3],
  ['equalizer, a curve over noise', { eq: [3, 2, 0, -2, -4, -1, 2, 4, 3, 0, -3, 2, 5, 3, -2] }, 'noise', 0.4],
  ['the key, 3 semitones up', { key: 3 }, 'centre', 1],
  ['the key, 5 semitones down, noise', { key: -5 }, 'noise', 1.2],
  ['chipmunk', { voicefx: 'chipmunk' }, 'centre', 1],
  ['deep', { voicefx: 'deep' }, 'noise', 1.2],
  ['robot', { voicefx: 'robot' }, 'centre', 1],
  ['alien', { voicefx: 'alien' }, 'noise', 1.5],
  ['echo', { voicefx: 'echo' }, 'noise', 1],
  ['old radio', { voicefx: 'radio' }, 'left', 0.7],
  // v3.59.0: headphone correction (peaks, and shelves of an unusual Q), crossfeed and headroom
  ['headphone correction, a pair\'s curve over noise', { hp: { name: 'test', gain: -4, bands: [['lowshelf', 105, 5.5, 0.7], ['peak', 170, -1.9, 1.47], ['peak', 3000, 4, 2], ['highshelf', 10000, 3, 0.7]] } }, 'noise', 0.3],
  ['headphone correction, a low shelf of Q 0.35 at 60 Hz', { hp: { name: 'test', gain: 0, bands: [['lowshelf', 105, 6, 0.35]] } }, 'bass', 0.3],
  ['crossfeed, a tone on the left', { crossfeed: true }, 'left', 0.3],
  ['crossfeed, the bass on the left', { crossfeed: true }, 'bassLeft', 0.3],
  ['headroom, the equalizer lifting 6 dB', { headroom: true, eq: [0, 0, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, 'bass', 0.3],
  // In order, one after another. Clear voice and night mode are left out: each is measured alone above, and
  // the ways they differ (what counts as a voice, how a peak is measured) add up through the rest.
  ['everything at once', { preamp: 2, channels: 'mono', mode: 'hall', boost: 1.5 }, 'noise', 1.5],
];

// ── FFmpeg ─────────────────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-sound-'));
function wavF32 (file, [L, R]) {
  const n = L.length, d = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { d.writeFloatLE(L[i], i * 8); d.writeFloatLE(R[i], i * 8 + 4); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, d]));
}
function readF32 (file) {
  const b = fs.readFileSync(file);
  let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const n = Math.floor(b.readUInt32LE(o + 4) / 8); o += 8;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = b.readFloatLE(o + i * 8); R[i] = b.readFloatLE(o + i * 8 + 4); }
  return [L, R];
}
const rms = ([L, R], from = 0.5) => [L, R].map(x => { const a = Math.floor(x.length * from); let s = 0; for (let i = a; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length - a)); });
for (const [k, v] of Object.entries(SOUNDS)) wavF32(path.join(TMP, k + '.wav'), v);
function viaFfmpeg (s, sound) {
  const af = lavfi(s);
  if (!af) return SOUNDS[sound];
  const out = path.join(TMP, 'out.wav');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(TMP, sound + '.wav'),
    '-af', af.slice('lavfi=['.length, -1) + ',aformat=sample_fmts=flt:channel_layouts=stereo:sample_rates=' + RATE, '-c:a', 'pcm_f32le', out]);
  // as long as the sound went in, as the engine's is (v3.59.0): FFmpeg goes on with the echoes' tail after
  // the end, which only echoes, quieter, and the longer the echo the more of the half measured it was
  const n = SOUNDS[sound][0].length;
  return readF32(out).map(c => c.subarray(0, n));
}

// ── the engine's nodes, in the browser ─────────────────────────────────
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>sound</title>'); return; }
  const f = path.join(ROOT, 'src', path.normalize(u).replace(/^([/\\])+/, ''));
  if (!f.startsWith(path.join(ROOT, 'src')) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-first-run', '--mute-audio'] });
const page = await browser.newPage();
await page.goto(base + '/');
async function viaWeb (s, sound) {
  const [L, R] = SOUNDS[sound];
  const out = await page.evaluate(async ({ url, L, R, s, rate }) => {
    const { WebChain } = await import(url);
    const ctx = new OfflineAudioContext(2, L.length, rate);
    const buf = ctx.createBuffer(2, L.length, rate);
    buf.copyToChannel(Float32Array.from(L), 0); buf.copyToChannel(Float32Array.from(R), 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const heard = ctx.createGain(), to = ctx.createGain();
    to.connect(ctx.destination);
    const chain = new WebChain(ctx, { from: src, heard, to });
    chain.set(s);
    await chain.ready?.();   // the key's pitch shifter, loaded (v3.59.0)
    src.start();
    const r = await ctx.startRendering();
    return { L: Array.from(r.getChannelData(0)), R: Array.from(r.getChannelData(1)), live: chain.live.join(',') };
  }, { url: base + '/js/sound-chain.js', L: Array.from(L), R: Array.from(R), s, rate: RATE });
  return [Float32Array.from(out.L), Float32Array.from(out.R), out.live];
}

// ── side by side ───────────────────────────────────────────────────────
const dB = x => 20 * Math.log10(Math.max(x, 1e-7));
console.log('sound-check: each effect in mpv\'s form (ffmpeg) and the engine\'s (Web Audio), ear by ear\n');
try {
  for (const [name, s, sound, tol] of CASES) {
    const full = settings(s);
    const a = rms(viaFfmpeg(full, sound)), w = await viaWeb(full, sound), b = rms(w), input = rms(SOUNDS[sound]);
    // an ear the effect leaves (nearly) silent in both is compared as silence, not in dB
    const quiet = x => x < Math.max(...input) * 0.03;
    const diff = [0, 1].map(i => quiet(a[i]) && quiet(b[i]) ? 0 : Math.abs(dB(a[i]) - dB(b[i])));
    const show = v => v.map(x => dB(x).toFixed(1)).join(' / ');
    ok(diff.every(d => d <= tol), `${name}: mpv ${show(a)} dB, engine ${show(b)} dB (input ${show(input)}; within ${tol} dB)`);
  }
  // What the modes are for, checked on the engine's own output too.
  const lvl = async (s, sound) => rms(await viaWeb(settings(s), sound));
  const [cl] = await lvl({ mode: 'karaoke' }, 'centre');
  ok(cl < rms(SOUNDS.centre)[0] * 0.05, `the vocal remover takes away a voice in the middle (${dB(cl).toFixed(1)} dB left of ${dB(rms(SOUNDS.centre)[0]).toFixed(1)})`);
  const [cv] = await lvl({ voice: true }, 'centreNoise'), [nv] = await lvl({ voice: true }, 'noise');
  ok(cv > nv, `clear voice lifts what is in the middle more than what is not (${dB(cv).toFixed(1)} against ${dB(nv).toFixed(1)} dB)`);
  const [lo] = await lvl({ mode: 'lofi' }, 'bass');
  ok(lo < 0.1 * rms(SOUNDS.bass)[0], `lo-fi takes the bass away (${dB(lo).toFixed(1)} dB)`);
  // v3.59.0: the note each player lands on, from the zero crossings of a 700 Hz tone
  const note = ([L]) => { let n = 0; const a = Math.floor(L.length / 2); for (let i = a + 1; i < L.length; i++) if (L[i - 1] <= 0 && L[i] > 0) n++; return n / ((L.length - a) / RATE); };
  for (const [k, want] of [[3, 700 * Math.pow(2, 3 / 12)], [-5, 700 * Math.pow(2, -5 / 12)]]) {
    const m = note(viaFfmpeg(settings({ key: k }), 'centre')), w = note(await viaWeb(settings({ key: k }), 'centre'));
    ok(Math.abs(m - want) < want * 0.01 && Math.abs(w - want) < want * 0.01, `the key ${k > 0 ? '+' : ''}${k}: 700 Hz becomes ${want.toFixed(0)} Hz, mpv ${m.toFixed(0)}, engine ${w.toFixed(0)}`);
  }
  // v3.59.0: crossfeed puts some of the left's bass in the right ear, and headroom keeps a 6 dB lift under full
  const [, cr] = await lvl({ crossfeed: true }, 'bassLeft');
  ok(cr > rms(SOUNDS.bassLeft)[0] * 0.2, `crossfeed puts the left's bass in the right ear too (${dB(cr).toFixed(1)} dB there, from silence)`);
  const lifted = await lvl({ eq: [0, 0, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, 'bass'), kept = await lvl({ headroom: true, eq: [0, 0, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, 'bass');
  ok(kept[0] <= rms(SOUNDS.bass)[0] * 1.02 && lifted[0] > rms(SOUNDS.bass)[0] * 1.5, `headroom: the 60 Hz tone lifted ${dB(lifted[0] / rms(SOUNDS.bass)[0]).toFixed(1)} dB by the bands is at ${dB(kept[0] / rms(SOUNDS.bass)[0]).toFixed(1)} dB with headroom, no higher than it came`);
  // v3.59.0: the engine's true-peak limiter (worklets/limiter.js), in the browser: a tone whose samples
  // are at 0.71 but whose waveform swings to 1.0 between them is brought under -1 dB, peaks between
  // samples included, and a quiet one passes untouched, 2 ms later
  const lim = await page.evaluate(async ({ url, rate }) => {
    const run = async (amp) => {
      const n = rate, ctx = new OfflineAudioContext(2, n, rate);
      await ctx.audioWorklet.addModule(url);
      const buf = ctx.createBuffer(2, n, rate);
      for (const c of [0, 1]) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = amp * Math.sin(Math.PI / 4 + i * Math.PI / 2); }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const node = new AudioWorkletNode(ctx, 'bm-limiter', { outputChannelCount: [2] });
      src.connect(node); node.connect(ctx.destination); src.start();
      const r = await ctx.startRendering(), d = r.getChannelData(0);
      let peak = 0; for (let i = n / 2; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
      let lag = -1; for (let i = 0; i < 400 && lag < 0; i++) if (Math.abs(d[i]) > 1e-6) lag = i;
      return { samplePeak: peak, truePeak: peak * Math.SQRT2, lag };
    };
    return { loud: await run(1.0), quiet: await run(0.5) };
  }, { url: base + '/js/worklets/limiter.js', rate: RATE });
  ok(lim.loud.truePeak <= 0.9 && lim.loud.truePeak > 0.85, `the peak limiter holds a 1.0 true peak (samples at 0.71) to ${lim.loud.truePeak.toFixed(3)}, under -1 dB (0.891)`);
  ok(Math.abs(lim.quiet.samplePeak - 0.5 * Math.SQRT1_2) < 1e-4 && lim.quiet.lag >= 90 && lim.quiet.lag <= 100, `the peak limiter leaves a quiet sound as it was (${lim.quiet.samplePeak.toFixed(4)}), ${lim.quiet.lag} samples later`);
  const [vl] = await lvl({ voice: true }, 'centre');
  ok(vl > rms(SOUNDS.centre)[0] * 1.6, `clear voice lifts a voice in the middle (${(vl / rms(SOUNDS.centre)[0]).toFixed(2)} times)`);
} finally {
  await browser.close(); server.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
}
console.log(fails.length ? `\nsound-check: ${fails.length} failed` : '\nsound-check: the two players agree');
process.exit(fails.length ? 1 : 0);
