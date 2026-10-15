/**
 * m-nowplaying: the song playing. The bar above the tabs (mini player) and
 * Now Playing over everything: the album art, or the desktop's visualiser
 * behind the controls (all its styles, MilkDrop and its preset browser
 * among them), full screen if wanted. Up Next and Lyrics come up from the
 * bottom; Lyrics is the desktop's lyrics view, timed lines and all, and in
 * the visualiser the line being sung can sit over the picture.
 *
 * Swipe down on the art (or Back) to close, left or right on it for the
 * next or previous song.
 */
import { player } from './m-player.js';
import { Visualizer, vizSettings, setSharedArt } from './visualizer.js';
import { Lyrics } from './modules/lyrics.js';
import { lyricsApi, lyricsKey } from './m-lyrics.js';
import { songArt } from './m-library.js';
import { songMenu } from './m-music.js';
import { VList } from './m-list.js';
import { $, esc, fmtTime, sheet, toast, artBg, fillRange } from './m-ui.js';
import { ICONS, setIcon } from './icons.js';
import { call, on } from './m-android.js';
import { favItem, songFav } from './m-favs.js';
import './viz-settings.js';
import './md-browser.js';

let viz = null, lyrics = null, qvl = null;
let open = false, mode = 'art', full = false, drawerOn = false, seeking = false, hidden = false, barsDark = false;
const AWAKE = 'bm_m_awake';
export const awakeOn = () => { try { return localStorage.getItem(AWAKE) !== '0'; } catch (_) { return true; } };
export function setAwake (on) { try { localStorage.setItem(AWAKE, on ? '1' : '0'); } catch (_) {} keepAwake(); }

const EQ_BANDS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const EQ_PRESETS = [['Flat', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], ['Bass', [8, 7, 5, 3, 1, 0, 0, 0, 0, 0]], ['Treble', [0, 0, 0, 0, 0, 1, 3, 5, 7, 8]],
  ['Vocal', [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1]], ['Rock', [5, 4, -2, -4, -2, 2, 5, 6, 6, 5]], ['Pop', [-1, 2, 4, 4, 1, -1, -2, -2, -1, 1]],
  ['Jazz', [3, 2, 1, 2, -1, -1, 0, 1, 2, 3]], ['Classical', [4, 3, 2, 1, -1, -1, -1, 0, 2, 3]]];
const TOOLS = { 'np-viz-btn': ['sparkle', 'Visualiser'], 'viz-btn-settings': ['palette', 'Style'], 'viz-btn-presets': ['grid', 'Presets'], 'viz-btn-lyrics': ['lyrics', 'Words'], 'np-full': ['fullscreen', 'Full screen'] };

export function initPlayerUI () {
  try { mode = localStorage.getItem('bm_np_mode') === 'viz' ? 'viz' : 'art'; } catch (_) {}
  lyrics = new Lyrics({ api: lyricsApi, music: { engineOwns: () => true, engine: player.engine }, app: null });
  window.bmLyrics = lyrics;
  // The desktop's modules put a bare icon on the buttons they own: the phone's have words too.
  for (const [id, [ico, lbl]] of Object.entries(TOOLS)) setIcon($(id), ico, lbl);

  // the mini player
  $('mini-open').addEventListener('click', openPlayer);
  $('mini-play').addEventListener('click', () => player.toggle());
  $('mini-next').addEventListener('click', () => player.next());
  // v3.43.0: the X stops the music and the bar goes, until something plays again.
  $('mini-close').addEventListener('click', stopAndClose);
  swipe($('mini-open'), { left: () => player.next(), right: () => player.prev() });

  // Now Playing
  $('np-close').addEventListener('click', closePlayer);
  $('np-play').addEventListener('click', () => player.toggle());
  $('np-prev').addEventListener('click', () => player.prev());
  $('np-next').addEventListener('click', () => player.next());
  $('np-shuffle').addEventListener('click', () => { player.setShuffle(!player.shuffle); toast(player.shuffle ? 'Shuffle on' : 'Shuffle off', 1200); });
  $('np-repeat').addEventListener('click', () => { const r = player.cycleRepeat(); toast(r === 'one' ? 'Repeat this song' : r === 'all' ? 'Repeat all' : 'Repeat off', 1200); });
  $('np-more').addEventListener('click', moreMenu);
  $('np-viz-btn').addEventListener('click', () => setMode(mode === 'viz' ? 'art' : 'viz'));
  $('np-full').addEventListener('click', () => setFull(true));
  $('np-exitfull').addEventListener('click', e => { e.stopPropagation(); setFull(false); });
  const r = $('np-range');
  r.addEventListener('input', () => { seeking = true; fillRange(r); $('np-cur').textContent = fmtTime(r.value / 1000 * player.duration); });
  r.addEventListener('change', () => { player.seek(r.value / 1000 * player.duration); seeking = false; });
  swipe($('np-stage'), { left: () => player.next(), right: () => player.prev(), down: closePlayer });
  swipe($('np-head'), { down: closePlayer });
  // Full screen: a tap shows the controls for a few seconds.
  $('np').addEventListener('click', e => {
    if (!full || e.target.closest('button, input, .np-drawer, .md-browser, .viz-settings')) return;
    peek();
  });

  // Up Next and Lyrics, from the bottom
  let before = null;
  $('np-drawer').querySelector('.np-tabs').addEventListener('click', () => { before = lyrics.tab; }, true);
  for (const id of ['np-tab-queue', 'np-tab-lyrics']) $(id).addEventListener('click', () => {
    const tab = id === 'np-tab-lyrics' ? 'lyrics' : 'queue';
    if (!drawerOn) setDrawer(true);
    else if (before === tab) setDrawer(false);
  });
  $('np-drawer').querySelector('.np-grip').addEventListener('click', () => setDrawer(!drawerOn));
  swipe($('np-drawer').querySelector('.np-drawer-head'), { down: () => setDrawer(false), up: () => setDrawer(true) });
  $('np-queue').addEventListener('click', e => {
    const row = e.target.closest('.vrow'); if (!row) return;
    const n = +row.dataset.i;
    if (e.target.closest('.qx')) { player.removeNext(n); return; }
    player.jump(n);
  });

  player.on('track', s => { trackChanged(s); });
  player.on('state', () => { updateState(); keepAwake(); });
  player.on('time', updateTime);
  player.on('queue', () => { updateModes(); if (drawerOn) renderQueue(); updateMini(); });
  player.on('speed', updateTime);
  on('lifecycle', d => { hidden = d.state === 'background'; applyMode(); });
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; applyMode(); });
  window.bmClosePlayer = closePlayer;
  updateModes();
}

// ── opening and closing ──────────────────────────────────────────────
export function openPlayer () {
  if (!player.current) return;
  const np = $('np');
  np.classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => np.classList.add('on')));
  open = true;
  np.setAttribute('aria-hidden', 'false');
  showTrack(player.current); updateState(); updateTime(); updateModes();
  applyMode();
}

export function closePlayer () {
  if (!open) return false;
  if (full) setFull(false);
  open = false;
  const np = $('np');
  np.classList.remove('on');
  np.setAttribute('aria-hidden', 'true');
  window.bmMdBrowser?.hide(); window.bmVizPanel?.close?.();
  setDrawer(false);
  applyMode();
  setTimeout(() => { if (!open) np.classList.add('hidden'); }, 300);
  return true;
}
export const playerOpen = () => open;

/** Back in Now Playing: the innermost thing open closes. True when something did. */
export function playerBack () {
  if (!open) return false;
  if (window.bmMdBrowser?.isOpen) { window.bmMdBrowser.hide(); return true; }
  const vs = $('viz-settings'); if (vs && !vs.classList.contains('hidden')) { window.bmVizPanel?.close?.(); return true; }
  if (full) { setFull(false); return true; }
  if (drawerOn) { setDrawer(false); return true; }
  return closePlayer();
}

// ── art or visualiser ────────────────────────────────────────────────
function setMode (m) {
  mode = m;
  try { localStorage.setItem('bm_np_mode', m); } catch (_) {}
  applyMode();
}

function applyMode () {
  const np = $('np');
  np.dataset.mode = mode;
  $('np-viz-btn').setAttribute('aria-pressed', String(mode === 'viz'));
  $('np-viz-btn').classList.toggle('on', mode === 'viz');
  const showing = open && mode === 'viz';
  document.body.classList.toggle('audio-viz', showing);
  // Android's bars black over the visualiser, the theme's colour otherwise.
  if (showing !== barsDark) { barsDark = showing; if (showing) call('bars', '#000000', false); else window.bmThemeBars?.(); }
  if (showing && !hidden) startViz(); else stopViz();
  if (!showing) { window.bmMdBrowser?.hide(); window.bmVizPanel?.close?.(); if (full) setFull(false); }
  lyrics?.setOverlay(lyrics.overlay, true);
  keepAwake();
}

function startViz () {
  if (!viz) {
    viz = new Visualizer($('np-viz'));
    const an = player.engine?.getAnalyser?.();
    if (an) viz.analyser = an;
  }
  const s = vizSettings();
  viz.setOptions(s);
  viz.setMode(s.style && s.style !== 'off' ? s.style : 'bars');
}
function stopViz () { if (viz && viz.mode !== 'off') viz.setMode('off'); }

function setFull (on) {
  full = on;
  $('np').classList.toggle('full', on);
  $('np').classList.remove('peek');
  call('immersive', on);
  if (on) { window.bmMdBrowser?.hide(); window.bmVizPanel?.close?.(); setDrawer(false); toast('Tap to show the controls', 1600); }
  keepAwake();
}

let peekT = 0;
function peek () {
  const np = $('np');
  np.classList.add('peek');
  clearTimeout(peekT);
  peekT = setTimeout(() => np.classList.remove('peek'), 3500);
}

/** The screen stays on while the visualiser plays on it (if the setting says so). */
function keepAwake () {
  const vp = document.getElementById('vp');
  const video = vp && !vp.classList.contains('hidden');
  if (video) return;                                     // the video player decides then
  call('keepScreenOn', awakeOn() && open && mode === 'viz' && !player.paused && !hidden);
}

// ── Up Next and Lyrics ───────────────────────────────────────────────
function setDrawer (on) {
  if (on === drawerOn) return;
  drawerOn = on;
  const d = $('np-drawer'), body = $('np-drawer-body');
  d.classList.toggle('on', on);
  $('np').classList.toggle('drawer', on);
  if (on) {
    body.classList.remove('closed');
    renderQueue();
    lyrics.showTab(lyrics.tab, true);                    // its lines follow the song again
  } else setTimeout(() => { if (!drawerOn) body.classList.add('closed'); lyrics._run?.(); }, 260);
}

function renderQueue () {
  const up = player.upNext();
  const box = $('np-queue');
  const head = document.createElement('div');
  head.className = 'q-head';
  head.innerHTML = up.length ? `<span>${up.length} song${up.length === 1 ? '' : 's'} to come</span>${player.from ? `<span class="q-from">${esc(player.from)}</span>` : ''}` : '<span>Nothing after this song.</span>';
  if (!qvl) qvl = new VList(box, { rowHeight: 60, head, render: (i, row) => queueRow(i, row) });
  else { qvl.head.replaceWith(head); qvl.head = head; }
  qvl.items = up;
  qvl.setCount(up.length);
}

function queueRow (i, row) {
  const s = qvl.items[i];
  row.className = 'vrow qrow';
  row.innerHTML = `<span class="art" style="background-image:${artBg(songArt(s))}"></span><span class="txt"><span class="t1">${esc(s.title)}</span><span class="t2">${esc(s.artist || 'Unknown artist')}</span></span><button class="qx m-ib" type="button" aria-label="Take out of the queue">${ICONS.x}</button>`;
}

// ── showing the song ─────────────────────────────────────────────────
function trackChanged (s) {
  showTrack(s);
  updateMini();
  if (s) {
    setSharedArt(songArt(s, 480) || null);
    lyrics.song(lyricsKey(s), { title: s.title, artist: s.artist, album: s.album, duration: s.duration });
  } else lyrics.clear();
  if (drawerOn) renderQueue();
}

function showTrack (s) {
  if (!s) return;
  const big = s.id ? `/art/audio/${s.id}?s=720` : '';
  $('np-art').style.backgroundImage = artBg(big);
  $('np-bg').style.backgroundImage = artBg(s.id ? songArt(s, 144) : '');
  $('np-title').textContent = s.title;
  $('np-sub').textContent = [s.artist || 'Unknown artist', s.album].filter(Boolean).join(' · ');
  $('np-from-k').textContent = player.from ? 'Playing from' : 'Now playing';
  $('np-from').textContent = player.from.replace(/^(Album|Artist|Folder): /, '');
}

function updateMini () {
  const s = player.current, m = $('mini');
  m.classList.toggle('hidden', !s);
  document.body.classList.toggle('has-mini', !!s);
  if (!s) return;
  $('mini-art').style.backgroundImage = artBg(songArt(s));
  $('mini-title').textContent = s.title;
  $('mini-sub').textContent = s.artist || s.album || '';
}

function updateState () {
  const p = player.paused;
  setIcon($('np-play'), p ? 'play' : 'pause'); $('np-play').setAttribute('aria-label', p ? 'Play' : 'Pause');
  setIcon($('mini-play'), p ? 'play' : 'pause'); $('mini-play').setAttribute('aria-label', p ? 'Play' : 'Pause');
  $('np').classList.toggle('paused', p);
}

function updateModes () {
  const sh = $('np-shuffle'), rp = $('np-repeat');
  sh.classList.toggle('on', player.shuffle); sh.setAttribute('aria-pressed', String(player.shuffle));
  setIcon(rp, player.repeat === 'one' ? 'repeatOne' : 'repeat');
  rp.classList.toggle('on', player.repeat !== 'off');
  rp.setAttribute('aria-label', 'Repeat: ' + (player.repeat === 'one' ? 'this song' : player.repeat));
}

function updateTime () {
  const t = player.time, d = player.duration;
  if (!seeking) {
    $('np-cur').textContent = fmtTime(t);
    $('np-range').value = d ? Math.round(t / d * 1000) : 0;
    fillRange($('np-range'));
  }
  $('np-dur').textContent = fmtTime(d);
  $('mini-prog').style.transform = `scaleX(${d ? Math.min(1, t / d) : 0})`;
  const sp = player.speed, el = $('np-speed');
  el.classList.toggle('hidden', Math.abs(sp - 1) < 0.01);
  el.textContent = sp.toFixed(2).replace(/0$/, '') + '×';
}

// ── more ─────────────────────────────────────────────────────────────
/** Stops the music and puts it away (v3.43.0): Now Playing, the bar, the notification. */
function stopAndClose () {
  if (open) closePlayer();
  player.close();
  toast('Music stopped', 1300);
}

function moreMenu () {
  const s = player.current; if (!s) return;
  const eq = player.eq();
  sheet({
    title: s.title, sub: [s.artist, s.album].filter(Boolean).join(' · '), art: songArt(s),
    items: [
      { icon: 'speed', label: 'Speed', note: player.speed === 1 ? 'Normal' : player.speed + '×', action: speedMenu },
      { icon: 'eq', label: 'Equaliser', note: player.engine?.available ? (eq.name || 'Custom') : 'Not on this phone', action: eqSheet },
      { icon: 'lyrics', label: 'Lyrics', action: () => { lyrics.showTab('lyrics'); setDrawer(true); } },
      ...[favItem(songFav(s))].filter(Boolean),
      { icon: 'more', label: 'More about this song', action: () => songMenu(s, { fromPlayer: true }) },
      { icon: 'x', label: 'Stop and close', note: 'The music bar goes until something plays', action: stopAndClose },
    ],
  });
}

function speedMenu () {
  const cur = player.speed;
  sheet({
    title: 'Speed', sub: 'The pitch stays the same.',
    items: [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map(v => ({ label: v === 1 ? 'Normal' : v + '×', on: Math.abs(cur - v) < 0.001, action: () => player.setSpeed(v) })),
  });
}

function eqSheet () {
  if (!player.engine?.available) { toast('The equaliser needs Web Audio, which this phone\'s web engine does not have.'); return; }
  const cur = player.eq();
  let gains = cur.gains.slice(0, 10);
  while (gains.length < 10) gains.push(0);
  const body = document.createElement('div');
  body.className = 'eq';
  body.innerHTML = `<div class="eq-presets">${EQ_PRESETS.map(([n]) => `<button type="button" class="chip${n === cur.name ? ' on' : ''}" data-p="${n}">${n}</button>`).join('')}</div>` +
    `<div class="eq-bands">${EQ_BANDS.map((f, i) => `<label class="eq-band"><span class="eq-val" id="eq-v${i}">${gains[i] > 0 ? '+' : ''}${gains[i]}</span><input type="range" min="-12" max="12" step="1" value="${gains[i]}" data-i="${i}" aria-label="${f} Hz"><span class="eq-f">${f}</span></label>`).join('')}</div>`;
  const set = (g, name) => { gains = g; player.setEQ(gains, name); };
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const p = EQ_PRESETS.find(x => x[0] === b.dataset.p); if (!p) return;
    set(p[1].slice(), p[0]);
    for (const c of body.querySelectorAll('.chip')) c.classList.toggle('on', c === b);
    body.querySelectorAll('input[type=range]').forEach((r, i) => { r.value = gains[i]; body.querySelector('#eq-v' + i).textContent = (gains[i] > 0 ? '+' : '') + gains[i]; });
  });
  body.addEventListener('input', e => {
    const r = e.target.closest('input[type=range]'); if (!r) return;
    const i = +r.dataset.i, g = gains.slice(); g[i] = +r.value;
    body.querySelector('#eq-v' + i).textContent = (g[i] > 0 ? '+' : '') + g[i];
    for (const c of body.querySelectorAll('.chip')) c.classList.remove('on');
    set(g, 'Custom');
  });
  sheet({ title: 'Equaliser', sub: 'Ten bands, from the deepest bass to the highest treble.', body, wide: true });
}

// ── swipes ───────────────────────────────────────────────────────────
/** Left, right, up or down across el: a quick drag of 60 pixels or more. */
function swipe (el, fns) {
  let x0 = 0, y0 = 0, t0 = 0, id = null;
  el.addEventListener('pointerdown', e => { if (e.target.closest('input')) return; id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); }, { passive: true });
  el.addEventListener('pointerup', e => {
    if (e.pointerId !== id) return; id = null;
    const dx = e.clientX - x0, dy = e.clientY - y0, dt = performance.now() - t0;
    if (dt > 700 || Math.max(Math.abs(dx), Math.abs(dy)) < 60) return;
    const f = Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx < 0 ? fns.left : fns.right) : Math.abs(dy) > Math.abs(dx) * 1.4 ? (dy > 0 ? fns.down : fns.up) : null;
    // the flag first: a swipe whose action failed left every later tap on the bar swallowed
    if (f) { el.dataset.swiped = '1'; setTimeout(() => delete el.dataset.swiped, 50); f(); }
  }, { passive: true });
  el.addEventListener('pointercancel', () => { id = null; }, { passive: true });
  el.addEventListener('click', e => { if (el.dataset.swiped) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
