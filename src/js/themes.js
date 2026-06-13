/**
 * BM Player — Theme Manager
 */
export class ThemeManager {
  constructor () {
    this.themes  = ['dark', 'light', 'glass'];
    this.current = localStorage.getItem('bm_theme') || 'dark';
    this.apply(this.current, false);
  }

  apply (name, save = true) {
    if (!this.themes.includes(name)) name = 'dark';
    this.current = name;
    document.documentElement.setAttribute('data-theme', name);
    if (save) localStorage.setItem('bm_theme', name);

    // Sync all theme toggles
    document.querySelectorAll('[data-theme]').forEach(el => {
      el.classList.toggle('active', el.dataset.theme === name);
    });
  }

  cycle () {
    const idx = this.themes.indexOf(this.current);
    this.apply(this.themes[(idx + 1) % this.themes.length]);
  }
}
