/**
 * GeoFox: the welcome-screen fox, drawn as a hand-placed low-poly SVG.
 *
 * Replaces the three.js fox, which was built from spheres in code: a
 * floating ball of a head over a ball of a body, its facets cracked apart,
 * in pink. This one is designed rather than generated. Every point has a
 * depth towards the viewer, and each triangle is its material shaded by the
 * real facet normal against a single light from the upper left, so flat
 * facets read as a solid head. The left half is laid out by hand and
 * mirrored, so the face is symmetrical and the lighting is not.
 *
 * Plain SVG and CSS: no WebGL, no library, cheap enough for Lite mode, so
 * every machine gets the same fox.
 *
 * Interface kept from the old fox, so nothing else had to change:
 *   wake(), setExpression('neutral'|'happy'|'excited'), pause(), resume(),
 *   setTheme(name), setMusicEnergy(0..1), destroy()
 */

const W = 400;
const NS = 'http://www.w3.org/2000/svg';

const MAT = {
  orange:    [232, 118, 43],
  orange_hi: [243, 146, 69],
  cream:     [251, 236, 216],
  ear_in:    [74, 42, 34],
};

/* (x, y, z) on a 400x400 face: left half and the centre line only. */
const P = {
  crown:     [200, 100, 44],
  brow_c:    [200, 170, 74],
  bridge:    [200, 236, 98],
  nose_top:  [200, 314, 116],
  chin:      [200, 362, 76],
  // ear: outer triangle, with an inset inner ear
  ear_tip:   [104, 20, 0],
  ear_out:   [66, 156, 12],
  ear_in:    [162, 108, 30],
  ie_tip:    [110, 50, 6],
  ie_o:      [88, 136, 14],
  ie_i:      [146, 116, 22],
  crown2:    [172, 128, 48],
  forehead:  [150, 164, 62],
  brow:      [118, 188, 54],
  temple:    [64, 196, 24],
  cheek_top: [88, 238, 40],
  tuft:      [30, 254, 6],
  notch:     [68, 272, 22],
  tuft2:     [56, 306, 10],
  cheek_low: [92, 292, 36],
  jaw:       [138, 330, 54],
  muz_side:  [164, 284, 90],
  muz_low:   [174, 330, 72],
  eye_out:   [108, 206, 56],
  eye_top:   [148, 200, 64],
  eye_in:    [176, 228, 72],
  eye_bot:   [144, 240, 60],
  under_eye: [158, 262, 78],
};

/* Triangles on the left half: [points, material, part]. */
const F = [
  [['ear_tip', 'ear_out', 'ie_o'], 'orange', 'ear'],
  [['ear_tip', 'ie_o', 'ie_tip'], 'orange', 'ear'],
  [['ear_out', 'ear_in', 'ie_i'], 'orange', 'ear'],
  [['ear_out', 'ie_i', 'ie_o'], 'orange', 'ear'],
  [['ear_in', 'ear_tip', 'ie_tip'], 'orange', 'ear'],
  [['ear_in', 'ie_tip', 'ie_i'], 'orange', 'ear'],
  [['ie_tip', 'ie_o', 'ie_i'], 'ear_in', 'ear'],
  [['ear_in', 'crown', 'crown2'], 'orange', 'face'],
  [['ear_in', 'crown2', 'forehead'], 'orange', 'face'],
  [['crown2', 'crown', 'brow_c'], 'orange', 'face'],
  [['crown2', 'brow_c', 'forehead'], 'orange', 'face'],
  [['ear_out', 'ear_in', 'forehead'], 'orange', 'face'],
  [['ear_out', 'forehead', 'brow'], 'orange', 'face'],
  [['ear_out', 'brow', 'temple'], 'orange', 'face'],
  [['temple', 'brow', 'eye_out'], 'orange', 'face'],
  [['temple', 'eye_out', 'cheek_top'], 'orange', 'face'],
  [['brow', 'forehead', 'eye_top'], 'orange', 'face'],
  [['brow', 'eye_top', 'eye_out'], 'orange', 'face'],
  [['eye_top', 'forehead', 'eye_in'], 'orange', 'face'],
  [['forehead', 'brow_c', 'eye_in'], 'orange', 'face'],
  [['brow_c', 'bridge', 'eye_in'], 'orange_hi', 'face'],
  [['eye_in', 'bridge', 'under_eye'], 'orange_hi', 'face'],
  [['bridge', 'nose_top', 'under_eye'], 'orange_hi', 'face'],
  [['under_eye', 'nose_top', 'muz_side'], 'orange_hi', 'face'],
  [['nose_top', 'muz_low', 'muz_side'], 'cream', 'face'],
  [['nose_top', 'chin', 'muz_low'], 'cream', 'face'],
  [['muz_side', 'muz_low', 'jaw'], 'cream', 'face'],
  [['muz_low', 'chin', 'jaw'], 'cream', 'face'],
  [['eye_out', 'eye_bot', 'cheek_top'], 'orange', 'face'],
  [['eye_bot', 'under_eye', 'muz_side'], 'cream', 'face'],
  [['cheek_top', 'eye_bot', 'muz_side'], 'cream', 'face'],
  [['cheek_top', 'muz_side', 'cheek_low'], 'cream', 'face'],
  [['temple', 'cheek_top', 'tuft'], 'cream', 'face'],
  [['cheek_top', 'notch', 'tuft'], 'cream', 'face'],
  [['cheek_top', 'cheek_low', 'notch'], 'cream', 'face'],
  [['notch', 'cheek_low', 'tuft2'], 'cream', 'face'],
  [['cheek_low', 'jaw', 'tuft2'], 'cream', 'face'],
  [['cheek_low', 'muz_side', 'jaw'], 'cream', 'face'],
];

const LIGHT = (() => { const v = [-0.45, 0.55, 0.70]; const l = Math.hypot(...v); return v.map(c => c / l); })();

function shade(tri, mat) {
  const [a, b, c] = tri.map(p => [p[0], -p[1], p[2]]);          // SVG y points down
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
  if (n[2] < 0) n = n.map(x => -x);
  const d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const k = 0.70 + 0.38 * d;
  return '#' + MAT[mat].map(ch => Math.min(255, Math.round(ch * k)).toString(16).padStart(2, '0')).join('');
}

const mirror = p => [W - p[0], p[1], p[2]];
const pts = list => list.map(p => `${p[0]},${p[1]}`).join(' ');

function poly(parent, points, fill, extra = {}) {
  const e = document.createElementNS(NS, 'polygon');
  e.setAttribute('points', pts(points));
  e.setAttribute('fill', fill);
  for (const [k, v] of Object.entries(extra)) e.setAttribute(k, v);
  parent.appendChild(e);
  return e;
}
function group(parent, cls, origin) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', cls);
  if (origin) g.style.transformOrigin = `${origin[0]}px ${origin[1]}px`;
  parent.appendChild(g);
  return g;
}

/** Builds the fox as an <svg> element. Exported for tests and previews. */
export function buildFoxSVG() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
  svg.setAttribute('class', 'geofox');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'BM Player fox');
  const body = group(svg, 'gf-body', [200, 360]);
  const earL = group(body, 'gf-ear gf-ear-l', [114, 132]);
  const earR = group(body, 'gf-ear gf-ear-r', [W - 114, 132]);
  const face = group(body, 'gf-face');
  for (const [names, mat, part] of F) {
    const tri = names.map(n => P[n]);
    const col = shade(tri, mat), colM = shade(tri.map(mirror), mat);
    // A hairline stroke in the fill colour closes anti-aliasing seams.
    poly(part === 'ear' ? earL : face, tri, col, { stroke: col, 'stroke-width': '0.8', 'stroke-linejoin': 'round' });
    poly(part === 'ear' ? earR : face, tri.map(mirror), colM, { stroke: colM, 'stroke-width': '0.8', 'stroke-linejoin': 'round' });
  }
  for (const side of [1, -1]) {
    const X = x => (side === 1 ? x : W - x);
    const eye = group(body, 'gf-eye ' + (side === 1 ? 'gf-eye-l' : 'gf-eye-r'), [X(144), 222]);
    const almond = [P.eye_out, P.eye_top, P.eye_in, P.eye_bot].map(p => [X(p[0]), p[1]]);
    poly(eye, almond, '#1c1413');
    poly(eye, [[124, 210], [150, 205], [168, 224], [146, 234]].map(([x, y]) => [X(x), y]), '#f0a531');
    poly(eye, [[124, 210], [150, 205], [146, 218]].map(([x, y]) => [X(x), y]), '#f7c95b');
    poly(eye, [[147, 208], [153, 220], [147, 232], [141, 220]].map(([x, y]) => [X(x), y]), '#1c1413');
    poly(eye, [[135, 211], [141, 209], [139, 215]].map(([x, y]) => [X(x), y]), '#fffaf0');
  }
  // The Santa hat for the Snow theme, shown by the gf-hat-on class.
  const hat = group(body, 'gf-hat');
  poly(hat, [[144, 111], [256, 111], [258, 122], [142, 122]], '#dfe5ec');
  poly(hat, [[146, 99], [254, 99], [256, 112], [144, 112]], '#f4f6f9');
  poly(hat, [[156, 100], [204, 100], [214, 40]], '#e23a4b');
  poly(hat, [[204, 100], [244, 100], [214, 40]], '#b8202f');
  poly(hat, [[214, 40], [262, 58], [236, 70]], '#c92536');
  poly(hat, [[214, 40], [236, 70], [226, 54]], '#a51b29');
  for (const [cx, cy, r, fill] of [[266, 61, 13, '#f7f8fa'], [262, 57, 5, '#ffffff']]) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r); c.setAttribute('fill', fill);
    hat.appendChild(c);
  }
  const nose = group(body, 'gf-nose');
  poly(nose, [[178, 312], [222, 312], [200, 340]], '#1d1614');
  poly(nose, [[186, 315], [204, 315], [194, 322]], '#6b5a55');
  return svg;
}

export class GeoFox {
  /** @param {Element} canvas the old fox canvas; its stage hosts the SVG. */
  constructor(canvas, opts = {}) {
    this.kind = 'svg';
    this.renderer = null;                 // no WebGL: diagnostics and tests read this
    this.lite = !!opts.lite;
    this.stage = canvas?.closest?.('.fox-stage') || canvas?.parentElement || null;
    if (!this.stage) throw new Error('GeoFox: no stage to draw in');
    canvas?.remove?.();
    this.svg = buildFoxSVG();
    this.stage.appendChild(this.svg);
    this._timers = new Set();
    this._paused = false;
    this._reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!this._reduced) { this._blinkLater(); this._twitchLater(); }
    if (!this.lite && !this._reduced) this._wireTilt();
  }

  _later(fn, ms) { const t = setTimeout(() => { this._timers.delete(t); fn(); }, ms); this._timers.add(t); }
  _flash(cls, ms) { this.svg.classList.add(cls); this._later(() => this.svg.classList.remove(cls), ms); }

  _blinkLater() {
    this._later(() => {
      if (!this._paused) { this._flash('gf-blink', 140); if (Math.random() < 0.25) this._later(() => this._flash('gf-blink', 140), 260); }
      this._blinkLater();
    }, 3200 + Math.random() * 4200);
  }
  _twitchLater() {
    this._later(() => {
      if (!this._paused) this._flash(Math.random() < 0.5 ? 'gf-twitch-l' : 'gf-twitch-r', 460);
      this._twitchLater();
    }, 6500 + Math.random() * 7000);
  }

  /** A gentle tilt towards the pointer, smoothed. */
  _wireTilt() {
    this._tx = 0; this._ty = 0; this._cx = 0; this._cy = 0;
    this._onMove = e => {
      const r = this.stage.getBoundingClientRect();
      if (!r.width) return;
      this._tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      this._ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      if (!this._raf) this._raf = requestAnimationFrame(this._step);
    };
    this._step = () => {
      this._raf = 0;
      this._cx += (this._tx - this._cx) * 0.12; this._cy += (this._ty - this._cy) * 0.12;
      this.svg.style.transform = `perspective(900px) rotateY(${(this._cx * 9).toFixed(2)}deg) rotateX(${(-this._cy * 7).toFixed(2)}deg)`;
      if (Math.abs(this._tx - this._cx) + Math.abs(this._ty - this._cy) > 0.002) this._raf = requestAnimationFrame(this._step);
    };
    window.addEventListener('mousemove', this._onMove, { passive: true });
  }

  describe() { return `flat SVG, ${this.svg.querySelectorAll('polygon').length} facets`; }
  wake() { this._flash('gf-perk', 700); }
  setExpression(name) {
    for (const c of ['gf-happy', 'gf-excited']) this.svg.classList.remove(c);
    if (name === 'happy') this.svg.classList.add('gf-happy');
    else if (name === 'excited') { this.svg.classList.add('gf-excited'); this._flash('gf-perk', 700); }
  }
  setMusicEnergy(e) { this.svg.style.setProperty('--gf-energy', String(Math.max(0, Math.min(1, +e || 0)))); }
  setTheme(name) { this.svg.classList.toggle('gf-hat-on', name === 'snow'); }   // colours stay fox colours; a hat in Snow
  pause() { this._paused = true; this.svg.classList.add('gf-paused'); }
  resume() { this._paused = false; this.svg.classList.remove('gf-paused'); }
  destroy() {
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
    if (this._onMove) window.removeEventListener('mousemove', this._onMove);
    if (this._raf) cancelAnimationFrame(this._raf);
    this.svg?.remove();
  }
}
