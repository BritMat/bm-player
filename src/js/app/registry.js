/**
 * What a feature adds to the player from its own file (v3.47.0).
 *
 * Until now a new menu item meant a line in app.js's handleAction, a new key
 * a branch in its keyboard handler, and a new setting a control in the
 * Preferences markup plus its wiring. A feature can add each of them from its
 * own file instead:
 *
 *   defineAction('sound-lab', app => app.openPanel('soundlab'),
 *                { menu: 'Tools', label: 'Sound lab…', before: 'preferences' })
 *     A menu action. Any element with data-a="sound-lab" runs it, and with
 *     `menu` a row for it is put in that menu (Media, Playback, Audio, Video,
 *     Subtitle or Tools), before the row named by `before`, or at the end.
 *
 *   defineShortcut({ code: 'KeyE', ctrl: true, label: 'Sound lab', group: 'Sound',
 *                    run: app => app.handleAction('sound-lab') })
 *     A key. It is tried after the player's own keys, so it can never take a
 *     key the player already uses, and it shows in the shortcuts list (?).
 *
 *   defineSetting({ id: 'scenes.calm', label: 'Calm home screen', type: 'toggle',
 *                   default: false, onChange: v => ... })
 *     A setting in Preferences, under "Features", kept with the other settings
 *     (exported, imported and reset with them). type is 'toggle', 'range'
 *     (min, max, step, unit) or 'select' (options: [[value, label], ...]).
 *     settingValue(id) reads it.
 *
 * Nothing here costs anything until a feature uses it: an action is one look
 * in a Map when a menu row is clicked, a shortcut one short list read when a
 * key is pressed that the player has no use for, and the settings are drawn
 * when Preferences opens.
 */
import settings from '../modules/settings.js';

const actions = new Map();     // name -> { run(app), menu, label, key, before }
const shortcuts = [];          // { code, ctrl, shift, alt, label, group, run(app, e), when(app) }
const items = [];              // settings: { id, label, type, default, ... }

export function defineAction (name, run, place = {}) {
  if (typeof name !== 'string' || !/^[a-z][\w.-]*$/i.test(name) || typeof run !== 'function') throw new TypeError('defineAction(name, run)');
  if (actions.has(name)) throw new Error(`the action "${name}" is defined twice`);
  actions.set(name, { run, ...place });
}
/** Runs a feature's action. False when no feature defined one by that name. */
export function runAction (app, name) {
  const a = actions.get(name);
  if (!a) return false;
  try { a.run(app); } catch (e) { console.warn(`[BM Player] the action "${name}" failed:`, e); }
  return true;
}
/** The menu rows features asked for, put into the page's menus once, at start. */
const rowFor = (scope, name) => [...scope.querySelectorAll('.mr[data-a]')].find(r => r.dataset.a === name) || null;
export function placeActions (root = document) {
  if (!actions.size) return;
  const doc = root.ownerDocument || root;
  for (const [name, a] of actions) {
    if (!a.menu || !a.label || rowFor(root, name)) continue;
    const menu = [...root.querySelectorAll('.mi')].find(m => m.querySelector('.mi-label')?.textContent.trim() === a.menu);
    const drop = menu?.querySelector('.mi-drop');
    if (!drop) { console.warn(`[BM Player] the action "${name}" asked for a menu called ${a.menu}, and there is none`); continue; }
    const row = doc.createElement('div');
    row.className = 'mr'; row.dataset.a = name; row.textContent = a.label;
    if (a.key) { const k = doc.createElement('kbd'); k.textContent = a.key; row.append(' ', k); }
    drop.insertBefore(row, a.before ? rowFor(drop, a.before) : null);
  }
}

const MODS = ['ctrl', 'shift', 'alt'];
export function defineShortcut (s) {
  if (!s || typeof s.code !== 'string' || typeof s.run !== 'function' || !s.label) throw new TypeError('defineShortcut({ code, label, run })');
  if (shortcuts.some(x => x.code === s.code && MODS.every(k => !!x[k] === !!s[k]))) throw new Error(`the shortcut ${keyName(s)} is defined twice`);
  shortcuts.push({ group: 'More', ...s });
}
/** A key the player's own handler had no use for: a feature's, if one asked for it. */
export function matchShortcut (app, e) {
  for (const s of shortcuts) {
    if (s.code !== e.code || !!s.ctrl !== !!e.ctrlKey || !!s.shift !== !!e.shiftKey || !!s.alt !== !!e.altKey) continue;
    if (s.when && !s.when(app)) continue;
    e.preventDefault();
    try { s.run(app, e); } catch (err) { console.warn(`[BM Player] the shortcut ${keyName(s)} failed:`, err); }
    return true;
  }
  return false;
}
export function keyName (s) {
  const key = s.code.replace(/^Key|^Digit/, '').replace(/^Arrow/, '');
  return [s.ctrl && 'Ctrl', s.alt && 'Alt', s.shift && 'Shift', key].filter(Boolean).join('+');
}
export const shortcutList = () => shortcuts.slice();

const TYPES = ['toggle', 'range', 'select'];
export function defineSetting (d) {
  if (!d || typeof d.id !== 'string' || !/^[a-z][\w.-]*$/i.test(d.id) || !d.label || !TYPES.includes(d.type)) throw new TypeError('defineSetting({ id, label, type })');
  if (items.some(x => x.id === d.id)) throw new Error(`the setting "${d.id}" is defined twice`);
  items.push(d);
}
const keyOf = id => 'features.' + id;
export function settingValue (id) {
  const d = items.find(x => x.id === id);
  const v = settings.get(keyOf(id));
  return v === undefined ? d?.default : v;
}
export function setSetting (id, v) {
  const d = items.find(x => x.id === id);
  settings.set(keyOf(id), v);
  try { d?.onChange?.(v); } catch (e) { console.warn(`[BM Player] the setting "${id}" failed to apply:`, e); }
}
export const settingList = () => items.slice();
