#!/usr/bin/env node
/**
 * smoke-packaged: start the app as electron-builder packaged it, and check it
 * boots. Every other test runs the app from the folder. A file left out of
 * the package list only breaks the packaged app: from v3.19 to v3.22
 * switches.js was missing from it, and main.js loads it at startup, so an
 * installer built then would have crashed on launch.
 *
 *   node scripts/smoke-packaged.mjs [dist folder]     (Linux: under xvfb-run)
 *   node scripts/smoke-packaged.mjs BM-Player-x.y.z-x86_64.AppImage   (a single-file build)
 *   node scripts/smoke-packaged.mjs "dist/mac-arm64/BM Player.app"    (a Mac app)
 */
import { _electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// --expect-lite: the build must know it is Lite (lite.flag in the package).
const EXPECT_LITE = process.argv.includes('--expect-lite');
const target = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(ROOT, 'dist'));
const single = fs.existsSync(target) && fs.statSync(target).isFile();   // an AppImage, say
const dist = single ? path.dirname(target) : target;
const fail = msg => { console.error('\u2717 ' + msg); process.exit(1); };
setTimeout(() => fail('the packaged app did not boot within 60 seconds'), 60000).unref();
// Playwright rejects an internal promise as well as the one awaited below when
// a launch fails, and Node would stop on it with a raw stack trace before the
// catch runs. Every failure ends in one plain line instead.
process.on('unhandledRejection', e => fail('the packaged app did not boot: ' + String(e?.message || e).split('\n')[0]));

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
let exe = single ? target : null;
// A Mac app is a folder: BM Player.app/Contents/MacOS/BM Player.
const macExe = app => path.join(app, 'Contents', 'MacOS', path.basename(app, '.app'));
if (!exe && /\.app$/.test(target) && fs.existsSync(macExe(target))) exe = macExe(target);
if (!exe && fs.existsSync(dist)) {
  // electron-builder puts Mac builds in mac (Intel), mac-arm64 or mac-universal.
  // Start the one this machine can run natively.
  const want = process.arch === 'arm64' ? ['mac-arm64', 'mac-universal', 'mac'] : ['mac', 'mac-universal'];
  for (const d of want) {
    const dir = path.join(dist, d);
    const app = fs.existsSync(dir) && fs.readdirSync(dir).find(f => f.endsWith('.app'));
    if (app && fs.existsSync(macExe(path.join(dir, app)))) { exe = macExe(path.join(dir, app)); break; }
  }
}
if (!exe) {
  const unpacked = fs.existsSync(dist) && fs.readdirSync(dist).map(d => path.join(dist, d)).find(d => /-unpacked$/.test(d) && fs.statSync(d).isDirectory());
  if (!unpacked) fail('no *-unpacked build or Mac app in ' + dist + ' (run: npx electron-builder --dir)');
  exe = [path.join(unpacked, pkg.name), path.join(unpacked, `${pkg.productName}.exe`), path.join(unpacked, `${pkg.name}.exe`)].find(p => fs.existsSync(p));
  if (!exe) fail('no executable in ' + unpacked);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-packaged-'));
const errors = [];
let app;
try {
  const env = /\.AppImage$/i.test(exe) ? { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' } : process.env;
  app = await _electron.launch({ executablePath: exe, args: ['--no-sandbox', `--user-data-dir=${profile}`], env, timeout: 45000 });
  app.process().stderr?.on('data', d => { const s = String(d); if (/Cannot find module|Uncaught|Error:/.test(s)) errors.push(s.trim().split('\n')[0]); });
  let page;
  for (let i = 0; i < 160 && !page; i++) { page = app.windows().find(w => w.url().includes('index.html')); if (!page) await new Promise(r => setTimeout(r, 250)); }
  if (!page) fail('no window opened: the main process failed to start' + (errors.length ? ': ' + errors[0] : ' (a file missing from the package?)'));
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.bmApp, null, { timeout: 30000 });
  const r = await page.evaluate(async () => ({ version: await window.api?.app?.version?.(), fox: !!window.bmApp.fox, liteWindow: document.documentElement.classList.contains('lite-window') }));
  const packaged = await app.evaluate(({ app }) => app.isPackaged);
  if (!packaged) fail('this is not the packaged app');
  if (EXPECT_LITE) {
    const liteMain = await app.evaluate(() => process.env.BM_LITE);
    if (liteMain !== '1' || !r.liteWindow) fail(`this should be the Lite build, but it runs as the full version (main process BM_LITE=${liteMain}, page Lite layout ${r.liteWindow})`);
  }
  if (errors.length) fail('errors while starting: ' + errors.join(' | '));
  console.log(`\u2713 the packaged app (${path.basename(exe)}) boots: version ${r.version}, fox ${r.fox ? 'drawn' : 'missing'}${EXPECT_LITE ? ', in Lite mode' : ''}`);
} catch (e) {
  fail('the packaged app did not boot: ' + String(e.message || e).split('\n')[0] + (errors.length ? ' | ' + errors[0] : ''));
} finally {
  await app?.close().catch(() => {});
  fs.rmSync(profile, { recursive: true, force: true });
}
process.exit(0);
