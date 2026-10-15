/**
 * m-home: the Home tab (v3.42.0), the desktop's welcome screen on a phone.
 *
 * The fox in the middle, BM Player's name, Browse and Resume, the things
 * opened last, and behind it all the theme's background, as on the desktop:
 * the Flow fluid (Dark, Light, Snow, Northern), the theme's own scene
 * (Ocean, Forest, Sakura...), or Dracula's.
 *
 * Three ways to play, from the switch at the top:
 *   Fox    tap, stroke, tickle or hold it; the mic button and it repeats
 *          what you say (play/fox-play.js, play/fox-voice.js)
 *   Flow   the background as a fluid simulator, full screen, with its own
 *          settings (play/flow-toy.js)
 *   Fruit  a fruit slicing game, the juice pouring into the fluid behind
 *          (play/slice-game.js)
 *
 * Everything here draws only while it can be seen: the Home tab showing,
 * nothing over it (Now Playing, a video, a picture, a document), the app in
 * front, and in Fox mode not resting (two minutes untouched, power.js). The
 * battery saver draws it at 30 frames a second.
 */
import { $, esc, sheet, toast, artBg, fmtTime, onLongPress } from './m-ui.js';
import { ICONS } from './icons.js';
import { call, on, has, info } from './m-android.js';
import { createFox } from './fox3d.js';
import { FluidFX } from './fluid.js';
import { ThemeFX } from './theme-fx.js';
import { SCENE_THEMES } from './theme-scenes.js';
import { flowSettings } from './flow-settings.js';
import { perf } from './perf.js';
import { power, onPower } from './power.js';
import { FoxPlay } from './play/fox-play.js';
import { FoxVoice } from './play/fox-voice.js';
import { FlowToy, buildToyPanel } from './play/flow-toy.js';
import { SliceGame } from './play/slice-game.js';
import { sfx } from './play/sfx.js';
import { player } from './m-player.js';
import { recent, onRecent, forget, lastResumable, position } from './m-recent.js';
import { favs, onFavs, isFav, toggleFav, removeFav, homeRows, songFav } from './m-favs.js';
import { lib } from './m-library.js';
import { THEMES, applyTheme } from './m-settings.js';

const h = { visible: false, fg: true, mode: 'fox', fox: null, fluid: null, theme: null, play: null, voice: null, toy: null, game: null,
  opts: null, musicT: 0, hintT: 0, plays: 0 };

const MODE_ICON = {
  fox: '<svg viewBox="0 0 24 24"><path d="M4 3l4.2 4.6h7.6L20 3l-.9 9.2L12 21l-7.1-8.8z" fill="currentColor"/></svg>',
  flow: '<svg viewBox="0 0 24 24"><path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  fruit: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5" fill="currentColor"/><path d="M12 6c0-2 1-3 3-3.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
};

/**
 * opts.open(entry): opens a recent thing. opts.resume(entry): carries on
 * with it. opts.openFav(entry): opens a favourite (v3.43.0). opts.browse(where):
 * 'file', 'music', 'videos' or 'photos'.
 */
export function initHome (opts) {
  h.opts = opts;
  const lite = false;
  // the background: the fluid (WebGL) and the theme's scene (2D)
  try { h.fluid = new FluidFX($('home-flow')); } catch (e) { console.warn('[BM Player] home fluid:', e.message); $('home-flow')?.remove(); }
  try { h.theme = new ThemeFX($('home-fx')); } catch (e) { console.warn('[BM Player] home scene:', e.message); }
  // the fox
  try { h.fox = createFox($('fox-canvas'), { lite }); } catch (e) { console.warn('[BM Player] fox:', e.message); }
  if (h.fox) {
    h.play = new FoxPlay({ stage: $('fox-stage'), fox: h.fox, fx: $('fox-fx'), onPlay: kind => played(kind) });
    h.voice = new FoxVoice({ fox: h.fox, onState: voiceState });
  }
  // the fingers push the background fluid, as the mouse does on the desktop
  wireBackground();
  // the switch between the three
  const modes = $('home-modes');
  modes.innerHTML = [['fox', 'Fox'], ['flow', 'Flow'], ['fruit', 'Fruit']].map(([k, l]) => `<button type="button" data-m="${k}" class="${k === 'fox' ? 'on' : ''}" aria-pressed="${k === 'fox'}">${MODE_ICON[k]}<span>${l}</span></button>`).join('');
  modes.addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (b) setMode(b.dataset.m); });
  $('home-theme').addEventListener('click', themeSheet);
  const snd = $('home-sound');
  const markSound = () => { snd.classList.toggle('off', !sfx.on); snd.setAttribute('aria-label', sfx.on ? 'Sounds on' : 'Sounds off'); snd.innerHTML = ICONS[sfx.on ? 'volHigh' : 'volMuted'] || ''; };
  markSound();
  snd.addEventListener('click', () => { sfx.on = !sfx.on; markSound(); toast(sfx.on ? 'The fox\'s sounds are on' : 'The fox\'s sounds are off', 1400); });
  $('home-talk').addEventListener('click', toggleTalk);
  $('home-browse').addEventListener('click', browseSheet);
  $('home-resume').addEventListener('click', () => { const e = lastResumable(); if (e) h.opts.resume(e); });
  // Flow's own controls
  $('flow-close').addEventListener('click', () => setMode('fox'));
  $('flow-pause').addEventListener('click', () => { h.toy?.pause(); markToy(); });
  $('flow-clear').addEventListener('click', () => h.toy?.clear());
  $('flow-burst').addEventListener('click', () => h.toy?.burst());
  $('flow-settings').addEventListener('click', toySheet);
  // the recent things, and the favourites (v3.43.0): a tap opens, a long press offers the star
  const row = $('home-recent');
  row.addEventListener('click', e => { const c = e.target.closest('[data-key]'); if (!c) return; const en = recent().find(x => x.key === c.dataset.key); if (en) h.opts.open(en); });
  onLongPress(row, '[data-key]', el => {
    const en = recent().find(x => x.key === el.dataset.key); if (!en) return;
    const fav = favOf(en), items = [{ icon: 'play', label: 'Open', action: () => h.opts.open(en) }];
    if (fav) items.push(isFav(fav.key) ? { icon: 'starFill', label: 'Remove from favourites', action: () => { toggleFav(fav); toast('Taken out of favourites', 1300); } }
      : { icon: 'star', label: 'Add to favourites', action: () => { toggleFav(fav); toast('Added to favourites', 1300); } });
    items.push({ icon: 'trash', label: 'Remove from recent', action: () => forget(en.key) });
    sheet({ title: en.title, items });
  });
  const frow = $('home-favs');
  frow.addEventListener('click', e => { const c = e.target.closest('[data-key]'); if (!c) return; const en = favs().find(x => x.key === c.dataset.key); if (en) (h.opts.openFav || h.opts.open)(en); });
  onLongPress(frow, '[data-key]', el => {
    const en = favs().find(x => x.key === el.dataset.key); if (!en) return;
    sheet({ title: en.title, items: [{ icon: 'play', label: 'Open', action: () => (h.opts.openFav || h.opts.open)(en) }, { icon: 'starFill', label: 'Remove from favourites', action: () => removeFav(en.key) }] });
  });
  onRecent(renderRows);
  onFavs(renderRows);
  renderRows();
  // theme changes (Settings, or the theme button here)
  window.addEventListener('bm-theme', e => themeFx(e.detail));
  themeFx(document.documentElement.dataset.theme || 'dark');
  // whatever is over the home screen stops it drawing
  const mo = new MutationObserver(() => sync());
  for (const id of ['np', 'vp', 'iv', 'pv']) { const el = $(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['class'] }); }
  on('lifecycle', d => { h.fg = d.state !== 'background'; if (!h.fg) { h.voice?.stop(); h.game?.stop(); } sync(); });
  document.addEventListener('visibilitychange', () => sync());
  onPower((p, what) => { if (what === 'idle') sync(); });
  player.on?.('state', () => { renderResume(); sync(); });
  player.on?.('track', () => renderResume());
  renderResume();
  hint();
  window.__bmHome = h;      // for the page checks (scripts/android-page.mjs)
}

/** The Home tab shown (true) or another tab (false). */
export function homeVisible (on) { h.visible = !!on; if (!on && h.mode !== 'fox') setMode('fox'); sync(); }
export const homeMode = () => h.mode;

/** Back on the home screen: a game pauses, a play mode goes back to the fox. True when handled. */
export function homeBack () {
  if (!h.visible) return false;
  if (h.mode === 'fruit' && h.game?.busy) { h.game.pause(); return true; }
  if (h.mode !== 'fox') { setMode('fox'); return true; }
  if (h.voice?.on) { h.voice.stop(); return true; }
  return false;
}

// ── what draws, and when ─────────────────────────────────────────────
function covered () { return ['np', 'vp', 'iv', 'pv'].some(id => { const el = $(id); return el && !el.classList.contains('hidden'); }); }

function sync () {
  const shown = h.visible && h.fg && !document.hidden && !covered();
  const rest = h.mode === 'fox' && power.idle;
  const on = shown && !rest;
  const fluidOn = on && (h.mode !== 'fox' || h.fluidTheme);
  try { if (fluidOn) h.fluid?.resume(); else h.fluid?.pause(); } catch (_) {}
  try { if (on && h.mode === 'fox') h.theme?.resume(); else h.theme?.pause(); } catch (_) {}
  try { if (on && h.mode === 'fox') { h.fox?.resume(); h.play?.resume(); } else { h.fox?.pause(); h.play?.pause(); } } catch (_) {}
  if (!shown) { h.voice?.on && h.voice.stop(); if (h.game?.busy) h.game.pause(); }
  // the music, to the fox: only while it can be seen and the music plays
  clearInterval(h.musicT); h.musicT = 0;
  if (on && h.mode === 'fox' && !player.paused) h.musicT = setInterval(musicTick, 150);
  else h.play?.setMusic(0);
  const full = h.visible && h.mode !== 'fox';
  document.body.classList.toggle('home-full', full);
  // Android's bars: hidden for Flow and Fruit. Only when that changes, and not
  // while something else is over the home screen (it sets them itself).
  if (full !== h.full && !covered()) { h.full = full; call('immersive', full); }
}

let bins = null;
function musicTick () {
  const an = player.engine?.getAnalyser?.();
  if (!an || player.paused) { h.play?.setMusic(0); return; }
  if (!bins || bins.length !== an.frequencyBinCount) bins = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(bins);
  let bass = 0, mid = 0;
  for (let i = 1; i < 9; i++) bass += bins[i];
  for (let i = 9; i < 48; i++) mid += bins[i];
  h.play?.setMusic(Math.min(1, (bass / 8 / 255) * 0.75 + (mid / 39 / 255) * 0.4));
}

// ── the theme's background, as the desktop's applyTheme does it ─────
function themeFx (name) {
  h.fox?.setTheme?.(name);
  h.fluidTheme = false;
  if (name === 'dracula') { h.theme?.setMode('blood'); }
  else if (name === 'northern') { h.theme?.setMode('off'); h.fluidTheme = true; h.fluid?.setPalette('northern'); h.fluid?.setFlow(flowSettings()); }
  else if (SCENE_THEMES.includes(name)) { h.theme?.setMode('scene:' + name); }
  else { h.theme?.setMode(name === 'snow' ? 'snow' : 'off'); h.fluidTheme = true; h.fluid?.setFlow({}); h.fluid?.setPalette(name); }
  if (h.fluid && h.mode === 'fox') { h.fluid.setQuality(perf.tier); h.fluid.setMode(h.fluidTheme ? 'fluid' : 'off'); }
  else if (h.fluid) h.fluid.setPalette(name);
  sync();
}

function wireBackground () {
  const host = $('home-main'), c = $('home-flow');
  if (!host || !c || !h.fluid) return;
  let px = 0, py = 0, have = false;
  const norm = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / Math.max(1, r.width), 1 - (e.clientY - r.top) / Math.max(1, r.height)]; };
  host.addEventListener('pointerdown', e => {
    if (h.mode !== 'fox' || e.target.closest('button, a, input, .fox-stage, .home-recent')) return;
    const [x, y] = norm(e); px = x; py = y; have = true;
    for (let i = 0; i < 4; i++) { const a = Math.random() * Math.PI * 2; h.fluid.addPointer(x, y, Math.cos(a) * 0.06, Math.sin(a) * 0.06); }
  });
  host.addEventListener('pointermove', e => {
    if (!have || h.mode !== 'fox') return;
    const [x, y] = norm(e);
    h.fluid.addPointer(x, y, x - px, y - py);
    px = x; py = y;
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) host.addEventListener(ev, () => { have = false; });
}

// ── the three modes ──────────────────────────────────────────────────
function setMode (m) {
  if (m === h.mode) return;
  const was = h.mode;
  h.mode = m;
  for (const b of $('home-modes').querySelectorAll('button')) { const on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
  const home = $('v-home');
  home.dataset.mode = m;
  // leaving
  if (was === 'flow') { h.toy?.leave(); }
  if (was === 'fruit') { h.game?.stop(); h.fluid && (h.fluid.onFrame = null); if (h.fluidSaved) { h.fluid.restore(h.fluidSaved); h.fluidSaved = null; } }
  if (was === 'fox') { h.voice?.stop(); }
  // entering
  if (m === 'flow') {
    if (!h.fluid) { toast('Flow needs WebGL, which this phone\'s web engine does not offer.'); setMode('fox'); return; }
    if (!h.toy) h.toy = new FlowToy({ fx: h.fluid, surface: $('flow-surface'), analyser: () => player.paused ? null : player.engine?.getAnalyser?.() });
    h.toy.enter();
    markToy();
  }
  if (m === 'fruit') {
    if (h.fluid) {
      h.fluidSaved = h.fluid.snapshot();
      h.fluid.configure(f => { f.setFlow({ intensity: 0.5, trail: 0.8 }); f.setBloom(0.35, { threshold: 0.1, knee: 0.7 }); f.setNeon(false); });
      h.fluid.audioDriven = true; h.fluid.setMode('fluid');
    }
    if (!h.game) {
      h.game = new SliceGame({ canvas: $('slice-canvas'), ui: $('slice-ui'), onExit: () => setMode('fox'),
        onJuice: (x, y, dx, dy, rgb, k = 1) => { if (h.fluid) h.fluid.splat(x, y, dx, dy, rgb.map(c => c * 0.28 * k), 0.0035 * k * Math.max(1, h.fluid.canvas.width / Math.max(1, h.fluid.canvas.height))); } });
    }
  }
  if (m === 'fox') { themeFx(document.documentElement.dataset.theme || 'dark'); }
  sync();
}

function markToy () {
  const p = h.toy?.paused;
  const b = $('flow-pause');
  b.innerHTML = ICONS[p ? 'play' : 'pause'] || '';
  b.setAttribute('aria-label', p ? 'Go on' : 'Pause');
}

function toySheet () {
  if (!h.toy) return;
  const body = document.createElement('div');
  body.className = 'fp-panel sh-pad';
  buildToyPanel(h.toy, body);
  sheet({ title: 'Flow', sub: 'A fluid to play with: draw with one finger or several.', body, wide: true });
}

// ── the fox's voice ──────────────────────────────────────────────────
function toggleTalk () {
  if (!h.voice) { toast('The fox needs WebGL to talk.'); return; }
  if (h.voice.on) { h.voice.stop(); return; }
  if (!player.paused) player.pause();                // it would hear the music and repeat that
  h.play?.poke();
  h.voice.start();
}

function voiceState (state, detail) {
  const b = $('home-talk'), label = $('home-talk-label');
  b.classList.toggle('on', ['listening', 'hearing', 'talking', 'starting'].includes(state));
  b.classList.toggle('hearing', state === 'hearing');
  const words = { off: 'Talk', starting: 'Asking for the microphone…', listening: 'Listening: say something', hearing: 'Listening…', talking: 'The fox is talking', denied: 'Talk', error: 'Talk' };
  label.textContent = words[state] || 'Talk';
  if (state === 'denied') {
    const p = call('permission', 'mic');
    if (p === 'denied') sheet({ title: 'The microphone is off for BM Player', sub: 'Turn it on in the app\'s settings, under Permissions, to talk to the fox.', items: [{ icon: 'settings', label: 'Open the app\'s settings', action: () => call('openAppSettings') }] });
    else toast('The fox needs the microphone to hear you.', 2600);
  } else if (state === 'error') toast('The microphone could not be used: ' + detail, 3200);
  if (state === 'listening' || state === 'hearing' || state === 'talking') h.play?.poke();
}

// ── Browse, Resume, the recent row ───────────────────────────────────
function browseSheet () {
  sheet({
    title: 'Browse', sub: 'Open something on this phone.',
    items: [
      { icon: 'folder', label: 'A file…', note: 'A song, a video, a picture or a PDF', action: () => h.opts.browse('file') },
      { icon: 'music', label: 'Music', note: 'Songs, albums, artists, folders', action: () => h.opts.browse('music') },
      { icon: 'video', label: 'Videos', note: 'Every video, or by folder', action: () => h.opts.browse('videos') },
      { icon: 'images', label: 'Photos', note: 'Pictures, by album', action: () => h.opts.browse('photos') },
    ],
  });
}

function themeSheet () {
  const cur = document.documentElement.dataset.theme || 'dark';
  sheet({ title: 'Theme', sub: 'The colours, and the home screen\'s background.', items: THEMES.map(([v, label]) => ({ label, on: v === cur, action: () => applyTheme(v) })) });
}

function renderResume () {
  const e = lastResumable(), b = $('home-resume'), sub = $('home-resume-sub');
  if (!e) { b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  let what = e.title || '';
  if (e.kind === 'video') { const p = position(e.key); what += p ? ' · ' + fmtTime(p.t) : ''; }
  else if (e.kind === 'music') { const s = player.current; if (s) what = s.title + (s.artist ? ' · ' + s.artist : ''); }
  sub.textContent = what;
}

/** A recent thing as a favourite: the song itself for the music (the recent row keeps one entry for it). */
function favOf (e) {
  if (e.kind !== 'music') return e;
  const s = e.id ? lib.byId.get(e.id) : player.current;
  return s ? songFav(s) : null;
}

function card (e) {
  const pic = e.thumb || e.art || '';
  const icon = e.kind === 'pdf' ? ICONS.pdf : e.kind === 'image' ? ICONS.images : e.kind === 'music' ? ICONS.music : ICONS.video;
  const p = e.kind === 'video' ? position(e.key) : null;
  const bar = p && p.d ? `<span class="hr-bar"><span style="width:${Math.round(p.t / p.d * 100)}%"></span></span>` : '';
  return `<button type="button" class="hr-card" data-key="${esc(e.key)}"><span class="hr-pic${pic ? '' : ' hr-ico'}" style="${pic ? `background-image:${artBg(pic)}` : ''}">${pic ? '' : icon}${bar}</span><span class="hr-t">${esc(e.title || '')}</span><span class="hr-s">${esc(e.sub || '')}</span></button>`;
}

/** Home's two rows, each shown when it has something and Settings has it on (v3.43.0). */
function renderRows () {
  const on = homeRows();
  const rec = on.recent ? recent().slice(0, 12) : [], fv = on.favs ? favs().slice(0, 30) : [];
  $('home-recent-wrap').classList.toggle('hidden', !rec.length);
  $('home-fav-wrap').classList.toggle('hidden', !fv.length);
  $('home-main').classList.toggle('no-recent', !rec.length && !fv.length);
  $('home-recent').innerHTML = rec.map(card).join('');
  $('home-favs').innerHTML = fv.map(card).join('');
  renderResume();
}

// ── a hint under the name, changing as the fox is played with ──────
const HINTS = ['Tap, stroke or tickle the fox', 'Press Talk, and the fox repeats what you say', 'Boop its nose. Stroke its head. Tickle its chin', 'Swipe across it fast, it spins', 'Flow and Fruit are at the top'];
function played (kind) {
  h.plays++;
  if (h.plays === 4 || h.plays === 14 || h.plays === 30) hint(1);
}
function hint (step = 0) {
  const el = $('home-hint'); if (!el) return;
  h.hintN = ((h.hintN ?? -1) + (step || 1)) % HINTS.length;
  el.textContent = HINTS[h.hintN];
}
