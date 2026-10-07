/**
 * viz-beat: when the music hits (v3.36.0).
 *
 * Every style has something it does on a beat: HD Flow's emitters dash, Smoke
 * puffs harder, Neon throws sparks, Bubbles lets a cluster go. They all asked
 * the same question, "is the bass a fifth louder than it was a moment ago?",
 * of a level read off the analyser's decibel scale. On that scale music with
 * any bass at all sits within a few hundredths of the top the whole time (a
 * kick drum is 0.98 of full, and so is the bass line between two kicks), so
 * the answer was nearly always no. Counted on the test track: 6 beats found
 * in 24 seconds, four of them in the intro, where there is no drum at all, and
 * none in the eight seconds where everything plays.
 *
 * This listens to the sound itself: the waveform the analyser hands over.
 * Its energy is followed, mostly of what is below about 150 Hz (the drum, the
 * bass) and a fifth of the rest (a snare, a strum: music with no bass has
 * beats too). A beat is where that energy
 *   - stands 30% above the highest it has been in the last twelfth of a
 *     second, and above it by a good share of its usual size. A held note or
 *     chord goes up and down by itself many times a second (two low notes a
 *     fifth apart do it 33 times), but hardly above where it has just been
 *   - stands a quarter above its own average of the last second or so, which
 *     lets most of the quieter notes between two drum hits pass
 *   - has dipped since the last beat
 *   - is not the hiss of a silent passage
 * and no sooner than a fifth of a second after the last one. How hard a beat
 * is, is measured against the hardest of the last few seconds, so a drum in
 * dense, loud music counts for as much as one in a sparse piece.
 *
 * The pieces have to join up. An analyser does not get its sound smoothly:
 * it comes in blocks of 128 samples, several at once each time the sound card
 * asks (480 samples every 10 ms is usual on Windows). So between two frames
 * it has moved on by one such batch, or two, or none: never by "the time that
 * passed". Taking the time that passed for it replayed or skipped a stretch
 * on nearly every frame, which in a held low note is a jolt, and jolts were
 * counted: nine beats in eight and a half seconds of a steady hum, on a 144 Hz
 * screen.
 * So the end of what was heard last time is looked for in what is here now,
 * and where it sits says exactly how much is new.
 *
 * It is not a metronome. A bass note between two drum hits can count, softly,
 * and so can each wave of a deep, slow tremolo: those are pulses in the music
 * too.
 *
 * It does not depend on the analyser's smoothing (a setting) nor on how many
 * frames a second are drawn, and it is plain arithmetic on an array, so
 * scripts/smoke-renderer.mjs runs it on made-up music, fed in batches as a
 * real analyser feeds it, and counts.
 */
const TAIL = 48;   // how much of the last piece is looked for in the next

export class BeatTracker {
  constructor () {
    this.n = 0;            // beats so far: a style remembers the last one it answered
    this.at = -1e9;        // when the last one landed (ms)
    this.strength = 0;     // how hard that one was against the hardest lately, 0.3 to 1
    this.punch = 0;        // that strength, dying away over a sixth of a second: 1 on a hard hit, 0 between
    this._t = -1e9; this._hist = []; this._slow = -1;
    this._l1 = 0; this._l2 = 0; this._lo = 0; this._hi = 0;   // the filters, and the two energies they follow
    this._top = 0; this._armed = true; this._best = 1;
    this._tail = new Float32Array(TAIL); this._has = false; this._hold = 0;
  }

  /**
   * The latest waveform (numbers from -1 to 1), its sample rate, and the time
   * in milliseconds. True on the frame a beat lands.
   */
  update (samples, rate, now) {
    const n = samples ? samples.length : 0, sr = rate || 44100;
    const gap = (now - this._t) / 1000, dt = Math.min(0.25, Math.max(0, gap)); this._t = now;
    this.punch *= Math.exp(-dt / 0.16);
    if (n < TAIL * 2) { this._has = false; return false; }
    // After a pause, or the first time, it starts again from what is here.
    const again = !(gap >= 0 && gap < 0.25) || !this._has;
    // How much is new: the end of the last piece, found in this one. Sound that
    // repeats (a held note, silence) matches in several places, and the one
    // nearest to the time that passed is taken. Found nowhere, the analyser has
    // moved on by more than it holds (few frames a second, or a jump in the
    // song): all of it is new, with a hole before it.
    let fresh = n, joined = false;
    if (!again) {
      const T = this._tail, want = dt * sr; let best = -1, off = Infinity;
      for (let p = n; p >= TAIL; p--) {
        if (samples[p - 1] !== T[TAIL - 1]) continue;
        let same = true; for (let j = 2; j <= TAIL; j++) if (samples[p - j] !== T[TAIL - j]) { same = false; break; }
        if (!same) continue;
        const d = Math.abs(n - p - want);
        if (d < off) { off = d; best = n - p; } else if (n - p > want) break;
      }
      if (best >= 0) { fresh = best; joined = true; }
    }
    this._tail.set(samples.subarray(n - TAIL)); this._has = true;
    if (joined && fresh === 0) return false;        // nothing new has arrived since the last frame
    // Two gentle low-pass filters in a row leave what is under about 150 Hz, and
    // each energy is smoothed over a fiftieth of a second. Across a hole the
    // filters are given the first quarter of the piece to settle before the
    // energies are fed again: a filter started in the middle of a low note
    // rings, and the ring is not the music.
    const a = 1 - Math.exp(-2 * Math.PI * 150 / sr), ae = 1 - Math.exp(-1 / (0.02 * sr));
    let l1 = this._l1, l2 = this._l2, lo = this._lo, hi = this._hi, i = n - fresh;
    if (!joined) {
      const settle = n >> 2; l1 = l2 = samples[0];
      for (; i < settle; i++) { const x = samples[i]; l1 += (x - l1) * a; l2 += (l1 - l2) * a; }
      if (again) {                                   // and the energies start at what this piece holds, not at nothing
        let sl = 0, sh = 0, m1 = l1, m2 = l2;
        for (let k = settle; k < n; k++) { const x = samples[k]; m1 += (x - m1) * a; m2 += (m1 - m2) * a; const h = x - m2; sl += m2 * m2; sh += h * h; }
        lo = sl / (n - settle); hi = sh / (n - settle);
      }
    }
    // The highest the energy got in this piece is kept as well as where it ends:
    // a held chord's energy swings many times a second, and looking only at
    // where each piece ends would miss most of its tops.
    let peak = 0;
    for (; i < n; i++) {
      const x = samples[i]; l1 += (x - l1) * a; l2 += (l1 - l2) * a;
      const h = x - l2; lo += (l2 * l2 - lo) * ae; hi += (h * h - hi) * ae;
      const e = lo + 0.2 * hi; if (e > peak) peak = e;
    }
    this._l1 = l1; this._l2 = l2; this._lo = lo; this._hi = hi;
    const E = lo + 0.2 * hi, H = this._hist;
    if (again) {
      // No beat for having started, nor in the first third of a second, while the
      // energies find their level: it is in the middle of the music as likely as not.
      H.length = 0; H.push(now, peak); this._slow = E; this._top = E; this._armed = true; this._hold = now + 300;
      return false;
    }
    // the highest it has been between a fortieth and a twelfth of a second ago
    let ref = -1, last = E;
    for (let k = H.length - 2; k >= 0; k -= 2) {
      const age = now - H[k];
      if (age > 80) { if (ref < 0) ref = H[k + 1]; break; }
      if (age >= 25 && H[k + 1] > ref) ref = H[k + 1];
      last = H[k + 1];
    }
    if (ref < 0) ref = last;
    H.push(now, peak); while (H.length > 2 && (now - H[0] > 300 || H.length > 128)) H.splice(0, 2);
    const slow = this._slow;
    this._slow += (E - slow) * (1 - Math.exp(-dt / 0.7));
    this._best = Math.max(0.6, this._best * Math.exp(-dt / 5));     // the hardest hit lately, forgotten over some seconds
    // armed again once it has dipped a fifth below its highest since the last beat
    if (E > this._top) this._top = E;
    if (!this._armed && E < this._top * 0.8 + 1e-9) this._armed = true;
    if (!(this._armed && now >= this._hold && E > 2e-5 && E > ref * 1.3 && E - ref > slow * 0.3 && E > slow * 1.25 && now - this.at > 190)) return false;
    this.n++; this.at = now; this._armed = false; this._top = E;
    const hard = Math.min(2, Math.log2(E / (slow + 1e-9)));       // four times its average and over is as hard as it gets
    if (hard > this._best) this._best = hard;
    this.strength = Math.max(0.3, Math.min(1, hard / this._best));
    this.punch = Math.max(this.punch, this.strength);
    return true;
  }
}
