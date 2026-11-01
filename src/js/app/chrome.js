/**
 * The window around everything (v3.47.0, from app.js): the title bar, the theme picker, the
 * sidebar and its tabs, the menus and their actions, About, the shortcuts list, dialogs, Diagnostics, messages
 * on screen, and plugins hearing of it all.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { buildFoxSVG } from '../geofox.js';
import { Visualizer, vizSettings } from '../visualizer.js';
import { perf } from '../perf.js';
import settings from '../modules/settings.js';
import { SCENE_THEMES } from '../theme-scenes.js';
import { flowSettings } from '../flow-settings.js';
import { collectDiagnostics, formatDiagnostics } from '../diagnostics.js';
import { el } from '../util.js';
import { runAction, placeActions } from './registry.js';

export default class ChromeFeature {
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
        this._wakeControls?.();
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
    // The Gallery, PDF and TV tabs are set up the first time they open (app/parts.js, v3.47.0).
    if(dest==='images'||dest==='pdf'||dest==='tv') this.part(dest);
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
  // Menu rows a feature asked for (registry.js) are put in first, so they are wired with the rest.
  wireMenu(){placeActions();document.querySelectorAll('.mr[data-a]').forEach(r=>r.addEventListener('click',()=>this.handleAction(r.dataset.a)));}
  handleAction(a){
    if(runAction(this,a))return;   // a feature's own action (registry.js, v3.47.0)
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
      'screenshot':()=>{cmd('screenshot','subtitles');this.showOSD('Screenshot saved');},'sleep-timer':()=>this.openSleep(),'jump-to-time':()=>{el('dlg-jump')?.classList.remove('hidden');el('jump-input')?.focus();},
      'cycle-audio':()=>cmd('cycle','audio'),'vol-up':()=>this.bumpVolume(settings.get('behaviour.volumeStep') ?? 5),'vol-down':()=>this.bumpVolume(-(settings.get('behaviour.volumeStep') ?? 5)),'mute':()=>this.toggleMute(),
      'fullscreen':()=>this.api?.win.fullscreen(),'theatre':()=>this.api?.win.theatre(),'cycle-sub':()=>cmd('cycle','sub'),
      'rotate-right':()=>this.transform?.rotate(90),'rotate-left':()=>this.transform?.rotate(-90),'mirror':()=>this.transform?.mirror(),'transform-reset':()=>this.transform?.reset(),
      'sub-delay-p':()=>this.api?.adj.subDelay(0.5),'sub-delay-m':()=>this.api?.adj.subDelay(-0.5),'sub-delay-r':()=>this.api?.adj.resetSub(),
      'sub-size-p':()=>cmd('add','sub-font-size',4),'sub-size-m':()=>cmd('add','sub-font-size',-4),
      'open-eq':()=>this.openPanel('eq'),'open-info':()=>this.openPanel('info'),'open-playlist':()=>this.openPanel('playlist'),
      // v3.46.0: the picture's colours and zoom
      'open-picture':()=>this.openPanel('picture'),'fill-screen':()=>this.picture?.setFill(!this.picture.fill),
      'zoom-in':()=>this.picture?.zoomBy(1),'zoom-out':()=>this.picture?.zoomBy(-1),'zoom-reset':()=>this.picture?.resetView(true),
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
      'search-subs':()=>{this.openPanel('subsearch');this._fillSubSearch();},
      'check-update':()=>{this.api?.app.checkUpdate();this.showOSD('Checking for updates...');},
      'preferences':()=>{this.openPanel('settings');this._syncSettingsPanel();},
      'about':()=>this.openAbout(),
    };
    m[a]?.();
  }
  // The pin button and the right-click menu's "Always on top" (v3.27.0).
  toggleAlwaysOnTop(){
    this.alwaysOnTop=!this.alwaysOnTop;
    this.api?.win.alwaysTop(this.alwaysOnTop);
    el('mi-always-top')?.classList.toggle('active-opt',this.alwaysOnTop);
    this.showOSD(this.alwaysOnTop?'Always on top: ON':'Always on top: OFF');
  }
  // The keyboard shortcuts list (v3.30.0). While it is open it takes Esc and
  // ? first (capture phase, e.__bmHandled), so closing it never also stops
  // the film, the trap wireOverlayKeys guards the other overlays against.
  toggleShortcuts(force){
    const o=el('kb-overlay');if(!o)return;
    const open=force===undefined?o.classList.contains('hidden'):!!force;
    o.classList.toggle('hidden',!open);
    if(open)this._renderFeatureShortcuts();   // the keys features added (registry.js)
    if(open&&!this._kbWired){
      this._kbWired=true;
      o.addEventListener('mousedown',e=>{if(e.target===o)this.toggleShortcuts(false);});
      document.addEventListener('keydown',e=>{
        if(o.classList.contains('hidden'))return;
        if(e.key==='Escape'||e.key==='?'||e.code==='F1'){e.preventDefault();e.stopPropagation();e.__bmHandled=true;this.toggleShortcuts(false);}
      },true);
    }
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
    const dlg=['dlg-url','dlg-jump','dlg-speed','dlg-substyle','dlg-sleep'].find(shown);
    if(dlg)return{modal:true,close:()=>el(dlg)?.classList.add('hidden')};
    if(shown('ctx-panel'))return{modal:true,close:()=>this._closeCtxPanel()};
    if(shown('theme-customizer'))return{modal:true,close:()=>el('theme-customizer')?.classList.add('hidden')};
    if(el('lightbox')?.classList.contains('open'))return{modal:true,close:()=>window.bmGallery?._closeLB()};
    const panel=document.querySelector('.side-panel.open');
    if(panel)return{modal:false,close:()=>panel.classList.remove('open')};
    if(shown('resume-prompt'))return{modal:false,close:()=>el('resume-dismiss')?.click()};
    if(shown('md-browser'))return{modal:false,close:()=>window.bmMdBrowser?.hide()};   // v3.39.0
    return null;
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
  wireDialogs(){
    el('jump-go')?.addEventListener('click',()=>this._doJump());
    el('jump-cancel')?.addEventListener('click',()=>el('dlg-jump')?.classList.add('hidden'));
    el('jump-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')this._doJump();if(e.key==='Escape')el('dlg-jump')?.classList.add('hidden');});
    el('url-go')?.addEventListener('click',()=>{const u=el('url-input')?.value?.trim();if(u)this.playMedia([u]);el('dlg-url')?.classList.add('hidden');});
    el('url-cancel')?.addEventListener('click',()=>el('dlg-url')?.classList.add('hidden'));
    el('url-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')el('url-go')?.click();if(e.key==='Escape')el('dlg-url')?.classList.add('hidden');});
  }
  _doJump(){const raw=el('jump-input')?.value?.trim();if(!raw)return;const parts=raw.split(':').map(Number);const secs=parts.length===3?parts[0]*3600+parts[1]*60+parts[2]:parts.length===2?parts[0]*60+parts[1]:parts[0];if(!isNaN(secs))this.seekTo(secs);el('dlg-jump')?.classList.add('hidden');if(el('jump-input'))el('jump-input').value='';}

  async openDialog(append=false){const files=await this.api?.dialog.open();if(!files?.length)return;if(append)files.forEach(f=>this.api?.mpv.append(f));else this.playMedia(files);}
  wireDragDrop(){const ov=el('drop-overlay');document.addEventListener('dragover',e=>{e.preventDefault();ov?.classList.add('active');});document.addEventListener('dragleave',e=>{if(!e.relatedTarget)ov?.classList.remove('active');});document.addEventListener('drop',e=>{e.preventDefault();ov?.classList.remove('active');if(e.__bmHandled)return;const files=[...(e.dataTransfer?.files||[])].map(f=>this.api?.files?.pathOf?.(f)||f.path).filter(Boolean);if(files.length)this.playMedia(files);});}   // pathOf (v3.39.0): File.path is gone from Electron
  showOSD(msg,ms=1600){const e=el('osd');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(this.osdTimer);this.osdTimer=setTimeout(()=>e.classList.remove('show'),ms);}
  emitPlugin(event,data){(this._pluginListeners[event]||[]).forEach(cb=>{try{cb(data);}catch(err){console.error('Plugin listener error on "'+event+'":',err);}});}
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
}
