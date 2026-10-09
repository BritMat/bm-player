#!/usr/bin/env node
/**
 * BM Player: end-to-end tests in real Electron
 *
 * Every other suite stubs something: jsdom has no GPU, no media stack and no
 * window manager, and the main-process test fakes BrowserWindow. This one
 * launches the actual app in actual Electron (under Xvfb on Linux) with the
 * actual mpv, and drives it through Playwright.
 *
 * Its first run found five bugs the other 300-odd checks could not see:
 * plugins blocked by the CSP since v3.4.0, an invalid connect-src token that
 * blocked every remote fetch, the mini bar showing on launch because idle
 * mpv reports pause=false, the welcome screen's top cut off behind the
 * menubar, and a Lite override key that nothing ever wrote.
 *
 *   npm run test:e2e              part A: boot, layout, tabs, themes, WebGL
 *   npm run test:e2e -- --part=b  part B: real playback, stop, PiP
 *   npm run test:e2e -- --part=c  part C: the normal two-window layout, Linux
 *                                 only, needs a compositor (xcompmgr)
 *
 * Runs in the single-window Lite layout. The two-window mode needs a
 * compositor for its transparent window, which a virtual display lacks.
 * Skips, successfully, when there is no display or no Electron binary.
 */

import fs from 'node:fs';
import zlib from 'node:zlib';   // the PNG fixtures (v3.32.0)
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// A throwaway profile for every launch. Without it the tests used the real
// BM Player profile: its history, music library, settings and theme.
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-test-profile-'));
process.on('exit', () => { try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {} });
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PART = (process.argv.find(a => a.startsWith('--part=')) || '--part=a').split('=')[1];
const SHOTS = process.env.E2E_SHOTS || path.join(os.tmpdir(), 'bm-e2e-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const pass = n => { results.push(true);  console.log('  \x1b[32m✓\x1b[0m ' + n); };
const fail = (n, e) => { results.push(false); console.log('  \x1b[31m✗\x1b[0m ' + n + (e ? '\n      ' + String(e.message || e).split('\n')[0].slice(0, 220) : '')); };
const step = async (n, fn) => { try { await fn(); pass(n); } catch (e) { fail(n, e); } };
// Exit 0 on a skip, so CI without a display stays green. Under BM_STRICT
// (the Windows check .bat sets it) a skip exits 3 instead: that batch file
// once reported two skipped runs as "all passed".
const skip = why => { console.log(`\n  end-to-end skipped: ${why}\n`); process.exit(process.env.BM_STRICT ? 3 : 0); };

if (!process.env.DISPLAY && process.platform === 'linux') skip('no DISPLAY (run under xvfb-run)');
let electronPath;
try { electronPath = require(path.join(ROOT, 'node_modules/electron')); if (!fs.existsSync(electronPath)) throw 0; }
catch { skip('Electron binary not installed (ELECTRON_SKIP_BINARY_DOWNLOAD?)'); }
let _electron;
try { ({ _electron } = await import('playwright-core')); } catch { skip('playwright-core not installed'); }

// Part C runs the full visuals and has grown past 100 s (v3.33.0), and to about 120 s with
// the lost-picture checks (v3.36.0): 240 s for it.
const hard = setTimeout(() => { console.log('\n  DEADLINE: e2e ran too long'); process.exit(1); }, PART === 'c' ? 240000 : 100000);

/* Fixtures, generated so nothing binary is committed. */
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-e2e-'));
function wav(file, seconds, hz) {
  const rate = 22050, n = Math.floor(rate * seconds), d = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(3000 * Math.sin(2 * Math.PI * hz * i / rate)), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, d]));
}
const TONE = path.join(FIX, 'tone & one.wav');          // hostile name on purpose
// 30 seconds: at 3 it could end partway through part B on a slow run, and the
// visualiser step then found no music to show.
wav(TONE, 30, 330);
// A test video: ffmpeg if present, otherwise mpv's own encoder. Windows
// machines rarely have ffmpeg, but anyone running BM Player has mpv.
// 20 seconds: at 4 it could end before part C's PiP step on a slow run, and
// PiP rightly refuses to start with nothing playing.
// A 1500 Hz tone for mpv (v3.29.0): the exact visualiser must find it where
// 1500 Hz belongs. null without ffmpeg, and the steps that need it are skipped.
let TONE1500 = path.join(FIX, 'tone 1500.wav');
try {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=1500:duration=20', TONE1500], { timeout: 20000, stdio: 'ignore', windowsHide: true });
  if (!fs.existsSync(TONE1500)) TONE1500 = null;
} catch { TONE1500 = null; }
// A plain PNG writer (v3.32.0), for an album cover and a large photo.
function writePng(file, w, h, px) {
  const row = w * 3 + 1, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = px(x, y), o = y * row + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]));
}
let VIDEO = null;
try {
  VIDEO = path.join(FIX, 'clip #1.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25',
    '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', VIDEO], { timeout: 30000, stdio: 'ignore', windowsHide: true });
} catch {
  try {
    VIDEO = path.join(FIX, 'clip #1.mkv');
    execFileSync(process.platform === 'win32' ? 'mpv.exe' : 'mpv', ['--no-config', 'av://lavfi:testsrc=duration=20:size=640x360:rate=25', `--o=${VIDEO}`,
      '--ovc=mpeg4', '--ovcopts=qscale=4'], { timeout: 60000, stdio: 'ignore', windowsHide: true });
    if (!fs.existsSync(VIDEO) || fs.statSync(VIDEO).size < 10000) VIDEO = null;
  } catch { VIDEO = null; }
}

console.log(`\nBM Player: end-to-end in real Electron (part ${PART.toUpperCase()})\n`);

// Part C runs the normal two-window layout. Its front window is transparent,
// which needs a compositor, and a virtual display has none, so start one.
let compositor = null;
if (PART === 'c') {
  if (process.platform !== 'linux') skip('part C uses X11 tools');
  try { execFileSync('which', ['xcompmgr', 'xwininfo', 'import']); } catch { skip('part C needs xcompmgr, xwininfo and ImageMagick'); }
  const { spawn } = await import('node:child_process');
  compositor = spawn('xcompmgr', ['-n'], { stdio: 'ignore', detached: true });
  await new Promise(r => setTimeout(r, 600));
}

// A first start after a download can take a long time while Windows scans
// the new program: part B's launch timed out at 25 seconds on a real
// machine. --part=warmup just starts the app once, so the scan happens there.
const t0 = Date.now();
const app = await _electron.launch({
  executablePath: electronPath,
  // --mpv-ao=null (v3.29.0): mpv plays audio into nothing, so an audio-only
  // file plays on a machine without a sound device, and the run is silent.
  args: [ROOT, '--no-sandbox', '--mpv-ao=null', `--user-data-dir=${PROFILE}`, ...(PART === 'c' ? [] : ['--lite'])],
  cwd: ROOT, timeout: PART === 'warmup' ? 150000 : 90000,
});
let page;
for (let i = 0; i < 400 && !page; i++) {
  page = app.windows().find(w => w.url().includes('index.html'));
  if (!page) await new Promise(r => setTimeout(r, 250));
}
if (PART === 'warmup') {
  if (page) await page.waitForFunction(() => window.bmApp, null, { timeout: 120000 }).catch(() => {});
  const ready = page ? await page.evaluate(() => !!window.bmApp).catch(() => false) : false;
  console.log(`\nwarm-up: the app ${ready ? 'was ready' : 'did NOT get ready'} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await app.close().catch(() => {});
  process.exit(ready ? 0 : 1);
}
// Part B starts by opening a file the moment the renderer exists, before mpv
// has connected. Until v3.14.0 that open was dropped silently: a quick click
// on a recent file after launch did nothing. Reproduced every time.
let earlyOpen = null;
if (PART === 'b' && VIDEO) {
  await page.waitForFunction(() => window.bmApp, null, { timeout: 15000 });
  const mpvReady = await page.evaluate(async () => { const r = await window.api.mpv.cmd('get_property', 'idle-active'); return !(r && r.error); });
  await page.evaluate(f => bmApp.playMedia([f]), VIDEO);
  await page.waitForTimeout(5000);
  earlyOpen = { mpvReady, t: await page.evaluate(() => bmApp.currentTime || 0) };
  await page.evaluate(() => bmApp.stop());
}

const consoleMsgs = [];
page.on('console', m => consoleMsgs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', e => consoleMsgs.push({ type: 'pageerror', text: String(e) }));
// Reload with listeners attached, so boot-time messages are captured too.
await page.reload();
await page.waitForFunction(() => window.bmApp && window.bmMusic, null, { timeout: 15000 });
await page.waitForTimeout(2500);
const shot = name => page.screenshot({ path: path.join(SHOTS, `${PART}-${name}.png`) });

// Messages that are the environment rather than the app.
const NOISE = /three\.min\.js" are deprecated|PulseAudio|ALSA|dbus/i;

try {
if (PART === 'a') {
  await step('app boots with no console errors, page errors or CSP violations', () => {
    const bad = consoleMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !NOISE.test(m.text));
    if (bad.length) throw new Error(bad.map(m => m.text).join(' | '));
  });

  await step('nothing reads as playing on a fresh launch', async () => {
    const s = await page.evaluate(() => ({ p: bmApp.isPlaying, mini: document.getElementById('music-mini-player').classList.contains('hidden') }));
    if (s.p) throw new Error('isPlaying is true with nothing loaded (idle mpv reports pause=false)');
    if (!s.mini) throw new Error('the music mini bar is showing with nothing playing');
  });

  await step('bundled plugin loads (CSP allows bmfile: scripts)', () => {
    const failed = consoleMsgs.find(m => /failed to load/i.test(m.text) || /violates.*script-src/i.test(m.text));
    if (failed) throw new Error(failed.text);
  });

  await step('welcome content starts below the menubar and fits', async () => {
    const g = await page.evaluate(() => {
      const wc = document.querySelector('.welcome-center').getBoundingClientRect();
      const stage = document.querySelector('.fox-stage').getBoundingClientRect();
      const title = document.querySelector('.welcome-title').getBoundingClientRect();
      return { wcTop: wc.top, stageTop: stage.top, titleTop: title.top };
    });
    if (g.stageTop < g.wcTop - 1) throw new Error(`fox stage starts ${Math.round(g.wcTop - g.stageTop)}px above the welcome area, behind the menubar`);
    if (g.titleTop < g.wcTop) throw new Error('the title is cut off at the top');
  });
  await shot('welcome');

  for (const [dest, view] of [['music', 'music-view'], ['images', 'gallery-view'], ['pdf', 'pdf-view'], ['tv', 'tv-view'], ['video', 'welcome-screen']]) {
    await step(`${dest} tab shows its view`, async () => {
      await page.evaluate(d => bmApp.switchDest(d), dest);
      await page.waitForTimeout(250);
      const on = await page.evaluate(v => document.getElementById(v)?.classList.contains('active'), view);
      if (!on) throw new Error('#' + view + ' is not active');
      await shot('tab-' + dest);
    });
  }

  await step('every theme in the picker changes the chrome, not just a token', async () => {
    const themes = await page.evaluate(() => [...document.querySelectorAll('[data-theme].tp, .theme-pill[data-theme]')].map(b => b.dataset.theme));
    if (themes.length < 5) throw new Error('found only ' + themes.length + ' theme buttons');   // themes may be removed, not all
    const seen = new Map();
    for (const t of themes) {
      const s = await page.evaluate(name => {
        document.querySelector(`[data-theme="${name}"].tp, .theme-pill[data-theme="${name}"]`).click();
        const cs = getComputedStyle(document.documentElement);
        return { attr: document.documentElement.getAttribute('data-theme'), accent: cs.getPropertyValue('--accent').trim(),
                 bar: getComputedStyle(document.querySelector('.sidebar')).backgroundColor };
      }, t);
      if (s.attr !== t) throw new Error(`${t}: data-theme is ${s.attr}`);
      seen.set(t, s.accent + '|' + s.bar);
    }
    const distinct = new Set(seen.values()).size;
    if (distinct < 12) throw new Error(`only ${distinct} distinct looks across ${themes.length} themes`);
    await page.evaluate(() => document.querySelector('[data-theme="dark"].tp, .theme-pill[data-theme="dark"]').click());
  });

  await step('GPU fluid solver builds and steps in real Chromium, or refuses cleanly', async () => {
    const r = await page.evaluate(async () => {
      const { FluidFX } = await import('./js/fluid.js');
      const c = document.createElement('canvas'); c.width = 320; c.height = 200;
      c.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:200px'; document.body.appendChild(c);
      let fx;
      try { fx = new FluidFX(c); } catch (e) { c.remove(); return { built: false, why: e.message }; }
      fx.setPalette('dark'); fx.setMode('fluid');
      await new Promise(r => setTimeout(r, 900));
      const gl = fx.gl, err = gl.getError();
      fx.destroy(); c.remove();
      return { built: true, glError: err };
    });
    if (r.built && r.glError !== 0) throw new Error('GL error 0x' + r.glError.toString(16) + ' after running the solver');
    console.log(`      (${r.built ? 'ran on the GPU path' : 'refused: ' + r.why})`);
  });

  // The Snow theme (v3.21.0): snowfall that clears around the pointer, and a
  // Santa hat on the fox, 3D and flat. This part runs Lite, where the app
  // skips the effects layer and uses the flat fox, so the snow and the 3D fox
  // are built here on test canvases.
  await step('Snow: flakes fall and swirl away from the pointer, and the fox wears a hat', async () => {
    const r = await page.evaluate(async () => {
      const out = {};
      const { ThemeFX } = await import('./js/theme-fx.js');
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;left:100px;top:50px;width:400px;height:300px';
      document.body.appendChild(c);
      const fx = new ThemeFX(c); fx._resize(); fx.setMode('snow'); fx.pause();
      out.flakes = fx._flakes?.length || 0;
      fx.pointer(150, 80);                                  // window coordinates
      out.pointer = [fx._px, fx._py];                       // should be canvas coordinates
      // One flake just right of the pointer, one far from it: only the near one
      // should be pushed (to the right, away from the pointer).
      const f = fx._flakes[0], far = fx._flakes[1];
      Object.assign(f, { x: 70, y: 30, vx: 0, vy: 0 }); Object.assign(far, { x: 350, y: 30, vx: 0, vy: 0 });
      for (let i = 0; i < 12; i++) fx._drawSnow();
      out.near = f.x - 70; out.farMoved = Math.abs(far.x - 350);
      fx.setMode('off'); c.remove();
      bmApp.applyTheme('snow');
      // Lite removes the app's own effects canvas, so a probe with its class
      // checks the CSS rule that makes it visible in Snow.
      const probe = document.createElement('canvas'); probe.className = 'theme-fx-canvas'; document.body.appendChild(probe);
      out.canvasOpacity = getComputedStyle(probe).opacity; probe.remove();
      const hat = document.querySelector('.fox-stage svg.geofox .gf-hat');
      out.flatHatSnow = hat ? getComputedStyle(hat).display : 'no hat';
      bmApp.applyTheme('dark');
      out.flatHatDark = hat ? getComputedStyle(hat).display : 'no hat';
      const { Fox3D } = await import('./js/fox3d.js');
      const fc = document.createElement('canvas'); fc.style.cssText = 'position:fixed;left:0;top:0;width:240px;height:240px';
      document.body.appendChild(fc);
      const fox = new Fox3D(fc); fox.pause();
      const red = theme => {
        fox.setTheme(theme); fox.renderAt(0, 0);
        const px = new Uint8Array(fc.width * fc.height * 4); fox.gl.readPixels(0, 0, fc.width, fc.height, fox.gl.RGBA, fox.gl.UNSIGNED_BYTE, px);
        // The hat's red has far less green than any shade of the fox's orange;
        // a looser filter let 27 antialiased orange edge pixels through on a real GPU.
        let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 150 && px[i + 1] < 60 && px[i + 2] < 90) n++;
        return n;
      };
      out.redSnow = red('snow'); out.redDark = red('dark');
      fox.destroy(); fc.remove();
      return out;
    });
    if (r.flakes < 50) throw new Error('too few flakes: ' + r.flakes);
    if (r.pointer[0] !== 50 || r.pointer[1] !== 30) throw new Error('pointer not converted to canvas coordinates: ' + r.pointer);
    if (!(r.near > 4) || !(r.near > r.farMoved * 2)) throw new Error(`the pointer did not push the flake beside it away: near flake moved ${r.near.toFixed(1)}px right, far one ${r.farMoved.toFixed(1)}px`);
    if (r.canvasOpacity !== '1') throw new Error('the snow canvas is invisible in Snow (opacity ' + r.canvasOpacity + ')');
    if (r.flatHatSnow === 'none' || r.flatHatSnow === 'no hat' || r.flatHatDark !== 'none') throw new Error(`flat fox hat: ${r.flatHatSnow} in Snow, ${r.flatHatDark} in Dark`);
    if (r.redSnow < 300 || r.redSnow < r.redDark * 10) throw new Error(`3D fox hat: ${r.redSnow} red pixels in Snow, ${r.redDark} in Dark`);
    console.log(`      (${r.flakes} flakes; hat ${r.redSnow} red pixels in Snow, ${r.redDark} in Dark)`);
  });

  // Control icons (v3.25.0): the music player, mini player, PiP bar, prompts
  // and close buttons showed emoji, which every system draws differently (the
  // shuffle was an orange square). Every control must now hold a drawn icon,
  // and with nothing loaded the play buttons show play, not pause.
  await step('every player control shows a drawn icon, not an emoji', async () => {
    const r = await page.evaluate(() => {
      const glyph = /[\u2190-\u21FF\u2300-\u23FF\u25A0-\u25FF\u2600-\u27BF\u2B00-\u2BFF]|[\uD83C-\uD83E][\uDC00-\uDFFF]/;
      const sel = '#controls-bar button, [id^="np-btn"], .mmp-ctrl, #pip-overlay button, [data-icon]';
      const els = [...document.querySelectorAll(sel)];
      const bad = els.filter(e => glyph.test(e.textContent) || !e.querySelector('svg.ico')).map(e => e.id || e.className);
      const idle = ['np-btn-play', 'mmp-play', 'pip-play'].map(id => document.getElementById(id)?.dataset.icon);
      return { count: els.length, bad, idle };
    });
    if (r.count < 30) throw new Error('only ' + r.count + ' controls found');
    if (r.bad.length) throw new Error('controls without a drawn icon or still showing a glyph: ' + r.bad.slice(0, 6).join(', '));
    if (r.idle.some(i => i !== 'play')) throw new Error('with nothing loaded the play buttons show ' + r.idle.join('/'));
    console.log(`      (${r.count} controls, all drawn icons)`);
  });

  // The right-click menu (v3.27.0): a short standard menu with submenus. It
  // showed seven expanded sections at once, with a close button among them.
  await step('the right-click menu is short, with submenus that open on hover', async () => {
    await page.evaluate(() => bmApp._openCtxPanel(300, 200));
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const p = document.getElementById('ctx-panel'), vis = e => e.offsetParent !== null;
      const rows = [...p.querySelectorAll(':scope > .ctx-group > .ctx-item, :scope > .ctx-has-sub > .ctx-label')].filter(vis).map(e => e.textContent.trim());
      const subsOpen = [...p.querySelectorAll('.ctx-sub')].filter(x => getComputedStyle(x).display !== 'none').length;
      return { rows, subsOpen, close: !!document.getElementById('ctx-close') };
    });
    if (r.close) throw new Error('the menu still has a close button');
    if (r.subsOpen) throw new Error(r.subsOpen + ' submenus open before any hover');
    if (r.rows.length > 16) throw new Error(`${r.rows.length} rows at the top level: ${r.rows.join(', ')}`);
    await page.hover('#ctx-sec-quick > .ctx-label');
    await page.waitForTimeout(400);
    const opened = await page.evaluate(() => getComputedStyle(document.querySelector('#ctx-sec-quick > .ctx-sub')).display);
    await page.evaluate(() => bmApp._closeCtxPanel());
    if (opened === 'none') throw new Error('hovering Volume did not open its submenu');
    console.log(`      (${r.rows.length} rows with nothing playing: ${r.rows.join(', ')})`);
  });

  // Readable menus in every theme (v3.34.0). In Light the dropdowns were dark
  // with dark text, 1.04 to 1, readable only under the pointer, from colours
  // fixed in index.html. Every row and every menu-strip label must reach 4.5
  // to 1. Colours are resolved by the browser (painted onto one pixel, any
  // notation, any transparency), transitions off, from each theme's page colour.
  await step('every theme\'s menus are readable', async () => {
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation-duration: 0s !important; }' });
    const r = await page.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
      const px = () => { const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ratio = el => {
        const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e);
        g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#808080'; g.fillRect(0, 0, 1, 1);
        for (const e of chain) { g.fillStyle = getComputedStyle(e).backgroundColor; g.fillRect(0, 0, 1, 1); }
        const bg = px(); g.fillStyle = getComputedStyle(el).color; g.fillRect(0, 0, 1, 1); const fg = px();
        const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      const themes = [...new Set([...document.querySelectorAll('[data-theme]')].map(e => e.dataset.theme).filter(Boolean))];
      const out = {};
      for (const t of themes) {
        bmApp.applyTheme(t); await new Promise(z => setTimeout(z, 60));
        let rows = 99, labels = 99;
        for (const drop of document.querySelectorAll('.mi-drop')) {
          drop.style.display = 'flex';
          for (const row of drop.querySelectorAll('.mr')) if (row.offsetHeight) rows = Math.min(rows, ratio(row));
          drop.style.display = '';
        }
        for (const l of document.querySelectorAll('.menu-toolbar .mi-label')) if (l.offsetHeight) labels = Math.min(labels, ratio(l));
        out[t] = [+rows.toFixed(2), +labels.toFixed(2)];
      }
      bmApp.applyTheme('dark');
      return out;
    });
    const bad = Object.entries(r).filter(([, [rows, labels]]) => rows < 4.5 || labels < 4.5);
    if (Object.keys(r).length < 10) throw new Error('only ' + Object.keys(r).length + ' themes found');
    if (bad.length) throw new Error('hard to read: ' + bad.map(([t, [a, b]]) => `${t} rows ${a} labels ${b}`).join(', '));
    const all = Object.values(r).flat();
    console.log(`      (${Object.keys(r).length} themes, lowest contrast ${Math.min(...all).toFixed(2)} to 1)`);
  });

  // The keyboard shortcuts list (v3.30.0): ? opens it, the Tools menu too,
  // and Esc closes it without also stopping playback.
  await step('the keyboard shortcuts list opens with ? and from Tools, and Esc only closes it', async () => {
    await page.keyboard.press('Shift+Slash'); await page.waitForTimeout(250);
    const a = await page.evaluate(() => { const o = document.getElementById('kb-overlay'); return { open: !o.classList.contains('hidden'), rows: o.querySelectorAll('.kb-row').length, groups: [...o.querySelectorAll('.kb-group h3')].map(h => h.textContent) }; });
    await page.evaluate(() => { window.__stops = 0; const st = bmApp.stop.bind(bmApp); bmApp.stop = (...x) => { window.__stops++; return st(...x); }; });
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    const b = await page.evaluate(() => ({ open: !document.getElementById('kb-overlay').classList.contains('hidden'), stops: window.__stops }));
    await page.evaluate(() => document.querySelector('.mr[data-a="shortcuts"]')?.click()); await page.waitForTimeout(250);
    const c = await page.evaluate(() => !document.getElementById('kb-overlay').classList.contains('hidden'));
    await page.evaluate(() => bmApp.toggleShortcuts(false));
    if (!a.open) throw new Error('? did not open the list');
    if (a.rows < 30 || a.groups.length !== 5) throw new Error(`the list has ${a.rows} rows in ${a.groups.length} groups`);
    if (b.open) throw new Error('Esc did not close the list');
    if (b.stops) throw new Error('Esc also stopped playback');
    if (!c) throw new Error('the Tools menu item did not open the list');
    console.log(`      (${a.rows} shortcuts: ${a.groups.join(', ')})`);
  });

  // Volume sliders (v3.25.3): filled with the theme's colours up to the thumb,
  // whether the value comes from a drag or from code (keys, wheel, mpv).
  await step('volume sliders fill with the theme up to the thumb', async () => {
    const r = await page.evaluate(() => ['volume-slider', 'np-volume', 'ctx-vol'].map(id => {
      const s = document.getElementById(id); if (!s) return { id, missing: true };
      const was = s.value;
      s.value = 75;                                     // set from code: no event fires
      const fromCode = parseFloat(s.style.getPropertyValue('--fill'));
      s.value = 26; s.dispatchEvent(new Event('input')); // a drag
      const fromDrag = parseFloat(s.style.getPropertyValue('--fill'));
      s.value = was;
      const bg = getComputedStyle(s).backgroundImage;
      return { id, fromCode, fromDrag, max: +s.max, gradient: bg.startsWith('linear-gradient') };
    }));
    for (const x of r) {
      if (x.missing) throw new Error(x.id + ' is missing');
      const want = v => (v / x.max) * 100;
      if (Math.abs(x.fromCode - want(75)) > 0.1) throw new Error(`${x.id}: 75 of ${x.max} filled ${x.fromCode}%, expected ${want(75).toFixed(1)}%`);
      if (Math.abs(x.fromDrag - want(26)) > 0.1) throw new Error(`${x.id}: a drag to 26 filled ${x.fromDrag}%`);
      if (!x.gradient) throw new Error(x.id + ' has no theme fill');
    }
    console.log(`      (75 of ${r[0].max} fills ${r[0].fromCode.toFixed(1)}% of the track)`);
  });

  // About BM Player: an in-app window with the author and links (v3.20.0).
  await step('About opens from the menu, with the version, author and links', async () => {
    // Recorded where links really leave the app: shell.openExternal in the main
    // process. The page's window.api is a read-only copy from contextBridge.
    await app.evaluate(({ shell }) => { global.__opened = []; global.__realOpen = shell.openExternal; shell.openExternal = async u => { global.__opened.push(u); }; });
    await page.evaluate(() => document.querySelector('.mr[data-a="about"]').click());
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const d = document.getElementById('about-dialog');
      return { shown: d && !d.classList.contains('hidden'), version: document.getElementById('about-version').textContent,
               name: document.querySelector('.about-name')?.textContent,
               urls: [...d.querySelectorAll('.about-link')].map(b => b.dataset.url), focus: document.activeElement?.id };
    });
    await shot('about');
    await page.click('.about-link[data-url^="mailto:"]');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.waitForTimeout(300);
    const after = { hidden: await page.evaluate(() => document.getElementById('about-dialog').classList.contains('hidden')),
                    opened: await app.evaluate(() => global.__opened) };
    await app.evaluate(({ shell }) => { shell.openExternal = global.__realOpen; });
    if (!r.shown) throw new Error('About did not open');
    if (!/^Version \d/.test(r.version)) throw new Error('no version shown: ' + r.version);
    if (r.name !== 'Bristo') throw new Error('author missing');
    for (const u of ['https://github.com/BritMat', 'mailto:reach.bristo@gmail.com', 'https://github.com/BritMat/bm-player', 'https://github.com/BritMat/bm-player/issues'])
      if (!r.urls.includes(u)) throw new Error('missing link ' + u);
    if (r.focus !== 'about-close') throw new Error('focus did not move into the window');
    if (JSON.stringify(after.opened) !== '["mailto:reach.bristo@gmail.com"]') throw new Error('the email button did not hand over its address: ' + JSON.stringify(after.opened));
    if (!after.hidden) throw new Error('Escape did not close About');
  });

  // The 3D fox (v3.16.0): a real WebGL head, checked at two angles, since a
  // model that only works face-on isn't 3D. Built directly on a test canvas,
  // because this part runs in Lite, where the app uses the flat fox.
  await step('the 3D fox draws in real WebGL, from the front and turned', async () => {
    const r = await page.evaluate(async () => {
      const { Fox3D, createFox } = await import('./js/fox3d.js');
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;left:0;top:0;width:240px;height:240px';
      document.body.appendChild(c);
      let fox; try { fox = new Fox3D(c); } catch (e) { c.remove(); return { ok: false, why: e.message }; }
      fox.pause();
      const gl = fox.gl;
      const sample = yaw => {
        fox.renderAt(yaw, 0);
        // sized after drawing: the first draw resizes the canvas from its 300x150 default
        const px = new Uint8Array(c.width * c.height * 4);
        gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let covered = 0, left = 0; const colours = new Set();
        for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) {
          covered++; colours.add(px[i] >> 3 << 10 | px[i + 1] >> 3 << 5 | px[i + 2] >> 3);
          if ((i / 4) % c.width < c.width / 2) left++;
        }
        return { cover: covered / (c.width * c.height), colours: colours.size, leftShare: covered ? left / covered : 0, px };
      };
      const front = sample(0), turned = sample(-40);
      // A turned head is a different picture: count the pixels that changed.
      let changed = 0;
      for (let i = 0; i < front.px.length; i += 4)
        if (Math.abs(front.px[i] - turned.px[i]) + Math.abs(front.px[i + 1] - turned.px[i + 1]) + Math.abs(front.px[i + 2] - turned.px[i + 2]) + Math.abs(front.px[i + 3] - turned.px[i + 3]) > 60) changed++;
      const changedShare = changed / (front.px.length / 4);
      delete front.px; delete turned.px;
      // Lite gets the flat fox. Give it a stage, as the welcome screen does.
      const stage = document.createElement('div'); stage.className = 'fox-stage';
      stage.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px';
      stage.appendChild(document.createElement('canvas')); document.body.appendChild(stage);
      const flat = createFox(stage.querySelector('canvas'), { lite: true });
      const res = { ok: true, front, turned, changedShare, triangles: fox.triangles, liteKind: flat.kind };
      flat.destroy(); stage.remove(); fox.destroy(); c.remove();
      return res;
    });
    if (!r.ok) throw new Error('3D fox could not start: ' + r.why);
    if (r.front.cover < 0.25 || r.front.colours < 25) throw new Error('front view nearly empty: ' + JSON.stringify(r.front));
    if (Math.abs(r.front.leftShare - 0.5) > 0.06) throw new Error('front view is lopsided: ' + r.front.leftShare.toFixed(2));
    if (r.changedShare < 0.12) throw new Error(`turning the head changed only ${(r.changedShare * 100).toFixed(1)}% of the picture`);
    if (r.liteKind !== 'svg') throw new Error('Lite did not get the flat fox: ' + r.liteKind);
    console.log(`      (${r.triangles} triangles; covers ${(r.front.cover * 100) | 0}% face-on, ${r.front.colours} shades; turning it 40 degrees changes ${(r.changedShare * 100) | 0}% of the picture)`);
  });

  // The fox on the welcome screen: the hand-placed low-poly SVG (v3.15.0),
  // which replaced a three.js fox whose head floated above its body.
  // v3.29.1: the flat fox is the 3D fox drawn still (the same mesh), and it
  // no longer floats: it is alive through blinks, ear twitches and its tilt.
  await step('the geometric fox is on the welcome screen, whole, blinking and not floating', async () => {
    await page.evaluate(() => bmApp.switchDest('video'));
    const r = await page.evaluate(() => {
      const svg = document.querySelector('.fox-stage svg.geofox');
      if (!svg) return { ok: false, why: 'no fox SVG in the stage' };
      const box = svg.getBoundingClientRect(), stage = document.querySelector('.fox-stage').getBoundingClientRect();
      return {
        ok: true,
        facets: svg.querySelectorAll('polygon').length,
        parts: ['.gf-ear-l', '.gf-ear-r', '.gf-eye-l', '.gf-eye-r', '.gf-nose', '.gf-body'].filter(s => !svg.querySelector(s)),
        visible: box.width > 100 && box.height > 100 && box.top >= stage.top - 2,
        floats: getComputedStyle(svg.querySelector('.gf-body')).animationName,
        live: !!bmApp.fox?._timers?.size,
        hat: !!svg.querySelector('.gf-hat polygon'),
        canvasGone: !document.getElementById('fox-canvas'),
      };
    });
    if (!r.ok) throw new Error(r.why);
    if (r.facets < 80) throw new Error('only ' + r.facets + ' facets');
    if (r.parts.length) throw new Error('missing parts: ' + r.parts.join(', '));
    if (!r.visible) throw new Error('the fox is not visibly placed in its stage');
    if (r.floats && r.floats !== 'none') throw new Error('the fox floats: its body runs ' + r.floats);
    if (!r.live) throw new Error('no blinks or twitches are scheduled');
    if (!r.hat) throw new Error('the Santa hat is not drawn (from the 3D fox\'s geometry)');
    if (!r.canvasGone) throw new Error('the old fox canvas is still in the page');
    console.log(`      (${r.facets} facets, the 3D fox's mesh, blinking, not floating)`);
  });
}

if (PART === 'b') {
  if (earlyOpen) {
    await step('a file opened before mpv has started still plays', () => {
      if (earlyOpen.mpvReady) console.log('      (mpv was already up, so this run could not test the early case)');
      if (!(earlyOpen.t > 1)) throw new Error(`nothing played: position ${earlyOpen.t.toFixed(2)}s five seconds after opening`);
    });
  }
  await step('in-app engine plays a real file through bmfile://', async () => {
    const r = await page.evaluate(async f => {
      bmApp.switchDest('music');
      bmMusic.play(f, 0);
      await new Promise(r => setTimeout(r, 2000));
      return { owns: bmMusic.engineOwns(), t: bmMusic.engine.currentTime, err: bmMusic.engine.el.error && bmMusic.engine.el.error.code };
    }, TONE);
    if (r.err) throw new Error('media element error code ' + r.err + ' (bmfile:// or decoder)');
    if (!r.owns) throw new Error('the engine did not take the file');
    if (!(r.t > 0.3)) throw new Error('playback did not advance: ' + r.t + 's');
  });
  await shot('engine-playing');

  // The music seek bar (v3.28.0): drag to scrub. It took a click only, on a
  // bar 5px tall, and a drag released off the bar did not seek at all. The
  // press is 6px above the thin bar (in its grab area), the release 40px
  // below it.
  await step('the music seek bar scrubs, and a release off the bar still seeks', async () => {
    const box = await page.evaluate(() => { const r = document.getElementById('np-seek-track').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    if (!(box.w > 20)) throw new Error('the seek bar is not on screen');
    const y = box.y + box.h / 2;
    await page.mouse.move(box.x + box.w * 0.2, box.y - 6); await page.mouse.down();
    await page.mouse.move(box.x + box.w * 0.5, y, { steps: 4 });
    const mid = await page.evaluate(() => ({ fill: parseFloat(document.getElementById('np-seek-fill').style.width), scrubbing: document.getElementById('np-seek-track').classList.contains('scrubbing') }));
    await page.mouse.move(box.x + box.w * 0.8, y + 40, { steps: 4 });
    await page.mouse.up(); await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ t: bmMusic.engine.currentTime, d: bmMusic.engine.duration }));
    if (!mid.scrubbing || Math.abs(mid.fill - 50) > 6) throw new Error(`the bar did not follow the drag: ${JSON.stringify(mid)}`);
    if (!(r.d > 0) || Math.abs(r.t / r.d - 0.8) > 0.07) throw new Error(`released at 80%, playback at ${(r.t / r.d * 100).toFixed(1)}%`);
  });

  // The visualiser's settings (v3.28.0): a panel from the visualiser's
  // settings button, applied to every visualiser and kept.
  await step('the visualiser settings apply to every visualiser and are kept', async () => {
    await page.click('#mv-btn-settings'); await page.waitForTimeout(200);
    const open = await page.evaluate(() => !document.getElementById('viz-settings').classList.contains('hidden'));
    await page.click('#vs-colors button[data-v="fire"]');
    await page.click('#vs-style button[data-v="radial"]');
    await page.evaluate(() => { const i = document.getElementById('vs-bars'); i.value = 40; i.dispatchEvent(new Event('input')); });
    // Visualisers are made when their view first opens: those that exist must
    // follow, and one made afterwards must start with the kept settings.
    const r = await page.evaluate(async () => {
      const { Visualizer, allVisualisers } = await import('./js/visualizer.js');
      const all = allVisualisers().map(v => ({ c: v.opts.colors, b: v.opts.bars, n: v._getFreq().length }));
      const fresh = new Visualizer(document.createElement('canvas'));
      return { saved: JSON.parse(localStorage.getItem('bm_viz') || '{}'), all, fresh: { c: fresh.opts.colors, b: fresh.opts.bars, n: fresh._getFreq().length } };
    });
    await page.click('#vs-reset');
    await page.evaluate(() => window.bmVizPanel?.close());   // not Escape: that is also a player key
    if (!open) throw new Error('the settings button did not open the panel');
    if (r.saved.colors !== 'fire' || r.saved.style !== 'radial' || r.saved.bars !== 40) throw new Error('not kept: ' + JSON.stringify(r.saved));
    if (r.all.some(v => v.c !== 'fire' || v.b !== 40 || v.n !== 40)) throw new Error('a visualiser did not follow: ' + JSON.stringify(r.all));
    if (r.fresh.c !== 'fire' || r.fresh.b !== 40 || r.fresh.n !== 40) throw new Error('a new visualiser did not start with them: ' + JSON.stringify(r.fresh));
  });

  // Reported on a real machine: while music played the sidebar was gone, so
  // there was no way to another tab and the mini bar never appeared. This
  // step used to call switchDest() directly, which is why it passed anyway.
  // It now goes through the sidebar with a real click, as a person would.
  await step('while music plays, the sidebar stays and clicking it brings up the mini bar', async () => {
    const sb = await page.evaluate(() => {
      const s = document.querySelector('.sidebar'), cs = getComputedStyle(s), r = s.getBoundingClientRect();
      return { playing: bmApp.isPlaying, bodyPlaying: document.body.classList.contains('playing'), opacity: +cs.opacity, pe: cs.pointerEvents, right: r.right };
    });
    if (!sb.playing) throw new Error('music is not playing at this point');
    if (sb.bodyPlaying || sb.opacity < 0.9 || sb.pe === 'none' || sb.right <= 0) throw new Error('the sidebar is hidden while music plays: ' + JSON.stringify(sb));
    await page.click('.sidebar-btn[data-dest="images"]', { timeout: 4000 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ dest: bmApp.currentDash, hidden: document.getElementById('music-mini-player').classList.contains('hidden') }));
    if (r.dest !== 'images') throw new Error('the click did not switch tabs: ' + r.dest);
    if (r.hidden) throw new Error('no mini bar on the Images tab');
    await shot('mini-bar-gallery');
  });

  await step('Video tab shows the visualiser with its buttons clear of the controls', async () => {
    const g = await page.evaluate(async () => {
      bmApp.switchDest('video'); await new Promise(r => setTimeout(r, 500));
      const ov = document.querySelector('.viz-overlay'), bar = document.getElementById('controls-bar');
      const btn = document.getElementById('viz-btn-play').getBoundingClientRect();
      const top = document.elementFromPoint(btn.x + btn.width / 2, btn.y + btn.height / 2);
      return { viz: document.body.classList.contains('audio-viz'), shown: getComputedStyle(ov).display !== 'none', hit: top && (top.id || top.className) };
    });
    if (!g.viz || !g.shown) throw new Error('visualiser not shown');
    if (g.hit !== 'viz-btn-play') throw new Error('something else is on top of the play button: ' + g.hit);
    await shot('video-visualiser');
  });

  await step('stop in video mode: silence, visualiser off, home screen', async () => {
    const s = await page.evaluate(async () => {
      bmApp.stop(); await new Promise(r => setTimeout(r, 400));
      return { active: bmMusic.engine.active, viz: document.body.classList.contains('audio-viz'),
               home: document.getElementById('welcome-screen').classList.contains('active'), playing: bmApp.isPlaying };
    });
    if (s.active) throw new Error('engine still playing');
    if (s.viz) throw new Error('visualiser state left behind');
    if (!s.home || s.playing) throw new Error('not back home');
  });

  if (VIDEO) {
    // Stop a video, open the same file again: it jumped straight to its end.
    // mpv's failed gpu attempt closed handle 0 on every file load, and the
    // second time handle 0 was the video file. Traced with strace; the app
    // now locks mpv onto the video output that worked.
    // Subtitle font and colour (v3.28.0), from the right-click menu: they
    // reach mpv, styled ASS subtitles included, and Default puts it back.
    await step('subtitle font and colour reach mpv, and Default restores the file\'s own', async () => {
      await page.evaluate(v => bmApp.playMedia([v]), VIDEO); await page.waitForTimeout(2500);
      await page.evaluate(() => bmApp._openCtxPanel(300, 160));
      await page.hover('#ctx-sec-sub-tracks > .ctx-label'); await page.waitForTimeout(450);
      const g = () => page.evaluate(async () => { const c = n => window.api.mpv.cmd('get_property', n); return { color: String(await c('sub-color')), font: await c('sub-font'), ass: await c('sub-ass-override') }; });
      await page.click('#ctx-sub-colors button[data-c="#FFE135"]');
      await page.click('#ctx-sub-fonts button[data-f="Georgia"]');
      await page.waitForTimeout(300); const on = await g();
      await page.click('#ctx-sub-colors button[data-c=""]'); await page.click('#ctx-sub-fonts button[data-f=""]');
      await page.waitForTimeout(300); const off = await g();
      await page.evaluate(() => { bmApp._closeCtxPanel(); bmApp.stop(); });
      if (on.font !== 'Georgia' || !on.color.toUpperCase().includes('FFE135') || on.ass !== 'force') throw new Error('not applied: ' + JSON.stringify(on));
      if (off.font !== 'sans-serif' || off.ass !== 'scale') throw new Error('Default did not restore: ' + JSON.stringify(off));
    });
    await step('stop a video, open the same file again: it starts from the beginning', async () => {
      const r = await page.evaluate(async vid => {
        const g = n => window.api.mpv.cmd('get_property', n);
        bmApp.playMedia([vid]); await new Promise(res => setTimeout(res, 2500));
        bmApp.stop(); await new Promise(res => setTimeout(res, 1200));
        bmApp.playMedia([vid]); await new Promise(res => setTimeout(res, 2000));
        const t = await g('time-pos'), eof = await g('eof-reached'), dur = await g('duration');
        const cur = await g('current-vo'), opt = await g('options/vo');
        bmApp.stop(); await new Promise(res => setTimeout(res, 600));
        return { t, eof, dur, cur, locked: Array.isArray(opt) ? opt.map(o => o.name).filter(Boolean).join(',') : String(opt) };
      }, VIDEO);
      if (typeof r.t !== 'number') throw new Error('no position after reopening: ' + JSON.stringify(r));
      if (r.eof === true || r.t > 6) throw new Error(`reopened at ${r.t.toFixed(1)}s of ${r.dur}, ${r.eof ? 'at the end' : 'far in'}: it should start from the beginning`);
      // Whichever load the bug would hit depends on what ran before, so check
      // the cure itself too: mpv is locked onto the output it is using.
      if (r.locked !== r.cur) throw new Error(`mpv's output is not locked to the one that worked: using ${r.cur}, option still ${r.locked}`);
    });

    // Opening a video used to leave the in-app music engine playing under it.
    // Its time updates overwrote the app's clock, and its late 'pause' marked
    // the app as stopped while the film played, so PiP then refused.
    await step('opening a video while music plays: the music stops and the video owns the player', async () => {
      const r = await page.evaluate(async ([tone, vid]) => {
        bmApp.switchDest('music'); bmMusic.engineEnabled = true; bmMusic.play(tone, 0);
        await new Promise(res => setTimeout(res, 1500));
        const before = bmMusic.engineOwns();
        bmApp.playMedia([vid]);
        await new Promise(res => setTimeout(res, 3500));
        const mpvT = await window.api.mpv.cmd('get_property', 'time-pos');
        const g = n => window.api.mpv.cmd('get_property', n);
        return { before, engineOwns: bmMusic.engineOwns(), enginePaused: bmMusic.engine.el.paused, playing: bmApp.isPlaying,
                 appT: bmApp.currentTime, mpvT: typeof mpvT === 'number' ? mpvT : null,
                 mpvPath: String(await g('path')).split(/[\\/]/).pop(), mpvIdle: await g('idle-active'), mpvPause: await g('pause'), hasVideo: bmApp._hasVideo };
      }, [TONE, VIDEO]);
      if (!r.before) throw new Error('the music was not playing in the engine to begin with');
      if (r.engineOwns || !r.enginePaused) throw new Error('the music engine kept playing under the video: ' + JSON.stringify(r));
      if (!r.playing) throw new Error('the app thinks nothing is playing while the video plays: ' + JSON.stringify(r));
      if (r.mpvT === null || Math.abs(r.appT - r.mpvT) > 1.5) throw new Error(`the app's clock (${r.appT}) does not follow the video (${r.mpvT})`);
    });

    await step('mpv plays a real video inside the window', async () => {
      await page.evaluate(f => bmApp.playMedia([f]), VIDEO);
      await page.waitForTimeout(3000);
      const s = await page.evaluate(() => ({ v: bmApp._hasVideo, t: bmApp.currentTime, p: bmApp.isPlaying,
        viz: document.body.classList.contains('audio-viz') }));
      if (!s.v) throw new Error('mpv did not report a video track');
      if (!(s.t > 0.5)) throw new Error('time did not advance: ' + s.t);
      if (s.viz) throw new Error('music overlay drawn over the video');
      await shot('mpv-video');
    });

    // Lite (v3.23.0): mpv draws into its own window laid over the page's video
    // area only. It used to draw into the whole Lite window, and on Windows the
    // controls disappeared behind the picture. The bar is now below the
    // picture, solid, and the video window must sit exactly over the area.
    await step('Lite: the picture sits above a solid control bar, in a window fitted to it', async () => {
      await page.waitForTimeout(400);
      const pg = await page.evaluate(async () => {
        const { videoRect } = await import('./js/lite-video.js');
        const bar = document.getElementById('controls-bar'), b = bar.getBoundingClientRect(), cs = getComputedStyle(bar);
        return { lite: document.documentElement.classList.contains('lite-window'), rect: videoRect(),
                 bar: { top: b.top, height: b.height, opacity: +cs.opacity, position: cs.position } };
      });
      if (!pg.lite) throw new Error('the page does not know it is the Lite build');
      if (!pg.rect) throw new Error('no video area reported while a video plays');
      if (pg.rect.y + pg.rect.height > pg.bar.top + 1) throw new Error(`the picture (to ${pg.rect.y + pg.rect.height}) runs over the control bar (from ${pg.bar.top})`);
      if (pg.bar.opacity < 1 || pg.bar.position !== 'relative' || pg.bar.height < 40) throw new Error('the control bar is not a solid bar below the picture: ' + JSON.stringify(pg.bar));
      const w = await app.evaluate(({ BaseWindow }) => {
        const all = BaseWindow.getAllWindows();
        const v = all.find(x => x.getTitle() === 'BM Player Lite video'), m = all.find(x => x !== v && x.getTitle() !== 'BM Player Lite video');
        return v && m ? { visible: v.isVisible(), v: v.getBounds(), c: m.getContentBounds() } : null;
      });
      if (!w) throw new Error('the Lite build has no video window');
      if (!w.visible) throw new Error('the video window is hidden while a video plays');
      const want = { x: w.c.x + pg.rect.x, y: w.c.y + pg.rect.y, width: pg.rect.width, height: pg.rect.height };
      const off = Math.max(...['x', 'y', 'width', 'height'].map(k => Math.abs(w.v[k] - want[k])));
      if (off > 2) throw new Error(`the video window is at ${JSON.stringify(w.v)}, the video area at ${JSON.stringify(want)}`);
      console.log(`      (picture ${pg.rect.width}x${pg.rect.height} above a ${Math.round(pg.bar.height)}px control bar)`);
    });

    // Lite (v3.25.3): the title bar and menus stay above the picture, and a
    // prompt appears over the menu row. The picture used to shrink when the
    // resume or "make default" prompt came up and grow back when it closed.
    await step('Lite: prompts sit over the menu row and the picture does not move', async () => {
      const r = await page.evaluate(async () => {
        const { videoRect } = await import('./js/lite-video.js');
        const settle = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const tb = document.querySelector('.titlebar'), mt = document.querySelector('.menu-toolbar');
        const before = videoRect();
        const p = document.getElementById('default-player-prompt'); const was = p.classList.contains('hidden');
        p.classList.remove('hidden'); await settle();
        const during = videoRect(), pr = p.getBoundingClientRect();
        if (was) p.classList.add('hidden');
        return { before, during, prompt: { top: pr.top, bottom: pr.bottom }, menuBottom: mt.getBoundingClientRect().bottom,
                 titleOpacity: +getComputedStyle(tb).opacity };
      });
      if (!r.before) throw new Error('no video area while a video plays');
      if (r.titleOpacity < 1) throw new Error('the title bar fades over the picture in Lite');
      if (r.before.y < r.menuBottom - 1) throw new Error(`the picture (from ${r.before.y}) covers the menus (to ${r.menuBottom})`);
      if (JSON.stringify(r.before) !== JSON.stringify(r.during)) throw new Error(`the picture moved when a prompt came up: ${JSON.stringify(r.before)} became ${JSON.stringify(r.during)}`);
      if (r.prompt.top < 31 || r.prompt.bottom > r.before.y + 1) throw new Error(`the prompt is not over the menu row: ${r.prompt.top} to ${r.prompt.bottom}, the picture starts at ${r.before.y}`);
    });

    // On a real machine the "make BM Player the default" prompt sat right on a
    // subtitle line: during video, prompts were placed just above the controls,
    // which is where subtitles are drawn. They now go to the top.
    await step('prompts stay clear of the subtitle area while a video plays', async () => {
      const r = await page.evaluate(async () => {
        const p = document.createElement('div');
        p.className = 'resume-prompt'; p.textContent = 'test prompt'; p.style.padding = '14px 20px';
        // First in the queue: Lite shows one prompt at a time (v3.25.3).
        document.getElementById('toast-stack').prepend(p);
        await new Promise(res => setTimeout(res, 100));
        const b = p.getBoundingClientRect(), H = window.innerHeight;
        p.remove();
        return { top: b.top, bottom: b.bottom, H, playing: document.body.classList.contains('playing'), lite: document.documentElement.classList.contains('lite-window') };
      });
      if (!r.playing) throw new Error('no video playing at this point');
      if (r.bottom > r.H * 0.6) throw new Error(`the prompt reaches ${Math.round(r.bottom)}px of ${r.H}: into the bottom of the picture, where subtitles go`);
      // The full layout: below the title bar and menus, which fade over the
      // picture. Lite (v3.25.3): over the menu row, which stays put, so the
      // picture below never moves when a prompt comes or goes.
      if (r.lite) { if (r.top < 31 || r.bottom > 66) throw new Error(`in Lite the prompt belongs over the menu row (32 to 64px), not at ${Math.round(r.top)} to ${Math.round(r.bottom)}`); }
      else if (r.top < 60) throw new Error(`the prompt is under the title bar and menus (top ${Math.round(r.top)}px)`);
    });

    await step('PiP resizes the real window and restores it', async () => {
      const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
      await page.evaluate(() => bmApp.togglePiP(true)); await page.waitForTimeout(900);
      // Read until it settles, up to 1.5 s more (Windows applies some of it late).
      let inPip;
      for (let i = 0; i < 7; i++) {
        inPip = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { b: w.getBounds(), top: w.isAlwaysOnTop() }; });
        if (inPip.b.width <= 700 && inPip.top) break;
        await page.waitForTimeout(250);
      }
      await shot('pip');
      await page.evaluate(() => bmApp.togglePiP(false)); await page.waitForTimeout(900);
      const after = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
      if (inPip.b.width > 700 || !inPip.top) throw new Error('did not enter PiP: ' + JSON.stringify(inPip));
      if (Math.abs(after.width - before.width) > 2 || Math.abs(after.height - before.height) > 2) {
        throw new Error(`restored to ${after.width}x${after.height}, was ${before.width}x${before.height}`);
      }
    });

    // Reported on a real machine: in PiP, pause, seek and the other controls
    // did nothing. The PiP overlay covered the whole little window and caught
    // every click. The step above only measured window sizes. These click.
    await step('in PiP the controls respond to real clicks', async () => {
      await page.evaluate(() => { if (!bmApp.isPlaying) bmApp.togglePlay(); });
      await page.evaluate(() => bmApp.togglePiP(true)); await page.waitForTimeout(900);
      const playing = () => page.evaluate(() => bmApp.isPlaying);
      let was, afterMain, afterBar;
      try {
        was = await playing();
        await page.click('#btn-play', { timeout: 3000 });           // refuses if anything covers it
        await page.waitForTimeout(600);
        afterMain = await playing();
        await page.hover('#pip-overlay .pip-bar', { timeout: 3000 }).catch(() => {});
        await page.click('#pip-play', { timeout: 3000 });
        await page.waitForTimeout(600);
        afterBar = await playing();
      } finally {
        // leave PiP whatever happened, so the next step starts clean
        await page.evaluate(() => bmApp.togglePiP(false)); await page.waitForTimeout(900);
      }
      if (!was) throw new Error('nothing was playing when PiP opened');
      if (afterMain) throw new Error("clicking the controls' play button in PiP did not pause");
      if (!afterBar) throw new Error("clicking the PiP bar's play button did not resume");
    });

    // Also reported: PiP would not open while playback was paused.
    await step('PiP opens from a paused video', async () => {
      await page.evaluate(() => { if (bmApp.isPlaying) bmApp.togglePlay(); }); await page.waitForTimeout(600);
      const width = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds().width);
      if (await width() <= 700) throw new Error('the window was already small before this step: a previous step left PiP on');
      await page.evaluate(() => bmApp.togglePiP(true)); await page.waitForTimeout(900);
      const r = { w: await width() };
      const paused = await page.evaluate(() => !bmApp.isPlaying);
      await page.evaluate(() => bmApp.togglePiP(false)); await page.waitForTimeout(900);
      if (!paused) throw new Error('the video was not paused for this step');
      if (r.w > 700) throw new Error('PiP did not open while paused');
    });

    await step('stop after video: idle, home, nothing reads as playing', async () => {
      await page.evaluate(() => bmApp.stop()); await page.waitForTimeout(800);
      const s = await page.evaluate(() => ({ p: bmApp.isPlaying, home: document.getElementById('welcome-screen').classList.contains('active'),
        mini: document.getElementById('music-mini-player').classList.contains('hidden') }));
      if (s.p || !s.home || !s.mini) throw new Error(JSON.stringify(s));
    });
  } else {
    console.log('  (ffmpeg unavailable: mpv video steps skipped)');
  }

  // The exact visualiser (v3.29.0): a song mpv plays is measured from a
  // silent copy that follows mpv (audio-shadow.js); the visualiser drew a
  // made-up animation for it before. A 1500 Hz tone must peak where 1500 Hz
  // belongs and fall silent when paused, and the copy must follow a seek and
  // stop with playback. Smoothing is set to 0 right before each reading (the
  // visualiser sets it every frame), so a reading is the sound of that moment.
  if (TONE1500) {
    await step('a song mpv plays is measured exactly, and follows pause and seek', async () => {
      await page.evaluate(f => bmApp.playMedia([f]), TONE1500); await page.waitForTimeout(3500);
      const read = () => page.evaluate(async () => {
        const a = bmApp.shadow?.analyser; if (!a || !bmApp._shadowOn) return null;
        const d = new Uint8Array(a.frequencyBinCount);
        for (let k = 0; k < 5; k++) { a.smoothingTimeConstant = 0; a.getByteFrequencyData(d); await new Promise(r => setTimeout(r, 50)); }
        let mi = 0; for (let i = 1; i < d.length; i++) if (d[i] > d[mi]) mi = i;
        return { bin: mi, total: d.reduce((x, y) => x + y, 0), want: 1500 / (a.context.sampleRate / a.fftSize), t: bmApp.shadow.el.currentTime, mpv: bmApp.currentTime };
      });
      const on = await read();
      if (!on) throw new Error('no exact visualiser for a song mpv plays');
      if (Math.abs(on.bin - on.want) > 1.01) throw new Error(`the loudest band is ${on.bin}, and 1500 Hz belongs at ${on.want.toFixed(1)}`);
      await page.evaluate(() => bmApp.api.mpv.cmd('set_property', 'pause', true)); await page.waitForTimeout(700);
      const off = await read();
      if (!(off.total < on.total * 0.1)) throw new Error(`paused, but the spectrum is still at ${off.total} (playing: ${on.total})`);
      await page.evaluate(() => bmApp.api.mpv.cmd('set_property', 'pause', false));
      await page.evaluate(() => bmApp.seekTo(12)); await page.waitForTimeout(1500);
      const sk = await read();
      if (Math.abs(sk.t - sk.mpv) > 0.6) throw new Error(`after a seek the copy is at ${sk.t.toFixed(2)}s and mpv at ${sk.mpv.toFixed(2)}s`);
      await page.evaluate(() => bmApp.stop()); await page.waitForTimeout(300);
      if (await page.evaluate(() => bmApp._shadowOn || !!bmApp.shadow?.active)) throw new Error('the copy kept going after stop');
    });
  }

  await step('no page errors during playback', () => {
    const bad = consoleMsgs.filter(m => m.type === 'pageerror' || (m.type === 'error' && !NOISE.test(m.text)));
    if (bad.length) throw new Error(bad.map(m => m.text).join(' | ').slice(0, 300));
  });
}

if (PART === 'c') {
  /* xwininfo lists top-level windows top-most first. This was confirmed by
     running these checks against the unfixed window-order code, where the
     picture window came first. */
  const stack = () => {
    const out = execFileSync('xwininfo', ['-root', '-children'], { timeout: 5000 }).toString();
    const names = [...out.matchAll(/^\s*0x[0-9a-f]+ "(BM Player(?: BG)?)"/gm)].map(m => m[1]);
    return { front: names.indexOf('BM Player'), back: names.indexOf('BM Player BG') };
  };
  const controlsOnTop = what => {
    const st = stack();
    if (st.front < 0 || st.back < 0) throw new Error(`${what}: could not find both windows in the X stack`);
    if (st.front > st.back) throw new Error(`${what}: the picture window is above the controls window`);
  };
  const bounds = () => app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows()
    .map(w => ({ t: w.getTitle(), b: w.getBounds(), top: w.isAlwaysOnTop() })));
  const xshot = name => { try { execFileSync('import', ['-window', 'root', path.join(SHOTS, `c-${name}.png`)], { timeout: 8000 }); } catch {} };

  await step('two windows, video drawn in the one behind', async () => {
    const ws = await bounds();
    if (ws.length !== 2) throw new Error(ws.length + ' windows');
    const layered = await page.evaluate(() => document.documentElement.classList.contains('bm-layered'));
    if (!layered) throw new Error('page is not in the layered mode that lets the picture show through');
  });

  // The picture window must cover exactly what the controls window shows
  // (v3.26.1): on a real machine it ended about 8px short of the right and
  // bottom edges, and the desktop showed through there like frosted glass.
  // Knock it out of step and it must be put back; resize the controls window
  // and it must follow. The diagnostics report says where both windows are.
  await step('the picture window stays exactly under the controls window', async () => {
    const cb = () => app.evaluate(({ BaseWindow, BrowserWindow }) => {
      const c = BrowserWindow.getAllWindows()[0], p = BaseWindow.getAllWindows().find(w => w.getTitle() === 'BM Player BG');
      return { c: c.getContentBounds(), p: p.getContentBounds() };
    });
    const same = r => ['x', 'y', 'width', 'height'].every(k => Math.abs(r.c[k] - r.p[k]) <= 1);
    await app.evaluate(({ BaseWindow }) => {
      const p = BaseWindow.getAllWindows().find(w => w.getTitle() === 'BM Player BG'), b = p.getContentBounds();
      p.setContentBounds({ ...b, width: b.width - 10, height: b.height - 10 });
    });
    if (same(await cb())) throw new Error('could not knock the picture window out of step to test it');
    await page.waitForTimeout(1500);
    const back = await cb();
    if (!same(back)) throw new Error(`the picture window stayed out of step: controls ${JSON.stringify(back.c)}, picture ${JSON.stringify(back.p)}`);
    const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0], b = w.getBounds(); w.setBounds({ ...b, width: b.width + 40, height: b.height + 30 }); });
    await page.waitForTimeout(400);
    const resized = await cb();
    await app.evaluate(({ BrowserWindow }, b) => BrowserWindow.getAllWindows()[0].setBounds(b), before);
    await page.waitForTimeout(400);
    if (!same(resized)) throw new Error(`after a resize the picture window did not follow: controls ${JSON.stringify(resized.c)}, picture ${JSON.stringify(resized.p)}`);
    const d = await page.evaluate(() => window.api?.app?.diagnostics?.());
    if (!d?.windows?.controls || !d.windows.picture) throw new Error('the diagnostics report does not say where the windows are');
  });

  // The pin (v3.27.0): on every window at once. It went to the picture window
  // only, and a file dialog left the controls window on top along with it, so
  // turning the pin off left the window you see above everything. It is no
  // longer saved either: a pin turned on once came back at every launch.
  await step('the pin sets and releases every window, and is not saved', async () => {
    const tops = () => app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows().map(w => w.isAlwaysOnTop()));
    if (await page.evaluate(() => bmApp.alwaysOnTop || localStorage.getItem('bm_ontop') !== null)) throw new Error('the player started pinned, or a pin was saved');
    await page.evaluate(() => bmApp.toggleAlwaysOnTop());
    await page.waitForTimeout(200);
    const on = await tops();
    if (!on.every(Boolean)) throw new Error('pinned, but not every window is on top: ' + JSON.stringify(on));
    await page.evaluate(() => bmApp.toggleAlwaysOnTop());
    // The old trap: the controls window left on top by itself, then the pin on and off.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setAlwaysOnTop(true));
    await page.evaluate(() => { bmApp.toggleAlwaysOnTop(); bmApp.toggleAlwaysOnTop(); });
    await page.waitForTimeout(200);
    const off = await tops();
    if (off.some(Boolean)) throw new Error('unpinned, but a window is still on top: ' + JSON.stringify(off));
    if (await page.evaluate(() => localStorage.getItem('bm_ontop') !== null)) throw new Error('the pin was saved');
  });

  if (VIDEO) {
    let normal;
    await step('controls sit above the video while it plays', async () => {
      normal = (await bounds()).map(w => w.b);
      await page.evaluate(f => bmApp.playMedia([f]), VIDEO);
      await page.waitForTimeout(2200);
      const t = await page.evaluate(() => bmApp.currentTime);
      if (!(t > 0.5)) throw new Error('video did not play: t=' + t);
      xshot('playing');
      controlsOnTop('playing');
    });

    await step('PiP moves both windows together, controls still on top', async () => {
      await page.evaluate(() => bmApp.togglePiP(true)); await page.waitForTimeout(1000);
      xshot('pip');
      const ws = await bounds();
      const [a, b] = ws.map(w => w.b);
      if (a.width > 700) throw new Error('did not shrink');
      if (a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height) {
        throw new Error('picture and controls windows differ: ' + JSON.stringify(ws.map(w => w.b)));
      }
      if (!ws.every(w => w.top)) throw new Error('both windows must stay on top in PiP');
      controlsOnTop('in PiP');
    });

    await step('leaving PiP restores both windows, controls still on top', async () => {
      await page.evaluate(() => bmApp.togglePiP(false)); await page.waitForTimeout(1000);
      xshot('after-pip');
      const ws = (await bounds()).map(w => w.b);
      for (const [i, w] of ws.entries()) {
        if (Math.abs(w.width - normal[i].width) > 2 || Math.abs(w.height - normal[i].height) > 2) {
          throw new Error(`window ${i} came back ${w.width}x${w.height}, was ${normal[i].width}x${normal[i].height}`);
        }
      }
      controlsOnTop('after PiP');
    });

    // v3.37.0: full screen is the whole screen, and a double-click on the
    // picture leads there and back. A real double-click, through the page.
    await step('a double-click on the picture fills the screen, and another brings the window back', async () => {
      const before = (await bounds()).map(w => w.b);
      const disp = await app.evaluate(({ BrowserWindow, screen }) => screen.getDisplayMatching(BrowserWindow.getAllWindows()[0].getBounds()).bounds);
      const same = (a, b) => Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2 && Math.abs(a.width - b.width) <= 2 && Math.abs(a.height - b.height) <= 2;
      const middle = () => page.evaluate(() => ({ x: Math.round(innerWidth / 2), y: Math.round(innerHeight * 0.45) }));
      let m = await middle();
      await page.mouse.dblclick(m.x, m.y); await page.waitForTimeout(1200);
      if (!(await page.evaluate(() => bmApp.api.win.isFs()))) throw new Error('the double-click did not lead to full screen');
      if (!(await page.evaluate(() => document.documentElement.classList.contains('is-fs')))) throw new Error('the page does not know it is in full screen');
      const full = (await bounds()).map(w => w.b);
      xshot('full-screen');
      // On Linux it is the window manager that makes a window full screen, and
      // a bare test display has none: there the state is all that can be checked.
      if (process.platform === 'linux' && full.every((w, i) => same(w, before[i]))) console.log('      (no window manager here to resize the window: the state was checked, the window was not)');
      else {
        if (!full.every(w => same(w, disp))) throw new Error('not the whole screen (' + disp.width + 'x' + disp.height + '): ' + JSON.stringify(full));
        controlsOnTop('in full screen');
      }
      m = await middle();
      await page.mouse.dblclick(m.x, m.y); await page.waitForTimeout(1200);
      if (await page.evaluate(() => bmApp.api.win.isFs())) throw new Error('the second double-click did not leave full screen');
      if (await page.evaluate(() => document.documentElement.classList.contains('is-fs'))) throw new Error('the page still thinks it is in full screen');
      const after = (await bounds()).map(w => w.b);
      after.forEach((w, i) => { if (!same(w, before[i])) throw new Error(`window ${i} came back as ${JSON.stringify(w)}, was ${JSON.stringify(before[i])}`); });
      controlsOnTop('after full screen');
    });

    await step('stop shows the home screen, not the empty picture window', async () => {
      await page.evaluate(() => bmApp.stop()); await page.waitForTimeout(900);
      xshot('stopped');
      const home = await page.evaluate(() => document.getElementById('welcome-screen').classList.contains('active'));
      if (!home) throw new Error('not home');
      controlsOnTop('after stop');
    });
  } else {
    console.log('  (ffmpeg unavailable: video steps skipped)');
  }
  // The artistic themes (v3.27.0): each draws a scene of its own instead of
  // the fluid every theme shared. Dark, Light, Dracula and Snow keep theirs.
  // Full visuals here: a small machine switches to Lite's on its own. Last in
  // part C, because it reloads the page.
  await step('each artistic theme draws its own scene, the standard four keep theirs', async () => {
    await page.evaluate(() => { localStorage.setItem('bm_lite_user', '0'); localStorage.setItem('bm_fluid_enabled', '1'); });
    await page.reload(); await page.waitForFunction(() => window.bmApp, null, { timeout: 30000 });
    const r = await page.evaluate(async () => {
      const out = {};
      // The canvas fades in over 0.5s: without the fade the opacity read is
      // the final one, however slow the machine.
      if (bmApp.themeFX?.canvas) bmApp.themeFX.canvas.style.transition = 'none';
      for (const t of ['ocean', 'forest', 'cyberpunk', 'midnight', 'sakura', 'sunset', 'golden', 'lavender', 'glass', 'dark', 'light', 'dracula', 'snow']) {
        bmApp.applyTheme(t); await new Promise(res => setTimeout(res, 300));
        const fx = bmApp.themeFX;
        out[t] = { mode: fx?.mode, scene: !!fx?._scene, shown: fx ? +getComputedStyle(fx.canvas).opacity : null };
      }
      bmApp.applyTheme('dark');
      return out;
    });
    const keep = { dark: 'off', dracula: 'blood', snow: 'snow' };   // light has its own scene since v3.34.0
    for (const [t, v] of Object.entries(r)) {
      if (keep[t]) { if (v.mode !== keep[t]) throw new Error(`${t} changed: ${v.mode}, expected ${keep[t]}`); continue; }
      if (v.mode !== 'scene:' + t || !v.scene) throw new Error(`${t} has no scene of its own: ${JSON.stringify(v)}`);
      if (!(v.shown > 0.9)) throw new Error(`${t}'s scene is drawn on a hidden canvas (opacity ${v.shown})`);
    }
  });

  // The Flow theme (v3.28.0): Northern is the fluid again, with its own
  // controls in the theme customizer, and Dark and Light keep the standard
  // fluid. And the fox (v3.28.0): its head turns from the neck, so the base
  // of its chest stays put instead of floating like a balloon.
  await step('the Flow theme is the fluid with its own controls, and the fox stays put', async () => {
    const r = await page.evaluate(async () => {
      bmApp.applyTheme('northern'); await new Promise(res => setTimeout(res, 300));
      const fx = bmApp.auroraFX, a = { mode: fx?.mode, palette: fx?.flow?.palette, scene: bmApp.themeFX?.mode };
      const i = document.getElementById('tc-flow-intensity'); i.value = 150; i.dispatchEvent(new Event('input'));
      const b = { intensity: fx?.flow?.intensity, kept: JSON.parse(localStorage.getItem('bm_flow') || '{}').intensity };
      document.getElementById('tc-flow-reset').click();
      bmApp.applyTheme('dark'); await new Promise(res => setTimeout(res, 300));
      const c = { palette: fx?.flow?.palette, intensity: fx?.flow?.intensity };
      let fox = null;
      if (bmApp.fox?._pose) {
        const st = bmApp.fox._state, ys = { base: [], ear: [] };
        st.energy = st.energyS = 0.9; st.perkUntil = st.t0 + 3000;
        for (let k = 0; k < 200; k++) {
          st.lastMove = 0; if (k % 20 === 0) st.energyS = k % 40 ? 0.9 : 0.1;
          const m = bmApp.fox._pose(st.t0 + k * 50).model.flat(), y = ([x, Y, z]) => m[1] * x + m[5] * Y + m[9] * z + m[13];
          ys.base.push(y([0, -2.08, 0])); ys.ear.push(y([-0.96, 1.8, 0]));
        }
        const span = q => Math.max(...q) - Math.min(...q);
        fox = { base: span(ys.base), ear: span(ys.ear) };
      }
      return { a, b, c, fox };
    });
    if (r.a.mode !== 'fluid' || r.a.palette !== 'northern' || r.a.scene !== 'off') throw new Error('Flow is not the fluid with Northern lights: ' + JSON.stringify(r.a));
    if (r.b.intensity !== 1.5 || r.b.kept !== 1.5) throw new Error('the intensity control did not reach the fluid, or was not kept: ' + JSON.stringify(r.b));
    if (r.c.palette !== null || r.c.intensity !== 1) throw new Error('Dark did not get the standard fluid back: ' + JSON.stringify(r.c));
    if (r.fox && !(r.fox.base < 0.06 && r.fox.ear > 0.1)) throw new Error('the fox floats: its base moves ' + r.fox.base.toFixed(3) + ', its ear ' + r.fox.ear.toFixed(3));
  });

  // The fox (v3.30.1): only its head turns, the chest stays where it is (it
  // swayed as one piece, like a balloon), and the pointer above it makes it
  // look up (it looked down). Real pixels for the first, the head's pose for
  // the second.
  await step('only the fox\'s head turns, and it looks up at a pointer above it', async () => {
    const r = await page.evaluate(() => {
      const fox = bmApp.fox, fc = document.getElementById('fox-canvas');
      if (!fox?.renderAt || !fc) return { none: true };
      const grab = (yaw, pitch) => {
        fox.renderAt(yaw, pitch);
        const c = document.createElement('canvas'); c.width = fc.width; c.height = fc.height;
        const x = c.getContext('2d'); x.drawImage(fc, 0, 0); return { d: x.getImageData(0, 0, c.width, c.height).data, m: fox._model.slice() };
      };
      const a = grab(-28, 0), b = grab(28, 0), up = grab(0, -14), down = grab(0, 14);
      fox.releaseAngle?.();
      const W = fc.width, H = fc.height;
      const diff = (y0, y1) => { let n = 0, t = 0; for (let y = Math.floor(H * y0); y < Math.floor(H * y1); y++) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; t++; if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) > 60) n++; } return n / t; };
      // the chest's band: just above the bottom of the drawn fox
      let bottom = 0; for (let y = H - 1; y > 0 && !bottom; y--) for (let x = 0; x < W; x += 3) if (a.d[(y * W + x) * 4 + 3] > 40) { bottom = y / H; break; }
      const noseY = m => m[1] * 0 + m[5] * -1.24 + m[9] * 1.5 + m[13];
      return { head: diff(0.12, 0.5), chest: diff(bottom - 0.07, bottom), up: noseY(up.m), down: noseY(down.m) };
    });
    if (r.none) return;
    if (!(r.head > 0.04)) throw new Error('the head did not turn: ' + JSON.stringify(r));
    if (!(r.chest < r.head * 0.25)) throw new Error(`the chest moves with the head (${(r.chest * 100).toFixed(1)}% of its pixels changed, the head ${(r.head * 100).toFixed(1)}%)`);
    if (!(r.up > r.down)) throw new Error('with the pointer above, the fox looks down');
    console.log(`      (turned: head ${(r.head * 100).toFixed(1)}% of its pixels changed, chest ${(r.chest * 100).toFixed(1)}%)`);
  });

  // The visual mode (v3.30.1): when the controls fade, the title row moves to
  // the bottom (it left an empty band), maximised the side pane hides, and
  // Radial with Spin off stands still.
  await step('the visual mode: no empty band, no side pane when maximised, Radial still with Spin off', async () => {
    const r = await page.evaluate(async t => {
      bmApp.switchDest('music'); bmMusic.play(t, 0); await new Promise(z => setTimeout(z, 1200));
      bmApp.switchDest('video'); await new Promise(z => setTimeout(z, 900));
      const v = bmApp.viz; const bar = document.getElementById('controls-bar');
      // The row slides down over 0.28 s, counted in drawn frames: on a machine that draws few of them it takes longer.
      bar.classList.add('faded');
      let band = 999; for (let i = 0; i < 30 && band > 2; i++) { await new Promise(z => setTimeout(z, 100)); band = Math.round(innerHeight - document.querySelector('.viz-overlay').getBoundingClientRect().bottom); }
      document.documentElement.classList.add('is-max'); await new Promise(z => setTimeout(z, 600));
      const pane = +getComputedStyle(document.querySelector('.sidebar')).opacity;
      document.documentElement.classList.remove('is-max');
      const spins = async on => { v.setOptions({ style: 'radial', spin: on }); v.setMode('radial'); let n = 0; const rot = v.ctx.rotate.bind(v.ctx); v.ctx.rotate = a => { n++; rot(a); }; await new Promise(z => setTimeout(z, 700)); v.ctx.rotate = rot; return n; };
      const still = await spins(false), turning = await spins(true);
      v.setOptions({ style: 'bars', spin: true }); v.setMode('bars'); bar.classList.remove('faded'); bmMusic.engine?.stop?.();
      return { band, pane, still, turning, viz: document.body.classList.contains('audio-viz') };
    }, TONE);
    if (!r.viz) throw new Error('the visual mode did not show');
    if (r.band > 2) throw new Error(`an empty band of ${r.band}px under the title row`);
    if (r.pane > 0.05) throw new Error('maximised, the side pane is still shown');
    if (r.still !== 0) throw new Error(`Radial turned ${r.still} times with Spin off`);
    if (!(r.turning > 0)) throw new Error('Radial did not turn with Spin on');
  });

  // The artistic styles (v3.31.0): Neon (wandering lanterns trailing glowing
  // wisps), Bubbles (glowing rings rising in columns) and Particles, which
  // stayed in a small patch in the middle and now reaches every edge. Each
  // draws with music, and with the music paused nothing new is made. And the
  // visual mode hides the side pane, which comes back at the left edge.
  await step('Neon, Bubbles and Particles draw with the music, Particles fills the screen, the side pane hides', async () => {
    await page.evaluate(async t => { bmApp.switchDest('music'); bmMusic.play(t, 0); await new Promise(z => setTimeout(z, 1200)); bmApp.switchDest('video'); await new Promise(z => setTimeout(z, 800)); }, TONE);
    // The pane fades over a quarter of a second, counted in drawn frames: it is
    // given up to three seconds to get there, for a machine that draws few.
    const pane = async there => { let o = -1; for (let i = 0; i < 30; i++) { await page.waitForTimeout(100); o = await page.evaluate(() => +getComputedStyle(document.querySelector('.sidebar')).opacity); if (i >= 2 && there(o)) break; } return o; };
    await page.mouse.move(600, 300);
    const paneHidden = await pane(o => o <= 0.05);
    await page.mouse.move(4, 300);
    const panePeek = await pane(o => o >= 0.95);
    await page.mouse.move(600, 300);
    const paneBack = await pane(o => o <= 0.05);
    const r = await page.evaluate(async () => {
      const v = bmApp.viz, out = {};
      const lit = () => {
        // Neon draws on the graphics card since v3.38.0, into a canvas of its own:
        // that is copied to a 2D one to be read.
        let c = v.canvas;
        if (v.mode === 'neon' && v._neonCanvas && v._neonCanvas.style.display !== 'none') {
          const t = document.createElement('canvas'); t.width = v._neonCanvas.width; t.height = v._neonCanvas.height;
          t.getContext('2d').drawImage(v._neonCanvas, 0, 0); c = t;
        }
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
        let n = 0, edges = { l: 0, r: 0, t: 0, b: 0 };
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {   // finer, so thin lines are not missed (v3.33.0)
          if (d[(y * W + x) * 4 + 3] < 25) continue; n++;
          if (x < W * 0.15) edges.l++; if (x > W * 0.85) edges.r++; if (y < H * 0.15) edges.t++; if (y > H * 0.85) edges.b++;
        }
        return { share: n / ((W / 2) * (H / 2)), edges };
      };
      const el2 = bmMusic.engine.el; el2.loop = true;
      for (const [style, key, list] of [['neon', '_neon', 'p'], ['bubbles', '_bub', 'b'], ['particles', '_pt', 'p']]) {
        // Sound first (v3.33.0): playing, and loud enough to be heard, before
        // a style is judged on what it draws.
        if (el2.paused) await el2.play().catch(() => {});
        for (let i = 0; i < 30 && !(v._loudness() > 0.01); i++) await new Promise(z => setTimeout(z, 100));
        v.setOptions({ style }); v.setMode(style);
        // Two and a half seconds, and at least 70 drawn frames: a style moves by
        // the frame, and a machine that draws few of them a second had not yet
        // carried its particles to the sides (nine seconds at the most).
        { const k0 = v._tick, t0 = performance.now(); while (performance.now() - t0 < 2500 || (v._tick - k0 < 70 && performance.now() - t0 < 9000)) await new Promise(z => setTimeout(z, 100)); }
        // what it has made in all: on screen, long-lived wisps outlast a short wait
        const playing = lit(), made = v[key]?.made || 0;
        bmMusic.engine.el.pause(); await new Promise(z => setTimeout(z, 600));
        const paused = v[key]?.made || 0; await new Promise(z => setTimeout(z, 1500));
        const after = (v[key]?.made || 0) - paused;
        bmMusic.engine.el.play(); await new Promise(z => setTimeout(z, 600));
        out[style] = { share: playing.share, edges: playing.edges, made, after, gl: style === 'neon' ? !!v._neonR : undefined };
      }
      v.setOptions({ style: 'bars' }); v.setMode('bars'); bmMusic.engine?.stop?.();
      return out;
    });
    if (paneHidden > 0.05) throw new Error('the side pane shows in the visual mode');
    if (panePeek < 0.95) throw new Error('the side pane did not come back at the left edge');
    if (paneBack > 0.05) throw new Error('the side pane did not hide again');
    for (const [style, x] of Object.entries(r)) {
      if (!(x.share > 0.004)) throw new Error(`${style} drew nothing with music playing`);
      if (!(x.made > 0)) throw new Error(`${style} made nothing with music playing`);
      if (x.after !== 0) throw new Error(`${style} made ${x.after} more with the music paused`);
    }
    const e = r.particles.edges;
    if (!(e.l && e.r && e.t && e.b)) throw new Error('Particles does not reach every edge: ' + JSON.stringify(e));
    // WebGL works here (the fluid uses it), so Neon has to have drawn with it.
    if (!r.neon.gl) throw new Error('Neon drew in 2D where WebGL was there to draw with');
    console.log(`      (lit: neon ${(r.neon.share * 100).toFixed(1)}% on the graphics card, bubbles ${(r.bubbles.share * 100).toFixed(1)}%, particles ${(r.particles.share * 100).toFixed(1)}%, at every edge)`);
  });

  // MilkDrop (v3.32.0): butterchurn plays the presets, which come ready-built,
  // so nothing is evaluated: a security-policy violation would mean an eval.
  await step('MilkDrop plays its presets, with nothing evaluated', async () => {
    const r = await page.evaluate(async t => {
      window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective));
      bmApp.switchDest('music'); bmMusic.play(t, 0); await new Promise(z => setTimeout(z, 1200));
      bmApp.switchDest('video'); await new Promise(z => setTimeout(z, 700));
      const v = bmApp.viz; v.setOptions({ style: 'milkdrop', mdAuto: 0 }); v.setMode('milkdrop');
      for (let i = 0; i < 60 && !v._md && !v._mdFailed; i++) await new Promise(z => setTimeout(z, 250));
      await new Promise(z => setTimeout(z, 1500));
      const first = v._mdName, next = v.mdNext(0); await new Promise(z => setTimeout(z, 600));
      let lit = 0;
      if (v._md) {
        v._drawMilk();   // drawn now, read now: the WebGL buffer is still there
        const c = document.createElement('canvas'); c.width = 64; c.height = 36; const x = c.getContext('2d'); x.drawImage(v._mdCanvas, 0, 0, 64, 36);
        const d = x.getImageData(0, 0, 64, 36).data; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
      }
      // v3.36.0: in the screen's own pixels (times the size it settled on), and every preset loads
      const { MD, MD_SCALES } = await import('./js/visualizer.js');
      const size = v._md ? { w: v._mdW, want: v._mdSize()[0], full: Math.round(v.canvas.offsetWidth * devicePixelRatio), share: MD_SCALES[v._mdLevel()] } : null;
      const bad = [];
      if (v._md) for (const n of v._mdNames) { try { const p = v._mdPresets[n](); if (typeof p.init_eqs !== 'function' || typeof p.frame_eqs !== 'function') bad.push(n); } catch (e) { bad.push(n + ': ' + e.message); } }
      // v3.36.0: the graphics card takes its picture away (as a driver restart
      // does). It makes itself a new canvas and plays on, where it stayed black.
      let lost = null;
      if (v._md) {
        const old = v._mdCanvas, ext = old.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if (ext) {
          ext.loseContext();
          for (let i = 0; i < 80 && (!v._md || v._mdCanvas === old); i++) await new Promise(z => setTimeout(z, 100));
          // A new picture starts black, and on a plain tone some presets stay dark
          // for a while (the first look, above, still had the last preset's
          // picture in it): up to four presets, three seconds each.
          let lit2 = 0; const tried = [];
          for (let p = 0; p < 4 && !lit2 && v._md && v._mdCanvas !== old; p++) {
            if (p) v.mdNext(0);
            tried.push(v._mdName);
            for (let i = 0; i < 15 && !lit2; i++) {
              await new Promise(z => setTimeout(z, 200));
              v._drawMilk();
              const c = document.createElement('canvas'); c.width = 64; c.height = 36; const x = c.getContext('2d'); x.drawImage(v._mdCanvas, 0, 0, 64, 36);
              const d = x.getImageData(0, 0, 64, 36).data; for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] > 30) lit2++;
            }
          }
          lost = { back: !!v._md, fresh: !!v._mdCanvas && v._mdCanvas !== old, gone: !old.isConnected, lit: lit2, tried, canvases: document.querySelectorAll('.viz-milk-canvas').length, failed: !!v._mdFailed };
        }
      }
      const out = { ok: !!v._md, failed: !!v._mdFailed, presets: v._mdNames?.length || 0, first, next, lit, size, bad, lost, csp: window.__csp.slice() };
      // And a card that takes every new picture away at once: it does not go on
      // making canvases for good. After four in a row it draws bars.
      if (lost?.back && lost.fresh) {
        let made = 0;
        for (let n = 0; n < 6 && v._md && !v._mdFailed; n++) {
          const cur = v._mdCanvas; made++;
          cur.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
          for (let i = 0; i < 80 && !v._mdFailed && (!v._md || v._mdCanvas === cur); i++) await new Promise(z => setTimeout(z, 100));
        }
        await new Promise(z => setTimeout(z, 300));
        out.gaveUp = { failed: !!v._mdFailed, more: made, canvases: document.querySelectorAll('.viz-milk-canvas').length, bars: v._inked === true };
        v._mdFailed = false; v._mdLost = 0;   // as it was found
      }
      v.setOptions({ style: 'bars', mdAuto: 30 }); v.setMode('bars'); bmMusic.engine?.stop?.();
      return out;
    }, TONE);
    if (r.lost && !(r.lost.back && r.lost.fresh && r.lost.gone && r.lost.canvases === 1 && !r.lost.failed)) throw new Error('after the graphics card took its picture away MilkDrop did not start again: ' + JSON.stringify(r.lost));
    if (r.gaveUp && !(r.gaveUp.failed && r.gaveUp.more === 3 && r.gaveUp.canvases === 0 && r.gaveUp.bars)) throw new Error('a picture lost four times in a row should end in bars, with no canvas left: ' + JSON.stringify(r.gaveUp));
    if (r.lost && !(r.lost.lit > 0)) throw new Error('MilkDrop started again after losing its picture, and drew nothing (tried: ' + r.lost.tried.join(' | ').slice(0, 200) + ')');
    if (!r.ok || r.failed) throw new Error('MilkDrop did not start');
    if (r.csp.length) throw new Error('the security policy blocked: ' + r.csp.join(', '));
    if (r.presets < 30) throw new Error('only ' + r.presets + ' presets');
    if (r.bad.length) throw new Error('presets that are not ready-built: ' + r.bad.slice(0, 3).join(', '));
    if (!r.next || r.next === r.first) throw new Error('Next did not change the preset');
    if (!(r.lit > 0)) throw new Error('MilkDrop drew nothing');
    if (r.size.w !== r.size.want) throw new Error(`MilkDrop is drawn ${r.size.w} across, not ${r.size.want}`);
    if (r.size.w < r.size.full * r.size.share * 0.95 && r.size.full * r.size.share <= 1920) throw new Error(`MilkDrop is drawn ${r.size.w} across a picture of ${r.size.full} pixels at a share of ${r.size.share}`);
    console.log(`      (${r.presets} presets, drawn ${r.size.w} across a picture of ${r.size.full}, now: ${r.next.slice(0, 40)}${r.lost ? ', and it started again after losing its picture' : ', losing its picture could not be tried here'})`);
  });

  // Album art (v3.32.0): a song with a cover beside it shows the art inside
  // Radial's ring and in the tile by the title.
  await step('Radial shows the album art in its middle', async () => {
    const dir = path.join(FIX, 'album'); fs.mkdirSync(dir, { recursive: true });
    const song = path.join(dir, 'song.wav'); fs.copyFileSync(TONE, song);
    writePng(path.join(dir, 'cover.png'), 96, 96, (x, y) => [x * 2, y * 2, 200]);
    await page.evaluate(f => bmApp.playMedia([f]), song); await page.waitForTimeout(3500);
    const r = await page.evaluate(async () => {
      const v = bmApp.viz; v.setOptions({ style: 'radial' }); v.setMode('radial');
      for (let i = 0; i < 20 && !v._art; i++) await new Promise(z => setTimeout(z, 200));
      // mpv adds the cover beside the song as a track marked albumart, a moment
      // later: the song must stay a song, art and all (v3.35.0, GitHub's run).
      await new Promise(z => setTimeout(z, 1500));
      const out = { art: v._art?.naturalWidth || 0, tile: !!document.getElementById('viz-art')?.classList.contains('has-art'),
        video: bmApp._hasVideo, viz: document.body.classList.contains('audio-viz') };
      v.setOptions({ style: 'bars' }); v.setMode('bars'); bmApp.stop();
      return out;
    });
    if (r.video) throw new Error('the song was taken for a video (its cover art counted as one)');
    if (!r.viz) throw new Error('the song left the visual mode');
    if (r.art !== 96) throw new Error('no album art in the visualiser');
    if (!r.tile) throw new Error('the tile by the title has no art');
  });

  // The gallery (v3.32.0): a card shows a thumbnail, never the original first,
  // which made a page of large photos slow to load.
  await step('the gallery shows thumbnails, not the full photos', async () => {
    const big = path.join(FIX, 'big photo.png');
    writePng(big, 2400, 1600, (x, y) => [(x >> 3) & 255, (y >> 3) & 255, 120]);
    const r = await page.evaluate(async p => {
      const g = window.bmGallery, im = document.createElement('img');
      g._thumbInto(im, p);
      for (let i = 0; i < 80 && im.classList.contains('g-wait'); i++) await new Promise(z => setTimeout(z, 100));
      if (!im.complete) await new Promise(z => { im.onload = z; im.onerror = z; });
      return { w: im.naturalWidth, original: /big%20photo|big photo/.test(decodeURIComponent(im.src)) };
    }, big);
    if (r.original) throw new Error('the card loaded the full photo');
    if (!(r.w > 0 && r.w <= 800)) throw new Error(`the thumbnail is ${r.w}px wide`);
    console.log(`      (a 2400px photo shown at ${r.w}px)`);
  });

  // Visual effects (v3.32.0): Tools has Automatic, Full and Lite, the current
  // one ticked. Choosing one with nothing playing reloads to apply it.
  await step('Tools offers the visual effects, and Lite and Full take effect', async () => {
    await page.evaluate(() => { bmApp.stop(); bmMusic.engine?.stop?.(); });
    const tick = () => page.evaluate(() => [...document.querySelectorAll('.mr[data-a^="fx-"]')].filter(r => r.classList.contains('checked')).map(r => r.dataset.a));
    const rows = await page.evaluate(() => document.querySelectorAll('.mr[data-a^="fx-"]').length);
    const before = await tick();
    await page.evaluate(() => document.querySelector('.mr[data-a="fx-lite"]').click());
    await page.waitForTimeout(1500); await page.waitForFunction(() => window.bmApp, null, { timeout: 30000 }); await page.waitForTimeout(800);
    const lite = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('lite-mode'), stored: localStorage.getItem('bm_lite_user') }));
    const tickLite = await tick();
    await page.evaluate(() => document.querySelector('.mr[data-a="fx-pro"]').click());
    await page.waitForTimeout(1500); await page.waitForFunction(() => window.bmApp, null, { timeout: 30000 }); await page.waitForTimeout(800);
    const full = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('lite-mode'), stored: localStorage.getItem('bm_lite_user') }));
    if (rows !== 3) throw new Error(rows + ' visual effects rows in Tools');
    if (before.length !== 1) throw new Error('no choice ticked');
    if (!lite.cls || lite.stored !== '1' || tickLite[0] !== 'fx-lite') throw new Error('Lite did not take effect: ' + JSON.stringify({ lite, tickLite }));
    if (full.cls || full.stored !== '0') throw new Error('Pro did not take effect: ' + JSON.stringify(full));
    // The switch by the window buttons (v3.33.0): it says Pro or Lite, a
    // press switches, and a note says so once the window has reloaded.
    const pillPro = await page.evaluate(() => document.getElementById('fx-toggle')?.textContent);
    await page.evaluate(() => document.getElementById('fx-toggle').click());
    await page.waitForTimeout(1500); await page.waitForFunction(() => window.bmApp, null, { timeout: 30000 }); await page.waitForTimeout(700);
    const after = await page.evaluate(() => ({ pill: document.getElementById('fx-toggle')?.textContent, lite: document.documentElement.classList.contains('lite-mode'), note: document.querySelector('.fx-note')?.textContent || '' }));
    await page.evaluate(() => document.getElementById('fx-toggle').click());
    await page.waitForTimeout(1500); await page.waitForFunction(() => window.bmApp, null, { timeout: 30000 }); await page.waitForTimeout(700);
    const back = await page.evaluate(() => ({ pill: document.getElementById('fx-toggle')?.textContent, lite: document.documentElement.classList.contains('lite-mode') }));
    if (pillPro !== 'Pro') throw new Error('the switch shows ' + pillPro + ' in Pro mode');
    if (after.pill !== 'Lite' || !after.lite) throw new Error('the switch did not go to Lite: ' + JSON.stringify(after));
    if (!/Switched to Lite mode/.test(after.note)) throw new Error('no note after switching: ' + JSON.stringify(after.note));
    if (back.pill !== 'Pro' || back.lite) throw new Error('the switch did not come back to Pro: ' + JSON.stringify(back));
  });

  // The title bar (v3.33.0): no stacked-layers symbol, and the name in the
  // middle of the window.
  await step('the title bar has the name in the middle, and no stacked symbol', async () => {
    const r = await page.evaluate(() => {
      const b = document.querySelector('.tb-brand')?.getBoundingClientRect();
      return { logo: !!document.querySelector('.tb-logo'), text: document.querySelector('.tb-brand')?.textContent, off: b ? Math.abs(b.left + b.width / 2 - innerWidth / 2) : 999 };
    });
    if (r.logo) throw new Error('the stacked-layers symbol is still there');
    if (r.text !== 'BM Player') throw new Error('the title bar name is ' + r.text);
    if (r.off > 4) throw new Error(`the name is ${r.off.toFixed(1)}px from the middle`);
  });

  // HD Flow (v3.33.0, rebuilt in v3.36.0): the fluid drawn as glowing contour
  // lines, stirred by emitters that wander with the music. It draws while music
  // plays and stops when paused. What is on the screen is looked at too: lines
  // on a dark picture. The version before filled the screen with a pale fog on
  // a machine left on the Low tier, and every check here still passed.
  await step('HD Flow is neon lines that move with the music, and stops with it', async () => {
    const r = await page.evaluate(async t => {
      bmApp.switchDest('music'); bmMusic.play(t, 0); bmMusic.engine.el.loop = true; await new Promise(z => setTimeout(z, 1200));
      bmApp.switchDest('video'); await new Promise(z => setTimeout(z, 700));
      const v = bmApp.viz; v.setOptions({ style: 'flow' }); v.setMode('flow');
      for (let i = 0; i < 30 && !(v._loudness() > 0.01); i++) await new Promise(z => setTimeout(z, 100));
      await new Promise(z => setTimeout(z, 800));
      const f = v._fluid;
      if (!f) { v.setOptions({ style: 'bars' }); v.setMode('bars'); bmMusic.engine?.stop?.(); return { fluid: false }; }
      // the clock: what the fluid was moved on by, against the time that passed
      let moved = 0, steps = 0; const feed = f.onFrame; f.onFrame = (dt, now) => { moved += dt; steps++; return feed(dt, now); };
      const t0 = performance.now(); await new Promise(z => setTimeout(z, 1700)); const passed = (performance.now() - t0) / 1000; f.onFrame = feed;
      const playing = v._fw?.splats || 0, bloom = f?.bloom || 0, neon = !!f?.neon && f.edge > 0, halo = (f?.bloomLevels?.length || 0) >= 2 && !!f?.shaded;
      // what is seen: drawn now, read now
      f._render(); const blending = f.gl.isEnabled(f.gl.BLEND);
      const c = document.createElement('canvas'); c.width = 160; c.height = 90; const x = c.getContext('2d'); x.drawImage(v._fluidCanvas, 0, 0, 160, 90);
      const d = x.getImageData(0, 0, 160, 90).data; let lit = 0, bright = 0;
      for (let i = 0; i < d.length; i += 4) { const m = Math.max(d[i], d[i + 1], d[i + 2]) * d[i + 3] / 255; if (m > 40) lit++; if (m > 150) bright++; }
      const info = { level: f._tier, levels: (f._ladder || []).map(l => l.name), dye: [f.dye.width, f.dye.height], canvas: [f.canvas.width, f.canvas.height], scale: f.cfg.dyeScale, fast: !!f._fastSplat, renderer: f.rendererName() };
      // The graphics card takes the picture away and gives it back, as a driver
      // restart does (v3.36.0): the fluid stops, builds itself again with its
      // lines and its glow, and carries on.
      let back = null;
      const lose = f.gl.getExtension('WEBGL_lose_context');
      if (lose) {
        lose.loseContext(); await new Promise(z => setTimeout(z, 300));
        const stopped = !f._raf;
        lose.restoreContext();
        for (let i = 0; i < 50 && !f._raf; i++) await new Promise(z => setTimeout(z, 100));
        const n0 = f.frames || 0; await new Promise(z => setTimeout(z, 1500));
        let lit2 = 0;
        if (f._raf && f.dye) {
          f._render(); x.clearRect(0, 0, 160, 90); x.drawImage(v._fluidCanvas, 0, 0, 160, 90);
          const d2 = x.getImageData(0, 0, 160, 90).data;
          for (let i = 0; i < d2.length; i += 4) if (Math.max(d2[i], d2[i + 1], d2[i + 2]) * d2[i + 3] / 255 > 40) lit2++;
        }
        back = { stopped, running: !!f._raf, frames: (f.frames || 0) - n0, lit: lit2 / (160 * 90), lines: !!f.progs.shade && !!f.shaded, glow: (f.bloomLevels?.length || 0) >= 2, lost: f.gl.isContextLost() };
      }
      bmMusic.engine.el.pause(); await new Promise(z => setTimeout(z, 500));
      const a = v._fw?.splats || 0; await new Promise(z => setTimeout(z, 1500)); const b = v._fw?.splats || 0;
      // The pointer stirs it (v3.36.0), with the music paused too: moving over
      // the picture adds to the fluid, and moving beside it does not.
      const rc = v.canvas.getBoundingClientRect(), move = (px, py) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: px, clientY: py }));
      // one after another with no wait between, so a slow machine's long frames cannot come between two moves
      v._stirAt = null; const s0 = f.splats || 0;
      for (let i = 0; i < 12; i++) move(rc.left + rc.width * (0.3 + i * 0.03), rc.top + rc.height * (0.4 + i * 0.01));
      const s1 = f.splats || 0;
      for (let i = 0; i < 6; i++) move(rc.left - 40 - i * 6, rc.top + 20 + i * 6);
      const s2 = f.splats || 0;
      // a pixel at a time, as a fast screen reports a slow pointer: each step is too small to count, and they add up
      v._stirAt = null;
      for (let i = 0; i < 40; i++) move(Math.round(rc.left + rc.width * 0.5) + i, Math.round(rc.top + rc.height * 0.5));
      const stir = { over: s1 - s0, beside: s2 - s1, small: (f.splats || 0) - s2, high: Math.round(rc.height) };
      v.setOptions({ style: 'bars' }); v.setMode('bars'); bmMusic.engine?.stop?.();
      return { fluid: !!f, bloom, neon, halo, playing, paused: b - a, lit: lit / (160 * 90), bright, blending, moved, steps, passed, back, stir, ...info };
    }, TONE);
    if (!r.fluid) throw new Error('the fluid did not start');
    if (!(r.bloom > 0)) throw new Error('no glow');
    if (!r.neon || !r.halo) throw new Error('no contour lines, or no glow built from them: ' + JSON.stringify(r));
    if (r.playing < 5) throw new Error('only ' + r.playing + ' strokes with music');
    if (r.paused !== 0) throw new Error(r.paused + ' strokes while paused');
    if (r.levels.join() !== 'hd,high,medium,low') throw new Error('its quality levels are ' + r.levels.join());
    if (Math.abs(r.dye[0] - r.canvas[0] * r.scale) > 2) throw new Error(`at the ${r.level} level the dye is ${r.dye[0]} across for a canvas of ${r.canvas[0]}`);
    if (r.blending) throw new Error('the picture is blended over the last one again: frames can pile up into a fog');
    if (!(r.lit > 0.0005)) throw new Error('nothing to be seen: ' + (r.lit * 100).toFixed(2) + '% of the picture is lit');
    if (r.lit > 0.5) throw new Error((r.lit * 100).toFixed(0) + '% of the picture is lit: a wash, not lines');
    // on a machine fast enough to tell (20 frames a second), the fluid keeps to the clock
    if (r.steps / r.passed >= 20 && Math.abs(r.moved / r.passed - 1) > 0.15) throw new Error(`in ${r.passed.toFixed(2)} s the fluid moved on ${r.moved.toFixed(2)} s`);
    if (r.stir.over !== 11) throw new Error(`the pointer moved over the picture 12 times and stirred the fluid ${r.stir.over} times, not 11`);
    if (r.stir.beside !== 0) throw new Error(`the pointer stirred the fluid ${r.stir.beside} times from beside the picture`);
    if (!(r.stir.small >= 12)) throw new Error(`forty steps of the pointer, a pixel each over a picture ${r.stir.high} pixels high, stirred the fluid ${r.stir.small} times: a fast screen's small steps must add up`);
    if (r.back && !(r.back.stopped && r.back.running && r.back.frames > 0 && r.back.lines && r.back.glow && !r.back.lost && r.back.lit > 0.0005)) throw new Error('after the graphics card took the picture away and gave it back, HD Flow did not carry on: ' + JSON.stringify(r.back));
    console.log(`      (${r.level} level, dye ${r.dye.join('x')}, ${(r.steps / r.passed).toFixed(0)} frames a second, ${(r.lit * 100).toFixed(1)}% lit, ${r.bright} bright, fast splats ${r.fast ? 'yes' : 'no'}; ${r.renderer.slice(0, 50)}${r.back ? `; carried on after losing its picture, ${(r.back.lit * 100).toFixed(1)}% lit ${r.back.frames} frames on` : ''})`);
  });

  // v3.36.0: the music view's visualiser stopped drawing once its view was
  // left. It went on, 72 times a second, into a canvas no one could see.
  await step('a visualiser whose view is hidden draws nothing', async () => {
    const r = await page.evaluate(async t => {
      const { allVisualisers } = await import('./js/visualizer.js');
      bmApp.switchDest('music'); bmMusic.play(t, 0); bmMusic.engine.el.loop = true; await new Promise(z => setTimeout(z, 1500));
      const mv = allVisualisers().find(v => v.canvas?.id === 'music-visualizer-canvas');
      if (!mv) return { none: true };
      const shown0 = mv._tick; await new Promise(z => setTimeout(z, 700)); const shown = mv._tick - shown0;
      bmApp.switchDest('video'); await new Promise(z => setTimeout(z, 500));
      const hid0 = mv._tick; await new Promise(z => setTimeout(z, 900)); const hidden = mv._tick - hid0;
      const main = bmApp.viz, main0 = main._tick; await new Promise(z => setTimeout(z, 600)); const mainDrew = main._tick - main0;
      const size = { canvas: main.canvas.width, want: Math.round(main.canvas.offsetWidth * main._scale()), scale: main._scale(), dpr: devicePixelRatio };
      bmMusic.engine?.stop?.();
      return { active: mv.active, shown, hidden, mainDrew, size };
    }, TONE);
    if (r.none) { console.log('      (no music-view visualiser in this mode)'); return; }
    if (r.active && !(r.shown > 0)) throw new Error('the music view\'s visualiser did not draw while its view was shown');
    if (r.hidden !== 0) throw new Error(`the music view's visualiser drew ${r.hidden} frames while hidden`);
    if (!(r.mainDrew > 0)) throw new Error('the visual mode\'s own visualiser is not drawing');
    if (Math.abs(r.size.canvas - r.size.want) > 1) throw new Error(`the visualiser's canvas is ${r.size.canvas} across, not ${r.size.want} (the screen's own pixels)`);
    console.log(`      (hidden: 0 frames, shown: ${r.shown}; canvas ${r.size.canvas} px for a scale of ${r.size.scale.toFixed(2)})`);
  });

  // The decorative loops (v3.30.0): the theme's background, the Flow fluid
  // and the fox animate only on the home screen, in a window that is not
  // minimised. Behind a playing video they ran on at 50 to 90 frames a
  // second, measured, and a minimised window kept them going too.
  if (VIDEO) {
    await step('nothing animates behind a playing video or in a minimised window', async () => {
      await page.evaluate(() => {
        if (!window.__fr) { window.__fr = { n: 0 }; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf(t => { window.__fr.n++; cb(t); }); }
        bmApp.stop(); bmApp.applyTheme('dark'); bmApp.applyTheme('ocean');
      });
      const rate = async () => { await page.evaluate(() => { window.__fr.n = 0; }); await page.waitForTimeout(1500); return page.evaluate(() => window.__fr.n / 1.5); };
      await page.waitForTimeout(800);
      const home = await rate();
      await page.evaluate(v => bmApp.playMedia([v]), VIDEO); await page.waitForTimeout(2500);
      const film = await rate();
      await page.evaluate(() => bmApp.stop()); await page.waitForTimeout(1200);
      const back = await rate();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('win:hidden', true)); await page.waitForTimeout(500);
      const hidden = await rate();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('win:hidden', false)); await page.waitForTimeout(500);
      await page.evaluate(() => bmApp.applyTheme('dark'));
      if (!(home > 5)) throw new Error(`the home screen does not animate (${home.toFixed(1)} frames a second)`);
      if (film > 3) throw new Error(`${film.toFixed(1)} frames a second drawn behind the video`);
      if (!(back > 5)) throw new Error('the effects did not come back on the home screen');
      if (hidden > 3) throw new Error(`${hidden.toFixed(1)} frames a second in a minimised window`);
      console.log(`      (home ${home.toFixed(0)}, behind a video ${film.toFixed(0)}, minimised ${hidden.toFixed(0)} frames a second)`);
    });
  }

  // The Fluid visualiser (v3.29.0): the fluid moved by the music. With a tone
  // playing it splashes, and paused it adds nothing.
  if (TONE1500) {
    await step('the Fluid visualiser moves with the music, and stops with it', async () => {
      const r = await page.evaluate(async f => {
        bmApp.playMedia([f]); await new Promise(res => setTimeout(res, 3000));
        const v = bmApp.viz; if (!v) return { noViz: true };
        v.setOptions({ style: 'fluid' }); v.setMode('fluid'); if (!v.active) v.start();
        await new Promise(res => setTimeout(res, 2500));
        const playing = v._fl?.splats || 0;
        await bmApp.api.mpv.cmd('set_property', 'pause', true); await new Promise(res => setTimeout(res, 1000));
        const a = v._fl?.splats || 0; await new Promise(res => setTimeout(res, 1500)); const b = v._fl?.splats || 0;
        const out = { fluid: !!v._fluid, playing, whilePaused: b - a };
        v.setOptions({ style: 'bars' }); v.setMode('bars'); bmApp.stop();
        return out;
      }, TONE1500);
      if (r.noViz) throw new Error('no visualiser');
      if (!r.fluid) throw new Error('the fluid did not start');
      if (r.playing < 5) throw new Error('the music made only ' + r.playing + ' splashes');
      if (r.whilePaused !== 0) throw new Error(r.whilePaused + ' splashes while paused');
    });
  }
}
} finally {
  await app.close().catch(() => {});
  try { execFileSync('pkill', ['-9', '-x', 'mpv']); } catch {}
  try { fs.rmSync(FIX, { recursive: true, force: true }); } catch {}
  try { if (compositor) process.kill(-compositor.pid, 'SIGKILL'); } catch {}
  clearTimeout(hard);
}

const bad = results.filter(r => !r).length;
console.log(`\n${results.length - bad}/${results.length} checks passed. Screenshots in ${SHOTS}\n`);
process.exit(bad ? 1 : 0);
