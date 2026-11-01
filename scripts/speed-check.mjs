#!/usr/bin/env node
/**
 * BM Player: speed check (v3.47.0)
 *
 * Asked for with the groundwork release: the code split into smaller files
 * must not make the app slower or heavier. So the same measurements are
 * taken of this version and of the one before it, on the same machine, one
 * run of each in turn, and this version may not come out worse.
 *
 * Each run starts the real app with a new, empty profile and measures:
 *
 *   start      seconds from launching Electron to the app being ready
 *   page       milliseconds from the page starting to the app being ready
 *   heap       the page's JavaScript memory, MB, once it has settled
 *   memory     every process of the app together, MB
 *   home CPU   all of the app's processes on the home screen, over 6 s
 *   home fps   frames a second the home screen draws
 *   viz fps    frames a second the visualiser draws, with music playing
 *   viz CPU    the app's processes while it does
 *   tabs       how long each tab takes to show the first time
 *
 *   node scripts/speed-check.mjs                     this version alone
 *   node scripts/speed-check.mjs --ref=<folder>      against another version
 *   --runs=3        runs of each (the middle value is compared)
 *   --modes=chosen  the visuals the app picks by itself; "full" also runs
 *                   with the full visuals forced, for a machine that would
 *                   pick Lite (no graphics card, two cores)
 *   --out=<folder>  speed.json and speed.txt there
 *
 * The reference needs no installed packages of its own. On Windows the
 * check .bat gives it the clone of the last published version that
 * publishing keeps next to the batch file, which has none: it runs from a
 * copy of that folder in the temp folder, with a link to this version's
 * packages, on this version's Electron. (Electron leaves NODE_PATH out, so
 * pointing it at the packages, as the first version of this did, could not
 * work. The clone itself is never touched: publishing commits from it.)
 *
 * Each version is started once before the measuring, unmeasured, so a disk
 * that has not read the files yet does not weigh on the first run.
 *
 * Exit 1 when this version is worse than the reference by more than the
 * margins below, which are wider than the run-to-run noise measured on a
 * two-core server and on a laptop, or when the reference could not be
 * measured at all: that is not a pass. With no reference it only reports.
 * result.txt (with --out) has the outcome in one plain line, for the .bat.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const REF = arg('ref', '') ? path.resolve(arg('ref', '')) : '';
const RUNS = Math.max(1, +arg('runs', '3') || 3);
const MODES = arg('modes', 'chosen').split(',').filter(m => m === 'chosen' || m === 'full');
const OUT = arg('out', '');
const IS_WIN = process.platform === 'win32', IS_LINUX = process.platform === 'linux';
const asRoot = IS_LINUX && process.getuid?.() === 0;

const lines = [];
const say = s => { lines.push(s); console.log(s); };
// The outcome in one plain line (result.txt), for the check .bat's summary.
const result = line => { if (!OUT) return; try { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'result.txt'), line + '\n'); } catch (_) {} };
const skip = why => { say(`speed check skipped: ${why}`); finish(null); result(`skipped: ${why}`); process.exit(process.env.BM_STRICT ? 3 : 0); };

if (IS_LINUX && !process.env.DISPLAY) skip('no DISPLAY (run under xvfb-run)');
let electronPath;
try { electronPath = require(path.join(ROOT, 'node_modules/electron')); if (!fs.existsSync(electronPath)) throw 0; } catch { skip('Electron is not installed'); }
let _electron;
try { ({ _electron } = await import('playwright-core')); } catch { skip('playwright-core is not installed'); }
const version = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version; } catch { return null; } };
const THIS = version(ROOT);
let REFV = REF ? version(REF) : null;
if (REF && (!REFV || !fs.existsSync(path.join(REF, 'main.js')) || !fs.existsSync(path.join(REF, 'src', 'index.html')))) {
  say(`the reference ${REF} is not a BM Player folder: measuring this version alone`);
  REFV = null;
}
if (REFV && REFV === THIS) say(`note: the reference is the same version (${THIS})`);

// The reference with this version's packages: a copy, with a link to them
// (a junction on Windows, which needs no administrator). Only when it has
// none of its own, as the clone publishing keeps has not.
let RUNREF = REF;
if (REFV && !fs.existsSync(path.join(REF, 'node_modules'))) {
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-speed-ref-')), copy = path.join(dir, 'ref');
    fs.cpSync(REF, copy, { recursive: true, filter: src => !/^(\.git|node_modules|dist|dist-lite)([\\/]|$)/.test(path.relative(REF, src)) });
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(copy, 'node_modules'), IS_WIN ? 'junction' : 'dir');
    process.on('exit', () => { try { fs.unlinkSync(path.join(copy, 'node_modules')); } catch {} try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
    RUNREF = copy;
    say(`${REFV} runs from a copy of ${REF}, with this version's packages`);
  } catch (e) { say(`${REFV} could not be prepared to run: ${String(e.message || e).split('\n')[0]}`); RUNREF = REF; }
}

const hard = setTimeout(() => { say('DEADLINE: the speed check ran too long'); finish(null); result('DEADLINE: the speed check ran too long'); process.exit(1); }, 20 * 60000);

// The music for the visualiser, made here (as the field check does).
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-speed-'));
process.on('exit', () => { try { fs.rmSync(FIX, { recursive: true, force: true }); } catch {} });
const { synthTrack, writeWav } = await import('./viz-preview.mjs');
const TRACK = path.join(FIX, 'speed-music.wav');
{ const t = synthTrack(30); writeWav(TRACK, t.samples, t.rate); }

const killMpv = () => { try { execFileSync(IS_WIN ? 'taskkill' : 'pkill', IS_WIN ? ['/F', '/IM', 'mpv.exe'] : ['-9', '-x', 'mpv'], { stdio: 'ignore', windowsHide: true }); } catch {} };
const pause = ms => new Promise(r => setTimeout(r, ms));

async function launch (dir, profile) {
  const env = { ...process.env };
  const args = [dir, '--mpv-ao=null', `--user-data-dir=${profile}`, ...(asRoot ? ['--no-sandbox'] : [])];
  const t0 = Date.now();
  const app = await _electron.launch({ executablePath: electronPath, args, cwd: dir, env, timeout: 90000, chromiumSandbox: !asRoot });
  let page;
  for (let i = 0; i < 600 && !page; i++) { page = app.windows().find(w => w.url().includes('index.html')); if (!page) await pause(50); }
  if (!page) { await app.close().catch(() => {}); throw new Error('the main window never appeared'); }
  await page.waitForFunction(() => window.bmApp && window.bmMusic, null, { timeout: 60000, polling: 20 });
  return { app, page, ready: (Date.now() - t0) / 1000 };
}

// A profile that starts with the full visuals: one start to set the
// Preferences override, then the measured start uses that profile.
async function fullProfile (dir) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-speed-profile-'));
  const { app, page } = await launch(dir, profile);
  await page.evaluate(() => { localStorage.setItem('bm_lite_user', '0'); });
  await pause(500);
  await app.close().catch(() => {});
  killMpv();
  return profile;
}

const frames = (page, ms) => page.evaluate(ms => new Promise(res => {
  let n = 0; const t = performance.now();
  const f = () => { n++; if (performance.now() - t < ms) requestAnimationFrame(f); else res(n / ((performance.now() - t) / 1000)); };
  requestAnimationFrame(f);
}), ms);
const sumCpu = m => m.reduce((s, p) => s + (p.cpu?.percentCPUUsage || 0), 0);
const sumMem = m => m.reduce((s, p) => s + (p.memory?.workingSetSize || 0), 0) / 1024;

async function measure (dir, mode) {
  const profile = mode === 'full' ? await fullProfile(dir) : fs.mkdtempSync(path.join(os.tmpdir(), 'bm-speed-profile-'));
  const errors = [];
  let app;
  try {
    const l = await launch(dir, profile);
    app = l.app; const page = l.page;
    page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 160)));
    // When the page had made the player: the end of DOMContentLoaded, where
    // both bmApp and bmMusic are made, as the page itself recorded it. Asking
    // performance.now() once the harness had seen them added the harness's
    // polling, and the main thread's own delays in reaching it, which in full
    // visuals on two cores were as large as the differences looked for.
    const pageMs = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || performance.now());
    await page.addStyleTag({ content: '#default-player-prompt, .toast-stack { display: none !important; }' }).catch(() => {});
    await pause(3000);
    const lite = await page.evaluate(() => document.documentElement.classList.contains('lite-mode'));
    // The page's own heap, exactly: performance.memory is rounded to coarse
    // steps unless Chromium is started with precise memory info.
    let heap = null;
    try {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      await cdp.send('Performance.enable');
      const { metrics } = await cdp.send('Performance.getMetrics');
      const h = metrics.find(x => x.name === 'JSHeapUsedSize');
      if (h) heap = h.value / 1048576;
      await cdp.detach().catch(() => {});
    } catch (_) {}
    if (heap == null) heap = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null);
    await app.evaluate(({ app: a }) => a.getAppMetrics());
    const t0 = Date.now();
    const homeFps = await frames(page, 3000);
    await pause(Math.max(0, 6000 - (Date.now() - t0)));
    const m = await app.evaluate(({ app: a }) => a.getAppMetrics());
    const r = { lite, ready: l.ready, page: pageMs, heap, memory: sumMem(m), homeCpu: sumCpu(m), homeFps, vizFps: null, vizCpu: null, tabs: {} };
    // The visualiser, where the app has one (not in Lite).
    if (!lite) {
      const ok = await page.evaluate(async t => {
        const quiet = () => { try { bmMusic.engine?.setMuted?.(true); } catch (_) {} };
        bmApp.switchDest('music'); quiet(); bmMusic.play(t, 0); quiet();
        for (let i = 0; i < 60 && !bmApp.isPlaying; i++) await new Promise(z => setTimeout(z, 250));
        quiet(); if (bmMusic.engine?.el) bmMusic.engine.el.loop = true;
        bmApp.switchDest('video'); await new Promise(z => setTimeout(z, 1500));
        return !!bmApp.viz && bmApp.isPlaying;
      }, TRACK);
      if (ok) {
        await app.evaluate(({ app: a }) => a.getAppMetrics());
        const t1 = Date.now();
        r.vizFps = await page.evaluate(async () => { const v = bmApp.viz, k0 = v._tick, t = performance.now(); await new Promise(z => setTimeout(z, 3000)); return (v._tick - k0) / ((performance.now() - t) / 1000); });
        await pause(Math.max(0, 4000 - (Date.now() - t1)));
        r.vizCpu = sumCpu(await app.evaluate(({ app: a }) => a.getAppMetrics()));
      }
      await page.evaluate(() => { try { bmApp.stop(); } catch (_) {} });
      await pause(800);
    }
    // Each tab the first time it is opened: the parts loaded on first use
    // must still open quickly.
    for (const dest of ['pdf', 'images', 'tv', 'music']) {
      // Until the tab is there to use: with a part loaded on first use
      // (v3.47.0, app.part), until that part is made, then drawn.
      r.tabs[dest] = await page.evaluate(async d => {
        const t = performance.now();
        await bmApp.switchDest(d);
        if (d !== 'music' && typeof bmApp.part === 'function') await bmApp.part(d);
        await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z)));
        return performance.now() - t;
      }, dest);
    }
    r.errors = errors;
    return r;
  } finally {
    if (app) await app.close().catch(() => {});
    killMpv();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

const med = a => { const s = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
// What may count as worse: a share of the reference plus a floor, because
// small numbers jump about more than big ones.
const RULES = [
  { k: 'ready', label: 'start', unit: ' s', d: 1, worse: (a, b) => a > b * 1.15 + 0.15 },
  { k: 'page', label: 'page ready', unit: ' ms', d: 0, worse: (a, b) => a > b * 1.15 + 80 },
  { k: 'heap', label: 'page memory', unit: ' MB', d: 1, worse: (a, b) => a > b * 1.10 + 3 },
  { k: 'memory', label: 'all memory', unit: ' MB', d: 0, worse: (a, b) => a > b * 1.08 + 20 },
  { k: 'homeCpu', label: 'home CPU', unit: '%', d: 1, worse: (a, b) => a > b * 1.25 + 2 },
  { k: 'homeFps', label: 'home', unit: ' fps', d: 0, worse: (a, b) => a < b * 0.9 - 2 },
  { k: 'vizFps', label: 'visualiser', unit: ' fps', d: 0, worse: (a, b) => a < b * 0.9 - 2 },
  { k: 'vizCpu', label: 'visualiser CPU', unit: '%', d: 1, worse: (a, b) => a > b * 1.25 + 3 },
];
const fmt = (v, r) => v == null ? '-' : v.toFixed(r.d) + r.unit;

const report = { version: THIS, reference: REFV, runs: RUNS, platform: `${process.platform} ${os.release()}`, cpus: os.cpus().length, modes: {} };
let worse = 0, notMeasured = false;
say(`BM Player speed check: ${THIS}${REFV ? ` against ${REFV}` : ''}, ${RUNS} run${RUNS === 1 ? '' : 's'} of each, ${os.cpus().length} cores, ${process.platform}`);
// One start of each, not measured: the files read once, as they are for anyone using the app.
for (const [who, dir] of REFV ? [[THIS, ROOT], [REFV, RUNREF]] : [[THIS, ROOT]]) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-speed-profile-'));
  try { const l = await launch(dir, profile); await pause(1500); await l.app.close().catch(() => {}); }
  catch (e) { say(`   warm-up start of ${who}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); }
  killMpv();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
let choseFull = false;
for (const mode of MODES) {
  if (mode === 'full' && choseFull) { say(''); say('== full visuals: the app chose them by itself, so they were measured above =='); continue; }
  const runs = { new: [], ref: [] };
  for (let i = 0; i < RUNS; i++) {
    // One of each in turn, the order swapped every round, so a machine
    // warming up or slowing down weighs on both alike.
    const order = REFV ? (i % 2 ? ['ref', 'new'] : ['new', 'ref']) : ['new'];
    for (const who of order) {
      try { runs[who].push(await measure(who === 'new' ? ROOT : RUNREF, mode)); }
      catch (e) { say(`   ${who === 'new' ? THIS : REFV}, run ${i + 1}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); }
    }
  }
  const pick = (list, k) => med(list.map(r => r[k]));
  const tab = (list, d) => med(list.map(r => r.tabs?.[d]));
  const n = runs.new, f = runs.ref;
  if (!n.length) { say(`${mode}: no run of this version finished`); worse++; continue; }
  // An earlier version that never ran is not a pass: nothing was compared.
  if (REFV && !f.length) { say(`${mode}: no run of ${REFV} finished, so nothing could be compared`); notMeasured = true; worse++; }
  const lite = n[0].lite;
  if (mode === 'chosen' && !lite) choseFull = true;
  say('');
  say(`== ${mode === 'full' ? 'full visuals, forced' : 'the visuals the app picked'}: ${lite ? 'Lite' : 'full'} ==`);
  const rows = [];
  for (const rule of RULES) {
    const a = pick(n, rule.k), b = f.length ? pick(f, rule.k) : null;
    if (a == null && b == null) continue;
    const bad = a != null && b != null && rule.worse(a, b);
    if (bad) worse++;
    rows.push({ k: rule.k, new: a, ref: b, worse: bad });
    say(`   ${rule.label.padEnd(15)} ${fmt(a, rule).padStart(9)}${b != null ? `   ${REFV}: ${fmt(b, rule).padStart(9)}` : ''}${bad ? '   WORSE' : ''}`);
  }
  const tabsNew = {}, tabsRef = {};
  for (const d of ['pdf', 'images', 'tv', 'music']) { tabsNew[d] = tab(n, d); tabsRef[d] = f.length ? tab(f, d) : null; }
  say(`   tabs, first open: ${Object.entries(tabsNew).map(([d, v]) => `${d} ${v == null ? '-' : Math.round(v) + ' ms'}${tabsRef[d] != null ? ` (${Math.round(tabsRef[d])})` : ''}`).join(', ')}`);
  const slow = Object.entries(tabsNew).filter(([, v]) => v != null && v > 600);
  if (slow.length) { say(`   SLOW TAB: ${slow.map(([d, v]) => `${d} took ${Math.round(v)} ms`).join(', ')}`); worse++; }
  const errs = n.flatMap(r => r.errors || []);
  if (errs.length) { say(`   page errors: ${errs[0]}`); worse++; }
  report.modes[mode] = { lite, rows, tabs: tabsNew, refTabs: tabsRef, runs };
}
say('');
const outcome = !REFV ? 'measured, with no earlier version here to compare against'
  : notMeasured ? `NOT COMPARED: ${REFV} could not be measured, see the speed log`
  : worse ? `SLOWER OR HEAVIER than ${REFV} in ${worse} place${worse === 1 ? '' : 's'}, marked WORSE in the speed log`
  : `no slower and no heavier than ${REFV}`;
say(REFV && !notMeasured ? '-> ' + outcome : outcome);
report.worse = worse; report.notMeasured = notMeasured; report.outcome = outcome;
finish(report);
result(outcome);
clearTimeout(hard);
process.exit(REFV && worse ? 1 : 0);

function finish (rep) {
  if (!OUT) return;
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'speed.txt'), lines.join('\n') + '\n');
    if (rep) fs.writeFileSync(path.join(OUT, 'speed.json'), JSON.stringify(rep, null, 1));
  } catch (_) {}
}
