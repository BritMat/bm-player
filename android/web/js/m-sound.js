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
import { MODES, lavfi } from './sound-chain.js';
import { player } from './m-player.js';
import { sheet } from './m-ui.js';

export const modeName = m => (MODES.find(x => x[0] === m) || MODES[0])[1];

/** What the sheet's row says: the mode, and clear voice and night mode when on. */
export function soundNote () {
  const s = player.sound();
  return [s.mode !== 'off' ? modeName(s.mode) : '', s.voice ? 'Clear voice' : '', s.night ? 'Night' : ''].filter(Boolean).join(', ') || 'Normal';
}

/** mpv's audio filter for a video, from what is kept ('' for none). */
export function videoAf () {
  const s = player.sound();
  return lavfi({ mode: s.mode, voice: s.voice, night: s.night });
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
    '<p class="snd-note">Quiet voices come up and loud bangs come down, for late at night.</p>';
  // every chip from what is kept, after each tap
  const mark = () => {
    const s = player.sound();
    for (const c of body.querySelectorAll('button.chip')) {
      const [key] = Object.keys(c.dataset), on = key === 'mode' ? c.dataset.mode === s.mode : (c.dataset[key] === 'on') === !!s[key];
      c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on));
    }
  };
  body.addEventListener('click', e => {
    const b = e.target.closest('button.chip'); if (!b) return;
    const [key] = Object.keys(b.dataset);
    const val = b.dataset[key];
    player.setSound(key === 'mode' ? { mode: val } : { [key]: val === 'on' });
    mark();
  });
  sheet({ title: 'Sound', sub: film ? 'For this video and the music.' : 'For the music and the videos.', body, wide: true });
}
