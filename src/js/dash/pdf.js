/**
 * BM Player — PDF viewer
 *
 * Rendering, page navigation, rotation, annotation, merge/save, the outline
 * panel, the selectable text layer, and search.
 *
 * Search extracts every page's text ONCE into a per-document cache. It used
 * to re-scan the whole document on every keystroke with no cancellation, so
 * results could belong to a query the user had already edited away.
 */

import { el, fileURL } from '../util.js';

export class PDFViewer{constructor(api){this.api=api;this.pdfDoc=null;this.pageNum=1;this.scale=1.4;this.fitScale=1.4;this.rendering=false;this._sr=[];this._si=-1;
    console.log('[PDFViewer] Initialized, API:', !!api);
    this.filePath=null;this.pageRotations={};this.deletedPages=new Set();this.pageOrder=[];
    this.annotations={};this.annotateMode=false;this._pendingStamp=null;
    this._wire();this._wireEdit();}
_wire(){el('btn-pdf-open')?.addEventListener('click',()=>this._open());el('pdf-prev')?.addEventListener('click',()=>this._go(-1));el('pdf-next')?.addEventListener('click',()=>this._go(+1));el('pdf-page-num')?.addEventListener('change',e=>{const n=parseInt(e.target.value);if(n>=1&&n<=(this.pageOrder?.length||1)){this.pageNum=n;this._render();}});el('pdf-zoom-out')?.addEventListener('click',()=>this._zoom(-.2));el('pdf-zoom-in')?.addEventListener('click',()=>this._zoom(.2));el('pdf-fit')?.addEventListener('click',()=>{this.scale=this.fitScale;this._render();});el('pdf-toggle-outline')?.addEventListener('click',()=>{const o=el('pdf-outline');if(!o)return;o.classList.toggle('hidden');if(!o.classList.contains('hidden')&&!this._outlineBuilt){this._outlineBuilt=true;this._buildOutline();}});el('pdf-search')?.addEventListener('input',e=>this._searchDebounced(e.target.value));el('pdf-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')this._nextMatch(e.shiftKey?-1:1);});document.addEventListener('keydown',e=>{if(!el('pdf-view')?.classList.contains('active'))return;if(e.key==='ArrowRight'||e.key==='ArrowDown')this._go(1);if(e.key==='ArrowLeft'||e.key==='ArrowUp')this._go(-1);});}
  _wireEdit(){
    el('pdf-rotate-left') ?.addEventListener('click',()=>this._rotate(-90));
    el('pdf-rotate-right')?.addEventListener('click',()=>this._rotate(90));
    el('pdf-delete-page') ?.addEventListener('click',()=>this._deletePage());
    el('btn-pdf-merge')   ?.addEventListener('click',()=>this._mergeWith());
    el('btn-pdf-annotate')?.addEventListener('click',()=>this._toggleAnnotate());
    el('btn-pdf-save')    ?.addEventListener('click',()=>this._saveAs());
    // Annotation click-to-place
    const ac=el('pdf-annotate-canvas');
    ac?.addEventListener('click',e=>{
      if(!this.annotateMode)return;
      const r=ac.getBoundingClientRect();
      const x=e.clientX-r.left,y=e.clientY-r.top;
      this._pendingStamp={x,y};
      const box=el('pdf-stamp-input');
      if(box){box.classList.remove('hidden');box.style.left=e.clientX+'px';box.style.top=e.clientY+'px';el('pdf-stamp-text').value='';el('pdf-stamp-text').focus();}
    });
    el('pdf-stamp-confirm')?.addEventListener('click',()=>this._confirmStamp());
    el('pdf-stamp-cancel') ?.addEventListener('click',()=>this._cancelStamp());
    el('pdf-stamp-text')?.addEventListener('keydown',e=>{if(e.key==='Enter')this._confirmStamp();if(e.key==='Escape')this._cancelStamp();});
  }
  _rotate(delta){
    if(!this.pdfDoc)return;
    const orig=this._origPage();
    this.pageRotations[orig]=((this.pageRotations[orig]||0)+delta+360)%360;
    this._dirty=true;
    this._render();this._buildThumbs();
  }
  _deletePage(){
    if(!this.pdfDoc||this.pageOrder.length<=1)return;
    this.pageOrder.splice(this.pageNum-1,1);
    this._dirty=true;
    this.pageNum=Math.max(1,Math.min(this.pageNum,this.pageOrder.length));
    el('pdf-total').textContent=this.pageOrder.length;
    this._render();this._buildThumbs();
  }
  async _mergeWith(){
    if(!window.PDFLib){alert('pdf-lib not loaded — check your internet connection');return;}
    const otherPath=await this.api?.dialog?.openPDF?.();
    if(!otherPath)return;
    try{
      const { PDFDocument }=window.PDFLib;
      const curBytes=this._sourceBytes||await(await fetch(fileURL(this.filePath))).arrayBuffer();
      const otherBytes=await(await fetch(fileURL(otherPath))).arrayBuffer();
      const curDoc=await PDFDocument.load(curBytes);
      const otherDoc=await PDFDocument.load(otherBytes);
      const merged=await PDFDocument.create();
      // Copy pages in this document's CURRENT working order (respects reorder/delete already applied)
      const curPageIndices=this.pageOrder.map(p=>p-1);
      const copiedCur=await merged.copyPages(curDoc,curPageIndices);
      copiedCur.forEach(p=>merged.addPage(p));
      const otherIndices=otherDoc.getPageIndices();
      const copiedOther=await merged.copyPages(otherDoc,otherIndices);
      copiedOther.forEach(p=>merged.addPage(p));
      const mergedBytes=await merged.save();
      await this.load(null,mergedBytes);
      this._dirty=true;
      el('pdf-filename').textContent='Merged: + '+otherPath.split(/[\\/]/).pop()+' (unsaved)';
    }catch(e){console.error('Merge failed:',e);alert('Merge failed: '+e.message);}
  }
  _toggleAnnotate(){
    this.annotateMode=!this.annotateMode;
    el('btn-pdf-annotate')?.classList.toggle('active-opt',this.annotateMode);
    el('pdf-canvas-wrap')?.classList.toggle('annotate-mode',this.annotateMode);
    el('pdf-edit-hint').textContent=this.annotateMode?'Click on the page to add a text stamp':'Drag thumbnails to reorder pages';
  }
  _confirmStamp(){
    const text=el('pdf-stamp-text')?.value?.trim();
    if(text&&this._pendingStamp){
      const orig=this._origPage();
      if(!this.annotations[orig])this.annotations[orig]=[];
      this.annotations[orig].push({x:this._pendingStamp.x,y:this._pendingStamp.y,text});
      this._dirty=true;
      this._redrawAnnotations();
    }
    this._cancelStamp();
  }
  _cancelStamp(){this._pendingStamp=null;el('pdf-stamp-input')?.classList.add('hidden');}
  async _saveAs(){
    if(!this.pdfDoc)return;
    if(!window.PDFLib){alert('pdf-lib not loaded — check your internet connection');return;}
    try{
      const { PDFDocument, rgb, degrees }=window.PDFLib;
      const srcBytes=this._sourceBytes||await(await fetch(fileURL(this.filePath))).arrayBuffer();
      const srcDoc=await PDFDocument.load(srcBytes);
      const outDoc=await PDFDocument.create();
      const indices=this.pageOrder.map(p=>p-1);
      const copied=await outDoc.copyPages(srcDoc,indices);
      copied.forEach((page,i)=>{
        outDoc.addPage(page);
        const orig=this.pageOrder[i];
        const rot=this.pageRotations[orig]||0;
        if(rot)page.setRotation(degrees((page.getRotation().angle||0)+rot));
        const anns=this.annotations[orig];
        if(anns?.length){
          const { height }=page.getSize();
          const scaleFactor=1/this.scale;   // convert our canvas px back to PDF points
          anns.forEach(a=>{
            page.drawText(a.text,{x:a.x*scaleFactor,y:height-(a.y*scaleFactor)-16,size:14,color:rgb(0.87,0.16,0.32)});
          });
        }
      });
      const outBytes=await outDoc.save();
      const defaultName=(this.filePath?this.filePath.split(/[\\/]/).pop().replace(/\.pdf$/i,''):'document')+'-edited.pdf';
      const savePath=await this.api?.dialog?.savePDF?.(defaultName);
      if(!savePath)return;
      const result=await this.api?.pdfFile?.write(savePath,outBytes);
      if(result?.error){alert('Save failed: '+result.error);return;}
      this._dirty=false;
      el('pdf-filename').textContent=savePath.split(/[\\/]/).pop();
      this.filePath=savePath;this._sourceBytes=null;
      window.bmApp?.showOSD?.('✓ PDF saved: '+savePath.split(/[\\/]/).pop(),2500);
    }catch(e){console.error('Save failed:',e);alert('Save failed: '+e.message);}
  }
  async _open(){
    if(!this.api?.dialog?.openPDF){
      alert('File dialogs are unavailable — the preload bridge did not load.\nOpen DevTools (Ctrl+Shift+I) and check for a preload error.');
      return;
    }
    let f=null;
    try{ f = await this.api.dialog.openPDF(); }
    catch(e){ console.error('[PDFViewer] open failed',e); alert('Could not open the PDF dialog:\n'+(e?.message||e)); return; }
    if(f) await this.load(f);
  }
  async load(fp,bytesOverride){const lib=window.pdfjsLib;if(!lib){alert('PDF.js not loaded — check your internet connection');return;}
    el('pdf-filename').textContent='Loading...';el('pdf-thumbs-list').innerHTML='';el('pdf-canvas').style.display='none';el('pdf-empty').style.display='flex';
    this.pageRotations={};this.annotations={};this.deletedPages=new Set();this._sourceBytes=null;this._dirty=false;
    try{
      let docSrc;
      if(bytesOverride){this._sourceBytes=bytesOverride;docSrc={data:bytesOverride};this.filePath=null;}
      else{const src=fp.startsWith('http')?fp:fileURL(fp);docSrc=src;this.filePath=fp;}
    // New document — everything derived from the old one is stale.
    this._textCache=null;this._textCacheFor=null;this._sr=[];this._si=-1;
    this._searchTerm='';this._outlineBuilt=false;
    const ob=el('pdf-outline-body');if(ob)ob.innerHTML='';
      this.pdfDoc=await lib.getDocument(docSrc).promise;
      this.pageOrder=Array.from({length:this.pdfDoc.numPages},(_,i)=>i+1);
      this.pageNum=1;
      el('pdf-total').textContent=this.pageOrder.length;
      el('pdf-page-num').max=this.pageOrder.length;
      el('pdf-filename').textContent=bytesOverride?'Merged document (unsaved)':fp.split(/[\\/]/).pop();
      const pg=await this.pdfDoc.getPage(1);
      const nw=pg.getViewport({scale:1}).width;
      const vw=(el('pdf-main')?.clientWidth||600)-56;
      this.fitScale=Math.max(.5,Math.min(3,vw/nw));this.scale=this.fitScale;
      el('pdf-empty').style.display='none';el('pdf-canvas').style.display='block';
      await this._render();this._buildThumbs();
    }catch(e){el('pdf-filename').textContent='Error loading PDF';console.error(e);}
  }
  _origPage(){return this.pageOrder[this.pageNum-1];}
  async _render(){
    if(!this.pdfDoc||this.rendering)return;this.rendering=true;
    const orig=this._origPage();
    const pg=await this.pdfDoc.getPage(orig);
    const extraRot=this.pageRotations[orig]||0;
    const vp=pg.getViewport({scale:this.scale,rotation:((pg.rotate||0)+extraRot)%360});
    const c=el('pdf-canvas');const ctx=c.getContext('2d');
    c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
    await pg.render({canvasContext:ctx,viewport:vp}).promise;
    // Size + redraw the annotation overlay to match
    const ac=el('pdf-annotate-canvas');
    if(ac){ac.width=c.width;ac.height=c.height;this._redrawAnnotations();}
    // Selectable text + search highlighting, positioned over the canvas.
    this._buildTextLayer(pg,vp).catch(e=>console.warn('[PDF] text layer failed',e));
    el('pdf-page-num').value=this.pageNum;
    el('pdf-zoom-label').textContent=Math.round(this.scale*100/this.fitScale)+'%';
    el('pdf-prev').disabled=this.pageNum<=1;
    el('pdf-next').disabled=this.pageNum>=this.pageOrder.length;
    document.querySelectorAll('.pdf-thumb-item').forEach((e,i)=>e.classList.toggle('active',i+1===this.pageNum));
    document.querySelector('.pdf-thumb-item:nth-child('+this.pageNum+')')?.scrollIntoView({behavior:'smooth',block:'nearest'});
    this.rendering=false;
  }
  _redrawAnnotations(){
    const ac=el('pdf-annotate-canvas');if(!ac)return;
    const ctx=ac.getContext('2d');ctx.clearRect(0,0,ac.width,ac.height);
    const orig=this._origPage();const list=this.annotations[orig]||[];
    ctx.font='16px Segoe UI, sans-serif';ctx.fillStyle='#ff4757';ctx.textBaseline='top';
    list.forEach(a=>{ctx.fillText(a.text,a.x,a.y);});
  }
  async _buildThumbs(){
    const l=el('pdf-thumbs-list');if(!l||!this.pdfDoc)return;l.innerHTML='';
    this.pageOrder.forEach((orig,idx)=>{
      const i=idx+1;
      const item=document.createElement('div');
      item.className='pdf-thumb-item'+(i===this.pageNum?' active':'');
      item.draggable=true;item.dataset.pos=i;item.dataset.orig=orig;
      const rot=this.pageRotations[orig]||0;
      item.innerHTML='<canvas'+(rot?' style="transform:rotate('+rot+'deg)"':'')+'></canvas><div class="pdf-thumb-num">'+i+'</div>'+(rot?'<div class="pdf-thumb-rotate-badge">'+rot+'°</div>':'');
      item.addEventListener('click',()=>{this.pageNum=i;this._render();});
      // Drag-to-reorder
      item.addEventListener('dragstart',e=>{item.classList.add('dragging');e.dataTransfer.setData('text/plain',String(i));});
      item.addEventListener('dragend',()=>item.classList.remove('dragging'));
      item.addEventListener('dragover',e=>{e.preventDefault();item.classList.add('drag-over');});
      item.addEventListener('dragleave',()=>item.classList.remove('drag-over'));
      item.addEventListener('drop',e=>{
        e.preventDefault();item.classList.remove('drag-over');
        const fromPos=+e.dataTransfer.getData('text/plain');const toPos=+item.dataset.pos;
        if(fromPos===toPos)return;
        const moved=this.pageOrder.splice(fromPos-1,1)[0];
        this.pageOrder.splice(toPos-1,0,moved);
        this._dirty=true;
        this.pageNum=Math.max(1,Math.min(this.pageNum,this.pageOrder.length));
        this._buildThumbs();this._render();
      });
      l.appendChild(item);
      this._renderThumb(orig,item.querySelector('canvas'),rot);
    });
  }
  async _renderThumb(n,c,rot=0){try{const pg=await this.pdfDoc.getPage(n);const vp=pg.getViewport({scale:.22,rotation:((pg.rotate||0))%360});c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;}catch(_){}}
_go(d){if(!this.pdfDoc)return;const n=this.pageNum+d;if(n>=1&&n<=this.pageOrder.length){this.pageNum=n;this._render();}}
_zoom(d){this.scale=Math.max(.3,Math.min(6,this.scale+d));this._render();}
// The old version ran a full getPage + getTextContent sweep of the entire
// document on EVERY keystroke, with no debounce and no cancellation. Typing
// "invoice" launched seven overlapping scans of every page, and whichever
// finished last won — so results could belong to a prefix you'd already
// deleted. Now: extract once into a cache, debounce input, and tag each run
// so a stale sweep discards its own results.
_searchDebounced(q){
  clearTimeout(this._searchTimer);
  const c=el('pdf-search-count');
  if(!q.trim()){ this._sr=[]; this._si=-1; if(c)c.textContent=''; this._redrawAnnotations?.(); return; }
  if(c)c.textContent='…';
  this._searchTimer=setTimeout(()=>this._search(q),250);
}

// Text is extracted once per document and reused by search, highlighting and
// the text layer. On a 400-page PDF this is the difference between one sweep
// and one sweep per keystroke.
async _ensureText(token){
  if(!this.pdfDoc) return null;
  if(this._textCache && this._textCacheFor===this.pdfDoc) return this._textCache;
  const cache=new Map();
  for(let i=1;i<=this.pdfDoc.numPages;i++){
    if(token!==undefined && token!==this._searchToken) return null;   // superseded
    try{
      const pg=await this.pdfDoc.getPage(i);
      const tc=await pg.getTextContent();
      cache.set(i,{ raw: tc.items.map(t=>t.str).join(' '), items: tc.items });
    }catch(_){ cache.set(i,{ raw:'', items:[] }); }
    // Yield every 20 pages so a big document doesn't freeze the UI thread.
    if(i%20===0) await new Promise(r=>setTimeout(r,0));
  }
  this._textCache=cache; this._textCacheFor=this.pdfDoc;
  return cache;
}

async _search(q){
  const c=el('pdf-search-count');
  if(!q.trim()||!this.pdfDoc){ if(c)c.textContent=''; this._sr=[]; this._si=-1; return; }
  const token=this._searchToken=(this._searchToken||0)+1;
  const cache=await this._ensureText(token);
  if(!cache||token!==this._searchToken) return;      // a newer query took over

  const needle=q.toLowerCase();
  const results=[];
  let total=0;
  for(const [page,{raw}] of cache){
    const hay=raw.toLowerCase();
    if(!hay.includes(needle)) continue;
    let n=0,idx=hay.indexOf(needle);
    while(idx!==-1){ n++; idx=hay.indexOf(needle,idx+needle.length); }
    total+=n;
    results.push(page);
  }
  if(token!==this._searchToken) return;
  this._sr=results; this._si=results.length?0:-1; this._searchTerm=needle;
  if(c)c.textContent=results.length
    ? total+' hit'+(total===1?'':'s')+' on '+results.length+' page'+(results.length===1?'':'s')
    : 'Not found';
  if(results.length){
    const pos=this.pageOrder.indexOf(results[0])+1;
    if(pos>0){ this.pageNum=pos; this._render(); }
  }
}

// ── Text layer: positioned spans over the canvas ───────────────────
// Gives selection, copy and search highlighting. pdf.js already handed us
// the item transforms during extraction; we were throwing them away.
async _buildTextLayer(page, viewport){
  const host=el('pdf-text-layer');
  if(!host) return;
  host.innerHTML='';
  host.style.width=viewport.width+'px';
  host.style.height=viewport.height+'px';
  let tc;
  try{ tc=await page.getTextContent(); }catch(_){ return; }
  const frag=document.createDocumentFragment();
  const needle=this._searchTerm;
  for(const item of tc.items){
    if(!item.str || !item.str.trim()) continue;
    const tx=pdfjsLib.Util.transform(viewport.transform, item.transform);
    const span=document.createElement('span');
    span.textContent=item.str;
    span.style.left=tx[4]+'px';
    span.style.top=(tx[5]-Math.abs(tx[3]))+'px';
    span.style.fontSize=Math.abs(tx[3])+'px';
    span.style.fontFamily=item.fontName||'sans-serif';
    if(needle && item.str.toLowerCase().includes(needle)) span.classList.add('hit');
    frag.appendChild(span);
  }
  host.appendChild(frag);
}

// ── Outline / bookmarks ────────────────────────────────────────────
async _buildOutline(){
  const body=el('pdf-outline-body');
  if(!body||!this.pdfDoc) return;
  body.innerHTML='';
  let outline=null;
  try{ outline=await this.pdfDoc.getOutline(); }catch(_){}
  this._hasOutline=!!(outline&&outline.length);
  if(!this._hasOutline){
    const e=document.createElement('div');
    e.className='pdf-outline-empty';
    e.textContent='This document has no contents';
    body.appendChild(e);
    return;
  }
  const build=(nodes,depth)=>{
    const wrap=document.createDocumentFragment();
    for(const n of nodes){
      const row=document.createElement('div');
      row.className='pdf-outline-item';
      row.style.paddingLeft=(10+depth*14)+'px';
      row.textContent=n.title||'Untitled';
      row.title=row.textContent;
      row.tabIndex=0;
      const go=async()=>{
        try{
          const dest=typeof n.dest==='string' ? await this.pdfDoc.getDestination(n.dest) : n.dest;
          if(!dest) return;
          const idx=await this.pdfDoc.getPageIndex(dest[0]);
          const pos=this.pageOrder.indexOf(idx+1)+1;
          if(pos>0){ this.pageNum=pos; this._render(); }
        }catch(err){ console.warn('[PDF] outline jump failed',err); }
      };
      row.addEventListener('click',go);
      row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
      wrap.appendChild(row);
      if(n.items&&n.items.length) wrap.appendChild(build(n.items,depth+1));
    }
    return wrap;
  };
  body.appendChild(build(outline,0));
}

    _nextMatch(d){if(!this._sr?.length)return;this._si=(this._si+d+this._sr.length)%this._sr.length;const origPage=this._sr[this._si];const pos=this.pageOrder.indexOf(origPage)+1;if(pos>0){this.pageNum=pos;this._render();}}

}
