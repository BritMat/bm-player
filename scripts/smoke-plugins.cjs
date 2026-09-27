#!/usr/bin/env node
/**
 * smoke-plugins: each plugin safety rule in plugin-safety.js, attacked.
 * Plugins can run code inside the player, so every rule here is one that a
 * hostile plugin folder would try to get round.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const PS = require(path.join(__dirname, '..', 'plugin-safety.js'));

let pass = 0, fail = 0;
const step = (name, fn) => {
  try { fn(); pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  catch (e) { fail++; console.log('  \x1b[31m✗\x1b[0m ' + name + '\n      ' + e.message); }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-plugins-'));
const plug = path.join(T, 'plug'), outside = path.join(T, 'outside');
fs.mkdirSync(path.join(plug, 'sub'), { recursive: true }); fs.mkdirSync(outside);
fs.writeFileSync(path.join(plug, 'index.js'), 'export function activate(){}');
fs.writeFileSync(path.join(plug, 'sub', 'x.css'), 'a{}');
fs.writeFileSync(path.join(plug, '.hidden.js'), '');
fs.writeFileSync(path.join(outside, 'evil.js'), 'bad');
let canLink = true;
try { fs.symlinkSync(path.join(outside, 'evil.js'), path.join(plug, 'link.js')); } catch { canLink = false; }

console.log('\nBM Player: plugin safety\n');

step('plugin files must stay inside their own folder', () => {
  expect(PS.safeChild(plug, 'index.js', ['.js']), 'index.js refused');
  expect(PS.safeChild(plug, 'sub/x.css', ['.css']), 'a file in a subfolder refused');
  for (const bad of ['../outside/evil.js', '..\\outside\\evil.js', path.join(outside, 'evil.js'), 'C:\\Windows\\evil.js', '', 'sub/../../outside/evil.js'])
    expect(PS.safeChild(plug, bad, ['.js']) === null, 'accepted ' + JSON.stringify(bad));
  expect(PS.safeChild(plug, '.hidden.js', ['.js']) === null, 'accepted a hidden file');
  expect(PS.safeChild(plug, 'index.js', ['.css']) === null, 'accepted the wrong kind of file');
  if (canLink) expect(PS.safeChild(plug, 'link.js', ['.js']) === null, 'followed a link out of the folder');
});

step('manifests are checked, and names and theme keys limited', () => {
  expect(PS.checkManifest({ name: '' }) === null, 'accepted no name');
  expect(PS.checkManifest(null) === null && PS.checkManifest([1]) === null, 'accepted a non-object');
  for (const key of ['Bad', 'a"]{}', 'x y', '-lead', 'a'.repeat(40), '<img>'])
    expect(PS.checkManifest({ name: 'T', type: 'theme', css: 'a.css', themeKey: key }) === null, 'accepted theme key ' + key);
  const m = PS.checkManifest({ name: 'n'.repeat(500), description: 'd'.repeat(5000), type: 'theme', css: 'a.css', themeKey: 'ok-1', icon: '🎨🎨🎨🎨' });
  expect(m && m.name.length === 60 && m.description.length === 240, 'name or description not limited');
  expect([...m.icon].length <= 2, 'icon not limited');
  expect(PS.checkManifest({ name: 'x\u0000y' }).name === 'x y', 'control characters kept');
});

step('a script plugin is fingerprinted, and any change is noticed', () => {
  const a = PS.folderDigest(plug);
  expect(a && a === PS.folderDigest(plug), 'the fingerprint is not stable');
  fs.writeFileSync(path.join(plug, 'index.js'), 'export function activate(){ /* changed */ }');
  expect(PS.folderDigest(plug) !== a, 'a changed file went unnoticed');
  fs.writeFileSync(path.join(plug, 'extra.js'), '1');
  const b = PS.folderDigest(plug);
  fs.unlinkSync(path.join(plug, 'extra.js'));
  expect(b !== PS.folderDigest(plug), 'an added file went unnoticed');
  const big = path.join(T, 'big'); fs.mkdirSync(big);
  for (let i = 0; i <= PS.LIMITS.folderFiles; i++) fs.writeFileSync(path.join(big, `f${i}.js`), '1');
  expect(PS.folderDigest(big) === null, 'a folder over the file limit was vouched for');
});

step('theme CSS cannot load anything', () => {
  const css = `@import url("https://evil.example/x.css");
    :root[data-theme="t"]{ --bg:#000; background:url(https://evil.example/track.png); cursor:url( 'http://x/y.cur' ), auto; }
    .a{ background-image:url(data:image/png;base64,AAAA); }
    .b{ background:image-set("https://e/1.png" 1x); }
    /* url(https://hidden.example) */ .c{ behavior: url(x.htc); }`;
  const out = PS.cleanCss(css);
  expect(!/https?:\/\//i.test(out), 'a remote address survived: ' + out.match(/https?:\/\/[^\s)'"]*/i));
  expect(!/@import/i.test(out.replace('/* @import removed */', '')), '@import survived');
  expect(out.includes('url(data:image/png;base64,AAAA)'), 'a data: URL was removed');
  expect(out.includes('--bg:#000'), 'ordinary CSS was damaged');
});

step('only web pages and email can be opened from the app', () => {
  for (const good of ['https://github.com/BritMat/bm-player', 'http://example.com', 'mailto:reach.bristo@gmail.com'])
    expect(PS.safeExternalUrl(good), 'refused ' + good);
  for (const bad of ['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'ms-settings:privacy', 'smb://host/share', 'vbscript:x', 'C:\\x.exe', 'https://', '', 42, 'x'.repeat(3000)])
    expect(PS.safeExternalUrl(bad) === null, 'accepted ' + String(bad).slice(0, 40));
});

fs.rmSync(T, { recursive: true, force: true });
console.log(`\n${pass}/${pass + fail} checks passed.\n`);
process.exit(fail ? 1 : 0);
