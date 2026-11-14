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
// Games by other people, under open licences, as their authors published
// them: no file is changed, and each keeps its licence beside it. `from` is
// the repository and the commit the files were taken at. The words about
// each game are its author's own. A game is added only if it runs under the
// built-in games' policy: nothing from the network and no eval.
const LJ = { by: 'Frank Force', licence: 'MIT', source: 'https://github.com/KilledByAPixel/LittleJSArcade', from: 'KilledByAPixel/LittleJSArcade@c14102b', shared: ['littlejs'], query: 'engine=min' };
const lj = (file, name, blurb, more) => ({ id: 'lj-' + file.toLowerCase(), version: 1, name, blurb, entry: 'games/' + file + '.html', ...LJ, ...more });
const OPEN = [
  lj('chess', 'Chess', 'The classic game of kings and pawns.'),
  lj('checkers', 'Checkers', 'Jump to capture your rival.'),
  lj('go', 'Go', 'Surround territory on a 9 by 9 board.'),
  lj('reversi', 'Reversi', 'Flank stones to flip them.'),
  lj('dominoes', 'Dominoes', 'Match tiles end to end.'),
  lj('klondike', 'Klondike Solitaire', 'Arrange cards into foundation piles.'),
  lj('freecell', 'FreeCell Solitaire', 'Sort every card back home.'),
  lj('sudoku', 'Sudoku', 'Fill the grid with 1-9.'),
  lj('matchThree', 'Match Three', 'Swap gems to match three.'),
  lj('pool', 'Pool', 'Cue up and sink all the balls.', { shared: ['littlejs', 'box2d'] }),
  lj('miniGolf', 'Mini Golf', 'Putt across tricky little courses.', { shared: ['littlejs', 'box2d'] }),
  lj('freeThrow', 'Free Throw', 'Sink free throws before time runs out.'),
  lj('moonLander', 'Moon Lander', 'Touch down gently.'),
  lj('skiing', 'Skiing', 'Carve downhill through the gates.'),
  lj('speedway', 'Speedway', 'Pass other racers and beat the clock.'),
  { id: 'radius-raid', version: 1, name: 'Radius Raid', blurb: 'A space shoot \'em up: blast away unrelenting enemies before they destroy you.', keys: 'W A S D or arrows to move, mouse to aim and fire, F autofire, P pause, M mute',
    by: 'Jack Rugile', licence: 'MIT', source: 'https://github.com/jackrugile/radius-raid-js13k', from: 'jackrugile/radius-raid-js13k@361ab51', entry: 'index.html' },
];
// What several games share, fetched once with the first game that needs it.
// The games ask for these under dist/. In the repository the folder is
// called engine/, because a folder named dist is build output everywhere
// else here: Git ignores it and the publishing step leaves it out. Each
// file is listed with where it is kept (src) and the path it is served at.
const SERVED_AS = { 'engine/': 'dist/' };
const SHARED = [
  { id: 'littlejs', version: 1, name: 'LittleJS', by: 'Frank Force', licence: 'MIT', source: 'https://github.com/KilledByAPixel/LittleJS' },
  { id: 'box2d', version: 1, name: 'Box2D', by: 'Erin Catto', licence: 'zlib', source: 'https://github.com/KilledByAPixel/LittleJS' },
];
const served = list => list.map(f => { for (const [from, to] of Object.entries(SERVED_AS)) if (f.path.startsWith(from)) return { path: to + f.path.slice(from.length), src: f.path, size: f.size, sha256: f.sha256 }; return f; });
const CORE = { id: 'mgba', version: '1.1.1', name: 'mGBA', licence: 'MPL-2.0', source: 'https://github.com/thenick775/mgba/tree/feature/wasm' };

function files(dir) {
  const out = [];
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) { if (e.isDirectory()) walk(path.join(d, e.name), rel + e.name + '/'); else { const buf = fs.readFileSync(path.join(d, e.name)); out.push({ path: rel + e.name, size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') }); } } };
  walk(dir, '');
  if (!out.length) throw new Error('nothing in ' + dir);
  // such a folder would be in the zip and never reach GitHub, and the app would be refused the file
  const lost = out.find(f => /(^|\/)(dist|dist-lite|node_modules|out|build)\//.test(f.path) || /\.log$/.test(f.path));
  if (lost) throw new Error(dir + ': ' + lost.path + ' is in a folder, or of a kind, that publishing leaves out');
  return out;
}
const catalog = {
  builtin: BUILTIN.map(g => ({ ...g, files: files(path.join(GAMES, g.id, String(g.version))) })),
  open: OPEN.map(g => ({ ...g, files: files(path.join(GAMES, g.id, String(g.version))) })),
  shared: SHARED.map(g => ({ ...g, files: served(files(path.join(GAMES, g.id, String(g.version)))) })),
  core: { ...CORE, files: files(path.join(GAMES, 'cores', CORE.id, CORE.version)) },
};
const text = JSON.stringify(catalog, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (have !== text) { console.error('main/games-catalog.json is not what games/ holds. Run: node scripts/games-catalog.mjs'); process.exit(1); }
  console.log('games catalogue: ' + catalog.builtin.length + ' games of our own, ' + catalog.open.length + ' by others and the GBA core, as listed');
} else {
  fs.writeFileSync(OUT, text);
  console.log('wrote main/games-catalog.json: ' + catalog.builtin.concat(catalog.open).map(g => g.id).join(', ') + ', and ' + CORE.id + ' ' + CORE.version);
}
