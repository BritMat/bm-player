/**
 * A true-peak limiter (v3.59.0), for the in-app engine: 'bm-limiter', after
 * the volume, the last thing before the speakers. Nothing it is given goes
 * past the ceiling (-1 dB below full), the peaks between samples included:
 * a waveform can swing higher between two samples than either sample, and a
 * converter that draws it out then clips. Those peaks are found by
 * upsampling each ear four times (a windowed-sinc interpolator, eight taps).
 *
 * The gain comes down over a lookahead of 2 ms, so it is down by the time a
 * peak arrives (a running minimum, then a running average, the usual way),
 * and goes back up over 80 ms. Below the ceiling it changes nothing: the
 * sound is only 2 ms later. ceiling: an AudioParam, 0.1 to 1.
 */
const PH = 3, TAPS = 8;   // three points between each pair of samples (a quarter apart), eight samples each
// h[p][k]: the point p/4 of the way from sample 3 to sample 4 of eight, from a Hann-windowed sinc
const H = [];
for (let p = 1; p <= PH; p++) {
  const f = p / (PH + 1), h = [];
  let sum = 0;
  for (let k = 0; k < TAPS; k++) {
    const x = k - 3 - f, s = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w = 0.5 + 0.5 * Math.cos(Math.PI * x / (TAPS / 2));
    h.push(s * w); sum += s * w;
  }
  H.push(h.map(v => v / sum));
}

class Limiter extends AudioWorkletProcessor {
  static get parameterDescriptors () { return [{ name: 'ceiling', defaultValue: 0.891, minValue: 0.1, maxValue: 1, automationRate: 'k-rate' }]; }
  constructor () {
    super();
    this.L = Math.max(8, Math.round(sampleRate * 0.002));   // the lookahead
    this.D = this.L + 3;                                     // how late the sound comes out
    this.N = 1 << Math.ceil(Math.log2(this.L * 2 + TAPS + 16)); this.mask = this.N - 1;
    this.x = [new Float32Array(this.N), new Float32Array(this.N)];
    this.w = 0;
    this.req = new Float32Array(this.N).fill(1);   // the gain each point needs
    this.dq = new Int32Array(this.N); this.dh = 0; this.dt = 0;   // indices of a running minimum of req
    this.held = new Float32Array(this.N).fill(1); this.sum = this.L; this.rel = 1;
    this.relK = 1 - Math.exp(-1 / (0.08 * sampleRate));
    this.n = 0;   // samples seen, for the running minimum's window
  }
  process (inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0], ceil = params.ceiling[0];
    const nOut = out[0].length, chans = Math.min(2, out.length);
    const L0 = inp && inp[0], R0 = inp && (inp[1] || inp[0]);
    const { x, mask, L, D, req, dq, held } = this;
    for (let i = 0; i < nOut; i++) {
      const w = this.w;
      x[0][w] = L0 ? L0[i] : 0; x[1][w] = R0 ? R0[i] : 0;
      // the true peak of the stretch from sample w-4 to w-3, both ears
      let pk = 0;
      for (let c = 0; c < 2; c++) {
        const b = x[c], a = Math.abs(b[(w - 4) & mask]); if (a > pk) pk = a;
        for (let p = 0; p < PH; p++) {
          const h = H[p]; let y = 0;
          for (let k = 0; k < TAPS; k++) y += h[k] * b[(w - 7 + k) & mask];
          const ay = y < 0 ? -y : y; if (ay > pk) pk = ay;
        }
      }
      const n = this.n++;
      req[n & mask] = pk > ceil ? ceil / pk : 1;
      // the lowest need over the last L points (a running minimum)
      while (this.dt > this.dh && req[dq[(this.dt - 1) & mask] & mask] >= req[n & mask]) this.dt--;
      dq[this.dt++ & mask] = n;
      while (dq[this.dh & mask] <= n - L) this.dh++;
      let g = req[dq[this.dh & mask] & mask];
      // up again slowly, down at once
      if (g > this.rel) g = this.rel += (g - this.rel) * this.relK; else this.rel = g;
      // and that averaged over the last L, so it comes down smoothly and is down in time
      this.sum += g - held[(n - L) & mask]; held[n & mask] = g;
      const gain = Math.min(1, this.sum / L);
      for (let c = 0; c < chans; c++) out[c][i] = x[c < 2 ? c : 1][(w - D) & mask] * gain;
      this.w = (w + 1) & mask;
    }
    return !!L0 || this.sum < L - 1e-6;
  }
}
registerProcessor('bm-limiter', Limiter);
