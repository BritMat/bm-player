#!/usr/bin/env node
/**
 * check-powershell: parse every PowerShell script the field checks carry.
 *
 * The screen capture and window-embedding code runs only on Windows, inside
 * PowerShell, where a syntax error would waste a whole run on someone's
 * machine. This pulls each script out (the String.raw blocks the field check
 * writes to .ps1 files, and tools/bm-helper.ps1) and runs PowerShell's own
 * parser over it.
 *
 * On Windows it uses the built-in Windows PowerShell 5.1, the version the
 * scripts actually run under, which also rejects newer syntax it lacks. Elsewhere
 * it uses pwsh if installed, plus a scan for the newer operators. With neither,
 * it reports a skip (exit 3 under BM_STRICT=1).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = [];

for (const rel of ['scripts/field-check.mjs', 'scripts/e2e.mjs']) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const re = /fs\.writeFileSync\(\s*(\w+)\s*,\s*String\.raw`([\s\S]*?)`\s*\)/g;
  let m;
  while ((m = re.exec(src))) scripts.push({ name: `${rel} (${m[1]})`, text: m[2] });
}
const helper = path.join(ROOT, 'tools/bm-helper.ps1');
if (fs.existsSync(helper)) scripts.push({ name: 'tools/bm-helper.ps1', text: fs.readFileSync(helper, 'utf8') });

const find = cands => { for (const c of cands) { try { execFileSync(c, ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore', timeout: 30000 }); return c; } catch {} } return null; };
const ps = process.platform === 'win32' ? find(['powershell', 'pwsh']) : find(['pwsh', '/opt/pwsh/pwsh']);

let failed = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-pscheck-'));
for (const [i, sc] of scripts.entries()) {
  // Windows PowerShell 5.1 lacks these; only the 5.1 parser rejects them itself.
  const newer = sc.text.split('\n').map((l, n) => [l.replace(/'[^']*'|"[^"]*"|#.*$/g, ''), n + 1])
    .filter(([l]) => /\?\?|\?\.|\s&&\s|\s\|\|\s|\?\s*\$?\w+\s*:\s/.test(l));
  for (const [l, n] of newer) { failed++; console.log(`  ✗ ${sc.name}:${n}: syntax Windows PowerShell 5.1 does not have: ${l.trim().slice(0, 80)}`); }
  if (!ps) continue;
  const file = path.join(tmp, `s${i}.ps1`);
  fs.writeFileSync(file, sc.text);
  const cmd = `$t=$null;$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${file.replace(/'/g, "''")}',[ref]$t,[ref]$e);` +
              `foreach($x in $e){Write-Output ('{0}: {1}' -f $x.Extent.StartLineNumber,$x.Message)}`;
  const out = execFileSync(ps, ['-NoProfile', '-Command', cmd], { timeout: 60000 }).toString().trim();
  if (out) { failed++; for (const l of out.split(/\r?\n/)) console.log(`  ✗ ${sc.name}: line ${l}`); }
  else console.log(`  ✓ ${sc.name} parses`);
}
fs.rmSync(tmp, { recursive: true, force: true });

if (!ps) {
  console.log(`  - ${scripts.length} PowerShell scripts not parsed: no PowerShell here`);
  process.exit(failed ? 1 : (process.env.BM_STRICT === '1' ? 3 : 0));
}
console.log(failed ? `\n${failed} PowerShell problem(s).` : `\n✓ ${scripts.length} PowerShell scripts parse (${path.basename(ps)}).`);
process.exit(failed ? 1 : 0);
