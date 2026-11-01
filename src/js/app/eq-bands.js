/**
 * The equaliser's ten bands and its presets (v3.47.0, from app.js). The sliders are built from
 * EQ_BANDS, made from sound-chain.js's EQ_FREQUENCIES, the list both players' equalizers use:
 * slider i is band i everywhere. A contract check sees to that, and to the phone's list.
 */
import { EQ_FREQUENCIES } from '../sound-chain.js';
export const EQ_BANDS=EQ_FREQUENCIES.map(f=>({freq:f,label:f<1000?String(f):f/1000+'K'}));
export const EQ_PRESETS={flat:[0,0,0,0,0,0,0,0,0,0],bass:[8,7,5,3,1,0,0,0,0,0],treble:[0,0,0,0,0,1,3,5,7,8],rock:[5,4,-2,-4,-2,2,5,6,6,5],pop:[-1,2,4,4,1,-1,-2,-2,-1,1],jazz:[3,2,1,2,-1,-1,0,1,2,3],classical:[4,3,2,1,-1,-1,-1,0,2,3]};
