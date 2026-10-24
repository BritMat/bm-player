/**
 * m-main: BM Player for Android starts here. The tabs, Back, Android's
 * events, and the order things start in: the theme, the player, each tab,
 * then the music library, and the queue as it was left.
 *
 * v3.42.0: Home is the first tab (the fox, Browse and Resume, and play),
 * Photos is new, and pictures and PDFs open in their own viewers, from the
 * app or from other apps.
 */
import { call, on, onBack, isAndroid, has } from './m-android.js';
import { $, toast, closeSheet, sheetOpen, pickFile } from './m-ui.js';
import { lib } from './m-library.js';
import { player } from './m-player.js';
import { initMusic, loadMusic, closeDetail, detailOpen, closeSearch, rebuild } from './m-music.js';
import { initPlayerUI, openPlayer, playerBack } from './m-nowplaying.js';
import { initVideos, loadAll as loadVideos, openVideo, videoBack, videosState } from './m-video.js';
import { initSettings, applyTheme, refresh as refreshSettings } from './m-settings.js';
import { initHome, homeVisible, homeBack } from './m-home.js';
import { initPhotos, loadPhotos, photosState } from './m-photos.js';
import { initViewer, openImages, viewerBack, viewerOpen } from './m-viewer.js';
import { initPdf, openPdf, pdfBack, pdfOpen } from './m-pdf.js';
import { initSub, closeSub, subOpen } from './m-sub.js';
import { remember, forget } from './m-recent.js';
import { songArt } from './m-library.js';
import { startPower } from './power.js';
import { perf } from './perf.js';
import { MD, allVisualisers } from './visualizer.js';
import { FluidFX } from './fluid.js';
import { favs } from './m-favs.js';
import { initUpdate, refreshUpdate } from './m-update.js';

let tab = 'home';

function showTab (t) {
  if (t === tab) return;
  tab = t;
  closeDetail();
  closeSub(true);
  for (const v of document.querySelectorAll('.m-view[data-tab]')) v.classList.toggle('hidden', v.dataset.tab !== t);
  for (const b of $('nav').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === t);
  homeVisible(t === 'home');
  if (t === 'videos') loadVideos();
  if (t === 'photos') loadPhotos();
  if (t === 'settings') { refreshSettings(); refreshUpdate(); }
}

async function startMusic () {
  const ok = await loadMusic();
  if (ok && !player.current) player.restore();
  return ok;
}

/** A file to open, by what it is: 'open' events, and files chosen in a desktop browser. */
function openThing (d) {
  const name = String(d.name || ''), title = name.replace(/\.[^.]+$/, '') || 'File';
  if (d.kind === 'video') openVideo({ url: d.url, title, file: name, docKey: d.key || null, size: d.size || 0 });
  else if (d.kind === 'image') openImages([{ url: d.url, title: name || 'Picture', mime: d.mime || '', docKey: d.key || null }], 0);
  else if (d.kind === 'pdf') openPdf({ url: d.url, title: title || 'Document', docKey: d.key || null });
  else { player.playFile(d); openPlayer(); }
}

const kindOf = (type, name) => /^video\//.test(type) || /\.(mkv|mp4|m4v|webm|avi|mov|ts|flv|wmv|3gp)$/i.test(name) ? 'video'
  : /^image\//.test(type) ? 'image' : /pdf/.test(type) || /\.pdf$/i.test(name) ? 'pdf' : 'audio';

/** Something from Home's recent row, or Resume. */
function openEntry (e) {
  let url = e.url;
  if (e.docKey) {
    const u = call('reopen', e.docKey);
    if (u) url = u;
    else if (/^\/opened\//.test(url || '')) { toast('That file is no longer there, or BM Player may no longer open it.', 2600); forget(e.key); return; }
  }
  if (e.kind === 'video') {
    const item = e.id ? lib.videos.find(x => x.id === e.id) : null;
    openVideo(item || { url, title: e.title, id: e.id, thumb: e.thumb, file: e.file, size: e.size, docKey: e.docKey || null, folder: e.sub });
  } else if (e.kind === 'music') {
    // The music playing carries on. Put away (the X), the song it was plays again (v3.43.0).
    const s = e.id ? lib.byId.get(e.id) : null;
    if (player.current) { if (player.paused) player.play(); openPlayer(); }
    else if (s) { player.playList([s], 0, { shuffle: false, from: '' }); openPlayer(); }
    else showTab('music');
  } else if (e.kind === 'image') openImages([{ url, title: e.title, docKey: e.docKey || null }], 0);
  else if (e.kind === 'pdf') openPdf({ url, title: e.title, key: e.key, docKey: e.docKey || null });
}

/** A favourite (v3.43.0): a song plays with the other starred songs after it, anything else opens as a recent thing does. */
function openFav (e) {
  if (e.kind !== 'music') { openEntry(e); return; }
  const songs = favs().filter(f => f.kind === 'music').map(f => lib.byId.get(f.id)).filter(Boolean);
  const i = songs.findIndex(s => s.id === e.id);
  if (i < 0) { toast(lib.loaded ? 'That song is no longer on this phone.' : 'The music is not read yet: allow access to it in Settings.', 2400); return; }
  player.playList(songs, i, { shuffle: false, from: 'Favourites' });
  openPlayer();
}

async function browse (where) {
  if (where !== 'file') { showTab(where); return; }
  if (has('pickMedia')) { call('pickMedia', 'any'); return; }
  const f = await pickFile('audio/*,video/*,image/*,application/pdf');
  if (!f) return;
  openThing({ url: URL.createObjectURL(f), name: f.name, mime: f.type, size: f.size, kind: kindOf(f.type, f.name) });
}

/**
 * Graphics memory given back now (v3.44.0), not after the half minute or so
 * a hidden effect waits on its own (fluid.js, visualizer.js): five seconds
 * after the app went behind others, and at once when Android says memory is
 * short. A smaller app is the last Android closes, and the music lives in it.
 * What is drawn again builds itself again.
 */
let bgRest = 0;
function restNow () {
  for (const f of FluidFX.all || []) { try { if (!f._raf) f.sleep(); } catch (_) {} }
  for (const v of allVisualisers()) { try { if (!v.active || v._hid) v._rest(); } catch (_) {} }
}

function boot () {
  if (window.__bmTooOld) return;
  applyTheme(document.documentElement.dataset.theme || 'dark');
  window.bmApp = { showOSD: text => toast(text, 1600) };     // the desktop's modules show notes through this
  // A phone's graphics are a laptop's at best: High only when chosen in Settings.
  if (!perf.chosen && perf.tier === 'high') perf.setSessionTier('medium');
  // MilkDrop starts a size down on a phone, two on a weak one: it steps down
  // further by itself if frames are slow, and the battery saver takes one more.
  MD.set = true;
  MD.level = MD.start = perf.tier === 'low' ? 2 : perf.tier === 'medium' ? 1 : 0;

  player.init();
  initMusic();
  initPlayerUI();
  initVideos();
  initSub();
  initPhotos();
  initViewer();
  initPdf();
  initSettings({ onShowAll: rebuild, onRescan: async () => {
    toast('Looking for new files…', 1200);
    await startMusic();
    if (videosState() === 'ready') await loadVideos(true);
    if (photosState() === 'ready') await loadPhotos(true);
    toast(`${lib.songs.length} songs, ${lib.videos.length} videos, ${lib.images.length} pictures`);
  } });
  startPower({
    api: { power: { battery: async () => !!call('onBattery'), onBattery: fn => on('battery', d => fn(!!d.onBattery)) } },
    playing: () => !player.paused,
  });
  initHome({ open: openEntry, resume: openEntry, openFav, browse });
  homeVisible(true);
  initUpdate();

  $('nav').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });

  // What plays is remembered for Home's Resume.
  player.on('track', s => { if (s) remember({ kind: 'music', key: 'music', id: s.id || 0, title: s.title, sub: s.artist || s.album || 'Music', art: songArt(s, 256) }); });

  on('permission', () => {
    refreshSettings();
    startMusic();
    if (tab === 'videos') loadVideos(true);
    if (tab === 'photos') loadPhotos(true);
  });
  on('memory', () => restNow());
  on('lifecycle', d => {
    if (d.state === 'background') { clearTimeout(bgRest); bgRest = setTimeout(restNow, 5000); return; }
    clearTimeout(bgRest);
    if (d.state !== 'foreground') return;
    // Access may have been changed in Android's settings meanwhile.
    refreshSettings();
    if (!lib.loaded) startMusic();
  });
  on('open', openThing);

  onBack(() => {
    if (sheetOpen()) { closeSheet(); return 'handled'; }
    if (viewerOpen()) { viewerBack(); return 'handled'; }
    if (pdfOpen()) { pdfBack(); return 'handled'; }
    if (videoBack()) return 'handled';
    if (playerBack()) return 'handled';
    if (closeSearch()) return 'handled';
    if (subOpen()) { closeSub(); return 'handled'; }
    if (detailOpen()) { closeDetail(); return 'handled'; }
    if (tab === 'home' && homeBack()) return 'handled';
    if (tab !== 'home') { showTab('home'); return 'handled'; }
    return 'background';
  });
  // A desktop browser has no Back button: Escape stands in (for testing).
  if (!isAndroid) document.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.defaultPrevented) window.BMNative.back(); });

  window.__bmStarted = true;
  window.__bmTab = () => tab;
  call('ready');
  startMusic();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
