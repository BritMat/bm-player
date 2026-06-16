import { Fox } from './fox.js';

class BMPlayerApp {
  constructor() {
    this.api = window.api;
    this.isPlaying = false;
    this.duration = 0;
    this.controlsTimer = null;
    this.osdTimer = null;
    this.init();
  }

  init() {
    const canvas = document.getElementById('fox-canvas');
    if (canvas && window.THREE) this.fox = new Fox(canvas);

    this.wireWindow();
    this.wireThemes();
    this.wireMenus();
    this.wireMedia();
    this.wirePanels();
    this.wireEqualizer();
    this.wireKeyboard();
    this.wireSmartControls();
    this.listenToMpv();

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault(); 
      if (this.api && this.api.showContextMenu) this.api.showContextMenu();
    });
  }

  showOSD(msg) {
    const osd = document.getElementById('osd');
    if (!osd) return;
    osd.innerText = msg;
    osd.classList.add('show');
    clearTimeout(this.osdTimer);
    this.osdTimer = setTimeout(() => osd.classList.remove('show'), 1500);
  }

  wireWindow() {
    document.getElementById('btn-close')?.addEventListener('click', () => this.api?.win.close());
    document.getElementById('btn-minimize')?.addEventListener('click', () => this.api?.win.minimize());
    document.getElementById('btn-maximize')?.addEventListener('click', () => this.api?.win.maximize());
  }

  wireThemes() {
    const pills = document.querySelectorAll('.tp');
    pills.forEach(btn => {
      btn.addEventListener('click', () => {
        pills.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.theme;
        document.documentElement.setAttribute('data-theme', theme);
        if (this.fox && typeof this.fox.setTheme === 'function') this.fox.setTheme(theme);
      });
    });
  }

  wireMenus() {
    document.querySelectorAll('[data-a]').forEach(el => {
      el.addEventListener('click', async () => {
        const action = el.dataset.a;
        if (action === 'open') { const f = await this.api?.dialog.open(); if(f && f.length) this.playMedia(f); }
        if (action === 'quit') this.api?.win.close();
        if (action === 'play-pause') this.togglePlay();
        if (action === 'stop') this.stopMedia();
        if (action === 'fullscreen') this.api?.win.fullscreen();
        
        if (action === 'media-info') { this.closePanels(); document.getElementById('panel-info')?.classList.add('open'); }
        if (action === 'equalizer') { this.closePanels(); document.getElementById('panel-eq')?.classList.add('open'); }
        if (action === 'playlist') { this.closePanels(); document.getElementById('panel-playlist')?.classList.add('open'); }
        if (action === 'jump') { this.closePanels(); document.getElementById('dlg-jump')?.classList.remove('hidden'); }
        
        const drop = el.closest('.mi-drop');
        if (drop) { drop.style.display = 'none'; setTimeout(() => drop.style.display = '', 150); }
      });
    });

    document.getElementById('jump-cancel')?.addEventListener('click', () => document.getElementById('dlg-jump').classList.add('hidden'));
    document.getElementById('jump-ok')?.addEventListener('click', () => {
      const val = document.getElementById('jump-input').value;
      const parts = val.split(':').map(Number).reverse();
      let sec = 0;
      if (parts[0]) sec += parts[0];
      if (parts[1]) sec += parts[1] * 60;
      if (parts[2]) sec += parts[2] * 3600;
      if (sec && this.api?.mpv) this.api.mpv.cmd('set_property', 'time-pos', sec);
      document.getElementById('dlg-jump').classList.add('hidden');
    });
  }

  closePanels() {
    document.querySelectorAll('.side-panel').forEach(el => el.classList.remove('open'));
  }

  wireEqualizer() {
    const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const eqContainer = document.getElementById('eq-bands');
    if (!eqContainer) return;

    let html = '';
    bands.forEach((freq, i) => {
      const label = freq >= 1000 ? (freq/1000) + 'k' : freq;
      html += `<div class="eq-band">
          <div class="eq-band-val" id="eq-val-${i}" style="font-size:10px; color:var(--accent); font-weight:700;">0</div>
          <input type="range" class="eq-slider" data-idx="${i}" min="-15" max="15" step="0.5" value="0" style="writing-mode:vertical-lr; direction:rtl; width:5px; height:120px; -webkit-appearance:slider-vertical; accent-color:var(--accent); cursor:pointer;">
          <div class="eq-band-label" style="font-size:10px; color:var(--text-muted);">${label}</div>
        </div>`;
    });
    eqContainer.innerHTML = html;

    const updateEQ = () => {
      const sliders = document.querySelectorAll('.eq-slider');
      let filters = [];
      sliders.forEach((slider, i) => {
        const val = parseFloat(slider.value);
        document.getElementById(`eq-val-${i}`).innerText = val > 0 ? '+'+val : val;
        if(val !== 0) { filters.push(`c0 f=${bands[i]} w=1 g=${val}`); filters.push(`c1 f=${bands[i]} w=1 g=${val}`); }
      });
      this.api?.mpv.cmd('set_property', 'af', filters.length === 0 ? '' : `lavfi=[anequalizer=${filters.join('|')}]`);
    };

    document.querySelectorAll('.eq-slider').forEach(sl => sl.addEventListener('input', updateEQ));
    document.getElementById('btn-reset-eq')?.addEventListener('click', () => { document.querySelectorAll('.eq-slider').forEach(sl => sl.value = 0); updateEQ(); });
  }

  wireSmartControls() {
    const bar = document.getElementById('controls-bar');
    this.triggerControlBar = () => {
      bar?.classList.remove('faded');
      clearTimeout(this.controlsTimer);
      if (!this.isPlaying) return; 
      this.controlsTimer = setTimeout(() => bar?.classList.add('faded'), 3000);
    };
    document.addEventListener('mousemove', this.triggerControlBar);
    document.addEventListener('click', this.triggerControlBar);
  }

  async refreshPlaylist() {
    if (!this.api || !this.api.mpv) return;
    const pl = await this.api.mpv.getPlaylist();
    const plContainer = document.getElementById('pl-list');
    if (!plContainer) return;
    if (!pl || pl.length === 0) {
      plContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">Queue is empty.</div>';
      return;
    }
    let html = '';
    pl.forEach((item, i) => {
      const isCurrent = item.current || item.playing;
      const name = item.filename.split('\\').pop().split('/').pop();
      html += `<div class="pl-item" style="padding:8px; background:${isCurrent ? 'var(--accent)' : 'var(--bar-bg)'}; color:${isCurrent ? '#fff' : 'var(--text)'}; border-radius:6px; cursor:pointer;" data-idx="${i}">
         ${i + 1}. ${name}
      </div>`;
    });
    plContainer.innerHTML = html;
    
    document.querySelectorAll('.pl-item').forEach(el => {
      el.addEventListener('click', () => this.api.mpv.cmd('set_property', 'playlist-pos', parseInt(el.dataset.idx)));
    });
  }

  wireMedia() {
    document.getElementById('btn-open-welcome')?.addEventListener('click', async () => { const f = await this.api?.dialog.open(); if (f && f.length) this.playMedia(f); });
    
    document.getElementById('btn-pl-add')?.addEventListener('click', async () => {
      const files = await this.api?.dialog.open();
      if (files && files.length > 0) {
        if (!this.isPlaying && this.duration === 0) {
          this.playMedia(files);
        } else {
          files.forEach(f => this.api?.mpv.append(f));
        }
        setTimeout(() => this.refreshPlaylist(), 500);
      }
    });

    document.getElementById('btn-play')?.addEventListener('click', () => this.togglePlay());
    document.getElementById('btn-stop')?.addEventListener('click', () => this.stopMedia());
    document.getElementById('btn-rew')?.addEventListener('click', () => { this.api?.mpv.cmd('seek', -10); this.showOSD('⏪ -10s'); });
    document.getElementById('btn-fwd')?.addEventListener('click', () => { this.api?.mpv.cmd('seek', 10); this.showOSD('⏩ +10s'); });
    document.getElementById('btn-prev')?.addEventListener('click', () => this.api?.mpv.cmd('playlist-prev'));
    document.getElementById('btn-next')?.addEventListener('click', () => this.api?.mpv.cmd('playlist-next'));
    document.getElementById('btn-fs')?.addEventListener('click', () => this.api?.win.fullscreen());

    document.getElementById('seek-bar')?.addEventListener('click', (e) => {
      if (!this.duration || !this.api?.mpv) return; 
      const pct = Math.max(0, Math.min(1, (e.clientX - e.target.getBoundingClientRect().left) / e.target.getBoundingClientRect().width));
      this.api.mpv.cmd('set_property', 'time-pos', pct * this.duration);
    });

    document.getElementById('volume-slider')?.addEventListener('input', (e) => {
      this.api?.mpv.cmd('set_property', 'volume', parseInt(e.target.value));
      document.getElementById('vol-label').innerText = `${e.target.value}%`;
      this.showOSD(`Volume: ${e.target.value}%`);
    });

    document.getElementById('btn-mute')?.addEventListener('click', () => { this.api?.mpv.cmd('cycle', 'mute'); this.showOSD('Mute Toggled'); });

    const speeds = [1, 1.5, 2, 2.5, 3, 4, 8];
    let speedIdx = 0;
    document.getElementById('speed-badge')?.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      const s = speeds[speedIdx];
      this.api?.mpv.cmd('set_property', 'speed', s);
      const badge = document.getElementById('speed-badge');
      if (badge) badge.innerText = s + '×';
      this.showOSD(`Speed: ${s}×`);
    });
  }

  wirePanels() {
    ['info', 'eq', 'playlist'].forEach(p => {
      document.getElementById(`btn-${p}`)?.addEventListener('click', () => { this.closePanels(); document.getElementById(`panel-${p}`)?.classList.add('open'); });
    });
    document.querySelectorAll('.panel-close').forEach(btn => btn.addEventListener('click', () => document.getElementById(`panel-${btn.dataset.panel}`)?.classList.remove('open')));
  }

  wireKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!this.api || !this.api.mpv || document.getElementById('welcome-screen')?.classList.contains('active')) return;
      if (document.getElementById('dlg-jump') && !document.getElementById('dlg-jump').classList.contains('hidden')) return;

      switch(e.code) {
        case 'Space': case 'KeyK': e.preventDefault(); this.togglePlay(); break;
        case 'ArrowRight': e.preventDefault(); this.api.mpv.cmd('seek', 5, 'relative'); this.showOSD('⏩ +5s'); break;
        case 'ArrowLeft': e.preventDefault(); this.api.mpv.cmd('seek', -5, 'relative'); this.showOSD('⏪ -5s'); break;
        case 'ArrowUp': 
          e.preventDefault(); this.api.mpv.cmd('add', 'volume', 10); 
          const vu = document.getElementById('volume-slider');
          if(vu) { vu.value = Math.min(130, parseInt(vu.value)+10); document.getElementById('vol-label').innerText = vu.value+'%'; this.showOSD(`Volume: ${vu.value}% 🔊`); }
          break;
        case 'ArrowDown': 
          e.preventDefault(); this.api.mpv.cmd('add', 'volume', -10); 
          const vd = document.getElementById('volume-slider');
          if(vd) { vd.value = Math.max(0, parseInt(vd.value)-10); document.getElementById('vol-label').innerText = vd.value+'%'; this.showOSD(`Volume: ${vd.value}% 🔉`); }
          break;
        case 'KeyF': e.preventDefault(); this.api.win.fullscreen(); break;
        case 'KeyS': e.preventDefault(); this.stopMedia(); break;
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
    this.triggerControlBar();
  }

  stopMedia() {
    if (!this.api?.mpv) return;
    this.api.mpv.cmd('stop');
    this.isPlaying = false;
    document.getElementById('player-view')?.classList.remove('active');
    document.getElementById('welcome-screen')?.classList.add('active');
    document.documentElement.classList.remove('playing');
    document.body.classList.remove('playing');
    document.getElementById('title-text').innerText = 'BM Player';
    clearTimeout(this.controlsTimer);
  }

  playMedia(files) {
    if (!this.api?.mpv) return;
    document.getElementById('welcome-screen')?.classList.remove('active');
    document.getElementById('player-view')?.classList.add('active');
    document.documentElement.classList.add('playing');
    document.body.classList.add('playing');
    this.api.mpv.open(files);
    this.isPlaying = true;
    document.getElementById('btn-play').innerText = '⏸';
    this.triggerControlBar();
    setTimeout(() => this.refreshPlaylist(), 500);
  }

  listenToMpv() {
    if (!this.api || !this.api.mpv) return;
    
    this.api.mpv.onProp((prop) => {
      if (prop.name === 'time-pos') {
        this.updateTime('time-current', prop.data);
        if (this.duration) document.getElementById('seek-progress').style.width = `${(prop.data / this.duration) * 100}%`;
      }
      if (prop.name === 'duration') {
        this.duration = prop.data;
        this.updateTime('time-total', prop.data);
      }
      if (prop.name === 'media-title') {
        const titleEl = document.getElementById('title-text');
        if (titleEl) titleEl.innerText = prop.data ? `BM Player - ${prop.data}` : 'BM Player';
      }
      if (prop.name === 'playlist-pos' || prop.name === 'playlist-count') {
        this.refreshPlaylist();
      }
      if (prop.name === 'speed') {
        const badge = document.getElementById('speed-badge');
        if (badge) badge.innerText = Number(prop.data).toFixed(1).replace('.0', '') + '×';
      }
    });

    this.api.mpv.onTracks((tracks) => {
      const audio = tracks.filter(t => t.type === 'audio');
      const subs = tracks.filter(t => t.type === 'sub');
      
      const audioDrop = document.getElementById('menu-audio-drop');
      if (audioDrop) {
          const noAudio = !audio.some(t => t.selected);
          let html = `<div class="mr" data-cmd="aid" data-id="no">${noAudio ? '✓ ' : ''}Disable Audio</div>`;
          audio.forEach(t => {
              const name = (t.lang ? `[${t.lang.toUpperCase()}] ` : '') + (t.title || t.codec || `Track ${t.id}`);
              html += `<div class="mr" data-cmd="aid" data-id="${t.id}">${t.selected ? '✓ ' : ''}${name}</div>`;
          });
          audioDrop.innerHTML = html;
      }
      
      const subDrop = document.getElementById('menu-sub-drop');
      if (subDrop) {
          const noSub = !subs.some(t => t.selected);
          let html = `<div class="mr" data-cmd="sid" data-id="no">${noSub ? '✓ ' : ''}Disable Subtitles</div>`;
          subs.forEach(t => {
              const name = (t.lang ? `[${t.lang.toUpperCase()}] ` : '') + (t.title || t.codec || `Track ${t.id}`);
              html += `<div class="mr" data-cmd="sid" data-id="${t.id}">${t.selected ? '✓ ' : ''}${name}</div>`;
          });
          subDrop.innerHTML = html;
      }

      document.querySelectorAll('[data-cmd]').forEach(el => {
          el.addEventListener('click', () => {
              this.api.mpv.cmd('set_property', el.dataset.cmd, el.dataset.id === 'no' ? 'no' : parseInt(el.dataset.id));
              el.closest('.mi-drop').style.display = 'none'; setTimeout(() => el.closest('.mi-drop').style.display = '', 150);
          });
      });
    });

    this.api.mpv.onMediaProps((props) => {
      const dump = document.getElementById('media-info-dump');
      if (dump) {
        let text = `STREAM ANALYSIS DATA:\n\n`;
        text += `[Container]\n`;
        text += `File: ${props['filename'] || 'Unknown'}\n`;
        text += `Format: ${props['container-format'] || 'Unknown'}\n`;
        text += `Size: ${props['file-size'] ? (props['file-size']/1048576).toFixed(2)+' MB' : 'Unknown'}\n\n`;
        
        text += `[Video Payload]\n`;
        text += `Codec: ${props['video-codec'] || 'Unknown'}\n`;
        if (props['video-params']) {
            text += `Resolution: ${props['video-params'].w} x ${props['video-params'].h}\n`;
            text += `Aspect Ratio: ${props['video-params'].dw}:${props['video-params'].dh}\n`;
            text += `Pixel Format: ${props['video-params'].pixelformat}\n`;
        }
        text += `Bitrate: ${props['video-bitrate'] ? (props['video-bitrate']/1000).toFixed(0)+' kbps' : 'VBR'}\n\n`;

        text += `[Audio Payload]\n`;
        text += `Codec: ${props['audio-codec'] || 'Unknown'}\n`;
        if (props['audio-params']) {
            text += `Channels: ${props['audio-params'].channel_count} (${props['audio-params'].format})\n`;
            text += `Sample Rate: ${props['audio-params'].samplerate} Hz\n`;
        }
        text += `Bitrate: ${props['audio-bitrate'] ? (props['audio-bitrate']/1000).toFixed(0)+' kbps' : 'VBR'}\n`;

        dump.innerText = text;
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
}

window.addEventListener('DOMContentLoaded', () => { window.bmApp = new BMPlayerApp(); });