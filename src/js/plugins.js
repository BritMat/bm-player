/**
 * BM Player — plugin manager
 *
 * Plugins are ES modules loaded into this same renderer context. There is no
 * process or iframe isolation, so a plugin has the same reach as the rest of
 * the UI layer. They receive a curated `BM` object rather than raw
 * `window.api`, which at least stops them calling IPC channels that were
 * never deliberately exposed.
 */

import { el, fileURL, escapeHtml, escapeAttr } from './util.js';

export class PluginManager {
  constructor(app) {
    this.app = app;
    this.plugins = [];       // manifests from main process
    this.loaded = new Map(); // id -> { module, api, panelEl }
    this._wire();
    this.reload();
  }

  _wire() {
    el('plugins-open-folder')?.addEventListener('click', () => this.app.api?.plugins?.openFolder());
    el('plugins-reload')?.addEventListener('click', () => this.reload());
  }

  async reload() {
    this.plugins = await this.app.api?.plugins?.list() || [];
    // Unload anything currently active before re-activating (simple approach:
    // deactivated plugins' panels are removed; re-enabled ones re-import fresh)
    this._teardownAll();
    for (const manifest of this.plugins) {
      if (!manifest.enabled) continue;
      if (manifest.type === 'theme') await this._activateTheme(manifest);
      else await this._activate(manifest);
    }
    this.refreshPanel();
  }

  // Theme plugins are CSS-only: fetch the stylesheet text and inject it as
  // a <style> tag (webSecurity:false already allows file:// fetches from
  // the renderer — the same technique the PDF merge feature uses), then
  // add a pill button to the theme selector wired to the SAME applyTheme()
  // the five built-in themes use, so a plugin theme behaves identically to
  // a built-in one once loaded (persists across restarts, works with
  // Ctrl-independent pill clicks, etc).
  async _activateTheme(manifest) {
    try {
      // The main process reads the file and returns it cleaned: no @import,
      // no url() except data:, so a theme cannot load anything.
      const css = await window.api?.plugins?.css?.(manifest.id);
      if (typeof css !== 'string' || !css) throw new Error('Could not read theme CSS');
      if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(manifest.themeKey || '')) throw new Error('bad theme key');

      const styleId = `plugin-theme-style-${manifest.id}`.replace(/[^a-zA-Z0-9_-]/g, '');
      let styleEl = document.getElementById(styleId);
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
      styleEl.textContent = css;

      const selector = document.querySelector('.theme-selector');
      if (selector && !selector.querySelector(`[data-theme="${CSS.escape(manifest.themeKey)}"]`)) {
        const pill = document.createElement('button');
        pill.className = 'tp plugin-theme-pill';
        pill.dataset.theme = manifest.themeKey;
        pill.title = manifest.name;
        pill.textContent = manifest.themeIcon || '🎨';
        pill.addEventListener('click', () => this.app.applyTheme?.(manifest.themeKey));
        selector.appendChild(pill);
        // Keep the pill's active/inactive state correct even though it
        // was added after wireThemes() already ran its own listener setup.
        pill.classList.toggle('active', document.documentElement.getAttribute('data-theme') === manifest.themeKey);
      }

      this.loaded.set(manifest.id, { manifest, styleEl });
    } catch (err) {
      console.error(`Theme plugin "${manifest.name}" failed to load:`, err);
      this.loaded.set(manifest.id, { manifest, error: err.message });
    }
  }

  async _activate(manifest) {
    try {
      // Same three-slash bug: plugin loading failed outright on Windows.
      const mod = await import(/* webpackIgnore: true */ fileURL(manifest.entryPath) + '?t=' + Date.now());
      if (typeof mod.activate !== 'function') {
        console.warn(`Plugin "${manifest.name}" has no activate() export — skipping.`);
        this.loaded.set(manifest.id, { manifest, error: 'No activate() export' });
        return;
      }
      const bm = this._buildBmApi(manifest.id);
      mod.activate(bm);
      this.loaded.set(manifest.id, { manifest, module: mod, api: bm });
    } catch (err) {
      console.error(`Plugin "${manifest.name}" failed to load:`, err);
      this.loaded.set(manifest.id, { manifest, error: err.message });
    }
  }

  _teardownAll() {
    // Remove any DOM panels plugins created; listeners are cleared by
    // resetting the app's plugin event bus entirely on reload.
    document.querySelectorAll('.plugin-panel').forEach(p => p.remove());
    document.querySelectorAll('.plugin-theme-pill').forEach(p => p.remove());
    document.querySelectorAll('style[id^="plugin-theme-style-"]').forEach(s => s.remove());
    this.app._pluginListeners = {};
    this.loaded.clear();
  }

  async setEnabled(id, enabled) {
    this.plugins = await this.app.api?.plugins?.setEnabled(id, enabled) || [];
    await this.reload();
  }

  refreshPanel() {
    const list = el('plugins-list');
    if (!list) return;
    if (!this.plugins.length) {
      list.innerHTML = '<div class="plugins-empty">No plugins found. Click "Folder" to add some.</div>';
      return;
    }
    list.innerHTML = this.plugins.map(p => {
      const loaded = this.loaded.get(p.id);
      const status = !p.enabled ? '' : loaded?.error ? '<span class="plugin-status err">Error</span>' : '<span class="plugin-status ok">Active</span>';
      const typeBadge = p.type === 'theme' ? '<span class="plugin-status" style="background:var(--accent-glow);color:var(--accent)">Theme</span>'
                      : '<span class="plugin-status">Script</span>';
      // Everything from a plugin is escaped. The description and error went
      // into the page as raw HTML, so a plugin.json description could run
      // code just by being listed, even for a theme or a switched-off plugin.
      const note = p.changed
        ? '<div class="plugin-desc" style="color:var(--danger)">Its files changed after you approved it, so it was switched off. Turn it on again to approve this version.</div>'
        : (p.needsApproval && !p.enabled)
          ? '<div class="plugin-desc">A script plugin you added: it runs with the player\'s full access. Turning it on asks you to confirm.</div>'
          : '';
      return `<div class="plugin-row" data-id="${escapeAttr(p.id)}">
        <div class="plugin-info">
          <div class="plugin-name">${escapeHtml(p.name)} <span style="color:var(--text-muted);font-weight:400">v${escapeHtml(String(p.version ?? '?'))}</span> ${typeBadge} ${status}</div>
          ${p.description ? `<div class="plugin-desc">${escapeHtml(p.description)}</div>` : ''}
          ${note}
          ${loaded?.error ? `<div class="plugin-desc" style="color:var(--danger)">${escapeHtml(String(loaded.error))}</div>` : ''}
        </div>
        <label class="ctx-toggle-wrap">
          <input type="checkbox" ${p.enabled ? 'checked' : ''} data-toggle-id="${escapeAttr(p.id)}" aria-label="${escapeAttr((p.enabled ? 'Turn off ' : 'Turn on ') + p.name)}">
          <span class="ctx-toggle"></span>
        </label>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-toggle-id]').forEach(cb => {
      cb.addEventListener('change', () => this.setEnabled(cb.dataset.toggleId, cb.checked));
    });
  }

  /** The curated API surface every plugin receives via activate(BM). */
  _buildBmApi(pluginId) {
    const app = this.app;
    return {
      version: '1.4.6',
      on:  (event, cb) => { (app._pluginListeners[event] ||= []).push(cb); },
      off: (event, cb) => { app._pluginListeners[event] = (app._pluginListeners[event]||[]).filter(f => f !== cb); },
      mpv: {
        cmd: (...args) => app.api?.mpv.cmd(...args),
      },
      ui: {
        toast: (msg, ms) => app.showOSD(msg, ms),
        /**
         * Creates a floating panel (same visual language as built-in side
         * panels) and a sidebar-adjacent toggle isn't auto-added — call
         * panel.open()/close() yourself, e.g. from a hook callback or your
         * own injected button.
         */
        addPanel: ({ id, title, render }) => {
          const panelId = `plugin-panel-${pluginId}-${id}`.replace(/[^a-zA-Z0-9_-]/g, '');
          let panel = document.getElementById(panelId);
          if (!panel) {
            panel = document.createElement('div');
            panel.id = panelId;
            panel.className = 'plugin-panel side-panel';
            panel.innerHTML = `<div class="panel-hdr"><span>${escapeHtml(title || 'Plugin')}</span><button class="panel-close" aria-label="Close ${escapeAttr(title || 'plugin')} panel">✕</button></div><div class="panel-body"></div>`;
            panel.querySelector('.panel-close').addEventListener('click', () => panel.classList.remove('open'));
            el('plugin-panels-root')?.appendChild(panel);
          }
          const body = panel.querySelector('.panel-body');
          try { render?.(body); } catch(err) { console.error(`Plugin panel render error (${pluginId}):`, err); }
          return {
            open:  () => panel.classList.add('open'),
            close: () => panel.classList.remove('open'),
            el: body,
          };
        },
      },
      storage: {
        get: (key) => { try { return JSON.parse(localStorage.getItem(`bm_plugin_${pluginId}_${key}`)); } catch(_) { return null; } },
        set: (key, val) => { try { localStorage.setItem(`bm_plugin_${pluginId}_${key}`, JSON.stringify(val)); } catch(_) {} },
      },
    };
  }
}
