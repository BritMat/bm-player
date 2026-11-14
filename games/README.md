# What the Games tab fetches

BM Player's installers do not carry these files. The app fetches a game from
here the first time it is wanted, checks each file against the length and
SHA-256 listed in `main/games-catalog.json`, and keeps it in its own folder.

- `trail/`, `bricks/`, `merge/`, `mines/`, `pairs/`: small games written for
  BM Player, each one HTML file. MIT, as the app is.
- `cores/mgba/1.1.1/`: mGBA built for the web, `mgba.js` and `mgba.wasm` from
  the npm package `@thenick775/mgba-wasm` 1.1.1, unchanged. mGBA is under the
  Mozilla Public License 2.0 (`LICENSE.txt` beside it). Its source is at
  https://github.com/thenick775/mgba/tree/feature/wasm and
  https://github.com/mgba-emu/mgba. No game comes with it.

The files of a version already published must not change: the app in
people's hands expects exactly those bytes. A game that changes gets a new
version folder, and `node scripts/games-catalog.mjs` writes the new list.
