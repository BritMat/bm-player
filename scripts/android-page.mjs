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
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36' });
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
  if (nose) { await page.touchscreen.tap(nose[0], nose[1]); ok(await until(() => ['boop', 'sneeze'].includes(window.__bmHome.fox._state.react?.name)), 'a tap on the nose: a boop (or a sneeze)'); }
  await sleep(1300);
  if (ear) { await page.touchscreen.tap(ear[0], ear[1]); ok(await until(() => window.__bmHome.fox._state.react?.name === 'ear'), 'a tap on an ear flicks it'); }
  await sleep(1300);
  if (chin) { for (let i = 0; i < 3; i++) { await page.touchscreen.tap(chin[0], chin[1]); await sleep(110); } ok(await until(() => window.__bmHome.fox._state.react?.name === 'laugh'), 'three quick taps: it laughs'); }
  ok(await until(() => document.querySelectorAll('#fox-fx .fp-spark').length > 0), 'with little stars or hearts');
  await sleep(1800);
  // a stroke across the head
  const head = await spot('head');
  if (head) {
    const c = await page.context().newCDPSession(page);
    const t = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await t('touchStart', head[0] - 40, head[1]);
    for (let i = 0; i <= 16; i++) { await t('touchMove', head[0] - 40 + i * 5, head[1] + (i % 2)); await sleep(30); }
    ok(await ev(() => window.__bmHome.fox._state.pet > 0.3), 'stroking it: it leans into the hand, eyes half shut');
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
    await sleep(300); await shot('09-video-mpv');
    ok(await ev(() => window.BMNative.back()) === 'handled' && await ev(() => window.__bmMpv.closed === true && !document.documentElement.classList.contains('mpv-on')), 'Back closes it: mpv stops and the page is solid again');

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
    await swipe(100, 450, 330, 450);
    ok(await until(() => window.__bmMpv.commands.some(cm => cm[0] === 'seek' && cm[2] === 'absolute+keyframes') && window.__bmMpv.commands.some(cm => cm[0] === 'seek' && cm[2] === 'absolute')), 'a sideways swipe moves through the video (quick seeks, then exact)');
    await ev(() => { window.__bmVol = 8; });
    await swipe(330, 600, 330, 350);
    ok(await until(() => window.__bmVol > 8), `up on the right: louder (${await ev(() => window.__bmVol)})`);
    await ev(() => { window.__bmBright = 0.5; });
    await swipe(80, 600, 80, 350);
    ok(await until(() => window.__bmBright > 0.5), 'up on the left: brighter');
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
    ok(await until(() => !!document.querySelector('#vd-list .vbar')), 'the list shows how far it was watched');
    await ev(() => localStorage.removeItem('mock_mpv'));
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

  step = 'opened from another app';
  console.log('\n' + step);
  await ev(() => window.BMNative.event('open', { url: '/media/audio/101', kind: 'audio', name: 'From a file manager.mp3', mime: 'audio/mpeg' }));
  ok(await until(() => window.__bmPlayback?.title === 'From a file manager' && document.getElementById('np').classList.contains('on')), 'an audio file plays, in Now Playing');
  await ev(() => window.BMNative.back());

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
