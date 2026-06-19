/**
 * BM Player — Neon Icon Set
 *
 * Replaces the emoji/text-glyph buttons with clean inline SVG, styled via
 * CSS (see the "NEON ICON BUTTONS" block in style.css) to match the cyan →
 * violet → amber gradient from the app's real icon artwork.
 *
 * Transport controls (play/pause/stop/prev/next/rew/fwd) use solid filled
 * shapes — the universal media-player convention, and they read better at
 * small sizes than thin outlines.
 *
 * Everything else (window chrome, mute, fullscreen, info, eq, playlist,
 * panel-close) uses a consistent 2px outline-stroke language, so the UI
 * reads as one deliberate icon system rather than mismatched glyphs.
 *
 * applyIcons() injects these by id/class — it does NOT require editing
 * index.html. Whatever emoji/text currently sits inside a button gets
 * overwritten at runtime.
 */

const S = (inner, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" class="ico">${inner}</svg>`;

export const ICONS = {
  play: S(`<path d="M7 4l13 8-13 8V4z" fill="currentColor"/>`),
  pause: S(`<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>`),
  stop: S(`<rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor"/>`),
  prev: S(`<rect x="4.2" y="5" width="2.3" height="14" rx="1" fill="currentColor"/><path d="M19 5v14L8 12l11-7z" fill="currentColor"/>`),
  next: S(`<rect x="17.5" y="5" width="2.3" height="14" rx="1" fill="currentColor"/><path d="M5 5v14l11-7L5 5z" fill="currentColor"/>`),
  rewind: S(`<path d="M12 5v14L1 12l11-7z" fill="currentColor"/><path d="M23 5v14L12 12l11-7z" fill="currentColor"/>`),
  forward: S(`<path d="M12 19V5l11 7-11 7z" fill="currentColor"/><path d="M1 19V5l11 7-11 7z" fill="currentColor"/>`),

  volumeHigh: S(`<path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" stroke="none"/><path d="M16.2 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  volumeMuted: S(`<path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" stroke="none"/><line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  fullscreen: S(`<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  info: S(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none"/>`),
  equalizer: S(`<line x1="5" y1="21" x2="5" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="7" x2="5" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="5" cy="9" r="2.1" fill="currentColor" stroke="none"/><line x1="12" y1="21" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="11" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="13" r="2.1" fill="currentColor" stroke="none"/><line x1="19" y1="21" x2="19" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="19" y1="9" x2="19" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="19" cy="11" r="2.1" fill="currentColor" stroke="none"/>`),
  playlist: S(`<line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="18" x2="14" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  minimize: S(`<line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  maximize: S(`<rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/>`),
  close:    S(`<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  // Sidebar destinations
  video: S(`<rect x="3" y="6" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M17 10l4-2.4v8.8l-4-2.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`),
  music: S(`<circle cx="6.5" cy="18" r="2.6" fill="currentColor" stroke="none"/><circle cx="17" cy="16" r="2.6" fill="currentColor" stroke="none"/><path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
  image: S(`<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="9.5" r="1.7" fill="currentColor" stroke="none"/><path d="M4 17l5-5 3.5 3.5L17 10l4 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`),
  pdf: S(`<path d="M6 3h8l4 4v14H6V3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="9" y1="16.5" x2="15" y2="16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`),

  // Gallery / lightbox
  folderOpen: S(`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 10h18l-2 9H5l-2-9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`),
  chevronLeft: S(`<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
  chevronRight: S(`<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
};

/**
 * Wraps two icons (e.g. play/pause) in a single element so JS can toggle
 * between them with a class instead of re-injecting markup every frame.
 */
function togglePair(nameA, nameB, classA, classB) {
  return `<span class="ico-pair ${classA}">${ICONS[nameA]}</span><span class="ico-pair ${classB} ico-hidden">${ICONS[nameB]}</span>`;
}

/**
 * Injects every icon by element id/class. Safe to call even if some
 * targets don't exist on the page (e.g. panels not yet open).
 */
export function applyIcons() {
  const byId = {
    'btn-stop': ICONS.stop,
    'btn-prev': ICONS.prev,
    'btn-next': ICONS.next,
    'btn-rew': ICONS.rewind,
    'btn-fwd': ICONS.forward,
    'btn-fs': ICONS.fullscreen,
    'btn-info': ICONS.info,
    'btn-eq': ICONS.equalizer,
    'btn-playlist': ICONS.playlist,
    'btn-minimize': ICONS.minimize,
    'btn-maximize': ICONS.maximize,
    'btn-close': ICONS.close,
  };
  for (const [id, svg] of Object.entries(byId)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  }

  // Two-state buttons: play/pause and mute/volume.
  const playBtn = document.getElementById('btn-play');
  if (playBtn) playBtn.innerHTML = togglePair('play', 'pause', 'ico-play', 'ico-pause');

  const muteBtn = document.getElementById('btn-mute');
  if (muteBtn) muteBtn.innerHTML = togglePair('volumeHigh', 'volumeMuted', 'ico-vol-on', 'ico-vol-off');

  // Side-panel close buttons (shared class, not id)
  document.querySelectorAll('.panel-close').forEach(btn => { btn.innerHTML = ICONS.close; });
}

/** Toggle helper for two-state buttons — flips which icon is visible. */
export function setTogglePair(btnId, showFirst) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const pairs = btn.querySelectorAll('.ico-pair');
  if (pairs.length !== 2) return;
  pairs[0].classList.toggle('ico-hidden', !showFirst);
  pairs[1].classList.toggle('ico-hidden', showFirst);
}
