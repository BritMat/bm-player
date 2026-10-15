/**
 * sfx: the little sounds of the home screen's play (v3.42.0): the fox's
 * squeaks, giggles, purring and sneezes, and the fruit game's swooshes and
 * splats. Each is made as it plays, with Web Audio oscillators and filtered
 * noise, so there is nothing to download and nothing in the APK.
 *
 * One AudioContext, made on the first sound (always after a tap, so the
 * browser allows it) and put to sleep a few seconds after the last one, so
 * it costs nothing while nobody plays. The fox's voice (fox-voice.js) keeps
 * it awake while it listens (hold / release).
 *
 * Shared by the desktop's welcome screen and the phone's home tab.
 */

const PREF = 'bm_play_sound';
let ctx = null, out = null, noiseBuf = null, sleepT = 0, holds = 0;

function context () {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ctx = new C({ latencyHint: 'interactive' }); } catch (_) { return null; }
    out = ctx.createGain();
    out.gain.value = 0.6;
    // Several sounds at once never clip: a gentle limiter before the speakers.
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -9; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.2;
    out.connect(lim); lim.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  restSoon();
  return ctx;
}

function restSoon () {
  clearTimeout(sleepT);
  sleepT = setTimeout(() => { if (ctx && ctx.state === 'running' && holds <= 0) ctx.suspend().catch(() => {}); }, 6000);
}

function noise () {
  if (noiseBuf) return noiseBuf;
  const n = Math.round(ctx.sampleRate * 1.2), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
  return (noiseBuf = b);
}

/** A tone gliding from f0 to f1 over dur seconds, starting `at` seconds from now. */
function tone (type, f0, f1, dur, vol, at = 0, { vib = 0, vibRate = 0, dest = null } = {}) {
  const c = context(); if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (vib) {
    const l = c.createOscillator(), lg = c.createGain();
    l.frequency.value = vibRate || 12; lg.gain.value = vib;
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || out);
  o.start(t); o.stop(t + dur + 0.05);
}

/** Noise through a filter that sweeps from f0 to f1. */
function hiss (dur, vol, kind, f0, f1, at = 0, q = 1) {
  const c = context(); if (!c) return;
  const t = c.currentTime + at;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise();
  s.loop = true;
  f.type = kind; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.015, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

const SOUNDS = {
  boop () { tone('sine', 880, 1500, 0.11, 0.32); },
  squeak () { tone('sine', 1300, 2300, 0.07, 0.25); tone('sine', 1700, 2700, 0.08, 0.22, 0.085); },
  boing () { tone('sine', 150, 560, 0.42, 0.38, 0, { vib: 40, vibRate: 17 }); },
  bonk () { tone('sine', 620, 170, 0.14, 0.34); hiss(0.05, 0.12, 'bandpass', 2500, 1200, 0, 2); },
  giggle () { [720, 880, 790, 960, 860].forEach((f, i) => tone('sine', f, f * 1.18, 0.075, 0.2, i * 0.095, { vib: 22, vibRate: 30 })); },
  laugh () {
    [640, 820, 700, 900, 760, 980, 820].forEach((f, i) => tone('triangle', f, f * 1.25, 0.07, 0.17, i * 0.082, { vib: 30, vibRate: 32 }));
    hiss(0.6, 0.03, 'bandpass', 2400, 1800, 0, 1.2);
  },
  hey () { tone('square', 480, 700, 0.09, 0.05); tone('square', 560, 820, 0.1, 0.05, 0.11); },
  sneeze () {
    tone('sawtooth', 250, 430, 0.38, 0.06, 0, { vib: 8, vibRate: 7 });
    hiss(0.36, 0.03, 'bandpass', 900, 1300, 0, 3);
    hiss(0.2, 0.5, 'highpass', 2600, 1400, 0.42, 0.8);
    tone('sine', 300, 120, 0.12, 0.12, 0.42);
  },
  yawn () { tone('sawtooth', 420, 230, 1.1, 0.05, 0, { vib: 6, vibRate: 5 }); hiss(1.0, 0.03, 'bandpass', 700, 420, 0.05, 2); },
  pop () { tone('sine', 520, 980, 0.06, 0.25); },
  whoosh () { hiss(0.32, 0.22, 'bandpass', 380, 2600, 0, 1.4); },
  swoosh () { hiss(0.13, 0.16, 'bandpass', 1400, 4200, 0, 1.6); },
  splat () { hiss(0.17, 0.4, 'lowpass', 1300, 260, 0, 0.9); tone('sine', 150, 55, 0.13, 0.32); },
  boom () { hiss(0.9, 0.85, 'lowpass', 900, 50, 0, 0.7); tone('sine', 95, 28, 0.7, 0.6); },
  throw () { tone('sine', 230, 340, 0.08, 0.06); },
  miss () { tone('triangle', 420, 190, 0.34, 0.16); },
  chime () { [880, 1320, 1760].forEach((f, i) => tone('triangle', f, f, 0.24, 0.12, i * 0.07)); },
  start () { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.16, 0.13, i * 0.09)); },
  over () { [784, 659, 523, 392].forEach((f, i) => tone('triangle', f, f * 0.98, 0.24, 0.14, i * 0.14)); },
  heart () { tone('sine', 990, 1180, 0.09, 0.12); tone('sine', 1320, 1560, 0.12, 0.1, 0.1); },
};

export const sfx = {
  /** Sounds on (the default) or off: one switch for the fox and the games. */
  get on () { try { return localStorage.getItem(PREF) !== '0'; } catch (_) { return true; } },
  set on (v) { try { localStorage.setItem(PREF, v ? '1' : '0'); } catch (_) {} },

  play (name) {
    if (!this.on || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (_) {}
  },

  /** A purr while the fox is stroked: returns stop(). */
  purr () {
    if (!this.on) return () => {};
    const c = context(); if (!c) return () => {};
    holds++;
    const t = c.currentTime;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    s.buffer = noise(); s.loop = true;
    f.type = 'lowpass'; f.frequency.value = 240; f.Q.value = 2;
    am.gain.value = 0.5;
    lfo.frequency.value = 23; lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(am.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.25);
    s.connect(f); f.connect(am); am.connect(g); g.connect(out);
    s.start(t); lfo.start(t);
    let stopped = false;
    return () => {
      if (stopped) return; stopped = true; holds--;
      const e = c.currentTime;
      try { g.gain.cancelScheduledValues(e); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), e); g.gain.exponentialRampToValueAtTime(0.0001, e + 0.35); } catch (_) {}
      s.stop(e + 0.4); lfo.stop(e + 0.4);
      restSoon();
    };
  },

  /** The shared context, for the fox's voice; null where there is no Web Audio. */
  context () { return context(); },
  output () { context(); return out; },
  hold () { holds++; context(); },
  release () { holds = Math.max(0, holds - 1); restSoon(); },
};
