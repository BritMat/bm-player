/**
 * m-recent (v3.42.0): what was opened last, for the Home tab's Resume and
 * its row of recent things, and where each video was left, so it carries
 * on from there (as MX Player does).
 *
 *   entry { kind: video | music | image | pdf, key, title, sub, url, id,
 *           thumb, art, t, d, at, docKey }
 *
 * Files chosen with Android's file picker are kept by Android for the app
 * (docKey: Java hands out a fresh address for them, reopen()). Files another
 * app opened in BM Player are not: those are dropped when the app starts
 * again, since their address no longer leads anywhere.
 */
const RECENT = 'bm_m_recent', POS = 'bm_m_vpos', MAX = 24, MAX_POS = 300;

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch (_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

let list = read(RECENT, []);
if (!Array.isArray(list)) list = [];
// A new start: files from other apps (no docKey) can no longer be reached.
list = list.filter(e => e && e.key && !(/^\/opened\//.test(e.url || '') && !e.docKey));
write(RECENT, list);
const listeners = new Set();

/** The things opened last, newest first. */
export const recent = () => list.slice();
/** fn() when the list changes. */
export function onRecent (fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed () { write(RECENT, list); for (const f of listeners) { try { f(); } catch (_) {} } }

/** Puts an entry at the front (replacing an older one with the same key). */
export function remember (e) {
  if (!e?.key) return;
  const old = list.find(x => x.key === e.key);
  list = [{ ...old, ...e, at: Date.now() }, ...list.filter(x => x.key !== e.key)].slice(0, MAX);
  changed();
}
/** Updates an entry in place (a video's time) without moving it. */
export function touch (key, patch) {
  const e = list.find(x => x.key === key);
  if (!e) return;
  Object.assign(e, patch);
  clearTimeout(touch._t);
  touch._t = setTimeout(changed, 400);
}
export function forget (key) { list = list.filter(x => x.key !== key); changed(); }
export function clearRecent () { list = []; changed(); }

/** A video's key: its id in the phone's library, or its name and size. */
export const videoKey = item => item?.id ? 'v' + item.id : item?.docKey ? 'd' + item.docKey : 'f' + (item?.file || item?.title || '') + ':' + (item?.size || '');

// ── where each video was left ────────────────────────────────────────
let pos = read(POS, {});
if (!pos || typeof pos !== 'object') pos = {};
/** { t, d } where the video was left, or null. */
export const position = key => pos[key] || null;
export function savePosition (key, t, d) {
  if (!key || !(d > 0)) return;
  // Near the end counts as finished: next time it starts from the beginning.
  if (t > d - 15 || t / d > 0.97) delete pos[key];
  else if (t > 5) pos[key] = { t: Math.round(t), d: Math.round(d), at: Date.now() };
  const keys = Object.keys(pos);
  if (keys.length > MAX_POS) { keys.sort((a, b) => pos[a].at - pos[b].at); for (const k of keys.slice(0, keys.length - MAX_POS)) delete pos[k]; }
  clearTimeout(savePosition._t);
  savePosition._t = setTimeout(() => write(POS, pos), 300);
}
export function clearPosition (key) { delete pos[key]; write(POS, pos); }
/** Several at once (videos deleted from the phone, v3.45.0): one write. */
export function clearPositions (keys) { let n = 0; for (const k of keys) if (k in pos) { delete pos[k]; n++; } if (n) write(POS, pos); }
/** Several entries at once, one write: those for which drop(entry) is true. */
export function forgetWhere (drop) { const n = list.length; list = list.filter(e => !drop(e)); if (list.length !== n) changed(); }
/** How far into a video, 0 to 1, for the bar under its picture. */
export const progress = key => { const p = pos[key]; return p && p.d ? Math.min(1, p.t / p.d) : 0; };

/** What Resume carries on with: the newest video or music. */
export const lastResumable = () => list.find(e => e.kind === 'video' || e.kind === 'music') || null;
