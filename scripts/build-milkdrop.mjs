/**
 * build-milkdrop: the MilkDrop presets as ready-made functions (v3.32.0).
 *
 * butterchurn (MIT) plays MilkDrop presets in WebGL. Each preset's equations
 * come as text, which butterchurn turns into functions with new Function: an
 * eval, which the app's Content-Security-Policy forbids, rightly. But it only
 * compiles a preset whose init_eqs is not a function already. So this script
 * writes the presets out once, at build time, with the equations as real
 * functions in an ordinary script: nothing is evaluated at runtime and the
 * policy stays as it is. Run it again only to change the pack.
 *
 *   node scripts/build-milkdrop.mjs [path to butterchurn-presets and butterchurn]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const from = process.argv[2] || 'node_modules';
const require = createRequire(import.meta.url);
const pack = require(path.resolve(from, 'butterchurn-presets/lib/butterchurnPresets.min.js'));
const all = (pack.getPresets ? pack.getPresets() : pack.default.getPresets());
const out = path.resolve('src/vendor/milkdrop');
fs.mkdirSync(out, { recursive: true });

const fn = body => `function(a){\n${body || ''}\nreturn a;}`;
const data = o => { const c = { ...o }; for (const k of Object.keys(c)) if (k.endsWith('_eqs_str')) delete c[k]; return JSON.stringify(c); };
const parts = [];
for (const [name, p] of Object.entries(all)) {
  // The same as butterchurn's loadPreset would build, but written out.
  const shapes = (p.shapes || []).map(s => `Object.assign(${data(s)},{init_eqs:${fn(s.init_eqs_str)},frame_eqs:${fn(s.frame_eqs_str)}})`);
  const waves = (p.waves || []).map(w => `Object.assign(${data(w)},{init_eqs:${fn(w.init_eqs_str)},frame_eqs:${fn(w.frame_eqs_str)},point_eqs:${w.point_eqs_str ? fn(w.point_eqs_str) : "''"}})`);
  const base = { ...p }; delete base.shapes; delete base.waves;
  parts.push(`${JSON.stringify(name)}:()=>Object.assign(${data(base)},{shapes:[${shapes.join(',')}],waves:[${waves.join(',')}],` +
    `init_eqs:${fn(p.init_eqs_str)},frame_eqs:${fn(p.frame_eqs_str)},pixel_eqs:${p.pixel_eqs_str ? fn(p.pixel_eqs_str) : "''"}})`);
}
// Each preset is made fresh when it is loaded (butterchurn changes the object).
fs.writeFileSync(path.join(out, 'presets.js'),
  '/* MilkDrop presets from butterchurn-presets (MIT, https://github.com/jberg/butterchurn-presets),\n' +
  '   with their equations written out as functions by scripts/build-milkdrop.mjs. Generated: do not edit. */\n' +
  `export const PRESETS = {\n${parts.join(',\n')}\n};\n`);
fs.copyFileSync(path.resolve(from, 'butterchurn/lib/butterchurn.min.js'), path.join(out, 'butterchurn.min.js'));
const lic = ['butterchurn', 'butterchurn-presets'].map(n => {
  const d = path.resolve(from, n); const f = ['LICENSE', 'LICENSE.md', 'license'].map(x => path.join(d, x)).find(fs.existsSync);
  return `── ${n} ──\n` + (f ? fs.readFileSync(f, 'utf8') : 'MIT License (see the package on npm)');
}).join('\n\n');
fs.writeFileSync(path.join(out, 'LICENSE.txt'), lic);
console.log(`${Object.keys(all).length} presets written to src/vendor/milkdrop`);
