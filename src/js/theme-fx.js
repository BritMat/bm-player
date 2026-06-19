/**
 * BM Player — Theme FX Engine  (v1.4)
 *
 * Drives two living welcome-screen canvases:
 *   blood  (Dracula)  — dripping strands from the top edge, each releasing a
 *                       falling droplet on a continuous loop
 *   aurora (Northern) — mouse-reactive starfield with drifting aurora blobs
 *                       underneath (replaces the fox entirely for that theme)
 *
 * No external deps — pure Canvas 2D API.
 */
export class ThemeFX {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas?.getContext('2d');
    this.mode    = 'off';
    this.running = false;
    this.raf     = null;
    this.tick    = 0;
    this.mouse   = { x: -9999, y: -9999 };

    this.drips    = [];
    this.droplets = [];
    this.stars    = [];
    this.blobs    = [];

    if (!this.canvas) return;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
  }

  _resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = Math.max(1, rect.width  || this.canvas.offsetWidth  || window.innerWidth);
    this.canvas.height = Math.max(1, rect.height || this.canvas.offsetHeight || window.innerHeight);
    if (this.mode === 'blood')  this._initBlood();
    if (this.mode === 'aurora') this._initAurora();
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.stop();
    if (mode === 'blood')  { this._initBlood();  this.start(); }
    if (mode === 'aurora') { this._initAurora(); this.start(); }
    if (mode === 'off') this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  start() {
    if (this.running || this.mode === 'off' || !this.canvas) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _loop() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this._loop());
    this.tick++;
    if (this.mode === 'blood')  this._drawBlood();
    if (this.mode === 'aurora') this._drawAurora();
  }

  // ══════════════════════════════════════════════════════════
  //  BLOOD  (Dracula)
  // ══════════════════════════════════════════════════════════
  _initBlood() {
    const W = this.canvas.width;
    const count = Math.max(14, Math.floor(W / 60));
    this.drips = Array.from({ length: count }, () => this._newDrip());
    this.droplets = [];
  }

  _newDrip() {
    return {
      x:      10 + Math.random() * (this.canvas.width - 20),
      len:    -(50 + Math.random() * 280),   // negative = staggered start delay
      maxLen: 60 + Math.random() * 250,
      speed:  0.30 + Math.random() * 0.80,
      width:  1.8 + Math.random() * 2.2,
    };
  }

  _drawBlood() {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    ctx.clearRect(0, 0, W, H);

    // ── strands ──
    this.drips.forEach(d => {
      d.len += d.speed;
      if (d.len > d.maxLen) {
        // release a falling droplet when the strand reaches full extension
        this.droplets.push({
          x: d.x + (Math.random() - 0.5) * 2,
          y: d.maxLen,
          vy: 0.8 + Math.random() * 1.4,
          r:  d.width * 0.95,
        });
        // reset this drip
        Object.assign(d, this._newDrip());
        d.len = -(30 + Math.random() * 180);
      }
      if (d.len <= 0) return;

      const grad = ctx.createLinearGradient(d.x, 0, d.x, d.len);
      grad.addColorStop(0,   'rgba(95, 0, 8, 0.85)');
      grad.addColorStop(0.6, 'rgba(175, 10, 22, 0.95)');
      grad.addColorStop(1,   'rgba(210, 15, 30, 1.0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth   = d.width;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(d.x, 0);
      ctx.lineTo(d.x, d.len);
      ctx.stroke();

      // bulging tip
      ctx.beginPath();
      ctx.fillStyle = 'rgba(210, 15, 30, 1.0)';
      ctx.ellipse(d.x, d.len, d.width * 0.95, d.width * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── falling droplets ──
    this.droplets = this.droplets.filter(p => {
      p.vy += 0.14;
      p.y  += p.vy;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(195, 12, 28, 0.92)';
      ctx.ellipse(p.x, p.y, p.r * 0.7, p.r * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      return p.y < H + 20;
    });
  }

  // ══════════════════════════════════════════════════════════
  //  AURORA STARFIELD  (Northern Lights)
  // ══════════════════════════════════════════════════════════
  _initAurora() {
    const W = this.canvas.width, H = this.canvas.height;
    const count = Math.min(260, Math.max(60, Math.floor((W * H) / 3800)));

    this.stars = Array.from({ length: count }, () => {
      const bx = Math.random() * W, by = Math.random() * H;
      return {
        bx, by, x: bx, y: by,                   // current pos tracks toward base
        r: 0.55 + Math.random() * 1.9,
        tw: Math.random() * Math.PI * 2,          // twinkle phase
        twSpeed: 0.011 + Math.random() * 0.028,
        hue: 148 + Math.random() * 95,            // green → blue-green → cyan
        speed: 0.04 + Math.random() * 0.04,       // lerp speed toward base
      };
    });

    // 4 aurora blob drifters (background atmospheric glow)
    this.blobs = [
      { x: W * 0.18, y: H * 0.28, r: 160, hue: 148, phase: 0.0 },
      { x: W * 0.55, y: H * 0.18, r: 210, hue: 175, phase: 1.2 },
      { x: W * 0.78, y: H * 0.40, r: 145, hue: 195, phase: 2.5 },
      { x: W * 0.35, y: H * 0.60, r: 130, hue: 165, phase: 3.8 },
    ];
  }

  _drawAurora() {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    ctx.clearRect(0, 0, W, H);

    const t = this.tick * 0.009;

    // ── drifting aurora blobs (deepest layer) ──
    this.blobs.forEach(b => {
      const bx = b.x + Math.sin(t + b.phase)       * 70;
      const by = b.y + Math.cos(t * 0.75 + b.phase) * 45;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
      grad.addColorStop(0, `hsla(${b.hue}, 90%, 55%, 0.13)`);
      grad.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── mouse-reactive stars ──
    const rect  = canvas.getBoundingClientRect();
    const mx    = this.mouse.x - rect.left;
    const my    = this.mouse.y - rect.top;
    const REPEL = 155;   // repulsion radius in px
    const PUSH  = 36;    // max displacement

    ctx.save();
    this.stars.forEach(s => {
      // Compute repulsion from cursor
      const dx   = s.bx - mx;
      const dy   = s.bx - my;    // intentional — gives fluid-sim swirl
      const dist = Math.sqrt(dx * dx + dy * dy);
      let tx = s.bx, ty = s.by;

      if (dist < REPEL && dist > 0.5) {
        const force = (REPEL - dist) / REPEL;
        // nudge away + slight tangential swirl for a fluid feel
        const nx = dx / dist, ny = (s.by - my) / (dist || 1);
        tx = s.bx + nx * force * PUSH + ny * force * 8;
        ty = s.by + ny * force * PUSH - nx * force * 8;
      }

      // Smoothly lerp toward target
      s.x += (tx - s.x) * s.speed;
      s.y += (ty - s.y) * s.speed;

      // Twinkle
      s.tw += s.twSpeed;
      const alpha = Math.max(0.12, 0.4 + Math.sin(s.tw) * 0.38);

      ctx.beginPath();
      ctx.fillStyle   = `hsla(${s.hue}, 92%, 78%, ${alpha})`;
      ctx.shadowColor = `hsla(${s.hue}, 92%, 68%, 0.85)`;
      ctx.shadowBlur  = s.r * 3.5;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
