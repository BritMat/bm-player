/**
 * m-delete (v3.45.0): pictures, videos and songs deleted from the phone.
 *
 * Java does it (MediaDelete.java). From Android 11, Android itself asks
 * first ("Allow BM Player to delete these 3 photos?"), and no permission is
 * needed. Android 10 and older do not ask, so the page does, and the app
 * needs the storage permission there (asked for the first time). Android 10
 * may also ask about a file another app made.
 *
 * What really went comes back (a 'deleted' event) and is taken out of
 * everything: the lists, the favourites, Resume, where videos were left,
 * the queue, and what is chosen. Then the tabs draw themselves again
 * (onDeleted).
 */
import { call, on, has, info } from './m-android.js';
import { sheet, toast } from './m-ui.js';
import { forgetMedia } from './m-library.js';
import { removeFavs } from './m-favs.js';
import { clearPositions, forgetWhere } from './m-recent.js';
import { player } from './m-player.js';
import { dropChosen } from './m-select.js';

const NAMES = { image: ['picture', 'pictures'], video: ['video', 'videos'], audio: ['song', 'songs'] };
const MAX = 5000;
/** "1 picture", "3 songs". */
export const howMany = (kind, n) => `${n} ${(NAMES[kind] || ['file', 'files'])[n === 1 ? 0 : 1]}`;

const fns = new Set();
/** fn(kind, ids) once things were deleted from the phone, for the lists to draw themselves again. */
export const onDeleted = fn => { fns.add(fn); };
/** Whether this app can delete (the page and the app ship together, so it always can on a phone). */
export const canDelete = () => has('deleteMedia');

let waiting = null;            // { kind, resolve, at } while Java works or Android asks

export function initDelete () { on('deleted', settled); }

/**
 * Deletes items of one kind (each with its id in the phone's library).
 * folder: the folder's name, when it is a whole folder. Resolves to the
 * Set of the ids really gone (empty when nothing went).
 */
export function deleteItems (kind, items, { folder = '' } = {}) {
  return new Promise(resolve => {
    const list = (items || []).filter(x => x && x.id);
    const none = () => resolve(new Set());
    if (!list.length || !NAMES[kind]) { none(); return; }
    if (!canDelete()) { toast('This version of BM Player cannot delete files.'); none(); return; }
    // An answer that never came (the app was put away mid-question) holds nothing up for long.
    if (waiting && Date.now() - waiting.at < 120000) { toast('Android is still asking about the last ones.'); none(); return; }
    if (waiting) { waiting.resolve(new Set()); waiting = null; }
    if (list.length > MAX) { toast(`At most ${MAX} at a time.`); none(); return; }
    const go = () => {
      waiting = { kind, resolve, at: Date.now() };
      call('deleteMedia', JSON.stringify({ kind, ids: list.map(x => x.id), folder: !!folder }));
    };
    if ((+info.sdk || 0) >= 30) { go(); return; }
    // Android 10 and older delete at once, without asking: the page asks.
    const n = list.length, one = NAMES[kind][0], what = howMany(kind, n);
    let chosen = false;
    sheet({
      title: folder ? `Delete the folder ${folder}?` : n === 1 ? `Delete this ${one}?` : `Delete ${what}?`,
      sub: folder ? (n === 1 ? `Its one ${one} is` : `Its ${what} are`) + ' deleted from the phone for good. Files of other kinds in it stay.'
        : n === 1 ? 'It is deleted from the phone for good.' : 'They are deleted from the phone for good.',
      items: [
        { icon: 'trash', label: 'Delete', danger: true, action: () => { chosen = true; go(); } },
        { icon: 'x', label: 'Cancel', action: () => { chosen = true; none(); } },
      ],
      // Closed some other way (Back, a tap beside it): nothing goes. The
      // items' actions run just after this, so they are waited for.
      onClose: () => setTimeout(() => { if (!chosen) none(); }, 60),
    });
  });
}

/** Java's answer: { kind, ids (really gone), asked, cancelled, denied, error }. */
function settled (d) {
  const w = waiting; waiting = null;
  const kind = d.kind || w?.kind || '';
  const gone = new Set((d.ids || []).map(Number).filter(Boolean));
  if (gone.size && NAMES[kind]) forgetAll(kind, gone);
  const asked = +d.asked || gone.size;
  if (!gone.size) toast(d.error || 'Nothing was deleted.', d.error ? 4500 : 2000);
  else if (gone.size < asked) toast(`${gone.size} of ${howMany(kind, asked)} deleted` + (d.cancelled ? '' : '. The others could not be.'), 3200);
  else toast(`${howMany(kind, gone.size)} deleted`);
  w?.resolve(gone);
}

function forgetAll (kind, gone) {
  forgetMedia(kind, gone);
  const key = kind === 'image' ? id => 'i/media/image/' + id : kind === 'video' ? id => 'v' + id : id => 's' + id;
  removeFavs(new Set([...gone].map(key)));
  if (kind === 'video') {
    clearPositions([...gone].map(key));
    forgetWhere(e => e.kind === 'video' && gone.has(e.id));
  }
  if (kind === 'audio') {
    player.forget(gone);                                   // the next song plays where the one playing went
    forgetWhere(e => e.kind === 'music' && gone.has(e.id));
  }
  dropChosen(gone);
  for (const fn of fns) { try { fn(kind, gone); } catch (e) { console.error('[BM Player] after deleting:', e); } }
}
