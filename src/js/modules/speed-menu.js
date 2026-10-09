/**
 * BM Player — Playback Speed Presets (v1.7.0)
 *
 * Replaces the original "click badge to cycle through 8 speeds"
 * with a small dropdown of curated presets plus the existing fine
 * control via [ and ] keys. Presets cover the speeds people actually
 * use: 0.25×, 0.5×, 0.75×, 1×, 1.25×, 1.5×, 1.75×, 2×, 2.5×, 3×.
 *
 * The badge remains a clickable element but now opens a dropdown
 * menu anchored beneath it, instead of blindly cycling.
 */

const PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

/*
 * Music too (v3.38.0). music: () => { owns(), get(), set(speed) }, the music
 * player's speed, which is used while it is playing a song itself (the
 * in-app engine plays nearly all music) and kept from one song to the next.
 * mpv's speed is the film's. With musicOnly (the button in the Music view)
 * it is always the music's.
 */
class SpeedMenu {
  constructor({ mpvApi, osd, anchorId = 'speed-badge', music = null, musicOnly = false }) {
    this._mpv = mpvApi;            // () => window.api.mpv
    this._osd = osd;                // (msg, ms) => void
    this._anchorId = anchorId;
    this._music = music; this._musicOnly = musicOnly;
    this._menu = null;
    this._current = 1.0;            // mpv's
    this._wire();
    this._updateBadge();
  }

  _m() { try { return typeof this._music === 'function' ? this._music() : this._music; } catch (_) { return null; } }
  _forMusic() { const m = this._m(); return !!m && (this._musicOnly || !!m.owns()); }
  /** The speed of what this menu sets now. */
  speed() { return this._forMusic() ? (+this._m().get() || 1) : this._current; }
  /** Show the speed again: music started or stopped. */
  sync() { this._updateBadge(); }

  _api() { return typeof this._mpv === 'function' ? this._mpv() : this._mpv; }
  _show(msg, ms = 1200) { try { this._osd?.(msg, ms); } catch (_) {} }

  _wire() {
    const anchor = document.getElementById(this._anchorId);
    if (!anchor) return;
    anchor.style.cursor = 'pointer';
    anchor.title = 'Click to choose speed (or use [ and ] keys)';
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });
    anchor.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); e.stopPropagation(); this.toggle();
    });
    document.addEventListener('click', () => this.hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  /** Programmatically set the speed (also updates the badge). */
  async set(speed) {
    const s = +speed;
    if (!isFinite(s) || s <= 0 || s > 10) return;
    if (this._forMusic()) { try { this._m().set(s); } catch (_) {} }
    else {
      this._current = s;
      try { await this._api()?.cmd('set_property', 'speed', s); } catch (_) {}
    }
    this._updateBadge();
    this._show(`Speed: ${formatSpeed(s)}`);
  }

  /** Cycle to the next preset (used by old keyboard behavior preserved). */
  async cycleNext() {
    const cur = this.speed();
    const idx = PRESETS.findIndex(p => Math.abs(p - cur) < 0.01);
    const next = PRESETS[(idx + 1) % PRESETS.length];
    await this.set(next);
  }

  async cyclePrev() {
    const cur = this.speed();
    const idx = PRESETS.findIndex(p => Math.abs(p - cur) < 0.01);
    const prev = PRESETS[(idx - 1 + PRESETS.length) % PRESETS.length];
    await this.set(prev);
  }

  /** Called from the host's mpv prop-change listener to keep the badge in sync. */
  onSpeedChange(speed) {
    this._current = +speed || 1;
    this._updateBadge();
  }

  _updateBadge() {
    const b = document.getElementById(this._anchorId);
    if (b) b.textContent = formatSpeed(this.speed());
  }

  toggle() {
    if (this._menu && this._menu.isConnected) this.hide();
    else this.show();
  }

  show() {
    this.hide();
    const anchor = document.getElementById(this._anchorId);
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.className = 'speed-menu';
    menu.innerHTML = `<div class="speed-menu-title">Playback Speed</div>`;
    const list = document.createElement('div');
    list.className = 'speed-menu-list';
    PRESETS.forEach(p => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'speed-menu-item';
      if (Math.abs(p - this.speed()) < 0.01) item.classList.add('active');
      item.innerHTML = `<span class="speed-menu-val">${formatSpeed(p)}</span>`;
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.set(p);
        this.hide();
      });
      list.appendChild(item);
    });
    menu.appendChild(list);

    // Position below the badge, clamped to viewport.
    document.body.appendChild(menu);
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = rect.left + rect.width / 2 - mw / 2;
    let top = rect.bottom + 6;
    if (left < 8) left = 8;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    if (top + mh > window.innerHeight - 8) top = rect.top - mh - 6;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    this._menu = menu;
    requestAnimationFrame(() => menu.classList.add('open'));
  }

  hide() {
    if (this._menu && this._menu.isConnected) {
      this._menu.classList.remove('open');
      const el = this._menu;
      setTimeout(() => el.remove(), 150);
    }
    this._menu = null;
  }
}

function formatSpeed(s) {
  if (s == null || isNaN(s)) return '1x';
  // 1.0 -> "1x", 1.5 -> "1.5x", 0.25 -> "0.25x", 2 -> "2x"
  const str = (+s).toFixed(2).replace(/\.?0+$/, '');
  return str + 'x';
}

export default SpeedMenu;
export { PRESETS as SPEED_PRESETS, formatSpeed };
