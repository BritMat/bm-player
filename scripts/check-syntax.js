#!/usr/bin/env node
'use strict';
/**
 * Cheap pre-flight parse of every JS file in the project.
 *
 * Chromium reports renderer parse errors as a line number in a file where a
 * single line can run to two thousand characters, which makes them very hard
 * to locate. Running this before `npm start` surfaces the same errors in the
 * terminal with a real message and a real position.
 *
 * Renderer files under src/js are parsed as ES modules; main, preload and
 * scripts as CommonJS.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', 'dist', 'out', 'vendor', 'buildResources']);

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    // .mjs and .cjs too. Only .js was collected, so every test script and
    // the field check (all .mjs or .cjs) had never been syntax-checked.
    else if (/\.(c|m)?js$/.test(e.name)) acc.push(full);
  }
  return acc;
}

const files = walk(ROOT, []);
let failed = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f);
  // Decide from the file, not from the Node running this. Node 22 detects
  // ES module syntax in a plain .js file by itself; Node 20.12 does not, so
  // on Windows with Node 20 the bundled plugin (which uses `export`) failed
  // here while passing everywhere else. .mjs and .cjs say what they are.
  const src = f.endsWith('.cjs') ? '' : fs.readFileSync(f, 'utf8');
  const isModule = !f.endsWith('.cjs') && !f.endsWith('.mjs') && (
    rel.startsWith(path.join('src', 'js')) ||
    rel.startsWith('plugins' + path.sep) ||
    /^\s*(import\s[\s\S]*?from\s|import\s*['"]|export\s)/m.test(src));
  try {
    if (isModule) {
      execFileSync(process.execPath, ['--input-type=module', '--check'], {
        input: fs.readFileSync(f), stdio: ['pipe', 'pipe', 'pipe']
      });
    } else {
      execFileSync(process.execPath, ['--check', f], { stdio: ['pipe', 'pipe', 'pipe'] });
    }
  } catch (e) {
    failed++;
    console.error('\n\u2717 ' + rel);
    console.error(String(e.stderr || e.message).trim().split('\n').slice(0, 6).join('\n'));
  }
}

if (failed) {
  console.error('\n' + failed + ' of ' + files.length + ' file(s) failed to parse.');
  process.exit(1);
}
console.log('\u2713 ' + files.length + ' JS files parse cleanly.');
