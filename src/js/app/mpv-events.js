/**
 * What mpv says (v3.47.0, from app.js): its reports turned into the page's state, and carrying
 * on after mpv is started again.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { setPlaying } from '../icons.js';
import settings from '../modules/settings.js';
import history from '../modules/history.js';
import { applySubStyle } from '../sub-style.js';
import { el, fmtSec } from '../util.js';

export default class MpvEventsFeature {
  listenMpv(){
    this.api?.mpv.onStatus?.(s=>{
      const st=el('tb-status');
      if(s.state==='missing'){this.showOSD('mpv not found - install mpv first',5000);if(st)st.textContent='mpv missing';}
      if(s.state==='crashed'){if(st)st.textContent='mpv stopped, starting it again';this._noteCrash();}
      if(s.state==='retrying-minimal'){if(st)st.textContent='mpv retrying with reduced options...';}
      if(s.state==='crash-loop'){this.showOSD('mpv could not keep running. Check that mpv is installed correctly. It is tried again when you open a file',7000);if(st)st.textContent='mpv stopped';}
      // ── v1.7.0: apply persisted subtitle settings once mpv is ready ──
      if(s.state==='ready'){
        settings.applyToMpv(this.api?.mpv); applySubStyle(this.api); this._mpvReadyHook?.();   // the subtitle look from the start too (v3.39.0)
        if(st)st.textContent='';   // "restarting" stayed in the title bar for good
        this.picture?.applyAll(); this._applyEQ();   // the picture and the sound as set (v3.46.0)
        this._carryOn();
      }
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
        // The other play buttons too (v3.43.1): a film whose pause came before
        // mpv left idle showed play on them while it played.
        for(const id of ['mmp-play','pip-play','viz-btn-play']){ const b=el(id); if(b) setPlaying(b,this.isPlaying); }
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
      // While the in-app engine plays a song, Now Playing is the music's. mpv
      // tells its own (empty) title and length when it connects, and on a
      // start soon after the app opened that came after the song had begun:
      // "Nothing playing", 0:00 of 0:00, over a song that played (v3.46.0).
      const musicOwns=!!window.bmMusic?.engineOwns?.();
      if(p.name==='duration'){this.duration=p.data||0;this.setTime('time-total',this.duration);const tot=el('np-time-tot');if(tot&&!musicOwns)tot.textContent=fmtSec(this.duration);this._renderBookmarksOnSeekbar();
        // Loaded again after mpv was restarted: back to the place (v3.46.0).
        const c=this._crashSeek; if(c&&p.data>0){ this._crashSeek=null; if(c.t>2&&c.t<p.data-1)this.seekTo(c.t); if(c.paused)this.togglePlay(); }}   // opened playing: paused again
      if(p.name==='volume'){const sl=el('volume-slider');if(sl)sl.value=p.data;const l=el('vol-label');if(l)l.textContent=Math.round(p.data);}
      if(p.name==='mute'){this._muted=!!p.data;this.updateMuteIcon(p.data);}
      // mpv moved on to another file (a playlist, the end of the last one):
      // turning and mirroring were for the file before (v3.38.0).
      if(p.name==='filename'&&p.data&&p.data!==this._tfFile){this._tfFile=p.data;this.transform?.reset(true);}
      if(p.name==='media-title'&&!musicOwns){const t=el('title-text');if(t)t.textContent=p.data||'';const np=el('np-title');if(np)np.textContent=p.data||'Nothing playing';
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
    // here: music in the in-app engine steps aside for them too. So does every
    // song the music gives mpv, and that is not a film (v3.46.0): taken for
    // one, it put the film's speed back over the song's, and lost track of
    // the song, so a broken one stopped the music instead of being passed over.
    this.api?.mpv.onOpened?.(files=>{
      const m=window.bmMusic;
      if(m?._mpvSong&&Array.isArray(files)&&files[0]===m._mpvSong) return;
      m?.yieldToPlayer?.();
    });
    this.api?.mpv.onMediaProps?.(props=>{this._mProps=props;});
  }
  // mpv crashed (v3.46.0). main.js starts it again, and the film or song it
  // was playing carries on from where it was. It was left to you to find the
  // file and the place again, and on Linux mpv did not even come back.
  _noteCrash(){
    const m=window.bmMusic, now=Date.now();
    const song=m?._mpvSong&&m._mpvSong===m.currentPath?m._mpvSong:null;
    const path=song||this._currentFilePath;
    this._afterCrash=null;
    if(!path||this.currentDash==='tv') return;   // the TV tab reconnects by itself
    // The same file brought mpv down again straight after it carried on: it
    // is the file. A song gives way to the next, a film stops.
    const again=this._crashedOn&&this._crashedOn.path===path&&now-this._crashedOn.at<20000;
    this._crashedOn={path,at:now};
    if(again){
      if(song){ this._afterCrash={path,song:true,skip:true}; return; }
      this.showOSD(`mpv stopped twice on ${path.split(/[\\/]/).pop()}. The file may be damaged`,6000);
      this.stop(); return;
    }
    this._afterCrash={path,song:!!song,t:this.currentTime||0,paused:!!this._lastPause};
  }
  _carryOn(){
    const c=this._afterCrash; this._afterCrash=null; if(!c) return;
    const m=window.bmMusic;
    // Something else was opened, or playing stopped, while mpv was away.
    if(c.song?m?.currentPath!==c.path:this._currentFilePath!==c.path) return;
    if(c.skip){ m.skipBroken(); return; }
    this._crashSeek=c;   // the place again once the file is loaded: 'duration' below
    if(c.song) m._mpvOpen(c.path); else this.api?.mpv.open([c.path]);
    this.showOSD(c.t>2?`mpv stopped and was started again. Carrying on from ${fmtSec(c.t)}`:'mpv stopped and was started again',4000);
  }
}
