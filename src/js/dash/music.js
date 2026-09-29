/**
 * BM Player — Music dashboard
 *
 * Library rail, track list, Now Playing panel, queue, shuffle and repeat.
 *
 * mpv's playlist only ever holds one file (play() calls mpv.open([fp])), so
 * the queue here is the real playlist — transport controls and end-of-track
 * advancement both go through it rather than through mpv's own playlist
 * commands.
 */

import { el, fileURL, fmtSec, seedGrad, cleanTitle, pickFolder } from '../util.js';
import { setIcon, setPlaying } from '../icons.js';
import { Visualizer } from '../visualizer.js';
import { AudioEngine } from '../audio-engine.js';

export class MusicDash{constructor(api){this.api=api;
  // Renderer-side playback for audio-only files. Video always stays on mpv.
  // Off by default is the wrong default here — the whole point is the real
  // analyser — but one localStorage key turns it off if a codec misbehaves.
  this.engineEnabled = localStorage.getItem('bm_audio_engine') !== '0'
    && (window.__BM_FLAGS__?.audioEngine !== false);
  this.engine = new AudioEngine();
  if (this.engine.available) this._wireEngine();
  else this.engineEnabled = false;
  this._filter='';
  this.shuffle=localStorage.getItem('bm_music_shuffle')==='1';
  this.repeat=localStorage.getItem('bm_music_repeat')||'off';this.folders=JSON.parse(localStorage.getItem('bm_music_folders')||'[]');this.tracks=[];this.queue=[];this.queueIdx=-1;this.currentPath=null;this._dur={};this._activePath=null;console.log('[MusicDash] Initialized, API:', !!api);this._wire();this.folders.forEach(f=>this._addFolder(f));if(this.folders.length)this._load(this.folders[0]);}
_wire(){
  // Folder picker
  el('btn-music-open')?.addEventListener('click',async()=>{
    const folder = await pickFolder(this.api);
    if(!folder || this.folders.includes(folder)) return;
    this.folders.push(folder);
    localStorage.setItem('bm_music_folders', JSON.stringify(this.folders));
    this._addFolder(folder);
    this._load(folder);
  });
  const ae=el('set-audio-engine');
  if(ae){
    ae.checked=this.engineEnabled;
    ae.addEventListener('change',e=>{
      this.engineEnabled=e.target.checked&&this.engine.available;
      localStorage.setItem('bm_audio_engine',this.engineEnabled?'1':'0');
      // Switching engines mid-track would leave the other one holding the
      // file, so stop cleanly and let the next play() pick the new path.
      if(window.bmApp) window.bmApp._stopAllAudio(); else this.engine.stop();
      window.bmApp?.showOSD?.(this.engineEnabled?'In-app audio engine on':'Using mpv for audio');
    });
  }
  el('np-btn-shuffle')?.addEventListener('click',()=>this._toggleShuffle());
  el('np-btn-repeat')?.addEventListener('click',()=>this._cycleRepeat());
  el('music-filter')?.addEventListener('input',e=>{
    clearTimeout(this._mFilterTimer);
    this._mFilterTimer=setTimeout(()=>{ this._filter=e.target.value; this._resort(); },180);
  });
  el('music-group')?.addEventListener('click',()=>{
    this.groupByAlbum=!this.groupByAlbum;
    el('music-group')?.classList.toggle('active',this.groupByAlbum);
    this._resort();
  });
  // Restore the persisted toggle states into the UI
  if(this.shuffle){ const b=el('np-btn-shuffle'); if(b){b.classList.add('active');b.title='Shuffle (on)';} }
  if(this.repeat!=='off'){
    const b=el('np-btn-repeat');
    if(b){ b.classList.add('active'); setIcon(b,this.repeat==='one'?'repeatOne':'repeat'); b.title='Repeat ('+this.repeat+')'; }
  }
  el('music-sort')?.addEventListener('change',e=>this._renderTracks(this._sorted(this.tracks,e.target.value)));
  // Seekbar click
  // Seek bar. It sent time-pos to mpv, which is idle whenever the in-app
  // engine is playing, and it needed a tag duration the engine doesn't need.
  const st=el('np-seek-track');st?.addEventListener('click',e=>{
    const dur=this.engineOwns()?this.engine.duration:(this._dur[this.currentPath]||window.bmApp?.duration||0);
    if(!this.currentPath||!dur)return;
    const r=st.getBoundingClientRect();
    const pct=Math.max(0,Math.min(1,(e.clientX-r.left)/(r.width||1)));
    window.bmApp?.seekTo(pct*dur);
  });
  // Transport controls in Now Playing panel
  el('np-btn-play')?.addEventListener('click',()=>this.toggle());
  el('np-btn-prev')?.addEventListener('click',()=>{const p=Math.max(0,(this.queueIdx||0)-1);if(this.queue?.[p])this.play(this.queue[p].path,p);});
  el('np-btn-next')?.addEventListener('click',()=>this.advance());
  // Stop. It only stopped mpv and changed the icon, so with the in-app engine
  // playing, the music kept going while the button said stopped. A full stop
  // now, staying on this tab.
  el('np-btn-stop')?.addEventListener('click',()=>window.bmApp?.stop({stay:true}));
  // Volume in Now Playing panel
  el('np-volume')?.addEventListener('input',e=>{window.bmApp?.setVolume(+e.target.value);const l=el('np-vol-label');if(l)l.textContent=e.target.value;});
  // Music visualizer
  // v1.9.0: skip in lite mode (canvas is display:none).
  if(!window.bmApp?.isLite){
    const mc=el('music-visualizer-canvas');
    if(mc&&!this._viz){this._viz=new Visualizer(mc);}
  }
  // mpv property sync
  this.api?.mpv?.onProp(p=>{
    if(p.name==='duration'&&this.currentPath){this._dur[this.currentPath]=p.data;const t=el('np-time-tot');if(t)t.textContent=fmtSec(p.data);}
    if(p.name==='time-pos'&&this.currentPath){const dur=this._dur[this.currentPath];if(dur&&dur>0){const pct=(p.data/dur)*100;const f=el('np-seek-fill');if(f)f.style.width=pct+'%';const c=el('np-time-cur');if(c)c.textContent=fmtSec(p.data);}}
    if(p.name==='pause'){const on=!p.data&&!!this.currentPath;   // idle mpv reports 'not paused'
      el('np-bars')?.classList.toggle('playing',on);const b=el('np-btn-play');if(b)setPlaying(b,on);}
    if(p.name==='volume'){const s=el('np-volume');if(s)s.value=p.data;const l=el('np-vol-label');if(l)l.textContent=Math.round(p.data);}
  });
}
_addFolder(fp){const s=el('music-lib-sections');if(!s)return;s.querySelector('.music-empty-lib')?.remove();const n=fp.split(/[\\/]/).pop();const d=document.createElement('div');d.className='music-folder-item';d.dataset.path=fp;d.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span class="mf-name">'+n+'</span>';d.addEventListener('click',()=>this._load(fp));s.appendChild(d);}
async _load(fp){
  this._activePath=fp;
  document.querySelectorAll('.music-folder-item').forEach(e=>e.classList.toggle('active',e.dataset.path===fp));
  const lbl=el('music-path-title');if(lbl)lbl.textContent=fp.split(/[\\/]/).pop();
  let files=[];
  try{ files=await this.api?.gallery?.scan(fp)||[]; }catch(e){ console.error('[MusicDash] scan failed',e); }
  const AUDIO=new Set(['mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka','m4b']);
  this.tracks=files.filter(f=>AUDIO.has(f.name.split('.').pop().toLowerCase()));
  this.tags=this.tags||{};
  this._filter='';
  const fi=el('music-filter'); if(fi) fi.value='';
  this._renderTracks(this._sorted(this.tracks,el('music-sort')?.value||'name'));
  this._buildQueue();
  this._loadTags(this.tracks);
}
// Tags are read in the main process and streamed back in batches so a large
// folder paints immediately and fills in real titles/artists/art behind it.
async _loadTags(tracks){
  if(!this.api?.music?.tags||!tracks.length)return;
  const token=this._tagToken=(this._tagToken||0)+1;
  const BATCH=60;
  // The old cap was a hard `i < 600`, so track 601 in a large library never
  // got tags and nothing said why. Now the whole folder is covered, with a
  // yield between batches so the UI thread stays responsive.
  for(let i=0;i<tracks.length;i+=BATCH){
    await new Promise(r=>setTimeout(r,0));
    if(token!==this._tagToken)return;                 // folder changed, abandon
    const paths=tracks.slice(i,i+BATCH).map(t=>t.path);
    let res=[];
    try{ res=await this.api.music.tags(paths)||[]; }catch(_){ return; }
    if(token!==this._tagToken)return;
    res.forEach(r=>{ if(r&&r.path){ this.tags[r.path]=r; if(r.duration)this._dur[r.path]=r.duration; } });
    this._renderTracks(this._sorted(this.tracks,el('music-sort')?.value||'name'));
    if(this.currentPath)this._applyTagsToNowPlaying(this.currentPath);
  }
}
_meta(t){
  const g=this.tags?.[t.path]||{};
  return {
    title:  g.title  || cleanTitle(t.name),
    artist: g.artist || t.path.split(/[\\/]/).slice(-2,-1)[0] || '',
    album:  g.album  || '',
    cover:  g.cover  || null,
    ext:    t.name.split('.').pop().toUpperCase()
  };
}
_applyTagsToNowPlaying(fp){
  const t=this.tracks.find(x=>x.path===fp);if(!t)return;
  const m=this._meta(t);
  const set=(id,v)=>{const e=el(id);if(e)e.textContent=v;};
  set('np-title',m.title);set('np-artist',m.artist);
  set('np-format',[m.ext,m.album].filter(Boolean).join(' · '));
  set('mv-current-title',m.title);set('mv-current-artist',m.artist);
  const ai=el('np-art-inner');
  if(ai&&m.cover){ ai.style.background='center/cover no-repeat url("'+fileURL(m.cover)+'")'; ai.innerHTML=''; }
  const mArt=el('mmp-art');
  if(mArt&&m.cover){ mArt.style.background='center/cover no-repeat url("'+fileURL(m.cover)+'")'; mArt.textContent=''; }
}
// Tags were parsed and then thrown away outside the row label. Artist, album,
// year and track number are all available — sorting by album then track number
// is the ordering people actually expect from a music library.
_sorted(t,by){
  let list=[...t];
  const q=(this._filter||'').trim().toLowerCase();
  if(q) list=list.filter(x=>{
    const m=this._meta(x);
    return (m.title+' '+m.artist+' '+m.album+' '+x.name).toLowerCase().includes(q);
  });
  const meta=x=>this._meta(x);
  const byName=(x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true,sensitivity:'base'});
  const str=(x,k)=>(meta(x)[k]||'\uffff').toLowerCase();   // untagged sorts last
  switch(by){
    case 'artist':
      list.sort((x,y)=>str(x,'artist').localeCompare(str(y,'artist'))
                    || str(x,'album').localeCompare(str(y,'album'))
                    || ((this.tags?.[x.path]?.trackNo||0)-(this.tags?.[y.path]?.trackNo||0))
                    || byName(x,y));
      break;
    case 'album':
      list.sort((x,y)=>str(x,'album').localeCompare(str(y,'album'))
                    || ((this.tags?.[x.path]?.trackNo||0)-(this.tags?.[y.path]?.trackNo||0))
                    || byName(x,y));
      break;
    case 'year':
      list.sort((x,y)=>((this.tags?.[y.path]?.year||0)-(this.tags?.[x.path]?.year||0))||byName(x,y));
      break;
    case 'type':
      list.sort((x,y)=>(x.name.split('.').pop()||'').localeCompare(y.name.split('.').pop()||'')||byName(x,y));
      break;
    default:
      list.sort(byName);
  }
  return list;
}

_resort(){
  this._renderTracks(this._sorted(this.tracks, el('music-sort')?.value||'name'));
  const c=el('music-count');
  if(c){
    const n=this._visible?.length||0;
    c.textContent=this._filter?.trim()? n+' of '+this.tracks.length : this.tracks.length+' tracks';
  }
}

// ── Shuffle ────────────────────────────────────────────────────────
// Fisher-Yates over a copy, with the current track pinned to the front so
// toggling shuffle mid-song doesn't restart you somewhere else.
_buildQueue(){
  const order=this._visible?.length?[...this._visible]:[...this.tracks];
  if(!this.shuffle){ this.queue=order; }
  else{
    const q=[...order];
    for(let i=q.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [q[i],q[j]]=[q[j],q[i]]; }
    if(this.currentPath){
      const at=q.findIndex(t=>t.path===this.currentPath);
      if(at>0){ const [cur]=q.splice(at,1); q.unshift(cur); }
    }
    this.queue=q;
  }
  this.queueIdx=Math.max(0,this.queue.findIndex(t=>t.path===this.currentPath));
  this._renderQueue();
}

// repeat: 'off' -> 'all' -> 'one'
_cycleRepeat(){
  const order=['off','all','one'];
  this.repeat=order[(order.indexOf(this.repeat||'off')+1)%3];
  const b=el('np-btn-repeat');
  if(b){
    b.classList.toggle('active',this.repeat!=='off');
    setIcon(b,this.repeat==='one'?'repeatOne':'repeat');
    b.title='Repeat ('+this.repeat+')';
  }
  localStorage.setItem('bm_music_repeat',this.repeat);
  return this.repeat;
}
_toggleShuffle(){
  this.shuffle=!this.shuffle;
  const b=el('np-btn-shuffle');
  if(b){ b.classList.toggle('active',this.shuffle); b.title='Shuffle ('+(this.shuffle?'on':'off')+')'; }
  localStorage.setItem('bm_music_shuffle',this.shuffle?'1':'0');
  this._buildQueue();
}

// Called when mpv reports end-of-file for the current track.
advance(){
  if(this.repeat==='one'&&this.currentPath){ this.play(this.currentPath,this.queueIdx); return; }
  const next=this.queueIdx+1;
  if(next<this.queue.length){ this.play(this.queue[next].path,next); return; }
  if(this.repeat==='all'&&this.queue.length){
    if(this.shuffle) this._buildQueue();
    this.play(this.queue[0].path,0);
  }
}

_renderTracks(tracks){
  const c=el('music-tracks');if(!c)return;
  this._visible=tracks;this._tpage=0;
  if(!tracks.length){
    c.innerHTML='<div class="music-empty-tracks"><div style="font-size:48px;margin-bottom:8px">&#127911;</div><p>No audio files</p></div>';
    return;
  }
  c.innerHTML='';
  this._renderTrackPage();
}
// Album headers turn a flat file list into something that reads like a
// library. Only meaningful once tags have arrived, so it's a toggle.
_albumHeader(t){
  const m=this._meta(t);
  return (m.album||'Unknown album')+' \u2014 '+(m.artist||'Unknown artist');
}
_renderTrackPage(){
  const c=el('music-tracks');if(!c)return;
  const PAGE=100, s=this._visible||[];
  const start=this._tpage*PAGE, slice=s.slice(start,start+PAGE);
  if(!slice.length)return;
  el('tracks-sentinel')?.remove();
  const g=seedGrad(this._activePath||'');
  if(this._tpage===0) this._lastAlbumKey=null;
  const frag=document.createDocumentFragment();
  slice.forEach((t,n)=>{
    const i=start+n, m=this._meta(t), isP=t.path===this.currentPath;
    const dur=this._dur[t.path]?fmtSec(this._dur[t.path]):'';
    const row=document.createElement('div');
    row.className='track-row'+(isP?' playing':'');
    row.dataset.path=t.path; row.dataset.idx=i;
    row.tabIndex=0; row.setAttribute('role','button');
    row.setAttribute('aria-label',m.title+(m.artist?' by '+m.artist:''));

    const num=document.createElement('span');
    num.className='tr-num'; num.textContent=String(i+1);

    const art=document.createElement('div');
    art.className='tr-art';
    if(m.cover) art.style.background='center/cover no-repeat url("'+fileURL(m.cover)+'")';
    else if(isP) art.style.background=g;
    else { art.innerHTML='<span style="opacity:.3"></span>'; setIcon(art.firstChild,'music'); }
    if(isP&&!m.cover) setIcon(art,'play');

    const info=document.createElement('div');
    info.className='tr-info';
    const nm=document.createElement('div');
    // CRITICAL: this was string-concatenated into innerHTML. A file called
    // 'Rock & Roll <live>.mp3' broke the row markup.
    nm.className='tr-name'; nm.textContent=m.title;
    const meta=document.createElement('div');
    meta.className='tr-meta'; meta.textContent=[m.artist,m.album,m.ext].filter(Boolean).join(' · ');
    info.appendChild(nm); info.appendChild(meta);

    const d=document.createElement('span');
    d.className='tr-dur'; d.textContent=dur;
    const pb=document.createElement('div');
    pb.className='tr-play-btn'; setIcon(pb,'play');

    if(this.groupByAlbum){
      const key=this._albumHeader(t);
      if(key!==this._lastAlbumKey){
        this._lastAlbumKey=key;
        const hd=document.createElement('div');
        hd.className='track-album-header';
        hd.textContent=key;
        frag.appendChild(hd);
      }
    }
    row.append(num,art,info,d,pb);
    const go=()=>this.play(t.path,i);
    row.addEventListener('click',go);
    row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
    frag.appendChild(row);
  });
  c.appendChild(frag);
  this._tpage++;
  if(this._tpage*PAGE<s.length){
    const sent=document.createElement('div');
    sent.id='tracks-sentinel'; sent.style.height='1px';
    c.appendChild(sent);
    this._tio?.disconnect();
    this._tio=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))this._renderTrackPage();},{root:c,rootMargin:'500px'});
    this._tio.observe(sent);
  }
}  // The mpv path gets its UI updates from property-change events in
  // BMPlayer. The engine has to drive the same elements itself.
  _wireEngine(){
    const e=this.engine;
    e.on('loaded', d=>{
      const tot=el('np-time-tot'); if(tot)tot.textContent=fmtSec(d.duration);
      if(window.bmApp) window.bmApp.duration=d.duration;
    });
    e.on('time', d=>{
      if(!e.active) return;
      const pct=d.duration?(d.time/d.duration*100):0;
      const cur=el('np-time-cur'); if(cur)cur.textContent=fmtSec(d.time);
      const fill=el('np-seek-fill'); if(fill)fill.style.width=pct+'%';
      const mfill=el('mmp-progress-fill'); if(mfill)mfill.style.width=pct+'%';
      const app=window.bmApp;
      if(app){
        app.currentTime=d.time; app.duration=d.duration;
        // The main controls bar only listened to mpv, so during in-app
        // playback it sat at 0:00 / 0:00. Seen on the Video tab on Windows.
        app.setTime?.('time-current', d.time);
        app.setTime?.('time-total', d.duration);
        if(!app.isSeeking) app.setSeekPct?.(pct/100);
      }
    });
    e.on('play', ()=>this._engineState(true));
    e.on('pause',()=>this._engineState(false));
    e.on('ended',()=>this.advance());
    // Decoder gave up mid-file: hand this track to mpv rather than skipping it.
    e.on('fallback', d=>{
      if(!d.path) return;
      this.engine.active=false;
      this.api?.mpv?.open([d.path]);
      window.bmApp?.showOSD?.('Codec unsupported in-app, using mpv');
    });
  }

  /** Give a visualiser the engine's analyser, if the engine is playing.
   *  The Video tab's visualiser is created the first time that tab opens,
   *  usually after a track has started, so handing the analyser over only at
   *  play() meant it never got one: synthetic bars instead of the music. */
  attachVisualiser(v){
    if(!v || !this.engineOwns?.()) return false;
    const a=this.engine.analyser; if(!a) return false;
    v.analyser=a; v.freqData=new Uint8Array(a.frequencyBinCount); v.timeData=new Uint8Array(a.fftSize);
    return true;
  }

  /** A video is taking over. Stop the in-app engine, so the music does not
   *  keep playing under the film, and keep its late 'pause' event from
   *  marking the whole app as stopped: mpv may already be unpaused and then
   *  never reports a change, so nothing would correct it. Found when a test
   *  tone outlasted its step: PiP then refused, as nothing was "playing". */
  yieldToPlayer(){
    if(!this.engineOwns?.()) return false;
    this._yielding=true;
    this.engine.stop();
    clearTimeout(this._yieldT);
    this._yieldT=setTimeout(()=>{ this._yielding=false; },800);
    return true;
  }

  _engineState(playing){
    if(window.bmApp && !this._yielding){
      window.bmApp.isPlaying=playing;
      window.bmApp.isPaused=!playing;
    }
    // Not body.playing: that is the video state, which slides the sidebar
    // away and fades the title bar and menus so the picture gets the window.
    // Setting it for music hid the sidebar, so there was no way to leave the
    // Music tab and the mini player never appeared (reported on a real
    // machine). app.js already clears it for audio mpv plays.
    el('np-bars')?.classList.toggle('playing',playing);
    for (const id of ['np-btn-play', 'mmp-play', 'viz-btn-play']) setPlaying(el(id), playing);
    // The main controls bar's button too: it showed play while music played.
    if(!this._yielding) window.bmApp?.updatePlayIcon?.();
    window.bmApp?._updateMiniPlayer?.();
  }

  /** True when this engine, not mpv, owns what is currently playing. */
  engineOwns(){ return !!(this.engineEnabled && this.engine?.available && this.engine.active); }

  toggle(){
    if(this.engineOwns()) return this.engine.toggle();
    this.api?.mpv?.cmd('cycle','pause');
  }


play(fp,idx){
    this.currentPath=fp;this.queueIdx=idx;
    const useEngine=this.engineEnabled&&this.engine.available&&this.engine.canPlay(fp);
    if(useEngine){
      // Stop mpv first or both would play at once.
      this.api?.mpv?.cmd('stop');
      this.engine.load(fileURL(fp),fp,true);
      // Hand the visualiser a real analyser. It already prefers one over its
      // synthetic fallback; it has simply never been given one.
      const a=this.engine.getAnalyser();
      if(a){
        if(this._viz){ this._viz.analyser=a; this._viz.freqData=new Uint8Array(a.frequencyBinCount); this._viz.timeData=new Uint8Array(a.fftSize); }
        if(window.bmApp?.viz){ const v=window.bmApp.viz; v.analyser=a; v.freqData=new Uint8Array(a.frequencyBinCount); v.timeData=new Uint8Array(a.fftSize); }
      }
    }else{
      if(!this.api?.mpv)return;
      this.engine.stop();
      this.api.mpv.open([fp]);
    }
    const _m=this.tags?.[fp]||{};const title=_m.title||cleanTitle(fp.split(/[\\/]/).pop());const folder=fp.split(/[\\/]/).slice(0,-1).pop()||'';const ext=fp.split('.').pop().toUpperCase();const g=seedGrad(folder);const ai=el('np-art-inner');if(ai){ai.style.background=g;ai.innerHTML='<span class="np-art-placeholder" style="opacity:.5"></span>';setIcon(ai.firstChild,'music');}const gl=el('np-glow');if(gl){gl.style.background=g;gl.style.opacity='.5';}el('np-art')?.classList.add('has-track');const nt=el('np-title');if(nt)nt.textContent=title;const na=el('np-artist');if(na)na.textContent=_m.artist||folder;const nf=el('np-format');if(nf)nf.textContent=ext;el('np-bars')?.classList.add('playing');const mvt=el('mv-current-title');if(mvt)mvt.textContent=title;const mva=el('mv-current-artist');if(mva)mva.textContent=folder;this._viz?.setMode('bars');this._viz?.start();this._renderTracks(this._sorted(this.tracks,el('music-sort')?.value||'name'));this._renderQueue();this._applyTagsToNowPlaying(fp);}
_renderQueue(){
  const q=el('np-queue');if(!q)return;
  const next=this.queue.slice(this.queueIdx+1,this.queueIdx+6);
  q.innerHTML='';
  if(!next.length){
    const e=document.createElement('div');
    e.style.cssText='font-size:11.5px;color:var(--text-muted);padding:6px 8px';
    e.textContent='End of queue'; q.appendChild(e); return;
  }
  next.forEach((t,i)=>{
    const d=document.createElement('div');
    d.className='np-q-item'; d.tabIndex=0; d.setAttribute('role','button');
    d.textContent=this._meta(t).title;      // was unescaped innerHTML
    const idx=this.queueIdx+1+i;
    const go=()=>this.play(t.path,idx);
    d.addEventListener('click',go);
    d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
    q.appendChild(d);
  });
}}

// ── PDF ────────────────────────────────────────────────────────
