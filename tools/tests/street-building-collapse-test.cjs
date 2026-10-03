/* v11.22 validointi: meteoriitti tuhoaa katuvarren talon (eskalaatio BAD/FULL).
   Funktiot ja vakiot poimitaan SUORAAN street.js:stä (ei kopiota logiikasta).
   Aja: node %TEMP%\street-building-collapse-test.cjs                          */
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
let smallHouseLights = { 2: { lit: false, timer: 0 }, 4: { lit: false, timer: 0 }, 6: { lit: false, timer: 0 } };
const litWindows = [];
let avenger = null;
let backdrop = { blocks: [], total: 0 };
let shootingStar = null;
/* v11.34: talon tuhoutuessa sen viereinen lamppu sammuu → startBuildingCollapse
   lukee lamps-taulukkoa. Tyhjä taulukko riittää (lamppulogiikkaa ei testata). */
let lamps = [];
let coinCount = 7, hamburgerCount = 4;
let firstHouseWindowsLit = false, firstHouseKickCount = 0, firstHouseKickTarget = 0, firstHouseWindowTimer = 0;
const state = { inventory: { coinCount: 7, hamburgerCount: 4 } };
let saveCalls = 0;
const GameState = { save() { saveCalls++; } };
const spawned = [];
function spawnParticles(x, y, c, n) { spawned.push({ x, y, c, n }); }
function playKnock() {}
function playBuildingCollapse() {}
const WORLD_W = ${num('WORLD_W')};
const GROUND_Y = ${num('GROUND_Y')};
const METEOR_HITS_TO_KILL = ${num('METEOR_HITS_TO_KILL')};
let meteorTempoMult = 1;
const BAR_BLDG_IDX = ${num('BAR_BLDG_IDX')};
const BACKDROP_GONE_SHARE = ${num('BACKDROP_GONE_SHARE')};
const BLDG_DMG_FLASH = ${num('BLDG_DMG_FLASH')};
const BLDG_DMG_SHAKE = ${num('BLDG_DMG_SHAKE')};
const BLDG_DMG_BLACK = ${num('BLDG_DMG_BLACK')};
const BLDG_DMG_BURN = ${num('BLDG_DMG_BURN')};
const BLDG_DMG_OUTLINE = ${num('BLDG_DMG_OUTLINE')};
const BLDG_DMG_FADE = ${num('BLDG_DMG_FADE')};
const BLDG_DMG_PHASES = [BLDG_DMG_FLASH, BLDG_DMG_SHAKE, BLDG_DMG_BLACK, BLDG_DMG_BURN, BLDG_DMG_OUTLINE, BLDG_DMG_FADE];
const BLDG_DMG_TOTAL = BLDG_DMG_FLASH + BLDG_DMG_SHAKE + BLDG_DMG_BLACK + BLDG_DMG_BURN + BLDG_DMG_OUTLINE + BLDG_DMG_FADE;
const AIM_ANGLE_MIN = (${expr('AIM_ANGLE_MIN')});
const AIM_ANGLE_MAX = (${expr('AIM_ANGLE_MAX')});
const DOOR_H = ${num('DOOR_H')};
const RUBBLE_H_MAX = ${expr('RUBBLE_H_MAX')};
const BD_RUIN_STUB_MIN = ${num('BD_RUIN_STUB_MIN')};
const BD_RUIN_STUB_MAX = ${num('BD_RUIN_STUB_MAX')};
const BAD_DEMO_DELAY = ${num('BAD_DEMO_DELAY')};
const BAD_FINALE_GAP_MIN = ${num('BAD_FINALE_GAP_MIN')};
const BAD_FINALE_GAP_MAX = ${num('BAD_FINALE_GAP_MAX')};
let buildingRubble = {};
let standingDoorIdx = -1;
let badDemoTimer = -1, badDemoDone = false;
const BAD_DEMO_IDX = null, BAD_DEMO_OFF = false;
let chaosLevel = 'bad';
/* Vaihe 2 (v11.38): tuotanto lukee johdettuja moodilippuja (chaosFlags). Testipreludissa
   ne johdetaan Proxylla chaosLevelistä → pysyvät synkassa myös setChaos()-kutsujen jälkeen. */
const chaosFlags = new Proxy({}, { get: (_, k) => ({ beer: chaosLevel === 'full', drunk: chaosLevel === 'full', beamWeapon: chaosLevel === 'full', meteorAlways: chaosLevel === 'full', meteorKill: chaosLevel === 'full', meteorHalf: chaosLevel === 'bad', badDemo: chaosLevel === 'bad', badFinale: chaosLevel === 'bad', ruin: chaosLevel === 'bad' || chaosLevel === 'full', mosquitoes: chaosLevel === 'bad' || chaosLevel === 'full', anyChaos: chaosLevel !== 'normal' })[k] });
const BLDG_FORCE = false, BLDG_TARGET = null;
let buildingDmg = {};
${arr('buildings')}
${extract('buildingGone')}
${extract('backdropMostlyGone')}
${extract('badFinalePhase')}
${extract('nextSkyGap')}
${extract('pickBuildingTarget')}
${extract('makeAimedMeteor')}
${extract('startBuildingCollapse')}
${extract('updateBuildingDamage')}
${extract('resetBuildingDamage')}
${extract('meteoriteBehindBuilding')}
${extract('meteoriteChance')}
${extract('makeBuildingRubble')}
${extract('ruinBackdropBlock')}
${extract('makeBadDemoMeteor')}
${extract('updateBadDemo')}
return {
    buildingGone, backdropMostlyGone, pickBuildingTarget, makeAimedMeteor,
    startBuildingCollapse, updateBuildingDamage, resetBuildingDamage,
    meteoriteBehindBuilding, meteoriteChance, buildings,
    NUM: { WORLD_W, GROUND_Y, BAR_BLDG_IDX, BLDG_DMG_TOTAL, BLDG_DMG_FADE, BLDG_DMG_FLASH,
           BLDG_DMG_SHAKE, BLDG_DMG_BLACK, BLDG_DMG_BURN, BLDG_DMG_OUTLINE,
           BACKDROP_GONE_SHARE, AIM_ANGLE_MIN, AIM_ANGLE_MAX },
    setChaos: v => { chaosLevel = v; },
    setBackdrop: (n, total) => { backdrop = { blocks: new Array(n).fill(0), total: (total === undefined ? n : total) }; },
    setBackdropRaw: v => { backdrop = v; },
    house: i => smallHouseLights[i],
    lit: () => litWindows,
    setAvenger: a => { avenger = a; },
    getAvenger: () => avenger,
    dmg: () => buildingDmg,
    setStar: s => { shootingStar = s; },
    spawned, saveCount: () => saveCalls,
    rubble: () => buildingRubble,
    doorIdx: () => standingDoorIdx,
    demoState: () => ({ timer: badDemoTimer, done: badDemoDone }),
    setDemo: (t, d) => { badDemoTimer = t; badDemoDone = d; },
    money: () => ({ coins: coinCount, burgers: hamburgerCount, inv: JSON.stringify(state.inventory) }),
    NUM2: { RUBBLE_H_MAX, BAD_DEMO_DELAY, BD_RUIN_STUB_MIN, BD_RUIN_STUB_MAX }
};
`;

const S = new Function(prelude)();
let pass = 0, fail = 0;
function ok(label, cond, extra) {
    if (cond) { pass++; console.log('  OK   ' + label); }
    else { fail++; console.log('  FAIL ' + label + (extra ? '  -> ' + extra : '')); }
}
console.log('vakiot: eskalaatio ' + S.NUM.BACKDROP_GONE_SHARE + ' · animaatio ' + S.NUM.BLDG_DMG_TOTAL +
            ' f · kulma ' + (S.NUM.AIM_ANGLE_MIN * 180 / Math.PI).toFixed(0) + '–' +
            (S.NUM.AIM_ANGLE_MAX * 180 / Math.PI).toFixed(0) + '°');

/* A) Meteoriitteja on vain BAD + FULL → NORMAL/MILD/GOOD eivät voi tuhota taloja */
console.log('A) meteoriittitahti (NORMAL-takuu)');
S.setChaos('normal'); ok('normal -> 0 (ei meteoriitteja eikä tuhoa)', S.meteoriteChance() === 0);
S.setChaos('mild');   ok('mild   -> 0 (ei meteoriitteja eikä tuhoa)', S.meteoriteChance() === 0);
S.setChaos('good');   ok('good   -> 0 (ei meteoriitteja eikä tuhoa)', S.meteoriteChance() === 0);
S.setChaos('bad');    ok('bad    -> 0.5 (v11.26)', Math.abs(S.meteoriteChance() - 0.5) < 1e-9);
S.setChaos('full');   ok('full   -> 1', S.meteoriteChance() === 1);

/* B) Eskalaatiokynnys: taustarivistä >= 40 % tuhoutunut (v11.26: 0.6) */
console.log('B) eskalaatiokynnys');
S.setBackdropRaw(null);  ok('taustariviä ei ole -> ei eskaltaatiota', S.backdropMostlyGone() === false);
S.setBackdrop(30, 30);   ok('30/30 lohkoa -> ei eskaltaatiota', S.backdropMostlyGone() === false);
S.setBackdrop(19, 30);   ok('19/30 -> ei vielä (raja 18)', S.backdropMostlyGone() === false);
S.setBackdrop(18, 30);   ok('18/30 (<= 60 %) -> eskalaatio', S.backdropMostlyGone() === true);
S.setBackdrop(0, 30);    ok('0/30 -> eskalaatio', S.backdropMostlyGone() === true);
S.setBackdrop(3, 35);    ok('3/35 -> eskalaatio', S.backdropMostlyGone() === true);

/* C) Kohdevalinta: BAR vasta viimeisenä */
console.log('C) kohdevalinta (BAR viimeisenä)');
S.setBackdrop(0, 30);
S.resetBuildingDamage();
let sawBar = 0, seen = {};
for (let i = 0; i < 500; i++) { const t = S.pickBuildingTarget(); seen[t] = true; if (t === 8) sawBar++; }
ok('BAR ei ole kohteena kun muita taloja on ehjänä (500 arpaa)', sawBar === 0, 'BAR-osumia=' + sawBar);
ok('kaikki 8 muuta taloa voivat olla kohteena', [0,1,2,3,4,5,6,7].every(i => seen[i] === true));
for (let i = 0; i < 8; i++) S.dmg()[i] = 'gone';
ok('kun vain BAR on ehjä -> kohde on BAR', S.pickBuildingTarget() === 8);
S.dmg()[8] = 'gone';
ok('kun kaikki on tuhottu -> -1 (meteoriitti putoaa tyhjään)', S.pickBuildingTarget() === -1);

/* D) Tähtäys osuu jokaiseen taloon (0–8) – myös makuuhuone 7 ja BAR 8 */
console.log('D) tähtäys logiikka (9 taloa × 40 arpaa)');
S.resetBuildingDamage();
let minF = 1e9, maxF = 0, allIn = true, inBounds = true, bad = [];
for (let i = 0; i < 9; i++) {
    for (let k = 0; k < 40; k++) {
        const m = S.makeAimedMeteor(i);
        const b = S.buildings[i];
        if (m.x < -40 || m.x > S.NUM.WORLD_W + 40) inBounds = false;
        if (!(m.vy > 0)) bad.push('vy<=0 talo ' + i);
        let x = m.x, y = m.y, f = 0;
        while (y < S.NUM.GROUND_Y && f < 6000) { x += m.vx; y += m.vy; f++; }
        if (!(x >= b.x - 1 && x <= b.x + b.w + 1)) { allIn = false; bad.push('talo ' + i + ' osuma x=' + x.toFixed(1)); }
        if (f < minF) minF = f;
        if (f > maxF) maxF = f;
    }
}
ok('jokainen tähtäys osuu kohdetalon kohdalle', allIn, bad.slice(0, 3).join(' | '));
ok('meteoriitti ei deaktivoidu heti rajojen takia', inBounds);
ok('lento samaa luokkaa kuin nykyisillä meteoriiteilla (~5–22 s)', minF > 300 && maxF < 1300, 'min=' + minF + ' f, max=' + maxF + ' f');
ok('kohde on merkitty meteoriittiin (targetBldgIdx)', S.makeAimedMeteor(7).targetBldgIdx === 7);

/* E) Tuhoutumisen aloitus: toiminta pois heti, talous ei muutu */
console.log('E) tuhoutumisen aloitus');
S.resetBuildingDamage();
S.house(6).lit = true; S.house(6).timer = 900;
S.lit().push({ wx: 1, wy: 2, bldgIdx: 6 });
S.setAvenger({ bldgIdx: 6 });
const before = S.money();
const started = S.startBuildingCollapse(6);
ok('palauttaa true', started === true);
ok('vaihe 0, ajastin 0', S.dmg()[6].phase === 0 && S.dmg()[6].t === 0);
ok('talon valaistus pois', S.house(6).lit === false && S.house(6).timer === 0);
ok('ko. talon ikkunavalot poistettu (K1)', S.lit().every(w => w.bldgIdx !== 6));
ok('oviukko katoaa talon mukana', S.getAvenger() === null);
ok('samaa taloa ei aloiteta kahdesti', S.startBuildingCollapse(6) === false);
ok('talous ei muutu (kolikot/🍔/localStorage)', S.money().coins === before.coins && S.money().burgers === before.burgers &&
   S.money().inv === before.inv && S.saveCount() === 0);
ok('pölyä/partikkeleita syntyy', S.spawned.length > 0);

/* F) Animaatio: vaiheet 0..5 → gone, ei koskaan kesken jäävää tilaa */
console.log('F) animaation vaiheet');
S.resetBuildingDamage();
ok('init/reset palauttaa talot', S.buildingGone(3) === false);
S.startBuildingCollapse(3);
let phases = [], goneAt = -1;
for (let f = 1; f <= S.NUM.BLDG_DMG_TOTAL + 5; f++) {
    S.updateBuildingDamage(1);
    const d = S.dmg()[3];
    if (d === 'gone') { if (goneAt < 0) goneAt = f; }
    else if (phases[phases.length - 1] !== d.phase) phases.push(d.phase);
}
ok('vaiheet järjestyksessä 0,1,2,3,4,5', phases.join(',') === '0,1,2,3,4,5', phases.join(','));
ok('gone vasta kun animaatio on ajettu (' + S.NUM.BLDG_DMG_TOTAL + ' f)', goneAt === S.NUM.BLDG_DMG_TOTAL, 'goneAt=' + goneAt);
ok('buildingGone() true lopussa', S.buildingGone(3) === true);
S.resetBuildingDamage();
ok('reset palauttaa talon ehjäksi', S.buildingGone(3) === false && S.dmg()[3] === undefined);

/* F2) Ei sivuvaikutuksia, kun mikään talo ei ole tuhoutumassa */
console.log('F2) updateBuildingDamage on no-op ilman tuhoutuvia taloja');
S.resetBuildingDamage();
const sp0 = S.spawned.length, sv0 = S.saveCount(), money0 = S.money();
S.updateBuildingDamage(1); S.updateBuildingDamage(1);
ok('ei partikkeleita eikä tallennuksia', S.spawned.length === sp0 && S.saveCount() === sv0);
ok('talous ennallaan', JSON.stringify(S.money()) === JSON.stringify(money0));

/* G) Säde: tähdätty meteoriitti on aina ammuttavissa, tuhoutunut talo ei estä */
console.log('G) säde ja tuhoutuneet talot');
S.resetBuildingDamage();
S.setStar({ x: 770, y: 100, targetBldgIdx: 8 });   // katon yläpuolella (talo 8: h 195 → katto y 115)
ok('tähdätty meteoriitti katon yläpuolella = ammuttavissa (v11.24)', S.meteoriteBehindBuilding() === false);
S.setStar({ x: 770, y: 200, targetBldgIdx: 8 });
ok('v11.24: tähdätty meteoriitti talon rungon kohdalla = talon takana', S.meteoriteBehindBuilding() === true);
S.setStar({ x: 770, y: 200 });
ok('tavallinen meteoriitti talon kohdalla = talon takana', S.meteoriteBehindBuilding() === true);
S.dmg()[8] = 'gone';
ok('tuhoutunut talo ei enää estä sädettä', S.meteoriteBehindBuilding() === false);

/* H) Koodikytkennät (staattiset tarkistukset – kaikki jälkitilan portit) */
console.log('H) koodikytkennät');
const B = n => extract(n);
const drawB = B('drawBuildings');
ok('drawBuildings: tuhoutuneen tilalle piirretään romukasa (v11.24)', drawB.includes("dmgState === 'gone'") && drawB.includes('drawRubble(b, idx)'));
ok('drawBuildings: tuhoutuva talo piirretään animaatiolla', drawB.includes('drawCollapsingBuilding(b, idx, dmgState)'));
ok('drawCollapsingBuilding olemassa', src.includes('function drawCollapsingBuilding('));
ok('forEachBuildingWindow olemassa', src.includes('function forEachBuildingWindow('));
const dd = B('drawDoor');
ok('drawDoor: v11.24 – ei mustaa ovea, vain yksi karmikehys', dd.includes('buildingGone(bldgIdx)') &&
   !dd.includes("'#000000'") && dd.includes('bldgIdx !== standingDoorIdx'));
/* Vaihe 1 (v11.38): handleAction() pilkottiin – taloreitit ovat nyt näissä
   funktioissa. Yhdistetty lähde, jotta tarkistukset kattavat yhä kaikki
   ovet ja potkut (sama tarkoitus: jokaisessa polussa on buildingGone-vahti). */
const ha = B('handleAction') + B('tryNewspaper') + B('tryFruitDoor') + B('tryJukeboxDoor') +
           B('trySinkshipDoor') + B('tryDoorsAndKicks');
ok('handleAction: hedelmäpeli', ha.includes('buildingGone(6)'));
ok('handleAction: jukebox', ha.includes('buildingGone(JUKEBOX_BLDG_IDX)'));
ok('handleAction: laivanupotus', ha.includes('buildingGone(SINKSHIP_BLDG_IDX)'));
ok('handleAction: lamppuovet (BAR/makuuhuone/Dig/Blue)', ha.includes('buildingGone(lamp.bldgIdx)'));
ok('handleAction: talo 0 potku', ha.includes('buildingGone(0)'));
ok('handleAction: potkuvalot', ha.includes('if (buildingGone(i)) return;'));
ok('drawThresholdPaving: kynnysvalo pois', B('drawThresholdPaving').includes('!buildingGone(t.bldgIdx)'));
ok('drawElectricCabinet: kaappi pois talon mukana', B('drawElectricCabinet').includes('buildingGone(c.bldgIdx)'));
ok('sähkökaapin isku ohitetaan', src.includes('buildingGone(cab.bldgIdx)'));
ok('drawMoonBuildingShadows: ei varjoa', B('drawMoonBuildingShadows').includes('buildingGone(buildings.indexOf(b))'));
ok('getAvailableWindows: ei ikkunavaloja', B('getAvailableWindows').includes('if (buildingGone(idx)) return false;'));
const us = B('updateShootingStar');
const iP = us.indexOf('const aimIdx = backdropMostlyGone()');
const iM = us.indexOf('const mAng = (40 + Math.random');
ok('tähtäyshaara ennen satunnaisspawnia', iP > 0 && iM > iP, 'iP=' + iP + ' iM=' + iM);
ok('tähtäys vain meteoriittiportin sisällä', us.indexOf('Math.random() < meteoriteChance()') < iP);
ok('osuma käynnistää tuhoutumisen', us.includes('startBuildingCollapse(shootingStar.targetBldgIdx)'));
ok('tavallinen meteoriitti ennallaan (40–60°)', us.includes('const mAng = (40 + Math.random() * 20) * Math.PI / 180;'));
ok('v11.24: meteoriitti piirretään aina taivashaarassa (talojen takana)', (src.match(/drawMeteorite\(\);/g) || []).length === 1);
ok('init() palauttaa talot', src.includes('resetBuildingDamage();      // v11.22: talot ehjinä uudessa pelissä'));
ok('taustarivin kokonaismäärä muistetaan', src.includes('backdrop.total = backdrop.blocks.length;'));
ok('testikytkimet ?bldg / ?bldgtarget', src.includes("get('bldg')") && src.includes("get('bldgtarget')"));

/* I) Sääntö 06: ei uusia dialogeja/popup-tekstejä */
console.log('I) sääntö 06 (ei uusia dialogeja)');
const notif = (src.match(/showNotification\(/g) || []).length;
ok('showNotification-kutsuja edelleen 14 (bf54693 poisti yhden popupin)', notif === 14, 'nyt ' + notif);
const newFns = ['buildingGone', 'backdropMostlyGone', 'pickBuildingTarget', 'makeAimedMeteor',
                'startBuildingCollapse', 'updateBuildingDamage', 'resetBuildingDamage',
                'drawCollapsingBuilding', 'forEachBuildingWindow', 'playBuildingCollapse'];
const bad2 = newFns.filter(n => extract(n).includes('showNotification'));
ok('uudet funktiot eivät sisällä yhtään dialogia (' + newFns.length + ' kpl)', bad2.length === 0, bad2.join(','));

/* J) Versioleimat */
console.log('J) versio');
const html = fs.readFileSync('d:/AI/AI_street/index.html', 'utf8');
ok('#version-tag ' + ver.VERSION, ver.tagOk(html));
ok('kaikki ?v=-leimat = ' + ver.NUM + ' (ei jäänteitä)', ver.stampsConsistent(html) && ver.stamps(html).length >= 4);

console.log('');
console.log('══════════════════════════════════════');
console.log(pass + ' OK / ' + fail + ' löydöstä');
if (fail > 0) process.exitCode = 1;
