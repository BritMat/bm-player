/**
 * range-fill: volume sliders filled with the theme's colours up to the thumb
 * (v3.25.3). The track reads --fill, the thumb's position along it: volume
 * goes to 130, so 75 is about 58% of the track, where the thumb sits.
 *
 * Scripts set .value directly when the volume changes elsewhere (keys, the
 * wheel, mpv), which fires no event, so each slider's value setter is wrapped
 * to update the fill whatever sets it.
 */
const SLIDERS = ['volume-slider', 'np-volume', 'ctx-vol'];
// Looked up when first needed: the renderer smoke test loads app.js in a
// simulated page with no HTMLInputElement, and a lookup here stopped the import.
const proto = () => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

export function fillOf(input) {
  const min = +input.min || 0, max = +input.max || 100, v = +proto().get.call(input);
  return Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100));
}

export function trackFill(input) {
  if (!input || input.dataset?.fill === 'on' || typeof HTMLInputElement === 'undefined') return;
  const p = proto();
  const update = () => input.style.setProperty('--fill', fillOf(input).toFixed(2) + '%');
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return p.get.call(this); },
    set(v) { p.set.call(this, v); update(); },
  });
  input.addEventListener('input', update);
  input.dataset.fill = 'on';
  update();
}

const attach = () => SLIDERS.forEach(id => trackFill(document.getElementById(id)));
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
}
