/**
 * Which Chromium switches BM Player starts with.
 *
 * On Windows, Chromium draws each window through DirectComposition, a layer
 * that sits above the window's child windows. mpv's picture is a child
 * window. On a real Windows 11 machine the video played black in every
 * layout and with every mpv output (sound fine), while the same mpv showed
 * the picture embedded in a plain Windows window. With DirectComposition
 * off, the picture and the controls over it both showed, and a 1080p film
 * played with its subtitles. So Windows starts with it off.
 *
 * Decided in this order:
 *   1. the platform default (Windows: disable-direct-composition)
 *   2. "chromiumSwitches": [...] in flags.json replaces it ([] turns it off)
 *   3. --bm-switch=none on the command line clears everything so far
 *   4. --bm-switch=<name> adds one
 * Only the allow-listed names are ever applied.
 */
'use strict';

const ALLOWED = ['disable-gpu-compositing', 'disable-direct-composition', 'disable-gpu'];

function chromiumSwitches({ platform, argv = [], flags = {} } = {}) {
  let list = platform === 'win32' ? ['disable-direct-composition'] : [];
  if (Array.isArray(flags && flags.chromiumSwitches)) list = flags.chromiumSwitches.slice();
  for (const a of argv) {
    if (typeof a !== 'string' || !a.startsWith('--bm-switch=')) continue;
    const v = a.slice('--bm-switch='.length);
    if (v === 'none') list = [];
    else list.push(v);
  }
  return [...new Set(list.filter(s => ALLOWED.includes(s)))];
}

module.exports = { chromiumSwitches, ALLOWED };
