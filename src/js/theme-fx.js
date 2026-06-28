/**
 * BM Player — Theme FX Engine
 * blood (Dracula): dripping strands from top + falling droplets
 * aurora (Northern): full-canvas fluid sim — curl forces, screen blending,
 *   fast-mouse color splats — both sides respond like the Android fluid app
 */
export class ThemeFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas?.getContext('2d');
    this.mode   = 'off';
    this.running= false;
    this.raf    = null;
    this.tick   = 0;
    this.mouse  = { x: -9999, y: -9999 };
    this.drips  = []; this.droplets = []; this.dyes = [];
    this._mvx = 0; this._mvy = 0; this._lmx = -9999; this._lmy = -9999;
    if (!this.canvas) return;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
  }
  _resize() {
    if (!this.canvas) return;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width  = Math.max(1, r.width  || this.canvas.offsetWidth  || window.innerWidth);
    this.canvas.height = Math.max(1, r.height || this.canvas.offsetHeight || window.innerHeight);
    if (this.mode === 'blood')  this._initBlood();
    if (this.mode === 'aurora') this._initAurora();
  }
  setMode(m) {
    if (this.mode === m) return;
    this.mode = m; this.stop();
    if (m === 'blood')  { this._initBlood();  this.start(); }
    if (m === 'aurora') { this._initAurora(); this.start(); }
    if (m === 'off') this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  start() { if (this.running || this.mode === 'off' || !this.canvas) return; this.running = true; this._loop(); }
  stop()  { this.running = false; cancelAnimationFrame(this.raf); this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  _loop() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this._loop());
    this.tick++;
    if (this.mode === 'blood')  this._drawBlood();
    if (this.mode === 'aurora') this._drawAurora();
  }

  /* ── BLOOD ── */
  _initBlood() {
    const W = this.canvas.width;
    const n = Math.max(14, Math.floor(W / 58));
    this.drips = Array.from({length: n}, () => this._newDrip());
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
    this.drips.forEach(d => {
      d.len += d.speed;
      if (d.len > d.maxLen) {
        this.droplets.push({ x: d.x, y: d.maxLen, vy: 0.8 + Math.random() * 1.5, r: d.width * .95 });
        Object.assign(d, this._newDrip()); d.len = -(30 + Math.random() * 180);
      }
      if (d.len <= 0) return;
      const g = ctx.createLinearGradient(d.x, 0, d.x, d.len);
      g.addColorStop(0, 'rgba(90,0,8,.85)'); g.addColorStop(0.6, 'rgba(170,10,22,.95)'); g.addColorStop(1, 'rgba(205,14,28,1)');
      ctx.strokeStyle = g; ctx.lineWidth = d.width; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(d.x, 0); ctx.lineTo(d.x, d.len); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = 'rgba(205,14,28,1)';
      ctx.ellipse(d.x, d.len, d.width * .95, d.width * 1.55, 0, 0, Math.PI * 2); ctx.fill();
    });
    this.droplets = this.droplets.filter(p => {
      p.vy += 0.14; p.y += p.vy;
      ctx.beginPath(); ctx.fillStyle = 'rgba(190,12,28,.9)';
      ctx.ellipse(p.x, p.y, p.r * .7, p.r * 1.3, 0, 0, Math.PI * 2); ctx.fill();
      return p.y < canvas.height + 20;
    });
  }

  /* ── AURORA FLUID SIM ── */
  _initAurora() {
    const W = this.canvas.width, H = this.canvas.height;
    const PAL = [[34,232,168],[58,168,255],[147,51,255],[29,233,182],[0,210,130],[100,180,255]];
    this.dyes = Array.from({length: 240}, (_, i) => {
      const [r, g, b] = PAL[i % PAL.length];
      return {
        x: Math.random()*W, y: Math.random()*H,
        vx: (Math.random()-.5)*.4, vy: (Math.random()-.5)*.4 - .15,
        r, g, b,
        alpha: .4 + Math.random()*.45,
        size:  22 + Math.random()*85,
        phase: Math.random()*Math.PI*2,
      };
    });
    this._mvx = 0; this._mvy = 0; this._lmx = -9999; this._lmy = -9999;
  }
  _drawAurora() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const t = this.tick * 0.009;

    /* Persistent fade — creates the fluid trail effect */
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(3,12,18,0.055)';
    ctx.fillRect(0, 0, W, H);

    /* Mouse velocity accumulation */
    const rect = canvas.getBoundingClientRect();
    const mx = this.mouse.x - rect.left, my = this.mouse.y - rect.top;
    const dmx = mx - this._lmx, dmy = my - this._lmy;
    this._mvx = dmx * .6 + this._mvx * .4;
    this._mvy = dmy * .6 + this._mvy * .4;
    this._lmx = mx; this._lmy = my;
    const spd = Math.sqrt(this._mvx*this._mvx + this._mvy*this._mvy);

    /* Render dye particles with screen blending */
    ctx.globalCompositeOperation = 'screen';
    const INF = 200, PUSH = 38;

    this.dyes.forEach(d => {
      const dx = d.x - mx, dy = d.y - my;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < INF && dist > .5) {
        const force = (INF - dist) / INF;
        const nx = dx/dist, ny = dy/dist;
        /* Tangential (curl) + direct push → vortex stirring */
        d.vx += nx*force*0.28 + ny*force*0.42 + this._mvx*0.048;
        d.vy += ny*force*0.28 - nx*force*0.42 + this._mvy*0.048;
      }

      /* Global aurora drift — upward + sinusoidal */
      d.vx += Math.sin(t*.8 + d.y*.008 + d.phase) * .019;
      d.vy += -.019 + Math.cos(t*.6 + d.x*.007 + d.phase) * .013;

      d.vx *= .962; d.vy *= .962;
      d.x  += d.vx;  d.y += d.vy;

      if (d.x < -130) d.x = W + 130;
      if (d.x > W+130) d.x = -130;
      if (d.y < -130) { d.y = H + 130; d.x = Math.random()*W; }
      if (d.y > H+130) d.y = -130;

      const s  = d.size * (.9 + Math.sin(t + d.phase) * .15);
      const a  = d.alpha * (.8 + Math.sin(t*1.3 + d.phase) * .2);
      const g  = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, s);
      g.addColorStop(0,   `rgba(${d.r},${d.g},${d.b},${a.toFixed(2)})`);
      g.addColorStop(0.5, `rgba(${d.r},${d.g},${d.b},${(a*.3).toFixed(2)})`);
      g.addColorStop(1,   `rgba(${d.r},${d.g},${d.b},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, s, 0, Math.PI*2); ctx.fill();
    });

    /* Fast-mouse color splat at cursor */
    if (spd > 4 && mx > 0 && mx < W && my > 0 && my < H) {
      const C = [[34,232,168],[58,168,255],[147,51,255]][this.tick%3];
      const sr = Math.min(spd * 13, 130);
      const sg = ctx.createRadialGradient(mx, my, 0, mx, my, sr);
      sg.addColorStop(0, `rgba(${C[0]},${C[1]},${C[2]},0.58)`);
      sg.addColorStop(1, `rgba(${C[0]},${C[1]},${C[2]},0)`);
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(mx, my, sr, 0, Math.PI*2); ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}
