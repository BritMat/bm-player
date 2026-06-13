/**
 * BM Player — Player Controls
 * VLC-compatible keybindings, seekbar, volume, OSD, playlist, fox integration.
 */

const api = window.electronAPI;

// Format seconds → m:ss or h:mm:ss
function fmt (s) {
  if (!s || isNaN(s)) return '0:00';
  s = Math.floor(s);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    : `${m}:${String(ss).padStart(2,'0')}`;
}

export class Player {
  constructor (app) {
    this.app      = app;
    this.fox      = null;   // set after Fox is created (via app.fox)
    this.paused   = true;
    this.duration = 0;
    this.position = 0;
    this.volume   = 100;
    this.muted    = false;
    this.seeking  = false;
    this.isAudio  = false;
    this._osdTimer = null;
    this._mouseHideTimer = null;
    this._alwaysOnTop = false;

    this._bindUI();
    this._initVolumeSlider();
    this._initSeekBar();
    this._mouseAutoHide();
  }

  // ── UI binding ──────────────────────────────────────
  _bindUI () {
    document.getElementById('btn-play')?.addEventListener('click', () => this.togglePlay());
    document.getElementById('btn-prev')?.addEventListener('click', () => this.playlistStep(-1));
    document.getElementById('btn-next')?.addEventListener('click', () => this.playlistStep(1));
    document.getElementById('btn-stop')?.addEventListener('click', () => this.stop());
    document.getElementById('btn-mute')?.addEventListener('click', () => this.toggleMute());

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => api?.window.fullscreen());

    document.getElementById('btn-ontop')?.addEventListener('click', e => {
      this._alwaysOnTop = !this._alwaysOnTop;
      api?.window.alwaysOnTop(this._alwaysOnTop);
      e.currentTarget.classList.toggle('active', this._alwaysOnTop);
      this._osd(this._alwaysOnTop ? '📌 Always on top ON' : 'Always on top OFF');
    });

    document.getElementById('btn-sub')?.addEventListener('click', () => this._cycleSubtitles());

    document.getElementById('btn-viz')?.addEventListener('click', () => {
      const modes = ['bars','radial','wave','particles','off'];
      const cur = this.app.visualizer.mode;
      const next = modes[(modes.indexOf(cur) + 1) % modes.length];
      this.app.visualizer.setMode(next);
      localStorage.setItem('bm_viz', next);
      const sel = document.getElementById('viz-mode-select');
      if (sel) sel.value = next;
      this._osd(`Visualizer: ${next}`);
    });

    document.getElementById('speed-select')?.addEventListener('change', e => {
      const v = parseFloat(e.target.value);
      api?.mpv.command('set_property', 'speed', v);
      this._osd(`Speed: ${v}×`);
    });

    // Open button in player (if needed)
    document.querySelector('#player-view .btn-primary')
      ?.addEventListener('click', async () => {
        const files = await api?.dialog.openFile();
        if (files?.length) await api?.mpv.openFiles(files);
      });
  }

  // ── Volume slider ────────────────────────────────────
  _initVolumeSlider () {
    const slider  = document.getElementById('volume-slider');
    const volMax  = document.getElementById('vol-max-select');

    slider?.addEventListener('input', e => {
      this.volume = +e.target.value;
      this._setVolume(this.volume);
    });

    slider?.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 5 : -5;
      this.volume  = Math.max(0, Math.min(+slider.max, this.volume + delta));
      slider.value = this.volume;
      this._setVolume(this.volume);
    }, { passive: false });

    volMax?.addEventListener('change', e => {
      if (slider) slider.max = e.target.value;
    });
  }

  _setVolume (v) {
    api?.mpv.command('set_property', 'volume', v);
    const label = document.getElementById('vol-label');
    if (label) label.textContent = v;
    // Fox reacts to volume extremes
    if (v > 115) this.app.fox?.onVolume(v);
    else if (v <= 115 && this.app.fox?.state === 'coverEars') this.app.fox?.setState('watching');
  }

  // ── Seekbar ───────────────────────────────────────────
  _initSeekBar () {
    const container = document.getElementById('seek-container');
    const track     = document.getElementById('seek-track');
    const preview   = document.getElementById('seek-preview');
    if (!container) return;

    container.addEventListener('mousemove', e => {
      const rect = track.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (preview) {
        preview.textContent  = fmt(pct * this.duration);
        preview.style.left   = `${pct * 100}%`;
      }
    });

    container.addEventListener('click', e => {
      const rect = track.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this._seek(pct * this.duration);
    });

    container.addEventListener('mousedown', e => {
      this.seeking = true;
      const move = ev => {
        const rect = track.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        this._updateSeekUI(pct * this.duration);
      };
      const up = ev => {
        this.seeking = false;
        const rect = track.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        this._seek(pct * this.duration);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  _seek (pos) {
    api?.mpv.command('seek', pos, 'absolute');
    this.app.fox?.onSeek();
  }

  _seekRelative (delta) {
    api?.mpv.command('seek', delta, 'relative');
    this._osd(delta > 0 ? `⏩ +${Math.abs(delta)}s` : `⏪ ${delta}s`);
    this.app.fox?.onSeek();
  }

  _updateSeekUI (pos) {
    if (this.seeking) return;
    this.position = pos;
    const pct = this.duration > 0 ? (pos / this.duration) : 0;
    const bar  = document.getElementById('seek-progress');
    const thumb = document.getElementById('seek-thumb');
    const cur  = document.getElementById('time-current');
    if (bar)   bar.style.width   = `${pct * 100}%`;
    if (thumb) thumb.style.left  = `${pct * 100}%`;
    if (cur)   cur.textContent   = fmt(pos);
  }

  // ── Playback commands ────────────────────────────────
  togglePlay () {
    api?.mpv.command('cycle', 'pause');
  }

  stop () {
    api?.mpv.command('stop');
    this.app.showWelcome();
    this.app.fox?.setState('idle');
  }

  toggleMute () {
    this.muted = !this.muted;
    api?.mpv.command('set_property', 'mute', this.muted);
    this._osd(this.muted ? '🔇 Muted' : '🔊 Unmuted');
    this._updateMuteIcon();
  }

  playlistStep (dir) {
    if (dir > 0) api?.mpv.command('playlist-next', 'weak');
    else         api?.mpv.command('playlist-prev');
  }

  _cycleSubtitles () {
    api?.mpv.command('cycle', 'sub');
    this._osd('Subtitle track changed');
  }

  // ── mpv property changes ──────────────────────────────
  onMpvProp (p) {
    switch (p.name) {
      case 'pause':
        this.paused = p.data;
        this._updatePlayBtn();
        if (p.data) this.app.fox?.onPause();
        else        this.app.fox?.onPlay();
        break;

      case 'time-pos':
        if (!this.seeking && p.data != null) this._updateSeekUI(p.data);
        break;

      case 'duration':
        this.duration = p.data || 0;
        const dur = document.getElementById('time-duration');
        if (dur) dur.textContent = fmt(this.duration);
        break;

      case 'volume':
        this.volume = Math.round(p.data || 0);
        const slider = document.getElementById('volume-slider');
        const label  = document.getElementById('vol-label');
        if (slider) slider.value    = this.volume;
        if (label)  label.textContent = this.volume;
        this.app.fox?.onVolume(this.volume);
        break;

      case 'mute':
        this.muted = p.data;
        this._updateMuteIcon();
        break;

      case 'media-title':
        this._setTitle(p.data);
        break;

      case 'filename':
        if (!p.data?.startsWith('http')) {
          const name = p.data?.split(/[\\/]/).pop();
          if (name) this.app.addRecent(p.data, name);
          // Detect audio-only by extension
          const audioExts = /\.(mp3|flac|ogg|wav|m4a|aac|wma|opus|alac|ape)$/i;
          this.isAudio = audioExts.test(name || '');
          if (this.isAudio) {
            this.app.visualizer.start();
            this.app.fox?.onAudioMode();
          }
        }
        break;
    }
  }

  // ── mpv events ────────────────────────────────────────
  onMpvEvent (ev) {
    switch (ev.event) {
      case 'file-loaded':
        this.app.showPlayer();
        this.app.fox?.onPlay();
        break;
      case 'end-file':
        if (ev.reason === 'error') {
          this.app.fox?.onError();
          this._osd('⚠ Playback error');
        } else if (ev.reason === 'eof') {
          this.app.fox?.onEnd();
        }
        break;
    }
  }

  // ── Keyboard (VLC-style) ──────────────────────────────
  handleKeydown (e) {
    // Skip if a text input is focused
    if (e.target.matches('input,select,textarea')) return;

    switch (e.code) {
      // Play / Pause
      case 'Space':
      case 'KeyK':
        e.preventDefault();
        this.togglePlay();
        break;

      // Seek — arrow keys
      case 'ArrowLeft':
        e.preventDefault();
        this._seekRelative(e.ctrlKey || e.metaKey ? -30 : -5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._seekRelative(e.ctrlKey || e.metaKey ? 30 : 5);
        break;

      // Volume — arrow keys (Up / Down)
      case 'ArrowUp':
        e.preventDefault();
        this.volume = Math.min(+document.getElementById('volume-slider').max, this.volume + 5);
        this._syncVolumeSlider();
        this._setVolume(this.volume);
        this._osd(`🔊 ${this.volume}%`);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.volume = Math.max(0, this.volume - 5);
        this._syncVolumeSlider();
        this._setVolume(this.volume);
        this._osd(`🔊 ${this.volume}%`);
        break;

      // Fullscreen
      case 'KeyF':
      case 'F11':
        e.preventDefault();
        api?.window.fullscreen();
        break;

      // Escape — exit fullscreen / back to welcome
      case 'Escape':
        api?.window.isFullscreen().then(fs => {
          if (fs) api?.window.fullscreen();
          else    this.stop();
        }).catch(() => {});
        break;

      // Mute
      case 'KeyM':
        this.toggleMute();
        break;

      // Stop
      case 'KeyS':
        this.stop();
        break;

      // Next / Previous
      case 'KeyN':
        this.playlistStep(1);
        break;
      case 'KeyP':
        this.playlistStep(-1);
        break;

      // Position jump (1-9 → 10%-90%)
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
      case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
        const pct = parseInt(e.code.replace('Digit','')) * 10;
        this._seek(this.duration * pct / 100);
        this._osd(`⏩ ${pct}%`);
        break;

      // Speed
      case 'BracketLeft':
        e.preventDefault();
        api?.mpv.command('multiply', 'speed', 1 / 1.25);
        this._osd('Speed −');
        break;
      case 'BracketRight':
        e.preventDefault();
        api?.mpv.command('multiply', 'speed', 1.25);
        this._osd('Speed +');
        break;
      case 'Backspace':
        api?.mpv.command('set_property', 'speed', 1.0);
        const sel = document.getElementById('speed-select');
        if (sel) sel.value = '1';
        this._osd('Speed: 1×');
        break;

      // Subtitles
      case 'KeyG':
      case 'KeyV':
        this._cycleSubtitles();
        break;

      // Audio track
      case 'KeyA':
        api?.mpv.command('cycle', 'audio');
        this._osd('Audio track changed');
        break;

      // Screenshot
      case 'KeyT':
        if (e.ctrlKey) {
          api?.mpv.command('screenshot', 'subtitles');
          this._osd('📷 Screenshot saved');
        }
        break;

      // Open file
      case 'KeyO':
        if (e.ctrlKey) {
          e.preventDefault();
          api?.dialog.openFile().then(files => {
            if (files?.length) api?.mpv.openFiles(files);
          });
        }
        break;

      // Always on top
      case 'KeyT':
        if (!e.ctrlKey) {
          this._alwaysOnTop = !this._alwaysOnTop;
          api?.window.alwaysOnTop(this._alwaysOnTop);
          this._osd(this._alwaysOnTop ? '📌 Always on top' : 'Normal window');
        }
        break;
    }
  }

  // ── UI helpers ────────────────────────────────────────
  _updatePlayBtn () {
    const play  = document.querySelector('#btn-play .ico-play');
    const pause = document.querySelector('#btn-play .ico-pause');
    play?.classList.toggle('hidden',  !this.paused);
    pause?.classList.toggle('hidden', this.paused);
  }

  _updateMuteIcon () {
    const btn = document.getElementById('btn-mute');
    if (!btn) return;
    btn.style.color = this.muted ? 'var(--danger)' : '';
  }

  _setTitle (title) {
    if (!title) return;
    const el  = document.getElementById('ctrl-title');
    const tb  = document.getElementById('titlebar-title');
    if (el)  el.textContent = title;
    if (tb)  tb.textContent = title;
    document.title = `${title} — BM Player`;
  }

  _syncVolumeSlider () {
    const slider = document.getElementById('volume-slider');
    const label  = document.getElementById('vol-label');
    if (slider) slider.value   = this.volume;
    if (label)  label.textContent = this.volume;
  }

  // ── OSD notification ──────────────────────────────────
  _osd (msg, ms = 1600) {
    const el = document.getElementById('osd');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._osdTimer);
    this._osdTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ── Mouse auto-hide in fullscreen ─────────────────────
  _mouseAutoHide () {
    document.addEventListener('mousemove', () => {
      document.body.style.cursor = '';
      clearTimeout(this._mouseHideTimer);
      if (document.body.classList.contains('fullscreen')) {
        this._mouseHideTimer = setTimeout(() => {
          document.body.style.cursor = 'none';
        }, 3000);
      }
    });
  }
}
