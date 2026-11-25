/**
 * The key changed without the speed (v3.59.0), for sound-chain.js: an
 * AudioWorklet processor, 'bm-pitch'. Two read heads follow the song
 * through a short delay line, each moving through it a little faster (a
 * higher key) or slower (a lower one) than the song is written, so what
 * they read is at the new pitch. Each head fades in and out on a Hann
 * window as it wraps round, half a turn apart, so the two always add up to
 * the song at its full level. The window is 60 ms: shorter sounds rougher,
 * longer smears the beats. The same idea as a studio's simple pitch
 * shifter. Within a few semitones a song sounds natural; far out it gets a
 * little grainy. mpv's form (asetrate, aresample and atempo) is another
 * way to the same key.
 *
 * ratio (an AudioParam, 0.25 to 4): 2 is an octave up, 0.5 an octave down,
 * 1 the song as it is (then it is copied straight through).
 */
class Pitch extends AudioWorkletProcessor {
  static get parameterDescriptors () { return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }]; }
  constructor (o) {
    super();
    const secs = (o && o.processorOptions && o.processorOptions.window) || 0.06;
    this.W = Math.max(64, Math.round(sampleRate * secs));
    this.N = 1 << Math.ceil(Math.log2(this.W + 256)); this.mask = this.N - 1;
    this.buf = [new Float32Array(this.N), new Float32Array(this.N)];
    this.w = 0; this.ph = 0;
  }
  read (c, pos) {
    const b = this.buf[c], i = Math.floor(pos), f = pos - i;
    return b[i & this.mask] * (1 - f) + b[(i + 1) & this.mask] * f;
  }
  process (inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0], r = params.ratio[0], n = out[0].length;
    const L = inp && inp[0], R = inp && (inp[1] || inp[0]);
    const W = this.W, step = (1 - r) / W, mask = this.mask;
    for (let i = 0; i < n; i++) {
      const w = this.w;
      this.buf[0][w] = L ? L[i] : 0; this.buf[1][w] = R ? R[i] : 0;
      if (Math.abs(r - 1) < 1e-4) {
        for (let c = 0; c < out.length; c++) out[c][i] = this.buf[c < 2 ? c : 1][w];
      } else {
        let p1 = this.ph, p2 = p1 + 0.5; if (p2 >= 1) p2 -= 1;
        const s1 = Math.sin(Math.PI * p1), s2 = Math.sin(Math.PI * p2), g1 = s1 * s1, g2 = s2 * s2;
        const a = w - 1 - p1 * W, b = w - 1 - p2 * W;
        for (let c = 0; c < out.length; c++) { const k = c < 2 ? c : 1; out[c][i] = this.read(k, a + this.N) * g1 + this.read(k, b + this.N) * g2; }
        this.ph += step; if (this.ph >= 1) this.ph -= 1; else if (this.ph < 0) this.ph += 1;
      }
      this.w = (w + 1) & mask;
    }
    // with nothing coming in (the effect taken out of the chain), it rests until something does
    return !!L;
  }
}
registerProcessor('bm-pitch', Pitch);
