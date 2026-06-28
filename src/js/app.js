import { Fox        } from './fox.js';
import { Visualizer } from './visualizer.js';
import { ThemeFX    } from './theme-fx.js';
import { applyIcons, setTogglePair } from './icons.js';

const EQ_BANDS=[31,62,125,250,500,1000,2000,4000,8000,16000].map((f,i)=>({freq:f,label:f<1000?String(f):f/1000+'K'}));
const EQ_PRESETS={flat:[0,0,0,0,0,0,0,0,0,0],bass:[8,7,5,3,1,0,0,0,0,0],treble:[0,0,0,0,0,1,3,5,7,8],rock:[5,4,-2,-4,-2,2,5,6,6,5],pop:[-1,2,4,4,1,-1,-2,-2,-1,1],jazz:[3,2,1,2,-1,-1,0,1,2,3],classical:[4,3,2,1,-1,-1,-1,0,2,3]};
function fmtSec(s){if(!s||isNaN(s))return'0:00';s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return h?h+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0'):m+':'+String(ss).padStart(2,'0');}
function el(id){return document.getElementById(id);}
function seedGrad(s){let h=5381;for(let i=0;i<s.length;i++)h=(h*33)^s.charCodeAt(i);h=Math.abs(h);return'linear-gradient(135deg,hsl('+(h%360)+',70%,45%),hsl('+((h+137)%360)+',75%,50%))';}
function cleanTitle(n){return n.replace(/\.[^.]+$/,'').replace(/^\d+[\s.\-_]+/,'').replace(/[_-]/g,' ').trim();}

class BMPlayer {
  constructor(){
    this.api=window.api;
    this.isPlaying=false;this.duration=0;this.currentTime=0;this.isSeeking=false;
    this.alwaysOnTop=localStorage.getItem('bm_ontop')==='1';
    this.recent=JSON.parse(localStorage.getItem('bm_recent')||'[]');
    this.eqValues=[...EQ_PRESETS.flat];
    this.osdTimer=null;this.hideTimer=null;
    this.currentDash='video';this._lastTracks=[];
    this._ctxSubDelay=0;this._ctxAudioDelay=0;this._mProps={};
    this.init();
  }
  init(){
    const fxC=el('theme-fx-canvas'),aurC=el('aurora-canvas'),foxC=el('fox-canvas'),vizC=el('visualizer-canvas');
    if(fxC)this.themeFX=new ThemeFX(fxC);
    if(aurC)this.auroraFX=new ThemeFX(aurC);
    if(foxC&&window.THREE)this.fox=new Fox(foxC);
    if(vizC)this.viz=new Visualizer(vizC);
    applyIcons();
    this.wireTitlebar();this.wireThemes();this.wireSidebar();this.wireMenu();
    this.wireWelcome();this.wireTransport();this.wireSeek();this.wireVolume();
    this.wirePanels();this.wireEQ();this.wirePlaylistPanel();this.wireCtxPanel();
    this.wireDialogs();this.wireKeyboard();this.wireDragDrop();this.wireControlsHide();
    this.wireUpdate();this.wireDefaultPrompt();this.listenMpv();this.renderRecent();this.renderTrackMenus([]);
    if(this.alwaysOnTop){this.api?.win.alwaysTop(true);el('mi-always-top')?.classList.add('active-opt');}
    window.addEventListener('contextmenu',e=>{e.preventDefault();this._openCtxPanel(e.clientX,e.clientY);});
    this.api?.win.onState?.(s=>{const b=el('btn-maximize');if(b)b.innerHTML=s==='maximized'?'&#10696;':'&#9633;';});
  }
  wireTitlebar(){
    el('btn-minimize')?.addEventListener('click',()=>this.api?.win.minimize());
    el('btn-maximize')?.addEventListener('click',()=>this.api?.win.maximize());
    el('btn-close')?.addEventListener('click',()=>this.api?.win.close());
    el('btn-theatre')?.addEventListener('click',()=>this.api?.win.theatre());
    el('titlebar')?.addEventListener('dblclick',()=>this.api?.win.maximize());
  }
  wireThemes(){
    const apply=name=>{
      document.documentElement.setAttribute('data-theme',name);
      document.querySelectorAll('.tp').forEach(b=>b.classList.toggle('active',b.dataset.theme===name));
      localStorage.setItem('bm_theme',name);
      this.fox?.setTheme?.(name);
      this.themeFX?.setMode(name==='dracula'?'blood':'off');
      this.auroraFX?.setMode(name==='northern'?'aurora':'off');
    };
    document.querySelectorAll('.tp').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.theme)));
    apply(localStorage.getItem('bm_theme')||'dark');
    el('mi-always-top')?.addEventListener('click',()=>{
      this.alwaysOnTop=!this.alwaysOnTop;localStorage.setItem('bm_ontop',this.alwaysOnTop?'1':'0');
      this.api?.win.alwaysTop(this.alwaysOnTop);el('mi-always-top')?.classList.toggle('active-opt',this.alwaysOnTop);
      this.showOSD(this.alwaysOnTop?'Always on top: ON':'Always on top: OFF');
    });
  }
  wireSidebar(){document.querySelectorAll('.sidebar-btn[data-dest]').forEach(b=>b.addEventListener('click',()=>this.switchDest(b.dataset.dest)));}
  switchDest(dest){
    this.currentDash=dest;
    document.querySelectorAll('.sidebar-btn[data-dest]').forEach(b=>b.classList.toggle('active',b.dataset.dest===dest));
    el('welcome-screen')?.classList.remove('active');el('player-view')?.classList.remove('active');
    document.querySelectorAll('.dashboard-view').forEach(v=>v.classList.remove('active'));
    if(dest==='video'){if(this.isPlaying||this.duration>0)el('player-view')?.classList.add('active');else el('welcome-screen')?.classList.add('active');}
    else if(dest==='images')el('gallery-view')?.classList.add('active');
    else if(dest==='music')el('music-view')?.classList.add('active');
    else if(dest==='pdf')el('pdf-view')?.classList.add('active');
  }
  wireMenu(){document.querySelectorAll('.mr[data-a]').forEach(r=>r.addEventListener('click',()=>this.handleAction(r.dataset.a)));}
  handleAction(a){
    const cmd=(c,...args)=>this.api?.mpv.cmd(c,...args);
    const m={
      'open':()=>this.openDialog(),'open-url':()=>{el('dlg-url')?.classList.remove('hidden');el('url-input')?.focus();},
      'open-sub':()=>this.api?.dialog.openSub().then(s=>{if(s){cmd('sub-add',s,'select');this.showOSD('Subtitle loaded');}}),
      'quit':()=>this.api?.win.close(),'toggle-play':()=>this.togglePlay(),'stop':()=>this.stop(),
      'prev':()=>cmd('playlist-prev'),'next':()=>cmd('playlist-next'),
      'speed-dec':()=>cmd('multiply','speed',0.9091),'speed-inc':()=>cmd('multiply','speed',1.1),
      'speed-reset':()=>cmd('set_property','speed',1),'loop-file':()=>cmd('cycle','loop-file'),
      'screenshot':()=>{cmd('screenshot','subtitles');this.showOSD('Screenshot saved');},'jump-to-time':()=>{el('dlg-jump')?.classList.remove('hidden');el('jump-input')?.focus();},
      'cycle-audio':()=>cmd('cycle','audio'),'vol-up':()=>this.bumpVolume(5),'vol-down':()=>this.bumpVolume(-5),'mute':()=>cmd('cycle','mute'),
      'fullscreen':()=>this.api?.win.fullscreen(),'theatre':()=>this.api?.win.theatre(),'cycle-sub':()=>cmd('cycle','sub'),
      'sub-delay-p':()=>this.api?.adj.subDelay(0.5),'sub-delay-m':()=>this.api?.adj.subDelay(-0.5),'sub-delay-r':()=>this.api?.adj.resetSub(),
      'sub-size-p':()=>cmd('add','sub-font-size',4),'sub-size-m':()=>cmd('add','sub-font-size',-4),
      'open-eq':()=>this.openPanel('eq'),'open-info':()=>this.openPanel('info'),'open-playlist':()=>this.openPanel('playlist'),
      'audio-delay-p':()=>this.api?.adj.audioDelay(0.5),'audio-delay-m':()=>this.api?.adj.audioDelay(-0.5),'audio-delay-r':()=>this.api?.adj.resetAudio(),
      'aspect-auto':()=>cmd('set_property','video-aspect-override','-1'),'aspect-16:9':()=>cmd('set_property','video-aspect-override','16/9'),
      'aspect-4:3':()=>cmd('set_property','video-aspect-override','4/3'),'aspect-21:9':()=>cmd('set_property','video-aspect-override','21/9'),
      'hwdec-auto':()=>cmd('set_property','hwdec','auto-safe'),'hwdec-nvdec':()=>cmd('set_property','hwdec','nvdec'),'hwdec-off':()=>cmd('set_property','hwdec','no'),
      'check-update':()=>{this.api?.app.checkUpdate();this.showOSD('Checking for updates...');},'preferences':()=>this.showOSD('Preferences — coming soon'),
      'about':()=>this.api?.app.version().then(v=>this.showOSD('BM Player v'+v+' — Powered by mpv',3000)),
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
    el('btn-prev')?.addEventListener('click',()=>this.api?.mpv.cmd('playlist-prev'));
    el('btn-next')?.addEventListener('click',()=>this.api?.mpv.cmd('playlist-next'));
    el('btn-rew')?.addEventListener('click',()=>{this.api?.mpv.cmd('seek','-30');this.showOSD('Seek -30s');});
    el('btn-fwd')?.addEventListener('click',()=>{this.api?.mpv.cmd('seek','+30');this.showOSD('Seek +30s');});
    el('btn-fs')?.addEventListener('click',()=>this.api?.win.fullscreen());
    el('btn-info')?.addEventListener('click',()=>this.openPanel('info'));
    el('btn-eq')?.addEventListener('click',()=>this.openPanel('eq'));
    el('btn-playlist')?.addEventListener('click',()=>this.openPanel('playlist'));
    el('btn-theatre')?.addEventListener('click',()=>this.api?.win.theatre());
    el('speed-badge')?.addEventListener('click',()=>{const speeds=[0.25,0.5,0.75,1,1.25,1.5,2,3];const cur=parseFloat(el('speed-badge').textContent)||1;const next=speeds[(speeds.indexOf(cur)+1)%speeds.length];this.api?.mpv.cmd('set_property','speed',next);this.showOSD('Speed: '+next+'x');});
  }
  togglePlay(){this.api?.mpv.cmd('cycle','pause');}
  stop(){
    if(!this.api?.mpv)return;this.api.mpv.cmd('stop');
    this.isPlaying=false;this.duration=0;this.currentTime=0;
    this.updatePlayIcon();this.setTime('time-current',0);this.setTime('time-total',0);this.setSeekPct(0);
    const t=el('title-text');if(t)t.textContent='BM Player';
    document.body.classList.remove('playing');document.documentElement.classList.remove('playing');
    this.viz?.stop();this.fox?.sleep();this.switchDest('video');
  }
  playMedia(files){
    if(!this.api?.mpv||!files?.length)return;
    el('welcome-screen')?.classList.remove('active');
    document.querySelectorAll('.dashboard-view').forEach(v=>v.classList.remove('active'));
    el('player-view')?.classList.add('active');
    document.body.classList.add('playing');document.documentElement.classList.add('playing');
    document.querySelectorAll('.sidebar-btn[data-dest]').forEach(b=>b.classList.toggle('active',b.dataset.dest==='video'));
    this.currentDash='video';this.api.mpv.open(files);this.isPlaying=true;this.updatePlayIcon();this.fox?.wake();
    files.forEach(f=>!f.startsWith('http')&&this.addRecent(f));
  }
  updatePlayIcon(){setTogglePair('btn-play',!this.isPlaying);}
  updateMuteIcon(m){setTogglePair('btn-mute',!m);}
  wireSeek(){
    const sc=el('seek-container');if(!sc)return;let drag=false;
    const getPct=e=>{const r=sc.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));};
    sc.addEventListener('mousedown',e=>{drag=true;this.isSeeking=true;const p=getPct(e);this.setSeekPct(p);this.api?.mpv.cmd('seek',String(p*this.duration),'absolute');});
    sc.addEventListener('mousemove',e=>{const p=getPct(e);const pt=el('seek-preview-time');if(pt)pt.textContent=fmtSec(p*this.duration);const sp=el('seek-preview');if(sp)sp.style.left=(p*sc.clientWidth)+'px';if(drag){this.setSeekPct(p);}});
    document.addEventListener('mouseup',()=>{if(drag){drag=false;this.isSeeking=false;}});
  }
  setSeekPct(p){const sf=el('seek-fill'),st=el('seek-thumb');if(sf)sf.style.width=(p*100)+'%';if(st)st.style.left=(p*100)+'%';}
  setTime(id,s){const e=el(id);if(e)e.textContent=fmtSec(s);}
  wireVolume(){
    const sl=el('volume-slider');if(!sl)return;
    sl.addEventListener('input',()=>{const v=+sl.value;this.api?.mpv.cmd('set_property','volume',v);const l=el('vol-label');if(l)l.textContent=v;});
    el('btn-mute')?.addEventListener('click',()=>this.api?.mpv.cmd('cycle','mute'));
  }
  bumpVolume(d){const sl=el('volume-slider');if(!sl)return;const v=Math.max(0,Math.min(130,+sl.value+d));sl.value=v;this.api?.mpv.cmd('set_property','volume',v);const l=el('vol-label');if(l)l.textContent=v;this.showOSD('Volume: '+v+'%');}
  wirePanels(){document.querySelectorAll('.panel-close').forEach(b=>b.addEventListener('click',()=>el('panel-'+b.dataset.panel)?.classList.remove('open')));}
  openPanel(name){document.querySelectorAll('.side-panel').forEach(p=>p.classList.remove('open'));const p=el('panel-'+name);if(!p)return;p.classList.add('open');if(name==='info')this.populateInfo();if(name==='playlist')this.renderPlaylistPanel();}
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
  _applyEQ(){const af=this.eqValues.map((v,i)=>'equalizer=f='+EQ_BANDS[i].freq+':width_type=o:width=2:g='+v).join(',');this.api?.mpv.cmd('set_property','af',this.eqValues.every(v=>v===0)?'':`lavfi=[${af}]`).catch(()=>{});}
  wirePlaylistPanel(){
    el('pl-add')?.addEventListener('click',()=>this.openDialog(true));
    el('pl-clear')?.addEventListener('click',()=>{this.api?.mpv.cmd('playlist-clear');this.renderPlaylistPanel();});
  }
  renderPlaylistPanel(){this.api?.mpv.getPlaylist?.().then(pl=>{const list=el('pl-list');if(!list)return;if(!pl?.length){list.innerHTML='<div style="color:var(--text-muted);font-size:12px;padding:10px">Playlist empty</div>';return;}list.innerHTML=pl.map((item,i)=>{const name=(item.title||item.filename||'').split(/[\\/]/).pop();return'<div class="pl-item'+(item.current?' playing':'')+'" data-idx="'+i+'"><span class="pl-item-idx">'+(i+1)+'</span><span class="pl-item-name">'+name+'</span><span class="pl-item-rm" data-rm="'+i+'">x</span></div>';}).join('');list.querySelectorAll('.pl-item').forEach(item=>item.addEventListener('click',()=>this.api?.mpv.cmd('set_property','playlist-pos',+item.dataset.idx)));list.querySelectorAll('.pl-item-rm').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();this.api?.mpv.cmd('playlist-remove',+btn.dataset.rm);setTimeout(()=>this.renderPlaylistPanel(),100);}));});}
  wireCtxPanel(){
    document.querySelectorAll('.ctx-tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.ctx-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.ctx-body').forEach(x=>x.classList.remove('active'));t.classList.add('active');el('ctx-tab-'+t.dataset.tab)?.classList.add('active');}));
    el('ctx-close')?.addEventListener('click',()=>this._closeCtxPanel());
    document.addEventListener('mousedown',e=>{const p=el('ctx-panel');if(p&&!p.contains(e.target)&&!p.classList.contains('hidden'))this._closeCtxPanel();});
    el('ctx-vol')?.addEventListener('input',e=>{const v=+e.target.value;this.api?.mpv.cmd('set_property','volume',v);const s=el('volume-slider');if(s)s.value=v;const l=el('vol-label');if(l)l.textContent=v;const cl=el('ctx-vol-val');if(cl)cl.textContent=v+'%';});
    el('ctx-mute')?.addEventListener('change',()=>this.api?.mpv.cmd('cycle','mute'));
    el('ctx-sub-size')?.addEventListener('input',e=>{this.api?.mpv.cmd('set_property','sub-font-size',+e.target.value);const v=el('ctx-sub-size-val');if(v)v.textContent=e.target.value;});
    el('ctx-sub-pos')?.addEventListener('input',e=>{this.api?.mpv.cmd('set_property','sub-pos',+e.target.value);const v=el('ctx-sub-pos-val');if(v)v.textContent=e.target.value;});
    document.querySelectorAll('.ctx-adj-btn[data-cmd]').forEach(btn=>btn.addEventListener('click',()=>{const c=btn.dataset.cmd,v=btn.dataset.v;if(c==='sub-delay'){if(v==='0'){this.api?.adj.resetSub();this._ctxSubDelay=0;}else{const d=parseFloat(v);this.api?.adj.subDelay(d);this._ctxSubDelay+=d;}const e=el('ctx-sub-delay-val');if(e)e.textContent=this._ctxSubDelay.toFixed(1)+'s';}else if(c==='audio-delay'){if(v==='0'){this.api?.adj.resetAudio();this._ctxAudioDelay=0;}else{const d=parseFloat(v);this.api?.adj.audioDelay(d);this._ctxAudioDelay+=d;}const e=el('ctx-audio-delay-val');if(e)e.textContent=this._ctxAudioDelay.toFixed(1)+'s';}}));
    document.querySelectorAll('.ctx-chip[data-cmd]').forEach(chip=>chip.addEventListener('click',()=>{chip.closest('.ctx-chip-row')?.querySelectorAll('.ctx-chip').forEach(c=>c.classList.remove('active'));chip.classList.add('active');const{cmd,v}=chip.dataset;if(cmd==='aspect')this.api?.mpv.cmd('set_property','video-aspect-override',v==='-1'?'-1':v);if(cmd==='hwdec')this.api?.mpv.cmd('set_property','hwdec',v);}));
    el('ctx-deinterlace')?.addEventListener('change',()=>this.api?.mpv.cmd('cycle','deinterlace'));
    el('ctx-screenshot')?.addEventListener('click',()=>{this.api?.mpv.cmd('screenshot','subtitles');this.showOSD('Screenshot saved');this._closeCtxPanel();});
    el('ctx-add-sub')?.addEventListener('click',async()=>{const s=await this.api?.dialog.openSub();if(s){this.api?.mpv.cmd('sub-add',s,'select');this.showOSD('Subtitle loaded');}this._closeCtxPanel();});
    this.api?.mpv.onProp(p=>{if(p.name==='volume'){const e=el('ctx-vol');if(e){e.value=p.data;const l=el('ctx-vol-val');if(l)l.textContent=Math.round(p.data)+'%';}}if(p.name==='mute'){const e=el('ctx-mute');if(e)e.checked=!!p.data;}});
    this.api?.mpv.onTrackList?.(tl=>{this._lastTracks=tl;});
  }
  _openCtxPanel(x,y){const p=el('ctx-panel');if(!p)return;p.classList.remove('hidden');p.style.left='-9999px';p.style.top='-9999px';const W=p.offsetWidth||320,H=p.offsetHeight||440;p.style.left=Math.max(8,Math.min(x,window.innerWidth-W-8))+'px';p.style.top=Math.max(8,Math.min(y,window.innerHeight-H-8))+'px';this._populateCtxTracks();}
  _closeCtxPanel(){el('ctx-panel')?.classList.add('hidden');}
  _populateCtxTracks(){
    const tracks=this._lastTracks||[];
    const fill=(id,type,prop)=>{const el_=el(id);if(!el_)return;const list=tracks.filter(t=>t.type===type);el_.innerHTML='';if(type==='sub'){const off=document.createElement('div');off.className='ctx-track-item'+(!list.some(t=>t.selected)?' active':'');off.textContent='Off';off.addEventListener('click',()=>{this.api?.mpv.cmd('set_property','sub-visibility',false);el_.querySelectorAll('.ctx-track-item').forEach(r=>r.classList.remove('active'));off.classList.add('active');});el_.appendChild(off);}if(!list.length&&type!=='sub'){el_.innerHTML='<div class="ctx-track-item" style="opacity:.4">None</div>';return;}list.forEach(t=>{const row=document.createElement('div');row.className='ctx-track-item'+(t.selected?' active':'');row.textContent=[t.lang?'['+t.lang.toUpperCase()+']':'',t.title||t.codec||'Track '+t.id].filter(Boolean).join(' ');row.addEventListener('click',()=>{if(type==='sub')this.api?.mpv.cmd('set_property','sub-visibility',true);this.api?.mpv.cmd('set_property',prop,t.id);el_.querySelectorAll('.ctx-track-item').forEach(r=>r.classList.remove('active'));row.classList.add('active');});el_.appendChild(row);});};
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
  _doJump(){const raw=el('jump-input')?.value?.trim();if(!raw)return;const parts=raw.split(':').map(Number);const secs=parts.length===3?parts[0]*3600+parts[1]*60+parts[2]:parts.length===2?parts[0]*60+parts[1]:parts[0];if(!isNaN(secs))this.api?.mpv.cmd('seek',String(secs),'absolute');el('dlg-jump')?.classList.add('hidden');if(el('jump-input'))el('jump-input').value='';}
  wireKeyboard(){
    document.addEventListener('keydown',e=>{
      if(e.target.matches('input,textarea'))return;
      const cmd=(c,...a)=>{e.preventDefault();this.api?.mpv.cmd(c,...a);};
      if(e.code==='Space'){e.preventDefault();this.togglePlay();}
      else if(e.code==='KeyS'){e.preventDefault();this.stop();}
      else if(e.code==='KeyF'||e.code==='F11'){e.preventDefault();this.api?.win.fullscreen();}
      else if(e.code==='KeyT'&&!e.ctrlKey){e.preventDefault();this.api?.win.theatre();}
      else if(e.code==='KeyM'){e.preventDefault();cmd('cycle','mute');}
      else if(e.code==='ArrowLeft'){e.shiftKey?cmd('seek','-30'):cmd('seek','-5');}
      else if(e.code==='ArrowRight'){e.shiftKey?cmd('seek','+30'):cmd('seek','+5');}
      else if(e.code==='ArrowUp'){e.preventDefault();this.bumpVolume(5);}
      else if(e.code==='ArrowDown'){e.preventDefault();this.bumpVolume(-5);}
      else if(e.code==='BracketLeft'){cmd('multiply','speed',0.9091);this.api?.mpv.cmd('get_property','speed').then(s=>this.showOSD('Speed: '+parseFloat(s).toFixed(2)+'x')).catch(()=>{});}
      else if(e.code==='BracketRight'){cmd('multiply','speed',1.1);this.api?.mpv.cmd('get_property','speed').then(s=>this.showOSD('Speed: '+parseFloat(s).toFixed(2)+'x')).catch(()=>{});}
      else if(e.code==='Backspace'){cmd('set_property','speed',1);this.showOSD('Speed: 1x');}
      else if(e.code==='KeyZ'){this.api?.adj.subDelay(-0.5);this.showOSD('Sub delay: '+(this._ctxSubDelay-=0.5).toFixed(1)+'s');}
      else if(e.code==='KeyX'){this.api?.adj.subDelay(0.5);this.showOSD('Sub delay: '+(this._ctxSubDelay+=0.5).toFixed(1)+'s');}
      else if(e.code==='KeyK'&&e.shiftKey){this.api?.adj.audioDelay(0.5);}
      else if(e.code==='KeyJ'&&e.shiftKey){this.api?.adj.audioDelay(-0.5);}
      else if(e.code==='KeyA'){cmd('cycle','audio');}
      else if(e.code==='KeyV'){cmd('cycle','sub');}
      else if(e.code==='KeyP'){cmd('playlist-prev');}
      else if(e.code==='KeyN'){cmd('playlist-next');}
      else if(e.code==='Escape'){this.api?.win.isFs().then(fs=>{if(fs)this.api?.win.fullscreen();else this.stop();});}
      else if(e.code==='KeyO'&&e.ctrlKey){e.preventDefault();this.openDialog();}
      else if(e.code==='KeyI'&&e.ctrlKey){e.preventDefault();this.openPanel('info');}
      else if(e.code==='KeyL'&&e.ctrlKey){e.preventDefault();this.openPanel('playlist');}
      else if(e.code==='KeyT'&&e.ctrlKey){e.preventDefault();this.api?.mpv.cmd('screenshot','subtitles');this.showOSD('Screenshot saved');}
      else if(e.code==='KeyJ'&&e.ctrlKey){e.preventDefault();el('dlg-jump')?.classList.remove('hidden');el('jump-input')?.focus();}
      else if(e.code==='KeyQ'&&e.ctrlKey){e.preventDefault();this.api?.win.close();}
      else if(e.key>='1'&&e.key<='9'&&!e.ctrlKey&&!e.altKey){const p=+e.key/10;this.api?.mpv.cmd('seek',String(p*this.duration),'absolute');}
    });
  }
  wireDragDrop(){const ov=el('drop-overlay');document.addEventListener('dragover',e=>{e.preventDefault();ov?.classList.add('active');});document.addEventListener('dragleave',e=>{if(!e.relatedTarget)ov?.classList.remove('active');});document.addEventListener('drop',e=>{e.preventDefault();ov?.classList.remove('active');const files=[...(e.dataTransfer?.files||[])].map(f=>f.path).filter(Boolean);if(files.length)this.playMedia(files);});}
  wireControlsHide(){
    const bar=el('controls-bar'),tb=el('titlebar'),mt=el('menu-toolbar');
    const show=()=>{bar?.classList.remove('faded');tb?.classList.remove('faded-top');mt?.classList.remove('faded-top');clearTimeout(this.hideTimer);if(this.isPlaying)this.hideTimer=setTimeout(()=>{if(this.isPlaying&&!bar?.matches(':hover')){bar?.classList.add('faded');tb?.classList.add('faded-top');mt?.classList.add('faded-top');}},3000);};
    document.addEventListener('mousemove',show);
    bar?.addEventListener('mouseenter',()=>{clearTimeout(this.hideTimer);bar.classList.remove('faded');});
    bar?.addEventListener('mouseleave',()=>{if(this.isPlaying)this.hideTimer=setTimeout(()=>bar?.classList.add('faded'),2500);});
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
    this.api?.mpv.onStatus?.(s=>{const st=el('tb-status');if(s.state==='missing'){this.showOSD('mpv not found - install mpv first',5000);if(st)st.textContent='mpv missing';}if(s.state==='crashed'&&st)st.textContent='mpv crashed - restarting...';}); 
    this.api?.mpv.onProp?.(p=>{
      if(p.name==='pause'){this.isPlaying=!p.data;this.updatePlayIcon();el('np-bars')?.classList.toggle('playing',this.isPlaying);}
      if(p.name==='time-pos'){this.currentTime=p.data||0;if(!this.isSeeking){this.setTime('time-current',this.currentTime);if(this.duration>0){this.setSeekPct(this.currentTime/this.duration);const fill=el('np-seek-fill');if(fill)fill.style.width=(this.currentTime/this.duration*100)+'%';const cur=el('np-time-cur');if(cur)cur.textContent=fmtSec(this.currentTime);}}}
      if(p.name==='duration'){this.duration=p.data||0;this.setTime('time-total',this.duration);const tot=el('np-time-tot');if(tot)tot.textContent=fmtSec(this.duration);}
      if(p.name==='volume'){const sl=el('volume-slider');if(sl)sl.value=p.data;const l=el('vol-label');if(l)l.textContent=Math.round(p.data);}
      if(p.name==='mute')this.updateMuteIcon(p.data);
      if(p.name==='media-title'){const t=el('title-text');if(t)t.textContent=p.data||'BM Player';const np=el('np-title');if(np)np.textContent=p.data||'Not Playing';}
      if(p.name==='speed'){const sb=el('speed-badge');if(sb)sb.textContent=(+p.data).toFixed(2).replace(/\.?0+$/,'')+'x';}
      if(p.name==='track-list'){this._lastTracks=Array.isArray(p.data)?p.data:[];this.renderTrackMenus(this._lastTracks);this.updateVisualizerVisibility(this._lastTracks);}
      if(p.name==='demuxer-cache-state'&&p.data&&this.duration>0){const pct=(p.data['cache-end']||0)/this.duration*100;const buf=el('seek-buffer');if(buf)buf.style.width=pct+'%';}
    });
    this.api?.mpv.onOpened?.(files=>{if(files?.[0]){el('welcome-screen')?.classList.remove('active');el('player-view')?.classList.add('active');document.body.classList.add('playing');document.documentElement.classList.add('playing');}});
    this.api?.mpv.onMediaProps?.(props=>{this._mProps=props;});
  }
  updateVisualizerVisibility(tracks){
    const hasVideo=tracks.some(t=>t.type==='video');
    if(hasVideo){this.viz?.stop();document.body.classList.add('playing');document.documentElement.classList.add('playing');}
    else{const mode=document.querySelector('.viz-opt.active-opt')?.dataset.v||'bars';if(mode!=='off')this.viz?.setMode(mode);document.body.classList.remove('playing');document.documentElement.classList.remove('playing');}
  }
  renderTrackMenus(tracks){
    const audio=tracks.filter(t=>t.type==='audio'),video=tracks.filter(t=>t.type==='video'),subs=tracks.filter(t=>t.type==='sub');
    this._fillTrack('audio-track-sub',audio,'aid');this._fillTrack('video-track-sub',video,'vid');this._fillSubMenu('sub-track-sub',subs);
  }
  _trackLabel(t){return[t.lang?'['+t.lang.toUpperCase()+']':'',t.title||t.codec||'Track '+t.id].filter(Boolean).join(' ');}
  _fillTrack(id,list,prop){const c=el(id);if(!c)return;c.innerHTML='';list.forEach(t=>{const row=document.createElement('div');row.className='mr'+(t.selected?' active-opt':'');row.textContent=(t.selected?'✓ ':'')+this._trackLabel(t);row.addEventListener('click',()=>this.api?.mpv.cmd('set_property',prop,t.id));c.appendChild(row);});}
  _fillSubMenu(id,subs){const c=el(id);if(!c)return;c.innerHTML='';const off=document.createElement('div');off.className='mr'+(!subs.some(t=>t.selected)?' active-opt':'');off.textContent=(!subs.some(t=>t.selected)?'✓ ':'')+'Off';off.addEventListener('click',()=>this.api?.mpv.cmd('set_property','sub-visibility',false));c.appendChild(off);subs.forEach(t=>{const row=document.createElement('div');row.className='mr'+(t.selected?' active-opt':'');row.textContent=(t.selected?'✓ ':'')+this._trackLabel(t);row.addEventListener('click',()=>{this.api?.mpv.cmd('set_property','sub-visibility',true);this.api?.mpv.cmd('set_property','sid',t.id);});c.appendChild(row);});}
  showOSD(msg,ms=1600){const e=el('osd');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(this.osdTimer);this.osdTimer=setTimeout(()=>e.classList.remove('show'),ms);}
  async openDialog(append=false){const files=await this.api?.dialog.open();if(!files?.length)return;if(append)files.forEach(f=>this.api?.mpv.append(f));else this.playMedia(files);}
}

window.addEventListener('DOMContentLoaded',()=>{
  window.bmApp=new BMPlayer();
  window.bmGallery=new GalleryDash(window.api);
  window.bmMusic=new MusicDash(window.api);
  window.bmPDF=new PDFViewer(window.api);
});

// ── Gallery ────────────────────────────────────────────────────
class GalleryDash{constructor(api){this.api=api;this.images=[];this.lbIdx=-1;this.lbScale=1;this.lbOffset={x:0,y:0};this.viewMode='masonry';this.thumbSize=190;this.sortMode='name';this._dragStart=null;this._wire();}
_wire(){el('btn-gallery-open')?.addEventListener('click',()=>this._browse());el('gallery-sort')?.addEventListener('change',e=>{this.sortMode=e.target.value;this._render();});el('thumb-size')?.addEventListener('input',e=>{this.thumbSize=+e.target.value;const g=el('gallery-grid');if(g)g.style.setProperty('--thumb-size',this.thumbSize+'px');});document.querySelectorAll('.vm-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.vm-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');this.viewMode=b.dataset.mode;this._render();}));el('lightbox-close')?.addEventListener('click',()=>this._closeLB());el('lb-backdrop')?.addEventListener('click',()=>this._closeLB());el('lightbox-prev')?.addEventListener('click',()=>this._nav(-1));el('lightbox-next')?.addEventListener('click',()=>this._nav(+1));el('lb-zoom-in')?.addEventListener('click',()=>this._zoom(.25));el('lb-zoom-out')?.addEventListener('click',()=>this._zoom(-.25));el('lb-fit')?.addEventListener('click',()=>this._resetZoom());el('lightbox')?.addEventListener('wheel',e=>{e.preventDefault();this._zoom(e.deltaY<0?.15:-.15);},{passive:false});document.addEventListener('keydown',e=>{if(!el('lightbox')?.classList.contains('open'))return;if(e.key==='Escape')this._closeLB();if(e.key==='ArrowLeft')this._nav(-1);if(e.key==='ArrowRight')this._nav(+1);});const f=document.querySelector('.lb-frame');if(f){f.addEventListener('mousedown',e=>{this._dragStart={x:e.clientX-this.lbOffset.x,y:e.clientY-this.lbOffset.y};});f.addEventListener('mousemove',e=>{if(!this._dragStart)return;this.lbOffset={x:e.clientX-this._dragStart.x,y:e.clientY-this._dragStart.y};this._applyT();});f.addEventListener('mouseup',()=>{this._dragStart=null;});f.addEventListener('mouseleave',()=>{this._dragStart=null;});}}
async _browse(){const folder=await this.api?.gallery?.browse();if(!folder)return;const files=await this.api?.gallery?.scan(folder)||[];const IMG=new Set(['jpg','jpeg','png','webp','gif','bmp','tiff','avif']);this.images=files.filter(f=>IMG.has(f.name.split('.').pop().toLowerCase()));const c=el('gallery-count');if(c)c.textContent=this.images.length?this.images.length+' images':'No images';this._render();}
_sorted(){return[...this.images].sort((a,b)=>this.sortMode==='type'?a.name.split('.').pop().localeCompare(b.name.split('.').pop()):a.name.localeCompare(b.name,undefined,{numeric:true}));}
_render(){const g=el('gallery-grid');if(!g)return;g.className='gallery-grid '+this.viewMode+'-view';g.style.setProperty('--thumb-size',this.thumbSize+'px');if(!this.images.length){g.innerHTML='<div class="gallery-empty-state"><div style="font-size:60px">&#128444;</div><p style="margin-top:10px">Click <strong>Open Folder</strong></p></div>';return;}const s=this._sorted();g.innerHTML=s.map((img,i)=>'<div class="g-card" data-idx="'+i+'"><img src="file://'+img.path.replace(/\\/g,'/')+'" loading="lazy" alt="'+img.name+'"><div class="g-card-overlay"><span class="g-card-name">'+img.name+'</span></div></div>').join('');g.querySelectorAll('.g-card').forEach(c=>c.addEventListener('click',()=>this._openLB(+c.dataset.idx)));}
_openLB(idx){this.lbIdx=idx;this._resetZoom();const s=this._sorted();const img=s[idx];const i=el('lightbox-img'),cap=el('lightbox-caption'),ct=el('lb-counter'),lb=el('lightbox');if(!img||!i||!lb)return;i.src='file://'+img.path.replace(/\\/g,'/');if(cap)cap.textContent=img.name;if(ct)ct.textContent=(idx+1)+' / '+s.length;lb.classList.add('open');}
_closeLB(){el('lightbox')?.classList.remove('open');this._resetZoom();}
_nav(d){const s=this._sorted();this.lbIdx=(this.lbIdx+d+s.length)%s.length;this._openLB(this.lbIdx);}
_zoom(d){this.lbScale=Math.max(.15,Math.min(8,this.lbScale+d));this._applyT();const l=el('lb-zoom-label');if(l)l.textContent=Math.round(this.lbScale*100)+'%';}
_resetZoom(){this.lbScale=1;this.lbOffset={x:0,y:0};this._applyT();const l=el('lb-zoom-label');if(l)l.textContent='100%';}
_applyT(){const i=el('lightbox-img');if(i)i.style.transform='translate('+this.lbOffset.x+'px,'+this.lbOffset.y+'px) scale('+this.lbScale+')';}}

// ── Music ──────────────────────────────────────────────────────
class MusicDash{constructor(api){this.api=api;this.folders=JSON.parse(localStorage.getItem('bm_music_folders')||'[]');this.tracks=[];this.queue=[];this.queueIdx=-1;this.currentPath=null;this._dur={};this._activePath=null;this._wire();this.folders.forEach(f=>this._addFolder(f));if(this.folders.length)this._load(this.folders[0]);}
_wire(){el('btn-music-open')?.addEventListener('click',async()=>{const f=await this.api?.gallery?.browse();if(!f||this.folders.includes(f))return;this.folders.push(f);localStorage.setItem('bm_music_folders',JSON.stringify(this.folders));this._addFolder(f);this._load(f);});el('music-sort')?.addEventListener('change',e=>this._renderTracks(this._sorted(this.tracks,e.target.value)));const st=el('np-seek-track');st?.addEventListener('click',e=>{if(!this.currentPath||!this._dur[this.currentPath])return;const r=st.getBoundingClientRect();const pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));this.api?.mpv?.cmd('set_property','time-pos',pct*this._dur[this.currentPath]);});this.api?.mpv?.onProp(p=>{if(p.name==='duration'&&this.currentPath){this._dur[this.currentPath]=p.data;const t=el('np-time-tot');if(t)t.textContent=fmtSec(p.data);}if(p.name==='time-pos'&&this.currentPath){const dur=this._dur[this.currentPath];if(dur&&dur>0){const pct=(p.data/dur)*100;const f=el('np-seek-fill');if(f)f.style.width=pct+'%';const c=el('np-time-cur');if(c)c.textContent=fmtSec(p.data);}}if(p.name==='pause')el('np-bars')?.classList.toggle('playing',!p.data);});}
_addFolder(fp){const s=el('music-lib-sections');if(!s)return;s.querySelector('.music-empty-lib')?.remove();const n=fp.split(/[\\/]/).pop();const d=document.createElement('div');d.className='music-folder-item';d.dataset.path=fp;d.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span class="mf-name">'+n+'</span>';d.addEventListener('click',()=>this._load(fp));s.appendChild(d);}
async _load(fp){this._activePath=fp;document.querySelectorAll('.music-folder-item').forEach(e=>e.classList.toggle('active',e.dataset.path===fp));const lbl=el('music-path-title');if(lbl)lbl.textContent=fp.split(/[\\/]/).pop();const files=await this.api?.gallery?.scan(fp)||[];const AUDIO=new Set(['mp3','flac','aac','ogg','wav','m4a','wma','opus','ape','mka','m4b']);this.tracks=files.filter(f=>AUDIO.has(f.name.split('.').pop().toLowerCase()));this._renderTracks(this._sorted(this.tracks,'name'));this.queue=[...this.tracks];}
_sorted(t,by){return[...t].sort((a,b)=>by==='type'?a.name.split('.').pop().localeCompare(b.name.split('.').pop()):a.name.localeCompare(b.name));}
_renderTracks(tracks){const c=el('music-tracks');if(!c)return;if(!tracks.length){c.innerHTML='<div class="music-empty-tracks"><div style="font-size:48px;margin-bottom:8px">&#127911;</div><p>No audio files</p></div>';return;}const g=seedGrad(this._activePath||'');c.innerHTML=tracks.map((t,i)=>{const title=cleanTitle(t.name);const ext=t.name.split('.').pop().toUpperCase();const isP=t.path===this.currentPath;const dur=this._dur[t.path]?fmtSec(this._dur[t.path]):'';return'<div class="track-row'+(isP?' playing':'')+'" data-path="'+t.path.replace(/"/g,'&quot;')+'" data-idx="'+i+'"><span class="tr-num">'+(i+1)+'</span><div class="tr-art"'+(isP?' style="background:'+g+'"':'')+'>'+( isP?'&#9654;':'<span style=\"opacity:.3\">&#9834;</span>')+'</div><div class="tr-info"><div class="tr-name">'+title+'</div><div class="tr-meta">'+ext+'</div></div><span class="tr-dur">'+dur+'</span><div class="tr-play-btn">&#9654;</div></div>';}).join('');c.querySelectorAll('.track-row').forEach(r=>r.addEventListener('click',()=>this.play(r.dataset.path,+r.dataset.idx)));}
play(fp,idx){if(!this.api?.mpv)return;this.currentPath=fp;this.queueIdx=idx;this.api.mpv.open([fp]);const title=cleanTitle(fp.split(/[\\/]/).pop());const folder=fp.split(/[\\/]/).slice(0,-1).pop()||'';const ext=fp.split('.').pop().toUpperCase();const g=seedGrad(folder);const ai=el('np-art-inner');if(ai){ai.style.background=g;ai.innerHTML='<span class="np-art-placeholder" style="opacity:.5">&#9834;</span>';}const gl=el('np-glow');if(gl){gl.style.background=g;gl.style.opacity='.5';}el('np-art')?.classList.add('has-track');const nt=el('np-title');if(nt)nt.textContent=title;const na=el('np-artist');if(na)na.textContent=folder;const nf=el('np-format');if(nf)nf.textContent=ext;el('np-bars')?.classList.add('playing');this._renderTracks(this._sorted(this.tracks,el('music-sort')?.value||'name'));this._renderQueue();}
_renderQueue(){const q=el('np-queue');if(!q)return;const next=this.queue.slice(this.queueIdx+1,this.queueIdx+6);q.innerHTML=next.length?next.map((t,i)=>'<div class="np-q-item" data-path="'+t.path.replace(/"/g,'&quot;')+'" data-idx="'+(this.queueIdx+1+i)+'">'+cleanTitle(t.name)+'</div>').join(''):'<div style="font-size:11.5px;color:var(--text-muted);padding:6px 8px">End of queue</div>';q.querySelectorAll('.np-q-item').forEach(i=>i.addEventListener('click',()=>this.play(i.dataset.path,+i.dataset.idx)));}}

// ── PDF ────────────────────────────────────────────────────────
class PDFViewer{constructor(api){this.api=api;this.pdfDoc=null;this.pageNum=1;this.scale=1.4;this.fitScale=1.4;this.rendering=false;this._sr=[];this._si=-1;this._wire();}
_wire(){el('btn-pdf-open')?.addEventListener('click',()=>this._open());el('pdf-prev')?.addEventListener('click',()=>this._go(-1));el('pdf-next')?.addEventListener('click',()=>this._go(+1));el('pdf-page-num')?.addEventListener('change',e=>{const n=parseInt(e.target.value);if(n>=1&&n<=(this.pdfDoc?.numPages||1)){this.pageNum=n;this._render();}});el('pdf-zoom-out')?.addEventListener('click',()=>this._zoom(-.2));el('pdf-zoom-in')?.addEventListener('click',()=>this._zoom(.2));el('pdf-fit')?.addEventListener('click',()=>{this.scale=this.fitScale;this._render();});el('pdf-search')?.addEventListener('input',e=>this._search(e.target.value));el('pdf-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')this._nextMatch(e.shiftKey?-1:1);});document.addEventListener('keydown',e=>{if(!el('pdf-view')?.classList.contains('active'))return;if(e.key==='ArrowRight'||e.key==='ArrowDown')this._go(1);if(e.key==='ArrowLeft'||e.key==='ArrowUp')this._go(-1);});}
async _open(){const f=await this.api?.dialog?.openPDF?.();if(f)await this.load(f);}
async load(fp){const lib=window.pdfjsLib;if(!lib){alert('PDF.js not loaded — check your internet connection');return;}el('pdf-filename').textContent='Loading...';el('pdf-thumbs-list').innerHTML='';el('pdf-canvas').style.display='none';el('pdf-empty').style.display='flex';try{const src=fp.startsWith('http')?fp:'file://'+fp.replace(/\\/g,'/');this.pdfDoc=await lib.getDocument(src).promise;this.pageNum=1;el('pdf-total').textContent=this.pdfDoc.numPages;el('pdf-page-num').max=this.pdfDoc.numPages;el('pdf-filename').textContent=fp.split(/[\\/]/).pop();const pg=await this.pdfDoc.getPage(1);const nw=pg.getViewport({scale:1}).width;const vw=(el('pdf-main')?.clientWidth||600)-56;this.fitScale=Math.max(.5,Math.min(3,vw/nw));this.scale=this.fitScale;el('pdf-empty').style.display='none';el('pdf-canvas').style.display='block';await this._render();this._buildThumbs();}catch(e){el('pdf-filename').textContent='Error loading PDF';console.error(e);}}
async _render(){if(!this.pdfDoc||this.rendering)return;this.rendering=true;const pg=await this.pdfDoc.getPage(this.pageNum);const vp=pg.getViewport({scale:this.scale});const c=el('pdf-canvas');const ctx=c.getContext('2d');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);await pg.render({canvasContext:ctx,viewport:vp}).promise;el('pdf-page-num').value=this.pageNum;el('pdf-zoom-label').textContent=Math.round(this.scale*100/this.fitScale)+'%';el('pdf-prev').disabled=this.pageNum<=1;el('pdf-next').disabled=this.pageNum>=this.pdfDoc.numPages;document.querySelectorAll('.pdf-thumb-item').forEach((e,i)=>e.classList.toggle('active',i+1===this.pageNum));document.querySelector('.pdf-thumb-item:nth-child('+this.pageNum+')')?.scrollIntoView({behavior:'smooth',block:'nearest'});this.rendering=false;}
async _buildThumbs(){const l=el('pdf-thumbs-list');if(!l||!this.pdfDoc)return;l.innerHTML='';for(let i=1;i<=this.pdfDoc.numPages;i++){const item=document.createElement('div');item.className='pdf-thumb-item'+(i===this.pageNum?' active':'');item.innerHTML='<canvas></canvas><div class="pdf-thumb-num">'+i+'</div>';item.addEventListener('click',()=>{this.pageNum=i;this._render();});l.appendChild(item);this._renderThumb(i,item.querySelector('canvas'));}}
async _renderThumb(n,c){try{const pg=await this.pdfDoc.getPage(n);const vp=pg.getViewport({scale:.22});c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;}catch(_){}}
_go(d){if(!this.pdfDoc)return;const n=this.pageNum+d;if(n>=1&&n<=this.pdfDoc.numPages){this.pageNum=n;this._render();}}
_zoom(d){this.scale=Math.max(.3,Math.min(6,this.scale+d));this._render();}
async _search(q){const c=el('pdf-search-count');if(!q.trim()||!this.pdfDoc){if(c)c.textContent='';this._sr=[];return;}const results=[];for(let i=1;i<=this.pdfDoc.numPages;i++){const pg=await this.pdfDoc.getPage(i);const tc=await pg.getTextContent();if(tc.items.map(t=>t.str).join(' ').toLowerCase().includes(q.toLowerCase()))results.push(i);}this._sr=results;this._si=results.length?0:-1;if(c)c.textContent=results.length?results.length+' pages':'Not found';if(results.length){this.pageNum=results[0];this._render();}}
_nextMatch(d){if(!this._sr?.length)return;this._si=(this._si+d+this._sr.length)%this._sr.length;this.pageNum=this._sr[this._si];this._render();}}
