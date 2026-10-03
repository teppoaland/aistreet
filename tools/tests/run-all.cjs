/* ═══════════════════════════════════════════════════════════
   run-all.cjs – ajaa kaikki tools/tests/*.cjs -penkit ja
   tulostaa yhteenvedon. Ei riippuvuuksia (vain node).

   Ajo:
       node tools/tests/run-all.cjs              # kaikki penkit
       node tools/tests/run-all.cjs street       # vain "street"-penkit
       node tools/tests/run-all.cjs chaos-normal # vain yksi penkki

   Paluukoodi: 0 = kaikki puhtaita, 1 = löydöksiä.
   Raportti kirjoitetaan aina tiedostoon last-run.txt.
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const SKIP = ['run-all.cjs', 'street-src.cjs', 'ver.cjs'];
const filter = process.argv[2] || '';

const files = fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.cjs') && !SKIP.includes(f))
    .filter((f) => !filter || f.includes(filter))
    .sort();

if (!files.length) {
    console.log('Ei penkkejä suodattimella "' + filter + '".');
    process.exit(1);
}

/* Löydösten tunnistus: FAIL-tyyppiset rivit + paluukoodi. */
const FINDING = /(FAIL|MISMATCH|UNEXPECTED KEY|VIRHEIT|VIRHE:|\blöydöstä\b|\bloydosta\b|✗|^ {2}X )/i;
const IGNORE = /(0 löydöstä|0 loydosta|LÖYDÖKSET \(0\)|== LÖYDÖKSET \(0\) ==)/i;

const rows = [];
for (const f of files) {
    const t0 = Date.now();
    let out = '';
    let code = 0;
    try {
        out = execFileSync(process.execPath, [path.join(DIR, f)], {
            encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024
        });
    } catch (e) {
        out = String(e.stdout || '') + String(e.stderr || '');
        code = typeof e.status === 'number' ? e.status : 1;
    }
    const lines = out.split(/\r?\n/);
    const hits = lines.filter((l) => FINDING.test(l) && !IGNORE.test(l));
    const summary = lines.filter((l) => /Tulos:|LOYDOSTA|löydöstä|KAIKKI OK|CLEAN|DIRTY|===\s*TULOS/i.test(l)).pop() || '';
    rows.push({
        file: f, code, ok: code === 0, ms: Date.now() - t0,
        hits: hits.length, first: hits.slice(0, 5), summary: summary.trim(),
        out
    });
    console.log((code === 0 ? '  ok   ' : '  FAIL ') + f + '  (' + (Date.now() - t0) + ' ms)' +
        (code === 0 ? '' : '   paluukoodi ' + code));
    if (code !== 0) for (const h of hits.slice(0, 5)) console.log('         ' + h.trim());
}

const bad = rows.filter((r) => !r.ok);
const report = [
    '# tools/tests – viimeisin ajo (' + new Date().toISOString() + ')',
    '',
    '| Penkki | Tulos | Löydöksiä | Aika (ms) |',
    '|---|---|---|---|',
    ...rows.map((r) => '| ' + r.file + ' | ' + (r.ok ? 'OK' : 'FAIL (' + r.code + ')') + ' | ' + r.hits + ' | ' + r.ms + ' |'),
    '',
    'Yhteensä: ' + rows.length + ' penkkiä, ' + bad.length + ' ei puhdas.',
    '',
    ...bad.flatMap((r) => ['## ' + r.file, '```', ...r.first, '```', ''])
].join('\n');
fs.writeFileSync(path.join(DIR, 'last-run.txt'), report, 'utf8');

console.log('');
console.log('=========================================================');
console.log(' ' + rows.length + ' penkkiä, ' + (rows.length - bad.length) + ' puhdasta, ' + bad.length + ' löydöksiä');
console.log(' Raportti: tools/tests/last-run.txt');
console.log('=========================================================');
if (bad.length) for (const r of bad) console.log('  X ' + r.file);
process.exit(bad.length ? 1 : 0);
