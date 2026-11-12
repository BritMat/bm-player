/**
 * Studio (v3.51.0): the two small behaviours the new layout needs.
 *
 * Themes sit behind one button in the top bar. It opens a short list, and
 * choosing a theme, a click elsewhere or Escape closes it.
 *
 * In Music the player is a bar along the bottom, and Up next and Lyrics
 * open in a panel beside the songs. Pressing the open one's button again
 * closes the panel, and so does its own close button. Whether it is open
 * is remembered.
 *
 *   wireStudio()      once, after the page is built
 */
const KEY = 'bm_np_side';

export function wireStudio (doc = document) {
  const $ = id => doc.getElementById(id);

  // ── themes ──
  const tbtn = $('theme-menu-btn'), list = $('theme-selector');
  if (tbtn && list) {
    const open = on => { list.classList.toggle('open', on); tbtn.setAttribute('aria-expanded', String(on)); };
    tbtn.addEventListener('click', e => { e.stopPropagation(); open(!list.classList.contains('open')); });
    list.addEventListener('click', e => { if (e.target.closest?.('.tp')) open(false); });
    doc.addEventListener('click', e => { if (list.classList.contains('open') && !list.contains(e.target)) open(false); });
    doc.addEventListener('keydown', e => { if (e.key === 'Escape' && list.classList.contains('open')) { open(false); tbtn.focus(); } });
  }

  // ── the panel beside the songs ──
  const view = $('music-view'), title = $('np-side-title');
  const tabs = { queue: $('np-tab-queue'), lyrics: $('np-tab-lyrics') };
  if (!view || !tabs.queue || !tabs.lyrics) return;
  const names = { queue: 'Up next', lyrics: 'Lyrics' };
  const isOpen = () => !view.classList.contains('np-side-closed');
  const set = on => {
    view.classList.toggle('np-side-closed', !on);
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {}
    for (const b of Object.values(tabs)) b.setAttribute('aria-expanded', String(on && b.classList.contains('active')));
  };
  for (const [name, b] of Object.entries(tabs)) {
    // before the lyrics module switches the tab: was this one open already?
    b.addEventListener('click', () => { b._wasOpen = isOpen() && b.classList.contains('active'); }, true);
    b.addEventListener('click', () => { set(!b._wasOpen); if (title) title.textContent = names[name]; });
  }
  $('np-side-close')?.addEventListener('click', () => set(false));
  let saved = '1'; try { saved = localStorage.getItem(KEY) ?? '1'; } catch (_) {}
  set(saved !== '0');
  if (title) title.textContent = names[tabs.lyrics.classList.contains('active') ? 'lyrics' : 'queue'];
}
