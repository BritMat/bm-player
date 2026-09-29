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

const hard = setTimeout(() => { console.log('\n  DEADLINE: e2e ran too long'); process.exit(1); }, 100000);

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
  args: [ROOT, '--no-sandbox', `--user-data-dir=${PROFILE}`, ...(PART === 'c' ? [] : ['--lite'])],
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
  await step('the geometric fox is on the welcome screen, whole and animated', async () => {
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
        animated: getComputedStyle(svg.querySelector('.gf-body')).animationName,
        canvasGone: !document.getElementById('fox-canvas'),
      };
    });
    if (!r.ok) throw new Error(r.why);
    if (r.facets < 80) throw new Error('only ' + r.facets + ' facets');
    if (r.parts.length) throw new Error('missing parts: ' + r.parts.join(', '));
    if (!r.visible) throw new Error('the fox is not visibly placed in its stage');
    if (!/gf-breathe/.test(r.animated)) throw new Error('the idle animation is not running: ' + r.animated);
    if (!r.canvasGone) throw new Error('the old fox canvas is still in the page');
    console.log(`      (${r.facets} facets, idle animation: ${r.animated})`);
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

    // On a real machine the "make BM Player the default" prompt sat right on a
    // subtitle line: during video, prompts were placed just above the controls,
    // which is where subtitles are drawn. They now go to the top.
    await step('prompts stay clear of the subtitle area while a video plays', async () => {
      const r = await page.evaluate(async () => {
        const p = document.createElement('div');
        p.className = 'resume-prompt'; p.textContent = 'test prompt'; p.style.padding = '14px 20px';
        document.getElementById('toast-stack').appendChild(p);
        await new Promise(res => setTimeout(res, 100));
        const b = p.getBoundingClientRect(), H = window.innerHeight;
        p.remove();
        return { top: b.top, bottom: b.bottom, H, playing: document.body.classList.contains('playing') };
      });
      if (!r.playing) throw new Error('no video playing at this point');
      if (r.bottom > r.H * 0.6) throw new Error(`the prompt reaches ${Math.round(r.bottom)}px of ${r.H}: into the bottom of the picture, where subtitles go`);
      if (r.top < 60) throw new Error(`the prompt is under the title bar and menus (top ${Math.round(r.top)}px)`);
    });

    await step('PiP resizes the real window and restores it', async () => {
      const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
      await page.evaluate(() => bmApp.togglePiP(true)); await page.waitForTimeout(900);
      const inPip = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { b: w.getBounds(), top: w.isAlwaysOnTop() }; });
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
