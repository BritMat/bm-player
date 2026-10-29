#!/usr/bin/env node
/**
 * Builds BM Player for Android: dist/BM-Player-<version>-android.apk.
 *
 * One APK for every Android phone from 7.0 on, 32-bit (armeabi-v7a) and
 * 64-bit (arm64-v8a) alike. The app itself is Java and a web page. Videos
 * play with mpv (v3.41.0), whose native libraries come from mpv-android's
 * own release, for both kinds of processor: about 28 MB of the APK's 30.
 * Android unpacks the right set when it installs the app.
 *
 * No Gradle and no Android Studio: the plain SDK tools, run in order.
 *
 *   1. The page: android/web, with the desktop's visualiser, MilkDrop,
 *      lyrics, icons, fox, home screen play and pdf.js copied in beside it
 *      (www/), the desktop's theme colours gathered into css/themes.css,
 *      and the licences.
 *   2. aapt packs the manifest, the resources and www/ (and writes R.java).
 *   3. javac compiles android/java against Android 14's android.jar.
 *   4. dx (or d8) turns the classes into classes.dex, added to the APK.
 *   5. mpv's libraries are added (lib/<processor>/*.so), taken unchanged
 *      from mpv-android's APKs on GitHub, checked against the SHA-256 sums
 *      below and kept in dist/android-cache.
 *   6. zipalign, then apksigner signs it (APK Signature Scheme v2 and v3).
 *
 * The tools, where they are looked for:
 *   Ubuntu or Debian: sudo apt install android-sdk-build-tools
 *     dalvik-exchange openjdk-17-jdk-headless (aapt, dx, zipalign,
 *     apksigner, javac), which is what GitHub's Linux machines and the
 *     development container use. Ubuntu 24.04's build tools no longer bring
 *     dx with them: dalvik-exchange is it (v3.42.0). JDK 21 works as well.
 *     Or an Android SDK: ANDROID_HOME (its newest build-tools).
 *   android.jar (Android 14, API 34): ANDROID_JAR, else the SDK's
 *     platforms/android-34, else downloaded once from GitHub (the
 *     Sable/android-platforms collection) into dist/android-cache and
 *     checked against the SHA-256 below.
 *
 * The signing key: an app is only ever updated by an APK signed with the
 * same key, so this one key must be kept for good. It is looked for in
 *   BM_ANDROID_KEYSTORE (the .p12 file in base64) with
 *   BM_ANDROID_KEYSTORE_PASSWORD (GitHub's release job, from its secrets),
 * then android/keystore/bm-player.p12 with keystore.properties beside it.
 * With neither, a new key is made there (not with --release, which stops
 * instead). android/keystore is private: the checker never publishes it.
 *
 *   node android/build-apk.mjs             build (makes a key if none)
 *   node android/build-apk.mjs --release   build only with the real key
 *   node android/build-apk.mjs --stage     only prepare www/ (for testing the page)
 *   node android/build-apk.mjs --no-mpv    leave mpv out (a small APK whose
 *                                          videos play with the web engine)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const WORK = path.join(DIST, 'android-build');
const CACHE = path.join(DIST, 'android-cache');
const KEYDIR = path.join(HERE, 'keystore');
const RELEASE = process.argv.includes('--release');
const STAGE_ONLY = process.argv.includes('--stage');
const NO_MPV = process.argv.includes('--no-mpv');
if (RELEASE && NO_MPV) { console.error('[apk] --release always carries mpv'); process.exit(1); }

const API_JAR = {
  url: 'https://raw.githubusercontent.com/Sable/android-platforms/master/android-34/android.jar',
  sha256: '6cea1df3efb77103ac3e2beb9bf4718964b0e0869ab16d39d29d5cbae1c147ad',
};
const MIN_SDK = 24, TARGET_SDK = 34;

// mpv for videos: mpv-android's release APKs, one per kind of processor,
// from which only the native libraries are taken. A new release means new
// names and sums here, and the versions in android/licenses/NOTICE.txt and
// MpvPlayer.RELEASE.
const MPV = {
  release: '2026-09-17',
  apks: {
    'arm64-v8a': { file: 'app-default-arm64-v8a-release.apk', sha256: '0b0e0a534dd6b8d2b117f06952e0600064ad97702e48bff02543e3e32107803d' },
    'armeabi-v7a': { file: 'app-default-armeabi-v7a-release.apk', sha256: '30c63f5528530f56cdece5d6466c749976f01bdcd8c8e67ae76e70a54b7243aa' },
  },
  // mpv, FFmpeg, the C++ runtime, and libplayer (the glue to Java,
  // android/java/is/xyz/mpv/MPVLib.java). The rest of mpv-android's APK
  // (its own app) is not used.
  libs: ['libmpv.so', 'libplayer.so', 'libavcodec.so', 'libavdevice.so', 'libavfilter.so', 'libavformat.so',
    'libavutil.so', 'libswresample.so', 'libswscale.so', 'libc++_shared.so'],
};

// The desktop's files the phone's page uses, as they are (src/ unless said).
const FROM_DESKTOP = [
  'js/visualizer.js', 'js/fluid.js', 'js/viz-art.js', 'js/viz-beat.js', 'js/neon-gl.js', 'js/perf.js', 'js/power.js',
  'js/md-browser.js', 'js/viz-settings.js', 'js/icons.js', 'js/audio-engine.js', 'js/modules/lyrics.js', 'js/translit.js',
  // v3.42.0: the home screen's fox, backgrounds and play, and the PDF reader
  'js/fox3d.js', 'js/fox3d-mesh.js', 'js/geofox.js', 'js/theme-fx.js', 'js/theme-scenes.js', 'js/flow-settings.js',
  'js/play/sfx.js', 'js/play/fox-play.js', 'js/play/fox-voice.js', 'js/play/flow-toy.js', 'js/play/slice-game.js',
  'css/play.css', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/pdfjs-LICENSE.txt',
  'vendor/milkdrop/butterchurn.min.js', 'vendor/milkdrop/presets.js', 'vendor/milkdrop/previews.js', 'vendor/milkdrop/previews.jpg',
  'vendor/milkdrop/LICENSE.txt', 'vendor/webgl-fluid/LICENSE.txt',
  'css/fonts.css', 'css/lyrics.css', 'css/md-browser.css',
  'fonts/outfit-latin-wght-normal.woff2', 'fonts/outfit-latin-ext-wght-normal.woff2',
  'fonts/unbounded-latin-wght-normal.woff2', 'fonts/unbounded-latin-ext-wght-normal.woff2',
  'fonts/OFL-Outfit.txt', 'fonts/OFL-Unbounded.txt',
];

const log = (...a) => console.log('[apk]', ...a);
function fail(msg, code = 1) { console.error('[apk] ' + msg); process.exit(code); }
function run(cmd, args, opts = {}) {
  try { return execFileSync(cmd, args, { stdio: opts.quiet ? 'pipe' : ['ignore', 'inherit', 'inherit'], encoding: 'utf8', ...opts }); }
  catch (e) { fail(`${path.basename(cmd)} failed${e.stderr ? ':\n' + e.stderr : ''}`); }
}
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copy(from, to) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!m) fail(`package.json's version (${version}) is not x.y.z`);
// 3.40.0 is 34000: always higher for a later version, which Android requires of an update.
const versionCode = +m[1] * 10000 + +m[2] * 100 + +m[3];

// ── 1. The page ──────────────────────────────────────────────────────
function stage() {
  const www = path.join(WORK, 'assets', 'www');
  rmrf(path.join(WORK, 'assets'));
  for (const f of FROM_DESKTOP) {
    const src = path.join(ROOT, 'src', f);
    if (!exists(src)) fail(`missing desktop file src/${f}`);
    copy(src, path.join(www, f));
  }
  copy(path.join(ROOT, 'lyrics-core.js'), path.join(www, 'js', 'lyrics-core.js'));
  copy(path.join(ROOT, 'LICENSE'), path.join(www, 'LICENSE.txt'));
  const web = path.join(HERE, 'web');
  for (const f of walk(web)) copy(f, path.join(www, path.relative(web, f)));
  // mpv's licences and where its source is (Settings, About, Licences).
  const lic = path.join(HERE, 'licenses');
  for (const f of walk(lic)) copy(f, path.join(www, 'licenses', path.relative(lic, f)));
  // The theme colours, the desktop's own: every theme there is one here.
  const css = ['style.css', 'themes.css'].map(f => fs.readFileSync(path.join(ROOT, 'src', 'css', f), 'utf8')).join('\n');
  const blocks = [...css.matchAll(/:root\[data-theme="([a-z0-9-]+)"\]\s*\{[^}]*\}/g)];
  if (blocks.length < 10) fail(`only ${blocks.length} themes found in style.css and themes.css`);
  // Each theme's colours a second time, for its swatch in Settings (data-theme-swatch).
  const swatches = blocks.map(b => b[0].replace(/^:root\[data-theme="([a-z0-9-]+)"\]/, '[data-theme-swatch="$1"]'));
  fs.writeFileSync(path.join(www, 'css', 'themes.css'),
    `/* The desktop's theme colours (src/css/style.css and themes.css), gathered by\n   android/build-apk.mjs. Not edited by hand. */\n` + [...blocks.map(b => b[0]), ...swatches].map(b => b.replace(/\s+/g, ' ')).join('\n') + '\n');
  // Every module import must be inside www/: a file left out of the list above
  // would only show on the phone, as a page that does not start.
  const missing = [];
  for (const f of walk(www).filter(p => p.endsWith('.js'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const im of src.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const rel = im[1] || im[2];
      if (!exists(path.resolve(path.dirname(f), rel))) missing.push(`${path.relative(www, f)} imports ${rel}`);
    }
  }
  if (missing.length) fail('the page would not start, files missing from www/:\n  ' + missing.join('\n  '));
  const bytes = walk(www).reduce((n, f) => n + fs.statSync(f).size, 0);
  log(`page staged: ${walk(www).length} files, ${(bytes / 1048576).toFixed(1)} MB, ${blocks.length} themes`);
  return www;
}

if (STAGE_ONLY) { stage(); process.exit(0); }

// ── the tools ────────────────────────────────────────────────────────
function findBuildTools() {
  const dirs = [];
  if (process.env.ANDROID_BUILD_TOOLS) dirs.push(process.env.ANDROID_BUILD_TOOLS);
  for (const home of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean)) {
    const bt = path.join(home, 'build-tools');
    if (exists(bt)) for (const v of fs.readdirSync(bt).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) dirs.push(path.join(bt, v));
  }
  dirs.push('/usr/lib/android-sdk/build-tools/29.0.3', '/usr/lib/android-sdk/build-tools/debian');
  const ext = process.platform === 'win32' ? ['.exe', '.bat', ''] : [''];
  const find = name => {
    for (const d of dirs) for (const e of ext) { const p = path.join(d, name + e); if (exists(p)) return p; }
    for (const d of (process.env.PATH || '').split(path.delimiter)) for (const e of ext) { const p = path.join(d, name + e); if (d && exists(p)) return p; }
    return null;
  };
  const t = { aapt: find('aapt'), zipalign: find('zipalign'), apksigner: find('apksigner'), dx: find('dx'), d8: find('d8') };
  const missing = ['aapt', 'zipalign', 'apksigner'].filter(k => !t[k]);
  if (!t.dx && !t.d8) missing.push('dx or d8');
  if (missing.length) fail(`not found: ${missing.join(', ')}. On Ubuntu or Debian: sudo apt install android-sdk-build-tools openjdk-17-jdk-headless`);
  return t;
}

function findJdk() {
  const homes = [process.env.JAVA_HOME, '/usr/lib/jvm/java-17-openjdk-amd64', '/usr/lib/jvm/java-17-openjdk-arm64', '/usr/lib/jvm/java-21-openjdk-amd64'].filter(Boolean);
  const ext = process.platform === 'win32' ? '.exe' : '';
  for (const h of homes) {
    const javac = path.join(h, 'bin', 'javac' + ext), keytool = path.join(h, 'bin', 'keytool' + ext);
    if (exists(javac)) return { javac, keytool: exists(keytool) ? keytool : 'keytool' };
  }
  return { javac: 'javac', keytool: 'keytool' };
}

/** A file from the internet, once: kept in dist/android-cache and checked against its SHA-256. */
async function pinned(url, sha256, name, what) {
  const p = path.join(CACHE, name);
  const sum = b => crypto.createHash('sha256').update(b).digest('hex');
  if (exists(p) && sum(fs.readFileSync(p)) === sha256) return p;
  log(`downloading ${what}...`);
  let r;
  try { r = await fetch(url); } catch (e) { fail(`could not download ${what} (${url}): ${e.message}`); }
  if (!r.ok) fail(`could not download ${what} (${url}): HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (sum(buf) !== sha256) fail(`${what} is not the file expected (SHA-256 ${sum(buf)})`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(p, buf);
  return p;
}

async function androidJar() {
  if (process.env.ANDROID_JAR && exists(process.env.ANDROID_JAR)) return process.env.ANDROID_JAR;
  for (const home of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean)) {
    const p = path.join(home, 'platforms', 'android-34', 'android.jar');
    if (exists(p)) return p;
  }
  return pinned(API_JAR.url, API_JAR.sha256, 'android-34.jar', 'android.jar (Android 14) from GitHub');
}

/**
 * The files in a ZIP (an APK is one) whose names want() accepts, as
 * { name: Buffer }. Only what an APK uses: stored or deflated, no ZIP64.
 */
function unzip(buf, want) {
  let end = -1;                                     // the end of the central directory
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('not a ZIP file');
  const out = {};
  let p = buf.readUInt32LE(end + 16);
  for (let k = buf.readUInt16LE(end + 10); k > 0; k--) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('the ZIP directory is damaged');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), at = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    if (!want(name)) continue;
    if (buf.readUInt32LE(at) !== 0x04034b50) throw new Error(`${name}: damaged`);
    const from = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const raw = buf.subarray(from, from + csize);
    const data = method === 0 ? Buffer.from(raw) : method === 8 ? zlib.inflateRawSync(raw) : null;
    if (!data) throw new Error(`${name}: packed in a way this cannot read (${method})`);
    if (data.length !== size) throw new Error(`${name}: ${data.length} bytes where ${size} were expected`);
    out[name] = data;
  }
  return out;
}

/** mpv's libraries for each kind of processor, in dir/lib/<abi>/. Returns their paths, relative to dir. */
async function mpvLibs(dir) {
  const added = [];
  for (const [abi, apk] of Object.entries(MPV.apks)) {
    const url = `https://github.com/mpv-android/mpv-android/releases/download/${MPV.release}/${apk.file}`;
    const file = await pinned(url, apk.sha256, `mpv-android-${MPV.release}-${abi}.apk`, `mpv-android ${MPV.release} (${abi}) from GitHub`);
    const want = new Set(MPV.libs.map(l => `lib/${abi}/${l}`));
    const got = unzip(fs.readFileSync(file), n => want.has(n));
    const missing = [...want].filter(n => !got[n]);
    if (missing.length) fail(`mpv-android's ${abi} APK lacks ${missing.join(', ')}`);
    for (const [name, data] of Object.entries(got)) {
      fs.mkdirSync(path.join(dir, path.dirname(name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), data);
      added.push(name);
    }
  }
  return added;
}

// ── the signing key ──────────────────────────────────────────────────
function signingKey(keytool) {
  if (process.env.BM_ANDROID_KEYSTORE && process.env.BM_ANDROID_KEYSTORE_PASSWORD) {
    const f = path.join(os.tmpdir(), `bm-key-${process.pid}.p12`);
    fs.writeFileSync(f, Buffer.from(process.env.BM_ANDROID_KEYSTORE.replace(/\s+/g, ''), 'base64'), { mode: 0o600 });
    process.on('exit', () => rmrf(f));
    return { file: f, pass: process.env.BM_ANDROID_KEYSTORE_PASSWORD, alias: process.env.BM_ANDROID_KEY_ALIAS || 'bmplayer', from: 'the BM_ANDROID_KEYSTORE secret' };
  }
  const file = path.join(KEYDIR, 'bm-player.p12'), props = path.join(KEYDIR, 'keystore.properties');
  if (exists(file) && exists(props)) {
    const kv = Object.fromEntries(fs.readFileSync(props, 'utf8').split(/\r?\n/).map(l => l.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(x => [x[1], x[2]]));
    if (!kv.storePassword) fail(`no storePassword in ${props}`);
    return { file, pass: kv.storePassword, alias: kv.keyAlias || 'bmplayer', from: 'android/keystore' };
  }
  if (RELEASE) fail('no signing key: set BM_ANDROID_KEYSTORE and BM_ANDROID_KEYSTORE_PASSWORD, or put the key in android/keystore. A new key would make an APK that cannot update the one people have.', 3);
  fs.mkdirSync(KEYDIR, { recursive: true });
  const pass = crypto.randomBytes(18).toString('base64').replace(/[^A-Za-z0-9]/g, 'x');
  run(keytool, ['-genkeypair', '-keystore', file, '-storetype', 'PKCS12', '-storepass:env', 'BM_KS_PASS', '-alias', 'bmplayer',
    '-keyalg', 'RSA', '-keysize', '4096', '-validity', '25000', '-dname', 'CN=BM Player, O=BritMat'], { env: { ...process.env, BM_KS_PASS: pass }, quiet: true });
  fs.writeFileSync(props, `# BM Player's Android signing key (bm-player.p12). Keep this folder: every\n# update must be signed with this key, or phones refuse to install it over\n# the app they have. Never published (tools/bm-helper.ps1 leaves it out).\nstorePassword=${pass}\nkeyAlias=bmplayer\n`, { mode: 0o600 });
  fs.writeFileSync(path.join(KEYDIR, 'bm-player.p12.base64.txt'), fs.readFileSync(file).toString('base64') + '\n', { mode: 0o600 });
  console.warn('[apk] made a NEW signing key in android/keystore. Keep that folder safe: updates need the same key.');
  return { file, pass, alias: 'bmplayer', from: 'android/keystore (new)' };
}

// ── 2 to 5. Build ────────────────────────────────────────────────────
const tools = findBuildTools();
const jdk = findJdk();
const jar = await androidJar();
const key = signingKey(jdk.keytool);

for (const d of ['gen', 'obj', 'dex', 'out', 'native']) rmrf(path.join(WORK, d));
for (const d of ['gen', 'obj', 'dex', 'out', 'native']) fs.mkdirSync(path.join(WORK, d), { recursive: true });
stage();
// mpv first, so a download that fails stops the build before anything else is done.
const nativeDir = path.join(WORK, 'native');
const libs = NO_MPV ? [] : await mpvLibs(nativeDir);

const javaPkg = 'io/github/britmat/bmplayer';
fs.mkdirSync(path.join(WORK, 'gen', javaPkg), { recursive: true });
fs.writeFileSync(path.join(WORK, 'gen', javaPkg, 'BuildInfo.java'),
  `package io.github.britmat.bmplayer;\n\n/** Written by android/build-apk.mjs from package.json. */\nfinal class BuildInfo {\n    private BuildInfo() { }\n    static final String VERSION_NAME = ${JSON.stringify(version)};\n    static final int VERSION_CODE = ${versionCode};\n}\n`);

const unsigned = path.join(WORK, 'out', 'unsigned.apk');
log(`aapt: BM Player ${version} (${versionCode}), Android ${MIN_SDK} to ${TARGET_SDK}`);
run(tools.aapt, ['package', '-f', '-m', '-J', path.join(WORK, 'gen'), '-M', path.join(HERE, 'AndroidManifest.xml'), '-S', path.join(HERE, 'res'),
  '-I', jar, '-A', path.join(WORK, 'assets'), '--min-sdk-version', String(MIN_SDK), '--target-sdk-version', String(TARGET_SDK),
  '--version-code', String(versionCode), '--version-name', version, '-F', unsigned]);

const sources = [...walk(path.join(HERE, 'java')), ...walk(path.join(WORK, 'gen'))].filter(f => f.endsWith('.java'));
log(`javac: ${sources.length} files`);
run(jdk.javac, ['-source', '8', '-target', '8', '-bootclasspath', jar, '-encoding', 'UTF-8', '-Xlint:-options', '-Xlint:unchecked',
  '-d', path.join(WORK, 'obj'), ...sources]);

const dexDir = path.join(WORK, 'dex');
if (tools.dx) {
  log('dx: classes.dex');
  run(tools.dx, ['--dex', `--min-sdk-version=${MIN_SDK}`, `--output=${path.join(dexDir, 'classes.dex')}`, path.join(WORK, 'obj')]);
} else {
  log('d8: classes.dex');
  run(tools.d8, ['--min-api', String(MIN_SDK), '--lib', jar, '--output', dexDir, ...walk(path.join(WORK, 'obj')).filter(f => f.endsWith('.class'))]);
}
run(tools.aapt, ['add', '-k', unsigned, path.join(dexDir, 'classes.dex')], { quiet: true });

if (libs.length) {
  // Added by their paths from nativeDir, which become their names in the
  // APK (lib/arm64-v8a/libmpv.so), compressed.
  log(`mpv: ${libs.length} libraries from mpv-android ${MPV.release} (${Object.keys(MPV.apks).join(', ')})`);
  run(tools.aapt, ['add', unsigned, ...libs], { quiet: true, cwd: nativeDir });
} else log('mpv left out (--no-mpv): videos play with the web engine');

const aligned = path.join(WORK, 'out', 'aligned.apk');
run(tools.zipalign, ['-f', '-p', '4', unsigned, aligned]);

fs.mkdirSync(DIST, { recursive: true });
const apk = path.join(DIST, `BM-Player-${version}-android.apk`);
rmrf(apk);
log(`signing with the key from ${key.from}`);
run(tools.apksigner, ['sign', '--ks', key.file, '--ks-type', 'PKCS12', '--ks-key-alias', key.alias, '--ks-pass', 'env:BM_KS_PASS',
  '--v1-signing-enabled', 'false', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true', '--v4-signing-enabled', 'false',
  '--out', apk, aligned], { env: { ...process.env, BM_KS_PASS: key.pass } });
rmrf(apk + '.idsig');

// ── check what came out ──────────────────────────────────────────────
const verify = run(tools.apksigner, ['verify', '--verbose', '--print-certs', apk], { quiet: true });
if (!/Verified using v2 scheme \(APK Signature Scheme v2\): true/.test(verify)) fail('apksigner could not verify the APK:\n' + verify);
const cert = (verify.match(/certificate SHA-256 digest: ([0-9a-f]+)/) || [])[1] || '?';
const badging = run(tools.aapt, ['dump', 'badging', apk], { quiet: true });
const pkgLine = (badging.match(/^package: .*$/m) || [''])[0];
if (!pkgLine.includes(`versionName='${version}'`)) fail('the APK does not carry the version:\n' + pkgLine);
if (libs.length) {
  // Every library in, whole, for both processors.
  const inApk = unzip(fs.readFileSync(apk), n => n.startsWith('lib/'));
  const wrong = libs.filter(n => !inApk[n] || !inApk[n].equals(fs.readFileSync(path.join(nativeDir, n))));
  if (wrong.length) fail('mpv\'s libraries are not in the APK as they should be: ' + wrong.join(', '));
  const native = (badging.match(/^native-code: .*$/m) || [''])[0];
  log(native || 'native-code: ?');
}
const size = fs.statSync(apk).size;
log(pkgLine);
log(`signing certificate SHA-256: ${cert}`);
log(`done: ${path.relative(ROOT, apk)} (${(size / 1048576).toFixed(2)} MB)`);
