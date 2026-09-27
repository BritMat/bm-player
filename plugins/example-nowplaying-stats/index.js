/**
 * Example BM Player plugin — Now Playing Stats
 *
 * Demonstrates the three things a plugin can do:
 *   1. Listen to playback hooks via BM.on(event, callback)
 *   2. Inject a custom UI panel via BM.ui.addPanel(...)
 *   3. Persist small bits of state via BM.storage.get/set
 *
 * Drop a folder like this one into your plugins/ directory (next to the app)
 * or into the user plugins folder (Tools > Plugins > Folder) to install.
 */
export function activate(BM) {
  let panel = null;
  let playCount = BM.storage.get('playCount') || 0;

  function render(container) {
    container.innerHTML = `
      <div style="font-size:12px;line-height:1.8;color:var(--text-muted)">
        <div><strong style="color:var(--text)">Session plays:</strong> <span id="np-stat-count">${playCount}</span></div>
        <div><strong style="color:var(--text)">Position:</strong> <span id="np-stat-time">0:00 / 0:00</span></div>
        <div><strong style="color:var(--text)">Theme:</strong> <span id="np-stat-theme">—</span></div>
      </div>`;
  }

  panel = BM.ui.addPanel({ id: 'stats', title: 'Now Playing Stats', render });
  // The theme only arrived with a theme change, so the panel showed a dash.
  const showTheme = () => {
    const el = document.getElementById('np-stat-theme');
    if (el) el.textContent = document.documentElement.dataset.theme || 'dark';
  };
  showTheme();

  BM.on('playback-start', () => {
    playCount++;
    BM.storage.set('playCount', playCount);
    const el = document.getElementById('np-stat-count');
    if (el) el.textContent = playCount;
    showTheme();
    // It used to open its panel and show a toast on every playback, which put
    // a panel over the corner of every video. It stays quiet now: the panel
    // keeps itself up to date and opens when you choose to open it.
  });

  BM.on('time-update', ({ time, duration }) => {
    const fmt = s => { s = Math.floor(s || 0); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
    const el = document.getElementById('np-stat-time');
    if (el) el.textContent = `${fmt(time)} / ${fmt(duration)}`;
  });

  BM.on('theme-change', ({ theme }) => {
    const el = document.getElementById('np-stat-theme');
    if (el) el.textContent = theme;
  });

  BM.on('playback-stop', () => {
    // (a playback-stop hook, left in as an example of the event)
  });
}
