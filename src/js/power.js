/**
 * power: how hard the page works (v3.39.0).
 *
 * Asked for: less power and less need of a strong machine. What draws all
 * the time is the visualiser and, on the home screen, the background (the
 * fluid, a theme's scene, the fox). Two things here, both read by the loops
 * that draw (frameGap):
 *
 *   Battery saver. On battery power (main.js tells, through Electron's
 *   powerMonitor), or always, or never, as set in Preferences. While it is
 *   on, the visualiser and the backgrounds draw at most 30 frames a second
 *   instead of 72, which about halves what they cost. Films are mpv's and
 *   are not touched.
 *
 *   Resting. The home screen's background stops after two minutes with no
 *   pointer or key and nothing playing, and starts again at the first touch.
 *   It went on drawing at full speed for as long as the app was left open.
 *
 * A window that is not in front draws its background at 30 a second too.
 */
const KEY = 'bm_battery_saver';               // 'auto' (on battery), 'on' or 'off'
const REST_AFTER = 120000;

export const power = { mode: 'auto', battery: false, saver: false, idle: false, blurred: false };
const listeners = new Set();

/** fn(power, what) whenever something here changes: what is 'saver', 'idle' or 'blurred'. */
export function onPower (fn) { listeners.add(fn); return () => listeners.delete(fn); }
function tell (what) { for (const f of listeners) { try { f(power, what); } catch (_) {} } }

/** The least time between two frames, in ms: 'viz' for the visualiser, 'decor' for the backgrounds. */
export function frameGap (kind) {
  if (power.saver) return 31;
  return kind === 'decor' && power.blurred ? 31 : 12;
}

function update () {
  const saver = power.mode === 'on' || (power.mode === 'auto' && power.battery);
  if (saver === power.saver) return;
  power.saver = saver;
  try { document.documentElement.classList.toggle('battery-saver', saver); } catch (_) {}
  tell('saver');
}

export function setSaverMode (mode) {
  power.mode = ['auto', 'on', 'off'].includes(mode) ? mode : 'auto';
  try { localStorage.setItem(KEY, power.mode); } catch (_) {}
  update();
}

export function setBattery (on) { power.battery = !!on; update(); }

/** Starts listening: the battery (api.power), input for resting, focus. playing() says whether anything plays. */
export function startPower ({ api, playing = () => false } = {}) {
  try { power.mode = ['auto', 'on', 'off'].includes(localStorage.getItem(KEY)) ? localStorage.getItem(KEY) : 'auto'; } catch (_) {}
  try { api?.power?.onBattery?.(on => { const was = power.saver; setBattery(on); if (power.saver !== was && power.mode === 'auto') window.bmApp?.showOSD?.(power.saver ? 'On battery: battery saver on' : 'Plugged in: battery saver off'); }); } catch (_) {}
  try { api?.power?.battery?.().then(on => setBattery(on)).catch(() => {}); } catch (_) {}
  update();
  let last = performance.now();
  const touch = () => { last = performance.now(); if (power.idle) { power.idle = false; tell('idle'); } };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, touch, { passive: true, capture: true });
  setInterval(() => {
    const idle = performance.now() - last > REST_AFTER && !playing();
    if (idle !== power.idle) { power.idle = idle; tell('idle'); }
  }, 10000);
  onPower((p, what) => { if (what === 'idle') { try { document.documentElement.classList.toggle('bm-resting', p.idle); } catch (_) {} } });
  window.addEventListener('blur', () => { power.blurred = true; tell('blurred'); });
  window.addEventListener('focus', () => { power.blurred = false; tell('blurred'); });
}
