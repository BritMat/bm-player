/**
 * The GBA player (v3.53.0): mGBA built for the web, with a game of yours.
 *
 * It runs in a frame of its own (bmgame://gba), apart from the app's page.
 * The core is at core/mgba.js, fetched by the app the first time (see
 * main/games-service.js). The game is asked for by the id it has in your
 * list (rom/<id>): the page never learns where the file is.
 *
 * Saves are the game's own (battery saves) and save states. They are kept
 * in this page's storage on this computer, under the game's id.
 *
 * The app's page tells it what to do with messages: pause, resume, reset,
 * save, load, speed, volume. It answers with what happened.
 */
const Q = new URLSearchParams(location.search);
for (const k of ['bg', 'fg', 'mu', 'ac']) { const v = Q.get(k); if (v && /^#[0-9a-f]{3,8}$/i.test(v)) document.documentElement.style.setProperty('--' + k, v); }
const id = Q.get('rom') || '';
const screen = document.getElementById('screen'), note = document.getElementById('note');
const tell = (event, more) => { try { parent.postMessage({ bm: 'gba', event, ...more }, '*'); } catch (_) {} };
const say = (text, bad) => { note.hidden = !text; note.textContent = text || ''; note.classList.toggle('bad', !!bad); };

// The screen is 240 by 160: as large as fits, in whole steps where there is room for them.
function fit() {
  const s = Math.min(innerWidth / 240, innerHeight / 160);
  const k = s >= 2 ? Math.floor(s) : s;
  screen.style.width = Math.floor(240 * k) + 'px'; screen.style.height = Math.floor(160 * k) + 'px';
}
addEventListener('resize', fit); fit();

// The keys. The core's own reading of the keyboard is switched off, so these are the only ones.
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyX: 'a', KeyZ: 'b', KeyA: 'l', KeyS: 'r', Enter: 'start', Backspace: 'select', ShiftRight: 'select' };
let core = null, running = false, paused = false, speed = 1;
const held = new Set();
addEventListener('keydown', e => {
  const b = KEYS[e.code]; if (!b) return;
  e.preventDefault();
  if (!running || e.repeat || held.has(b)) return;
  held.add(b); core.buttonPress(b);
});
addEventListener('keyup', e => { const b = KEYS[e.code]; if (!b) return; e.preventDefault(); if (held.delete(b) && running) core.buttonUnpress(b); });
const letGo = () => { if (running) for (const b of held) core.buttonUnpress(b); held.clear(); };
addEventListener('blur', letGo);

let syncing = 0;
const keep = () => { clearTimeout(syncing); syncing = setTimeout(() => core.FSSync().catch(() => {}), 400); };

async function start() {
  if (!/^[0-9a-f]{12}$/.test(id)) throw new Error('No game was named.');
  say('Starting the player…');
  let mGBA;
  try { mGBA = (await import('./core/mgba.js')).default; } catch (_) { throw new Error('The player is not on this computer yet.'); }
  core = await mGBA({ canvas: screen });
  await core.FSInit();
  say('Reading the game…');
  const r = await fetch('rom/' + id);
  if (!r.ok) throw new Error(r.status === 404 ? 'The game\'s file is not where it was.' : 'The game could not be read.');
  const bytes = new Uint8Array(await r.arrayBuffer());
  const paths = core.filePaths();
  // One game at a time is copied in here: the last one goes.
  for (const f of core.FS.readdir(paths.gamePath)) if (f !== '.' && f !== '..') { try { core.FS.unlink(paths.gamePath + '/' + f); } catch (_) {} }
  const file = paths.gamePath + '/' + id + '.gba';
  core.FS.writeFile(file, bytes);
  if (!core.loadGame(file)) throw new Error('This is not a game the player can run.');
  core.toggleInput(false);
  core.addCoreCallbacks({ saveDataUpdatedCallback: keep, coreCrashedCallback: () => { running = false; say('The game stopped. Reset starts it again.', true); tell('crashed'); } });
  running = true; paused = false;
  say('');
  screen.focus();
  tell('ready', { core: core.version.projectName + ' ' + core.version.projectVersion });
}

const DO = {
  pause() { if (running && !paused) { core.pauseGame(); paused = true; letGo(); } },
  resume() { if (running && paused) { core.resumeGame(); paused = false; } screen.focus(); },
  reset() { if (!core) return; core.quickReload(); running = true; paused = false; say(''); screen.focus(); },
  save() { const ok = running && core.saveState(1); if (ok) keep(); return { ok: !!ok }; },
  load() { const ok = running && core.loadState(1); return { ok: !!ok }; },
  speed(v) { speed = v === 2 || v === 4 ? v : 1; if (running) core.setFastForwardMultiplier(speed); return { speed }; },
  volume(v) { if (running) core.setVolume(Math.max(0, Math.min(1, +v || 0))); },
  focus() { screen.focus(); },
};
addEventListener('message', e => {
  if (e.source !== parent || !e.data || e.data.bm !== 'gba') return;
  const f = DO[e.data.cmd]; if (!f) return;
  let out; try { out = f(e.data.value); } catch (err) { out = { ok: false }; }
  tell('done', { cmd: e.data.cmd, paused, ...out });
});
addEventListener('pagehide', () => { try { core?.FSSync(); } catch (_) {} });

start().catch(e => { say(String(e && e.message || e), true); tell('error', { message: String(e && e.message || e) }); });
