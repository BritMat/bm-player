#!/usr/bin/env node
// Builds dist/BM-Player-Check.bat: the template plus the check scripts it
// needs, carried as base64 after a marker line, so the .bat works next to a
// zip that predates those scripts. Batch files break on Unix line endings and
// on non-ASCII text, so both are enforced here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['scripts/field-check.mjs', 'scripts/e2e.mjs', 'tools/bm-helper.ps1'];
const tpl = fs.readFileSync(path.join(ROOT, 'tools/BM-Player-Check.template.bat'), 'utf8');
const bad = [...tpl].findIndex(c => c.charCodeAt(0) > 126 || (c.charCodeAt(0) < 32 && !'\r\n\t'.includes(c)));
if (bad >= 0) { console.error('template has a non-ASCII character at offset ' + bad + ': ' + JSON.stringify(tpl.slice(bad - 20, bad + 5))); process.exit(1); }
if (tpl.includes('#BMPAYLOAD#')) { console.error('template must not contain the payload marker'); process.exit(1); }
const payload = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f)).toString('base64')]));
const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
const bat = tpl.replace(/\r?\n/g, '\r\n').replace(/\s*$/, '\r\n') + '#BMPAYLOAD#\r\n' + b64 + '\r\n';
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'BM-Player-Check.bat');
fs.writeFileSync(out, bat);
console.log(`wrote ${path.relative(ROOT, out)}: ${bat.length} bytes, carrying ${FILES.join(', ')}`);
