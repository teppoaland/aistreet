/* ═══════════════════════════════════════════════════════════
   clean-version-comments.cjs – Vaihe 6 (v11.45): kommenttien
   versiosiivous. Poistaa KOMMENTEISTA historian (vNN.NN-merkinnät)
   ja jättää "miksi"-sisällön. Historia elää `CHANGELOG.md`:ssä,
   git-logissa ja muistipankissa – ei enää kommenteissa.

   Turvarajat:
     • muokataan VAIN kommenttiosuutta (rivi- ja lohkokommentit sekä niiden
       jatkorivit); koodi ja merkkijonot jäävät koskemattomiksi
       (lainausheuristiikka: kommentin alku etsitään lainausten ulkopuolelta)
     • `?v=`-leimat ja `#version-tag` eivät ole vNN.NN-muotoa → ei kosketa
     • index.html jätetään rauhaan (sääntö 01: suojattu pääsivutiedosto;
       sen versiokommentit kertovat versioleimakäytännöstä)

   Ajo:   node tools/refactor/clean-version-comments.cjs --dry   (esikatselu)
          node tools/refactor/clean-version-comments.cjs
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const DRY = process.argv.includes('--dry');

const FILES = ['street.js', 'gameState.js', 'audio.js', 'style.css',
    'street/chaos-config.js', 'street/sfx.js', 'street/news.js',
    'street/traffic.js', 'street/chaos-cards.js', 'street/rooms.js'];

const VER = 'v\\d+\\.\\d+[a-z]?';
const VERLIST = VER + '(?:\\s*[/,–-]\\s*' + VER + ')*';
const reVerList = new RegExp('\\b' + VERLIST + '\\b', 'g');
const reVer = new RegExp('\\b' + VER + '\\b', 'g');

/* ── Kommenttiosuuden alku (lainausheuristiikka) ─────────────────── */
function commentStart(line) {
    let q = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) {
            if (c === '\\') { i++; continue; }
            if (c === q) q = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') { q = c; continue; }
        if (c === '/' && (line[i + 1] === '/' || line[i + 1] === '*')) return i;
    }
    const t = line.trim();
    if (t.startsWith('*')) return line.indexOf('*');
    return -1;
}

/* ── Yhden kommentin siivous (sisältö ilman kommenttimerkkiä) ───── */
function cleanComment(text) {
    let s = text;

    /* 1) "vNN.NN (bugikorjaus):" → "Bugikorjaus:" */
    s = s.replace(new RegExp('^\\s*' + VER + '\\s*\\(bugikorjaus\\)\\s*:\\s*', 'i'), 'Bugikorjaus: ');
    s = s.replace(new RegExp('\\(bugikorjaus,?\\s*' + VER + '\\)', 'gi'), '(bugikorjaus)');

    /* 2) "vNN.NN (X): Y" alussa → "X: Y" */
    s = s.replace(new RegExp('^\\s*' + VER + '\\s*\\(([^)]*)\\)\\s*[:–-]\\s*'), (m, g) => g ? g + ': ' : '');

    /* 3) "vNN.NN: Y" / "vNN.NN – Y" alussa → "Y" */
    s = s.replace(new RegExp('^\\s*' + VER + '\\s*[:–-]\\s*'), '');
    /* 4) pelkkä "vNN.NN" alussa → pois */
    s = s.replace(new RegExp('^\\s*' + VERLIST + '\\s*'), '');

    /* 5) sulkuryhmät: pudota pelkät versiot, pidä merkitys */
    s = s.replace(/\(([^()]*)\)/g, (m, inner) => {
        if (!reVer.test(inner)) { reVer.lastIndex = 0; return m; }
        reVer.lastIndex = 0;
        let parts = inner.split(',').map((p) => p.trim());
        parts = parts.filter((p) => !new RegExp('^' + VERLIST + '$').test(p));
        if (!parts.length) return '';
        parts = parts.map((p) => p.replace(new RegExp('^' + VER + '\\s*[:–-]\\s*'), ''));
        return '(' + parts.join(', ') + ')';
    });

    /* 6) muualla lauseessa: ", vNN.NN" / "– vNN.NN" pois */
    s = s.replace(new RegExp('[,\\s]*[–-]\\s*' + VERLIST, 'g'), '');
    s = s.replace(new RegExp(',\\s*' + VERLIST, 'g'), '');
    s = s.replace(new RegExp('\\bks\\.\\s*' + VERLIST, 'g'), 'ks.');

    /* 7) jäljelle jääneet pelkät merkinnät pois */
    s = s.replace(reVerList, '');

    /* 8) siivous */
    s = s.replace(/\s+([,.;:)!])/g, '$1');
    s = s.replace(/\(\s+/g, '(');
    s = s.replace(/\s{2,}/g, ' ');
    s = s.replace(/^[,\s–-]+/, '');
    if (s.trim() === '') return '';
    return s;
}

let totalFiles = 0, totalChanged = 0, after = 0;
const leftovers = [], samples = [];
for (const rel of FILES) {
    const p = path.join(ROOT, rel);
    const raw = fs.readFileSync(p, 'utf8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);
    let changed = 0, inBlock = false;
    const out = lines.map((line, idx) => {
        /* ── Etsi kommenttiosuus ───────────────────────────────────────
           Turvallista olla lainausvapaa: koko skoopissa EI ole yhtään
           vNN.NN-merkintää merkkijonossa (tarkistettu erikseen), ja tälle
           riville päästään vain jos rivillä on merkintä. Lohkotila pidetään
           yllä laskemalla avaus- ja sulkumerkinnät. */
        let cStart = -1, cEnd = line.length;
        if (inBlock) {
            cStart = 0;
            const close = line.indexOf('*/');
            if (close >= 0) cEnd = close + 2;
        } else {
            const lc = line.indexOf('//');
            const bc = line.indexOf('/*');
            if (lc >= 0 && (bc < 0 || lc < bc)) { cStart = lc; }
            else if (bc >= 0) {
                cStart = bc;
                const close = line.indexOf('*/', bc + 2);
                if (close >= 0) cEnd = close + 2;
            } else if (line.trim().startsWith('*')) { cStart = line.indexOf('*'); }
        }
        /* Lohkotila seuraavalle riville (sama skannaus riippumatta siitä,
           osuiko riville merkintää). HUOM: tämä rivi saattoi PÄÄTTÄÄ lohkon –
           merkkipäätös tehdään `wasInBlock`ista, ei päivitetystä tilasta. */
        const wasInBlock = inBlock;
        const opens = (line.match(/\/\*/g) || []).length;
        const closes = (line.match(/\*\//g) || []).length;
        if (inBlock) { if (closes > 0) inBlock = false; }
        else if (opens > closes) { inBlock = true; }
        if (cStart < 0) { if (reVer.test(line)) { reVer.lastIndex = 0; leftovers.push([rel, idx + 1, line.trim()]); } reVer.lastIndex = 0; return line; }
        if (!reVer.test(line)) { reVer.lastIndex = 0; return line; }
        reVer.lastIndex = 0;

        const pre = line.slice(0, cStart);
        const body = line.slice(cStart, cEnd);
        const post = line.slice(cEnd);
        /* kommenttimerkki + sisältö erilleen (lohkossa myös paljas sisärivi) */
        const m = /^(\/\/|\/\*|\*)?([\s\S]*?)(\*\/)?$/.exec(body);
        const mark = m[1] || '';
        const inner = m[2] || '';
        const closeMark = m[3] || '';
        const lead = (inner.match(/^\s*/) || [''])[0];      // säilytä sisennys
        const cleaned = cleanComment(inner);
        let newBody;
        if (cleaned === '') {
            /* kommentti oli pelkkää historiaa: jos lohko jatkuu, jätä merkki – muuten rivi pois */
            newBody = closeMark ? (post ? '*/' : '') : '';
            if (mark === '*' && !closeMark) newBody = '*';
        } else {
            newBody = (mark || (wasInBlock ? '' : '//')) + lead + cleaned.replace(/^\s+/, '') + closeMark;
        }
        const res = (pre + newBody + post).replace(/[ \t]+$/, '');
        if (res !== line) {
            changed++;
            if (samples.length < 500) samples.push([rel, idx + 1, line.trim(), res.trim()]);
        }
        if (reVer.test(res)) { reVer.lastIndex = 0; leftovers.push([rel, idx + 1, res.trim()]); }
        reVer.lastIndex = 0;
        return res;
    });
    if (changed) totalFiles++;
    totalChanged += changed;
    after += out.reduce((n, l) => n + ((l.match(reVerList) || []).length), 0);
    console.log(String(changed).padStart(4) + ' riviä siivottiin: ' + rel);
    if (!DRY) fs.writeFileSync(p, out.join(eol), 'utf8');
}

console.log('\n' + (DRY ? '[DRY] ' : '') + 'siivottuja rivejä ' + totalChanged + ' / tiedostoja ' + totalFiles);
console.log((DRY ? '[DRY] ' : '') + 'vNN.NN-merkintöjä jäljellä (tulos): ' + after);
if (DRY && samples.length) {
    console.log('\nESIKATSELU (' + samples.length + ' muutosta, näytetään 25):');
    for (const [f, n, a, b] of samples.slice(0, 25)) console.log('  ' + f + ':' + n + '\n    – ' + a.slice(0, 120) + '\n    + ' + b.slice(0, 120));
}
if (leftovers.length) {
    console.log('\nTARKISTETTAVAT (' + leftovers.length + ' riviä – merkintä jäi tai se on koodissa):');
    for (const [f, n, t] of leftovers.slice(0, 40)) console.log('  ' + f + ':' + n + '  ' + t.slice(0, 110));
}
