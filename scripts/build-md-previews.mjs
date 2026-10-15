#!/usr/bin/env node
/**
 * Builds the MilkDrop preset browser's pictures (v3.39.0): one sheet,
 * src/vendor/milkdrop/previews.jpg, with a picture of every preset, and
 * src/vendor/milkdrop/previews.js, which says which picture is which.
 *
 * The pictures come from the app itself, through scripts/viz-preview.mjs,
 * which draws MilkDrop on its own clock and takes a picture every few
 * seconds. A probe run after each picture starts the next preset, so each
 * picture after the first shows one preset, four seconds in:
 *
 *   xvfb-run -a node scripts/viz-preview.mjs --style=milkdrop --size=960x600 \
 *     --hz=30 --seconds=248 --shots=62 --out=/tmp/md --name=md \
 *     --probe-file=probe.js --eval="(hide the title and buttons)" > /tmp/md/run.log
 *
 * where probe.js starts preset number n (counting the probes) with
 * bmApp.viz.mdLoad(name, 0) and answers [n, name, w, h, x, y, width, height],
 * the last four being where the visualiser is in the window. Then:
 *
 *   node scripts/build-md-previews.mjs /tmp/md /tmp/md/run.log
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jimp } from 'jimp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [SHOTS, LOG] = process.argv.slice(2);
if (!SHOTS || !LOG) { console.error('usage: node scripts/build-md-previews.mjs <shots folder> <viz-preview log>'); process.exit(1); }

const W = 256, H = 144, COLS = 8;
const OUT = path.join(ROOT, 'src/vendor/milkdrop');

// Which picture is which preset: probe k started preset k-1, seen in picture k+1.
const shots = [];
for (const line of fs.readFileSync(LOG, 'utf8').split('\n')) {
  const m = /probe (\d+): (\[.*\])\s*$/.exec(line);
  if (!m) continue;
  const [n, name, , , x, y, w, h] = JSON.parse(m[2]);
  if (name) shots.push({ file: path.join(SHOTS, `md-${String(+m[1] + 1).padStart(2, '0')}.png`), name, n, rect: { x, y, w, h } });
}
const have = shots.filter(s => fs.existsSync(s.file));
if (!have.length) { console.error('no pictures found for the probes in ' + LOG); process.exit(1); }

const rows = Math.ceil(have.length / COLS);
const sheet = new Jimp({ width: COLS * W, height: rows * H, color: 0x05060aff });
for (const [i, s] of have.entries()) {
  const img = await Jimp.read(s.file);
  img.crop({ x: s.rect.x, y: s.rect.y, w: s.rect.w, h: s.rect.h });
  img.cover({ w: W, h: H });                       // the middle, at 16:9
  sheet.composite(img, (i % COLS) * W, Math.floor(i / COLS) * H);
}
const jpg = path.join(OUT, 'previews.jpg');
await sheet.write(jpg, { quality: 78 });
const index = `/* Made by scripts/build-md-previews.mjs from the presets themselves: which
   picture in previews.jpg is which preset, in order, ${COLS} to a row. */
export const MD_PREVIEWS = ${JSON.stringify({ src: 'vendor/milkdrop/previews.jpg', w: W, h: H, cols: COLS, names: have.map(s => s.name) }, null, 1)};
`;
fs.writeFileSync(path.join(OUT, 'previews.js'), index);
console.log(`wrote ${path.relative(ROOT, jpg)} (${have.length} pictures, ${(fs.statSync(jpg).size / 1024).toFixed(0)} KB) and previews.js`);
