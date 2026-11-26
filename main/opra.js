'use strict';
/**
 * Headphone correction's data (v3.59.0, the plan's 3.59): OPRA, an open
 * database of headphones and EQ curves for them (github.com/opra-project/
 * OPRA, its data CC BY-SA 4.0). One file, database_v1.jsonl, about 13 MB,
 * fetched the first time a pair of headphones is looked for, from the mirror
 * OPRA asks open-source players to use (opra.roonlabs.net), and kept. It is
 * fetched again when two weeks old, and the kept one is used meanwhile and
 * when the mirror cannot be reached.
 *
 *   opra:search (query)  up to 40 headphones whose maker and name match, each
 *                        with its EQ curves (who made each, and from what)
 *   opra:eq (id)         one curve: its gain and bands, ready for
 *                        sound-chain.js (peaks and shelves; a band of a kind
 *                        it does not have is left out, and counted)
 *   opra:status          whether the database is here, and how old
 */
const { app, net: electronNet } = require('electron');
const fs = require('fs');
const path = require('path');

const URLS = ['https://opra.roonlabs.net/database_v1.jsonl', 'http://opra.roonlabs.net/database_v1.jsonl'];
const STALE_MS = 14 * 24 * 3600 * 1000;
const KINDS = { peak_dip: 'peak', low_shelf: 'lowshelf', high_shelf: 'highshelf' };

let db = null, loading = null;
const file = () => path.join(app.getPath('userData'), 'opra', 'database_v1.jsonl');
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** The JSONL read into vendors, products and curves, products with curves only. */
function parse (text) {
  const vendors = new Map(), products = new Map(), eqs = new Map();
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch (_) { continue; }
    if (o.type === 'vendor') vendors.set(o.id, o.data?.name || o.id);
    else if (o.type === 'product') products.set(o.id, { id: o.id, name: o.data?.name || o.id, vendor: o.data?.vendor_id, kind: o.data?.subtype || o.data?.type || '', eqs: [] });
    else if (o.type === 'eq' && o.data?.type === 'parametric_eq') eqs.set(o.id, { id: o.id, product: o.data.product_id, author: o.data.author || '', details: o.data.details || '', link: o.data.link || '', p: o.data.parameters || {} });
  }
  for (const e of eqs.values()) products.get(e.product)?.eqs.push(e.id);
  const list = [];
  for (const p of products.values()) {
    if (!p.eqs.length) continue;
    p.vendorName = vendors.get(p.vendor) || p.vendor || '';
    p.key = norm(p.vendorName + ' ' + p.name);
    list.push(p);
  }
  return { list, eqs, products };
}

async function fetchText (ua) {
  let last = null;
  for (const url of URLS) {
    const stop = new AbortController(), t = setTimeout(() => stop.abort(), 120000);
    try {
      const r = await electronNet.fetch(url, { headers: { 'User-Agent': ua }, signal: stop.signal });
      if (!r.ok) { last = new Error('the OPRA mirror answered ' + r.status); continue; }
      const text = await r.text();
      if (!/"type":"product"/.test(text.slice(0, 200000))) { last = new Error('what came back was not the OPRA database'); continue; }
      return text;
    } catch (e) { last = e; } finally { clearTimeout(t); }
  }
  throw last || new Error('the OPRA mirror could not be reached');
}

/** The database, from the file kept, fetched when there is none or it is old. */
async function load (ua) {
  if (db) return db;
  if (loading) return loading;
  loading = (async () => {
    const f = file();
    let text = null, age = Infinity;
    try { text = fs.readFileSync(f, 'utf8'); age = Date.now() - fs.statSync(f).mtimeMs; } catch (_) {}
    if (!text || age > STALE_MS) {
      try {
        const fresh = await fetchText(ua);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f + '.part', fresh); fs.renameSync(f + '.part', f);
        text = fresh;
      } catch (e) { if (!text) throw e; }   // the one kept, when the mirror cannot be reached
    }
    db = parse(text);
    return db;
  })();
  try { return await loading; } finally { loading = null; }
}

/** Headphones matching every word of the query, makers' full names first. */
function search (d, query) {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const hits = d.list.filter(p => words.every(w => p.key.includes(w)));
  const q = norm(query);
  hits.sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || a.key.length - b.key.length || a.key.localeCompare(b.key));
  return hits.slice(0, 40).map(p => ({
    id: p.id, name: p.name, vendor: p.vendorName, kind: p.kind,
    eqs: p.eqs.map(id => { const e = d.eqs.get(id); return { id, author: e.author, details: e.details }; }),
  }));
}

/** One curve, for sound-chain.js: { id, name, author, details, link, gain, bands, skipped }. */
function curve (d, id) {
  const e = d.eqs.get(id); if (!e) return null;
  const p = d.products.get(e.product) || {};
  const bands = [], kinds = e.p.bands || [];
  let skipped = 0;
  for (const b of kinds) {
    const t = KINDS[b.type];
    if (!t || !(b.frequency > 0)) { skipped++; continue; }
    bands.push([t, +b.frequency, +b.gain_db || 0, +b.q || 0.707]);
  }
  return { id, name: ((p.vendorName || '') + ' ' + (p.name || '')).trim(), author: e.author, details: e.details, link: e.link, gain: +e.p.gain_db || 0, bands: bands.slice(0, 20), skipped: skipped + Math.max(0, bands.length - 20) };
}

function register (ipcMain) {
  const ua = `BM Player ${app.getVersion()} (https://github.com/BritMat/bm-player)`;
  ipcMain.handle('opra:search', async (_, query) => {
    try { return { ok: true, results: search(await load(ua), String(query || '').slice(0, 80)) }; } catch (e) { return { ok: false, error: String(e?.message || e) }; }
  });
  ipcMain.handle('opra:eq', async (_, id) => {
    try { return { ok: true, eq: curve(await load(ua), String(id || '')) }; } catch (e) { return { ok: false, error: String(e?.message || e) }; }
  });
  ipcMain.handle('opra:status', () => {
    try { const st = fs.statSync(file()); return { here: true, age: Date.now() - st.mtimeMs }; } catch (_) { return { here: false }; }
  });
}

module.exports = { register, parse, search, curve };
