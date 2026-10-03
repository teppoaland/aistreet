/* v11.24 validointi: meteoriittituhon jälkitila + BAD-avaus.
   Funktiot ja vakiot poimitaan SUORAAN street.js:stä (ei kopiota logiikasta).
   Aja: node %TEMP%\street-meteor-aftermath-test.cjs                            */
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

const prelude = `
const DOOR_H = ${num('DOOR_H')};
const DOOR_W = ${num('DOOR_W')};
const WORLD_W = ${num('WORLD_W')};
const GROUND_Y = ${num('GROUND_Y')};
const BACKDROP_PARALLAX = ${num('BACKDROP_PARALLAX')};
const METEOR_BACKDROP_HOUSES = ${num('METEOR_BACKDROP_HOUSES')};
const METEOR_HITS_TO_KILL = ${num('METEOR_HITS_TO_KILL')};
const BACKDROP_GONE_SHARE = ${num('BACKDROP_GONE_SHARE')};
const BAR_BLDG_IDX = ${num('BAR_BLDG_IDX')};
const BLDG_DMG_FLASH = ${num('BLDG_DMG_FLASH')};
const BLDG_DMG_SHAKE = ${num('BLDG_DMG_SHAKE')};
const BLDG_DMG_BLACK = ${num('BLDG_DMG_BLACK')};
const BLDG_DMG_BURN = ${num('BLDG_DMG_BURN')};
const BLDG_DMG_OUTLINE = ${num('BLDG_DMG_OUTLINE')};
const BLDG_DMG_FADE = ${num('BLDG_DMG_FADE')};
const BLDG_DMG_PHASES = [BLDG_DMG_FLASH, BLDG_DMG_SHAKE, BLDG_DMG_BLACK, BLDG_DMG_BURN, BLDG_DMG_OUTLINE, BLDG_DMG_FADE];
const AIM_ANGLE_MIN = (${expr('AIM_ANGLE_MIN')});
const AIM_ANGLE_MAX = (${expr('AIM_ANGLE_MAX')});
const BD_RUIN_STUB_MIN = ${num('BD_RUIN_STUB_MIN')};
const BD_RUIN_STUB_MAX = ${num('BD_RUIN_STUB_MAX')};
const BAD_DEMO_DELAY = ${num('BAD_DEMO_DELAY')};
const RUBBLE_H_MAX = ${expr('RUBBLE_H_MAX')};
let badDemoTimer = -1, badDemoDone = false, standingDoorIdx = -1;
let BAD_DEMO_IDX = null, BAD_DEMO_OFF = false;
let chaosLevel = 'bad';
/* Vaihe 2 (v11.38): tuotanto lukee johdettuja moodilippuja (chaosFlags). Testipreludissa
   ne johdetaan Proxylla chaosLevelistä → pysyvät synkassa myös setChaos()-kutsujen jälkeen. */
const chaosFlags = new Proxy({}, { get: (_, k) => ({ beer: chaosLevel === 'full', drunk: chaosLevel === 'full', beamWeapon: chaosLevel === 'full', meteorAlways: chaosLevel === 'full', meteorKill: chaosLevel === 'full', meteorHalf: chaosLevel === 'bad', badDemo: chaosLevel === 'bad', badFinale: chaosLevel === 'bad', ruin: chaosLevel === 'bad' || chaosLevel === 'full', mosquitoes: chaosLevel === 'bad' || chaosLevel === 'full', anyChaos: chaosLevel !== 'normal' })[k] });
let camX = 0, meteorTempoMult = 1;
let backdrop = { blocks: [], total: 0 };
let shootingStar = null;
let buildingDmg = {}, buildingRubble = {};
let smallHouseLights = { 2: { lit: false, timer: 0 }, 4: { lit: false, timer: 0 }, 6: { lit: false, timer: 0 } };
let litWindows = [], avenger = null;
let firstHouseWindowsLit = false, firstHouseKickCount = 0, firstHouseKickTarget = 0, firstHouseWindowTimer = 0;
const state = { inventory: { coinCount: 7, hamburgerCount: 4 } };
const GameState = { save() {} };
const spawned = [];
function spawnParticles(x, y, c, n) { spawned.push({ x, y, c, n }); }
function playKnock() {}
function playBuildingCollapse() {}
const BLDG_FORCE = false, BLDG_TARGET = null;
${arr('buildings')}
${extract('buildingGone')}
${extract('backdropMostlyGone')}
${extract('pickBuildingTarget')}
${extract('makeAimedMeteor')}
${extract('makeBadDemoMeteor')}
${extract('updateBadDemo')}
${extract('ruinBackdropBlock')}
${extract('destroyBackdropHouses')}
${extract('makeBuildingRubble')}
${extract('startBuildingCollapse')}
${extract('updateBuildingDamage')}
${extract('resetBuildingDamage')}
${extract('meteoriteBehindBuilding')}
return {
    buildingGone, backdropMostlyGone, pickBuildingTarget, makeAimedMeteor, makeBadDemoMeteor,
    updateBadDemo, ruinBackdropBlock, destroyBackdropHouses, makeBuildingRubble,
    startBuildingCollapse, updateBuildingDamage, resetBuildingDamage, meteoriteBehindBuilding,
    buildings, spawned,
    NUM: { DOOR_H, DOOR_W, WORLD_W, GROUND_Y, RUBBLE_H_MAX, BD_RUIN_STUB_MIN, BD_RUIN_STUB_MAX,
           BAD_DEMO_DELAY, METEOR_BACKDROP_HOUSES, BACKDROP_GONE_SHARE, BAR_BLDG_IDX,
           METEOR_HITS_TO_KILL, BLDG_DMG_FADE },
    setChaos: v => { chaosLevel = v; },
    setBackdrop: list => { backdrop = { blocks: list.map((h, i) => ({ x: i * 20, w: 20, h: h, color: '#141a2c', winCols: 1, winRows: 1, lit: null })), total: list.length }; },
    getBackdrop: () => backdrop,
    setStar: s => { shootingStar = s; },
    getStar: () => shootingStar,
    rubble: () => buildingRubble,
    dmg: () => buildingDmg,
    doorIdx: () => standingDoorIdx,
    demoState: () => ({ timer: badDemoTimer, done: badDemoDone }),
    setDemo: (t, d) => { badDemoTimer = t; badDemoDone = d; },
    setDemoIdx: v => { BAD_DEMO_IDX = v; },
    setDemoOff: v => { BAD_DEMO_OFF = v; }
};
`;

const S = new Function(prelude)();
let pass = 0, fail = 0;
function ok(label, cond, extra) {
    if (cond) { pass++; console.log('  OK   ' + label); }
    else { fail++; console.log('  FAIL ' + label + (extra ? '  -> ' + extra : '')); }
}
console.log('vakiot: kasa ≤ ' + S.NUM.RUBBLE_H_MAX + ' px (DOOR_H ' + S.NUM.DOOR_H + ') · raunion runko ' +
            (S.NUM.BD_RUIN_STUB_MIN * 100) + '–' + (S.NUM.BD_RUIN_STUB_MAX * 100) + ' % · BAD-avaus ' +
            S.NUM.BAD_DEMO_DELAY + ' f');

/* A) §2 Romukasa: randomi musta kasa, korkeus ≤ puoli ovenkorkeudesta */
console.log('A) romukasa (makeBuildingRubble)');
ok('RUBBLE_H_MAX = DOOR_H / 2 (16)', S.NUM.RUBBLE_H_MAX === 16 && S.NUM.RUBBLE_H_MAX === Math.round(S.NUM.DOOR_H / 2));
S.resetBuildingDamage();
let hMax = 0, hMin = 999, lumpMin = 9, lumpMax = 0, wOk = true, xOk = true, hOk = true;
for (let i = 0; i < 9; i++) {
    for (let k = 0; k < 400; k++) {
        S.makeBuildingRubble(i);
        const r = S.rubble()[i];
        const b = S.buildings[i];
        if (r.h > hMax) hMax = r.h;
        if (r.h < hMin) hMin = r.h;
        if (lumpMin > r.lumps.length) lumpMin = r.lumps.length;
        if (lumpMax < r.lumps.length) lumpMax = r.lumps.length;
        if (!(r.w >= Math.round(b.w * 0.45) - 1 && r.w <= Math.round(b.w * 0.85) + 1)) wOk = false;
        if (!(r.x >= 0 && r.x + r.w <= b.w + 1)) xOk = false;
        if (!(r.h >= 6 && r.h <= S.NUM.RUBBLE_H_MAX)) hOk = false;
        for (const l of r.lumps) if (!(l.h >= 3 && l.h <= r.h)) hOk = false;
    }
}
ok('kasan korkeus aina 6–' + S.NUM.RUBBLE_H_MAX + ' px (mitattu ' + hMin + '–' + hMax + ')', hOk && hMax <= S.NUM.RUBBLE_H_MAX, 'hMax=' + hMax);
ok('kasa mahtuu talon pohjalle (leveys 45–85 %, keskitetty)', wOk && xOk);
ok('möykkyjä 2–4 (mitattu ' + lumpMin + '–' + lumpMax + ')', lumpMin >= 2 && lumpMax <= 4);
S.makeBuildingRubble(3); const snap = JSON.stringify(S.rubble()[3]);
S.updateBuildingDamage(0);   // ei vielä 'gone' → kasan ei pidä muuttua
ok('kasa ei arvota uudelleen joka framella', JSON.stringify(S.rubble()[3]) === snap);
ok('kasan muoto arvotaan vain tuhoutumishetkellä (määrittely + 1 kutsu)',
   (src.match(/makeBuildingRubble\(/g) || []).length === 2, 'osumia ' + (src.match(/makeBuildingRubble\(/g) || []).length);

/* B) §1 Ovet: ei mustia ovia – vain yksi randomi karmikehys */
console.log('B) ovet (drawDoor)');
const dd = extract('drawDoor');
const goneIdx = dd.indexOf('buildingGone(bldgIdx)');
const goneBranch = dd.slice(goneIdx, dd.indexOf('const isBar'));
ok('tuhoutuneen haara olemassa', goneIdx > 0 && goneBranch.length > 0);
ok('musta ovi (#000000) poistettu', !goneBranch.includes("'#000000'"));
ok('koko oven täyttöä ei enää piirretä', !/fillRect\(dx, dy, DOOR_W, DOOR_H\)/.test(goneBranch));
ok('vain standingDoorIdx saa karmit', goneBranch.includes('bldgIdx !== standingDoorIdx') && goneBranch.includes('return;'));
ok('karmit: vasen + oikea + yläkarmi', goneBranch.includes('fillRect(dx - 2, dy - 2, 2, DOOR_H + 2)') &&
   goneBranch.includes('fillRect(dx + DOOR_W, dy - 2, 2, DOOR_H + 2)') && goneBranch.includes('fillRect(dx - 2, dy - 4, DOOR_W + 4, 2)'));
ok('karmeissa ei kahvaa eikä paneelia', !goneBranch.includes('drawHandle') && !goneBranch.includes('doorBase'));
S.resetBuildingDamage();
S.dmg()[4] = { phase: 5, t: S.NUM.BLDG_DMG_FADE - 0.5 };
S.updateBuildingDamage(1);
const d1 = S.doorIdx();
ok('ensimmäinen tuhoutuminen arpoo ovikehyksen (0–8)', d1 >= 0 && d1 <= 8, 'idx=' + d1);
ok('talo merkittiin tuhoutuneeksi ja kasa syntyi', S.buildingGone(4) === true && !!S.rubble()[4]);
S.dmg()[6] = { phase: 5, t: S.NUM.BLDG_DMG_FADE - 0.5 };
S.updateBuildingDamage(1);
ok('toinen tuhoutuminen ei arvo uutta kehystä', S.doorIdx() === d1);
S.resetBuildingDamage();
ok('reset nollaa kasan, kehyksen ja BAD-avauksen', S.doorIdx() === -1 && Object.keys(S.rubble()).length === 0 &&
   S.demoState().done === false && S.demoState().timer === -1);
ok('standingDoorIdx: määrittely, nollaus, arvonta kerran + vertailu drawDoorssa',
   src.includes('let standingDoorIdx = -1;') &&
   /resetBuildingDamage[\s\S]{0,400}standingDoorIdx = -1;/.test(src) &&
   (src.match(/standingDoorIdx = Math\.floor\(Math\.random\(\) \* buildings\.length\)/g) || []).length === 1 &&
   /if \(bldgIdx !== standingDoorIdx\) return;/.test(src));

/* C) §4 Alakaupungin rauniot */
console.log('C) taustarivin rauniot (destroyBackdropHouses)');
S.resetBuildingDamage();
S.setBackdrop([80, 60, 110, 70, 95, 55, 100, 65, 90, 75]);
S.destroyBackdropHouses(100);   // camX 0 → osuma suoraan tausta-avaruudessa
let bl = S.getBackdrop().blocks;
ok('lohkoja ei enää poisteta (10 → ' + bl.length + ')', bl.length === 10);
ok('tasan ' + S.NUM.METEOR_BACKDROP_HOUSES + ' lohkoa raunioitui', bl.filter(b => b.ruin).length === S.NUM.METEOR_BACKDROP_HOUSES);
let stubOk = true, colOk = true, slabOk = true, wallOk = true;
for (const b of bl) {
    if (!b.ruin) continue;
    const r = b.ruin;
    if (!(r.stub <= Math.round(b.h * S.NUM.BD_RUIN_STUB_MAX) && r.stub >= Math.round(b.h * S.NUM.BD_RUIN_STUB_MIN))) stubOk = false;
    if (!(r.cols.length >= 2 && r.cols.length <= 4)) colOk = false;
    for (const c of r.cols) if (!(c >= 0 && c <= b.w - 2)) colOk = false;
    if (!(r.slabs.length >= 2 && r.slabs.length <= 4)) slabOk = false;
    for (const f of r.slabs) if (!(f > 0 && f <= r.stub)) slabOk = false;
    if (!(r.walls.length >= 1 && r.walls.length <= 3)) wallOk = false;
    for (const w of r.walls) if (!(w.h >= 10 && w.w >= 1 && w.x >= 0 && w.x + w.w <= b.w + 1)) wallOk = false;
}
ok('rungon korkeus ' + (S.NUM.BD_RUIN_STUB_MIN * 100) + '–' + (S.NUM.BD_RUIN_STUB_MAX * 100) + ' % alkuperäisestä', stubOk);
ok('pystypalkit 2–4 (runko jää pystyyn)', colOk);
ok('laattaviivat 2–4 (seinät puuttuvat, runko näkyy)', slabOk);
ok('seinäpaloja 1–3 (muutama osa seinistä jäi)', wallOk);
const firstRuin = bl.filter(b => b.ruin)[0];
const stubBefore = firstRuin.ruin.stub, wallsBefore = firstRuin.ruin.walls.length;
S.destroyBackdropHouses(100);
ok('toinen osuma: runko ei laske', firstRuin.ruin.stub === stubBefore);
ok('toinen osuma: yksi seinäpala murenee (tai oli jo 0)', firstRuin.ruin.walls.length <= wallsBefore);
S.setBackdrop([80, 60, 110, 70, 95, 55, 100, 65, 90, 75]);
S.destroyBackdropHouses(99999);   // reunan yli → wrap-around
ok('wrap-around reunalla toimii (ei kaatumista, 3 rauniota)', S.getBackdrop().blocks.filter(b => b.ruin).length === 3);
S.setBackdrop(new Array(30).fill(90));
for (let i = 0; i < 22; i++) S.destroyBackdropHouses(i * 28);   // osumat koko rivin yli → kaikki raunioina
ok('rauniot eivät katoa: lohkoja edelleen 30', S.getBackdrop().blocks.length === 30);
ok('kaikki raunioina → eskalaatio päällä', S.backdropMostlyGone() === true);
S.setBackdrop(new Array(30).fill(90));
S.destroyBackdropHouses(0);
ok('3/30 rauniota → ei vielä eskalaatiota', S.backdropMostlyGone() === false);
ok('drawBackdropBlock ohjaa raunion drawBackdropRuinille', extract('drawBackdropBlock').includes('if (b.ruin) { drawBackdropRuin(b); return; }'));
const dr = extract('drawBackdropRuin');
ok('drawBackdropRuin: seinäpalat + laattaviivat + pystypalkit', dr.includes('for (const w of r.walls)') &&
   dr.includes('for (const f of r.slabs)') && dr.includes('for (const c of r.cols)'));
ok('drawBackdropRuin: ei ikkunaristikkoa eikä kattoa', !dr.includes('winRows') && !dr.includes('b.roof'));
ok('kynnys laskee ehjistä lohkoista', extract('backdropMostlyGone').includes('if (!b.ruin) intact++'));

/* D) §3 Meteoriitit talojen taakse */
console.log('D) meteoriitin piirto ja taloesto');
ok('drawMeteorite kutsutaan vain kerran (taivashaarassa)', (src.match(/drawMeteorite\(\);/g) || []).length === 1,
   'kutsuja ' + (src.match(/drawMeteorite\(\);/g) || []).length);
ok('v11.22:n "talojen EDELLÄ" -poikkeus poistettu', !src.includes('if (shootingStar.targetBldgIdx === undefined) drawMeteorite();'));
ok('meteoriteBehindBuilding: ei tähdätty-poikkeusta', !extract('meteoriteBehindBuilding').includes('targetBldgIdx !== undefined) return false'));
S.setStar({ kind: 'meteorite', targetBldgIdx: 3, x: S.buildings[4].x + 1, y: S.NUM.GROUND_Y - 10 });
ok('tähdätty meteoriitti talon rungon kohdalla → säde estyy', S.meteoriteBehindBuilding() === true);
S.setStar({ kind: 'meteorite', targetBldgIdx: 3, x: S.buildings[4].x + 1, y: S.NUM.GROUND_Y - S.buildings[4].h - 5 });
ok('tähdätty meteoriitti katon yläpuolella → ammuttavissa', S.meteoriteBehindBuilding() === false);
S.setStar({ kind: 'meteorite', targetBldgIdx: 3, x: S.buildings[4].x + 1, y: S.NUM.GROUND_Y - 10 });
S.dmg()[4] = 'gone';
ok('tuhoutunut talo ei estä sädettä', S.meteoriteBehindBuilding() === false);
S.resetBuildingDamage();

/* E) §6 BAD-avaus */
console.log('E) BAD-avaus (updateBadDemo)');
S.setStar(null); S.setDemo(-1, false);
S.updateBadDemo(1);
ok('ei viritetty → ei mitään', S.getStar() === null);
S.setDemo(S.NUM.BAD_DEMO_DELAY, false);
S.updateBadDemo(1);
ok('laskuri tikittää (ei laukea heti)', S.getStar() === null && S.demoState().timer === S.NUM.BAD_DEMO_DELAY - 1);
S.setStar({ kind: 'meteorite', active: true, timer: 0 });
S.setDemo(0, false);
S.updateBadDemo(5);
ok('taivas varattu → BAD-avaus odottaa', S.demoState().done === false);
S.setStar(null);
S.updateBadDemo(1);
const st = S.getStar();
ok('laukeaa kun taivas vapautuu', !!st && st.kind === 'meteorite');
ok('kohdetalo 0–8 (myös BAR sallittu)', st.targetBldgIdx >= 0 && st.targetBldgIdx <= 8, 'idx=' + st.targetBldgIdx);
ok('vain kerran per kierros', S.demoState().done === true);
S.updateBadDemo(500);
ok('toista meteoriittia ei tule', S.getStar() === st);
ok('laskuri nollautuu laukaisun jälkeen', S.demoState().timer === -1);
const seen = {};
for (let i = 0; i < 6000; i++) {
    S.setStar(null); S.setDemo(0, false); S.setDemoIdx(null);
    S.updateBadDemo(1);
    seen[S.getStar().targetBldgIdx] = true;
}
ok('arpa osuu kaikkiin 9 taloon (BAR mukana)', [0,1,2,3,4,5,6,7,8].every(i => seen[i] === true), Object.keys(seen).join(','));
S.setDemoIdx(8);
S.setStar(null); S.setDemo(0, false);
S.updateBadDemo(1);
ok('?baddemo=8 pakottaa BARin (BAD = BAD)', S.getStar().targetBldgIdx === 8);
S.setDemoIdx(0);
S.setStar(null); S.setDemo(0, false);
S.updateBadDemo(1);
ok('?baddemo=0 pakottaa talon 0', S.getStar().targetBldgIdx === 0);
ok('?baddemo-kytkimet olemassa', src.includes("get('baddemo')") && /\/\^\[0-8\]\$\//.test(src));
ok('vain BAD virittää avauksen (init)', src.includes("chaosFlags.badDemo && !BAD_DEMO_OFF"));
ok('updateBadDemo kutsutaan yön haarassa (1 kutsu)', (src.match(/updateBadDemo\(dt\);/g) || []).length === 1);
ok('BAD-avaus ei ohita eskalaatioporttia (oma spawn)', src.includes('shootingStar = makeBadDemoMeteor(idx);'));
let flightMin = 1e9, flightMax = 0, hitOk = true, bad = [];
for (let i = 0; i < 9; i++) {
    for (let k = 0; k < 200; k++) {
        const m = S.makeBadDemoMeteor(i), b = S.buildings[i];
        let x = m.x, y = m.y, f = 0;
        while (y < S.NUM.GROUND_Y && f < 3000) { x += m.vx; y += m.vy; f++; }
        if (!(x >= b.x - 1 && x <= b.x + b.w + 1)) { hitOk = false; bad.push('talo ' + i + ' x=' + x.toFixed(1)); }
        if (f < flightMin) flightMin = f;
        if (f > flightMax) flightMax = f;
    }
}
ok('osuma aina kohdetalon kohdalle', hitOk, bad.slice(0, 3).join(' | '));
ok('lento ' + (flightMin / 60).toFixed(1) + '–' + (flightMax / 60).toFixed(1) + ' s (1,5–5 s)',
   flightMin >= 90 && flightMax <= 300);
ok('tuho kulkee samaa ketjua (startBuildingCollapse)', src.includes('if (shootingStar.targetBldgIdx !== undefined) startBuildingCollapse(shootingStar.targetBldgIdx);'));

/* F) §5 Ääni: patarummun/kongin kumahdus pois osumahetkeltä */
console.log('F) osumaääni (playBuildingCollapse)');
const pb = extract('playBuildingCollapse');
ok('soiva oskillaattori poistettu (ei createOscillator)', !pb.includes('createOscillator'));
ok('jäljellä matala kohina (lowpass + 1,5 s puskuri)', pb.includes("lp.type = 'lowpass'") && pb.includes('sampleRate * 1.5'));
/* Vaihe 2 (v11.38): oskillaattori siirrettiin sfxTone()-apuriin – varmistetaan, että
   matala kolahtava runko on yhä (220 → 70, triangle) ja kohinakerros tallella. */
ok('playMeteorHit (aseen osumaääni) ennallaan',
   /sfxTone\(\{ freq: 220, freqTo: 70/.test(extract('playMeteorHit')) &&
   extract('playMeteorHit').includes('createBufferSource'));
ok('playBuildingCollapse kutsutaan vain romahduksen alusta', (src.match(/playBuildingCollapse\(\);/g) || []).length === 1);

/* G) Sääntö 06, talous ja versio */
console.log('G) säännöt ja versio');
const newFns = ['makeBuildingRubble', 'ruinBackdropBlock', 'makeBadDemoMeteor', 'updateBadDemo',
                'drawRubble', 'drawBackdropRuin', 'drawDoor', 'playBuildingCollapse',
                'updateBuildingDamage', 'resetBuildingDamage', 'destroyBackdropHouses'];
const bad2 = newFns.filter(n => extract(n).includes('showNotification'));
ok('uudet/muutetut funktiot eivät sisällä dialogeja (' + newFns.length + ' kpl)', bad2.length === 0, bad2.join(','));
const notif = (src.match(/showNotification\(/g) || []).length;
ok('showNotification-kutsuja ei lisätty (14)', notif === 14, 'nyt ' + notif);
ok('ei uusia kolikko-/🍔-kirjoituksia uusissa funktioissa',
   !newFns.some(n => /coinCount\s*=|hamburgerCount\s*=/.test(extract(n))));
ok('drawRubble kutsutaan drawBuildingsista', extract('drawBuildings').includes('drawRubble(b, idx)'));
ok('init nollaa tuhon jälkitilan (resetBuildingDamage)', src.includes('resetBuildingDamage();'));
const html = fs.readFileSync('d:/AI/AI_street/index.html', 'utf8');
ok('#version-tag ' + ver.VERSION, ver.tagOk(html));
ok('kaikki ?v=-leimat = ' + ver.NUM + ' (≥4 kpl, ei jäänteitä)',
   ver.stampsConsistent(html) && ver.stamps(html).length >= 4);

console.log('');
console.log('══════════════════════════════════════');
console.log(pass + ' OK / ' + fail + ' löydöstä');
if (fail > 0) process.exitCode = 1;




