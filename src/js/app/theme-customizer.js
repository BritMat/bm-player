/**
 * The theme customizer (v3.47.0, from app.js).
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { el, escapeHtml } from '../util.js';

export default class ThemeCustomizerFeature {

  // ════════════════════════════════════════════════════════════════
  // v1.8.0 — Theme Customizer
  // ════════════════════════════════════════════════════════════════
  wireThemeCustomizer(){
    el('tc-cancel')?.addEventListener('click',()=>el('theme-customizer')?.classList.add('hidden'));
    el('tc-reset')?.addEventListener('click',()=>{
      const name=localStorage.getItem('bm_theme')||'dark';
      this._applyCustomThemeToUI(this._getBuiltinTokens(name));
      this.showOSD('Colors reset to theme default');
    });
    el('tc-apply')?.addEventListener('click',()=>{
      const tokens=this._readCustomThemeFromUI();
      this._applyCustomTokens(tokens);
      this.showOSD('Custom theme applied');
      el('theme-customizer')?.classList.add('hidden');
    });
    // Fluid toggle
    const ft=el('tc-fluid-toggle');
    if(ft){
      if(!this._fluidEnabled)ft.classList.remove('active');
      ft.addEventListener('click',()=>{
        this._fluidEnabled=!this._fluidEnabled;
        ft.classList.toggle('active',this._fluidEnabled);
        localStorage.setItem('bm_fluid_enabled',this._fluidEnabled?'1':'0');
        const name=localStorage.getItem('bm_theme')||'dark';
        this.applyTheme(name);
      });
    }
    // Connections toggle
    const ct=el('tc-connections-toggle');
    if(ct){
      const connOn=localStorage.getItem('bm_fluid_connections')==='1';
      if(connOn)ct.classList.add('active');
      ct.addEventListener('click',()=>{
        ct.classList.toggle('active');
        localStorage.setItem('bm_fluid_connections',ct.classList.contains('active')?'1':'0');
      });
    }
    this._buildThemePresetGrid();
    const cur=localStorage.getItem('bm_theme')||'dark';
    this._applyCustomThemeToUI(this._getBuiltinTokens(cur));
  }

  _buildThemePresetGrid(){
    const grid=el('tc-preset-grid');if(!grid)return;
    const presets=[
      {name:'dark',    icon:'🌙', colors:['#080b14','#111624','#e4eaf6','#5B6FF8','#00D4FF']},
      {name:'light',   icon:'☀️', colors:['#f0f2fa','#ffffff','#1a1d2b','#4757e3','#0098cf']},
      {name:'glass',   icon:'🔮', colors:['#0a0c1a','#14162e','#e0e0ff','#8d7bff','#43e0ff']},
      {name:'dracula', icon:'🧛', colors:['#130c1c','#20132c','#f4e9ff','#ff4d6d','#bd5cff']},
      {name:'northern',icon:'🌌', colors:['#030c12','#091a26','#d8faf0','#22e8a8','#3aa8ff']},
      {name:'ocean',   icon:'🌊', colors:['#0a1628','#112844','#d4f1ff','#1a8fcc','#00c8ff']},
      {name:'snow',    icon:'❄️', colors:['#0b1522','#132438','#eef6ff','#8fd0ff','#cfe9ff']},
      {name:'sunset',  icon:'🌅', colors:['#1a0c08','#2e1a14','#fff0e0','#ff6b35','#ffb432']},
      {name:'sakura',  icon:'🌸', colors:['#1c0a14','#2e1420','#fff0f5','#f5a0c0','#ff80b0']},
      {name:'midnight',icon:'🌙', colors:['#0a0c1e','#161a34','#e8eaff','#4a5fcf','#7888ff']},
    ];
    grid.innerHTML='';
    presets.forEach(p=>{
      const div=document.createElement('div');
      div.className='tc-preset';
      if(p.name===localStorage.getItem('bm_theme'))div.classList.add('active');
      // Interpolated into a style attribute, so restrict it to a colour literal.
      // Theme presets can come from plugins, and `);` in a colour string
      // would break out of the declaration.
      const safeColor = c => /^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : '#888';
      div.innerHTML=`<div class="tc-preset-swatch" style="background:linear-gradient(135deg,${safeColor(p.colors[3])},${safeColor(p.colors[4])})"></div><span>${escapeHtml(p.icon || '')} ${escapeHtml(p.name || '')}</span>`;
      div.addEventListener('click',()=>{
        this.applyTheme(p.name);
        this._applyCustomThemeToUI(this._getBuiltinTokens(p.name));
        grid.querySelectorAll('.tc-preset').forEach(x=>x.classList.remove('active'));
        div.classList.add('active');
      });
      grid.appendChild(div);
    });
  }

  _getBuiltinTokens(n){
    const m={
      dark:    {bg:'#080b14',surface:'#111624',text:'#e4eaf6',accent:'#5B6FF8',accent2:'#00D4FF'},
      light:   {bg:'#f0f2fa',surface:'#ffffff',text:'#1a1d2b',accent:'#4757e3',accent2:'#0098cf'},
      glass:   {bg:'#0a0c1a',surface:'#14162e',text:'#e0e0ff',accent:'#8d7bff',accent2:'#43e0ff'},
      dracula: {bg:'#130c1c',surface:'#20132c',text:'#f4e9ff',accent:'#ff4d6d',accent2:'#bd5cff'},
      northern:{bg:'#030c12',surface:'#091a26',text:'#d8faf0',accent:'#22e8a8',accent2:'#3aa8ff'},
      ocean:   {bg:'#0a1628',surface:'#112844',text:'#d4f1ff',accent:'#1a8fcc',accent2:'#00c8ff'},
      snow:    {bg:'#0b1522',surface:'#132438',text:'#eef6ff',accent:'#8fd0ff',accent2:'#cfe9ff'},
      sunset:  {bg:'#1a0c08',surface:'#2e1a14',text:'#fff0e0',accent:'#ff6b35',accent2:'#ffb432'},
      sakura:  {bg:'#1c0a14',surface:'#2e1420',text:'#fff0f5',accent:'#f5a0c0',accent2:'#ff80b0'},
      midnight:{bg:'#0a0c1e',surface:'#161a34',text:'#e8eaff',accent:'#4a5fcf',accent2:'#7888ff'},
    };
    return m[n]||m.dark;
  }

  _applyCustomThemeToUI(t){
    const s=(id,v)=>{const e=el(id);if(e)e.value=v;};
    s('tc-bg',t.bg);s('tc-surface',t.surface);s('tc-text',t.text);
    s('tc-accent',t.accent);s('tc-accent2',t.accent2);
  }

  _readCustomThemeFromUI(){
    const g=id=>el(id)?.value||'#000000';
    return{bg:g('tc-bg'),surface:g('tc-surface'),text:g('tc-text'),accent:g('tc-accent'),accent2:g('tc-accent2')};
  }

  _applyCustomTokens(t){
    const r=document.documentElement.style;
    r.setProperty('--bg',t.bg);
    r.setProperty('--bg2',this._lighten(t.bg,8));
    r.setProperty('--surface',t.surface);
    r.setProperty('--surface2',this._lighten(t.surface,6));
    r.setProperty('--text',t.text);
    r.setProperty('--text-muted',this._blend(t.text,t.bg,0.5));
    r.setProperty('--accent',t.accent);
    r.setProperty('--accent2',t.accent2);
    r.setProperty('--accent-glow',t.accent+'59');
    r.setProperty('--bar-bg',t.accent+'14');
    r.setProperty('--hover',t.accent+'1f');
    r.setProperty('--border',t.accent+'26');
    r.setProperty('--menu-bg',t.bg);
    r.setProperty('--danger','#ff5555');
  }

  _lighten(hex,pct){
    let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    r=Math.min(255,r+Math.round((255-r)*pct/100));
    g=Math.min(255,g+Math.round((255-g)*pct/100));
    b=Math.min(255,b+Math.round((255-b)*pct/100));
    return '#'+[r,g,b].map(c=>c.toString(16).padStart(2,'0')).join('');
  }

  _blend(h1,h2,t){
    const p=c=>parseInt(c,16);
    const r=Math.round(p(h1.slice(1,3))*(1-t)+p(h2.slice(1,3))*t);
    const g=Math.round(p(h1.slice(3,5))*(1-t)+p(h2.slice(3,5))*t);
    const b=Math.round(p(h1.slice(5,7))*(1-t)+p(h2.slice(5,7))*t);
    return '#'+[r,g,b].map(c=>Math.min(255,Math.max(0,c)).toString(16).padStart(2,'0')).join('');
  }

  _openThemeCustomizer(){
    el('theme-customizer')?.classList.remove('hidden');
    // On the Flow theme, its controls are what you came for: they are the
    // customizer's last section, so it opens scrolled to them (v3.28.0).
    if(document.documentElement.getAttribute('data-theme')==='northern') requestAnimationFrame(()=>el('tc-flow')?.scrollIntoView({block:'nearest'}));
  }
}
