/**
 * BM Player — Music dashboard
 *
 * Library rail, track list, Now Playing panel, queue, shuffle and repeat.
 *
 * mpv's playlist only ever holds one file (play() calls mpv.open([fp])), so
 * the queue here is the real playlist — transport controls and end-of-track
 * advancement both go through it rather than through mpv's own playlist
 * commands.
 *
 * v3.44.0: the list is a table (css/music.css): column heads that sort, one
 * row height, the artist under the title and the album in a column of its
 * own, neither shown when it only repeats the title. The folder's head shows
 * its covers, how many songs and how long, and plays them all in order or
 * shuffled. Starting a song no longer redraws the whole list, so the list
 * stays where it was scrolled to.
 */

import { el, fileURL, fmtSec, cleanTitle, pickFolder } from '../util.js';
import { setIcon, setPlaying } from '../icons.js';
import { isFav, toggleFav } from '../favourites.js';   // v3.43.0: a star on each song
import { Visualizer, vizSettings } from '../visualizer.js';
import { AudioEngine } from '../audio-engine.js';
import SpeedMenu from '../modules/speed-menu.js';

const AUDIO = new Set(['mp3', 'flac', 'aac', 'ogg', 'wav', 'm4a', 'wma', 'opus', 'ape', 'mka', 'm4b']);
const PAGE = 100;
const FOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
// Two tags say the same when their letters and digits match: "Adiye - From
// "Bachelor"" and "Adiye (From "Bachelor")" are one name.
const bare = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const sameText = (a, b) => { const x = bare(a); return !!x && x === bare(b); };
// Sorting by title starts at the first letter or digit, not at an emoji or a bracket.
const sortKey = s => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '');
const byText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const baseName = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || String(p || '');
function fmtTotal (sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' hr' + (r ? ' ' + r + ' min' : '');
}

export class MusicDash{constructor(api){this.api=api;
  // Renderer-side playback for audio-only files. Video always stays on mpv.
  // Off by default is the wrong default here — the whole point is the real
  // analyser — but one localStorage key turns it off if a codec misbehaves.
  this.engineEnabled = localStorage.getItem('bm_audio_engine') !== '0'
    && (window.__BM_FLAGS__?.audioEngine !== false);
  this.engine = new AudioEngine();
  if (this.engine.available) this._wireEngine();
  else this.engineEnabled = false;
  // The music's own speed (v3.38.0), kept from song to song and between runs,
  // with the pitch kept as it is. A film's speed is mpv's and stays apart.
  this.speed = Math.max(0.25, Math.min(4, +localStorage.getItem('bm_music_speed') || 1));
  this.engine.setSpeed(this.speed);
  this._filter='';
  this._desc=false;
  this.shuffle=localStorage.getItem('bm_music_shuffle')==='1';
  this.repeat=localStorage.getItem('bm_music_repeat')||'off';
  try{ this.folders=JSON.parse(localStorage.getItem('bm_music_folders')||'[]'); }catch(_){ this.folders=[]; }
  if(!Array.isArray(this.folders)) this.folders=[];
  this.tracks=[];this.queue=[];this.queueIdx=-1;this.currentPath=null;this._dur={};this._activePath=null;this.tags={};
  console.log('[MusicDash] Initialized, API:', !!api);
  this._wire();
  this.folders.forEach(f=>this._addFolder(f));
  if(this.folders.length) this._load(this.folders[0]);
  else this._updateHead();
}
_wire(){
  // The speed button in Now Playing (v3.38.0): always the music's.
  this._npSpeed=new SpeedMenu({mpvApi:()=>this.api?.mpv,osd:(m,ms)=>window.bmApp?.showOSD?.(m,ms),anchorId:'np-speed',music:()=>this.speedAdapter(),musicOnly:true});
  // Folder picker
  el('btn-music-open')?.addEventListener('click',()=>this.addFolder());
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
  // The folder's head (v3.44.0): every song, in order or shuffled.
  el('music-play-all')?.addEventListener('click',()=>this.playAll(false));
  el('music-shuffle-all')?.addEventListener('click',()=>this.playAll(true));
  const fi=el('music-filter');
  fi?.addEventListener('input',e=>{
    clearTimeout(this._mFilterTimer);
    this._mFilterTimer=setTimeout(()=>{ this._filter=e.target.value; this._resort(); },180);
  });
  // Escape empties the search first, before anything else takes the key.
  fi?.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!fi.value) return;
    e.preventDefault(); e.stopPropagation();
    fi.value=''; clearTimeout(this._mFilterTimer); this._filter=''; this._resort();
  });
  el('music-group')?.addEventListener('click',()=>{
    this._setGroup(!this.groupByAlbum);
    this._resort();
  });
  // Restore the persisted toggle states into the UI
  this._setShuffle(this.shuffle);
  if(this.repeat!=='off'){
    const b=el('np-btn-repeat');
    if(b){ b.classList.add('active'); setIcon(b,this.repeat==='one'?'repeatOne':'repeat'); b.title='Repeat ('+this.repeat+')'; b.setAttribute('aria-label',b.title); }
  }
  // The order chosen is kept between runs.
  const so=el('music-sort');
  if(so){
    const saved=localStorage.getItem('bm_music_sort');
    if(saved&&[...so.options].some(o=>o.value===saved)) so.value=saved;
    this._desc=localStorage.getItem('bm_music_sort_desc')==='1';
    so.addEventListener('change',()=>{ this._desc=false; this._resort(); });
  }
  // In the list: the column heads sort, and the buttons of an empty list act.
  el('music-tracks')?.addEventListener('click',e=>{
    const h=e.target.closest?.('.tr-h[data-sort]');
    if(h){ e.stopPropagation(); this._sortBy(h.dataset.sort); return; }
    const act=e.target.closest?.('[data-mv-act]')?.dataset.mvAct;
    if(act==='add'){ e.stopPropagation(); this.addFolder(); }
    else if(act==='clear'){ e.stopPropagation(); if(fi) fi.value=''; this._filter=''; this._resort(); fi?.focus(); }
  });
  // Seek bar. It sent time-pos to mpv, which is idle whenever the in-app
  // engine is playing, and it needed a tag duration the engine doesn't need.
  // v3.28.0: drag to scrub, or click. It took a click only, on a bar 5px
  // tall, so a click a little off it did nothing, a drag moved nothing until
  // the release, and a release off the bar did not seek at all. While you
  // drag, the bar and the time follow the pointer (pointer capture keeps it
  // going off the bar) and playback updates wait; letting go seeks there.
  const st=el('np-seek-track');
  // The library's duration for the track stands in if the player reports none.
  const durNow=()=>(this.engineOwns()?this.engine.duration:0)||this._dur[this.currentPath]||window.bmApp?.duration||0;
  const pctAt=x=>{const r=st.getBoundingClientRect();return Math.max(0,Math.min(1,(x-r.left)/(r.width||1)));};
  const preview=p=>{const f=el('np-seek-fill');if(f)f.style.width=(p*100)+'%';const c=el('np-time-cur'),d=durNow();if(c&&d)c.textContent=fmtSec(p*d);st?.setAttribute('aria-valuenow',String(Math.round(p*100)));};
  st?.addEventListener('pointerdown',e=>{
    if(e.button!==0||!this.currentPath||!durNow())return;
    e.preventDefault();st.setPointerCapture?.(e.pointerId);
    this._scrubbing=true;st.classList.add('scrubbing');
    let p=pctAt(e.clientX);preview(p);
    const move=ev=>{p=pctAt(ev.clientX);preview(p);};
    const done=()=>{
      st.removeEventListener('pointermove',move);st.removeEventListener('pointerup',done);st.removeEventListener('pointercancel',done);
      this._scrubbing=false;st.classList.remove('scrubbing');this._scrubEnded=performance.now();
      const d=durNow();if(d)window.bmApp?.seekTo(p*d);
    };
    st.addEventListener('pointermove',move);st.addEventListener('pointerup',done);st.addEventListener('pointercancel',done);
  });
  // A click with no pointer press before it (assistive tools, a click made
  // from the keyboard) seeks too. A real click comes after a press, which
  // already seeked, so a click straight after one is left alone.
  st?.addEventListener('click',e=>{
    if(performance.now()-(this._scrubEnded||0)<400)return;
    const d=durNow();if(!this.currentPath||!d)return;
    window.bmApp?.seekTo(pctAt(e.clientX)*d);
  });
  // The keyboard: left and right step five seconds.
  st?.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    const d=durNow();if(!this.currentPath||!d)return;
    e.preventDefault();
    const cur=this.engineOwns()?this.engine.currentTime:(window.bmApp?.currentTime||0);
    window.bmApp?.seekTo(Math.max(0,Math.min(d,cur+(e.key==='ArrowLeft'?-5:5))));
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
    if(p.name==='time-pos'&&this.currentPath&&!this._scrubbing){const dur=this._dur[this.currentPath];if(dur&&dur>0){const pct=(p.data/dur)*100;const f=el('np-seek-fill');if(f)f.style.width=pct+'%';const c=el('np-time-cur');if(c)c.textContent=fmtSec(p.data);}}
    if(p.name==='pause'){const on=!p.data&&!!this.currentPath;   // idle mpv reports 'not paused'
      el('np-bars')?.classList.toggle('playing',on);const b=el('np-btn-play');if(b)setPlaying(b,on);}
    if(p.name==='volume'){const s=el('np-volume');if(s)s.value=p.data;const l=el('np-vol-label');if(l)l.textContent=Math.round(p.data);}
  });
}

// ── Folders ────────────────────────────────────────────────────────
async addFolder(){
  const folder=await pickFolder(this.api);
  if(!folder) return;
  if(!this.folders.includes(folder)){
    this.folders.push(folder);
    try{ localStorage.setItem('bm_music_folders',JSON.stringify(this.folders)); }catch(_){}
    this._addFolder(folder);
  }
  this._load(folder);
}
_addFolder(fp){
  const s=el('music-lib-sections');if(!s)return;
  s.querySelector('.music-empty-lib')?.remove();
  const n=baseName(fp);
  const d=document.createElement('div');
  d.className='music-folder-item'; d.dataset.path=fp; d.title=fp;
  d.tabIndex=0; d.setAttribute('role','button');
  d.innerHTML=FOLDER_SVG;
  const nm=document.createElement('span'); nm.className='mf-name'; nm.textContent=n;   // a name is text, never markup
  // Out of the library, not off the disk.
  const rm=document.createElement('button'); rm.type='button'; rm.className='mf-remove';
  rm.title='Take this folder out of the library. Its files stay where they are.';
  rm.setAttribute('aria-label','Take '+n+' out of the library'); setIcon(rm,'x');
  rm.addEventListener('click',e=>{ e.stopPropagation(); this._removeFolder(fp); });
  rm.addEventListener('keydown',e=>e.stopPropagation());
  d.append(nm,rm);
  d.addEventListener('click',()=>this._load(fp));
  d.addEventListener('keydown',e=>{ if(e.target===d&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); this._load(fp); } });
  s.appendChild(d);
}
_removeFolder(fp){
  this.folders=this.folders.filter(f=>f!==fp);
  try{ localStorage.setItem('bm_music_folders',JSON.stringify(this.folders)); }catch(_){}
  document.querySelectorAll('.music-folder-item').forEach(e=>{ if(e.dataset.path===fp) e.remove(); });
  const s=el('music-lib-sections');
  if(s&&!this.folders.length){ const p=document.createElement('p'); p.className='music-empty-lib'; p.textContent='Folders you add show here.'; s.appendChild(p); }
  if(this._activePath===fp){
    if(this.folders.length) this._load(this.folders[0]);
    else{
      this._tagToken=(this._tagToken||0)+1; this._activePath=null; this.tracks=[]; this._filter='';
      const f=el('music-filter'); if(f) f.value='';
      this._renderTracks([]); this._buildQueue(); this._updateHead();
    }
  }
  window.bmApp?.showOSD?.('Taken out of the library. The files are still there.');
}
async _load(fp){
  this._activePath=fp;
  document.querySelectorAll('.music-folder-item').forEach(e=>e.classList.toggle('active',e.dataset.path===fp));
  const lbl=el('music-path-title');if(lbl)lbl.textContent=baseName(fp);
  let files=[];
  try{ files=await this.api?.gallery?.scan(fp)||[]; }catch(e){ console.error('[MusicDash] scan failed',e); }
  if(this._activePath!==fp) return;                   // another folder was opened meanwhile
  this.tracks=files.filter(f=>AUDIO.has(String(f.name||'').split('.').pop().toLowerCase()));
  this.tags=this.tags||{};
  this._filter='';
  const fi=el('music-filter'); if(fi) fi.value='';
  this._renderTracks(this._sorted(this.tracks,this._sortKey()));
  this._buildQueue();
  this._updateHead();
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
    this._renderTracks(this._sorted(this.tracks,this._sortKey()),true);   // where it was scrolled to
    this._updateHead();
    if(this.currentPath){ this._applyTagsToNowPlaying(this.currentPath); this._renderQueue(); }
    else this._buildQueue();          // Up next in the order the list now shows
  }
}
_meta(t){
  const g=this.tags?.[t.path]||{};
  const title=g.title||cleanTitle(t.name);
  // A tag that only repeats the title says nothing more (v3.44.0). Many
  // downloaded songs carry their title as the artist too, and a single its
  // title as the album. The folder's name stood in for a missing artist,
  // which put "Music" under half a library.
  const artist=g.artist&&!sameText(g.artist,title)?g.artist:'';
  const album=g.album||'';
  return {
    title, artist, album,
    albumShown: sameText(album,title)?'':album,
    cover:  g.cover  || null,
    ext:    t.name.split('.').pop().toUpperCase()
  };
}
_applyTagsToNowPlaying(fp){
  const t=this.tracks.find(x=>x.path===fp);if(!t)return;
  const m=this._meta(t);
  const set=(id,v)=>{const e=el(id);if(e)e.textContent=v;};
  // With no artist known, the album takes its line (often the film the song is from).
  set('np-title',m.title);set('np-artist',m.artist||m.albumShown);set('np-format',m.albumShown);
  const nt=el('np-title'); if(nt) nt.title=m.title;
  const ai=el('np-art-inner');
  if(ai&&m.cover){ ai.style.background='center/cover no-repeat url("'+fileURL(m.cover)+'")'; ai.innerHTML=''; }
  const mArt=el('mmp-art');
  if(mArt&&m.cover){ mArt.style.background='center/cover no-repeat url("'+fileURL(m.cover)+'")'; mArt.textContent=''; }
  window.bmApp?._vizArtFor?.(fp, m.cover);   // the visual mode shows it too (v3.32.0)
}

// ── Order ──────────────────────────────────────────────────────────
_sortKey(){ return el('music-sort')?.value||'title'; }
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
  const byName=(x,y)=>byText(x.name,y.name);
  const str=(x,k)=>(sortKey(meta(x)[k])||'\uffff').toLowerCase();   // untagged sorts last
  const no=x=>this.tags?.[x.path]?.trackNo||0;
  if(this.groupByAlbum) by='album';                     // grouped: album by album
  switch(by){
    case 'title':
      list.sort((x,y)=>byText(sortKey(meta(x).title),sortKey(meta(y).title))||byName(x,y));
      break;
    case 'artist':
      list.sort((x,y)=>str(x,'artist').localeCompare(str(y,'artist'))
                    || str(x,'album').localeCompare(str(y,'album'))
                    || (no(x)-no(y))
                    || byName(x,y));
      break;
    case 'album':
      list.sort((x,y)=>str(x,'album').localeCompare(str(y,'album'))
                    || (no(x)-no(y))
                    || byName(x,y));
      break;
    case 'added':
      list.sort((x,y)=>((y.mtime||0)-(x.mtime||0))||byName(x,y));
      break;
    case 'length':
      list.sort((x,y)=>((this._dur[x.path]||0)-(this._dur[y.path]||0))||byName(x,y));
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
  if(this._desc&&!this.groupByAlbum) list.reverse();
  return list;
}
_resort(){
  try{ localStorage.setItem('bm_music_sort',this._sortKey()); localStorage.setItem('bm_music_sort_desc',this._desc?'1':'0'); }catch(_){}
  this._renderTracks(this._sorted(this.tracks,this._sortKey()));
  this._updateHead();
}
/** A column head was pressed: sort by it, or the other way round when it already is. */
_sortBy(key){
  const sel=el('music-sort');
  if(this.groupByAlbum) this._setGroup(false);
  if(sel&&sel.value===key) this._desc=!this._desc;
  else{ if(sel) sel.value=key; this._desc=false; }
  this._resort();
  el('music-tracks')?.querySelector('.tr-h[data-sort="'+key+'"]')?.focus({preventScroll:true});
}
_setGroup(on){
  this.groupByAlbum=!!on;
  const b=el('music-group');
  if(b){ b.classList.toggle('active',this.groupByAlbum); b.setAttribute('aria-pressed',String(this.groupByAlbum)); }
}

// ── The folder's head ──────────────────────────────────────────────
_updateHead(){
  const has=this.tracks.length>0;
  el('music-view')?.querySelector('.music-center')?.classList.toggle('is-empty',!has);
  const t=el('music-path-title');
  if(t) t.textContent=this._activePath?baseName(this._activePath):'Music';
  const c=el('music-count');
  if(c){
    if(!this._activePath) c.textContent='No folder yet';
    else if(!has) c.textContent='No songs in this folder';
    else{
      const n=this.tracks.length, songs=n===1?'1 song':n+' songs';
      if((this._filter||'').trim()) c.textContent=(this._visible?.length||0)+' of '+songs;
      else{
        const total=this.tracks.reduce((s,x)=>s+(+this._dur[x.path]||0),0);
        c.textContent=songs+(total>=30?', '+fmtTotal(total):'');
      }
    }
  }
  const none=!(this._visible?.length);
  const p=el('music-play-all'), s=el('music-shuffle-all');
  if(p) p.disabled=none;
  if(s) s.disabled=none;
  const sel=el('music-sort');
  if(sel){ sel.disabled=!!this.groupByAlbum; sel.title=this.groupByAlbum?'Grouped by album, so the songs are in album order':''; }
  this._renderCover();
}
// Up to four covers from the folder, one from each album, as a 2 by 2 square.
_renderCover(){
  const box=el('music-cover'); if(!box) return;
  const covers=[], albums=new Set();
  for(const t of this.tracks){
    const g=this.tags?.[t.path]; if(!g?.cover) continue;
    const k=bare(g.album)||t.path; if(albums.has(k)) continue;
    albums.add(k); covers.push(g.cover);
    if(covers.length===4) break;
  }
  const show=covers.length>=4?covers:covers.slice(0,1);
  const key=show.join('|')||'blank';
  if(box.dataset.key===key) return;
  box.dataset.key=key;
  box.innerHTML='';
  box.classList.toggle('one',show.length<4);
  if(!show.length){ const b=document.createElement('span'); b.className='mv-cover-blank'; setIcon(b,'music'); box.appendChild(b); return; }
  for(const cv of show){ const s=document.createElement('span'); s.style.backgroundImage='url("'+fileURL(cv)+'")'; box.appendChild(s); }
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
    b.title='Repeat ('+this.repeat+')'; b.setAttribute('aria-label',b.title);
  }
  localStorage.setItem('bm_music_repeat',this.repeat);
  return this.repeat;
}
_setShuffle(on){
  this.shuffle=!!on;
  const b=el('np-btn-shuffle');
  if(b){ b.classList.toggle('active',this.shuffle); b.title='Shuffle ('+(this.shuffle?'on':'off')+')'; b.setAttribute('aria-label',b.title); b.setAttribute('aria-pressed',String(this.shuffle)); }
  try{ localStorage.setItem('bm_music_shuffle',this.shuffle?'1':'0'); }catch(_){}
}
_toggleShuffle(){
  this._setShuffle(!this.shuffle);
  this._buildQueue();
}
/** The head's Play and Shuffle: every song in the list, from the top or in a new order. */
playAll(shuffled){
  if(!(this._visible?.length||this.tracks.length)) return;
  this._setShuffle(!!shuffled);
  this.currentPath=null;            // nothing kept at the front: a fresh order
  this._buildQueue();
  if(this.queue.length) this.play(this.queue[0].path,0);
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

// ── The list ───────────────────────────────────────────────────────
/** keepScroll: the same list again with tags filled in, left where it was scrolled to. */
_renderTracks(tracks,keepScroll){
  const c=el('music-tracks');if(!c)return;
  const top=keepScroll?c.scrollTop:0;
  this._tio?.disconnect();
  this._visible=tracks;this._tpage=0;
  c.innerHTML='';
  c.classList.toggle('grouped',!!this.groupByAlbum);
  if(!tracks.length){ c.appendChild(this._emptyState()); return; }
  if(this.groupByAlbum){
    // How many songs each album has here, and by whom, for its head.
    this._groups=new Map();
    for(const t of tracks){
      const m=this._meta(t), k=m.album.trim().toLowerCase();
      const g=this._groups.get(k)||{n:0,artists:new Set()};
      g.n++; if(m.artist) g.artists.add(m.artist);
      this._groups.set(k,g);
    }
  }
  c.appendChild(this._headRow());
  this._renderTrackPage();
  if(top>0){
    while(c.scrollHeight<top+c.clientHeight&&this._tpage*PAGE<tracks.length) this._renderTrackPage();
    c.scrollTop=top;
  }
}
_emptyState(){
  const d=document.createElement('div'); d.className='music-empty-tracks';
  const ico=document.createElement('span'); ico.className='mv-empty-ico'; ico.setAttribute('aria-hidden','true');
  const h=document.createElement('p'); h.className='mv-empty-title';
  const p=document.createElement('p'); p.className='mv-empty-text';
  const q=(this._filter||'').trim();
  let btn=null;
  if(!this._activePath){
    setIcon(ico,'music'); h.textContent='Add your music';
    p.textContent='Choose a folder with songs in it. The folders inside it are read too.';
    btn={act:'add',icon:'addToQ',label:'Add a folder',primary:true};
  }else if(q&&this.tracks.length){
    setIcon(ico,'search'); h.textContent='No songs match “'+q+'”';
    p.textContent='Try fewer words, or part of a title, an artist or an album.';
    btn={act:'clear',icon:'x',label:'Clear the search'};
  }else{
    setIcon(ico,'folder'); h.textContent='No songs in this folder';
    p.textContent='BM Player plays MP3, FLAC, AAC, OGG, WAV, M4A, WMA, Opus, APE, MKA and M4B files.';
  }
  d.append(ico,h,p);
  if(btn){
    const b=document.createElement('button'); b.type='button';
    b.className=btn.primary?'mv-btn mv-btn-primary':'mv-btn';
    b.dataset.mvAct=btn.act; b.setAttribute('aria-label',btn.label); setIcon(b,btn.icon,btn.label);
    d.appendChild(b);
  }
  return d;
}
// The column heads. Pressing one sorts by it; again, the other way round.
_headRow(){
  const by=this.groupByAlbum?'album':this._sortKey();
  const h=document.createElement('div'); h.className='tr-head';
  const cell=(key,label,name,cls,icon)=>{
    const b=document.createElement('button'); b.type='button';
    b.className='tr-h'+(cls?' '+cls:'')+(key===by?(this._desc&&!this.groupByAlbum?' on desc':' on'):'');
    b.dataset.sort=key; b.title='Sort by '+name;
    b.setAttribute('aria-label','Sort by '+name);
    if(icon) setIcon(b,icon); else b.textContent=label;
    return b;
  };
  const fav=document.createElement('span'); fav.className='tr-h-fav';
  h.append(cell('name','#','file name','tr-h-num'),cell('title','Title','title'),cell('album','Album','album','tr-h-album'),fav,cell('length','','length','tr-h-dur','clock'));
  return h;
}
_renderTrackPage(){
  const c=el('music-tracks');if(!c)return;
  const s=this._visible||[];
  const start=this._tpage*PAGE, slice=s.slice(start,start+PAGE);
  if(!slice.length)return;
  el('tracks-sentinel')?.remove();
  if(this._tpage===0) this._lastAlbumKey=null;
  const frag=document.createDocumentFragment();
  slice.forEach((t,n)=>{
    const i=start+n, m=this._meta(t);
    // Album heads turn a flat list of files into something that reads like
    // a library. Only meaningful once tags have arrived, so it's a toggle.
    if(this.groupByAlbum){
      const key=m.album.trim().toLowerCase();
      if(key!==this._lastAlbumKey){ this._lastAlbumKey=key; frag.appendChild(this._albumHead(m.album,key)); }
    }
    frag.appendChild(this._row(t,i,m));
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
}
_albumHead(album,key){
  const g=this._groups?.get(key)||{n:0,artists:new Set()};
  const hd=document.createElement('div'); hd.className='track-album-header';
  const a=document.createElement('span'); a.className='tah-album'; a.textContent=album||'Unknown album';
  const ar=document.createElement('span'); ar.className='tah-artist';
  ar.textContent=g.artists.size>1?'Various artists':([...g.artists][0]||'');
  const n=document.createElement('span'); n.className='tah-count'; n.textContent=g.n===1?'1 song':g.n+' songs';
  hd.append(a,ar,n);
  return hd;
}
_eq(){
  const s=document.createElement('span'); s.className='tr-eq'; s.setAttribute('aria-hidden','true');
  s.append(document.createElement('i'),document.createElement('i'),document.createElement('i'));
  return s;
}
_row(t,i,m){
  const isP=t.path===this.currentPath;
  const row=document.createElement('div');
  row.className='track-row'+(isP?' playing':'');
  row.dataset.path=t.path; row.dataset.idx=i;
  row.tabIndex=0; row.setAttribute('role','button');
  row.setAttribute('aria-label',m.title+(m.artist?' by '+m.artist:''));
  if(isP) row.setAttribute('aria-current','true');

  const num=document.createElement('span');
  num.className='tr-num';
  if(isP) num.appendChild(this._eq()); else num.textContent=String(i+1);

  const cell=document.createElement('div'); cell.className='tr-title';
  const art=document.createElement('div');
  art.className='tr-art';
  if(m.cover) art.style.backgroundImage='url("'+fileURL(m.cover)+'")';
  else setIcon(art,'music');
  const info=document.createElement('div');
  info.className='tr-info';
  const nm=document.createElement('div');
  // CRITICAL: this was string-concatenated into innerHTML. A file called
  // 'Rock & Roll <live>.mp3' broke the row markup.
  nm.className='tr-name'; nm.textContent=m.title; nm.title=m.title;
  info.appendChild(nm);
  // The artist under the title. With none known the title stands alone, in
  // the middle of the row: a column of "Unknown artist" said nothing.
  if(m.artist){ const meta=document.createElement('div'); meta.className='tr-meta'; meta.textContent=m.artist; info.appendChild(meta); }
  cell.append(art,info);

  const al=document.createElement('div');
  al.className='tr-album'; al.textContent=m.albumShown; if(m.albumShown) al.title=m.albumShown;

  // The star (v3.43.0): the song in the welcome screen's Favourites row.
  const fv=document.createElement('button');
  const mark=on=>{ fv.className='tr-fav'+(on?' on':''); setIcon(fv,on?'starFill':'star'); fv.title=on?'Remove from favourites':'Add to favourites'; fv.setAttribute('aria-label',fv.title); fv.setAttribute('aria-pressed',String(on)); };
  fv.type='button'; mark(isFav(t.path));
  fv.addEventListener('click',e=>{ e.stopPropagation(); const on=toggleFav(t.path); mark(on); window.bmApp?.showOSD?.(on?'Added to favourites: it is on the home screen':'Taken out of favourites'); });
  fv.addEventListener('keydown',e=>e.stopPropagation());   // Enter on the star is the star's, not the row's

  const d=document.createElement('span');
  d.className='tr-dur'; d.textContent=this._dur[t.path]?fmtSec(this._dur[t.path]):'';

  row.append(num,cell,al,fv,d);
  const go=()=>this._rowGo(t);
  row.addEventListener('click',go);
  row.addEventListener('keydown',e=>{
    if(e.target!==row) return;
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); return; }
    // Up and down move along the list, past the album heads.
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      const step=e.key==='ArrowDown'?'nextElementSibling':'previousElementSibling';
      let n=row[step];
      while(n&&!n.classList.contains('track-row')) n=n[step];
      n?.focus();
    }
  });
  return row;
}
/** A row was pressed. Its song plays, and the list as it stands is what plays
 *  next. The song already playing pauses or plays on instead, as its mark says. */
_rowGo(t){
  if(t.path===this.currentPath&&this._live()){ this.toggle(); return; }
  this.currentPath=t.path;
  this._buildQueue();
  this.play(t.path,this.queueIdx);
}
/** True while the current song is loaded and can be paused or played on. */
_live(){
  if(this.engineOwns()) return !!this.engine.el?.src&&!this.engine.el.ended;
  return !!this.currentPath&&window.bmApp?._mpvIdle===false;
}
/** The playing row marked, and the one before unmarked, without redrawing the list. */
_markPlaying(){
  const c=el('music-tracks'); if(!c) return;
  for(const row of c.querySelectorAll('.track-row')){
    const on=row.dataset.path===this.currentPath;
    if(on===row.classList.contains('playing')) continue;
    row.classList.toggle('playing',on);
    if(on) row.setAttribute('aria-current','true'); else row.removeAttribute('aria-current');
    const num=row.querySelector('.tr-num');
    if(num){ num.textContent=''; if(on) num.appendChild(this._eq()); else num.textContent=String(+row.dataset.idx+1); }
  }
}
  // The mpv path gets its UI updates from property-change events in
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
      if(!this._scrubbing){   // a drag on the seek bar shows its own position
        const cur=el('np-time-cur'); if(cur)cur.textContent=fmtSec(d.time);
        const fill=el('np-seek-fill'); if(fill)fill.style.width=pct+'%';
      }
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
    // mpv played a song at the music's speed: the film gets its own back (v3.38.0).
    if(this._filmSpeed!=null){const v=this._filmSpeed;this._filmSpeed=null;this.api?.mpv?.cmd('set_property','speed',v);}
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

  /** The music's speed for the speed menus (v3.38.0). */
  speedAdapter(){
    return {
      owns:()=>this.engineOwns(),
      get:()=>this.speed,
      set:s=>{
        this.speed=Math.max(0.25,Math.min(4,+s||1));
        try{localStorage.setItem('bm_music_speed',String(this.speed));}catch(_){}
        this.engine?.setSpeed(this.speed);
        // A song mpv plays (a format the engine cannot): mpv's speed, as before.
        if(!this.engineOwns()&&this.currentPath&&!window.bmApp?._hasVideo)this.api?.mpv?.cmd('set_property','speed',this.speed);
        this._npSpeed?.sync();window.bmApp?.speedMenu?.sync?.();
      },
    };
  }

  toggle(){
    if(this.engineOwns()) return this.engine.toggle();
    this.api?.mpv?.cmd('cycle','pause');
  }


play(fp,idx){
    this.currentPath=fp;
    // Where the song is in the queue. The index the caller had is its place in
    // the list on screen, which is not the queue's when shuffled or searched.
    const qi=this.queue.findIndex(q=>q.path===fp);
    this.queueIdx=qi>=0?qi:(idx||0);
    const useEngine=this.engineEnabled&&this.engine.available&&this.engine.canPlay(fp);
    if(useEngine){
      // Stop mpv first or both would play at once.
      this.api?.mpv?.cmd('stop');
      this.engine.load(fileURL(fp),fp,true);
      this.engine.setSpeed(this.speed);
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
      // mpv's speed is the film's. It is kept aside while mpv plays a song at
      // the music's own speed, and given back when a film opens (v3.38.0).
      if(this._filmSpeed==null)this._filmSpeed=window.bmApp?.speedMenu?._current||1;
      this.api.mpv.open([fp]);
      this.api.mpv.cmd('set_property','speed',this.speed);
    }
    window.bmApp?.speedMenu?.sync?.(); this._npSpeed?.sync();   // the speed shown is now the music's (v3.38.0)
    const _m=this.tags?.[fp]||{};const title=_m.title||cleanTitle(fp.split(/[\\/]/).pop());
    // Its lyrics (v3.38.0): beside it, inside it, or online.
    window.bmLyrics?.song(fp,{title,artist:_m.artist||null,album:_m.album||null,duration:_m.duration||this._dur?.[fp]||null});
    // Now Playing: the cover's place shows a note until the tags give one.
    const ai=el('np-art-inner');
    if(ai){ ai.style.background=''; ai.innerHTML='<span class="np-art-placeholder"></span>'; setIcon(ai.firstChild,'music'); }
    el('np-art')?.classList.add('has-track');
    const nt=el('np-title'); if(nt){ nt.textContent=title; nt.title=title; }
    const na=el('np-artist'); if(na) na.textContent=(_m.artist&&!sameText(_m.artist,title))?_m.artist:'';
    const nf=el('np-format'); if(nf) nf.textContent='';
    el('np-bars')?.classList.add('playing');
    // The style chosen in the visualiser's settings, here as everywhere (it
    // was always Bars in this view, whatever was chosen).
    this._viz?.setMode(vizSettings().style);this._viz?.start();
    this._markPlaying();this._renderQueue();this._applyTagsToNowPlaying(fp);
}
_renderQueue(){
  const q=el('np-queue');if(!q)return;
  // With nothing playing, what Play would start with.
  const from=this.currentPath?this.queueIdx+1:0;
  const next=this.queue.slice(from,from+30);
  q.innerHTML='';
  if(!next.length){
    const e=document.createElement('div'); e.className='np-q-end';
    e.textContent=this.currentPath?'Nothing after this song.':'Songs line up here when one plays.';
    q.appendChild(e); return;
  }
  next.forEach((t,k)=>{
    const m=this._meta(t), idx=from+k;
    const d=document.createElement('div');
    d.className='np-q-item'; d.tabIndex=0; d.setAttribute('role','button');
    d.setAttribute('aria-label','Play '+m.title+(m.artist?' by '+m.artist:''));
    const n=document.createElement('span'); n.className='np-q-n'; n.textContent=String(k+1);
    const tx=document.createElement('span'); tx.className='np-q-text';
    const ti=document.createElement('span'); ti.className='np-q-t'; ti.textContent=m.title;      // was unescaped innerHTML
    const ar=document.createElement('span'); ar.className='np-q-a'; ar.textContent=m.artist||m.albumShown;
    tx.append(ti,ar);
    const du=document.createElement('span'); du.className='np-q-d'; du.textContent=this._dur[t.path]?fmtSec(this._dur[t.path]):'';
    d.append(n,tx,du);
    const go=()=>this.play(t.path,idx);
    d.addEventListener('click',go);
    d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
    q.appendChild(d);
  });
}}

// ── PDF ────────────────────────────────────────────────────────
