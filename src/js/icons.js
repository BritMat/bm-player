const S = (inner, vb='0 0 24 24') => `<svg viewBox="${vb}" class="ico" fill="none">${inner}</svg>`;
export const ICONS = {
  // ── Playback ──────────────────────────────────────────────────
  play:      S(`<path d="M7 4l13 8-13 8V4z" fill="currentColor"/>`),
  pause:     S(`<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>`),
  stop:      S(`<rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor"/>`),
  prev:      S(`<rect x="4" y="5" width="2.5" height="14" rx="1" fill="currentColor"/><path d="M19 5v14L8 12l11-7z" fill="currentColor"/>`),
  next:      S(`<rect x="17.5" y="5" width="2.5" height="14" rx="1" fill="currentColor"/><path d="M5 5v14l11-7L5 5z" fill="currentColor"/>`),
  rew:       S(`<path d="M11 7v10L2 12l9-5z" fill="currentColor"/><path d="M22 7v10L13 12l9-5z" fill="currentColor"/>`),
  fwd:       S(`<path d="M13 17V7l9 5-9 5z" fill="currentColor"/><path d="M2 17V7l9 5-9 5z" fill="currentColor"/>`),

  // ── Volume ───────────────────────────────────────────────────
  volHigh:   S(`<path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M19 5.5a9 9 0 0 1 0 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`),
  volMuted:  S(`<path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  volLow:    S(`<path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`),

  // ── Window controls ───────────────────────────────────────────
  minimize:  S(`<line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  maximize:  S(`<rect x="5.5" y="5.5" width="13" height="13" rx="1.5" stroke="currentColor" stroke-width="1.7"/>`),
  restore:   S(`<rect x="5" y="3" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M9 8h8v8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="M8 9h8v8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`),
  close:     S(`<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  // ── Titlebar buttons ──────────────────────────────────────────
  pip:       S(`<rect x="2" y="3" width="15" height="11" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M19 10l3-2v8l-3-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  theatre:   S(`<rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 21l3-4 3 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  settings:  S(`<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
  shortcuts: S(`<rect x="2" y="4" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><line x1="7" y1="9" x2="11" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="7" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="13" x2="17" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`),

  // ── Mode icons ────────────────────────────────────────────────
  video:     S(`<rect x="2" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M17 9l5-3v12l-5-3V9z" fill="currentColor"/>`),
  music:     S(`<path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="2"/>`),
  images:    S(`<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`),
  pdf:       S(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" fill="none"/><line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="17" x2="15" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  tv:        S(`<rect x="2" y="4" width="15" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M17 7l5-2.5v11L17 13V7z" fill="currentColor" opacity=".7"/><line x1="7" y1="18" x2="17" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="12" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  // ── Utility ───────────────────────────────────────────────────
  fullscreen:S(`<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  info:      S(`<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/>`),
  eq:        S(`<line x1="5" y1="21" x2="5" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="7" x2="5" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="5" cy="9" r="2.2" fill="currentColor"/><line x1="12" y1="21" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="11" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="13" r="2.2" fill="currentColor"/><line x1="19" y1="21" x2="19" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="19" y1="9" x2="19" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="19" cy="11" r="2.2" fill="currentColor"/>`),
  playlist:  S(`<line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="18" x2="14" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  // ── Context menu icons ────────────────────────────────────────
  playFile:  S(`<path d="M3 5h10v2H3zM3 9h7v2H3z" fill="currentColor"/><path d="M16 6l5 3.5L16 13V6z" fill="currentColor"/>`),
  folder:    S(`<path d="M3 5v14h18V8l-3-3H9L7 3H3z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`),
  copy:      S(`<rect x="8" y="8" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8" fill="none"/>`),
  addToQ:    S(`<line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  // ── Drag & drop ───────────────────────────────────────────────
  upload:    S(`<path d="M12 3v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 8l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M2 17v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`),

  // ── Accent color ──────────────────────────────────────────────
  palette:   S(`<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="8" cy="9" r="2.5" fill="currentColor" opacity=".5"/><circle cx="15.5" cy="9.5" r="2.5" fill="currentColor" opacity=".75"/><circle cx="12" cy="15" r="2.5" fill="currentColor"/>`),

  // ── Misc ───────────────────────────────────────────────────────
  heart:     S(`<path d="M12 21C12 21 3 14.5 3 8.5C3 5.5 5.5 3 8 3C9.5 3 11 3.8 12 5C13 3.8 14.5 3 16 3C18.5 3 21 5.5 21 8.5C21 14.5 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" fill="none"/>`),
  clock:     S(`<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  bookmark:  S(`<path d="M6 2h12a2 2 0 0 1 2 2v16l-8-4-8 4V4a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`),
  search:    S(`<circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="2" fill="none"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  sort:      S(`<path d="M3 6h7M3 12h5M3 18h3M14 6h7M16 12h5M18 18h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  filter:    S(`<path d="M3 4h18l-7 8.5V18l-4 2V12.5L3 4z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`),
  star:      S(`<path d="M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.9L12 17.8l-6.2 3.3L7 14.2l-5-4.9 6.9-1L12 2z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`),
  starFill:  S(`<path d="M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.9L12 17.8l-6.2 3.3L7 14.2l-5-4.9 6.9-1L12 2z" fill="currentColor" stroke="none"/>`),
  check:     S(`<path d="M4 12.5l5 5L20 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  x:         S(`<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`),
  warn:      S(`<path d="M12 2L1 21h22L12 2z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1" fill="currentColor"/>`),
  checkCirc: S(`<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M7 12.5l3.5 3.5L17 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  errCirc:   S(`<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/><line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/>`),
  infoCirc:  S(`<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/><line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/>`),
};

const pair = (a, b, ca, cb) =>
  `<span class="ico-pair ${ca}">${ICONS[a]}</span><span class="ico-pair ${cb} ico-hidden">${ICONS[b]}</span>`;

export function applyIcons() {
  const byId = {
    'btn-stop': ICONS.stop, 'btn-prev': ICONS.prev, 'btn-next': ICONS.next,
    'btn-rew': ICONS.rew,   'btn-fwd': ICONS.fwd,   'btn-fs': ICONS.fullscreen,
    'btn-info': ICONS.info, 'btn-eq': ICONS.eq,     'btn-playlist': ICONS.playlist,
    'btn-minimize': ICONS.minimize, 'btn-maximize': ICONS.maximize, 'btn-close': ICONS.close,
    'btn-pip': ICONS.pip,   'btn-theatre': ICONS.theatre,
  };
  for (const [id, svg] of Object.entries(byId)) {
    const el = document.getElementById(id); if (el) el.innerHTML = svg;
  }
  const pl = document.getElementById('btn-play');
  if (pl) pl.innerHTML = pair('play','pause','ico-play','ico-pause');
  const mu = document.getElementById('btn-mute');
  if (mu) mu.innerHTML = pair('volHigh','volMuted','ico-vol-on','ico-vol-off');
  // Sidebar icons
  const dest2icon = { video:'video', music:'music', images:'images', pdf:'pdf', tv:'tv' };
  document.querySelectorAll('.sidebar-btn[data-dest]').forEach(btn => {
    const ico = ICONS[dest2icon[btn.dataset.dest]];
    if (ico) btn.innerHTML = ico;
  });
  document.querySelectorAll('.panel-close').forEach(b => { b.innerHTML = ICONS.close; });
}

export function setTogglePair(btnId, showFirst) {
  const btn = document.getElementById(btnId); if (!btn) return;
  const pairs = btn.querySelectorAll('.ico-pair'); if (pairs.length !== 2) return;
  pairs[0].classList.toggle('ico-hidden', !showFirst);
  pairs[1].classList.toggle('ico-hidden',  showFirst);
}
