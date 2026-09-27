#!/usr/bin/env node
'use strict';
/**
 * BM Player — Electron API audit
 *
 * Checks every Electron API this app calls against the typings shipped with
 * the Electron version in package.json. Upgrading across several majors
 * removes APIs, and the failure is a TypeError at runtime on whichever code
 * path happens to touch the missing method — often not the one you opened
 * the app to test.
 *
 * This reads electron.d.ts out of node_modules rather than relying on
 * anyone's memory of the release notes.
 *
 * Run with: npm run lint:electron
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DTS  = path.join(ROOT, 'node_modules', 'electron', 'electron.d.ts');

if (!fs.existsSync(DTS)) {
  console.log('\n  electron.d.ts not found — run `npm install` first. Skipping.\n');
  process.exit(0);
}

const dts = fs.readFileSync(DTS, 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const declared = (pkg.devDependencies && pkg.devDependencies.electron) || '?';

/* Modules destructured from require('electron'), and the members used on
 * each. Built by scanning main.js and preload.js rather than hardcoding. */
const sources = ['main.js', 'preload.js']
  .map(f => ({ f, t: fs.readFileSync(path.join(ROOT, f), 'utf8') }));

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const modules = new Set();
for (const { t } of sources) {
  for (const m of t.matchAll(/const\s*\{([^}]+)\}\s*=\s*require\(['"]electron['"]\)/g)) {
    m[1].split(',').forEach(n => { const x = n.trim(); if (x) modules.add(x); });
  }
}

/* Electron's typings name the interface after the module, capitalised:
 * app -> App, ipcMain -> IpcMain, BrowserWindow -> BrowserWindow. */
const IFACE = {
  app: 'App', ipcMain: 'IpcMain', ipcRenderer: 'IpcRenderer', dialog: 'Dialog',
  shell: 'Shell', screen: 'Screen', nativeImage: 'NativeImage', Menu: 'Menu',
  BrowserWindow: 'BrowserWindow', webContents: 'WebContents', session: 'Session',
  contextBridge: 'ContextBridge', protocol: 'Protocol', nativeTheme: 'NativeTheme',
  globalShortcut: 'GlobalShortcut', powerSaveBlocker: 'PowerSaveBlocker',
  clipboard: 'Clipboard', Tray: 'Tray', Notification: 'Notification',
};

/* Pull the body of an interface/class declaration out of the .d.ts. */
function ifaceBody(name) {
  const re = new RegExp(`\\n\\s*(?:interface|class)\\s+${name}\\b[^{]*\\{`, 'g');
  const m = re.exec(dts);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  while (i < dts.length && depth > 0) {
    const c = dts[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return dts.slice(m.index, i);
}

const bodies = new Map();
const memberCache = new Map();
function membersOf(iface) {
  if (memberCache.has(iface)) return memberCache.get(iface);
  const body = bodies.get(iface) ?? ifaceBody(iface);
  bodies.set(iface, body);
  const set = new Set();
  if (body) {
    // Members may carry modifiers: `static`, `readonly`, `protected`.
    for (const m of body.matchAll(/^\s*(?:(?:static|readonly|protected|public|declare)\s+)*([A-Za-z_$][\w$]*)\s*[(:?]/gm)) set.add(m[1]);
    // `on(event: 'x', ...)` style event names
    for (const m of body.matchAll(/\bon\(event:\s*'([^']+)'/g)) set.add('on:' + m[1]);
    for (const m of body.matchAll(/\bonce\(event:\s*'([^']+)'/g)) set.add('on:' + m[1]);
  }
  memberCache.set(iface, set);
  return set;
}

const problems = [];
const checked = [];

for (const { f, t } of sources) {
  const src = strip(t);
  for (const mod of modules) {
    const iface = IFACE[mod];
    if (!iface) continue;
    const members = membersOf(iface);
    if (!members.size) { problems.push(`${f}: electron.d.ts has no interface for '${mod}' (${iface})`); continue; }

    // mod.member( and mod.member =
    const used = new Set();
    for (const m of src.matchAll(new RegExp(`\\b${mod}\\.([A-Za-z_$][\\w$]*)`, 'g'))) used.add(m[1]);
    for (const name of used) {
      checked.push(`${mod}.${name}`);
      if (!members.has(name)) problems.push(`${f}: ${mod}.${name}() is not in Electron ${declared} typings`);
    }
  }

  /* BrowserWindow instance methods — matched on the known window variables
   * so we don't try to type-check every object in the file. */
  const winMembers = membersOf('BrowserWindow');
  for (const v of ['win', 'bgWin']) {
    for (const m of src.matchAll(new RegExp(`\\b${v}\\??\\.([A-Za-z_$][\\w$]*)\\s*\\(`, 'g'))) {
      const name = m[1];
      if (['then','catch','forEach','map','filter'].includes(name)) continue;
      checked.push(`BrowserWindow#${name}`);
      if (!winMembers.has(name)) problems.push(`${f}: BrowserWindow#${name}() is not in Electron ${declared} typings`);
    }
  }

  /* webPreferences keys — silently ignored when removed, which is worse
   * than a crash: the window is built with different security settings
   * than the code claims. */
  const wpMembers = membersOf('WebPreferences');
  const wpKeys = new Set();
  for (const m of src.matchAll(/webPreferences\s*:\s*\{/g)) {
    let i = m.index + m[0].length, depth = 1, start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    const block = src.slice(start, i - 1);
    // Only top-level keys: a nested object's keys belong to that object.
    let d = 0;
    for (const line of block.split('\n')) {
      if (d === 0) {
        const k = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
        if (k) wpKeys.add(k[1]);
      }
      d += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    }
  }
  if (wpKeys.size && wpMembers.size) {
    for (const m of [...wpKeys].map(k => [null, k])) {
      checked.push(`webPreferences.${m[1]}`);
      if (!wpMembers.has(m[1])) problems.push(`${f}: webPreferences.${m[1]} is not in Electron ${declared} typings`);
    }
  }
}

console.log(`\nElectron API audit — target ${declared}`);
console.log(`  ${new Set(checked).size} distinct API references checked\n`);

if (problems.length) {
  for (const p of problems) console.log('  \x1b[31m✗\x1b[0m ' + p);
  console.log(`\n${problems.length} problem(s).\n`);
  process.exit(1);
}
console.log('  \x1b[32m✓\x1b[0m every Electron API this app calls exists in the target version\n');
