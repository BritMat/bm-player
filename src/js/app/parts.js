/**
 * The tabs most starts never open (v3.47.0): the Gallery, the PDF tools and
 * TV. Each is loaded and set up the first time its tab opens (switchDest),
 * not at every start. TV was the costly one: its saved channel list, which
 * can be thousands of channels, was read, sorted and drawn at each start
 * into a tab that stayed hidden.
 *
 *   app.part('pdf').then(...)   the tab's part, set up once; the same promise after
 *
 * Its methods are BMPlayer's own: app.js copies them onto the player (mixin.js),
 * so `this` is the player.
 */
import { once, started } from '../lazy.js';
import { el } from '../util.js';

// Each tab's part, set up as it was at start before: window.bmGallery and
// window.bmPDF as the page has always called them, TV on the player itself.
const PARTS = {
  images: () => import('../dash/gallery.js').then(m => { window.bmGallery = new m.GalleryDash(window.api); return window.bmGallery; }),
  pdf: () => import('../dash/pdf.js').then(m => { window.bmPDF = new m.PDFViewer(window.api); return window.bmPDF; }),
  tv: app => import('../modules/tv.js').then(m => { app._tvStart(m.TVModule); return app.tvModule; }),
};
const VIEW = { images: 'gallery-view', pdf: 'pdf-view', tv: 'tv-view' };
const NAME = { images: 'Gallery', pdf: 'PDF', tv: 'TV' };

export default class PartsFeature {
  /**
   * A tab's part, set up the first time it is asked for. While it loads (a
   * few milliseconds) the tab's contents are kept out of sight, so a list it
   * fills in is not seen empty first. A part that fails to load says so, and
   * is tried again the next time the tab opens.
   */
  part(name){
    const key = name === 'gallery' ? 'images' : name, load = PARTS[key];
    if (!load) return Promise.reject(new Error('there is no part called ' + name));
    const first = !started('part:' + key);
    const p = once('part:' + key, () => load(this));
    if (first) {
      const view = el(VIEW[key]);
      if (view) view.dataset.loading = '';
      p.then(() => { if (view) delete view.dataset.loading; }, e => {
        if (view) delete view.dataset.loading;
        console.error(`[BM Player] the ${NAME[key]} tab could not be set up:`, e);
        this.showOSD?.(`The ${NAME[key]} tab could not be loaded`, 3500);
      });
    }
    return p;
  }
}
