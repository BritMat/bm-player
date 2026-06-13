/**
 * BM Player — Renderer entry point
 * Wires the Fox mascot, Visualizer, Player controls, and Themes together.
 */
import { Fox }        from './fox.js';
import { Visualizer } from './visualizer.js';
import { Player }     from './player.js';
import { ThemeManager }from './themes.js';

const api = window.electronAPI;

class BMPlayerApp {
  constructor () {
    this.fox        = null;
    this.visualizer = null;
    this.player     = null;
    this.theme      = null;
    this.view       = 'welcome';   // 'welcome' | 'player'
    this.recentFiles = JSON.parse(localStorage.getItem('bm_recent') || '[]');
    this.init();
  }

  async init () {
    // ── Theme first (no flash) ──────────────────────────
    this.theme = new ThemeManager();

    // ── Fox mascot (welcome canvas) ─────────────────────
    const foxCanvas = document.getElementById('fox-canvas');
    this.fox = new Fox(foxCanvas, { size: 'large' });

    // ── Audio visualizer ────────────────────────────────
    this.visualizer = new Visualizer(document.getElementById('visualizer-canvas'));

    // ── Player controls ─────────────────────────────────
    this.player = new Player(this);

    // ── UI wiring ────────────────────────────────────────
    this.wireTitlebar();
    this.wireThemePills();
    this.wireSettings();
    this.wireWelcomeButtons();
    this.wireUrlDialog();
    this.wireDragDrop();
    this.wireKeyboard();
    this.renderRecent();

    // ── mpv events ───────────────────────────────────────
    if (api) {
      api.mpv.onStatus(d  => this.onMpvStatus(d));
      api.mpv.onEvent(e   => this.player.onMpvEvent(e));
      api.mpv.onProp(p    => this.player.onMpvProp(p));
      api.mpv.onFilesOpen(d => this.onFilesOpened(d.files));
      api.mpv.onDownload(d => this.onDownloadProgress(d));
      api.window.onState(s => this.onWindowState(s));

      const ver = await api.app.getVersion();
      const el  = document.getElementById('app-version');
      if (el) el.textContent = `v${ver}`;

      const mpvp = await api.app.getMpvPath();
      const mp   = document.getElementById('mpv-path-display');
      if (mp) mp.textContent = mpvp || 'not found';

      // Updater
      api.updater.onStatus(d => this.onUpdaterStatus(d));
    }

    // ── Boot animation ───────────────────────────────────
    setTimeout(() => this.fox.wave(), 300);
    setTimeout(() => this.fox.setState('idle'), 3200);
  }

  // ── Views ───────────────────────────────────────────
  showWelcome () {
    this.view = 'welcome';
    document.getElementById('welcome-screen').classList.add('active');
    document.getElementById('player-view').classList.remove('active');
    document.getElementById('titlebar-title').textContent = 'BM Player';
    document.title = 'BM Player';
    this.visualizer.stop();
    this.fox.setState('idle');
  }

  showPlayer () {
    this.view = 'player';
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('player-view').classList.add('active');
  }

  // ── mpv status ───────────────────────────────────────
  onMpvStatus (d) {
    if (d.state === 'missing') {
      document.getElementById('mpv-setup').classList.remove('hidden');
    }
    if (d.state === 'ready') {
      document.getElementById('mpv-setup').classList.add('hidden');
    }
  }

  onFilesOpened (files) {
    if (!files?.length) return;
    this.showPlayer();
    const name = files[0].split(/[\\/]/).pop();
    this.addRecent(files[0], name);
    this.fox.setState('excited');
    setTimeout(() => this.fox.setState('watching'), 2500);
  }

  // ── Recent files ─────────────────────────────────────
  addRecent (filePath, name) {
    this.recentFiles = [
      { path: filePath, name },
      ...this.recentFiles.filter(f => f.path !== filePath)
    ].slice(0, 6);
    localStorage.setItem('bm_recent', JSON.stringify(this.recentFiles));
    this.renderRecent();
  }

  renderRecent () {
    const el = document.getElementById('recent-files');
    if (!el) return;
    el.innerHTML = '';
    this.recentFiles.forEach(f => {
      const div = document.createElement('div');
      div.className = 'recent-item';
      div.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
        <span class="recent-item-name" title="${f.path}">${f.name}</span>`;
      div.addEventListener('click', () => api?.mpv.openFiles([f.path]));
      el.appendChild(div);
    });
  }

  // ── Titlebar ─────────────────────────────────────────
  wireTitlebar () {
    document.getElementById('btn-minimize')?.addEventListener('click', () => api?.window.minimize());
    document.getElementById('btn-maximize')?.addEventListener('click', () => api?.window.maximize());
    document.getElementById('btn-close')?.addEventListener('click',    () => api?.window.close());
  }

  // ── Theme pills (welcome screen) ─────────────────────
  wireThemePills () {
    document.querySelectorAll('.theme-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        const t = e.currentTarget.dataset.theme;
        this.theme.apply(t);
        document.querySelectorAll('.theme-pill').forEach(b =>
          b.classList.toggle('active', b.dataset.theme === t));
        document.querySelectorAll('.seg-btn[data-theme]').forEach(b =>
          b.classList.toggle('active', b.dataset.theme === t));
      });
    });
  }

  // ── Settings panel ───────────────────────────────────
  wireSettings () {
    const panel = document.getElementById('settings-panel');
    const open  = () => panel.classList.add('open');
    const close = () => panel.classList.remove('open');

    document.getElementById('btn-settings')?.addEventListener('click', open);
    document.getElementById('settings-close')?.addEventListener('click', close);

    // Theme in settings
    document.querySelectorAll('#theme-control .seg-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const t = e.currentTarget.dataset.theme;
        this.theme.apply(t);
        document.querySelectorAll('#theme-control .seg-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.theme === t));
        document.querySelectorAll('.theme-pill').forEach(b =>
          b.classList.toggle('active', b.dataset.theme === t));
      });
    });

    // Viz mode
    document.getElementById('viz-mode-select')?.addEventListener('change', e => {
      this.visualizer.setMode(e.target.value);
      localStorage.setItem('bm_viz', e.target.value);
    });
    const savedViz = localStorage.getItem('bm_viz') || 'bars';
    const vizSel   = document.getElementById('viz-mode-select');
    if (vizSel) vizSel.value = savedViz;
    this.visualizer.setMode(savedViz);

    // Subtitle size
    const subSize  = document.getElementById('sub-size');
    const subSizeV = document.getElementById('sub-size-val');
    subSize?.addEventListener('input', e => {
      if (subSizeV) subSizeV.textContent = e.target.value;
      api?.mpv.command('set_property', 'sub-font-size', +e.target.value);
    });

    // Subtitle delay
    document.getElementById('sub-delay-input')?.addEventListener('change', e => {
      api?.mpv.command('set_property', 'sub-delay', +e.target.value);
    });

    // HW decoding
    document.getElementById('hwdec-select')?.addEventListener('change', e => {
      api?.mpv.command('set_property', 'hwdec', e.target.value);
    });

    // Loop
    document.getElementById('loop-select')?.addEventListener('change', e => {
      const v = e.target.value;
      api?.mpv.command('set_property', 'loop-playlist', v === 'inf' ? 'inf' : 'no');
      api?.mpv.command('set_property', 'loop-file',     v === 'file' ? 'inf' : 'no');
    });

    // Update buttons
    document.getElementById('btn-check-update')?.addEventListener('click', () => api?.updater.check());
    document.getElementById('btn-install-update')?.addEventListener('click', () => api?.updater.install());
    document.getElementById('btn-download-mpv')?.addEventListener('click', () => {
      api?.mpv.downloadMpv();
      this.toast('Downloading mpv…');
    });
  }

  // ── Welcome buttons ──────────────────────────────────
  wireWelcomeButtons () {
    document.getElementById('btn-open-welcome')?.addEventListener('click', async () => {
      const files = await api?.dialog.openFile();
      if (files?.length) await api?.mpv.openFiles(files);
    });
    document.getElementById('btn-open-url')?.addEventListener('click', () => {
      document.getElementById('url-dialog').classList.remove('hidden');
    });
    // mpv setup dialog
    document.getElementById('setup-download')?.addEventListener('click', () => {
      api?.mpv.downloadMpv();
      document.getElementById('setup-progress-wrap')?.classList.remove('hidden');
    });
    document.getElementById('setup-skip')?.addEventListener('click', () => {
      document.getElementById('mpv-setup').classList.add('hidden');
    });
  }

  // ── URL dialog ───────────────────────────────────────
  wireUrlDialog () {
    document.getElementById('url-cancel')?.addEventListener('click', () =>
      document.getElementById('url-dialog').classList.add('hidden'));
    document.getElementById('url-open')?.addEventListener('click', async () => {
      const url = document.getElementById('url-input')?.value?.trim();
      if (url) {
        await api?.mpv.openFiles([url]);
        document.getElementById('url-dialog').classList.add('hidden');
        document.getElementById('url-input').value = '';
      }
    });
    document.getElementById('url-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('url-open').click();
    });
  }

  // ── Drag-and-drop ────────────────────────────────────
  wireDragDrop () {
    const overlay = document.getElementById('drop-overlay');
    document.addEventListener('dragover',  e => { e.preventDefault(); overlay.classList.add('active'); });
    document.addEventListener('dragleave', e => { if (!e.relatedTarget) overlay.classList.remove('active'); });
    document.addEventListener('drop', async e => {
      e.preventDefault();
      overlay.classList.remove('active');
      const paths = [...e.dataTransfer.files].map(f => f.path).filter(Boolean);
      if (paths.length) await api?.mpv.openFiles(paths);
    });
  }

  // ── Keyboard ─────────────────────────────────────────
  wireKeyboard () {
    document.addEventListener('keydown', e => {
      if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
      this.player.handleKeydown(e);
    });
  }

  // ── Window state ─────────────────────────────────────
  onWindowState (state) {
    document.body.classList.toggle('fullscreen', state === 'fullscreen');
    const ico = document.querySelector('#btn-fullscreen .ico-expand');
    const ic2 = document.querySelector('#btn-fullscreen .ico-compress');
    ico?.classList.toggle('hidden', state === 'fullscreen');
    ic2?.classList.toggle('hidden', state !== 'fullscreen');
  }

  // ── Download progress ────────────────────────────────
  onDownloadProgress (d) {
    const fill  = document.getElementById('setup-progress-fill');
    const label = document.getElementById('setup-progress-label');
    if (fill)  fill.style.width  = d.pct + '%';
    if (label) label.textContent = d.phase === 'done' ? 'Done!' : `${d.pct}%`;
    if (d.phase === 'done') {
      setTimeout(() => document.getElementById('mpv-setup').classList.add('hidden'), 1200);
    }
  }

  // ── Updater ──────────────────────────────────────────
  onUpdaterStatus (d) {
    const status  = document.getElementById('update-status');
    const install = document.getElementById('btn-install-update');
    const msgs = {
      checking:    'Checking for updates…',
      latest:      '✓ Up to date',
      available:   `Update v${d.version} available – downloading…`,
      downloading: `Downloading update ${d.pct}%…`,
      ready:       `✓ Update v${d.version} ready`,
      error:       `Update check failed`,
    };
    if (status) status.textContent = msgs[d.state] ?? '';
    install?.classList.toggle('hidden', d.state !== 'ready');
  }

  // ── Toast ─────────────────────────────────────────────
  toast (msg, duration = 2200) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.bmApp = new BMPlayerApp();
});
