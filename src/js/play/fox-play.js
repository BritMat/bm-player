/**
 * FoxPlay: playing with the fox (v3.42.0), in the way of a talking pet.
 *
 *   tap the nose        a boop, and now and then a sneeze
 *   tap an eye          it blinks and turns away: "hey!"
 *   tap an ear          the ear flicks
 *   tap the head        a bonk: it ducks, stars
 *   tap a cheek         it turns away shyly, a heart
 *   tap the chin/chest  it is tickled and giggles
 *   three quick taps    it laughs
 *   stroke it           it leans into your hand, eyes half shut, and purrs
 *   hold it             a hug
 *   flick across it     it spins and is dizzy for a moment
 *   leave it alone      it yawns, and later dozes off; a tap wakes it
 *   play music          it nods along
 *
 * The parts are found on the fox as it is drawn (Fox3D.hit), the sounds
 * are made as they play (sfx.js), and the little hearts, stars and z's are
 * elements in `fx` that CSS animates (play.css). Nothing runs while the
 * home screen is away: pause() stops the idle clock too.
 *
 * Shared by the desktop's welcome screen and the phone's home tab.
 */
import { sfx } from './sfx.js';

const ICON = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.6.7-1.4 2.2-2.6 4.3-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" fill="currentColor"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M9 17.5a3 3 0 1 1-2-2.8V4l11-2v12.5a3 3 0 1 1-2-2.8V6.2l-7 1.3z" fill="currentColor"/></svg>',
  z: '<span>z</span>',
};

export class FoxPlay {
  /**
   * stage: the element the fox is drawn in (it takes the touches). fox: a
   * Fox3D or GeoFox. fx: an element over the stage for the little effects.
   * onPlay(kind): told of each play, for a hint to change.
   */
  constructor ({ stage, fox, fx, onPlay = null }) {
    this.stage = stage; this.fox = fox; this.fx = fx; this.onPlay = onPlay;
    this.active = false; this._taps = []; this._p = null; this._last = performance.now(); this._yawned = 0; this._sparks = 0;
    this._noteAt = 0; this._zAt = 0; this._music = 0;
    this._down = e => this._onDown(e);
    this._move = e => this._onMove(e);
    this._up = e => this._onUp(e);
    stage.addEventListener('pointerdown', this._down);
    stage.addEventListener('pointermove', this._move);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(ev, this._up);
  }

  resume () {
    if (this.active) return;
    this.active = true; this._last = performance.now();
    this._idleT = setInterval(() => this._idle(), 1000);
  }
  pause () {
    this.active = false;
    clearInterval(this._idleT);
    this._endStroke();
  }
  destroy () {
    this.pause();
    this.stage.removeEventListener('pointerdown', this._down);
    this.stage.removeEventListener('pointermove', this._move);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) this.stage.removeEventListener(ev, this._up);
  }

  /** The music's loudness, 0 to 1, a few times a second: the fox nods along. */
  setMusic (level) {
    this._music = level;
    this.fox.setMusicEnergy?.(level);
    const now = performance.now();
    if (level > 0.12) this._last = Math.max(this._last, now - 20000);       // music keeps it awake
    if (level > 0.5 && now - this._noteAt > 1600 && this.active) { this._noteAt = now; this._spark('note', null, null, 1); }
  }

  /** Something happened with the fox from elsewhere (the voice): it is awake. */
  poke () { this._last = performance.now(); if (this.fox.asleep) this.fox.setSleep(false); }

  _wake () {
    const was = this.fox.asleep;
    this._last = performance.now();
    if (was) { this.fox.setSleep(false); this.fox.react('surprise'); sfx.play('pop'); this.onPlay?.('wake'); }
    return was;
  }

  _onDown (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hit = this.fox.hit?.(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    try { this.stage.setPointerCapture(e.pointerId); } catch (_) {}
    const now = performance.now();
    this._p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: now, t: now, hit, dist: 0, petting: false, flicked: false, held: false, woke: this._wake() };
    clearTimeout(this._holdT);
    this._holdT = setTimeout(() => {
      const p = this._p;
      if (!p || p.petting || p.dist > 14) return;
      p.held = true;
      this.fox.react('hug'); sfx.play('heart');
      this._stopPurr = sfx.purr();
      this._spark('heart', p.x, p.y, 2);
      this.onPlay?.('hug');
    }, 650);
  }

  _onMove (e) {
    const p = this._p;
    if (!p || p.id !== e.pointerId) return;
    const now = performance.now(), dx = e.clientX - p.x, dy = e.clientY - p.y, d = Math.hypot(dx, dy), dt = Math.max(1, now - p.t);
    p.dist += d; p.x = e.clientX; p.y = e.clientY; p.t = now;
    this.fox.lookAt?.(e.clientX, e.clientY);
    const v = d / dt;                                       // px per ms
    if (!p.flicked && v > 1.8 && p.dist > 70) {
      p.flicked = true; clearTimeout(this._holdT); this._endStroke();
      this.fox.react('dizzy', { side: dx < 0 ? -1 : 1 });
      sfx.play('whoosh');
      this._spark('star', p.x, p.y, 3);
      this.onPlay?.('spin');
      return;
    }
    if (p.flicked) return;
    if (!p.petting && p.dist > 26 && v < 1.4) {
      p.petting = true; clearTimeout(this._holdT);
      if (!this._stopPurr) this._stopPurr = sfx.purr();
      this.onPlay?.('pet');
    }
    if (p.petting) {
      this.fox.pet(1, dx);
      this._last = now;
      if (now - (p.heartAt || 0) > 520) { p.heartAt = now; this._spark('heart', p.x, p.y - 10, 1); }
    }
  }

  _onUp (e) {
    const p = this._p;
    if (!p || (e.pointerId !== undefined && p.id !== e.pointerId)) return;
    this._p = null;
    clearTimeout(this._holdT);
    const now = performance.now();
    if (p.petting || p.held) { this._endStroke(); this.fox.react('happy'); if (p.petting) sfx.play('heart'); return; }
    if (p.flicked || p.woke) return;
    if (p.dist < 18 && now - p.t0 < 420) this._tap(p.hit, p.x, p.y);
  }

  _endStroke () { if (this._stopPurr) { this._stopPurr(); this._stopPurr = null; } }

  _tap (hit, x, y) {
    const now = performance.now();
    this._taps = this._taps.filter(t => now - t < 1100);
    this._taps.push(now);
    if (this._taps.length >= 3) {
      this._taps = [];
      this.fox.react('laugh'); sfx.play('laugh'); this._spark('star', x, y, 2);
      this.onPlay?.('laugh');
      return;
    }
    const side = hit.side || 1;
    switch (hit.part) {
      case 'nose':
        if (Math.random() < 0.3) { this.fox.react('sneeze'); setTimeout(() => sfx.play('sneeze'), 0); }
        else { this.fox.react('boop'); sfx.play('boop'); }
        break;
      case 'eye': this.fox.react('eye', { side }); sfx.play('hey'); break;
      case 'ear': this.fox.react('ear', { side }); sfx.play('squeak'); break;
      case 'cheek': this.fox.react('cheek', { side }); sfx.play('giggle'); this._spark('heart', x, y, 1); break;
      case 'chin': case 'chest': this.fox.react('tickle'); sfx.play('giggle'); break;
      default: this.fox.react('bonk'); sfx.play(Math.random() < 0.5 ? 'boing' : 'bonk'); this._spark('star', x, y - 20, 3);
    }
    this.onPlay?.(hit.part);
  }

  _idle () {
    if (!this.active) return;
    const quiet = (performance.now() - this._last) / 1000;
    if (this._p) return;
    if (this.fox.asleep) {
      if (performance.now() - this._zAt > 2300) { this._zAt = performance.now(); this._spark('z', null, null, 1); }
      return;
    }
    if (quiet > 30 && quiet - this._yawned > 30 && quiet < 48) { this._yawned = quiet; this.fox.react('yawn'); sfx.play('yawn'); }
    if (quiet > 50) { this.fox.setSleep(true); this._yawned = 0; }
  }

  /**
   * Little things floating up from (x, y) on the screen, or from the fox's
   * head: hearts, stars, notes or z's. At most a dozen on screen.
   */
  _spark (kind, x, y, n = 1) {
    const fx = this.fx; if (!fx) return;
    const r = fx.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      if (fx.childElementCount >= 12) return;
      const el = document.createElement('span');
      el.className = 'fp-spark ' + ({ heart: 'fp-heart', star: 'fp-star', note: 'fp-note', z: 'fp-z' }[kind] || '');
      el.innerHTML = ICON[kind] || '';
      const px = x == null ? r.width * (0.62 + Math.random() * 0.12) : x - r.left + (Math.random() - 0.5) * 24;
      const py = y == null ? r.height * 0.18 : y - r.top + (Math.random() - 0.5) * 16;
      el.style.left = px + 'px'; el.style.top = py + 'px';
      el.style.setProperty('--dx', ((Math.random() - 0.5) * 70).toFixed(0) + 'px');
      el.style.setProperty('--rot', ((Math.random() - 0.5) * 50).toFixed(0) + 'deg');
      el.style.animationDelay = (i * 90) + 'ms';
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 3000);
      fx.appendChild(el);
    }
  }
}
