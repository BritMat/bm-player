/**
 * BM Player — Icon Generator
 * Resizes the real designed icon (assets/icon-source.png) down to the
 * 256×256 PNG electron-builder needs, then the CI workflow converts that
 * to a multi-size .ico. Pure-JS (jimp) — no native deps, keeps Windows CI
 * builds simple.
 */
'use strict';
const path = require('path');
const fs   = require('fs');
const { Jimp, ResizeStrategy } = require('jimp');

const SRC  = path.join(__dirname, '..', 'assets', 'icon-source.png');
const OUT  = path.join(__dirname, '..', 'buildResources', 'icon.png');
const SIZE = 256;

async function generate() {
  if (!fs.existsSync(SRC)) {
    console.error(`✗ Icon source not found at ${SRC}`);
    console.error('  Commit your designed icon there (square PNG, ideally ≥512×512).');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const img = await Jimp.read(SRC);
  // Force square (cover-crop) in case the source isn't perfectly 1:1, then resize.
  const side = Math.min(img.bitmap.width, img.bitmap.height);
  img
    .crop({ x: (img.bitmap.width - side) / 2, y: (img.bitmap.height - side) / 2, w: side, h: side })
    .resize({ w: SIZE, h: SIZE, mode: ResizeStrategy.BICUBIC });
  await img.write(OUT);
  console.log(`✓ Icon generated from real artwork: ${OUT}`);
}

generate().catch(err => { console.error('Icon generation failed:', err.message); process.exit(1); });
