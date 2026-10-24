/**
 * m-update: new versions from GitHub (v3.44.0). Android does the work
 * (Updater.java: the check, the download, its checks, and Android's own
 * installer). This shows where it stands and asks it to go on.
 *
 * Where it shows: Settings, About (a line, a button and a bar), a card at the
 * top of Home and a dot on the Settings tab while a newer version is out, and
 * a sheet with its size and Download and install.
 *
 * It looks by itself once a day when Settings allows it, a few seconds after
 * the app starts so the start is not slowed, and again when the app comes
 * back to the front a day later. Nothing is downloaded until Update is
 * chosen. Android asks before it installs. Once BM Player has installed
 * itself, Android 12 and later may not ask again.
 */
import { call, on, has, info } from './m-android.js';
import { $, toast, sheet, closeSheet } from './m-ui.js';

const DAY = 24 * 3600 * 1000;
const ls = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch (_) {}
  return null;
};

let st = { state: 'idle' };
let sheetBody = null;              // the sheet's body while it is open
let installWhenReady = false;      // Download and install: the install follows the download
let asked = false;                 // a check the person asked for: what it finds opens the sheet
let inFront = true;                // Android shows its question only over an app in front

export const updateState = () => st;
export const autoOn = () => ls('bm_m_upd_auto') !== '0';
export function setAuto (on) { ls('bm_m_upd_auto', on ? '1' : '0'); if (on) autoCheck(true); }

const mb = n => n > 0 ? `${(n / 1048576).toFixed(n >= 100 * 1048576 ? 0 : 1)} MB` : '';
/** A newer version is offered (found, downloading, downloaded or installing). */
const newer = () => !!st.version && ['available', 'downloading', 'ready', 'installing'].includes(st.state);
const pct = () => st.total > 0 ? Math.min(100, Math.floor((st.got || 0) * 100 / st.total)) : 0;

function cmp (a, b) {
  const p = v => String(v || '').replace(/^v/i, '').split('-')[0].split('.').map(x => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
  return 0;
}

function when (t) {
  if (!t) return '';
  const d = new Date(t), now = new Date();
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `today at ${hm}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `yesterday at ${hm}`;
  return 'on ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Where things stand, in a line, and what the button next to it does. */
function describe () {
  const v = st.version, size = mb(st.size), err = st.error ? ' ' + st.error : '';
  switch (st.state) {
    case 'checking': return { note: 'Looking on GitHub…', btn: 'Check', busy: true };
    case 'available': return { note: `Version ${v} is out${size ? `, ${size}` : ''}. You have ${st.current}.${err}`, btn: 'Update' };
    case 'downloading': return { note: `Downloading ${v}: ${pct()}% of ${mb(st.total) || size}.`, btn: 'Stop' };
    case 'ready':
      if (st.canInstall === false) return { note: `Version ${v} is downloaded and checked. Android needs your OK for BM Player to install it: Allow, switch it on, then come back here.`, btn: 'Allow' };
      return { note: `Version ${v} is downloaded and checked.${err}`, btn: 'Install' };
    case 'installing': return { note: `Android is installing ${v}. BM Player closes while it does, and opens from its icon after.`, btn: 'Install' };
    case 'none': return { note: `${st.current || info.version || 'This'} is the newest version.${st.checked ? ` Looked ${when(st.checked)}.` : ''}`, btn: 'Check' };
    case 'error': return { note: st.error || 'The check did not work.', btn: 'Try again' };
    default: return { note: 'Not looked yet.', btn: 'Check' };
  }
}

/** The button: whatever comes next. fromSheet: the sheet's own button, which downloads rather than opening the sheet. */
function act (fromSheet) {
  switch (st.state) {
    case 'available':
      if (!fromSheet) { openSheet(); return; }
      installWhenReady = true;
      call('updateDownload');
      return;
    case 'downloading': installWhenReady = false; call('updateCancel'); return;
    case 'ready':
      if (st.canInstall === false) call('updateAllowInstalls');
      else call('updateInstall');
      return;
    case 'installing': call('updateInstall'); return;        // Android's question again, if it was put away
    case 'checking': return;
    default:
      asked = true;
      ls('bm_m_upd_last', String(Date.now()));
      call('updateCheck', true);
  }
}

function render () {
  const d = describe();
  const note = $('st-upd-note'), btn = $('st-upd-btn');
  if (note) note.textContent = d.note;
  if (btn) { btn.textContent = d.btn; btn.disabled = !!d.busy; }
  const prog = $('st-upd-prog');
  if (prog) {
    prog.classList.toggle('hidden', st.state !== 'downloading');
    $('st-upd-bar').style.transform = `scaleX(${pct() / 100})`;
  }
  // Home's card, until Later for this version
  const card = $('home-upd');
  if (card) {
    const show = newer() && ls('bm_m_upd_later') !== st.version;
    card.classList.toggle('hidden', !show);
    if (show) {
      $('home-upd-title').textContent = `BM Player ${st.version}`;
      $('home-upd-sub').textContent = st.state === 'downloading' ? `Downloading, ${pct()}%`
        : st.state === 'ready' ? (st.canInstall === false ? 'Downloaded. Android needs your OK to install it.' : 'Downloaded and checked, ready to install')
          : st.state === 'installing' ? 'Android is installing it'
            : `A new version${st.size ? `, ${mb(st.size)}` : ''}`;
      $('home-upd-go').textContent = st.state === 'ready' ? (st.canInstall === false ? 'Allow' : 'Install') : st.state === 'downloading' ? 'Show' : st.state === 'installing' ? 'Install' : 'Update';
    }
  }
  document.querySelector('#nav button[data-tab="settings"]')?.classList.toggle('dot', newer());
  if (sheetBody) renderSheet();
}

function renderSheet () {
  const b = sheetBody, d = describe();
  b.querySelector('.upd-note').textContent = d.note + (st.state === 'available' && st.metered ? ' The phone is on mobile data.' : '');
  b.querySelector('.upd-prog').classList.toggle('hidden', st.state !== 'downloading');
  b.querySelector('.upd-prog i').style.transform = `scaleX(${pct() / 100})`;
  const go = b.querySelector('[data-go]');
  go.textContent = st.state === 'available' ? 'Download and install' : d.btn;
  go.disabled = !!d.busy || !newer() && st.state !== 'error';
  b.querySelector('[data-new]').classList.toggle('hidden', !st.page);
}

function openSheet () {
  if (!newer()) return;
  const body = document.createElement('div');
  body.className = 'upd';
  body.innerHTML = '<p class="upd-note"></p><div class="upd-prog hidden"><i></i></div>'
    + '<div class="sh-btns"><button class="m-btn" type="button" data-go></button><button class="m-btn m-btn-2" type="button" data-new>What\'s new</button></div>'
    + '<p class="upd-small">From GitHub (github.com/BritMat/bm-player). BM Player checks the download against GitHub\'s checksum and its own key before Android installs it, and your music, settings and favourites stay.</p>';
  body.querySelector('[data-go]').addEventListener('click', () => act(true));
  body.querySelector('[data-new]').addEventListener('click', () => { if (st.page) call('openUrl', st.page); });
  sheetBody = body;
  sheet({ title: `BM Player ${st.version}`, sub: st.size ? `${mb(st.size)}, you have ${st.current}` : `You have ${st.current}`, body, onClose: () => { if (sheetBody === body) sheetBody = null; } });
  renderSheet();
}

function autoCheck (soon) {
  if (!autoOn() || !has('updateCheck')) return;
  const last = +(ls('bm_m_upd_last') || 0);
  if (Date.now() - last < DAY && last <= Date.now()) return;
  setTimeout(() => {
    if (['checking', 'downloading', 'installing'].includes(st.state)) return;
    ls('bm_m_upd_last', String(Date.now()));
    call('updateCheck', false);
  }, soon ? 300 : 8000);
}

export function initUpdate () {
  const rows = $('st-upd-rows');
  if (!has('updateState')) { rows?.classList.add('hidden'); return; }
  try { st = JSON.parse(call('updateState') || '{}') || {}; } catch (_) { st = {}; }
  on('update', data => {
    const was = st.state;
    st = data || {};
    if (st.state === 'ready' && was === 'downloading' && installWhenReady) {
      // In front only: Android refuses to show its question over another app.
      // Behind others, Home's card says it is ready, and Install asks then.
      installWhenReady = false;
      if (st.canInstall !== false && inFront) call('updateInstall');
    }
    if (asked && st.state !== 'checking') {
      asked = false;
      if (st.state === 'available' || st.state === 'ready') openSheet();
      else if (st.state === 'none') toast(`${st.current || 'This'} is the newest version.`, 1800);
    }
    render();
  });
  $('st-upd-btn').addEventListener('click', () => act(false));
  const auto = $('st-upd-auto');
  auto.checked = autoOn();
  auto.addEventListener('change', () => setAuto(auto.checked));
  $('home-upd-go').addEventListener('click', () => { if (st.state === 'ready') act(false); else openSheet(); });
  $('home-upd-x').addEventListener('click', () => { if (st.version) ls('bm_m_upd_later', st.version); render(); });
  render();

  // Updated: said once, on the first start of the new version.
  const v = info.version, before = ls('bm_m_ver');
  if (v && v !== 'dev') {
    if (before && before !== v && cmp(v, before) > 0) setTimeout(() => toast(`BM Player is updated to ${v}.`, 2600), 1200);
    ls('bm_m_ver', v);
  }
  autoCheck(false);
  on('lifecycle', d => { inFront = d.state === 'foreground'; if (inFront) autoCheck(true); });
}

/** Settings shows it again (its note says when the last look was). */
export function refreshUpdate () { render(); }
