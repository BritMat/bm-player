import { Fox } from './fox.js';

class BMPlayerApp {
  constructor() {
    this.api = window.api;
    this.isPlaying = false;
    this.duration = 0;
    this.osdTimer = null;
    this.init();
  }

  init() {
    const canvas = document.getElementById('fox-canvas');
    if (canvas && window.THREE) this.fox = new Fox(canvas);

    this.wireTitlebar();
    this.wireThemes();
    this.wireMedia();
    this.wireKeyboard();
    this.listenToMpv();

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault(); 
      if (this.api && this.api.showContextMenu) this.api.showContextMenu();
    });
  }

  // ── NEW: OSD POPUP FUNCTION ──
  showOSD(msg) {
    const osd = document.getElementById('osd');
    if (!osd) return;
    osd.innerText = msg;
    osd.classList.add('active');
    clearTimeout(this.osdTimer);
    this.osdTimer = setTimeout(() => {
      osd.classList.remove('active');
    }, 1500); // Fades out after 1.5 seconds
  }

  wireTitlebar() {
    document.getElementById('btn-close')?.addEventListener('click', () => this.api?.win.close());
    document.getElementById('btn-minimize')?.addEventListener('click', () => this.api?.win.minimize());
    document.getElementById('btn-maximize')?.addEventListener('click', () => this.api?.win.maximize());
  }

  wireThemes() {
    const pills = document.querySelectorAll('.theme-pill');
    pills.forEach(btn => {
      btn.addEventListener('click', () => {
        pills.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.documentElement.setAttribute('data-theme', btn.dataset.theme);
      });
    });
  }

  wireMedia() {
    document.getElementById('btn-open-welcome')?.addEventListener('click', async () => {
      const files = await this.api?.dialog.open();
      if (files && files.length > 0) this.playMedia(files);
    });

    document.getElementById('btn-play')?.addEventListener('click', () => this.togglePlay());

    document.getElementById('seek-bar')?.addEventListener('click', (e) => {
      if (!this.duration || !this.api?.mpv) return; 
      const rect = e.target.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.api.mpv.cmd('set_property', 'time-pos', percentage * this.duration);
    });

    document.getElementById('btn-stop')?.addEventListener('click', () => {
      if (!this.api?.mpv) return;
      this.api.mpv.cmd('stop');
      this.isPlaying = false;
      document.getElementById('btn-play').innerText = '▶';
      this.updateTime('time-current', 0);
      this.updateSeek(0);
      
      document.getElementById('player-view')?.classList.remove('active');
      document.getElementById('welcome-screen')?.classList.add('active');
      document.getElementById('title-text').innerText = 'BM Player';
    });

    document.getElementById('btn-prev')?.addEventListener('click', () => this.api?.mpv.cmd('playlist-prev'));
    document.getElementById('btn-next')?.addEventListener('click', () => this.api?.mpv.cmd('playlist-next'));

    document.getElementById('volume-slider')?.addEventListener('input', (e) => {
      this.api?.mpv.cmd('set_property', 'volume', parseInt(e.target.value));
      this.showOSD(`Volume: ${e.target.value}%`);
    });

    document.getElementById('btn-mute')?.addEventListener('click', () => {
      this.api?.mpv.cmd('cycle', 'mute');
      this.showOSD('Mute Toggled');
    });
  }

  wireKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!this.api || !this.api.mpv || document.getElementById('welcome-screen')?.classList.contains('active')) return;
      switch(e.code) {
        case 'Space': 
          e.preventDefault(); 
          this.togglePlay(); 
          break;
        case 'ArrowRight': 
          e.preventDefault(); 
          this.api.mpv.cmd('seek', 5, 'relative'); 
          this.showOSD('Seek: +5s ⏩');
          break;
        case 'ArrowLeft': 
          e.preventDefault(); 
          this.api.mpv.cmd('seek', -5, 'relative'); 
          this.showOSD('Seek: -5s ⏪');
          break;
        case 'ArrowUp': 
          e.preventDefault(); 
          this.api.mpv.cmd('add', 'volume', 10); 
          const vUp = document.getElementById('volume-slider');
          if (vUp) vUp.value = Math.min(100, parseInt(vUp.value) + 10);
          this.showOSD(`Volume: ${vUp ? vUp.value : 'Up'}% 🔊`);
          break;
        case 'ArrowDown': 
          e.preventDefault(); 
          this.api.mpv.cmd('add', 'volume', -10); 
          const vDn = document.getElementById('volume-slider');
          if (vDn) vDn.value = Math.max(0, parseInt(vDn.value) - 10);
          this.showOSD(`Volume: ${vDn ? vDn.value : 'Down'}% 🔉`);
          break;
      }
    });
  }

  togglePlay() {
    if (!this.api || !this.api.mpv) return;
    this.isPlaying = !this.isPlaying;
    this.api.mpv.cmd('set_property', 'pause', !this.isPlaying);
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) btnPlay.innerText = this.isPlaying ? '⏸' : '▶';
    this.showOSD(this.isPlaying ? 'Play ▶️' : 'Pause ⏸️');
  }

  playMedia(files) {
    if (!this.api || !this.api.mpv) return;
    document.getElementById('welcome-screen')?.classList.remove('active');
    document.getElementById('player-view')?.classList.add('active');
    this.api.mpv.open(files);
    this.isPlaying = true;
    document.getElementById('btn-play').innerText = '⏸';
  }

  listenToMpv() {
    if (!this.api || !this.api.mpv) return;
    this.api.mpv.onProp((prop) => {
      if (prop.name === 'time-pos') {
        this.updateTime('time-current', prop.data);
        this.updateSeek(prop.data);
      }
      if (prop.name === 'duration') {
        this.duration = prop.data;
        this.updateTime('time-total', prop.data);
      }
      if (prop.name === 'media-title') {
        const titleEl = document.getElementById('title-text');
        if (titleEl) titleEl.innerText = prop.data ? `BM Player - ${prop.data}` : 'BM Player';
      }
      if (prop.name === 'mute') {
        const muteBtn = document.getElementById('btn-mute');
        if (muteBtn) muteBtn.innerText = prop.data ? '🔇' : '🔊';
      }
    });
  }

  updateTime(elementId, seconds) {
    if (!seconds) return;
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    const el = document.getElementById(elementId);
    if (el) el.innerText = `${mins}:${secs}`;
  }

  updateSeek(current) {
    if (!this.duration) return;
    const progressEl = document.getElementById('seek-progress');
    if (progressEl) progressEl.style.width = `${(current / this.duration) * 100}%`;
  }
}

window.addEventListener('DOMContentLoaded', () => { window.bmApp = new BMPlayerApp(); });