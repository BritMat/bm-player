#!/usr/bin/env node
/**
 * The list of what the Games tab can fetch (v3.53.0): main/games-catalog.json,
 * made from the games/ folder. Each file is listed with its length and its
 * SHA-256, and the app keeps nothing that does not match.
 *
 *   node scripts/games-catalog.mjs           writes the list
 *   node scripts/games-catalog.mjs --check   fails if the list is not what games/ holds
 *
 * A game that changes gets a new version folder (games/<id>/2/): the files
 * of a version already published are never changed, because the app in
 * people's hands expects exactly those.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(ROOT, 'games'), OUT = path.join(ROOT, 'main', 'games-catalog.json');

// What the tab says of each. The order here is the order shown.
const BUILTIN = [
  { id: 'trail', version: 1, name: 'Trail', blurb: 'Steer a line that grows with every dot it reaches.', keys: 'Arrow keys or W A S D, Space to pause' },
  { id: 'bricks', version: 1, name: 'Bricks', blurb: 'A bat, a ball and walls of bricks, each faster than the last.', keys: 'Arrow keys or the mouse, Space to send the ball' },
  { id: 'merge', version: 1, name: 'Merge', blurb: 'Slide the numbers. Two alike become one.', keys: 'Arrow keys or W A S D' },
  { id: 'mines', version: 1, name: 'Mines', blurb: 'Open every square that hides no mine.', keys: 'Click to open, right-click or F to mark' },
  { id: 'pairs', version: 1, name: 'Pairs', blurb: 'Turn the cards two at a time and find every pair.', keys: 'Click or Tab and Enter' },
];
const CORE = { id: 'mgba', version: '1.1.1', name: 'mGBA', licence: 'MPL-2.0', source: 'https://github.com/thenick775/mgba/tree/feature/wasm' };

function files(dir) {
  const out = [];
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) { if (e.isDirectory()) walk(path.join(d, e.name), rel + e.name + '/'); else { const buf = fs.readFileSync(path.join(d, e.name)); out.push({ path: rel + e.name, size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') }); } } };
  walk(dir, '');
  if (!out.length) throw new Error('nothing in ' + dir);
  return out;
}
const catalog = {
  builtin: BUILTIN.map(g => ({ ...g, files: files(path.join(GAMES, g.id, String(g.version))) })),
  core: { ...CORE, files: files(path.join(GAMES, 'cores', CORE.id, CORE.version)) },
};
const text = JSON.stringify(catalog, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (have !== text) { console.error('main/games-catalog.json is not what games/ holds. Run: node scripts/games-catalog.mjs'); process.exit(1); }
  console.log('games catalogue: ' + catalog.builtin.length + ' games and the GBA core, as listed');
} else {
  fs.writeFileSync(OUT, text);
  console.log('wrote main/games-catalog.json: ' + catalog.builtin.map(g => g.id).join(', ') + ', and ' + CORE.id + ' ' + CORE.version);
}
