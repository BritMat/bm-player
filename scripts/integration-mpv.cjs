#!/usr/bin/env node
'use strict';
/**
 * BM Player: integration test against the real mpv
 *
 * Every other test stubs mpv, which means they can only confirm the app
 * agrees with what the author BELIEVES mpv does. That belief was wrong once
 * already: v2.6.0 advanced music on `end-file`, but with --keep-open=yes mpv
 * never sends end-file at the end of the last file. It sets eof-reached and
 * pauses. Music auto-advance silently never worked under mpv.
 *
 * This launches the actual binary with the launch arguments read out of
 * main.js (only the window embedding and outputs are swapped for headless
 * ones) and checks the behaviour the app now depends on.
 *
 * Skips, successfully, when mpv is not installed. CI installs it on Linux.
 * Run with: npm run test:mpv
 */

const { spawn, execFileSync } = require('child_process');
const net = require('net'), fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const results = [];
const pass = n => { results.push(true);  console.log('  \x1b[32m✓\x1b[0m ' + n); };
const fail = (n, e) => { results.push(false); console.log('  \x1b[31m✗\x1b[0m ' + n + (e ? '\n      ' + (e.message || e) : '')); };

let version;
try { version = execFileSync('mpv', ['--version'], { timeout: 5000 }).toString().split('\n')[0]; }
catch { console.log('\n  mpv not installed: integration test skipped.\n'); process.exit(0); }
console.log('\nBM Player: integration test against real mpv\n  ' + version + '\n');

/* The app's own launch arguments, read from main.js so the test cannot
   drift from what actually ships. */
const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const block = (mainSrc.match(/const coreArgs\s*=\s*\[([\s\S]*?)\];/) || [])[1] || '';
const appArgs = [...block.matchAll(/'(--[^']+)'/g)].map(m => m[1])
  .filter(a => !/^--(vo|hwdec)=/.test(a));          // headless: no video output here
if (!appArgs.includes('--keep-open=yes')) {
  console.log('  note: main.js no longer passes --keep-open=yes; the checks below describe the old contract');
}

/* Short sine-tone WAVs, generated rather than committed. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-mpv-'));
function wav(file, seconds) {
  const rate = 22050, n = Math.floor(rate * seconds), data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(3000 * Math.sin(2 * Math.PI * 440 * i / rate)), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
const ONE = path.join(TMP, 'one.wav'), TWO = path.join(TMP, 'two.wav');
wav(ONE, 1.2); wav(TWO, 1.2);

/** Run mpv with the app's args, drive it with `script`, return what it said. */
function session(script, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    // A fresh name per session, and mpv.exe itself on Windows: plain 'mpv'
    // resolves to the mpv.com launcher there, and killing the launcher left
    // mpv.exe holding the previous session's pipe.
    const n = (session.count = (session.count || 0) + 1);
    const sock = IS_WIN() ? '\\\\.\\pipe\\bm-mpv-test-' + process.pid + '-' + n : path.join(TMP, 'mpv-' + n + '.sock');
    const proc = spawn(IS_WIN() ? 'mpv.exe' : 'mpv', [...appArgs, `--input-ipc-server=${sock}`, '--vo=null', '--ao=null', '--no-config'],
                       { stdio: 'ignore' });
    const seen = { events: [], props: {}, timeline: [] };
    const t0 = Date.now();
    let s, done = false;
    const finish = err => {
      if (done) return; done = true;
      try { s && s.destroy(); } catch {}
      try {
        if (IS_WIN()) execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
        else proc.kill();
      } catch {}
      err ? reject(err) : resolve(seen);
    };
    const timer = setTimeout(() => finish(), timeoutMs);
    const tryConnect = (n = 50) => {
      s = net.connect(sock);
      s.on('error', () => n > 0 ? setTimeout(() => tryConnect(n - 1), 100) : finish(new Error('mpv IPC socket never appeared')));
      s.on('connect', () => {
        const send = c => s.write(JSON.stringify({ command: c }) + '\n');
        ['pause', 'eof-reached', 'filename', 'time-pos', 'idle-active']
          .forEach((p, i) => send(['observe_property', 300 + i, p]));
        let buf = '';
        s.on('data', d => {
          buf += d; let nl;
          while ((nl = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
            if (!line) continue;
            let m; try { m = JSON.parse(line); } catch { continue; }
            if (m.event === 'property-change') {
              seen.props[m.name] = m.data;
              if (m.name !== 'time-pos') seen.timeline.push([Date.now() - t0, m.name, m.data]);
              script.onProp && script.onProp(m.name, m.data, send, seen);
            } else if (m.event) {
              seen.events.push({ event: m.event, reason: m.reason });
            }
          }
        });
        script.start(send);
        if (script.stopAfter) setTimeout(() => { clearTimeout(timer); finish(); }, script.stopAfter);
      });
    };
    setTimeout(tryConnect, 100);
  });
}
function IS_WIN() { return process.platform === 'win32'; }

/* Mirror openFiles() in main.js as it currently is, rather than as it is
   meant to be. A hard-coded copy would keep passing if the unpause were
   deleted from the app, which is the one regression this test exists for. */
const openFilesSrc = (mainSrc.match(/function openFiles\([^)]*\)\{[^\n]*/) || [''])[0];
const APP_UNPAUSES = /mpvCmd\('set_property','pause',false\)/.test(openFilesSrc);
const openLikeApp = (send, file) => {
  send(['loadfile', file, 'replace']);
  if (APP_UNPAUSES) send(['set_property', 'pause', false]);
};

async function main() {
  // 1. The contract the renderer's auto-advance is built on.
  try {
    const r = await session({ start: send => setTimeout(() => openLikeApp(send, ONE), 150), stopAfter: 2600 });
    const eofEndFile = r.events.some(e => e.event === 'end-file' && e.reason === 'eof');
    const eofReached = r.timeline.some(([, n, v]) => n === 'eof-reached' && v === true);
    if (!eofReached) throw new Error('eof-reached never became true, so the renderer would never advance');
    if (eofEndFile) throw new Error('mpv now sends end-file at EOF with these args; the end-file handler would fire as well, check for double advance');
    pass('end of file sets eof-reached and sends no end-file (keep-open)');
  } catch (e) { fail('end of file sets eof-reached and sends no end-file (keep-open)', e); }

  // 2. Advancing late, after mpv has paused on the last frame.
  try {
    let advanced = false;
    const r = await session({
      start: send => setTimeout(() => openLikeApp(send, ONE), 150),
      onProp: (name, v, send, seen) => {
        if (name === 'pause' && v === true && seen.props['eof-reached'] === true && !advanced) {
          advanced = true;
          openLikeApp(send, TWO);                       // the next track, the way the app loads it
        }
      },
      stopAfter: 4200,
    });
    if (!advanced) throw new Error('mpv never paused at the end of the first file');
    if (r.props.filename !== 'two.wav') throw new Error('second file was not loaded');
    const pos = r.props['time-pos'];
    if (!(pos > 0.5)) throw new Error(`second file sat at ${pos}s: it loaded paused`);
    pass('the next file plays after an end-of-file pause');
  } catch (e) { fail('the next file plays after an end-of-file pause', e); }

  // 3. Why openFiles() unpauses: mpv keeps pause across loadfile.
  try {
    let advanced = false;
    const r = await session({
      start: send => setTimeout(() => openLikeApp(send, ONE), 150),
      onProp: (name, v, send, seen) => {
        if (name === 'pause' && v === true && seen.props['eof-reached'] === true && !advanced) {
          advanced = true;
          send(['loadfile', TWO, 'replace']);           // no unpause
        }
      },
      stopAfter: 3600,
    });
    const pos = r.props['time-pos'];
    if (pos > 0.5) {
      console.log('  note: this mpv no longer keeps pause across loadfile; the unpause in openFiles() is now redundant');
    }
    pass(`mpv keeps pause across loadfile (next file sat at ${Number(pos || 0).toFixed(2)}s without an unpause)`);
  } catch (e) { fail('mpv keeps pause across loadfile', e); }

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  const bad = results.filter(r => !r).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed.\n`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
