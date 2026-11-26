/**
 * m-sound (v3.49.0, Sound lab): the sound modes, clear voice and night mode
 * on the phone, one sheet for the music and the videos, kept together
 * (m-player.js sound()). The music hears them through the engine, in Web
 * Audio as on the desktop, and a video through mpv's audio filter, made by the
 * same sound-chain.js the desktop gives its mpv, and let through by Java
 * only when it is made of that file's own filters (AfGuard.java).
 *
 * Slowed and Nightcore also play the music slower or faster, the pitch
 * following, as a record would. A video keeps its own speed: Slowed gives
 * it the reverb only, and Nightcore nothing.
 */
import { MODES, VOICES, lavfi } from './sound-chain.js';
import { player } from './m-player.js';
import { sheet } from './m-ui.js';

export const modeName = m => (MODES.find(x => x[0] === m) || MODES[0])[1];

/** What the sheet's row says: the mode, and clear voice and night mode when on. */
export function soundNote () {
  const s = player.sound();
  const vfx = VOICES.find(x => x[0] === s.voicefx && x[0] !== 'off');
  return [s.mode !== 'off' ? modeName(s.mode) : '', s.voice ? 'Clear voice' : '', s.night ? 'Night' : '', s.key ? 'Key ' + (s.key > 0 ? '+' : '') + s.key : '', vfx ? vfx[1] : ''].filter(Boolean).join(', ') || 'Normal';
}

/** mpv's audio filter for a video, from what is kept ('' for none). */
export function videoAf () {
  const s = player.sound();
  return lavfi({ mode: s.mode, voice: s.voice, night: s.night, key: s.key, voicefx: s.voicefx, headroom: s.headroom, crossfeed: s.crossfeed });   // v3.59.0: the key, the voice changer, headroom and crossfeed too
}

const chips = (key, list, cur) => `<div class="eq-presets snd-chips" role="group">${list.map(([k, l]) => `<button type="button" class="chip${k === cur ? ' on' : ''}" data-${key}="${k}" aria-pressed="${k === cur}">${l}</button>`).join('')}</div>`;

/** film: opened from the video player, where the speed is the video's own. */
export function soundSheet ({ film = false } = {}) {
  const cur = player.sound(), onOff = [['off', 'Off'], ['on', 'On']];
  const body = document.createElement('div');
  body.className = 'snd';
  body.innerHTML = '<div class="snd-h">Sound mode</div>' + chips('mode', MODES, cur.mode) +
    `<p class="snd-note">${film ? 'Slowed and Nightcore change the speed of music only. A video keeps its own speed (Slowed gives it the reverb).' : 'Slowed and Nightcore play songs slower or faster, lower or higher, as a record would.'}</p>` +
    '<div class="snd-h">Clear voice</div>' + chips('voice', onOff, cur.voice ? 'on' : 'off') +
    '<p class="snd-note">Brings the words forward over the music and the bangs, for films.</p>' +
    '<div class="snd-h">Night mode</div>' + chips('night', onOff, cur.night ? 'on' : 'off') +
    '<p class="snd-note">Quiet voices come up and loud bangs come down, for late at night.</p>' +
    // v3.59.0: the key, the speed kept, and a voice changer (sound-chain.js)
    `<div class="snd-h">Key <span class="snd-key-val" data-key-val>${cur.key > 0 ? '+' : ''}${cur.key}</span></div>` + chips('step', [['-1', 'Lower'], ['1', 'Higher'], ['0', 'As made']], '') +
    '<p class="snd-note">Higher or lower a semitone at a time, at the same speed.</p>' +
    '<div class="snd-h">Voice changer</div>' + chips('vfx', VOICES, cur.voicefx) +
    // v3.59.0: hi-fi
    '<div class="snd-h">No clipping</div>' + chips('headroom', onOff, player.hifiGet().headroom ? 'on' : 'off') +
    '<p class="snd-note">The sound lowered by as much as the equaliser lifts it, and a limiter that stops it going past full, the peaks between samples too.</p>' +
    '<div class="snd-h">Crossfeed</div>' + chips('crossfeed', onOff, player.hifiGet().crossfeed ? 'on' : 'off') +
    '<p class="snd-note">For headphones: the lows reach both ears, as from speakers.</p>' +
    (film ? '' : '<div class="snd-h">Pure</div>' + chips('pure', onOff, player.hifiGet().pure ? 'on' : 'off') +
    '<p class="snd-note">Songs go to Android at their own rate with nothing in the way: no equaliser, effects or visualiser.</p>') +
    `<p class="snd-note snd-path" data-path>${player.signal()}</p>`;
  // every chip from what is kept, after each tap
  const mark = () => {
    const s = player.sound();
    for (const c of body.querySelectorAll('button.chip')) {
      const [key] = Object.keys(c.dataset);
      if (key === 'step') continue;
      const hf = player.hifiGet();
      const on = key === 'mode' ? c.dataset.mode === s.mode : key === 'vfx' ? c.dataset.vfx === s.voicefx : ['headroom', 'crossfeed', 'pure'].includes(key) ? (c.dataset[key] === 'on') === !!hf[key] : (c.dataset[key] === 'on') === !!s[key];
      c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on));
    }
  };
  body.addEventListener('click', e => {
    const b = e.target.closest('button.chip'); if (!b) return;
    const [key] = Object.keys(b.dataset);
    const val = b.dataset[key];
    if (key === 'step') { const k = val === '0' ? 0 : player.sound().key + (+val); player.setSound({ key: k }); const v = body.querySelector('[data-key-val]'); if (v) { const n = player.sound().key; v.textContent = (n > 0 ? '+' : '') + n; } }
    else if (key === 'vfx') player.setSound({ voicefx: val });
    else if (['headroom', 'crossfeed', 'pure'].includes(key)) player.setHifi({ [key]: val === 'on' });
    else player.setSound(key === 'mode' ? { mode: val } : { [key]: val === 'on' });
    mark();
    setTimeout(() => { const p = body.querySelector('[data-path]'); if (p) p.textContent = player.signal(); }, 300);
  });
  sheet({ title: 'Sound', sub: film ? 'For this video and the music.' : 'For the music and the videos.', body, wide: true });
}
