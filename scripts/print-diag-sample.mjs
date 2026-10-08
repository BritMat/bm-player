// perf.js reads localStorage at import time, and diagnostics.js imports it.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// Node 20+ makes navigator a getter-only global; it already provides the
// two fields diagnostics reads, so leave it alone.
// Static imports hoist above the stubs above, so load it dynamically.
const { formatDiagnostics } = await import('../src/js/diagnostics.js');
console.log(formatDiagnostics({
  generated: '2026-09-14T10:00:00.000Z',
  renderer: { perfTier: 'low', liteMode: true, theme: 'northern', devicePixelRatio: 1,
              viewport: '1366x768', deviceMemoryGB: 4, hardwareConcurrency: 2, language: 'en-IE' },
  webgl: { webgl2: true, webgl1: true, halfFloatRenderable: false, renderer: 'Intel(R) UHD Graphics 610', vendor: 'Intel' },
  audio: { webAudio: true, engineEnabled: true, engineActive: true,
           codecs: { mp3: 'probably', flac: 'probably', wav: 'probably', aac: 'maybe', m4a: 'probably', ogg: 'probably', opus: 'probably' } },
  features: { fluidGPU: false, foxWebGL: true, colorMix: true },
  main: {
    app: { version: '3.2.0', packaged: true, liteBuild: true, appPath: 'C:\\\\Program Files\\\\BM Player', userData: 'C:\\\\Users\\\\b\\\\AppData\\\\Roaming\\\\bm-player' },
    versions: { electron: '44.3.0', chrome: '140.0.7339.5', node: '22.9.0' },
    system: { platform: 'win32', arch: 'x64', release: '10.0.19045', cpu: 'Intel(R) Celeron(R) N4020', cpuCount: 2, totalMemGB: 3.8, freeMemGB: 1.1 },
    mpv: { found: false, path: null, version: null, connected: false },
    gpu: {}, caches: { thumbsMB: 184.3, coversMB: 12.1 }, window: null,
    errorLog: { lines: 3, entries: 1, tail: ['[2026-09-14T09:58:11Z] uncaughtException: EPERM: operation not permitted', "    at Object.openSync (node:fs:573:18)"] },
  },
}));
