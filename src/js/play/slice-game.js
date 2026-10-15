/**
 * SliceGame: fruit slicing on the home screen (v3.42.0).
 *
 * Fruit is thrown up from the bottom; a swipe slices it. Each cut fruit
 * falls apart in two halves, its juice splashes, and with the Flow fluid
 * behind the game (onJuice) the juice pours into the fluid in the fruit's
 * colour. Classic: three missed fruits or one bomb ends the game. Zen: 90
 * seconds, no bombs, as much as you can. Three or more in one swipe is a
 * combo, worth that many more. The best score of each mode is kept.
 *
 * All the drawing is the game's own (no pictures): each fruit is drawn once
 * into a small canvas, whole and cut, and those are what each frame draws.
 * The loop runs only while a game is on screen, at most about 72 frames a
 * second and 30 on battery (power.js), and stops when paused or hidden.
 *
 * Shared by the desktop's welcome screen and the phone's home tab. The
 * menus are plain elements in `ui`, styled by play.css.
 */
import { frameGap } from '../power.js';
import { sfx } from './sfx.js';

const BEST = 'bm_slice_best';
const FRUITS = [
  { name: 'orange', r: 33, skin: ['#ffc46b', '#f57c00'], flesh: '#ffbe5c', rind: '#fff1d6', juice: [1, 0.55, 0.08], dots: '#e06c00', segs: true },
  { name: 'watermelon', r: 44, skin: ['#9ccc65', '#2e7d32'], stripes: '#1b5e20', flesh: '#ff4f6e', rind: '#e8f5e9', juice: [1, 0.12, 0.28], seeds: '#1a1a1a' },
  { name: 'apple', r: 31, skin: ['#ff7b7b', '#c62828'], flesh: '#fff3d1', rind: '#ffe3b0', juice: [1, 0.9, 0.55], leaf: true, core: true },
  { name: 'lime', r: 27, skin: ['#d4ef7a', '#689f38'], flesh: '#d7ee9f', rind: '#f4fbe5', juice: [0.5, 1, 0.2], segs: true },
  { name: 'plum', r: 27, skin: ['#c3a1ff', '#5e35b1'], flesh: '#ffd65a', rind: '#fff6d8', juice: [0.65, 0.15, 0.85], pit: true },
  { name: 'kiwi', r: 29, skin: ['#b0907f', '#5d4037'], flesh: '#9ccc65', rind: '#cfe8a8', juice: [0.55, 0.9, 0.15], seeds: '#1f1f1f', ring: true, fuzz: true },
];
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

function sprite (size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size);
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  draw(g);
  return c;
}

/** A fruit, whole: skin with its light from the upper left, and its marks. */
function drawWhole (g, f, R) {
  const grad = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
  grad.addColorStop(0, f.skin[0]); grad.addColorStop(1, f.skin[1]);
  g.save();
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
  g.clip();
  if (f.stripes) {
    g.strokeStyle = f.stripes; g.globalAlpha = 0.55; g.lineWidth = R * 0.16;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * R * 0.42, 0, R * 0.16, R * 1.05, 0, 0, Math.PI * 2); g.stroke(); }
    g.globalAlpha = 1;
  }
  if (f.dots) { g.fillStyle = f.dots; g.globalAlpha = 0.25; for (let i = 0; i < 40; i++) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * R; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, R * 0.03, 0, 6.28); g.fill(); } g.globalAlpha = 1; }
  if (f.fuzz) { g.strokeStyle = '#d7c2b6'; g.globalAlpha = 0.25; g.lineWidth = 1; for (let i = 0; i < 70; i++) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * R; g.beginPath(); g.moveTo(Math.cos(a) * d, Math.sin(a) * d); g.lineTo(Math.cos(a) * d + rand(-2, 2), Math.sin(a) * d + rand(-2, 2)); g.stroke(); } g.globalAlpha = 1; }
  g.restore();
  // a darker edge (the shine is drawn over it each frame, unturned: the light stays up and to the left)
  g.lineWidth = Math.max(1.5, R * 0.05); g.strokeStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.arc(0, 0, R - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
  if (f.leaf) {
    g.strokeStyle = '#5d4037'; g.lineWidth = R * 0.1; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -R * 0.82); g.quadraticCurveTo(R * 0.05, -R * 1.1, R * 0.12, -R * 1.18); g.stroke();
    g.fillStyle = '#66bb6a'; g.beginPath(); g.ellipse(R * 0.36, -R * 1.02, R * 0.3, R * 0.13, -0.5, 0, Math.PI * 2); g.fill();
  }
}

/** The same fruit cut open: rind, flesh, and seeds, segments or a pit. */
function drawCut (g, f, R) {
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fillStyle = f.skin[1]; g.fill();
  g.beginPath(); g.arc(0, 0, R * 0.92, 0, Math.PI * 2); g.fillStyle = f.rind; g.fill();
  const fl = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.84);
  fl.addColorStop(0, '#ffffff'); fl.addColorStop(0.18, f.flesh); fl.addColorStop(1, f.flesh);
  g.beginPath(); g.arc(0, 0, R * 0.84, 0, Math.PI * 2); g.fillStyle = fl; g.fill();
  if (f.segs) {
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = Math.max(1, R * 0.04);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12); g.lineTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); g.stroke(); }
  }
  if (f.ring) {
    g.fillStyle = '#f5f5dc'; g.beginPath(); g.arc(0, 0, R * 0.26, 0, Math.PI * 2); g.fill();
    g.fillStyle = f.seeds;
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; g.beginPath(); g.ellipse(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38, R * 0.05, R * 0.025, a, 0, Math.PI * 2); g.fill(); }
  } else if (f.seeds) {
    g.fillStyle = f.seeds;
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + (i % 2) * 0.2, d = R * (i % 2 ? 0.5 : 0.62); g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, R * 0.055, R * 0.03, a, 0, Math.PI * 2); g.fill(); }
  }
  if (f.core) {
    g.fillStyle = 'rgba(160,110,60,0.35)'; g.beginPath(); g.ellipse(0, 0, R * 0.22, R * 0.32, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4e342e'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.07, 0, R * 0.04, R * 0.08, s * 0.3, 0, Math.PI * 2); g.fill(); }
  }
  if (f.pit) { g.fillStyle = '#8d5524'; g.beginPath(); g.ellipse(0, 0, R * 0.22, R * 0.3, 0.3, 0, Math.PI * 2); g.fill(); }
}

function drawBomb (g, R) {
  const grad = g.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
  grad.addColorStop(0, '#5a5f6e'); grad.addColorStop(1, '#101218');
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,60,60,0.85)'; g.beginPath(); g.arc(0, 0, R - 1, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#2b2f3a'; g.fillRect(-R * 0.22, -R * 1.12, R * 0.44, R * 0.3);
  g.strokeStyle = '#8d6e63'; g.lineWidth = R * 0.09; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -R * 1.1); g.quadraticCurveTo(R * 0.3, -R * 1.45, R * 0.55, -R * 1.3); g.stroke();
  // a skull-free warning: an exclamation mark
  g.fillStyle = 'rgba(255,90,90,0.95)'; g.font = `900 ${Math.round(R * 1.05)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, R * 0.06);
}

export class SliceGame {
  /**
   * canvas: where it is drawn (fills its parent). ui: an element for the
   * menus. onJuice(x, y, dx, dy, rgb): juice for the fluid, x and y from 0
   * to 1 with y up. onExit(): back to the home screen.
   */
  constructor ({ canvas, ui, onJuice = null, onExit = null }) {
    this.canvas = canvas; this.ui = ui; this.onJuice = onJuice; this.onExit = onExit;
    this.g = canvas.getContext('2d');
    this.state = 'menu'; this.mode = 'classic';
    this.objs = []; this.drops = []; this.texts = []; this.trails = new Map();
    this.raf = 0; this.dpr = 1; this.W = 0; this.H = 0;
    this._loop = this._loop.bind(this);
    this._sprites = null;
    this._down = e => this._pointer(e, 'down');
    this._move = e => this._pointer(e, 'move');
    this._up = e => this._pointer(e, 'up');
    canvas.addEventListener('pointerdown', this._down);
    canvas.addEventListener('pointermove', this._move);
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, this._up);
    this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this._resize()) : null;
    this._ro?.observe(canvas);
    this._vis = () => { if (document.hidden && this.state === 'play') this.pause(); };
    document.addEventListener('visibilitychange', this._vis);
    // Pause, at the top in the middle, while a game is on (Back or Escape pause it too).
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.type = 'button'; this.pauseBtn.className = 'sg-pause hidden'; this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>';
    this.pauseBtn.addEventListener('click', () => this.pause());
    canvas.parentElement?.appendChild(this.pauseBtn);
    this._resize();
    this._menu();
  }

  get best () { try { return JSON.parse(localStorage.getItem(BEST) || '{}'); } catch (_) { return {}; } }
  _setBest (mode, n) { const b = this.best; if (n > (b[mode] || 0)) { b[mode] = n; try { localStorage.setItem(BEST, JSON.stringify(b)); } catch (_) {} return true; } return false; }

  _resize () {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return;
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.scale = Math.max(0.75, Math.min(1.5, Math.min(this.W, this.H) / 420));   // fruit size follows the screen
    this._sprites = null;
    if (this.state !== 'play') this._draw();
  }

  _makeSprites () {
    const k = this.scale * this.dpr;
    this._sprites = FRUITS.map(f => {
      const R = f.r * k, size = R * 2.8;
      return { size, whole: sprite(size, g => drawWhole(g, f, R)), cut: sprite(size, g => drawCut(g, f, R)) };
    });
    const R = 30 * k;
    this._bomb = { size: R * 3.4, img: sprite(R * 3.4, g => drawBomb(g, R)) };
    // the light on a fruit, at 100 pixels across: scaled to each one as it is drawn
    this._shine = sprite(100, g => {
      const sh = g.createRadialGradient(-19, -21, 0, -19, -21, 30);
      sh.addColorStop(0, 'rgba(255,255,255,0.6)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sh; g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.fill();
    });
  }

  // ── menus ────────────────────────────────────────────────────────────
  _panel (html) {
    this.ui.innerHTML = `<div class="sg-panel">${html}</div>`;
    this.ui.classList.remove('hidden');
    return this.ui.firstElementChild;
  }
  _hidePanel () { this.ui.classList.add('hidden'); this.ui.textContent = ''; }

  _menu () {
    this.state = 'menu'; this._stop();
    const b = this.best;
    const p = this._panel(`<div class="sg-title">Fruit Slice</div><p class="sg-sub">Swipe to slice. Three missed fruits, or one bomb, and it is over.</p>
      <div class="sg-btns"><button type="button" class="sg-btn sg-main" data-a="classic">Classic<span>Best ${b.classic || 0}</span></button>
      <button type="button" class="sg-btn" data-a="zen">Zen, 90 seconds<span>No bombs · best ${b.zen || 0}</span></button>
      <button type="button" class="sg-btn sg-ghost" data-a="exit">Back</button></div>`);
    p.addEventListener('click', e => this._act(e.target.closest('[data-a]')?.dataset.a));
    this.objs = []; this.drops = []; this.texts = [];
    this._draw();
  }

  _act (a) {
    if (!a) return;
    if (a === 'classic' || a === 'zen' || a === 'again') this.start(a === 'again' ? this.mode : a);
    else if (a === 'resume') this.resume();
    else if (a === 'menu') this._menu();
    else if (a === 'exit') { this.stop(); this.onExit?.(); }
  }

  start (mode = 'classic') {
    this.mode = mode === 'zen' ? 'zen' : 'classic';
    this._hidePanel();
    this.objs = []; this.drops = []; this.texts = []; this.trails.clear();
    this.score = 0; this.lives = 3; this.elapsed = 0; this.nextWave = 0.6; this.flash = 0; this.shake = 0;
    this.combo = { n: 0, at: 0, x: 0, y: 0 };
    this.timeLeft = this.mode === 'zen' ? 90 : 0;
    this.state = 'play';
    sfx.play('start');
    this._go();
  }

  pause () {
    if (this.state !== 'play') return;
    this.state = 'paused'; this._stop();
    const p = this._panel(`<div class="sg-title">Paused</div><p class="sg-sub">Score ${this.score}</p>
      <div class="sg-btns"><button type="button" class="sg-btn sg-main" data-a="resume">Go on</button><button type="button" class="sg-btn sg-ghost" data-a="menu">Stop</button></div>`);
    p.addEventListener('click', e => this._act(e.target.closest('[data-a]')?.dataset.a));
  }
  resume () { if (this.state !== 'paused') return; this._hidePanel(); this.state = 'play'; this._go(); }
  /** Stops the loop and leaves the game where it is (the home screen is left). */
  stop () { if (this.state === 'play') this.pause(); this._stop(); }

  _over (why) {
    this.state = 'over'; this._stop();
    const best = this._setBest(this.mode, this.score);
    sfx.play('over');
    const p = this._panel(`<div class="sg-title">${why === 'time' ? 'Time!' : why === 'bomb' ? 'Boom!' : 'Game over'}</div>
      <div class="sg-score">${this.score}</div><p class="sg-sub">${best && this.score ? 'A new best!' : 'Best ' + (this.best[this.mode] || 0)}</p>
      <div class="sg-btns"><button type="button" class="sg-btn sg-main" data-a="again">Play again</button><button type="button" class="sg-btn" data-a="menu">Menu</button><button type="button" class="sg-btn sg-ghost" data-a="exit">Back</button></div>`);
    p.addEventListener('click', e => this._act(e.target.closest('[data-a]')?.dataset.a));
    this._draw();
  }

  destroy () {
    this._stop();
    this._ro?.disconnect();
    document.removeEventListener('visibilitychange', this._vis);
    this.canvas.removeEventListener('pointerdown', this._down);
    this.canvas.removeEventListener('pointermove', this._move);
    for (const ev of ['pointerup', 'pointercancel']) this.canvas.removeEventListener(ev, this._up);
    this.pauseBtn?.remove();
  }

  // ── the loop ─────────────────────────────────────────────────────────
  _go () { this._last = performance.now(); this._drawn = 0; this.pauseBtn.classList.remove('hidden'); if (!this.raf) this.raf = requestAnimationFrame(this._loop); }
  _stop () { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.pauseBtn?.classList.add('hidden'); }
  /** Whether a game is under way (playing or paused): Back pauses it, or leaves the menu. */
  get busy () { return this.state === 'play' || this.state === 'boom'; }

  _loop (now) {
    this.raf = requestAnimationFrame(this._loop);
    if (now - this._drawn < frameGap('decor') - 2) return;
    this._drawn = now;
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this._step(dt, now);
    this._draw(now);
  }

  _launch (bomb) {
    const W = this.W, H = this.H, g = this.gravity;
    const x = rand(0.14, 0.86) * W, h = H * rand(0.5, 0.82), vy = -Math.sqrt(2 * g * h), up = -vy / g;
    const vx = (W / 2 - x) / (up * 2) * rand(0.2, 0.9) + rand(-30, 30);
    const type = Math.floor(Math.random() * FRUITS.length);
    const r = (bomb ? 30 : FRUITS[type].r) * this.scale;
    this.objs.push({ kind: bomb ? 'bomb' : 'fruit', type, x, y: H + r, vx, vy, rot: rand(0, 6.28), vr: rand(-3, 3), r, cut: false });
    sfx.play('throw');
  }

  _step (dt, now) {
    const W = this.W, H = this.H;
    this.gravity = 1150 * Math.max(0.8, H / 760);
    const playing = this.state === 'play';
    if (playing) this.elapsed += dt;
    if (playing && this.mode === 'zen') { this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; this._over('time'); return; } }
    // waves, faster and fuller as the game goes on
    if (playing) this.nextWave -= dt;
    if (playing && this.nextWave <= 0) {
      const d = this.elapsed / 90;
      this.nextWave = this.mode === 'zen' ? lerp(1.25, 0.6, d) : lerp(1.75, 0.75, d);
      const n = 1 + Math.floor(Math.random() * (1.6 + d * (this.mode === 'zen' ? 5 : 4)));
      const bombAt = this.mode === 'classic' && this.elapsed > 8 && Math.random() < lerp(0.18, 0.4, d) ? Math.floor(Math.random() * n) : -1;
      for (let i = 0; i < n; i++) setTimeout(() => { if (this.state === 'play') this._launch(i === bombAt && n > 1 ? true : i === bombAt && Math.random() < 0.5); }, i * 140);
    }
    for (const o of this.objs) {
      o.vy += this.gravity * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
      if (o.kind === 'half') o.alpha = Math.max(0, (o.alpha ?? 1) - dt * 0.15);
    }
    // whole fruit that fell back unsliced is missed
    const keep = [];
    for (const o of this.objs) {
      if (o.y > H + o.r * 2.2 && o.vy > 0) {
        if (o.kind === 'fruit' && !o.cut && this.mode === 'classic' && playing) {
          this.lives--; sfx.play('miss');
          this.texts.push({ x: Math.max(30, Math.min(W - 30, o.x)), y: H - 40, text: '✕', color: '#ff5a5a', life: 1, big: true });
          if (this.lives <= 0) { this.objs = keep; this._over('miss'); return; }
        }
        continue;
      }
      keep.push(o);
    }
    this.objs = keep;
    for (const d of this.drops) { d.vy += this.gravity * 0.6 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * 1.6; }
    this.drops = this.drops.filter(d => d.life > 0 && d.y < H + 20);
    for (const t of this.texts) { t.y -= 40 * dt; t.life -= dt * 0.9; }
    this.texts = this.texts.filter(t => t.life > 0);
    // The blade's last point stays while the finger is down (v3.43.0): with a
    // slow frame between two touches, the point a swipe came from was dropped
    // and the swipe cut nothing (the page check's swipe failed now and then).
    for (const [id, tr] of this.trails) { while (tr.length > (tr.down ? 1 : 0) && now - tr[0].t > 150) tr.shift(); if (!tr.length && !tr.down) this.trails.delete(id); }
    // a combo is told once the swipe has gone a moment without a cut
    if (this.combo.n && now - this.combo.at > 280) this._endCombo();
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 3);
  }

  _endCombo () {
    const c = this.combo;
    if (c.n >= 3) {
      this.score += c.n;
      this.texts.push({ x: c.x, y: c.y, text: `${c.n} fruit combo +${c.n}`, color: '#ffe066', life: 1.4 });
      sfx.play('chime');
    }
    this.combo = { n: 0, at: 0, x: 0, y: 0 };
  }

  // ── slicing ──────────────────────────────────────────────────────────
  _pointer (e, kind) {
    const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
    if (kind === 'down') {
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const tr = []; tr.down = true; tr.push({ x, y, t: now }); this.trails.set(e.pointerId, tr);
      return;
    }
    const tr = this.trails.get(e.pointerId);
    if (!tr) return;
    if (kind === 'up') { tr.down = false; return; }
    if (!tr.down) return;
    const p = tr[tr.length - 1] || { x, y, t: now };
    tr.push({ x, y, t: now });
    if (this.state !== 'play') return;
    const len = Math.hypot(x - p.x, y - p.y);
    if (len < 4) return;
    if (len > 26 && now - (tr.swoosh || 0) > 180) { tr.swoosh = now; sfx.play('swoosh'); }
    for (const o of this.objs) {
      if (o.cut || o.kind === 'half') continue;
      if (segDist(p.x, p.y, x, y, o.x, o.y) < o.r * 1.05) this._cut(o, (x - p.x) / len, (y - p.y) / len, now);
      if (this.state !== 'play') return;
    }
  }

  _cut (o, ux, uy, now) {
    o.cut = true;
    this.objs = this.objs.filter(x => x !== o);       // a cut fruit is its two halves from here on
    if (o.kind === 'bomb') {
      this.flash = 1; this.shake = 1; sfx.play('boom');
      this.onJuice?.(o.x / this.W, 1 - o.y / this.H, ux * 2000, -uy * 2000, [1, 0.45, 0.1], 2.4);
      if (this.mode === 'classic') { setTimeout(() => this._over('bomb'), 650); this.state = 'boom'; }
      return;
    }
    const f = FRUITS[o.type], ang = Math.atan2(uy, ux);
    this.score++;
    sfx.play('splat');
    for (const side of [-1, 1]) {
      this.objs.push({ kind: 'half', type: o.type, side, x: o.x + -uy * side * 4, y: o.y + ux * side * 4, vx: o.vx * 0.6 + -uy * side * 120, vy: o.vy * 0.4 + ux * side * 120 - 80,
        rot: ang, vr: side * rand(2, 5), r: o.r, cutAng: ang, alpha: 1 });
    }
    const col = `rgb(${f.juice.map(c => Math.round(c * 255)).join(',')})`;
    for (let i = 0; i < 12; i++) {
      const a = ang + rand(-0.9, 0.9) + (i % 2 ? Math.PI : 0), s = rand(80, 320);
      this.drops.push({ x: o.x, y: o.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, r: rand(2, 5) * this.scale, life: rand(0.6, 1), color: col });
    }
    this.onJuice?.(o.x / this.W, 1 - o.y / this.H, ux * 900, -uy * 900, f.juice, 1);
    const c = this.combo;
    if (c.n && now - c.at > 280) this._endCombo();
    this.combo.n++; this.combo.at = now; this.combo.x = o.x; this.combo.y = o.y - o.r;
  }

  // ── drawing ──────────────────────────────────────────────────────────
  _draw () {
    const g = this.g, d = this.dpr;
    if (!this.W) return;
    if (!this._sprites) this._makeSprites();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.shake) g.translate(rand(-6, 6) * this.shake * d, rand(-6, 6) * this.shake * d);
    // juice drops
    for (const p of this.drops) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.color; g.beginPath(); g.arc(p.x * d, p.y * d, p.r * d, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    for (const o of this.objs) {
      g.save();
      g.translate(o.x * d, o.y * d);
      g.rotate(o.rot);
      if (o.kind === 'bomb') {
        const s = this._bomb; g.drawImage(s.img, -s.size / 2, -s.size / 2);
        // the fuse sparks
        g.fillStyle = Math.random() < 0.5 ? '#fff6a0' : '#ffb300';
        const R = o.r * d; g.beginPath(); g.arc(R * 0.55, -R * 1.3, R * rand(0.08, 0.16), 0, Math.PI * 2); g.fill();
      } else if (o.kind === 'fruit') {
        const s = this._sprites[o.type]; g.drawImage(s.whole, -s.size / 2, -s.size / 2);
        g.rotate(-o.rot);
        const R = o.r * d; g.drawImage(this._shine, -R, -R, R * 2, R * 2);
      } else {
        // a half: the cut fruit's face, clipped to one side of the cut
        const s = this._sprites[o.type], R = o.r * d;
        g.globalAlpha = o.alpha ?? 1;
        g.beginPath(); g.rect(-R * 1.4, o.side < 0 ? -R * 1.4 : 0, R * 2.8, R * 1.4); g.clip();
        g.drawImage(s.cut, -s.size / 2, -s.size / 2);
      }
      g.restore();
    }
    g.globalAlpha = 1;
    // the blades
    for (const tr of this.trails.values()) {
      if (tr.length < 2) continue;
      const n = tr.length;
      for (const [w, col] of [[11, 'rgba(120,200,255,0.28)'], [4.5, 'rgba(255,255,255,0.95)']]) {
        g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
        for (let i = 1; i < n; i++) {
          g.lineWidth = w * d * (i / n);
          g.beginPath(); g.moveTo(tr[i - 1].x * d, tr[i - 1].y * d); g.lineTo(tr[i].x * d, tr[i].y * d); g.stroke();
        }
      }
    }
    // texts
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of this.texts) {
      g.globalAlpha = Math.min(1, t.life * 1.5);
      g.font = `800 ${Math.round((t.big ? 34 : 22) * d)}px Outfit, system-ui, sans-serif`;
      g.lineWidth = 4 * d; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(t.text, t.x * d, t.y * d);
      g.fillStyle = t.color; g.fillText(t.text, t.x * d, t.y * d);
    }
    g.globalAlpha = 1;
    if (this.state === 'play' || this.state === 'paused' || this.state === 'boom' || this.state === 'over') this._hud();
    if (this.flash) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(255,248,230,${this.flash})`; g.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  }

  _hud () {
    const g = this.g, d = this.dpr, pad = 18 * d;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.font = `800 ${Math.round(34 * d)}px Outfit, system-ui, sans-serif`;
    g.lineWidth = 5 * d; g.strokeStyle = 'rgba(0,0,0,0.45)';
    const top = (this.hudTop || 0) * d;
    g.strokeText(String(this.score), pad, pad + top); g.fillStyle = '#ffe9a8'; g.fillText(String(this.score), pad, pad + top);
    g.font = `600 ${Math.round(13 * d)}px Outfit, system-ui, sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText(`BEST ${Math.max(this.best[this.mode] || 0, this.score)}`, pad + 2 * d, pad + top + 40 * d);
    g.textAlign = 'right';
    if (this.mode === 'zen') {
      const t = Math.ceil(this.timeLeft), txt = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      g.font = `800 ${Math.round(28 * d)}px Outfit, system-ui, sans-serif`;
      g.strokeText(txt, this.canvas.width - pad, pad + top); g.fillStyle = t <= 10 ? '#ff7b7b' : '#ffffff'; g.fillText(txt, this.canvas.width - pad, pad + top);
    } else {
      g.font = `900 ${Math.round(26 * d)}px system-ui, sans-serif`;
      for (let i = 0; i < 3; i++) {
        const lost = i >= this.lives;
        g.fillStyle = lost ? '#ff4d4d' : 'rgba(255,255,255,0.35)';
        g.fillText('✕', this.canvas.width - pad - i * 30 * d, pad + top);
      }
    }
  }
}

/** The distance from point (px, py) to the segment from (ax, ay) to (bx, by). */
function segDist (ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
