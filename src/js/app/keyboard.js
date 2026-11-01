/**
 * The keyboard (v3.47.0, from app.js). Shortcuts a feature adds for itself (registry.js) are
 * tried after the player's own, so a feature can never take a key the player uses, and they
 * are listed with the others when the shortcuts list (?) opens.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import settings from '../modules/settings.js';
import { el } from '../util.js';
import { matchShortcut, shortcutList, keyName } from './registry.js';

export default class KeyboardFeature {
  wireKeyboard(){
    document.addEventListener('keydown',e=>{
      // An open overlay claimed this key in the capture phase (see
      // wireOverlayKeys). Without this, Escape to dismiss a menu also
      // stopped playback, and arrow keys in the lightbox seeked the music.
      if(e.__bmHandled)return;
      if(e.target.matches?.('input,textarea'))return;
      // A key the element in focus already acted on is its own (v3.44.0).
      // Space on a song in the list played it and this then paused it again,
      // and the arrows in the subtitle font list moved the volume as well.
      if(e.defaultPrevented)return;
      const cmd=(c,...a)=>{e.preventDefault();this.api?.mpv.cmd(c,...a);};
      if(e.key==='?'||e.code==='F1'){e.preventDefault();this.toggleShortcuts();}   // v3.30.0
      // Rotate and mirror (v3.38.0). Ctrl+R also reloaded the whole page through
      // Electron's built-in menu, music and all: that menu is gone too (main.js).
      else if(e.ctrlKey&&e.code==='KeyR'){e.preventDefault();this.transform?.rotate(e.shiftKey?-90:90);}
      else if(e.ctrlKey&&e.code==='KeyM'){e.preventDefault();this.transform?.mirror();}
      // Zoom, and moving the zoomed picture (v3.46.0, picture.js). Before the
      // plain arrows and Backspace, which seek, change the volume and reset
      // the speed.
      else if(e.altKey&&!e.ctrlKey&&(e.code==='Equal'||e.code==='NumpadAdd')){e.preventDefault();this.picture?.zoomBy(1);}
      else if(e.altKey&&!e.ctrlKey&&(e.code==='Minus'||e.code==='NumpadSubtract')){e.preventDefault();this.picture?.zoomBy(-1);}
      else if(e.altKey&&!e.ctrlKey&&e.code==='Backspace'){e.preventDefault();this.picture?.resetView(true);}
      else if(e.altKey&&!e.ctrlKey&&/^Arrow(Left|Right|Up|Down)$/.test(e.code)){e.preventDefault();const d={ArrowLeft:[1,0],ArrowRight:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.code];this.picture?.panBy(d[0],d[1]);}
    else if(e.code==='Space'){e.preventDefault();this.togglePlay();}
      else if(e.code==='KeyS'){e.preventDefault();this.stop();}
      else if(e.code==='KeyF'||e.code==='F11'){e.preventDefault();this.api?.win.fullscreen();}
      else if(e.code==='KeyT'&&!e.ctrlKey){e.preventDefault();this.api?.win.theatre();}
      else if(e.code==='KeyM'){e.preventDefault();this.toggleMute();}
      else if(e.code==='ArrowLeft'){e.preventDefault();this.seekBy(-(e.shiftKey?(settings.get('behaviour.seekLargeSec') ?? 30):(settings.get('behaviour.seekSmallSec') ?? 5)));}
      else if(e.code==='ArrowRight'){e.preventDefault();this.seekBy(e.shiftKey?(settings.get('behaviour.seekLargeSec') ?? 30):(settings.get('behaviour.seekSmallSec') ?? 5));}
      else if(e.code==='ArrowUp'){e.preventDefault();this.bumpVolume(settings.get('behaviour.volumeStep') ?? 5);}
      else if(e.code==='ArrowDown'){e.preventDefault();this.bumpVolume(-(settings.get('behaviour.volumeStep') ?? 5));}
      else if(e.code==='BracketLeft'){e.preventDefault();this.speedMenu?.cyclePrev();}
      else if(e.code==='BracketRight'){e.preventDefault();this.speedMenu?.cycleNext();}
      else if(e.code==='Backspace'){e.preventDefault();this.speedMenu?.set(1);}
      else if(e.code==='KeyZ'){this.api?.adj.subDelay(-0.5);this.showOSD('Sub delay: '+(this._ctxSubDelay-=0.5).toFixed(1)+'s');}
      else if(e.code==='KeyX'){this.api?.adj.subDelay(0.5);this.showOSD('Sub delay: '+(this._ctxSubDelay+=0.5).toFixed(1)+'s');}
      else if(e.code==='KeyK'&&e.shiftKey){this.api?.adj.audioDelay(0.5);}
      else if(e.code==='KeyJ'&&e.shiftKey){this.api?.adj.audioDelay(-0.5);}
      else if(e.code==='KeyA'){cmd('cycle','audio');}
      else if(e.code==='KeyV'){cmd('cycle','sub');}
      else if(e.code==='KeyP'){e.preventDefault();this.trackStep(-1);}
      else if(e.code==='KeyN'){e.preventDefault();this.trackStep(1);}
      // ── v1.7.0: A-B repeat (B / Shift+B / C / G) ──
      // Ctrl+B / Alt+B for bookmarks handled BEFORE the plain KeyB branch
      // so the modifier-aware cases win.
      else if(e.code==='KeyB'&&e.ctrlKey){e.preventDefault();this.addBookmarkAtCurrent();}
      else if(e.code==='KeyB'&&e.altKey){e.preventDefault();this.addBookmarkAtCurrent({quick:true});}
      else if(e.code==='KeyB'&&e.shiftKey){e.preventDefault();this.abRepeat?.setB();}
      else if(e.code==='KeyB'&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){e.preventDefault();this.abRepeat?.setA();}
      else if(e.code==='KeyC'&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){e.preventDefault();this.abRepeat?.clear();}
      else if(e.code==='KeyG'&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){e.preventDefault();this.abRepeat?.togglePause();}
      // ── v1.7.0: Frame stepping (, / .) ──
      else if(e.code==='Comma'){e.preventDefault();cmd('frame-back-step');this.showOSD('◂ Frame',700);}
      else if(e.code==='Period'){e.preventDefault();cmd('frame-step');this.showOSD('Frame ▸',700);}
      else if(e.code==='Escape'){this.api?.win.isFs().then(fs=>{if(fs)this.api?.win.fullscreen();else this.stop();});}
      else if(e.code==='KeyO'&&e.ctrlKey){e.preventDefault();this.openDialog();}
      else if(e.code==='KeyI'&&e.ctrlKey){e.preventDefault();this.openPanel('info');}
      else if(e.code==='KeyL'&&e.ctrlKey){e.preventDefault();this.openPanel('playlist');}
      else if(e.code==='KeyH'&&e.ctrlKey){e.preventDefault();this.openPanel('history');this._renderHistoryPanel();}
      else if(e.code==='KeyT'&&e.ctrlKey){e.preventDefault();this.api?.mpv.cmd('screenshot','subtitles');this.showOSD('Screenshot saved');}
      else if(e.code==='KeyJ'&&e.ctrlKey){e.preventDefault();el('dlg-jump')?.classList.remove('hidden');el('jump-input')?.focus();}
      else if(e.code==='KeyQ'&&e.ctrlKey){e.preventDefault();this.api?.win.close();}
      else if(e.key>='1'&&e.key<='9'&&!e.ctrlKey&&!e.altKey){const p=+e.key/10;this.seekTo(p*this.duration);}
      else matchShortcut(this,e);   // a key a feature added (registry.js, v3.47.0)
    });
  }
  // The keys features added (registry.js), as a group of their own in the
  // shortcuts list, drawn each time it opens. Nothing when there are none.
  _renderFeatureShortcuts(){
    const grid=document.querySelector('#kb-overlay .kb-grid');if(!grid)return;
    grid.querySelectorAll('.kb-group[data-features]').forEach(g=>g.remove());
    const groups=new Map();
    for(const s of shortcutList()){if(!groups.has(s.group))groups.set(s.group,[]);groups.get(s.group).push(s);}
    for(const [name,list] of groups){
      const sec=document.createElement('section');sec.className='kb-group';sec.dataset.features='';
      const h=document.createElement('h3');h.textContent=name;sec.append(h);
      for(const s of list){
        const row=document.createElement('div');row.className='kb-row';
        const keys=document.createElement('span');keys.className='kb-keys';
        keyName(s).split('+').forEach(k=>{const kb=document.createElement('kbd');kb.textContent=k;keys.append(kb);});
        const what=document.createElement('span');what.className='kb-what';what.textContent=s.label;
        row.append(keys,what);sec.append(row);
      }
      grid.append(sec);
    }
  }
}
