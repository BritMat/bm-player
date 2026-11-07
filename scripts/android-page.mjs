#!/usr/bin/env node
/**
 * Tries the Android app's page in Chromium, laid out as a phone, against a
 * stand-in for its Java side (scripts/android-mock.mjs): the library, playing
 * and the buttons Android sends, Now Playing and the visualiser, lyrics from
 * a file, from the song's tags and from LRCLIB, Back, the queue kept between
 * runs, a video with its subtitles in the web engine and in mpv (a stand-in
 * that answers as mpv does), Settings, and a long library.
 *
 * v3.42.0: Home (the fox and its reactions, Browse and Resume, Flow as a
 * fluid simulator, the fruit game), the Videos tab's folders and grid, the
 * player's swipes, lock, picture size and carrying on where a video was
 * left, Photos and the picture viewer, and the PDF reader.
 *
 * What it cannot try is the Java side itself, which only a phone (or an
 * emulator) runs: the build checks that compiles (android/build-apk.mjs).
 *
 *   node scripts/android-page.mjs [--shots DIR]
 *
 * Needs a Chromium or Chrome (BM_CHROME, Playwright's, or the system's) and
 * makes its test songs with ffmpeg when there is one (WAV tones when not).
 * With no browser at all it says so and stops without failing.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startMock, beatWav } from './android-mock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SHOTS = arg('--shots');
const fails = [], notes = [];
let step = '';
const ok = (cond, what) => { if (cond) console.log('  ok   ' + what); else { console.log('  FAIL ' + what); fails.push(`${step}: ${what}`); } };
const soft = (cond, what) => { console.log((cond ? '  ok   ' : '  note ') + what); if (!cond) notes.push(`${step}: ${what}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── a browser ────────────────────────────────────────────────────────
const { chromium } = await import('playwright-core');
function findChrome () {
  const c = [process.env.BM_CHROME, '/opt/pw-browsers/chromium'];
  try { c.push(chromium.executablePath()); } catch (_) {}
  c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  return c.find(p => p && fs.existsSync(p)) || null;
}
const chrome = findChrome();
if (!chrome) { console.log('android-page: no Chromium or Chrome found (set BM_CHROME): skipped'); process.exit(0); }

// ── the page and the test songs ──────────────────────────────────────
console.log('Staging the page (android/build-apk.mjs --stage)');
execFileSync(process.execPath, [path.join(ROOT, 'android', 'build-apk.mjs'), '--stage'], { stdio: 'inherit' });
const media = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-android-page-'));
let ffmpeg = false;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); ffmpeg = true; } catch (_) {}
if (ffmpeg) {
  console.log('Making test songs and a video with ffmpeg');
  const beat = p => `aevalsrc='0.55*sin(2*PI*55*${p}*t)*exp(-8*mod(t,0.5))+0.25*sin(2*PI*(220+110*floor(mod(t*2,4)))*${p}*t)+0.15*(random(0)-0.5)*exp(-30*mod(t+0.25,0.5))':s=44100`;
  const ff = (...a) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...a], { stdio: 'inherit', timeout: 120000 });
  ff('-f', 'lavfi', '-i', beat(1), '-t', '30', '-c:a', 'libmp3lame', '-b:a', '128k', '-metadata', 'title=Night Lights', path.join(media, 's1.mp3'));
  ff('-f', 'lavfi', '-i', beat(1.12), '-t', '25', '-c:a', 'flac', '-metadata', 'LYRICS=[00:01.00]Waves come rolling in\n[00:04.50]Under the bright lights\n[00:08.00]We drive along the shore', path.join(media, 's2.flac'));
  ff('-f', 'lavfi', '-i', beat(0.9), '-t', '30', '-c:a', 'libvorbis', '-q:a', '3', path.join(media, 's3.ogg'));
  ff('-f', 'lavfi', '-i', beat(1.25), '-t', '24', '-c:a', 'libvorbis', '-q:a', '3', path.join(media, 's4.ogg'));
  ff('-f', 'lavfi', '-i', beat(1), '-t', '20', '-c:a', 'libopus', '-b:a', '64k', path.join(media, 's5.opus'));
  ff('-f', 'lavfi', '-i', 'sine=frequency=330:duration=20', path.join(media, 's6.wav'));
  // s7.mp3: s1's sound behind a real ID3v2.3 USLT frame in UTF-16, as taggers write one.
  const src = fs.readFileSync(path.join(media, 's1.mp3'));
  const ss = o => ((src[o] & 0x7f) << 21) | ((src[o + 1] & 0x7f) << 14) | ((src[o + 2] & 0x7f) << 7) | (src[o + 3] & 0x7f);
  const audio = src[0] === 0x49 ? src.subarray(10 + ss(6)) : src;
  const u16 = s => { const b = Buffer.alloc(2 + s.length * 2); b[0] = 0xff; b[1] = 0xfe; for (let i = 0; i < s.length; i++) b.writeUInt16LE(s.charCodeAt(i), 2 + i * 2); return b; };
  const frame = (id, data) => { const h = Buffer.alloc(10); h.write(id, 0, 'latin1'); h.writeUInt32BE(data.length, 4); return Buffer.concat([h, data]); };
  const body = Buffer.concat([frame('USLT', Buffer.concat([Buffer.from([1]), Buffer.from('eng', 'latin1'), u16(''), Buffer.from([0, 0]), u16('Words inside the file\nSecond line, café')])), Buffer.alloc(32)]);
  const n = body.length;
  fs.writeFileSync(path.join(media, 's7.mp3'), Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, (n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]), body, audio]));
  // v3.42.0: three pictures, and a two-page PDF written here by hand
  for (let k = 1; k <= 3; k++) ff('-f', 'lavfi', '-i', `testsrc2=size=1280x720:rate=1`, '-frames:v', '1', '-vf', `hue=h=${k * 90}`, path.join(media, `p${k}.jpg`));
  fs.writeFileSync(path.join(media, 'doc.pdf'), makePdf(['BM Player test document', 'The second page has the fox']));
  try {
    ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25', '-f', 'lavfi', '-i', beat(1), '-t', '10', '-c:v', 'libvpx-vp9', '-b:v', '300k', '-deadline', 'realtime', '-cpu-used', '8', '-c:a', 'libopus', '-shortest', path.join(media, 'v1.webm'));
    fs.writeFileSync(path.join(media, 'v1.srt'), '1\n00:00:00,500 --> 00:00:04,000\nHello from the subtitle file\n');
  } catch (_) { console.log('  (no VP9 in this ffmpeg: the video is not tried)'); }
} else {
  console.log('No ffmpeg: WAV tones only (no tags or video)');
}

/** A small PDF, one line of text on each page, with a correct cross-reference table. */
function makePdf (lines) {
  const objs = [];
  const n = lines.length, kids = lines.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  lines.forEach((t, i) => {
    const content = `BT /F1 28 Tf 60 760 Td (${t}) Tj ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${3 + n * 2} 0 R >> >> >>`);
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let out = '%PDF-1.4\n';
  const at = [];
  objs.forEach((o, i) => { at.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + at.map(a => String(a).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const mock = await startMock({ media: ffmpeg ? media : null, big: 0 });
const URL0 = `http://127.0.0.1:${mock.port}/index.html`;
const browser = await chromium.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-networking', '--no-first-run', '--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  // As the app's WebView says it (MainActivity adds BMPlayerAndroid/VERSION)
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 BMPlayerAndroid/3.48.0' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const ev = (fn, a) => page.evaluate(fn, a);
const until = async (fn, a, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn, a)) return true; await sleep(100); } return false; };
const rowOf = title => ev(t => [...document.querySelectorAll('#mu-list .vrow')].find(r => r.querySelector('.t1')?.textContent === t)?.dataset.i, title);
const lyr = () => ev(() => ({ status: window.bmLyrics?.status, source: window.bmLyrics?.source, lines: window.bmLyrics?.lines?.length || 0, plain: window.bmLyrics?.plain || '' }));

try {
  step = 'start';
  console.log('\n' + step);
  await page.goto(URL0);
  ok(await until(() => window.__bmStarted === true), 'the page starts');
  ok(await until(() => [...document.querySelectorAll('#mu-list .vrow')].filter(r => r.style.display !== 'none').length > 0), 'the songs are listed');
  const listed = await ev(() => [...document.querySelectorAll('#mu-list .vrow')].filter(r => r.style.display !== 'none').length);
  const music = mock.lib.audio.filter(s => s.mu && s.d >= 15000 && !/WhatsApp|Ringtones/.test(s.p)).length;
  ok(listed === music, `only music is listed (${listed} of ${mock.lib.audio.length} audio files, ${music} expected)`);
  ok(await ev(() => document.getElementById('m-old').hidden), 'no "update WebView" or start error screen');

  // ── v3.42.0: Home ──────────────────────────────────────────────────
  step = 'home';
  console.log('\n' + step);
  ok(await ev(() => window.__bmTab() === 'home' && !document.getElementById('v-home').classList.contains('hidden')), 'the app opens on Home');
  ok(await until(() => window.__bmHome?.fox?.kind === 'webgl'), 'the fox is drawn in 3D');
  await sleep(600);
  await shot('00-home');
  const spot = part => ev(p => { const f = window.__bmHome.fox, r = document.getElementById('fox-canvas').getBoundingClientRect(), hits = [];
    for (let y = r.top; y < r.bottom; y += 5) for (let x = r.left; x < r.right; x += 5) { const h = f.hit(x, y); if (h && h.part === p) hits.push([x, y]); }
    return hits.length ? hits[Math.floor(hits.length / 2)] : null; }, part);
  const nose = await spot('nose'), ear = await spot('ear'), chin = await spot('chin');
  ok(!!nose && !!ear && !!chin, 'the fox knows where its nose, ears and chin are');
  // The fox moves all the time: a spot found a moment before can be its head
  // by the time of the tap (v3.47.0: one start in two met it turning). Each
  // tap looks for the part again first, and taps again if the fox had moved.
  const touch = async (part, reacted) => {
    for (let k = 0; k < 4; k++) {
      const at = await spot(part); if (!at) return false;
      await page.touchscreen.tap(at[0], at[1]);
      if (await until(reacted, null, 1200)) return true;
      await sleep(400);
    }
    return false;
  };
  if (nose) ok(await touch('nose', () => ['boop', 'sneeze'].includes(window.__bmHome.fox._state.react?.name)), 'a tap on the nose: a boop (or a sneeze)');
  await sleep(1300);
  if (ear) ok(await touch('ear', () => window.__bmHome.fox._state.react?.name === 'ear'), 'a tap on an ear flicks it');
  await sleep(1300);
  if (chin) {
    let laughed = false;
    for (let k = 0; k < 3 && !laughed; k++) {
      const at = await spot('chin'); if (!at) break;
      for (let i = 0; i < 3; i++) { await page.touchscreen.tap(at[0], at[1]); await sleep(110); }
      laughed = await until(() => window.__bmHome.fox._state.react?.name === 'laugh', null, 1500);
      if (!laughed) await sleep(900);
    }
    ok(laughed, 'three quick taps: it laughs');
  }
  ok(await until(() => document.querySelectorAll('#fox-fx .fp-spark').length > 0), 'with little stars or hearts');
  await sleep(1800);
  // a stroke across the head (found again before each try, as the taps above)
  let head = await spot('head');
  if (head) {
    const c = await page.context().newCDPSession(page);
    const t = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    let leaned = false;
    for (let k = 0; k < 3 && !leaned && head; k++) {
      if (k) { await t('touchEnd'); await sleep(500); head = await spot('head'); if (!head) break; }
      await t('touchStart', head[0] - 40, head[1]);
      for (let i = 0; i <= 16; i++) { await t('touchMove', head[0] - 40 + i * 5, head[1] + (i % 2)); await sleep(30); }
      leaned = await ev(() => window.__bmHome.fox._state.pet > 0.3);
    }
    ok(leaned, 'stroking it: it leans into the hand, eyes half shut');
    await t('touchEnd');
  }
  ok(await ev(() => { window.__bmHome.fox.react('yawn'); return true; }) && await until(() => window.__bmHome.fox._state.mouth > 0.5), 'it can open its mouth (a yawn)');
  await page.tap('#home-browse');
  ok(await until(() => [...document.querySelectorAll('#sheet .sh-lbl')].some(e => /A file/.test(e.textContent)) && [...document.querySelectorAll('#sheet .sh-lbl')].some(e => /Photos/.test(e.textContent))), 'Browse offers a file, music, videos and photos');
  await ev(() => window.BMNative.back());
  // Flow, the fluid simulator
  await page.tap('#home-modes button[data-m="flow"]');
  ok(await until(() => window.__bmHome.toy?.on === true && document.body.classList.contains('home-full')), 'Flow: the fluid fills the screen, the tabs make way');
  const splats0 = await ev(() => window.__bmHome.fluid.splats || 0);
  { const c = await page.context().newCDPSession(page); const t = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await t('touchStart', 80, 300); for (let i = 1; i <= 12; i++) { await t('touchMove', 80 + i * 18, 300 + i * 22); await sleep(25); } await t('touchEnd'); }
  ok(await until(n => (window.__bmHome.fluid.splats || 0) > n + 5, splats0), 'a finger pours colour into it');
  await page.tap('#flow-settings');
  ok(await until(() => document.querySelectorAll('#sheet .fp-row').length >= 12), 'its settings: colours, swirl, glow, lines and more');
  await page.tap('#sheet .fp-seg button[data-v="fire"]');
  ok(await ev(() => window.__bmHome.toy.settings.colors === 'fire' && JSON.parse(localStorage.getItem('bm_flow_toy')).colors === 'fire'), 'a choice applies and is kept');
  await ev(() => window.BMNative.back());
  await sleep(600); await shot('00-flow');
  ok(await ev(() => window.BMNative.back()) === 'handled' && await until(() => window.__bmHome.toy.on === false && !document.body.classList.contains('home-full')), 'Back: the fox again, the fluid as it was');
  // Fruit
  await page.tap('#home-modes button[data-m="fruit"]');
  ok(await until(() => !!document.querySelector('#slice-ui:not(.hidden) .sg-btn[data-a="classic"]')), 'Fruit: a menu, Classic or Zen');
  await page.tap('.sg-btn[data-a="classic"]');
  ok(await until(() => window.__bmHome.game.state === 'play'), 'a game starts');
  // a fruit thrown at a known place, and a swipe through it
  await ev(() => { const g = window.__bmHome.game; g.objs = []; g.nextWave = 99; g.objs.push({ kind: 'fruit', type: 0, x: 200, y: 400, vx: 0, vy: 0, rot: 0, vr: 0, r: 34 * g.scale, cut: false, pin: true }); g._step = (s => function (dt, now) { const r = s.call(this, dt, now); this.objs.forEach(o => { if (o.pin) { o.vy = 0; o.y = 400; } }); return r; })(g._step); });
  { const c = await page.context().newCDPSession(page); const t = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await t('touchStart', 120, 400); for (let i = 1; i <= 8; i++) { await t('touchMove', 120 + i * 20, 400); await sleep(16); } await t('touchEnd'); }
  ok(await until(() => window.__bmHome.game.score >= 1 && window.__bmHome.game.objs.some(o => o.kind === 'half')), 'a swipe slices a fruit in two, and scores');
  await sleep(300); await shot('00-fruit');
  ok(await ev(() => window.BMNative.back()) === 'handled' && await until(() => window.__bmHome.game.state === 'paused'), 'Back pauses the game');
  await ev(() => window.BMNative.back());
  ok(await until(() => window.__bmHome.game && document.getElementById('v-home').dataset.mode === 'fox'), 'and again: the fox');
  // v3.48.0: a scene for Home in place of the theme's own, one at a time, resting when not seen
  const themeWas = await ev(() => document.documentElement.dataset.theme || 'dark');
  await page.tap('#home-theme');
  await page.tap('#sheet .sh-item:has-text("Ocean")');
  await until(() => document.documentElement.dataset.theme === 'ocean' && window.__bmHome.theme?.running);
  await page.tap('#home-scene-btn');
  await page.tap('#sheet .sh-item:has-text("Aurora Lake")');
  ok(await until(() => window.__bmHome.scene?.def?.id === 'aurora' && window.__bmHome.scene.cost().frames >= 1, null, 10000), 'Scene: Aurora Lake draws behind the fox');
  ok(await ev(() => document.getElementById('v-home').classList.contains('has-scene') && !window.__bmHome.theme?.running && localStorage.getItem('bm_m_scene') === 'aurora'), 'in place of the theme\'s own, and kept');
  // On Low quality (a weak phone, and this browser often) it is a still that moves when touched.
  const still = await ev(() => window.__bmHome.scene.still);
  {
    // Moving: at whatever pace this browser's software drawing allows. On GitHub's machines (not Low,
    // so not a still) Aurora Lake drew one frame in the first 0.8 s while it made its land (v3.49.0).
    const f0 = await ev(() => window.__bmHome.scene.cost().frames);
    if (still) await sleep(800);
    else await until(n => window.__bmHome.scene.cost().frames > n + 5, f0, 5000);
    const f1 = await ev(() => window.__bmHome.scene.cost().frames);
    ok(still ? f1 === f0 : f1 > f0 + 5, still ? 'on Low it is a still picture' : `it moves (${f1 - f0} frames)`);
    // a place the scene gets: not the fox, a button or a row (an update's card can come and go above the fox)
    const free = above => ev(up => {
      const no = 'button, a, input, .fox-stage, .home-recent, .home-favs';
      for (const fy of up ? [0.12, 0.2, 0.3, 0.4] : [0.9, 0.8, 0.7, 0.6]) for (const fx of [0.08, 0.92, 0.5, 0.25, 0.75]) {
        const x = innerWidth * fx, y = innerHeight * fy, e = document.elementFromPoint(x, y);
        if (e && e.closest('#home-main') && !e.closest(no)) return [x, y];
      }
      return null;
    }, above);
    const sky = await free(true), lake = await free(false);
    if (sky) await page.touchscreen.tap(sky[0], sky[1]);
    if (lake) await page.touchscreen.tap(lake[0], lake[1]);
    // moving, at whatever pace this browser's software drawing allows (a phone's is quicker)
    ok(!!sky && await until(n => window.__bmHome.scene.running && window.__bmHome.scene.cost().frames > n + 3, f1, 4000), `and a touch on the sky or the lake moves it (at ${JSON.stringify(sky)} and ${JSON.stringify(lake)})`);
  }
  await page.tap('#home-scene-btn');
  ok(await until(() => /Lights: Violet/.test(document.getElementById('sheet').textContent)), 'its lights\' colours are offered');
  await page.tap('#sheet .sh-item:has-text("Lights: Violet")');
  ok(await until(() => localStorage.getItem('bm_m_aurora_colour') === 'violet'), 'and a colour is kept');
  await sleep(600); await shot('00-home-aurora');
  ok(await ev(() => window.__bmHome.scene.cost().errors === 0), 'a tap on the sky and one on the lake, with no error');
  await page.tap('#nav button[data-tab="music"]');
  await sleep(400);
  const away0 = await ev(() => window.__bmHome.scene.cost().frames); await sleep(700);
  ok(await ev(n => window.__bmHome.scene.cost().frames === n && window.__bmHome.scene.resting, away0), 'away from Home it rests');
  await page.tap('#nav button[data-tab="home"]');
  ok(await until(([n, st]) => window.__bmHome.scene.cost().frames > n + (st ? 0 : 5) && !window.__bmHome.scene.resting, [away0, still]), 'and draws again on Home');
  // v3.49.0: Jellyfish Drift, in Aurora Lake's place, with its two looks
  await page.tap('#home-scene-btn');
  await page.tap('#sheet .sh-item:has-text("Jellyfish Drift")');
  ok(await until(() => window.__bmHome.scene?.def?.id === 'jellyfish' && window.__bmHome.scene.cost().frames >= 1, null, 10000), 'Scene: Jellyfish Drift draws in its place');
  await page.tap('#home-scene-btn');
  ok(await until(() => /Look: Glow/.test(document.getElementById('sheet').textContent) && !/Lights: Violet/.test(document.getElementById('sheet').textContent)), 'its looks are offered, and not Aurora Lake\'s colours');
  await page.tap('#sheet .sh-item:has-text("Look: Glow")');
  ok(await until(() => localStorage.getItem('bm_m_jelly_look') === 'glow' && localStorage.getItem('bm_m_scene') === 'jellyfish'), 'the look is kept, and the scene');
  await sleep(600); await shot('00b-home-jellyfish');
  ok(await ev(() => window.__bmHome.scene.cost().errors === 0), 'with no error');
  await page.tap('#home-scene-btn');
  await page.tap('#sheet .sh-item:has-text("The theme\'s own")');
  ok(await until(() => !window.__bmHome.scene.scene && !document.getElementById('v-home').classList.contains('has-scene') && window.__bmHome.theme?.running), 'The theme\'s own: its scene again, the scene put away');
  await ev(t => { localStorage.setItem('bm_m_theme', t); document.documentElement.dataset.theme = t; window.dispatchEvent(new CustomEvent('bm-theme', { detail: t })); }, themeWas);
  await page.tap('#nav button[data-tab="music"]');
  await shot('01-music');

  // Until v3.41.0 the button on this card did nothing (nothing listened to the box it is in).
  step = 'music access';
  console.log('\n' + step);
  await ev(() => localStorage.setItem('mock_perm_audio', 'ask'));
  await page.reload();
  await until(() => window.__bmStarted === true);
  await page.tap('#nav button[data-tab="music"]');
  ok(await until(() => window.__bmStarted && !!document.querySelector('#mu-empty:not(.hidden) [data-perm="audio"]')), 'without access, the music tab asks for it');
  await page.tap('#mu-empty [data-perm="audio"]');
  ok(await until(() => localStorage.getItem('mock_perm_audio') === 'granted'), '"Allow access to music" asks Android');
  ok(await until(() => [...document.querySelectorAll('#mu-list .vrow')].filter(r => r.style.display !== 'none').length > 0), 'once allowed, the songs are listed');
  ok(await ev(() => document.getElementById('mu-empty').classList.contains('hidden')), 'and the card goes');

  step = 'every audio file';
  console.log('\n' + step);
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('label:has(#st-allaudio)');
  await page.tap('#nav button[data-tab="music"]');
  ok(await until(n => [...document.querySelectorAll('#mu-list .vrow')].filter(r => r.style.display !== 'none').length === n, mock.lib.audio.length), 'turned on, voice notes and ringtones are listed too');
  await page.tap('#nav button[data-tab="settings"]'); await page.tap('label:has(#st-allaudio)'); await page.tap('#nav button[data-tab="music"]');
  ok(await until(n => [...document.querySelectorAll('#mu-list .vrow')].filter(r => r.style.display !== 'none').length === n, music), 'turned off again, they are not');

  step = 'playing';
  console.log('\n' + step);
  await page.tap(`#mu-list .vrow[data-i="${await rowOf('Night Lights')}"] .txt`);
  ok(await until(() => !document.getElementById('mini').classList.contains('hidden')), 'the mini player shows');
  ok(await until(() => (document.querySelector('audio')?.currentTime || window.bmLyrics?.music?.engine?.currentTime || 0) > 0.5, null, 8000), 'the song plays (its time moves)');
  const pb = await ev(() => window.__bmPlayback);
  ok(pb?.has && pb.playing && pb.title === 'Night Lights' && pb.artId === 101 && pb.albumId === 11, 'Android is told what plays (title, playing, art)');
  await ev(() => window.BMNative.event('remote', { action: 'pause' }));
  ok(await until(() => window.__bmPlayback?.playing === false), 'pause from the notification');
  await ev(() => window.BMNative.event('remote', { action: 'play' }));
  ok(await until(() => window.__bmPlayback?.playing === true), 'play from the notification');
  await ev(() => window.BMNative.event('remote', { action: 'seek', value: 12 }));
  ok(await until(() => Math.abs((window.bmLyrics.music.engine.currentTime || 0) - 12) < 1.5), 'seek from the lock screen');
  await ev(() => window.BMNative.event('remote', { action: 'next' }));
  ok(await until(() => window.__bmPlayback?.title && window.__bmPlayback.title !== 'Night Lights'), `next from headphones (now "${await ev(() => window.__bmPlayback?.title)}")`);
  await ev(() => window.BMNative.event('remote', { action: 'prev' }));
  ok(await until(() => window.__bmPlayback?.title === 'Night Lights'), 'previous goes back to it (the next song had only just begun)');
  await shot('02-playing');
  // v3.48.0: a song's stream lost partway, as the phone's log showed ("decode
  // failed (code 2)", then the song skipped): it goes on from the same place.
  // A song not played yet (the browser keeps what it has read of one it has),
  // and a WAV: an Ogg as small as the test's is read to its end before it
  // plays (its length is at its end), so it never breaks partway.
  {
    const id = mock.lib.audio.find(x => x.t === 'Plain Tone')?.i, file = id && mock.lib.files.get('audio/' + id);
    // the stand-in's own state, waited for here rather than in the page
    const waitFor = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await sleep(100); } return false; };
    if (file) {
      mock.hits.cut = { file, share: 0.3, phase: 'armed' };
      // A stream that hangs with no error is waited on for twelve seconds; four here.
      await ev(() => { window.bmLyrics.music.engine.constructor.STALL_MS = 4000; window.__bmEngineLog = []; const w = console.warn; console.warn = (...a) => { window.__bmEngineLog.push(a.join(' ')); w.apply(console, a); }; });
      await page.tap(`#mu-list .vrow[data-i="${await rowOf('Plain Tone')}"] .txt`);
      // the stream is held after its first part, and broken off three seconds in
      const begun = await until(() => window.__bmPlayback?.title === 'Plain Tone', null, 6000) && await waitFor(() => mock.hits.cut.phase === 'held', 6000)
        && await until(() => window.__bmPlayback?.playing && window.bmLyrics.music.engine.currentTime >= 3, null, 12000);
      mock.hits.cut.drop?.();
      ok(begun, `a song plays, and its stream is broken off three seconds in (${mock.hits.cut.phase})`);
      const lost = await waitFor(() => mock.hits.cut.phase === 'over', 30000);
      const log = await ev(() => window.__bmEngineLog.filter(l => /AudioEngine|could not play/.test(l)));
      ok(lost && /carrying on from there, try 1 of 3/.test(log.join(' | ')), `the engine loads it again to carry on (${log.slice(0, 2).join(' | ') || 'nothing said'})`);
      // where it stopped, as the engine said it ("... at 0:07: carrying on")
      const m = /at (\d+):(\d\d): carrying on/.exec(log.join(' ')), stoppedAt = m ? +m[1] * 60 + +m[2] : null;
      await sleep(2000);
      const r = await ev(() => ({ t: window.bmLyrics.music.engine.currentTime || 0, playing: window.__bmPlayback?.playing, title: window.__bmPlayback?.title, skipped: window.__bmEngineLog.some(l => /could not play|Skipping/.test(l)) }));
      ok(stoppedAt > 2 && r.t >= stoppedAt - 1 && r.playing === true && r.title === 'Plain Tone' && !r.skipped,
        `and it plays on from there (stopped at ${stoppedAt} s, now at ${r.t.toFixed(1)} s), not skipped or started again`);
      console.log(`      (the browser's own tries to go on with the broken stream, refused: ${mock.hits.cut.refused || 0})`);
      mock.hits.cut = null;
      await ev(() => { window.bmLyrics.music.engine.constructor.STALL_MS = 12000; });
      await page.tap(`#mu-list .vrow[data-i="${await rowOf('Night Lights')}"] .txt`);
      await until(() => window.__bmPlayback?.title === 'Night Lights', null, 6000);
      await sleep(300);
    }
  }
  // v3.43.2: a sideways swipe on the music bar is the bar's, not taken by the browser as a pan
  { const c = await page.context().newCDPSession(page);
    const tch = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const b = await ev(() => { const r = document.getElementById('mini-open').getBoundingClientRect(); return { x: r.left + r.width * 0.7, y: r.top + r.height / 2 }; });
    await tch('touchStart', b.x, b.y); for (let i = 1; i <= 8; i++) { await tch('touchMove', b.x - i * 18, b.y + 1); await sleep(20); } await tch('touchEnd');
    ok(await until(() => window.__bmPlayback?.title && window.__bmPlayback.title !== 'Night Lights'), `a swipe to the left on the music bar: the next song (now "${await ev(() => window.__bmPlayback?.title)}")`);
    await ev(() => window.BMNative.event('remote', { action: 'prev' }));
    await until(() => window.__bmPlayback?.title === 'Night Lights');
    await sleep(250); }   // a tap just after a swipe is the swipe's own, and is let go

  step = 'Now Playing';
  console.log('\n' + step);
  await page.tap('#mini-open');
  ok(await until(() => document.getElementById('np').classList.contains('on')), 'opens');
  ok(await ev(() => document.getElementById('np-title').textContent === 'Night Lights'), 'shows the song');
  await shot('03-now-playing');
  await page.tap('#np-viz-btn');
  ok(await until(() => document.body.classList.contains('audio-viz') && document.querySelector('#np-viz.active')), 'the visualiser starts');
  ok(await ev(() => { const c = document.getElementById('np-viz'); return c.width > 300 && c.height > 300; }), 'and fills the screen');
  await sleep(1200);
  await shot('04-visualiser');
  await page.tap('#viz-btn-settings');
  ok(await until(() => !document.getElementById('viz-settings').classList.contains('hidden')), 'its settings open');
  await page.tap('#vs-style button[data-v="milkdrop"]');
  await ev(() => window.bmVizPanel.close());
  const milk = await until(() => { const c = document.querySelector('.viz-milk-canvas'); return c && c.style.display !== 'none'; }, null, 12000);
  soft(milk, 'MilkDrop draws (needs WebGL 2 in this browser)');
  if (milk) {
    await sleep(1500); await shot('05-milkdrop');
    await page.tap('#viz-btn-presets');
    ok(await until(() => document.querySelectorAll('#mdb-grid .mdb-card').length > 20), 'the preset browser lists the presets');
    await page.tap('#mdb-grid .mdb-card:nth-child(3)');
    ok(await ev(() => window.BMNative.back() === 'handled' && document.getElementById('md-browser').classList.contains('hidden')), 'Back closes the preset browser');
  }
  await page.tap('#viz-btn-settings'); await page.tap('#vs-style button[data-v="bars"]'); await ev(() => window.bmVizPanel.close());
  await page.tap('#np-full');
  ok(await until(() => document.getElementById('np').classList.contains('full') && window.__bmImmersive === true), 'full screen (Android hides its bars)');
  ok(await ev(() => window.BMNative.back() === 'handled' && !document.getElementById('np').classList.contains('full') && window.__bmImmersive === false), 'Back leaves full screen');

  // v3.49.0, Sound lab: the sound modes, clear voice and night mode, for the music
  step = 'sound modes';
  console.log('\n' + step);
  await ev(() => document.getElementById('np-more').click());
  await page.tap('#sheet .sh-item:has-text("Sound mode")');
  ok(await until(() => document.querySelectorAll('#sheet .snd [data-mode]').length === 9), 'Sound mode opens its sheet, with the nine modes');
  await page.tap('#sheet .snd [data-mode="hall"]');
  ok(await until(() => window.bmLyrics?.music?.engine?.chain?.live.includes('hall')), `Concert hall: the music goes through the hall (${await ev(() => window.bmLyrics?.music?.engine?.chain?.live.join(','))})`);
  await page.tap('#sheet .snd [data-mode="nightcore"]');
  ok(await until(() => { const e = window.bmLyrics.music.engine; return Math.abs(e.el.playbackRate - e.speed * 1.25) < 1e-6 && e.el.preservesPitch === false && !e.chain.live.includes('hall'); }), 'Nightcore: a quarter faster, the pitch following, the hall gone');
  await page.tap('#sheet .snd [data-voice="on"]');
  ok(await until(() => window.bmLyrics.music.engine.chain.live.includes('voice')), 'clear voice goes in');
  ok(await until(() => ['mode="nightcore"', 'voice="on"', 'night="off"'].every(a => document.querySelector(`#sheet .snd [data-${a}]`)?.classList.contains('on')) && document.querySelectorAll('#sheet .snd .chip.on').length === 3), 'the sheet shows what is on');
  await shot('03b-sound-modes');
  ok(await ev(() => { const k = JSON.parse(localStorage.getItem('bm_m_sound') || '{}'); return k.mode === 'nightcore' && k.voice === true; }), 'and they are kept for next time');
  await ev(() => window.BMNative.back());
  await ev(() => document.getElementById('np-more').click());
  ok(await ev(() => /Sound mode\s*Nightcore, Clear voice/.test(document.getElementById('sheet').textContent)), 'the menu says which');
  await page.tap('#sheet .sh-item:has-text("Sound mode")');
  await page.tap('#sheet .snd [data-mode="off"]');
  await page.tap('#sheet .snd [data-voice="off"]');
  ok(await until(() => { const e = window.bmLyrics.music.engine; return e.chain.live.join(',') === '' && e.el.preservesPitch === true && Math.abs(e.el.playbackRate - e.speed) < 1e-6; }), 'all off again: nothing in the way, the speed and the pitch as chosen');
  await ev(() => window.BMNative.back());

  step = 'lyrics';
  console.log('\n' + step);
  await page.tap('#np-tab-lyrics');
  ok(await until(() => document.getElementById('np-drawer').classList.contains('on')), 'the lyrics come up');
  if (ffmpeg) {
    const s7 = await lyr();
    await ev(() => window.BMNative.back()); await ev(() => window.BMNative.back());
    const play = async t => { await page.tap('#nav button[data-tab="music"]'); const i = await rowOf(t); await page.tap(`#mu-list .vrow[data-i="${i}"] .txt`); };
    await play('Ocean Drive');
    ok(await until(() => window.bmLyrics.status === 'ready' && window.bmLyrics.source === 'tags' && window.bmLyrics.lines.length === 3), 'timed lyrics from a FLAC file\'s tags');
    await play('Tagged Words');
    ok(await until(() => window.bmLyrics.status === 'ready' && window.bmLyrics.source === 'tags' && /café/.test(window.bmLyrics.plain || '')), 'words from an MP3\'s ID3 tag (USLT, UTF-16)');
    await play('Fast Lane');
    ok(await until(() => window.bmLyrics.source === 'file' && window.bmLyrics.lines.length === 3), 'a .lrc file beside the song (through Java)');
    await play('Slow Morning');
    ok(await until(() => window.bmLyrics.source === 'lrclib' && window.bmLyrics.lines.length === 4), 'LRCLIB, through Java (the best match, timed)');
    ok(mock.hits.lrclib.some(u => u.includes('/api/search')), 'asked LRCLIB by artist and title');
    void s7;
    // v3.46.0: lyrics in another alphabet, in English letters or both
    await page.tap('#mini-open');
    await until(() => document.getElementById('np').classList.contains('on'));
    await page.tap('#np-tab-lyrics');
    await until(() => document.getElementById('np-drawer').classList.contains('on'));
    await ev(() => { const l = window.bmLyrics; l._apply({ source: 'file', synced: '[00:00.00]ഇന്ന് നല്ല മഴയാണ്\n[00:04.00]നീ എന്റെ കൂടെ വരുമോ\n[00:08.00]காதல் வந்தேன்\n[00:12.00]and English', plain: null }); l._render(); });
    ok(await until(() => document.querySelectorAll('#np-lyrics .lyr-sbtn').length === 3), 'Malayalam lyrics: Original, English letters and Both offered');
    await page.tap('#np-lyrics .lyr-sbtn[data-v="both"]');
    const bothShown = () => document.querySelector('#np-lyrics .lyr-line[data-i="0"] .lyr-rom')?.textContent === 'Innu nalla mazhayaanu'
      && document.querySelector('#np-lyrics .lyr-line[data-i="2"] .lyr-rom')?.textContent === 'Kaadhal vandhen' && !document.querySelector('#np-lyrics .lyr-line[data-i="3"] .lyr-rom');
    // A tap now and then is not taken here (a few runs in ten, never seen on a
    // phone): tapped again as a person would, and noted with what was seen.
    let both = await until(bothShown, null, 2500);
    if (!both) {
      const lost = await ev(() => 'chosen ' + (document.querySelector('#np-lyrics .lyr-sbtn.on')?.dataset.v || 'none') + '; scrolled sideways: ' + ([...document.querySelectorAll('*')].filter(e => e.scrollLeft > 0).map(e => (e.id || e.className || e.tagName) + ' ' + e.scrollLeft).join(', ') || 'nothing'));
      soft(false, 'the first tap on Both was not taken (' + lost + ')');
      await page.tap('#np-lyrics .lyr-sbtn[data-v="both"]');
      both = await until(bothShown);
    }
    const seen = both ? '' : ' (' + await ev(() => [...document.querySelectorAll('#np-lyrics .lyr-line')].slice(0, 4).map(l => JSON.stringify(l.textContent)).join(', ') + '; chosen ' + (document.querySelector('#np-lyrics .lyr-sbtn.on')?.dataset.v || 'none') + '; source ' + window.bmLyrics.source
      + '; scrolled sideways: ' + [...document.querySelectorAll('*')].filter(e => e.scrollLeft > 0).map(e => (e.id || e.className || e.tagName) + ' ' + e.scrollLeft).join(', ')
      + '; past the right edge: ' + [...document.querySelectorAll('#np *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map(e => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().right)).join(', ')) + ')';
    ok(both, 'Both: the English letters under each line (Malayalam and Tamil), none under English' + seen);
    const sb = await ev(() => { const r = document.querySelector('#np-lyrics .lyr-script').getBoundingClientRect(); return { h: r.height, w: r.width, right: r.right, vw: innerWidth }; });
    ok(sb.h >= 34 && sb.right <= sb.vw, `the choice fits the phone and is big enough to tap (${Math.round(sb.w)}×${Math.round(sb.h)})`);
    await sleep(300); await shot('06b-lyrics-english-letters');
    await page.tap('#np-lyrics .lyr-sbtn[data-v="latin"]');
    ok(await until(() => document.querySelector('#np-lyrics .lyr-line[data-i="1"]')?.textContent === 'Nee ente koode varumo' && localStorage.getItem('bm_lyrics_script') === 'latin'), 'English letters alone, and the choice kept');
    await page.tap('#np-lyrics .lyr-sbtn[data-v="original"]');
    await ev(() => window.BMNative.back()); await ev(() => window.BMNative.back());

    // v3.50.0: lyrics that stay. Found once, they are kept in the app's own
    // storage (LyricsStore.java, here the stand-in), and shown without a connection.
    console.log('\nlyrics that stay');
    ok(await ev(() => Object.keys(localStorage).some(k => k.startsWith('mock_lyr_sf-')) && !Object.keys(localStorage).some(k => /^bm_ly_/.test(k))), 'the lyrics LRCLIB found are kept in the app\'s storage, not the page\'s');
    mock.hits.lrclibDown = true;
    await play('Fast Lane'); await until(() => window.bmLyrics.source === 'file');
    const askedBefore = mock.hits.lrclib.length;
    await play('Slow Morning');
    ok(await until(() => window.bmLyrics.status === 'ready' && window.bmLyrics.source === 'lrclib' && window.bmLyrics.lines.length === 4 && window.bmLyrics.saved) && mock.hits.lrclib.length === askedBefore,
      'LRCLIB out of reach: the saved lyrics, with nothing asked');
    ok(/saved for offline/.test(await ev(() => document.querySelector('#np-lyrics .lyr-foot')?.textContent || '')), 'and they say they are saved for offline');
    await ev(() => document.querySelector('#np-lyrics [data-lyr="refresh"]')?.click());
    ok(await until(() => window.bmLyrics.lines.length === 4 && /saved ones/.test(document.getElementById('np-lyrics').textContent)) && mock.hits.lrclib.length > askedBefore,
      'Refresh asks LRCLIB, and with it out of reach the lyrics stay, said to be the saved ones');
    await ev(() => { window.__bmShared = null; document.querySelector('#np-lyrics [data-lyr="share"]')?.click(); });
    ok(await until(() => /Sun comes up slow\nCoffee on the stove/.test(window.__bmShared || '')), 'Share hands the words to Android');
    ok(await ev(() => !document.querySelector('#np-lyrics [data-lyr="save-lrc"]')), 'no Save as .lrc on the phone');
    await play('Opus Number');
    ok(await until(() => window.bmLyrics.status === 'offline' && /could not be reached/.test(document.getElementById('np-lyrics').textContent) && !!document.querySelector('#np-lyrics [data-lyr="retry"]')),
      'a song with none saved, LRCLIB out of reach: said so, with Try again');
    mock.hits.lrclibDown = false;
    const askedOnline = mock.hits.lrclib.length;
    await ev(() => window.dispatchEvent(new Event('online')));
    ok(await until(() => window.bmLyrics.status === 'none' && !!document.querySelector('#np-lyrics [data-lyr="retry"]')) && mock.hits.lrclib.length > askedOnline,
      `looked for again by itself when the connection is back (${await ev(() => window.bmLyrics.status)})`);
    // Settings: how many are saved, every song at once, and clearing them
    await page.tap('#nav button[data-tab="settings"]');
    ok(await until(() => /Lyrics for 1 song are saved on the phone/.test(document.getElementById('st-lyr-count').textContent)), `Settings counts the songs with lyrics saved (${await ev(() => document.getElementById('st-lyr-count').textContent)})`);
    await ev(() => document.getElementById('st-lyr-save').scrollIntoView({ block: 'center' }));
    await page.tap('#st-lyr-save');
    await until(() => /^Done: /.test(document.getElementById('st-lyr-save-note').textContent), null, 30000);
    const saveNote = await ev(() => document.getElementById('st-lyr-save-note').textContent);
    const sn = /^Done: (\d+) of (\d+) songs have lyrics\.(?: LRCLIB had none for (\d+) songs?\.)?/.exec(saveNote) || [];
    const listedMusic = mock.lib.audio.filter(x => x.mu && x.d >= 15000 && !/WhatsApp|Ringtones/.test(x.p)).length;
    ok(+sn[2] === listedMusic && +sn[1] >= 3 && +sn[1] + (+sn[3] || 0) === listedMusic && await ev(() => document.getElementById('st-lyr-save').textContent === 'Save all'),
      `Save all goes through every song: their own lyrics, the saved ones, and LRCLIB for the rest (${saveNote})`);
    await ev(() => document.getElementById('st-lyr-clear').scrollIntoView({ block: 'center' }));
    await page.tap('#st-lyr-clear');
    ok(await until(() => /Clear the saved lyrics/.test(document.getElementById('sheet').textContent)), 'Clear asks first');
    await page.tap('#sheet .sh-item.danger');
    ok(await until(() => /None saved yet/.test(document.getElementById('st-lyr-count').textContent) && !Object.keys(localStorage).some(k => k.startsWith('mock_lyr_sf-'))), 'and clears them');
    await page.tap('#nav button[data-tab="music"]');
  }

  step = 'Back';
  console.log('\n' + step);
  await page.tap('#mini-open');
  await until(() => document.getElementById('np').classList.contains('on'));
  ok(await ev(() => window.BMNative.back()) === 'handled', 'closes Now Playing');
  await page.tap('#mu-chips .chip[data-k="albums"]');
  await page.tap('#mu-list .acard');
  ok(await until(() => document.getElementById('v-detail').classList.contains('on')), 'an album opens');
  ok(await ev(() => window.BMNative.back()) === 'handled', 'closes the album');
  await page.tap('#mu-chips .chip[data-k="songs"]');
  await page.tap('#nav button[data-tab="settings"]');
  ok(await ev(() => window.BMNative.back()) === 'handled' && await ev(() => !document.getElementById('v-home').classList.contains('hidden')), 'from another tab, back to Home');
  ok(await ev(() => window.BMNative.back()) === 'background', 'at Home, the app goes behind the others (the music plays on)');
  ok(await ev(() => !document.getElementById('home-resume').classList.contains('hidden') && /Resume/.test(document.getElementById('home-resume').textContent)), 'Home offers to resume what played');
  // v3.43.2: a long name under Resume made the button wider than the screen, and Home could be slid sideways
  await ev(() => { const s = document.getElementById('home-resume-sub'); s.dataset.was = s.textContent; s.textContent = 'x2mate.com-Matthew West - Because of Bethlehem (Lyrics) [Official Video] [4K Remastered] and a good deal more'; });
  await sleep(150);
  { const m = await ev(() => {
      const sc = document.querySelector('#v-home .home-scroll'), W = window.innerWidth;
      const b = document.getElementById('home-browse').getBoundingClientRect(), r = document.getElementById('home-resume').getBoundingClientRect();
      return { sw: sc.scrollWidth, cw: sc.clientWidth, W, bl: Math.round(b.left), bw: Math.round(b.width), rr: Math.round(r.right), rw: Math.round(r.width) };
    });
    ok(m.sw <= m.cw + 1 && m.bl >= 0 && m.rr <= m.W + 1 && Math.abs(m.bw - m.rw) < 2, `a long name under Resume: both buttons keep their size, and Home does not slide sideways (${JSON.stringify(m)})`); }
  await shot('00-home-long-resume');
  await ev(() => { const s = document.getElementById('home-resume-sub'); s.textContent = s.dataset.was || ''; });
  await page.tap('#nav button[data-tab="music"]');

  step = 'queue';
  console.log('\n' + step);
  const before = await ev(() => window.bmLyrics && document.querySelectorAll('#np-queue .vrow').length);
  void before;
  await page.tap(`#mu-list .vrow[data-i="${await rowOf('Fast Lane')}"] .more`);
  await page.tap('.sh-item:has-text("Play next")');
  await page.tap('#mini-open'); await page.tap('#np-tab-queue');
  ok(await until(() => document.querySelector('#np-queue .vrow .t1')?.textContent === 'Fast Lane'), 'Play next puts it first in Up Next');
  await shot('06-up-next');
  await ev(() => window.BMNative.back()); await ev(() => window.BMNative.back());
  const kept = await ev(() => window.__bmPlayback?.title);
  await sleep(700);
  await page.reload();
  ok(await until(() => window.__bmStarted && !document.getElementById('mini').classList.contains('hidden')), 'after a restart the queue is back');
  ok(await until(() => [...document.querySelectorAll('#home-recent .hr-card')].length > 0), 'and Home lists what was played');
  ok(await until(t => document.getElementById('mini-title').textContent === t, kept), `at the same song ("${kept}"), paused`);

  // ── v3.43.0: favourites, Home's two rows, and the music put away ─────
  step = 'favourites and the X';
  console.log('\n' + step);
  await page.tap('#nav button[data-tab="music"]');
  for (const title of ['Fast Lane', 'Night Lights']) {
    await page.tap(`#mu-list .vrow[data-i="${await rowOf(title)}"] .more`);
    await page.tap('.sh-item:has-text("Add to favourites")');
    await sleep(250);
  }
  ok(await ev(() => JSON.parse(localStorage.getItem('bm_m_favs') || '[]').filter(f => f.kind === 'music').length === 2), 'two songs starred from their menus');
  await page.tap('#nav button[data-tab="home"]');
  ok(await until(() => [...document.querySelectorAll('#home-favs .hr-t')].map(e => e.textContent).join('|') === 'Night Lights|Fast Lane'), 'Home has a Favourites row, the newest first');
  await shot('13-favourites');
  await page.tap('#home-favs .hr-card:first-child');
  ok(await until(() => window.__bmPlayback?.title === 'Night Lights' && window.__bmPlayback?.playing === true) && await ev(() => document.getElementById('np-from').textContent === 'Favourites'), 'a starred song plays, the starred ones after it');
  await ev(() => window.BMNative.back());
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('label:has(#st-home-favs)'); await page.tap('label:has(#st-home-recent)');
  await page.tap('#nav button[data-tab="home"]');
  ok(await until(() => document.getElementById('home-fav-wrap').classList.contains('hidden') && document.getElementById('home-recent-wrap').classList.contains('hidden') && document.getElementById('home-main').classList.contains('no-recent')), 'Settings takes either row off Home');
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('label:has(#st-home-favs)'); await page.tap('label:has(#st-home-recent)');
  await page.tap('#nav button[data-tab="home"]');
  ok(await until(() => !document.getElementById('home-fav-wrap').classList.contains('hidden') && !document.getElementById('home-recent-wrap').classList.contains('hidden')), 'and puts them back');
  // A long press on a recent thing offers the star too. Home's cards are
  // buttons, and until v3.43.0 a long press on a button was not taken.
  const card = await ev(() => { const c = document.querySelector('#home-recent .hr-card'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  if (card) {
    const c = await page.context().newCDPSession(page);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: card[0], y: card[1] }] });
    await sleep(800);
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    ok(await until(() => [...document.querySelectorAll('#sheet .sh-lbl')].some(e => /favourites/.test(e.textContent)) && [...document.querySelectorAll('#sheet .sh-lbl')].some(e => /Remove from recent/.test(e.textContent))), 'a long press on a recent thing offers the star, and to remove it');
    await ev(() => window.BMNative.back());
  }
  await page.tap('#nav button[data-tab="music"]');
  await page.tap('#mini-close');
  ok(await until(() => document.getElementById('mini').classList.contains('hidden') && window.__bmPlayback?.has === false), 'the X stops the music: the bar and Android\'s notification go');
  ok(await ev(() => localStorage.getItem('bm_m_queue') === null), 'and nothing is kept for next time');
  await page.reload();
  await until(() => window.__bmStarted === true);
  await sleep(600);
  ok(await ev(() => document.getElementById('mini').classList.contains('hidden')), 'after a restart there is no music bar');
  ok(await until(() => !document.getElementById('home-resume').classList.contains('hidden')), 'Home still offers Resume');
  await page.tap('#home-resume');
  ok(await until(() => window.__bmPlayback?.title === 'Night Lights' && window.__bmPlayback?.playing === true), 'which plays that song again');
  await ev(() => window.BMNative.back());
  await ev(() => window.BMNative.event('remote', { action: 'close' }));
  ok(await until(() => document.getElementById('mini').classList.contains('hidden') && window.__bmPlayback?.has === false), 'Close in the notification puts it away too');
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('label:has(#st-keepq)');
  await page.tap('#nav button[data-tab="music"]');
  await page.tap(`#mu-list .vrow[data-i="${await rowOf('Fast Lane')}"] .txt`);
  ok(await until(() => window.__bmPlayback?.playing === true), 'with "Keep the music for next time" off, a song plays');
  await sleep(700);
  await page.reload();
  await until(() => window.__bmStarted === true);
  await sleep(600);
  ok(await ev(() => document.getElementById('mini').classList.contains('hidden') && localStorage.getItem('bm_m_queue') === null), 'and the app opens again with no music bar');
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('label:has(#st-keepq)');
  await page.tap('#nav button[data-tab="home"]');

  if (mock.lib.videos.length) {
    step = 'video';
    console.log('\n' + step);
    await page.tap('#nav button[data-tab="videos"]');
    ok(await until(n => [...document.querySelectorAll('#vd-list .vrow')].filter(r => r.style.display !== 'none').length === n, mock.lib.videos.length), 'the videos are listed');
    await page.tap('#vd-list .vrow[data-i="0"] .txt');
    ok(await until(() => (document.getElementById('vp-video').currentTime || 0) > 0.3, null, 8000), 'a video plays');
    ok(await until(() => { const t = document.getElementById('vp-video').textTracks; return t.length === 1 && t[0].mode === 'showing'; }), 'its .srt beside it is shown as subtitles');
    ok(await ev(() => window.__bmOrientation === 'landscape' && window.__bmImmersive === true && window.__bmAwake === true), 'landscape, full screen, the screen kept on');
    // v3.48.0: turned in the web engine, its box is the screen the other way round
    await ev(() => document.getElementById('vp-more').click());
    await page.tap('#sheet .sh-item:has-text("Turn the picture")');
    await page.tap('#sheet .sh-item:has-text("A quarter to the left")');
    // (a menu's choice is acted on as its sheet closes)
    await until(() => /rotate/.test(document.getElementById('vp-video').style.transform));
    const turned = await ev(() => { const e = document.getElementById('vp-video'); return { tf: e.style.transform, w: parseFloat(e.style.width), h: parseFloat(e.style.height), W: innerWidth, H: innerHeight, o: window.__bmOrientation }; });
    ok(/rotate\(270deg\)/.test(turned.tf) && Math.abs(turned.w - turned.H) < 1 && Math.abs(turned.h - turned.W) < 1 && turned.o === 'sensor', `the web engine turns it too, in a box the screen's other way round (${JSON.stringify(turned)})`);
    await ev(() => document.getElementById('vp-more').click());
    await page.tap('#sheet .sh-item:has-text("Turn the picture")');
    await page.tap('#sheet .sh-item:has-text("Straight")');
    ok(await until(() => !document.getElementById('vp-video').style.transform && !document.getElementById('vp-video').style.width && window.__bmOrientation === 'landscape'), 'straight again, as it was');
    await sleep(600); await shot('07-video');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await ev(() => window.__bmImmersive === false && window.__bmOrientation === 'auto'), 'Back closes it and gives the screen back');

    // mpv plays videos on a phone (v3.41.0). Here the stand-in answers as it
    // would (m-android.js), so the controls, the tracks and the fallbacks are tried.
    step = 'video with mpv';
    console.log('\n' + step);
    await ev(() => localStorage.setItem('mock_mpv', '1'));
    await page.reload();
    await until(() => window.__bmStarted === true);
    await page.tap('#nav button[data-tab="videos"]');
    await until(() => [...document.querySelectorAll('#vd-list .vrow')].filter(r => r.style.display !== 'none').length > 0);
    await page.tap('#vd-list .vrow[data-i="0"] .txt');
    ok(await until(() => /^\/media\/video\/\d+$/.test(window.__bmMpv?.src || '')), `mpv is asked to play it, by its address (${await ev(() => window.__bmMpv?.src)})`);
    ok(await ev(() => document.documentElement.classList.contains('mpv-on') && document.getElementById('vp').classList.contains('mpv')), 'the page goes see-through over mpv\'s picture');
    ok(await ev(() => getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(document.getElementById('vp')).backgroundColor === 'rgba(0, 0, 0, 0)'
      && getComputedStyle(document.getElementById('app')).visibility === 'hidden' && !document.getElementById('vp-video').getAttribute('src')), 'only the controls are drawn (no video element, nothing behind)');
    ok(await until(() => document.getElementById('vp-cur').textContent !== '0:00' && document.getElementById('vp-dur').textContent === '2:05', null, 4000), 'its time and length show');
    ok(await ev(() => window.__bmOrientation === 'landscape' && window.__bmImmersive === true), 'landscape for a wide film, full screen');
    ok(await until(() => window.__bmMpv.subs.length === 1 && /Hello from the subtitle file/.test(window.__bmMpv.subs[0].text)), 'the .srt beside it goes to mpv');
    await ev(() => window.BMNative.event('remote', { action: 'pause' }));
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set pause yes')) && await ev(() => window.__bmPlayback?.playing !== true), 'a headphone button pauses the video, not the music');
    ok(await until(() => document.getElementById('vp-play').getAttribute('aria-label') === 'Play'), 'the play button follows mpv');
    await ev(() => document.getElementById('vp-play').click());
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set pause no')), 'play goes to mpv');
    await ev(() => document.getElementById('vp-fwd').click());
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'seek 10 relative')), 'ten seconds on');
    await ev(() => document.getElementById('vp-subs').click());
    const subs = await ev(() => [...document.querySelectorAll('#sheet .sh-item .sh-lbl')].map(e => e.textContent));
    ok(subs.some(s => /^English/.test(s)) && subs.some(s => /^Indonesian/.test(s)) && subs.some(s => /v1\.srt/.test(s)), `the film's subtitles by language, and the file (${subs.join(', ')})`);
    await page.tap('#sheet .sh-item:has-text("Indonesian")');
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set sid 2')), 'a subtitle track is chosen');
    await ev(() => document.getElementById('vp-more').click());
    await page.tap('#sheet .sh-item:has-text("Audio track")');
    await page.tap('#sheet .sh-item:has-text("English dub")');
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set aid 2')), 'and an audio track');
    // v3.49.0: the sound modes reach mpv as its audio filter (more below)
    ok(await ev(() => window.__bmMpv.commands.some(c => c[0] === 'set' && c[1] === 'af' && c[2] === '')), 'a film opens with no audio filter while every sound setting is off');
    // v3.48.0: the picture turned, for a film recorded sideways; the screen follows it
    ok(await ev(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set video-rotate 0')), 'a new film starts straight (mpv keeps a turn from film to film)');
    await ev(() => { window.__bmMpv.commands = []; document.getElementById('vp-more').click(); });
    await page.tap('#sheet .sh-item:has-text("Turn the picture")');
    await page.tap('#sheet .sh-item:has-text("A quarter to the right")');
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set video-rotate 90') && window.__bmOrientation === 'sensor'), `Turn the picture: mpv turns it a quarter, and the wide film now stands up (${await ev(() => window.__bmOrientation)})`);
    await ev(() => document.getElementById('vp-more').click());
    ok(await ev(() => /Turn the picture\s*90°/.test(document.getElementById('sheet').textContent)), 'the menu says how it is turned');
    await page.tap('#sheet .sh-item:has-text("Turn the picture")');
    await page.tap('#sheet .sh-item:has-text("Straight")');
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set video-rotate 0') && window.__bmOrientation === 'landscape'), 'and straight again, landscape again');
    // v3.49.0: the sound modes reach mpv as its audio filter, made by sound-chain.js
    await ev(() => { window.__bmMpv.commands = []; document.getElementById('vp-more').click(); });
    await page.tap('#sheet .sh-item:has-text("Sound")');
    await page.tap('#sheet .snd [data-voice="on"]');
    ok(await until(() => window.__bmMpv.commands.some(c => c[0] === 'set' && c[1] === 'af' && /^lavfi=\[dialoguenhance,/.test(c[2]))), `clear voice: mpv is given dialoguenhance (${await ev(() => (window.__bmMpv.commands.filter(c => c[1] === 'af').pop() || [])[2])})`);
    await page.tap('#sheet .snd [data-mode="hall"]');
    ok(await until(() => window.__bmMpv.commands.some(c => c[1] === 'af' && /aecho/.test(c[2]) && /dialoguenhance/.test(c[2]))), 'and Concert hall with it');
    await page.tap('#sheet .snd [data-mode="off"]'); await page.tap('#sheet .snd [data-voice="off"]');
    ok(await until(() => { const a = window.__bmMpv.commands.filter(c => c[1] === 'af').pop(); return a && a[2] === ''; }), 'and off again');
    await ev(() => window.BMNative.back());
    // v3.48.0: picture-in-picture: Android is told a film plays, and its shape
    ok(await until(() => window.__bmPip?.film === true && window.__bmPip.playing === true && window.__bmPip.w === 3840 && window.__bmPip.h === 2160), `Android is told a film plays, for its small window (${JSON.stringify(await ev(() => window.__bmPip))})`);
    await ev(() => window.BMNative.event('pip', { on: true }));
    ok(await until(() => document.getElementById('vp').classList.contains('pip') && !document.getElementById('vp').classList.contains('ui') && getComputedStyle(document.getElementById('vp-ui')).display === 'none'), 'in the small window only the picture shows');
    await ev(() => { window.__bmMpv.commands = []; window.BMNative.event('remote', { action: 'toggle' }); });
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set pause yes') && window.__bmPip.playing === false), 'its play and pause button pauses the film, and Android hears it is paused');
    await ev(() => { window.__bmMpv.commands = []; window.BMNative.event('remote', { action: 'seekBy', value: 10 }); });
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'seek 10 relative')), 'and its skip goes ten seconds on');
    await ev(() => window.BMNative.event('pip', { on: false }));
    ok(await until(() => !document.getElementById('vp').classList.contains('pip') && document.getElementById('vp').classList.contains('ui')), 'back full size: the controls again');
    await ev(() => document.getElementById('vp-play').click());
    await until(() => window.__bmPip.playing === true);
    await ev(() => { window.__bmMpv.commands = []; window.BMNative.event('pip', { on: true }); window.BMNative.event('pip', { on: false, closed: true }); });
    ok(await until(() => window.__bmMpv.commands.some(c => c.join(' ') === 'set pause yes')), 'the small window closed: the film pauses');
    await sleep(300); await shot('09-video-mpv');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await ev(() => window.__bmMpv.closed === true && !document.documentElement.classList.contains('mpv-on')), 'Back closes it: mpv stops and the page is solid again');
    ok(await until(() => window.__bmPip?.film === false), 'and Android is told no film is open');

    await ev(() => localStorage.setItem('mock_mpv_fail', '1'));
    await page.tap('#vd-list .vrow[data-i="0"] .txt');
    ok(await until(() => !document.getElementById('vp-note').classList.contains('hidden') && /mpv could not play/.test(document.getElementById('vp-note').textContent)), 'a file mpv cannot open says so');
    ok(await ev(() => /moov atom not found/.test(document.getElementById('vp-note').textContent) && document.querySelectorAll('#vp-note button').length === 2), 'with mpv\'s reason, and two ways on');
    await page.tap('#vp-note button:has-text("Open in another app")');
    ok(await until(() => /^\/media\/video\/\d+$/.test(window.__bmOpenWith || '')), 'another app can be asked to open it');
    await ev(() => window.BMNative.back());
    await page.tap('#vd-list .vrow[data-i="0"] .txt');
    await until(() => document.querySelectorAll('#vp-note button').length === 2);
    await page.tap('#vp-note button:has-text("Try the web engine")');
    ok(await until(() => !document.documentElement.classList.contains('mpv-on') && (document.getElementById('vp-video').currentTime || 0) > 0.3, null, 8000), 'or the web engine plays it instead');
    await ev(() => window.BMNative.back());
    await ev(() => localStorage.removeItem('mock_mpv_fail'));

    // v3.42.0: folders, the grid, MX-style controls, carrying on
    step = 'videos by folder';
    console.log('\n' + step);
    await page.tap('#vd-chips .chip[data-k="folders"]');
    ok(await until(() => document.querySelectorAll('#vd-list .vfolder').length > 0), 'the videos by folder');
    await page.tap('#vd-list .vfolder .txt');
    ok(await until(() => document.getElementById('v-sub').classList.contains('on') && document.querySelectorAll('#sub-list .vrow.video').length > 0), 'a folder opens over the tab, with its videos');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await until(() => !document.getElementById('v-sub').classList.contains('on')), 'Back closes the folder');
    await page.tap('#vd-view-btn');
    ok(await until(() => document.querySelectorAll('#vd-list .vcard').length > 0), 'a grid of folders');
    await page.tap('#vd-chips .chip[data-k="all"]');
    ok(await until(() => document.querySelectorAll('#vd-list .vcard[data-vi]').length > 0), 'and of videos');
    await shot('10-videos-grid');
    await page.tap('#vd-view-btn');
    await until(() => document.querySelectorAll('#vd-list .vrow.video').length > 0);

    step = 'the player, MX style';
    console.log('\n' + step);
    await page.tap('#vd-list .vrow[data-i="0"] .txt');
    ok(await until(() => /^\/media\/video\/\d+$/.test(window.__bmMpv?.src || '') && window.__bmMpv.closed !== true), 'mpv plays it');
    await until(() => document.getElementById('vp-dur').textContent === '2:05');
    const c = await page.context().newCDPSession(page);
    const touch = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const swipe = async (x0, y0, x1, y1) => { await touch('touchStart', x0, y0); for (let i = 1; i <= 10; i++) { await touch('touchMove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await sleep(20); } await touch('touchEnd'); };
    await ev(() => { window.__bmMpv.commands = []; });
    const W = 892, H = 412;   // landscape is asked for; the test window stays as it is
    void W; void H;
    // v3.43.2: the seek bar follows a sideways swipe while it goes
    { const r0 = await ev(() => +document.getElementById('vp-range').value);
      await touch('touchStart', 100, 450); for (let i = 1; i <= 8; i++) { await touch('touchMove', 100 + i * 25, 452); await sleep(20); }
      const r1 = await ev(() => +document.getElementById('vp-range').value), hudOn = await ev(() => document.getElementById('vp-hud').classList.contains('on'));
      await touch('touchEnd');
      ok(r1 > r0 && hudOn, `the seek bar follows a sideways swipe (${r0} to ${r1} of 10000), the time in the middle`); }
    await sleep(300);
    await swipe(100, 450, 330, 450);
    ok(await until(() => window.__bmMpv.commands.some(cm => cm[0] === 'seek' && cm[2] === 'absolute+keyframes') && window.__bmMpv.commands.some(cm => cm[0] === 'seek' && cm[2] === 'absolute')), 'a sideways swipe moves through the video (quick seeks, then exact)');
    await ev(() => { window.__bmVol = 8; });
    await swipe(330, 600, 330, 350);
    ok(await until(() => window.__bmVol > 8), `up on the right: louder (${await ev(() => window.__bmVol)})`);
    await ev(() => { window.__bmBright = 0.5; });
    await swipe(80, 600, 80, 350);
    ok(await until(() => window.__bmBright > 0.5), 'up on the left: brighter');
    // v3.43.2: a swipe from the edge is Android's (Back), and changes nothing here
    await ev(() => { window.__bmBright = 0.5; });
    await swipe(6, 600, 6, 350);
    await sleep(200);
    ok(await ev(() => window.__bmBright === 0.5), 'a swipe from the very edge is left to Android: the brightness stays');
    // v3.43.2: a phone that counts brightness past 255 (Xiaomi) read as several times full, and a swipe down did nothing
    await ev(() => { window.__bmBright = 4.7; });
    await swipe(80, 350, 80, 600);
    ok(await until(() => window.__bmBright < 0.9), `from a level read as more than full, down on the left: darker at once (${(await ev(() => window.__bmBright)).toFixed(2)})`);
    // v3.43.2: the seek bar dragged: the picture follows, the time shows, and the end is exact
    await ev(() => { window.__bmMpv.commands = []; const r = document.getElementById('vp-range'); r.value = '5000'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    ok(await until(() => window.__bmMpv.commands.some(cm => cm[0] === 'seek' && cm[2] === 'absolute+keyframes') && document.getElementById('vp-hud').classList.contains('on') && /1:0[23]/.test(document.getElementById('vp-hud-txt').textContent)), `dragging the seek bar: the picture follows, the time in the middle (${await ev(() => document.getElementById('vp-hud-txt').textContent)})`);
    await ev(() => { const r = document.getElementById('vp-range'); r.dispatchEvent(new Event('change', { bubbles: true })); });
    ok(await until(() => window.__bmMpv.commands.some(cm => cm[0] === 'seek' && cm[2] === 'absolute')), 'and let go, the exact place');
    await ev(() => { window.__bmMpv.commands = []; document.getElementById('vp-fit').click(); });
    ok(await until(() => window.__bmMpv.commands.some(cm => cm.join(' ') === 'set panscan 1')), 'the size button: Fill crops the picture');
    await ev(() => document.getElementById('vp-fit').click());
    ok(await until(() => window.__bmMpv.commands.some(cm => cm.join(' ') === 'set keepaspect no')), 'then Stretch');
    await ev(() => document.getElementById('vp-lock').click());
    ok(await until(() => document.getElementById('vp').classList.contains('locked')), 'the lock hides the controls');
    await page.touchscreen.tap(200, 450);
    await sleep(400);
    ok(await ev(() => !document.getElementById('vp').classList.contains('ui') && document.getElementById('vp-unlock').classList.contains('on')), 'locked, a tap shows only the unlock button');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await ev(() => !document.getElementById('vp').classList.contains('locked') && window.__bmMpv.closed !== true), 'Back unlocks first');
    await ev(() => document.getElementById('vp-ab').click()); await sleep(1100); await ev(() => document.getElementById('vp-ab').click());
    ok(await until(() => window.__bmMpv.commands.some(cm => cm[1] === 'ab-loop-a') && window.__bmMpv.commands.some(cm => cm[1] === 'ab-loop-b')), 'A-B repeat goes to mpv');
    ok(await ev(() => /\d+:\d+/.test(document.getElementById('vp-meta').textContent) && /76%/.test(document.getElementById('vp-meta').textContent)), 'the clock and the battery with the controls');
    await sleep(5600);   // a position worth keeping (saved every five seconds)
    const t1 = await ev(() => window.__bmMpv.start ?? 0);
    void t1;
    ok(await ev(() => window.BMNative.back()) === 'handled', 'Back closes it');
    ok(await ev(() => !!JSON.parse(localStorage.getItem('bm_m_vpos') || '{}').v201), 'where it was left is kept');
    await page.tap('#vd-list .vrow[data-i="0"] .txt');
    ok(await until(() => (window.__bmMpv?.start || 0) > 5 && !document.getElementById('vp-chip').classList.contains('hidden')), `opened again, it carries on from there (${await ev(() => window.__bmMpv?.start)} s), with "Start over"`);
    await ev(() => window.BMNative.back());
    // drawn again when the player closes (v3.47.0: m-vplayer.js tells m-video.js)
    ok(await until(() => !!document.querySelector('#vd-list .vbar')), 'the list shows how far it was watched');
    await ev(() => localStorage.removeItem('mock_mpv'));
    // v3.43.2: the view chosen is kept when Android closes the app in the background (it came back on All)
    await page.tap('#vd-chips .chip[data-k="folders"]');
    await page.reload();
    await until(() => window.__bmStarted === true);
    await page.tap('#nav button[data-tab="videos"]');
    ok(await until(() => document.querySelector('#vd-chips .chip.on')?.dataset.k === 'folders' && document.querySelectorAll('#vd-list .vfolder').length > 0), 'Folders is still the view after the app starts again');
    await page.tap('#vd-chips .chip[data-k="all"]');
  }

  // ── v3.42.0: Photos and the picture viewer ────────────────────────
  if (mock.lib.images.length) {
    step = 'photos';
    console.log('\n' + step);
    await page.tap('#nav button[data-tab="photos"]');
    ok(await until(n => document.querySelectorAll('#ph-list .ptile').length === n, mock.lib.images.length), 'the pictures are listed');
    await page.tap('#ph-list .ptile[data-pi="0"]');
    ok(await until(() => !document.getElementById('iv').classList.contains('hidden') && document.querySelector('.iv-slide:nth-child(2) img')?.complete), 'a picture opens full screen');
    ok(await ev(() => document.getElementById('iv-count').textContent === '1 / 3'), 'with the others to swipe to (1 / 3)');
    await sleep(300); await shot('11-picture');
    { const c = await page.context().newCDPSession(page); const t = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await t('touchStart', 330, 450); for (let i = 1; i <= 10; i++) { await t('touchMove', 330 - i * 25, 452); await sleep(16); } await t('touchEnd'); }
    ok(await until(() => document.getElementById('iv-count').textContent === '2 / 3'), 'a swipe goes to the next one');
    await page.tap('#iv-share');
    ok(await ev(() => /^\/media\/image\/30\d$/.test(window.__bmSharedFile?.[0] || '')), 'Share sends the picture itself');
    await page.tap('#iv-fav');
    ok(await until(() => document.getElementById('iv-fav').classList.contains('on') && JSON.parse(localStorage.getItem('bm_m_favs') || '[]').some(f => f.kind === 'image')), 'the star keeps the picture among the favourites');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await until(() => document.getElementById('iv').classList.contains('hidden')), 'Back closes it');
    await page.tap('#ph-chips .chip[data-k="albums"]');
    ok(await until(() => document.querySelectorAll('#ph-list .acard').length === 2), 'by album (Camera, Screenshots)');
    // v3.43.2: and kept, as the Videos tab's view is
    await page.reload();
    await until(() => window.__bmStarted === true);
    await page.tap('#nav button[data-tab="photos"]');
    ok(await until(() => document.querySelector('#ph-chips .chip.on')?.dataset.k === 'albums' && document.querySelectorAll('#ph-list .acard').length === 2), 'Albums is still the view after the app starts again');
    await ev(() => window.BMNative.event('open', { url: '/opened/2', kind: 'image', name: 'From a chat.jpg', mime: 'image/jpeg' }));
    ok(await until(() => !document.getElementById('iv').classList.contains('hidden') && document.getElementById('iv-title').textContent === 'From a chat.jpg'), 'a picture from another app opens in the viewer');
    await ev(() => window.BMNative.back());

    step = 'PDF';
    console.log('\n' + step);
    await ev(() => window.BMNative.event('open', { url: '/opened/1', kind: 'pdf', name: 'Test document.pdf', mime: 'application/pdf' }));
    ok(await until(() => !document.getElementById('pv').classList.contains('hidden') && document.querySelectorAll('#pv-pages .pv-p').length === 2, null, 12000), 'a PDF opens in the reader, its two pages laid out');
    ok(await until(() => !!document.querySelector('#pv-pages .pv-p canvas.pv-c'), null, 12000), 'its first page is drawn (pdf.js)');
    await sleep(300); await shot('12-pdf');
    await page.tap('#pv-find');
    await page.fill('#pv-q', 'fox');
    await page.press('#pv-q', 'Enter');
    ok(await until(() => /1 page/.test(document.getElementById('pv-hits').textContent), null, 8000), 'Find: the word is on one page');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await ev(() => document.getElementById('pv-search').classList.contains('hidden')), 'Back closes the search');
    await page.tap('#pv-fav');
    ok(await until(() => document.getElementById('pv-fav').classList.contains('on')), 'the star keeps the document among the favourites');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await until(() => document.getElementById('pv').classList.contains('hidden')), 'and then the document');
    await page.tap('#nav button[data-tab="home"]');
    ok(await until(() => [...document.querySelectorAll('#home-recent .hr-t')].some(e => /Test document/.test(e.textContent))), 'Home lists the document among the recent things');
    ok(await until(() => { const k = [...document.querySelectorAll('#home-favs .hr-card')].map(c => c.dataset.key); return k.some(x => x.startsWith('p')) && k.some(x => x.startsWith('i')) && k.filter(x => x.startsWith('s')).length === 2; }), 'and its Favourites row has the songs, the picture and the document');
    await shot('14-home-rows');
  }

  step = 'settings';
  console.log('\n' + step);
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('#st-themes button[data-v="ocean"]');
  ok(await ev(() => document.documentElement.dataset.theme === 'ocean' && window.__bmBars?.[0] === '#04121c'), 'a theme changes the page and Android\'s bars');
  await page.tap('#st-saver button[data-v="on"]');
  ok(await ev(() => document.documentElement.classList.contains('battery-saver')), 'the battery saver turns on');
  await page.tap('#st-saver button[data-v="auto"]');
  await page.tap('#st-log');
  ok(await until(() => !document.getElementById('sheet').classList.contains('hidden') && document.querySelector('.sh-log pre')), 'the log shows');
  await ev(() => window.BMNative.back());
  await page.tap('#st-themes button[data-v="dark"]');
  await shot('08-settings');

  // v3.44.0: updates from GitHub. Android's side is the stand-in (m-android.js):
  // GitHub has 9.9.0 once mock_update is set.
  step = 'updates';
  console.log('\n' + step);
  // A start with no look for a day: the stand-in starts afresh, as the page does.
  await ev(() => localStorage.removeItem('bm_m_upd_last'));
  await page.reload();
  await until(() => window.__bmStarted === true, null, 15000);
  await page.tap('#nav button[data-tab="settings"]');
  ok(await until(() => (window.__bmUpdChecks || 0) === 1 && /newest version/.test(document.getElementById('st-upd-note').textContent), null, 12000),
    'it looked by itself once, a few seconds after the start, and says this is the newest');
  ok(await ev(() => document.getElementById('home-upd').classList.contains('hidden') && !document.querySelector('#nav button[data-tab="settings"]').classList.contains('dot')), 'no card on Home and no dot on Settings while there is nothing newer');
  await ev(() => localStorage.setItem('mock_update', '1'));
  await page.tap('#st-upd-btn');
  ok(await until(() => !document.getElementById('sheet').classList.contains('hidden') && /BM Player 9\.9\.0/.test(document.getElementById('sheet').textContent) && /29\.0 MB/.test(document.getElementById('sheet').textContent)),
    'Check finds 9.9.0 and the sheet shows it with its size');
  ok(await ev(() => document.querySelector('#sheet [data-go]').textContent === 'Download and install'), 'its button downloads and installs');
  await shot('15-update-sheet');
  await page.tap('#sheet [data-go]');
  ok(await until(() => /Downloading 9\.9\.0: \d+%/.test(document.querySelector('#sheet .upd-note')?.textContent || '') && !document.querySelector('#sheet .upd-prog').classList.contains('hidden')), 'the download shows its progress');
  ok(await until(() => window.__bmInstalled === '9.9.0', null, 4000), 'and once it is downloaded, the install starts by itself');
  ok(await until(() => /Android is installing 9\.9\.0/.test(document.getElementById('st-upd-note').textContent)), 'Settings says Android is installing it');
  await ev(() => window.BMNative.back());
  await page.tap('#nav button[data-tab="home"]');
  ok(await until(() => !document.getElementById('home-upd').classList.contains('hidden') && document.getElementById('home-upd-title').textContent === 'BM Player 9.9.0'
    && document.querySelector('#nav button[data-tab="settings"]').classList.contains('dot')), 'Home has the card and the Settings tab a dot');
  const updCard = await ev(() => { const r = document.getElementById('home-upd').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sw: document.querySelector('.home-scroll').scrollWidth, cw: document.querySelector('.home-scroll').clientWidth }; });
  ok(updCard.l >= 0 && updCard.r <= updCard.w && updCard.sw <= updCard.cw, `the card fits the screen (${Math.round(updCard.l)} to ${Math.round(updCard.r)} of ${updCard.w})`);
  await shot('16-update-home');
  await page.tap('#home-upd-x');
  ok(await ev(() => document.getElementById('home-upd').classList.contains('hidden') && localStorage.getItem('bm_m_upd_later') === '9.9.0'), 'Later hides the card for this version');
  // Android has not allowed BM Player to install apps yet: Allow first, then Install.
  await ev(() => { localStorage.setItem('mock_update_perm', '0'); localStorage.removeItem('bm_m_upd_later'); window.__bmInstalled = null; });
  await page.reload();
  await until(() => window.__bmStarted === true, null, 15000);
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('#st-upd-btn');
  ok(await until(() => !document.getElementById('sheet').classList.contains('hidden') && /9\.9\.0/.test(document.getElementById('sheet').textContent)), 'after a restart, Check finds it again');
  await page.tap('#sheet [data-go]');
  ok(await until(() => document.querySelector('#sheet [data-go]')?.textContent === 'Allow' && /needs your OK/.test(document.querySelector('#sheet .upd-note').textContent), null, 4000), 'downloaded, it asks for Android\'s OK instead of installing');
  ok(await ev(() => window.__bmInstalled == null), 'and nothing was installed');
  await page.tap('#sheet [data-go]');
  ok(await until(() => window.__bmAllowAsked === true && document.querySelector('#sheet [data-go]')?.textContent === 'Install'), 'Allow opens Android\'s setting, and with it on the button installs');
  await page.tap('#sheet [data-go]');
  ok(await until(() => window.__bmInstalled === '9.9.0'), 'Install hands it to Android');
  await ev(() => window.BMNative.back());
  // Stopping a download, and a check that fails
  await ev(() => { localStorage.removeItem('mock_update_perm'); });
  await page.reload();
  await until(() => window.__bmStarted === true, null, 15000);
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('#st-upd-btn');
  await until(() => !document.getElementById('sheet').classList.contains('hidden'));
  await ev(() => localStorage.setItem('mock_update_slow', '1'));
  await page.tap('#sheet [data-go]');
  await until(() => document.querySelector('#sheet [data-go]')?.textContent === 'Stop');
  await page.tap('#sheet [data-go]');
  ok(await until(() => window.__bmUpdCancelled === true && /9\.9\.0 is out/.test(document.querySelector('#sheet .upd-note').textContent)), 'Stop stops the download and offers it again');
  await ev(() => window.BMNative.back());
  await ev(() => { localStorage.removeItem('mock_update'); localStorage.removeItem('mock_update_slow'); localStorage.setItem('mock_update_fail', '1'); });
  await page.reload();
  await until(() => window.__bmStarted === true, null, 15000);
  await page.tap('#nav button[data-tab="settings"]');
  await page.tap('#st-upd-btn');
  ok(await until(() => /could not be reached/.test(document.getElementById('st-upd-note').textContent) && document.getElementById('st-upd-btn').textContent === 'Try again'), 'a check that fails says why and offers to try again');
  ok(await ev(() => document.getElementById('sheet').classList.contains('hidden')), 'and opens no sheet');
  // By itself: once a day, and not at all when switched off
  await ev(() => { localStorage.removeItem('mock_update_fail'); localStorage.setItem('bm_m_upd_last', String(Date.now() - 2 * 864e5)); });
  await page.tap('#st-upd-auto');
  ok(await ev(() => localStorage.getItem('bm_m_upd_auto') === '0'), 'the switch turns the daily look off');
  await page.reload();
  await until(() => window.__bmStarted === true, null, 15000);
  await sleep(9000);
  ok(await ev(() => !window.__bmUpdChecks), 'and with it off, nothing is asked after a start');
  await ev(() => localStorage.setItem('bm_m_upd_auto', '1'));
  // Updated: said once, on the new version's first start
  await ev(() => { localStorage.setItem('mock_version', '3.44.0'); localStorage.setItem('bm_m_ver', '3.43.2'); localStorage.setItem('bm_m_upd_last', String(Date.now())); });
  await page.reload();
  await until(() => window.__bmStarted === true, null, 15000);
  ok(await until(() => /updated to 3\.44\.0/.test(document.getElementById('toast').textContent) && document.getElementById('toast').classList.contains('on'), null, 5000), 'the first start of a new version says it was updated');
  ok(await ev(() => localStorage.getItem('bm_m_ver') === '3.44.0'), 'once');
  await ev(() => { localStorage.removeItem('mock_version'); localStorage.removeItem('bm_m_ver'); });

  // v3.44.0: Android short of memory, or the app out of sight: what is not on
  // screen gives its graphics memory back at once, and builds it again when shown.
  step = 'memory';
  console.log('\n' + step);
  await page.tap('#nav button[data-tab="home"]');
  ok(await until(() => (document.getElementById('home-flow')?.width || 0) > 1, null, 5000), 'Home\'s fluid is drawn');
  await page.tap('#nav button[data-tab="music"]');
  await sleep(300);
  await ev(() => window.BMNative.event('memory', { level: 15 }));
  ok(await until(() => document.getElementById('home-flow')?.width === 1), 'Android short of memory: the fluid behind Home, not on screen, gives its memory back');
  await page.tap('#nav button[data-tab="home"]');
  ok(await until(() => (document.getElementById('home-flow')?.width || 0) > 1, null, 5000), 'and Home shown again draws it again');

  step = 'opened from another app';
  console.log('\n' + step);
  await ev(() => window.BMNative.event('open', { url: '/media/audio/101', kind: 'audio', name: 'From a file manager.mp3', mime: 'audio/mpeg' }));
  ok(await until(() => window.__bmPlayback?.title === 'From a file manager' && document.getElementById('np').classList.contains('on')), 'an audio file plays, in Now Playing');
  await ev(() => window.BMNative.back());

  // v3.45.0: several chosen at once, shared, and deleted from the phone. The
  // stand-in answers as Android would (m-android.js): mock_delete is what the
  // person says to Android's question, mock_sdk the Android version.
  if (mock.lib.images.length) {
    step = 'choosing and deleting';
    console.log('\n' + step);
    const cdp = await page.context().newCDPSession(page);
    const centre = sel => ev(s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && r.width ? [r.x + r.width / 2, r.y + r.height / 2] : null; }, sel);
    const hold = async sel => {
      const p = await centre(sel); if (!p) throw new Error('nothing to hold at ' + sel);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1] }] });
      await sleep(800);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(250);
    };
    const bar = () => ev(() => ({ on: document.getElementById('sel-bar').classList.contains('on'), n: document.getElementById('sel-n').textContent }));
    const toastSays = src => until(s => document.getElementById('toast').classList.contains('on') && new RegExp(s).test(document.getElementById('toast').textContent), src);
    const sheetSays = src => until(s => !document.getElementById('sheet').classList.contains('hidden') && new RegExp(s).test(document.getElementById('sheet').textContent), src);
    const asked = () => ev(() => (window.__bmDeleted || []).length);

    // Pictures: a long press starts choosing, taps add and take away
    await page.tap('#nav button[data-tab="photos"]');
    await page.tap('#ph-chips .chip[data-k="all"]');
    await until(() => document.querySelectorAll('#ph-list .ptile').length === 3);
    await hold('#ph-list .ptile[data-pi="0"]');
    let b = await bar();
    ok(b.on && b.n === '1 selected' && await ev(() => document.getElementById('ph-list').classList.contains('selecting') && document.querySelector('#ph-list .ptile[data-pi="0"]').classList.contains('sel')
      && document.querySelectorAll('#ph-list .sel-mark').length === 3), `a long press on a picture starts choosing, with it chosen (${b.n})`);
    ok(await ev(() => document.getElementById('iv').classList.contains('hidden')), 'and does not open it');
    await page.tap('#ph-list .ptile[data-pi="1"]');
    ok((await bar()).n === '2 selected', 'a tap chooses another');
    await page.tap('#ph-list .ptile[data-pi="1"]');
    ok((await bar()).n === '1 selected' && await ev(() => !document.querySelector('#ph-list .ptile[data-pi="1"]').classList.contains('sel')), 'a second tap takes it away');
    await page.tap('#sel-all');
    ok((await bar()).n === '3 selected' && await ev(() => document.getElementById('sel-all').getAttribute('aria-label') === 'Select none'), 'Select all chooses all three');
    await sleep(250); await shot('17-choosing');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await until(() => !document.getElementById('sel-bar').classList.contains('on')
      && !document.querySelector('#ph-list .sel, #ph-list .sel-mark') && !document.getElementById('ph-list').classList.contains('selecting')), 'Back ends the choosing, and nothing is left marked');

    // Two shared at once
    await hold('#ph-list .ptile[data-pi="0"]');
    await page.tap('#ph-list .ptile[data-pi="2"]');
    await page.tap('#sel-acts button[aria-label="Share"]');
    const shared = await ev(() => window.__bmSharedFiles);
    ok(shared?.srcs?.length === 2 && shared.srcs.every(s => /^\/media\/image\/30\d$/.test(s)) && shared.type === 'image/*', `Share sends both pictures at once (${JSON.stringify(shared)})`);
    ok(!(await bar()).on, 'and the choosing ends');

    // From the viewer: the person says no to Android, then yes
    const favImages = () => ev(() => JSON.parse(localStorage.getItem('bm_m_favs') || '[]').filter(f => f.kind === 'image').map(f => f.url));
    const starred = ((await favImages())[0] || '').split('/').pop();
    ok(!!starred, `a picture was starred earlier (${starred})`);
    await ev(() => localStorage.setItem('mock_delete', 'no'));
    await page.tap(`#ph-list .ptile[data-id="${starred}"]`);
    await until(() => !document.getElementById('iv').classList.contains('hidden'));
    ok(await ev(() => !document.getElementById('iv-del').classList.contains('hidden')), 'the viewer has Delete for a picture of the phone');
    let n0 = await asked();
    await page.tap('#iv-del');
    ok(await toastSays('Nothing was deleted') && await ev(n => window.__bmDeleted.length === n + 1 && /\/ 3$/.test(document.getElementById('iv-count').textContent), n0), 'Android asked, the person said no: the picture stays');
    await ev(() => localStorage.setItem('mock_delete', 'yes'));
    await page.tap('#iv-del');
    ok(await toastSays('^1 picture deleted') && await until(() => /\/ 2$/.test(document.getElementById('iv-count').textContent)), 'said yes: it goes, and the next one shows');
    ok(await ev(id => { const d = window.__bmDeleted.at(-1); return d.kind === 'image' && d.ids.join() === id && !d.folder; }, starred), 'Android was asked to delete that one picture');
    ok((await favImages()).length === 0, 'it is no longer among the favourites');
    await ev(() => window.BMNative.back());
    ok(await until(() => document.querySelectorAll('#ph-list .ptile').length === 2), 'the grid has the other two');

    // Android 10 and older delete without asking: the page asks
    await ev(() => localStorage.setItem('mock_sdk', '29'));
    await page.reload();
    await until(() => window.__bmStarted === true, null, 15000);
    await page.tap('#nav button[data-tab="photos"]');
    await page.tap('#ph-chips .chip[data-k="albums"]');
    await until(() => document.querySelectorAll('#ph-list .acard').length === 2);
    await hold('#ph-list .acard[data-ai="0"]');
    ok(await sheetSays('Delete the album'), 'a long press on an album offers to delete it');
    await page.tap('#sheet .sh-item:has-text("Delete the album")');
    ok(await sheetSays('Delete the folder Camera\\?') && await ev(() => /2 pictures are deleted from the phone for good/.test(document.querySelector('#sheet .sh-sub')?.textContent || '')), 'Android 10: the page asks first, and says how many go');
    n0 = await asked();
    await page.tap('#sheet .sh-item:has-text("Cancel")');
    await sleep(400);
    ok(await ev(n => (window.__bmDeleted || []).length === n && document.querySelectorAll('#ph-list .acard').length === 2, n0), 'Cancel: Android is not asked, and nothing goes');
    await hold('#ph-list .acard[data-ai="0"]');
    await page.tap('#sheet .sh-item:has-text("Delete the album")');
    await sheetSays('Delete the folder');
    await page.tap('#sheet .sh-item:has-text("Delete")');
    ok(await until(() => document.querySelectorAll('#ph-list .acard').length === 1) && await ev(() => { const d = window.__bmDeleted.at(-1); return d.kind === 'image' && d.folder === true && d.ids.length === 2; }), 'Delete: the album\'s two pictures go, and the album with them');
    ok(await toastSays('^2 pictures deleted'), 'and it says so');

    // A video: chosen, the page asks, and it goes with where it was left
    if (mock.lib.videos.length) {
      await page.tap('#nav button[data-tab="videos"]');
      await page.tap('#vd-chips .chip[data-k="all"]');
      await until(n => document.querySelectorAll('#vd-list .vrow.video').length === n, mock.lib.videos.length);
      await hold('#vd-list .vrow.video .txt');
      ok((await bar()).n === '1 selected' && await ev(() => document.querySelector('#vd-list .vrow.video').classList.contains('sel') && getComputedStyle(document.querySelector('#vd-list .vrow.video .more')).visibility === 'hidden'), 'a long press on a video chooses it (its ⋮ out of the way meanwhile)');
      await sleep(250); await shot('18-choosing-videos');
      await page.tap('#sel-acts button[aria-label="Delete"]');
      ok(await sheetSays('Delete this video\\?'), 'Delete: the page asks first');
      await page.tap('#sheet .sh-item:has-text("Delete")');
      ok(await until(() => /No videos found/.test(document.getElementById('vd-empty').textContent)), 'the video goes from the list');
      ok(await ev(() => !JSON.parse(localStorage.getItem('bm_m_vpos') || '{}').v201 && !JSON.parse(localStorage.getItem('bm_m_recent') || '[]').some(e => e.key === 'v201')), 'and where it was left, and from the recent things');
      ok(!(await bar()).on, 'the choosing ends with it');
    }

    // Songs: the one playing goes, the next one left plays
    await page.tap('#nav button[data-tab="music"]');
    await page.tap('#mu-chips .chip[data-k="songs"]');
    await until(() => document.querySelectorAll('#mu-list .vrow.song').length >= 4);
    const night = await rowOf('Night Lights');
    await page.tap(`#mu-list .vrow[data-i="${night}"] .txt`);
    ok(await until(() => window.__bmPlayback?.title === 'Night Lights' && window.__bmPlayback.playing === true, null, 8000), 'a song plays');
    await hold(`#mu-list .vrow[data-i="${night}"] .txt`);
    await page.tap(`#mu-list .vrow[data-i="${await rowOf('Ocean Drive')}"] .txt`);
    ok((await bar()).n === '2 selected' && await ev(() => window.__bmPlayback?.title === 'Night Lights'), 'songs are chosen the same way, and a tap then plays nothing');
    await sleep(250); await shot('19-choosing-songs');
    await page.tap('#sel-acts button[aria-label="More"]');
    ok(await until(() => ['Play', 'Shuffle', 'Play next', 'Add to queue'].every(l => [...document.querySelectorAll('#sheet .sh-lbl')].some(e => e.textContent === l))), 'More offers to play or queue them');
    await ev(() => window.BMNative.back());
    await ev(() => localStorage.setItem('mock_delete', 'denied'));
    await page.tap('#sel-acts button[aria-label="Delete"]');
    await sheetSays('Delete 2 songs\\?');
    await sleep(250); await shot('20-delete-asks');
    await page.tap('#sheet .sh-item:has-text("Delete")');
    ok(await toastSays('may not change files') && (await bar()).n === '2 selected', 'no access to the storage: it says what to allow, and they stay chosen');
    await ev(() => localStorage.setItem('mock_delete', 'yes'));
    await page.tap('#sel-acts button[aria-label="Delete"]');
    await sheetSays('Delete 2 songs\\?');
    await page.tap('#sheet .sh-item:has-text("Delete")');
    ok(await until(() => !!window.__bmPlayback?.title && !/Night Lights|Ocean Drive/.test(window.__bmPlayback.title) && window.__bmPlayback.playing === true, null, 8000), `the song playing went: the next one left plays (${await ev(() => window.__bmPlayback?.title)})`);
    ok(await ev(() => ![...document.querySelectorAll('#mu-list .vrow .t1')].some(e => /Night Lights|Ocean Drive/.test(e.textContent))), 'both go from the list');
    ok(await ev(() => !JSON.parse(localStorage.getItem('bm_m_favs') || '[]').some(f => f.key === 's101' || f.key === 's102')), 'and from the favourites');
    await page.tap('#mini-close');
    await ev(() => { localStorage.removeItem('mock_sdk'); localStorage.removeItem('mock_delete'); });
  }

  // v3.48.0: the page started again lighter, after Android stopped its
  // process three times in a few minutes (MainActivity.restartPage)
  step = 'started lighter';
  console.log('\n' + step);
  // v3.50.0: lyrics kept in the page's storage by an older version, moved to the app's own on this start
  await ev(() => {
    localStorage.setItem('bm_ly_pins', JSON.stringify({ 'f:/old/song.mp3': { at: 1, found: { source: 'file', synced: '[00:01.00]an old choice' } } }));
    localStorage.setItem('bm_ly_0123456789abcdef', JSON.stringify({ at: 1, found: { source: 'lrclib', synced: '[00:01.00]an old answer' } }));
    localStorage.setItem('bm_ly_NOT A NAME', '{}');
  });
  await page.goto(URL0 + '?light=1');
  await until(() => window.__bmStarted === true, null, 20000);
  ok(await until(() => !Object.keys(localStorage).some(k => k.startsWith('bm_ly_'))
    && JSON.parse(localStorage.getItem('mock_lyr_0123456789abcdef') || 'null')?.found?.synced === '[00:01.00]an old answer'
    && !!JSON.parse(localStorage.getItem('mock_lyr_pins') || '{}')['f:/old/song.mp3'], null, 10000),
    'lyrics an older version kept in the page\'s storage are moved to the app\'s, the choices with them');
  ok(await until(() => document.getElementById('toast').classList.contains('on') && /runs lighter/.test(document.getElementById('toast').textContent), null, 6000), 'it says why it runs lighter');
  await page.tap('#nav button[data-tab="settings"]');
  ok(await until(() => document.querySelector('#st-quality button.on')?.dataset.v === 'low'), 'and runs on Low, for this run only');
  ok(await ev(() => localStorage.getItem('bm_perf_quality_user') !== 'low'), 'with nothing kept for the next start');
  await page.goto(URL0);
  await until(() => window.__bmStarted === true, null, 20000);

  step = 'a long library';
  console.log('\n' + step);
  const big = await startMock({ media: ffmpeg ? media : null, big: 20000 });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${big.port}/index.html`);
  await until(() => window.__bmStarted === true, null, 20000);
  await page.tap('#nav button[data-tab="music"]');
  ok(await until(() => [...document.querySelectorAll('#mu-list .vrow')].filter(r => r.style.display !== 'none').length > 5, null, 20000), 'twenty thousand songs are listed');
  const took = Date.now() - t0;
  ok(took < 8000, `quickly enough (${took} ms here; a phone is slower)`);
  const rows = await ev(async () => { const sc = document.getElementById('mu-list'); for (let y = 0; y < 300000; y += 30000) { sc.scrollTop = y; await new Promise(r => requestAnimationFrame(r)); } return sc.querySelectorAll('.vrow').length; });
  ok(rows < 60, `only the rows on screen exist (${rows})`);
  await big.close();
} catch (e) {
  fails.push(`${step}: ${e.message}`);
  console.log('  FAIL ' + e.message);
}

ok(!errors.length, 'no errors in the page' + (errors.length ? ':\n    ' + errors.slice(0, 8).join('\n    ') : ''));
await browser.close();
await mock.close();
fs.rmSync(media, { recursive: true, force: true });
if (notes.length) console.log(`\n${notes.length} note(s):\n  ` + notes.join('\n  '));
if (fails.length) { console.log(`\nandroid-page: ${fails.length} failed:\n  ` + fails.join('\n  ')); process.exit(1); }
console.log('\nandroid-page: all passed');
