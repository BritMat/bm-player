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
 */
import { _electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
const single = fs.existsSync(target) && fs.statSync(target).isFile();   // an AppImage, say
const dist = single ? path.dirname(target) : target;
const fail = msg => { console.error('\u2717 ' + msg); process.exit(1); };
setTimeout(() => fail('the packaged app did not boot within 60 seconds'), 60000).unref();

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
let exe = single ? target : null;
if (!exe) {
  const unpacked = fs.existsSync(dist) && fs.readdirSync(dist).map(d => path.join(dist, d)).find(d => /-unpacked$/.test(d) && fs.statSync(d).isDirectory());
  if (!unpacked) fail('no *-unpacked build in ' + dist + ' (run: npx electron-builder --dir)');
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
  const r = await page.evaluate(async () => ({ version: await window.api?.app?.version?.(), fox: !!window.bmApp.fox }));
  const packaged = await app.evaluate(({ app }) => app.isPackaged);
  if (!packaged) fail('this is not the packaged app');
  if (errors.length) fail('errors while starting: ' + errors.join(' | '));
  console.log(`\u2713 the packaged app (${path.basename(exe)}) boots: version ${r.version}, fox ${r.fox ? 'drawn' : 'missing'}`);
} catch (e) {
  fail('the packaged app did not boot: ' + String(e.message || e).split('\n')[0] + (errors.length ? ' | ' + errors[0] : ''));
} finally {
  await app?.close().catch(() => {});
  fs.rmSync(profile, { recursive: true, force: true });
}
process.exit(0);
