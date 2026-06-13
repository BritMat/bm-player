/**
 * BM Player — Audio Visualizer
 * Modes: bars | radial | wave | particles | off
 * Falls back to beautiful synthetic animation when no audio stream is available.
 */

export class Visualizer {
  constructor (canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas?.getContext('2d');
    this.mode     = 'bars';
    this.active   = false;
    this._tick    = 0;
    this._raf     = null;

    // Web Audio
    this.audioCtx = null;
    this.analyser = null;
    this.freqData = null;
    this.timeData = null;

    // Synthetic state
    this._synthValues  = new Float32Array(128).fill(0);
    this._particles    = [];
    this._hue          = 220;

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize () {
    if (!this.canvas) return;
    this.canvas.width  = this.canvas.offsetWidth  || 800;
    this.canvas.height = this.canvas.offsetHeight || 400;
  }

  // ── Public control ──────────────────────────────────
  setMode (mode) {
    this.mode = mode;
    if (mode === 'off') { this.stop(); return; }
    if (!this.active) this.start();
  }

  start () {
    if (this.active || this.mode === 'off') return;
    this.active = true;
    this.canvas?.classList.add('active');
    this._loop();
  }

  stop () {
    this.active = false;
    this.canvas?.classList.remove('active');
    cancelAnimationFrame(this._raf);
    this.ctx?.clearRect(0, 0, this.canvas?.width, this.canvas?.height);
  }

  /** Try to connect a media element (audio or video) for real analysis */
  connectElement (mediaEl) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.fftSize);
        this.analyser.connect(this.audioCtx.destination);
      }
      const src = this.audioCtx.createMediaElementSource(mediaEl);
      src.connect(this.analyser);
    } catch (_) { /* unsupported codec — use synthetic */ }
  }

  // ── Main render loop ─────────────────────────────────
  _loop () {
    if (!this.active) return;
    this._raf = requestAnimationFrame(() => this._loop());
    this._tick++;
    this._draw();
  }

  _getFreq () {
    if (this.analyser && this.freqData) {
      this.analyser.getByteFrequencyData(this.freqData);
      return this.freqData;
    }
    return this._synth();
  }

  _getTime () {
    if (this.analyser && this.timeData) {
      this.analyser.getByteTimeDomainData(this.timeData);
      return this.timeData;
    }
    // Synthesise time-domain
    const arr = new Uint8Array(128);
    const t   = this._tick * 0.04;
    for (let i = 0; i < 128; i++) {
      arr[i] = 128 + Math.sin(t + i * 0.3) * 40 * this._synthValues[i % this._synthValues.length] / 255;
    }
    return arr;
  }

  _synth () {
    const t  = this._tick;
    const sv = this._synthValues;
    for (let i = 0; i < sv.length; i++) {
      const target = (
        Math.abs(Math.sin(t * 0.03 + i * 0.15)) * 180 +
        Math.abs(Math.sin(t * 0.05 + i * 0.08)) * 60  +
        Math.abs(Math.sin(t * 0.008 + i * 0.4)) * 30
      );
      sv[i] += (target - sv[i]) * 0.08;
    }
    return new Uint8Array(sv.map(v => Math.min(255, v)));
  }

  _draw () {
    if (!this.ctx || !this.canvas) return;
    switch (this.mode) {
      case 'bars':     this._drawBars();     break;
      case 'radial':   this._drawRadial();   break;
      case 'wave':     this._drawWave();     break;
      case 'particles':this._drawParticles();break;
    }
  }

  // ── BARS ─────────────────────────────────────────────
  _drawBars () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const freq  = this._getFreq();
    const len   = freq.length;

    ctx.clearRect(0, 0, W, H);

    const barW = (W / len) * 1.5;
    const gap  = barW * 0.15;

    for (let i = 0; i < len; i++) {
      const v = freq[i] / 255;
      const h = v * H * 0.85;
      const x = (i / len) * W;

      const hue = 220 + v * 140;
      const grad = ctx.createLinearGradient(x, H - h, x, H);
      grad.addColorStop(0, `hsla(${hue}, 90%, 68%, 0.95)`);
      grad.addColorStop(1, `hsla(${hue - 20}, 100%, 40%, 0.3)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = Math.min(barW * 0.4, 3);
      ctx.roundRect
        ? ctx.roundRect(x, H - h, barW - gap, h, [r, r, 0, 0])
        : ctx.fillRect(x, H - h, barW - gap, h);
      ctx.fill();

      // Reflection
      ctx.fillStyle = `hsla(${hue}, 90%, 68%, 0.08)`;
      ctx.fillRect(x, H, barW - gap, h * 0.25);
    }

    // Scanline bloom
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  // ── RADIAL ───────────────────────────────────────────
  _drawRadial () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const freq  = this._getFreq();
    const len   = freq.length;
    const cx    = W / 2;
    const cy    = H / 2;
    const baseR = Math.min(cx, cy) * 0.38;
    const t     = this._tick * 0.012;

    ctx.clearRect(0, 0, W, H);

    // Inner glow circle
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.9);
    innerGlow.addColorStop(0, `hsla(${220 + this._tick % 120}, 80%, 60%, 0.12)`);
    innerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 0.9, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < len; i++) {
      const v     = freq[i] / 255;
      const angle = (i / len) * Math.PI * 2 - Math.PI / 2 + t;
      const inner = baseR;
      const outer = baseR + v * baseR * 1.6;
      const hue   = (i / len) * 360 + this._tick * 0.4;

      ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${0.4 + v * 0.6})`;
      ctx.lineWidth   = 2.2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.stroke();

      // Mirror
      ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${(0.4 + v * 0.6) * 0.3})`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle + Math.PI) * inner, cy + Math.sin(angle + Math.PI) * inner);
      ctx.lineTo(cx + Math.cos(angle + Math.PI) * outer * 0.6, cy + Math.sin(angle + Math.PI) * outer * 0.6);
      ctx.stroke();
    }
  }

  // ── WAVE ─────────────────────────────────────────────
  _drawWave () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const time  = this._getTime();
    const freq  = this._getFreq();
    const avg   = freq.reduce((a, b) => a + b, 0) / freq.length / 255;
    const cy    = H / 2;

    ctx.clearRect(0, 0, W, H);

    // Glow layers
    const layers = [
      { w: 6, a: 0.10 }, { w: 3, a: 0.25 }, { w: 1.5, a: 0.9 }
    ];
    const hue = 200 + avg * 80;

    layers.forEach(({ w, a }) => {
      ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${a})`;
      ctx.lineWidth   = w;
      ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.6)`;
      ctx.shadowBlur  = w * 6;
      ctx.beginPath();
      time.forEach((v, i) => {
        const x = (i / time.length) * W;
        const y = cy + ((v - 128) / 128) * H * 0.42;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

    // Second harmonics (slightly offset)
    ctx.strokeStyle = `hsla(${hue + 40}, 80%, 70%, 0.15)`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    time.forEach((v, i) => {
      const x = (i / time.length) * W;
      const y = cy + ((v - 128) / 128) * H * 0.25 + Math.sin(i * 0.15 + this._tick * 0.04) * 8;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // ── PARTICLES ───────────────────────────────────────
  _drawParticles () {
    const { ctx, canvas } = this;
    const { width: W, height: H } = canvas;
    const freq  = this._getFreq();
    const avg   = freq.reduce((a, b) => a + b, 0) / freq.length / 255;

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, W, H);

    // Spawn particles
    if (this._tick % 2 === 0) {
      const bass = freq[2] / 255;
      const count = 1 + Math.floor(bass * 4);
      for (let i = 0; i < count; i++) {
        this._particles.push({
          x: W / 2 + (Math.random() - 0.5) * 80 * bass,
          y: H / 2 + (Math.random() - 0.5) * 80 * bass,
          vx: (Math.random() - 0.5) * 3 * (1 + avg * 3),
          vy: (Math.random() - 0.5) * 3 * (1 + avg * 3) - 1.5,
          life: 1.0,
          hue: 200 + Math.random() * 140,
          size: 1 + Math.random() * 4 * bass,
        });
      }
    }

    // Update & draw particles
    this._particles = this._particles.filter(p => {
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.04;
      p.life -= 0.018;
      if (p.life <= 0) return false;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.life * 0.9})`;
      ctx.shadowColor= `hsla(${p.hue}, 100%, 70%, 0.5)`;
      ctx.shadowBlur = p.size * 3;
      ctx.fill();
      ctx.shadowBlur = 0;
      return true;
    });

    // Cap particles
    if (this._particles.length > 400) this._particles.splice(0, 60);
  }
}
