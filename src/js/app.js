import { Fox } from './fox.js';

class BMPlayerApp {
  constructor() {
    this.api = window.api;
    this.isPlaying = false;
    this.duration = 0;
    this.init();
  }

  init() {
    const canvas = document.getElementById('fox-canvas');
    if (canvas && window.THREE) this.fox = new Fox(canvas);

    this.wireTitlebar();
    this.wireThemes();
    this.wireMedia();
    this.wireKeyboard(); // VLC Shortcuts
    this.listenToMpv();
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

    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => this.togglePlay());
    }

    const seekContainer = document.getElementById('seek-bar');
    if (seekContainer) {
      seekContainer.addEventListener('click', (e) => {
        if (!this.duration || !this.api?.mpv) return; 
        const rect = seekContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const seekTime = percentage * this.duration;
        this.api.mpv.cmd('set_property', 'time-pos', seekTime);
      });
    }
  }

  // --- VLC KEYBOARD SHORTCUTS ---
  wireKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger if the welcome screen is active
      if (!this.api || !this.api.mpv || document.getElementById('welcome-screen').classList.contains('active')) return;

      switch(e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.api.mpv.cmd('seek', 5, 'relative'); // Jump forward 5s
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.api.mpv.cmd('seek', -5, 'relative'); // Jump back 5s
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.api.mpv.cmd('add', 'volume', 10); // Volume Up
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.api.mpv.cmd('add', 'volume', -10); // Volume Down
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
  }

  playMedia(files) {
    if (!this.api || !this.api.mpv) return;
    
    document.getElementById('welcome-screen')?.classList.remove('active');
    document.getElementById('player-view')?.classList.add('active');
    
    document.documentElement.classList.add('playing');
    document.body.classList.add('playing');
    
    this.api.mpv.open(files);
    this.isPlaying = true;
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) btnPlay.innerText = '⏸';
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
    const percentage = (current / this.duration) * 100;
    const progressEl = document.getElementById('seek-progress');
    if (progressEl) progressEl.style.width = `${percentage}%`;
  }
}

window.addEventListener('DOMContentLoaded', () => { window.bmApp = new BMPlayerApp(); });