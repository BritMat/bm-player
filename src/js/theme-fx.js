/**
 * BM Player — Theme FX Engine v2.2.0 Enhanced
 *
 * Universal fluid simulation with per-theme color palettes, enhanced curl
 * noise (3-octave FBM), mouse trail ripples, particle connections,
 * smooth color bleeding, crossfade theme transitions.
 *
 * Modes:
 *   'fluid' — universal particle fluid for ALL themes (new default)
 *   'blood' — dripping blood strands for Dracula theme
 *   'off'   — nothing rendered
 *
 * Performance: particle counts, connections, ripple limits, and visual
 * richness all scale with perf.js quality tiers (low/medium/high).
 * Sprite pre-rendering (drawImage blits) keeps per-frame cost minimal.
 *
 * v2.2.0 Enhancements:
 * - Added palettes for: cyberpunk, forest, lavender, golden, ocean, sakura, midnight
 * - Enhanced particle behavior for new themes
 * - Better crossfade transitions
 */

import { perf } from './perf.js';

/* ─── Color palettes — one per theme ─────────────────────────────── */
const THEME_PALETTES = {
  dark:     [[91,111,248],[0,212,255],[130,80,255],[60,180,255],[100,140,255]],
  light:    [[71,87,227],[0,152,207],[100,60,200],[50,130,220],[80,120,255]],
  glass:    [[141,123,255],[67,224,255],[200,100,255],[100,200,255],[180,140,255]],
  dracula:  [[255,77,109],[189,92,255],[255,50,80],[220,60,180],[255,100,150]],
  northern: [[34,232,168],[58,168,255],[147,51,255],[29,233,182],[0,210,130],[100,180,255],[80,220,210]],
  ocean:    [[26,143,204],[0,200,255],[80,180,220],[30,120,200],[100,210,255],[60,160,240]],
  snow:     [[143,208,255],[207,233,255],[120,170,240],[180,220,255],[100,150,230],[220,240,255]],
  sunset:   [[255,107,53],[255,180,50],[255,80,100],[255,140,60],[220,60,40],[255,200,80]],
  sakura:   [[245,160,192],[255,130,180],[220,100,160],[255,180,200],[200,80,140],[255,160,190]],
  midnight: [[74,95,207],[100,120,255],[60,80,180],[120,140,255],[80,100,220],[140,160,255]],
  // v2.2.0 New themes
  cyberpunk:[[255,0,128],[0,255,255],[255,50,150],[100,200,255],[255,100,200]],
  forest:   [[80,200,120],[152,216,90],[50,180,80],[100,220,120],[60,160,100]],
  lavender: [[180,140,255],[255,128,191],[200,100,240],[230,150,255],[170,120,235]],
  golden:   [[220,180,80],[240,160,48],[200,160,60],[255,200,100],[180,150,70]],
};

/* ─── Tuning constants ──────────────────────────────────────────── */
const SPRITE_SIZE      = 64;
const CONNECTION_DIST  = 110;   // px — max distance for connection lines
const GRID_CELL        = 120;   // spatial hash cell size for connection checks
const CROSSFADE_FRAMES = 60;

const TIER_CONFIG = {
  low:    { particles: 120, maxRipples: 5,  connections: false },
  medium: { particles: 300, maxRipples: 15, connections: false },
  high:   { particles: 600, maxRipples: 30, connections: true  },
};

export class ThemeFX {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas?.getContext('2d');
    this.mode    = 'off';
    this.running = false;
    this.raf     = null;
    this.tick    = 0;

    // Current palette state
    this._paletteName  = 'northern';
    this._palette      = THEME_PALETTES.northern;
    this._sprites      = [];
    this._oldSprites   = null;
    this._crossfade    = 0;       // remaining crossfade frames (0 = none)

    // Mouse / touch tracking
    this.mouse   = { x: -9999, y: -9999 };
    this._mvx    = 0; this._mvy = 0;
    this._lmx    = -9999; this._lmy = -9999;
    this._lastRippleTick = 0;

    // Particle pools
    this.dyes     = [];
    this.ripples  = [];

    // Blood mode pools
    this.drips    = [];
    this.droplets = [];

    // Spatial hash for particle connections
    this._grid = null;

    // Perf
    this._params = perf.getParams();
    this._tierCfg = TIER_CONFIG[perf.tier] || TIER_CONFIG.medium;

    if (!this.canvas) return;

    // Build initial sprites for the default palette
    this._buildSprites(this._palette);
    this._resize();

    // Event listeners
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });

    // Click / touch for burst ripple
    this._boundClick = (e) => this._onClick(e);
    this._boundTouch = (e) => this._onTouchStart(e);
    canvas.addEventListener('click',      this._boundClick);
    canvas.addEventListener('touchstart', this._boundTouch, { passive: true });

    // React to quality tier changes
    perf.onChange(p => {
      this._params  = p;
      this._tierCfg = TIER_CONFIG[perf.tier] || TIER_CONFIG.medium;
      if (this.mode === 'fluid') this._resizeDyes();
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SPRITE PRE-RENDERING
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Pre-render one radial-gradient sprite per palette colour.
   * @param {number[][]} palette — array of [r, g, b] arrays
   * @returns {HTMLCanvasElement[]}
   */
  _buildSprites(palette) {
    return palette.map(([r, g, b]) => {
      const off = document.createElement('canvas');
      off.width = SPRITE_SIZE; off.height = SPRITE_SIZE;
      const octx = off.getContext('2d');
      const half = SPRITE_SIZE / 2;
      const grad = octx.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0,    `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.55, `rgba(${r},${g},${b},0.4)`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      octx.fillStyle = grad;
      octx.beginPath(); octx.arc(half, half, half, 0, Math.PI * 2); octx.fill();
      return off;
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Switch rendering mode.
   * @param {'fluid'|'blood'|'snow'|'off'} m
   */
  setMode(m) {
    if (this.mode === m) return;
    this.mode = m;
    this.stop();
    if (m === 'fluid') { this._initFluid(); this.start(); }
    if (m === 'blood') { this._initBlood(); this.start(); }
    if (m === 'snow')  { this._initSnow();  this.start(); }
    if (m === 'off')   { this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  }

  /**
   * Switch the fluid colour palette. Triggers a smooth crossfade.
   * @param {string} themeName — key in THEME_PALETTES
   */
  setPalette(themeName) {
    const pal = THEME_PALETTES[themeName];
    if (!pal || pal === this._palette) return;

    // Start crossfade: keep old sprites, build new ones
    this._oldSprites = this._sprites;
    this._sprites    = this._buildSprites(pal);
    this._crossfade  = CROSSFADE_FRAMES;

    this._paletteName = themeName;
    this._palette     = pal;
  }

  start()  { if (this.running || this.mode === 'off' || !this.canvas) return; this.running = true;  this._loop(); }
  stop()   { this.running = false; cancelAnimationFrame(this.raf); this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  pause()  { this.running = false; cancelAnimationFrame(this.raf); }
  resume() { if (this.mode === 'off' || !this.canvas || this.running) return; this.running = true; this._loop(); }

  /* ═══════════════════════════════════════════════════════════════
     INTERNAL — RESIZE / INIT
     ═══════════════════════════════════════════════════════════════ */

  /** Where the pointer is, in canvas pixels. Snowflakes swirl away from it. */
  pointer(x, y) {
    // clientX/Y are window coordinates; the canvas sits inside the welcome
    // area, below the title bar and beside the sidebar.
    const r = this.canvas?.getBoundingClientRect();
    this._px = x - (r ? r.left : 0); this._py = y - (r ? r.top : 0); this._pAt = performance.now();
  }

  /* ── Snow (v3.21.0) ────────────────────────────────────────────────
     Flakes at different depths: near ones are bigger, brighter and faster.
     A gusting wind and each flake's own sway move them sideways, and while
     the pointer moves it clears a soft circle, pushing flakes outwards. */
  _initSnow() {
    if (!this.canvas) return;
    const W = this.canvas.width, H = this.canvas.height;
    this._snowSlow = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const n = Math.round(Math.min(240, Math.max(70, W * H / 9000)) * (this._snowSlow ? 0.5 : 1));
    this._flakes = Array.from({ length: n }, () => this._newFlake(W, H, true));
    if (!this._flakeSprite) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(235,245,255,.85)'); grad.addColorStop(1, 'rgba(220,235,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
      this._flakeSprite = c;
    }
  }
  _newFlake(W, H, anywhere) {
    const depth = Math.random();
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : -8 - Math.random() * 40,
             r: 0.8 + depth * 2.6, vy: (0.35 + depth * 1.05) * (this._snowSlow ? 0.5 : 1), vx: 0,
             sway: Math.random() * Math.PI * 2, a: 0.30 + depth * 0.55 };
  }
  _drawSnow() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, t = this.tick;
    if (!ctx || !this._flakes) return;
    ctx.clearRect(0, 0, W, H);
    const wind = Math.sin(t * 0.004) * 0.35 + Math.sin(t * 0.0013 + 1.7) * 0.25;
    const live = this._pAt && performance.now() - this._pAt < 1200, R = 110;
    for (const f of this._flakes) {
      f.sway += 0.012 + f.r * 0.002;
      let ax = wind * (f.r / 3) + Math.sin(f.sway) * 0.18;
      if (live) {
        const dx = f.x - this._px, dy = f.y - this._py, d2 = dx * dx + dy * dy;
        if (d2 < R * R && d2 > 1) { const d = Math.sqrt(d2), k = (1 - d / R) * 2.2; ax += dx / d * k; f.y += dy / d * k * 0.5; }
      }
      f.vx += (ax - f.vx) * 0.08;
      f.x += f.vx; f.y += f.vy;
      if (f.y > H + 8) Object.assign(f, this._newFlake(W, H, false));
      if (f.x < -8) f.x = W + 8; else if (f.x > W + 8) f.x = -8;
      ctx.globalAlpha = f.a;
      ctx.drawImage(this._flakeSprite, f.x - f.r * 2, f.y - f.r * 2, f.r * 4, f.r * 4);
    }
    ctx.globalAlpha = 1;
  }

  _resize() {
    if (!this.canvas) return;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width  = Math.max(1, r.width  || this.canvas.offsetWidth  || window.innerWidth);
    this.canvas.height = Math.max(1, r.height || this.canvas.offsetHeight || window.innerHeight);
    if (this.mode === 'blood')  this._initBlood();
    if (this.mode === 'fluid') this._initFluid();
    if (this.mode === 'snow')  this._initSnow();
  }

  /* ═══════════════════════════════════════════════════════════════
     MAIN LOOP
     ═══════════════════════════════════════════════════════════════ */

  _loop() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this._loop());
    this.tick++;

    // Advance crossfade
    if (this._crossfade > 0) {
      this._crossfade--;
      if (this._crossfade <= 0) this._oldSprites = null;
    }

    if (this.mode === 'blood')  this._drawBlood();
    if (this.mode === 'fluid') this._drawFluid();
    if (this.mode === 'snow')  this._drawSnow();
  }

  /* ═══════════════════════════════════════════════════════════════
     FLUID SIM — UNIVERSAL MODE
     ═══════════════════════════════════════════════════════════════ */

  _initFluid() {
    const W = this.canvas.width, H = this.canvas.height;
    const count = this._tierCfg.particles;
    this.dyes    = Array.from({ length: count }, (_, i) => this._newDye(i, W, H));
    this.ripples = [];
    this._mvx = 0; this._mvy = 0;
    this._lmx = -9999; this._lmy = -9999;
    this._lastRippleTick = 0;
  }

  _newDye(i, W, H) {
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: 0, vy: 0,
      colorIdx:   i % this._palette.length,
      colorFloat: i % this._palette.length,
      alpha: .32 + Math.random() * .38,
      size:  6 + Math.random() * 16,
      phase: Math.random() * Math.PI * 2,
    };
  }

  /** Grow / shrink the particle pool without full reset. */
  _resizeDyes() {
    const target = this._tierCfg.particles;
    const W = this.canvas.width, H = this.canvas.height;
    if (this.dyes.length < target) {
      for (let i = this.dyes.length; i < target; i++) this.dyes.push(this._newDye(i, W, H));
    } else if (this.dyes.length > target) {
      this.dyes.length = target;
    }
  }

  /* ─── Enhanced 3-octave curl noise with FBM ─────────────────── */

  /**
   * Multi-octave noise function. Three octaves of sine-based noise
   * with increasing frequency and halving amplitude (FBM).
   */
  _noise(x, y, t) {
    let val = 0, amp = 1, totalAmp = 0;
    for (let o = 0; o < 3; o++) {
      const f = 1 + o * 1.7;
      const tOff = o * 0.2;
      val += amp * (
        Math.sin(x * 0.006 * f + t * (0.6 + tOff)) *
        Math.cos(y * 0.007 * f - t * (0.5 + tOff * 0.8))
        + Math.sin((x + y) * 0.004 * f - t * (0.35 + tOff * 0.6)) * 0.6
        + Math.cos(x * 0.011 * f - y * 0.009 * f + t * (0.8 + tOff)) * 0.4
      );
      totalAmp += amp;
      amp *= 0.5;
    }
    return val / totalAmp;
  }

  /** Curl of the noise field — produces divergence-free flow. */
  _curl(x, y, t) {
    const e = 2;
    const n1 = this._noise(x, y + e, t), n2 = this._noise(x, y - e, t);
    const n3 = this._noise(x + e, y, t), n4 = this._noise(x - e, y, t);
    return { x: (n1 - n2) / (2 * e), y: -(n3 - n4) / (2 * e) };
  }

  /* ─── Spatial hash for O(n) neighbour lookup ────────────────── */

  _buildSpatialGrid() {
    const grid = Object.create(null);
    for (let i = 0; i < this.dyes.length; i++) {
      const d = this.dyes[i];
      const cx = (d.x / GRID_CELL) | 0;
      const cy = (d.y / GRID_CELL) | 0;
      const key = cx + ',' + cy;
      (grid[key] || (grid[key] = [])).push(i);
    }
    this._grid = grid;
  }

  _drawConnections(ctx) {
    if (!this._tierCfg.connections || !this._grid) return;

    const palLen   = this._palette.length;
    const drawn    = new Set();
    ctx.lineWidth  = 0.6;

    for (let i = 0; i < this.dyes.length; i++) {
      const a = this.dyes[i];
      const cx = (a.x / GRID_CELL) | 0;
      const cy = (a.y / GRID_CELL) | 0;

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = (cx + dx) + ',' + (cy + dy);
          const cell = this._grid[key];
          if (!cell) continue;
          for (let k = 0; k < cell.length; k++) {
            const j = cell[k];
            if (j <= i) continue;
            const pairKey = i < j ? i * 100000 + j : j * 100000 + i;
            if (drawn.has(pairKey)) continue;

            const b = this.dyes[j];
            const ddx = a.x - b.x, ddy = a.y - b.y;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist < CONNECTION_DIST) {
              drawn.add(pairKey);
              const opacity = (1 - dist / CONNECTION_DIST) * 0.12;
              const c = this._palette[a.colorIdx % palLen];
              ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${opacity.toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  /* ─── Ripple system ─────────────────────────────────────────── */

  /**
   * Add a ripple at (x, y).
   * @param {number} x
   * @param {number} y
   * @param {boolean} burst — if true, large burst that pushes particles
   */
  _addRipple(x, y, burst = false) {
    if (this.ripples.length >= this._tierCfg.maxRipples) {
      this.ripples.shift();
    }
    this.ripples.push({
      x, y,
      radius:    burst ? 5 : 2,
      maxRadius: burst ? 200 + Math.random() * 100 : 40 + Math.random() * 30,
      opacity:   burst ? 0.6 : 0.25,
      speed:     burst ? 4 + Math.random() * 2 : 1.2 + Math.random() * 0.8,
      burst,     // flag for particle push
      pushed:    false,
    });
  }

  _updateAndDrawRipples(ctx) {
    const W = this.canvas.width, H = this.canvas.height;

    this.ripples = this.ripples.filter(r => {
      r.radius += r.speed;
      r.opacity *= 0.965;
      if (r.opacity < 0.005 || r.radius > r.maxRadius) return false;

      const c = this._palette[0];
      ctx.globalAlpha = r.opacity;
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},1)`;
      ctx.lineWidth   = r.burst ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (r.burst && !r.pushed) {
        r.pushed = true;
        for (const d of this.dyes) {
          const dx = d.x - r.x, dy = d.y - r.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < r.maxRadius && dist > 1) {
            const force = (1 - dist / r.maxRadius) * 8;
            d.vx += (dx / dist) * force;
            d.vy += (dy / dist) * force;
          }
        }
      }
      return true;
    });
    ctx.globalAlpha = 1;
  }

  /* ─── Click / touch handlers ────────────────────────────────── */

  _onClick(e) {
    if (this.mode !== 'fluid' || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    this._addRipple(x, y, true);
  }

  _onTouchStart(e) {
    if (this.mode !== 'fluid' || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    for (const touch of e.touches) {
      const x = touch.clientX - rect.left, y = touch.clientY - rect.top;
      this._addRipple(x, y, true);
    }
  }

  /* ─── Main fluid draw ───────────────────────────────────────── */

  _drawFluid() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const P = this._params;
    const t = this.tick * 0.006 * P.speedScale;
    const palLen = this._palette.length;

    // Trail fade
    ctx.globalCompositeOperation = 'destination-out';
    const fadeAlpha = 0.035 / Math.max(0.5, P.trail);
    ctx.fillStyle = `rgba(0,0,0,${fadeAlpha.toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);

    // Mouse tracking
    const rect = canvas.getBoundingClientRect();
    const mx = this.mouse.x - rect.left, my = this.mouse.y - rect.top;
    const dmx = mx - this._lmx, dmy = my - this._lmy;
    this._mvx = dmx * 0.6 + this._mvx * 0.4;
    this._mvy = dmy * 0.6 + this._mvy * 0.4;
    this._lmx = mx; this._lmy = my;
    const spd = Math.sqrt(this._mvx * this._mvx + this._mvy * this._mvy);
    const cursorActive = mx > -50 && mx < W + 50 && my > -50 && my < H + 50;

    // Add mouse trail ripple periodically
    if (cursorActive && spd > 2 && this.tick - this._lastRippleTick > 4) {
      this._addRipple(mx, my, false);
      this._lastRippleTick = this.tick;
    }

    // Build spatial hash for connections (once per frame)
    if (this._tierCfg.connections) this._buildSpatialGrid();

    // Draw ripples
    ctx.globalCompositeOperation = 'source-over';
    this._updateAndDrawRipples(ctx);

    // Particle connections
    if (this._tierCfg.connections) {
      ctx.globalCompositeOperation = 'lighter';
      this._drawConnections(ctx);
    }

    // Draw particles
    ctx.globalCompositeOperation = 'screen';
    
    // Safety check: ensure sprites are initialized
    if (!this._sprites || !this._sprites.length) return;
    
    const CURSOR_RADIUS = 220;
    const crossfadeOld  = this._crossfade > 0 && this._oldSprites ? this._crossfade / CROSSFADE_FRAMES : 0;
    const crossfadeNew  = 1 - crossfadeOld;

    for (const d of this.dyes) {
      const flow = this._curl(d.x, d.y, t);
      d.vx += flow.x * 0.16 * P.speedScale;
      d.vy += flow.y * 0.16 * P.speedScale;

      // Cursor influence
      if (cursorActive) {
        const dx = d.x - mx, dy = d.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CURSOR_RADIUS && dist > 0.5) {
          const force = Math.pow((CURSOR_RADIUS - dist) / CURSOR_RADIUS, 1.6);
          const boosted = this._curl(d.x, d.y, t + 4);
          d.vx += boosted.x * force * (0.55 + spd * 0.02) * P.speedScale;
          d.vy += boosted.y * force * (0.55 + spd * 0.02) * P.speedScale;
        }
      }

      d.vx *= 0.94; d.vy *= 0.94;
      d.x  += d.vx;  d.y  += d.vy;

      // Wrap around edges
      if (d.x < -40) d.x = W + 40;
      if (d.x > W + 40) d.x = -40;
      if (d.y < -40) d.y = H + 40;
      if (d.y > H + 40) d.y = -40;

      // Smooth color bleeding
      d.colorFloat += 0.001 * P.speedScale;
      d.colorIdx = Math.floor(d.colorFloat) % palLen;

      // Pulsing size & alpha
      const s = d.size * (0.85 + Math.sin(t * 2 + d.phase) * 0.2) * P.glow;
      const a = d.alpha * (0.75 + Math.sin(t * 2.4 + d.phase) * 0.25);

      // Crossfade
      if (crossfadeOld > 0 && this._oldSprites && this._oldSprites.length) {
        const oldLen = this._oldSprites.length;
        const oldIdx = d.colorIdx % oldLen;
        const oldSprite = this._oldSprites[oldIdx];
        if (oldSprite) {
          ctx.globalAlpha = Math.max(0, Math.min(1, a * crossfadeOld));
          ctx.drawImage(oldSprite, d.x - s, d.y - s, s * 2, s * 2);
        }
      }

      ctx.globalAlpha = Math.max(0, Math.min(1, a * crossfadeNew));
      const sprite = this._sprites[d.colorIdx % this._sprites.length];
      if (sprite) {
        ctx.drawImage(sprite, d.x - s, d.y - s, s * 2, s * 2);
      }
    }

    // Mouse glow
    if (spd > 3 && mx > 0 && mx < W && my > 0 && my < H) {
      const idx = this.tick % palLen;
      const mouseSprite = this._sprites[idx % this._sprites.length];
      if (mouseSprite) {
        const sr  = Math.min(14 + spd * 2.2, 60) * P.glow;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(mouseSprite, mx - sr, my - sr, sr * 2, sr * 2);
      }
    }

    // Persistent cursor glow
    if (mx > 0 && mx < W && my > 0 && my < H) {
      const pulse = 0.55 + Math.sin(this.tick * 0.06) * 0.15 + Math.min(spd * 0.02, 0.25);
      const cr = (26 + Math.sin(this.tick * 0.05) * 4) * P.glow;
      const c  = this._palette[0];
      const cg = ctx.createRadialGradient(mx, my, 0, mx, my, cr);
      cg.addColorStop(0,   `rgba(${c[0]},${c[1]},${c[2]},${(pulse * 0.9).toFixed(2)})`);
      cg.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${(pulse * 0.5).toFixed(2)})`);
      cg.addColorStop(1,   `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(mx, my, cr, 0, Math.PI * 2); ctx.fill();
      // White dot center
      ctx.globalAlpha = 0.7 + pulse * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath(); ctx.arc(mx, my, 2.4, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ═══════════════════════════════════════════════════════════════
     BLOOD MODE — kept from v1 for Dracula theme
     ═══════════════════════════════════════════════════════════════ */

  _initBlood() {
    const W = this.canvas.width;
    const scale = this._tierCfg.particles < 180 ? 0.6 : 1;
    const n = Math.max(8, Math.floor((W / 58) * scale));
    this.drips    = Array.from({ length: n }, () => this._newDrip());
    this.droplets = [];
  }

  _newDrip() {
    return {
      x: 10 + Math.random() * (this.canvas.width - 20),
      len: -(50 + Math.random() * 280),
      maxLen: 60 + Math.random() * 240,
      speed: 0.28 + Math.random() * 0.8,
      width: 1.8 + Math.random() * 2.3,
    };
  }

  _drawBlood() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const d of this.drips) {
      d.len += d.speed;
      if (d.len > d.maxLen) {
        this.droplets.push({ x: d.x, y: d.maxLen, vy: 0.8 + Math.random() * 1.5, r: d.width * 0.95 });
        Object.assign(d, this._newDrip()); d.len = -(30 + Math.random() * 180);
      }
      if (d.len <= 0) continue;
      const g = ctx.createLinearGradient(d.x, 0, d.x, d.len);
      g.addColorStop(0,   'rgba(90,0,8,.85)');
      g.addColorStop(0.6, 'rgba(170,10,22,.95)');
      g.addColorStop(1,   'rgba(205,14,28,1)');
      ctx.strokeStyle = g; ctx.lineWidth = d.width; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(d.x, 0); ctx.lineTo(d.x, d.len); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = 'rgba(205,14,28,1)';
      ctx.ellipse(d.x, d.len, d.width * 0.95, d.width * 1.55, 0, 0, Math.PI * 2); ctx.fill();
    }

    this.droplets = this.droplets.filter(p => {
      p.vy += 0.14; p.y += p.vy;
      ctx.beginPath(); ctx.fillStyle = 'rgba(190,12,28,.9)';
      ctx.ellipse(p.x, p.y, p.r * 0.7, p.r * 1.3, 0, 0, Math.PI * 2); ctx.fill();
      return p.y < canvas.height + 20;
    });
  }
}
