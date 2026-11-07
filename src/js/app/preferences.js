/**
 * Preferences (v3.47.0, from app.js): the settings panel, Pro and Lite and the battery saver,
 * updates, and the default player prompt. Settings a feature adds for itself (registry.js) are shown here too.
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player, as it was when they were written there.
 */
import { power, setSaverMode } from '../power.js';
import settings from '../modules/settings.js';
import liteMode from '../modules/lite-mode.js';
import { el } from '../util.js';
import { settingList, settingValue, setSetting } from './registry.js';
import { wireLyricsPrefs } from '../modules/lyrics-prefs.js';   // v3.50.0: saved lyrics

export default class PreferencesFeature {
  wirePerfPanel(){
    // The battery saver (v3.39.0, power.js): on battery, always, or never.
    const bs = el('set-battery-saver');
    if (bs) { bs.value = power.mode; bs.addEventListener('change', () => { setSaverMode(bs.value); this.showOSD(power.saver ? 'Battery saver on: visuals at 30 frames a second' : 'Battery saver off'); }); }
    const sel = el('set-perf-mode');
    if (sel) {
      // Initialize from current override
      const stored = localStorage.getItem('bm_lite_user');
      sel.value = (stored === '1') ? 'lite' : (stored === '0' ? 'full' : 'auto');
      sel.addEventListener('change', () => {
        const v = sel.value;
        if (v === 'auto') liteMode.setUserOverride(null);
        else if (v === 'lite') liteMode.setUserOverride(true);
        else liteMode.setUserOverride(false);
        this._renderPerfInfo();
      });
    }
    this._renderPerfInfo();
  }
  _renderPerfInfo(){
    const modeEl = el('perf-info-mode'),
          reasonEl = el('perf-info-reason'),
          coresEl = el('perf-info-cores'),
          ramEl = el('perf-info-ram'),
          gpuEl = el('perf-info-gpu');
    if (!modeEl) return;
    modeEl.textContent = this.isLite ? '🟢 Lite' : '🔵 Full';
    if (reasonEl) reasonEl.textContent = liteMode.getReason();
    const info = liteMode.detectPerfInfo();
    const main = this._mainPerfInfo || {};
    if (coresEl) coresEl.textContent = main.cpuCount || info.hardwareConcurrency || '—';
    if (ramEl) {
      const mem = main.totalMemGB || info.deviceMemory;
      ramEl.textContent = mem != null ? `${mem} GB${main.totalMemGB ? ' (system)' : ' (reported)'}` : '—';
    }
    if (gpuEl) gpuEl.textContent = info.webglRenderer || '—';
  }

  // ── Settings panel ───────────────────────────────────────────────
  wireSettings(){
    // Wire each control to the settings store.
    const bind = (id, path, format) => {
      const el2 = el(id);
      if(!el2) return;
      // Initialize from store
      const v = settings.get(path);
      if(el2.type === 'checkbox') el2.checked = !!v;
      else el2.value = v;
      // Update label
      const lbl = el(id + '-val');
      if(lbl && format) lbl.textContent = format(v);
      // Listen for changes
      el2.addEventListener('input',()=>{
        const nv = el2.type === 'checkbox' ? el2.checked : (el2.type === 'number' || el2.type === 'range' ? +el2.value : el2.value);
        settings.set(path, nv);
        const lbl2 = el(id + '-val');
        if(lbl2 && format) lbl2.textContent = format(nv);
        // Subtitle settings apply immediately to mpv
        if(path.startsWith('subtitles.')) settings.applyToMpv(this.api?.mpv);
      });
    };
    bind('set-resume', 'playback.resumePrompt', v => v ? 'on' : 'off');
    bind('set-resume-rewind', 'playback.resumeRewindSec', v => v + 's');
    bind('set-history', 'playback.historyEnabled', v => v ? 'on' : 'off');
    bind('set-history-cap', 'playback.historyMaxItems', v => v + ' items');
    bind('set-sub-font', 'subtitles.fontFamily');
    bind('set-sub-size', 'subtitles.fontSize', v => v);
    bind('set-sub-bold', 'subtitles.bold', v => v ? 'on' : 'off');
    bind('set-sub-color', 'subtitles.color');
    bind('set-sub-outline', 'subtitles.outlineSize', v => v);
    bind('set-sub-pos', 'subtitles.position', v => v);
    bind('set-seek-small', 'behaviour.seekSmallSec', v => v + 's');
    bind('set-seek-large', 'behaviour.seekLargeSec', v => v + 's');
    bind('set-vol-step', 'behaviour.volumeStep', v => v + '%');

    // Color value display syncs with the picker
    el('set-sub-color')?.addEventListener('input',e=>{
      const l=el('set-sub-color-val'); if(l) l.textContent = (e.target.value || '#ffffff').toUpperCase();
    });

    // Export / Import
    el('settings-export')?.addEventListener('click',async()=>{
      const json = JSON.stringify(settings.exportAll(), null, 2);
      try{
        await navigator.clipboard.writeText(json);
        this.showOSD('Settings copied to clipboard');
      }catch(_){ this.showOSD('Clipboard unavailable — see console'); console.log(json); }
    });
    el('settings-import')?.addEventListener('click',async()=>{
      let txt;
      try{ txt = await navigator.clipboard.readText(); }catch(_){ txt = prompt('Paste settings JSON:'); }
      if(!txt) return;
      try{
        settings.importAll(JSON.parse(txt));
        this._syncSettingsPanel();
        settings.applyToMpv(this.api?.mpv);
        this.showOSD('Settings imported');
      }catch(e){ this.showOSD('Invalid JSON'); }
    });
    el('settings-reset')?.addEventListener('click',()=>{
      if(!confirm('Reset all preferences to defaults?')) return;
      settings.reset();
      this._syncSettingsPanel();
      settings.applyToMpv(this.api?.mpv);
      this.showOSD('Settings reset');
    });
    this._renderFeatureSettings();
    this._lyrPrefs = wireLyricsPrefs({ api: this.api, osd: t => this.showOSD(t) });
  }
  _syncSettingsPanel(){
    this._renderFeatureSettings();   // the settings features added (registry.js)
    this._lyrPrefs?.refresh();       // how many songs have lyrics saved (v3.50.0)
    const fields = [
      ['set-resume', 'playback.resumePrompt'],
      ['set-resume-rewind', 'playback.resumeRewindSec'],
      ['set-history', 'playback.historyEnabled'],
      ['set-history-cap', 'playback.historyMaxItems'],
      ['set-sub-font', 'subtitles.fontFamily'],
      ['set-sub-size', 'subtitles.fontSize'],
      ['set-sub-bold', 'subtitles.bold'],
      ['set-sub-color', 'subtitles.color'],
      ['set-sub-outline', 'subtitles.outlineSize'],
      ['set-sub-pos', 'subtitles.position'],
      ['set-seek-small', 'behaviour.seekSmallSec'],
      ['set-seek-large', 'behaviour.seekLargeSec'],
      ['set-vol-step', 'behaviour.volumeStep'],
    ];
    fields.forEach(([id, path]) => {
      const e = el(id); if(!e) return;
      const v = settings.get(path);
      if(e.type === 'checkbox') e.checked = !!v;
      else e.value = v;
      const lbl = el(id + '-val');
      if(lbl){
        if(id === 'set-resume-rewind') lbl.textContent = v + 's';
        else if(id === 'set-history-cap') lbl.textContent = v + ' items';
        else if(id === 'set-sub-size' || id === 'set-sub-outline' || id === 'set-sub-pos') lbl.textContent = v;
        else if(id === 'set-seek-small' || id === 'set-seek-large') lbl.textContent = v + 's';
        else if(id === 'set-vol-step') lbl.textContent = v + '%';
        else if(id === 'set-resume' || id === 'set-history' || id === 'set-sub-bold') lbl.textContent = v ? 'on' : 'off';
      }
    });
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
  // Settings features added (registry.js, v3.47.0), under "Features" at the
  // end of Preferences, drawn from what each feature said about its setting.
  // The section stays hidden while no feature has one.
  _renderFeatureSettings(){
    const box=el('set-features');if(!box)return;
    const list=settingList();
    box.hidden=!list.length;
    box.textContent='';
    if(!list.length)return;
    const head=document.createElement('div');head.className='ctx-section-label';head.style.marginTop='16px';head.textContent='Features';box.append(head);
    for(const d of list){
      const v=settingValue(d.id),id='set-f-'+d.id.replace(/[^\w-]/g,'-');
      if(d.type==='toggle'){
        const row=document.createElement('div');row.className='ctx-checkbox-row';row.style.marginTop='8px';
        const lab=document.createElement('label');lab.className='ctx-checkbox';
        const cb=document.createElement('input');cb.type='checkbox';cb.id=id;cb.checked=!!v;
        cb.addEventListener('change',()=>setSetting(d.id,cb.checked));
        lab.append(cb,' '+d.label);row.append(lab);box.append(row);
        continue;
      }
      const row=document.createElement('div');row.className='ctx-row';row.style.marginTop='8px';
      const lab=document.createElement('span');lab.className='ctx-row-label';lab.textContent=d.label;row.append(lab);
      if(d.type==='range'){
        const r=document.createElement('input');r.type='range';r.className='ctx-slider';r.id=id;
        r.min=d.min??0;r.max=d.max??100;r.step=d.step??1;r.value=v;
        const out=document.createElement('span');out.className='ctx-val';out.textContent=v+(d.unit||'');
        r.addEventListener('input',()=>{out.textContent=r.value+(d.unit||'');});
        r.addEventListener('change',()=>setSetting(d.id,+r.value));
        row.append(r,out);
      }else{
        const sel=document.createElement('select');sel.className='dash-select';sel.id=id;sel.style.flex='1';
        for(const [val,text] of (d.options||[])){const o=document.createElement('option');o.value=String(val);o.textContent=text;sel.append(o);}
        sel.value=String(v);
        sel.addEventListener('change',()=>{const o=(d.options||[]).find(([val])=>String(val)===sel.value);setSetting(d.id,o?o[0]:sel.value);});
        row.append(sel);
      }
      box.append(row);
    }
  }
}
