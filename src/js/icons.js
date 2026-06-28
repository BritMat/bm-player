const S = (inner, vb='0 0 24 24') => `<svg viewBox="${vb}" class="ico">${inner}</svg>`;
export const ICONS = {
  play:      S(`<path d="M7 4l13 8-13 8V4z" fill="currentColor"/>`),
  pause:     S(`<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>`),
  stop:      S(`<rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor"/>`),
  prev:      S(`<rect x="4" y="5" width="2.5" height="14" rx="1" fill="currentColor"/><path d="M19 5v14L8 12l11-7z" fill="currentColor"/>`),
  next:      S(`<rect x="17.5" y="5" width="2.5" height="14" rx="1" fill="currentColor"/><path d="M5 5v14l11-7L5 5z" fill="currentColor"/>`),
  rew:       S(`<path d="M11 7v10L2 12l9-5z" fill="currentColor"/><path d="M22 7v10L13 12l9-5z" fill="currentColor"/>`),
  fwd:       S(`<path d="M13 17V7l9 5-9 5z" fill="currentColor"/><path d="M2 17V7l9 5-9 5z" fill="currentColor"/>`),
  volHigh:   S(`<path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  volMuted:  S(`<path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  fullscreen:S(`<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  info:      S(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/>`),
  eq:        S(`<line x1="5" y1="21" x2="5" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="7" x2="5" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="5" cy="9" r="2.2" fill="currentColor"/><line x1="12" y1="21" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="11" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="13" r="2.2" fill="currentColor"/><line x1="19" y1="21" x2="19" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="19" y1="9" x2="19" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="19" cy="11" r="2.2" fill="currentColor"/>`),
  playlist:  S(`<line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="18" x2="14" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  minimize:  S(`<line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  maximize:  S(`<rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/>`),
  close:     S(`<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  video:     S(`<rect x="2" y="5" width="15" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M17 9l5-3v12l-5-3V9z" fill="currentColor"/>`),
  music:     S(`<path d="M9 18V5l12-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/>`),
  images:    S(`<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  pdf:       S(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2"/><line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="2"/><line x1="9" y1="17" x2="15" y2="17" stroke="currentColor" stroke-width="2"/>`),
};
const pair = (a, b, ca, cb) =>
  `<span class="ico-pair ${ca}">${ICONS[a]}</span><span class="ico-pair ${cb} ico-hidden">${ICONS[b]}</span>`;

export function applyIcons() {
  const byId = {
    'btn-stop': ICONS.stop, 'btn-prev': ICONS.prev, 'btn-next': ICONS.next,
    'btn-rew': ICONS.rew,   'btn-fwd': ICONS.fwd,   'btn-fs': ICONS.fullscreen,
    'btn-info': ICONS.info, 'btn-eq': ICONS.eq,     'btn-playlist': ICONS.playlist,
    'btn-minimize': ICONS.minimize, 'btn-maximize': ICONS.maximize, 'btn-close': ICONS.close,
  };
  for (const [id, svg] of Object.entries(byId)) {
    const el = document.getElementById(id); if (el) el.innerHTML = svg;
  }
  const pl = document.getElementById('btn-play');
  if (pl) pl.innerHTML = pair('play','pause','ico-play','ico-pause');
  const mu = document.getElementById('btn-mute');
  if (mu) mu.innerHTML = pair('volHigh','volMuted','ico-vol-on','ico-vol-off');
  // Sidebar icons
  const dest2icon = { video:'video', music:'music', images:'images', pdf:'pdf' };
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
