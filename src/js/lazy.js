/**
 * Loading a part the first time it is needed (v3.47.0).
 *
 * Until v3.47.0 the page read everything at every start: the two PDF
 * libraries (845 KB), the gallery, the PDF tools, TV with its saved channel
 * list, and the home screen's games, though most starts open none of them.
 * Those load when they are first used now.
 *
 *   once(key, load)    runs load() the first time, and gives every later call
 *                      the same promise. A load that fails is tried again on
 *                      the next call, not remembered as failed.
 *   loadScript(src)    a classic <script> (pdf.js and pdf-lib are not
 *                      modules), the same as a tag in the page, once.
 *
 * A local file loads in a few milliseconds, so the first use waits that much
 * and no more. The timeout is for a script that never answers at all (a
 * test page that does not run scripts): an error, not a promise left waiting.
 */
const pending = new Map();

export function once (key, load) {
  let p = pending.get(key);
  if (!p) {
    p = Promise.resolve().then(load);
    pending.set(key, p);
    p.catch(() => { if (pending.get(key) === p) pending.delete(key); });
  }
  return p;
}

export function loadScript (src, { timeout = 20000 } = {}) {
  return once('script:' + src, () => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    const done = (err) => { clearTimeout(timer); s.onload = s.onerror = null; if (err) { s.remove(); reject(err); } else resolve(); };
    const timer = setTimeout(() => done(new Error(`${src} did not load in ${timeout / 1000} s`)), timeout);
    s.src = src;
    s.onload = () => done();
    s.onerror = () => done(new Error(`${src} could not be loaded`));
    document.head.append(s);
  }));
}

/** Whether a part has been asked for yet (for the checks, and for code that only acts on a part already there). */
export const started = key => pending.has(key);
