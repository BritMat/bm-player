/**
 * Picture-in-picture (v3.47.0, from app.js): its bar, its sizes and leaving it.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { Visualizer, vizSettings } from '../visualizer.js';
import { setPlaying } from '../icons.js';
import { el } from '../util.js';

export default class PipFeature {
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
    // A double-click on the picture (v3.37.0): full screen and back, as in mpv
    // and VLC, for a video and for the visualiser alike. In PiP it brings the
    // window back, as it always has. Not on a control: two quick clicks on a
    // button are two clicks on that button.
    el('player-view')?.addEventListener('dblclick',e=>{
      if(this._pipActive){ this.togglePiP(false); return; }
      if(e.target?.closest?.('button,input,select,textarea,a,#controls-bar,.viz-transport')) return;
      this.api?.win.fullscreen();
    });
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
        // The bar's play button as things are (v3.43.1). It was set only when
        // playing changed, so it showed play over a film playing.
        const playingNow=window.bmMusic?.engineOwns?.()?!window.bmMusic.engine?.el?.paused:!!this.isPlaying;
        setPlaying(el('pip-play'),playingNow);
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
}
