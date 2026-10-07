import { createFox  } from './fox3d.js';
import { buildFoxSVG } from './geofox.js';
import { Visualizer, vizSettings, saveVizSettings, allVisualisers, setSharedAnalyser, setSharedArt } from './visualizer.js';
import { AudioShadow } from './audio-shadow.js';   // the exact visualiser for audio mpv plays
import './viz-settings.js';   // the visualiser settings panel
import { ThemeFX    } from './theme-fx.js';
import { FluidFX    } from './fluid.js';
import { applyIcons, setTogglePair, setIcon, setPlaying } from './icons.js';
import { perf, QUALITY_TIERS } from './perf.js';
import settings from './modules/settings.js';
import history from './modules/history.js';
import ABRepeat from './modules/abrepeat.js';
import bookmarks from './modules/bookmarks.js';
import SpeedMenu, { SPEED_PRESETS } from './modules/speed-menu.js';
import SubtitleSearch from './modules/subtitle-search.js';
import { parseM3u, serializeM3u, readM3uFile, writeM3uFile, isM3uPath } from './modules/playlist-io.js';
import liteMode from './modules/lite-mode.js';
import './lite-video.js';   // Lite: where the video window goes
import './range-fill.js';   // volume sliders filled with the theme's colours
import './ctx-menu.js';     // the right-click menu's submenus
import { SCENE_THEMES } from './theme-scenes.js';   // the artistic themes' own scenes
import { flowSettings } from './flow-settings.js';   // the Flow theme's controls
import { applySubStyle } from './sub-style.js';   // subtitle font and colour
import { TVModule } from './modules/tv.js';
import { el, fileURL, fmtSec, seedGrad,
         escapeHtml, escapeAttr, basenameOf, relativeTime } from './util.js';
import { PluginManager } from './plugins.js';
import { collectDiagnostics, formatDiagnostics } from './diagnostics.js';
import { GalleryDash } from './dash/gallery.js';
import { MusicDash }   from './dash/music.js';
import { PDFViewer }   from './dash/pdf.js';

const EQ_BANDS=[31,62,125,250,500,1000,2000,4000,8000,16000].map((f,i)=>({freq:f,label:f<1000?String(f):f/1000+'K'}));
const EQ_PRESETS={flat:[0,0,0,0,0,0,0,0,0,0],bass:[8,7,5,3,1,0,0,0,0,0],treble:[0,0,0,0,0,1,3,5,7,8],rock:[5,4,-2,-4,-2,2,5,6,6,5],pop:[-1,2,4,4,1,-1,-2,-2,-1,1],jazz:[3,2,1,2,-1,-1,0,1,2,3],classical:[4,3,2,1,-1,-1,-1,0,2,3]};

class BMPlayer {
  constructor(){
    this.api=window.api;
    this.isPlaying=false;this.duration=0;this.currentTime=0;this.isSeeking=false;
    // For this session only (v3.27.0): a pin switched on once was saved and came
    // back at every launch, so the player opened above everything. An old saved
    // value is cleared once.
    this.alwaysOnTop=false;try{localStorage.removeItem('bm_ontop');}catch(_){}
    this.recent=JSON.parse(localStorage.getItem('bm_recent')||'[]');
    this.eqValues=[...EQ_PRESETS.flat];
    this.osdTimer=null;this.hideTimer=null;
    this.currentDash='video';this._lastTracks=[];
    this._pluginListeners={};
    this._ctxSubDelay=0;this._ctxAudioDelay=0;this._mProps={};
    this._currentFilePath=null;          // path of the currently-loaded media file
    this.shadow=new AudioShadow();this._shadowOn=false;   // v3.29.0, audio-shadow.js
    this._resumePromptTimer=null;
    // ── v1.8.0: fluid FX state, music energy, custom theme ──
    this._musicEnergy=0;this._targetMusicEnergy=0;
    this._fluidEnabled=localStorage.getItem('bm_fluid_enabled')!=='0';
    this._customTheme=null;
    this.init();
  }
  init(){
    // ── v1.9.0: Lite Mode bootstrap ───────────────────────────────
    // Detect lite mode BEFORE instantiating any GPU-heavy module. The
    // boot-time inline script in index.html has already set window.__BM_LITE__
    // if auto-detect (or env var, or user override) voted for lite. We use
    // that boot flag synchronously here to make the heavy-module skip
    // decision; _initLiteMode() then refines asynchronously (asking the
    // main process for the authoritative build-time flag + perf info).
    this.isLite = (window.__BM_LITE__ === true);
    this._initLiteMode();   // async, refines this.isLite + sets up listeners
    const isLite = this.isLite;
    if (isLite) {
      // Perf tier 'low' for this run: disables particle-heavy rendering in any
      // module that does end up running (e.g. theme-fx if user re-enables).
      // For this run only (v3.36.0): setTier saved it, and the app stayed on
      // Low for good, even back in Pro.
      try { perf.setSessionTier('low'); } catch(_) {}
    }
    const fxC=el('theme-fx-canvas'),aurC=el('aurora-canvas'),foxC=el('fox-canvas'),vizC=el('visualizer-canvas');
    // The fox: a real 3D low-poly head where WebGL works, the flat SVG one in
    // Lite mode or without WebGL. createFox() decides.
    try { if(foxC) this.fox = createFox(foxC, { lite: isLite }); }
    catch(e) { console.warn('[BM Player] Fox init failed:', e); }
    // Skip ALL GPU-heavy visual modules in lite mode.fox stays undefined;
    // this.fox?.resume()/pause() / this.themeFX?.resume() etc all no-op.
    if(!isLite){
      // Ensure fox canvas has proper dimensions before init
      if(foxC && (!foxC.clientWidth || !foxC.clientHeight)) {
        foxC.style.width='220px';
        foxC.style.height='220px';
        foxC.width=220;
        foxC.height=220;
      }
      // Wrap each module init in try-catch to prevent one failure from breaking everything
      try { if(fxC) this.themeFX=new ThemeFX(fxC); } catch(e) { console.warn('[BM Player] ThemeFX init failed:', e); }
      // The aurora canvas ran a SECOND ThemeFX — a 2D particle system that
      // called itself a fluid simulation but never solved for pressure, so it
      // looked like drifting dots. This is a real GPU Navier-Stokes solver.
      // Same setMode/setPalette/pause/resume surface, so every existing call
      // site keeps working; if the GPU can't give us half-float render
      // targets the constructor throws and we fall back to the old particles.
      if(aurC){
        try {
          if (window.__BM_FLAGS__?.gpuFluid === false) throw new Error('disabled by flag');
          this.auroraFX = new FluidFX(aurC);
          this._fluidIsGPU = true;
        } catch(e) {
          console.warn('[BM Player] GPU fluid unavailable, using particle fallback:', e.message);
          try { this.auroraFX = new ThemeFX(aurC); } catch(e2) { console.warn('[BM Player] AuroraFX init failed:', e2); }
        }
      }
      try { if(vizC) this.viz=new Visualizer(vizC); } catch(e) { console.warn('[BM Player] Visualizer init failed:', e); }
    } else {
      // Belt-and-braces: the CSS already hides these via html.lite-mode,
      // but we also nuke the canvas elements so even direct getContext
      // calls can't reach them. Frees their GPU memory immediately.
      ['fox-canvas','theme-fx-canvas','aurora-canvas','visualizer-canvas'].forEach(id=>{
        const c = el(id); if(c) c.remove();
      });
    }
    // Apply icons with error handling
    this.installErrorTrap();
    try { applyIcons(); } catch(e) { console.warn('[BM Player] applyIcons failed:', e); }
    // ── v1.7.0: instantiate professional feature modules ──
    this.abRepeat = new ABRepeat({
      mpvApi: () => this.api?.mpv,
      osd: (m, ms) => this.showOSD(m, ms),
    });
    this.speedMenu = new SpeedMenu({
      mpvApi: () => this.api?.mpv,
      osd: (m, ms) => this.showOSD(m, ms),
      anchorId: 'speed-badge',
    });
    this.subSearch = new SubtitleSearch({
      mpvApi: () => this.api?.mpv,
      osd: (m, ms) => this.showOSD(m, ms),
    });
    // React to A-B repeat state changes (updates on-screen indicator)
    window.addEventListener('bm:abrepeat', () => this._renderABIndicator());
    // React to bookmark store changes (re-render panel if open)
    bookmarks.onChange(() => this._renderBookmarksPanel());
    // React to history store changes
    history.onChange(() => this._renderHistoryPanel());
    this.wireTitlebar();this.wireThemes();this.wireSidebar();this.wireMenu();
    this.wireWelcome();this.wireTransport();this.wireSeek();this.wireVolume();
    this.wirePanels();this.wireEQ();this.wirePlaylistPanel();this.wireCtxPanel();
    this.wireDialogs();this.wireOverlayKeys();this.wireKeyboard();this.wireDragDrop();this.wireControlsHide();
    this.wirePiP();this.wireMiniPlayer();this.wireVizOverlay();this.wireCtxMenu();this.wireFluidPointer();this.wireDiagnostics();
    this.wireUpdate();this.wireDefaultPrompt();this.listenMpv();this.renderRecent();this.renderTrackMenus([]);
    this.wireABRepeat();this.wireBookmarks();this.wireHistory();this.wireSettings();this.wireSubSearch();this.wireResumePrompt();this.wirePlaylistIO();this.wireBookmarkControls();
    this.wirePerfPanel();
    this.pluginManager=new PluginManager(this);
    this._wireFluidPanel();
    // ── v1.8.0 ──
    this.wireThemeCustomizer();this._startMusicEnergyLoop();
    // ── v2.0.0: TV / IPTV module ──
    this.tvModule = new TVModule({
      onPlay: (ch) => this._tvPlayChannel(ch),
      onStatus: (type, msg) => this._tvStatusUpdate(type, msg),
    });
    if (this.tvModule.restoreFromCache()) { this._tvRenderChannels(); }
    this._tvRenderRecent();
    this.wireTV();
    if(this.alwaysOnTop){this.api?.win.alwaysTop(true);el('mi-always-top')?.classList.add('active-opt');}
    window.addEventListener('contextmenu',e=>{e.preventDefault();this._openCtxPanel(e.clientX,e.clientY);});
    this.api?.win.onState?.(s=>{const b=el('btn-maximize');if(b)setIcon(b,s==='maximized'?'restore':'maximize');this._askRefresh();});
  }
  /**
   * v1.9.0 — Lite mode bootstrap.
   * The boot-time inline script in index.html has already set the
   * html.lite-mode class based on a quick localStorage+deviceMemory
   * check. Here we ask the main process for the authoritative build-
   * time flag + real CPU/RAM, then feed that into the lite-mode
   * module so its getReason() can say something useful.
   */
  async _initLiteMode(){
    // 1. Quick path — the boot script already decided.
    const bootLite = (window.__BM_LITE__ === true);
    // 2. Authoritative path — ask the main process for build flag + perf info.
    try {
      const info = await this.api?.app?.perfInfo?.();
      if (info?.liteBuild) { liteMode.setEnvFlag(1); document.documentElement.classList.add('lite-build'); }   // no effects choice there (v3.32.0)
      else if (info?.envLite) liteMode.setEnvFlag(1);
      // Stash the real CPU/RAM for the perf panel display.
      this._mainPerfInfo = info;
      // And let the quality tier use them (v3.36.0): the page cannot see more
      // than "8 GB or more", the main process can.
      perf.refine({ cores: info?.cpuCount, memGB: info?.totalMemGB });
      perf.setRefresh(info?.displayHz);   // and the screen's refresh rate (see _askRefresh)
    } catch(_) {}
    // 3. Final verdict (env > user override > auto).
    this.isLite = liteMode.isLiteMode();
    // 4. Sync the html class — the boot script may have got it wrong
    //    if main process perfInfo disagrees.
    document.documentElement.classList.toggle('lite-mode', !!this.isLite);
    this._markFx?.();   // the Pro/Lite switch (v3.33.0)
    // 5. React to user toggling the override in Preferences.
    liteMode.onChange((verdict, reason) => {
      this.isLite = verdict;
      // We can't safely hot-swap the deleted canvases back in, so prompt
      // the user that a restart is needed for the visual change to take
      // full effect. The CSS-level changes (backdrop-filter, shadows)
      // do apply immediately, which is a nice partial win.
      document.documentElement.classList.toggle('lite-mode', !!verdict);
      this._markFx?.();
      // The Pro/Lite switch says it its own way (v3.33.0).
      if (!this._fxQuiet) this.showOSD(`Performance mode: ${verdict ? 'Lite' : 'Pro'} (restart for full effect)`, 3500);
      this._renderPerfInfo();
    });
  }
  wirePerfPanel(){
    const sel = el('set-perf-mode');
    if (sel) {
      // Initialize from current override
      const stored = localStorage.getItem('bm_lite_user');
      sel.value = (stored === '1') ? 'lite' : (stored === '0' ? 'full' : 'auto');
      sel.addEventListener('change', () => {
        const v = sel.value;
        if (v === 'auto') liteMode.setUserOverride(null);
        else if (v === 'lite') liteMode.setUserOverride(true);
        else liteMode.setUserOverride(false);
        this._renderPerfInfo();
      });
    }
    this._renderPerfInfo();
  }
  _renderPerfInfo(){
    const modeEl = el('perf-info-mode'),
          reasonEl = el('perf-info-reason'),
          coresEl = el('perf-info-cores'),
          ramEl = el('perf-info-ram'),
          gpuEl = el('perf-info-gpu');
    if (!modeEl) return;
    modeEl.textContent = this.isLite ? '🟢 Lite' : '🔵 Full';
    if (reasonEl) reasonEl.textContent = liteMode.getReason();
    const info = liteMode.detectPerfInfo();
    const main = this._mainPerfInfo || {};
    if (coresEl) coresEl.textContent = main.cpuCount || info.hardwareConcurrency || '—';
    if (ramEl) {
      const mem = main.totalMemGB || info.deviceMemory;
      ramEl.textContent = mem != null ? `${mem} GB${main.totalMemGB ? ' (system)' : ' (reported)'}` : '—';
    }
    if (gpuEl) gpuEl.textContent = info.webglRenderer || '—';
  }
  wireTitlebar(){
    el('btn-minimize')?.addEventListener('click',()=>this.api?.win.minimize());
    el('btn-maximize')?.addEventListener('click',()=>this.api?.win.maximize());
    el('btn-close')?.addEventListener('click',()=>this.api?.win.close());
    el('btn-theatre')?.addEventListener('click',()=>this.api?.win.theatre());
    el('titlebar')?.addEventListener('dblclick',()=>this.api?.win.maximize());
  }
  wireThemes(){
    this.applyTheme=name=>{
      // If a custom theme override exists, skip built-in theme data-attr
      document.documentElement.setAttribute('data-theme',name);
      document.querySelectorAll('.tp').forEach(b=>b.classList.toggle('active',b.dataset.theme===name));
      localStorage.setItem('bm_theme',name);
      this.fox?.setTheme?.(name);
      // ── v1.8.0: fluid FX for ALL themes, blood only for dracula ──
      if(name==='dracula'){
        this.themeFX?.setMode('blood');
        this.auroraFX?.setMode('off');
      } else if(name==='northern'){
        // v3.28.0: Flow, the fluid this theme had before v3.27.0, with its
        // controls in the theme customizer (flow-settings.js).
        this.themeFX?.setMode('off');
        if(this._fluidEnabled){ this.auroraFX?.setPalette?.('northern'); this.auroraFX?.setFlow?.(flowSettings()); this.auroraFX?.setMode('fluid'); }
        else this.auroraFX?.setMode('off');
      } else if(SCENE_THEMES.includes(name)){
        // v3.27.0: the artistic themes each have a scene of their own (ocean
        // light and bubbles, forest fireflies, city lights...) instead of the
        // fluid every theme shared. Dark, Light, Dracula and Snow keep theirs.
        this.themeFX?.setMode(this._fluidEnabled?'scene:'+name:'off');
        this.auroraFX?.setMode('off');
      } else {
        // Snow falls in the effects layer, over the icy fluid.
        this.themeFX?.setMode(name==='snow'?'snow':'off');
        if(this._fluidEnabled){
          this.auroraFX?.setFlow?.({});   // Dark and Light: the standard fluid
          this.auroraFX?.setPalette?.(name);
          this.auroraFX?.setMode('fluid');
        } else {
          this.auroraFX?.setMode('off');
        }
      }
      this.auroraFX?.setQuality?.(perf.tier);
      this.emitPlugin('theme-change',{theme:name});
      this._syncEffects();   // a theme change starts loops: settle them (v3.30.0)
    };
    // The effects layer follows the pointer too: snowflakes swirl away from it.
    window.addEventListener('mousemove',e=>this.themeFX?.pointer?.(e.clientX,e.clientY),{passive:true});
    document.querySelectorAll('.tp').forEach(b=>b.addEventListener('click',()=>this.applyTheme(b.dataset.theme)));
    this.applyTheme(localStorage.getItem('bm_theme')||'dark');
    el('mi-always-top')?.addEventListener('click',()=>{
      this.toggleAlwaysOnTop();
    });
  }
  wireSidebar(){document.querySelectorAll('.sidebar-btn[data-dest]').forEach(b=>b.addEventListener('click',()=>this.switchDest(b.dataset.dest)));}
  switchDest(dest){
    // Unknown names used to be stored anyway, and every view was hidden
    // before the branch match, so a typo left a blank screen. The gallery is
    // 'images', which is how five tests ended up exercising that blank state.
    if(!['video','music','images','pdf','tv'].includes(dest)){
      console.warn('[BM Player] switchDest: unknown destination',dest);
      return;
    }
    // The full-screen visualiser belongs to the Video tab. Only that branch
    // used to reset it, so after music -> Video -> Gallery the mode stayed
    // on, and because the mini bar hides itself during the visualiser, it
    // never came back. Leaving the Video tab now leaves the visualiser. The
    // music keeps playing, and returning to Video turns it on again.
    if(dest!=='video' && this._audioVizMode){
      this._audioVizMode=false;
      document.body.classList.remove('audio-viz');
      this.viz?.stop?.();
    }
    this.currentDash=dest;
    document.querySelectorAll('.sidebar-btn[data-dest]').forEach(b=>b.classList.toggle('active',b.dataset.dest===dest));
    el('welcome-screen')?.classList.remove('active');el('player-view')?.classList.remove('active');
    document.querySelectorAll('.dashboard-view').forEach(v=>v.classList.remove('active'));
    let welcomeVisible=false;
    if(dest==='video'){
      // Audio playing + Video tab used to KILL the track. Now it promotes the
      // audio to the full-screen visualiser instead — the track keeps playing.
      if(this.isPlaying && !this._hasVideo){
        this._audioVizMode=true;
        this._askRefresh();
        el('welcome-screen')?.classList.remove('active');
        el('player-view')?.classList.add('active');
        document.body.classList.add('audio-viz');
        const vc=el('visualizer-canvas');
        if(vc && !this.viz){ try{ this.viz=new Visualizer(vc); }catch(_){} }
        window.bmMusic?.attachVisualiser?.(this.viz);
        requestAnimationFrame(()=>{ this.viz?._resize?.(); this.viz?.setMode(vizSettings().style); this.viz?.start(); });
        this._hideMiniPlayer();
        this._updateVizMeta();
        this.fox?.setExpression?.('happy');
        // Everything below assumes we're falling through to welcome/player —
        // this branch is already resolved.
        this._updateMiniPlayer();
        this.fox?.pause();this.themeFX?.pause();this.auroraFX?.pause();
        return;
      }
      this._audioVizMode=false;
      document.body.classList.remove('audio-viz');
      // Only show player-view if actual VIDEO content is playing (not audio-only)
      if(this.isPlaying && this._hasVideo) el('player-view')?.classList.add('active');
      else { el('welcome-screen')?.classList.add('active'); welcomeVisible=true; }
    }
    else if(dest==='images') el('gallery-view')?.classList.add('active');
    else if(dest==='music'){
      el('music-view')?.classList.add('active');
      // Canvas was sized while the view was display:none (offsetWidth 0 -> 800x400 fallback).
      requestAnimationFrame(()=>window.bmMusic?._viz?._resize?.());
    }
    else if(dest==='pdf')    el('pdf-view')?.classList.add('active');
    else if(dest==='tv')     el('tv-view')?.classList.add('active');
    // ── v1.8.0: Smart mini player — shows in pdf/gallery/tv, hidden in music tab ──
    if(dest==='music') this._hideMiniPlayer();
    else this._updateMiniPlayer();
    // Only TV stops audio now — a live stream and a local track can't share mpv.
    if(dest==='tv'){
      if(this.isPlaying && !this._hasVideo){
        this._stopAllAudio();
        this.isPlaying=false;this.duration=0;this.currentTime=0;
        this._hideMiniPlayer();
        this.fox?.setExpression?.('neutral');
      }
    }
    // Performance: the fox's WebGL scene and the theme-fx canvas
    this._syncEffects();
  }
  _updateVizMeta(){
    const t=el('viz-meta-title'),ar=el('viz-meta-artist');
    if(t)t.textContent=el('np-title')?.textContent||'Not Playing';
    if(ar)ar.textContent=el('np-artist')?.textContent||'';
  }
  _updateMiniPlayer(){
    const mini=el('music-mini-player');if(!mini)return;
    // ── v1.8.0: show mini player when audio is playing and NOT on music tab ──
    // Also suppressed in the full-screen audio visualiser — the big overlay
    // already carries the transport, two sets of controls is noise.
    const show=this.isPlaying&&!this._hasVideo&&this.currentDash!=='music'&&!this._audioVizMode;
    mini.classList.toggle('hidden',!show);
    const pv=el('player-view'),ws=el('welcome-screen');
    pv?.classList.toggle('has-mini',show);ws?.classList.toggle('has-mini',show);
    document.querySelectorAll('.dashboard-view').forEach(v=>v.classList.toggle('has-mini',show));
    // ── v1.8.0: update mini player title/artist/progress ──
    if(show){
      const title=el('np-title')?.textContent||'Not Playing';
      const mt=el('mmp-title');if(mt)mt.textContent=title;
      const ma=el('mmp-artist');if(ma)ma.textContent=el('np-artist')?.textContent||'';
      // Mirror the Now Playing gradient so the bar doesn't look like a stub
      const srcArt=el('np-art-inner'),mArt=el('mmp-art');
      if(mArt&&srcArt&&srcArt.style.background){mArt.style.background=srcArt.style.background;mArt.textContent='';}
      const mp=el('mmp-play');if(mp)setPlaying(mp,!this.isPaused);
      if(this.duration>0){
        const pf=el('mmp-progress-fill');
        if(pf)pf.style.width=(this.currentTime/this.duration*100)+'%';
      }
    }
  }
  _hideMiniPlayer(){
    el('music-mini-player')?.classList.add('hidden');
    el('player-view')?.classList.remove('has-mini');
    el('welcome-screen')?.classList.remove('has-mini');
    document.querySelectorAll('.dashboard-view').forEach(v=>v.classList.remove('has-mini'));
  }
  wireMenu(){document.querySelectorAll('.mr[data-a]').forEach(r=>r.addEventListener('click',()=>this.handleAction(r.dataset.a)));}
  handleAction(a){
    const cmd=(c,...args)=>this.api?.mpv.cmd(c,...args);
    const m={
      'open':()=>this.openDialog(),'open-url':()=>{el('dlg-url')?.classList.remove('hidden');el('url-input')?.focus();},
      'open-sub':()=>this.api?.dialog.openSub().then(s=>{if(s){cmd('sub-add',s,'select');this.showOSD('Subtitle loaded');}}),
      'quit':()=>this.api?.win.close(),'toggle-play':()=>this.togglePlay(),'stop':()=>this.stop(),
      'prev':()=>this.trackStep(-1),'next':()=>this.trackStep(1),
      'speed-dec':()=>this.speedMenu?.cyclePrev() ?? cmd('multiply','speed',0.9091),
      'speed-inc':()=>this.speedMenu?.cycleNext() ?? cmd('multiply','speed',1.1),
      'speed-presets':()=>this.speedMenu?.toggle(),
      'speed-reset':()=>this.speedMenu?.set(1) ?? cmd('set_property','speed',1),
      'loop-file':()=>cmd('cycle','loop-file'),
      'screenshot':()=>{cmd('screenshot','subtitles');this.showOSD('Screenshot saved');},'jump-to-time':()=>{el('dlg-jump')?.classList.remove('hidden');el('jump-input')?.focus();},
      'cycle-audio':()=>cmd('cycle','audio'),'vol-up':()=>this.bumpVolume(settings.get('behaviour.volumeStep') ?? 5),'vol-down':()=>this.bumpVolume(-(settings.get('behaviour.volumeStep') ?? 5)),'mute':()=>this.toggleMute(),
      'fullscreen':()=>this.api?.win.fullscreen(),'theatre':()=>this.api?.win.theatre(),'cycle-sub':()=>cmd('cycle','sub'),
      'sub-delay-p':()=>this.api?.adj.subDelay(0.5),'sub-delay-m':()=>this.api?.adj.subDelay(-0.5),'sub-delay-r':()=>this.api?.adj.resetSub(),
      'sub-size-p':()=>cmd('add','sub-font-size',4),'sub-size-m':()=>cmd('add','sub-font-size',-4),
      'open-eq':()=>this.openPanel('eq'),'open-info':()=>this.openPanel('info'),'open-playlist':()=>this.openPanel('playlist'),
      'open-bookmarks':()=>{this.openPanel('bookmarks');this._renderBookmarksPanel();},
      'open-history':()=>{this.openPanel('history');this._renderHistoryPanel();},
      'open-plugins':()=>{this.openPanel('plugins');this.pluginManager?.refreshPanel();},'open-fluid':()=>{this.openPanel('fluid');this._refreshFluidPanel();},
      // ── v1.8.0: Theme Customizer ──
      'open-theme-customizer':()=>this._openThemeCustomizer(),
      'shortcuts':()=>this.toggleShortcuts(true),
      'fx-auto':()=>this._switchFx('auto'),'fx-pro':()=>this._switchFx('pro'),'fx-lite':()=>this._switchFx('lite'),
      'audio-delay-p':()=>this.api?.adj.audioDelay(0.5),'audio-delay-m':()=>this.api?.adj.audioDelay(-0.5),'audio-delay-r':()=>this.api?.adj.resetAudio(),
      'aspect-auto':()=>cmd('set_property','video-aspect-override','-1'),'aspect-16:9':()=>cmd('set_property','video-aspect-override','16/9'),
      'aspect-4:3':()=>cmd('set_property','video-aspect-override','4/3'),'aspect-21:9':()=>cmd('set_property','video-aspect-override','21/9'),
      'hwdec-auto':()=>cmd('set_property','hwdec','auto-safe'),'hwdec-nvdec':()=>cmd('set_property','hwdec','nvdec'),'hwdec-off':()=>cmd('set_property','hwdec','no'),
      // ── v1.7.0: A-B repeat & frame stepping ──
      'ab-set-a':()=>this.abRepeat?.setA(),
      'ab-set-b':()=>this.abRepeat?.setB(),
      'ab-clear':()=>this.abRepeat?.clear(),
      'ab-toggle':()=>this.abRepeat?.togglePause(),
      'frame-back':()=>{cmd('frame-back-step');this.showOSD('◂ Frame');},
      'frame-fwd':()=>{cmd('frame-step');this.showOSD('Frame ▸');},
      // ── v1.7.0: M3U playlist IO ──
      'import-m3u':()=>this.importM3u(),
      'export-m3u':()=>this.exportM3u(),
      // ── v1.7.0: Online subtitle search ──
      'search-subs':()=>{this.openPanel('subsearch');},
      'check-update':()=>{this.api?.app.checkUpdate();this.showOSD('Checking for updates...');},
      'preferences':()=>{this.openPanel('settings');this._syncSettingsPanel();},
      'about':()=>this.openAbout(),
    };
    m[a]?.();
  }
  wireWelcome(){
    el('btn-open-welcome')?.addEventListener('click',()=>this.openDialog());
    el('btn-open-url-welcome')?.addEventListener('click',()=>{el('dlg-url')?.classList.remove('hidden');el('url-input')?.focus();});
    el('btn-clear-recent')?.addEventListener('click',()=>{this.recent=[];localStorage.removeItem('bm_recent');this.renderRecent();});
  }
  renderRecent(){
    const g=el('recent-grid');if(!g)return;
    if(!this.recent.length){g.innerHTML='<div class="recent-empty"><div style="font-size:40px;margin-bottom:8px;opacity:.3">&#127909;</div><p>No recent files</p></div>';return;}
    g.innerHTML=this.recent.slice(0,16).map(f=>{const name=f.split(/[\\/]/).pop();const ext=name.split('.').pop().toUpperCase();return'<div class="recent-card" data-f="'+f.replace(/"/g,'&quot;')+'"><div class="recent-thumb">&#127909;</div><div class="recent-info"><div class="recent-name">'+name+'</div><div class="recent-ext">'+ext+'</div></div></div>';}).join('');
    g.querySelectorAll('.recent-card').forEach(c=>c.addEventListener('click',()=>this.playMedia([c.dataset.f])));
  }
  addRecent(f){this.recent=[f,...this.recent.filter(r=>r!==f)].slice(0,20);localStorage.setItem('bm_recent',JSON.stringify(this.recent));this.api?.app.addRecent(f);}
  wireTransport(){
    el('btn-play')?.addEventListener('click',()=>this.togglePlay());
    el('btn-stop')?.addEventListener('click',()=>this.stop());
    el('btn-prev')?.addEventListener('click',()=>this.trackStep(-1));
    el('btn-next')?.addEventListener('click',()=>this.trackStep(1));
    el('btn-rew')?.addEventListener('click',()=>{const s=-(settings.get('behaviour.seekLargeSec') ?? 30);this.seekBy(s);this.showOSD(`Seek ${s}s`);});
    el('btn-fwd')?.addEventListener('click',()=>{const s=(settings.get('behaviour.seekLargeSec') ?? 30);this.seekBy(s);this.showOSD(`Seek +${s}s`);});
    el('btn-fs')?.addEventListener('click',()=>this.api?.win.fullscreen());
    el('btn-info')?.addEventListener('click',()=>this.openPanel('info'));
    el('btn-eq')?.addEventListener('click',()=>this.openPanel('eq'));
    el('btn-playlist')?.addEventListener('click',()=>this.openPanel('playlist'));
    el('btn-bookmark')?.addEventListener('click',()=>this.addBookmarkAtCurrent());
    el('btn-history')?.addEventListener('click',()=>{this.openPanel('history');this._renderHistoryPanel();});
    el('btn-theatre-player')?.addEventListener('click',()=>this.api?.win.theatre());
    // NOTE: speed-badge click handler is now owned by SpeedMenu (v1.7.0)
    // — it opens a dropdown with curated speed presets instead of blindly
    // cycling through them.
  }
  // Playback is owned by mpv for video and by the renderer audio engine for
  // audio-only files. Every transport control goes through here so the two
  // can't get out of step.
  togglePlay(){
    const m=window.bmMusic;
    if(m?.engineOwns?.()) return m.toggle();
    this.api?.mpv.cmd('cycle','pause');
  }
  setVolume(v){
    window.bmMusic?.engine?.setVolume?.(v);
    this.api?.mpv.cmd('set_property','volume',v);
  }
  // Relative seek. Negative goes back.
  seekBy(delta){
    const m=window.bmMusic;
    if(m?.engineOwns?.()) return m.engine.seekBy(delta);
    this.api?.mpv.cmd('seek',(delta>=0?'+':'')+delta);
  }
  // Mute is set explicitly on both players rather than cycled, so the two
  // can never end up disagreeing about whether sound is on.
  toggleMute(){
    this._muted=!this._muted;
    window.bmMusic?.engine?.setMuted?.(this._muted);
    this.api?.mpv.cmd('set_property','mute',this._muted);
    this.updateMuteIcon?.(this._muted);
    const c=el('ctx-mute'); if(c) c.checked=this._muted;
  }
  // Stops whichever player has audio without the rest of stop()'s teardown.
  _stopAllAudio(){
    window.bmMusic?.engine?.stop?.();
    this.api?.mpv.cmd('stop');
  }
  seekTo(seconds){
    const m=window.bmMusic;
    if(m?.engineOwns?.()) return m.engine.seek(seconds);
    this.api?.mpv.cmd('seek',seconds,'absolute');
  }
  // opts.stay keeps you on the current tab (the music panel's own stop
  // button). Everywhere else, including the video-mode visualiser, stop
  // returns to the home screen.
  stop(opts){
    if(!this.api?.mpv)return;this.api.mpv.cmd('stop');
    // ── v1.7.0: persist last position before stopping ──
    history.onClose({ path: this._currentFilePath, timePos: this.currentTime });
    this.isPlaying=false;this.duration=0;this.currentTime=0;
    this._currentFilePath=null;
    this.abRepeat?.clear();
    this._renderBookmarksOnSeekbar();
    this.updatePlayIcon();this.setTime('time-current',0);this.setTime('time-total',0);this.setSeekPct(0);
    const t=el('title-text');if(t)t.textContent='';   // the name stays in the middle (v3.33.0)
    document.body.classList.remove('playing');document.documentElement.classList.remove('playing');
    // FULL TEARDOWN: _hasVideo used to stay true after a stop, so the next
    // switchDest('video') thought a video was still loaded and re-opened
    // player-view over an empty mpv surface.
    this._hasVideo=false;
    this._audioVizMode=false;
    window.bmMusic?.engine?.stop();
    // Clear the return tab first. Leaving PiP navigates back to wherever PiP
    // was entered from, and that reply arrives after goHome() below, so stop
    // in PiP used to land on the old tab instead of home.
    this._pipReturnDash=null;
    if(this._pipActive) this.togglePiP(false);
    // The class that shows the music overlay in the player view. Left set,
    // it put the album tile and transport on top of the next video.
    document.body.classList.remove('audio-viz');
    this._stopShadow();
    this.viz?.stop();this.musicViz?.stop();
    window.bmMusic?._viz?.stop?.();   // the music view's too (v3.36.0): it went on drawing an empty spectrum after the music stopped
    this._hideMiniPlayer();
    this._resetNowPlaying();
    this.fox?.wake();this.fox?.setExpression?.('neutral');
    if(!(opts&&opts.stay)) this.goHome();
    this.emitPlugin('playback-stop',{});
  }
  // Explicit "back to square one" — every stop path funnels through here so
  // the welcome screen is guaranteed to be the visible view.
  // A thrown error in any handler used to kill the rest of that callback
  // with nothing but a console line the user never sees. At minimum they
  // should know something broke and that DevTools has the detail.
  installErrorTrap(){
    let last=0;
    const report=(what,detail)=>{
      const now=Date.now();
      if(now-last<4000)return;      // don't spam on a repeating rAF error
      last=now;
      console.error('[BM Player]',what,detail);
      try{ this.showOSD('Something went wrong — Ctrl+Shift+I for details'); }catch(_){}
    };
    window.addEventListener('error',e=>report('uncaught error:',e.error||e.message));
    window.addEventListener('unhandledrejection',e=>report('unhandled rejection:',e.reason));
    // The decorative loops follow the window too (v3.30.0, _syncEffects).
    document.addEventListener('visibilitychange',()=>this._syncEffects());
    this._markFx();
    el('fx-toggle')?.addEventListener('click',()=>this._switchFx(document.documentElement.classList.contains('lite-mode')?'pro':'lite'));
    try{ const n=sessionStorage.getItem('bm_fx_note'); if(n){ sessionStorage.removeItem('bm_fx_note'); setTimeout(()=>this._fxNote(`Switched to ${n} mode`),400); } }catch(_){}
    // The visual mode hides the side pane (v3.31.0), and it slides back while the
    // pointer is at the left edge, so the other views are still a move away.
    document.addEventListener('mousemove',e=>{
      const b=document.body;
      if(!b.classList.contains('audio-viz')){b.classList.remove('sidebar-peek');return;}
      if(e.clientX<18)b.classList.add('sidebar-peek');else if(e.clientX>96)b.classList.remove('sidebar-peek');
    },{passive:true});
    this.api?.win?.onHidden?.(h=>{this._winHidden=!!h;this._syncEffects();if(!h)this._askRefresh();});
  }

  // The refresh rate of the screen the window is on now (v3.36.0): asked again
  // when the window is maximised, restored or shown and when the visual mode
  // opens, since it may have been moved to another screen.
  _askRefresh(){
    try{ this.api?.app?.perfInfo?.()?.then?.(i=>perf.setRefresh(i?.displayHz))?.catch?.(()=>{}); }catch(_){}
  }

  // mpv's playlist has a single entry during music playback, so transport
  // buttons must go through MusicDash's queue instead.
  trackStep(dir){
    const m=window.bmMusic;
    if(m?.currentPath && !this._hasVideo && m.queue?.length){
      if(dir>0) m.advance();
      else{
        const prev=Math.max(0,(m.queueIdx||0)-1);
        if(m.queue[prev]) m.play(m.queue[prev].path,prev);
      }
      return;
    }
    this.api?.mpv.cmd(dir>0?'playlist-next':'playlist-prev');
  }

  // I can't see the machine this runs on, so the app reports on itself.
  // Everything here is what a bug report needs and nobody can be expected
  // to dig out by hand.
  async openDiagnostics(){
    this.openPanel('diagnostics');
    const out=el('diag-output');
    if(out)out.textContent='Collecting\u2026';
    try{
      const d=await collectDiagnostics(this.api);
      this._lastDiagnostics=formatDiagnostics(d);
      if(out)out.textContent=this._lastDiagnostics;
    }catch(e){
      if(out)out.textContent='Diagnostics failed: '+(e&&e.message||e);
    }
  }
  wireDiagnostics(){
    el('diag-refresh')?.addEventListener('click',()=>this.openDiagnostics());
    el('diag-copy')?.addEventListener('click',async()=>{
      const text=this._lastDiagnostics||el('diag-output')?.textContent||'';
      try{ await navigator.clipboard.writeText(text); this.showOSD('Diagnostics copied'); }
      catch(_){
        // Clipboard can be refused; selecting the text is still useful.
        const out=el('diag-output');
        if(out){ const r=document.createRange(); r.selectNodeContents(out);
          const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
        this.showOSD('Copy blocked \u2014 text selected instead');
      }
    });
  }

  // Overlays get first claim on the keyboard. A capture-phase listener on
  // window runs before every bubble listener on document regardless of the
  // order they were registered in, so this does not depend on init order.
  //   Escape: closes the topmost overlay and stops there.
  //   Other keys: modal overlays (menu, dialogs, lightbox, customizer) own
  //   them, so Space/S/arrows don't reach playback underneath. Side panels
  //   are not modal: playback keys still work while one is open.
  wireOverlayKeys(){
    window.addEventListener('keydown',e=>{
      const top=this._topOverlay();
      if(!top)return;
      if(e.key==='Escape'){
        e.preventDefault();
        e.__bmHandled=true;
        top.close();
        return;
      }
      if(top.modal)e.__bmHandled=true;
    },true);
  }
  /** About BM Player: an in-app window with the version, author and links.
   *  The links are buttons, not <a href>: a real link would navigate the
   *  player window itself. Main only lets web pages and email out. */
  async openAbout(){
    const d=el('about-dialog'); if(!d) return;
    if(!this._aboutWired){
      this._aboutWired=true;
      el('about-close')?.addEventListener('click',()=>this.closeAbout());
      d.addEventListener('mousedown',e=>{ if(e.target===d) this.closeAbout(); });
      d.querySelectorAll('.about-link[data-url]').forEach(b=>b.addEventListener('click',()=>this.api?.app?.external?.(b.dataset.url)));
      const fox=el('about-fox');
      if(fox && !fox.firstChild){ try{ fox.appendChild(buildFoxSVG()); }catch(_){} }
    }
    try{
      const v=await this.api?.app?.version?.();
      el('about-version').textContent=v?`Version ${v}`:'';
    }catch(_){}
    const ua=navigator.userAgent, ev=(ua.match(/Electron\/([\d.]+)/)||[])[1], cv=(ua.match(/Chrome\/([\d.]+)/)||[])[1];
    el('about-built').textContent=`Built with Electron${ev?' '+ev:''}${cv?' (Chromium '+cv.split('.')[0]+')':''}, mpv and pdf.js`;
    this._aboutReturnFocus=document.activeElement;
    d.classList.remove('hidden');
    el('about-close')?.focus();
  }
  closeAbout(){
    el('about-dialog')?.classList.add('hidden');
    try{ this._aboutReturnFocus?.focus?.(); }catch(_){}
  }

  _topOverlay(){
    if(this._pipActive)return{modal:false,close:()=>this.togglePiP(false)};
    const shown=id=>{const x=el(id);return !!x&&!x.classList.contains('hidden');};
    if(shown('about-dialog'))return{modal:true,close:()=>this.closeAbout()};
    const dlg=['dlg-url','dlg-jump','dlg-speed'].find(shown);
    if(dlg)return{modal:true,close:()=>el(dlg)?.classList.add('hidden')};
    if(shown('ctx-panel'))return{modal:true,close:()=>this._closeCtxPanel()};
    if(shown('theme-customizer'))return{modal:true,close:()=>el('theme-customizer')?.classList.add('hidden')};
    if(el('lightbox')?.classList.contains('open'))return{modal:true,close:()=>window.bmGallery?._closeLB()};
    const panel=document.querySelector('.side-panel.open');
    if(panel)return{modal:false,close:()=>panel.classList.remove('open')};
    if(shown('resume-prompt'))return{modal:false,close:()=>el('resume-dismiss')?.click()};
    return null;
  }

  goHome(){
    this.currentDash='video';
    document.querySelectorAll('.sidebar-btn[data-dest]').forEach(b=>b.classList.toggle('active',b.dataset.dest==='video'));
    document.querySelectorAll('.dashboard-view').forEach(v=>v.classList.remove('active'));
    el('player-view')?.classList.remove('active');
    el('welcome-screen')?.classList.add('active');
    this._syncEffects();
  }
  _resetNowPlaying(){
    const set=(id,txt)=>{const e=el(id);if(e)e.textContent=txt;};
    set('np-title','Not Playing');set('np-artist','—');set('np-format','');
    set('np-time-cur','0:00');set('np-time-tot','0:00');
    set('mv-current-title','No track selected');set('mv-current-artist','');
    const f=el('np-seek-fill');if(f)f.style.width='0%';
    el('np-art')?.classList.remove('has-track');
    el('np-bars')?.classList.remove('playing');
    const gl=el('np-glow');if(gl)gl.style.opacity='0';
    const ai=el('np-art-inner');
    if(ai){ai.style.background='';ai.innerHTML='<span class="np-art-placeholder"></span>';setIcon(ai.firstChild,'music');}
    if(window.bmMusic){window.bmMusic.currentPath=null;window.bmMusic._renderTracks?.(window.bmMusic.tracks||[]);}
  }
  playMedia(files){
    this._lastOpened=Array.isArray(files)?String(files[0]||''):'';
    if(!this.api?.mpv||!files?.length)return;
    applySubStyle(this.api);   // the chosen subtitle font and colour (v3.28.0)
    // Music playing in the in-app engine stops, instead of carrying on under the film.
    window.bmMusic?.yieldToPlayer?.();
    // ── v1.7.0: persist previous file's last position before switching ──
    if(this._currentFilePath){
      history.onClose({ path: this._currentFilePath, timePos: this.currentTime });
    }
    el('welcome-screen')?.classList.remove('active');
    document.querySelectorAll('.dashboard-view').forEach(v=>v.classList.remove('active'));
    el('player-view')?.classList.add('active');
    document.body.classList.add('playing');document.documentElement.classList.add('playing');
    this._syncEffects();   // nothing animates behind the film (v3.30.0)
    // Every other visualiser stops too (v3.30.1): the music yields to the
    // player, but the music page's visualiser went on drawing, hidden, behind
    // the film. The music page starts its own again when music plays.
    for(const v of allVisualisers()) if(v!==this.viz) v.stop?.();
    document.querySelectorAll('.sidebar-btn[data-dest]').forEach(b=>b.classList.toggle('active',b.dataset.dest==='video'));
    this.currentDash='video';
    // Reset A-B loop for the new file
    this.abRepeat?.clear();
    // Capture current file path for resume/bookmark tracking
    this._currentFilePath = files[0]?.startsWith('http') ? null : files[0];
    this.api.mpv.open(files);this.isPlaying=true;this.updatePlayIcon();this.fox?.wake();
    files.forEach(f=>!f.startsWith('http')&&this.addRecent(f));
    this.emitPlugin('playback-start',{files});
    // ── v1.7.0: resume playback prompt ──
    this._maybePromptResume(files[0]);
    // ── v1.7.0: notify history store about new playback ──
    if(this._currentFilePath){
      // isVideo is best-guess here — track-list property from mpv
      // will refine it later via onTrackList
      history.onOpened({ path: this._currentFilePath, isVideo: this._hasVideo ?? true });
    }
    // Re-render bookmark markers on the seekbar (empty for new file until duration is known)
    this._renderBookmarksOnSeekbar();
  }
  updatePlayIcon(){setTogglePair('btn-play',!this.isPlaying);}
  updateMuteIcon(m){setTogglePair('btn-mute',!m);}
  wireSeek(){
    const sc=el('seek-container');if(!sc)return;let drag=false;
    const getPct=e=>{const r=sc.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));};
    sc.addEventListener('mousedown',e=>{drag=true;this.isSeeking=true;const p=getPct(e);this.setSeekPct(p);this.seekTo(p*this.duration);});
    sc.addEventListener('mousemove',e=>{const p=getPct(e);const pt=el('seek-preview-time');if(pt)pt.textContent=fmtSec(p*this.duration);const sp=el('seek-preview');if(sp)sp.style.left=(p*sc.clientWidth)+'px';if(drag){this.setSeekPct(p);}});
    document.addEventListener('mouseup',()=>{if(drag){drag=false;this.isSeeking=false;}});
  }
  setSeekPct(p){const sf=el('seek-fill'),st=el('seek-thumb');if(sf)sf.style.width=(p*100)+'%';if(st)st.style.left=(p*100)+'%';}
  setTime(id,s){const e=el(id);if(e)e.textContent=fmtSec(s);}
  wireVolume(){
    const sl=el('volume-slider');if(!sl)return;
    sl.addEventListener('input',()=>{const v=+sl.value;this.setVolume(v);const l=el('vol-label');if(l)l.textContent=v;});
    el('btn-mute')?.addEventListener('click',()=>this.toggleMute());
  }
  bumpVolume(d){const sl=el('volume-slider');if(!sl)return;const v=Math.max(0,Math.min(130,+sl.value+d));sl.value=v;this.setVolume(v);const l=el('vol-label');if(l)l.textContent=v;this.showOSD('Volume: '+v+'%');}
  wirePanels(){document.querySelectorAll('.panel-close').forEach(b=>b.addEventListener('click',()=>el('panel-'+b.dataset.panel)?.classList.remove('open')));}
  openPanel(name){document.querySelectorAll('.side-panel').forEach(p=>p.classList.remove('open'));const p=el('panel-'+name);if(!p)return;p.classList.add('open');if(name==='info')this.populateInfo();if(name==='playlist')this.renderPlaylistPanel();if(name==='fluid')this._refreshFluidPanel();if(name==='bookmarks')this._renderBookmarksPanel();if(name==='history')this._renderHistoryPanel();if(name==='settings')this._syncSettingsPanel();}
  // ── Fluid Settings panel ────────────────────────────────────────
  // Sliders use a 40–180 "percent" range for speed/glow/trail (mapped to
  // 0.4x–1.8x multipliers) so the UI reads as intuitive percentages rather
  // than the raw small-decimal multipliers perf.js stores internally.
  _wireFluidPanel(){
    document.querySelectorAll('#fluid-presets .eq-preset-btn').forEach(btn=>{
      btn.addEventListener('click',()=>perf.setTier(btn.dataset.tier));
    });
    el('fluid-density')?.addEventListener('input',e=>{perf.setCustom('density',+e.target.value);this._syncFluidLabels();});
    el('fluid-speed')?.addEventListener('input',e=>{perf.setCustom('speedScale',+e.target.value/100);this._syncFluidLabels();});
    el('fluid-glow')?.addEventListener('input',e=>{perf.setCustom('glow',+e.target.value/100);this._syncFluidLabels();});
    el('fluid-trail')?.addEventListener('input',e=>{perf.setCustom('trail',+e.target.value/100);this._syncFluidLabels();});
    el('fluid-reset')?.addEventListener('click',()=>{perf.resetCustom();this._refreshFluidPanel();});
    perf.onChange(()=>{ if(el('panel-fluid')?.classList.contains('open')) this._refreshFluidPanel(); });
    // The fluid follows the tier at once (v3.36.0): it took the new quality only
    // at the next theme change, so the Low, Medium and High buttons seemed dead.
    // Only when the tier is another one, or is now the user's own choice: the
    // four sliders above report through the same door, and setting the quality
    // rebuilds the fluid from nothing, which emptied it at every step of a drag.
    let fluidTier=perf.tier, fluidChosen=perf.chosen;
    perf.onChange(()=>{
      if(perf.tier===fluidTier&&perf.chosen===fluidChosen)return;
      fluidTier=perf.tier; fluidChosen=perf.chosen;
      try{ this.auroraFX?.setQuality?.(perf.tier); }catch(_){}
    });
  }
  _refreshFluidPanel(){
    const p=perf.getParams();
    document.querySelectorAll('#fluid-presets .eq-preset-btn').forEach(b=>b.classList.toggle('active',b.dataset.tier===perf.tier));
    const density=el('fluid-density'); if(density) density.value=p.density;
    const speed=el('fluid-speed');     if(speed)   speed.value=Math.round(p.speedScale*100);
    const glow=el('fluid-glow');       if(glow)    glow.value=Math.round(p.glow*100);
    const trail=el('fluid-trail');     if(trail)   trail.value=Math.round(p.trail*100);
    this._syncFluidLabels();
  }
  _syncFluidLabels(){
    const density=el('fluid-density'), speed=el('fluid-speed'), glow=el('fluid-glow'), trail=el('fluid-trail');
    const dv=el('fluid-density-val'), sv=el('fluid-speed-val'), gv=el('fluid-glow-val'), tv=el('fluid-trail-val');
    if(dv&&density) dv.textContent=density.value;
    if(sv&&speed)   sv.textContent=speed.value+'%';
    if(gv&&glow)    gv.textContent=glow.value+'%';
    if(tv&&trail)   tv.textContent=trail.value+'%';
  }
  populateInfo(){
    const body=el('info-body');if(!body)return;
    this.api?.mpv.cmd('get_property','media-title').catch(()=>null).then(title=>{
      const rows=[['Title',title||'—'],['Container',this._mProps['container-format']||'—'],['Video Codec',this._mProps['video-codec']||'—'],['Audio Codec',this._mProps['audio-codec']||'—'],['Size',this._mProps['file-size']?(this._mProps['file-size']/1048576).toFixed(1)+' MB':'—'],['Duration',fmtSec(this._mProps['duration'])],['Resolution',this._mProps['video-params']?(this._mProps['video-params'].w+'x'+this._mProps['video-params'].h):'—'],['FPS',this._mProps['video-params']?.fps?.toFixed(3)||'—'],['Audio',this._mProps['audio-params']?(this._mProps['audio-params'].samplerate+'Hz'):'—']];
      body.innerHTML='<div class="info-sec-title">Media Information</div>'+rows.map(([k,v])=>'<div class="info-row"><span>'+k+'</span><span>'+v+'</span></div>').join('');
    });
  }
  wireEQ(){
    const bands=el('eq-bands');if(!bands)return;
    bands.innerHTML=EQ_BANDS.map((b,i)=>'<div class="eq-band"><span class="eq-band-val" id="eq-val-'+i+'">0</span><input type="range" min="-12" max="12" value="0" step="0.5" id="eq-s-'+i+'"><span class="eq-band-label">'+b.label+'</span></div>').join('');
    EQ_BANDS.forEach((_,i)=>{el('eq-s-'+i)?.addEventListener('input',e=>{this.eqValues[i]=+e.target.value;const v=el('eq-val-'+i);if(v)v.textContent=(+e.target.value>0?'+':'')+e.target.value;this._applyEQ();});});
    document.querySelectorAll('.eq-preset-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.eq-preset-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const vals=EQ_PRESETS[btn.dataset.p]||EQ_PRESETS.flat;this.eqValues=[...vals];EQ_BANDS.forEach((_,i)=>{const s=el('eq-s-'+i),v=el('eq-val-'+i);if(s)s.value=vals[i];if(v)v.textContent=(vals[i]>0?'+':'')+vals[i];});this._applyEQ();});});
    el('btn-reset-eq')?.addEventListener('click',()=>document.querySelector('.eq-preset-btn[data-p="flat"]')?.click());
  }
  _applyEQ(){
    // Two backends, one set of sliders. The engine owns audio-only playback,
    // so its BiquadFilter chain has to track the same values mpv's `af`
    // string does — otherwise moving a slider does nothing for music.
    window.bmMusic?.engine?.setEQ?.(this.eqValues);
    const af=this.eqValues.map((v,i)=>'equalizer=f='+EQ_BANDS[i].freq+':width_type=o:width=2:g='+v).join(',');this.api?.mpv.cmd('set_property','af',this.eqValues.every(v=>v===0)?'':`lavfi=[${af}]`).catch(()=>{});}
  wirePlaylistPanel(){
    el('pl-add')?.addEventListener('click',()=>this.openDialog(true));
    el('pl-clear')?.addEventListener('click',()=>{this.api?.mpv.cmd('playlist-clear');this.renderPlaylistPanel();});
  }
  renderPlaylistPanel(){this.api?.mpv.getPlaylist?.().then(pl=>{const list=el('pl-list');if(!list)return;if(!pl?.length){list.innerHTML='<div style="color:var(--text-muted);font-size:12px;padding:10px">Playlist empty</div>';return;}list.innerHTML=pl.map((item,i)=>{const name=(item.title||item.filename||'').split(/[\\/]/).pop();return'<div class="pl-item'+(item.current?' playing':'')+'" data-idx="'+i+'"><span class="pl-item-idx">'+(i+1)+'</span><span class="pl-item-name">'+name+'</span><span class="pl-item-rm" data-rm="'+i+'">x</span></div>';}).join('');list.querySelectorAll('.pl-item').forEach(item=>item.addEventListener('click',()=>this.api?.mpv.cmd('set_property','playlist-pos',+item.dataset.idx)));list.querySelectorAll('.pl-item-rm').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();this.api?.mpv.cmd('playlist-remove',+btn.dataset.rm);setTimeout(()=>this.renderPlaylistPanel(),100);}));});}
  wireCtxPanel(){
    document.querySelectorAll('.ctx-tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.ctx-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.ctx-body').forEach(x=>x.classList.remove('active'));t.classList.add('active');el('ctx-tab-'+t.dataset.tab)?.classList.add('active');}));
    document.addEventListener('mousedown',e=>{const p=el('ctx-panel');if(p&&!p.contains(e.target)&&!p.classList.contains('hidden'))this._closeCtxPanel();});
    el('ctx-vol')?.addEventListener('input',e=>{const v=+e.target.value;this.setVolume(v);const s=el('volume-slider');if(s)s.value=v;const l=el('vol-label');if(l)l.textContent=v;const cl=el('ctx-vol-val');if(cl)cl.textContent=v+'%';});
    el('ctx-mute')?.addEventListener('change',()=>this.toggleMute());
    el('ctx-sub-size')?.addEventListener('input',e=>{this.api?.mpv.cmd('set_property','sub-font-size',+e.target.value);const v=el('ctx-sub-size-val');if(v)v.textContent=e.target.value;});
    el('ctx-sub-pos')?.addEventListener('input',e=>{this.api?.mpv.cmd('set_property','sub-pos',+e.target.value);const v=el('ctx-sub-pos-val');if(v)v.textContent=e.target.value;});
    document.querySelectorAll('.ctx-chip[data-cmd]').forEach(chip=>chip.addEventListener('click',()=>{chip.closest('.ctx-chip-row')?.querySelectorAll('.ctx-chip').forEach(c=>c.classList.remove('active'));chip.classList.add('active');const{cmd,v}=chip.dataset;if(cmd==='aspect')this.api?.mpv.cmd('set_property','video-aspect-override',v==='-1'?'-1':v);if(cmd==='hwdec')this.api?.mpv.cmd('set_property','hwdec',v);}));
    el('ctx-deinterlace')?.addEventListener('change',()=>this.api?.mpv.cmd('cycle','deinterlace'));
    el('ctx-screenshot')?.addEventListener('click',()=>{this.api?.mpv.cmd('screenshot','subtitles');this.showOSD('Screenshot saved');this._closeCtxPanel();});
    // mpv runs with --keep-open=yes, so the end of a file does NOT send
    // end-file. It sets eof-reached and pauses on the last frame. Verified
    // against real mpv 0.37 (scripts/integration-mpv.cjs). Advance on that.
    this.api?.mpv.onProp?.(p=>{
      if(p?.name!=='eof-reached') return;
      if(p.data!==true){ this._eofHandled=false; return; }
      if(this._eofHandled) return;           // one advance per end of file
      this._eofHandled=true;
      const m=window.bmMusic;
      // Only for audio mpv is playing. The in-app engine has its own 'ended'.
      if(m?.currentPath && !this._hasVideo && !m.engineOwns?.()) m.advance();
    });
    // Kept for keep-open=no, should that ever change.
    this.api?.mpv.onEvent?.(ev=>{
      if(ev?.event!=='end-file') return;
      // A file mpv could not play. This was ignored, so a broken file, a
      // missing codec or a video output that would not start left you looking
      // at an empty player with no explanation.
      if(ev.reason==='error'){
        const what=(this._lastOpened||'').split(/[\\/]/).pop()||'this file';
        this.showOSD(`Couldn't play ${what}${ev.file_error?': '+ev.file_error:''}`,4000);
        // The TV tab reports stream failures itself and retries, so leave it be.
        if(this.currentDash!=='tv') this.stop();
        return;
      }
      // 'eof' is a natural finish; 'stop'/'quit' mean the user did it.
      if(ev.reason && ev.reason!=='eof') return;
      const m=window.bmMusic;
      if(m?.currentPath && !this._hasVideo) m.advance();
    });
    this.api?.mpv.onProp(p=>{if(p.name==='volume'){const e=el('ctx-vol');if(e){e.value=p.data;const l=el('ctx-vol-val');if(l)l.textContent=Math.round(p.data)+'%';}}if(p.name==='mute'){const e=el('ctx-mute');if(e)e.checked=!!p.data;}});
    this.api?.mpv.onTrackList?.(tl=>{this._lastTracks=tl;});
  }
  _openCtxPanel(x,y){
    const p=el('ctx-panel');if(!p)return;
    // Hide sections that can't do anything right now. A Subtitles section on
    // the welcome screen is just noise.
    const playing=!!this.isPlaying, vid=playing&&this._hasVideo;
    const show=(id,on)=>el(id)?.classList.toggle('hidden',!on);
    show('ctx-sec-playback',playing);
    show('ctx-sec-audio-tracks',playing);
    show('ctx-sec-sub-tracks',vid);
    show('ctx-sec-video',vid);
    show('ctx-sec-extra',playing);
    el('ctx-ontop')?.classList.toggle('on',!!this.alwaysOnTop);

    p.classList.remove('hidden');
    p.style.left='-9999px';p.style.top='-9999px';
    this._populateCtxTracks();
    this._syncCtxDelays();
    // Measure AFTER populating — the panel's height depends on how many
    // tracks the file has, and measuring first put it off-screen on tall menus.
    const W=p.offsetWidth||320,H=p.offsetHeight||440;
    p.style.left=Math.max(8,Math.min(x,window.innerWidth-W-8))+'px';
    p.style.top =Math.max(8,Math.min(y,window.innerHeight-H-8))+'px';
    this._refreshCtxTracks();
  }
  _syncCtxDelays(){
    const s=el('ctx-sdelay-val'),a_=el('ctx-adelay-val');
    if(s)s.textContent=(this._ctxSubDelay||0).toFixed(2)+'s';
    if(a_)a_.textContent=(this._ctxAudioDelay||0).toFixed(2)+'s';
  }
  // Every .ctx-item / .ctx-mini-btn carries a data-a action. Nothing read it,
  // so even once the panel opened every row was inert.
  wireCtxMenu(){
    const panel=el('ctx-panel');if(!panel)return;
    const bump=(kind,d)=>{
      if(kind==='sub'){ this._ctxSubDelay=(this._ctxSubDelay||0)+d; this.api?.adj.subDelay(d); }
      else            { this._ctxAudioDelay=(this._ctxAudioDelay||0)+d; this.api?.adj.audioDelay(d); }
      this._syncCtxDelays();
    };
    const actions={
      'open':        ()=>this.openDialog(),
      'open-url':    ()=>el('dlg-url')?.classList.remove('hidden'),
      'quit':        ()=>this.api?.win.close(),
      'toggle-play': ()=>this.togglePlay(),
      'stop':        ()=>this.stop(),
      'prev':        ()=>this.trackStep(-1),
      'next':        ()=>this.trackStep(1),
      'fullscreen':  ()=>this.api?.win.fullscreen(),
      'theatre':     ()=>this.api?.win.theatre(),
      'pip':         ()=>this.togglePiP(),
      'always-top':  ()=>this.toggleAlwaysOnTop(),
      'open-eq':     ()=>this.openPanel('eq'),
      'diagnostics': ()=>this.openDiagnostics(),
      'open-info':   ()=>this.openPanel('info'),
      'screenshot':  ()=>{this.api?.mpv.cmd('screenshot');this.showOSD('Screenshot saved');},
      // These three rows shipped in the markup with no handler behind them.
      'aspect-auto': ()=>{this.api?.mpv.cmd('set_property','video-aspect-override','-1');this.showOSD('Aspect: Auto');},
      'aspect-16:9': ()=>{this.api?.mpv.cmd('set_property','video-aspect-override','16:9');this.showOSD('Aspect: 16:9');},
      'aspect-4:3':  ()=>{this.api?.mpv.cmd('set_property','video-aspect-override','4:3');this.showOSD('Aspect: 4:3');},
      'aspect-21:9': ()=>{this.api?.mpv.cmd('set_property','video-aspect-override','21:9');this.showOSD('Aspect: 21:9');},
      'frame-fwd':   ()=>this.api?.mpv.cmd('frame-step'),
      'frame-back':  ()=>this.api?.mpv.cmd('frame-back-step'),
      'sdelay-down': ()=>bump('sub',-0.1),
      'sdelay-up':   ()=>bump('sub', 0.1),
      'sdelay-reset':()=>{this._ctxSubDelay=0;this.api?.adj.resetSub();this._syncCtxDelays();},
      'adelay-down': ()=>bump('audio',-0.05),
      'adelay-up':   ()=>bump('audio', 0.05),
      'adelay-reset':()=>{this._ctxAudioDelay=0;this.api?.adj.resetAudio();this._syncCtxDelays();},
      // Reuses the existing dialog:openSub handler rather than adding a
      // second one that does the same job.
      'load-sub':    async()=>{
        try{
          const f=await this.api?.dialog?.openSub();
          if(f){
            await this.api?.mpv.cmd('sub-add',f,'select');
            this.showOSD('Subtitle loaded: '+f.split(/[\\/]/).pop());
            setTimeout(()=>this._refreshCtxTracks(),150);
          }
        }catch(e){ this.showOSD('Could not load subtitle'); console.error(e); }
      },
    };
    panel.addEventListener('click',e=>{
      const t=e.target.closest('[data-a]');if(!t)return;
      const fn=actions[t.dataset.a];if(!fn)return;
      e.stopPropagation();
      fn();
      // Delay steppers stay open so you can nudge repeatedly; everything
      // else is a one-shot command.
      if(!/^(sdelay|adelay)-/.test(t.dataset.a)) this._closeCtxPanel();
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!panel.classList.contains('hidden')) this._closeCtxPanel();
    });
  }
  _closeCtxPanel(){el('ctx-panel')?.classList.add('hidden');}
  // The exact visualiser for a song mpv plays (v3.29.0): a silent copy of
  // the file, kept in step with mpv and measured (audio-shadow.js). The
  // visualisers that exist are given its analyser, and one made later finds
  // it shared. Stopping takes it back only where it is still the shadow's.
  _startShadow(){
    const a=this.shadow?.load(this._currentFilePath,this.currentTime||0,!!this._lastPause);
    if(!a)return;
    this._shadowOn=true;setSharedAnalyser(a);
    for(const v of [this.viz,this.musicViz]) if(v) v.analyser=a;
  }
  _stopShadow(){
    if(!this._shadowOn)return;
    const a=this.shadow.analyser;this._shadowOn=false;this.shadow.stop();setSharedAnalyser(null);
    for(const v of [this.viz,this.musicViz]) if(v&&v.analyser===a) v.analyser=null;
  }
  // v3.30.0: one place decides whether the decorative loops run (the theme's
  // background, the Flow fluid and the fox): only while the home screen shows,
  // nothing plays, and the window is not minimised or hidden. A video played
  // with them still animating behind it (nothing paused them when it started,
  // and a theme change restarted them), and a minimised window kept them going:
  // measured at 50 to 90 frames a second, drawn for nobody. It waits a moment
  // so the page has finished switching views.
  _syncEffects(){
    clearTimeout(this._fxT);
    this._fxT=setTimeout(()=>{
      const home=!!el('welcome-screen')?.classList.contains('active')&&!document.body.classList.contains('playing');
      const on=home&&!document.hidden&&!this._winHidden;
      for(const fx of [this.fox,this.themeFX,this.auroraFX]){ try{ if(on)fx?.resume?.();else fx?.pause?.(); }catch(_){} }
      // The visualisers too (v3.33.0), when the window is minimised or hidden;
      // only the ones that were running start again.
      const away=document.hidden||!!this._winHidden;
      for(const v of allVisualisers()){
        if(away&&v.active){ v._awayPaused=true; v.stop(); }
        else if(!away&&v._awayPaused){ v._awayPaused=false; v.start(); }
      }
      this._fxOn=on;
    },0);
  }
  // The keyboard shortcuts list (v3.30.0). While it is open it takes Esc and
  // ? first (capture phase, e.__bmHandled), so closing it never also stops
  // the film, the trap wireOverlayKeys guards the other overlays against.
  toggleShortcuts(force){
    const o=el('kb-overlay');if(!o)return;
    const open=force===undefined?o.classList.contains('hidden'):!!force;
    o.classList.toggle('hidden',!open);
    if(open&&!this._kbWired){
      this._kbWired=true;
      o.addEventListener('mousedown',e=>{if(e.target===o)this.toggleShortcuts(false);});
      document.addEventListener('keydown',e=>{
        if(o.classList.contains('hidden'))return;
        if(e.key==='Escape'||e.key==='?'||e.code==='F1'){e.preventDefault();e.stopPropagation();e.__bmHandled=true;this.toggleShortcuts(false);}
      },true);
    }
  }
  // Something is playing that the controls should fade over (v3.30.1): mpv, or
  // the in-app engine while the visual mode shows. A song from the library, in
  // the visual mode, kept every bar on screen.
  _anyPlaying(){
    if(this.isPlaying)return true;
    const e=window.bmMusic?.engine?.el;
    return !!(this._audioVizMode&&e&&!e.paused);
  }
  // The album art in the visual mode (v3.32.0): inside Radial's ring and in the
  // tile by the title. A library song brings its cover; otherwise the main
  // process looks (the file's own art, or a cover image beside it).
  _vizArtFor(fp,cover){
    const show=p=>{
      const url=p?fileURL(p):null;
      setSharedArt(url);   // every visualiser follows it, even one made later
      const t=el('viz-art'); if(!t)return;
      t.classList.toggle('has-art',!!url); t.style.background=url?`center/cover no-repeat url("${url}")`:'';
    };
    if(cover){show(cover);return;}
    show(null);
    if(fp)this.api?.music?.art?.(fp)?.then?.(p=>{ if(fp===this._currentFilePath||window.bmMusic?.engineOwns?.()) show(p); }).catch?.(()=>{});
  }
  // Pro or Lite (v3.33.0): the switch by the window buttons, and Tools,
  // Visual effects (automatic, Pro, Lite). Lite changes how the app starts
  // (the flat fox, no fluid), so with nothing playing it reloads, and says so
  // after; during playback the look changes now and the rest at the next start.
  async _switchFx(target){
    const { liteMode } = await import('./modules/lite-mode.js');
    const playing=this.isPlaying||!!(window.bmMusic?.engine?.el&&!window.bmMusic.engine.el.paused);
    this._fxQuiet=true;
    const lite=liteMode.setUserOverride(target==='auto'?null:target==='lite');
    this._fxQuiet=false;
    const name=lite?'Lite':'Pro';
    if(!playing){ try{sessionStorage.setItem('bm_fx_note',name);}catch(_){} location.reload(); return; }
    this._markFx(); this._fxNote(`Switched to ${name} mode, fully from the next start`);
  }
  _fxNote(text){
    this._fxNoteEl?.remove();
    const t=document.createElement('div'); t.className='fx-note'; t.setAttribute('role','status'); t.textContent=text;
    document.body.appendChild(t); this._fxNoteEl=t;
    requestAnimationFrame(()=>t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),400); },2600);
  }
  _markFx(){
    const lite=document.documentElement.classList.contains('lite-mode'), build=document.documentElement.classList.contains('lite-build');
    const b=el('fx-toggle');
    if(b){
      b.textContent=lite?'Lite':'Pro'; b.classList.toggle('lite',lite); b.disabled=build;
      b.title=build?'BM Player Lite always runs in Lite mode':`${lite?'Lite':'Pro'} mode. Press to switch to ${lite?'Pro':'Lite'}`;
      b.setAttribute('aria-label',`Visual effects: ${lite?'Lite':'Pro'}. Press to switch`);
    }
    let u=null; try{u=localStorage.getItem('bm_lite_user');}catch(_){}
    const cur=u==='1'?'lite':u==='0'?'pro':'auto';
    document.querySelectorAll('.mr[data-a^="fx-"]').forEach(r=>r.classList.toggle('checked',r.dataset.a==='fx-'+cur));
  }
  // The pin button and the right-click menu's "Always on top" (v3.27.0).
  toggleAlwaysOnTop(){
    this.alwaysOnTop=!this.alwaysOnTop;
    this.api?.win.alwaysTop(this.alwaysOnTop);
    el('mi-always-top')?.classList.toggle('active-opt',this.alwaysOnTop);
    this.showOSD(this.alwaysOnTop?'Always on top: ON':'Always on top: OFF');
  }
  // Active re-fetch on top of the passive observer stream — mirrors what
  // the old native right-click menu used to do (explicit get_property
  // before building the menu) rather than trusting only the cached
  // _lastTracks, which can go stale if an auto-loaded subtitle track's
  // property-change event has any timing quirk relative to when the user
  // actually opens the panel.
  async _refreshCtxTracks(){
    try{
      const fresh=await this.api?.mpv.cmd('get_property','track-list');
      if(Array.isArray(fresh)){this._lastTracks=fresh;this._populateCtxTracks();}
    }catch(_){}
  }
  _populateCtxTracks(){
    const tracks=this._lastTracks||[];
    const fill=(id,type,prop)=>{const el_=el(id);if(!el_)return;const list=tracks.filter(t=>t.type===type);el_.innerHTML='';if(type==='sub'){const off=document.createElement('div');off.className='ctx-track-item'+(!list.some(t=>t.selected)?' active':'');off.textContent='Off';off.addEventListener('click',()=>{this.api?.mpv.cmd('set_property','sub-visibility',false);el_.querySelectorAll('.ctx-track-item').forEach(r=>r.classList.remove('active'));off.classList.add('active');});el_.appendChild(off);}if(!list.length&&type!=='sub'){el_.innerHTML='<div class="ctx-track-item" style="opacity:.4">None</div>';return;}list.forEach(t=>{const row=document.createElement('div');row.className='ctx-track-item'+(t.selected?' active':'');row.textContent=[t.lang?'['+t.lang.toUpperCase()+']':'',t.title||'Track '+t.id,t.codec?'· '+t.codec:'',t['demux-channel-count']?'· '+t['demux-channel-count']+'ch':'',t.default?'· default':''].filter(Boolean).join(' ');row.title=row.textContent;row.addEventListener('click',()=>{if(type==='sub')this.api?.mpv.cmd('set_property','sub-visibility',true);this.api?.mpv.cmd('set_property',prop,t.id);el_.querySelectorAll('.ctx-track-item').forEach(r=>r.classList.remove('active'));row.classList.add('active');});el_.appendChild(row);});};
    fill('ctx-audio-tracks','audio','aid');fill('ctx-video-tracks','video','vid');fill('ctx-sub-tracks','sub','sid');
  }
  wireDialogs(){
    el('jump-go')?.addEventListener('click',()=>this._doJump());
    el('jump-cancel')?.addEventListener('click',()=>el('dlg-jump')?.classList.add('hidden'));
    el('jump-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')this._doJump();if(e.key==='Escape')el('dlg-jump')?.classList.add('hidden');});
    el('url-go')?.addEventListener('click',()=>{const u=el('url-input')?.value?.trim();if(u)this.playMedia([u]);el('dlg-url')?.classList.add('hidden');});
    el('url-cancel')?.addEventListener('click',()=>el('dlg-url')?.classList.add('hidden'));
    el('url-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')el('url-go')?.click();if(e.key==='Escape')el('dlg-url')?.classList.add('hidden');});
  }
  _doJump(){const raw=el('jump-input')?.value?.trim();if(!raw)return;const parts=raw.split(':').map(Number);const secs=parts.length===3?parts[0]*3600+parts[1]*60+parts[2]:parts.length===2?parts[0]*60+parts[1]:parts[0];if(!isNaN(secs))this.seekTo(secs);el('dlg-jump')?.classList.add('hidden');if(el('jump-input'))el('jump-input').value='';}
  wireKeyboard(){
    document.addEventListener('keydown',e=>{
      // An open overlay claimed this key in the capture phase (see
      // wireOverlayKeys). Without this, Escape to dismiss a menu also
      // stopped playback, and arrow keys in the lightbox seeked the music.
      if(e.__bmHandled)return;
      if(e.target.matches?.('input,textarea'))return;
      const cmd=(c,...a)=>{e.preventDefault();this.api?.mpv.cmd(c,...a);};
      if(e.key==='?'||e.code==='F1'){e.preventDefault();this.toggleShortcuts();}   // v3.30.0
    else if(e.code==='Space'){e.preventDefault();this.togglePlay();}
      else if(e.code==='KeyS'){e.preventDefault();this.stop();}
      else if(e.code==='KeyF'||e.code==='F11'){e.preventDefault();this.api?.win.fullscreen();}
      else if(e.code==='KeyT'&&!e.ctrlKey){e.preventDefault();this.api?.win.theatre();}
      else if(e.code==='KeyM'){e.preventDefault();this.toggleMute();}
      else if(e.code==='ArrowLeft'){e.preventDefault();this.seekBy(-(e.shiftKey?(settings.get('behaviour.seekLargeSec') ?? 30):(settings.get('behaviour.seekSmallSec') ?? 5)));}
      else if(e.code==='ArrowRight'){e.preventDefault();this.seekBy(e.shiftKey?(settings.get('behaviour.seekLargeSec') ?? 30):(settings.get('behaviour.seekSmallSec') ?? 5));}
      else if(e.code==='ArrowUp'){e.preventDefault();this.bumpVolume(settings.get('behaviour.volumeStep') ?? 5);}
      else if(e.code==='ArrowDown'){e.preventDefault();this.bumpVolume(-(settings.get('behaviour.volumeStep') ?? 5));}
      else if(e.code==='BracketLeft'){e.preventDefault();this.speedMenu?.cyclePrev();}
      else if(e.code==='BracketRight'){e.preventDefault();this.speedMenu?.cycleNext();}
      else if(e.code==='Backspace'){e.preventDefault();this.speedMenu?.set(1);}
      else if(e.code==='KeyZ'){this.api?.adj.subDelay(-0.5);this.showOSD('Sub delay: '+(this._ctxSubDelay-=0.5).toFixed(1)+'s');}
      else if(e.code==='KeyX'){this.api?.adj.subDelay(0.5);this.showOSD('Sub delay: '+(this._ctxSubDelay+=0.5).toFixed(1)+'s');}
      else if(e.code==='KeyK'&&e.shiftKey){this.api?.adj.audioDelay(0.5);}
      else if(e.code==='KeyJ'&&e.shiftKey){this.api?.adj.audioDelay(-0.5);}
      else if(e.code==='KeyA'){cmd('cycle','audio');}
      else if(e.code==='KeyV'){cmd('cycle','sub');}
      else if(e.code==='KeyP'){e.preventDefault();this.trackStep(-1);}
      else if(e.code==='KeyN'){e.preventDefault();this.trackStep(1);}
      // ── v1.7.0: A-B repeat (B / Shift+B / C / G) ──
      // Ctrl+B / Alt+B for bookmarks handled BEFORE the plain KeyB branch
      // so the modifier-aware cases win.
      else if(e.code==='KeyB'&&e.ctrlKey){e.preventDefault();this.addBookmarkAtCurrent();}
      else if(e.code==='KeyB'&&e.altKey){e.preventDefault();this.addBookmarkAtCurrent({quick:true});}
      else if(e.code==='KeyB'&&e.shiftKey){e.preventDefault();this.abRepeat?.setB();}
      else if(e.code==='KeyB'&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){e.preventDefault();this.abRepeat?.setA();}
      else if(e.code==='KeyC'&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){e.preventDefault();this.abRepeat?.clear();}
      else if(e.code==='KeyG'&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){e.preventDefault();this.abRepeat?.togglePause();}
      // ── v1.7.0: Frame stepping (, / .) ──
      else if(e.code==='Comma'){e.preventDefault();cmd('frame-back-step');this.showOSD('◂ Frame',700);}
      else if(e.code==='Period'){e.preventDefault();cmd('frame-step');this.showOSD('Frame ▸',700);}
      else if(e.code==='Escape'){this.api?.win.isFs().then(fs=>{if(fs)this.api?.win.fullscreen();else this.stop();});}
      else if(e.code==='KeyO'&&e.ctrlKey){e.preventDefault();this.openDialog();}
      else if(e.code==='KeyI'&&e.ctrlKey){e.preventDefault();this.openPanel('info');}
      else if(e.code==='KeyL'&&e.ctrlKey){e.preventDefault();this.openPanel('playlist');}
      else if(e.code==='KeyH'&&e.ctrlKey){e.preventDefault();this.openPanel('history');this._renderHistoryPanel();}
      else if(e.code==='KeyT'&&e.ctrlKey){e.preventDefault();this.api?.mpv.cmd('screenshot','subtitles');this.showOSD('Screenshot saved');}
      else if(e.code==='KeyJ'&&e.ctrlKey){e.preventDefault();el('dlg-jump')?.classList.remove('hidden');el('jump-input')?.focus();}
      else if(e.code==='KeyQ'&&e.ctrlKey){e.preventDefault();this.api?.win.close();}
      else if(e.key>='1'&&e.key<='9'&&!e.ctrlKey&&!e.altKey){const p=+e.key/10;this.seekTo(p*this.duration);}
    });
  }
  wireDragDrop(){const ov=el('drop-overlay');document.addEventListener('dragover',e=>{e.preventDefault();ov?.classList.add('active');});document.addEventListener('dragleave',e=>{if(!e.relatedTarget)ov?.classList.remove('active');});document.addEventListener('drop',e=>{e.preventDefault();ov?.classList.remove('active');const files=[...(e.dataTransfer?.files||[])].map(f=>f.path).filter(Boolean);if(files.length)this.playMedia(files);});}
  wireControlsHide(){
    const bar=el('controls-bar'),tb=el('titlebar'),mt=el('menu-toolbar');
    const show=()=>{bar?.classList.remove('faded');tb?.classList.remove('faded-top');mt?.classList.remove('faded-top');clearTimeout(this.hideTimer);if(this._anyPlaying())this.hideTimer=setTimeout(()=>{if(this._anyPlaying()&&!bar?.matches(':hover')){bar?.classList.add('faded');tb?.classList.add('faded-top');mt?.classList.add('faded-top');}},3000);};
    document.addEventListener('mousemove',show);
    bar?.addEventListener('mouseenter',()=>{clearTimeout(this.hideTimer);bar.classList.remove('faded');});
    bar?.addEventListener('mouseleave',()=>{if(this._anyPlaying())this.hideTimer=setTimeout(()=>bar?.classList.add('faded'),2500);});
  }
  wireUpdate(){
    el('update-dismiss')?.addEventListener('click',()=>el('update-banner')?.classList.add('hidden'));
    el('update-install-btn')?.addEventListener('click',()=>this.api?.app.installUpdate());
    this.api?.app.onUpdater?.(s=>{const banner=el('update-banner'),msg=el('update-msg'),pw=el('update-progress-wrap'),pb=el('update-progress-bar'),ib=el('update-install-btn');if(!banner)return;if(s.state==='available'){banner.classList.remove('hidden');if(msg)msg.textContent='v'+s.ver+' available';if(ib)ib.style.display='none';if(pw)pw.classList.remove('hidden');}if(s.state==='progress'){if(pb)pb.style.width=s.pct+'%';if(msg)msg.textContent='Downloading... '+s.pct+'%';}if(s.state==='ready'){if(msg)msg.textContent='v'+s.ver+' ready to install';if(pw)pw.classList.add('hidden');if(ib)ib.style.display='';}if(s.state==='error')banner.classList.add('hidden');});
  }
  async wireDefaultPrompt(){
    this.api?.app.onFirstRun?.(async()=>{if(localStorage.getItem('bm_default_asked'))return;const isD=await this.api?.app.isDefault?.().catch(()=>false);if(isD){localStorage.setItem('bm_default_asked','1');return;}el('default-player-prompt')?.classList.remove('hidden');});
    el('btn-set-default')?.addEventListener('click',async()=>{el('default-player-prompt')?.classList.add('hidden');localStorage.setItem('bm_default_asked','1');await this.api?.app.setDefault?.();this.showOSD('BM Player set as default media player',3000);});
    el('btn-skip-default')?.addEventListener('click',()=>{el('default-player-prompt')?.classList.add('hidden');localStorage.setItem('bm_default_asked','1');});
  }
  listenMpv(){
    this.api?.mpv.onStatus?.(s=>{
      const st=el('tb-status');
      if(s.state==='missing'){this.showOSD('mpv not found - install mpv first',5000);if(st)st.textContent='mpv missing';}
      if(s.state==='crashed'){if(st)st.textContent='mpv crashed - restarting...';}
      if(s.state==='retrying-minimal'){if(st)st.textContent='mpv retrying with reduced options...';}
      if(s.state==='crash-loop'){this.showOSD('mpv failed to start - check that mpv is installed correctly',6000);if(st)st.textContent='mpv failed to start';}
      // ── v1.7.0: apply persisted subtitle settings once mpv is ready ──
      if(s.state==='ready'){ settings.applyToMpv(this.api?.mpv); this._mpvReadyHook?.(); }
    });
    this.api?.mpv.onProp?.(p=>{
      // Idle mpv (nothing loaded) reports pause=false as soon as it connects.
      // That used to read as "playing", so on every launch the mini bar
      // appeared saying "Not Playing" with a pause icon. Found by launching
      // the real app with real mpv. mpv is also idle while the in-app audio
      // engine plays, so neither of these may overrule the engine.
      if(p.name==='idle-active'){ this._mpvIdle=!!p.data;
        this._mpvIdle=p.data!==false;
        if(this._mpvIdle)this._stopShadow();   // the song ended or was replaced
        if(window.bmMusic?.engineOwns?.()) return;
        if(this._mpvIdle){ this.isPlaying=false; this.updatePlayIcon?.(); this._updateMiniPlayer?.(); }
        else { this.isPlaying=!this._lastPause; this.updatePlayIcon?.(); }
        return;
      }
      if(p.name==='pause'){
        this._lastPause=!!p.data;
        if(this._shadowOn)this.shadow.follow({paused:!!p.data});
        if(window.bmMusic?.engineOwns?.()) return;
        this.isPlaying=!p.data && this._mpvIdle===false;this.updatePlayIcon();
        el('np-bars')?.classList.toggle('playing',this.isPlaying);
        // Sync mini player play button
        const on=!p.data&&!!this.isPlaying;   // pause only while something is loaded and running
        const mmpPlay=el('mmp-play');if(mmpPlay)setPlaying(mmpPlay,on);setPlaying(el('pip-play'),on);
        this.isPaused=!!p.data;
        const vp=el('viz-btn-play');if(vp)setPlaying(vp,on);
        // Sync np transport play button
        const npPlay=el('np-btn-play');if(npPlay)setPlaying(npPlay,on);
        // Start/stop music visualizer
        if(this.currentDash==='music'){p.data?this.musicViz?.stop():this.musicViz?.start();}
        this.emitPlugin('pause-change',{paused:p.data});
      }
      if(p.name==='time-pos'){
        this.currentTime=p.data||0;
        if(this._shadowOn)this.shadow.follow({time:this.currentTime});
        // ── v1.7.0: feed A-B repeat & history ──
        this.abRepeat?.onTimePos(this.currentTime);
        history.onTimeUpdate({ timePos: this.currentTime, duration: this.duration });
        if(!this.isSeeking){this.setTime('time-current',this.currentTime);if(this.duration>0){this.setSeekPct(this.currentTime/this.duration);const fill=el('np-seek-fill');if(fill)fill.style.width=(this.currentTime/this.duration*100)+'%';const cur=el('np-time-cur');if(cur)cur.textContent=fmtSec(this.currentTime);// Mini player seek
        // ── v1.8.0: update mini player progress bar ──
        const mmpFill=el('mmp-progress-fill');if(mmpFill)mmpFill.style.width=(this.currentTime/this.duration*100)+'%';}}
        this.emitPlugin('time-update',{time:this.currentTime,duration:this.duration});}
      if(p.name==='duration'){this.duration=p.data||0;this.setTime('time-total',this.duration);const tot=el('np-time-tot');if(tot)tot.textContent=fmtSec(this.duration);this._renderBookmarksOnSeekbar();}
      if(p.name==='volume'){const sl=el('volume-slider');if(sl)sl.value=p.data;const l=el('vol-label');if(l)l.textContent=Math.round(p.data);}
      if(p.name==='mute'){this._muted=!!p.data;this.updateMuteIcon(p.data);}
      if(p.name==='media-title'){const t=el('title-text');if(t)t.textContent=p.data||'';const np=el('np-title');if(np)np.textContent=p.data||'Not Playing';
        // ── v1.8.0: sync mini player title ──
        const mt=el('mmp-title');if(mt)mt.textContent=p.data||'Not Playing';
        this._updateVizMeta();
      }
      if(p.name==='speed'){if(this._shadowOn)this.shadow.follow({speed:+p.data});const sb=el('speed-badge');if(sb)sb.textContent=(+p.data).toFixed(2).replace(/\.?0+$/,'')+'x';this.speedMenu?.onSpeedChange(p.data);}
      if(p.name==='sub-delay'){this._ctxSubDelay=Number(p.data)||0;this._syncCtxDelays();}
      if(p.name==='audio-delay'){this._ctxAudioDelay=Number(p.data)||0;this._syncCtxDelays();}
      if(p.name==='track-list'){this._lastTracks=Array.isArray(p.data)?p.data:[];this.renderTrackMenus(this._lastTracks);this.updateVisualizerVisibility(this._lastTracks);this.emitPlugin('track-change',{tracks:this._lastTracks});}
      if(p.name==='demuxer-cache-state'&&p.data&&this.duration>0){const pct=(p.data['cache-end']||0)/this.duration*100;const buf=el('seek-buffer');if(buf)buf.style.width=pct+'%';}
    });
    // Files opened from outside (double-click, drag and drop) come through
    // here: music in the in-app engine steps aside for them too.
    this.api?.mpv.onOpened?.(()=>{ window.bmMusic?.yieldToPlayer?.(); });
    this.api?.mpv.onMediaProps?.(props=>{this._mProps=props;});
  }
  updateVisualizerVisibility(tracks){
    // Cover art is not video (v3.35.0): mpv lists a song's cover (its own, or a
    // cover.png beside it) as a video track marked albumart, and the song was
    // taken for a video: no visual mode, no art. GitHub's Linux run caught it.
    const hasVideo=tracks.some(t=>t.type==='video'&&!t.albumart);
    this._hasVideo=hasVideo;
    // The album art, asked for whatever the audio analysis does (v3.33.0):
    // it hung on the analyser starting before, and a test machine got none.
    if(!hasVideo&&this._currentFilePath&&!window.bmMusic?.engineOwns?.())this._vizArtFor(this._currentFilePath);
    else if(hasVideo)this._vizArtFor(null);
    // A song mpv plays (not the in-app engine) gets the exact visualiser.
    if(!hasVideo&&!window.bmMusic?.engineOwns?.()&&this._currentFilePath)this._startShadow();else this._stopShadow();
    if(hasVideo){
      document.body.classList.remove('audio-viz');
      this._audioVizMode=false;
      // Video content — show player view, hide music mini player
      this.viz?.stop();
      document.body.classList.add('playing');
      document.documentElement.classList.add('playing');
      this._hideMiniPlayer();
      if(this.currentDash==='video'){
        el('welcome-screen')?.classList.remove('active');
        el('player-view')?.classList.add('active');
      }
    } else {
      // Audio only — visualiser in music tab, mini player in video tab
      document.body.classList.remove('playing');
      document.documentElement.classList.remove('playing');
      // Start music visualizer if music tab is open
      // v1.9.0: skip in lite mode — visualizer canvas is hidden by CSS
      // and there's no point in setting up an AnalyserNode + rAF loop
      // for a canvas that's display:none.
      if(this.currentDash==='music' && !this.isLite){
        const mc=el('music-visualizer-canvas');
        // The music view's own visualiser if it has one (v3.36.0): a second one
        // made here drew on the same canvas, both at once, each clearing the other.
        if(mc&&!this.musicViz){this.musicViz=window.bmMusic?._viz||new Visualizer(mc);}
        this.musicViz?.setMode(vizSettings().style);
      }
      // Show mini player bar if user is on video tab
      this._updateMiniPlayer();
    }
  }
  renderTrackMenus(tracks){
    const audio=tracks.filter(t=>t.type==='audio'),video=tracks.filter(t=>t.type==='video'),subs=tracks.filter(t=>t.type==='sub');
    this._fillTrack('audio-track-sub',audio,'aid');this._fillTrack('video-track-sub',video,'vid');this._fillSubMenu('sub-track-sub',subs);
  }
  _trackLabel(t){return[t.lang?'['+t.lang.toUpperCase()+']':'',t.title||t.codec||'Track '+t.id].filter(Boolean).join(' ');}
  _fillTrack(id,list,prop){const c=el(id);if(!c)return;c.innerHTML='';list.forEach(t=>{const row=document.createElement('div');row.className='mr'+(t.selected?' active-opt':'');row.textContent=(t.selected?'✓ ':'')+this._trackLabel(t);row.addEventListener('click',()=>this.api?.mpv.cmd('set_property',prop,t.id));c.appendChild(row);});}
  _fillSubMenu(id,subs){const c=el(id);if(!c)return;c.innerHTML='';const off=document.createElement('div');off.className='mr'+(!subs.some(t=>t.selected)?' active-opt':'');off.textContent=(!subs.some(t=>t.selected)?'✓ ':'')+'Off';off.addEventListener('click',()=>this.api?.mpv.cmd('set_property','sub-visibility',false));c.appendChild(off);subs.forEach(t=>{const row=document.createElement('div');row.className='mr'+(t.selected?' active-opt':'');row.textContent=(t.selected?'✓ ':'')+this._trackLabel(t);row.addEventListener('click',()=>{this.api?.mpv.cmd('set_property','sub-visibility',true);this.api?.mpv.cmd('set_property','sid',t.id);});c.appendChild(row);});}
  showOSD(msg,ms=1600){const e=el('osd');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(this.osdTimer);this.osdTimer=setTimeout(()=>e.classList.remove('show'),ms);}
  emitPlugin(event,data){(this._pluginListeners[event]||[]).forEach(cb=>{try{cb(data);}catch(err){console.error('Plugin listener error on "'+event+'":',err);}});}
  // ── Picture-in-Picture ────────────────────────────────────────
  wirePiP(){
    this._pipActive=false;
    // PiP button in titlebar (if present)
    el('btn-pip')?.addEventListener('click',()=>this.togglePiP());
    el('pip-exit')?.addEventListener('click',()=>this.togglePiP(false));
    // Close from inside PiP. The titlebar is hidden there, so previously the
    // only way out was to expand first.
    el('pip-close')?.addEventListener('click',e=>{e.stopPropagation();this.stop();});
    // Transparent frameless windows can't be resized by their edges on
    // Windows, so PiP was stuck at one size. Cycle through three instead.
    el('pip-size')?.addEventListener('click',e=>{e.stopPropagation();this.api?.win.pipSize?.();});
    el('player-view')?.addEventListener('dblclick',()=>{ if(this._pipActive) this.togglePiP(false); });
    this.api?.win.onPipState?.(on=>{
      this._pipPending=false;
      this._pipActive=on;
      document.body.classList.toggle('pip-mode',on);
      const overlay=el('pip-overlay');
      if(overlay) overlay.classList.toggle('hidden',!on);
      if(on){
        document.body.classList.add('pip-intro');
        clearTimeout(this._pipIntroTimer);
        this._pipIntroTimer=setTimeout(()=>document.body.classList.remove('pip-intro'),2500);
        // Remember where we were so exiting PiP restores the same view rather
        // than dumping the user on whatever happened to be underneath.
        this._pipReturnDash=this.currentDash;
        const t=el('pip-title');
        if(t)t.textContent=el('title-text')?.textContent||'BM Player';
        // Any dashboard left open would render straight over the video in a
        // 340x200 window. Force the player surface to be the only thing there.
        document.querySelectorAll('.dashboard-view').forEach(v=>v.classList.remove('active'));
        el('welcome-screen')?.classList.remove('active');
        el('player-view')?.classList.add('active');
        this.fox?.pause();this.themeFX?.pause();this.auroraFX?.pause();
      }else{
        // PiP switched the visualiser on for audio. If nothing else wants
        // it, turn it back off, or it keeps drawing unseen and its overlay
        // reappears the next time the player view opens.
        if(this._pipAddedViz && !this._audioVizMode){
          document.body.classList.remove('audio-viz');
          this.viz?.stop?.();
        }
        this._pipAddedViz=false;
        if(this._pipReturnDash) this.switchDest(this._pipReturnDash);
        this._pipReturnDash=null;
      }
      this.viz?._resize?.();
    });
    // Keyboard shortcut P (only when not text input)
    document.addEventListener('keydown',e=>{
      if(e.target.matches('input,textarea'))return;
      if(e.code==='KeyP'&&e.altKey){e.preventDefault();this.togglePiP();}
    });
  }
  togglePiP(force){
    const next=(force!==undefined)?force:!this._pipActive;
    // _pipActive only updates when main replies. Two quick clicks used to
    // send "enter" twice before the first reply arrived.
    if(this._pipPending) return;
    if(next===this._pipActive) return;
    // Paused is fine: only refuse when nothing is loaded at all. It used to
    // test isPlaying, so a paused video could not go to PiP.
    const loaded = this.isPlaying || window.bmMusic?.engineOwns?.() || this._mpvIdle === false;
    if(next && !loaded){
      this.showOSD('Nothing loaded: PiP needs a track or video');
      return;
    }
    // Audio-only PiP shows the visualiser rather than an empty black window.
    if(next && !this._hasVideo){
      this._pipAddedViz=!document.body.classList.contains('audio-viz');
      const vc=el('visualizer-canvas');
      if(vc && !this.viz){ try{ this.viz=new Visualizer(vc); }catch(_){} }
      document.body.classList.add('audio-viz');
      this.viz?.setMode(vizSettings().style);this.viz?.start();
      this._updateVizMeta();
    }
    this._pipPending=true;
    Promise.resolve(this.api?.win.pip(next)).catch(()=>{}).finally(()=>{
      // Safety valve: never leave the guard stuck if the reply is lost.
      setTimeout(()=>{ this._pipPending=false; },1500);
    });
  }

  // Drag the pointer across the welcome screen to push the fluid around —
  // the whole point of the effect is that it responds to you.
  wireFluidPointer(){
    const host=el('welcome-screen'), c=el('aurora-canvas');
    if(!host||!c||!this._fluidIsGPU)return;
    let px=0,py=0,have=false;
    const norm=e=>{
      const r=c.getBoundingClientRect();
      return [ (e.clientX-r.left)/Math.max(1,r.width), 1-(e.clientY-r.top)/Math.max(1,r.height) ];
    };
    host.addEventListener('pointermove',e=>{
      const [x,y]=norm(e);
      if(have) this.auroraFX?.addPointer?.(x,y,x-px,y-py);
      px=x;py=y;have=true;
    });
    host.addEventListener('pointerleave',()=>{have=false;});
    host.addEventListener('pointerdown',e=>{
      const [x,y]=norm(e);
      // A click should read as a burst, not a nudge.
      for(let i=0;i<4;i++){
        const ang=Math.random()*Math.PI*2;
        this.auroraFX?.addPointer?.(x,y,Math.cos(ang)*0.06,Math.sin(ang)*0.06);
      }
      px=x;py=y;have=true;
    });
  }

  // ── Full-screen audio visualiser transport ────────────────────
  wireVizOverlay(){
    el('viz-btn-play')?.addEventListener('click',()=>this.togglePlay());
    el('viz-btn-prev')?.addEventListener('click',()=>this.trackStep(-1));
    el('viz-btn-next')?.addEventListener('click',()=>this.trackStep(1));
    el('viz-btn-music')?.addEventListener('click',()=>this.switchDest('music'));
    el('pip-play')?.addEventListener('click',e=>{e.stopPropagation();this.togglePlay();});
    // Cycle visualiser modes by clicking the canvas — bars/radial/wave/particles
    const modes=['bars','radial','wave','particles','fluid','flow','neon','bubbles','milkdrop'];let mi=Math.max(0,modes.indexOf(vizSettings().style));
    el('visualizer-canvas')?.addEventListener('click',()=>{
      if(!this._audioVizMode)return;
      mi=(mi+1)%modes.length;saveVizSettings({...vizSettings(),style:modes[mi]});allVisualisers().forEach(v=>v.setMode(modes[mi]));window.bmVizPanel?.sync?.();this.showOSD('Visualiser: '+modes[mi]);
    });
  }

  // ── Music Mini Player Bar ─────────────────────────────────────
  wireMiniPlayer(){
    el('mmp-play')?.addEventListener('click',()=>this.togglePlay());
    el('mmp-prev')?.addEventListener('click',()=>this.trackStep(-1));
    el('mmp-next')?.addEventListener('click',()=>this.trackStep(1));
    el('mmp-stop')?.addEventListener('click',()=>{this.stop();});
    el('mmp-goto')?.addEventListener('click',()=>this.switchDest('music'));
    // ── v1.8.0: click on mini player progress bar to seek ──
    const mp=el('mmp-progress');if(mp){
      mp.addEventListener('click',e=>{
        if(!this.duration)return;
        const r=mp.getBoundingClientRect();
        const pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
        this.seekTo(pct*this.duration);
      });
    }
  }

  async openDialog(append=false){const files=await this.api?.dialog.open();if(!files?.length)return;if(append)files.forEach(f=>this.api?.mpv.append(f));else this.playMedia(files);}

  // ════════════════════════════════════════════════════════════════
  // v1.7.0 — Professional Media Player features
  // ════════════════════════════════════════════════════════════════

  // ── A-B Repeat: wire the on-screen clear button + indicator ───────
  wireABRepeat(){
    el('ab-clear-btn')?.addEventListener('click',()=>this.abRepeat?.clear());
    this._renderABIndicator();
  }
  _renderABIndicator(){
    const ind = el('ab-indicator');
    if(!ind) return;
    const snap = this.abRepeat?.snapshot();
    if(!snap || !snap.a || snap.a == null){ ind.classList.add('hidden'); return; }
    ind.classList.remove('hidden');
    ind.classList.toggle('ab-paused', snap.paused || !snap.active);
    const a = el('ab-a'), b = el('ab-b');
    if(a) a.textContent = fmtSec(snap.a);
    if(b) b.textContent = snap.b != null ? fmtSec(snap.b) : '…';
  }

  // ── Bookmarks panel + seekbar markers ─────────────────────────────
  wireBookmarks(){
    el('bm-add-now')?.addEventListener('click',()=>this.addBookmarkAtCurrent());
    el('bm-clear-file')?.addEventListener('click',()=>{
      if(!this._currentFilePath){this.showOSD('No file open');return;}
      bookmarks.clearForFile(this._currentFilePath);
      this._renderBookmarksOnSeekbar();
      this.showOSD('Bookmarks cleared');
    });
  }
  wireBookmarkControls(){
    // Player-control bookmark button already wired in wireTransport.
    // Hook for context-menu integration is intentionally a no-op until
    // we add a dedicated context menu entry.
  }
  async addBookmarkAtCurrent(opts = {}){
    if(!this._currentFilePath){this.showOSD('Open a file first');return;}
    const t = await this.api?.mpv?.cmd('get_property','time-pos').catch(()=>null);
    if(t == null){this.showOSD('Cannot add bookmark — no playback');return;}
    let note = '';
    if(!opts.quick){
      // Use a tiny inline prompt (the existing dlg-jump pattern)
      const raw = prompt('Bookmark note (optional):', '');
      if(raw === null) return;            // user cancelled
      note = (raw || '').slice(0, 120);
    }
    const bm = bookmarks.add(this._currentFilePath, t, note);
    if(bm){this.showOSD(`Bookmark @ ${fmtSec(t)}`);}
    this._renderBookmarksOnSeekbar();
    if(el('panel-bookmarks')?.classList.contains('open')) this._renderBookmarksPanel();
  }
  _renderBookmarksPanel(){
    const list = el('bm-list');
    if(!list) return;
    const hint = el('bm-hint');
    if(!this._currentFilePath){
      if(hint) hint.style.display = '';
      list.innerHTML = '';
      return;
    }
    const items = bookmarks.list(this._currentFilePath);
    if(hint) hint.style.display = items.length ? 'none' : '';
    if(!items.length){ list.innerHTML = ''; return; }
    list.innerHTML = items.map(bm => `
      <div class="bm-item" data-t="${bm.t}">
        <span class="bm-time">${fmtSec(bm.t)}</span>
        <span class="bm-note ${bm.note ? '' : 'empty'}">${bm.note ? escapeHtml(bm.note) : '— no note —'}</span>
        <button class="bm-jump" title="Seek to here" aria-label="Seek to bookmark">▸</button>
        <button class="bm-del" title="Remove" aria-label="Remove bookmark">✕</button>
      </div>`).join('');
    list.querySelectorAll('.bm-item').forEach(row => {
      const t = parseFloat(row.dataset.t);
      row.querySelector('.bm-jump').addEventListener('click',()=>{
        this.seekTo(t);
        this.showOSD(`Jump to ${fmtSec(t)}`);
      });
      row.querySelector('.bm-del').addEventListener('click',()=>{
        bookmarks.remove(this._currentFilePath, t);
        this._renderBookmarksOnSeekbar();
      });
      row.addEventListener('dblclick',()=>{
        this.seekTo(t);
      });
    });
  }
  _renderBookmarksOnSeekbar(){
    const track = el('seek-track');
    if(!track) return;
    // Clear any previous markers (we re-render the whole set).
    track.querySelectorAll('.seek-bookmark-marker').forEach(m => m.remove());
    if(!this._currentFilePath || !this.duration) return;
    const items = bookmarks.list(this._currentFilePath);
    if(!items.length) return;
    items.forEach(bm => {
      const pct = Math.max(0, Math.min(100, (bm.t / this.duration) * 100));
      const m = document.createElement('div');
      m.className = 'seek-bookmark-marker';
      m.style.left = pct + '%';
      m.title = `${fmtSec(bm.t)}${bm.note ? ' — ' + bm.note : ''}`;
      m.addEventListener('click',(e)=>{
        e.stopPropagation();
        this.seekTo(bm.t);
      });
      track.appendChild(m);
    });
  }

  // ── Watch History panel ───────────────────────────────────────────
  wireHistory(){
    el('hist-clear')?.addEventListener('click',()=>{
      if(!confirm('Clear all watch history?')) return;
      history.clear();
      this._renderHistoryPanel();
      this.showOSD('History cleared');
    });
  }
  _renderHistoryPanel(){
    const list = el('hist-list'), summary = el('hist-summary');
    if(!list) return;
    const items = history.list();
    // Summary
    if(summary){
      if(!items.length){ summary.innerHTML = ''; }
      else {
        const totalSec = items.reduce((s, r) => s + (r.watchSeconds || 0), 0);
        const videos = items.filter(r => r.kind !== 'audio').length;
        const audios = items.length - videos;
        summary.innerHTML = `
          <div><strong>${items.length}</strong> files</div>
          <div><strong>${videos}</strong> videos</div>
          <div><strong>${audios}</strong> audio</div>
          <div><strong>${fmtSec(totalSec)}</strong> watched</div>`;
      }
    }
    if(!items.length){
      list.innerHTML = '<div class="hist-empty">No history yet.</div>';
      return;
    }
    list.innerHTML = items.map(r => {
      const name = (r.title || basenameOf(r.path)) + (r.path ? '' : '');
      // Straight off the filename, so it is untrusted: a file called
      // `movie.<img src=x onerror=...>` would otherwise be interpolated
      // into innerHTML verbatim. Same class as the gallery/music bugs.
      const ext = escapeHtml((r.path || '').split('.').pop().toUpperCase().slice(0, 8));
      const pct = (r.duration && r.lastPosition) ? Math.min(100, Math.round(r.lastPosition / r.duration * 100)) : 0;
      const when = r.lastPlayed ? relativeTime(r.lastPlayed) : '—';
      return `
      <div class="hist-item" data-path="${escapeAttr(r.path)}">
        <span class="hist-icon">${r.kind === 'audio' ? '🎵' : '🎬'}</span>
        <div class="hist-info">
          <div class="hist-title">${escapeHtml(name)}</div>
          <div class="hist-meta">
            <span>${ext}</span>
            <span>·</span>
            <span>${when}</span>
            <span>·</span>
            <span>${r.playCount || 1}×</span>
          </div>
          <div class="hist-progress"><div class="hist-progress-fill" style="width:${pct}%"></div></div>
        </div>
        <span class="hist-time">${fmtSec(r.lastPosition || 0)} / ${fmtSec(r.duration || 0)}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.hist-item').forEach(row => {
      row.addEventListener('click',()=>{
        const p = row.dataset.path;
        if(p) this.playMedia([p]);
      });
    });
  }

  // ── Settings panel ───────────────────────────────────────────────
  wireSettings(){
    // Wire each control to the settings store.
    const bind = (id, path, format) => {
      const el2 = el(id);
      if(!el2) return;
      // Initialize from store
      const v = settings.get(path);
      if(el2.type === 'checkbox') el2.checked = !!v;
      else el2.value = v;
      // Update label
      const lbl = el(id + '-val');
      if(lbl && format) lbl.textContent = format(v);
      // Listen for changes
      el2.addEventListener('input',()=>{
        const nv = el2.type === 'checkbox' ? el2.checked : (el2.type === 'number' || el2.type === 'range' ? +el2.value : el2.value);
        settings.set(path, nv);
        const lbl2 = el(id + '-val');
        if(lbl2 && format) lbl2.textContent = format(nv);
        // Subtitle settings apply immediately to mpv
        if(path.startsWith('subtitles.')) settings.applyToMpv(this.api?.mpv);
      });
    };
    bind('set-resume', 'playback.resumePrompt', v => v ? 'on' : 'off');
    bind('set-resume-rewind', 'playback.resumeRewindSec', v => v + 's');
    bind('set-history', 'playback.historyEnabled', v => v ? 'on' : 'off');
    bind('set-history-cap', 'playback.historyMaxItems', v => v + ' items');
    bind('set-sub-font', 'subtitles.fontFamily');
    bind('set-sub-size', 'subtitles.fontSize', v => v);
    bind('set-sub-bold', 'subtitles.bold', v => v ? 'on' : 'off');
    bind('set-sub-color', 'subtitles.color');
    bind('set-sub-outline', 'subtitles.outlineSize', v => v);
    bind('set-sub-pos', 'subtitles.position', v => v);
    bind('set-seek-small', 'behaviour.seekSmallSec', v => v + 's');
    bind('set-seek-large', 'behaviour.seekLargeSec', v => v + 's');
    bind('set-vol-step', 'behaviour.volumeStep', v => v + '%');

    // Color value display syncs with the picker
    el('set-sub-color')?.addEventListener('input',e=>{
      const l=el('set-sub-color-val'); if(l) l.textContent = (e.target.value || '#ffffff').toUpperCase();
    });

    // Export / Import
    el('settings-export')?.addEventListener('click',async()=>{
      const json = JSON.stringify(settings.exportAll(), null, 2);
      try{
        await navigator.clipboard.writeText(json);
        this.showOSD('Settings copied to clipboard');
      }catch(_){ this.showOSD('Clipboard unavailable — see console'); console.log(json); }
    });
    el('settings-import')?.addEventListener('click',async()=>{
      let txt;
      try{ txt = await navigator.clipboard.readText(); }catch(_){ txt = prompt('Paste settings JSON:'); }
      if(!txt) return;
      try{
        settings.importAll(JSON.parse(txt));
        this._syncSettingsPanel();
        settings.applyToMpv(this.api?.mpv);
        this.showOSD('Settings imported');
      }catch(e){ this.showOSD('Invalid JSON'); }
    });
    el('settings-reset')?.addEventListener('click',()=>{
      if(!confirm('Reset all preferences to defaults?')) return;
      settings.reset();
      this._syncSettingsPanel();
      settings.applyToMpv(this.api?.mpv);
      this.showOSD('Settings reset');
    });
  }
  _syncSettingsPanel(){
    const fields = [
      ['set-resume', 'playback.resumePrompt'],
      ['set-resume-rewind', 'playback.resumeRewindSec'],
      ['set-history', 'playback.historyEnabled'],
      ['set-history-cap', 'playback.historyMaxItems'],
      ['set-sub-font', 'subtitles.fontFamily'],
      ['set-sub-size', 'subtitles.fontSize'],
      ['set-sub-bold', 'subtitles.bold'],
      ['set-sub-color', 'subtitles.color'],
      ['set-sub-outline', 'subtitles.outlineSize'],
      ['set-sub-pos', 'subtitles.position'],
      ['set-seek-small', 'behaviour.seekSmallSec'],
      ['set-seek-large', 'behaviour.seekLargeSec'],
      ['set-vol-step', 'behaviour.volumeStep'],
    ];
    fields.forEach(([id, path]) => {
      const e = el(id); if(!e) return;
      const v = settings.get(path);
      if(e.type === 'checkbox') e.checked = !!v;
      else e.value = v;
      const lbl = el(id + '-val');
      if(lbl){
        if(id === 'set-resume-rewind') lbl.textContent = v + 's';
        else if(id === 'set-history-cap') lbl.textContent = v + ' items';
        else if(id === 'set-sub-size' || id === 'set-sub-outline' || id === 'set-sub-pos') lbl.textContent = v;
        else if(id === 'set-seek-small' || id === 'set-seek-large') lbl.textContent = v + 's';
        else if(id === 'set-vol-step') lbl.textContent = v + '%';
        else if(id === 'set-resume' || id === 'set-history' || id === 'set-sub-bold') lbl.textContent = v ? 'on' : 'off';
      }
    });
  }

  // ── Online subtitle search ───────────────────────────────────────
  wireSubSearch(){
    el('subs-search-btn')?.addEventListener('click',async()=>{
      if(!this._currentFilePath){this.showOSD('Open a file first');return;}
      // Try to fetch the file as a File object. Electron exposes files via
      // the File API for file:// URLs only in some contexts; if that fails
      // we fall back to keyword-only search using the filename.
      const results = el('subs-results');
      if(results){
        results.innerHTML = '<div class="subs-loading">Searching</div>';
      }
      const lang = el('subs-lang')?.value || 'eng';
      try{
        // Try to read the file as a File object (works if Electron exposes it)
        const file = await this._getFileObjectForCurrent();
        const items = await this.subSearch.searchForFile(file, lang);
        if(!items.length){
          if(results) results.innerHTML = '<div class="subs-empty">No subtitles found.</div>';
          return;
        }
        if(results){
          results.innerHTML = items.map(it => `
            <div class="subs-result" data-link="${escapeAttr(it.downloadLink)}">
              <div class="subs-result-top">
                <span class="subs-result-lang">${escapeHtml(it.lang)}</span>
                <span class="subs-result-name">${escapeHtml(it.filename || 'Unknown')}</span>
                ${it.rating ? `<span class="subs-result-rating">★ ${it.rating.toFixed(1)}</span>` : ''}
              </div>
              <div class="subs-result-actions">
                <button class="subs-download ${it.fromHash ? 'subs-hash-match' : ''}">${it.fromHash ? '⬇ Download (hash match)' : '⬇ Download'}</button>
              </div>
            </div>`).join('');
          results.querySelectorAll('.subs-result').forEach(r => {
            r.querySelector('.subs-download').addEventListener('click',async()=>{
              const link = r.dataset.link;
              if(!link) return;
              this.showOSD('Downloading subtitle…', 2000);
              try{
                const res = await fetch(link);
                if(!res.ok) throw new Error('HTTP ' + res.status);
                const blob = await res.blob();
                const buf = new Uint8Array(await blob.arrayBuffer());
                // The download is a ZIP containing the .srt; extract it.
                const srtBytes = await extractSrtFromZip(buf);
                if(!srtBytes) throw new Error('No .srt in ZIP');
                // Save it next to the media file with the same base name.
                const baseName = this._currentFilePath.replace(/\.[^.]+$/, '');
                const subPath = baseName + '.' + (lang === 'all' ? 'srt' : lang) + '.srt';
                const result = await this.api?.pdfFile?.write(subPath, srtBytes);
                if(result?.error) throw new Error(result.error);
                this.api?.mpv.cmd('sub-add', subPath, 'select');
                this.showOSD('Subtitle downloaded and loaded', 2500);
              }catch(err){ this.showOSD('Download failed: ' + err.message, 4000); }
            });
          });
        }
      }catch(err){
        if(results) results.innerHTML = `<div class="subs-empty">Error: ${escapeHtml(err.message)}</div>`;
      }
    });
  }
  async _getFileObjectForCurrent(){
    // Electron's renderer can fetch file:// URLs; wrap the bytes in a File
    // object so the subtitle-search module's hashFile() can read it.
    if(!this._currentFilePath) return null;
    const url = fileURL(this._currentFilePath);
    const res = await fetch(url);
    const blob = await res.blob();
    const name = (this._currentFilePath.split(/[\\/]/).pop()) || 'media';
    return new File([blob], name, { type: blob.type || 'application/octet-stream' });
  }

  // ── Resume prompt ─────────────────────────────────────────────────
  wireResumePrompt(){
    el('resume-yes')?.addEventListener('click',()=>this._doResume(true));
    el('resume-no')?.addEventListener('click',()=>this._doResume(false));
    el('resume-dismiss')?.addEventListener('click',()=>el('resume-prompt')?.classList.add('hidden'));
  }
  _maybePromptResume(path){
    if(!path || path.startsWith('http')) return;
    if(!settings.get('playback.resumePrompt')) return;
    const pos = history.getResumePosition(path);
    if(!pos) return;
    // Wait briefly for mpv to actually start the file before we prompt
    // (otherwise the seek-to-position won't take effect).
    clearTimeout(this._resumePromptTimer);
    this._resumePromptTimer = setTimeout(()=>{
      const prompt = el('resume-prompt');
      if(!prompt) return;
      const meta = el('resume-prompt-meta');
      if(meta) meta.textContent = `Stopped at ${fmtSec(pos)}${this.duration ? ' of ' + fmtSec(this.duration) : ''}`;
      prompt.classList.remove('hidden');
      this._pendingResumePos = pos;
      // Auto-dismiss after 12s if no interaction
      setTimeout(()=>{ if(!prompt.matches('.hidden')){ prompt.classList.add('hidden'); this._pendingResumePos = null; } }, 12000);
    }, 800);
  }
  _doResume(resume){
    el('resume-prompt')?.classList.add('hidden');
    if(resume && this._pendingResumePos){
      const rewind = settings.get('playback.resumeRewindSec') || 0;
      const target = Math.max(0, this._pendingResumePos - rewind);
      this.seekTo(target);
      this.showOSD(`Resumed from ${fmtSec(target)}`, 2200);
    }
    this._pendingResumePos = null;
  }

  // ── M3U playlist IO ───────────────────────────────────────────────
  wirePlaylistIO(){
    // Wiring is via handleAction — import-m3u / export-m3u call into
    // the methods below. No additional listeners needed.
  }
  async importM3u(){
    const file = await this.api?.dialog.openM3u();
    if(!file) return;
    try{
      const items = await readM3uFile(file);
      if(!items.length){ this.showOSD('Playlist is empty'); return; }
      const paths = items.map(i => i.path).filter(Boolean);
      if(!paths.length){ this.showOSD('No playable paths in playlist'); return; }
      this.playMedia(paths);
      this.showOSD(`Loaded ${paths.length} items from playlist`, 2200);
    }catch(err){
      this.showOSD('Failed to load playlist: ' + err.message, 4000);
    }
  }
  async exportM3u(){
    let pl;
    try{ pl = await this.api?.mpv.getPlaylist(); }catch(_){}
    if(!pl || !Array.length || !pl.length){
      this.showOSD('Playlist is empty');
      return;
    }
    const items = pl.map(p => ({
      path: p.filename,
      title: p.title || (p.filename ? (p.filename.split(/[\\/]/).pop() || p.filename) : ''),
      duration: p.duration || -1,
    })).filter(i => i.path && !i.path.startsWith('cdda://'));
    if(!items.length){
      this.showOSD('Playlist is empty');
      return;
    }
    const defaultName = (this._currentFilePath ? this._currentFilePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : 'playlist') + '.m3u';
    const savePath = await this.api?.dialog.saveM3u(defaultName);
    if(!savePath) return;
    try{
      await writeM3uFile(savePath, items, this.api);
      this.showOSD(`Saved ${items.length} items to .m3u`, 2200);
    }catch(err){
      this.showOSD('Failed to save playlist: ' + err.message, 4000);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // v1.8.0 — Theme Customizer
  // ════════════════════════════════════════════════════════════════
  wireThemeCustomizer(){
    el('tc-cancel')?.addEventListener('click',()=>el('theme-customizer')?.classList.add('hidden'));
    el('tc-reset')?.addEventListener('click',()=>{
      const name=localStorage.getItem('bm_theme')||'dark';
      this._applyCustomThemeToUI(this._getBuiltinTokens(name));
      this.showOSD('Colors reset to theme default');
    });
    el('tc-apply')?.addEventListener('click',()=>{
      const tokens=this._readCustomThemeFromUI();
      this._applyCustomTokens(tokens);
      this.showOSD('Custom theme applied');
      el('theme-customizer')?.classList.add('hidden');
    });
    // Fluid toggle
    const ft=el('tc-fluid-toggle');
    if(ft){
      if(!this._fluidEnabled)ft.classList.remove('active');
      ft.addEventListener('click',()=>{
        this._fluidEnabled=!this._fluidEnabled;
        ft.classList.toggle('active',this._fluidEnabled);
        localStorage.setItem('bm_fluid_enabled',this._fluidEnabled?'1':'0');
        const name=localStorage.getItem('bm_theme')||'dark';
        this.applyTheme(name);
      });
    }
    // Connections toggle
    const ct=el('tc-connections-toggle');
    if(ct){
      const connOn=localStorage.getItem('bm_fluid_connections')==='1';
      if(connOn)ct.classList.add('active');
      ct.addEventListener('click',()=>{
        ct.classList.toggle('active');
        localStorage.setItem('bm_fluid_connections',ct.classList.contains('active')?'1':'0');
      });
    }
    this._buildThemePresetGrid();
    const cur=localStorage.getItem('bm_theme')||'dark';
    this._applyCustomThemeToUI(this._getBuiltinTokens(cur));
  }

  _buildThemePresetGrid(){
    const grid=el('tc-preset-grid');if(!grid)return;
    const presets=[
      {name:'dark',    icon:'🌙', colors:['#080b14','#111624','#e4eaf6','#5B6FF8','#00D4FF']},
      {name:'light',   icon:'☀️', colors:['#f0f2fa','#ffffff','#1a1d2b','#4757e3','#0098cf']},
      {name:'glass',   icon:'🔮', colors:['#0a0c1a','#14162e','#e0e0ff','#8d7bff','#43e0ff']},
      {name:'dracula', icon:'🧛', colors:['#130c1c','#20132c','#f4e9ff','#ff4d6d','#bd5cff']},
      {name:'northern',icon:'🌌', colors:['#030c12','#091a26','#d8faf0','#22e8a8','#3aa8ff']},
      {name:'ocean',   icon:'🌊', colors:['#0a1628','#112844','#d4f1ff','#1a8fcc','#00c8ff']},
      {name:'snow',    icon:'❄️', colors:['#0b1522','#132438','#eef6ff','#8fd0ff','#cfe9ff']},
      {name:'sunset',  icon:'🌅', colors:['#1a0c08','#2e1a14','#fff0e0','#ff6b35','#ffb432']},
      {name:'sakura',  icon:'🌸', colors:['#1c0a14','#2e1420','#fff0f5','#f5a0c0','#ff80b0']},
      {name:'midnight',icon:'🌙', colors:['#0a0c1e','#161a34','#e8eaff','#4a5fcf','#7888ff']},
    ];
    grid.innerHTML='';
    presets.forEach(p=>{
      const div=document.createElement('div');
      div.className='tc-preset';
      if(p.name===localStorage.getItem('bm_theme'))div.classList.add('active');
      // Interpolated into a style attribute, so restrict it to a colour literal.
      // Theme presets can come from plugins, and `);` in a colour string
      // would break out of the declaration.
      const safeColor = c => /^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : '#888';
      div.innerHTML=`<div class="tc-preset-swatch" style="background:linear-gradient(135deg,${safeColor(p.colors[3])},${safeColor(p.colors[4])})"></div><span>${escapeHtml(p.icon || '')} ${escapeHtml(p.name || '')}</span>`;
      div.addEventListener('click',()=>{
        this.applyTheme(p.name);
        this._applyCustomThemeToUI(this._getBuiltinTokens(p.name));
        grid.querySelectorAll('.tc-preset').forEach(x=>x.classList.remove('active'));
        div.classList.add('active');
      });
      grid.appendChild(div);
    });
  }

  _getBuiltinTokens(n){
    const m={
      dark:    {bg:'#080b14',surface:'#111624',text:'#e4eaf6',accent:'#5B6FF8',accent2:'#00D4FF'},
      light:   {bg:'#f0f2fa',surface:'#ffffff',text:'#1a1d2b',accent:'#4757e3',accent2:'#0098cf'},
      glass:   {bg:'#0a0c1a',surface:'#14162e',text:'#e0e0ff',accent:'#8d7bff',accent2:'#43e0ff'},
      dracula: {bg:'#130c1c',surface:'#20132c',text:'#f4e9ff',accent:'#ff4d6d',accent2:'#bd5cff'},
      northern:{bg:'#030c12',surface:'#091a26',text:'#d8faf0',accent:'#22e8a8',accent2:'#3aa8ff'},
      ocean:   {bg:'#0a1628',surface:'#112844',text:'#d4f1ff',accent:'#1a8fcc',accent2:'#00c8ff'},
      snow:    {bg:'#0b1522',surface:'#132438',text:'#eef6ff',accent:'#8fd0ff',accent2:'#cfe9ff'},
      sunset:  {bg:'#1a0c08',surface:'#2e1a14',text:'#fff0e0',accent:'#ff6b35',accent2:'#ffb432'},
      sakura:  {bg:'#1c0a14',surface:'#2e1420',text:'#fff0f5',accent:'#f5a0c0',accent2:'#ff80b0'},
      midnight:{bg:'#0a0c1e',surface:'#161a34',text:'#e8eaff',accent:'#4a5fcf',accent2:'#7888ff'},
    };
    return m[n]||m.dark;
  }

  _applyCustomThemeToUI(t){
    const s=(id,v)=>{const e=el(id);if(e)e.value=v;};
    s('tc-bg',t.bg);s('tc-surface',t.surface);s('tc-text',t.text);
    s('tc-accent',t.accent);s('tc-accent2',t.accent2);
  }

  _readCustomThemeFromUI(){
    const g=id=>el(id)?.value||'#000000';
    return{bg:g('tc-bg'),surface:g('tc-surface'),text:g('tc-text'),accent:g('tc-accent'),accent2:g('tc-accent2')};
  }

  _applyCustomTokens(t){
    const r=document.documentElement.style;
    r.setProperty('--bg',t.bg);
    r.setProperty('--bg2',this._lighten(t.bg,8));
    r.setProperty('--surface',t.surface);
    r.setProperty('--surface2',this._lighten(t.surface,6));
    r.setProperty('--text',t.text);
    r.setProperty('--text-muted',this._blend(t.text,t.bg,0.5));
    r.setProperty('--accent',t.accent);
    r.setProperty('--accent2',t.accent2);
    r.setProperty('--accent-glow',t.accent+'59');
    r.setProperty('--bar-bg',t.accent+'14');
    r.setProperty('--hover',t.accent+'1f');
    r.setProperty('--border',t.accent+'26');
    r.setProperty('--menu-bg',t.bg);
    r.setProperty('--danger','#ff5555');
  }

  _lighten(hex,pct){
    let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    r=Math.min(255,r+Math.round((255-r)*pct/100));
    g=Math.min(255,g+Math.round((255-g)*pct/100));
    b=Math.min(255,b+Math.round((255-b)*pct/100));
    return '#'+[r,g,b].map(c=>c.toString(16).padStart(2,'0')).join('');
  }

  _blend(h1,h2,t){
    const p=c=>parseInt(c,16);
    const r=Math.round(p(h1.slice(1,3))*(1-t)+p(h2.slice(1,3))*t);
    const g=Math.round(p(h1.slice(3,5))*(1-t)+p(h2.slice(3,5))*t);
    const b=Math.round(p(h1.slice(5,7))*(1-t)+p(h2.slice(5,7))*t);
    return '#'+[r,g,b].map(c=>Math.min(255,Math.max(0,c)).toString(16).padStart(2,'0')).join('');
  }

  _openThemeCustomizer(){
    el('theme-customizer')?.classList.remove('hidden');
    // On the Flow theme, its controls are what you came for: they are the
    // customizer's last section, so it opens scrolled to them (v3.28.0).
    if(document.documentElement.getAttribute('data-theme')==='northern') requestAnimationFrame(()=>el('tc-flow')?.scrollIntoView({block:'nearest'}));
  }

  // ── v1.8.0: Music energy -> Fox ────────────────────────────────
  _startMusicEnergyLoop(){
    const loop=()=>{
      if(this.isPlaying&&!this._hasVideo&&this.viz?.audioCtx){
        try{
          if(!this.viz.analyser){setTimeout(loop,200);return;}
          const data=new Uint8Array(this.viz.analyser.frequencyBinCount);
          this.viz.analyser.getByteFrequencyData(data);
          let bass=0;for(let i=0;i<8&&i<data.length;i++)bass+=data[i];
          bass/=8*255;
          let mid=0;const me=Math.min(40,data.length);
          for(let i=8;i<me;i++)mid+=data[i];
          mid/=(me-8)*255;
          this._targetMusicEnergy=bass*0.7+mid*0.3;
        }catch(_){this._targetMusicEnergy=0;}
      }else{this._targetMusicEnergy=0;}
      this._musicEnergy+=(this._targetMusicEnergy-this._musicEnergy)*0.12;
      this.fox?.setMusicEnergy?.(this._musicEnergy);
      if(this._musicEnergy>0.6)this.fox?.setExpression?.('excited');
      else if(this._musicEnergy>0.25)this.fox?.setExpression?.('happy');
      else if(!this.isPlaying)this.fox?.setExpression?.('neutral');
      setTimeout(loop,200);
    };
    loop();
  }

  // ════════════════════════════════════════════════════════════════
  // RELOCATED: these lived inside PDFViewer while BMPlayer.init() called
  // this._tvRenderRecent() — so init() threw on every single launch.
  // Everything after that line never ran: wireTV(), the always-on-top
  // restore, the window-state listener, and critically
  //     window.addEventListener('contextmenu', ...)
  // which is why right-click did nothing. window.bmPlayer was never
  // assigned either, since the constructor never returned.
  // ════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  // v2.0.0 — TV / IPTV
  // ════════════════════════════════════════════════════════════════

  wireTV(){
    const tv = this.tvModule;
    // Open M3U file
    el('btn-tv-open-m3u')?.addEventListener('click', async () => {
      const file = await this.api?.dialog.openM3u?.();
      if (!file) return;
      const result = await tv.loadPlaylist(file);
      if (result.warned) el('tv-eco-warning')?.classList.remove('hidden');
      this._tvPopulateGroups();
      this._tvRenderChannels();
    });
    // Open URL dialog
    el('btn-tv-open-url')?.addEventListener('click', () => {
      el('dlg-tv-url')?.classList.remove('hidden');
      el('tv-url-input')?.focus();
    });
    el('tv-url-cancel')?.addEventListener('click', () => el('dlg-tv-url')?.classList.add('hidden'));
    el('tv-url-go')?.addEventListener('click', async () => {
      const url = el('tv-url-input')?.value?.trim();
      if (!url) return;
      el('dlg-tv-url')?.classList.add('hidden');
      const result = await tv.loadPlaylist(url);
      if (result.warned) el('tv-eco-warning')?.classList.remove('hidden');
      this._tvPopulateGroups();
      this._tvRenderChannels();
    });
    el('tv-url-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') el('tv-url-go')?.click(); });
    // Search
    el('tv-search')?.addEventListener('input', e => {
      tv.setSearch(e.target.value);
      this._tvRenderChannels();
    });
    // Group filter
    el('tv-group-filter')?.addEventListener('change', e => {
      tv.setGroupFilter(e.target.value);
      this._tvRenderChannels();
    });
    // Sort
    el('tv-sort')?.addEventListener('change', e => {
      tv.setSortBy(e.target.value);
      this._tvRenderChannels();
    });
    // Eco warning dismiss
    el('tv-eco-dismiss')?.addEventListener('click', () => el('tv-eco-warning')?.classList.add('hidden'));
    // Reconnect stop
    el('tv-reconnect-stop')?.addEventListener('click', () => { tv.stop(); el('tv-reconnect-bar')?.classList.add('hidden'); });
  }

  _tvPopulateGroups(){
    const sel = el('tv-group-filter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="all">All Groups</option>';
    for (const g of this.tvModule.groups) {
      const opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      sel.appendChild(opt);
    }
    sel.value = current;
  }

  _tvRenderChannels(){
    const container = el('tv-channels');
    const countEl = el('tv-count');
    if (!container) return;
    const channels = this.tvModule.channels;
    if (countEl) countEl.textContent = channels.length ? `${channels.length} channel${channels.length !== 1 ? 's' : ''}` : '';
    if (!channels.length) {
      // Show empty state with recent
      container.innerHTML = `<div class="tv-empty"><div style="font-size:52px;margin-bottom:12px">📺</div><p>No channels match your filter</p></div>`;
      return;
    }
    // Virtual render: only render visible chunk for perf
    const FRAG_SIZE = 200;
    const html = [];
    const limit = Math.min(channels.length, FRAG_SIZE);
    for (let i = 0; i < limit; i++) {
      const ch = channels[i];
      const isNow = this.tvModule.currentChannel?.url === ch.url;
      const isFav = this.tvModule.isFavorite(ch.url);
      html.push(`<div class="tv-ch${isNow ? ' now-playing' : ''}" data-idx="${i}" data-url="${escapeAttr(ch.url)}">
      <div class="tv-ch-num">${i + 1}</div>
      <div class="tv-ch-info"><div class="tv-ch-title">${escapeHtml(ch.title || ch.url)}</div><div class="tv-ch-group">${escapeHtml(ch.group)}</div></div>
      <button class="tv-ch-fav${isFav ? ' active' : ''}" data-url="${escapeAttr(ch.url)}" title="Favorite" aria-label="Toggle favourite for ${escapeAttr(ch.title || ch.url)}" aria-pressed="${isFav}">★</button>
      <div class="tv-ch-probe" data-url="${escapeAttr(ch.url)}"></div>
    </div>`);
    }
    container.innerHTML = html.join('');
    // Wire clicks (event delegation)
    container.onclick = (e) => {
      const card = e.target.closest('.tv-ch');
      if (!card) return;
      // Fav button?
      if (e.target.closest('.tv-ch-fav')) {
        const url = e.target.closest('.tv-ch-fav').dataset.url;
        this.tvModule.toggleFavorite(url);
        this._tvRenderChannels();
        return;
      }
      // Play channel
      const idx = parseInt(card.dataset.idx, 10);
      const ch = channels[idx];
      if (ch) this.tvModule.play(ch);
    };
  }

  _tvStatusUpdate(type, msg){
    const statusEl = el('tv-status-text');
    const spinnerEl = el('tv-status-spinner');
    const warningEl = el('tv-eco-warning');
    const warnMsgEl = el('tv-eco-msg');
    const reconBar = el('tv-reconnect-bar');
    const reconText = el('tv-reconnect-text');
    if (!statusEl) return;
    if (type === 'loading' || type === 'progress') {
      statusEl.textContent = msg;
      spinnerEl?.classList.remove('hidden');
    } else if (type === 'warn') {
      warningEl?.classList.remove('hidden');
      if (warnMsgEl) warnMsgEl.textContent = msg;
    } else if (type === 'done') {
      statusEl.textContent = msg;
      spinnerEl?.classList.add('hidden');
    } else if (type === 'error') {
      statusEl.textContent = msg;
      spinnerEl?.classList.add('hidden');
      this.showOSD(msg, 4000);
    } else if (type === 'streaming') {
      statusEl.textContent = msg;
      reconBar?.classList.add('hidden');
    } else if (type === 'reconnect') {
      reconBar?.classList.remove('hidden');
      if (reconText) reconText.textContent = msg;
    }
  }

  _tvRenderRecent(){
    const section = el('tv-recent-section');
    const list = el('tv-recent-list');
    if (!section || !list) return;
    const recent = this.tvModule.recent;
    if (!recent.length) return;
    section.style.display = '';
    list.innerHTML = recent.slice(0, 12).map(r =>
      `<div class="recent-item" data-url="${escapeAttr(r.url)}"><div class="recent-thumb" style="${seedGrad(r.title||r.url)}"></div><div class="recent-meta"><span class="recent-name">${escapeHtml(r.title||basenameOf(r.url))}</span></div></div>`
    ).join('');
    list.onclick = (e) => {
      const item = e.target.closest('.recent-item');
      if (!item) return;
      const url = item.dataset.url;
      const ch = this.tvModule.channels.find(c => c.url === url);
      if (ch) { this.tvModule.play(ch); this.switchDest('tv'); }
    };
  }

  _tvPlayChannel(ch){
    // Switch to video player and open the stream URL
    this.switchDest('video');
    this.playMedia([ch.url]);
    el('title-text') && (el('title-text').textContent = ch.title || 'TV — ' + (ch.group || ''));
    this._tvRenderChannels(); // refresh now-playing highlight
  }

}

// ── Plugin System ────────────────────────────────────────────────
// Plugins are plain ES modules dropped in a plugins/<name>/ folder with a
// plugin.json manifest ({name, version, description, entry}). They load in
// this SAME renderer context — there is no process/iframe isolation — so a
// plugin has effectively the same reach as the rest of the UI layer. Only
// install plugins you trust. Plugins get a curated `BM` object rather than
// raw access to `window.api`, so at minimum they can't call arbitrary IPC
// channels that weren't deliberately exposed here.

window.addEventListener('DOMContentLoaded',()=>{
  window.bmApp=new BMPlayer();
  window.bmGallery=new GalleryDash(window.api);
  window.bmMusic=new MusicDash(window.api);
  window.bmPDF=new PDFViewer(window.api);
});
