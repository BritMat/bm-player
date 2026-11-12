/**
 * BM Player's page: the player.
 *
 * Until v3.47.0 this file was one class of 139 methods, 2,580 lines, that every new feature had to be
 * wired into. It keeps the start (constructor, init) and the playback routing now: togglePlay, seekTo,
 * seekBy, setVolume, toggleMute, trackStep and stop decide which player, mpv or the in-app engine, gets a
 * command. Everything else is in app/, one file per feature, each a class whose methods are copied onto
 * BMPlayer below (app/mixin.js), so they run exactly as they did here. A feature that adds menu actions,
 * shortcuts or settings does it from its own file through app/registry.js.
 */
import { createFox } from './fox3d.js';
import { Visualizer, allVisualisers } from './visualizer.js';
import { AudioShadow } from './audio-shadow.js';
import './viz-settings.js';   // the visualiser settings panel
import './md-browser.js';     // the MilkDrop preset browser (v3.39.0)
import { ThemeFX } from './theme-fx.js';
import { FluidFX } from './fluid.js';
import { applyIcons, setIcon } from './icons.js';
import { perf } from './perf.js';
import { onPower, startPower } from './power.js';
import history from './modules/history.js';
import ABRepeat from './modules/abrepeat.js';
import bookmarks from './modules/bookmarks.js';
import SpeedMenu from './modules/speed-menu.js';
import VideoTransform from './modules/video-transform.js';
import { Picture } from './modules/picture.js';
import { Sound } from './modules/sound.js';
import { SleepTimer } from './modules/sleep-timer.js';
import { Lyrics } from './modules/lyrics.js';
import liteMode from './modules/lite-mode.js';
import './lite-video.js';   // Lite: where the video window goes
import './range-fill.js';   // volume sliders filled with the theme's colours
import './ctx-menu.js';     // the right-click menu's submenus
import { applySubStyle } from './sub-style.js';
import { PluginManager } from './plugins.js';
import { MusicDash } from './dash/music.js';
import { el } from './util.js';
import { EQ_PRESETS } from './app/eq-bands.js';
import ChromeFeature from './app/chrome.js';
import NowPlayingFeature from './app/nowplaying.js';
import PanelsFeature from './app/panels.js';
import EffectsFeature from './app/effects.js';
import MpvEventsFeature from './app/mpv-events.js';
import KeyboardFeature from './app/keyboard.js';
import PipFeature from './app/pip.js';
import LibraryFeature from './app/library.js';
import PreferencesFeature from './app/preferences.js';
import SleepFeature from './app/sleep.js';
import ThemeCustomizerFeature from './app/theme-customizer.js';
import TvTabFeature from './app/tv-tab.js';
import PartsFeature from './app/parts.js';
import { mixin } from './app/mixin.js';
import { wireStudio } from './modules/studio.js';

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
      music: () => window.bmMusic?.speedAdapter?.(),   // while the music plays itself, its speed (v3.38.0)
    });
    // Rotate and mirror the picture (v3.38.0), for the file that is open.
    this.transform = new VideoTransform({ mpv: () => this.api?.mpv, osd: m => this.showOSD(m), paused: () => !!this.isPaused });
    // The picture's colours and zoom, and the sound's effects (v3.46.0).
    this.picture = new Picture(this.api, { osd: m => this.showOSD(m) });
    this.sound = new Sound({ apply: () => this._applyEQ(), osd: m => this.showOSD(m) });
    this.sleep = new SleepTimer({
      playing: () => !!this.isPlaying, pause: () => this.togglePlay(),
      volume: () => +(el('volume-slider')?.value ?? 100), setVolume: v => this.setVolume(v),
      osd: (m, ms) => this.showOSD(m, ms), onChange: () => this._sleepChanged(),
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
    this.picture.wire(el('panel-picture'));this.sound.wire(el('snd-section'));this.wireSleep();
    this.wireDialogs();this.wireOverlayKeys();this.wireKeyboard();this.wireDragDrop();this.wireControlsHide();
    this.wirePiP();this.wireMiniPlayer();this.wireVizOverlay();this.wireCtxMenu();this.wireFluidPointer();this.wirePlayModes();this.wireScenes();this.wireDiagnostics();
    this.wireUpdate();this.wireDefaultPrompt();this.listenMpv();this.renderRecent();this.renderTrackMenus([]);
    this.wireABRepeat();this.wireBookmarks();this.wireHistory();this.wireSettings();this.wireSubSearch();this.wireResumePrompt();this.wirePlaylistIO();this.wireBookmarkControls();
    // Power (v3.39.0): the battery, and the home screen's background resting
    // while nothing plays and no one is there.
    startPower({ api: this.api, playing: () => this._anyPlaying() || !!(window.bmMusic?.engine?.el && !window.bmMusic.engine.el.paused) });
    onPower((_, what) => { if (what === 'idle') this._syncEffects(); });
    this.wirePerfPanel();
    this.pluginManager=new PluginManager(this);
    this._wireFluidPanel();
    // ── v1.8.0 ──
    this.wireThemeCustomizer();this._startMusicEnergyLoop();
    // TV (v2.0.0) is set up the first time its tab opens (app/parts.js, v3.47.0).
    if(this.alwaysOnTop){this.api?.win.alwaysTop(true);el('mi-always-top')?.classList.add('active-opt');}
    window.addEventListener('contextmenu',e=>{e.preventDefault();this._openCtxPanel(e.clientX,e.clientY);});
    // 'fullscreen' as well as 'maximized' and 'normal' (v3.37.0). The page is
    // told so that it can hide the pointer along with the controls, and keep
    // the title bar from dragging a window that fills the screen (is-fs).
    this.api?.win.onState?.(s=>{const b=el('btn-maximize');if(b)setIcon(b,s==='normal'?'maximize':'restore');document.documentElement.classList.toggle('is-fs',s==='fullscreen');this._askRefresh();});
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
  // fast: to the nearest keyframe, for a seek bar being dragged (v3.46.0).
  seekTo(seconds,fast){
    const m=window.bmMusic;
    if(m?.engineOwns?.()) return m.engine.seek(seconds);
    this.api?.mpv.cmd('seek',seconds,fast?'absolute+keyframes':'absolute');
  }
  // opts.stay keeps you on the current tab (the music panel's own stop
  // button). Everywhere else, including the video-mode visualiser, stop
  // returns to the home screen.
  stop(opts){
    if(!this.api?.mpv)return;this.api.mpv.cmd('stop');
    if(this._holdAtEnd){this._holdAtEnd=false;this.api.mpv.cmd('set_property','keep-open','yes');}   // the sleep timer's hold (v3.46.0)
    // ── v1.7.0: persist last position before stopping ──
    history.onClose({ path: this._currentFilePath, timePos: this.currentTime });
    this.isPlaying=false;this.duration=0;this.currentTime=0;
    this._currentFilePath=null;
    this.abRepeat?.clear(true);
    this._renderBookmarksOnSeekbar();
    setTimeout(()=>this.speedMenu?.sync?.(),0);   // the film's speed shown again once the music has stopped (v3.38.0)
    window.bmLyrics?.clear?.();
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
    set('np-title','Nothing playing');set('np-artist','Pick a song from the list');set('np-format','');
    el('np-title')?.removeAttribute('title');
    set('np-time-cur','0:00');set('np-time-tot','0:00');
    const f=el('np-seek-fill');if(f)f.style.width='0%';
    el('np-art')?.classList.remove('has-track');
    el('np-bars')?.classList.remove('playing');
    const gl=el('np-glow');if(gl)gl.style.opacity='0';
    const ai=el('np-art-inner');
    if(ai){ai.style.background='';ai.innerHTML='<span class="np-art-placeholder"></span>';setIcon(ai.firstChild,'music');}
    // Only the playing mark goes. Redrawing the list here put it back in
    // the order of the folder scan, whatever it was sorted or searched by.
    if(window.bmMusic){window.bmMusic.currentPath=null;window.bmMusic._markPlaying?.();window.bmMusic._renderQueue?.();}
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
    this.abRepeat?.clear(true);
    // and turning and mirroring (v3.38.0): they were for the last file
    this.transform?.reset(true);
    this.picture?.newFile();   // and zoom (v3.46.0); the colours stay
    if(this._sid2){this._sid2=null;this.api?.mpv.cmd('set_property','secondary-sid','no');}   // the second subtitle was the last film's
    window.bmLyrics?.clear?.();   // a film: the last song's lyrics go
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
}
// The features' methods, onto the player (v3.47.0).
mixin(BMPlayer, ChromeFeature, NowPlayingFeature, PanelsFeature, EffectsFeature, MpvEventsFeature, KeyboardFeature, PipFeature, LibraryFeature, PreferencesFeature, SleepFeature, ThemeCustomizerFeature, TvTabFeature, PartsFeature);

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
  window.bmMusic=new MusicDash(window.api);
  window.bmApp._applyEQ?.();   // the sound's kept effects for the engine as well (v3.46.0)
  // Lyrics (v3.38.0), for the music: the Now Playing tab and the visual mode.
  try { window.bmLyrics=new Lyrics({ api: window.api, music: window.bmMusic, app: window.bmApp }); } catch (e) { console.warn('[BM Player] lyrics unavailable:', e); }
  try { wireStudio(); } catch (e) { console.warn('[BM Player] studio layout:', e); }   // v3.51.0: the themes menu, the panel beside the songs
  // The Gallery (window.bmGallery), the PDF tools (window.bmPDF) and TV are
  // set up the first time their tab opens: app.part() (app/parts.js, v3.47.0).
});
