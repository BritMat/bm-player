/**
 * The visuals (v3.47.0, from app.js): the home screen's fluid, scenes and fox, the visual mode
 * for music, Pro and Lite, play on the welcome screen, and everything resting when nobody sees it.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { Visualizer, vizSettings, saveVizSettings, allVisualisers, setSharedAnalyser, setSharedArt, sharedAnalyser } from '../visualizer.js';
import { setIcon } from '../icons.js';
import { perf } from '../perf.js';
import { power } from '../power.js';
import { FoxPlay } from '../play/fox-play.js';
import { el, fileURL } from '../util.js';
import liteMode from '../modules/lite-mode.js';
import { once } from '../lazy.js';

// The fox's voice, Flow and Fruit (v3.47.0) load the first time they are used,
// not at every start. The fox you can touch (fox-play.js) is the home screen
// itself, so it is there from the start as before.
const playPart = name => once('play:' + name, { voice: () => import('../play/fox-voice.js'),
  flow: () => import('../play/flow-toy.js'), fruit: () => import('../play/slice-game.js') }[name]);

export default class EffectsFeature {
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
      const shown=home&&!document.hidden&&!this._winHidden;
      const mode=this._playMode||'fox';
      const on=shown&&(mode!=='fox'||!power.idle);   // resting after two idle minutes (v3.39.0), with the fox only
      // v3.42.0: Flow and Fruit use the fluid alone; the fox and the scene wait.
      for(const fx of [this.fox,this.themeFX]){ try{ if(on&&mode==='fox')fx?.resume?.();else fx?.pause?.(); }catch(_){} }
      try{ if(on)this.auroraFX?.resume?.();else this.auroraFX?.pause?.(); }catch(_){}
      try{ if(on&&mode==='fox')this.foxPlay?.resume();else this.foxPlay?.pause(); }catch(_){}
      if(!shown){ try{ this.foxVoice?.stop(); if(this.sliceGame?.busy) this.sliceGame.pause(); }catch(_){} }
      this._foxMusic(on&&mode==='fox');
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
      // A song opened as a file (Open, a drop, a recent or favourite card)
      // showed an empty player with the music bar under it (v3.43.0). It gets
      // the visual mode, as music does when the Video tab opens.
      if(this.currentDash==='video'&&this.isPlaying&&!this._audioVizMode&&el('player-view')?.classList.contains('active')){ this.switchDest('video'); return; }
      // Show mini player bar if user is on video tab
      this._updateMiniPlayer();
    }
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
      if((this._playMode||'fox')!=='fox'){have=false;return;}   // Flow and Fruit take the pointer themselves (v3.42.0)
      const [x,y]=norm(e);
      if(have) this.auroraFX?.addPointer?.(x,y,x-px,y-py);
      px=x;py=y;have=true;
    });
    host.addEventListener('pointerleave',()=>{have=false;});
    host.addEventListener('pointerdown',e=>{
      if((this._playMode||'fox')!=='fox'||e.target.closest?.('#fox-stage, button'))return;
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

  // ── v1.8.0: Music energy -> Fox ────────────────────────────────
  // v3.42.0: it ran five times a second for as long as the app was open,
  // and waited for an audio context the visualiser never made, so the fox
  // never moved with the music. Now it runs only while the fox can be seen,
  // and listens to whatever analyser there is: the music view's engine, or
  // the shadow of a song mpv plays (audio-shadow.js).
  _startMusicEnergyLoop(){ this._musicEnergy=0; this._targetMusicEnergy=0; }
  _foxMusic(on){
    clearInterval(this._musicT); this._musicT=0;
    if(!on||!this.fox){ this.foxPlay?.setMusic?.(0); return; }
    let bins=null;
    this._musicT=setInterval(()=>{
      const a=window.bmMusic?.engine?.getAnalyser?.()||sharedAnalyser()||this.viz?.analyser;
      const playing=this._anyPlaying?.()||!!(window.bmMusic?.engine?.el&&!window.bmMusic.engine.el.paused);
      let target=0;
      if(a&&playing){
        try{
          if(!bins||bins.length!==a.frequencyBinCount) bins=new Uint8Array(a.frequencyBinCount);
          a.getByteFrequencyData(bins);
          let bass=0,mid=0;
          for(let i=1;i<9;i++)bass+=bins[i];
          for(let i=9;i<48;i++)mid+=bins[i];
          target=Math.min(1,(bass/8/255)*0.75+(mid/39/255)*0.4);
        }catch(_){ target=0; }
      }
      this._musicEnergy+=(target-this._musicEnergy)*0.35;
      if(this.foxPlay) this.foxPlay.setMusic(this._musicEnergy);
      else this.fox?.setMusicEnergy?.(this._musicEnergy);
      if(this._musicEnergy>0.6)this.fox?.setExpression?.('excited');
      else if(this._musicEnergy>0.25)this.fox?.setExpression?.('happy');
      else this.fox?.setExpression?.('neutral');
    },150);
  }

  // ── v3.42.0: play on the welcome screen ─────────────────────────
  // The fox to play with (tap, stroke, tickle, talk to it), Flow as a fluid
  // simulator, and a fruit slicing game: the same code as the phone's Home
  // tab (src/js/play). Nothing of it runs until it is used, and it stops
  // with the welcome screen (_syncEffects).
  wirePlayModes(){
    const ws=el('welcome-screen'), modes=el('welcome-modes');
    if(!ws||!modes)return;
    this._playMode='fox';
    const fox=this.fox;
    if(fox) this.foxPlay=new FoxPlay({ stage: el('fox-stage'), fox, fx: el('fox-fx') });
    // The fox's voice, made the first time Talk is pressed (v3.47.0).
    const voice=()=>playPart('voice').then(({ FoxVoice })=>this.foxVoice||(this.foxVoice=new FoxVoice({ fox, onState: (st, detail) => {
      const b=el('welcome-talk'), lbl=el('welcome-talk-label'); if(!b||!lbl)return;
      b.classList.toggle('on',['starting','listening','hearing','talking'].includes(st));
      lbl.textContent={starting:'Asking for the microphone…',listening:'Listening: say something',hearing:'Listening…',talking:'The fox is talking'}[st]||'Talk to the fox';
      if(st==='denied') this.showOSD('The microphone is not allowed. On Windows: Settings, Privacy, Microphone, let desktop apps use it.',4200);
      else if(st==='error') this.showOSD('The microphone could not be used: '+detail,3600);
      if(st==='listening'||st==='hearing'||st==='talking') this.foxPlay?.poke();
    } })));
    el('welcome-talk')?.addEventListener('click',async()=>{
      if(!fox){ this.showOSD('The fox needs WebGL to talk.'); return; }
      let v; try{ v=await voice(); }catch(e){ console.error('[BM Player] the fox\'s voice could not be loaded:',e); this.showOSD('The fox could not start listening'); return; }
      if(v.on){ v.stop(); return; }
      v.start();
    });
    // Flow and Fruit need the GPU fluid, which Lite mode leaves out.
    const can=!!this._fluidIsGPU&&!this.isLite;
    const icon={fox:'<svg viewBox="0 0 24 24"><path d="M4 3l4.2 4.6h7.6L20 3l-.9 9.2L12 21l-7.1-8.8z" fill="currentColor"/></svg>',
      flow:'<svg viewBox="0 0 24 24"><path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
      fruit:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5" fill="currentColor"/><path d="M12 6c0-2 1-3 3-3.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'};
    modes.innerHTML=[['fox','Fox'],['flow','Flow'],['fruit','Fruit']].filter(([k])=>k==='fox'||can).map(([k,l])=>`<button type="button" data-m="${k}" class="${k==='fox'?'on':''}" aria-pressed="${k==='fox'}">${icon[k]}<span>${l}</span></button>`).join('');
    modes.classList.toggle('hidden',!can);
    modes.addEventListener('click',e=>{const b=e.target.closest('button[data-m]');if(b)this.setPlayMode(b.dataset.m);});
    el('flow-close')?.addEventListener('click',()=>this.setPlayMode('fox'));
    el('flow-pause')?.addEventListener('click',()=>{ this.flowToy?.pause(); setIcon(el('flow-pause'),this.flowToy?.paused?'play':'pause'); });
    el('flow-clear')?.addEventListener('click',()=>this.flowToy?.clear());
    el('flow-burst')?.addEventListener('click',()=>this.flowToy?.burst());
    el('flow-settings')?.addEventListener('click',()=>{
      const p=el('flow-panel'); if(!p||!this.flowToy||!this._buildToyPanel)return;
      if(p.classList.contains('hidden')) this._buildToyPanel(this.flowToy,p,{tilt:false});
      p.classList.toggle('hidden');
    });
    // Esc: a game pauses, a play mode goes back to the fox.
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||(this._playMode||'fox')==='fox'||e.__bmHandled||!el('welcome-screen')?.classList.contains('active'))return;
      e.__bmHandled=true;
      if(!el('flow-panel')?.classList.contains('hidden')){ el('flow-panel').classList.add('hidden'); return; }
      if(this._playMode==='fruit'&&this.sliceGame?.busy){ this.sliceGame.pause(); return; }
      this.setPlayMode('fox');
    },true);
  }

  // Flow and Fruit are loaded the first time they are chosen (v3.47.0), so
  // this gives a promise, settled once the mode is in place.
  setPlayMode(m){
    const was=this._playMode||'fox';
    if(m===was||!el('welcome-screen'))return Promise.resolve();
    this._playMode=m;
    const ws=el('welcome-screen');
    ws.dataset.play=m;
    for(const b of el('welcome-modes')?.querySelectorAll('button')||[]){ const on=b.dataset.m===m; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); }
    el('flow-panel')?.classList.add('hidden');
    if(was==='flow') this.flowToy?.leave();
    if(was==='fruit'){ this.sliceGame?.stop(); if(this._fruitSaved){ this.auroraFX?.restore?.(this._fruitSaved); this._fruitSaved=null; } }
    if(was==='fox') this.foxVoice?.stop();
    const fx=this.auroraFX;
    let ready=Promise.resolve();
    // Each waits for its code the first time, and does nothing if the mode
    // was left again in those few milliseconds.
    if(m==='flow'&&fx){
      ready=playPart('flow').then(({ FlowToy, buildToyPanel })=>{
        this._buildToyPanel=buildToyPanel;
        if(this._playMode!=='flow')return;
        if(!this.flowToy) this.flowToy=new FlowToy({ fx, surface: el('flow-surface'), analyser: () => window.bmMusic?.engine?.getAnalyser?.()||sharedAnalyser() });
        this.flowToy.enter();
        setIcon(el('flow-pause'),'pause');
      });
    }
    if(m==='fruit'&&fx){
      this._fruitSaved=fx.snapshot();
      fx.configure(f=>{ f.setFlow({ intensity: 0.5, trail: 0.8 }); f.setBloom(0.35,{threshold:0.1,knee:0.7}); f.setNeon(false); });
      fx.audioDriven=true; fx.setMode('fluid');
      ready=playPart('fruit').then(({ SliceGame })=>{
        if(this._playMode!=='fruit'||this.sliceGame)return;
        this.sliceGame=new SliceGame({ canvas: el('slice-canvas'), ui: el('slice-ui'), onExit: () => this.setPlayMode('fox'),
          onJuice: (x,y,dx,dy,rgb,k=1) => { const c=fx.canvas; fx.splat(x,y,dx,dy,rgb.map(v=>v*0.28*k),0.0035*k*Math.max(1,c.width/Math.max(1,c.height))); } });
      });
    }
    if(m==='fox'){ const t=document.documentElement.getAttribute('data-theme')||'dark'; this.applyTheme?.(t); }
    this._syncEffects();
    return ready.catch(e=>{ console.error('[BM Player] '+m+' could not be loaded:',e); this.showOSD('That could not be loaded'); });
  }
}
