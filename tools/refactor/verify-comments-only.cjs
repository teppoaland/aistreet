/* ═══════════════════════════════════════════════════════════
   verify-comments-only.cjs – todistaa, että muutos koski VAIN
   kommentteja: vertaa koodia ilman kommentteja (HEAD ↔ työpuu).

   Käyttö (Vaihe 6:n jälkeen ja aina kun muokataan kommentteja):
       node tools/refactor/verify-comments-only.cjs
   Tuloste: jokainen tiedosto OK, jos koodi on identtinen.
   Ei riippuvuuksia; käyttää `git show HEAD:<file>`-versiota.
   ═══════════════════════════════════════════════════════════ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const FILES = ['street.js', 'gameState.js', 'audio.js', 'style.css',
    'street/chaos-config.js', 'street/sfx.js', 'street/news.js',
    'street/traffic.js', 'street/chaos-cards.js', 'street/rooms.js'];

/* Karkea mutta johdonmukainen kommenttien poisto (sama molemmille versioille). */
function stripComments(src) {
    let out = '', i = 0, q = null;
    while (i < src.length) {
        const c = src[i], n = src[i + 1];
        if (q) {
            out += c;
            if (c === '\\') { out += n; i += 2; continue; }
            if (c === q) q = null;
            i++; continue;
        }
        if (c === "'" || c === '"' || c === '`') { q = c; out += c; i++; continue; }
        if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && n === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2; continue;
        }
        out += c; i++;
    }
    return out.replace(/\s+/g, ' ').trim();
}

let bad = 0;
for (const f of FILES) {
    let head;
    try { head = execFileSync('git', ['show', 'HEAD:' + f], { encoding: 'utf8', cwd: ROOT, maxBuffer: 1e8 }); }
    catch (e) { console.log('  SKIP ' + f + ' (ei HEAD-versiota)'); continue; }
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const a = stripComments(head), b = stripComments(now);
    if (a === b) { console.log('  OK   koodi identtinen (ilman kommentteja): ' + f); continue; }
    bad++;
    console.log('  ERO! ' + f + '  (pituus ' + a.length + ' → ' + b.length + ')');
    for (let k = 0; k < Math.min(a.length, b.length); k++) {
        if (a[k] !== b[k]) {
            console.log('    kohta ' + k + ': ...' + a.slice(Math.max(0, k - 60), k + 60) +
                        '  ⟷  ...' + b.slice(Math.max(0, k - 60), k + 60));
            break;
        }
    }
}
console.log(bad ? ('EROJA: ' + bad + ' (kommenttisiivous muutti koodia – tutki!)')
                : 'KAIKKI OK: vain kommentit muuttuivat, koodi on identtinen');
process.exit(bad ? 1 : 0);
