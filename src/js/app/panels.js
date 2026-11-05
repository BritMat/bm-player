/**
 * The side panels and the right-click menu (v3.47.0, from app.js): the equaliser, the playlist,
 * media info, and the track, subtitle and delay choices.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { setIcon } from '../icons.js';
import { lavfi } from '../sound-chain.js';
import { isFav, toggleFav } from '../favourites.js';
import { el, fmtSec } from '../util.js';
import { EQ_BANDS, EQ_PRESETS } from './eq-bands.js';

export default class PanelsFeature {
  wirePanels(){document.querySelectorAll('.panel-close').forEach(b=>b.addEventListener('click',()=>el('panel-'+b.dataset.panel)?.classList.remove('open')));}
  openPanel(name){document.querySelectorAll('.side-panel').forEach(p=>p.classList.remove('open'));const p=el('panel-'+name);if(!p)return;p.classList.add('open');if(name==='info')this.populateInfo();if(name==='playlist')this.renderPlaylistPanel();if(name==='fluid')this._refreshFluidPanel();if(name==='bookmarks')this._renderBookmarksPanel();if(name==='history')this._renderHistoryPanel();if(name==='settings')this._syncSettingsPanel();}
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
    // The equalizer's own presets only (v3.46.0). Every .eq-preset-btn was
    // taken for one, so the Fluid panel's quality buttons, and now the sound's
    // and the picture's, set the equalizer back to flat when pressed.
    const presets=[...document.querySelectorAll('#eq-presets .eq-preset-btn')];
    presets.forEach(btn=>{btn.addEventListener('click',()=>{presets.forEach(b=>b.classList.remove('active'));btn.classList.add('active');const vals=EQ_PRESETS[btn.dataset.p]||EQ_PRESETS.flat;this.eqValues=[...vals];EQ_BANDS.forEach((_,i)=>{const s=el('eq-s-'+i),v=el('eq-val-'+i);if(s)s.value=vals[i];if(v)v.textContent=(vals[i]>0?'+':'')+vals[i];});this._applyEQ();});});
    el('btn-reset-eq')?.addEventListener('click',()=>{document.querySelector('#eq-presets .eq-preset-btn[data-p="flat"]')?.click();this._setPreamp(0);});
    // The preamp (v3.49.0): the whole sound up or down before the bands. Kept between runs.
    this.eqPreamp=Math.max(-12,Math.min(12,+localStorage.getItem('bm_eq_preamp')||0));
    const pre=el('eq-preamp');
    if(pre){pre.value=this.eqPreamp;pre.addEventListener('input',e=>this._setPreamp(+e.target.value));pre.addEventListener('dblclick',()=>this._setPreamp(0));}
    this._showPreamp();
  }
  _setPreamp(db){
    this.eqPreamp=Math.max(-12,Math.min(12,+db||0));
    try{localStorage.setItem('bm_eq_preamp',String(this.eqPreamp));}catch(_){}
    const pre=el('eq-preamp');if(pre&&+pre.value!==this.eqPreamp)pre.value=this.eqPreamp;
    this._showPreamp();this._applyEQ();
  }
  _showPreamp(){const v=el('eq-preamp-val');if(v)v.textContent=(this.eqPreamp>0?'+':'')+(this.eqPreamp||0)+' dB';}
  _applyEQ(){
    // Two players, one set of sliders and effects: the engine plays the
    // library's songs and mpv everything else, and both are given the same
    // settings, made into each one's form by sound-chain.js (v3.47.0).
    // v3.49.0: the preamp, the sound mode and clear voice too. Slowed and
    // Nightcore also change a song's speed: the engine does that itself, and
    // for a song mpv plays the music view sets mpv's speed (applyRate).
    const fx=this.sound?.fx||{};
    const s={eq:this.eqValues,preamp:this.eqPreamp||0,night:!!fx.night,channels:fx.channels||'stereo',boost:(fx.boost||100)/100,mode:fx.mode||'off',voice:!!fx.voice};
    window.bmMusic?.engine?.setSound?.(s);
    window.bmMusic?.applyRate?.();
    this.api?.mpv.cmd('set_property','af',lavfi(s))?.catch?.(()=>{});}
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
    el('ctx-fav')?.addEventListener('click',()=>{const fp=this._currentFilePath;if(fp)this.showOSD(toggleFav(fp)?'Added to favourites: it is on the home screen':'Taken out of favourites');this._closeCtxPanel();});
    // mpv runs with --keep-open=yes, so the end of a file does NOT send
    // end-file. It sets eof-reached and pauses on the last frame. Verified
    // against real mpv 0.37 (scripts/integration-mpv.cjs). Advance on that.
    this.api?.mpv.onProp?.(p=>{
      if(p?.name!=='eof-reached') return;
      if(p.data!==true){
        this._eofHandled=false;
        // Off the end again (played on, another file): mpv goes on through its playlist as before.
        if(this._holdAtEnd){ this._holdAtEnd=false; this.api?.mpv.cmd('set_property','keep-open','yes'); }
        return;
      }
      if(this._eofHandled) return;           // one advance per end of file
      this._eofHandled=true;
      const m=window.bmMusic;
      // Only for audio mpv is playing. The in-app engine has its own 'ended'.
      if(m?.currentPath && !this._hasVideo && !m.engineOwns?.()) m.advance(true);
      // A film at its end, with the sleep timer set for the end of it (v3.46.0).
      // mpv is left holding there: let go now, with the next film in its
      // playlist, it would go straight on to it.
      else if(this._hasVideo&&this.sleep?.mode==='end'){ this._holdAtEnd=true; this.sleep.atEnd(); }
    });
    // Kept for keep-open=no, should that ever change.
    this.api?.mpv.onEvent?.(ev=>{
      if(ev?.event!=='end-file') return;
      // A file mpv could not play. This was ignored, so a broken file, a
      // missing codec or a video output that would not start left you looking
      // at an empty player with no explanation.
      if(ev.reason==='error'){
        // A song from the music list: on to the next one (v3.46.0).
        const m=window.bmMusic;
        if(m?._mpvSong&&m._mpvSong===m.currentPath){ m.skipBroken(); return; }
        // Late news of a file already replaced by a song the engine plays.
        if(m?.engineOwns?.()) return;
        const what=(this._lastOpened||'').split(/[\\/]/).pop()||'this file';
        this.showOSD(`Couldn't play ${what}${ev.file_error?': '+ev.file_error:''}`,4000);
        // The TV tab reports stream failures itself and retries, so leave it be.
        if(this.currentDash!=='tv') this.stop();
        return;
      }
      // 'eof' is a natural finish; 'stop'/'quit' mean the user did it.
      if(ev.reason && ev.reason!=='eof') return;
      const m=window.bmMusic;
      if(m?.currentPath && !this._hasVideo) m.advance(true);
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
    // The star for what is playing (v3.43.0): a file, not a stream.
    const fav=el('ctx-fav'),fp=this._currentFilePath;
    if(fav){ fav.classList.toggle('hidden',!fp); const on=!!fp&&isFav(fp); fav.classList.toggle('on',on); const l=fav.querySelector('.ctx-fav-lbl'); if(l) l.textContent=on?'Remove from favourites':'Add to favourites'; setIcon(fav.querySelector('.ctx-ico'),on?'starFill':'star'); }

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
      'rotate-right':()=>this.transform?.rotate(90),
      'mirror':      ()=>this.transform?.mirror(),
      'transform-reset':()=>this.transform?.reset(),
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
  renderTrackMenus(tracks){
    const audio=tracks.filter(t=>t.type==='audio'),video=tracks.filter(t=>t.type==='video'),subs=tracks.filter(t=>t.type==='sub');
    this._fillTrack('audio-track-sub',audio,'aid');this._fillTrack('video-track-sub',video,'vid');this._fillSubMenu('sub-track-sub',subs);this._fillSub2Menu('sub2-track-sub',subs);
  }
  // A second subtitle at the top of the picture (v3.46.0), as KMPlayer and
  // PotPlayer have: the film's own language with another underneath to learn
  // from, or two people watching in two languages. mpv's secondary-sid. In
  // mpv's track list a track chosen as the second has main-selection 1.
  _fillSub2Menu(id,subs){
    const c=el(id);if(!c)return;c.innerHTML='';
    if(subs.length<2){c.classList.add('hidden');return;}
    c.classList.remove('hidden');
    const second=subs.find(t=>t.selected&&t['main-selection']===1)||subs.find(t=>t.id===this._sid2)||null;
    const head=document.createElement('div');head.className='mr-head';head.textContent='Second subtitle, at the top';c.appendChild(head);
    const row=(label,on,fn)=>{const r=document.createElement('div');r.className='mr'+(on?' active-opt':'');r.textContent=(on?'✓ ':'')+label;r.addEventListener('click',fn);c.appendChild(r);};
    row('Off',!second,()=>this.setSecondSub(null));
    subs.filter(t=>!(t.selected&&t['main-selection']!==1)).forEach(t=>row(this._trackLabel(t),second?.id===t.id,()=>this.setSecondSub(t.id)));
  }
  /** id: a subtitle track's, or null for none. */
  setSecondSub(id){
    this._sid2=id||null;
    this.api?.mpv.cmd('set_property','secondary-sid',id||'no');
    if(id) this.api?.mpv.cmd('set_property','secondary-sub-visibility',true);
    const t=(this._lastTracks||[]).find(x=>x.type==='sub'&&x.id===id);
    this.showOSD(id?'Second subtitle: '+(t?this._trackLabel(t):id):'Second subtitle off');
  }
  _trackLabel(t){return[t.lang?'['+t.lang.toUpperCase()+']':'',t.title||t.codec||'Track '+t.id].filter(Boolean).join(' ');}
  _fillTrack(id,list,prop){const c=el(id);if(!c)return;c.innerHTML='';list.forEach(t=>{const row=document.createElement('div');row.className='mr'+(t.selected?' active-opt':'');row.textContent=(t.selected?'✓ ':'')+this._trackLabel(t);row.addEventListener('click',()=>this.api?.mpv.cmd('set_property',prop,t.id));c.appendChild(row);});}
  _fillSubMenu(id,subs){const c=el(id);if(!c)return;c.innerHTML='';subs=subs.map(t=>t.selected&&t['main-selection']===1?{...t,selected:false}:t);const off=document.createElement('div');off.className='mr'+(!subs.some(t=>t.selected)?' active-opt':'');off.textContent=(!subs.some(t=>t.selected)?'✓ ':'')+'Off';off.addEventListener('click',()=>this.api?.mpv.cmd('set_property','sub-visibility',false));c.appendChild(off);subs.forEach(t=>{const row=document.createElement('div');row.className='mr'+(t.selected?' active-opt':'');row.textContent=(t.selected?'✓ ':'')+this._trackLabel(t);row.addEventListener('click',()=>{this.api?.mpv.cmd('set_property','sub-visibility',true);this.api?.mpv.cmd('set_property','sid',t.id);});c.appendChild(row);});}
}
