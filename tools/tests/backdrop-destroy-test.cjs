/* v11.24: taustarivin rauniot – validoi SUORAAN street.js:n funktiot (ei replikaa).
   Aiempi versio (v10.19) testasi omaa kopiota poistologiikasta → vanhentui v11.24:ssä.
   Aja: node %TEMP%\backdrop-destroy-test.cjs                                      */
const fs = require('fs');
const src = require('./street-src.cjs');

function extract(name) {
    const idx = src.indexOf('function ' + name + '(');
    if (idx < 0) throw new Error('funktiota ei löytynyt: ' + name);
    let depth = 0, i = src.indexOf('{', idx);
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(idx, i + 1); }
    }
    throw new Error('sulut eivät täsmää: ' + name);
}
function num(name) {
    const m = src.match(new RegExp('^\\s*const ' + name + '\\s*=\\s*([^;\\n]+)', 'm'));
    if (!m) throw new Error('vakiota ei löytynyt: ' + name);
    return parseFloat(m[1]);
}

const prelude = `
const BACKDROP_PARALLAX = ${num('BACKDROP_PARALLAX')};
const METEOR_BACKDROP_HOUSES = ${num('METEOR_BACKDROP_HOUSES')};
const BACKDROP_GONE_SHARE = ${num('BACKDROP_GONE_SHARE')};
const BD_RUIN_STUB_MIN = ${num('BD_RUIN_STUB_MIN')};
const BD_RUIN_STUB_MAX = ${num('BD_RUIN_STUB_MAX')};
const WORLD_W = ${num('WORLD_W')};
let backdrop = { blocks: [], total: 0 };
let camX = 0;
const BLDG_FORCE = false, BLDG_TARGET = null;
${extract('ruinBackdropBlock')}
${extract('destroyBackdropHouses')}
${extract('backdropMostlyGone')}
return { ruinBackdropBlock, destroyBackdropHouses, backdropMostlyGone,
         setBD: (list) => { backdrop = { blocks: list.map((h, i) => ({ x: i * 20, w: 20, h: h })), total: list.length }; },
         bd: () => backdrop, NUM: { BACKDROP_PARALLAX, METEOR_BACKDROP_HOUSES, BD_RUIN_STUB_MIN, BD_RUIN_STUB_MAX } };
`;
const S = new Function(prelude)();
let pass = 0, fail = 0;
function ok(label, cond, extra) {
    if (cond) { pass++; console.log('  OK   ' + label); }
    else { fail++; console.log('  FAIL ' + label + (extra ? '  -> ' + extra : '')); }
}

/* 1) Lohkot eivät enää katoa – ne raunioituvat */
console.log('1) lohkot säilyvät rivissä (v11.24)');
S.setBD(new Array(30).fill(90));
S.destroyBackdropHouses(0);
ok('30 lohkoa → edelleen 30', S.bd().blocks.length === 30);
ok('tasan 3 raunioitui', S.bd().blocks.filter(b => b.ruin).length === 3);
let hOk = true, nOk = true, wOk = true;
for (const b of S.bd().blocks) {
    if (!b.ruin) continue;
    const r = b.ruin;
    if (!(r.stub >= Math.round(b.h * S.NUM.BD_RUIN_STUB_MIN) && r.stub <= Math.round(b.h * S.NUM.BD_RUIN_STUB_MAX))) hOk = false;
    if (!(r.cols.length >= 2 && r.cols.length <= 4 && r.slabs.length >= 2 && r.slabs.length <= 4)) nOk = false;
    if (!(r.walls.length >= 1 && r.walls.length <= 3)) wOk = false;
}
ok('runko 55–80 % alkuperäisestä', hOk);
ok('pystypalkit + laattaviivat 2–4 kpl', nOk);
ok('seinäpaloja 1–3', wOk);

/* 2) Montako kertaa voi osua: ei kaatumista, ei poistoa, rauniot rapistuvat */
console.log('2) 200 osumaa riviin – rauniot rapistuvat, rivi ei tyhjene');
S.setBD(new Array(40).fill(100));
let kaatui = 0;
for (let h = 0; h < 200; h++) {
    try { S.destroyBackdropHouses(h * 7); } catch (e) { kaatui++; break; }
}
ok('ei kaatumisia 200 osumalla', kaatui === 0);
ok('lohkoja edelleen 40 (ei koskaan poisteta)', S.bd().blocks.length === 40);
/* v11.26: destroyBackdropHouses valitsee vain EHJIÄ lohkoja → sama raunio ei osu
   enää uudelleen. Rapistuminen (toinen osuma murentaa yhden seinäpalan) testataan
   suoraan ruinBackdropBlockilla – muuten tämä ei enää laukea. */
const ruined = S.bd().blocks.find(b => b.ruin && b.ruin.walls.length > 0);
let rapistui = 0;
if (ruined) {
    const before = ruined.ruin.walls.length;
    S.ruinBackdropBlock(ruined);
    if (ruined.ruin.walls.length === before - 1) rapistui++;
}
ok('seinäpaloja mureni ' + rapistui + ' kerralla (raunio rapistuu)', rapistui > 0);

/* 3) Eskalaatiokynnys laskee EHJISTÄ lohkoista */
console.log('3) eskalaatiokynnys (ehjät lohkot)');
S.setBD(new Array(30).fill(90));
S.destroyBackdropHouses(0);
ok('3/30 rauniota → ei eskalaatiota', S.backdropMostlyGone() === false);
for (let i = 0; i < 22; i++) S.destroyBackdropHouses(i * 28);
ok('kaikki raunioina → eskalaatio', S.backdropMostlyGone() === true);
ok('edelleen 30 lohkoa rivissä', S.bd().blocks.length === 30);

console.log('');
console.log('══════════════════════════════════════');
console.log(pass + ' OK / ' + fail + ' löydöstä');
if (fail > 0) process.exitCode = 1;
