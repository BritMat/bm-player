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
 *   channels  stereo, mono, left, right or swap
 *   night     true or false
 *   boost     1 to 2 (100% to 200%)
 */

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const CHANNELS = [['stereo', 'Stereo'], ['mono', 'Mono'], ['left', 'Left only'], ['right', 'Right only'], ['swap', 'Swapped']];

const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
/** The settings, complete and in range, from any part of them. */
export function settings (s = {}) {
  return {
    eq: EQ_FREQUENCIES.map((_, i) => num(s.eq?.[i], -12, 12, 0)),
    channels: CHANNELS.some(([k]) => k === s.channels) ? s.channels : 'stereo',
    night: !!s.night,
    boost: num(s.boost, 1, 2, 1),
  };
}

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

export const EFFECTS = [
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
      // the engine's knee is softer (12 dB): a compressor's knee in Web Audio is in decibels, FFmpeg's a ratio
      const comp = compressor(ctx, { threshold: Math.round(20 * Math.log10(NIGHT.threshold)), knee: 12, ratio: NIGHT.ratio, attack: NIGHT.attack, release: NIGHT.release });
      const makeup = ctx.createGain(); makeup.gain.value = NIGHT.makeup;
      comp.connect(makeup);
      return { input: comp, output: makeup };
    },
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
    // it does not know fails the whole filter, equalizer and all.
    id: 'limit',
    on: s => s.night || s.boost > 1,
    mpv: () => ['alimiter=limit=0.95'],
    web: ctx => { const c = compressor(ctx, { threshold: -1.5, knee: 0, ratio: 20, attack: 0.002, release: 0.1 }); return { input: c, output: c }; },
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

  /** The timers stopped, for an engine being taken down. */
  destroy () { for (const t of this._fading.values()) clearTimeout(t); this._fading.clear(); }
}
