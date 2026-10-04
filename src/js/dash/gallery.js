/**
 * BM Player — Gallery dashboard
 *
 * Folder browsing, paged thumbnail grid, lightbox with zoom/pan, filmstrip,
 * slideshow and the image info drawer.
 *
 * Rendering is paged (120 cards at a time behind an IntersectionObserver)
 * and thumbnail requests are queued at a concurrency of 5, because the
 * recursive scan can return thousands of files and both the DOM and the
 * main process fall over if you hand them all of it at once.
 */

import { el, fileURL, fmtBytes, pickFolder } from '../util.js';
import { setPlaying } from '../icons.js';

export class GalleryDash{constructor(api){this.api=api;this.images=[];this.lbIdx=-1;this.lbScale=1;this.lbOffset={x:0,y:0};this.viewMode='masonry';this.thumbSize=190;this.sortMode='name';this._dragStart=null;this._filter='';this._wire();this._wireGalleryExtras();}
_wire(){el('btn-gallery-open')?.addEventListener('click',()=>this._browse());el('gallery-sort')?.addEventListener('change',e=>{this.sortMode=e.target.value;this._render();});el('thumb-size')?.addEventListener('input',e=>{this.thumbSize=+e.target.value;const g=el('gallery-grid');if(g)g.style.setProperty('--thumb-size',this.thumbSize+'px');});document.querySelectorAll('.vm-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.vm-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');this.viewMode=b.dataset.mode;this._render();}));el('lightbox-close')?.addEventListener('click',()=>this._closeLB());el('lb-backdrop')?.addEventListener('click',()=>this._closeLB());el('lightbox-prev')?.addEventListener('click',()=>this._nav(-1));el('lightbox-next')?.addEventListener('click',()=>this._nav(+1));el('lb-zoom-in')?.addEventListener('click',()=>this._zoom(.25));el('lb-zoom-out')?.addEventListener('click',()=>this._zoom(-.25));el('lb-fit')?.addEventListener('click',()=>this._resetZoom());el('lightbox')?.addEventListener('wheel',e=>{e.preventDefault();this._zoom(e.deltaY<0?.15:-.15);},{passive:false});document.addEventListener('keydown',e=>{if(!el('lightbox')?.classList.contains('open'))return;if(e.key==='Escape')this._closeLB();if(e.key==='ArrowLeft')this._nav(-1);if(e.key==='ArrowRight')this._nav(+1);if(e.key==='s'||e.key==='S')this._toggleSlideshow();if(e.key==='i'||e.key==='I')el('lb-info-drawer')?.classList.toggle('hidden');});const f=document.querySelector('.lb-frame');if(f){f.addEventListener('mousedown',e=>{this._dragStart={x:e.clientX-this.lbOffset.x,y:e.clientY-this.lbOffset.y};});f.addEventListener('mousemove',e=>{if(!this._dragStart)return;this.lbOffset={x:e.clientX-this._dragStart.x,y:e.clientY-this._dragStart.y};this._applyT();});f.addEventListener('mouseup',()=>{this._dragStart=null;});f.addEventListener('mouseleave',()=>{this._dragStart=null;});}}
async _browse(){
  const folder = await pickFolder(this.api);
  if(!folder) return;
  let files=[];
  try{ files = await this.api.gallery.scan(folder) || []; }
  catch(e){ console.error('[GalleryDash] scan failed',e); }
  const IMG=new Set(['jpg','jpeg','png','webp','gif','bmp','tiff','avif']);
  this.images=files.filter(f=>IMG.has(f.name.split('.').pop().toLowerCase()));
  const c=el('gallery-count');
  if(c)c.textContent=this.images.length?this.images.length+' images':'No images';
  this._render();
}
  // ── Gallery: filter, slideshow, filmstrip, info ────────────────
  _wireGalleryExtras(){
    const f=el('gallery-filter');
    if(f) f.addEventListener('input',e=>{
      clearTimeout(this._filterTimer);
      this._filterTimer=setTimeout(()=>{
        this._filter=e.target.value;
        this._flushThumbQueue();
        this._render();
        const c=el('gallery-count');
        if(c){
          const n=this._sorted().length;
          c.textContent=this._filter?.trim()
            ? n+' of '+this.images.length+' images'
            : (this.images.length?this.images.length+' images':'No images');
        }
      },180);
    });
    el('lb-slideshow')?.addEventListener('click',()=>this._toggleSlideshow());
    el('lb-info')?.addEventListener('click',()=>el('lb-info-drawer')?.classList.toggle('hidden'));
  }

  _toggleSlideshow(force){
    const on=force!==undefined?force:!this._slideshow;
    this._slideshow=on;
    const b=el('lb-slideshow');
    if(b){ setPlaying(b,on); b.classList.toggle('active',on); }
    clearInterval(this._slideTimer);
    if(on){
      this._slideTimer=setInterval(()=>{
        if(!el('lightbox')?.classList.contains('open')){ this._toggleSlideshow(false); return; }
        this._nav(1);
      },4000);
    }
  }

  // Filmstrip: without it there's no sense of where you are in a set of 800.
  _renderFilmstrip(){
    const strip=el('lb-filmstrip');
    if(!strip) return;
    const s=this._sortedCache||this._sorted();
    strip.innerHTML='';
    // Only a window around the current image — 800 thumbnails would defeat
    // the point of paging the grid in the first place.
    const from=Math.max(0,this.lbIdx-12), to=Math.min(s.length,this.lbIdx+13);
    const frag=document.createDocumentFragment();
    for(let i=from;i<to;i++){
      const img=s[i];
      const t=document.createElement('div');
      t.className='lb-strip-item'+(i===this.lbIdx?' active':'');
      t.title=img.name;
      const im=document.createElement('img');
      im.loading='lazy'; im.alt=''; im.decoding='async';
      this._thumbInto(im,img.path);
      t.appendChild(im);
      t.addEventListener('click',()=>this._openLB(i));
      frag.appendChild(t);
    }
    strip.appendChild(frag);
    strip.querySelector('.lb-strip-item.active')?.scrollIntoView({block:'nearest',inline:'center'});
  }

  _renderImageInfo(img){
    const d=el('lb-info-drawer');
    if(!d) return;
    const im=el('lightbox-img');
    const rows=[
      ['Name',  img.name],
      ['Folder',(img.dir||img.path).replace(/[\\/][^\\/]*$/,'')],
      ['Type',  (img.name.split('.').pop()||'').toUpperCase()],
      ['Size',  img.size?fmtBytes(img.size):'—'],
      ['Dimensions', im&&im.naturalWidth?im.naturalWidth+' × '+im.naturalHeight:'—'],
      ['Modified',   img.mtime?new Date(img.mtime).toLocaleString():'—'],
    ];
    d.innerHTML='';
    for(const [k,v] of rows){
      const r=document.createElement('div'); r.className='lb-info-row';
      const kk=document.createElement('span'); kk.className='lb-info-key'; kk.textContent=k;
      const vv=document.createElement('span'); vv.className='lb-info-val'; vv.textContent=v;
      r.append(kk,vv); d.appendChild(r);
    }
  }

_sorted(){
  let list=[...this.images];
  const q=(this._filter||'').trim().toLowerCase();
  if(q) list=list.filter(i=>i.name.toLowerCase().includes(q));
  const by=this.sortMode||'name';
  const name=(x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true,sensitivity:'base'});
  switch(by){
    case 'name-desc': list.sort((x,y)=>name(y,x)); break;
    case 'type':      list.sort((x,y)=>(x.name.split('.').pop()||'').localeCompare(y.name.split('.').pop()||'')||name(x,y)); break;
    case 'size':      list.sort((x,y)=>(y.size||0)-(x.size||0)||name(x,y)); break;
    case 'date':      list.sort((x,y)=>(y.mtime||0)-(x.mtime||0)||name(x,y)); break;
    default:          list.sort(name);
  }
  return list;
}
_render(){
  const g=el('gallery-grid');if(!g)return;
  g.className='gallery-grid '+this.viewMode+'-view';
  g.style.setProperty('--thumb-size',this.thumbSize+'px');
  this._page=0;
  if(!this.images.length){
    g.innerHTML='<div class="gallery-empty-state"><div style="font-size:60px">&#128444;</div><p style="margin-top:10px">Click <strong>Open Folder</strong></p></div>';
    return;
  }
  g.innerHTML='';
  this._sortedCache=this._sorted();
  this._renderPage();
}
// PAGED: the grid used to build one innerHTML string for every file in the
// folder. After the scan became recursive that can be thousands of nodes and
// thousands of full-resolution decodes at once. 120 at a time, more as you
// scroll.
_renderPage(){
  const g=el('gallery-grid');if(!g)return;
  const PAGE=120;
  const s=this._sortedCache||[];
  const start=this._page*PAGE, slice=s.slice(start,start+PAGE);
  if(!slice.length) return;
  el('gallery-sentinel')?.remove();
  const frag=document.createDocumentFragment();
  slice.forEach((img,n)=>{
    const i=start+n;
    const card=document.createElement('div');
    card.className='g-card';
    card.dataset.idx=i;
    card.tabIndex=0;                       // keyboard-reachable
    card.setAttribute('role','button');
    card.setAttribute('aria-label',img.name);
    const im=document.createElement('img');
    im.loading='lazy'; im.alt=img.name; im.decoding='async';
    // A file deleted or renamed since the scan used to fail silently, leaving
    // a blank card with no explanation.
    im.addEventListener('error',()=>{
      if(im.dataset.missing) return;
      im.dataset.missing='1';
      card.classList.add('g-card-missing');
      card.title=img.name+' — file could not be read';
    });
    const ov=document.createElement('div');
    ov.className='g-card-overlay';
    const nm=document.createElement('span');
    nm.className='g-card-name'; nm.textContent=img.name;   // textContent, never innerHTML
    ov.appendChild(nm); card.appendChild(im); card.appendChild(ov);
    const open=()=>this._openLB(i);
    card.addEventListener('click',open);
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    frag.appendChild(card);
    this._thumbInto(im,img.path);
  });
  g.appendChild(frag);
  this._page++;
  if(this._page*PAGE < s.length){
    const sent=document.createElement('div');
    sent.id='gallery-sentinel';
    sent.style.cssText='grid-column:1/-1;height:1px';
    g.appendChild(sent);
    this._io?.disconnect();
    this._io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))this._renderPage();},{root:g,rootMargin:'600px'});
    this._io.observe(sent);
  }
}
// Bounded concurrency. The page renders 120 cards at once and each one fired
// its own IPC round-trip immediately, so the main process took 120 simultaneous
// OS thumbnail requests — on a folder of RAWs that stalls it for seconds.
// A card shows its thumbnail, never the original first (v3.32.0). It loaded the
// full photo and swapped the thumbnail in later, so a page of large photos was
// decoded in full, and loading the gallery dragged. Without the system's
// thumbnailer (Linux) the thumbnail is made here, decoded and shrunk off the
// main thread, two at a time. The original is the last resort.
_thumbInto(im,p){
  im.classList.add('g-wait');
  this._thumb(p).then(async t=>{
    let url=t?fileURL(t):null;
    if(!url) url=await this._shrink(p).catch(()=>null);
    im.src=url||fileURL(p);
    im.classList.remove('g-wait');
  });
}
async _shrink(p){
  this._shrunk=this._shrunk||new Map();
  if(this._shrunk.has(p)) return this._shrunk.get(p);
  this._sq=this._sq||{active:0,wait:[]};
  if(this._sq.active>=2) await new Promise(r=>this._sq.wait.push(r));
  this._sq.active++;
  try{
    const size=Math.max(240,Math.round(this.thumbSize*2));
    const blob=await (await fetch(fileURL(p))).blob();
    const bmp=await createImageBitmap(blob,{resizeWidth:size,resizeQuality:'medium'});   // decoded off the main thread
    const c=document.createElement('canvas'); c.width=bmp.width; c.height=bmp.height;
    c.getContext('2d').drawImage(bmp,0,0); bmp.close?.();
    const out=await new Promise(r=>c.toBlob(r,'image/jpeg',0.84));
    const url=out?URL.createObjectURL(out):null;
    this._shrunk.set(p,url);
    // Kept to 500 (v3.33.0): every one held its image in memory for good.
    if(this._shrunk.size>500){ const [k,u]=this._shrunk.entries().next().value; this._shrunk.delete(k); if(u) URL.revokeObjectURL(u); }
    return url;
  }finally{ this._sq.active--; this._sq.wait.shift()?.(); }
}
async _thumb(p){
  if(!this.api?.gallery?.thumb) return null;
  this._thumbCache=this._thumbCache||new Map();
  if(this._thumbCache.has(p)) return this._thumbCache.get(p);
  this._tq=this._tq||{active:0,queue:[],max:5};
  const size=Math.max(240,Math.round(this.thumbSize*2));
  return new Promise(resolve=>{
    const run=async()=>{
      this._tq.active++;
      let t=null;
      try{ t=await this.api.gallery.thumb(p,size); }catch(_){}
      this._thumbCache.set(p,t);
      this._tq.active--;
      resolve(t);
      const next=this._tq.queue.shift();
      if(next) next();
    };
    if(this._tq.active<this._tq.max) run(); else this._tq.queue.push(run);
  });
}
// Dropping a folder mid-scroll leaves queued work for images nobody will see.
_flushThumbQueue(){ if(this._tq) this._tq.queue.length=0; }

_openLB(idx){this.lbIdx=idx;this._sortedCache=this._sortedCache||this._sorted();this._resetZoom();const s=this._sorted();const img=s[idx];const i=el('lightbox-img'),cap=el('lightbox-caption'),ct=el('lb-counter'),lb=el('lightbox');if(!img||!i||!lb)return;i.src=fileURL(img.path);
    i.addEventListener('load',()=>this._renderImageInfo(img),{once:true});
    this._renderFilmstrip();
    this._renderImageInfo(img);if(cap)cap.textContent=img.name;if(ct)ct.textContent=(idx+1)+' / '+s.length;lb.classList.add('open');}
_closeLB(){this._toggleSlideshow(false);el('lightbox')?.classList.remove('open');this._resetZoom();}
_nav(d){const s=this._sorted();this.lbIdx=(this.lbIdx+d+s.length)%s.length;this._openLB(this.lbIdx);}
_zoom(d){this.lbScale=Math.max(.15,Math.min(8,this.lbScale+d));this._applyT();const l=el('lb-zoom-label');if(l)l.textContent=Math.round(this.lbScale*100)+'%';}
_resetZoom(){this.lbScale=1;this.lbOffset={x:0,y:0};this._applyT();const l=el('lb-zoom-label');if(l)l.textContent='100%';}
_applyT(){const i=el('lightbox-img');if(i)i.style.transform='translate('+this.lbOffset.x+'px,'+this.lbOffset.y+'px) scale('+this.lbScale+')';}}

// ── Music ──────────────────────────────────────────────────────
