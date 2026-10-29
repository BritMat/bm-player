#!/usr/bin/env node
/**
 * Lyrics in English letters (src/js/translit.js, v3.46.0): words in each
 * supported script against the spelling people use for them. Short phrases,
 * song titles and everyday sentences, so each language's sound rules are
 * tried: the Hindi a left unsaid, Tamil's letters that change by where they
 * stand, Malayalam's u at a word's end, Bengali's o, Korean's sound changes.
 *
 *   node scripts/check-translit.mjs
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { romanize, canRomanize } = await import(pathToFileURL(path.join(ROOT, 'src/js/translit.js')).href);

const CASES = {
  'Hindi': [
    ['तुम ही हो', 'Tum hi ho'], ['कल हो ना हो', 'Kal ho na ho'], ['मैं हूँ ना', 'Main hoon na'],
    ['मेरे सपनों की रानी', 'Mere sapnon ki raani'], ['आज मौसम बहुत अच्छा है', 'Aaj mausam bahut achha hai'],
    ['मुझे तुमसे प्यार है', 'Mujhe tumse pyaar hai'], ['चलते चलते', 'Chalte chalte'], ['पहली नज़र', 'Pahli nazar'],
    ['रंग दे बसंती', 'Rang de basanti'], ['आँखें', 'Aankhein'], ['ज़िंदगी', 'Zindagi'], ['समझना', 'Samajhna'], ['धड़कन', 'Dhadkan'],
    ['मोहब्बत', 'Mohabbat'], ['इश्क़', 'Ishq'], ['मित्र', 'Mitra'], ['दोस्त', 'Dost'], ['नहीं', 'Nahin'], ['ज्ञान', 'Gyaan'],
    ['ख़्वाब', 'Khwaab'], ['संगीत', 'Sangeet'], ['चंपा', 'Champa'], ['अपना', 'Apna'], ['आएगी', 'Aayegi'], ['दर्द', 'Dard'],
    ['ग़म', 'Gham'], ['ख़ुशी', 'Khushi'], ['लड़की', 'Ladki'], ['पढ़ना', 'Padhna'], ['बादल', 'Baadal'], ['क्यों', 'Kyon'],
  ],
  'Malayalam': [
    ['ആരും കാണാതെ', 'Aarum kaanaathe'], ['എന്റെ ഖൽബിലെ', 'Ente khalbile'], ['ഞാൻ നിന്നെ സ്നേഹിക്കുന്നു', 'Njaan ninne snehikkunnu'],
    ['ഇന്ന് നല്ല മഴയാണ്', 'Innu nalla mazhayaanu'], ['പാട്ട്', 'Paattu'], ['വീട്', 'Veedu'], ['കൂടെ', 'Koode'], ['അടിപൊളി', 'Adipoli'],
    ['മിഴിയോരം', 'Mizhiyoram'], ['ജീവിതം', 'Jeevitham'], ['ഹൃദയം', 'Hridayam'], ['പൂമുഖ വാതിൽക്കൽ', 'Poomukha vaathilkkal'],
    ['അമ്മ', 'Amma'], ['എന്ത്', 'Enthu'], ['കാറ്റ്', 'Kaattu'], ['ഉണ്ട്', 'Undu'], ['അമ്പിളി', 'Ambili'], ['മലയാളം', 'Malayaalam'],
    ['സന്തോഷം', 'Santhosham'], ['പുഞ്ചിരി', 'Punchiri'], ['ചന്ദ്രൻ', 'Chandran'], ['കണ്ണീർ', 'Kanneer'],
    // old-style chillu: consonant, virama, zero-width joiner
    ['അവന്‍', 'Avan'],
  ],
  'Tamil': [
    ['காதல்', 'Kaadhal'], ['அடியே', 'Adiye'], ['நீ இல்லை என்றால்', 'Nee illai endraal'], ['வா வா', 'Vaa vaa'], ['தமிழ்', 'Thamizh'],
    ['முத்து', 'Muthu'], ['நெஞ்சம்', 'Nenjam'], ['வந்தேன்', 'Vandhen'], ['காற்று', 'Kaatru'], ['பச்சை', 'Pachai'], ['கொஞ்சம்', 'Konjam'],
    ['எங்க', 'Enga'], ['தம்பி', 'Thambi'], ['நன்றி', 'Nandri'], ['ஆகும்', 'Aagum'], ['ஆசை', 'Aasai'], ['இன்று நல்ல மழை', 'Indru nalla mazhai'],
    ['எப்படி', 'Eppadi'], ['கண்கள்', 'Kangal'], ['வாழ்க', 'Vaazhga'], ['பார்க்க', 'Paarkka'], ['அப்பா', 'Appaa'],
  ],
  'Telugu and Kannada': [
    ['నిన్ను చూడాలని', 'Ninnu choodaalani'], ['ప్రేమ', 'Prema'], ['హృదయం', 'Hrudayam'], ['ನಿನ್ನ ಪ್ರೀತಿ', 'Ninna preethi'],
  ],
  'Bengali': [
    ['আমার সোনার বাংলা', 'Amar shonar bangla'], ['আমি তোমাকে ভালোবাসি', 'Ami tomake bhalobashi'], ['স্বপ্ন', 'Shopno'],
    ['এখন', 'Ekhon'], ['বাড়ি', 'Bari'],
  ],
  'Punjabi and Gujarati': [
    ['ਤੇਰੇ ਨਾਲ', 'Tere naal'], ['ਜੱਟ', 'Jatt'], ['ਕੁੜੀ', 'Kudi'], ['તારી આંખ', 'Taari aankh'], ['કેમ છો', 'Kem chho'],
  ],
  'Korean': [
    ['사랑해요', 'Saranghaeyo'], ['보고 싶어', 'Bogo sipeo'], ['감사합니다', 'Gamsahamnida'], ['있는', 'Inneun'], ['좋아해', 'Joahae'],
    ['많이', 'Mani'], ['없어', 'Eopseo'], ['몰라', 'Molla'], ['축하', 'Chuka'], ['안녕하세요', 'Annyeonghaseyo'],
  ],
  'Cyrillic and Greek': [
    ['Я тебя люблю', 'Ya tebya lyublyu'], ['Москва', 'Moskva'], ['Київ', 'Kyiv'], ["Σ' αγαπώ", "S' agapo"],
  ],
  'Mixed and left alone': [
    ['Tum hi ho (तुम ही हो)', 'Tum hi ho (tum hi ho)'], ['॥ जय ॥', '. Jay .'], ['१२३', '123'],
    ['Already in English', 'Already in English'], ['你好', '你好'], ['مرحبا', 'مرحبا'], ['', ''],
  ],
};

let n = 0, bad = 0;
for (const [lang, cases] of Object.entries(CASES)) {
  const before = bad;
  for (const [src, want] of cases) {
    n++;
    const got = romanize(src);
    if (got !== want) { bad++; console.log(`  \x1b[31m✗\x1b[0m ${lang}: ${JSON.stringify(src)} gave ${JSON.stringify(got)}, not ${JSON.stringify(want)}`); }
  }
  console.log(`  ${bad > before ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m'} ${lang} (${cases.length})`);
}
const checks = [
  ['canRomanize: Indian scripts, Korean, Cyrillic and Greek yes', () => ['തുമ്പി', 'नमस्ते', '사랑', 'Да', 'Ναι', '१'].every(canRomanize)],
  ['canRomanize: English, Chinese, Arabic and nothing no', () => !['hello', '你好', 'مرحبا', '', '♪ ♪'].some(canRomanize)],
  ['two thousand lines in well under a second', () => {
    const line = 'ഞാൻ നിന്നെ സ്നേഹിക്കുന്നു मुझे तुमसे प्यार है காதல் 사랑해요';
    const t = performance.now();
    for (let i = 0; i < 2000; i++) romanize(line);
    const ms = performance.now() - t;
    console.log(`      (${ms.toFixed(0)} ms)`);
    return ms < 800;
  }],
  ['any text at all gives text back, never an error', () => {
    const odd = ['്', '््', 'क्', 'ം', '‍‌', 'ஃ', 'ॐ नमः', 'ऽ', '\uD800', 'ੱ', '가́', null, undefined, 42];
    return odd.every(x => typeof romanize(x) === 'string');
  }],
];
for (const [name, fn] of checks) {
  n++;
  let ok = false; try { ok = fn(); } catch (e) { console.log('      ' + e.message); }
  if (!ok) bad++;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}`);
}
console.log(`\n${n - bad}/${n} checks passed.`);
process.exit(bad ? 1 : 0);
