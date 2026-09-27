#!/usr/bin/env node
'use strict';
/**
 * BM Player — build icon generator
 *
 * Every `npm run build:*` script starts with `npm run gen-icon`, which runs
 * this file. It was referenced but never committed, so every build died here
 * before electron-builder was ever invoked.
 *
 * Reads assets/icon-source.png and writes a square 1024x1024
 * buildResources/icon.png. electron-builder derives .ico / .icns / the Linux
 * png set from that one file, so there's nothing else to produce.
 */

const path = require('path');
const fs   = require('fs');

const ROOT   = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'icon-source.png');
const OUTDIR = path.join(ROOT, 'buildResources');
const OUT    = path.join(OUTDIR, 'icon.png');
const SIZE   = 1024;   // electron-builder wants >=256; 1024 covers macOS retina

function fail(msg) {
  console.error('[gen-icon] ' + msg);
  process.exit(1);
}

async function main() {
  if (!fs.existsSync(SOURCE)) fail('missing source image: ' + SOURCE);
  fs.mkdirSync(OUTDIR, { recursive: true });

  let Jimp;
  try {
    // jimp 1.x is ESM-first and exports { Jimp }; 0.x exported the class
    // directly. Support both so a lockfile bump doesn't break the build.
    const mod = await import('jimp');
    Jimp = mod.Jimp || mod.default || mod;
  } catch (e) {
    // Not fatal: if a valid icon is already committed, a missing jimp
    // shouldn't stop someone from building.
    if (fs.existsSync(OUT)) {
      console.warn('[gen-icon] jimp unavailable (' + e.message + ') — keeping existing icon.png');
      return;
    }
    fail('jimp is required to generate the icon: ' + e.message);
  }

  const img = await Jimp.read(SOURCE);
  const w = img.bitmap.width, h = img.bitmap.height;

  // Pad to a square before scaling. Scaling a non-square source straight to
  // 1024x1024 stretches the artwork, and electron-builder rejects non-square.
  if (w !== h) {
    const side = Math.max(w, h);
    const canvas = new Jimp({ width: side, height: side, color: 0x00000000 });
    canvas.composite(img, Math.floor((side - w) / 2), Math.floor((side - h) / 2));
    await canvas.resize({ w: SIZE, h: SIZE });
    await canvas.write(OUT);
  } else {
    await img.resize({ w: SIZE, h: SIZE });
    await img.write(OUT);
  }

  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log('[gen-icon] wrote ' + path.relative(ROOT, OUT) + ' (' + SIZE + 'x' + SIZE + ', ' + kb + ' KB)');
}

main().catch(e => fail(e.stack || e.message));
