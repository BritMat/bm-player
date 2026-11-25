/**
 * The equaliser's bands (fifteen since v3.59.0) and its presets (v3.47.0, from app.js). The sliders are built from
 * EQ_BANDS, made from sound-chain.js's EQ_FREQUENCIES, the list both players' equalizers use:
 * slider i is band i everywhere. A contract check sees to that, and to the phone's list.
 */
import { EQ_FREQUENCIES } from '../sound-chain.js';
import { BUILT_IN } from '../eq-presets.js';
export const EQ_BANDS=EQ_FREQUENCIES.map(f=>({freq:f,label:f<1000?String(f):f/1000+'K'}));
// v3.59.0: fifteen bands; the presets are eq-presets.js's, by their lower-case names as before
export const EQ_PRESETS=Object.fromEntries(Object.entries(BUILT_IN).map(([k,v])=>[k.toLowerCase(),v.eq]));
