/**
 * geofox: the fox drawn flat, as SVG. BM Player Lite, and a machine without
 * WebGL, show it instead of the 3D fox (fox3d.js). Until v3.29.1 it was a
 * separate, older drawing, so the two players showed two different foxes.
 * Now it is the 3D fox itself, drawn still: the same mesh, colours and
 * lighting (the 3D shader's formula, per facet), turned a little as the 3D
 * fox rests. It blinks, twitches an ear and tilts towards the pointer, and,
 * like the 3D fox, it no longer floats.
 */
import { TRIANGLES, MATERIALS, MATERIAL_ORDER, PARTS, PIVOTS } from './fox3d-mesh.js';
import { hatTriangles } from './fox3d.js';   // a function: called once both modules are loaded

const W = 400;
const NS = 'http://www.w3.org/2000/svg';
const K = 88, CX = 200, CY = 205;   // mesh units to the 400 by 400 view
const YAW = -0.24, PITCH = 0.08;    // the 3D fox's resting turn
const norm3 = v => { const l = Math.hypot(...v) || 1; return v.map(c => c / l); };
const KEY = norm3([-0.45, 0.55, 0.70]), FILL = norm3([0.7, 0.1, 0.6]);   // fox3d.js's lights
const cyw = Math.cos(YAW), syw = Math.sin(YAW), cpt = Math.cos(PITCH), spt = Math.sin(PITCH);
const rot = ([x, y, z]) => { const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw; return [x1, y * cpt - z1 * spt, y * spt + z1 * cpt]; };
const to2 = p => { const [x, y] = rot(p); return [+(CX + x * K).toFixed(1), +(CY - y * K).toFixed(1)]; };
const pts = list => list.map(p => `${p[0]},${p[1]}`).join(' ');

// The rim light is the theme's accent, as on the 3D fox.
function accent() {
  try {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const m = /^#([0-9a-f]{6})$/i.exec(c); if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  } catch {}
  return [0.4, 0.6, 1];
}

// fox3d.js's fragment shader, for one flat facet.
function shade(col, n, lit, rim) {
  n = norm3(rot(n));
  const d = Math.max(0, n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2]);
  const f = Math.max(0, n[0] * FILL[0] + n[1] * FILL[1] + n[2] * FILL[2]);
  const r = Math.pow(1 - Math.max(n[2], 0), 2.4) * 0.30;
  const warm = [0.035, 0.018, 0];
  const out = col.map((c, i) => {
    const l = c * (0.70 + 0.38 * d + 0.10 * f) + warm[i] * (1 - d) + rim[i] * r;
    return Math.min(1, c + (l - c) * lit);
  });
  return `rgb(${out.map(v => Math.round(v * 255)).join(',')})`;
}

function group(parent, cls, origin) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', cls);
  if (origin) g.style.transformOrigin = `${origin[0]}px ${origin[1]}px`;
  parent.appendChild(g);
  return g;
}

// The head turns about the neck, as on the 3D fox (fox3d.js, v3.30.1): each
// point follows it by its height, none below y -1.85 (the chest), fully above
// -1.35, so the chest stays put and the neck bends.
const NECK = [0, -1.55, -0.1];
function headWeight(y) { const t = Math.max(0, Math.min(1, (y + 1.85) / 0.5)); return t * t * (3 - 2 * t); }
function turn(v, c, origin = true) {
  const o = origin ? NECK : [0, 0, 0];
  const x = v[0] - o[0], y = v[1] - o[1], z = v[2] - o[2];
  const x1 = x * c.cy + z * c.sy, z1 = -x * c.sy + z * c.cy;
  return [x1 + o[0], y * c.cp - z1 * c.sp + o[1], y * c.sp + z1 * c.cp + o[2]];
}
/** Turns the drawn fox's head: yaw and pitch in radians, pitch below 0 looks up. */
export function poseFlat(svg, yaw, pitch) {
  const F = svg?._facets; if (!F) return;
  const c = { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) };
  for (const f of F) {
    const q = f.p3.map((v, i) => { const h = turn(v, c), w = f.w[i]; return [v[0] + (h[0] - v[0]) * w, v[1] + (h[1] - v[1]) * w, v[2] + (h[2] - v[2]) * w]; });
    f.node.setAttribute('points', pts(q.map(to2)));
    const wm = (f.w[0] + f.w[1] + f.w[2]) / 3, hn = turn(f.n, c, false);
    const fill = shade(f.col, f.n.map((v, i) => v + (hn[i] - v) * wm), f.lit, svg._rim);
    f.node.setAttribute('fill', fill); f.node.setAttribute('stroke', fill);
  }
}

/** Builds the fox as an <svg> element. Exported for tests and previews. */
export function buildFoxSVG() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
  svg.setAttribute('class', 'geofox');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'BM Player fox');
  const rim = accent();
  // The facets of each part, front-facing ones only, drawn back to front.
  const parts = {};
  const add = (name, p, n, col, lit) => {
    if (rot(n)[2] <= 0) return;                       // facing away: hidden
    (parts[name] = parts[name] || []).push({ p: p.map(to2), p3: p, n, col, lit, z: (rot(p[0])[2] + rot(p[1])[2] + rot(p[2])[2]) / 3, fill: shade(col, n, lit, rim) });
  };
  for (const t of TRIANGLES) {
    const mat = MATERIAL_ORDER[t[12]], col = MATERIALS[mat].map(c => c / 255);
    add(PARTS[t[13]], [t.slice(0, 3), t.slice(3, 6), t.slice(6, 9)], t.slice(9, 12), col, mat === 'glint' ? 0 : 1);
  }
  try { for (const h of hatTriangles()) add('hat', h.p, h.n, h.col, 1); } catch {}
  const mirror = v => [-v[0], v[1], v[2]];
  const eyeAt = name => to2(name === 'eye_l' ? PIVOTS.eye_l : mirror(PIVOTS.eye_l));
  const body = group(svg, 'gf-body', [CX, CY + 1.8 * K]);
  const groups = {
    ear_l: group(body, 'gf-ear gf-ear-l', to2(PIVOTS.ear_l)),
    ear_r: group(body, 'gf-ear gf-ear-r', to2(mirror(PIVOTS.ear_l))),
    head: group(body, 'gf-face'),
    nose: group(body, 'gf-nose'),
    eye_l: group(body, 'gf-eye gf-eye-l', eyeAt('eye_l')),
    eye_r: group(body, 'gf-eye gf-eye-r', eyeAt('eye_r')),
    hat: group(body, 'gf-hat'),
  };
  const facets = [];
  svg._facets = facets; svg._rim = rim;
  for (const [name, list] of Object.entries(parts)) {
    const g = groups[name] || groups.head;
    list.sort((a, b) => a.z - b.z);
    for (const f of list) {
      const e = document.createElementNS(NS, 'polygon');
      e.setAttribute('points', pts(f.p)); e.setAttribute('fill', f.fill);
      // An outline in the facet's own colour closes the seams between facets.
      // About a pixel on screen (the 400-unit view is drawn about 200px wide):
      // thinner, the background showed through as light lines.
      e.setAttribute('stroke', f.fill); e.setAttribute('stroke-width', '2'); e.setAttribute('stroke-linejoin', 'round');
      g.appendChild(e);
      const w = [0, 1, 2].map(i => headWeight(f.p3[i][1]));
      if (w.some(Boolean)) facets.push({ node: e, p3: f.p3, n: f.n, col: f.col, lit: f.lit, w });   // the chest never moves

    }
  }
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
      // The head turns towards the pointer, the chest stays (v3.30.1). The whole
      // drawing used to tilt in 3D, so the fox swayed like a balloon.
      poseFlat(this.svg, this._cx * 0.30, this._cy * 0.16);
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
  // A hat in Snow, and the rim light follows the theme's accent, as on the 3D
  // fox: the drawing is redone on the next frame, once the theme applies.
  setTheme(name) {
    this._theme = name;
    this.svg.classList.toggle('gf-hat-on', name === 'snow');
    requestAnimationFrame(() => {
      const fresh = buildFoxSVG();
      fresh.setAttribute('class', this.svg.getAttribute('class'));
      this.svg.replaceWith(fresh); this.svg = fresh;
      this.svg.classList.toggle('gf-hat-on', this._theme === 'snow');
      if (this._cx || this._cy) poseFlat(this.svg, this._cx * 0.30, this._cy * 0.16);
    });
  }
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
