/**
 * BM Player — Icon Generator
 * Creates buildResources/icon.png (256×256) using pngjs (pure JS, no native deps).
 */
'use strict';

const path = require('path');
const fs   = require('fs');
const { PNG } = require('pngjs');

const OUT  = path.join(__dirname, '..', 'buildResources', 'icon.png');
const SIZE = 256;

function clamp (v) { return Math.max(0, Math.min(255, Math.round(v))); }
function lerp  (a, b, t) { return a + (b - a) * t; }

function hexToRgb (hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Draw a filled circle (anti-aliased at edge)
function drawCircle (pixels, cx, cy, r, color, alpha = 1) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const aa   = Math.max(0, Math.min(1, r - dist + 0.5));
      const a    = aa * alpha;
      if (a <= 0) continue;
      const idx = (y * SIZE + x) * 4;
      pixels[idx]     = clamp(lerp(pixels[idx],     color[0], a));
      pixels[idx + 1] = clamp(lerp(pixels[idx + 1], color[1], a));
      pixels[idx + 2] = clamp(lerp(pixels[idx + 2], color[2], a));
      pixels[idx + 3] = clamp(lerp(pixels[idx + 3], 255, a));
    }
  }
}

// Draw a filled rectangle
function drawRect (pixels, x1, y1, w, h, color, alpha = 1) {
  for (let y = y1; y < y1 + h; y++) {
    for (let x = x1; x < x1 + w; x++) {
      if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
      const idx = (y * SIZE + x) * 4;
      pixels[idx]     = clamp(lerp(pixels[idx],     color[0], alpha));
      pixels[idx + 1] = clamp(lerp(pixels[idx + 1], color[1], alpha));
      pixels[idx + 2] = clamp(lerp(pixels[idx + 2], color[2], alpha));
      pixels[idx + 3] = clamp(lerp(pixels[idx + 3], 255, alpha));
    }
  }
}

// Draw a gradient circle (background)
function drawGradBg (pixels) {
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 2;
  const c1 = [0x5B, 0x6F, 0xF8];  // #5B6FF8 (indigo)
  const c2 = [0x00, 0xD4, 0xFF];  // #00D4FF (cyan)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx   = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r + 0.5) continue;
      const aa = Math.max(0, Math.min(1, r - dist + 0.5));
      const t  = (dx + dy + r * 2) / (r * 4); // diagonal gradient
      const c  = [lerp(c1[0],c2[0],t), lerp(c1[1],c2[1],t), lerp(c1[2],c2[2],t)];
      const idx = (y * SIZE + x) * 4;
      pixels[idx]     = clamp(c[0]);
      pixels[idx + 1] = clamp(c[1]);
      pixels[idx + 2] = clamp(c[2]);
      pixels[idx + 3] = clamp(255 * aa);
    }
  }
}

// Draw a pixel-art letter using a 5×7 bitmap
const GLYPHS = {
  B: [
    [1,1,1,0],
    [1,0,0,1],
    [1,1,1,0],
    [1,0,0,1],
    [1,0,0,1],
    [1,1,1,0],
  ],
  M: [
    [1,0,0,0,1],
    [1,1,0,1,1],
    [1,0,1,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
};

function drawGlyph (pixels, glyph, startX, startY, scale, color) {
  const rows = GLYPHS[glyph];
  if (!rows) return;
  rows.forEach((row, ry) => {
    row.forEach((on, rx) => {
      if (!on) return;
      const px = startX + rx * scale;
      const py = startY + ry * scale;
      drawRect(pixels, px, py, scale - 1, scale - 1, color, 1.0);
    });
  });
}

// Draw fox ears (two triangles at top)
function drawEar (pixels, tipX, tipY, baseX, baseY, baseW, color) {
  const steps = 20;
  for (let t = 0; t <= steps; t++) {
    const left   = [baseX - baseW / 2 + (t / steps) * baseW, baseY];
    const right  = [baseX + baseW / 2 + (t / steps) * 0, baseY];
    const topX   = lerp(left[0], tipX, t / steps);
    const topY   = lerp(left[1], tipY, t / steps);
    const botX   = lerp(left[0], right[0], t / steps);
    const h      = Math.abs(botX - topX);
    for (let s = 0; s <= h; s++) {
      const cx = lerp(topX, botX, s / Math.max(h, 1));
      const cy = lerp(topY, left[1], s / Math.max(h, 1));
      drawCircle(pixels, cx, cy, 3.5, color, 0.9);
    }
  }
}

async function generate () {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const png      = new PNG({ width: SIZE, height: SIZE });
  const pixels   = png.data;
  const white    = [255, 255, 255];
  const foxOrange= [255, 120, 45];

  // 1. Gradient circle background
  drawGradBg(pixels);

  // 2. Fox ears above the circle
  drawEar(pixels, SIZE * 0.36, SIZE * 0.14, SIZE * 0.35, SIZE * 0.32, 28, foxOrange);
  drawEar(pixels, SIZE * 0.64, SIZE * 0.14, SIZE * 0.65, SIZE * 0.32, 28, foxOrange);

  // 3. Darker inner ears
  const innerEar = [255, 160, 180];
  drawCircle(pixels, SIZE * 0.36, SIZE * 0.20, 7, innerEar, 0.85);
  drawCircle(pixels, SIZE * 0.64, SIZE * 0.20, 7, innerEar, 0.85);

  // 4. White "BM" letters (large, centered)
  const glyphScale = 14;
  const bWidth = GLYPHS.B[0].length * glyphScale;
  const mWidth = GLYPHS.M[0].length * glyphScale;
  const gap    = 10;
  const totalW = bWidth + gap + mWidth;
  const startX = (SIZE - totalW) / 2;
  const startY = (SIZE - GLYPHS.B.length * glyphScale) / 2 + 8;

  drawGlyph(pixels, 'B', Math.round(startX),              Math.round(startY), glyphScale, white);
  drawGlyph(pixels, 'M', Math.round(startX + bWidth + gap), Math.round(startY), glyphScale, white);

  // 5. Small play-triangle decoration (bottom-right)
  const triCx = SIZE * 0.73, triCy = SIZE * 0.73, triR = 22;
  drawCircle(pixels, triCx, triCy, triR, [255,255,255], 0.18);
  // Triangle pixels
  for (let ty = -11; ty < 11; ty++) {
    const hw = Math.max(0, 11 - Math.abs(ty));
    for (let tx = -4; tx < hw; tx++) {
      const px = Math.round(triCx + tx);
      const py = Math.round(triCy + ty);
      if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;
      const idx = (py * SIZE + px) * 4;
      pixels[idx]     = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = 220;
    }
  }

  // Write PNG
  const buf = PNG.sync.write(png);
  fs.writeFileSync(OUT, buf);
  console.log(`✓ Icon generated: ${OUT}`);
}

generate().catch(err => { console.error('Icon generation failed:', err.message); });
