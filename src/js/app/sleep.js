/**
 * The sleep timer's panel (v3.47.0, from app.js). The timer itself is modules/sleep-timer.js.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { setIcon } from '../icons.js';
import { SLEEP_CHOICES, label as sleepLabel } from '../modules/sleep-timer.js';
import { el } from '../util.js';

export default class SleepFeature {
  // ── Sleep timer (v3.46.0, sleep-timer.js) ──────────────────────
  wireSleep(){
    const d=el('dlg-sleep');
    el('sleep-close')?.addEventListener('click',()=>d?.classList.add('hidden'));
    d?.addEventListener('mousedown',e=>{if(e.target===d)d.classList.add('hidden');});
    el('sleep-badge')?.addEventListener('click',()=>this.openSleep());
    setIcon(el('sleep-badge-ico'),'moon');
  }
  openSleep(){
    const d=el('dlg-sleep');if(!d)return;
    this._renderSleep();d.classList.remove('hidden');
    d.querySelector('.eq-preset-btn.active')?.focus?.();
  }
  _renderSleep(){
    const s=this.sleep,left=s.remaining();
    const st=el('sleep-state');
    if(st)st.textContent=s.mode==='time'?`Playing stops in ${sleepLabel(Math.max(1,Math.ceil(left/60000)))}.`:s.mode==='end'?'Playing stops at the end of this file.':'Off. Playing goes on until you stop it.';
    const box=el('sleep-chips');if(!box)return;
    if(!box.childElementCount){
      for(const [v,name] of SLEEP_CHOICES){
        const b=document.createElement('button');b.className='eq-preset-btn';b.type='button';b.dataset.sleep=String(v);b.textContent=name;
        b.addEventListener('click',()=>{this.sleep.set(v);if(!v)el('dlg-sleep')?.classList.add('hidden');});
        box.appendChild(b);
      }
    }
    for(const b of box.children){
      const v=b.dataset.sleep,on=v==='0'?!s.mode:v==='end'?s.mode==='end':s.mode==='time'&&String(s.minutes)===v;
      b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
    }
  }
  _sleepChanged(){
    const s=this.sleep,badge=el('sleep-badge'),txt=el('sleep-badge-text');
    clearInterval(this._sleepTick);this._sleepTick=0;
    const paint=()=>{
      const left=s.remaining();
      if(txt)txt.textContent=s.mode==='time'?Math.max(1,Math.ceil(left/60000))+' min':s.mode==='end'?'end':'';
      badge?.classList.toggle('hidden',!s.mode);
      if(badge)badge.title=s.mode==='time'?`Sleep timer: playing stops in ${sleepLabel(Math.max(1,Math.ceil(left/60000)))}`:s.mode==='end'?'Sleep timer: playing stops at the end of this file':'';
      if(!el('dlg-sleep')?.classList.contains('hidden'))this._renderSleep();
    };
    paint();
    if(s.mode==='time')this._sleepTick=setInterval(paint,20000);
    // At the end of this file: mpv stops at the end of a film even with more
    // in its playlist, for as long as that is set, and once it has stopped
    // there until the film is left (_holdAtEnd, at eof-reached).
    if(s.mode==='end')this.api?.mpv.cmd('set_property','keep-open','always');
    else if(!this._holdAtEnd)this.api?.mpv.cmd('set_property','keep-open','yes');
  }
}
