/**
 * The sound chain (v3.47.0): each sound effect written once, for both of the
 * app's players.
 *
 * Films, and music mpv plays itself, go through mpv. Songs from the library
 * go through the in-app engine (audio-engine.js, Web Audio). Until v3.47.0
 * each effect was written twice, as FFmpeg filters for mpv in sound.js and
 * as Web Audio nodes in audio-engine.js, kept alike by hand. Here each is one
 * entry of EFFECTS, its two forms side by side, in the order it is heard:
 *
 *   on(s)      whether it is in the chain for these settings
 *   mpv(s)     its FFmpeg filters, for mpv's af
 *   web(ctx)   its Web Audio nodes, { input, output, set(s, to) }, made the
 *              first time it is on; set() is given every change after that,
 *              and to(param, value) to change a value without a click
 *   heard      before the point the visualiser listens at, so it shows the
 *              music as it is shaped (the equalizer), at any volume
 *   fade       seconds to settle to nothing before it leaves the chain, for
 *              an effect that would click if taken out at once
 *
 * An effect that is off is not in the chain at all, in either player, so it
 * costs nothing: with a flat equalizer, stereo, no night mode and no boost,
 * the sound goes from the file to the volume and through nothing else.
 *
 * The settings, one object for both players (settings() fills it in):
 *   eq        a gain in dB for each of EQ_FREQUENCIES, -12 to 12
 *   preamp    a gain in dB before the equalizer, -12 to 12 (v3.49.0)
 *   channels  stereo, mono, left, right or swap
 *   night     true or false
 *   boost     1 to 2 (100% to 200%)
 *   voice     clear voice, true or false (v3.49.0)
 *   mode      one of MODES, or 'off' (v3.49.0)
 *
 * Sound modes (v3.49.0, Sound lab): one tap for a whole sound, one at a
 * time. Two of them, Slowed and Nightcore, also play songs slower or faster
 * with the pitch following, as a record would: rateOf() says how much, and
 * each player applies it to the music's speed (the engine in setSpeed, mpv
 * through its speed for a song it plays). A film keeps its own speed.
 *
 * Where the two players' forms are not the same filter, they are the same
 * sum: the reverb is FFmpeg's aecho in both (what comes in plus a few
 * delayed copies, at fixed gains), the stereo effects are one table of
 * gains (mix), and the Web Audio compressors have their automatic make-up
 * gain taken off again (makeup), which mpv's have not, so night mode and the
 * limiter are as loud in both. Clear voice is the exception: mpv's
 * dialoguenhance separates the voice by its spectrum, which Web Audio cannot
 * do. The engine lifts the voice's frequencies in the middle of the stereo
 * picture instead, the same idea done simply.
 */

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const CHANNELS = [['stereo', 'Stereo'], ['mono', 'Mono'], ['left', 'Left only'], ['right', 'Right only'], ['swap', 'Swapped']];
/** The sound modes (v3.49.0), in the order the screens show them. */
export const MODES = [['off', 'Off'], ['slowed', 'Slowed + reverb'], ['nightcore', 'Nightcore'], ['8d', '8D'], ['bass', 'Bass boost'],
  ['karaoke', 'Vocal remover'], ['hall', 'Concert hall'], ['lofi', 'Lo-fi'], ['wide', 'Wider stereo']];
/** How much faster a mode plays songs, the pitch following. */
export const RATES = { slowed: 0.85, nightcore: 1.25 };

const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
/** The settings, complete and in range, from any part of them. */
export function settings (s = {}) {
  return {
    eq: EQ_FREQUENCIES.map((_, i) => num(s.eq?.[i], -12, 12, 0)),
    preamp: num(s.preamp, -12, 12, 0),
    channels: CHANNELS.some(([k]) => k === s.channels) ? s.channels : 'stereo',
    night: !!s.night,
    boost: num(s.boost, 1, 2, 1),
    voice: !!s.voice,
    mode: MODES.some(([k]) => k === s.mode) ? s.mode : 'off',
  };
}
/** How much faster songs play in these settings' mode: 1 for most, 0.85 for Slowed, 1.25 for Nightcore. */
export const rateOf = s => RATES[settings(s).mode] || 1;

// Which ear hears what: for the music's left and right, how much goes to the
// left ear and how much to the right. mpv's pan filter is written from this
// same table, so the two players cannot disagree.
const ROUTES = { mono: [[0.5, 0.5], [0.5, 0.5]], left: [[1, 1], [0, 0]], right: [[0, 0], [1, 1]], swap: [[0, 1], [1, 0]] };
const pan = r => 'pan=stereo|' + [0, 1].map(to => `c${to}=` + [0, 1].filter(from => r[from][to])
  .map(from => (r[from][to] === 1 ? '' : r[from][to] + '*') + 'c' + from).join('+')).join('|');

// Night mode: quiet voices come up and loud bangs come down. A compressor
// from 26 dB below full, 4 to 1, then twice as loud (+6 dB).
const NIGHT = { threshold: 0.05, ratio: 4, attack: 0.008, release: 0.25, makeup: 2 };

const compressor = (ctx, o) => { const c = ctx.createDynamicsCompressor(); for (const k in o) c[k].value = o[k]; return c; };

/**
 * The make-up gain a Web Audio compressor adds by itself (v3.49.0): the
 * specification has it lift the sound by (1 / the curve at full scale)^0.6,
 * and mpv's acompressor has no such thing, so night mode was some 12 dB
 * louder in the engine than in mpv, and a 200% boost a little over double.
 * Worked out here the way Chromium and Firefox work it out (their
 * DynamicsCompressorKernel: the knee is an exponential curve, its k found so
 * the slope at the knee's end is 1/ratio), and taken off again after the
 * compressor. threshold and knee in dB.
 */
export function makeup (threshold, knee, ratio) {
  const lin = db => Math.pow(10, db / 20), db = x => 20 * Math.log10(x);
  const lt = lin(threshold), curve = (x, k) => x < lt ? x : lt + (1 - Math.exp(-k * (x - lt))) / k;
  const slopeAt = (x, k) => { if (x < lt) return 1; const x2 = x * 1.001; return (db(curve(x2, k)) - db(curve(x, k))) / (db(x2) - db(x)); };
  let lo = 0.1, hi = 10000, k = 5;
  const x = lin(threshold + knee);
  for (let i = 0; i < 15; i++) { if (slopeAt(x, k) < 1 / ratio) hi = k; else lo = k; k = Math.sqrt(lo * hi); }
  const kneeDb = threshold + knee, yKnee = db(curve(lin(kneeDb), k));
  const full = 1 < lin(kneeDb) ? curve(1, k) : lin(yKnee + (0 - kneeDb) / ratio);
  return Math.pow(1 / full, 0.6);
}
// A compressor with its own make-up gain taken off: { input, output }.
const evenCompressor = (ctx, o) => {
  const c = compressor(ctx, o), g = ctx.createGain();
  g.gain.value = 1 / makeup(o.threshold, o.knee ?? 30, o.ratio ?? 12);
  c.connect(g);
  return { input: c, output: g };
};

// Two channels, mixed as speakers would: a 5.1 film's centre (its voices)
// is in both, where the left and right alone would be the front pair only.
const stereo = ctx => { const g = ctx.createGain(); g.channelCount = 2; g.channelCountMode = 'explicit'; g.channelInterpretation = 'speakers'; return g; };

/**
 * A table of gains, m[to] = [from the left, from the right], for both
 * players: mpv's pan filter is written from it, and the engine's gains are
 * set from it (v3.49.0, for the modes. The channels above keep their own
 * table and wording, so mpv is given what 3.46.0 gave it).
 */
// The positive terms first: FFmpeg's pan reads a leading minus only as part of a number ("-1*c0", not "-c0").
const mix = m => 'pan=stereo|' + m.map((row, to) => `c${to}=` + row
  .map((g, from) => [g, from]).filter(([g]) => g).sort((a, b) => (b[0] > 0) - (a[0] > 0))
  .map(([g, from], i) => (g < 0 ? '-' : i ? '+' : '') + (Math.abs(g) === 1 ? '' : Math.abs(g) + '*') + 'c' + from)
  .join('')).join('|');
function mixNode (ctx, m) {
  const input = stereo(ctx), split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
  input.connect(split);
  const g = m.map((row, to) => row.map((v, from) => { const n = ctx.createGain(); n.gain.value = v; split.connect(n, from); n.connect(merge, 0, to); return n; }));
  return { input, output: merge, g };
}

/**
 * FFmpeg's aecho, [in, out, delays in ms, decays]: what comes in times in,
 * plus each delay at its decay, all times out. Nothing is fed back, so its
 * Web Audio form is the same sum exactly.
 */
const aecho = ([i, o, d, k]) => `aecho=${i}:${o}:${d.join('|')}:${k.join('|')}`;
function echoNode (ctx, [i, o, d, k]) {
  const input = ctx.createGain(), output = ctx.createGain();
  output.gain.value = o;
  if (i) { const dry = ctx.createGain(); dry.gain.value = i; input.connect(dry); dry.connect(output); }
  d.forEach((ms, n) => { const dl = ctx.createDelay(1); dl.delayTime.value = ms / 1000; const g = ctx.createGain(); g.gain.value = k[n]; input.connect(dl); dl.connect(g); g.connect(output); });
  return { input, output };
}
/** Nodes one after another, as one: { input, output }. */
function series (...nodes) {
  for (let n = 1; n < nodes.length; n++) (nodes[n - 1].output || nodes[n - 1]).connect(nodes[n].input || nodes[n]);
  return { input: nodes[0].input || nodes[0], output: nodes[nodes.length - 1].output || nodes[nodes.length - 1] };
}
const biquad = (ctx, type, f, extra = {}) => {
  const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
  // FFmpeg's lowpass and highpass default to a Q of 0.707 (Butterworth), and Web Audio's Q is in dB for these two
  if (type === 'lowpass' || type === 'highpass') b.Q.value = -3.0103;
  for (const k in extra) b[k].value = extra[k];
  return b;
};

/**
 * A reverb: the sound as it is, and beside it the same sound without its
 * lowest notes (they would boom) through three echoes one after another,
 * each echo of the one before, which makes many reflections from few.
 * mpv: asplit and amix (amix halves each, so the volume after doubles it
 * back). The engine: the same two paths, added.
 */
// The delays are not whole milliseconds, nor near multiples of each other:
// with whole ones every tap lines up at 1 kHz and its multiples, and a held
// note there rang five times as loud. These were picked from a search for
// the smallest peak in the response (about 10 dB at one narrow frequency for
// the hall, for a steady tone, while the sound as a whole is as loud as it was).
const REVERBS = {
  hall: { wet: 0.5, stages: [[0, 1, [7.3, 12.4, 15.1, 19.4], [0.5, 0.45, 0.4, 0.35]], [1, 0.8, [19.8, 28.5, 45.3, 59.4], [0.35, 0.3, 0.25, 0.2]], [1, 0.8, [72.2, 133, 171.9, 231.9], [0.4, 0.3, 0.22, 0.16]]] },
  slowed: { wet: 0.7, stages: [[0, 1, [5.6, 10.5, 14, 15.7], [0.5, 0.45, 0.4, 0.35]], [1, 0.8, [34, 37.1, 56.7, 73.9], [0.4, 0.33, 0.27, 0.22]], [1, 0.8, [93, 154.8, 216.1, 277.6], [0.45, 0.35, 0.27, 0.2]]] },
  space: { wet: 0.3, stages: [[0, 1, [8.4, 11, 13.9, 15.9], [0.5, 0.45, 0.4, 0.35]], [1, 0.8, [27.3, 35.8, 50.4, 68.7], [0.35, 0.3, 0.25, 0.2]]] },
};
const REVERB_LOW = 200;
const reverbMpv = (id, p = REVERBS[id]) => `asplit=2[${id}d][${id}w];[${id}w]highpass=f=${REVERB_LOW},${p.stages.map(aecho).join(',')},volume=${p.wet}[${id}r];[${id}d][${id}r]amix=inputs=2,volume=2`;
function reverbNode (ctx, id) {
  const p = REVERBS[id], input = ctx.createGain(), output = ctx.createGain(), wet = ctx.createGain();
  wet.gain.value = p.wet;
  input.connect(output);
  const path = series(biquad(ctx, 'highpass', REVERB_LOW), ...p.stages.map(st => echoNode(ctx, st)), wet);
  input.connect(path.input); path.output.connect(output);
  return { input, output };
}

// 8D: the music narrowed a little, then sent round the head, one ear's
// level rising as the other's falls (FFmpeg's apulsator, sine: each ear's
// gain is 1 - a/2 + a/2 * sin, the right half a turn behind), once in ten
// seconds, in a small room.
const CIRCLE = { hz: 0.1, amount: 0.9, narrow: [[0.6, 0.4], [0.4, 0.6]] };
function circleNode (ctx) {
  const pre = mixNode(ctx, CIRCLE.narrow), split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), a = CIRCLE.amount;
  pre.output.connect(split);
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = CIRCLE.hz;
  [1, -1].forEach((sign, ch) => {
    const g = ctx.createGain(); g.gain.value = 1 - a / 2;
    const depth = ctx.createGain(); depth.gain.value = sign * a / 2;
    lfo.connect(depth); depth.connect(g.gain);
    split.connect(g, ch); g.connect(merge, 0, ch);
  });
  try { lfo.start(); } catch (_) {}
  return { input: pre.input, output: merge, stop: () => { try { lfo.stop(); } catch (_) {} } };
}

// Lo-fi: the top and bottom taken off, as from a small old speaker, and a
// slow wow, the pitch wavering as a worn tape's does (FFmpeg's vibrato: a
// delay of up to 5 ms, swung by depth).
const LOFI = { low: 200, high: 3800, hz: 0.5, depth: 0.6 };
function wowNode (ctx) {
  const dl = ctx.createDelay(0.02), lfo = ctx.createOscillator(), swing = ctx.createGain();
  dl.delayTime.value = 0.005 - 0.0025 * LOFI.depth;
  lfo.type = 'sine'; lfo.frequency.value = LOFI.hz; swing.gain.value = 0.0025 * LOFI.depth;
  lfo.connect(swing); swing.connect(dl.delayTime);
  try { lfo.start(); } catch (_) {}
  return { input: dl, output: dl, stop: () => { try { lfo.stop(); } catch (_) {} } };
}

// The vocal remover: what is the same in both ears (the singer, usually) is
// taken away, above about 180 Hz.
const KARAOKE_LOW = 180;
const VOICE_BAND = [250, 3500];
// How much of the voice is added to each ear, in each player: about the voice again (+6 dB) in both.
const VOICE_LIFT = { mpv: 0.4, web: 1 };
// extrastereo m=1.6: each ear's own part 1.3, the other's -0.3
const WIDE = [[1.3, -0.3], [-0.3, 1.3]];
// The modes that can make the sound louder than it came: the limiter goes after them.
const LOUD = new Set(['slowed', '8d', 'bass', 'karaoke', 'hall', 'wide']);

export const EFFECTS = [
  {
    // The equalizer's preamp (v3.49.0): the whole sound up or down before the
    // bands, so a curve that lifts every band need not crackle.
    id: 'preamp', heard: true,
    on: s => s.preamp !== 0,
    mpv: s => [`volume=${s.preamp}dB`],
    web: ctx => { const g = ctx.createGain(); return { input: g, output: g, set: (s, to) => to(g.gain, Math.pow(10, s.preamp / 20)) }; },
  },
  {
    // The equalizer: ten bands, an octave apart. mpv's bands are two octaves
    // wide and the engine's about an octave and a quarter (Q 1.1), as they
    // were before this file; the 15-band equalizer (3.49) settles one shape.
    id: 'eq', heard: true, fade: 0.2,
    on: s => s.eq.some(g => g !== 0),
    mpv: s => s.eq.flatMap((g, i) => g ? [`equalizer=f=${EQ_FREQUENCIES[i]}:width_type=o:width=2:g=${g}`] : []),
    web: ctx => {
      const bands = EQ_FREQUENCIES.map(f => {
        const b = ctx.createBiquadFilter();
        b.type = 'peaking'; b.frequency.value = f; b.Q.value = 1.1; b.gain.value = 0;
        return b;
      });
      for (let i = 1; i < bands.length; i++) bands[i - 1].connect(bands[i]);
      const last = bands.map(() => 0);
      return {
        input: bands[0], output: bands[bands.length - 1], bands,
        set: (s, to) => bands.forEach((b, i) => { if (s.eq[i] !== last[i]) { last[i] = s.eq[i]; to(b.gain, s.eq[i]); } }),
      };
    },
  },
  {
    // Clear voice (v3.49.0), for films: mpv's dialoguenhance finds what is
    // the voice and puts it in a centre channel of its own, which is added
    // back to both ears, so the words come forward over the music and the
    // bangs. It takes stereo (a 5.1 film is made stereo first, while it is
    // on). The engine lifts the voice's band in the middle of the stereo
    // picture by about as much.
    id: 'voice',
    on: s => s.voice,
    // dialoguenhance's centre is the voice at some 2.6 times: 0.4 of it in each ear is about twice the voice (+6 dB)
    mpv: () => ['dialoguenhance', `pan=stereo|c0=c0+${VOICE_LIFT.mpv}*c2|c1=c1+${VOICE_LIFT.mpv}*c2`],
    web: ctx => {
      const input = stereo(ctx), split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), mid = ctx.createGain(), lift = ctx.createGain();
      input.connect(split);
      mid.gain.value = 0.5; lift.gain.value = VOICE_LIFT.web;
      for (const ch of [0, 1]) { split.connect(mid, ch); const d = ctx.createGain(); split.connect(d, ch); d.connect(merge, 0, ch); }
      const band = series(mid, biquad(ctx, 'highpass', VOICE_BAND[0]), biquad(ctx, 'lowpass', VOICE_BAND[1]), lift);
      for (const ch of [0, 1]) band.output.connect(merge, 0, ch);
      return { input, output: merge };
    },
  },
  {
    // Which ear hears what. Two channels first, mixed as speakers would: a
    // 5.1 film's centre (its voices) is in both, where pan's c0 and c1 alone
    // would be the front left and right only.
    id: 'channels',
    on: s => s.channels !== 'stereo',
    mpv: s => ['aformat=channel_layouts=stereo', pan(ROUTES[s.channels])],
    web: ctx => {
      const two = ctx.createGain();
      two.channelCount = 2; two.channelCountMode = 'explicit'; two.channelInterpretation = 'speakers';
      const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
      two.connect(split);
      const g = [0, 1].map(from => [0, 1].map(to => { const n = ctx.createGain(); split.connect(n, from); n.connect(merge, 0, to); return n; }));
      return { input: two, output: merge, set: s => { const r = ROUTES[s.channels]; if (r) for (const f of [0, 1]) for (const t of [0, 1]) g[f][t].gain.value = r[f][t]; } };
    },
  },
  {
    id: 'night',
    on: s => s.night,
    mpv: () => [`acompressor=threshold=${NIGHT.threshold}:ratio=${NIGHT.ratio}:attack=${NIGHT.attack * 1000}:release=${NIGHT.release * 1000}:makeup=${NIGHT.makeup}`],
    web: ctx => {
      // the engine's knee is softer (12 dB): a compressor's knee in Web Audio is in decibels, FFmpeg's a ratio.
      // Its own make-up gain is taken off (v3.49.0): only NIGHT.makeup, as in mpv.
      const comp = evenCompressor(ctx, { threshold: Math.round(20 * Math.log10(NIGHT.threshold)), knee: 12, ratio: NIGHT.ratio, attack: NIGHT.attack, release: NIGHT.release });
      const up = ctx.createGain(); up.gain.value = NIGHT.makeup;
      comp.output.connect(up);
      return { input: comp.input, output: up };
    },
  },
  // The sound modes (v3.49.0): one at a time, after night mode and before
  // the boost and the limiter. Nightcore is only faster (rateOf), so it has
  // no filters here.
  {
    id: 'slowed',
    on: s => s.mode === 'slowed',
    mpv: () => [reverbMpv('slowed')],
    web: ctx => reverbNode(ctx, 'slowed'),
  },
  {
    id: '8d',
    on: s => s.mode === '8d',
    mpv: () => ['aformat=channel_layouts=stereo', mix(CIRCLE.narrow), `apulsator=hz=${CIRCLE.hz}:amount=${CIRCLE.amount}`, reverbMpv('space')],
    web: ctx => { const c = circleNode(ctx), r = reverbNode(ctx, 'space'); c.output.connect(r.input); return { input: c.input, output: r.output, stop: c.stop }; },
  },
  {
    // A low shelf, +8 dB below about 100 Hz: FFmpeg's lowshelf with a slope
    // of 1 is the same filter as Web Audio's (FFmpeg's bass, given the same
    // numbers, came out 1.4 dB stronger: scripts/sound-check.mjs).
    id: 'bass',
    on: s => s.mode === 'bass',
    mpv: () => ['lowshelf=g=8:f=100:t=s:w=1'],
    web: ctx => { const b = biquad(ctx, 'lowshelf', 100, { gain: 8 }); return { input: b, output: b }; },
  },
  {
    // Each ear less the other, which takes away what is the same in both,
    // and the other ear's lowest notes added back, so the bass and the kick
    // drum (also in the middle) stay: left is L - R + low(R), right is
    // R - L + low(L). At the bottom that is L and R again, and above it L - R
    // and R - L, with no dip between the two (a low and a high filter added
    // would cancel each other at the crossing).
    id: 'karaoke',
    on: s => s.mode === 'karaoke',
    // The low filter twice over, steeper, so less of a voice above it comes back with the bass.
    mpv: () => ['aformat=channel_layouts=stereo', `asplit=2[ka][kb];[kb]lowpass=f=${KARAOKE_LOW},lowpass=f=${KARAOKE_LOW},${mix([[0, 1], [1, 0]])}[kc];[ka]${mix([[1, -1], [-1, 1]])}[kd];[kd][kc]amix=inputs=2,volume=2`],
    web: ctx => {
      const input = stereo(ctx), output = ctx.createGain(), diff = mixNode(ctx, [[1, -1], [-1, 1]]);
      const low = series(biquad(ctx, 'lowpass', KARAOKE_LOW), biquad(ctx, 'lowpass', KARAOKE_LOW), mixNode(ctx, [[0, 1], [1, 0]]));
      input.connect(diff.input); diff.output.connect(output);
      input.connect(low.input); low.output.connect(output);
      return { input, output };
    },
  },
  {
    id: 'hall',
    on: s => s.mode === 'hall',
    mpv: () => [reverbMpv('hall')],
    web: ctx => reverbNode(ctx, 'hall'),
  },
  {
    id: 'lofi',
    on: s => s.mode === 'lofi',
    mpv: () => [`highpass=f=${LOFI.low}`, `lowpass=f=${LOFI.high}`, `vibrato=f=${LOFI.hz}:d=${LOFI.depth}`],
    web: ctx => { const w = wowNode(ctx); return { ...series(biquad(ctx, 'highpass', LOFI.low), biquad(ctx, 'lowpass', LOFI.high), w), stop: w.stop }; },
  },
  {
    // Wider: what differs between the ears made half as much again (the
    // middle stays as it is). FFmpeg's extrastereo at 1.6, written as gains.
    id: 'wide',
    on: s => s.mode === 'wide',
    mpv: () => ['aformat=channel_layouts=stereo', mix(WIDE)],
    web: ctx => mixNode(ctx, WIDE),
  },
  {
    id: 'boost',
    on: s => s.boost > 1,
    mpv: s => [`volume=${s.boost}`],
    web: ctx => { const g = ctx.createGain(); return { input: g, output: g, set: s => { g.gain.value = s.boost; } }; },
  },
  {
    // A limiter after night mode or a boost, so the loud parts do not crackle.
    // No level= for mpv: FFmpeg before 5.1 has no such option, and an option
    // it does not know fails the whole filter, equalizer and all. v3.49.0:
    // also after clear voice, a preamp above 0 and the modes that add sound.
    // The engine's has its own make-up gain taken off: it only holds the
    // peaks down, as mpv's does.
    id: 'limit',
    on: s => s.night || s.boost > 1 || s.voice || s.preamp > 0 || LOUD.has(s.mode),
    mpv: () => ['alimiter=limit=0.95'],
    web: ctx => evenCompressor(ctx, { threshold: -1.5, knee: 0, ratio: 20, attack: 0.002, release: 0.1 }),
  },
];

/** mpv's af for these settings: one lavfi filter, or '' when every effect is off. */
export function lavfi (s) {
  s = settings(s);
  const parts = EFFECTS.filter(e => e.on(s)).flatMap(e => e.mpv(s));
  return parts.length ? `lavfi=[${parts.join(',')}]` : '';
}

/**
 * The same chain in Web Audio, for the in-app engine:
 *
 *   from -> [heard effects] -> heard -> [the others] -> to
 *
 * from is the song, heard a node the visualiser listens to, to the volume.
 * Nothing is between them until an effect is on. Changing the settings puts
 * effects in and takes them out; the links that stay are left alone.
 */
export class WebChain {
  constructor (ctx, { from, heard, to }) {
    this.ctx = ctx; this.from = from; this.heard = heard; this.to = to;
    this.made = new Map();       // effect id -> its nodes, made the first time it is on
    this.live = [];              // the effects in the chain now, in order
    this.links = [];             // [a, b]: what this chain connected
    this._fading = new Map();    // effect id -> timer: off, settling before it leaves
    this._settled = new Set();
    this.s = settings();
    this._wire([]);
  }

  /** A value glides while the sound runs (a step clicks), and is set outright at rest. */
  _to (param, v) {
    try {
      if (this.ctx.state === 'running') param.setTargetAtTime(v, this.ctx.currentTime, 0.02);
      else { param.cancelScheduledValues(0); param.value = v; }
    } catch (_) { param.value = v; }
  }

  set (next) {
    const s = this.s = settings(next);
    const to = (p, v) => this._to(p, v);
    const ids = [];
    for (const e of EFFECTS) {
      let n = this.made.get(e.id);
      if (e.on(s)) {
        clearTimeout(this._fading.get(e.id)); this._fading.delete(e.id);
        if (!n) { n = e.web(this.ctx); this.made.set(e.id, n); }
        n.set?.(s, to);
        ids.push(e.id);
      } else if (n && this.live.includes(e.id) && e.fade && this.ctx.state === 'running' && !this._settled.has(e.id)) {
        // Leaving: brought to nothing first (a flat equalizer), then out.
        n.set?.(s, to);
        if (!this._fading.has(e.id)) {
          this._fading.set(e.id, setTimeout(() => {
            this._fading.delete(e.id); this._settled.add(e.id);
            try { this.set(this.s); } finally { this._settled.delete(e.id); }
          }, e.fade * 1000));
        }
        ids.push(e.id);
      } else if (n) n.set?.(s, to);   // out of the chain, at its resting values for when it comes back
    }
    this._wire(ids);
  }

  _wire (ids) {
    const nodes = id => this.made.get(id);
    const isHeard = id => EFFECTS.find(e => e.id === id)?.heard;
    const path = [this.from, ...ids.filter(isHeard).map(nodes), this.heard, ...ids.filter(id => !isHeard(id)).map(nodes), this.to];
    const links = [];
    for (let i = 1; i < path.length; i++) links.push([path[i - 1].output || path[i - 1], path[i].input || path[i]]);
    const has = (list, [a, b]) => list.some(([x, y]) => x === a && y === b);
    for (const l of this.links) if (!has(links, l)) { try { l[0].disconnect(l[1]); } catch (_) {} }
    for (const l of links) if (!has(this.links, l)) l[0].connect(l[1]);
    this.links = links; this.live = ids;
  }

  /** The timers stopped, for an engine being taken down, and the effects' own oscillators. */
  destroy () {
    for (const t of this._fading.values()) clearTimeout(t); this._fading.clear();
    for (const n of this.made.values()) { try { n.stop?.(); } catch (_) {} }
  }
}
