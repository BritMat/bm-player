/**
 * FoxVoice: the fox says back what it hears, in a high little voice
 * (v3.42.0), as a talking pet does.
 *
 * With the microphone on, the fox listens. When someone speaks it pricks up
 * its ears and tilts its head; when they stop, it repeats the words, played
 * half as fast again (higher and quicker), moving its mouth with them.
 * While it talks it does not listen, so it never answers itself.
 *
 * The sound stays on the device: it is held in memory for at most twelve
 * seconds and nothing is saved or sent. The microphone is asked for only
 * when the talk button is pressed, and released with stop().
 *
 * Shared by the desktop's welcome screen and the phone's home tab (where
 * Android asks for the microphone the first time: MainActivity).
 */
import { sfx } from './sfx.js';

const RATE_UP = 1.5;          // how much higher and quicker the fox's voice is
const SILENCE = 0.65;         // seconds of quiet that end what was said
const MIN_SPEECH = 0.25;      // shorter than this is a click or a knock
const MAX_SPEECH = 8;         // the fox answers after this long anyway

export class FoxVoice {
  /** fox: the fox (react, setMouth). onState(state, detail): off, starting, listening, hearing, talking, denied, error. */
  constructor ({ fox, onState = () => {} }) {
    this.fox = fox; this.onState = onState;
    this.state = 'off';
  }

  get on () { return this.state !== 'off' && this.state !== 'denied' && this.state !== 'error'; }

  _set (state, detail = '') { this.state = state; try { this.onState(state, detail); } catch (_) {} }

  async start () {
    if (this.on) return;
    const ctx = sfx.context();
    if (!ctx || !navigator.mediaDevices?.getUserMedia || !ctx.createScriptProcessor) { this._set('error', 'This device cannot record sound here.'); return; }
    this._set('starting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'PermissionDeniedError');
      this._set(denied ? 'denied' : 'error', denied ? 'The microphone is not allowed.' : String(e?.message || e));
      return;
    }
    if (this.state !== 'starting') { this._release(); return; }        // stopped while asking
    sfx.hold();
    this.ctx = ctx; this.rate = ctx.sampleRate;
    this.src = ctx.createMediaStreamSource(this.stream);
    this.proc = ctx.createScriptProcessor(2048, 1, 1);
    this.sink = ctx.createGain(); this.sink.gain.value = 0;              // a processor only runs when it leads somewhere
    this.src.connect(this.proc); this.proc.connect(this.sink); this.sink.connect(ctx.destination);
    this.ring = new Float32Array(Math.round(this.rate * 12)); this.w = 0; this.total = 0;
    this.floor = 0.006; this.voiceAt = -1; this.lastVoice = -1; this.deafUntil = 0; this.playing = false;
    this.proc.onaudioprocess = ev => this._chunk(ev.inputBuffer.getChannelData(0));
    this._set('listening');
  }

  stop () {
    if (this.state === 'off') return;
    this._release();
    this._set('off');
  }

  _release () {
    try { this.proc && (this.proc.onaudioprocess = null); } catch (_) {}
    for (const n of [this.src, this.proc, this.sink]) { try { n?.disconnect(); } catch (_) {} }
    try { this.player?.stop(); } catch (_) {}
    for (const t of this.stream?.getTracks?.() || []) { try { t.stop(); } catch (_) {} }
    if (this.ctx) sfx.release();
    cancelAnimationFrame(this._mouthRaf);
    this.fox.setMouth?.(0);
    this.src = this.proc = this.sink = this.stream = this.ctx = this.player = null;
    this.ring = null; this.playing = false;
  }

  _chunk (x) {
    if (!this.ring) return;
    const n = this.ring.length, len = x.length;
    let sum = 0;
    for (let i = 0; i < len; i++) { const v = x[i]; this.ring[(this.w + i) % n] = v; sum += v * v; }
    this.w = (this.w + len) % n; this.total += len;
    if (this.playing || performance.now() < this.deafUntil) return;
    const rms = Math.sqrt(sum / len), thresh = Math.max(0.016, this.floor * 3.2);
    if (rms > thresh) {
      if (this.voiceAt < 0) { this.voiceAt = this.total - len; this.fox.react?.('listen', { side: Math.random() < 0.5 ? -1 : 1 }); this._set('hearing'); }
      this.lastVoice = this.total;
    } else if (this.voiceAt < 0) {
      this.floor += (rms - this.floor) * 0.05;                         // the room's own hum, learnt while quiet
    }
    if (this.voiceAt >= 0) {
      const spoke = (this.lastVoice - this.voiceAt) / this.rate, quiet = (this.total - this.lastVoice) / this.rate, all = (this.total - this.voiceAt) / this.rate;
      if ((quiet > SILENCE && spoke > MIN_SPEECH) || all > MAX_SPEECH) this._reply(this.voiceAt, this.lastVoice);
      else if (quiet > SILENCE) { this.voiceAt = -1; this._set('listening'); }
    }
  }

  _reply (from, to) {
    const ctx = this.ctx, rate = this.rate, n = this.ring.length;
    this.voiceAt = -1;
    const a = Math.max(this.total - n + 1, from - Math.round(0.18 * rate)), b = Math.min(this.total, to + Math.round(0.22 * rate));
    const len = b - a;
    if (len < rate * 0.2) { this._set('listening'); return; }
    const buf = ctx.createBuffer(1, len, rate), d = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < len; i++) { const v = this.ring[((a + i) % n + n) % n]; d[i] = v; peak = Math.max(peak, Math.abs(v)); }
    const gain = peak > 0 ? Math.min(6, 0.85 / peak) : 1, fade = Math.round(rate * 0.02);
    for (let i = 0; i < len; i++) d[i] *= gain * Math.min(1, i / fade, (len - 1 - i) / fade);
    const s = ctx.createBufferSource(), an = ctx.createAnalyser();
    s.buffer = buf; s.playbackRate.value = RATE_UP;
    an.fftSize = 512;
    s.connect(an); an.connect(sfx.output());
    this.player = s; this.playing = true;
    this._set('talking');
    const tmp = new Float32Array(an.fftSize);
    const mouth = () => {
      if (!this.playing) return;
      an.getFloatTimeDomainData(tmp);
      let m = 0; for (let i = 0; i < tmp.length; i++) m += tmp[i] * tmp[i];
      this.fox.setMouth?.(Math.min(1, Math.sqrt(m / tmp.length) * 6));
      this._mouthRaf = requestAnimationFrame(mouth);
    };
    mouth();
    s.onended = () => {
      this.playing = false; this.player = null;
      cancelAnimationFrame(this._mouthRaf);
      this.fox.setMouth?.(0);
      this.deafUntil = performance.now() + 350;                        // the room's echo of it fades first
      if (this.state === 'talking') this._set('listening');
    };
    s.start();
  }
}
