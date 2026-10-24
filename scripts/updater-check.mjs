#!/usr/bin/env node
/**
 * The Android updater's choice of release (android/java/.../Releases.java),
 * tried on a computer (v3.44.0): compiled with android/test/TestReleases.java
 * against a real org.json (Android's own, as Debian and Ubuntu package it:
 * libandroid-json-java) and run on android/test/releases.json.
 *
 * The rest of the updater (the download, the checks on the APK, Android's
 * installer) needs a phone. With no javac, java or org.json here it says so
 * and stops without failing.
 *
 *   node scripts/updater-check.mjs        BM_ORG_JSON=path/to/json.jar to choose the jar
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = cmd => { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return true; } catch (_) { return false; } };
const jar = [process.env.BM_ORG_JSON, '/usr/share/java/com.android.json.jar', '/usr/share/java/json.jar'].find(p => p && fs.existsSync(p));
if (!has('javac') || !has('java') || !jar) {
  console.log(`updater-check: skipped (${!jar ? 'no org.json jar: apt install libandroid-json-java, or set BM_ORG_JSON' : 'no javac or java'})`);
  process.exit(0);
}
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-updater-'));
try {
  const pkg = path.join(ROOT, 'android', 'java', 'io', 'github', 'britmat', 'bmplayer');
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', out, '-cp', jar, path.join(pkg, 'Releases.java'), path.join(ROOT, 'android', 'test', 'TestReleases.java')], { stdio: 'inherit' });
  execFileSync('java', ['-cp', out + path.delimiter + jar, 'io.github.britmat.bmplayer.TestReleases', path.join(ROOT, 'android', 'test', 'releases.json')], { stdio: 'inherit' });
} catch (e) {
  console.log('updater-check: FAILED');
  process.exitCode = 1;
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
