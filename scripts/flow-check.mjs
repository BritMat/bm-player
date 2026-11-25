#!/usr/bin/env node
/**
 * Songs that flow, measured (v3.59.0): the in-app engine (audio-engine.js)
 * in a real Chromium, playing test songs made by ffmpeg, with what comes out
 * of it recorded and looked at in steps of 2 ms.
 *
 *   gapless     a song of one tone, then a song of another: the silence
 *               between the first ending and the second starting, which
 *               should be none (at most 15 ms, the time an element takes to
 *               begin varying from machine to machine)
 *   off         the same with gapless off, the old way: the gap there was
 *               before, shown for comparison
 *   crossfade   2 seconds: both tones heard together for about that long,
 *               and the sound as loud through it (no dip of more than 3 dB)
 *   loudness    a song measured while it plays (loudness.js): the figure
 *               within 1.5 dB of what BS.1770 gives for that tone, and the
 *               level that follows from it applied to the song next time
 *
 * Skips, successfully, without ffmpeg or a Chromium. Run with:
 *   node scripts/flow-check.mjs
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = why => { console.log('flow-check: skipped, ' + why); process.exit(0); };
const has = cmd => { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return true; } catch (_) { return false; } };
if (!has('ffmpeg')) skip('no ffmpeg');
let chromium;
try { ({ chromium } = await import('playwright-core')); } catch (_) { skip('no playwright-core'); }
// the same Chromium sound-check.mjs looks for
const CHROME = (() => {
  const c = [process.env.BM_CHROME];
  try { c.push(chromium.executablePath()); } catch (_) {}
  c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  return c.find(p => p && fs.existsSync(p));
})();
if (!CHROME) skip('no Chromium or Chrome found (set BM_CHROME)');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-flow-'));
// a tone whose peaks are at db below full, in both ears (ffmpeg's sine source is at 1/8 of full, so the expression is written out)
const tone = (name, hz, secs, db) => { const A = Math.pow(10, db / 20).toFixed(5), e = `${A}*sin(2*PI*${hz}*t)`;
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `aevalsrc=${e}|${e}:s=48000:d=${secs}`, '-c:a', 'pcm_s16le', path.join(dir, name)]); };
tone('a.wav', 440, 2, -12); tone('b.wav', 660, 2, -12); tone('c.wav', 440, 3, -12); tone('d.wav', 880, 3, -12);
tone('m.wav', 1000, 6, -20);

// the app's renderer files and the songs, from one address
const types = { '.js': 'text/javascript', '.html': 'text/html', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/songs/') ? path.join(dir, u.slice(7)) : u === '/' ? null : path.join(ROOT, 'src', u);
  if (!f) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>flow</title>'); return; }
  if (!f.startsWith(dir) && !f.startsWith(path.join(ROOT, 'src'))) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-first-run', '--mute-audio', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const said = []; page.on('pageerror', e => said.push(String(e.message)));
await page.goto(base + '/');
let failed = 0;
const step = async (name, fn) => { try { const note = await fn(); console.log('  \u2713 ' + name + (note ? '  (' + note + ')' : '')); } catch (e) { failed++; console.log('  \u2717 ' + name + '\n      ' + (e.message || e)); } };

// Plays one song into the next with the engine as the app uses it, and records the sound after the volume.
const run = (mode, seconds, a, b) => page.evaluate(async ({ mode, seconds, a, b }) => {
  const { AudioEngine } = await import('/js/audio-engine.js');
  const eng = new AudioEngine();
  eng.setFlow({ mode, seconds });
  let flowed = 0, ended = 0;
  eng.on('advanced', () => { flowed++; });
  // the music view's part: with nothing flowing in, the next song when this one ends
  eng.on('ended', () => { ended++; if (!flowed && ended === 1) eng.load('/songs/' + b, b, true); });
  await eng.load('/songs/' + a, a, false);
  const ctx = eng.ctx, rec = [], N = Math.round(ctx.sampleRate / 500);   // 2 ms steps
  const sp = ctx.createScriptProcessor(1024, 2, 2), mute = ctx.createGain(); mute.gain.value = 0;
  let carry = [];
  sp.onaudioprocess = ev => {
    const L = ev.inputBuffer.getChannelData(0), R = ev.inputBuffer.getChannelData(1);
    for (let i = 0; i < L.length; i++) carry.push((L[i] * L[i] + R[i] * R[i]) / 2);
    while (carry.length >= N) { const w = carry.splice(0, N); rec.push(Math.sqrt(w.reduce((x, y) => x + y, 0) / N)); }
  };
  eng.gain.connect(sp); sp.connect(mute); mute.connect(ctx.destination);
  // the next song, as the music view gives it
  if (mode !== 'off') eng.queueNext('/songs/' + b, b);
  await eng.play();
  await new Promise(r => setTimeout(r, 1000 * (seconds && mode === 'crossfade' ? 5 : 4.6)));
  eng.destroy();
  return { rec, flowed, ended };
}, { mode, seconds, a, b });

// the silence between: the longest run of quiet steps after the first sound and before the last
const segs = rec => { const out = []; let cur = null; rec.forEach((v, i) => { const l = v > 0.02; if (!cur || cur[0] !== l) { cur = [l, i * 2, 0]; out.push(cur); } cur[2] += 2; }); return out.map(([l, at, ms]) => (l ? 'sound' : 'quiet') + '@' + at + '+' + ms).join(' '); };
const gapOf = rec => {
  const loud = rec.map(v => v > 0.02);
  const first = loud.indexOf(true), last = loud.lastIndexOf(true);
  let run = 0, best = 0;
  for (let i = first; i <= last; i++) { if (!loud[i]) { run++; best = Math.max(best, run); } else run = 0; }
  return best * 2;
};

// both songs heard at once: steps well above the steady level (two tones together, about 1.4 times as loud)
const overlapOf = rec => {
  const s = rec.filter(v => v > 0.02).sort((a, b) => a - b), mid = s[s.length >> 1] || 1;
  return rec.filter(v => v > mid * 1.2).length * 2;
};
await step('gapless: the next song starts as this one ends, with no silence between and no overlap', async () => {
  const r = await run('gapless', 0, 'a.wav', 'b.wav');
  if (process.env.FLOW_DEBUG) console.log(segs(r.rec), r.flowed, r.ended);
  const gap = gapOf(r.rec);
  if (!r.flowed) throw new Error('the next song did not flow in (ended ' + r.ended + ' times)');
  const both = overlapOf(r.rec);
  if (gap > 15) throw new Error(`a gap of ${gap} ms`);
  if (both > 30) throw new Error(`the two songs overlapped for ${both} ms`);
  return `${gap} ms between, ${both} ms of both`;
});
let before = 0;
await step('off: each song ends, then the next starts, as before', async () => {
  const r = await run('off', 0, 'a.wav', 'b.wav');
  if (process.env.FLOW_DEBUG) console.log(segs(r.rec), r);
  if (r.flowed) throw new Error('a song flowed in with it off');
  before = gapOf(r.rec);
  return `${before} ms between, the old way`;
});
await step('crossfade: two seconds of both, and as loud all through', async () => {
  const r = await run('crossfade', 2, 'c.wav', 'd.wav');
  if (process.env.FLOW_DEBUG) console.log(segs(r.rec), r.flowed, r.ended);
  if (!r.flowed) throw new Error('the next song did not come in');
  const loud = r.rec.map(v => v > 0.02), first = loud.indexOf(true), last = loud.lastIndexOf(true);
  const mid = r.rec.slice(first + 50, last - 50);
  const steady = mid.reduce((a, b) => a + b, 0) / mid.length, low = Math.min(...mid);
  const dip = 20 * Math.log10(steady / low);
  if (gapOf(r.rec) > 0) throw new Error('a silence in a crossfade');
  if (dip > 3) throw new Error(`the sound dipped by ${dip.toFixed(1)} dB`);
  return `the lowest point ${dip.toFixed(1)} dB under the rest`;
});
await step('loudness: a song measured while it plays, and its level next time', async () => {
  const r = await page.evaluate(async () => {
    localStorage.clear();
    const { AudioEngine } = await import('/js/audio-engine.js');
    const { Leveller, TARGET } = await import('/js/loudness.js');
    const eng = new AudioEngine(), lv = new Leveller(eng, { tags: () => null });
    lv.setMode('track');
    const fin = lv._finish.bind(lv); let at = null; lv._finish = () => { if (lv._m) at = { secs: lv._m.secs, dur: lv._m.dur, blocks: lv._m.blocks.length }; fin(); };
    await eng.load('/songs/m.wav', '/songs/m.wav', true);
    await new Promise(z => { eng.on('ended', z); setTimeout(z, 9000); });
    const seen = lv.seen['/songs/m.wav'] || null, level = lv.level('/songs/m.wav');
    eng.destroy();
    return { seen, level, TARGET, at };
  });
  // a 1 kHz tone at -20 dB in both ears: BS.1770 reads -20 LUFS (-3.01 for one ear at full, +3.01 for two)
  if (!r.seen) throw new Error('nothing was kept: ' + JSON.stringify(r.at));
  if (Math.abs(r.seen.lufs - -20) > 1.5) throw new Error(`measured ${r.seen.lufs} LUFS, not about -20`);
  if (Math.abs(r.level.db - (r.TARGET - r.seen.lufs)) > 0.2 && r.level.db < -20 * Math.log10(r.seen.peak) - 0.6) throw new Error('the level is not what the figure gives: ' + JSON.stringify(r));
  return `${r.seen.lufs} LUFS, played next time at ${r.level.db > 0 ? '+' : ''}${r.level.db} dB`;
});

await browser.close(); server.close();
fs.rmSync(dir, { recursive: true, force: true });
if (said.length) { console.log('  page errors: ' + said.join(' | ')); failed++; }
console.log(failed ? `flow-check: ${failed} failed` : 'flow-check: all passed');
process.exit(failed ? 1 : 0);
