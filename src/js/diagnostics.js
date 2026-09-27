/**
 * BM Player — diagnostics
 *
 * Collects everything needed to explain why the app is misbehaving on a
 * machine nobody debugging it can see: versions, where mpv was found, which
 * GPU features are actually available, which audio codecs the browser will
 * decode, and what the performance tier decided.
 *
 * The output is deliberately plain text, because the point is that someone
 * can paste it into a bug report.
 */

import { perf } from './perf.js';
import { AudioEngine } from './audio-engine.js';

/** Probe WebGL without leaving a context lying around. */
function probeWebGL() {
  const out = { webgl2: false, webgl1: false, halfFloatRenderable: false, renderer: null, vendor: null };
  let canvas, gl;
  try {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2');
    out.webgl2 = !!gl;
    if (!gl) { gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); }
    out.webgl1 = !!gl;
    if (!gl) return out;

    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      out.renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      out.vendor   = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
    }

    // This is the exact capability fluid.js needs. Reporting "WebGL: yes"
    // while the fluid sim silently falls back to particles helps nobody.
    if (out.webgl2) {
      gl.getExtension('EXT_color_buffer_float');
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      out.halfFloatRenderable = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.deleteTexture(tex); gl.deleteFramebuffer(fbo);
    } else {
      out.halfFloatRenderable = !!gl.getExtension('OES_texture_half_float');
    }
  } catch (e) {
    out.error = e.message;
  } finally {
    try { gl && gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (_) {}
  }
  return out;
}

function probeCodecs() {
  const a = document.createElement('audio');
  const types = {
    mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav',
    aac: 'audio/aac', m4a: 'audio/mp4; codecs="mp4a.40.2"',
    ogg: 'audio/ogg; codecs="vorbis"', opus: 'audio/ogg; codecs="opus"',
  };
  const out = {};
  for (const [k, mime] of Object.entries(types)) {
    try { out[k] = a.canPlayType(mime) || 'no'; } catch (_) { out[k] = 'error'; }
  }
  return out;
}

export async function collectDiagnostics(api) {
  const d = {
    generated: new Date().toISOString(),
    main: null,
    renderer: {
      perfTier: perf.tier,
      liteMode: document.documentElement.classList.contains('lite-mode'),
      theme: document.documentElement.getAttribute('data-theme'),
      devicePixelRatio: window.devicePixelRatio,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      deviceMemoryGB: navigator.deviceMemory ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      language: navigator.language,
    },
    webgl: probeWebGL(),
    audio: {
      webAudio: AudioEngine.isSupported(),
      engineEnabled: localStorage.getItem('bm_audio_engine') !== '0',
      engineActive: !!window.bmMusic?.engineOwns?.(),
      codecs: probeCodecs(),
    },
    features: {
      fluidGPU: !!window.bmApp?._fluidIsGPU,
      fox: window.bmApp?.fox ? (window.bmApp.fox.describe?.() || window.bmApp.fox.kind || 'present') : 'none',
      colorMix: (() => { try { return CSS.supports('color', 'color-mix(in srgb, red 50%, blue)'); } catch (_) { return false; } })(),
    },
  };
  try { d.main = await api?.app?.diagnostics?.(); }
  catch (e) { d.main = { error: e.message }; }
  return d;
}

/** Plain text, wide-labelled, so it survives being pasted anywhere. */
export function formatDiagnostics(d) {
  const L = [];
  const head = t => { L.push(''); L.push('── ' + t + ' ' + '─'.repeat(Math.max(0, 46 - t.length))); };
  const row  = (k, v) => L.push('  ' + String(k).padEnd(22) + (v === null || v === undefined ? '—' : String(v)));

  L.push('BM Player diagnostics');
  L.push(d.generated);

  const m = d.main && !d.main.error ? d.main : null;
  head('Application');
  row('mode', m?.flags?.compat ? 'COMPATIBILITY (start:compat)' : 'normal');
  if (m?.flags) row('flags', `files:${m.flags.fileScheme} audio-engine:${m.flags.audioEngine} gpu-fluid:${m.flags.gpuFluid}`);
  if (m?.flags) row('video', `layer:${m.flags.videoLayer || '?'} mpv-output:${m.flags.mpvVo || 'default'} chromium-switches:${(m.flags.chromiumSwitches || []).join(',') || 'none'}`);
  row('version',  m?.app.version);
  row('packaged', m?.app.packaged);
  row('build',    m?.app.liteBuild ? 'Lite' : 'Full');
  row('lite mode active', d.renderer.liteMode);
  row('perf tier', d.renderer.perfTier);
  row('theme',     d.renderer.theme);

  head('Versions');
  row('electron', m?.versions.electron);
  row('chrome',   m?.versions.chrome);
  row('node',     m?.versions.node);

  head('System');
  row('platform', m ? `${m.system.platform} ${m.system.arch} (${m.system.release})` : null);
  row('cpu',      m?.system.cpu);
  row('cores',    m?.system.cpuCount);
  row('memory',   m ? `${m.system.freeMemGB} GB free of ${m.system.totalMemGB} GB` : null);
  row('viewport', `${d.renderer.viewport} @ ${d.renderer.devicePixelRatio}x`);

  head('mpv');
  if (m?.mpv.found) {
    row('path', m.mpv.path);
    row('version', m.mpv.version || 'could not run --version');
    row('socket connected', m.mpv.connected);
  } else {
    row('found', 'NO — playback will not start');
    row('searched', 'bundled vendor/mpv, resources/mpv, bin/, and PATH');
  }

  head('Graphics');
  row('webgl2', d.webgl.webgl2);
  row('renderer', d.webgl.renderer);
  row('half-float targets', d.webgl.halfFloatRenderable + (d.webgl.halfFloatRenderable ? '' : '  (fluid sim falls back)'));
  row('fluid sim on GPU', d.features.fluidGPU);
  row('fox', d.features.fox);
  row('color-mix()', d.features.colorMix);
  if (m?.gpu?.auxAttributes) row('gpu status', JSON.stringify(m.gpu.auxAttributes).slice(0, 120));

  head('Audio');
  row('web audio', d.audio.webAudio);
  row('engine enabled', d.audio.engineEnabled);
  row('engine active now', d.audio.engineActive);
  row('codecs', Object.entries(d.audio.codecs).map(([k, v]) => `${k}:${v === 'probably' ? 'yes' : v === 'maybe' ? 'maybe' : 'no'}`).join(' '));

  head('Caches');
  row('thumbnails', m ? m.caches.thumbsMB + ' MB' : null);
  row('cover art',  m ? m.caches.coversMB + ' MB' : null);
  row('userData',   m?.app.userData);

  if (m?.errorLog) {
    head('Recent main-process errors');
    row('total lines', m.errorLog.lines);
    m.errorLog.tail.forEach(t => L.push('    ' + t.slice(0, 150)));
  }
  if (d.main?.error) {
    head('Main process');
    row('error', d.main.error);
  }

  L.push('');
  return L.join('\n');
}
