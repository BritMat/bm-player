/**
 * m-vplayer: the video player (v3.47.0, from m-video.js, moved as it was).
 *
 * Videos play with mpv (v3.41.0), built into the app: MKV, MP4, AVI and
 * nearly anything else, 4K and H.265, every audio track, and subtitles in
 * the film or beside it, styled ones included. mpv draws the picture
 * behind the page (m-mpv.js) and this page draws the controls over it.
 * Where mpv cannot run, or Settings says so, the phone's web engine plays
 * them (a video element), as before: then what plays is what the phone can
 * decode. Both sit behind the same controls (eng, below).
 *
 * v3.42.0, as MX Player has it: swipes for brightness, volume (and a
 * boost) and the position, pinch to zoom, hold for double speed
 * (m-vgest.js), a lock, the picture's size (fit, fill, stretch, 100%,
 * 16:9, 4:3), the previous and next video of the folder and playing on to
 * the next, the decoder (HW, HW+, SW), speed, repeating a part (A-B), a
 * sleep timer, subtitle and sound timing, and carrying on where each video
 * was left. The clock and the battery show with the controls.
 *
 * The Videos tab (m-video.js) opens videos here (openVideo), and its ⋮ is
 * details() here, which knows the one playing.
 */
import { player } from './m-player.js';
import { $, esc, fmtTime, fmtSize, sheet, toast, pickFile, fillRange } from './m-ui.js';
import { setIcon } from './icons.js';
import { call, on } from './m-android.js';
import { awakeOn } from './m-nowplaying.js';
import { mpv, choice, codecName, trackLabel, channels } from './m-mpv.js';
import { remember, touch, videoKey, position, savePosition, clearPosition } from './m-recent.js';
import { wireGestures, hud, hudOff } from './m-vgest.js';
import { favItem, videoFav } from './m-favs.js';
import { shareItems } from './m-select.js';
import { deleteItems, canDelete } from './m-delete.js';
import { soundSheet, soundNote, videoAf } from './m-sound.js';

/** The seek bar's steps: ten thousand along the film (v3.43.2). */
const RANGE = 10000;
const v = { open: false, item: null, uiT: 0, turn: 'auto', rot: 0, fileRot: 0, aspect: 'fit', seeking: false, objectUrl: null, subUrls: [],
  waiting: false, failed: false, spinT: 0, lifted: false, besideTried: false, list: null, index: -1, locked: false,
  zoom: 1, pan: [0, 0], boost: 100, ab: { a: null, b: null }, sleepT: 0, sleepAt: 0, sleepEnd: false, held: false, speedBefore: 1,
  saveT: 0, clockT: 0, nextT: 0, lastSeek: 0, startAt: 0 };

const ASPECTS = [['fit', 'Fit'], ['fill', 'Fill (crop)'], ['stretch', 'Stretch'], ['orig', '100%'], ['16:9', '16:9'], ['4:3', '4:3']];
// What was opened, for NEW on the ones not opened yet (the tab shows it).
const SEEN = 'bm_m_vseen';
export let seen = new Set();
try { seen = new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch (_) {}
const markSeen = key => { if (seen.has(key)) return; seen.add(key); try { localStorage.setItem(SEEN, JSON.stringify([...seen].slice(-3000))); } catch (_) {} };
const autoNext = () => { try { return localStorage.getItem('bm_m_vnext') !== '0'; } catch (_) { return true; } };

/** Files Java can hand to mpv or another app: the phone's videos, and files opened or chosen through Android. */
const hasAddress = item => /^\/(media|opened)\//.test(item?.url || '');
const extOf = item => { const e = (item?.file || item?.path || '').split('.').pop().toUpperCase(); return e && e.length <= 4 ? e : ''; };

// ── the two engines, behind one set of controls ──────────────────────
const web = {
  name: 'web',
  get el () { return $('vp-video'); },
  open (item, start = 0) {
    const vid = this.el;
    vid.src = item.url;
    if (start > 0) vid.addEventListener('loadedmetadata', () => { try { vid.currentTime = start; } catch (_) {} }, { once: true });
    vid.play().catch(() => {});
  },
  close () { const vid = this.el; vid.pause(); vid.removeAttribute('src'); vid.style.transform = ''; vid.style.cssText = ''; try { vid.load(); } catch (_) {} },
  get paused () { return this.el.paused; },
  get time () { return this.el.currentTime || 0; },
  get duration () { const d = this.el.duration; return isFinite(d) ? d : 0; },
  play () { this.el.play().catch(() => {}); },
  pause () { this.el.pause(); },
  seek (t) { if (this.duration) this.el.currentTime = Math.max(0, Math.min(this.duration - 0.2, t)); },
  quickSeek (t) { this.seek(t); },
  jump (d) { this.seek(this.time + d); },
  get speed () { return this.el.playbackRate || 1; },
  setSpeed (s) { this.el.playbackRate = s; this.el.defaultPlaybackRate = s; },
  aspect () { this.layout(); },
  zoom () { this.layout(); },
  turn () { this.layout(); },
  // The picture's size, its turn (v3.48.0) and the pinch's zoom, together.
  // Turned a quarter, its box is the screen the other way round, then turned
  // about its middle, so the picture fits the screen as it is.
  layout () {
    const vid = this.el, side = v.rot % 180 !== 0, mode = v.aspect;
    const W = window.innerWidth, H = window.innerHeight, bw = side ? H : W, bh = side ? W : H;
    vid.classList.remove('fill', 'stretch', 'orig');
    let w = bw, hh = bh;
    if (mode === 'fill' || mode === 'stretch' || mode === 'orig') vid.classList.add(mode);
    else if (mode === '16:9' || mode === '4:3') {
      const r = mode === '16:9' ? 16 / 9 : 4 / 3;
      w = Math.min(bw, bh * r); hh = w / r;
      vid.classList.add('stretch');
    }
    if (side || mode === '16:9' || mode === '4:3') Object.assign(vid.style, { width: w + 'px', height: hh + 'px', left: (W - w) / 2 + 'px', top: (H - hh) / 2 + 'px' });
    else vid.style.width = vid.style.height = vid.style.left = vid.style.top = '';
    // the pan is a share of the screen, as the fingers move on it
    const t = [];
    if (v.zoom > 1.001) t.push(`translate(${(v.pan[0] * W).toFixed(1)}px, ${(v.pan[1] * H).toFixed(1)}px)`, `scale(${v.zoom})`);
    if (v.rot) t.push(`rotate(${v.rot}deg)`);
    vid.style.transform = t.join(' ');
  },
  setLoop () {},
};
const mp = {
  name: 'mpv',
  open (item, start = 0) { mpv.open(item.url, { start }); },
  close () { mpv.close(); },
  get paused () { return mpv.st.pause || mpv.st.eof; },
  get time () { return mpv.st.t; },
  get duration () { return mpv.st.d; },
  // At the end, play starts again from the beginning, as a video element does.
  play () { if (mpv.st.eof) mpv.seek(0); mpv.set('pause', false); },
  pause () { mpv.set('pause', true); },
  seek (t) { mpv.seek(t); },
  quickSeek (t) { mpv.cmd('seek', Math.max(0, +t || 0).toFixed(3), 'absolute+keyframes'); },
  jump (d) { mpv.jump(d); },
  get speed () { return mpv.st.speed || 1; },
  setSpeed (s) { mpv.set('speed', s); },
  aspect (mode) {
    mpv.set('panscan', mode === 'fill' ? 1 : 0);
    mpv.set('keepaspect', mode !== 'stretch');
    mpv.set('video-unscaled', mode === 'orig');
    mpv.set('video-aspect-override', mode === '16:9' || mode === '4:3' ? mode : 'no');
  },
  // video-zoom is a power of two; the pan is a share of the picture's size
  zoom (z, px, py) { mpv.set('video-zoom', Math.log2(Math.max(1, z)).toFixed(3)); mpv.set('video-pan-x', px.toFixed(3)); mpv.set('video-pan-y', py.toFixed(3)); },
  // added to the file's own turn (v3.48.0); mpv keeps it from film to film, so it is set on each
  turn (r) { mpv.set('video-rotate', r); },
};
let eng = web;

/** A picture's size as people say it: 4K, 1080p, 720p. */
export function quality (x) {
  const h = Math.min(x.w || 0, x.h || 0) || x.h || 0;
  if (!h) return '';
  return h >= 2000 ? '4K' : h >= 1400 ? '1440p' : h >= 1000 ? '1080p' : h >= 700 ? '720p' : h >= 470 ? '480p' : h + 'p';
}

/** A video's details, and what can be done with it: play, carry on, share, delete. */
export function details (x) {
  const playing = v.open && v.item === x, s = mpv.st;
  const rows = [['Title', x.title], ['File', x.path || x.file], ['Length', fmtTime(x.duration || (playing ? eng.duration : 0))],
    ['Picture', x.w && x.h ? `${x.w} × ${x.h}` : playing && s.w ? `${s.w} × ${s.h}` : ''], ['Type', x.mime], ['Size', x.size ? fmtSize(x.size) : '']];
  const p = position(videoKey(x));
  if (p && !playing) rows.push(['Left at', fmtTime(p.t)]);
  if (playing && eng === mp) {
    rows.push(['Video', codecName(s.video)], ['Audio', codecName(s.audio)]);
    rows.push(['Played by', 'mpv, ' + (!s.hwdec ? 'starting' : s.hwdec === 'no' ? 'with its own decoder (SW)' : `with the phone's decoder (${s.hwdec === 'mediacodec-copy' ? 'HW+' : 'HW'})`)]);
  } else if (playing) rows.push(['Played by', 'the phone\'s web engine']);
  const body = document.createElement('div'); body.className = 'sh-info';
  body.innerHTML = rows.filter(r => r[1]).map(([k, val]) => `<div class="sh-info-row"><span>${esc(k)}</span><span>${esc(val)}</span></div>`).join('');
  const items = playing ? [] : [{ icon: 'play', label: p ? 'Carry on from ' + fmtTime(p.t) : 'Play', action: () => openVideo(x) }];
  if (!playing && p) items.push({ icon: 'rew', label: 'Play from the start', action: () => { clearPosition(videoKey(x)); openVideo(x); } });
  const star = favItem(videoFav(x));                     // v3.43.0: for Home's Favourites row
  if (star && !playing) items.push(star);
  // v3.45.0: the file itself to another app, or deleted from the phone
  if (!playing && hasAddress(x)) items.push({ icon: 'share', label: 'Share', action: () => shareItems('video', [x]) });
  if (!playing && x.id && canDelete()) items.push({ icon: 'trash', label: 'Delete', danger: true, action: () => deleteItems('video', [x]) });
  sheet({ title: x.title, items, body });
}

// ── the player ───────────────────────────────────────────────────────
let hooks = { watched () {} };
/** The player's controls wired, once, at start (initVideos). watched(): a video closed, the tab can show how far it went. */
export function initPlayer (h = {}) {
  hooks = { ...hooks, ...h };
  wirePlayer();
  // v3.48.0: in Android's small window (picture-in-picture) only the picture
  // shows; closing that window pauses the film.
  on('pip', d => {
    v.pip = !!d.on;
    $('vp').classList.toggle('pip', v.pip);
    if (v.pip) { clearTimeout(v.uiT); $('vp').classList.remove('ui'); hudOff(0); hideChip(); }
    else if (d.closed && v.open) eng.pause();
    else if (v.open) showUi();
  });
}

/**
 * What Android needs for picture-in-picture (v3.48.0): a film open, playing
 * or not, its shape, and whether more are around it (the small window's
 * buttons skip to them, else ten seconds). Told when any of it changes.
 */
function tellPip () {
  const s = mpv.st, vid = $('vp-video');
  let w = eng === mp ? s.w : vid.videoWidth, h = eng === mp ? s.h : vid.videoHeight;
  if (((eng === mp ? v.fileRot : 0) + v.rot) % 180) [w, h] = [h, w];
  const now = JSON.stringify({ film: v.open, playing: v.open && !eng.paused, w: w || 16, h: h || 9, list: !!(v.list && v.list.length > 1) });
  if (now === v.pipSaid) return;
  v.pipSaid = now;
  call('pip', now);
}

/** A video chosen inside the page, without Android's picker: played from a blob address, the one before let go. */
export function openPicked (f) {
  if (v.objectUrl) URL.revokeObjectURL(v.objectUrl);
  v.objectUrl = URL.createObjectURL(f);
  openVideo({ url: v.objectUrl, title: f.name.replace(/\.[^.]+$/, ''), file: f.name, size: f.size });
}

function wirePlayer () {
  const vid = $('vp-video');
  $('vp-back').addEventListener('click', closeVideo);
  $('vp-play').addEventListener('click', () => { if (eng.paused) eng.play(); else eng.pause(); showUi(); });
  $('vp-rew').addEventListener('click', () => { jump(-10); showUi(); });
  $('vp-fwd').addEventListener('click', () => { jump(10); showUi(); });
  $('vp-prev').addEventListener('click', () => step(-1));
  $('vp-next').addEventListener('click', () => step(1));
  $('vp-fit').addEventListener('click', () => { const i = ASPECTS.findIndex(a => a[0] === v.aspect); setAspect(ASPECTS[(i + 1) % ASPECTS.length][0], true); showUi(); });
  $('vp-rotate').addEventListener('click', () => {
    v.turn = v.turn === 'landscape' ? 'portrait' : v.turn === 'portrait' ? 'sensor' : 'landscape';
    call('orientation', v.turn);
    // This button turns the screen. The first time, where the picture itself is turned (v3.48.0).
    let told = true; try { told = localStorage.getItem('bm_m_turn_told') === '1'; localStorage.setItem('bm_m_turn_told', '1'); } catch (_) {}
    const what = v.turn === 'landscape' ? 'Landscape' : v.turn === 'portrait' ? 'Portrait' : 'Turns with the phone';
    toast(told ? what : what + '. To turn the picture itself: More, Turn the picture.', told ? 1200 : 3600);
    showUi();
  });
  // A picture turned a quarter, or at 16:9 or 4:3, is laid out by the screen's size: again when it turns.
  window.addEventListener('resize', () => { if (v.open && eng === web) web.layout(); });
  $('vp-lock').addEventListener('click', () => setLock(true));
  $('vp-unlock').addEventListener('click', () => setLock(false));
  $('vp-speed').addEventListener('click', speedMenu);
  $('vp-ab').addEventListener('click', abStep);
  $('vp-badge').addEventListener('click', decoderMenu);
  $('vp-audio').addEventListener('click', audioMenu);
  $('vp-subs').addEventListener('click', subsMenu);
  $('vp-more').addEventListener('click', moreMenu);
  // The seek bar (v3.43.2): steps of a ten-thousandth (they were a
  // thousandth, 7 seconds of a two hour film), and while it is dragged the
  // picture follows (quick seeks to keyframes, as the sideways swipe does),
  // the time and how far it moves show in the middle, and the controls stay.
  const r = $('vp-range');
  r.max = String(RANGE);
  let from = null;
  r.addEventListener('input', () => {
    const d = eng.duration; if (!d) return;
    if (from == null) from = eng.time;
    v.seeking = true; fillRange(r);
    const t = r.value / RANGE * d, delta = t - from;
    $('vp-cur').textContent = fmtTime(t);
    showUi(true);
    hud(delta < 0 ? 'rew' : 'fwd', fmtTime(t), (delta < 0 ? '-' : '+') + fmtTime(Math.abs(delta)), t / d);
    const now = performance.now();
    if (now - v.lastSeek > 160) { v.lastSeek = now; eng.quickSeek(t); }
  });
  r.addEventListener('change', () => {
    if (eng.duration) eng.seek(r.value / RANGE * eng.duration);
    v.seeking = false; from = null;
    hudOff(400); showUi();
  });
  // The web engine's news.
  const mine = fn => () => { if (eng === web && v.open) fn(); };
  vid.addEventListener('timeupdate', mine(time));
  vid.addEventListener('durationchange', mine(time));
  vid.addEventListener('play', mine(() => { state(); showUi(); }));
  vid.addEventListener('pause', mine(() => { state(); showUi(true); }));
  vid.addEventListener('ended', mine(() => { state(); showUi(true); ended(); }));
  vid.addEventListener('waiting', mine(() => { v.waiting = true; spin(); }));
  for (const ev of ['playing', 'canplay', 'seeked']) vid.addEventListener(ev, mine(() => { v.waiting = false; spin(); }));
  vid.addEventListener('loadedmetadata', mine(() => { hideNote(); v.fileRot = 0; turnFor(vid.videoWidth, vid.videoHeight, v.rot); meta(); }));
  vid.addEventListener('error', mine(webError));
  // mpv's.
  mpv.listen(onMpv);
  // The sound changed in its sheet (v3.49.0): a video mpv plays hears it at once.
  player.on('sound', () => { if (v.open && eng === mp) mpv.set('af', videoAf()); });
  // Touch: taps, double taps, swipes, pinch and hold (m-vgest.js).
  wireGestures($('vp-tap'), {
    locked: () => v.locked,
    showUnlock: () => { const u = $('vp-unlock'); u.classList.add('on'); clearTimeout(v.unlockT); v.unlockT = setTimeout(() => u.classList.remove('on'), 2500); },
    toggleUi: () => { if ($('vp').classList.contains('ui')) hideUi(); else showUi(); },
    jump: (d, side, n) => { jump(d); flash(side, n); },
    playPause: () => { if (eng.paused) eng.play(); else eng.pause(); hud(eng.paused ? 'play' : 'pause', eng.paused ? 'Playing' : 'Paused'); hudOff(500); },
    time: () => eng.time, duration: () => eng.duration,
    seekTo: (t, final) => {
      if (final) { eng.seek(t); return; }
      const now = performance.now();
      if (now - v.lastSeek > 160) { v.lastSeek = now; eng.quickSeek(t); }
    },
    // the seek bar follows a sideways swipe, and lets go after it (null)
    preview: t => {
      const r = $('vp-range'), d = eng.duration;
      if (t == null || !d) { v.seeking = false; return; }
      v.seeking = true;
      r.value = Math.round(t / d * RANGE); fillRange(r);
      $('vp-cur').textContent = fmtTime(t);
    },
    speedHold: on => {
      if (on) { v.held = true; v.speedBefore = eng.speed; eng.setSpeed(2); hud('fwd', '2× speed', 'While held'); }
      else if (v.held) { v.held = false; eng.setSpeed(v.speedBefore || 1); hudOff(150); }
      speedLabel();
    },
    zoomNow: () => v.zoom, panNow: () => v.pan,
    zoom: (z, px, py) => { v.zoom = z; v.pan = [px, py]; eng.zoom(z, px, py); },
    get boost () { return eng === mp ? b => { v.boost = b; mpv.set('volume', b); } : null; },
    boostNow: () => v.boost,
  });
  on('lifecycle', d => { if (d.state === 'background' && v.open) { eng.pause(); savePos(); } });
  on('battery', () => { if (v.open) meta(); });
  // Headphone and notification buttons work the video while one is open.
  player.videoRemote = d => {
    if (!v.open) return false;
    const a = d.action;
    if (a === 'close') return false;                       // the music's notification closed: the music's to handle
    if (a === 'play') eng.play();
    else if (a === 'pause') eng.pause();
    else if (a === 'toggle') { if (eng.paused) eng.play(); else eng.pause(); }
    else if (a === 'seekBy') jump(+d.value || 0);
    else if (a === 'seek') eng.seek(+d.value || 0);
    else if (a === 'next') step(1);
    else if (a === 'prev') step(-1);
    return true;
  };
}

/** The player for a video: mpv, unless it cannot play it here. */
function engineFor (item) {
  if (!mpv.ready || !hasAddress(item)) return web;
  if (mpv.info.crashed && mpv.info.crashed === item.url) {
    // The app closed the last time mpv opened this one: the web engine, this once.
    mpv.info.crashed = null;
    setTimeout(() => toast('BM Player closed the last time mpv opened this video, so the phone\'s web engine plays it this time.', 4200), 400);
    return web;
  }
  return mp;
}

/**
 * Plays a video: { url, title, id, file, w, h }. list and index: the
 * videos around it (its folder, or the list it was chosen from), for the
 * previous and next buttons and playing on.
 */
export function openVideo (item, { engine = null, start = null, list = null, index = -1 } = {}) {
  const vp = $('vp');
  if (!player.paused) player.pause();
  if (v.open) { savePos(); eng.close(); clearSubs(); }
  clearTimeout(v.nextT); $('vp-chip').classList.add('hidden');
  if (list) { v.list = list; v.index = index; } else if (!v.open || !v.list || !v.list.includes(item)) { v.list = null; v.index = -1; }
  else v.index = v.list.indexOf(item);
  if (item !== v.item) v.rot = 0;           // a turn is the video's: kept only when the same one opens again (another engine)
  v.item = item; v.open = true; v.turn = 'auto'; v.failed = false; v.waiting = false; v.lifted = false; v.besideTried = false;
  v.zoom = 1; v.pan = [0, 0]; v.boost = 100; v.ab = { a: null, b: null }; v.held = false;
  eng = engine || engineFor(item);
  // where it was left, unless asked for a place
  const key = videoKey(item);
  const saved = position(key);
  v.startAt = start != null ? start : saved ? saved.t : 0;
  $('vp-video').className = 'vp-video';
  setIcon($('vp-fit'), 'aspect');
  $('vp-title').textContent = item.title || 'Video';
  hideNote();
  setLock(false, true);
  document.documentElement.classList.toggle('mpv-on', eng === mp);
  vp.classList.toggle('mpv', eng === mp);
  vp.classList.remove('hidden');
  requestAnimationFrame(() => vp.classList.add('on'));
  call('immersive', true);
  eng.open(item, v.startAt);
  if (eng === mp && localStorage.getItem('bm_m_hwdec')) mpv.set('hwdec', localStorage.getItem('bm_m_hwdec'));
  if (eng === mp) mp.turn(v.rot);
  if (eng === mp) mpv.set('af', videoAf());          // the sound mode, clear voice, night mode (v3.49.0)
  setAspect(v.aspect, false);
  applySubStyle();
  markAb();
  time(); state(); speedLabel();
  for (const b of ['vp-prev', 'vp-next']) $(b).classList.toggle('hidden', !v.list || v.list.length < 2);
  $('vp-badge').classList.toggle('hidden', eng !== mp);
  meta();
  clearInterval(v.clockT); v.clockT = setInterval(() => { if ($('vp').classList.contains('ui')) meta(); }, 15000);
  showUi();
  spin();
  if (item.id && eng === web) besideSubs(item);
  if (start == null && saved && saved.t > 5) chip(`Carrying on from ${fmtTime(saved.t)}`, 'Start over', () => { eng.seek(0); hideChip(); });
  // remembered, for Home's Resume and its recent row
  markSeen(key);
  remember({ kind: 'video', key, title: item.title || 'Video', sub: item.folder || '', url: item.url, id: item.id, thumb: item.thumb || '', docKey: item.docKey || null,
    file: item.file, size: item.size });
  clearInterval(v.saveT); v.saveT = setInterval(savePos, 5000);
}

export function closeVideo () {
  if (!v.open) return false;
  const vp = $('vp');
  savePos();
  v.open = false;
  tellPip();
  eng.close();
  clearSubs();
  clearTimeout(v.spinT); clearInterval(v.saveT); clearInterval(v.clockT); clearTimeout(v.nextT);
  stopSleep();
  vp.classList.remove('on', 'ui', 'spinning', 'locked');
  document.documentElement.classList.remove('mpv-on');
  setTimeout(() => { if (!v.open) { vp.classList.add('hidden'); vp.classList.remove('mpv'); } }, 220);
  call('immersive', false);
  call('orientation', 'auto');
  call('keepScreenOn', false);
  call('brightness', -1);                // the phone's own brightness again
  hideChip(); hudOff(0);
  hooks.watched();                       // the tab shows how far each was watched
  return true;
}
export const videoOpen = () => v.open;

function savePos () {
  if (!v.open || !v.item) return;
  const d = eng.duration, t = eng.time;
  if (!(d > 0)) return;
  const key = videoKey(v.item);
  savePosition(key, t, d);
  touch(key, { t, d });
}

/** The same video in the other player, from where it was. */
function switchEngine (to) {
  const item = v.item, at = eng.time;
  if (!item) return;
  if (to === mp && !hasAddress(item)) { toast('mpv can only open videos from the list, or opened with the folder button.'); return; }
  openVideo(item, { engine: to, start: at > 1 ? at : 0, list: v.list, index: v.index });
}

/** The previous (-1) or next (1) video of the list it was chosen from. */
function step (d) {
  if (!v.list || v.list.length < 2) return;
  const i = v.index + d;
  if (i < 0 || i >= v.list.length) { toast(d > 0 ? 'That was the last one' : 'That is the first one', 1200); return; }
  openVideo(v.list[i], { list: v.list, index: i });
}

/** At the end: the next one of the list, after a moment that can be cancelled. */
function ended () {
  const key = v.item ? videoKey(v.item) : null;
  if (key) clearPosition(key);
  if (v.sleepEnd) { stopSleep(); toast('Sleep timer: stopped at the end of the video', 2600); return; }
  if (!autoNext() || !v.list || v.index < 0 || v.index >= v.list.length - 1) return;
  const next = v.list[v.index + 1];
  chip(`Next: ${next.title}`, 'Cancel', () => { clearTimeout(v.nextT); hideChip(); });
  clearTimeout(v.nextT);
  v.nextT = setTimeout(() => { if (v.open) step(1); }, 3500);
}

function chip (text, button, act) {
  const c = $('vp-chip');
  c.innerHTML = `<span>${esc(text)}</span>` + (button ? `<button type="button">${esc(button)}</button>` : '');
  c.querySelector('button')?.addEventListener('click', act);
  c.classList.remove('hidden');
  clearTimeout(v.chipT); v.chipT = setTimeout(hideChip, 5000);
}
function hideChip () { $('vp-chip').classList.add('hidden'); }

function onMpv (d, s) {
  if (!v.open || eng !== mp) return;
  switch (d.e) {
    case 'loaded':
      hideNote();
      v.fileRot = s.rotate || 0;               // the file's own turn (its demuxer's): the one asked for comes on top
      turnFor(s.w, s.h, v.fileRot + v.rot);
      time(); meta();
      markSubs();
      // A subtitle file beside the film, unless mpv found one itself.
      if (v.item?.id && !v.besideTried && !s.tracks.some(t => t.type === 'sub' && t.external)) { v.besideTried = true; besideSubs(v.item); }
      break;
    case 'video': turnFor(d.w, d.h, d.rotate); break;          // the decoded picture's turn, the one asked for in it
    case 'restart': case 'buffering': case 'seeking': spin(); break;
    case 'time': case 'duration': time(); break;
    case 'pause': case 'eof': state(); if (mp.paused) showUi(true); else showUi(); if (d.e === 'eof' && d.v) ended(); break;
    case 'tracks': markSubs(); break;
    case 'hwdec': meta(); break;
    case 'speed': speedLabel(); break;
    case 'error': mpvError(d); break;
    case 'end': note('The video stopped part way: mpv could not read on.', reason(d.text), [['Open in another app', () => call('openWith', v.item.url)]]); break;
    case 'unavailable':
      toast('mpv could not start, so the phone\'s web engine plays this video.', 3600);
      switchEngine(web);
      break;
  }
}

/**
 * The picture turned (v3.48.0): straight, a quarter to the right, upside
 * down or a quarter to the left, for a film recorded sideways. The screen
 * follows it while it turns with the film.
 */
const TURNS = [[0, 'Straight'], [90, 'A quarter to the right'], [180, 'Upside down'], [270, 'A quarter to the left']];
function turnPicture (r, tell) {
  v.rot = ((Math.round(r / 90) * 90) % 360 + 360) % 360;
  eng.turn(v.rot);
  if (eng === mp) { if (mpv.st.w) turnFor(mpv.st.w, mpv.st.h, v.fileRot + v.rot); }
  else { const vid = $('vp-video'); turnFor(vid.videoWidth, vid.videoHeight, v.rot); }
  if (tell) toast('Picture: ' + TURNS.find(t => t[0] === v.rot)[1].toLowerCase(), 1400);
}
function turnMenu () {
  sheet({ title: 'Turn the picture', sub: 'For a video recorded sideways. The screen follows it.',
    items: TURNS.map(([deg, label]) => ({ label, note: deg ? deg + '°' : '', on: v.rot === deg, action: () => turnPicture(deg, true) })) });
}

/** The screen turns to suit the film: landscape for a wide one. */
function turnFor (w, h, rotate) {
  tellPip();
  if (v.turn !== 'auto' || !w || !h) return;
  const wide = (rotate || 0) % 180 ? h > w : w > h;
  call('orientation', wide ? 'landscape' : 'sensor');
}

function jump (d) {
  if (eng === web && !eng.duration) return;
  eng.jump(d);
}

function flash (side, n = 1) {
  if (!side) return;
  const f = $(side < 0 ? 'vp-flash-l' : 'vp-flash-r');
  f.lastElementChild.textContent = (n > 1 ? n * 10 : 10) + ' s';
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}

function state () {
  const p = eng.paused;
  setIcon($('vp-play'), p ? 'play' : 'pause');
  $('vp-play').setAttribute('aria-label', p ? 'Play' : 'Pause');
  call('keepScreenOn', v.open && !p && awakeOn());
  tellPip();
}

function time () {
  const d = eng.duration, t = eng.time;
  if (!v.seeking) {
    $('vp-cur').textContent = fmtTime(t);
    $('vp-range').value = d ? Math.round(t / d * RANGE) : 0;
    fillRange($('vp-range'));
  }
  $('vp-dur').textContent = fmtTime(d);
  // A-B repeat in the web engine (mpv does its own)
  if (eng === web && v.ab.a != null && v.ab.b != null && t >= v.ab.b) eng.seek(v.ab.a);
  if (v.sleepAt && Date.now() >= v.sleepAt) { eng.pause(); stopSleep(); toast('Sleep timer: paused', 2600); }
}

/** The line under the title: which of the list, the clock and the battery. */
function meta () {
  const parts = [];
  if (v.list && v.index >= 0 && v.list.length > 1) parts.push(`${v.index + 1} of ${v.list.length}`);
  const q = v.item && (v.item.w ? quality(v.item) : mpv.st.h && eng === mp ? quality({ w: mpv.st.w, h: mpv.st.h }) : '');
  if (q) parts.push(q);
  const now = new Date();
  parts.push(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const b = +call('batteryLevel');
  if (b >= 0) parts.push(b + '%');
  $('vp-meta').textContent = parts.join(' · ');
  if (eng === mp) {
    const hw = mpv.st.hwdec, label = !hw ? '' : hw === 'no' ? 'SW' : hw.includes('copy') ? 'HW+' : 'HW';
    const badge = $('vp-badge');
    badge.textContent = label || 'HW';
    badge.classList.toggle('hidden', !label);
  }
}

/**
 * A turning ring when opening or seeking takes a moment: around the play
 * button with the controls showing, in the middle without (mobile.css).
 */
function spin () {
  const s = mpv.st;
  const want = v.open && !v.failed && (eng === mp ? !s.shown || s.seeking || s.buffering : v.waiting);
  clearTimeout(v.spinT);
  if (!want) { $('vp').classList.remove('spinning'); return; }
  v.spinT = setTimeout(() => $('vp').classList.add('spinning'), 400);
}

function showUi (stay = false) {
  if (v.locked || v.pip) return;
  const vp = $('vp');
  vp.classList.add('ui');
  lift(true);
  meta();
  clearTimeout(v.uiT);
  if (!stay && !eng.paused) v.uiT = setTimeout(hideUi, 3600);
}
function hideUi () { if (eng.paused || !$('vp-note').classList.contains('hidden')) return; $('vp').classList.remove('ui'); lift(false); }

/** Locked: the controls go, and touches only bring back the unlock button. */
function setLock (on, quiet = false) {
  v.locked = !!on;
  const vp = $('vp');
  vp.classList.toggle('locked', v.locked);
  $('vp-unlock').classList.toggle('hidden', !v.locked);
  if (v.locked) { vp.classList.remove('ui'); lift(false); $('vp-unlock').classList.add('on'); clearTimeout(v.unlockT); v.unlockT = setTimeout(() => $('vp-unlock').classList.remove('on'), 2500); if (!quiet) toast('Locked: tap the lock to unlock', 1600); }
  else if (!quiet) { showUi(); }
}

/** With the controls showing, mpv's subtitles move up out of their way (the web engine's do in CSS). */
function lift (on) {
  if (eng !== mp || !v.open || v.lifted === on) return;
  v.lifted = on;
  mpv.set('sub-margin-y', on ? 130 : 22);
}

function setAspect (mode, tell) {
  v.aspect = ASPECTS.some(a => a[0] === mode) ? mode : 'fit';
  eng.aspect(v.aspect);
  if (tell) { hud('aspect', ASPECTS.find(a => a[0] === v.aspect)[1], 'Picture size'); hudOff(900); }
}

function speedLabel () { $('vp-speed').textContent = (Math.round(eng.speed * 100) / 100) + '×'; }

/** A note over the video: a line, a smaller one, and buttons [label, action]. */
function note (text, small = '', buttons = []) {
  const n = $('vp-note');
  n.innerHTML = `<p>${esc(text)}</p>` + (small ? `<p class="vp-note-small">${esc(small)}</p>` : '') +
    (buttons.length ? `<div class="vp-note-btns">${buttons.map(([label], i) => `<button class="m-btn${i ? ' m-btn-2' : ''}" type="button" data-i="${i}">${esc(label)}</button>`).join('')}</div>` : '');
  n.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { hideNote(); buttons[+b.dataset.i][1](); }));
  n.classList.remove('hidden');
  v.failed = true;
  spin();
  showUi(true);
}
function hideNote () { $('vp-note').classList.add('hidden'); }
/** mpv's last two complaints, without its [module] labels: the reason, then what came of it. */
const reason = text => String(text || '').trim().split('\n').slice(-2).map(l => l.replace(/^\[[^\]]+\]\s*/, '').trim()).filter(Boolean).join(' · ');

function mpvError (d) {
  const ext = extOf(v.item);
  // With mpv's own words there was a file it could not make sense of. Without, Java could not open it at all.
  const main = d.detail ? `mpv could not play this video${ext ? ' (' + ext + ')' : ''}. The file may be damaged, or not a video.` : d.text || 'mpv could not play this video.';
  note(main, reason(d.detail), [
    ['Open in another app', () => call('openWith', v.item.url)],
    ['Try the web engine', () => switchEngine(web)],
  ]);
}

function webError () {
  const ext = extOf(v.item), what = `This video${ext ? ' (' + ext + ')' : ''} did not play in the phone's web engine.`;
  const buttons = [];
  if (mpv.info.available && hasAddress(v.item)) buttons.push(['Play it with mpv', () => switchEngine(mp)]);
  if (hasAddress(v.item)) buttons.push(['Open in another app', () => call('openWith', v.item.url)]);
  const small = mpv.info.available ? 'mpv, built into BM Player, plays nearly every film.'
    : `mpv is not available here${mpv.info.reason ? ': ' + mpv.info.reason : '.'} The web engine plays MP4 and WebM, with what the phone can decode.`;
  note(what, small, buttons);
}

// ── the menus ────────────────────────────────────────────────────────
function speedMenu () {
  const cur = eng.speed;
  sheet({ title: 'Speed', items: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4].map(x => ({ label: x === 1 ? 'Normal' : x + '×', on: Math.abs(cur - x) < 0.001, action: () => { eng.setSpeed(x); setTimeout(speedLabel, 60); } })) });
}

/** A-B repeat: the first press marks where it starts, the second where it ends, the third clears it. */
function abStep () {
  const t = eng.time;
  if (v.ab.a == null) { v.ab.a = t; toast('Repeat from ' + fmtTime(t) + ': press again where it should end', 2200); }
  else if (v.ab.b == null) {
    if (t <= v.ab.a + 0.5) { toast('The end must come after the start', 1600); return; }
    v.ab.b = t; toast(`Repeating ${fmtTime(v.ab.a)} to ${fmtTime(v.ab.b)}`, 1800);
    if (eng === mp) { mpv.set('ab-loop-a', v.ab.a.toFixed(2)); mpv.set('ab-loop-b', v.ab.b.toFixed(2)); }
  } else { clearAb(); toast('Repeat off', 1200); }
  markAb();
  showUi();
}
function clearAb () { v.ab = { a: null, b: null }; if (eng === mp && v.open) { mpv.set('ab-loop-a', 'no'); mpv.set('ab-loop-b', 'no'); } markAb(); }
function markAb () {
  const m = $('vp-ab-mark'), d = eng.duration;
  $('vp-ab').classList.toggle('on', v.ab.a != null);
  if (v.ab.a == null || !d) { m.classList.add('hidden'); return; }
  const b = v.ab.b ?? v.ab.a + d * 0.004;
  m.style.left = (v.ab.a / d * 100) + '%'; m.style.width = Math.max(0.6, (b - v.ab.a) / d * 100) + '%';
  m.classList.remove('hidden');
}

function sleepMenu () {
  const left = v.sleepAt ? Math.max(0, Math.round((v.sleepAt - Date.now()) / 60000)) : 0;
  sheet({ title: 'Sleep timer', sub: v.sleepAt ? `Pauses in ${left} minute${left === 1 ? '' : 's'}` : v.sleepEnd ? 'Stops at the end of this video' : 'Pauses the video after a while', items: [
    { label: 'Off', on: !v.sleepAt && !v.sleepEnd, action: stopSleep },
    ...[15, 30, 45, 60, 90].map(m => ({ label: m + ' minutes', action: () => { stopSleep(); v.sleepAt = Date.now() + m * 60000; toast(`Sleep timer: ${m} minutes`, 1600); } })),
    { label: 'At the end of this video', on: v.sleepEnd, action: () => { stopSleep(); v.sleepEnd = true; toast('Sleep timer: at the end of this video', 1600); } },
  ] });
}
function stopSleep () { v.sleepAt = 0; v.sleepEnd = false; }

function decoderMenu () {
  if (eng !== mp) return;
  const cur = mpv.st.hwdec || '';
  sheet({ title: 'Decoder', sub: 'How mpv turns the file into pictures.', items: [
    { label: 'HW', note: 'The phone\'s video chip, straight to the screen: the least power', on: cur === 'mediacodec', action: () => setHw('mediacodec') },
    { label: 'HW+', note: 'The phone\'s chip, then mpv: rotation, filters', on: cur === 'mediacodec-copy', action: () => setHw('mediacodec-copy') },
    { label: 'SW', note: 'mpv alone: for files the chip gets wrong', on: cur === 'no', action: () => setHw('no') },
  ] });
}
function setHw (val) {
  mpv.set('hwdec', val);
  try { localStorage.setItem('bm_m_hwdec', val); } catch (_) {}
  toast(val === 'no' ? 'Decoder: SW' : val === 'mediacodec' ? 'Decoder: HW' : 'Decoder: HW+', 1400);
}

/** A delay in steps, for subtitles or sound: mpv only. */
function delayMenu (prop, title) {
  const body = document.createElement('div'); body.className = 'vp-delay';
  let val = 0;
  const show = () => { body.querySelector('.vp-delay-v').textContent = (val > 0 ? '+' : '') + val.toFixed(1) + ' s'; };
  body.innerHTML = '<div class="vp-delay-v"></div><div class="seg"><button type="button" data-d="-0.5">-0.5</button><button type="button" data-d="-0.1">-0.1</button><button type="button" data-d="0">0</button><button type="button" data-d="0.1">+0.1</button><button type="button" data-d="0.5">+0.5</button></div>';
  body.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d; val = d === 0 ? 0 : Math.round((val + d) * 10) / 10; mpv.set(prop, val.toFixed(2)); show(); });
  show();
  sheet({ title, sub: prop === 'sub-delay' ? 'Later (+) when the words come too soon.' : 'Later (+) when the sound comes before the picture.', body });
}

function moreMenu () {
  const s = mpv.st;
  const audios = eng === mp ? s.tracks.filter(t => t.type === 'audio') : [];
  const sel = audios.find(t => t.selected);
  sheet({
    title: v.item?.title || 'Video',
    items: [
      { icon: 'speed', label: 'Speed', note: eng.speed === 1 ? 'Normal' : eng.speed + '×', action: speedMenu },
      // v3.49.0: the sound modes, clear voice and night mode, through mpv's audio filter (the web engine has none)
      ...(eng === mp ? [{ icon: 'wave', label: 'Sound', note: soundNote(), action: () => soundSheet({ film: true }) }] : []),
      ...(audios.length > 1 ? [{ icon: 'volHigh', label: 'Audio track', note: sel ? trackLabel(sel) : 'Off', action: audioMenu }] : []),
      { icon: 'aspect', label: 'Picture size', note: ASPECTS.find(a => a[0] === v.aspect)[1], action: () => sheet({ title: 'Picture size', items: ASPECTS.map(([k, l]) => ({ label: l, on: v.aspect === k, action: () => setAspect(k, true) })) }) },
      { icon: 'turnPic', label: 'Turn the picture', note: v.rot ? v.rot + '°' : 'Straight', action: turnMenu },
      { icon: 'timer', label: 'Sleep timer', note: v.sleepAt ? 'On' : v.sleepEnd ? 'At the end' : 'Off', action: sleepMenu },
      { icon: 'abloop', label: 'Repeat a part (A-B)', note: v.ab.b != null ? `${fmtTime(v.ab.a)} to ${fmtTime(v.ab.b)}` : 'Off', action: () => { if (v.ab.a != null) clearAb(); abStep(); } },
      ...(eng === mp ? [{ icon: 'sub', label: 'Subtitle timing', action: () => delayMenu('sub-delay', 'Subtitle timing') }, { icon: 'volHigh', label: 'Sound timing', action: () => delayMenu('audio-delay', 'Sound timing') },
        { icon: 'chip', label: 'Decoder', note: s.hwdec === 'no' ? 'SW' : s.hwdec?.includes('copy') ? 'HW+' : 'HW', action: decoderMenu }] : []),
      { icon: 'next', label: 'Play the next one after', note: autoNext() ? 'On' : 'Off', action: () => { try { localStorage.setItem('bm_m_vnext', autoNext() ? '0' : '1'); } catch (_) {} toast(autoNext() ? 'Plays on to the next video' : 'Stops at the end', 1400); } },
      ...(mpv.info.available && hasAddress(v.item) ? [{ icon: 'tv', label: 'Player', note: eng === mp ? 'mpv' : 'The phone\'s web engine', action: () => sheet({ title: 'Play this video with', items: [
        { label: 'mpv', note: 'Built into BM Player', on: eng === mp, action: () => { if (eng !== mp) switchEngine(mp); } },
        { label: 'The phone\'s web engine', note: 'What the phone can decode', on: eng === web, action: () => { if (eng !== web) switchEngine(web); } },
      ] }) }] : []),
      ...(hasAddress(v.item) ? [{ icon: 'share', label: 'Open in another app', action: () => { eng.pause(); call('openWith', v.item.url); } }] : []),
      ...[favItem(videoFav(v.item))].filter(Boolean),
      { icon: 'info', label: 'Details', action: () => details(v.item) },
    ],
  });
}

function audioMenu () {
  if (eng !== mp) { toast('The web engine plays the first sound track only. mpv chooses between them.', 2400); return; }
  const audios = mpv.st.tracks.filter(t => t.type === 'audio');
  sheet({ title: 'Audio track', items: [
    ...audios.map(t => ({ label: trackLabel(t), note: [codecName(t.codec), channels(t)].filter(Boolean).join(' · '), on: !!t.selected, action: () => mpv.set('aid', t.id) })),
    { icon: 'timer', label: 'Sound timing…', action: () => delayMenu('audio-delay', 'Sound timing') },
  ] });
}

// ── subtitles ────────────────────────────────────────────────────────
/** SRT (or VTT) text as WebVTT, which is what a video element reads. */
export function toVtt (text) {
  let t = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT/.test(t)) return t;
  t = t.replace(/^\d+\n(?=\d{1,2}:\d{2})/gm, '')
    .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2')
    .replace(/\{\\[^}]*\}/g, '');
  return 'WEBVTT\n\n' + t + '\n';
}

/** Subtitles as text, for whichever engine plays. mpv reads SRT, VTT and ASS itself. */
function addSubs (name, text) {
  if (eng === mp) { mpv.subAdd(name, text); return; }
  const vid = $('vp-video');
  for (const tr of vid.textTracks) tr.mode = 'disabled';
  const url = URL.createObjectURL(new Blob([toVtt(text)], { type: 'text/vtt' }));
  v.subUrls.push(url);
  const t = document.createElement('track');
  t.kind = 'subtitles'; t.label = name; t.srclang = 'und'; t.src = url; t.default = true;
  vid.appendChild(t);
  setTimeout(() => { if (t.track) t.track.mode = 'showing'; }, 0);
  $('vp-subs').classList.add('on');
}

function clearSubs () {
  const vid = $('vp-video');
  for (const t of [...vid.querySelectorAll('track')]) t.remove();
  for (const u of v.subUrls) URL.revokeObjectURL(u);
  v.subUrls = [];
  $('vp-subs').classList.remove('on');
}

/** The subtitles button lit while subtitles show (mpv's tracks). */
function markSubs () {
  if (eng !== mp) return;
  $('vp-subs').classList.toggle('on', mpv.st.tracks.some(t => t.type === 'sub' && t.selected));
}

async function besideSubs (item) {
  try {
    const r = await fetch(`/api/beside/video/${item.id}?ext=${eng === mp ? 'srt,ass,ssa,vtt' : 'srt,vtt'}`, { cache: 'no-store' });
    if (!r.ok || v.item !== item) return;
    const o = await r.json();
    if (o?.text && v.item === item) { addSubs(o.name, o.text); toast('Subtitles: ' + o.name, 1800); }
  } catch (_) {}
}

async function chooseSubs () {
  const f = await pickFile(eng === mp ? '.srt,.ass,.ssa,.vtt,text/vtt,application/x-subrip' : '.srt,.vtt,text/vtt,application/x-subrip');
  if (!f) return;
  if (f.size > 4 * 1024 * 1024) { toast('That file is too large for subtitles.'); return; }
  addSubs(f.name, await f.text());
}

function subsMenu () {
  if (eng === mp) {
    const subs = mpv.st.tracks.filter(t => t.type === 'sub');
    sheet({
      title: 'Subtitles',
      items: [
        { label: 'Off', on: !subs.some(t => t.selected), action: () => mpv.set('sid', 'no') },
        ...subs.map(t => ({ label: trackLabel(t), note: [codecName(t.codec), t.external ? 'from a file' : ''].filter(Boolean).join(' · '), on: !!t.selected, action: () => mpv.set('sid', t.id) })),
        { icon: 'folder', label: 'Choose a subtitle file…', note: '.srt, .ass or .vtt', action: chooseSubs },
        { icon: 'timer', label: 'Timing…', note: 'When the words come too soon or too late', action: () => delayMenu('sub-delay', 'Subtitle timing') },
      ],
    });
    return;
  }
  const vid = $('vp-video'), tracks = [...vid.textTracks];
  sheet({
    title: 'Subtitles',
    items: [
      { label: 'Off', on: !tracks.some(t => t.mode === 'showing'), action: () => { for (const t of tracks) t.mode = 'disabled'; $('vp-subs').classList.remove('on'); } },
      ...tracks.map(t => ({ label: t.label || 'Subtitles', on: t.mode === 'showing', action: () => { for (const x of tracks) x.mode = x === t ? 'showing' : 'disabled'; $('vp-subs').classList.add('on'); } })),
      { icon: 'folder', label: 'Choose a subtitle file…', note: '.srt or .vtt', action: chooseSubs },
    ],
  });
}

/** The subtitles' look, from Settings: size, and a box behind them or an outline. */
export function applySubStyle () {
  let size = 'm', box = false;
  try { size = localStorage.getItem('bm_m_subsize') || 'm'; box = localStorage.getItem('bm_m_subbox') === '1'; } catch (_) {}
  if (v.open && eng === mp) {
    // In mpv's units: a 720-line picture's pixels. Styled (ASS) subtitles keep their own look.
    mpv.set('sub-font-size', { s: 36, m: 44, l: 54 }[size] || 44);
    mpv.set('sub-border-style', box ? 'background-box' : 'outline-and-shadow');
    if (box) mpv.set('sub-back-color', '#A0000000');
  }
  const px = { s: 'calc(14px + 1.6vmin)', m: 'calc(16px + 2.4vmin)', l: 'calc(18px + 3.4vmin)' }[size] || 'calc(16px + 2.4vmin)';
  let s = document.getElementById('cue-style');
  if (!s) { s = document.createElement('style'); s.id = 'cue-style'; document.head.appendChild(s); }
  s.textContent = `.vp-video::cue{font-family:var(--font-ui);font-size:${px};line-height:1.25;color:#fff;` +
    (box ? 'background-color:rgba(0,0,0,.62);text-shadow:none;}' : 'background-color:transparent;text-shadow:0 0 3px #000,0 0 3px #000,1px 1px 2px #000,-1px -1px 2px #000;}');
}

/** For Settings: which player plays videos, and why. */
export function playerNote () {
  if (!mpv.info.available) return `mpv cannot run on this phone${mpv.info.reason ? ': ' + mpv.info.reason : '.'} Videos play with the phone's web engine.`;
  if (mpv.info.off && choice() === 'mpv') return 'mpv stopped the app once while starting, so videos play with the web engine. Choose mpv to try it again.';
  return choice() === 'mpv' ? 'mpv plays nearly every film: MKV and MP4, 4K and H.265, every audio track, and styled subtitles.'
    : 'The phone\'s web engine plays MP4 and WebM, with what the phone can decode.';
}

/** Back while the player is open: unlock first if locked, else close. True when handled. */
export function videoBack () {
  if (!v.open) return false;
  if (v.locked) { setLock(false); return true; }
  closeVideo();
  return true;
}
