import { Fox } from './fox.js';
import { Visualizer } from './visualizer.js';
import { applyIcons, setTogglePair } from './icons.js';
import { ThemeFX } from './theme-fx.js';

const EQ_BANDS = [{freq:31,label:'31'},{freq:62,label:'62'},{freq:125,label:'125'},{freq:250,label:'250'},{freq:500,label:'500'},{freq:1000,label:'1K'},{freq:2000,label:'2K'},{freq:4000,label:'4K'},{freq:8000,label:'8K'},{freq:16000,label:'16K'}];
const EQ_PRESETS = { flat:[0,0,0,0,0,0,0,0,0,0], bass:[8,7,5,3,1,0,0,0,0,0], treble:[0,0,0,0,0,1,3,5,7,8], rock:[5,4,-2,-4,-2,2,5,6,6,5], pop:[-1,2,4,4,1,-1,-2,-2,-1,1], jazz:[3,2,1,2,-1,-1,0,1,2,3], classical:[4,3,2,1,-1,-1,-1,0,2,3] };

function fmtTime(s) { if (!s || isNaN(s)) return '0:00'; s = Math.floor(s); const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60; return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${m}:${String(ss).padStart(2,'0')}`; }
function fmtBytes(b) { if (!b) return '—'; const u = ['B','KB','MB','GB']; let i=0; while (b>=1024 && i<u.length-1) { b/=1024; i++; } return `${b.toFixed(i?1:0)} ${u[i]}`; }
function fmtBitrate(b) { return b ? `${Math.round(b/1000)} kbps` : '—'; }

class BMPlayerApp {
  constructor() {
    this.api = window.api;
    this.isPlaying = false;
    this.duration = 0;
    this.eqGains = [...EQ_PRESETS.flat];
    this.eqEnabled = false;
    this.playlist = [];
    this.mediaProps = {};
    this.alwaysOnTop = localStorage.getItem('bm_ontop') === '1';
    this.recent = JSON.parse(localStorage.getItem('bm_recent') || '[]');
    this.osdTimer = null;
    this.hideTimer = null;
    this.controlsHovered = false;
    this.currentDash = 'video';       
    this.galleryImages = [];          
    this.galleryIndex  = -1;          
    this.init();
  }

  init() {
    const canvas = document.getElementById('fox-canvas');
    if (canvas && window.THREE) this.fox = new Fox(canvas);
    
    const vizCanvas = document.getElementById('visualizer-canvas');
    if (vizCanvas) this.viz = new Visualizer(vizCanvas);

    const fxCanvas = document.getElementById('theme-fx-canvas');
    if (fxCanvas) this.themeFX = new ThemeFX(fxCanvas);
    const auroraCanvas = document.getElementById('aurora-canvas');
    if (auroraCanvas) this.auroraFX = new ThemeFX(auroraCanvas);

    applyIcons();
    this.wireSidebar();

    this.wireTitlebar();
    this.wireThemes();
    this.wireMenu();
    this.wireWelcome();
    this.wireTransport();
    this.wireSeek();
    this.wireVolume();
    this.wirePanels();
    this.wireEqualizer();
    this.wirePlaylist();
    this.wireGallery();
    this.wireStudioDashboards(); 
    this.wireDialogs();
    this.wireKeyboard();
    this.wireDragDrop();
    this.wireControlsAutoHide();
    this.listenToMpv();
    this.renderRecent();
    this.renderTrackMenus([]);

    if (this.alwaysOnTop) {
      this.api?.win.alwaysTop(true);
      document.getElementById('mi-always-top')?.classList.add('active-opt');
    }

    window.addEventListener('contextmenu', e => { e.preventDefault(); this.api?.showContextMenu(); });

    this.ticker = document.createElement('div');
    this.ticker.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:9999;';
    document.body.appendChild(this.ticker);
    this.tickPos = 0;
    
    const keepAwake = () => {
      if (this.isPlaying) {
        this.tickPos = (this.tickPos + 1) % 2;
        this.ticker.style.transform = `translateX(${this.tickPos}px)`;
      }
      requestAnimationFrame(keepAwake);
    };
    keepAwake();
  }

  showOSD(msg, ms = 1400) {
    const el = document.getElementById('osd');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this.osdTimer);
    this.osdTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  wireTitlebar() {
    document.getElementById('btn-close')?.addEventListener('click', () => this.api?.win.close());
    document.getElementById('btn-minimize')?.addEventListener('click', () => this.api?.win.minimize());
    document.getElementById('btn-maximize')?.addEventListener('click', () => this.api?.win.maximize());
  }

  wireThemes() {
    const SIDEBAR_ICONS = {
      video:  `<svg class="ico" viewBox="0 0 24 24"><rect x="2" y="5" width="15" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M17 9l5-3v12l-5-3V9z" fill="currentColor"/></svg>`,
      music:  `<svg class="ico" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      images: `<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      pdf:    `<svg class="ico" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2"/><line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="17" x2="15" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    };
    document.querySelectorAll('.sidebar-btn[data-dest]').forEach(btn => {
      btn.innerHTML = SIDEBAR_ICONS[btn.dataset.dest] || '';
    });

    const apply = name => {
      document.documentElement.setAttribute('data-theme', name);
      document.querySelectorAll('.tp').forEach(b => b.classList.toggle('active', b.dataset.theme === name));
      localStorage.setItem('bm_theme', name);
      this.fox?.setTheme?.(name);

      const isWelcome = document.getElementById('welcome-screen')?.classList.contains('active');

      if (this.themeFX) {
        this.themeFX.setMode(name === 'dracula' ? 'blood' : 'off');
        if (name === 'dracula' && isWelcome) this.themeFX.start();
      }

      if (this.auroraFX) {
        this.auroraFX.setMode(name === 'northern' ? 'aurora' : 'off');
        if (name === 'northern' && isWelcome) this.auroraFX.start();
      }
    };
    document.querySelectorAll('.tp').forEach(btn => btn.addEventListener('click', () => apply(btn.dataset.theme)));
    apply(localStorage.getItem('bm_theme') || 'dark');
  }

  wireSidebar() {
    document.querySelectorAll('.sidebar-btn[data-dest]').forEach(btn => {
      btn.addEventListener('click', () => this.switchDest(btn.dataset.dest));
    });
  }

  // 🌟 Master visibility controller for all living canvases 🌟
  switchDest(dest) {
    this.currentDash = dest;
    document.querySelectorAll('.sidebar-btn[data-dest]').forEach(btn => btn.classList.toggle('active', btn.dataset.dest === dest));

    document.getElementById('welcome-screen')?.classList.remove('active');
    document.getElementById('player-view')?.classList.remove('active');
    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));

    let showWelcome = false;

    if (dest === 'video') {
      if (this.isPlaying || this.duration > 0) {
        document.getElementById('player-view')?.classList.add('active');
      } else {
        document.getElementById('welcome-screen')?.classList.add('active');
        showWelcome = true;
      }
    } else if (dest === 'images') {
      document.getElementById('gallery-view')?.classList.add('active');
    } else if (dest === 'music') {
      document.getElementById('music-view')?.classList.add('active');
    } else if (dest === 'pdf') {
      document.getElementById('pdf-view')?.classList.add('active');
    }

    // Instantly wake or sleep all visual effects based on screen status
    if (showWelcome) {
      this.fox?.wake();
      if (this.themeFX?.mode !== 'off') this.themeFX?.start();
      if (this.auroraFX?.mode !== 'off') this.auroraFX?.start();
    } else {
      this.fox?.sleep();
      this.themeFX?.stop();
      this.auroraFX?.stop();
    }
  }

  wireStudioDashboards() {
    document.getElementById('btn-pdf-open')?.addEventListener('click', async () => {
      const file = await this.api?.documents?.openPDF();
      if (file) this.showOSD(`Loaded PDF Document Workspace: ${file.split(/[\\/]/).pop()}`);
    });
    document.getElementById('btn-music-open')?.addEventListener('click', async () => {
      const files = await this.api?.dialog.open();
      if (files?.length) this.playMedia(files);
    });
  }

  wireGallery() {
    document.getElementById('btn-gallery-open')?.addEventListener('click', async () => {
      const folder = await this.api?.gallery?.browse();
      if (!folder) return;
      const label = document.getElementById('gallery-folder-label');
      if (label) label.textContent = folder;
      const images = await this.api?.gallery?.scan(folder);
      this.galleryImages = images || [];
      this._renderGallery();
    });

    document.getElementById('lightbox-close')?.addEventListener('click', () => this._closeLightbox());
    document.getElementById('lightbox-prev')?.addEventListener('click', () => this._lightboxNav(-1));
    document.getElementById('lightbox-next')?.addEventListener('click', () => this._lightboxNav(+1));
    document.addEventListener('keydown', e => {
      const lb = document.getElementById('lightbox');
      if (!lb?.classList.contains('open')) return;
      if (e.key === 'Escape')     this._closeLightbox();
      if (e.key === 'ArrowLeft')  this._lightboxNav(-1);
      if (e.key === 'ArrowRight') this._lightboxNav(+1);
    });
  }

  _renderGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    if (!this.galleryImages.length) {
      grid.innerHTML = '<div class="gallery-empty"><div style="font-size:56px">🖼</div><p>No images found in this folder</p></div>';
      return;
    }
    grid.innerHTML = this.galleryImages.map((img, i) => `
      <div class="gallery-thumb" data-idx="${i}">
        <img src="file://${img.path.replace(/\\/g, '/')}" loading="lazy" alt="${img.name}">
        <div class="gt-name">${img.name}</div>
      </div>`).join('');
    grid.querySelectorAll('.gallery-thumb').forEach(card => card.addEventListener('click', () => this._openLightbox(+card.dataset.idx)));
  }

  _openLightbox(idx) {
    this.galleryIndex = idx;
    const img  = this.galleryImages[idx];
    const el   = document.getElementById('lightbox');
    const imgEl= document.getElementById('lightbox-img');
    const cap  = document.getElementById('lightbox-caption');
    if (!el || !imgEl || !img) return;
    imgEl.src = `file://${img.path.replace(/\\/g, '/')}`;
    if (cap) cap.textContent = `${img.name}  (${idx + 1} / ${this.galleryImages.length})`;
    el.classList.add('open');
  }

  _closeLightbox() { document.getElementById('lightbox')?.classList.remove('open'); }

  _lightboxNav(dir) {
    if (!this.galleryImages.length) return;
    this.galleryIndex = (this.galleryIndex + dir + this.galleryImages.length) % this.galleryImages.length;
    this._openLightbox(this.galleryIndex);
  }

  wireMenu() {
    document.querySelectorAll('.menu-toolbar [data-a]').forEach(el => {
      el.addEventListener('click', () => this.handleMenuAction(el.dataset.a, el.dataset.v, el));
    });
  }

  handleMenuAction(action, v, el) {
    const api = this.api;
    switch (action) {
      case 'open': case 'open-multi': this.openFileDialog(); break;
      case 'quit': api?.win.close(); break;
      case 'play-pause': this.togglePlay(); break;
      case 'stop': this.stop(); break;
      case 'prev': api?.mpv.cmd('playlist-prev'); break;
      case 'next': api?.mpv.cmd('playlist-next'); break;
      case 'viz-mode': {
        this.viz?.setMode(v);
        document.querySelectorAll('.viz-opt').forEach(b => {
          const isActive = b.dataset.v === v;
          b.classList.toggle('active-opt', isActive);
          b.textContent = (isActive ? '✓ ' : '') + b.textContent.replace('✓ ', '');
        });
        this.showOSD(`Visualizer: ${v.charAt(0).toUpperCase() + v.slice(1)}`);
        break;
      }
      case 'speed': {
        const speed = parseFloat(v);
        api?.mpv.cmd('set_property','speed', speed);
        document.getElementById('speed-badge').textContent = speed + '×';
        document.querySelectorAll('[data-a="speed"]').forEach(b => b.classList.toggle('active-opt', parseFloat(b.dataset.v) === speed));
        this.showOSD(`Speed ${speed}×`);
        break;
      }
      case 'loop': {
        api?.mpv.cmd('set_property','loop-file', v==='file' ? 'inf' : 'no');
        api?.mpv.cmd('set_property','loop-playlist', v==='playlist' ? 'inf' : 'no');
        document.querySelectorAll('.loop-opt').forEach(b => b.classList.toggle('sel', b.dataset.v === v));
        this.showOSD(`Loop: ${v}`);
        break;
      }
      case 'jump': document.getElementById('dlg-jump').classList.remove('hidden'); document.getElementById('jump-input').focus(); break;
      case 'chapter-prev': api?.mpv.cmd('add','chapter',-1); break;
      case 'chapter-next': api?.mpv.cmd('add','chapter',1); break;
      case 'fullscreen': api?.win.fullscreen(); break;
      case 'vol-up': this.bumpVolume(5); break;
      case 'vol-down': this.bumpVolume(-5); break;
      case 'mute': this.toggleMute(); break;
      case 'audio-delay': if (v === '0') api?.adj.resetAudio(); else api?.adj.audioDelay(v === '+' ? 0.5 : -0.5); break;
      case 'channels': api?.mpv.cmd('set_property','audio-channels', v); this.showOSD(`Channels: ${v}`); break;
      case 'equalizer': this.openPanel('eq'); break;
      case 'aspect': api?.mpv.cmd('set_property','video-aspect-override', v==='-1' ? '-1' : v); this.showOSD(`Aspect: ${v==='-1'?'Auto':v}`); break;
      case 'zoom': api?.mpv.cmd('set_property','video-zoom', parseFloat(v)); break;
      case 'deinterlace': api?.mpv.cmd('cycle','deinterlace'); this.showOSD('Deinterlace toggled'); break;
      case 'snapshot': api?.mpv.cmd('screenshot','subtitles'); this.showOSD('📸 Screenshot saved'); break;
      case 'sub-track': api?.mpv.cmd('set_property','sub-visibility', false); break;
      case 'sub-file': this.addSubtitleFile(); break;
      case 'sub-delay': if (v === '0') api?.adj.resetSub(); else api?.adj.subDelay(v === '+' ? 0.5 : -0.5); break;
      case 'sub-size': api?.mpv.cmd('add','sub-font-size', parseInt(v)); break;
      case 'sub-pos': if (v === 'up') api?.mpv.cmd('add','sub-pos',-5); if (v === 'down') api?.mpv.cmd('add','sub-pos',5); if (v === 'reset') api?.mpv.cmd('set_property','sub-pos',100); break;
      case 'hwdec': api?.mpv.cmd('set_property','hwdec', v); document.querySelectorAll('.hwdec-opt').forEach(b => b.classList.toggle('sel', b.dataset.v === v)); this.showOSD(`Decoder: ${v}`); break;
      case 'media-info': this.openPanel('info'); break;
      case 'playlist': this.openPanel('playlist'); break;
      case 'always-top': {
        this.alwaysOnTop = !this.alwaysOnTop; api?.win.alwaysTop(this.alwaysOnTop);
        localStorage.setItem('bm_ontop', this.alwaysOnTop ? '1' : '0');
        el?.classList.toggle('active-opt', this.alwaysOnTop);
        this.showOSD(this.alwaysOnTop ? '📌 Always on top' : 'Normal window');
        break;
      }
      case 'check-updates': this.checkForUpdates(); break;
      case 'about': this.showAbout(); break;
    }
  }

  async showAbout() {
    document.getElementById('dlg-about').classList.remove('hidden');
    const version = await this.api?.app.version();
    document.getElementById('lbl-version').textContent = version;
    document.getElementById('update-status').textContent = 'System check complete.';
  }

  async checkForUpdates() {
    document.getElementById('dlg-about').classList.remove('hidden');
    const status = document.getElementById('update-status');
    const version = await this.api?.app.version();
    document.getElementById('lbl-version').textContent = version;
    
    status.textContent = 'Checking GitHub for updates...';
    const res = await this.api?.app.checkUpdate();
    if (res?.success) {
      status.textContent = 'Update found! Downloading in the background...';
      status.style.color = '#00ffaa';
    } else {
      status.textContent = 'You are running the latest version.';
      status.style.color = 'var(--text-muted)';
    }
  }

  wireWelcome() { document.getElementById('btn-open-welcome')?.addEventListener('click', () => this.openFileDialog()); }

  async openFileDialog() { const files = await this.api?.dialog.open(); if (files?.length) this.playMedia(files); }
  async addSubtitleFile() { const sub = await this.api?.dialog.openSub(); if (sub) { this.api?.mpv.cmd('sub-add', sub, 'select'); this.showOSD('Subtitle added'); } }

  renderRecent() {
    const grid = document.getElementById('recent-grid');
    const sub  = document.getElementById('recent-sub');
    if (grid) {
      grid.innerHTML = this.recent.map(f => `<div class="recent-card" data-path="${f.path.replace(/"/g,'&quot;')}"><div class="recent-card-icon">🎬</div><div class="recent-card-name" title="${f.name}">${f.name}</div></div>`).join('');
      grid.querySelectorAll('.recent-card').forEach(card => card.addEventListener('click', () => this.playMedia([card.dataset.path])));
    }
    if (sub) {
      sub.innerHTML = this.recent.length ? this.recent.map(f => `<div class="mr" data-path="${f.path.replace(/"/g,'&quot;')}">${f.name}</div>`).join('') : '<div class="mr disabled">No recent files</div>';
      sub.querySelectorAll('.mr[data-path]').forEach(row => row.addEventListener('click', () => this.playMedia([row.dataset.path])));
    }
  }

  addRecent(filePath) {
    const name = filePath.split(/[\\/]/).pop();
    this.recent = [{ path: filePath, name }, ...this.recent.filter(f => f.path !== filePath)].slice(0, 8);
    localStorage.setItem('bm_recent', JSON.stringify(this.recent));
    this.renderRecent(); this.api?.app.addRecent(filePath);
  }

  wireTransport() {
    document.getElementById('btn-play')?.addEventListener('click', () => this.togglePlay());
    document.getElementById('btn-stop')?.addEventListener('click', () => this.stop());
    document.getElementById('btn-prev')?.addEventListener('click', () => this.api?.mpv.cmd('playlist-prev'));
    document.getElementById('btn-next')?.addEventListener('click', () => this.api?.mpv.cmd('playlist-next'));
    document.getElementById('btn-rew')?.addEventListener('click', () => { this.api?.mpv.cmd('seek',-10,'relative'); this.showOSD('⏪ -10s'); });
    document.getElementById('btn-fwd')?.addEventListener('click', () => { this.api?.mpv.cmd('seek', 10,'relative'); this.showOSD('⏩ +10s'); });
    document.getElementById('btn-fs')?.addEventListener('click',  () => this.api?.win.fullscreen());
    document.getElementById('btn-info')?.addEventListener('click', () => this.openPanel('info'));
    document.getElementById('btn-eq')?.addEventListener('click',   () => this.openPanel('eq'));
    document.getElementById('btn-playlist')?.addEventListener('click', () => this.openPanel('playlist'));
  }

  togglePlay() {
    if (!this.api?.mpv) return;
    this.isPlaying = !this.isPlaying;
    this.api.mpv.cmd('set_property','pause', !this.isPlaying);
    this.updatePlayIcon();
    this.showOSD(this.isPlaying ? '▶ Play' : '⏸ Pause');
  }

  stop() {
    if (!this.api?.mpv) return;
    this.api.mpv.cmd('stop');
    this.isPlaying = false;
    this.duration  = 0;
    this.updatePlayIcon();
    this.updateTime('time-current', 0);
    this.updateSeek(0);
    document.getElementById('title-text').textContent = 'BM Player';
    document.documentElement.classList.remove('playing');
    document.body.classList.remove('playing');
    this.viz?.stop();
    this.switchDest('video'); // Triggers the wake sequence perfectly!
  }

  updatePlayIcon() { setTogglePair('btn-play', !this.isPlaying); }

  playMedia(files) {
    if (!this.api?.mpv) return;
    document.documentElement.classList.add('playing');
    document.body.classList.add('playing');
    this.api.mpv.open(files);
    this.isPlaying = true;
    this.updatePlayIcon();
    this.switchDest('video'); // Triggers the sleep sequence securely!
    files.forEach(f => !f.startsWith('http') && this.addRecent(f));
  }

  bumpVolume(delta) {
    const slider = document.getElementById('volume-slider');
    if (!slider) return;
    const next = Math.max(0, Math.min(+slider.max, +slider.value + delta));
    slider.value = next;
    this.api?.mpv.cmd('set_property','volume', next);
    document.getElementById('vol-label').textContent = next + '%';
    this.showOSD(`🔊 ${next}%`);
  }

  toggleMute() { this.api?.mpv.cmd('cycle','mute'); }

  wireSeek() {
    const bar  = document.getElementById('seek-bar');
    const tip  = document.getElementById('seek-tooltip');
    if (!bar) return;
    bar.addEventListener('mousemove', e => {
      const rect = bar.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX-rect.left)/rect.width));
      if (tip) { tip.style.left = `${pct*100}%`; tip.textContent = fmtTime(pct*this.duration); }
    });
    bar.addEventListener('click', e => {
      if (!this.duration) return;
      const rect = bar.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX-rect.left)/rect.width));
      this.api?.mpv.cmd('set_property','time-pos', pct*this.duration);
    });
  }

  wireVolume() {
    const slider = document.getElementById('volume-slider');
    slider?.addEventListener('input', e => {
      const v = +e.target.value; this.api?.mpv.cmd('set_property','volume', v);
      document.getElementById('vol-label').textContent = v + '%';
    });
    document.getElementById('btn-mute')?.addEventListener('click', () => this.toggleMute());
  }

  wirePanels() {
    document.querySelectorAll('.panel-close').forEach(btn => btn.addEventListener('click', () => this.closePanel(btn.dataset.panel)));
  }

  openPanel(name) {
    ['info','eq','playlist'].forEach(n => { const el = document.getElementById('panel-' + n); el?.classList.toggle('open', n === name); });
    if (name === 'info') this.renderInfo();
    if (name === 'playlist') this.refreshPlaylist();
  }
  closePanel(name) { document.getElementById('panel-' + name)?.classList.remove('open'); }

  renderInfo() {
    const p = this.mediaProps; const vp = p['video-params'] || {}; const ap = p['audio-params'] || {};
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('inf-name', this.currentTitle || '—'); set('inf-dur',  fmtTime(this.duration)); set('inf-size', fmtBytes(p['file-size'])); set('inf-fmt',  p['container-format'] || '—');
    set('inf-vc',  p['video-codec'] || '—'); set('inf-res', vp.w && vp.h ? `${vp.w} × ${vp.h}` : '—'); set('inf-fps', p['estimated-vf-fps'] ? p['estimated-vf-fps'].toFixed(2) : '—'); set('inf-asp', vp.aspect ? vp.aspect.toFixed(3) : '—'); set('inf-vbr', fmtBitrate(p['video-bitrate']));
    set('inf-ac', p['audio-codec'] || '—'); set('inf-sr', ap['samplerate'] ? `${ap.samplerate} Hz` : '—'); set('inf-ch', ap['channel-count'] ? `${ap['channel-count']} ch` : (ap.channels || '—')); set('inf-abr', fmtBitrate(p['audio-bitrate']));
  }

  wireEqualizer() {
    const wrap = document.getElementById('eq-bands');
    if (!wrap) return;
    wrap.innerHTML = EQ_BANDS.map((b,i) => `<div class="eq-band"><span class="eq-band-val" id="eq-val-${i}">0</span><input type="range" min="-12" max="12" value="0" id="eq-slider-${i}"><span class="eq-band-label">${b.label}</span></div>`).join('');

    EQ_BANDS.forEach((_, i) => {
      document.getElementById(`eq-slider-${i}`)?.addEventListener('input', e => {
        this.eqGains[i] = +e.target.value; document.getElementById(`eq-val-${i}`).textContent = this.eqGains[i];
        document.getElementById('eq-preset').value = ''; this.applyEq();
      });
    });

    document.getElementById('eq-enable')?.addEventListener('change', e => { this.eqEnabled = e.target.checked; this.applyEq(); });

    document.getElementById('eq-preset')?.addEventListener('change', e => {
      const preset = EQ_PRESETS[e.target.value]; if (!preset) return;
      this.eqGains = [...preset];
      EQ_BANDS.forEach((_, i) => { document.getElementById(`eq-slider-${i}`).value = preset[i]; document.getElementById(`eq-val-${i}`).textContent = preset[i]; });
      this.applyEq();
    });

    document.getElementById('btn-reset-eq')?.addEventListener('click', () => { document.getElementById('eq-preset').value = 'flat'; document.getElementById('eq-preset').dispatchEvent(new Event('change')); });
  }

  applyEq() {
    if (!this.eqEnabled) { this.api?.mpv.cmd('set_property','af',''); return; }
    const chain = EQ_BANDS.map((b,i) => `equalizer=f=${b.freq}:width_type=o:width=1:g=${this.eqGains[i]}`).join(',');
    this.api?.mpv.cmd('set_property','af', `lavfi=[${chain}]`);
  }

  wirePlaylist() {
    document.getElementById('btn-pl-add')?.addEventListener('click', async () => { const files = await this.api?.dialog.open(); if (files?.length) { for (const f of files) await this.api.mpv.append(f); setTimeout(()=>this.refreshPlaylist(),300); } });
    document.getElementById('btn-pl-clear')?.addEventListener('click', () => { this.api?.mpv.cmd('playlist-clear'); setTimeout(() => this.refreshPlaylist(), 200); });
  }

  async refreshPlaylist() {
    const list = await this.api?.mpv.getPlaylist(); const el = document.getElementById('pl-list'); if (!el) return;
    if (!Array.isArray(list) || !list.length) { el.innerHTML = '<div class="mr disabled">Playlist is empty</div>'; return; }
    el.innerHTML = list.map((item, i) => {
      const name = (item.filename || '').split(/[\\/]/).pop() || item.filename;
      return `<div class="pl-item ${item.current ? 'playing' : ''}" data-idx="${i}"><span class="pl-item-idx">${i+1}</span><span class="pl-item-name" title="${name}">${name}</span><span class="pl-item-rm" data-rm="${i}">✕</span></div>`;
    }).join('');
    el.querySelectorAll('.pl-item').forEach(row => row.addEventListener('click', e => { if (e.target.dataset.rm !== undefined) return; this.api?.mpv.cmd('playlist-play-index', +row.dataset.idx); }));
    el.querySelectorAll('[data-rm]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); this.api?.mpv.cmd('playlist-remove', +btn.dataset.rm); setTimeout(() => this.refreshPlaylist(), 200); }));
  }

  wireDialogs() {
    const dlg = document.getElementById('dlg-jump');
    document.getElementById('jump-cancel')?.addEventListener('click', () => dlg.classList.add('hidden'));
    document.getElementById('about-ok')?.addEventListener('click', () => document.getElementById('dlg-about').classList.add('hidden'));

    document.getElementById('jump-ok')?.addEventListener('click', () => {
      const val = document.getElementById('jump-input').value.trim(); const parts = val.split(':').map(Number); let secs = 0;
      if (parts.length === 3) secs = parts[0]*3600+parts[1]*60+parts[2]; else if (parts.length === 2) secs = parts[0]*60+parts[1]; else secs = parts[0] || 0;
      if (!isNaN(secs)) this.api?.mpv.cmd('set_property','time-pos', secs);
      dlg.classList.add('hidden'); document.getElementById('jump-input').value = '';
    });
    document.getElementById('jump-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('jump-ok').click(); if (e.key === 'Escape') dlg.classList.add('hidden'); });
  }

  wireKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.matches('input,select,textarea')) return;
      if (!document.getElementById('player-view')?.classList.contains('active')) return;

      switch (e.code) {
        case 'Space': e.preventDefault(); this.togglePlay(); break;
        case 'KeyS': this.stop(); break;
        case 'KeyP': this.api?.mpv.cmd('playlist-prev'); break;
        case 'KeyN': this.api?.mpv.cmd('playlist-next'); break;
        case 'ArrowLeft':  e.preventDefault(); this.api?.mpv.cmd('seek',-5,'relative'); this.showOSD('⏪ -5s'); break;
        case 'ArrowRight': e.preventDefault(); this.api?.mpv.cmd('seek', 5,'relative'); this.showOSD('⏩ +5s'); break;
        case 'ArrowUp':    e.preventDefault(); this.bumpVolume(5);  break;
        case 'ArrowDown':  e.preventDefault(); this.bumpVolume(-5); break;
        case 'KeyM': this.toggleMute(); break;
        case 'KeyF': case 'F11': e.preventDefault(); this.api?.win.fullscreen(); break;
        case 'KeyZ': this.api?.adj.subDelay(0.5);  this.showOSD('Sub delay +0.5s'); break;
        case 'KeyX': this.api?.adj.subDelay(-0.5); this.showOSD('Sub delay -0.5s'); break;
        case 'KeyG': case 'KeyV': this.api?.mpv.cmd('cycle','sub'); break;
        case 'BracketLeft':  this.api?.mpv.cmd('multiply','speed',1/1.25); this.showOSD('Speed −'); break;
        case 'BracketRight': this.api?.mpv.cmd('multiply','speed',1.25);   this.showOSD('Speed +'); break;
        case 'Backspace': this.api?.mpv.cmd('set_property','speed',1.0); document.getElementById('speed-badge').textContent = '1×'; this.showOSD('Speed reset'); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
        case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': {
          const pct = parseInt(e.code.replace('Digit','')) * 10;
          if (this.duration) this.api?.mpv.cmd('set_property','time-pos', this.duration*pct/100);
          this.showOSD(`⏩ ${pct}%`); break;
        }
        case 'KeyK': if (e.shiftKey) { this.api?.adj.audioDelay(0.5);  this.showOSD('Audio delay +0.5s'); } break;
        case 'KeyJ': if (e.shiftKey) { this.api?.adj.audioDelay(-0.5); this.showOSD('Audio delay -0.5s'); } break;
        case 'KeyI': if (e.ctrlKey) { e.preventDefault(); this.openPanel('info'); } break;
        case 'KeyL': if (e.ctrlKey) { e.preventDefault(); this.openPanel('playlist'); } break;
        case 'KeyT': if (e.ctrlKey) { this.api?.mpv.cmd('screenshot','subtitles'); this.showOSD('📸 Screenshot saved'); } break;
        case 'KeyO': if (e.ctrlKey) { e.preventDefault(); this.openFileDialog(); } break;
        case 'KeyQ': if (e.ctrlKey) { this.api?.win.close(); } break;
        case 'Escape': this.api?.win.isFs().then(fs => { if (fs) { e.preventDefault(); this.api.win.fullscreen(); } else this.stop(); }); break;
      }
    });
  }

  wireDragDrop() {
    const overlay = document.getElementById('drop-overlay');
    document.addEventListener('dragover', e => { e.preventDefault(); overlay.classList.add('active'); });
    document.addEventListener('dragleave', e => { if (!e.relatedTarget) overlay.classList.remove('active'); });
    document.addEventListener('drop', e => { 
      e.preventDefault(); 
      overlay.classList.remove('active'); 
      const paths = [...e.dataTransfer.files].map(f => f.path).filter(Boolean); 
      if (!paths.length) return;

      const ext = paths[0].split('.').pop().toLowerCase();
      const imgs = new Set(['jpg','jpeg','png','webp','gif','bmp']);

      if (ext === 'pdf') {
        this.switchDest('pdf');
        this.showOSD(`Loaded PDF Workspace via drop: ${paths[0].split(/[\\/]/).pop()}`);
      } else if (imgs.has(ext)) {
        this.switchDest('images');
        this.showOSD("Dropped an image. Use 'Open Folder' to scan full collections.");
      } else {
        this.playMedia(paths);
      }
    });
  }

  wireControlsAutoHide() {
    const bottomBar = document.getElementById('controls-bar');
    const topTitle = document.getElementById('titlebar');
    const topMenu = document.getElementById('menu-toolbar');
    if (!bottomBar) return;

    const show = () => {
      bottomBar.classList.remove('faded');
      topTitle?.classList.remove('faded-top');
      topMenu?.classList.remove('faded-top');
      clearTimeout(this.hideTimer);
      
      this.hideTimer = setTimeout(() => {
        const anyPanelOpen = document.querySelector('.side-panel.open');
        if (this.isPlaying && !this.controlsHovered && !anyPanelOpen) {
          bottomBar.classList.add('faded');
          topTitle?.classList.add('faded-top');
          topMenu?.classList.add('faded-top');
        }
      }, 3000);
    };

    document.addEventListener('mousemove', () => { 
      if (document.getElementById('player-view')?.classList.contains('active')) show(); 
    });
    
    const keepAwake = () => { this.controlsHovered = true;  show(); };
    const letSleep  = () => { this.controlsHovered = false; show(); };

    bottomBar.addEventListener('mouseenter', keepAwake);
    bottomBar.addEventListener('mouseleave', letSleep);
    topTitle?.addEventListener('mouseenter', keepAwake);
    topTitle?.addEventListener('mouseleave', letSleep);
    topMenu?.addEventListener('mouseenter', keepAwake);
    topMenu?.addEventListener('mouseleave', letSleep);

    this._showControls = show;
  }

  listenToMpv() {
    if (!this.api?.mpv) return;
    this.api.mpv.onProp(prop => {
      switch (prop.name) {
        case 'pause': this.isPlaying = !prop.data; this.updatePlayIcon(); this._showControls?.(); break;
        case 'time-pos': this.updateTime('time-current', prop.data); this.updateSeek(prop.data); break;
        case 'duration': this.duration = prop.data || 0; this.updateTime('time-total', prop.data); break;
        case 'media-title': this.currentTitle = prop.data; document.getElementById('title-text').textContent = prop.data ? prop.data : 'BM Player'; break;
        case 'mute': { setTogglePair('btn-mute', !prop.data); break; }
        case 'volume': { const slider = document.getElementById('volume-slider'); if (slider) slider.value = prop.data; document.getElementById('vol-label').textContent = Math.round(prop.data) + '%'; break; }
        case 'track-list': this.renderTrackMenus(prop.data || []); this.updateVisualizerVisibility(prop.data || []); break;
        case 'loop-file': case 'loop-playlist': this.syncLoopMenu(); break;
        case 'playlist-pos': case 'playlist-count': if (document.getElementById('panel-playlist')?.classList.contains('open')) this.refreshPlaylist(); break;
      }
    });
    this.api.mpv.onMediaProps(props => { this.mediaProps = props; });
    this.api.mpv.onStatus(d => { if (d.state === 'missing') this.showOSD('⚠ mpv.exe not found — place it in vendor/mpv/', 5000); });
  }

  updateTime(id, seconds) { const el = document.getElementById(id); if (el) el.textContent = fmtTime(seconds); }
  updateSeek(current) {
    if (!this.duration) return;
    const pct = Math.max(0, Math.min(100, (current/this.duration)*100));
    document.getElementById('seek-progress').style.width = pct + '%'; document.getElementById('seek-thumb').style.left = pct + '%';
  }

  syncLoopMenu() { }

  updateVisualizerVisibility(tracks) {
    const hasVideo = tracks.some(t => t.type === 'video');
    if (hasVideo) this.viz?.stop(); else { const activeMode = document.querySelector('.viz-opt.active-opt')?.dataset.v || 'bars'; if (activeMode !== 'off') this.viz?.setMode(activeMode); }
  }

  renderTrackMenus(tracks) {
    const audio = tracks.filter(t => t.type === 'audio'); const video = tracks.filter(t => t.type === 'video'); const subs  = tracks.filter(t => t.type === 'sub');
    this._fillTrackSub('audio-track-sub', audio, 'aid'); this._fillTrackSub('video-track-sub', video, 'vid'); this._fillSubTrackMenu(subs);
  }

  _trackLabel(t) { return [t.lang ? `[${t.lang.toUpperCase()}]` : '', t.title || t.codec || `Track ${t.id}`].filter(Boolean).join(' '); }

  _fillTrackSub(containerId, list, propName) {
    const el = document.getElementById(containerId); if (!el) return;
    if (!list.length) { el.innerHTML = '<div class="mr disabled">None</div>'; return; }
    el.innerHTML = '';
    list.forEach(t => { const row = document.createElement('div'); row.className = 'mr' + (t.selected ? ' active-opt' : ''); row.textContent = (t.selected ? '✓ ' : '') + this._trackLabel(t); row.addEventListener('click', () => this.api?.mpv.cmd('set_property', propName, t.id)); el.appendChild(row); });
  }

  _fillSubTrackMenu(subs) {
    const el = document.getElementById('sub-track-sub'); if (!el) return;
    const anySelected = subs.some(t => t.selected); el.innerHTML = '';
    const offRow = document.createElement('div'); offRow.className = 'mr' + (!anySelected ? ' active-opt' : ''); offRow.textContent = (!anySelected ? '✓ ' : '') + 'Off'; offRow.addEventListener('click', () => this.api?.mpv.cmd('set_property','sub-visibility', false)); el.appendChild(offRow);
    subs.forEach(t => { const row = document.createElement('div'); row.className = 'mr' + (t.selected ? ' active-opt' : ''); row.textContent = (t.selected ? '✓ ' : '') + this._trackLabel(t); row.addEventListener('click', () => { this.api?.mpv.cmd('set_property','sub-visibility', true); this.api?.mpv.cmd('set_property','sid', t.id); }); el.appendChild(row); });
  }
}

window.addEventListener('DOMContentLoaded', () => { window.bmApp = new BMPlayerApp(); });