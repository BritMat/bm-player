#!/usr/bin/env node
/**
 * BM Player: field check
 *
 * Runs the real app on this machine, in the normal two-window layout, and
 * answers the questions that can't be settled anywhere else. Written to run
 * unattended from BM-Player-Check.bat, but works on its own too:
 *
 *   node scripts/field-check.mjs --out <folder>
 *
 * For each video layer (the platform default, then the other one) it plays
 * a generated test video and captures the screen, then works out whether
 * the controls and the picture are both visible. That verdict does not rely
 * on guessing colours. The controls fade after three seconds, so it captures
 * once with them shown and once after they fade. If the interface is really
 * on screen, the two captures differ where the play button is. If mpv's
 * window is covering it, they are identical there.
 *
 * Also checks PiP and stop in each layer, and saves the app's own
 * Diagnostics report. Everything goes to --out, with a plain-text summary.
 *
 * It also talks to mpv directly over its IPC pipe, to ask what it is really
 * doing (which video output, whether frames are advancing) and to have mpv
 * save a screenshot of its own rendered frame. A screen grab can miss GPU
 * video; mpv's own screenshot can't.
 *
 * Given a video of the user's (--video <file>, or BM_USER_VIDEO), it plays
 * that too: container, codecs and every track, then switches each audio and
 * subtitle track through the app's own right-click menu and confirms with
 * mpv that the switch happened, finds a moment with subtitle text for each
 * subtitle track and has mpv screenshot it, and tests seeking and pause.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// A throwaway profile for every launch. Without it the tests used the real
// BM Player profile: its history, music library, settings and theme.
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-test-profile-'));
process.on('exit', () => { try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {} });
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const OUT = path.resolve(opt('--out') || path.join(ROOT, 'field-results'));
const SHOTS = path.join(OUT, 'shots');
const USER_VIDEO = (() => {
  const v = opt('--video') || process.env.BM_USER_VIDEO || '';
  return v && fs.existsSync(v) ? path.resolve(v) : null;
})();
fs.mkdirSync(SHOTS, { recursive: true });
const IS_WIN = process.platform === 'win32', IS_LINUX = process.platform === 'linux';

const lines = [];
const say = s => { lines.push(s); console.log(s); };
const writeSummary = () => fs.writeFileSync(path.join(OUT, 'summary.txt'), lines.join('\n') + '\n');
const hard = setTimeout(() => { say('\nDEADLINE: the field check ran too long and was stopped.'); writeSummary(); process.exit(1); }, 18 * 60 * 1000);

say('BM Player field check');
say(`when: ${new Date().toISOString()}   platform: ${process.platform} ${os.release()}   node: ${process.version}`);
say('');

/* ── prerequisites ───────────────────────────────────────────────── */
let electronPath = null, playwright = null;
try { electronPath = require(path.join(ROOT, 'node_modules/electron')); if (!fs.existsSync(electronPath)) electronPath = null; } catch {}
try { playwright = await import('playwright-core'); } catch {}
if (!electronPath || !playwright) {
  say('Cannot run: ' + (!electronPath ? 'the Electron binary is not installed. ' : '') + (!playwright ? 'playwright-core is not installed.' : ''));
  writeSummary(); process.exit(process.env.BM_STRICT ? 3 : 1);
}

/* ── a test video, made on this machine ─────────────────────────── */
// ffmpeg if present, otherwise mpv's own encoder, which a player install
// almost always has. Colour bars and a frame counter, nothing personal.
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-field-'));
const VIDEO = path.join(FIX, 'bm-test-pattern.mkv');
function makeVideo() {
  const tries = [
    ['ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30', '-t', '45', '-c:v', 'mpeg4', '-q:v', '4', VIDEO]],
    [IS_WIN ? 'mpv.exe' : 'mpv', ['--no-config', 'av://lavfi:testsrc=duration=45:size=1280x720:rate=30', `--o=${VIDEO}`, '--ovc=mpeg4', '--ovcopts=qscale=4']],
  ];
  for (const [exe, args] of tries) {
    try {
      execFileSync(exe, args, { timeout: 120000, stdio: 'ignore', windowsHide: true });
      if (fs.existsSync(VIDEO) && fs.statSync(VIDEO).size > 10000) return exe;
    } catch {}
  }
  return null;
}
const madeWith = makeVideo();
say(madeWith ? `test video: generated with ${madeWith}` : 'test video: could not be generated (no ffmpeg, and mpv could not encode). Video checks will be skipped.');

/* ── screen capture and pixel sampling ──────────────────────────── */
// Captures the real screen, native windows included. A page screenshot
// only contains what Chromium draws, which would never show mpv's picture.
const PS1 = path.join(FIX, 'capture.ps1');
if (IS_WIN) fs.writeFileSync(PS1, String.raw`
param([string]$Mode = 'capture', [int]$X, [int]$Y, [int]$W, [int]$H, [string]$Out, [string]$Points, [string]$File, [string]$Mpv, [string]$Vo)
# Stop on any error. The first version carried on after one, saved an
# untouched all-black bitmap, and reported its pixels as if they were real.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BmCap {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
  [DllImport("gdi32.dll")] public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int w, int h, IntPtr hdcSrc, int xSrc, int ySrc, int rop);
}
'@
# Physical pixels everywhere: before any window or capture exists.
[BmCap]::SetProcessDPIAware() | Out-Null

function Get-GridStats($bmp) {
  # colours on a 12x12 grid (1 means one flat colour), and the share of
  # grid points that are lit rather than near-black
  $seen = @{}; $lit = 0
  for ($i = 0; $i -lt 12; $i++) { for ($j = 0; $j -lt 12; $j++) {
    $c = $bmp.GetPixel([int](($bmp.Width - 1) * $i / 11), [int](($bmp.Height - 1) * $j / 11))
    $seen["$($c.R),$($c.G),$($c.B)"] = 1
    if ([Math]::Max($c.R, [Math]::Max($c.G, $c.B)) -gt 40) { $lit++ }
  } }
  return @($seen.Count, ($lit / 144.0))
}

function Invoke-Capture([int]$cx, [int]$cy, [int]$cw, [int]$ch, [string]$file, [string]$pts) {
  $bmp = New-Object System.Drawing.Bitmap $cw, $ch
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $dst = $g.GetHdc()
  $src = [BmCap]::GetDC([IntPtr]::Zero)
  # SRCCOPY | CAPTUREBLT through BitBlt itself. The managed CopyFromScreen
  # rejects that combination as an invalid enum value, which is why the
  # first Windows run captured nothing but black.
  $ok = [BmCap]::BitBlt($dst, 0, 0, $cw, $ch, $src, $cx, $cy, 0x40CC0020)
  [BmCap]::ReleaseDC([IntPtr]::Zero, $src) | Out-Null
  $g.ReleaseHdc($dst)
  if (-not $ok) { $g.CopyFromScreen($cx, $cy, 0, 0, (New-Object System.Drawing.Size $cw, $ch)) }
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  # A capture that is one colour everywhere is not evidence of anything.
  $stats = Get-GridStats $bmp
  $status = 'OK'
  if ($stats[0] -le 1) { $status = 'BLANK' }
  $res = @()
  if ($pts) {
    foreach ($p in $pts.Split(';')) {
      $xy = $p.Split(','); $px = [int]$xy[0] - $cx; $py = [int]$xy[1] - $cy
      if ($px -ge 0 -and $py -ge 0 -and $px -lt $cw -and $py -lt $ch) { $c = $bmp.GetPixel($px, $py); $res += ('{0},{1},{2}' -f $c.R, $c.G, $c.B) } else { $res += 'out' }
    }
  }
  $g.Dispose(); $bmp.Dispose()
  return ($status + '|' + ($res -join ';'))
}

if ($Mode -eq 'stat') {
  $img = New-Object System.Drawing.Bitmap $File
  $stats = Get-GridStats $img
  Write-Output ('{0}|{1}|{2}|{3}' -f $img.Width, $img.Height, $stats[0], $stats[1])
  $img.Dispose(); exit 0
}

if ($Mode -eq 'embed') {
  # mpv embedded (--wid) in a plain Windows window, with no Chromium in it.
  # Dark purple background: purple means mpv drew nothing, black means it
  # drew black, colour means it drew the picture.
  Add-Type -AssemblyName System.Windows.Forms
  $form = New-Object System.Windows.Forms.Form
  $form.FormBorderStyle = 'None'
  $form.StartPosition = 'Manual'
  $form.TopMost = $true
  $form.ShowInTaskbar = $false
  $form.BackColor = [System.Drawing.Color]::FromArgb(40, 0, 40)
  $form.Location = New-Object System.Drawing.Point -ArgumentList $X, $Y
  $form.Size = New-Object System.Drawing.Size -ArgumentList $W, $H
  $form.Show()
  [System.Windows.Forms.Application]::DoEvents()
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Mpv
  $psi.Arguments = ('--no-config --wid={0} --vo={1} --loop-file=inf --ao=null --osd-level=0 --hwdec=auto-safe "{2}"' -f $form.Handle.ToInt64(), $Vo, $File)
  $psi.UseShellExecute = $false
  $proc = [System.Diagnostics.Process]::Start($psi)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt 4500) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 25 }
  $alive = -not $proc.HasExited
  $result = Invoke-Capture $X $Y $W $H $Out $Points
  try { if (-not $proc.HasExited) { $proc.Kill() } } catch { }
  $form.Close(); $form.Dispose()
  Write-Output ($result + '|' + $alive)
  exit 0
}

Write-Output (Invoke-Capture $X $Y $W $H $Out $Points)
`);



/** rect and points are in physical screen pixels. Returns [[r,g,b]|null, ...]. */
function capture(rect, points, file) {
  const pts = points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
  try {
    if (IS_WIN) {
      const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-Mode', 'capture',
        '-X', String(rect.x), '-Y', String(rect.y), '-W', String(rect.width), '-H', String(rect.height), '-Out', file, '-Points', pts],
        { timeout: 20000, windowsHide: true }).toString().trim().split(/\r?\n/).pop();
      const [status, rest] = out.split('|');
      if (status === 'BLANK') { blankCaptures++; say('   (the screen capture came back as one flat colour: ' + path.basename(file) + ')'); }
      return (rest || '').split(';').map(v => v === 'out' || !v ? null : v.split(',').map(Number));
    }
    if (IS_LINUX) {
      const full = file + '.full.png';
      execFileSync('import', ['-window', 'root', full], { timeout: 10000 });
      execFileSync('convert', [full, '-crop', `${rect.width}x${rect.height}+${rect.x}+${rect.y}`, '+repage', file], { timeout: 10000 });
      // Same rule as the Windows path: one flat colour is not evidence.
      const colours = execFileSync('convert', [file, '-scale', '12x12!', '-unique-colors', '-format', '%w', 'info:'], { timeout: 5000 }).toString().trim();
      if (colours === '1') { blankCaptures++; say('   (the screen capture came back as one flat colour: ' + path.basename(file) + ')'); }
      const res = points.map(p => {
        // fx channels, not %[pixel:], which answers exact matches with names like 'black'.
        const v = execFileSync('convert', [full, '-format', `%[fx:int(255*p{${Math.round(p.x)},${Math.round(p.y)}}.r)],%[fx:int(255*p{${Math.round(p.x)},${Math.round(p.y)}}.g)],%[fx:int(255*p{${Math.round(p.x)},${Math.round(p.y)}}.b)]`, 'info:'], { timeout: 5000 }).toString();
        const m = v.match(/(\d+),(\d+),(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null;
      });
      fs.rmSync(full, { force: true });
      return res;
    }
    execFileSync('screencapture', ['-x', '-R', `${rect.x},${rect.y},${rect.width},${rect.height}`, file], { timeout: 10000 });
    return points.map(() => null);
  } catch (e) {
    say('   (screen capture failed: ' + String(e.message || e).split('\n')[0].slice(0, 120) + ')');
    return points.map(() => null);
  }
}
/** {w, h, colours} of an image file, colours counted on a 12x12 grid. */
function imageStat(file) {
  try {
    if (!fs.existsSync(file)) return null;
    if (IS_WIN) {
      const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-Mode', 'stat', '-File', file],
        { timeout: 20000, windowsHide: true }).toString().trim().split(/\r?\n/).pop();
      const [w, h, c, lit] = out.split('|').map(Number); return { w, h, colours: c, lit };
    }
    const [w, h] = execFileSync('identify', ['-format', '%w %h', file], { timeout: 5000 }).toString().trim().split(' ').map(Number);
    const c = Number(execFileSync('convert', [file, '-scale', '12x12!', '-unique-colors', '-format', '%w', 'info:'], { timeout: 5000 }).toString().trim());
    // share of a 12x12 grid brighter than near-black, as the Windows path counts it
    const lit = Number(execFileSync('convert', [file, '-scale', '12x12!', '-channel', 'RGB', '-separate', '-evaluate-sequence', 'max', '-threshold', '15.7%', '-format', '%[fx:mean]', 'info:'], { timeout: 5000 }).toString().trim());
    return { w, h, colours: c, lit };
  } catch { return null; }
}

/** Ask mpv through the app's own channel: renderer, preload, main, mpv.
 *  The first version connected to mpv's pipe directly, named after the
 *  process id Playwright reported. On Windows Playwright starts Electron
 *  through cmd.exe, so that id was the shell's, the pipe didn't exist, and
 *  the check with the user's own video stopped right after "plays". This
 *  way there is no name to get right, and the app's real IPC is exercised. */
function mpvViaApp(page) {
  const isErr = r => r && typeof r === 'object' && !Array.isArray(r) && Object.keys(r).length === 1 && 'error' in r;
  return {
    get: async name => {
      const r = await page.evaluate(n => window.api.mpv.cmd('get_property', n), name).catch(() => undefined);
      return isErr(r) ? undefined : r;
    },
    cmd: async (...a) => {
      const r = await page.evaluate(a => window.api.mpv.cmd(...a), a).catch(e => ({ error: String(e.message || e) }));
      return isErr(r) ? { error: r.error } : { error: 'success', data: r };
    },
    close: () => {},
  };
}

/** What mpv says it is doing: output, decoder, and whether frames advance. */
async function renderState(mc) {
  const q = {};
  for (const k of ['current-vo', 'vo-configured', 'hwdec-current', 'width', 'height', 'container-fps', 'video-codec', 'current-ao', 'frame-drop-count', 'estimated-frame-number', 'display-fps', 'vo-delayed-frame-count']) q[k] = await mc.get(k);
  await new Promise(r => setTimeout(r, 1000));
  const f2 = await mc.get('estimated-frame-number');
  q.framesInOneSecond = (typeof f2 === 'number' && typeof q['estimated-frame-number'] === 'number') ? f2 - q['estimated-frame-number'] : null;
  return q;
}
const describeRender = q => `output ${q['current-vo'] || '?'} (${q['vo-configured'] ? 'running' : 'NOT running'}), decoder ${q['hwdec-current'] && q['hwdec-current'] !== 'no' ? 'hardware ' + q['hwdec-current'] : 'software'}, ` +
  `${q.width || '?'}x${q.height || '?'}, ${q.framesInOneSecond ?? '?'} frames in one second, ${q['frame-drop-count'] ?? 0} dropped, display ${Number.isFinite(q['display-fps']) ? Math.round(q['display-fps']) + 'Hz' : '?'}, audio ${q['current-ao'] || 'none'}`;

/** Wait until the app's mpv answers. Older builds dropped a file opened
 *  before that (fixed in v3.14.0), and this check may run against one. */
async function waitForMpv(page, ms = 20000) {
  for (let t = 0; t < ms; t += 250) {
    const up = await page.evaluate(async () => { const r = await window.api.mpv.cmd('get_property', 'idle-active'); return !(r && r.error); }).catch(() => false);
    if (up) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

let blankCaptures = 0;
const sat = c => c ? Math.max(...c) - Math.min(...c) : 0;
const differs = (a, b) => a && b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 60;

// A two-window layout on Linux needs a compositor for its transparent window.
let compositor = null;
if (IS_LINUX) {
  try { execFileSync('which', ['xcompmgr'], { stdio: 'ignore' }); compositor = spawn('xcompmgr', ['-n'], { stdio: 'ignore', detached: true }); await new Promise(r => setTimeout(r, 600)); } catch {}
}

/* ── one run per video layer ─────────────────────────────────────── */
// Must match main.js. It said 'front' for Windows after v3.15.0 made Windows
// default to 'back', and the check launches runs by flag, so the "front" run
// would have tested back mode twice. Each run now passes its layout
// explicitly and confirms from inside the app which one is in effect.
const defaultLayer = (IS_LINUX || IS_WIN) ? 'back' : 'front';
// --video-only skips the layer comparison when only a user's file matters.
// Lite is a third layout: one window, no separate picture window. On Windows
// that is the same arrangement that played black, so it is checked too.
// Each run is a layout plus, on Windows, a video output for mpv. mpv drew a
// black picture inside the app on a real Windows machine while showing it
// fine in its own window, so the outputs are compared as well as layouts.
// Windows: the default (DirectComposition off, which made the picture show
// on a real machine), the old behaviour as a witness that this setting is
// what matters, then front and Lite. --experiments adds the diagnostic runs
// that found the answer: each mpv output, and the other Chromium switch.
const EXPERIMENTS = argv.includes('--experiments');
const CONFIGS = argv.includes('--video-only') && USER_VIDEO ? [] : (IS_WIN
  ? [{ id: 'back (default)', layer: 'back' },
     { id: 'back with DirectComposition on (the old behaviour)', layer: 'back', sw: 'none' },
     { id: 'front', layer: 'front' },
     { id: 'lite', layer: 'lite' },
     ...(EXPERIMENTS ? [{ id: 'back+gpu', layer: 'back', vo: 'gpu' }, { id: 'back+direct3d', layer: 'back', vo: 'direct3d' },
                        { id: 'back+no-gpu-compositing', layer: 'back', sw: 'disable-gpu-compositing' }] : [])]
  : [{ id: defaultLayer, layer: defaultLayer }, { id: defaultLayer === 'back' ? 'front' : 'back', layer: defaultLayer === 'back' ? 'front' : 'back' }, { id: 'lite', layer: 'lite' }])
  .map((c, i) => ({ vo: null, sw: null, ...c, slug: c.id.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, ''), full: i === 0 }));
const layers = CONFIGS.map(c => c.id);
const results = {};
const verdicts = {};
let savedDiagnostics = false;

// Warm up: the first start after a download can take a long time while
// Windows scans the new program. The last run's first launches timed out.
if (CONFIGS.length || USER_VIDEO) {
  const t0 = Date.now();
  try {
    const wa = await playwright._electron.launch({ executablePath: electronPath, args: [ROOT, '--no-sandbox', `--user-data-dir=${PROFILE}`, '--lite'], cwd: ROOT, timeout: 150000 });
    let wp; for (let i = 0; i < 600 && !wp; i++) { wp = wa.windows().find(w => w.url().includes('index.html')); if (!wp) await new Promise(r => setTimeout(r, 250)); }
    if (wp) await wp.waitForFunction(() => window.bmApp, null, { timeout: 120000 });
    await wa.close().catch(() => {});
    say(`(warm-up start: the app was ready after ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) { say(`(warm-up start failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${String(e.message || e).split('\n')[0].slice(0, 100)})`); }
  try { execFileSync(IS_WIN ? 'taskkill' : 'pkill', IS_WIN ? ['/F', '/IM', 'mpv.exe'] : ['-9', '-x', 'mpv'], { stdio: 'ignore', windowsHide: true }); } catch {}
}

for (const cfg of CONFIGS) {
  const layer = cfg.layer, id = cfg.id;   // cfg.slug names its files
  say('');
  const flag = layer === 'lite' ? '--lite' : `--video-${layer}`;
  const voFlag = [...(cfg.vo ? [`--mpv-vo=${cfg.vo}`] : []), ...(cfg.sw ? [`--bm-switch=${cfg.sw}`] : [])];
  say(`== ${id}: ${layer === 'lite' ? 'one window' : layer + ' layout'}${cfg.vo ? ', mpv output ' + cfg.vo : ''}, launched with ${[flag, ...voFlag].join(' ')} ==`);
  const args = [ROOT, '--no-sandbox', `--user-data-dir=${PROFILE}`, flag, ...voFlag];
  let app;
  try {
    // A first start after a download can be slow while Windows scans it.
    app = await playwright._electron.launch({ executablePath: electronPath, args, cwd: ROOT, timeout: 90000 });
  } catch (e) {
    say('   could not launch the app: ' + String(e.message || e).split('\n')[0]);
    verdicts[id] = 'app did not launch';
    continue;
  }
  const errors = [];
  try {
    let page;
    for (let i = 0; i < 120 && !page; i++) {
      page = app.windows().find(w => w.url().includes('index.html'));
      if (!page) await new Promise(r => setTimeout(r, 250));
    }
    if (!page) throw new Error('the main window never appeared');
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.waitForFunction(() => window.bmApp, null, { timeout: 60000 });
    // Which layout is really in effect, from the app itself.
    // The window layout comes from the launch (lite=1 in the page's address).
    // Not window.__BM_LITE__: the page also sets that when it lowers its own
    // visuals on a weak machine, which says nothing about the windows.
    const inEffect = await page.evaluate(() => { const q = new URLSearchParams(location.search); return q.get('lite') === '1' ? 'lite' : (q.get('vl') || '?'); });
    say(inEffect === layer ? `   layout in effect: ${inEffect}` : `   NOTE: asked for ${layer}, but the app is using ${inEffect}`);
    await page.waitForTimeout(1500);

    const flags = await page.evaluate(async () => (await window.api.app.diagnostics()).flags || {});
    say(`   app started, video layer reported by the app: ${flags.videoLayer || '?'}`);

    if (!savedDiagnostics) {
      const text = await page.evaluate(async () => {
        const d = await import('./js/diagnostics.js');
        return d.formatDiagnostics(await d.collectDiagnostics(window.api));
      }).catch(e => 'Diagnostics failed: ' + e.message);
      fs.writeFileSync(path.join(OUT, 'diagnostics.txt'), text);
      savedDiagnostics = true;
      say('   saved the app\'s Diagnostics report');
    }

    if (!madeWith) { verdicts[id] = 'skipped (no test video)'; continue; }

    // Where things are on the physical screen.
    const geo = async () => app.evaluate(({ BaseWindow, screen }) => {
      const ws = BaseWindow.getAllWindows();
      const front = ws.find(w => w.getTitle() !== 'BM Player BG') || ws[0];
      const b = front.getBounds();
      const toPhys = r => (process.platform === 'win32' && screen.dipToScreenRect) ? screen.dipToScreenRect(null, r) : r;
      return { front: b, phys: toPhys(b), scale: screen.getDisplayMatching(b).scaleFactor };
    });
    // Keep both windows above anything else (the console, say) while capturing,
    // picture window first so the controls window stays on top of it.
    const raise = on => app.evaluate(({ BaseWindow }, on) => {
      const ws = BaseWindow.getAllWindows();
      const bg = ws.find(w => w.getTitle() === 'BM Player BG'), fr = ws.find(w => w.getTitle() !== 'BM Player BG');
      const order = on ? [bg, fr] : [fr, bg];
      for (const w of order) if (w) { try { w.setAlwaysOnTop(on); if (on) w.moveTop(); } catch {} }
    }, on);

    if (!(await waitForMpv(page))) say('   mpv did not answer within 20 seconds');
    await page.evaluate(f => bmApp.playMedia([f]), VIDEO);
    await page.waitForTimeout(2500);
    const st = await page.evaluate(() => ({ t: bmApp.currentTime, v: bmApp._hasVideo }));
    say(`   playing: position ${st.t.toFixed(2)}s, video track ${st.v ? 'yes' : 'NO'}`);
    if (!(st.t > 0.5)) {
      verdicts[id] = 'the video did not play';
      await page.screenshot({ path: path.join(SHOTS, `${cfg.slug}-not-playing.png`) }).catch(() => {});
      continue;
    }

    // Ask mpv itself, and have it screenshot its own rendered frame.
    let mpvDraws = null;
    try {
      const mc = mpvViaApp(page);
      const q = await renderState(mc);
      say('   mpv says: ' + describeRender(q));
      // On Windows mpv's 'window' screenshot is a grab of the screen area, the
      // same as ours, so it proves nothing about drawing. The decoded frame
      // ('video') at least shows mpv has a real picture to draw.
      const own = path.join(SHOTS, `${cfg.slug}-0-mpv-decoded.png`);
      await mc.cmd('screenshot-to-file', own, 'video');
      const st = imageStat(own);
      mpvDraws = null;
      say(`   mpv decodes a real picture: ${st ? (st.lit > 0.3 ? 'yes' : 'NO (the decoded frame is dark)') : 'no screenshot'}`);
      mc.close();
    } catch (e) { say('   could not ask mpv: ' + String(e.message || e).split('\n')[0]); }

    const g = await geo();
    const btn = await page.evaluate(() => { const r = document.getElementById('btn-play').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const s = g.phys.width / g.front.width;                 // DIP to physical
    const P = (dx, dy) => ({ x: g.phys.x + dx * s, y: g.phys.y + dy * s });
    const pointsBtn = [P(btn.x + btn.w / 2, btn.y + btn.h / 2), P(btn.x + btn.w * 0.3, btn.y + btn.h / 2), P(btn.x + btn.w * 0.7, btn.y + btn.h / 2)];
    const midY = g.front.height * 0.45;
    const pointsPic = [0.25, 0.4, 0.5, 0.6, 0.75].map(f => P(g.front.width * f, midY));
    const rect = { x: Math.max(0, Math.round(g.phys.x - 10)), y: Math.max(0, Math.round(g.phys.y - 10)),
                   width: Math.round(g.phys.width + 20), height: Math.round(g.phys.height + 20) };

    const blankAtStart = blankCaptures;
    await raise(true);
    // Show and fade the controls ourselves. Waiting for the app's own fade
    // timer failed on Windows: a real mouse pointer over the window keeps the
    // controls up, so both captures were identical and the verdict wrong.
    const setFaded = on => page.evaluate(on => document.getElementById('controls-bar')?.classList.toggle('faded', on), on);
    const isFaded = () => page.evaluate(() => !!document.getElementById('controls-bar')?.classList.contains('faded'));
    await setFaded(false); await page.waitForTimeout(700);
    const shown = capture(rect, [...pointsBtn, ...pointsPic], path.join(SHOTS, `${cfg.slug}-1-playing-controls-shown.png`));
    const shownOk = !(await isFaded());
    await setFaded(true); await page.waitForTimeout(900);
    const faded = capture(rect, [...pointsBtn, ...pointsPic], path.join(SHOTS, `${cfg.slug}-2-playing-controls-faded.png`));
    const fadedOk = await isFaded();
    await setFaded(false);
    // The controls window made invisible: is the picture there behind it?
    let behind = null;
    if (IS_WIN && layer === 'back') {
      await app.evaluate(({ BaseWindow }) => { for (const w of BaseWindow.getAllWindows()) if (w.getTitle() !== 'BM Player BG') w.setOpacity(0); });
      await page.waitForTimeout(600);
      const bp = capture(rect, pointsPic, path.join(SHOTS, `${cfg.slug}-6-controls-window-invisible.png`));
      await app.evaluate(({ BaseWindow }) => { for (const w of BaseWindow.getAllWindows()) w.setOpacity(1); });
      behind = bp.some(c => sat(c) > 80);
    }
    await raise(false);

    const controlsVisible = pointsBtn.some((_, i) => differs(shown[i], faded[i]));
    const picVisible = [...shown, ...faded].slice(3).some(c => sat(c) > 80)
      || shown.slice(pointsBtn.length).some(c => sat(c) > 80) || faded.slice(pointsBtn.length).some(c => sat(c) > 80);
    const captured = shown.some(Boolean) && faded.some(Boolean);
    let verdict;
    if (blankCaptures > blankAtStart) verdict = 'unclear (the screen capture was blank, so it could not see the windows)';
    else if (!captured) verdict = 'unclear (the screen capture returned nothing; look at the screenshots)';
    else if ((!shownOk || !fadedOk) && picVisible) verdict = 'picture VISIBLE (the controls could not be checked: the mouse may have moved)';
    else if ((!shownOk || !fadedOk) && !picVisible) verdict = 'NO PICTURE (the controls could not be checked: the mouse may have moved)';
    else if (controlsVisible && picVisible) verdict = 'controls AND picture both visible';
    else if (!controlsVisible && picVisible) verdict = 'picture visible, controls HIDDEN behind it';
    else if (controlsVisible && !picVisible && mpvDraws) verdict = 'controls visible; mpv IS drawing the picture (its own screenshot shows it), but it does not appear in the screen capture';
    else if (controlsVisible && !picVisible && mpvDraws === false) verdict = 'controls visible, but mpv is NOT drawing a picture';
    else if (controlsVisible && !picVisible) verdict = 'controls visible, but NO PICTURE in the screen capture';
    else verdict = 'unclear (neither detected; look at the screenshots)';
    verdicts[id] = verdict;
    results[id] = { pic: picVisible, controls: (shownOk && fadedOk) ? controlsVisible : null, behind };
    say(`   VERDICT: ${verdict}`);
    if (behind !== null) say(`   with the controls window made invisible, the picture behind it is ${behind ? 'VISIBLE' : 'NOT visible either'}`);
    say(`   (play button shown ${JSON.stringify(shown.slice(0, 3))} vs faded ${JSON.stringify(faded.slice(0, 3))})`);

    if (!cfg.full) continue;
    // PiP in this layer. The captures take a while, so make sure it's still
    // playing: PiP rightly refuses to start with nothing playing.
    await page.evaluate(() => { if (!bmApp.isPlaying) bmApp.togglePlay(); }); await page.waitForTimeout(400);
    await page.evaluate(() => bmApp.togglePiP(true)); await page.waitForTimeout(1200);
    const pip = await app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows().map(w => ({ t: w.getTitle(), b: w.getBounds(), vis: w.isVisible(), top: w.isAlwaysOnTop() })));
    const pg = await geo();
    capture({ x: Math.max(0, Math.round(pg.phys.x - 40)), y: Math.max(0, Math.round(pg.phys.y - 40)), width: Math.round(pg.phys.width + 80), height: Math.round(pg.phys.height + 80) },
            [], path.join(SHOTS, `${cfg.slug}-3-pip.png`));
    const fr = pip.find(w => w.t !== 'BM Player BG'), bg = pip.find(w => w.t === 'BM Player BG');
    say(`   PiP: controls window ${fr ? fr.b.width + 'x' + fr.b.height : '?'}${bg ? `, picture window ${bg.vis ? bg.b.width + 'x' + bg.b.height : 'hidden'}` : ''}, on top: ${fr && fr.top ? 'yes' : 'NO'}`);
    await page.evaluate(() => bmApp.togglePiP(false)); await page.waitForTimeout(1200);
    const back = (await geo()).front;
    say(`   after PiP: ${back.width}x${back.height} (was ${g.front.width}x${g.front.height})${Math.abs(back.width - g.front.width) > 2 ? '  <-- NOT RESTORED' : ''}`);
    await raise(true);
    capture(rect, [], path.join(SHOTS, `${cfg.slug}-4-after-pip.png`));
    await raise(false);

    await page.evaluate(() => bmApp.stop()); await page.waitForTimeout(1200);
    const home = await page.evaluate(() => document.getElementById('welcome-screen').classList.contains('active'));
    await raise(true);
    const homePix = capture(rect, [P(g.front.width / 2, g.front.height * 0.45)], path.join(SHOTS, `${cfg.slug}-5-stopped.png`));
    await raise(false);
    const black = homePix[0] && Math.max(...homePix[0]) < 8;
    say(`   after stop: home screen ${home ? 'active' : 'NOT active'}${black ? ', but the screen looks pure black there  <-- check 5-stopped.png' : ''}`);
  } catch (e) {
    say('   error during this run: ' + String(e.message || e).split('\n')[0].slice(0, 200));
    if (!verdicts[id]) verdicts[id] = 'error: ' + String(e.message || e).split('\n')[0].slice(0, 80);
  } finally {
    if (errors.length) { say(`   console errors (${errors.length}):`); errors.slice(0, 6).forEach(e => say('     - ' + e.slice(0, 180))); }
    await app.close().catch(() => {});
    try { execFileSync(IS_WIN ? 'taskkill' : 'pkill', IS_WIN ? ['/F', '/IM', 'mpv.exe'] : ['-9', '-x', 'mpv'], { stdio: 'ignore', windowsHide: true }); } catch {}
  }
}

/* Control experiment. Can this screen capture see mpv's video at all? Play
 * the test pattern in a plain mpv window, outside the app, with the same
 * video output setting, and capture it the same way. If it can, a black
 * picture area inside the app means the picture really is hidden. If it
 * can't, black areas prove nothing and mpv's own screenshots are the evidence. */
let captureSeesMpv = null;
const controlResults = {};
const MPV_EXE = (() => {
  if (!IS_WIN) return 'mpv';
  try { return execFileSync('where', ['mpv.exe'], { windowsHide: true }).toString().split(/\r?\n/)[0].trim() || 'mpv.exe'; } catch { return 'mpv.exe'; }
})();
if (madeWith && (IS_WIN || IS_LINUX)) {
  say('');
  say('== control: mpv outside the app, in its own window and embedded in a plain window ==');
  const G = { x: 140, y: 140, w: 640, h: 360 };
  const pts = [0.2, 0.35, 0.5, 0.65, 0.8].map(f => ({ x: G.x + G.w * f, y: G.y + G.h * 0.4 }));
  const classify = px => px.some(c => sat(c) > 80) ? 'PICTURE'
    : px.every(c => c && Math.abs(c[0] - 40) < 12 && c[1] < 12 && Math.abs(c[2] - 40) < 12) ? 'nothing drawn'
    : px.every(c => c && Math.max(...c) < 20) ? 'black' : 'unclear';
  const mpvExe = MPV_EXE;
  const vos = IS_WIN ? (EXPERIMENTS ? ['direct3d', 'gpu', 'gpu-next'] : ['gpu-next']) : ['gpu,xv,x11,'];
  for (const vo of vos) {
    // mpv in its own window
    const proc = spawn(mpvExe, ['--no-config', `--vo=${vo}`, '--no-border', '--ontop', '--loop-file=inf', '--ao=null', '--osd-level=0',
      `--geometry=${G.w}x${G.h}+${G.x}+${G.y}`, '--autofit-larger=640x360', VIDEO], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 3500));
    const own = classify(capture({ x: G.x, y: G.y, width: G.w, height: G.h }, pts, path.join(SHOTS, `control-own-window-${vo.replace(/[^a-z0-9-]/g, '')}.png`)));
    try { IS_WIN ? execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) : proc.kill('SIGKILL'); } catch {}
    // mpv embedded (--wid) in a plain Windows window with no Chromium in it
    let embedded = 'not tested';
    if (IS_WIN) {
      try {
        const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-Mode', 'embed',
          '-X', String(G.x), '-Y', String(G.y), '-W', String(G.w), '-H', String(G.h), '-Mpv', mpvExe, '-Vo', vo, '-File', VIDEO,
          '-Out', path.join(SHOTS, `control-embedded-${vo}.png`), '-Points', pts.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(';')],
          { timeout: 30000, windowsHide: true }).toString().trim().split(/\r?\n/).pop();
        const [, rest, alive] = out.split('|');
        embedded = classify(rest.split(';').map(v => v === 'out' || !v ? null : v.split(',').map(Number)));
        if (alive !== 'True') embedded += ' (mpv had exited)';
      } catch (e) { embedded = 'test failed: ' + String(e.message || e).split('\n')[0].slice(0, 90); }
    }
    controlResults[vo] = { own, embedded };
    say(`   ${vo.padEnd(12)} own window: ${own.padEnd(14)} embedded in a plain window: ${embedded}`);
    if (own === 'PICTURE') captureSeesMpv = true;
    else if (captureSeesMpv === null) captureSeesMpv = false;
  }
  say(captureSeesMpv
    ? '   The capture can see mpv video, so a black picture inside the app means it really is hidden there.'
    : '   The capture could not see mpv video even in its own window, so black areas prove nothing either way.');
}

/* Experiment: mpv in its own window, lined up behind the controls window.
 * If the picture shows with the controls over it, the app could stop
 * embedding mpv and keep mpv's own window behind the controls instead. */
let separateResult = null;
if (IS_WIN && madeWith && EXPERIMENTS) {
  say('');
  say('== experiment: mpv in its own window, behind the controls window ==');
  let app, proc;
  try {
    app = await playwright._electron.launch({ executablePath: electronPath, args: [ROOT, '--no-sandbox', `--user-data-dir=${PROFILE}`, '--video-back'], cwd: ROOT, timeout: 90000 });
    let page; for (let i = 0; i < 400 && !page; i++) { page = app.windows().find(w => w.url().includes('index.html')); if (!page) await new Promise(r => setTimeout(r, 250)); }
    await page.waitForFunction(() => window.bmApp, null, { timeout: 60000 });
    await waitForMpv(page);
    // Real playback, so the page goes transparent the way it does for video.
    await page.evaluate(f => bmApp.playMedia([f]), VIDEO);
    await page.waitForTimeout(2500);
    // The app's own picture window out of the way: only mpv's window is behind.
    const r = await app.evaluate(({ BaseWindow, screen }) => {
      const ws = BaseWindow.getAllWindows();
      const bg = ws.find(w => w.getTitle() === 'BM Player BG'); if (bg) bg.hide();
      const fr = ws.find(w => w.getTitle() !== 'BM Player BG');
      const b = fr.getBounds();
      return { b, phys: screen.dipToScreenRect ? screen.dipToScreenRect(null, b) : b };
    });
    const ph = r.phys;
    proc = spawn(MPV_EXE, ['--no-config', '--vo=gpu-next,gpu,', '--no-border', '--loop-file=inf', '--ao=null', '--osd-level=0', '--keepaspect=no',
      `--geometry=${Math.round(ph.width)}x${Math.round(ph.height)}+${Math.round(ph.x)}+${Math.round(ph.y)}`, VIDEO], { stdio: 'ignore' });
    await new Promise(res => setTimeout(res, 3500));
    await app.evaluate(({ BaseWindow }) => { for (const w of BaseWindow.getAllWindows()) if (w.getTitle() !== 'BM Player BG') { w.setAlwaysOnTop(true); w.moveTop(); } });
    await page.waitForTimeout(600);
    const btn = await page.evaluate(() => { const b = document.getElementById('btn-play').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    const k = ph.width / r.b.width;
    const P = (dx, dy) => ({ x: ph.x + dx * k, y: ph.y + dy * k });
    const pBtn = [0.5, 0.3, 0.7].map(f => P(btn.x + btn.w * f, btn.y + btn.h / 2));
    const pPic = [0.25, 0.4, 0.5, 0.6, 0.75].map(f => P(r.b.width * f, r.b.height * 0.45));
    const rect = { x: Math.round(ph.x), y: Math.round(ph.y), width: Math.round(ph.width), height: Math.round(ph.height) };
    const setFaded = on => page.evaluate(on => document.getElementById('controls-bar')?.classList.toggle('faded', on), on);
    await setFaded(false); await page.waitForTimeout(700);
    const shown = capture(rect, [...pBtn, ...pPic], path.join(SHOTS, 'experiment-own-window-behind-shown.png'));
    await setFaded(true); await page.waitForTimeout(900);
    const faded = capture(rect, [...pBtn, ...pPic], path.join(SHOTS, 'experiment-own-window-behind-faded.png'));
    await setFaded(false);
    const pic = [...shown.slice(3), ...faded.slice(3)].some(c => sat(c) > 80);
    const controls = pBtn.some((_, i) => differs(shown[i], faded[i]));
    separateResult = { pic, controls };
    say(`   picture ${pic ? 'VISIBLE' : 'not visible'}, controls ${controls ? 'visible on top' : 'not seen'}`);
    say(pic && controls
      ? '   -> mpv in its own window behind the controls works here: a way to show the picture without embedding.'
      : '   -> this does not show both either.');
  } catch (e) { say('   experiment failed: ' + String(e.message || e).split('\n')[0].slice(0, 140)); }
  finally {
    try { if (proc) execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    await app?.close().catch(() => {});
    try { execFileSync('taskkill', ['/F', '/IM', 'mpv.exe'], { stdio: 'ignore', windowsHide: true }); } catch {}
  }
}

if (USER_VIDEO) await checkUserVideo();
else { say(''); say('(no video of yours was given: put one next to the .bat to check playback, audio tracks and subtitles)'); }

async function checkUserVideo() {
  // Play it in the best configuration the runs above found: picture and
  // controls both visible, else the picture at least, else the default.
  const best = CONFIGS.find(c => results[c.id]?.pic && results[c.id]?.controls !== false)
            || CONFIGS.find(c => results[c.id]?.pic) || null;
  const extra = best ? [best.layer === 'lite' ? '--lite' : `--video-${best.layer}`, ...(best.vo ? [`--mpv-vo=${best.vo}`] : []),
                        ...(best.sw ? [`--bm-switch=${best.sw}`] : [])] : [];
  say('');
  say(`== your video: ${path.basename(USER_VIDEO)} ==`);
  say(best ? `   played in ${best.id}, the best configuration found above` : '   played with the app\'s defaults (no configuration above showed the picture)');
  let app;
  try { app = await playwright._electron.launch({ executablePath: electronPath, args: [ROOT, '--no-sandbox', `--user-data-dir=${PROFILE}`, ...extra], cwd: ROOT, timeout: 90000 }); }
  catch (e) { say('   could not launch the app: ' + String(e.message || e).split('\n')[0]); return; }
  const ok = (good, text) => say(`   ${good ? 'OK  ' : 'FAIL'}  ${text}`);
  let mc = null;
  try {
    let page;
    for (let i = 0; i < 120 && !page; i++) { page = app.windows().find(w => w.url().includes('index.html')); if (!page) await new Promise(r => setTimeout(r, 250)); }
    await page.waitForFunction(() => window.bmApp, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    if (!(await waitForMpv(page))) say('   mpv did not answer within 20 seconds');
    await page.evaluate(f => bmApp.playMedia([f]), USER_VIDEO);
    let t = 0;
    for (let i = 0; i < 30 && !(t > 1.5); i++) { await page.waitForTimeout(500); t = await page.evaluate(() => bmApp.currentTime || 0); }
    ok(t > 1.5, `plays (position ${t.toFixed(1)}s)`);
    if (!(t > 1.5)) return;

    // Is it on screen? A fifth of the way in, past any opening fade.
    try {
      const d0 = await page.evaluate(() => bmApp.duration || 0);
      if (d0 > 60) { await page.evaluate(x => bmApp.seekTo(x), d0 * 0.2); await page.waitForTimeout(1800); }
      const gw = await app.evaluate(({ BaseWindow, screen }) => {
        const ws = BaseWindow.getAllWindows(); const fr = ws.find(w => w.getTitle() !== 'BM Player BG') || ws[0];
        for (const w of [ws.find(w => w.getTitle() === 'BM Player BG'), fr]) if (w) { try { w.setAlwaysOnTop(true); w.moveTop(); } catch {} }
        const b = fr.getBounds();
        return (process.platform === 'win32' && screen.dipToScreenRect) ? screen.dipToScreenRect(null, b) : b;
      });
      await page.waitForTimeout(500);
      const pts = [];
      for (const fy of [0.3, 0.45, 0.6]) for (const fx of [0.2, 0.35, 0.5, 0.65, 0.8]) pts.push({ x: gw.x + gw.width * fx, y: gw.y + gw.height * fy });
      const px = capture({ x: Math.round(gw.x), y: Math.round(gw.y), width: Math.round(gw.width), height: Math.round(gw.height) }, pts, path.join(SHOTS, 'yours-0-on-screen.png'));
      await app.evaluate(({ BaseWindow }) => { for (const w of BaseWindow.getAllWindows()) { try { w.setAlwaysOnTop(false); } catch {} } });
      const lit = px.filter(c => c && Math.max(...c) > 40).length;
      ok(lit >= 4, `your picture on screen: ${lit} of ${px.length} sample points lit (yours-0-on-screen.png)`);
    } catch (e) { say('   could not capture the screen: ' + String(e.message || e).split('\n')[0].slice(0, 120)); }

    mc = mpvViaApp(page);
    const dur = await mc.get('duration'), fmt = await mc.get('file-format');
    const tracks = (await mc.get('track-list')) || [];
    say(`   file: ${fmt || '?'}, ${dur ? Math.floor(dur / 60) + ':' + String(Math.floor(dur % 60)).padStart(2, '0') : '?'} long`);
    const q = await renderState(mc);
    say('   mpv says: ' + describeRender(q));
    const describe = tr => [`#${tr.id}`, tr.lang ? `[${tr.lang}]` : '', tr.title ? `"${String(tr.title).slice(0, 40)}"` : '', tr.codec || '',
      tr['demux-channel-count'] ? tr['demux-channel-count'] + 'ch' : '', tr.external ? 'external file' : '', tr.default ? 'default' : '', tr.selected ? 'selected' : ''].filter(Boolean).join(' ');
    const auds = tracks.filter(x => x.type === 'audio'), subs = tracks.filter(x => x.type === 'sub');
    say(`   audio tracks: ${auds.length}`); auds.forEach(x => say('     ' + describe(x)));
    say(`   subtitle tracks: ${subs.length}`); subs.forEach(x => say('     ' + describe(x)));

    const frame = path.join(SHOTS, 'yours-1-decoded.jpg');
    await mc.cmd('screenshot-to-file', frame, 'video');
    const fst = imageStat(frame);
    ok(!!(fst && fst.lit > 0.2), `mpv decodes your picture (${fst ? fst.w + 'x' + fst.h + ', ' + Math.round(fst.lit * 100) + '% lit' : 'none'})`);

    // Tracks, through the app's own right-click menu, confirmed with mpv.
    const openMenu = () => page.evaluate(() => { bmApp._populateCtxTracks?.(); bmApp._openCtxPanel?.(60, 60); });
    const rowCount = sel => page.evaluate(sel => document.querySelectorAll(sel).length, sel);
    const clickRow = (sel, i) => page.evaluate(([sel, i]) => document.querySelectorAll(sel)[i]?.click(), [sel, i]);
    const closeMenu = () => page.evaluate(() => bmApp._closeCtxPanel?.());

    await openMenu();
    const aRows = await rowCount('#ctx-audio-tracks .ctx-track-item');
    // With no audio output device, mpv switches audio off whatever you pick,
    // so a switch can't be judged. Seen in the test sandbox, which has none.
    const hasAo = !!(await mc.get('current-ao'));
    if (!hasAo && auds.length) say('   (no audio output device is available, so audio track switching can\'t be tested here)');
    for (let i = 0; hasAo && i < Math.min(auds.length, 4, aRows); i++) {
      await openMenu(); await clickRow('#ctx-audio-tracks .ctx-track-item', i); await page.waitForTimeout(900);
      const aid = await mc.get('aid');
      ok(aid === auds[i].id, `audio track ${describe(auds[i])}: mpv now playing aid ${aid}`);
    }
    await closeMenu();

    for (let i = 0; i < Math.min(subs.length, 5); i++) {
      await openMenu(); await clickRow('#ctx-sub-tracks .ctx-track-item', i + 1);      // row 0 is "Off"
      await page.waitForTimeout(900); await closeMenu();
      const sid = await mc.get('sid'), vis = await mc.get('sub-visibility');
      ok(sid === subs[i].id && vis !== false, `subtitle track ${describe(subs[i])}: mpv sid ${sid}, visible ${vis}`);
      // Find a moment with a line on screen, then have mpv draw it.
      let text = await mc.get('sub-text') || '';
      for (let k = 0; k < 8 && !text.trim(); k++) {
        await page.evaluate(() => bmApp.seekBy(15)); await page.waitForTimeout(900);
        text = await mc.get('sub-text') || '';
      }
      const shot = path.join(SHOTS, `yours-2-subtitle-${subs[i].id}.jpg`);
      await mc.cmd('screenshot-to-file', shot, 'subtitles');
      if (text.trim()) say(`         found a line: "${text.replace(/\s+/g, ' ').trim().slice(0, 70)}"  (${path.basename(shot)})`);
      else say(`         no text line found nearby${/pgs|dvd|hdmv|vobsub/i.test(subs[i].codec || '') ? ' (image-based subtitles have no text; see the screenshot)' : ''}  (${path.basename(shot)})`);
    }
    if (subs.length) {
      await openMenu(); await clickRow('#ctx-sub-tracks .ctx-track-item', 0); await page.waitForTimeout(700); await closeMenu();
      const vis = await mc.get('sub-visibility');
      ok(vis === false, `subtitles Off: mpv sub-visibility ${vis}`);
    }

    // Seek and pause, through the app.
    if (dur > 20) {
      const target = dur * 0.5;
      await page.evaluate(x => bmApp.seekTo(x), target); await page.waitForTimeout(1500);
      const pos = await mc.get('time-pos');
      ok(Math.abs((pos || 0) - target) < 5, `seek to the middle: mpv at ${pos ? pos.toFixed(1) : '?'}s, asked for ${target.toFixed(1)}s`);
    }
    await page.evaluate(() => bmApp.togglePlay()); await page.waitForTimeout(700);
    const paused = await mc.get('pause');
    await page.evaluate(() => bmApp.togglePlay()); await page.waitForTimeout(700);
    const resumed = await mc.get('pause');
    ok(paused === true && resumed === false, `pause and resume: mpv pause ${paused} then ${resumed}`);

    await page.evaluate(() => bmApp.stop()); await page.waitForTimeout(900);
    const home = await page.evaluate(() => document.getElementById('welcome-screen').classList.contains('active'));
    ok(home, 'stop returns to the home screen');
  } catch (e) {
    say('   error: ' + String(e.message || e).split('\n')[0].slice(0, 200));
  } finally {
    try { mc?.close(); } catch {}
    await app.close().catch(() => {});
    try { execFileSync(IS_WIN ? 'taskkill' : 'pkill', IS_WIN ? ['/F', '/IM', 'mpv.exe'] : ['-9', '-x', 'mpv'], { stdio: 'ignore', windowsHide: true }); } catch {}
  }
}

if (layers.length) {
  say('');
  say('== ANSWER ==');
  for (const c of CONFIGS) say(`   ${c.id.padEnd(16)} ${verdicts[c.id] || 'not run'}`);
  const works = CONFIGS.filter(c => results[c.id]?.pic && results[c.id]?.controls !== false);
  const picOnly = CONFIGS.filter(c => results[c.id]?.pic);
  if (works.length) say(`   -> WORKS: ${works.map(c => c.id).join(', ')}.`);
  else if (picOnly.length) say(`   -> the picture shows in ${picOnly.map(c => c.id).join(', ')}, but not with the controls on top.`);
  else say('   -> no configuration showed the picture inside the app.');
  if (IS_WIN) {
    const d = results['back (default)'], o = results['back with DirectComposition on (the old behaviour)'];
    if (d && d.pic && d.controls !== false) say('   -> THE DEFAULT WORKS: the picture and the controls over it are both visible.');
    else if (d) say('   -> the default did NOT show the picture here.');
    if (d && d.pic && o && !o.pic) say('   -> with DirectComposition on, the picture was hidden again, so that setting is what fixed it.');
  }
  // Only where the picture was hidden normally but there behind the controls window.
  const behind = CONFIGS.filter(c => results[c.id]?.behind === true && !results[c.id]?.pic);
  if (behind.length) say(`   -> with the controls window made invisible, the picture was there in: ${behind.map(c => c.id).join(', ')}. The controls window is what hides it.`);
  const embeddedOk = Object.entries(controlResults).filter(([, r]) => r.embedded === 'PICTURE').map(([vo]) => vo);
  if (IS_WIN && Object.keys(controlResults).length) say(embeddedOk.length
    ? `   -> embedded in a plain window, mpv shows the picture with: ${embeddedOk.join(', ')}. Embedding works; the app's windows are the difference.`
    : '   -> embedded in a plain window, mpv showed no picture with any output: embedding itself fails on this machine, not only in the app.');
  if (separateResult) say(`   -> mpv in its own window behind the controls: picture ${separateResult.pic ? 'VISIBLE' : 'not visible'}, controls ${separateResult.controls ? 'visible' : 'not seen'}.`);
  if (captureSeesMpv === false) say('   -> the capture cannot see mpv video here at all, so only your eyes can confirm the picture.');
}

writeSummary();
try { if (compositor) process.kill(-compositor.pid, 'SIGKILL'); } catch {}
try { fs.rmSync(FIX, { recursive: true, force: true }); } catch {}
clearTimeout(hard);
process.exit(0);
