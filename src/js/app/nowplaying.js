/**
 * What is playing (v3.47.0, from app.js): the welcome screen and its rows, the play bar, the seek
 * bar and its pictures, the volume, the mini bar and the controls fading over a film.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { setTogglePair, setPlaying } from '../icons.js';
import settings from '../modules/settings.js';
import { wireRows, renderRows } from '../favourites.js';
import { el, fmtSec } from '../util.js';

export default class NowPlayingFeature {
  wireWelcome(){
    el('btn-open-welcome')?.addEventListener('click',()=>this.openDialog());
    el('btn-open-url-welcome')?.addEventListener('click',()=>{el('dlg-url')?.classList.remove('hidden');el('url-input')?.focus();});
    el('btn-clear-recent')?.addEventListener('click',()=>{this.recent=[];localStorage.removeItem('bm_recent');this.renderRecent();});
    wireRows(this);   // v3.43.0: the recent and favourite rows (favourites.js)
  }
  // The rows are drawn by favourites.js (v3.43.0). The recent one put each
  // file's name into the page as it was, and was drawn only at start, so a
  // file just played was not in it until the next start.
  renderRecent(){ renderRows(); }
  addRecent(f){this.recent=[f,...this.recent.filter(r=>r!==f)].slice(0,20);localStorage.setItem('bm_recent',JSON.stringify(this.recent));this.api?.app.addRecent(f);this.renderRecent();}
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
  updatePlayIcon(){setTogglePair('btn-play',!this.isPlaying);}
  updateMuteIcon(m){setTogglePair('btn-mute',!m);}
  // The seek bar. A drag moved the bar but did not seek: the film stayed
  // where the press was, and the bar went back there once let go (v3.46.0).
  // Now the picture follows the drag, to the nearest keyframe as it goes and
  // exactly where it is let go, also off the bar. Above it, a picture of the
  // film at that place, made by a second mpv (thumbs.js), as KMPlayer has.
  wireSeek(){
    const sc=el('seek-container');if(!sc)return;let drag=false,lastP=0,lastSeek=0,endT=0;
    const getPct=e=>{const r=sc.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/(r.width||1)));};
    const box=el('seek-preview'),img=el('seek-preview-img');
    const show=p=>{const pt=el('seek-preview-time');if(pt)pt.textContent=fmtSec(p*this.duration);if(box){const w=sc.clientWidth,half=(box.offsetWidth||0)/2;box.style.left=Math.max(half,Math.min(w-half,p*w))+'px';}this._seekThumb(p);};
    sc.addEventListener('mousedown',e=>{if(e.button!==0)return;e.preventDefault();drag=true;clearTimeout(endT);this.isSeeking=true;sc.classList.add('dragging');const p=lastP=getPct(e);this.setSeekPct(p);show(p);this.seekTo(p*this.duration);lastSeek=performance.now();});
    sc.addEventListener('mousemove',e=>{if(!drag)show(getPct(e));});
    document.addEventListener('mousemove',e=>{
      if(!drag)return;
      const p=lastP=getPct(e);this.setSeekPct(p);show(p);
      const now=performance.now();if(now-lastSeek>140&&this.duration>0){lastSeek=now;this.seekTo(p*this.duration,true);}
    });
    document.addEventListener('mouseup',()=>{
      if(!drag)return;drag=false;sc.classList.remove('dragging');
      if(this.duration>0)this.seekTo(lastP*this.duration);
      // the position mpv reports from before the seek does not pull the bar back
      endT=setTimeout(()=>{this.isSeeking=false;},300);
    });
    sc.addEventListener('mouseleave',()=>{if(!drag)this._thumbWant=null;});
    if(img)img.addEventListener('error',()=>box?.classList.remove('has-pic'));
  }
  /** The seek bar's picture for a place along it, p from 0 to 1 (v3.46.0). Films on this computer only. */
  _seekThumb(p){
    const box=el('seek-preview'),img=el('seek-preview-img'),f=this._currentFilePath,d=this.duration;
    if(!box||!img)return;
    if(!f||!this._hasVideo||!(d>0)||/^[a-z][a-z0-9+.-]*:\/\//i.test(f)||!this.api?.mpv?.thumbAt){box.classList.remove('has-pic');this._thumbFile=null;return;}
    if(this._thumbFile!==f){this._thumbFile=f;box.classList.remove('has-pic');}
    // about three hundred places along a film: the pictures are of keyframes anyway
    const step=Math.max(1,d/300),t=Math.max(0,Math.min(d-0.5,Math.round(p*d/step)*step)),key=f+'\n'+t.toFixed(1);
    const cache=this._thumbs||(this._thumbs=new Map());
    this._thumbWant=key;
    if(cache.has(key)){img.src=cache.get(key);box.classList.add('has-pic');return;}
    clearTimeout(this._thumbT);
    this._thumbT=setTimeout(async()=>{
      let url=null;try{url=await this.api.mpv.thumbAt(f,t);}catch(_){}
      if(url){cache.set(key,url);if(cache.size>150)cache.delete(cache.keys().next().value);}
      if(this._thumbWant!==key||this._thumbFile!==f||!url)return;   // the pointer moved on, or another film
      img.src=url;box.classList.add('has-pic');
    },70);
  }
  setSeekPct(p){const sf=el('seek-fill'),st=el('seek-thumb');if(sf)sf.style.width=(p*100)+'%';if(st)st.style.left=(p*100)+'%';}
  setTime(id,s){const e=el(id);if(e)e.textContent=fmtSec(s);}
  wireVolume(){
    const sl=el('volume-slider');if(!sl)return;
    sl.addEventListener('input',()=>{const v=+sl.value;this.setVolume(v);const l=el('vol-label');if(l)l.textContent=v;});
    el('btn-mute')?.addEventListener('click',()=>this.toggleMute());
  }
  bumpVolume(d){const sl=el('volume-slider');if(!sl)return;const v=Math.max(0,Math.min(130,+sl.value+d));sl.value=v;this.setVolume(v);const l=el('vol-label');if(l)l.textContent=v;this.showOSD('Volume: '+v+'%');}
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
  wireControlsHide(){
    const bar=el('controls-bar'),tb=el('titlebar'),mt=el('menu-toolbar');
    // v3.43.0: not while the pointer is on the title bar or the menus either
    // (a menu held open there, with the mouse still, faded away with them),
    // and _wakeControls() starts the count when the visual mode opens, so the
    // bars go even before the mouse moves.
    const over=()=>bar?.matches(':hover')||tb?.matches(':hover')||mt?.matches(':hover');
    const show=()=>{bar?.classList.remove('faded');tb?.classList.remove('faded-top');mt?.classList.remove('faded-top');clearTimeout(this.hideTimer);if(this._anyPlaying())this.hideTimer=setTimeout(()=>{if(this._anyPlaying()&&!over()){bar?.classList.add('faded');tb?.classList.add('faded-top');mt?.classList.add('faded-top');}},3000);};
    this._wakeControls=show;
    document.addEventListener('mousemove',show);
    bar?.addEventListener('mouseenter',()=>{clearTimeout(this.hideTimer);bar.classList.remove('faded');});
    bar?.addEventListener('mouseleave',()=>{if(this._anyPlaying())this.hideTimer=setTimeout(()=>bar?.classList.add('faded'),2500);});
  }
}
