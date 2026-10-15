/**
 * m-settings: the Settings tab. The theme (every theme the desktop has),
 * the battery saver and the visualiser's quality (the desktop's power.js
 * and perf.js), keeping the screen on, which audio files count as music,
 * lyrics online, the video player (mpv or the web engine) and the
 * subtitles' look, access to music and videos, and About, with the app's
 * log for a problem report and the licences.
 */
import { $, esc, sheet, toast } from './m-ui.js';
import { call, info, permission } from './m-android.js';
import { power, setSaverMode } from './power.js';
import { perf } from './perf.js';
import { showAll, setShowAll } from './m-library.js';
import { awakeOn, setAwake } from './m-nowplaying.js';
import { savedCount, clearSaved } from './m-lyrics.js';
import { applySubStyle, playerNote } from './m-video.js';
import { mpv, setChoice } from './m-mpv.js';
import { gestures, setGesture } from './m-vgest.js';
import { sfx } from './play/sfx.js';
import { recent, clearRecent } from './m-recent.js';
import { favs, clearFavs, homeRows, setHomeRow } from './m-favs.js';
import { keepQueue, setKeepQueue } from './m-player.js';

export const THEMES = [['dark', 'Dark'], ['light', 'Light'], ['midnight', 'Midnight'], ['ocean', 'Ocean'], ['northern', 'Northern'], ['forest', 'Forest'], ['dracula', 'Dracula'],
  ['cyberpunk', 'Cyberpunk'], ['sunset', 'Sunset'], ['golden', 'Golden'], ['sakura', 'Sakura'], ['lavender', 'Lavender'], ['snow', 'Snow'], ['glass', 'Glass']];

/** A CSS colour as #rrggbb, laid over black where it is see-through. */
function hex (c) {
  c = String(c || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return '#' + m[1].split('').map(x => x + x).join('');
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?/i.exec(c);
  if (!m) return '#080b14';
  let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
  if (a < 0.5) a = 1;                                    // the glass theme: its own colour, solid
  return '#' + [m[1], m[2], m[3]].map(x => Math.round(+x * a).toString(16).padStart(2, '0')).join('');
}

export function applyTheme (name) {
  if (!THEMES.some(t => t[0] === name)) name = 'dark';
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem('bm_m_theme', name); } catch (_) {}
  const cs = getComputedStyle(document.documentElement);
  const bg = hex(cs.getPropertyValue('--bg'));
  const lum = parseInt(bg.slice(1, 3), 16) * 0.299 + parseInt(bg.slice(3, 5), 16) * 0.587 + parseInt(bg.slice(5, 7), 16) * 0.114;
  call('bars', bg, lum > 150);
  for (const b of document.querySelectorAll('#st-themes button')) b.classList.toggle('on', b.dataset.v === name);
  // The home screen's background and fox follow the theme (m-home.js, v3.42.0).
  try { window.dispatchEvent(new CustomEvent('bm-theme', { detail: name })); } catch (_) {}
}

/** Android's bars back in the theme's colour (after the visualiser made them black). */
window.bmThemeBars = () => applyTheme(document.documentElement.dataset.theme || 'dark');

export function initSettings ({ onShowAll, onRescan }) {
  const themes = $('st-themes');
  themes.innerHTML = THEMES.map(([v, label]) => `<button type="button" class="st-theme" data-theme-pick="${v}" data-v="${v}"><span class="st-swatch" data-theme-swatch="${v}"></span><span>${esc(label)}</span></button>`).join('');
  themes.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) applyTheme(b.dataset.v); });
  // Each swatch shows its own theme's colours (themes.css gives every theme's tokens to its swatch too).

  seg('st-saver', power.mode, v => { setSaverMode(v); toast(v === 'auto' ? 'Battery saver: on when not charging' : v === 'on' ? 'Battery saver: always on' : 'Battery saver: off', 1600); });
  const given = perf.chosen ? '' : perf.tier;
  $('st-quality-note').textContent = 'How much the visualiser draws. Higher looks finer and uses more power.' + (given ? ` This phone started on ${given === 'low' ? 'Low' : given === 'medium' ? 'Medium' : 'High'}.` : '');
  seg('st-quality', perf.tier, v => { perf.setSessionTier(null); perf.setTier(v); });

  check('st-awake', awakeOn(), setAwake);
  check('st-allaudio', showAll(), on => { setShowAll(on); onShowAll?.(); });
  check('st-lyr-online', localStorage.getItem('bm_lyrics_online') !== '0', on => {
    localStorage.setItem('bm_lyrics_online', on ? '1' : '0');
    if (window.bmLyrics) { window.bmLyrics.online = on; if (on && window.bmLyrics.status === 'none') window.bmLyrics.reload(); else window.bmLyrics._render(); }
  });
  $('st-lyr-clear').addEventListener('click', () => { const n = clearSaved(); toast(n ? `${n} saved answers cleared. Your own choices are kept.` : 'Nothing to clear.'); counts(); });
  // The video player: mpv where it can run, the web engine where it cannot or when chosen.
  const vp = $('st-vplayer');
  vp.querySelector('[data-v="mpv"]').disabled = !mpv.info.available;
  seg('st-vplayer', mpv.ready ? 'mpv' : 'web', v => {
    if (v === 'mpv' && !mpv.info.available) return;
    setChoice(v);
    $('st-vplayer-note').textContent = playerNote();
    toast(v === 'mpv' ? 'Videos play with mpv' : 'Videos play with the phone\'s web engine', 1600);
  });
  $('st-vplayer-note').textContent = playerNote();
  let size = 'm'; try { size = localStorage.getItem('bm_m_subsize') || 'm'; } catch (_) {}
  seg('st-sub-size', size, v => { localStorage.setItem('bm_m_subsize', v); applySubStyle(); });
  check('st-sub-box', localStorage.getItem('bm_m_subbox') === '1', on => { localStorage.setItem('bm_m_subbox', on ? '1' : '0'); applySubStyle(); });
  // v3.42.0: the player's swipes, playing on, the fox, the recent things
  check('st-vnext', localStorage.getItem('bm_m_vnext') !== '0', on => localStorage.setItem('bm_m_vnext', on ? '1' : '0'));
  const gest = $('st-gest'), markGest = () => { const g = gestures(); for (const b of gest.querySelectorAll('button')) b.classList.toggle('on', !!g[b.dataset.v]); };
  markGest();
  gest.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; setGesture(b.dataset.v, !gestures()[b.dataset.v]); markGest(); });
  check('st-fox-sound', sfx.on, on => { sfx.on = on; });
  $('st-recent-clear').addEventListener('click', () => { clearRecent(); toast('Home\'s recent list is empty. Where each video was left is kept.'); counts(); });
  // v3.43.0: Home's two rows, the favourites, and the music kept for next time
  check('st-home-recent', homeRows().recent, on => setHomeRow('recent', on));
  check('st-home-favs', homeRows().favs, on => setHomeRow('favs', on));
  $('st-fav-clear').addEventListener('click', () => { const n = clearFavs(); toast(n ? 'No favourites now.' : 'There were none.', 1600); counts(); });
  check('st-keepq', keepQueue(), setKeepQueue);
  $('st-acc-image-btn').addEventListener('click', () => access('image'));
  $('st-acc-mic-btn').addEventListener('click', () => access('mic'));

  $('st-acc-audio-btn').addEventListener('click', () => access('audio'));
  $('st-acc-video-btn').addEventListener('click', () => access('video'));
  $('st-rescan').addEventListener('click', () => onRescan?.());
  $('st-log').addEventListener('click', showLog);
  $('st-github').addEventListener('click', () => call('openUrl', 'https://github.com/BritMat/bm-player'));
  $('st-licences').addEventListener('click', licences);
  const i = info;
  $('st-about').textContent = `Version ${i.version || '?'} · Android ${i.release || '?'} (API ${i.sdk || '?'}) · ${i.device || ''}` + (i.webview && i.webview !== '?' ? ` · ${i.webview}` : '');
  refresh();
}

/** What may change while the app runs: access, the counts, lyrics online (also set in the lyrics view). */
export function refresh () {
  $('st-lyr-online').checked = localStorage.getItem('bm_lyrics_online') !== '0';
  $('st-fox-sound').checked = sfx.on;
  for (const k of ['audio', 'video', 'image', 'mic']) {
    const p = permission(k);
    $('st-acc-' + k).textContent = p === 'granted' ? 'Allowed' : p === 'denied' ? 'Turned off in Android\'s settings' : 'Not allowed yet';
    const b = $('st-acc-' + k + '-btn');
    b.textContent = p === 'granted' ? 'Allowed' : p === 'denied' ? 'Settings' : 'Allow';
    b.disabled = p === 'granted';
  }
  counts();
}

function counts () {
  const n = savedCount(); $('st-lyr-count').textContent = n ? `Answers for ${n} song${n === 1 ? '' : 's'} are kept, so each song is looked up once.` : 'None kept yet.';
  const r = recent().length; $('st-recent-n').textContent = r ? `${r} thing${r === 1 ? '' : 's'} opened lately.` : 'Nothing yet.';
  const f = favs().length; $('st-fav-n').textContent = f ? `${f} starred.` : 'Nothing starred yet.';
}

function access (kind) {
  const p = permission(kind);
  if (p === 'denied') call('openAppSettings'); else call('requestPermission', kind);
}

function seg (id, value, set) {
  const box = $(id);
  const mark = v => { for (const b of box.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v); };
  mark(value);
  box.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; mark(b.dataset.v); set(b.dataset.v); });
}

function check (id, value, set) {
  const i = $(id);
  i.checked = !!value;
  i.addEventListener('change', () => set(i.checked));
}

function showLog () {
  const text = [call('logText') || '', ...(window.__bmErrors || []).map(e => 'page error: ' + e)].join('\n').trim();
  const body = document.createElement('div');
  body.className = 'sh-log';
  body.innerHTML = '<pre class="st-sel"></pre><div class="sh-btns"><button class="m-btn" type="button" data-share>Share</button><button class="m-btn m-btn-2" type="button" data-copy>Copy</button></div>';
  body.querySelector('pre').textContent = text || 'Nothing in the log yet.';
  body.querySelector('[data-share]').addEventListener('click', () => call('share', `BM Player ${info.version || ''} on Android ${info.release || ''} (${info.device || ''})\n\n${text}`, 'BM Player log'));
  body.querySelector('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (_) { toast('Could not copy: use Share instead.'); } });
  sheet({ title: 'The app\'s log', sub: 'Newest at the bottom. Nothing in it is sent anywhere unless you share it.', body, wide: true });
  setTimeout(() => { const pre = body.querySelector('pre'); pre.scrollTop = pre.scrollHeight; }, 50);
}

function licences () {
  const files = [['BM Player', 'LICENSE.txt'], ['mpv and FFmpeg (the video engine)', 'licenses/NOTICE.txt'],
    ['GNU GPL version 3 (mpv, FFmpeg)', 'licenses/GPL-3.0.txt'], ['GNU LGPL version 2.1', 'licenses/LGPL-2.1.txt'], ['mpv\'s licensing notes', 'licenses/mpv-Copyright.txt'],
    ['mpv-android', 'licenses/mpv-android-LICENSE.txt'], ['butterchurn (MilkDrop)', 'vendor/milkdrop/LICENSE.txt'], ['WebGL Fluid', 'vendor/webgl-fluid/LICENSE.txt'], ['pdf.js (the PDF reader)', 'vendor/pdfjs-LICENSE.txt'],
    ['Outfit', 'fonts/OFL-Outfit.txt'], ['Unbounded', 'fonts/OFL-Unbounded.txt']];
  sheet({
    title: 'Licences', sub: 'BM Player and what it is built with.',
    items: files.map(([name, path]) => ({ label: name, action: async () => {
      let text = '';
      try { text = await (await fetch(path)).text(); } catch (_) { text = 'Could not be read.'; }
      const body = document.createElement('div'); body.className = 'sh-log';
      body.innerHTML = '<pre class="st-sel"></pre>';
      body.querySelector('pre').textContent = text;
      sheet({ title: name, body, wide: true });
    } })),
  });
}
