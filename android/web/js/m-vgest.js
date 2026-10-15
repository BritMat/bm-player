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
 *
 * v3.43.2, smoother: a swipe that starts at an edge of the screen is left to
 * Android (its Back, Home and the bars), and only a tap counts there. The
 * direction is settled after 16 pixels and counted from there, so nothing
 * jumps by those first pixels. Brightness starts from the phone's real level
 * (Xiaomi phones count it past 255, which read as more than full, and a
 * swipe down did nothing for a long way), goes to Android once a frame, not
 * on every move, and the ends are felt. Volume and brightness show as
 * percentages. A sideways swipe moves the seek bar too, and one Android
 * takes over (its Back from an edge) puts the film back where it was.
 */
// Android's own swipes start at the edges: Back at the sides, the bars and Home at the top and bottom.
export const EDGE = { side: 24, top: 36, bottom: 48 };
const LOCK = 16;   // pixels before a swipe settles its direction
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

// One change a frame for each kind (brightness, volume, boost), the newest.
const pending = new Map();
let frame = 0;
function later (k, fn) {
  pending.set(k, fn);
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; const fns = [...pending.values()]; pending.clear(); for (const f of fns) { try { f(); } catch (_) {} } });
}
/** A short buzz when a swipe reaches an end (or the boost), once each time. */
function felt (g, at) {
  if (at && at !== g.felt) { try { navigator.vibrate?.(at === 'boost' ? 8 : 14); } catch (_) {} }
  g.felt = at;
}

/**
 * Touch on el, for a player: api = { locked(), toggleUi(), showUnlock(),
 * jump(seconds, side), playPause(), time(), duration(), seekTo(t, final),
 * speedHold(on), zoom(scale, panX, panY), boost(percent) | null (no mpv),
 * preview(t | null): the seek bar shows where a sideways swipe is going }.
 */
export function wireGestures (el, api) {
  const pts = new Map();
  let g = null, tapT = 0, lastTap = { at: 0, side: 0, n: 0 }, holdT = 0;

  const side = x => { const w = window.innerWidth; return x < w * 0.38 ? -1 : x > w * 0.62 ? 1 : 0; };

  el.addEventListener('pointerdown', e => {
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
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
    const W = window.innerWidth, H = window.innerHeight;
    const edge = e.clientX < EDGE.side || e.clientX > W - EDGE.side || e.clientY < EDGE.top || e.clientY > H - EDGE.bottom;
    g = { x0: e.clientX, y0: e.clientY, t0: performance.now(), kind: null, moved: false, edge };
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
    let dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.kind) {
      if (Math.hypot(dx, dy) < LOCK) return;
      g.moved = true; clearTimeout(holdT);
      if (g.edge) { g.kind = 'none'; return; }                  // Android's: Back, Home, the bars
      // counted from here, so the value does not jump by the first pixels
      g.x0 = e.clientX; g.y0 = e.clientY; dx = 0; dy = 0;
      if (Math.abs(e.clientX - p.sx) > Math.abs(e.clientY - p.sy) * 1.3) { if (!on.seek || !(api.duration() > 0)) { g.kind = 'none'; return; } g.kind = 'seek'; g.t0v = api.time(); }
      else {
        const s = p.sx < window.innerWidth / 2 ? 'brightness' : 'volume';
        if (!on[s]) { g.kind = 'none'; return; }
        g.kind = s;
        if (s === 'brightness') { const b = +call('screenBrightness'); g.v0 = isFinite(b) && b > 0 ? Math.min(1, b) : 0.5; }
        else { let v = {}; try { v = JSON.parse(call('volume') || '{}'); } catch (_) {} g.max = v.max || 15; g.v0 = Math.min(g.max, v.v ?? 7) + (api.boost ? (api.boostNow?.() || 100) - 100 : 0) / 100 * g.max; }
      }
    }
    // A full swipe of 60% of the screen's height goes from one end to the other.
    const span = Math.max(220, window.innerHeight * 0.6);
    if (g.kind === 'seek') {
      const d = api.duration(), range = Math.min(d, 120 + d * 0.05);
      const t = Math.max(0, Math.min(d - 0.5, g.t0v + dx / window.innerWidth * range));
      g.t = t;
      const delta = t - g.t0v;
      hud(delta < 0 ? 'rew' : 'fwd', (delta < 0 ? '-' : '+') + fmtTime(Math.abs(delta)), fmtTime(t) + ' / ' + fmtTime(d), t / d);
      api.preview?.(t);
      api.seekTo(t, false);
    } else if (g.kind === 'brightness') {
      const v = Math.max(0.01, Math.min(1, g.v0 - dy / span));
      if (v !== g.v) { g.v = v; later('brightness', () => call('brightness', v)); }
      felt(g, v <= 0.01 ? 'low' : v >= 1 ? 'high' : '');
      hud('sun', Math.round(v * 100) + '%', 'Brightness', v);
    } else if (g.kind === 'volume') {
      // in steps of the phone's own volume, then a boost above it with mpv
      const top = api.boost ? g.max * 1.5 : g.max;
      const v = Math.max(0, Math.min(top, g.v0 - dy / span * g.max));
      const sys = Math.min(g.max, Math.round(v)), boost = api.boost ? Math.round(100 + Math.max(0, v - g.max) / g.max * 100) : 100;
      if (sys !== g.sys) { g.sys = sys; later('volume', () => call('setVolume', sys)); }
      if (api.boost && boost !== g.boost) { g.boost = boost; later('boost', () => api.boost(boost)); }
      felt(g, sys === 0 ? 'low' : v >= top ? 'high' : boost > 100 ? 'boost' : '');
      hud(sys === 0 ? 'volMuted' : 'volHigh', boost > 100 ? `Boost ${boost}%` : Math.round(sys / g.max * 100) + '%', boost > 100 ? 'Louder than the phone can go: may distort' : 'Volume', Math.min(1, v / g.max));
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
    // Taken over by Android (its Back from an edge): the film goes back where it was.
    if (was.kind === 'seek') { const back = e.type === 'pointercancel'; api.seekTo(back ? was.t0v : was.t, true); api.preview?.(null); hudOff(back ? 0 : 650); return; }
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
