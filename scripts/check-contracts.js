#!/usr/bin/env node
'use strict';
/**
 * BM Player — contract checker
 *
 * Parsing is not correctness. Every bug that has cost real debugging time in
 * this codebase was a broken *contract* between two files that each parsed
 * perfectly on their own:
 *
 *   - app.js called el('ctx-panel'); the markup said id="ctx-menu".
 *     Right-click silently did nothing for months.
 *   - _populateCtxTracks() filled #ctx-audio-tracks, which did not exist.
 *   - Two elements shared id="lite-badge", so el() only ever saw the first.
 *   - Menu rows carried data-a="screenshot" with no handler reading data-a.
 *   - The renderer invoked IPC channels with no ipcMain.handle() behind them.
 *
 * None of those are syntax errors. This file checks the seams instead.
 * Exit code 1 on any ERROR; warnings are informational.
 */

const fs   = require('fs');
// Every file this script reads, with Windows line endings made plain. On
// GitHub's Windows runner Git checks files out with CRLF, and a . in a regex
// does not match \r: the packaging check read only the first line of each
// files list and reported everything after main.js as missing.
{ const read = fs.readFileSync.bind(fs);
  fs.readFileSync = (p, ...a) => { const r = read(p, ...a); return typeof r === 'string' ? r.replace(/\r\n?/g, '\n') : r; }; }
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const errors = [];
const warns  = [];
const err  = (cat, msg) => errors.push({ cat, msg });
const warn = (cat, msg) => warns.push({ cat, msg });

/* ── collect sources ───────────────────────────────────────────── */
const html = read('src/index.html');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'vendor' || e.name === 'node_modules') continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, acc);
    else if (e.name.endsWith('.js')) acc.push(rel);
  }
  return acc;
}
const rendererFiles = walk('src/js');
const rendererSrc = rendererFiles.map(f => ({ file: f, text: read(f) }));
const mainSrc    = read('main.js');
const preloadSrc = read('preload.js');

/* Strip comments so commented-out code doesn't register as a real reference.
 *
 * This walks the source tracking string state instead of pattern-matching.
 * The naive regex version ate the third slash of 'file:///x': the slashes
 * there are preceded by another slash rather than a colon, so it looked like
 * the start of a line comment and the rest of the line was discarded. Every
 * check downstream was silently receiving truncated input, which is worse
 * than having no check at all.
 */
function strip(src) {
  let out = '', i = 0;
  const n = src.length;
  let quote = null;      // ' " ` when inside a string
  while (i < n) {
    const c = src[i], next = src[i + 1];
    if (quote) {
      if (c === '\\') { out += c + (next || ''); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      // Keep the comment's newlines. Collapsing it to one space shifted
      // every line number reported after it.
      out += ' ' + src.slice(i, stop).replace(/[^\n]/g, '').replace(/^/, '');
      i = stop; continue;
    }
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      out += ' '; i = end === -1 ? n : end; continue;
    }
    out += c; i++;
  }
  return out;
}

/* ── 0. self-test ───────────────────────────────────────────────
 * The comment stripper feeds every check below it. A silent bug there makes
 * the whole file report clean while missing everything — which is exactly
 * what happened with 'file:///'. Verify it before trusting any result. */
{
  const cases = [
    ["const u = 'file:///x/y.jpg';", "file:///x/y.jpg"],
    ['const u = "https://a.example/b";', 'https://a.example/b'],
    ['const s = `bmfile://local/${p}`;', 'bmfile://local/'],
    ['const re = "a//b";', 'a//b'],
  ];
  for (const [src, mustSurvive] of cases) {
    if (!strip(src).includes(mustSurvive)) {
      err('self-test', `comment stripper destroys ${JSON.stringify(mustSurvive)} — every check below is unreliable`);
    }
  }
  if (strip('x; // gone\ny').includes('gone')) err('self-test', 'stripper is not removing line comments');
  if (strip('a /* gone */ b').includes('gone')) err('self-test', 'stripper is not removing block comments');
  if (strip('a\n/* x\n y\n z */\nb').split('\n').length !== 5) {
    err('self-test', 'stripper changes the line count, so every reported line number is wrong');
  }
}

/* ── 1. duplicate element ids ──────────────────────────────────── */
{
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const seen = new Set(), dupes = new Set();
  for (const id of ids) (seen.has(id) ? dupes : seen).add(id);
  for (const d of dupes) err('duplicate-id', `id="${d}" appears more than once — el() only ever returns the first`);
}

/* ── 2. el('x') references that have no element ────────────────── */
/* Some elements are authored in JS template strings (the SVG fallback fox,
 * for one) rather than in index.html. Those ids are legitimate, so harvest
 * them too before deciding anything is missing. */
const jsAuthoredIds = new Set();
for (const { text } of rendererSrc) {
  for (const m of text.matchAll(/\bid=["']([A-Za-z0-9_-]+)["']/g)) jsAuthoredIds.add(m[1]);
  for (const m of text.matchAll(/\.id\s*=\s*['"]([A-Za-z0-9_-]+)['"]/g)) jsAuthoredIds.add(m[1]);
}
const htmlIds = new Set([
  ...[...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]),
  ...jsAuthoredIds,
]);
{
  // ids created at runtime rather than authored in the markup
  const RUNTIME_IDS = new Set();   // now derived automatically, see jsAuthoredIds
  for (const { file, text } of rendererSrc) {
    const refs = new Set([...strip(text).matchAll(/\bel\(\s*'([^']+)'\s*\)/g)].map(m => m[1]));
    for (const id of refs) {
      if (!htmlIds.has(id) && !RUNTIME_IDS.has(id)) {
        err('missing-element', `${file}: el('${id}') — no element with that id in index.html`);
      }
    }
  }
}

/* ── 3. getElementById / querySelector('#id') outside el() ─────── */
for (const { file, text } of rendererSrc) {
  const s = strip(text);
  for (const m of s.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) {
    if (!htmlIds.has(m[1])) err('missing-element', `${file}: getElementById('${m[1]}') — not in index.html`);
  }
  for (const m of s.matchAll(/querySelector(?:All)?\(\s*'#([A-Za-z0-9_-]+)'\s*\)/g)) {
    if (!htmlIds.has(m[1])) err('missing-element', `${file}: querySelector('#${m[1]}') — not in index.html`);
  }
}

/* ── 4. data-a actions without a handler, and vice versa ───────── */
{
  const declared = new Set([...html.matchAll(/data-a="([^"]+)"/g)].map(m => m[1]));
  const handled  = new Set();
  for (const { text } of rendererSrc) {
    const s = strip(text);
    // keys in an action map: 'name': () => ...   or   'name': async () => ...
    // Action names may contain ':' or '.' — e.g. 'aspect-16:9'.
    for (const m of s.matchAll(/'([a-z0-9.:-]+)'\s*:\s*(?:async\s*)?\(\s*\)\s*=>/g)) handled.add(m[1]);
    for (const m of s.matchAll(/'([a-z0-9.:-]+)'\s*:\s*(?:async\s*)?function/g))        handled.add(m[1]);
  }
  for (const a of declared) {
    if (!handled.has(a)) err('dead-action', `data-a="${a}" is in the markup but no action map handles it`);
  }
}

/* ── 5. IPC channel parity ─────────────────────────────────────── */
{
  const handled = new Set([...mainSrc.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map(m => m[1]));
  const onMain  = new Set([...mainSrc.matchAll(/ipcMain\.on\(\s*'([^']+)'/g)].map(m => m[1]));
  const invoked = new Set([...strip(preloadSrc).matchAll(/inv\(\s*'([^']+)'/g)].map(m => m[1]));
  const sent    = new Set([...strip(preloadSrc).matchAll(/ipcRenderer\.send\(\s*'([^']+)'/g)].map(m => m[1]));

  for (const ch of invoked) {
    if (!handled.has(ch)) err('ipc', `preload invokes '${ch}' — no ipcMain.handle() in main.js`);
  }
  for (const ch of sent) {
    if (!onMain.has(ch)) err('ipc', `preload sends '${ch}' — no ipcMain.on() in main.js`);
  }
  for (const ch of handled) {
    if (!invoked.has(ch)) warn('ipc', `main handles '${ch}' but preload never invokes it (dead channel?)`);
  }
}

/* ── 6. api.* surface used by the renderer vs exposed by preload ─ */
{
  // top-level groups in contextBridge.exposeInMainWorld('api', { ... })
  const groups = new Set([...preloadSrc.matchAll(/^\s{2}([a-zA-Z]+)\s*:\s*\{/gm)].map(m => m[1]));
  const used = new Set();
  for (const { text } of rendererSrc) {
    // Exclude hostnames: 'https://api.opensubtitles.org' is not an api.* call.
    // Require the reference to be preceded by whitespace, '(', '=' or '.'.
    for (const m of strip(text).matchAll(/(^|[\s(=.,?:!&|[{])api\??\.([a-zA-Z]+)\b/gm)) {
      const before = m[1];
      if (before === '.' ) continue;          // e.g. this.api handled separately
      used.add(m[2]);
    }
    for (const m of strip(text).matchAll(/this\.api\??\.([a-zA-Z]+)\b/g)) used.add(m[1]);
  }
  for (const g of used) {
    if (!groups.has(g)) err('api', `renderer uses api.${g} — preload exposes no such group`);
  }
}

/* ── 7. CSS classes set from JS that no stylesheet defines ─────── */
{
  const css = ['src/css/style.css', 'src/css/themes.css', 'src/css/enhance.css', 'src/css/components.css']
    .filter(f => fs.existsSync(path.join(ROOT, f))).map(read).join('\n') + '\n' + html;
  const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const IGNORE = new Set(['hidden', 'active', 'open', 'then', 'catch', 'push', 'map', 'filter']);
  const used = new Set();
  for (const { text } of rendererSrc) {
    const s = strip(text);
    for (const m of s.matchAll(/classList\.(?:add|toggle)\(\s*'([^']+)'/g)) used.add(m[1]);
    for (const m of s.matchAll(/className\s*=\s*'([^']+)'/g)) m[1].split(/\s+/).forEach(c => c && used.add(c));
  }
  for (const c of used) {
    if (!defined.has(c) && !IGNORE.has(c)) warn('css', `class '${c}' is applied from JS but no stylesheet defines it`);
  }
}

/* ── 8. script/link targets that don't exist on disk ───────────── */
for (const m of html.matchAll(/(?:src|href)="((?!https?:|data:)[^"]+)"/g)) {
  const target = path.join(ROOT, 'src', m[1]);
  if (!fs.existsSync(target)) err('missing-file', `index.html references ${m[1]} — not on disk`);
}

/* ── 9. ES module import hygiene ────────────────────────────────
 * New failure mode since app.js was split: a class moves into its own file
 * and quietly loses access to a helper that used to be module-scope beside
 * it. That is a ReferenceError at runtime, on whichever branch happens to
 * call it — possibly not the one you tested. Cheap to catch statically.
 *
 * A name counts as available if it is imported, declared locally (including
 * as a `const` inside any function), or is a global. */
{
  const SHARED = ['el', 'fileURL', 'isRemoteURL', 'fmtSec', 'fmtBytes', 'seedGrad',
                  'cleanTitle', 'escapeHtml', 'escapeAttr', 'basenameOf',
                  'relativeTime', 'pickFolder', 'Visualizer', 'perf'];
  for (const { file, text } of rendererSrc) {
    const imported = new Set();
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
      for (const n of m[1].split(',')) {
        const name = n.trim().split(/\s+as\s+/).pop().trim();
        if (name) imported.add(name);
      }
    }
    for (const m of text.matchAll(/import\s+(\w+)\s+from/g)) imported.add(m[1]);

    const body = strip(text).replace(/^import[^;]*;/gm, '');
    for (const h of SHARED) {
      // Must be a bare reference, not a property: `this.el` is the <audio>
      // element in audio-engine.js, not a call to the el() helper.
      const bareRef = new RegExp('(?<![.\\w$])' + h + '(?![\\w$])');
      if (!bareRef.test(body)) continue;
      if (imported.has(h)) continue;
      // declared in this file? covers `function el(`, `const el =`, `class Visualizer`
      const declared = new RegExp(
        '(?:^|\\s)(?:export\\s+)?(?:async\\s+)?(?:function|class|const|let|var)\\s+' + h + '\\b'
      ).test(text);
      if (declared) continue;
      err('import', `${file}: uses ${h}() but never imports or declares it`);
    }
    // flag imports nothing in the file actually uses
    for (const name of imported) {
      if (!SHARED.includes(name)) continue;
      if (!new RegExp('(?<![.\\w$])' + name + '(?![\\w$])').test(body)) {
        warn('import', `${file}: imports ${name} but never uses it`);
      }
    }
  }
}

/* ── 10. CSP must not re-admit eval ────────────────────────────
 * 'unsafe-eval' was in both CSPs on the claim that Three.js needed it.
 * It doesn't, and nothing here calls eval() or new Function(). This keeps
 * it from drifting back in, and fails if anything starts evaluating
 * strings as code. */
{
  const evalUsers = [];
  for (const { file, text } of rendererSrc) {
    const s = strip(text);
    if (/\beval\s*\(/.test(s) || /\bnew\s+Function\s*\(/.test(s)) evalUsers.push(file);
  }
  const cspSources = [html, mainSrc];
  const admitsEval = cspSources.some(t => /unsafe-eval/.test(strip(t)));
  if (evalUsers.length) {
    warn('csp', `eval()/new Function() used in: ${evalUsers.join(', ')} — CSP will block it`);
  } else if (admitsEval) {
    err('csp', `CSP still allows 'unsafe-eval' but nothing in the app evaluates strings — remove it`);
  }
}

/* ── 11. EQ band alignment ─────────────────────────────────────
 * app.js builds the slider UI from EQ_BANDS; audio-engine.js addresses its
 * BiquadFilter chain by the same index via EQ_FREQUENCIES. If the two lists
 * drift, every slider silently controls the wrong frequency — audible, but
 * very hard to attribute. */
{
  const appSrc = rendererSrc.find(f => f.file.endsWith('app.js'));
  const engSrc = rendererSrc.find(f => f.file.endsWith('audio-engine.js'));
  if (appSrc && engSrc) {
    // EQ_BANDS is built by mapping over a flat array literal, so there is no
    // `freq: 31` in the source to match — read the literal that feeds it.
    const bandsM = appSrc.text.match(/EQ_BANDS\s*=\s*\[([^\]]+)\]/);
    const bands = bandsM ? bandsM[1].split(',').map(n => +n.trim()).filter(n => !isNaN(n)) : [];
    const freqM = engSrc.text.match(/EQ_FREQUENCIES\s*=\s*\[([^\]]+)\]/);
    const freqs = freqM ? freqM[1].split(',').map(n => +n.trim()).filter(n => !isNaN(n)) : [];
    if (!bands.length || !freqs.length) {
      err('eq', 'could not read the EQ band lists — this check is not actually verifying anything');
    } else {
      if (bands.length !== freqs.length) {
        err('eq', `EQ_BANDS has ${bands.length} bands, EQ_FREQUENCIES has ${freqs.length}`);
      } else if (bands.join(',') !== freqs.join(',')) {
        err('eq', `EQ band frequencies disagree:\n        app.js:          ${bands.join(', ')}\n        audio-engine.js: ${freqs.join(', ')}`);
      }
    }
  }
}

/* ── 12. Unescaped interpolation into generated HTML ───────────
 * Fourth time this bug class has appeared: gallery card names, music track
 * titles, the file extension in the history panel, and plugin manifest
 * fields were each interpolated straight into an HTML string. Anything
 * derived from a path or a plugin's JSON is user-controlled — a file really
 * can be named `movie.<img src=x onerror=alert(1)>`.
 *
 * Signal is "a template literal that builds HTML", not "a template literal
 * directly assigned to innerHTML": the first version of this check missed
 * the plugin list because its template sits inside a .map() callback.
 */
{
  const SAFE = /^(escapeHtml|escapeAttr|safeColor|seedGrad|fmtSec|fmtBytes|relativeTime|fileURL|Number|String\(|JSON\.|\d)/;
  const SUSPECT = /\b(name|title|path|note|ext|artist|album|label|file|dir|query|folder|desc|author|version)\b/i;
  for (const { file, text } of rendererSrc) {
    const s = strip(text);
    // Locals already run through an escaper: `const ext = escapeHtml(...)`.
    // A purely textual check would otherwise flag `${ext}` as unescaped and
    // a checker with false positives gets ignored.
    const preEscaped = new Set(
      [...s.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*escape(?:Html|Attr)\s*\(/g)].map(x => x[1])
    );
    // Every template literal in the file, then keep the ones producing markup.
    for (const m of s.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
      const body = m[1];
      if (!/<[a-zA-Z][\w-]*[\s>]/.test(body)) continue;      // not HTML
      for (const e of body.matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
        const expr = e[1].trim();
        if (SAFE.test(expr)) continue;
        // A ternary whose live branches are escaped, e.g.
        // `${x ? escapeHtml(x) : '- none -'}`.
        if (/escape(Html|Attr)\s*\(/.test(expr)) continue;
        if (preEscaped.has(expr)) continue;
        if (!SUSPECT.test(expr)) continue;
        if (/^[^?]*\?\s*'[^']*'\s*:\s*'[^']*'$/.test(expr)) continue;   // literal ternary
        warn('escaping', `${file}: \${${expr.slice(0, 50)}} goes into generated HTML unescaped`);
      }
    }
  }
}

/* ── 13. Local file access must go through bmfile:// ───────────
 * webSecurity was disabled for both windows so the renderer could load local
 * files directly, which turns off the same-origin model everywhere. The
 * custom scheme replaces it. Two things would quietly undo that: turning
 * webSecurity back off, or building a raw file:// URL in the renderer, which
 * the CSP now blocks — so it would fail at runtime, not here. */
{
  if (/webSecurity\s*:\s*false/.test(strip(mainSrc))) {
    err('security', "main.js sets webSecurity:false — bmfile:// exists so this can stay on");
  }
  for (const { file, text } of rendererSrc) {
    if (file.endsWith('util.js')) continue;          // defines rawFileURL deliberately
    const s = strip(text);
    for (const m of s.matchAll(/(['"`])file:\/\/[^'"`]*/g)) {
      err('security', `${file}: builds a raw ${m[0].slice(1, 24)}… URL — the CSP only allows bmfile:`);
    }
  }
  // Every directive that carries local media has to list the scheme.
  // Checking the policy as one blob passes when only default-src has it,
  // and default-src does not back-fill a directive that is present.
  for (const [what, t] of [['index.html', html], ['main.js', mainSrc]]) {
    for (const csp of t.match(/Content-Security-Policy[^\n]*/g) || []) {
      for (const directive of ['img-src', 'media-src', 'connect-src']) {
        // Terminate on ';' only. A character class excluding quotes stops
        // dead at "'self'", which every directive starts with.
        const m = csp.match(new RegExp(directive + '([^;]*)'));
        if (!m) continue;                       // absent: falls back to default-src
        if (!m[1].includes('bmfile:')) {
          err('security', `${what}: CSP ${directive} does not allow bmfile: — local media will not load`);
        }
      }
    }
  }
}

/* ── 14. npm scripts must run on Windows ───────────────────────
 * `BM_LITE=1 electron .` is POSIX shell syntax. Windows cmd reads BM_LITE=1
 * as the name of a program and fails. start:lite shipped like that, and the
 * same mistake nearly went into test:main while adding compat mode. Use a
 * CLI flag the script reads itself, or cross-env. */
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
    // An assignment as the first word of any command in the chain.
    for (const part of String(cmd).split(/&&|\|\||;/)) {
      const first = part.trim().split(/\s+/)[0] || '';
      if (/^[A-Z_][A-Z0-9_]*=/.test(first)) {
        err('portability', `npm script "${name}" starts with "${first}", which fails in Windows cmd`);
      }
    }
  }
}

/* ── 15. Theme contrast (WCAG AA) ──────────────────────────────
 * Measured rather than eyeballed. When this was first run, white labels on
 * accent-filled buttons failed in 12 of the 13 themes (Cyberpunk was 1.25:1,
 * white on cyan) and Light's secondary text failed everywhere. Every theme
 * is checked for body text, secondary text on both background and surface,
 * and the button label against BOTH ends of the accent gradient. */
{
  const css = ['src/css/style.css', 'src/css/themes.css']
    .filter(f => fs.existsSync(path.join(ROOT, f))).map(read).join('\n');
  const parse = v => {
    v = String(v || '').trim();
    let m = v.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      let h = m[1]; if (h.length === 3) h = [...h].map(c => c + c).join('');
      return { rgb: [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)), a: 1 };
    }
    m = v.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const p = m[1].split(',').map(x => parseFloat(x));
      return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
    }
    return null;
  };
  const over = (c, bg) => c.a >= 1 ? c.rgb : c.rgb.map((x, i) => Math.round(x * c.a + bg[i] * (1 - c.a)));
  const lum = rgb => {
    const [r, g, b] = rgb.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  const themes = {};
  for (const m of css.matchAll(/:root\[data-theme="([a-z]+)"\]\s*\{([^}]*)\}/g)) {
    const t = themes[m[1]] = themes[m[1]] || {};
    for (const d of m[2].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) t[d[1]] = d[2].trim();
  }
  // Every theme the picker offers must have a token block here, so themes can
  // be added or removed without this check going quietly out of date.
  const pills = new Set([...fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8').matchAll(/class="tp"[^>]*data-theme="([a-z-]+)"/g)].map(m => m[1]));
  const missing = [...pills].filter(p => !themes[p]);
  if (!pills.size) err('contrast', 'found no theme pills in index.html: this check is not seeing them');
  if (missing.length) err('contrast', `themes in the picker with no token block: ${missing.join(', ')}`);
  for (const [name, t] of Object.entries(themes)) {
    const bgc = parse(t.bg); if (!bgc) continue;
    const bg = over(bgc, [0, 0, 0]);                     // glass: assume a dark desktop
    const sf = over(parse(t.surface) || bgc, bg);
    const need = [
      ['body text on background',        parse(t.text),                bg],
      ['secondary text on background',   parse(t['text-muted']),       bg],
      ['secondary text on surface',      parse(t['text-muted']),       sf],
      ['button label on accent',         parse(t['on-accent'] || '#0B0D14'), parse(t.accent)?.rgb],
      ['button label on accent2',        parse(t['on-accent'] || '#0B0D14'), parse(t.accent2 || t.accent)?.rgb],
    ];
    for (const [what, fg, against] of need) {
      if (!fg || !against) continue;
      const r = ratio(over(fg, against), against);
      if (r < 4.5) err('contrast', `${name}: ${what} is ${r.toFixed(2)}:1, needs 4.5:1`);
    }
  }
  // A white label hard-coded onto an accent fill bypasses all of the above.
  for (const f of ['src/css/style.css', 'src/css/themes.css', 'src/css/enhance.css', 'src/css/components.css']) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    for (const m of read(f).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decl = m[2];
      if (!/background(?:-color)?\s*:\s*(?:var\(--accent\)|linear-gradient\([^;]*var\(--accent\))/i.test(decl)) continue;
      if (/(?<![-\w])color\s*:\s*(?:#fff(?:fff)?|white)\b/i.test(decl)) {
        err('contrast', `${f}: "${m[1].trim().split('\n').pop().slice(0, 50)}" puts a white label on an accent fill — use var(--on-accent)`);
      }
    }
  }
}

/* ── 16. Panel wiring and markup-side classes ──────────────────
 * The Diagnostics panel shipped with a close button that did nothing and an
 * unstyled header: wirePanels() reads data-panel and I had written
 * data-close, and every other panel uses .panel-hdr where I had written
 * .panel-head. Check 7 only looks at classes applied from JavaScript, so
 * classes written straight into the markup were never checked at all. */
{
  for (const m of html.matchAll(/<button[^>]*class="[^"]*\bpanel-close\b[^"]*"[^>]*>/g)) {
    const tag = m[0];
    const p = (tag.match(/data-panel="([^"]+)"/) || [])[1];
    if (!p) { err('panel', `${tag.slice(0, 70)} has no data-panel, so wirePanels() cannot close anything`); continue; }
    if (!htmlIds.has('panel-' + p)) err('panel', `panel-close data-panel="${p}" but there is no #panel-${p}`);
  }
  // Every side panel needs a header the stylesheet actually styles.
  for (const m of html.matchAll(/<div class="side-panel" id="([^"]+)">([\s\S]*?)<div class="panel-body/g)) {
    if (!/class="panel-hdr"/.test(m[2])) err('panel', `#${m[1]} has no .panel-hdr header, so it renders unstyled`);
  }
  // Classes written in markup that no stylesheet mentions. Warn only: some
  // are deliberate hooks for JavaScript rather than styling.
  const cssText = ['src/css/style.css', 'src/css/themes.css', 'src/css/enhance.css', 'src/css/components.css']
    .filter(f => fs.existsSync(path.join(ROOT, f))).map(read).join('\n')
    + (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const styled = new Set([...cssText.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(x => x[1]));
  // A class only counts as a JavaScript hook if JavaScript uses it AS A
  // CLASS. The first version exempted any class whose name appeared in a
  // script at all, so `resume-prompt` and `theme-customizer` slipped through
  // because el('resume-prompt') looks up an element id of the same name.
  const jsHooks = new Set();
  for (const { text } of rendererSrc) {
    const t = strip(text);
    for (const m of t.matchAll(/(?:querySelector(?:All)?|closest|matches)\(\s*['"`]([^'"`]+)['"`]/g)) {
      for (const c of m[1].matchAll(/\.([a-zA-Z][\w-]*)/g)) jsHooks.add(c[1]);
    }
    for (const m of t.matchAll(/classList\.(?:contains|remove|toggle|add)\(\s*['"]([^'"]+)['"]/g)) jsHooks.add(m[1]);
    for (const m of t.matchAll(/getElementsByClassName\(\s*['"]([^'"]+)['"]/g)) jsHooks.add(m[1]);
  }
  // Classes in markup, plus classes inside HTML built by template strings in
  // JavaScript, which is where the bookmark and history rows come from.
  const used = new Map();
  const collect = (src, where) => {
    for (const m of src.matchAll(/class="([^"$'+]+)"/g)) {
      m[1].split(/\s+/).forEach(c => { if (c && !used.has(c)) used.set(c, where); });
    }
  };
  collect(html, 'index.html');
  for (const { file, text } of rendererSrc) collect(text, file);
  const BENIGN = new Set(['hidden', 'active', 'open', 'show', 'empty', 'playing']);
  for (const [c, where] of used) {
    if (styled.has(c) || jsHooks.has(c) || BENIGN.has(c)) continue;
    warn('css', `class "${c}" (${where}) is styled by nothing`);
  }
}

/* ── 17. Every button has a spoken name ────────────────────────
 * 23 icon-only buttons (‹ › ✕ ⊡) had no name at all, so a screen reader
 * announced each as just "button", and 75 more relied on title=, which is
 * not announced reliably. Entities are decoded first: the first version of
 * this audit read the digits in '&#10005;' as a word and concluded ten
 * cross buttons were already named. */
{
  const decode = t => String(t || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&(amp|lt|gt|quot|nbsp);/g, ' ');
  const spoken = t => /[A-Za-z]{2,}/.test(decode(t).replace(/<[^>]+>/g, ''));
  const scan = (src, where) => {
    for (const m of src.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const attrs = m[1], inner = m[2];
      if (/\$\{/.test(inner) && !/[<>]/.test(inner.replace(/\$\{[^}]*\}/g, ''))) continue; // label is dynamic
      const aria = (attrs.match(/aria-label="([^"]*)"/) || [])[1];
      if (spoken(aria) || spoken(inner)) continue;
      const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
      const cls = (attrs.match(/\bclass="([^"]+)"/) || [])[1];
      err('a11y', `${where}: <button ${id ? '#' + id : '.' + (cls || '?').split(' ')[0]}> has no spoken name — add aria-label`);
    }
  };
  scan(html, 'index.html');
  for (const { file, text } of rendererSrc) scan(text, file);
}

/* ── 18. Overlays must not put controls under the titlebar ─────
 * The lightbox covered the whole window at a z-index below the titlebar,
 * and its close button sat half under the window's own close button, which
 * is drawn on top. Aiming slightly high at the image viewer's ✕ closed the
 * app. Any fixed overlay that is (a) stacked below the titlebar, (b) starts
 * at the top edge and (c) contains buttons has the same problem. */
{
  const order = ['src/css/style.css', null, 'src/css/themes.css', 'src/css/enhance.css', 'src/css/components.css'];
  const inline = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const rules = [];
  for (const f of order) {
    const t = f === null ? inline : (fs.existsSync(path.join(ROOT, f)) ? read(f) : '');
    for (const m of strip(t).matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push([m[1], m[2]]);
  }
  // Last declaration wins unless an earlier one was !important.
  const resolve = (sel, prop) => {
    let val = null, imp = false;
    for (const [sels, decl] of rules) {
      if (!sels.split(',').map(x => x.trim()).includes(sel)) continue;
      for (const d of decl.matchAll(new RegExp('(?<![\\w-])' + prop + '\\s*:\\s*([^;]+)', 'g'))) {
        const v = d[1].trim(), vi = /!important/.test(v);
        if (imp && !vi) continue;
        val = v.replace(/!important/, '').trim(); imp = vi;
      }
    }
    return val;
  };
  const titlebarZ = parseInt(resolve('.titlebar', 'z-index') || '0', 10);
  const seen = new Set();
  for (const [sels] of rules) {
    for (const raw of sels.split(',')) {
      const sel = raw.trim();
      if (!/^\.[\w-]+$/.test(sel) || seen.has(sel)) continue;
      seen.add(sel);
      if (resolve(sel, 'position') !== 'fixed') continue;
      const z = parseInt(resolve(sel, 'z-index') || '0', 10);
      if (!(z < titlebarZ)) continue;
      const top = resolve(sel, 'top'), inset = resolve(sel, 'inset');
      const atTop = top === '0' || top === '0px' || (top === null && (inset === '0' || inset === '0px'));
      if (!atTop) continue;
      // Does the element carry buttons? Walk its markup.
      const cls = sel.slice(1);
      const at = html.search(new RegExp('<div[^>]*class="[^"]*\\b' + cls + '\\b'));
      if (at < 0) continue;
      let depth = 0, end = at;
      for (const m of html.slice(at).matchAll(/<(\/?)div\b[^>]*>/g)) {
        depth += m[1] ? -1 : 1;
        if (depth === 0) { end = at + m.index + m[0].length; break; }
      }
      if (/<button\b/.test(html.slice(at, end))) {
        err('layout', `${sel} is fixed from the top edge under the titlebar (z ${z} < ${titlebarZ}) and has buttons — the titlebar will swallow clicks near the top`);
      }
    }
  }
}

/* ── 19. Playback commands go through the routing layer ────────
 * Two players can own playback: mpv, and the in-app audio engine, which
 * plays most music. A control that sends a command straight to mpv does
 * nothing while the engine is playing. This has been found three times:
 * play/pause and volume in v3.1.0, then the seek bars, mute, jump-to-time,
 * bookmarks, the arrow/number/M/P/N keys, the Now Playing stop and volume,
 * and the switch to TV, about twenty controls in all.
 *
 * Playback commands may only be sent from the functions that decide which
 * player gets them. The local `cmd` shorthand counts as a direct send. */
{
  const ROUTERS = new Set([
    'togglePlay', 'seekTo', 'seekBy', 'setVolume', 'toggleMute', 'trackStep',
    'stop', '_stopAllAudio', 'toggle', 'play',
  ]);
  const TRANSPORT = /\bcmd\(\s*(?:'seek'|'stop'|'playlist-(?:prev|next)'|'cycle'\s*,\s*'(?:pause|mute)'|'set_property'\s*,\s*'(?:time-pos|volume|mute|pause)')/;
  const ALSO = /\bcmd\(\s*dir\s*>\s*0\s*\?\s*'playlist-next'/;          // trackStep's ternary
  for (const { file, text } of rendererSrc) {
    if (!/app\.js$|music\.js$/.test(file)) continue;
    const lines = strip(text).split('\n');
    let fn = '?';
    lines.forEach((line, i) => {
      const def = line.match(/^\s{0,2}(?:async\s+)?([_a-zA-Z$][\w$]*)\s*\([^)]*\)\s*\{/);
      if (def && !/^(if|for|while|switch|catch|function)$/.test(def[1])) fn = def[1];
      if (!(TRANSPORT.test(line) || ALSO.test(line))) return;
      if (ROUTERS.has(fn)) return;
      const what = (line.match(TRANSPORT) || line.match(ALSO))[0].replace(/\s+/g, '');
      err('routing', `${file}:${i + 1} in ${fn}() sends ${what} straight to mpv; use seekTo/seekBy/toggleMute/trackStep/setVolume/stop so the in-app engine gets it too`);
    });
  }
}

/* ── 20. switchDest() only receives real destinations ─────────
 * The gallery's destination is 'images'. Five tests called
 * switchDest('gallery'), which matched no branch after every view had been
 * hidden, so they exercised a blank screen and asserted the invented name
 * back to themselves. Only running the real app showed it. */
{
  const dests = new Set([...html.matchAll(/data-dest="([a-z]+)"/g)].map(m => m[1]));
  const scan = (text, where) => {
    for (const m of strip(text).matchAll(/switchDest\(\s*'([^']+)'\s*\)/g)) {
      if (m[1].includes('${')) continue;      // a placeholder inside a message, not a call
      if (!dests.has(m[1])) err('dest', `${where}: switchDest('${m[1]}') — not a destination; valid: ${[...dests].join(', ')}`);
    }
  };
  for (const { file, text } of rendererSrc) scan(text, file);
  for (const f of ['scripts/smoke-renderer.mjs', 'scripts/e2e.mjs']) {
    if (fs.existsSync(path.join(ROOT, f))) scan(read(f), f);
  }
}

/* ── 21. Our Node minimum covers what Electron needs ───────────
 * package.json said node >=20 while electron@44 declares >=22.12.0. npm only
 * warns about that by default, so on Windows with Node 20.12 it installed,
 * then Electron's download failed with ERR_REQUIRE_ESM and nothing ran.
 * Checked against the installed packages' own engines fields. */
{
  // Accepts partial versions: '>=20' is 20.0.0.
  const minOf = r => { const m = String(r || '').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/); return m ? [m[1], m[2] || 0, m[3] || 0].map(Number) : null; };
  const lt = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const pkg = JSON.parse(read('package.json'));
  const ours = minOf(pkg.engines && pkg.engines.node);
  if (!ours) err('engines', 'package.json has no engines.node minimum');
  for (const dep of ['electron', '@electron/get', 'playwright-core', 'jsdom']) {
    const pj = path.join(ROOT, 'node_modules', dep, 'package.json');
    if (!fs.existsSync(pj)) continue;
    const need = minOf((JSON.parse(fs.readFileSync(pj, 'utf8')).engines || {}).node);
    if (ours && need && lt(ours, need) < 0) {
      err('engines', `package.json allows Node ${ours.join('.')} but ${dep} needs ${need.join('.')} or newer`);
    }
  }
  const npmrc = fs.existsSync(path.join(ROOT, '.npmrc')) ? read('.npmrc') : '';
  if (!/^\s*engine-strict\s*=\s*true/m.test(npmrc)) {
    err('engines', '.npmrc must set engine-strict=true, or npm installs on an unsupported Node and fails later');
  }
}

/* ── 22. On Windows, mpv means mpv.exe ─────────────────────────
 * PATHEXT puts .COM first, so a PATH search for "mpv" finds mpv.com, a
 * console launcher that starts mpv.exe as a child. Kill the launcher and the
 * real player keeps running, holding its pipe. Found on a real Windows run. */
{
  const main = strip(mainSrc);
  const g = main.slice(main.indexOf('function getMpv'), main.indexOf('function getMpv') + 2500);
  if (/PATHEXT/.test(g)) err('mpv', "getMpv() follows PATHEXT on Windows, which finds mpv.com before mpv.exe");
  if (!/IS_WIN\s*\?\s*\[\s*'\.exe'\s*\]/.test(g)) err('mpv', "getMpv() must search PATH for mpv.exe only on Windows");
  const it = fs.existsSync(path.join(ROOT, 'scripts/integration-mpv.cjs')) ? read('scripts/integration-mpv.cjs') : '';
  if (it && !/spawn\(\s*IS_WIN\(\)\s*\?\s*'mpv\.exe'/.test(it)) err('mpv', "integration-mpv.cjs must spawn mpv.exe on Windows, not the mpv.com launcher");
}

/* ── report ────────────────────────────────────────────────────── */
const group = list => {
  const by = {};
  for (const { cat, msg } of list) (by[cat] = by[cat] || []).push(msg);
  return by;
};

/* The files list of an electron-builder config. Takes Windows line endings
   too: on GitHub's Windows runner a . stopped at every \r and only the first
   entry was read. .gitattributes now checks files out with Unix endings, so
   this self-test keeps the parser honest on its own. */
function filesList(text) {
  const t = String(text).replace(/\r\n?/g, '\n');
  const block = (t.match(/^files:\s*\n((?:[ \t]+(?:-|#).*\n?)+)/m) || [])[1] || '';
  return [...block.matchAll(/-\s+["']?([^"'\n]+?)["']?\s*$/gm)].map(m => m[1]).filter(g => !g.startsWith('!'));
}
{
  const sample = 'files:\r\n  - "main.js"\r\n  # a comment\r\n  - "switches.js"\r\n  - "src/**/*"\r\n  - "!dist"\r\nnext: 1\r\n';
  const got = filesList(sample).join(',');
  if (got !== 'main.js,switches.js,src/**/*') err('packaging', `the files-list parser misreads Windows line endings: got ${got}`);
}

/* ── Packaging: what an installer contains ──────────────────────────
   electron-builder packages only the files its config lists. main.js loads
   ./switches at startup, and from v3.19 to v3.22 the list did not include
   it (nor plugin-safety.js or plugin-templates): an installer built then
   would have crashed on launch, and every test ran from the folder, never
   the package. Every local module main.js loads, directly or through one it
   loads, must be listed, and so must the folders it reads at runtime. */
{
  const globRe = g => new RegExp('^' + g.split('**/*').map(x => x.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('.*') + '$');
  const loaded = new Set(), queue = ['main.js'];
  while (queue.length) {
    const f = queue.shift(); if (loaded.has(f)) continue; loaded.add(f);
    for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      let r = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
      if (!/\.[cm]?js$/.test(r) && fs.existsSync(path.join(ROOT, r + '.js'))) r += '.js';
      if (fs.existsSync(path.join(ROOT, r)) && fs.statSync(path.join(ROOT, r)).isFile()) queue.push(r);
    }
  }
  // Folders main.js reads from its own directory. vendor reaches the app as
  // an extraResource (mpv), not from inside the package.
  const firstFile = dir => { const e = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const x of e) { if (x.isFile()) return `${dir}/${x.name}`; if (x.isDirectory()) { const r = firstFile(`${dir}/${x.name}`); if (r) return r; } } return null; };
  const runtimeDirs = [...new Set([...fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8').matchAll(/path\.join\(\s*__dirname\s*,\s*'([a-z][\w-]*)'/g)].map(m => m[1]))]
    // buildResources is only read for lite.flag, checked on its own below.
    .filter(d => !['vendor', 'buildResources'].includes(d) && fs.existsSync(path.join(ROOT, d)) && fs.statSync(path.join(ROOT, d)).isDirectory());
  for (const cfg of ['electron-builder.yml', 'electron-builder.lite.yml']) {
    const p = path.join(ROOT, cfg); if (!fs.existsSync(p)) continue;
    // The list may contain comment lines; YAML allows them, and one ended the
    // list early on the first try, hiding every entry below it.
    const globs = filesList(fs.readFileSync(p, 'utf8'));
    if (!globs.length) { err('packaging', `${cfg}: could not read its files list`); continue; }
    const covered = rel => globs.some(g => globRe(g).test(rel));
    for (const f of loaded) if (!covered(f)) err('packaging', `${cfg} does not package ${f}, which main.js loads: an installed app would crash on launch`);
    const lite = /lite/.test(cfg);
    // Lite leaves plugins out on purpose: it does not load them.
    for (const d of runtimeDirs) { if (lite && d === 'plugins') continue; const f = firstFile(d); if (f && !covered(f)) err('packaging', `${cfg} does not package ${d}/, which main.js reads at runtime`); }
    // lite.flag is how a packaged build knows it is Lite: in the Lite build,
    // and never in the normal one, which would then run as Lite.
    // electron-builder never packs buildResources into the app, so lite.flag
    // reaches the Lite build as an extraResource (resources/lite.flag), where
    // main.js looks. Only the Lite config may carry it.
    const cfgText = fs.readFileSync(p, 'utf8');
    const flagCopied = /-\s*from:\s*["']?buildResources\/lite\.flag["']?\s*\n\s*to:\s*["']?lite\.flag["']?/.test(cfgText);
    if (lite && !flagCopied) err('packaging', `${cfg} does not copy buildResources/lite.flag to resources/lite.flag: the Lite build would run as the full version`);
    if (!lite && flagCopied) err('packaging', `${cfg} copies lite.flag into resources: the normal build would run as Lite`);
  }
}

/* ── Icons for the Windows installer ────────────────────────────────
   electron-builder.yml asked for buildResources/icon.ico for the app, the
   installer, the uninstaller and the header, and only icon.png existed: the
   first installer build on GitHub stopped there. Every icon path must exist,
   and wherever Windows reads it (the app icon, the NSIS installer, file-type
   icons) it must be an .ico. */
// icon.png and icon.ico are generated by scripts/generate-icon.js and kept out
// of Git (.gitignore), so on GitHub they exist only after `npm run gen-icon`,
// which the build and release jobs run first. They count as present when the
// script writes them; anything else must be a real file.
const iconScript = fs.readFileSync(path.join(ROOT, 'scripts', 'generate-icon.js'), 'utf8');
const generatedIcons = new Set([...iconScript.matchAll(/path\.join\(\s*OUTDIR\s*,\s*'([^']+)'\s*\)/g)].map(m => 'buildResources/' + m[1]));
for (const cfg of ['electron-builder.yml', 'electron-builder.lite.yml']) {
  const p = path.join(ROOT, cfg); if (!fs.existsSync(p)) continue;
  let section = null;
  fs.readFileSync(p, 'utf8').split('\n').forEach((l, n) => {
    const top = l.match(/^([A-Za-z]\w*):/); if (top) section = top[1];
    const m = l.match(/^\s+(icon|installerIcon|uninstallerIcon|installerHeaderIcon):\s*["']?([^"'\s#]+)["']?/);
    if (!m) return;
    const [, key, file] = m;
    if (!generatedIcons.has(file) && !fs.existsSync(path.join(ROOT, file))) err('packaging', `${cfg} line ${n + 1}: ${key} ${file} does not exist, and generate-icon.js does not make it`);
    if (['win', 'nsis', 'fileAssociations'].includes(section) && !/\.ico$/i.test(file))
      err('packaging', `${cfg} line ${n + 1}: ${section} ${key} must be an .ico for Windows, not ${file}`);
  });
}

/* ── Bundled fonts (v3.24.0) ─────────────────────────────────────────
   Every font file fonts.css names must exist, and each font family ships
   with its license text: the SIL Open Font License requires it. */
{
  const dir = path.join(ROOT, 'src', 'fonts'), css = path.join(ROOT, 'src', 'css', 'fonts.css');
  if (fs.existsSync(css)) {
    for (const m of fs.readFileSync(css, 'utf8').matchAll(/url\('\.\.\/fonts\/([^']+)'\)/g))
      if (!fs.existsSync(path.join(dir, m[1]))) err('fonts', `fonts.css names ${m[1]}, which is not in src/fonts`);
    for (const fam of new Set([...fs.readFileSync(css, 'utf8').matchAll(/font-family:\s*'([^']+)'/g)].map(m => m[1])))
      if (!fs.existsSync(path.join(dir, `OFL-${fam}.txt`))) err('fonts', `the ${fam} font has no license file (src/fonts/OFL-${fam}.txt)`);
  }
}

/* ── CI uses a Node the app accepts ─────────────────────────────────
   The workflow still set up Node 20 after package.json moved to 22.12, so
   on GitHub every job stopped at npm ci with EBADENGINE, on all three
   systems, before a single test ran. */
{
  const need = ((JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).engines || {}).node || '').match(/(\d+)\.(\d+)\.(\d+)/);
  const wfDir = path.join(ROOT, '.github', 'workflows');
  if (need && fs.existsSync(wfDir)) for (const wf of fs.readdirSync(wfDir).filter(f => /\.ya?ml$/.test(f))) {
    for (const m of fs.readFileSync(path.join(wfDir, wf), 'utf8').matchAll(/node-version:\s*['"]?(\d+)(?:\.(\d+))?/g)) {
      const major = +m[1], minor = m[2] === undefined ? Infinity : +m[2];
      if (major < +need[1] || (major === +need[1] && minor < +need[2]))
        err('ci', `${wf} sets up Node ${m[1]}${m[2] !== undefined ? '.' + m[2] : ''}, but package.json needs ${need[0]} or newer: npm ci stops with EBADENGINE`);
    }
  }
}

if (warns.length) {
  console.log('\n\x1b[33mWARNINGS\x1b[0m');
  for (const [cat, msgs] of Object.entries(group(warns))) {
    console.log(`\n  [${cat}]`);
    msgs.forEach(m => console.log('    · ' + m));
  }
}
if (errors.length) {
  console.log('\n\x1b[31mERRORS\x1b[0m');
  for (const [cat, msgs] of Object.entries(group(errors))) {
    console.log(`\n  [${cat}]`);
    msgs.forEach(m => console.log('    ✗ ' + m));
  }
  console.log(`\n${errors.length} contract error(s), ${warns.length} warning(s).\n`);
  process.exit(1);
}
console.log(`\n\x1b[32m✓\x1b[0m contracts intact (${warns.length} warning(s)).\n`);
