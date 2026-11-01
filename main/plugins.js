'use strict';
/**
 * Plugins (v3.47.0, from main.js): finding them, their saved state, and the
 * page's messages about them. See plugin-safety.js for the rules.
 */
const { app, shell } = require('electron');
const path = require('path'), fs = require('fs');
const { ROOT } = require('./env');
const PS = require('../plugin-safety');
const { messageBox } = require('./dialogs');

// ── Plugin system ────────────────────────────────────────────────
// Two plugin locations are scanned:
//   1. <app root>/plugins   — bundled/dev plugins shipped with the app
//   2. <userData>/plugins   — user-installed plugins (survives updates)
// Each plugin is a folder containing plugin.json + an entry .js file.
// Enable/disable state persists in <userData>/plugins-state.json.
function getPluginDirs() {
  return [
    path.join(ROOT, 'plugins'),
    path.join(app.getPath('userData'), 'plugins'),
  ];
}
function ensurePluginDirs() {
  getPluginDirs().forEach(d => { try { fs.mkdirSync(d, { recursive: true }); } catch(_) {} });
}
function getPluginStatePath() { return path.join(app.getPath('userData'), 'plugins-state.json'); }
function readPluginState() {
  try { return JSON.parse(fs.readFileSync(getPluginStatePath(), 'utf8')); } catch(_) { return {}; }
}
function writePluginState(state) {
  try { fs.writeFileSync(getPluginStatePath(), JSON.stringify(state, null, 2)); } catch(_) {}
}
/* Plugins: see plugin-safety.js for the rules. Bundled plugins ship with the
   app and are trusted. Plugins you add are checked: files must stay inside
   their folder, script plugins start switched off and need a native
   confirmation, and are switched off again if their files change. */
function scanPlugins() {
  const state = readPluginState();
  const found = [];
  getPluginDirs().forEach((dir, di) => {
    const bundled = di === 0;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(_) { return; }
    entries.filter(e => e.isDirectory() && !/^[_.]/.test(e.name)).slice(0, PS.LIMITS.plugins).forEach(e => {
      const pluginDir = path.join(dir, e.name);
      try {
        const mPath = PS.safeChild(pluginDir, 'plugin.json', ['.json']);
        if (!mPath || fs.statSync(mPath).size > PS.LIMITS.manifestBytes) return;
        const m = PS.checkManifest(JSON.parse(fs.readFileSync(mPath, 'utf8')));
        if (!m) return;
        // Bundled ids keep their old form; yours get their own, so a plugin
        // you add can never borrow a bundled plugin's saved state.
        const id = bundled ? `plugins:${e.name}` : `user:${e.name}`;
        const saved = state[id];
        let entryPath = null, cssPath = null, enabled, changed = false;
        if (m.type === 'functional') {
          entryPath = PS.safeChild(pluginDir, m.entry, ['.js', '.mjs']);
          if (!entryPath || fs.statSync(entryPath).size > PS.LIMITS.scriptBytes) return;
          if (bundled) enabled = saved !== false;
          else {
            const digest = PS.folderDigest(pluginDir);
            if (!digest) return;
            const approved = !!(saved && typeof saved === 'object' && saved.enabled === true);
            changed = approved && saved.digest !== digest;
            enabled = approved && !changed;
          }
        } else {
          cssPath = PS.safeChild(pluginDir, m.css, ['.css']);
          if (!cssPath || fs.statSync(cssPath).size > PS.LIMITS.cssBytes) return;
          enabled = saved !== false;
        }
        found.push({ id, type: m.type, name: m.name, version: m.version, description: m.description,
          entryPath, cssPath, themeKey: m.themeKey || null, themeIcon: m.icon || null,
          enabled, bundled, needsApproval: m.type === 'functional' && !bundled, changed, dir: pluginDir });
      } catch(_) { /* a malformed plugin is skipped */ }
    });
  });
  return found;
}
/* The samples and README in your plugins folder. Never overwrites a file.
   Plain reads and writes rather than fs.cpSync, which may not read from the
   packaged app's asar archive. */
function installPluginTemplates(dest) {
  const copy = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name), b = path.join(to, e.name);
      if (e.isDirectory()) copy(a, b);
      else if (!fs.existsSync(b)) fs.writeFileSync(b, fs.readFileSync(a));
    }
  };
  try { copy(path.join(ROOT, 'plugin-templates'), dest); } catch(_) {}
}

function register(ipcMain) {
  // ── Plugin system IPC ────────────────────────────────────────────
  ipcMain.handle('plugins:list', () => scanPlugins());
  ipcMain.handle('plugins:setEnabled', async (_, id, enabled) => {
    const p = scanPlugins().find(x => x.id === id);
    if (!p) return scanPlugins();
    const state = readPluginState();
    if (!enabled) state[id] = p.needsApproval ? { enabled: false } : false;
    else if (p.needsApproval) {
      // The approval comes from a native dialog, which page code cannot click.
      const r = await messageBox({ type: 'warning', buttons: ['Cancel', 'Turn on'], defaultId: 0, cancelId: 0, noLink: true,
        title: 'Turn on a script plugin?', message: `Turn on "${p.name}"?`,
        detail: 'Script plugins run inside BM Player with its full access: your files, playback, and everything the player can do. ' +
                'Only turn on plugins you wrote yourself or trust completely.\n\nIf any of its files change later, it will be switched off until you approve it again.' });
      if (!r || r.response !== 1) return scanPlugins();
      const digest = PS.folderDigest(p.dir);
      if (!digest) return scanPlugins();
      state[id] = { enabled: true, digest };
    } else state[id] = true;
    writePluginState(state);
    return scanPlugins();
  });
  // Theme CSS goes to the page already cleaned: nothing in it can load anything.
  ipcMain.handle('plugins:css', (_, id) => {
    const p = scanPlugins().find(x => x.id === id && x.type === 'theme' && x.enabled);
    if (!p) return '';
    try { return PS.cleanCss(fs.readFileSync(p.cssPath, 'utf8')); } catch(_) { return ''; }
  });
  ipcMain.handle('plugins:openFolder', () => {
    const userPluginsDir = getPluginDirs()[1];
    try { fs.mkdirSync(userPluginsDir, { recursive: true }); } catch(_) {}
    installPluginTemplates(userPluginsDir);
    shell.openPath(userPluginsDir);
  });
}

module.exports = { getPluginDirs, ensurePluginDirs, readPluginState, writePluginState, scanPlugins, installPluginTemplates, register };
