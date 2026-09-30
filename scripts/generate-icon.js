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
 * buildResources/icon.png, the Windows buildResources/icon.ico, and on macOS
 * buildResources/icon.icns. electron-builder does not derive those from the
 * PNG in this configuration: the configs name them, and the first Windows and
 * Mac builds on GitHub stopped because they did not exist.
 */

const path = require('path');
const fs   = require('fs');
const { execFileSync } = require('child_process');

const ROOT   = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'icon-source.png');
const OUTDIR = path.join(ROOT, 'buildResources');
const OUT    = path.join(OUTDIR, 'icon.png');
const ICO    = path.join(OUTDIR, 'icon.ico');
const ICNS   = path.join(OUTDIR, 'icon.icns');
const ICONSET = path.join(OUTDIR, 'icon.iconset');
const FILL   = 0.88;   // the tile's share of the icon: between Windows' full tiles and macOS's smaller ones
const INSET  = 3;      // source pixels trimmed off the tile's edge, where it blends into the black
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

  // The artwork is a rounded tile inside a solid black square, with no
  // transparency, and the tile fills only about 60% of it: the app icon was a
  // small tile in a black box on every taskbar and dock (v3.25.3). Find the
  // tile, cut it out with its own rounded corners, and let it fill the icon
  // with a small transparent margin. A plain square source comes out as it is.
  const img = await Jimp.read(SOURCE);
  const tile = findTile(img.bitmap);
  const side = Math.max(tile.w, tile.h);
  const sq = new Jimp({ width: side, height: side, color: 0x00000000 });
  sq.composite(img, Math.round(side / 2 - (tile.x + tile.w / 2)), Math.round(side / 2 - (tile.y + tile.h / 2)));
  maskTile(sq.bitmap, { x: side / 2 - tile.w / 2, y: side / 2 - tile.h / 2, w: tile.w, h: tile.h, r: tile.r });
  const inner = Math.round(SIZE * FILL);
  await sq.resize({ w: inner, h: inner });
  const out = new Jimp({ width: SIZE, height: SIZE, color: 0x00000000 });
  out.composite(sq, Math.round((SIZE - inner) / 2), Math.round((SIZE - inner) / 2));
  await out.write(OUT);

  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log('[gen-icon] wrote ' + path.relative(ROOT, OUT) + ' (' + SIZE + 'x' + SIZE + ', ' + kb + ' KB)');

  // The Windows installer (NSIS) needs a real .ico: electron-builder.yml asks
  // for icon.ico for the app, the installer, the uninstaller and the header,
  // and only icon.png was ever made, so the first installer build on GitHub
  // stopped with "cannot find specified resource buildResources/icon.ico".
  const big = await Jimp.read(OUT);
  const entries = [];
  for (const s of [16, 24, 32, 48, 64, 128, 256]) {
    // Halve step by step, then scale to size: one jump from 1024 to 16 samples
    // too few pixels and turns the detailed artwork into speckle.
    const im = big.clone();
    while (im.bitmap.width / 2 >= s * 1.5) await im.resize({ w: Math.round(im.bitmap.width / 2), h: Math.round(im.bitmap.height / 2) });
    await im.resize({ w: s, h: s });
    entries.push({ size: s, rgba: im.bitmap.data, png: s === 256 ? await im.getBuffer('image/png') : null });
  }
  fs.writeFileSync(ICO, encodeIco(entries));
  console.log('[gen-icon] wrote ' + path.relative(ROOT, ICO) + ' (' + entries.map(e => e.size).join(', ') + ')');

  generateMacIcon();
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

/* The macOS icon, with Apple's own tools: sips renders each size of an
   .iconset from the 1024 PNG, and iconutil turns the set into an .icns. Both
   come with macOS, which is the only place a Mac build runs, so elsewhere
   this does nothing. (v3.25.3: the Mac build on GitHub stopped with "cannot
   find specified resource buildResources/icon.icns".) */
function generateMacIcon() {
  if (process.platform !== 'darwin') return;
  fs.rmSync(ICONSET, { recursive: true, force: true });
  fs.mkdirSync(ICONSET, { recursive: true });
  const sizes = [
    [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png'],
  ];
  for (const [size, name] of sizes)
    execFileSync('sips', ['-z', String(size), String(size), OUT, '--out', path.join(ICONSET, name)], { stdio: 'ignore' });
  execFileSync('iconutil', ['-c', 'icns', ICONSET, '-o', ICNS], { stdio: 'inherit' });
  fs.rmSync(ICONSET, { recursive: true, force: true });
  console.log('[gen-icon] wrote ' + path.relative(ROOT, ICNS));
}

/* The artwork's tile: the box of everything that is not the black
   background, and its corner radius, from where the diagonal from the box's
   corner first meets it (a rounded corner of radius r lies r(1 - 1/sqrt 2) in
   along the diagonal). */
function findTile({ data, width: W, height: H }) {
  const lit = (x, y) => { const i = (y * W + x) * 4; return Math.max(data[i], data[i + 1], data[i + 2]) > 12 && data[i + 3] > 12; };
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2)
    if (lit(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { x: 0, y: 0, w: W, h: H, r: 0 };
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  let d = 0;
  while (d < Math.min(w, h) / 2 && !lit(x0 + d, y0 + d)) d++;
  return { x: x0, y: y0, w, h, r: Math.min(d / (1 - Math.SQRT1_2), w / 2, h / 2) };
}

/* Everything outside the tile's rounded rectangle becomes transparent, with a
   one-pixel soft edge. The tile is trimmed by INSET pixels first, where its
   edge blends into the black, and pixels outside take the tile's own edge
   colour, so scaling cannot pull a dark fringe in from the old background. */
function maskTile({ data, width: W, height: H }, { x, y, w, h, r }) {
  x += INSET; y += INSET; w -= 2 * INSET; h -= 2 * INSET; r = Math.max(0, r - INSET);
  const cx = x + w / 2, cy = y + h / 2, hx = w / 2 - r, hy = h / 2 - r;
  const ei = (Math.round(cy) * W + Math.round(x + Math.min(24, w / 4))) * 4;   // just inside the left edge
  const edge = [data[ei], data[ei + 1], data[ei + 2]];
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const qx = Math.abs(px + 0.5 - cx) - hx, qy = Math.abs(py + 0.5 - cy) - hy;
    const dist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    const k = Math.min(1, Math.max(0, 0.5 - dist));
    if (k >= 1) continue;
    const i = (py * W + px) * 4;
    if (dist > 0.5) { data[i] = edge[0]; data[i + 1] = edge[1]; data[i + 2] = edge[2]; }
    data[i + 3] = Math.round(data[i + 3] * k);
  }
}
