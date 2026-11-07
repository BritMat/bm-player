/**
 * Lyrics for many songs at once, saved for later (v3.50.0): every song in
 * the music folder on the desktop, every song on the phone. Each is looked
 * for as when it plays (window.api.music.lyrics, lyrics-core.js): the
 * person's choice, a file beside it, its tags, what is saved already, then
 * LRCLIB. What LRCLIB finds is saved on the device, so those songs have
 * their lyrics later without a connection.
 *
 * LRCLIB is free and asks nothing, so it is asked gently: one song at a
 * time, and a pause after each song it was asked about. A song it had
 * nothing for in the last week is not asked about again. When it cannot be
 * reached, the saver waits for the connection (the browser's online event,
 * or half a minute) and goes on from the same song. A song that still
 * cannot be looked up after a few tries while the device says it is online
 * (LRCLIB refusing, say) is left for the next time (missed), so one song
 * never holds up the rest. It runs while the app is open, and can be
 * stopped.
 *
 *   const s = new LyricsSaver({ api, onChange })
 *   s.start(songs)     songs: [{ path, meta: { title, artist, album, duration } }]
 *   s.stop()
 *   s.state            { running, waiting, total, done, found, none, missed, stopped }
 */
const GAP = 1200;          // ms after each song LRCLIB was asked about
const WAIT = 30000;        // ms before trying again when it could not be reached
const TRIES = 3;           // tries for one song while the device says it is online

export class LyricsSaver {
  constructor ({ api, onChange = () => {}, gap = GAP, wait = WAIT } = {}) {
    this.api = api; this.onChange = onChange; this.gap = gap; this.wait = wait;
    this.state = { running: false, waiting: false, total: 0, done: 0, found: 0, none: 0, missed: 0, stopped: false };
    this._run = 0;
  }

  get running () { return this.state.running; }

  _tell () { try { this.onChange({ ...this.state }); } catch (_) {} }

  _sleep (ms, run) {
    return new Promise(done => {
      let t = 0;
      const on = () => { clearTimeout(t); try { window.removeEventListener('online', on); } catch (_) {} done(); };
      t = setTimeout(on, ms);
      // a stop, or the connection back, ends the wait early
      this._wake = on;
      if (run && this.state.waiting) { try { window.addEventListener('online', on); } catch (_) {} }
    });
  }

  /** Goes through the songs, one at a time. Resolves when done or stopped. */
  async start (songs) {
    if (this.state.running || !this.api?.music?.lyrics) return this.state;
    const list = (songs || []).filter(s => s && typeof s.path === 'string' && s.path);
    const run = ++this._run;
    this.state = { running: true, waiting: false, total: list.length, done: 0, found: 0, none: 0, missed: 0, stopped: false };
    this._tell();
    let tries = 0;
    for (let i = 0; i < list.length; i++) {
      if (run !== this._run) break;
      const { path, meta } = list[i];
      let r = null;
      try { r = await this.api.music.lyrics(path, meta || {}, { online: true, youtube: false }); } catch (_) { r = null; }
      if (run !== this._run) break;
      const words = r && (r.synced || r.plain || r.instrumental);
      if (r?.offline && !words) {
        let online = true; try { online = navigator.onLine !== false; } catch (_) {}
        if (++tries <= TRIES || !online) {
          // the same song again once the connection is back
          this.state.waiting = true; this._tell();
          await this._sleep(this.wait, run);
          this.state.waiting = false;
          i--; continue;
        }
      }
      const missed = r?.offline && !words;
      tries = 0;
      this.state.done++;
      if (words) this.state.found++; else if (missed) this.state.missed++; else this.state.none++;
      this._tell();
      if (r?.fetched && i < list.length - 1) await this._sleep(this.gap, run);
    }
    if (run === this._run) { this.state.running = false; this._tell(); }
    return this.state;
  }

  /** Stops after the song being looked for. */
  stop () {
    if (!this.state.running) return;
    this._run++;
    this.state = { ...this.state, running: false, waiting: false, stopped: true };
    try { this._wake?.(); } catch (_) {}
    this._tell();
  }
}
