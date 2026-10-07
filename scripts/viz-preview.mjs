/**
 * viz-preview: the visualiser, frame by frame, at true speed (v3.36.0).
 *
 * A machine without a graphics card (CI, a build server) draws the fluid at a
 * few frames a second, and the picture is then nothing like what a real GPU
 * shows: emitters jump between frames and leave dots where there should be
 * ribbons. For weeks the look was tuned against pictures like that.
 *
 * This runs the real app, puts it in the visual mode, and takes over two
 * things on the page:
 *   - the clock: performance.now() and requestAnimationFrame are replaced, and
 *     every frame moves time on by exactly 1/60 s, however long it took to draw
 *   - the sound: a made-up piece of music (kick, bass, hats, pad, lead) is
 *     analysed as the Web Audio analyser would (Blackman window, FFT,
 *     smoothing, decibels to bytes) at each frame's own moment
 * So frame 300 is what the app shows 5 seconds in on a fast machine, to the
 * pixel, and it can be captured however slowly it was made.
 *
 *   xvfb-run -a node scripts/viz-preview.mjs --style=flow --seconds=8 --shots=4 --out=/tmp/viz
 *
 * Options: --style (bars, radial, wave, particles, fluid, flow, neon, bubbles,
 * milkdrop, or home for the home screen's own background, with --theme),
 * --colors, --seconds, --shots (pictures, evenly spaced, the last
 * at the end), --size=1280x780, --tier (low, medium, high: the quality tier),
 * --out, --track (a 16-bit PCM .wav of your own), --eval (JavaScript run on the
 * page once the style is up, to try settings), --quiet-at (seconds: the music
 * stops there, to see how a style settles), --hz (the screen's refresh rate,
 * 60 unless given: at 144 the page is called 144 times a second, as on a
 * gaming laptop, which is how a slow-motion bug there was found), --dpr (the
 * display's scaling, 1.25 for a laptop set to 125%), --level (the fluid's
 * quality level: hd, high, medium, low), --tune (JSON merged into HD Flow's
 * settings), --name (the pictures' file name), --set=key=value (a stored
 * setting, put in place before the app starts, as many as wanted), --probe
 * or --probe-file (JavaScript run on the page after each picture, its result
 * printed, to measure as well as look), --burst (after the last picture, this
 * many more, one frame apart, to see how it moves).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => { const a = process.argv.find(x => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : def; };
const STYLE = arg('style', 'flow'), COLORS = arg('colors', 'auto'), SECONDS = +arg('seconds', 8), SHOTS = Math.max(1, +arg('shots', 4));
const [W, H] = arg('size', '1280x780').split('x').map(Number), TIER = arg('tier', 'high');
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'bm-viz-preview'))), EVAL = arg('eval', ''), QUIET_AT = +arg('quiet-at', 0), HZ = +arg('hz', 60);
// The fluid styles' quality level (hd, high, medium, low). Without it a machine
// with no graphics card gets the lightest, as it would in the app.
const LEVEL = arg('level', '');
// The display's scaling (1.25 for a laptop set to 125%), 1 unless given.
const DPR = +arg('dpr', 1);
// JavaScript run on the page after each picture, its result printed: to measure as well as look.
const PROBE = arg('probe', '') || (arg('probe-file', '') ? fs.readFileSync(arg('probe-file', ''), 'utf8') : '');
// After the last picture, this many more, one frame apart: how it moves, not only how it looks.
const BURST = Math.max(0, +arg('burst', 0));

/* A piece of music, made here so nothing binary is kept: 124 beats a minute,
   an intro on the pad, kick and bass from 4 s, everything from 12 s, a
   breakdown at 20 s. The same every time (its noise is seeded). */
export function synthTrack(seconds = 24, rate = 44100) {
  const n = Math.floor(seconds * rate), out = new Float32Array(n);
  let seed = 20261006; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const add = (t0, dur, fn) => { const a = Math.max(0, Math.floor(t0 * rate)), b = Math.min(n, Math.floor((t0 + dur) * rate)); for (let i = a; i < b; i++) out[i] += fn((i - a) / rate, i); };
  const beat = 60 / 124, TAU = Math.PI * 2;
  const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const bassNotes = [55, 43.65, 65.41, 49];
  const scale = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
  let walk = 3;
  for (let b = 0; b * beat < seconds; b++) {
    const t = b * beat, bar = Math.floor(b / 4), ch = chords[Math.floor(bar / 2) % 4];
    const drums = t >= 4 && t < 20, full = t >= 12 && t < 20, breakdown = t >= 20;
    if (b % 4 === 0) for (const f of ch) for (const det of [0.997, 1.003])
      add(t, beat * 4, x => 0.045 * Math.sin(TAU * f * det * x) * Math.min(1, x * 4) * Math.min(1, (beat * 4 - x) * 4) * (0.8 + 0.2 * Math.sin(TAU * 0.7 * x)));
    if (drums) {
      add(t, 0.32, x => 0.85 * Math.sin(TAU * (45 * x + (110 / 28) * (1 - Math.exp(-28 * x)))) * Math.exp(-7 * x));                 // kick
      const bf = bassNotes[Math.floor(bar / 2) % 4];
      add(t + beat / 2, beat * 0.45, x => { let s = 0; for (let k = 1; k <= 6; k++) s += Math.sin(TAU * bf * k * x) / k; return 0.26 * s * Math.exp(-5 * x); });   // bass, off the beat
      for (const off of [0, 0.5]) { let prev = 0; add(t + beat * off, 0.06, x => { const w = rnd(), v = w - prev; prev = w; return 0.13 * v * Math.exp(-70 * x); }); }   // hats
      if (b % 4 === 1 || b % 4 === 3) add(t, 0.2, x => 0.22 * rnd() * Math.exp(-20 * x) + 0.2 * Math.sin(TAU * 190 * x) * Math.exp(-24 * x));        // snare
    }
    if (full || breakdown) for (const off of [0, 0.5]) {
      walk = Math.max(0, Math.min(scale.length - 1, walk + Math.round(rnd() * 2.4)));
      const f = scale[walk];
      add(t + beat * off, beat * 0.48, x => 0.13 * (Math.sin(TAU * f * x) + 0.3 * Math.sin(TAU * 2 * f * x)) * Math.exp(-5.5 * x) * Math.min(1, x * 200));   // lead
    }
  }
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * 1.1);
  return { samples: out, rate };
}

export function writeWav(file, samples, rate) {
  const d = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) d.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, d]));
}

/* Runs in the page: the clock and the analyser. Returns nothing; leaves
   window.__viz = { step(frames), t(), quietAt }. */
export function installOnPage({ wavUrl, quietAt, hz, home }) {
  return (async () => {
    // ── the sound: 16-bit PCM, first channel ──
    const buf = await (await fetch(wavUrl)).arrayBuffer(), dv = new DataView(buf);
    let p = 12, rate = 44100, channels = 1, data = null;
    while (p + 8 <= dv.byteLength) {
      const id = String.fromCharCode(dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3)), len = dv.getUint32(p + 4, true);
      if (id === 'fmt ') { channels = dv.getUint16(p + 10, true); rate = dv.getUint32(p + 12, true); }
      if (id === 'data') { data = new Int16Array(buf, p + 8, Math.floor(len / 2)); break; }
      p += 8 + len + (len & 1);
    }
    const total = Math.floor(data.length / channels);
    const sample = i => (i < 0 ? 0 : data[(i % total) * channels] / 32768);
    // ── the clock ──
    const state = { v: performance.now(), t0: 0, q: new Map(), id: 0, quietAt: quietAt || 0 };
    state.t0 = state.v;
    performance.now = () => state.v;
    // and chance: the same numbers every run, so two runs can be compared frame
    // for frame. Only inside the visualiser's own drawing (or, for the home
    // screen, inside any frame): the fox, a theme's particles and the app's
    // timers draw numbers too, at moments that differ from run to run, and one
    // of those taken from the same row sent the whole fluid another way.
    let seed = 0x2f6e2b1, seeded = 0, inFrame = false; const chance = Math.random;
    Math.random = () => ((seeded > 0 || (home && inFrame)) ? ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) : chance());
    const own = (proto, names) => { for (const n of names) { const f = proto[n]; if (typeof f !== 'function') continue; proto[n] = function (...a) { seeded++; try { return f.apply(this, a); } finally { seeded--; } }; } };
    // Its own numbers start high: a frame asked for before this point has one of
    // the browser's, and cancelling it has to reach the browser. Left alone, it
    // ran later by the real clock and put the run one frame out of step.
    const realCancel = window.cancelAnimationFrame.bind(window);
    state.id = 1e9;
    window.requestAnimationFrame = cb => { state.q.set(++state.id, cb); return state.id; };
    window.cancelAnimationFrame = id => { if (id > 1e9) state.q.delete(id); else realCancel(id); };
    const playT = () => (state.v - state.t0) / 1000;
    // ── the analyser, as the Web Audio one works ──
    const N = 1024, win = new Float32Array(N), re = new Float32Array(N), im = new Float32Array(N), smooth = new Float32Array(N / 2);
    for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N);
    const rev = new Uint16Array(N); for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < 10; b++) r |= ((i >> b) & 1) << (9 - b); rev[i] = r; }
    const cosT = new Float32Array(N / 2), sinT = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = Math.sin(2 * Math.PI * i / N); }
    const silent = () => state.quietAt > 0 && playT() >= state.quietAt;
    // What the analyser holds is not the sound up to this very moment. It
    // arrives in blocks of 128 samples, several at once each time the sound
    // card asks (a hundredth of a second's worth, 100 times a second, is
    // usual), so since the last frame it has moved on by a batch or two, or by
    // none. The beat tracker was first tried on sound that ended exactly on the
    // clock, and went wrong on the real thing.
    const batch = Math.round(rate / 100);
    const window1024 = out => { const end = Math.ceil(batch * (Math.floor(playT() * 100 + 1e-6) + 1) / 128) * 128 - batch, s = silent(); for (let i = 0; i < N; i++) out[i] = s ? 0 : sample(end - N + i); };
    let freqAt = -1; const tmp = new Float32Array(N);
    const fake = {
      fftSize: N, frequencyBinCount: N / 2, smoothingTimeConstant: 0.8, minDecibels: -100, maxDecibels: -30, context: { sampleRate: rate },
      getFloatTimeDomainData(arr) { window1024(tmp); for (let i = 0; i < arr.length; i++) arr[i] = tmp[Math.floor(i * N / arr.length)]; },
      getByteTimeDomainData(arr) { window1024(tmp); for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, Math.min(255, Math.floor(128 * (1 + tmp[Math.floor(i * N / arr.length)])))); },
      getByteFrequencyData(arr) {
        if (freqAt !== state.v) {
          freqAt = state.v; window1024(tmp);
          for (let i = 0; i < N; i++) { re[rev[i]] = tmp[i] * win[i]; im[rev[i]] = 0; }
          for (let size = 2; size <= N; size <<= 1) { const half = size >> 1, stepT = N / size;
            for (let i = 0; i < N; i += size) for (let j = 0, k = 0; j < half; j++, k += stepT) {
              const tr = re[i + j + half] * cosT[k] + im[i + j + half] * sinT[k], ti = im[i + j + half] * cosT[k] - re[i + j + half] * sinT[k];
              re[i + j + half] = re[i + j] - tr; im[i + j + half] = im[i + j] - ti; re[i + j] += tr; im[i + j] += ti; } }
          const tau = this.smoothingTimeConstant;
          for (let k = 0; k < N / 2; k++) smooth[k] = tau * smooth[k] + (1 - tau) * Math.hypot(re[k], im[k]) / N;
        }
        const range = this.maxDecibels - this.minDecibels;
        for (let k = 0; k < arr.length; k++) { const db = 20 * Math.log10(smooth[k] || 1e-12); arr[k] = Math.max(0, Math.min(255, Math.floor(255 / range * (db - this.minDecibels)))); }
      },
    };
    // every visualiser reads it, whatever the app assigns later
    const { allVisualisers, Visualizer } = await import('./js/visualizer.js');
    const { FluidFX } = await import('./js/fluid.js');
    // A browser empties a WebGL canvas once it has shown it, so each frame is
    // drawn on an empty one. Here many frames are drawn between two that are
    // shown, so that is done by hand, before the first drawing of each frame.
    // Without it a fluid that blends over its canvas (BM Player's did, up to
    // v3.35) piles frame upon frame, and a faint glow turns into a solid fog:
    // pictures made that way misled the tuning for a while.
    const render = FluidFX.prototype._render;
    if (typeof render === 'function') FluidFX.prototype._render = function (...a) {
      if (this.__emptiedAt !== state.v) {
        this.__emptiedAt = state.v;
        try { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } catch (_) {}
      }
      return render.apply(this, a);
    };
    own(Visualizer.prototype, ['_draw', '_feedFlow', '_feedFluid', 'mdNext']);
    for (const v of allVisualisers()) Object.defineProperty(v, 'analyser', { get: () => fake, set() {}, configurable: true });
    const one = new Uint8Array(4);
    const sync = () => { for (const fx of (FluidFX.all || [])) { try { const gl = fx.gl; if (!fx._raf) continue; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one); } catch (_) {} } };
    window.__viz = {
      fake, state, t: playT,
      /** The same start every run: chance from its first number, and the analyser with nothing remembered. */
      reset() { seed = 0x2f6e2b1; smooth.fill(0); freqAt = -1; },
      /** Move time on by `frames` screen refreshes, calling the page for each. */
      async step(frames) {
        for (let f = 0; f < frames; f++) {
          state.v += 1000 / (hz || 60) + 0.02;            // a hair over, so a cap at the refresh rate never skips one
          const run = [...state.q.values()]; state.q.clear();
          inFrame = true;
          for (const cb of run) { try { cb(state.v); } catch (e) { console.error('[viz-preview] frame failed:', e); } }
          inFrame = false;
          // Every fourth frame, wait for the graphics process to have drawn what it
          // was sent (reading one pixel back does that). Without it the page ran
          // hundreds of frames ahead, and the picture taken afterwards had to wait
          // for all of them: long runs at a large size timed out.
          if (f % 4 === 3) { sync(); await new Promise(r => setTimeout(r, 0)); }
        }
      },
    };
  })();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.DISPLAY && process.platform === 'linux') { console.log('viz-preview needs a display: run it under xvfb-run'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });   // here, not above: the field check and milkdrop-review borrow this file's music and clock
  const electronPath = require(path.join(ROOT, 'node_modules/electron'));
  const { _electron } = await import('playwright-core');
  let track = arg('track', '');
  if (!track) { track = path.join(OUT, 'track.wav'); const t = synthTrack(24); writeWav(track, t.samples, t.rate); }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-viz-prof-'));
  const app = await _electron.launch({ executablePath: electronPath, args: [ROOT, '--no-sandbox', '--mpv-ao=null', `--user-data-dir=${prof}`, ...(DPR !== 1 ? [`--force-device-scale-factor=${DPR}`] : [])], cwd: ROOT, timeout: 90000 });
  const done = async code => { await app.close().catch(() => {}); fs.rmSync(prof, { recursive: true, force: true }); process.exit(code); };
  try {
    let page; for (let i = 0; i < 200 && !page; i++) { page = app.windows().find(w => w.url().includes('index.html')); if (!page) await new Promise(r => setTimeout(r, 250)); }
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    page.on('console', m => { if (m.type() === 'error' || /viz-preview|FluidFX|MilkDrop/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 240)); });
    await page.waitForFunction(() => window.bmApp, null, { timeout: 60000 });
    await page.evaluate(([tier, style, colors, extra]) => {
      localStorage.setItem('bm_lite_user', '0'); localStorage.setItem('bm_perf_quality_user', tier);
      localStorage.setItem('bm_viz', JSON.stringify({ style, colors, mdAuto: 0 }));
      for (const kv of extra) { const i = kv.indexOf('='); if (i > 0) localStorage.setItem(kv.slice(0, i), kv.slice(i + 1)); }
    }, [TIER, STYLE, COLORS, process.argv.filter(a => a.startsWith('--set=')).map(a => a.slice(6))]);
    await app.evaluate(({ BrowserWindow }, [w, h]) => { for (const x of BrowserWindow.getAllWindows()) x.setBounds({ x: 0, y: 0, width: w, height: h }); }, [W, H]);
    await page.reload(); await page.waitForFunction(() => window.bmApp && window.bmMusic, null, { timeout: 60000 });
    // the "make BM Player the default" prompt would sit in every picture
    await page.addStyleTag({ content: '#default-player-prompt, .toast-stack { display: none !important; }' });
    const HOME = STYLE === 'home', THEME = arg('theme', '');
    if (THEME) await page.evaluate(t => bmApp.applyTheme(t), THEME);
    if (!HOME) {
      // the visual mode, with a song in the in-app engine (its sound is not used)
      await page.evaluate(t => { bmApp.switchDest('music'); bmMusic.play(t, 0); }, track);
      // playing first: on a cold start the song can take a few seconds, and the visual mode only opens for one that plays
      await page.waitForFunction(() => bmApp.isPlaying, null, { timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.evaluate(() => { bmApp.switchDest('video'); if (bmMusic.engine?.el) { bmMusic.engine.el.loop = true; bmMusic.engine.el.muted = true; } });
      await page.waitForFunction(() => bmApp.viz && bmApp.viz.canvas.offsetWidth > 0, null, { timeout: 30000 });
      await page.waitForTimeout(600);
    }
    const wavUrl = await page.evaluate(async t => (await import('./js/util.js')).fileURL(t), track);
    await page.evaluate(installOnPage, { wavUrl, quietAt: QUIET_AT, hz: HZ, home: HOME });
    const TUNE = arg('tune', '');   // JSON merged into HD Flow's settings (visualizer.js FLOW), to try a look
    if (TUNE) await page.evaluate(async j => { const { FLOW } = await import('./js/visualizer.js'); const o = JSON.parse(j); for (const [k, val] of Object.entries(o)) { if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(FLOW[k], val); else FLOW[k] = val; } }, TUNE);
    if (LEVEL) await page.evaluate(async l => { const { FluidFX } = await import('./js/fluid.js'); FluidFX._settled?.set('flow', l); FluidFX._settled?.set('tier', l); }, LEVEL);
    if (HOME) await page.evaluate(t => { window.__viz.reset(); bmApp.applyTheme('dark'); bmApp.applyTheme(t); }, THEME || 'northern');   // started again, on the page's new clock
    else await page.evaluate(([style, colors]) => { const v = bmApp.viz; v.setOptions({ style, colors }); v.setMode('off'); window.__viz.reset(); v._lastDraw = -1e9; v.setMode(style); document.getElementById('controls-bar')?.classList.add('faded'); }, [STYLE, COLORS]);
    if (EVAL) await page.evaluate(EVAL);   // as an expression, through the debugger: the page's own policy forbids eval
    const frames = Math.round(SECONDS * HZ), per = Math.floor(frames / SHOTS), t0 = Date.now(), files = [];
    for (let s = 1; s <= SHOTS; s++) {
      await page.evaluate(n => window.__viz.step(n), s === SHOTS ? frames - per * (SHOTS - 1) : per);
      const file = path.join(OUT, `${arg('name', STYLE + '-' + COLORS)}-${String(s).padStart(2, '0')}.png`);
      await page.screenshot({ path: file, timeout: 120000 }); files.push(file);
      if (PROBE) console.log(`  probe ${s}:`, JSON.stringify(await page.evaluate(PROBE)));
    }
    for (let b = 1; b <= BURST; b++) {
      await page.evaluate(() => window.__viz.step(1));
      const file = path.join(OUT, `${arg('name', STYLE + '-' + COLORS)}-burst-${String(b).padStart(2, '0')}.png`);
      await page.screenshot({ path: file, timeout: 120000 }); files.push(file);
    }
    const info = await page.evaluate(home => { const v = bmApp.viz, f = home ? bmApp.auroraFX : v._fluid; return { style: v.mode, t: +window.__viz.t().toFixed(2), fluid: f ? { tier: f._tier, fast: f._fastSplat, splats: f.splats, frames: f.frames, dye: f.dye ? [f.dye.width, f.dye.height] : null, sim: f.velocity ? [f.velocity.width, f.velocity.height] : null, canvas: [f.canvas.width, f.canvas.height] } : null }; }, HOME);
    console.log(`viz-preview: ${frames} frames of ${STYLE} in ${((Date.now() - t0) / 1000).toFixed(1)} s (${((Date.now() - t0) / frames).toFixed(0)} ms a frame)`, JSON.stringify(info));
    for (const f of files) console.log('  ' + f);
    await done(0);
  } catch (e) { console.log('viz-preview failed:', e.message); await done(1); }
}
