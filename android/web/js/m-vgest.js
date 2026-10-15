/**
 * m-vgest (v3.42.0): the video player's touch, as MX Player has it.
 *
 *   tap             the controls, on or off
 *   double tap      left side back 10 seconds, right side forward (each
 *                   more tap 10 more), the middle play or pause
 *   swipe up, down  the left half the brightness, the right half the volume,
 *                   past full a boost to 150% (mpv only)
 *   swipe sideways  moves through the video, showing where to
 *   pinch           zoom (and with two fingers, move the picture about)
 *   hold            twice as fast while held
 *
 * Locked (the lock button), touches do nothing but show the unlock button.
 * What a swipe changes shows in the middle of the screen (the HUD). Each
 * kind can be turned off in Settings (gestures()).
 */
import { $, fmtTime } from './m-ui.js';
import { ICONS } from './icons.js';
import { call } from './m-android.js';

const PREF = 'bm_m_gest';
/** Which gestures are on: { seek, brightness, volume, zoom, hold, doubleTap }. */
export function gestures () {
  let g = {};
  try { g = JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch (_) {}
  return { seek: g.seek !== false, brightness: g.brightness !== false, volume: g.volume !== false, zoom: g.zoom !== false, hold: g.hold !== false, doubleTap: g.doubleTap !== false };
}
export function setGesture (k, on) { const g = gestures(); g[k] = !!on; try { localStorage.setItem(PREF, JSON.stringify(g)); } catch (_) {} }

let hudT = 0;
/** Shows what is being changed: an icon, a big line, a small one, and a bar from 0 to 1 (or none). */
export function hud (icon, text, sub = '', frac = null) {
  const el = $('vp-hud');
  $('vp-hud-ico').innerHTML = ICONS[icon] || '';
  $('vp-hud-txt').textContent = text;
  $('vp-hud-sub').textContent = sub;
  const bar = $('vp-hud-bar');
  bar.classList.toggle('hidden', frac == null);
  if (frac != null) bar.firstElementChild.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  el.classList.add('on');
  clearTimeout(hudT);
}
export function hudOff (ms = 650) { clearTimeout(hudT); hudT = setTimeout(() => $('vp-hud').classList.remove('on'), ms); }

/**
 * Touch on el, for a player: api = { locked(), toggleUi(), showUnlock(),
 * jump(seconds, side), playPause(), time(), duration(), seekTo(t, final),
 * speedHold(on), zoom(scale, panX, panY), boost(percent) | null (no mpv) }.
 */
export function wireGestures (el, api) {
  const pts = new Map();
  let g = null, tapT = 0, lastTap = { at: 0, side: 0, n: 0 }, holdT = 0;

  const side = x => { const w = window.innerWidth; return x < w * 0.38 ? -1 : x > w * 0.62 ? 1 : 0; };

  el.addEventListener('pointerdown', e => {
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (api.locked()) { g = { locked: true }; return; }
    if (pts.size === 2) {
      // a pinch starts: whatever one finger was doing stops
      clearTimeout(holdT);
      if (g?.hold) api.speedHold(false);
      const [a, b] = [...pts.values()];
      g = { pinch: true, d0: Math.hypot(a.x - b.x, a.y - b.y), z0: api.zoomNow?.() || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, px0: api.panNow?.()[0] || 0, py0: api.panNow?.()[1] || 0 };
      return;
    }
    if (pts.size > 2) return;
    g = { x0: e.clientX, y0: e.clientY, t0: performance.now(), kind: null, moved: false };
    const on = gestures();
    if (on.hold) holdT = setTimeout(() => { if (g && !g.kind && !g.moved) { g.kind = 'hold'; g.hold = true; api.speedHold(true); } }, 520);
  });

  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (!g || g.locked) return;
    const on = gestures();
    if (g.pinch) {
      if (!on.zoom || pts.size < 2) return;
      const [a, b] = [...pts.values()];
      const z = Math.max(1, Math.min(4, g.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.d0)));
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const panX = z > 1.01 ? g.px0 + (cx - g.cx) / window.innerWidth / z : 0, panY = z > 1.01 ? g.py0 + (cy - g.cy) / window.innerHeight / z : 0;
      api.zoom(z, panX, panY);
      hud('zoomIn', Math.round(z * 100) + '%', 'Zoom');
      return;
    }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.kind) {
      if (Math.hypot(dx, dy) < 14) return;
      g.moved = true; clearTimeout(holdT);
      if (Math.abs(dx) > Math.abs(dy) * 1.2) { if (!on.seek || !(api.duration() > 0)) { g.kind = 'none'; return; } g.kind = 'seek'; g.t0v = api.time(); }
      else {
        const s = g.x0 < window.innerWidth / 2 ? 'brightness' : 'volume';
        if (!on[s]) { g.kind = 'none'; return; }
        g.kind = s;
        if (s === 'brightness') { const b = +call('screenBrightness'); g.v0 = isFinite(b) && b >= 0 ? b : 0.5; }
        else { let v = {}; try { v = JSON.parse(call('volume') || '{}'); } catch (_) {} g.max = v.max || 15; g.v0 = (v.v ?? 7) + (api.boost ? (api.boostNow?.() || 100) - 100 : 0) / 100 * g.max; }
      }
    }
    const H = Math.max(240, window.innerHeight * 0.75);
    if (g.kind === 'seek') {
      const d = api.duration(), span = Math.min(d, 120 + d * 0.05);
      const t = Math.max(0, Math.min(d - 0.5, g.t0v + dx / window.innerWidth * span));
      g.t = t;
      const delta = t - g.t0v;
      hud(delta < 0 ? 'rew' : 'fwd', (delta < 0 ? '-' : '+') + fmtTime(Math.abs(delta)), fmtTime(t) + ' / ' + fmtTime(d), t / d);
      api.seekTo(t, false);
    } else if (g.kind === 'brightness') {
      const v = Math.max(0.01, Math.min(1, g.v0 - dy / H));
      call('brightness', v);
      hud('sun', Math.round(v * 100) + '%', 'Brightness', v);
    } else if (g.kind === 'volume') {
      // in steps of the phone's own volume, then a boost above it with mpv
      const top = api.boost ? g.max * 1.5 : g.max;
      const v = Math.max(0, Math.min(top, g.v0 - dy / H * g.max * 1.2));
      const sys = Math.min(g.max, Math.round(v)), boost = api.boost ? Math.round(100 + Math.max(0, v - g.max) / g.max * 100) : 100;
      if (sys !== g.sys) { g.sys = sys; call('setVolume', sys); }
      if (api.boost && boost !== g.boost) { g.boost = boost; api.boost(boost); }
      hud(sys === 0 ? 'volMuted' : 'volHigh', boost > 100 ? `Boost ${boost}%` : String(sys), boost > 100 ? 'Louder than the phone can go: may distort' : 'Volume', Math.min(1, v / g.max));
    }
  });

  const end = e => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    clearTimeout(holdT);
    if (!g) return;
    if (g.locked) { if (!pts.size) { g = null; api.showUnlock(); } return; }
    if (g.pinch) { if (!pts.size) { g = null; hudOff(); } return; }
    const was = g; g = null;
    if (was.hold) { api.speedHold(false); hudOff(200); return; }
    if (was.kind === 'seek') { api.seekTo(was.t, true); hudOff(); return; }
    if (was.kind) { hudOff(); return; }
    if (e.type === 'pointercancel' || !p) return;
    // a tap: wait a moment for a second one
    const now = performance.now(), s = side(p.x), dbl = gestures().doubleTap;
    if (dbl && now - lastTap.at < 300 && s === lastTap.side) {
      clearTimeout(tapT);
      lastTap.n++; lastTap.at = now;
      if (s) api.jump(10 * s, s, lastTap.n);
      else api.playPause();
      return;
    }
    // more taps on the same side, a little later, keep jumping
    if (dbl && s && lastTap.side === s && lastTap.n >= 1 && now - lastTap.at < 650) { lastTap.n++; lastTap.at = now; api.jump(10 * s, s, lastTap.n); return; }
    lastTap = { at: now, side: s, n: 0 };
    clearTimeout(tapT);
    tapT = setTimeout(() => api.toggleUi(), dbl ? 260 : 0);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
