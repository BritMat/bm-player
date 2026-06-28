'use strict';
const path = require('path');
const fs   = require('fs');
const { Jimp, ResizeStrategy } = require('jimp');
const SRC = path.join(__dirname, '..', 'assets', 'icon-source.png');
const OUT = path.join(__dirname, '..', 'buildResources', 'icon.png');
async function run() {
  if (!fs.existsSync(SRC)) { console.error('Missing', SRC); process.exit(1); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const img = await Jimp.read(SRC);
  const side = Math.min(img.bitmap.width, img.bitmap.height);
  img.crop({ x: (img.bitmap.width-side)/2, y: (img.bitmap.height-side)/2, w: side, h: side })
     .resize({ w: 256, h: 256, mode: ResizeStrategy.BICUBIC });
  await img.write(OUT);
  console.log('Icon generated:', OUT);
}
run().catch(e => { console.error(e.message); process.exit(1); });
