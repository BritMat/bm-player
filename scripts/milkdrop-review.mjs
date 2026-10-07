/**
 * milkdrop-review: every MilkDrop preset on the same music, drawn and measured (v3.36.0).
 *
 * butterchurn's four packs hold 395 presets, and the app carries a chosen set
 * of them (scripts/milkdrop-presets.json). This is how they were chosen, kept
 * so it can be done again. It runs the real app with the page's clock and
 * sound replaced (scripts/viz-preview.mjs), plays each preset through the same
 * 24 seconds of music frame by frame, and writes:
 *
 *   NNN-a.png, NNN-b.png   the picture 8 and 18 seconds in
 *   review.json            for each preset, over those 24 seconds: how bright
 *                          the picture is on average and at its brightest, how
 *                          much of it is white at its whitest, how often it is
 *                          nearly empty, the biggest jump in brightness within
 *                          a third of a second, and the time a frame took
 *
 * One picture cannot show a preset that flashes white on every beat, or one
 * that is black half the time. The numbers do, and `verdict` says so in words.
 * A preset passes when its verdict is empty. That is a first sieve: the ones
 * that pass still want looking at.
 *
 *   xvfb-run -a node scripts/milkdrop-review.mjs --out=/tmp/md-review
 *
 * reviews the app's own set. To review all 395, build them first:
 *
 *   node scripts/build-milkdrop.mjs /tmp/md/node_modules --all
 *   xvfb-run -a node scripts/milkdrop-review.mjs --all --out=/tmp/md-review
 *
 * and delete src/vendor/milkdrop/all-presets.js afterwards. --from and --to
 * take a part of the list (a run that was cut short picks up with --from, and
 * review.json keeps what was done). Without a graphics card a preset takes
 * about 20 seconds.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { synthTrack, writeWav, installOnPage } from './viz-preview.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => { const a = process.argv.find(x => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : def; };
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'bm-milkdrop-review'))), FROM = +arg('from', 0), TO = +arg('to', 1e9), ALL = process.argv.includes('--all');

/** What is wrong with a preset, from its numbers: an empty list is a pass. */
export function verdict(r) {
  const why = [];
  if (r.whiteMax > 0.3) why.push(`flashes white (${Math.round(r.whiteMax * 100)}% of the picture)`);
  if (r.whiteMean > 0.09) why.push('white much of the time');
  if (r.lumMax > 0.7 && (r.bright > 0.2 || r.jump > 0.4 || r.whiteMax > 0.2)) why.push(`glare (brightness up to ${r.lumMax})`);
  if (r.bright > 0.6) why.push('bright most of the time');
  if (r.empty > 0.5) why.push('nearly empty most of the time');
  return why;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.DISPLAY && process.platform === 'linux') { console.log('milkdrop-review needs a display: run it under xvfb-run'); process.exit(1); }
  if (ALL && !fs.existsSync(path.join(ROOT, 'src/vendor/milkdrop/all-presets.js'))) { console.log('no src/vendor/milkdrop/all-presets.js: build it with scripts/build-milkdrop.mjs <node_modules> --all'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const track = path.join(OUT, 'track.wav'); { const t = synthTrack(24); writeWav(track, t.samples, t.rate); }
  const file = path.join(OUT, 'review.json');
  let rows = []; try { rows = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  const { _electron } = await import('playwright-core');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-md-review-'));
  const app = await _electron.launch({ executablePath: require(path.join(ROOT, 'node_modules/electron')), args: [ROOT, '--no-sandbox', '--mpv-ao=null', `--user-data-dir=${prof}`], cwd: ROOT, timeout: 90000 });
  const done = async code => { await app.close().catch(() => {}); fs.rmSync(prof, { recursive: true, force: true }); process.exit(code); };
  try {
    let page; for (let i = 0; i < 200 && !page; i++) { page = app.windows().find(w => w.url().includes('index.html')); if (!page) await new Promise(r => setTimeout(r, 250)); }
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.waitForFunction(() => window.bmApp, null, { timeout: 60000 });
    await page.evaluate(() => { localStorage.setItem('bm_lite_user', '0'); localStorage.setItem('bm_viz', JSON.stringify({ style: 'bars', mdAuto: 0 })); });
    await page.reload(); await page.waitForFunction(() => window.bmApp && window.bmMusic, null, { timeout: 60000 });
    await page.addStyleTag({ content: '#default-player-prompt, .toast-stack, .viz-overlay, #controls-bar { display: none !important; }' });
    await page.evaluate(t => { bmApp.switchDest('music'); bmMusic.play(t, 0); }, track);
    await page.waitForFunction(() => bmApp.isPlaying, null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { bmApp.switchDest('video'); if (bmMusic.engine?.el) { bmMusic.engine.el.loop = true; bmMusic.engine.el.muted = true; } });
    await page.waitForFunction(() => bmApp.viz && bmApp.viz.canvas.offsetWidth > 0, null, { timeout: 30000 });
    const wavUrl = await page.evaluate(async t => (await import('./js/util.js')).fileURL(t), track);
    await page.evaluate(installOnPage, { wavUrl, quietAt: 0, hz: 30 });
    await page.evaluate(() => { const v = bmApp.viz; v.setOptions({ style: 'milkdrop', mdAuto: 0 }); v._lastDraw = -1e9; v.setMode('milkdrop'); });
    for (let i = 0; i < 80; i++) { await page.evaluate(() => window.__viz.step(2)); if (await page.evaluate(() => !!bmApp.viz._md)) break; await page.waitForTimeout(150); }
    // One size for every preset and every machine, so the times can be compared.
    await page.evaluate(async all => {
      const v = bmApp.viz; v._mdSize = () => [480, 270];
      if (all) { const m = await import('./vendor/milkdrop/all-presets.js'); v._mdPresets = m.PRESETS; v._mdNames = Object.keys(m.PRESETS); }
    }, ALL);
    const names = await page.evaluate(() => bmApp.viz._mdNames);
    console.log(`${names.length} presets${ALL ? ' (all of the packs)' : ' (the app\'s set)'}, pictures and review.json in ${OUT}`);
    const box = () => page.evaluate(() => { const r = bmApp.viz._mdCanvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    // A part of the track: frames drawn, a look at the picture every third of a second.
    const play = (frames) => page.evaluate(async frames => {
      const v = bmApp.viz, S = window.__look || (window.__look = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 36; return { c, x: c.getContext('2d', { willReadFrequently: true }) }; })());
      const out = [];
      for (let f = 0; f < frames; f += 10) {
        await window.__viz.step(Math.min(10, frames - f));
        v._drawMilk(); S.x.drawImage(v._mdCanvas, 0, 0, 64, 36);         // drawn now, read now: the WebGL picture is still there
        const d = S.x.getImageData(0, 0, 64, 36).data, n = d.length / 4; let lum = 0, white = 0, lit = 0;
        for (let k = 0; k < d.length; k += 4) { const r = d[k], g = d[k + 1], b = d[k + 2]; lum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; if (Math.min(r, g, b) > 215) white++; if (Math.max(r, g, b) > 40) lit++; }
        out.push([lum / n, white / n, lit / n]);
      }
      return out;
    }, frames);
    for (let i = FROM; i < Math.min(TO, names.length); i++) {
      const id = String(i).padStart(3, '0'), t0 = Date.now();
      const err = await page.evaluate(name => {
        const v = bmApp.viz, S = window.__viz.state;
        S.t0 = S.v;                                                        // every preset hears the track from its start
        try { v._mdName = name; v._md.loadPreset(v._mdPresets[name](), 0); v._mdAt = performance.now(); return ''; } catch (e) { return String(e.message || e).slice(0, 120); }
      }, names[i]);
      const looks = [];
      looks.push(...await play(240)); await page.screenshot({ path: path.join(OUT, id + '-a.png'), clip: await box() });     // 8 s in
      looks.push(...await play(300)); await page.screenshot({ path: path.join(OUT, id + '-b.png'), clip: await box() });     // 18 s in
      looks.push(...await play(180));
      const lum = looks.map(l => l[0]), white = looks.map(l => l[1]), lit = looks.map(l => l[2]);
      const mean = a => a.reduce((p, q) => p + q, 0) / a.length, r3 = n => +n.toFixed(3);
      let jump = 0; for (let k = 1; k < lum.length; k++) jump = Math.max(jump, Math.abs(lum[k] - lum[k - 1]));
      const row = { i, name: names[i], err, lumMean: r3(mean(lum)), lumMax: r3(Math.max(...lum)), whiteMax: r3(Math.max(...white)), whiteMean: r3(mean(white)),
        bright: r3(lum.filter(v => v > 0.5).length / lum.length), empty: r3(lit.filter(v => v < 0.02).length / lit.length), jump: r3(jump), frameMs: r3((Date.now() - t0) / 720) };
      row.verdict = verdict(row);
      rows = rows.filter(r => r.name !== row.name); rows.push(row);
      fs.writeFileSync(file, JSON.stringify(rows, null, 1));
      console.log(`${id} ${row.verdict.length || row.err ? 'NO ' : 'ok '} ${names[i].slice(0, 60).padEnd(60)} ${row.frameMs.toFixed(0).padStart(4)} ms a frame  ${row.err || row.verdict.join(', ')}`);
    }
    // heavy: several times the usual frame time, measured the same way on this machine
    const times = rows.map(r => r.frameMs).sort((a, b) => a - b), usual = times[Math.floor(times.length / 2)] || 0;
    for (const r of rows) { r.verdict = verdict(r); if (usual && r.frameMs > usual * 4) r.verdict.push(`heavy (${(r.frameMs / usual).toFixed(1)} times the usual frame)`); }
    fs.writeFileSync(file, JSON.stringify(rows, null, 1));
    console.log(`\n${rows.filter(r => !r.verdict.length && !r.err).length} of ${rows.length} pass. The usual frame took ${usual.toFixed(0)} ms here.`);
    await done(0);
  } catch (e) { console.log('milkdrop-review failed:', e.message); await done(1); }
}
