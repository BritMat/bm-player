#!/usr/bin/env node
/**
 * How the Android app hands songs and videos to its page, in parts (v3.48.0):
 * android/java/.../RangeStream.java, compiled with android/test/
 * TestRangeStream.java and read the way WebView reads what
 * shouldInterceptRequest returns. WebView answers a request's Range itself;
 * before 3.48.0 the app had answered it too, and a song asked for from
 * partway in came from twice as far, or not at all (the phone's "code 2").
 *
 * RangeStream is plain Java, so this needs only javac and java. Without them
 * it says so and stops without failing.
 *
 * v3.49.0: also AfGuard.java, which lets the page give mpv an audio filter
 * only when it is made of the filters sound-chain.js uses. Every filter
 * sound-chain.js makes, for each sound mode and setting, is handed to it
 * here and must get through, and filters that open files must not.
 *
 *   node scripts/stream-check.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = cmd => { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return true; } catch (_) { return false; } };
if (!has('javac') || !has('java')) {
  console.log('stream-check: skipped (no javac or java)');
  process.exit(0);
}
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-stream-'));
try {
  const pkg = path.join(ROOT, 'android', 'java', 'io', 'github', 'britmat', 'bmplayer');
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', out, path.join(pkg, 'RangeStream.java'), path.join(ROOT, 'android', 'test', 'TestRangeStream.java')], { stdio: 'inherit' });
  execFileSync('java', ['-cp', out, 'io.github.britmat.bmplayer.TestRangeStream'], { stdio: 'inherit' });
  // the sound modes' filters for films (v3.49.0)
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', out, path.join(pkg, 'AfGuard.java'), path.join(ROOT, 'android', 'test', 'TestAfGuard.java')], { stdio: 'inherit' });
  const { lavfi, MODES } = await import(pathToFileURL(path.join(ROOT, 'src', 'js', 'sound-chain.js')).href);
  const all = new Set();
  for (const [mode] of MODES) for (const voice of [false, true]) for (const night of [false, true]) for (const channels of ['stereo', 'mono']) {
    for (const extra of [{}, { eq: [3, 0, -2, 0, 0, 0, 0, 0, 0, 4.5], preamp: -3.5, boost: 1.5 }]) all.add(lavfi({ mode, voice, night, channels, ...extra }));
  }
  all.delete('');
  execFileSync('java', ['-cp', out, 'io.github.britmat.bmplayer.TestAfGuard'], { input: [...all].join('\n') + '\n', stdio: ['pipe', 'inherit', 'inherit'] });
} catch (e) {
  console.log('stream-check: FAILED');
  process.exitCode = 1;
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
