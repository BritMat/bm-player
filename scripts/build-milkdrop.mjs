/**
 * build-milkdrop: the MilkDrop presets as ready-made functions (v3.32.0).
 *
 * butterchurn (MIT) plays MilkDrop presets in WebGL. Each preset's equations
 * come as text, which butterchurn turns into functions with new Function: an
 * eval, which the app's Content-Security-Policy forbids, rightly. But it only
 * compiles a preset whose init_eqs is not a function already. So this script
 * writes the presets out once, at build time, with the equations as real
 * functions in an ordinary script: nothing is evaluated at runtime and the
 * policy stays as it is. Run it again only to change the set.
 *
 * v3.36.0: a chosen set, not a whole pack. butterchurn-presets has four packs
 * with 395 presets between them, and the app carried the first pack's 100 as
 * they came: many garish, some nearly black, some flashing white. Every one of
 * the 395 was drawn on the same piece of music and looked at, and the names
 * kept are in scripts/milkdrop-presets.json. To change the set, edit that
 * list and run this again.
 *
 *   npm install --prefix /tmp/md butterchurn@2.6.7 butterchurn-presets@2.4.7
 *   node scripts/build-milkdrop.mjs /tmp/md/node_modules
 *
 * With --all it also writes every preset of the packs to
 * src/vendor/milkdrop/all-presets.js, for scripts/milkdrop-review.mjs to draw
 * and measure. That file is for looking, not for shipping: delete it when done
 * (check-contracts fails while it is there).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const from = process.argv[2] || 'node_modules';
const require = createRequire(import.meta.url);
const PACKS = ['butterchurnPresets', 'butterchurnPresetsExtra', 'butterchurnPresetsExtra2', 'butterchurnPresetsMD1'];
const every = {};
for (const f of PACKS) {
  const pack = require(path.resolve(from, `butterchurn-presets/lib/${f}.min.js`));
  for (const [name, p] of Object.entries(pack.getPresets ? pack.getPresets() : pack.default.getPresets())) if (!(name in every)) every[name] = p;
}
const keep = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'milkdrop-presets.json'), 'utf8'));
const missing = keep.filter(n => !every[n]);
if (missing.length) { console.error(`not in butterchurn's packs (${missing.length}):\n  ` + missing.join('\n  ')); process.exit(1); }
if (new Set(keep).size !== keep.length) { console.error('a name is listed twice in milkdrop-presets.json'); process.exit(1); }
const all = Object.fromEntries(keep.map(n => [n, every[n]]));
const out = path.resolve('src/vendor/milkdrop');
fs.mkdirSync(out, { recursive: true });

const fn = body => `function(a){\n${body || ''}\nreturn a;}`;
const data = o => { const c = { ...o }; for (const k of Object.keys(c)) if (k.endsWith('_eqs_str')) delete c[k]; return JSON.stringify(c); };
// A set of presets as the text of a module. Each preset is made fresh when it
// is loaded (butterchurn changes the object).
const moduleOf = (set, what) => {
  const parts = [];
  for (const [name, p] of Object.entries(set)) {
    // The same as butterchurn's loadPreset would build, but written out.
    const shapes = (p.shapes || []).map(s => `Object.assign(${data(s)},{init_eqs:${fn(s.init_eqs_str)},frame_eqs:${fn(s.frame_eqs_str)}})`);
    const waves = (p.waves || []).map(w => `Object.assign(${data(w)},{init_eqs:${fn(w.init_eqs_str)},frame_eqs:${fn(w.frame_eqs_str)},point_eqs:${w.point_eqs_str ? fn(w.point_eqs_str) : "''"}})`);
    const base = { ...p }; delete base.shapes; delete base.waves;
    parts.push(`${JSON.stringify(name)}:()=>Object.assign(${data(base)},{shapes:[${shapes.join(',')}],waves:[${waves.join(',')}],` +
      `init_eqs:${fn(p.init_eqs_str)},frame_eqs:${fn(p.frame_eqs_str)},pixel_eqs:${p.pixel_eqs_str ? fn(p.pixel_eqs_str) : "''"}})`);
  }
  return '/* MilkDrop presets from butterchurn-presets (MIT, https://github.com/jberg/butterchurn-presets),\n' +
    `   ${what}, with their equations written out as\n` +
    '   functions by scripts/build-milkdrop.mjs. Generated: do not edit. */\n' +
    `export const PRESETS = {\n${parts.join(',\n')}\n};\n`;
};
fs.writeFileSync(path.join(out, 'presets.js'), moduleOf(all, 'the set named in scripts/milkdrop-presets.json'));
if (process.argv.includes('--all')) {
  fs.writeFileSync(path.join(out, 'all-presets.js'), moduleOf(every, 'every one of the four packs, for review only'));
  console.log(`all ${Object.keys(every).length} presets written to src/vendor/milkdrop/all-presets.js, for review: delete it when done`);
}
fs.copyFileSync(path.resolve(from, 'butterchurn/lib/butterchurn.min.js'), path.join(out, 'butterchurn.min.js'));
const lic = ['butterchurn', 'butterchurn-presets'].map(n => {
  const d = path.resolve(from, n); const f = ['LICENSE', 'LICENSE.md', 'license'].map(x => path.join(d, x)).find(fs.existsSync);
  return `── ${n} ──\n` + (f ? fs.readFileSync(f, 'utf8') : 'MIT License (see the package on npm)');
}).join('\n\n');
fs.writeFileSync(path.join(out, 'LICENSE.txt'), lic);
console.log(`${Object.keys(all).length} presets (of ${Object.keys(every).length} in the packs) written to src/vendor/milkdrop`);
