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
const ICO    = path.join(OUTDIR, 'icon.ico');
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

  // The Windows installer (NSIS) needs a real .ico: electron-builder.yml asks
  // for icon.ico for the app, the installer, the uninstaller and the header,
  // and only icon.png was ever made, so the first installer build on GitHub
  // stopped with "cannot find specified resource buildResources/icon.ico".
  const big = await Jimp.read(OUT);
  const entries = [];
  for (const s of [16, 24, 32, 48, 64, 128, 256]) {
    const im = big.clone(); await im.resize({ w: s, h: s });
    entries.push({ size: s, rgba: im.bitmap.data, png: s === 256 ? await im.getBuffer('image/png') : null });
  }
  fs.writeFileSync(ICO, encodeIco(entries));
  console.log('[gen-icon] wrote ' + path.relative(ROOT, ICO) + ' (' + entries.map(e => e.size).join(', ') + ')');
}

/* An .ico file. Sizes below 256 are classic 32-bit bitmaps, which every tool
   reads (NSIS has a history of refusing PNG-compressed small icons); 256 is
   PNG, the way Windows expects its largest icon. */
function encodeIco(entries) {
  const images = entries.map(({ size: s, rgba, png }) => {
    if (png) return png;
    const rowMask = Math.ceil(s / 32) * 4;
    const buf = Buffer.alloc(40 + s * s * 4 + rowMask * s);
    buf.writeUInt32LE(40, 0); buf.writeInt32LE(s, 4); buf.writeInt32LE(s * 2, 8);     // height counts colour + mask
    buf.writeUInt16LE(1, 12); buf.writeUInt16LE(32, 14); buf.writeUInt32LE(0, 16);
    buf.writeUInt32LE(s * s * 4 + rowMask * s, 20);
    for (let y = 0; y < s; y++) {                                                      // rows bottom-up, BGRA
      const row = s - 1 - y;
      for (let x = 0; x < s; x++) {
        const i = (y * s + x) * 4, o = 40 + (row * s + x) * 4;
        buf[o] = rgba[i + 2]; buf[o + 1] = rgba[i + 1]; buf[o + 2] = rgba[i]; buf[o + 3] = rgba[i + 3];
        if (rgba[i + 3] === 0) buf[40 + s * s * 4 + row * rowMask + (x >> 3)] |= 0x80 >> (x & 7);  // transparent in the mask
      }
    }
    return buf;
  });
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  entries.forEach(({ size: s }, k) => {
    const e = 6 + 16 * k;
    head[e] = s >= 256 ? 0 : s; head[e + 1] = s >= 256 ? 0 : s; head[e + 2] = 0; head[e + 3] = 0;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(images[k].length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += images[k].length;
  });
  return Buffer.concat([head, ...images]);
}

main().catch(e => fail(e.stack || e.message));
