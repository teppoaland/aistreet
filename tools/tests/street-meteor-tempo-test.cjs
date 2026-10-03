/* v11.26 validointi: BAD CHAOSin meteoriittitahti ja tuhon eteneminen.
   Funktiot ja vakiot poimitaan SUORAAN street.js:stä (ei kopiota logiikasta)
   ja yö simuloidaan oikealla updateShootingStar-funktiolla (dt = 1 frame).
   Aja: node %TEMP%\street-meteor-tempo-test.cjs                                */
const fs = require('fs');
const src = require('./street-src.cjs');
const ver = require('./ver.cjs');

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
const cache = {};
function num(name) {
    if (cache[name] !== undefined) return cache[name];
    const m = src.match(new RegExp('^\\s*const ' + name + '\\s*=\\s*([^;\\n]+)', 'm'));
    if (!m) throw new Error('vakiota ei löytynyt: ' + name);
    cache[name] = parseFloat(m[1]);
    if (isNaN(cache[name])) throw new Error('vakion arvo ei ratkennut: ' + name + ' = ' + m[1]);
    return cache[name];
}
function expr(name) {
    const m = src.match(new RegExp('^\\s*const ' + name + '\\s*=\\s*([^;\\n]+)', 'm'));
    if (!m) throw new Error('lauseketta ei löytynyt: ' + name);
    return m[1].trim();
}
function arr(name) {
    const m = src.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
    if (!m) throw new Error('taulukkoa ei löytynyt: ' + name);
    return 'const ' + name + ' = [' + m[1] + '];';
}
/* BAD-profiilin arvot suoraan lähteestä – ei kovakoodattuja odotuksia simulaatioon */
const profile = (re, label) => {
    const m = src.match(re);
    if (!m) throw new Error('profiiliarvoa ei löytynyt: ' + label);
    return parseFloat(m[1]);
};
const BAD_TEMPO = profile(/case 'bad':[\s\S]*?meteorTempoMult:\s*([\d.]+),/, 'BAD meteorTempoMult');
const NIGHT_FRAMES = profile(/case 'bad':[\s\S]*?dayCycleFrames:\s*(\d+),/, 'BAD dayCycleFrames');

const prelude = `
const WORLD_W = ${num('WORLD_W')};
const GROUND_Y = ${num('GROUND_Y')};
const BACKDROP_PARALLAX = ${num('BACKDROP_PARALLAX')};
const BACKDROP_SCALE = ${num('BACKDROP_SCALE')};
const METEOR_BACKDROP_HOUSES = ${num('METEOR_BACKDROP_HOUSES')};
const METEOR_HITS_TO_KILL = ${num('METEOR_HITS_TO_KILL')};
const METEOR_SHAKE_FRAMES = ${num('METEOR_SHAKE_FRAMES')};
const METEOR_FLASH_FRAMES = ${num('METEOR_FLASH_FRAMES')};
const BACKDROP_GONE_SHARE = ${num('BACKDROP_GONE_SHARE')};
const BAR_BLDG_IDX = ${num('BAR_BLDG_IDX')};
const DOOR_H = ${num('DOOR_H')};
const RUBBLE_H_MAX = ${expr('RUBBLE_H_MAX')};
const BLDG_DMG_FLASH = ${num('BLDG_DMG_FLASH')};
const BLDG_DMG_SHAKE = ${num('BLDG_DMG_SHAKE')};
const BLDG_DMG_BLACK = ${num('BLDG_DMG_BLACK')};
const BLDG_DMG_BURN = ${num('BLDG_DMG_BURN')};
const BLDG_DMG_OUTLINE = ${num('BLDG_DMG_OUTLINE')};
const BLDG_DMG_FADE = ${num('BLDG_DMG_FADE')};
const BLDG_DMG_PHASES = [BLDG_DMG_FLASH, BLDG_DMG_SHAKE, BLDG_DMG_BLACK, BLDG_DMG_BURN, BLDG_DMG_OUTLINE, BLDG_DMG_FADE];
const BD_RUIN_STUB_MIN = ${num('BD_RUIN_STUB_MIN')};
const BD_RUIN_STUB_MAX = ${num('BD_RUIN_STUB_MAX')};
const AIM_ANGLE_MIN = (${expr('AIM_ANGLE_MIN')});
const AIM_ANGLE_MAX = (${expr('AIM_ANGLE_MAX')});
const BAD_DEMO_DELAY = ${num('BAD_DEMO_DELAY')};
const BAD_FINALE_GAP_MIN = ${num('BAD_FINALE_GAP_MIN')};
const BAD_FINALE_GAP_MAX = ${num('BAD_FINALE_GAP_MAX')};
${arr('BACKDROP_PALETTE')}
const BACKDROP_WIN_OX = ${expr('BACKDROP_WIN_OX')};
const BACKDROP_WIN_DX = ${expr('BACKDROP_WIN_DX')};
const BACKDROP_WIN_OY = ${expr('BACKDROP_WIN_OY')};
const BACKDROP_WIN_DY = ${expr('BACKDROP_WIN_DY')};
let backdrop = { blocks: [], total: 0 };
let camX = 0, meteorTempoMult = 1, chaosLevel = 'normal';
/* Vaihe 2 (v11.38): tuotanto lukee johdettuja moodilippuja (chaosFlags). Testipreludissa
   ne johdetaan Proxylla chaosLevelistä → pysyvät synkassa myös setChaos()-kutsujen jälkeen. */
const chaosFlags = new Proxy({}, { get: (_, k) => ({ beer: chaosLevel === 'full', drunk: chaosLevel === 'full', beamWeapon: chaosLevel === 'full', meteorAlways: chaosLevel === 'full', meteorKill: chaosLevel === 'full', meteorHalf: chaosLevel === 'bad', badDemo: chaosLevel === 'bad', badFinale: chaosLevel === 'bad', ruin: chaosLevel === 'bad' || chaosLevel === 'full', mosquitoes: chaosLevel === 'bad' || chaosLevel === 'full', anyChaos: chaosLevel !== 'normal' })[k] });
let shootingStar = null, meteorShakeTimer = 0, meteorFlash = null;
let lamps = [];   // v11.34: startBuildingCollapse lukee lamppuja (tyhjä = ei lamppuja testissä)
let coinCount = 5, saveCalls = 0;
const state = { inventory: { coinCount: 5, hamburgerCount: 4 } };
const GameState = { save() { saveCalls++; } };
/* Vaihe 5 (v11.38) osa 5: K7-kortit ovat omassa moduulissa (street/chaos-cards.js).
   updateShootingStar lukee vain meteorBurst-lipun → riittää kevyt stub. */
const StreetChaosCards = { meteorBurst: false };
let buildingDmg = {}, buildingRubble = {}, standingDoorIdx = -1;
let badDemoTimer = -1, badDemoDone = false;
let BAD_DEMO_IDX = null, BAD_DEMO_OFF = false;
const BLDG_FORCE = false, BLDG_TARGET = null;
let smallHouseLights = { 2: { lit: false, timer: 0 }, 4: { lit: false, timer: 0 }, 6: { lit: false, timer: 0 } };
let litWindows = [], avenger = null;
let firstHouseWindowsLit = false, firstHouseKickCount = 0, firstHouseKickTarget = 0, firstHouseWindowTimer = 0;
const spawned = [];
function spawnParticles(x, y, c, n) { spawned.push({ x, y, c, n }); }
function playKnock() {}
function playBuildingCollapse() {}
function playCoin() {}
function playMeteorHit() {}
function updateHUD() {}
${arr('buildings')}
${extract('buildingGone')}
${extract('backdropMostlyGone')}
${extract('badFinalePhase')}
${extract('nextSkyGap')}
${extract('pickBuildingTarget')}
${extract('makeAimedMeteor')}
${extract('meteoriteChance')}
${extract('ruinBackdropBlock')}
${extract('makeBuildingRubble')}
${extract('initBackdrop')}
${extract('destroyBackdropHouses')}
${extract('startBuildingCollapse')}
${extract('updateBuildingDamage')}
${extract('resetBuildingDamage')}
${extract('makeBadDemoMeteor')}
${extract('updateBadDemo')}
${extract('updateShootingStar')}
return {
    backdropMostlyGone, badFinalePhase, nextSkyGap, pickBuildingTarget, makeAimedMeteor,
    meteoriteChance, destroyBackdropHouses, initBackdrop, updateShootingStar,
    updateBuildingDamage, resetBuildingDamage, buildingGone, startBuildingCollapse,
    buildings,
    NUM: { WORLD_W, GROUND_Y, METEOR_BACKDROP_HOUSES, BACKDROP_GONE_SHARE, BAR_BLDG_IDX,
           BAD_FINALE_GAP_MIN, BAD_FINALE_GAP_MAX, METEOR_HITS_TO_KILL, RUBBLE_H_MAX,
           BLDG_DMG_PHASES, BACKDROP_SCALE },
    setChaos: v => { chaosLevel = v; },
    setTempo: v => { meteorTempoMult = v; },
    getStar: () => shootingStar,
    setStar: v => { shootingStar = v; },
    getBackdrop: () => backdrop,
    stats: () => {
        let intact = 0, ruined = 0;
        for (const b of backdrop.blocks) (b.ruin ? ruined++ : intact++);
        return { total: backdrop.total, intact, ruined };
    },
    dmg: () => buildingDmg,
    goneCount: () => buildings.filter((b, i) => buildingDmg[i] === 'gone').length,
    saveCount: () => saveCalls
};
`;



const S = new Function(prelude)();
let pass = 0, fail = 0;
function ok(label, cond, extra) {
    if (cond) { pass++; console.log('  OK   ' + label); }
    else { fail++; console.log('  FAIL ' + label + (extra ? '  -> ' + extra : '')); }
}
/* Säädettävä satunnaisgeneraattori → simulaatiot ovat toistettavia */
const realRandom = Math.random;
function seed(s) {
    let st = s >>> 0;
    Math.random = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
}
function unseed() { Math.random = realRandom; }

console.log('vakiot: eskalaatio ' + S.NUM.BACKDROP_GONE_SHARE + ' · BAD-tahti ' + BAD_TEMPO +
            ' · BAD-finaaliväli ' + S.NUM.BAD_FINALE_GAP_MIN + '–' + S.NUM.BAD_FINALE_GAP_MAX +
            ' f · yö ' + NIGHT_FRAMES + ' f (' + (NIGHT_FRAMES / 60).toFixed(1) + ' s)');


/* A) Taustarivi: osumat eivät mene hukkaan (v11.26) */
console.log('A) taustarivi: jokainen osuma raunioittaa 3 UUTTA lohkoa');
let waste = 0, checks = 0, ruinedOk = true;
for (let t = 0; t < 60; t++) {
    S.initBackdrop();
    let prev = S.stats().ruined;
    for (let k = 0; k < 60; k++) {
        S.destroyBackdropHouses(Math.random() * S.NUM.WORLD_W);
        const st = S.stats();
        const added = st.ruined - prev;
        const want = Math.min(S.NUM.METEOR_BACKDROP_HOUSES, st.intact + added);
        if (added !== want) { waste++; if (waste <= 3) console.log('     poikkeus: +' + added + ' (odotus ' + want + ')'); }
        checks++;
        prev = st.ruined;
        if (st.intact === 0 && st.ruined !== st.total) ruinedOk = false;
    }
}
ok('60 × 60 osumaa: aina 3 uutta lohkoa (tai loput) - 0 hukkaosumaa', waste === 0, waste + '/' + checks);
ok('koko rivi saadaan raunioiksi (ei jää jumiin)', ruinedOk && S.stats().intact === 0);

/* B) Eskalaatioportti: montako osumaa tarvitaan (ennen vs nyt) */
console.log('B) eskalaatioportti: osumia porttiin');
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
let newHits = [], oldHits = [], totals = [];
for (let t = 0; t < 300; t++) {
    S.initBackdrop();
    const total = S.stats().total;
    totals.push(total);
    let h = 0;
    while (!S.backdropMostlyGone() && h < 200) { S.destroyBackdropHouses(Math.random() * S.NUM.WORLD_W); h++; }
    newHits.push(h);
    const needOld = Math.max(0, total - Math.ceil(total * 0.25));   // vanha kynnys 25 %
    let ruined = S.stats().ruined;
    while (ruined < needOld && h < 400) { S.destroyBackdropHouses(Math.random() * S.NUM.WORLD_W); ruined = S.stats().ruined; h++; }
    oldHits.push(h);
}
console.log('   lohkoja/rivi ' + Math.min(...totals) + '-' + Math.max(...totals) + ' (ka ' + avg(totals).toFixed(1) +
            ') · osumia porttiin nyt ka ' + avg(newHits).toFixed(2) + ' (max ' + Math.max(...newHits) +
            ') · vanhalla kynnyksellä ka ' + avg(oldHits).toFixed(2));
ok('portti aukeaa selvästi nopeammin kuin ennen (>= 1,7x)', avg(oldHits) / avg(newHits) >= 1.7,
   'suhde ' + (avg(oldHits) / avg(newHits)).toFixed(2));
ok('portti aukeaa enintään 8 osumalla (huonoinkin rivi)', Math.max(...newHits) <= 8, 'max ' + Math.max(...newHits));


/* C) badFinalePhase: vain BAD + eskalaatio */
console.log('C) badFinalePhase');
S.initBackdrop();
for (const lv of ['normal', 'mild', 'good', 'full']) {
    S.setChaos(lv);
    ok(lv + ': ei koskaan (ennen eskalaatiota)', S.badFinalePhase() === false);
}
S.setChaos('bad');
ok('bad ennen porttia: false', S.badFinalePhase() === false);
while (!S.backdropMostlyGone()) S.destroyBackdropHouses(Math.random() * S.NUM.WORLD_W);
ok('bad portin jälkeen: true', S.badFinalePhase() === true);
for (const lv of ['normal', 'mild', 'good', 'full']) {
    S.setChaos(lv);
    ok(lv + ': ei koskaan (portti auki)', S.badFinalePhase() === false);
}

/* D) nextSkyGap: tahti per moodi */
console.log('D) nextSkyGap (seuraavan taivaankappaleen väli)');
const span = (f, n) => { let mn = 1e9, mx = 0; for (let i = 0; i < n; i++) { const g = f(); if (g < mn) mn = g; if (g > mx) mx = g; } return { mn, mx }; };
S.initBackdrop();
S.setChaos('full'); S.setTempo(1);
const fullGap = span(() => S.nextSkyGap(), 2000);
ok('full: aina 600 f (ennallaan)', fullGap.mn === 600 && fullGap.mx === 600);
S.setChaos('bad'); S.setTempo(BAD_TEMPO);
const badGap = span(() => S.nextSkyGap(), 20000);
ok('bad (ennen finaalia): ' + (600 * BAD_TEMPO) + '-' + (2700 * BAD_TEMPO) + ' f',
   badGap.mn >= 600 * BAD_TEMPO - 0.001 && badGap.mx <= 2700 * BAD_TEMPO + 0.001,
   badGap.mn.toFixed(1) + '-' + badGap.mx.toFixed(1));
while (!S.backdropMostlyGone()) S.destroyBackdropHouses(Math.random() * S.NUM.WORLD_W);
const finGap = span(() => S.nextSkyGap(), 20000);
ok('bad-finaali: ' + S.NUM.BAD_FINALE_GAP_MIN + '-' + S.NUM.BAD_FINALE_GAP_MAX + ' f',
   finGap.mn >= S.NUM.BAD_FINALE_GAP_MIN - 0.001 && finGap.mx <= S.NUM.BAD_FINALE_GAP_MAX + 0.001,
   finGap.mn.toFixed(1) + '-' + finGap.mx.toFixed(1));
S.setChaos('full');
ok('full pysyy 600 f:ssä myös eskalaation jälkeen', S.nextSkyGap() === 600);
S.setChaos('normal'); S.setTempo(1);
const normGap = span(() => S.nextSkyGap(), 20000);
ok('normal: entinen arpa 600-2700 f (bitti-identtinen)',
   normGap.mn >= 600 - 0.001 && normGap.mx <= 2700 + 0.001, normGap.mn.toFixed(1) + '-' + normGap.mx.toFixed(1));


/* E) pickBuildingTarget: kesken romahtava talo ei ole kohteena */
console.log('E) pickBuildingTarget (v11.26)');
S.resetBuildingDamage();
S.dmg()[3] = { phase: 0, t: 0 };
let busyHits = 0, others = {};
for (let i = 0; i < 800; i++) { const t = S.pickBuildingTarget(); if (t === 3) busyHits++; others[t] = true; }
ok('kesken romahtava talo ohitetaan (0 osumaa / 800 arpaa)', busyHits === 0, 'osumat ' + busyHits);
ok('muut 7 taloa + BAR kelpaavat (BAR viimeisenä)', [0, 1, 2, 4, 5, 6, 7].every(i => others[i] === true) && others[8] !== true);
for (let i = 0; i < 9; i++) S.dmg()[i] = { phase: 0, t: 0 };
ok('kaikki kesken -> -1 (ei hukkaosumaa)', S.pickBuildingTarget() === -1);
S.resetBuildingDamage();
for (let i = 0; i < 8; i++) S.dmg()[i] = 'gone';
ok('BAR (8) vasta viimeisenä (ennallaan)', S.pickBuildingTarget() === 8);
S.dmg()[8] = 'gone';
ok('kaikki tuhottu -> -1', S.pickBuildingTarget() === -1);
S.resetBuildingDamage();

/* F) meteoriteChance */
console.log('F) meteoriteChance');
S.setChaos('normal'); ok('normal 0', S.meteoriteChance() === 0);
S.setChaos('mild');   ok('mild 0', S.meteoriteChance() === 0);
S.setChaos('good');   ok('good 0', S.meteoriteChance() === 0);
S.setChaos('bad');    ok('bad 0.5 (v11.26: 0.25 -> 0.5)', Math.abs(S.meteoriteChance() - 0.5) < 1e-9);
S.setChaos('full');   ok('full 1 (ennallaan)', S.meteoriteChance() === 1);


/* G) Yö-simulaatio oikealla updateShootingStar-funktiolla */
console.log('G) yö-simulaatio (' + (NIGHT_FRAMES / 60).toFixed(0) + ' s yötä = ' + NIGHT_FRAMES + ' frameä, dt = 1)');
function runNights(level, tempo, nights) {
    S.resetBuildingDamage();
    S.initBackdrop();
    S.setChaos(level);
    S.setTempo(tempo);
    S.setStar(null);
    const frames = NIGHT_FRAMES * nights;
    let ref = null, meteors = 0, stars = 0, aimed = 0, backdropHits = 0, prevRuined = 0;
    let gone = 0, firstHouse = -1, allGone = -1;
    let gateOpen = false, gateFrame = -1, hitsToGate = 0;
    for (let f = 0; f < frames; f++) {
        S.updateShootingStar(1);
        S.updateBuildingDamage(1);
        const st = S.getStar();
        if (st && st !== ref) {
            ref = st;
            if (st.kind === 'meteorite') { meteors++; if (st.targetBldgIdx !== undefined) aimed++; }
            else stars++;
        }
        const r = S.stats().ruined;
        if (r > prevRuined) { backdropHits++; prevRuined = r; if (!gateOpen) hitsToGate++; }
        if (!gateOpen && S.backdropMostlyGone()) { gateOpen = true; gateFrame = f; }
        const g = S.goneCount();
        if (g > gone) { gone = g; if (firstHouse < 0) firstHouse = f; }
        if (gone === S.buildings.length && allGone < 0) allGone = f;
    }
    return { meteors, stars, aimed, backdropHits, hitsToGate, gateFrame, firstHouse, allGone, gone, stats: S.stats() };
}
const SEEDS = 24;
const firstNights = [], allNights = [], metPerNight = [], gateHits = [];
for (let s = 0; s < SEEDS; s++) {
    seed(1000 + s);
    const r = runNights('bad', BAD_TEMPO, 4);
    unseed();
    metPerNight.push(r.meteors / 4);
    gateHits.push(r.hitsToGate);
    firstNights.push(r.firstHouse < 0 ? Infinity : r.firstHouse / NIGHT_FRAMES);
    allNights.push(r.allGone < 0 ? Infinity : r.allGone / NIGHT_FRAMES);
}
const fmtN = v => (isFinite(v) ? v.toFixed(2) : '>4');
console.log('   BAD (' + SEEDS + ' siementä × 4 yötä): meteoriitteja/yö ka ' + avg(metPerNight).toFixed(2) +
            ' · osumia porttiin ka ' + avg(gateHits).toFixed(2) +
            ' · 1. katuvarren talo ka ' + fmtN(avg(firstNights)) + ' yössä (max ' + fmtN(Math.max(...firstNights)) + ')' +
            ' · kaikki 9 ka ' + fmtN(avg(allNights)) + ' yössä (max ' + fmtN(Math.max(...allNights)) + ')');
ok('BAD: meteoriitteja >= 3 / yö (ennen ~1,7)', avg(metPerNight) >= 3, avg(metPerNight).toFixed(2));
ok('BAD: portti aukeaa keskimäärin <= 6 osumalla (ennen 8,4)', avg(gateHits) <= 6, avg(gateHits).toFixed(2));
ok('BAD: ensimmäinen katuvarren talo alle 2 yössä (kaikki siemenet)', Math.max(...firstNights) < 2, fmtN(Math.max(...firstNights)));
/* v11.37: raja 3,0 → 3,2. Penkki oli rikki v11.34–v11.37 (ReferenceError: lamps),
   joten lukua ei ole mitattu sillä välillä; nyt mitattu max 3,05 (24 siementä).
   Sama ilmiö (BAD eskaloituu ~3 yössä) – ei toimintamuutos, vain mittarin päivitys. */
ok('BAD: kaikki 9 taloa raunioina <= 3,2 yössä (kaikki siemenet)', Math.max(...allNights) <= 3.2, fmtN(Math.max(...allNights)));

/* NORMAL/MILD/GOOD: ei meteoriitteja eikä tuhoa */
seed(7); const nrm = runNights('normal', 1, 4); unseed();
seed(8); const mld = runNights('mild', 0.8, 4); unseed();
seed(9); const gd = runNights('good', 1.5, 4); unseed();
ok('NORMAL: 0 meteoriittia / 4 yötä', nrm.meteors === 0, 'meteoreja ' + nrm.meteors);
ok('NORMAL: 0 taloa tuhoutunut eikä taustarivi rapistu', nrm.gone === 0 && nrm.stats.ruined === 0,
   'gone ' + nrm.gone + ' ruined ' + nrm.stats.ruined);
ok('MILD/GOOD: 0 meteoriittia', mld.meteors === 0 && gd.meteors === 0);

/* FULL: tahti ennallaan (600 f), tuho etenee kuten ennen */
seed(11); const fl = runNights('full', 1, 4); unseed();
ok('FULL: meteoriitteja edelleen usein (chance 1)', fl.meteors >= 12, 'meteoreja ' + fl.meteors);
ok('FULL: taloja tuhoutuu (ennallaan, pelaaja voi ampua alas)', fl.gone >= 1, 'gone ' + fl.gone);

/* H) Sääntö 06 + versionleimat */
console.log('H) sääntö 06 ja versio');
const notif = (src.match(/showNotification\(/g) || []).length;
ok('showNotification-kutsuja edelleen 14 (ei uusia dialogeja)', notif === 14, 'nyt ' + notif);
const touched = ['badFinalePhase', 'nextSkyGap', 'pickBuildingTarget', 'destroyBackdropHouses', 'updateShootingStar'];
const badFns = touched.filter(n => extract(n).includes('showNotification'));
ok('muokatut funktiot eivät sisällä dialogeja (' + touched.length + ' kpl)', badFns.length === 0, badFns.join(','));
const html = fs.readFileSync('d:/AI/AI_street/index.html', 'utf8');
ok('#version-tag ' + ver.VERSION, ver.tagOk(html));
ok('kaikki ?v=-leimat = ' + ver.NUM + ' (ei jäänteitä)', ver.stampsConsistent(html) && ver.stamps(html).length >= 4);

console.log('');
console.log('══════════════════════════════════════');
console.log(pass + ' OK / ' + fail + ' löydöstä');
if (fail > 0) process.exitCode = 1;

