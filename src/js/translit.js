/**
 * translit: words in other alphabets spelled in English letters, by how
 * they sound (v3.46.0), so lyrics in Hindi, Malayalam, Tamil and the rest
 * can be sung along by someone who does not read the script. It is not a
 * translation: the words stay the words.
 *
 *   romanize(text)       the text with every supported script spelled out
 *   canRomanize(text)    whether there is anything here to spell out
 *
 * All here, offline, by rule. Supported:
 *
 *   Indian scripts   Devanagari (Hindi, Marathi, Nepali), Bengali, Gurmukhi
 *                    (Punjabi), Gujarati, Odia, Tamil, Telugu, Kannada and
 *                    Malayalam. Their Unicode blocks share one layout, so one
 *                    reader handles all nine, and each language's own sound
 *                    rules are applied after: the a left unsaid at the end of
 *                    a Hindi word and in its middle ("kamal", "samajhna"),
 *                    Tamil's letters that change their sound by where they
 *                    stand ("kaadhal", "nenjam", "endru"), Malayalam's u at
 *                    the end of a word ("paattu"), Bengali's o ("amar
 *                    shonar bangla").
 *   Korean           Hangul, with the sound changes between syllables
 *                    ("saranghaeyo", "gamsahamnida").
 *   Cyrillic, Greek  letter by letter.
 *
 * Not supported: Chinese and the kanji in Japanese need a dictionary of
 * readings, and Arabic, Urdu and Hebrew are written mostly without their
 * vowels. Those stay as they are.
 *
 * The spelling is the everyday one people type, not a scholarly one: no
 * accents, aa and ee for long vowels ("pyaar", "jeena"), th for the soft t
 * of South Indian languages ("thaalam"). Rule-based, so a word now and then
 * comes out a little off (Hindi compounds such as hamsafar, "hamasfar"),
 * the way a person reading it aloud for the first time might say it.
 */

// ── the Indian scripts ───────────────────────────────────────────────
// Each block is 128 code points with the same layout: an offset means the
// same sound in every one (0x15 is ka everywhere).
const BLOCKS = [
  [0x0900, 'hi'], [0x0980, 'bn'], [0x0A00, 'pa'], [0x0A80, 'gu'], [0x0B00, 'or'],
  [0x0B80, 'ta'], [0x0C00, 'te'], [0x0C80, 'kn'], [0x0D00, 'ml'],
];
const DRAVIDIAN = new Set(['ta', 'te', 'kn', 'ml']);
// Hindi, Gujarati and Punjabi leave the a unsaid at the end of a word and
// often in its middle; Bengali only at the end; the rest say it.
const SCHWA = { hi: 'all', gu: 'all', pa: 'all', bn: 'end' };

const blockOf = cp => { for (const [base, lang] of BLOCKS) if (cp >= base && cp < base + 0x80) return { base, lang }; return null; };

// Consonants by offset: the plain sound.
const CONS = {
  0x15: 'k', 0x16: 'kh', 0x17: 'g', 0x18: 'gh', 0x19: 'ng',
  0x1A: 'ch', 0x1B: 'chh', 0x1C: 'j', 0x1D: 'jh', 0x1E: 'ny',
  0x1F: 'T', 0x20: 'Th', 0x21: 'D', 0x22: 'Dh', 0x23: 'N',
  0x24: 't', 0x25: 'th', 0x26: 'd', 0x27: 'dh', 0x28: 'n', 0x29: 'n_',
  0x2A: 'p', 0x2B: 'ph', 0x2C: 'b', 0x2D: 'bh', 0x2E: 'm',
  0x2F: 'y', 0x30: 'r', 0x31: 'R', 0x32: 'l', 0x33: 'L', 0x34: 'zh', 0x35: 'v',
  0x36: 'sh', 0x37: 'S', 0x38: 's', 0x39: 'h',
};
// The same letter with a nukta under it: the sounds of Persian and Arabic words.
const NUKTA = { k: 'q', kh: 'x', g: 'G', j: 'z', D: 'r.', Dh: 'rh', ph: 'f', y: 'Y', L: 'L', s: 's', sh: 'sh' };
// Letters with the nukta already in them.
const PRE = {
  0x0958: 'q', 0x0959: 'x', 0x095A: 'G', 0x095B: 'z', 0x095C: 'r.', 0x095D: 'rh', 0x095E: 'f', 0x095F: 'Y',
  0x09DC: 'r.', 0x09DD: 'rh', 0x09DF: 'Y', 0x09F0: 'r', 0x09F1: 'w',
  0x0A59: 'x', 0x0A5A: 'G', 0x0A5B: 'z', 0x0A5C: 'r.', 0x0A5E: 'f', 0x0A33: 'L', 0x0A36: 'sh',
  0x0B5C: 'r.', 0x0B5D: 'rh', 0x0B5F: 'Y', 0x0B71: 'v',
};
// Malayalam's chillu letters: a consonant that ends a syllable, with no vowel.
const CHILLU = { 0x0D7A: 'N', 0x0D7B: 'n', 0x0D7C: 'r', 0x0D7D: 'l', 0x0D7E: 'L', 0x0D7F: 'k', 0x0D54: 'm', 0x0D55: 'y', 0x0D56: 'zh' };
// Vowels, on their own (by offset) and as signs after a consonant.
const VOWEL = { 0x05: 'a', 0x06: 'aa', 0x07: 'i', 0x08: 'ii', 0x09: 'u', 0x0A: 'uu', 0x0B: 'ri', 0x0C: 'li', 0x0D: 'e', 0x0E: 'e', 0x0F: 'e',
  0x10: 'ai', 0x11: 'o', 0x12: 'o', 0x13: 'o', 0x14: 'au', 0x60: 'ri', 0x61: 'li', 0x04: 'a' };
const SIGN = { 0x3E: 'aa', 0x3F: 'i', 0x40: 'ii', 0x41: 'u', 0x42: 'uu', 0x43: 'ri', 0x44: 'ri', 0x45: 'e', 0x46: 'e', 0x47: 'e', 0x48: 'ai',
  0x49: 'o', 0x4A: 'o', 0x4B: 'o', 0x4C: 'au', 0x4E: 'e', 0x4F: 'o', 0x57: 'au', 0x62: 'li', 0x63: 'li', 0x56: 'ai', 0x55: '' };
const VIRAMA = 0x4D, NUKTA_MARK = 0x3C, ANUSVARA = 0x02, CANDRABINDU = 0x01, VISARGA = 0x03, AVAGRAHA = 0x3D;
const ZWJ = 0x200D, ZWNJ = 0x200C;

/**
 * A word of one Indian script, read into syllables:
 *   { c: [consonants], v: vowel ('A' the inherent one, null none), n: nasal, h: visarga, fin: a chillu }
 */
function readWord (chars, base, lang) {
  const units = [];
  let cur = null, open = false, gem = false;
  const finish = () => { if (cur && cur.v === undefined) cur.v = 'A'; };
  const consonant = (s, chillu) => {
    if (cur && open) { cur.c.push(s); if (gem) cur.c.push(s); cur.v = undefined; }
    else { finish(); cur = { c: gem ? [s, s] : [s], v: undefined, n: false, h: false }; units.push(cur); }
    gem = false; open = false;
    if (chillu) { cur.v = null; cur.fin = true; }
  };
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i], off = cp - base;
    if (cp === ZWJ) { if (cur && cur.v === null && open) { cur.fin = true; open = false; } continue; }   // consonant + virama + ZWJ: an old-style chillu
    if (cp === ZWNJ) continue;
    if (CHILLU[cp]) { consonant(CHILLU[cp], true); continue; }
    if (PRE[cp]) { consonant(PRE[cp]); continue; }
    if (cp === 0x09CE) { consonant('t', true); continue; }                     // Bengali khanda ta
    if (cp === 0x0B83) { finish(); cur = { c: ['h'], v: null, n: false, h: false, fin: true }; units.push(cur); open = false; continue; }   // Tamil aytham
    if (lang === 'pa' && cp === 0x0A71) { finish(); gem = true; continue; }    // addak: the next consonant doubled
    if (lang === 'pa' && cp === 0x0A70) { if (cur) { if (cur.v === undefined) cur.v = 'A'; cur.n = true; } continue; }   // tippi
    if (lang === 'pa' && (cp === 0x0A72 || cp === 0x0A73)) { finish(); cur = { c: [], v: undefined, n: false, h: false }; units.push(cur); open = false; continue; }   // vowel bearers
    if (CONS[off] !== undefined && off >= 0x15 && off <= 0x39) { consonant(CONS[off]); continue; }
    if (off === NUKTA_MARK) { if (cur && cur.c.length) { const k = cur.c.length - 1; cur.c[k] = NUKTA[cur.c[k]] || cur.c[k]; } continue; }
    if (off === VIRAMA) { if (cur) { cur.v = null; open = true; } continue; }
    if (SIGN[off] !== undefined) {
      if (!cur) { cur = { c: [], v: undefined, n: false, h: false }; units.push(cur); }
      const s = SIGN[off];
      // A vowel written as two signs (e then aa is o, as in some typed Malayalam and Tamil).
      if (cur.v === 'e' && s === 'aa') cur.v = 'o';
      else if (cur.v === 'e' && (s === 'au' || s === 'ai')) cur.v = s;
      else if (cur.v === 'e' && s === 'uu' && lang === 'kn') cur.v = 'o';
      else if (s) cur.v = s;
      open = false; continue;
    }
    if (VOWEL[off] !== undefined) { finish(); cur = { c: [], v: VOWEL[off], n: false, h: false }; units.push(cur); open = false; continue; }
    if (off === ANUSVARA || off === CANDRABINDU || cp === 0x0C00 || cp === 0x0C04 || cp === 0x0D00) {
      if (cur) { if (cur.v === undefined) cur.v = 'A'; cur.n = off === ANUSVARA ? 'm' : 'n'; open = false; } continue;
    }
    if (off === VISARGA) { if (cur) { if (cur.v === undefined) cur.v = 'A'; cur.h = true; open = false; } continue; }
  }
  finish();
  // A virama left at the end: the word ends in a consonant.
  for (const u of units) if (u.v === undefined) u.v = 'A';
  dropSchwa(units, lang);
  return units;
}

const isSemivowel = c => c === 'r' || c === 'y' || c === 'v';

/**
 * The a that Hindi, Gujarati and Punjabi do not say: at the end of a word
 * (not after a cluster ending r, y or v: "mitra", "satya"), and in the
 * middle between a vowel and a consonant with a vowel after (the rule
 * linguists give, taken right to left): kamal, samajhna, dhadkan.
 */
function dropSchwa (u, lang) {
  const mode = SCHWA[lang];
  if (!mode || u.length < 2) return;
  const n = u.length, last = u[n - 1];
  const del = x => { x.v = null; x.dropped = true; };
  // After a cluster Bengali keeps it (shopno, jotno); Hindi only after r, y or v.
  const keepAfter = last.c.length > 1 && (lang === 'bn' || isSemivowel(last.c[last.c.length - 1]));
  if (last.v === 'A' && !last.n && !last.h && last.c.length && !keepAfter) del(last);
  if (mode !== 'all') return;
  const sounded = x => x && x.v !== null;
  for (let i = n - 2; i >= 1; i--) {
    const x = u[i];
    if (x.v !== 'A' || x.n || x.h || x.c.length !== 1) continue;
    const before = u[i - 1], after = u[i + 1];
    if (!sounded(before) || before.n || before.h) continue;               // a vowel must come before (not a nasal or h)
    if (!after || after.c.length !== 1 || !sounded(after)) continue;      // and one consonant with its vowel after
    del(x);
  }
}

// ── writing a word out ───────────────────────────────────────────────
const VELAR = new Set(['k', 'kh', 'g', 'gh', 'q', 'x', 'G']);
const LABIAL = new Set(['p', 'ph', 'b', 'bh', 'm', 'f']);
const STOPS = new Set(['k', 'kh', 'g', 'gh', 'ch', 'chh', 'j', 'jh', 'T', 'Th', 'D', 'Dh', 't', 'th', 'd', 'dh', 'p', 'ph', 'b', 'bh', 'q', 'x', 'G', 'z', 'f']);

/** The sound of each consonant letter, per language, before what is next to it is looked at. */
function plain (c, lang) {
  const south = DRAVIDIAN.has(lang);
  switch (c) {
    case 'T': return 't';
    case 'Th': return 'th';
    case 'D': return 'd';
    case 'Dh': return 'dh';
    case 'N': return 'n';
    case 'n_': return 'n';
    case 'L': return 'l';
    case 'S': return 'sh';
    case 'R': return 'r';
    // the flapped d: d in Hindi and Punjabi as people type it (dhadkan, ladki, kudi), r in Bengali and Odia (bari)
    case 'r.': return lang === 'bn' || lang === 'or' ? 'r' : 'd';
    case 'rh': return lang === 'bn' || lang === 'or' ? 'rh' : 'dh';
    case 'x': return 'kh';
    case 'G': return 'gh';
    case 'Y': return 'y';
    case 'ny': return lang === 'ml' || lang === 'ta' ? 'nj' : 'n';
    case 't': return south ? 'th' : 't';
    case 'ph': return lang === 'ml' ? 'f' : 'ph';
    case 'v': return lang === 'bn' ? 'b' : 'v';
    case 'y': return lang === 'bn' ? 'j' : 'y';
    case 's': return lang === 'bn' ? 'sh' : 's';
    default: return c;
  }
}

/** A cluster of consonants (no vowel between them), written out. */
function cluster (cs, lang, prevVowel) {
  if (lang === 'ta') return tamilCluster(cs, prevVowel);
  if (lang === 'ml') {
    const k = cs.join('+');
    const ML = { 'k+k': 'kk', 'ng+ng': 'ng', 'ch+ch': 'ch', 'ch+chh': 'chh', 'ny+ny': 'nj', 'T+T': 'tt', 'N+N': 'nn', 't+t': 'th', 'n+n': 'nn',
      'p+p': 'pp', 'm+m': 'mm', 'y+y': 'yy', 'l+l': 'll', 'v+v': 'vv', 'L+L': 'll', 'R+R': 'tt', 's+s': 'ss', 'sh+sh': 'sh',
      'ng+k': 'nk', 'ny+ch': 'nch', 'N+T': 'nd', 'n+t': 'nth', 'n+d': 'nd', 'm+p': 'mb', 'n+R': 'nt', 'n_+R': 'nt', 'j+ny': 'jn', 'R+R+R': 'tt' };
    if (ML[k]) return ML[k];
    if (cs.length === 1 && cs[0] === 'T' && prevVowel) return 'd';        // Malayalam says a single t between vowels as d: adipoli, veedu
  }
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], prev = cs[i - 1], next = cs[i + 1];
    let s = plain(c, lang);
    // the same letter twice: kk, tt, and ch before chh as in accha
    if (next && plain(next, lang) === s + 'h' && (s === 'ch' || s === 't' || s === 'k' || s === 'p' || s === 'd' || s === 'b' || s === 'g' || s === 'j')) { if (s === 'ch') continue; }
    if (c === 'v' && prev && lang !== 'bn') s = 'w';                       // swar, khwaab, dwaar
    if (c === 'b' && prev && prev !== 'm' && lang === 'bn') continue;     // Bengali b after a consonant is not said (shopno, bishsho)
    if (c === 'y' && prev && lang === 'bn') s = 'y';                      // the Bengali y after a consonant
    if (c === 's' && lang === 'bn' && (prev || next) && next !== 'b') s = 's';   // Bengali s in a cluster: s (asthir, snaan)
    if (c === 'j' && next === 'ny') { out.push('g'); i++; out.push('y'); continue; }   // jna as gya: gyaan
    out.push(s);
  }
  return out.join('');
}

/**
 * Tamil writes one letter for k and g, s and ch, t and d, th and dh, p and
 * b; which one is said depends on where it stands: at the start of a word
 * the first, after a vowel or after its own nasal the second, doubled the
 * first doubled (but th and ch once: muthu, pichai). ற is r, doubled tr,
 * after ன dr: kaatru, endru.
 */
const TA_NASAL = new Set(['ng', 'ny', 'N', 'n', 'n_', 'm']);
const TA_SOFT = new Set(['y', 'r', 'l', 'zh', 'L', 'v']);
function tamilCluster (cs, prevVowel) {
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], prev = i ? cs[i - 1] : null, next = cs[i + 1];
    const atStart = !prev && !prevVowel, afterVowel = !prev && prevVowel;
    const same = prev === c, nasal = TA_NASAL.has(prev), soft = TA_SOFT.has(prev);
    let s;
    switch (c) {
      case 'k': s = (same || next === 'k') ? 'k' : (nasal || afterVowel || soft) ? 'g' : 'k'; break;   // kangal, aagum, vaazhga; doubled kk
      case 'ch': s = same ? '' : nasal ? 'j' : (atStart || afterVowel) ? 's' : 'ch'; if (next === 'ch') s = 'ch'; break;
      case 'T': s = (same || next === 'T') ? 't' : (nasal || afterVowel) ? 'd' : 't'; break;
      case 't': s = same ? '' : (nasal || afterVowel) ? 'dh' : 'th'; if (next === 't') s = 'th'; break;
      case 'p': s = (same || next === 'p') ? 'p' : (nasal || afterVowel || soft) ? 'b' : 'p'; break;
      case 'R': s = same ? 'r' : prev === 'n_' ? 'dr' : 'r'; if (next === 'R') s = 't'; break;
      case 'ng': s = next === 'k' ? 'n' : 'ng'; break;
      case 'ny': s = next === 'ch' ? 'n' : 'nj'; break;
      case 'n_': case 'n': case 'N': s = 'n'; break;
      case 'L': s = 'l'; break;
      case 'S': s = 'sh'; break;
      case 'j': s = 'j'; break;
      default: s = plain(c, 'ta');
    }
    out.push(s);
  }
  return out.join('');
}

/** A vowel written out: long ones doubled, as people type them. */
function vowel (v, lang, { final, nasal }) {
  const north = !DRAVIDIAN.has(lang);
  if (v === 'A') return lang === 'bn' ? 'o' : 'a';
  if (lang === 'bn') return { a: 'o', aa: 'a', ii: 'i', uu: 'u', ai: 'oi', au: 'ou' }[v] || v;
  if (lang === 'or') return { aa: 'a', ii: 'i', uu: 'u' }[v] || v;
  if (v === 'ri' && (lang === 'te' || lang === 'kn')) return 'ru';
  if (north && final) {
    if (v === 'aa') return nasal ? 'aa' : 'a';                           // mera, tera; but haan
    if (v === 'ii') return 'i';                                           // teri, kabhi; nahin
    if (v === 'uu') return nasal ? 'oo' : 'u';                            // tu, aansu; but hoon
    if (v === 'e' && nasal) return 'ei';                                  // mein, aankhein
  }
  return { ii: 'ee', uu: 'oo' }[v] || v;
}

/** The nasal sign before the next consonant: m before p, b and m, else n (Bengali ng). */
function nasal (kind, next, lang, final) {
  if (lang === 'bn') return kind === 'm' ? 'ng' : 'n';
  if (final) return DRAVIDIAN.has(lang) && kind === 'm' ? 'm' : 'n';
  if (next && LABIAL.has(next)) return 'm';
  if (DRAVIDIAN.has(lang) && kind === 'm' && !(next && (VELAR.has(next) || STOPS.has(next)))) return 'm';
  return 'n';
}

function writeWord (units, lang) {
  let out = '', prevVowel = false;
  for (let i = 0; i < units.length; i++) {
    const u = units[i], last = i === units.length - 1;
    // Hindi glides from one vowel into e: aaye, gaye, jaaye.
    if (!u.c.length && u.v === 'e' && prevVowel && !DRAVIDIAN.has(lang) && lang !== 'bn') out += 'y';
    if (u.c.length) out += cluster(u.c, lang, prevVowel);
    if (u.v) out += vowel(u.v, lang, { final: last, nasal: !!u.n }); else if (last && !u.fin && !u.dropped && lang === 'ml') out += 'u';   // Malayalam: a word ending in a consonant ends with a short u (paattu, enthu)
    if (u.n) out += nasal(u.n, units[i + 1]?.c[0] && plain(units[i + 1].c[0], lang), lang, last);
    if (u.h) out += 'h';
    prevVowel = !!u.v && !u.n && !u.h;
  }
  return out;
}

// ── Korean ───────────────────────────────────────────────────────────
const KO_L = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const KO_V = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
// A final consonant at the end of a syllable, and what it gives the next syllable when that starts with a silent ㅇ.
const KO_T = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
const KO_CARRY = [null, ['', 'g'], ['', 'kk'], ['k', 's'], ['', 'n'], ['n', 'j'], ['', 'n'], ['', 'd'], ['', 'r'], ['l', 'g'], ['l', 'm'], ['l', 'b'], ['l', 's'], ['l', 't'], ['l', 'p'], ['', 'r'],
  ['', 'm'], ['', 'b'], ['p', 's'], ['', 's'], ['', 'ss'], null, ['', 'j'], ['', 'ch'], ['', 'k'], ['', 't'], ['', 'p'], ['', '']];

function korean (word) {
  const syl = [];
  for (const ch of word) {
    const s = ch.codePointAt(0) - 0xAC00;
    syl.push({ l: Math.floor(s / 588), v: Math.floor((s % 588) / 28), t: s % 28 });
  }
  let out = '';
  for (let i = 0; i < syl.length; i++) {
    const x = syl[i], next = syl[i + 1];
    let init = KO_L[x.l];
    if (i > 0) {
      const p = syl[i - 1];
      // The sound the previous syllable carried over, or changed this one's by.
      if (p.carry !== undefined) init = p.carry;
      else if (x.l === 5 && (p.t === 8 || p.t === 4)) init = 'l';         // ㄹ after ㄹ or ㄴ: ll (molla, silla)

    }
    out += init + KO_V[x.v];
    if (!x.t) continue;
    let fin = KO_T[x.t];
    if (next) {
      const nl = next.l;
      if (nl === 11 && KO_CARRY[x.t]) { fin = KO_CARRY[x.t][0]; x.carry = KO_CARRY[x.t][1]; }   // liaison: sipeo, isseo, mani
      else if (nl === 2 || nl === 6) {                                    // before ㄴ or ㅁ, a stop turns nasal
        if (fin === 'k') fin = 'ng'; else if (fin === 't') fin = 'n'; else if (fin === 'p') fin = 'm';
      } else if (nl === 5 && (x.t === 4 || x.t === 8)) fin = 'l';         // ㄴ or ㄹ before ㄹ: ll
      else if (x.t === 27 && [0, 3, 12].includes(nl)) { fin = ''; x.carry = { 0: 'k', 3: 't', 12: 'ch' }[nl]; }   // ㅎ before ㄱ ㄷ ㅈ: aspirated (jota)
      else if (nl === 18 && [1, 7, 17, 22].includes(x.t)) { fin = ''; x.carry = { 1: 'k', 7: 't', 17: 'p', 22: 'ch' }[x.t]; }   // a stop before ㅎ: aspirated (chuka)
      else if (x.t === 27 && nl === 9) { fin = ''; x.carry = 'ss'; }
      if (nl === 5 && fin === 'l') x.carry = x.carry || 'l';
    }
    out += fin;
  }
  return out;
}

// ── Cyrillic and Greek ───────────────────────────────────────────────
const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye', ґ: 'g', ў: 'w',
  ђ: 'dj', ј: 'j', љ: 'lj', њ: 'nj', ћ: 'c', џ: 'dz', ѓ: 'gj', ќ: 'kj', ѕ: 'dz' };
const GRK = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
  υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' };

function cyrillic (word) {
  const ua = /[іїєґ]/i.test(word);
  let out = '';
  const w = [...word];
  for (let i = 0; i < w.length; i++) {
    const ch = w[i], lo = ch.toLowerCase();
    let s = CYR[lo];
    if (s === undefined) { out += ch; continue; }
    if (ua && lo === 'г') s = 'h';
    if (ua && lo === 'и') s = 'y';
    if (ua && lo === 'ї' && i > 0) s = 'i';                               // Kyiv
    // е at the start of a word, or after a vowel or a hard or soft sign, is ye (Yelena).
    if (lo === 'е' && !ua && (i === 0 || /[аеёиоуыэюяъь]/i.test(w[i - 1]))) s = 'ye';
    out += ch !== lo && s ? s[0].toUpperCase() + s.slice(1) : s;
  }
  return out;
}

function greek (word) {
  const w = word.normalize('NFD').replace(/[̀-ͯ]/g, '');
  let out = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i], lo = ch.toLowerCase(), nx = (w[i + 1] || '').toLowerCase();
    let s, take = 1;
    if (lo === 'ο' && nx === 'υ') { s = 'ou'; take = 2; }
    else if (lo === 'α' && nx === 'ι') { s = 'e'; take = 2; }
    else if ((lo === 'ε' || lo === 'ο') && nx === 'ι') { s = 'i'; take = 2; }
    else if (lo === 'α' && nx === 'υ') { s = 'av'; take = 2; }
    else if (lo === 'ε' && nx === 'υ') { s = 'ev'; take = 2; }
    else if (lo === 'μ' && nx === 'π') { s = i === 0 ? 'b' : 'mb'; take = 2; }
    else if (lo === 'ν' && nx === 'τ') { s = i === 0 ? 'd' : 'nd'; take = 2; }
    else if (lo === 'γ' && (nx === 'γ' || nx === 'κ')) { s = 'ng'; take = 2; }
    else s = GRK[lo];
    if (s === undefined) { out += ch; continue; }
    out += ch !== lo ? s[0].toUpperCase() + s.slice(1) : s;
    i += take - 1;
  }
  return out;
}

// ── putting it together ──────────────────────────────────────────────
const DIGITS = new Set([0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F]);
const isHangul = cp => cp >= 0xAC00 && cp <= 0xD7A3;
const isCyr = cp => cp >= 0x0400 && cp <= 0x04FF;
const isGreek = cp => (cp >= 0x0370 && cp <= 0x03FF) || (cp >= 0x1F00 && cp <= 0x1FFF);

/** What kind of run a character belongs to: an Indian block's base, 'ko', 'cy', 'gr' or null. */
function kindOf (cp) {
  const b = blockOf(cp);
  if (b) return b.base;
  if (isHangul(cp)) return 'ko';
  if (isCyr(cp)) return 'cy';
  if (isGreek(cp)) return 'gr';
  return null;
}

/** Whether the text has something romanize() would spell out. */
export function canRomanize (text) {
  for (const ch of String(text || '')) {
    const cp = ch.codePointAt(0), b = blockOf(cp);
    if (b) { const off = cp - b.base; if ((off >= 0x05 && off <= 0x39) || DIGITS.has(off)) return true; continue; }
    if (isHangul(cp) || (isCyr(cp) && /\p{L}/u.test(ch)) || (isGreek(cp) && /\p{L}/u.test(ch))) return true;
  }
  return false;
}

/**
 * The text with each word of a supported script spelled in English
 * letters. Everything else (English words, numbers, punctuation, scripts
 * it cannot read) stays as it is. A line that starts with a spelled-out
 * word starts with a capital, as a line of lyrics does.
 */
export function romanize (text) {
  const s = String(text ?? '').normalize('NFC');
  if (!canRomanize(s)) return s;
  const cps = [...s].map(ch => ch.codePointAt(0));
  let out = '', i = 0, firstDone = false, capNext = true;
  while (i < cps.length) {
    const cp = cps[i], kind = kindOf(cp);
    if (kind === null || (typeof kind === 'number' && (cp - kind === 0x64 || cp - kind === 0x65))) {
      // dandas end a line of verse: a comma or a full stop
      if (typeof kind === 'number' && cp - kind === 0x64) out += ',';
      else if (typeof kind === 'number' && cp - kind === 0x65) out += '.';
      else out += String.fromCodePoint(cp);
      if (/\p{L}/u.test(String.fromCodePoint(cp))) firstDone = true;     // a word in English letters came first
      i++; continue;
    }
    if (typeof kind === 'number' && DIGITS.has(cp - kind)) { out += String(cp - kind - 0x66); i++; firstDone = true; continue; }
    // a run of one script, with the joiners that go with it
    let j = i;
    while (j < cps.length && (kindOf(cps[j]) === kind || cps[j] === ZWJ || cps[j] === ZWNJ) && !(typeof kind === 'number' && (DIGITS.has(cps[j] - kind) || cps[j] - kind === 0x64 || cps[j] - kind === 0x65))) j++;
    const run = cps.slice(i, j);
    let word;
    if (kind === 'ko') word = korean(String.fromCodePoint(...run));
    else if (kind === 'cy') word = cyrillic(String.fromCodePoint(...run));
    else if (kind === 'gr') word = greek(String.fromCodePoint(...run));
    else {
      const lang = blockOf(cp).lang;
      if (cp === kind + 0x50) word = 'om';                                // ॐ
      else if (cps[i] - kind === AVAGRAHA) word = "'";
      else word = writeWord(readWord(run, kind, lang), lang);
      // Only the dandas and digits were skipped above; Om stands alone
      if (cp === kind + 0x50 && run.length > 1) word = 'om' + writeWord(readWord(run.slice(1), kind, lang), lang);
    }
    if (capNext && !firstDone && word) word = word[0].toUpperCase() + word.slice(1);
    capNext = false; firstDone = true;
    out += word;
    i = j;
  }
  return out;
}
