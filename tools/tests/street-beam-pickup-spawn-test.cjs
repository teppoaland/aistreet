/* ══════════════════════════════════════════════════════════════════════════
   street-beam-pickup-spawn-test.cjs – v11.15 sädeaseen ilmestymislogiikka
   (sädease aina samalla Y-akselilla teräsaidan vieressä = alin jalkapiste)

   Testi EI kirjoita sääntöjä itse: se purkaa street.js:stä
     • vakiot (WORLD_W/H, GROUND_Y, player, COIN_Y_MIN/MAX, BEAM_PICKUP_*)
     • spawnBeamPickup()-funktion kokonaisuudessaan
     • lampputolpan estoblokin sellaisena kuin se on update()issa
     • poimintaehdon dx/dy + 10 px säteen
   ja simuloi, YLTÄÄKÖ pelaaja esineeseen (tolppablokki ajetaan oikealla koodilla).

   Ajo:  node "%TEMP%\street-beam-pickup-spawn-test.cjs"
   Ympäristö: STREET_ROOT = polku street.js:ään (oletus d:\AI\AI_street)
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = process.env.STREET_ROOT || 'd:\\AI\\AI_street';
const src = require('./street-src.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
    if (cond) { pass++; console.log('  OK   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function section(t) { console.log(''); console.log(t); }

/* ── Purku ────────────────────────────────────────────────────────────── */
function num(re, what) {
    const m = src.match(re);
    if (!m) throw new Error('ei löytynyt: ' + what);
    return Number(m[1]);
}
function grab(re, what) {
    const m = src.match(re);
    if (!m) throw new Error('ei löytynyt: ' + what);
    return m[0];
}

const WORLD_W = num(/const WORLD_W = (\d+);/, 'WORLD_W');
const WORLD_H = num(/const WORLD_H = (\d+);/, 'WORLD_H');
const GROUND_Y = num(/const GROUND_Y = (\d+);/, 'GROUND_Y');
const pw = num(/x: 40, y: GROUND_Y - 20, w: (\d+), h: \d+/, 'player.w');
const ph = num(/x: 40, y: GROUND_Y - 20, w: \d+, h: (\d+)/, 'player.h');
const COIN_Y_MIN = num(/const COIN_Y_MIN = GROUND_Y;\s*\/\/ *(\d+)/, 'COIN_Y_MIN');
const COIN_Y_MAX = num(/const COIN_Y_MAX = \(WORLD_H - 50\) \+ player\.h;\s*\/\/ *(\d+)/, 'COIN_Y_MAX');
const BEAM_PICKUP_Y = num(/const BEAM_PICKUP_Y = COIN_Y_MAX;\s*\/\/ *(\d+)/, 'BEAM_PICKUP_Y');
const BEAM_X_MIN = num(/const BEAM_PICKUP_X_MIN = player\.w \/ 2;\s*\/\/ *(\d+)/, 'BEAM_PICKUP_X_MIN');
const BEAM_X_MAX = num(/const BEAM_PICKUP_X_MAX = WORLD_W - player\.w \/ 2;\s*\/\/ *(\d+)/, 'BEAM_PICKUP_X_MAX');

const lamps = [...grab(/const lamps = \[[\s\S]*?\n    \];/, 'lamps').matchAll(/\{ x: (\d+),/g)]
    .map(m => ({ x: Number(m[1]) }));

/* Tolpan geometria + liikenteen turvaraja (syvyysviiva) – purkaa street.js:stä */
const LAMP_BASE_Y = GROUND_Y + num(/const LAMP_BASE_Y = GROUND_Y \+ (\d+);/, 'LAMP_BASE_Y');
const LAMP_POST_H = num(/const LAMP_POST_H = (\d+);/, 'LAMP_POST_H');
const lampPoleTop = LAMP_BASE_Y - LAMP_POST_H + 15;      // kuten lampGeom()
const DEPTH_MAX_Y = num(/const PLAYER_DEPTH_MAX_Y  = WORLD_H - (\d+);/, 'PLAYER_DEPTH_MAX_Y');
/* Vaihe 5 osa 7 (v11.42): liikennologiikka (ja tämä rivi) muutti street/traffic.js:ään,
   jossa nimet on sidottu H.-etuliitteellä → sallitaan molemmat muodot. */
const laneSafeGap = num(/if \((?:H\.)?player\.y >= (?:H\.)?PLAYER_DEPTH_MAX_Y - (\d+)\) continue;/, 'kaistaraja');
const LANE_SAFE_Y = (WORLD_H - DEPTH_MAX_Y) - laneSafeGap;   // tästä alaspäin kumpikaan kaista ei osu

/* Oikea spawnBeamPickup sellaisenaan */
const spawnSrc = grab(/function spawnBeamPickup\(\) {[\s\S]*?\n    }/, 'spawnBeamPickup');
const makeSpawn = new Function(
    'BEAM_PICKUP_Y', 'BEAM_PICKUP_X_MIN', 'BEAM_PICKUP_X_MAX',
    'let chaosLevel = "normal";\nlet beamWeaponCollected = false;\nlet beamPickup = null;\n' +
    /* Vaihe 2 (v11.38): tuotanto lukee johdettuja moodilippuja – johdetaan ne tässä
       suoraan chaosLevelistä, jotta spawnBeamPickup toimii samoin kuin tuotannossa. */
    'const chaosFlags = new Proxy({}, { get: function (_, k) { return { beer: chaosLevel === "full", drunk: chaosLevel === "full", beamWeapon: chaosLevel === "full", meteorAlways: chaosLevel === "full", meteorKill: chaosLevel === "full", meteorHalf: chaosLevel === "bad", badDemo: chaosLevel === "bad", badFinale: chaosLevel === "bad", ruin: chaosLevel === "bad" || chaosLevel === "full", mosquitoes: chaosLevel === "bad" || chaosLevel === "full", anyChaos: chaosLevel !== "normal" }[k]; } });\n' +
    spawnSrc + '\n' +
    'return {' +
    '  set: function (c, w) { chaosLevel = c; beamWeaponCollected = w; },' +
    '  spawn: function () { spawnBeamPickup(); return beamPickup; }' +
    '};');
const spawner = makeSpawn(BEAM_PICKUP_Y, BEAM_X_MIN, BEAM_X_MAX);

/* Oikea lampputolpan estoblokki update()ista */
const lampBlockSrc = grab(/\/\/ Estä pelaajaa kävelemästä[\s\S]*?player\.x = Math\.max\(0, Math\.min\(WORLD_W - player\.w, player\.x\)\);/,
    'lamppublokki');
const applyLampBlock = new Function('player', 'lamps', 'GROUND_Y', 'WORLD_W', lampBlockSrc);

/* Oikea poimintaehto update()ista */
const pickLines = grab(/const dx = \(player\.x \+ player\.w\/2\) - beamPickup\.x;[\s\S]{0,200}?Math\.sqrt\(dx\*dx \+ dy\*dy\) < (\d+)\)/,
    'poimintaehto');
const radius = Number(pickLines.match(/< (\d+)\)$/)[1]);
const collect = new Function('player', 'beamPickup',
    pickLines.replace(/if \(Math\.sqrt\(dx\*dx \+ dy\*dy\) < \d+\)$/, 'return Math.sqrt(dx*dx + dy*dy) < ' + radius + ';'));

/* ── Simulaatio: yltääkö pelaaja esineeseen (oikea blokki + oikea ehto) ── */
function reachable(item) {
    // Pelaaja kohdistaa keskipisteensä esineen x:ään (toleranssi ±radius) ja
    // kokeilee kaikki syvyydet 280…350 (alin = aidan viiva), kuten pelissä.
    const xMax = WORLD_W - pw;
    for (let py = 280; py <= 350.0001; py += 0.5) {
        for (let off = -radius; off <= radius + 0.0001; off += 0.5) {
            const p = { x: Math.max(0, Math.min(xMax, item.x + off - pw / 2)), y: py, w: pw, h: ph };
            applyLampBlock(p, lamps, GROUND_Y, WORLD_W);
            if (collect(p, item)) return true;
        }
    }
    return false;
}

console.log('vakiot: WORLD ' + WORLD_W + 'x' + WORLD_H + ' GROUND_Y ' + GROUND_Y +
    ' player ' + pw + 'x' + ph + ' | BEAM_PICKUP_Y ' + BEAM_PICKUP_Y +
    ' x [' + BEAM_X_MIN + ', ' + BEAM_X_MAX + '] | lamput ' + lamps.map(l => l.x).join(','));


/* ── A) Vakiot ─────────────────────────────────────────────────────── */
section('A) vakiot');
ok('BEAM_PICKUP_Y = COIN_Y_MAX = aidan juuri (380)', BEAM_PICKUP_Y === COIN_Y_MAX && COIN_Y_MAX === (WORLD_H - 50) + ph,
    BEAM_PICKUP_Y + ' vs ' + ((WORLD_H - 50) + ph));
ok('COIN_Y_MAX on pelaajan alin jalkapiste (350 + h)', COIN_Y_MAX === 350 + ph);
ok('x-kaista on pelaajan keskipistealue [w/2, WORLD_W - w/2]',
    BEAM_X_MIN === pw / 2 && BEAM_X_MAX === WORLD_W - pw / 2, BEAM_X_MIN + '…' + BEAM_X_MAX);
ok('poimintasäde on 10 px', radius === 10, radius);

/* ── B) spawnBeamPickup käyttäytyy kuten ennen (ehdot) ─────────────── */
section('B) spawnBeamPickup: ehdot ennallaan');
spawner.set('normal', false);
ok('NORMAL → ei esinettä', spawner.spawn() === null);
spawner.set('mild', false);
ok('MILD → ei esinettä', spawner.spawn() === null);
spawner.set('full', true);
ok('ase jo kerätty → ei esinettä', spawner.spawn() === null);
spawner.set('full', false);
const first = spawner.spawn();
ok('FULL + keräämätön → esine syntyy', !!first && typeof first.x === 'number' && typeof first.y === 'number');

/* ── C) y on AINA sama, x vaihtelee ────────────────────────────────── */
section('C) kiinteä y, satunnainen x');
const ys = new Set();
let xMin = Infinity, xMax = -Infinity, badY = 0, badX = 0;
for (let i = 0; i < 20000; i++) {
    const it = spawner.spawn();
    ys.add(it.y);
    if (it.y !== BEAM_PICKUP_Y) badY++;
    if (it.x < BEAM_X_MIN || it.x > BEAM_X_MAX) badX++;
    if (it.x < xMin) xMin = it.x;
    if (it.x > xMax) xMax = it.x;
}
ok('20 000 spawnia: y aina ' + BEAM_PICKUP_Y + ' (teräsaidan vieressä)',
    ys.size === 1 && ys.has(BEAM_PICKUP_Y) && badY === 0, [...ys].join(','));
ok('x pysyy kaistalla [' + BEAM_X_MIN + ', ' + BEAM_X_MAX + ']', badX === 0, badX + ' rikettä');
ok('x on oikeasti satunnainen (koko kaista käytössä)',
    xMin < BEAM_X_MIN + 5 && xMax > BEAM_X_MAX - 5, xMin.toFixed(1) + '…' + xMax.toFixed(1));

/* ── D) uudet esineet: aina poimittavissa (myös tolpan kohdalla) ───── */
section('D) uusi y = ' + BEAM_PICKUP_Y + ' → esine on AINA poimittavissa');
const spots = [];
for (const lamp of lamps) for (const d of [-25, -15, -5, -0.5, 0, 0.5, 5, 15, 25]) spots.push(lamp.x + d);
for (const e of [BEAM_X_MIN, BEAM_X_MIN + 1, 20, WORLD_W - 20, BEAM_X_MAX - 1, BEAM_X_MAX]) spots.push(e);
for (let i = 0; i < 300; i++) spots.push(BEAM_X_MIN + Math.random() * (BEAM_X_MAX - BEAM_X_MIN));
const unreachable = [];
for (const x of spots) if (!reachable({ x: x, y: BEAM_PICKUP_Y })) unreachable.push('x=' + x.toFixed(1));
ok('kaikki ' + spots.length + ' esinepaikkaa (myös lamppujen kohdalla) poimittavissa',
    unreachable.length === 0, unreachable.slice(0, 6).join(' | '));
for (const lamp of lamps) {
    ok('täsmälleen tolpan kohdalla x=' + lamp.x + ' → poimittavissa',
        reachable({ x: lamp.x, y: BEAM_PICKUP_Y }));
}
ok('kaistan reunat (' + BEAM_X_MIN + ' ja ' + BEAM_X_MAX + ') poimittavissa',
    reachable({ x: BEAM_X_MIN, y: BEAM_PICKUP_Y }) && reachable({ x: BEAM_X_MAX, y: BEAM_PICKUP_Y }));

/* ── E) miksi kiinteä viiva on parempi kuin vanha satunnainen y ────── */
section('E) vanha satunnainen y vs. kiinteä aidan viiva');
// Pylväs peittää alleen kaiken, mikä on sen juuren (325) yläpuolella.
let hiddenOld = 0, testedOld = 0;
for (let y = COIN_Y_MIN; y <= COIN_Y_MAX + 0.001; y += 1) {
    testedOld++;
    if (y - 15 >= lampPoleTop && y <= LAMP_BASE_Y) hiddenOld++;   // koko sprite pylvään takana
}
ok('VANHA: tolpan kohdalle osunut esine jäi ' + hiddenOld + '/' + testedOld +
    ' y-arvolla pylvään taakse piiloon (y ≤ ' + LAMP_BASE_Y + ')',
    hiddenOld > 0 && !(BEAM_PICKUP_Y - 15 >= lampPoleTop && BEAM_PICKUP_Y <= LAMP_BASE_Y),
    'uusi y ' + BEAM_PICKUP_Y + ' ei ole piilossa');
ok('UUSI: esine (' + (BEAM_PICKUP_Y - 15) + '…' + BEAM_PICKUP_Y + ') ja vilkkuva piste (' +
    (BEAM_PICKUP_Y - 20) + ') ovat pylvään juuren (' + LAMP_BASE_Y + ') alapuolella → aina näkyvissä',
    BEAM_PICKUP_Y - 20 > LAMP_BASE_Y);

// Tolpan estoblokki: ei laukea aidan viivalla, mutta laukeaa vielä syvyydessä,
// jossa esine satunnaisesti oli (esim. 290) → täsmäasettuminen oli hankalaa.
const lamp0 = lamps[0].x;
function blockMoves(py) {
    const p = { x: lamp0 - pw / 2, y: py, w: pw, h: ph };   // keskipiste täsmälleen tolpassa
    applyLampBlock(p, lamps, GROUND_Y, WORLD_W);
    return Math.abs((p.x + pw / 2) - lamp0) > 0.01;
}
ok('tolppablokki AKTIIVINEN syvyydellä 290 (vanha satunnainen esine saattoi olla tässä) → työntää pois',
    blockMoves(290));
ok('tolppablokki EI laukea aidan viivalla (y 350) → pelaaja saa seistä tolpan kohdalla',
    !blockMoves(350));
ok('liikenne ei yllä aidan juureen (turvaraja y ' + LANE_SAFE_Y + ' ≤ 350) → poiminta onnistuu rauhassa',
    350 >= LANE_SAFE_Y, LANE_SAFE_Y);

/* ── F) lähdekoodin siisteys ───────────────────────────────────────── */
section('F) lähdekoodin siisteys');
ok('spawnBeamPickup ei enää kutsu randomCoinY:tä', !/randomCoinY/.test(spawnSrc));
ok('spawnBeamPickup ei enää kutsu randomCoinX:tä', !/randomCoinX/.test(spawnSrc));
ok('y tulee vakiosta BEAM_PICKUP_Y', /y: BEAM_PICKUP_Y/.test(spawnSrc));
ok('kommentti kertoo syyn (lampputolppa)', /lampputolpan/.test(src), '');

console.log('');
console.log('TULOS: ' + pass + ' OK / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
